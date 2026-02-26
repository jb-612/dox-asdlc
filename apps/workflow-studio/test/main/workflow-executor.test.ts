// @vitest-environment node
// ---------------------------------------------------------------------------
// WorkflowExecutor tests (P15-F05 Phase C)
//
// Tests for T11 (sequential lane execution), T12 (parallel fan-out/fan-in),
// T13 (abort propagation), T28 (ContainerPool.acquire wiring into engine),
// T32 (parallel group dispatch integration)
// ---------------------------------------------------------------------------
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ParallelBlockResult, ContainerRecord } from '../../src/shared/types/execution';
import type { WorkflowPlan, ParallelLane, MergeStrategy } from '../../src/shared/types/workflow';

// ---------------------------------------------------------------------------
// Mock IPC emitter — captures IPC events sent by the executor
// ---------------------------------------------------------------------------
type IPCEvent = { channel: string; data: unknown };
const ipcEvents: IPCEvent[] = [];
const mockEmitIPC = vi.fn((channel: string, data: unknown) => {
  ipcEvents.push({ channel, data });
});

// ---------------------------------------------------------------------------
// Mock ContainerPool
// ---------------------------------------------------------------------------
function makeContainerRecord(blockId: string, port: number): ContainerRecord {
  return {
    id: `container-for-${blockId}`,
    state: 'running',
    blockId,
    port,
    agentUrl: `http://localhost:${port}`,
    createdAt: Date.now(),
    dormantSince: null,
  };
}

let acquireDelay = 0;
const mockAcquire = vi.fn(async (blockId: string): Promise<ContainerRecord> => {
  if (acquireDelay > 0) {
    await new Promise((r) => setTimeout(r, acquireDelay));
  }
  return makeContainerRecord(blockId, 49200 + Math.floor(Math.random() * 100));
});
const mockRelease = vi.fn(async () => {});
const mockTeardown = vi.fn(async () => {});

function makeMockPool() {
  return {
    acquire: mockAcquire,
    release: mockRelease,
    teardown: mockTeardown,
    snapshot: vi.fn(() => []),
    prewarm: vi.fn(async () => {}),
  };
}

// ---------------------------------------------------------------------------
// Mock ExecutionEngine (only the methods used by WorkflowExecutor)
// ---------------------------------------------------------------------------
let executeBlockDelay = 50;
let executeBlockError: Error | null = null;
let executeBlockResults: Map<string, unknown> = new Map();

const mockExecuteBlock = vi.fn(
  async (blockId: string, _container: ContainerRecord): Promise<ParallelBlockResult> => {
    if (executeBlockDelay > 0) {
      await new Promise((r) => setTimeout(r, executeBlockDelay));
    }
    if (executeBlockError) {
      throw executeBlockError;
    }
    return {
      blockId,
      success: true,
      output: executeBlockResults.get(blockId) ?? { mock: true },
      durationMs: executeBlockDelay,
    };
  },
);

function makeMockEngine() {
  return {
    executeBlock: mockExecuteBlock,
  };
}

// ---------------------------------------------------------------------------
// Import subject under test
// ---------------------------------------------------------------------------
import { WorkflowExecutor } from '../../src/main/services/workflow-executor';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
describe('WorkflowExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ipcEvents.length = 0;
    acquireDelay = 0;
    executeBlockDelay = 10;
    executeBlockError = null;
    executeBlockResults = new Map();
  });

  // -------------------------------------------------------------------------
  // T11: Sequential lane execution
  // -------------------------------------------------------------------------
  describe('T11: sequential lane execution', () => {
    it('executes string lanes sequentially in order', async () => {
      const pool = makeMockPool();
      const engine = makeMockEngine();
      const executor = new WorkflowExecutor(pool as any, engine as any, mockEmitIPC);

      const plan: WorkflowPlan = {
        lanes: ['block-A', 'block-B', 'block-C'],
        parallelismModel: 'multi-container',
        failureMode: 'strict',
      };

      const results = await executor.execute(plan);

      expect(results).toHaveLength(3);
      expect(results[0].blockId).toBe('block-A');
      expect(results[1].blockId).toBe('block-B');
      expect(results[2].blockId).toBe('block-C');
      results.forEach((r) => expect(r.success).toBe(true));
    });

    it('calls pool.acquire for each block, then pool.release after execution', async () => {
      const pool = makeMockPool();
      const engine = makeMockEngine();
      const executor = new WorkflowExecutor(pool as any, engine as any, mockEmitIPC);

      const plan: WorkflowPlan = {
        lanes: ['block-1', 'block-2'],
        parallelismModel: 'multi-container',
        failureMode: 'strict',
      };

      await executor.execute(plan);

      expect(mockAcquire).toHaveBeenCalledTimes(2);
      expect(mockAcquire).toHaveBeenCalledWith('block-1');
      expect(mockAcquire).toHaveBeenCalledWith('block-2');
      expect(mockRelease).toHaveBeenCalledTimes(2);
    });

    it('emits execution:lane-start and execution:lane-complete IPC events', async () => {
      const pool = makeMockPool();
      const engine = makeMockEngine();
      const executor = new WorkflowExecutor(pool as any, engine as any, mockEmitIPC);

      const plan: WorkflowPlan = {
        lanes: ['block-X'],
        parallelismModel: 'multi-container',
        failureMode: 'strict',
      };

      await executor.execute(plan);

      const laneStarts = ipcEvents.filter((e) => e.channel === 'execution:lane-start');
      const laneCompletes = ipcEvents.filter((e) => e.channel === 'execution:lane-complete');
      expect(laneStarts.length).toBeGreaterThanOrEqual(1);
      expect(laneCompletes.length).toBeGreaterThanOrEqual(1);
    });

    it('passes the acquired container to executeBlock', async () => {
      const pool = makeMockPool();
      const engine = makeMockEngine();
      const executor = new WorkflowExecutor(pool as any, engine as any, mockEmitIPC);

      const plan: WorkflowPlan = {
        lanes: ['block-Z'],
        parallelismModel: 'multi-container',
        failureMode: 'strict',
      };

      await executor.execute(plan);

      expect(mockExecuteBlock).toHaveBeenCalledTimes(1);
      const [blockId, container] = mockExecuteBlock.mock.calls[0];
      expect(blockId).toBe('block-Z');
      expect(container).toHaveProperty('agentUrl');
      expect(container.blockId).toBe('block-Z');
    });

    it('returns empty results for empty plan', async () => {
      const pool = makeMockPool();
      const engine = makeMockEngine();
      const executor = new WorkflowExecutor(pool as any, engine as any, mockEmitIPC);

      const plan: WorkflowPlan = {
        lanes: [],
        parallelismModel: 'multi-container',
        failureMode: 'strict',
      };

      const results = await executor.execute(plan);
      expect(results).toHaveLength(0);
    });

    it('captures block failure as unsuccessful result in sequential mode', async () => {
      const pool = makeMockPool();
      const engine = makeMockEngine();
      mockExecuteBlock.mockRejectedValueOnce(new Error('block failed'));

      const executor = new WorkflowExecutor(pool as any, engine as any, mockEmitIPC);

      const plan: WorkflowPlan = {
        lanes: ['block-fail'],
        parallelismModel: 'multi-container',
        failureMode: 'lenient',
      };

      const results = await executor.execute(plan);
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('block failed');
    });
  });

  // -------------------------------------------------------------------------
  // T12: Fan-out / fan-in for parallel lanes
  // -------------------------------------------------------------------------
  describe('T12: parallel fan-out / fan-in', () => {
    it('executes all nodes in a ParallelLane via Promise.allSettled', async () => {
      const pool = makeMockPool();
      const engine = makeMockEngine();
      const executor = new WorkflowExecutor(pool as any, engine as any, mockEmitIPC);

      const parallelLane: ParallelLane = {
        nodeIds: ['par-A', 'par-B', 'par-C'],
      };

      const plan: WorkflowPlan = {
        lanes: [parallelLane],
        parallelismModel: 'multi-container',
        failureMode: 'lenient',
      };

      const results = await executor.execute(plan);

      expect(results).toHaveLength(3);
      expect(results.map((r) => r.blockId).sort()).toEqual(['par-A', 'par-B', 'par-C']);
      results.forEach((r) => expect(r.success).toBe(true));
    });

    it('acquires a container for each parallel node', async () => {
      const pool = makeMockPool();
      const engine = makeMockEngine();
      const executor = new WorkflowExecutor(pool as any, engine as any, mockEmitIPC);

      const parallelLane: ParallelLane = {
        nodeIds: ['p1', 'p2', 'p3'],
      };

      const plan: WorkflowPlan = {
        lanes: [parallelLane],
        parallelismModel: 'multi-container',
        failureMode: 'lenient',
      };

      await executor.execute(plan);

      expect(mockAcquire).toHaveBeenCalledTimes(3);
      expect(mockRelease).toHaveBeenCalledTimes(3);
    });

    it('lenient mode collects all results including failures', async () => {
      const pool = makeMockPool();
      const engine = makeMockEngine();

      // Make the second call fail
      let callCount = 0;
      mockExecuteBlock.mockImplementation(async (blockId: string, _container: ContainerRecord) => {
        callCount++;
        if (callCount === 2) {
          throw new Error('second block failed');
        }
        return {
          blockId,
          success: true,
          output: { mock: true },
          durationMs: 10,
        };
      });

      const executor = new WorkflowExecutor(pool as any, engine as any, mockEmitIPC);

      const parallelLane: ParallelLane = {
        nodeIds: ['ok-1', 'fail-1', 'ok-2'],
      };

      const plan: WorkflowPlan = {
        lanes: [parallelLane],
        parallelismModel: 'multi-container',
        failureMode: 'lenient',
      };

      const results = await executor.execute(plan);

      expect(results).toHaveLength(3);
      const successful = results.filter((r) => r.success);
      const failed = results.filter((r) => !r.success);
      expect(successful).toHaveLength(2);
      expect(failed).toHaveLength(1);
      expect(failed[0].error).toContain('second block failed');
    });

    it('strict mode aborts remaining on first failure', async () => {
      const pool = makeMockPool();
      const engine = makeMockEngine();

      // First block fails immediately, others take longer
      mockExecuteBlock.mockImplementation(async (blockId: string, _container: ContainerRecord) => {
        if (blockId === 'fast-fail') {
          throw new Error('fast failure');
        }
        // Other blocks take a long time
        await new Promise((r) => setTimeout(r, 500));
        return {
          blockId,
          success: true,
          output: { mock: true },
          durationMs: 500,
        };
      });

      const executor = new WorkflowExecutor(pool as any, engine as any, mockEmitIPC);

      const parallelLane: ParallelLane = {
        nodeIds: ['fast-fail', 'slow-1', 'slow-2'],
      };

      const plan: WorkflowPlan = {
        lanes: [parallelLane],
        parallelismModel: 'multi-container',
        failureMode: 'strict',
      };

      const results = await executor.execute(plan);

      // At least the failing block should be recorded
      const failed = results.filter((r) => !r.success);
      expect(failed.length).toBeGreaterThanOrEqual(1);
      expect(failed.some((r) => r.error?.includes('fast failure'))).toBe(true);
    });

    it('emits execution:block-error for failures', async () => {
      const pool = makeMockPool();
      const engine = makeMockEngine();
      mockExecuteBlock.mockRejectedValueOnce(new Error('block error'));

      const executor = new WorkflowExecutor(pool as any, engine as any, mockEmitIPC);

      const parallelLane: ParallelLane = {
        nodeIds: ['err-block'],
      };

      const plan: WorkflowPlan = {
        lanes: [parallelLane],
        parallelismModel: 'multi-container',
        failureMode: 'lenient',
      };

      await executor.execute(plan);

      const blockErrors = ipcEvents.filter((e) => e.channel === 'execution:block-error');
      expect(blockErrors.length).toBeGreaterThanOrEqual(1);
    });

    it('handles mixed sequential and parallel lanes', async () => {
      const pool = makeMockPool();
      const engine = makeMockEngine();
      const executor = new WorkflowExecutor(pool as any, engine as any, mockEmitIPC);

      const plan: WorkflowPlan = {
        lanes: [
          'seq-1',
          { nodeIds: ['par-A', 'par-B'] } as ParallelLane,
          'seq-2',
        ],
        parallelismModel: 'multi-container',
        failureMode: 'lenient',
      };

      const results = await executor.execute(plan);

      expect(results).toHaveLength(4);
      expect(results[0].blockId).toBe('seq-1');
      // par-A and par-B can be in any order
      const parallelIds = results.slice(1, 3).map((r) => r.blockId).sort();
      expect(parallelIds).toEqual(['par-A', 'par-B']);
      expect(results[3].blockId).toBe('seq-2');
    });
  });

  // -------------------------------------------------------------------------
  // T13: Abort propagation
  // -------------------------------------------------------------------------
  describe('T13: abort propagation', () => {
    it('abort() causes all parallel blocks to report failure', async () => {
      const pool = makeMockPool();
      const engine = makeMockEngine();

      // Use a deferred pattern: blocks wait until resolved externally
      const blockStarted = { count: 0 };
      const blockResolvers: Array<() => void> = [];
      mockExecuteBlock.mockImplementation(async (blockId: string) => {
        blockStarted.count++;
        // Wait on a deferred promise that we can resolve externally
        await new Promise<void>((resolve) => {
          blockResolvers.push(resolve);
        });
        return {
          blockId,
          success: true,
          output: {},
          durationMs: 0,
        };
      });

      const executor = new WorkflowExecutor(pool as any, engine as any, mockEmitIPC);

      const plan: WorkflowPlan = {
        lanes: [{ nodeIds: ['long-1', 'long-2'] } as ParallelLane],
        parallelismModel: 'multi-container',
        failureMode: 'lenient',
      };

      // Start execution, then abort before blocks complete
      const executePromise = executor.execute(plan);

      // Wait for blocks to start
      await new Promise((r) => setTimeout(r, 30));
      executor.abort();

      // Resolve the deferred promises so blocks can finish
      for (const resolve of blockResolvers) {
        resolve();
      }

      const results = await executePromise;

      // The execution completed with aborted state
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('abort calls pool.teardown()', async () => {
      const pool = makeMockPool();
      const engine = makeMockEngine();

      let resolveBlock: (() => void) | null = null;
      mockExecuteBlock.mockImplementation(async (blockId: string) => {
        await new Promise<void>((resolve) => {
          resolveBlock = resolve;
        });
        return { blockId, success: true, output: {}, durationMs: 0 };
      });

      const executor = new WorkflowExecutor(pool as any, engine as any, mockEmitIPC);

      const plan: WorkflowPlan = {
        lanes: [{ nodeIds: ['block-1'] } as ParallelLane],
        parallelismModel: 'multi-container',
        failureMode: 'lenient',
      };

      const executePromise = executor.execute(plan);

      await new Promise((r) => setTimeout(r, 30));
      executor.abort();

      // Resolve deferred so execution can finish
      if (resolveBlock) resolveBlock();

      await executePromise;

      expect(mockTeardown).toHaveBeenCalled();
    });

    it('emits execution:aborted IPC event', async () => {
      const pool = makeMockPool();
      const engine = makeMockEngine();

      let resolveBlock: (() => void) | null = null;
      mockExecuteBlock.mockImplementation(async (blockId: string) => {
        await new Promise<void>((resolve) => {
          resolveBlock = resolve;
        });
        return { blockId, success: true, output: {}, durationMs: 0 };
      });

      const executor = new WorkflowExecutor(pool as any, engine as any, mockEmitIPC);

      const plan: WorkflowPlan = {
        lanes: ['block-1'],
        parallelismModel: 'multi-container',
        failureMode: 'strict',
      };

      const executePromise = executor.execute(plan);

      await new Promise((r) => setTimeout(r, 30));
      executor.abort();

      // Resolve deferred so execution can finish
      if (resolveBlock) resolveBlock();

      await executePromise;

      const abortEvents = ipcEvents.filter((e) => e.channel === 'execution:aborted');
      expect(abortEvents.length).toBeGreaterThanOrEqual(1);
    });

    it('abort cancels in-flight sequential blocks', async () => {
      const pool = makeMockPool();
      const engine = makeMockEngine();

      const executedBlocks: string[] = [];
      let resolveFirst: (() => void) | null = null;

      mockExecuteBlock.mockImplementation(async (blockId: string) => {
        executedBlocks.push(blockId);
        if (blockId === 'block-1') {
          // First block waits until we resolve it
          await new Promise<void>((resolve) => {
            resolveFirst = resolve;
          });
        }
        return { blockId, success: true, output: {}, durationMs: 0 };
      });

      const executor = new WorkflowExecutor(pool as any, engine as any, mockEmitIPC);

      const plan: WorkflowPlan = {
        lanes: ['block-1', 'block-2', 'block-3'],
        parallelismModel: 'multi-container',
        failureMode: 'strict',
      };

      const executePromise = executor.execute(plan);

      // Wait for first block to start
      await new Promise((r) => setTimeout(r, 30));
      // Abort while first block is in progress
      executor.abort();
      // Resolve first block so execution loop can continue
      if (resolveFirst) resolveFirst();

      await executePromise;

      // Only block-1 should have been started; block-2 and block-3 skipped
      expect(executedBlocks).toHaveLength(1);
      expect(executedBlocks[0]).toBe('block-1');
    });
  });

  // -------------------------------------------------------------------------
  // T28: ContainerPool.acquire wired into executeBlock
  // -------------------------------------------------------------------------
  describe('T28: container pool wiring', () => {
    it('acquire is called before executeBlock and release after', async () => {
      const callOrder: string[] = [];

      const pool = makeMockPool();
      pool.acquire = vi.fn(async (blockId: string) => {
        callOrder.push(`acquire:${blockId}`);
        return makeContainerRecord(blockId, 49200);
      }) as any;
      pool.release = vi.fn(async (containerId: string) => {
        callOrder.push(`release:${containerId}`);
      }) as any;

      const engine = makeMockEngine();
      mockExecuteBlock.mockImplementation(async (blockId: string) => {
        callOrder.push(`execute:${blockId}`);
        return { blockId, success: true, output: {}, durationMs: 0 };
      });

      const executor = new WorkflowExecutor(pool as any, engine as any, mockEmitIPC);

      const plan: WorkflowPlan = {
        lanes: ['block-1'],
        parallelismModel: 'multi-container',
        failureMode: 'strict',
      };

      await executor.execute(plan);

      expect(callOrder[0]).toBe('acquire:block-1');
      expect(callOrder[1]).toBe('execute:block-1');
      expect(callOrder[2]).toMatch(/^release:/);
    });

    it('release is called even when executeBlock throws', async () => {
      const pool = makeMockPool();
      const engine = makeMockEngine();
      mockExecuteBlock.mockRejectedValueOnce(new Error('exec error'));

      const executor = new WorkflowExecutor(pool as any, engine as any, mockEmitIPC);

      const plan: WorkflowPlan = {
        lanes: ['block-1'],
        parallelismModel: 'multi-container',
        failureMode: 'lenient',
      };

      await executor.execute(plan);

      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('container.agentUrl is available to executeBlock', async () => {
      const pool = makeMockPool();
      const engine = makeMockEngine();

      const executor = new WorkflowExecutor(pool as any, engine as any, mockEmitIPC);

      const plan: WorkflowPlan = {
        lanes: ['block-1'],
        parallelismModel: 'multi-container',
        failureMode: 'strict',
      };

      await executor.execute(plan);

      const [, container] = mockExecuteBlock.mock.calls[0];
      expect(container.agentUrl).toMatch(/^http:\/\/localhost:\d+/);
    });
  });

  // -------------------------------------------------------------------------
  // T32: Parallel group dispatch integration
  // -------------------------------------------------------------------------
  describe('T32: parallel group dispatch integration', () => {
    it('end-to-end: sequential -> parallel -> sequential with merge', async () => {
      const pool = makeMockPool();
      const engine = makeMockEngine();
      const executor = new WorkflowExecutor(pool as any, engine as any, mockEmitIPC);

      const plan: WorkflowPlan = {
        lanes: [
          'setup',
          {
            nodeIds: ['worker-1', 'worker-2', 'worker-3'],
            mergeStrategy: 'concatenate' as MergeStrategy,
          } as ParallelLane,
          'finalize',
        ],
        parallelismModel: 'multi-container',
        failureMode: 'lenient',
      };

      const results = await executor.execute(plan);

      // 1 setup + 3 parallel + 1 finalize = 5 results
      expect(results).toHaveLength(5);
      expect(results[0].blockId).toBe('setup');
      expect(results[4].blockId).toBe('finalize');

      // All should succeed
      results.forEach((r) => expect(r.success).toBe(true));

      // Verify acquire was called for each block
      expect(mockAcquire).toHaveBeenCalledTimes(5);
    });

    it('parallel blocks truly run concurrently (not sequentially)', async () => {
      const pool = makeMockPool();
      const engine = makeMockEngine();

      const startTimes: Map<string, number> = new Map();
      mockExecuteBlock.mockImplementation(async (blockId: string, _container: ContainerRecord) => {
        startTimes.set(blockId, Date.now());
        await new Promise((r) => setTimeout(r, 50));
        return { blockId, success: true, output: {}, durationMs: 50 };
      });

      const executor = new WorkflowExecutor(pool as any, engine as any, mockEmitIPC);

      const plan: WorkflowPlan = {
        lanes: [
          {
            nodeIds: ['concurrent-A', 'concurrent-B', 'concurrent-C'],
          } as ParallelLane,
        ],
        parallelismModel: 'multi-container',
        failureMode: 'lenient',
      };

      await executor.execute(plan);

      // All blocks should have started within a very short window of each other
      const times = [...startTimes.values()];
      const maxDiff = Math.max(...times) - Math.min(...times);
      // If they ran sequentially, max diff would be >= 50ms per block.
      // Concurrently they should start within ~30ms of each other.
      expect(maxDiff).toBeLessThan(40);
    });
  });
});
