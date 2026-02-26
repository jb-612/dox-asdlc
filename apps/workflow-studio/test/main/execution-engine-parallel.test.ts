// @vitest-environment node
// ---------------------------------------------------------------------------
// T07 + T08: ExecutionEngine parallel detection and startParallel()
//
// T07: Parallel detection in start() — routes to startParallel when
//      workflow.parallelGroups is present and pool is available.
// T08: startParallel() creates WorkflowExecutor and delegates execution.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { BrowserWindow } from 'electron';
import type { WorkflowDefinition, ParallelGroup } from '../../src/shared/types/workflow';
import type { ParallelBlockResult } from '../../src/shared/types/execution';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
}));

let uuidCounter = 0;
vi.mock('uuid', () => ({
  v4: () => `test-uuid-${++uuidCounter}`,
}));

// Mock WorkflowExecutor so we can verify delegation
const mockExecute = vi.fn<[], Promise<ParallelBlockResult[]>>();
const mockWorkflowExecutorInstance = { execute: mockExecute, abort: vi.fn() };
const MockWorkflowExecutor = vi.fn().mockReturnValue(mockWorkflowExecutorInstance);

vi.mock('../../src/main/services/workflow-executor', () => ({
  WorkflowExecutor: MockWorkflowExecutor,
}));

// Mock ExecutorEngineAdapter
const MockExecutorEngineAdapter = vi.fn().mockReturnValue({
  executeBlock: vi.fn(),
});

vi.mock('../../src/main/services/executor-engine-adapter', () => ({
  ExecutorEngineAdapter: MockExecutorEngineAdapter,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockMainWindow(): BrowserWindow {
  return {
    webContents: {
      send: vi.fn(),
    },
  } as unknown as BrowserWindow;
}

function createMockContainerPool() {
  return {
    acquire: vi.fn(),
    release: vi.fn(),
    teardown: vi.fn(),
  };
}

function createWorkflowWithParallelGroups(
  parallelGroups: ParallelGroup[],
): WorkflowDefinition {
  const nodeIds = parallelGroups.flatMap((g) => g.laneNodeIds);
  const nodes = nodeIds.map((id) => ({
    id,
    type: 'backend' as const,
    label: `Node ${id}`,
    config: {},
    inputs: [],
    outputs: [],
    position: { x: 0, y: 0 },
  }));

  return {
    id: 'workflow-parallel-1',
    metadata: {
      name: 'Parallel Workflow',
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
    },
    nodes,
    transitions: [],
    gates: [],
    variables: [],
    parallelGroups,
  };
}

function createSequentialWorkflow(): WorkflowDefinition {
  return {
    id: 'workflow-seq-1',
    metadata: {
      name: 'Sequential Workflow',
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
    },
    nodes: [
      {
        id: 'node-1',
        type: 'backend',
        label: 'Backend',
        config: {},
        inputs: [],
        outputs: [],
        position: { x: 0, y: 0 },
      },
    ],
    transitions: [],
    gates: [],
    variables: [],
    // No parallelGroups
  };
}

// ---------------------------------------------------------------------------
// Tests — T07: Parallel detection in start()
// ---------------------------------------------------------------------------

describe('ExecutionEngine parallel detection (T07)', () => {
  let ExecutionEngine: typeof import('../../src/main/services/execution-engine').ExecutionEngine;
  let mockMainWindow: BrowserWindow;

  beforeEach(async () => {
    vi.clearAllMocks();
    uuidCounter = 0;
    mockMainWindow = createMockMainWindow();

    const mod = await import('../../src/main/services/execution-engine');
    ExecutionEngine = mod.ExecutionEngine;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls startParallel when workflow has parallelGroups and pool is available', async () => {
    const pool = createMockContainerPool();
    const engine = new ExecutionEngine(mockMainWindow, { mockMode: true });

    // Set the container pool on the engine
    engine.containerPool = pool;

    const workflow = createWorkflowWithParallelGroups([
      {
        id: 'group-1',
        label: 'Dev Group',
        laneNodeIds: ['node-a', 'node-b'],
      },
    ]);

    // Mock WorkflowExecutor.execute to return results
    mockExecute.mockResolvedValue([
      { blockId: 'node-a', success: true, output: { mock: true }, durationMs: 100 },
      { blockId: 'node-b', success: true, output: { mock: true }, durationMs: 150 },
    ]);

    const execution = await engine.start(workflow);

    // Should have created a WorkflowExecutor
    expect(MockWorkflowExecutor).toHaveBeenCalledTimes(1);
    // Should have called execute on the executor
    expect(mockExecute).toHaveBeenCalledTimes(1);
    // Execution should complete
    expect(execution.status).toBe('completed');
  });

  it('emits error event when workflow has parallelGroups but no pool', async () => {
    const engine = new ExecutionEngine(mockMainWindow, { mockMode: true });
    // Do NOT set containerPool

    const workflow = createWorkflowWithParallelGroups([
      {
        id: 'group-1',
        label: 'Dev Group',
        laneNodeIds: ['node-a', 'node-b'],
      },
    ]);

    const execution = await engine.start(workflow);

    expect(execution.status).toBe('failed');
    // Should have an event indicating pool is not available
    const failEvent = execution.events.find(
      (e) => e.type === 'execution_failed',
    );
    expect(failEvent).toBeDefined();
    expect(failEvent!.message).toContain('container pool');
  });

  it('continues sequential execution when no parallelGroups', async () => {
    const engine = new ExecutionEngine(mockMainWindow, { mockMode: true });

    const workflow = createSequentialWorkflow();
    const execution = await engine.start(workflow);

    // Should NOT have called WorkflowExecutor
    expect(MockWorkflowExecutor).not.toHaveBeenCalled();
    // Should complete via sequential mock
    expect(execution.status).toBe('completed');
    expect(execution.nodeStates['node-1'].status).toBe('completed');
  });

  it('continues sequential execution when parallelGroups is empty array', async () => {
    const engine = new ExecutionEngine(mockMainWindow, { mockMode: true });

    const workflow = createSequentialWorkflow();
    workflow.parallelGroups = [];

    const execution = await engine.start(workflow);

    expect(MockWorkflowExecutor).not.toHaveBeenCalled();
    expect(execution.status).toBe('completed');
  });
});

// ---------------------------------------------------------------------------
// Tests — T08: startParallel() with WorkflowExecutor delegation
// ---------------------------------------------------------------------------

describe('ExecutionEngine startParallel (T08)', () => {
  let ExecutionEngine: typeof import('../../src/main/services/execution-engine').ExecutionEngine;
  let mockMainWindow: BrowserWindow;

  beforeEach(async () => {
    vi.clearAllMocks();
    uuidCounter = 0;
    mockMainWindow = createMockMainWindow();

    // Re-configure mock implementations after clearAllMocks
    MockWorkflowExecutor.mockReturnValue(mockWorkflowExecutorInstance);
    MockExecutorEngineAdapter.mockReturnValue({ executeBlock: vi.fn() });

    const mod = await import('../../src/main/services/execution-engine');
    ExecutionEngine = mod.ExecutionEngine;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates WorkflowExecutor and calls execute with plan', async () => {
    const pool = createMockContainerPool();
    const engine = new ExecutionEngine(mockMainWindow, { mockMode: true });
    engine.containerPool = pool;

    const workflow = createWorkflowWithParallelGroups([
      {
        id: 'group-1',
        label: 'Dev Group',
        laneNodeIds: ['node-a', 'node-b'],
      },
    ]);

    mockExecute.mockResolvedValue([
      { blockId: 'node-a', success: true, output: {}, durationMs: 100 },
      { blockId: 'node-b', success: true, output: {}, durationMs: 150 },
    ]);

    await engine.start(workflow);

    // Verify the WorkflowExecutor was constructed with pool, adapter, emitIPC
    expect(MockWorkflowExecutor).toHaveBeenCalledTimes(1);
    const ctorArgs = MockWorkflowExecutor.mock.calls[0];
    expect(ctorArgs[0]).toBe(pool); // pool
    expect(ctorArgs[1]).toBeDefined(); // adapter (ExecutorEngineAdapter instance)
    expect(typeof ctorArgs[2]).toBe('function'); // emitIPC function

    // Verify execute was called with a plan
    expect(mockExecute).toHaveBeenCalledTimes(1);
    const plan = mockExecute.mock.calls[0][0];
    expect(plan.lanes).toBeDefined();
    expect(plan.failureMode).toBe('lenient');
  });

  it('maps ParallelBlockResult back to nodeStates', async () => {
    const pool = createMockContainerPool();
    const engine = new ExecutionEngine(mockMainWindow, { mockMode: true });
    engine.containerPool = pool;

    const workflow = createWorkflowWithParallelGroups([
      {
        id: 'group-1',
        label: 'Dev Group',
        laneNodeIds: ['node-a', 'node-b'],
      },
    ]);

    mockExecute.mockResolvedValue([
      { blockId: 'node-a', success: true, output: { data: 'a' }, durationMs: 100 },
      { blockId: 'node-b', success: false, output: null, error: 'build failed', durationMs: 200 },
    ]);

    const execution = await engine.start(workflow);

    // node-a should be completed
    expect(execution.nodeStates['node-a'].status).toBe('completed');
    // node-b should be failed
    expect(execution.nodeStates['node-b'].status).toBe('failed');
    expect(execution.nodeStates['node-b'].error).toBe('build failed');
  });

  it('emits execution events for lane start/complete', async () => {
    const pool = createMockContainerPool();
    const engine = new ExecutionEngine(mockMainWindow, { mockMode: true });
    engine.containerPool = pool;

    const workflow = createWorkflowWithParallelGroups([
      {
        id: 'group-1',
        label: 'Dev Group',
        laneNodeIds: ['node-a'],
      },
    ]);

    mockExecute.mockResolvedValue([
      { blockId: 'node-a', success: true, output: {}, durationMs: 100 },
    ]);

    const execution = await engine.start(workflow);

    // Should have emitted execution_started
    const startEvent = execution.events.find(
      (e) => e.type === 'execution_started',
    );
    expect(startEvent).toBeDefined();

    // Should have completed or failed (but not stayed in running)
    expect(['completed', 'failed']).toContain(execution.status);
  });

  it('sets execution status to failed when any parallel block fails', async () => {
    const pool = createMockContainerPool();
    const engine = new ExecutionEngine(mockMainWindow, { mockMode: true });
    engine.containerPool = pool;

    const workflow = createWorkflowWithParallelGroups([
      {
        id: 'group-1',
        label: 'Dev Group',
        laneNodeIds: ['node-a', 'node-b'],
      },
    ]);

    mockExecute.mockResolvedValue([
      { blockId: 'node-a', success: true, output: {}, durationMs: 100 },
      { blockId: 'node-b', success: false, output: null, error: 'timeout', durationMs: 5000 },
    ]);

    const execution = await engine.start(workflow);

    // Overall execution should be failed since node-b failed
    expect(execution.status).toBe('failed');
  });

  it('handles WorkflowExecutor.execute rejection gracefully', async () => {
    const pool = createMockContainerPool();
    const engine = new ExecutionEngine(mockMainWindow, { mockMode: true });
    engine.containerPool = pool;

    const workflow = createWorkflowWithParallelGroups([
      {
        id: 'group-1',
        label: 'Dev Group',
        laneNodeIds: ['node-a'],
      },
    ]);

    mockExecute.mockRejectedValue(new Error('Pool exhausted'));

    const execution = await engine.start(workflow);

    expect(execution.status).toBe('failed');
    const failEvent = execution.events.find(
      (e) => e.type === 'execution_failed',
    );
    expect(failEvent).toBeDefined();
  });
});
