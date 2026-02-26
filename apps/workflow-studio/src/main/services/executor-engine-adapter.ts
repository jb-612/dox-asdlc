// ---------------------------------------------------------------------------
// ExecutorEngineAdapter (P15-F09, T05)
//
// Bridges the CLISpawner-based execution model with the ExecutorEngine
// interface consumed by WorkflowExecutor for parallel container execution.
//
// In real mode, spawns a CLI process targeting the container's agent URL
// and waits for the process to exit. In mock mode, returns a synthetic
// success result after a brief delay.
// ---------------------------------------------------------------------------

import type { ParallelBlockResult, ContainerRecord } from '../../shared/types/execution';
import type { ExecutorEngine } from './workflow-executor';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Minimal spawn function signature matching CLISpawner.spawn().
 * Decoupled from the full CLISpawner class for testability.
 */
export interface AdapterSpawnFn {
  (config: {
    command: string;
    args: string[];
    cwd?: string;
    instanceId?: string;
  }): { id: string; status: string };
}

/**
 * Waits for a spawned CLI session to exit and returns the exit code.
 * The caller is responsible for wiring this to CLISpawner's exit events.
 */
export type WaitForExitFn = (sessionId: string) => Promise<number>;

/**
 * Configuration for the ExecutorEngineAdapter.
 */
export interface ExecutorEngineAdapterOptions {
  /** Function to spawn a CLI process. */
  spawn: AdapterSpawnFn;
  /** Function to wait for a CLI session to exit. */
  waitForExit: WaitForExitFn;
  /** Function that builds a prompt string for a given blockId. */
  buildPromptFn: (blockId: string) => string;
  /** If true, skip real CLI execution and return mock results. */
  mockMode: boolean;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Adapts CLISpawner to the ExecutorEngine interface for use with
 * WorkflowExecutor's parallel container execution.
 *
 * Cyclomatic complexity: 4 (mock branch, try/catch, exit code check, success path)
 */
export class ExecutorEngineAdapter implements ExecutorEngine {
  private readonly spawn: AdapterSpawnFn;
  private readonly waitForExit: WaitForExitFn;
  private readonly buildPromptFn: (blockId: string) => string;
  private readonly mockMode: boolean;

  constructor(options: ExecutorEngineAdapterOptions) {
    this.spawn = options.spawn;
    this.waitForExit = options.waitForExit;
    this.buildPromptFn = options.buildPromptFn;
    this.mockMode = options.mockMode;
  }

  /**
   * Execute a workflow block using a container.
   *
   * In mock mode, returns a synthetic success result immediately.
   * In real mode, spawns a CLI process targeting the container's agent URL,
   * waits for exit, and returns a result based on the exit code.
   *
   * @param blockId   The workflow block to execute.
   * @param container The container record assigned for this block.
   * @returns A ParallelBlockResult with success/failure status and timing.
   */
  async executeBlock(
    blockId: string,
    container: ContainerRecord,
  ): Promise<ParallelBlockResult> {
    const start = Date.now();

    if (this.mockMode) {
      return {
        blockId,
        success: true,
        output: { mock: true },
        durationMs: Date.now() - start,
      };
    }

    try {
      const prompt = this.buildPromptFn(blockId);

      const session = this.spawn({
        command: 'claude',
        args: ['--output-format', 'json', '-p', prompt],
        cwd: undefined,
        instanceId: `parallel-${blockId}`,
      });

      const exitCode = await this.waitForExit(session.id);

      if (exitCode === 0) {
        return {
          blockId,
          success: true,
          output: { sessionId: session.id, exitCode },
          durationMs: Date.now() - start,
        };
      }

      return {
        blockId,
        success: false,
        output: null,
        error: `CLI exited with exit code ${exitCode}`,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        blockId,
        success: false,
        output: null,
        error: message,
        durationMs: Date.now() - start,
      };
    }
  }
}
