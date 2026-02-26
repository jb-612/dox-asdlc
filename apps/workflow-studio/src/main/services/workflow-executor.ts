// ---------------------------------------------------------------------------
// WorkflowExecutor (P15-F05 Phase C)
//
// Executes a WorkflowPlan by iterating its lanes:
//   - String lanes (single block): acquire -> executeBlock -> release
//   - ParallelLane entries: fan-out via Promise.allSettled, fan-in results
//
// Supports two failure modes:
//   - 'strict': aborts remaining blocks on first failure via AbortController
//   - 'lenient': collects all results including failures
//
// Emits IPC events for lane lifecycle and error tracking.
//
// T11: Sequential lane execution
// T12: Fan-out / fan-in for parallel lanes
// T13: Abort propagation
// T28: ContainerPool.acquire wired into executeBlock
// T32: Parallel group dispatch integration
// ---------------------------------------------------------------------------

import type { ParallelBlockResult, ContainerRecord } from '../../shared/types/execution';
import type { WorkflowPlan, ParallelLane, FailureMode } from '../../shared/types/workflow';

// ---------------------------------------------------------------------------
// Interfaces for injected dependencies
// ---------------------------------------------------------------------------

/**
 * Minimal ContainerPool interface used by the executor.
 * Matches the public API of ContainerPool without importing the full class.
 */
export interface ExecutorContainerPool {
  acquire(blockId: string): Promise<ContainerRecord>;
  release(containerId: string): Promise<void>;
  teardown(): Promise<void>;
}

/**
 * Minimal ExecutionEngine interface used by the executor.
 * The executor only needs the ability to run a block with a container.
 */
export interface ExecutorEngine {
  executeBlock(blockId: string, container: ContainerRecord): Promise<ParallelBlockResult>;
}

/**
 * IPC event emitter function type.
 * Used to send IPC events to the renderer process.
 */
export type IPCEmitter = (channel: string, data: unknown) => void;

// ---------------------------------------------------------------------------
// WorkflowExecutor
// ---------------------------------------------------------------------------

export class WorkflowExecutor {
  private readonly pool: ExecutorContainerPool;
  private readonly engine: ExecutorEngine;
  private readonly emitIPC: IPCEmitter;

  private isAborted = false;
  private abortController: AbortController = new AbortController();

  constructor(
    pool: ExecutorContainerPool,
    engine: ExecutorEngine,
    emitIPC: IPCEmitter,
  ) {
    this.pool = pool;
    this.engine = engine;
    this.emitIPC = emitIPC;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Execute a workflow plan by walking its lanes in order.
   *
   * - String lanes are executed sequentially (acquire -> execute -> release).
   * - ParallelLane entries fan out via Promise.allSettled.
   * - Results are accumulated in order: sequential results first, then
   *   parallel results (in their settled order), then next sequential, etc.
   *
   * @param plan The computed workflow plan from buildWorkflowPlan.
   * @returns Array of ParallelBlockResult for every block executed.
   */
  async execute(plan: WorkflowPlan): Promise<ParallelBlockResult[]> {
    this.isAborted = false;
    this.abortController = new AbortController();

    const allResults: ParallelBlockResult[] = [];

    for (const lane of plan.lanes) {
      if (this.isAborted) break;

      if (typeof lane === 'string') {
        // Sequential single-block lane
        const result = await this.executeSequentialBlock(lane);
        allResults.push(result);
      } else {
        // Parallel lane
        const results = await this.executeParallelLane(
          lane,
          plan.failureMode,
        );
        allResults.push(...results);
      }
    }

    if (this.isAborted) {
      this.emitIPC('execution:aborted', { timestamp: new Date().toISOString() });
      await this.pool.teardown();
    }

    return allResults;
  }

  /**
   * Abort the current execution.
   *
   * Sets the aborted flag, signals the internal AbortController (cancelling
   * in-flight parallel blocks), and schedules pool teardown after settlement.
   */
  abort(): void {
    this.isAborted = true;
    this.abortController.abort();
  }

  // -----------------------------------------------------------------------
  // Sequential execution (T11, T28)
  // -----------------------------------------------------------------------

  /**
   * Execute a single block sequentially.
   * Acquires a container, runs the block, releases the container.
   * Always releases the container, even on failure.
   */
  private async executeSequentialBlock(blockId: string): Promise<ParallelBlockResult> {
    this.emitIPC('execution:lane-start', { blockId, type: 'sequential' });

    const start = Date.now();
    let container: ContainerRecord | null = null;

    try {
      if (this.isAborted) {
        return {
          blockId,
          success: false,
          output: null,
          error: 'Execution aborted',
          durationMs: 0,
        };
      }

      container = await this.pool.acquire(blockId);
      const result = await this.engine.executeBlock(blockId, container);

      this.emitIPC('execution:lane-complete', { blockId, result });
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.emitIPC('execution:block-error', { blockId, error });
      return {
        blockId,
        success: false,
        output: null,
        error,
        durationMs: Date.now() - start,
      };
    } finally {
      if (container) {
        try {
          await this.pool.release(container.id);
        } catch {
          // Best effort release
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // Parallel execution (T12, T13, T32)
  // -----------------------------------------------------------------------

  /**
   * Execute all nodes in a parallel lane using Promise.allSettled.
   *
   * In strict mode, the first failure signals the AbortController, causing
   * remaining in-flight blocks to detect the abort and fail fast.
   *
   * In lenient mode, all blocks run to completion regardless of failures.
   */
  private async executeParallelLane(
    lane: ParallelLane,
    failureMode: FailureMode,
  ): Promise<ParallelBlockResult[]> {
    this.emitIPC('execution:lane-start', {
      nodeIds: lane.nodeIds,
      type: 'parallel',
    });

    const signal = this.abortController.signal;

    const promises = lane.nodeIds.map((nodeId) =>
      this.executeParallelBlock(nodeId, signal, failureMode),
    );

    const settled = await Promise.allSettled(promises);

    const results: ParallelBlockResult[] = [];
    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') {
        results.push(outcome.value);
      } else {
        // Rejected promise -- extract block info from error if available
        const error = outcome.reason instanceof Error
          ? outcome.reason.message
          : String(outcome.reason);
        results.push({
          blockId: 'unknown',
          success: false,
          output: null,
          error,
          durationMs: 0,
        });
      }
    }

    this.emitIPC('execution:lane-complete', {
      nodeIds: lane.nodeIds,
      type: 'parallel',
      resultCount: results.length,
    });

    return results;
  }

  /**
   * Execute a single block within a parallel lane.
   *
   * Monitors the AbortSignal to bail out early if another block failed
   * in strict mode or if the user called abort().
   */
  private async executeParallelBlock(
    blockId: string,
    signal: AbortSignal,
    failureMode: FailureMode,
  ): Promise<ParallelBlockResult> {
    const start = Date.now();
    let container: ContainerRecord | null = null;

    try {
      // Check abort before acquiring
      if (signal.aborted || this.isAborted) {
        return {
          blockId,
          success: false,
          output: null,
          error: 'Execution aborted',
          durationMs: 0,
        };
      }

      container = await this.pool.acquire(blockId);

      // Check abort after acquiring
      if (signal.aborted || this.isAborted) {
        return {
          blockId,
          success: false,
          output: null,
          error: 'Execution aborted',
          durationMs: Date.now() - start,
        };
      }

      const result = await this.engine.executeBlock(blockId, container);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);

      this.emitIPC('execution:block-error', { blockId, error });

      // In strict mode, signal abort on first failure
      if (failureMode === 'strict' && !signal.aborted) {
        this.abortController.abort();
      }

      return {
        blockId,
        success: false,
        output: null,
        error,
        durationMs: Date.now() - start,
      };
    } finally {
      if (container) {
        try {
          await this.pool.release(container.id);
        } catch {
          // Best effort release
        }
      }
    }
  }
}
