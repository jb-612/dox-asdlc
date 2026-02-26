// @vitest-environment node
// ---------------------------------------------------------------------------
// T09: Integration test for parallel routing
//
// Verifies the full routing logic end-to-end:
//   - Workflows with parallelGroups route to WorkflowExecutor
//   - Workflows without parallelGroups route to sequential execution
//   - Workflows with parallelGroups but no pool emit an error
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
  v4: () => `routing-uuid-${++uuidCounter}`,
}));

// Track whether WorkflowExecutor was used
const mockExecute = vi.fn<[], Promise<ParallelBlockResult[]>>();
const MockWorkflowExecutor = vi.fn().mockReturnValue({
  execute: mockExecute,
  abort: vi.fn(),
});

vi.mock('../../src/main/services/workflow-executor', () => ({
  WorkflowExecutor: MockWorkflowExecutor,
}));

vi.mock('../../src/main/services/executor-engine-adapter', () => ({
  ExecutorEngineAdapter: vi.fn().mockReturnValue({
    executeBlock: vi.fn(),
  }),
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

function makeParallelWorkflow(groups: ParallelGroup[]): WorkflowDefinition {
  const nodeIds = groups.flatMap((g) => g.laneNodeIds);
  return {
    id: 'wf-routing-parallel',
    metadata: {
      name: 'Routing Test - Parallel',
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
    },
    nodes: nodeIds.map((id) => ({
      id,
      type: 'backend' as const,
      label: `Node ${id}`,
      config: {},
      inputs: [],
      outputs: [],
      position: { x: 0, y: 0 },
    })),
    transitions: [],
    gates: [],
    variables: [],
    parallelGroups: groups,
  };
}

function makeSequentialWorkflow(): WorkflowDefinition {
  return {
    id: 'wf-routing-seq',
    metadata: {
      name: 'Routing Test - Sequential',
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
    },
    nodes: [
      {
        id: 'seq-node-1',
        type: 'backend' as const,
        label: 'Sequential Node',
        config: {},
        inputs: [],
        outputs: [],
        position: { x: 0, y: 0 },
      },
      {
        id: 'seq-node-2',
        type: 'backend' as const,
        label: 'Sequential Node 2',
        config: {},
        inputs: [],
        outputs: [],
        position: { x: 0, y: 100 },
      },
    ],
    transitions: [
      {
        id: 'trans-1',
        sourceNodeId: 'seq-node-1',
        targetNodeId: 'seq-node-2',
        condition: { type: 'always' },
      },
    ],
    gates: [],
    variables: [],
    // No parallelGroups
  };
}

// ---------------------------------------------------------------------------
// Tests — T09: Parallel routing integration
// ---------------------------------------------------------------------------

describe('Parallel routing integration (T09)', () => {
  let ExecutionEngine: typeof import('../../src/main/services/execution-engine').ExecutionEngine;
  let mockMainWindow: BrowserWindow;

  beforeEach(async () => {
    vi.clearAllMocks();
    uuidCounter = 0;
    mockMainWindow = createMockMainWindow();

    // Re-configure mock implementations after clearAllMocks
    MockWorkflowExecutor.mockReturnValue({
      execute: mockExecute,
      abort: vi.fn(),
    });

    const mod = await import('../../src/main/services/execution-engine');
    ExecutionEngine = mod.ExecutionEngine;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('workflow with parallelGroups routes to WorkflowExecutor', async () => {
    const pool = createMockContainerPool();
    const engine = new ExecutionEngine(mockMainWindow, { mockMode: true });
    engine.containerPool = pool;

    const workflow = makeParallelWorkflow([
      { id: 'g1', label: 'Group 1', laneNodeIds: ['p-node-1', 'p-node-2'] },
    ]);

    mockExecute.mockResolvedValue([
      { blockId: 'p-node-1', success: true, output: {}, durationMs: 50 },
      { blockId: 'p-node-2', success: true, output: {}, durationMs: 75 },
    ]);

    const execution = await engine.start(workflow);

    // WorkflowExecutor should have been used
    expect(MockWorkflowExecutor).toHaveBeenCalledTimes(1);
    expect(mockExecute).toHaveBeenCalledTimes(1);

    // Both nodes completed via parallel path
    expect(execution.nodeStates['p-node-1'].status).toBe('completed');
    expect(execution.nodeStates['p-node-2'].status).toBe('completed');
    expect(execution.status).toBe('completed');
  });

  it('workflow without parallelGroups routes to sequential execution', { timeout: 15000 }, async () => {
    const pool = createMockContainerPool();
    const engine = new ExecutionEngine(mockMainWindow, { mockMode: true });
    engine.containerPool = pool; // Pool available, but workflow is sequential

    const workflow = makeSequentialWorkflow();
    const execution = await engine.start(workflow);

    // WorkflowExecutor should NOT have been used
    expect(MockWorkflowExecutor).not.toHaveBeenCalled();

    // Nodes should complete sequentially via mock mode
    expect(execution.nodeStates['seq-node-1'].status).toBe('completed');
    expect(execution.nodeStates['seq-node-2'].status).toBe('completed');
    expect(execution.status).toBe('completed');
  });

  it('parallelGroups with null pool emits error', async () => {
    const engine = new ExecutionEngine(mockMainWindow, { mockMode: true });
    // containerPool is NOT set (null by default)

    const workflow = makeParallelWorkflow([
      { id: 'g1', label: 'Group 1', laneNodeIds: ['p-node-1'] },
    ]);

    const execution = await engine.start(workflow);

    // WorkflowExecutor should NOT have been used
    expect(MockWorkflowExecutor).not.toHaveBeenCalled();

    // Execution should be failed
    expect(execution.status).toBe('failed');

    // Error event should mention container pool
    const failEvents = execution.events.filter(
      (e) => e.type === 'execution_failed',
    );
    expect(failEvents.length).toBeGreaterThan(0);
    const errorMessage = failEvents.map((e) => e.message).join(' ');
    expect(errorMessage.toLowerCase()).toContain('container pool');
  });

  it('multi-group workflow maps all groups into the plan', async () => {
    const pool = createMockContainerPool();
    const engine = new ExecutionEngine(mockMainWindow, { mockMode: true });
    engine.containerPool = pool;

    const workflow = makeParallelWorkflow([
      { id: 'g1', label: 'Group 1', laneNodeIds: ['p-node-1', 'p-node-2'] },
      { id: 'g2', label: 'Group 2', laneNodeIds: ['p-node-3'] },
    ]);

    mockExecute.mockResolvedValue([
      { blockId: 'p-node-1', success: true, output: {}, durationMs: 50 },
      { blockId: 'p-node-2', success: true, output: {}, durationMs: 75 },
      { blockId: 'p-node-3', success: true, output: {}, durationMs: 60 },
    ]);

    const execution = await engine.start(workflow);

    // Verify the plan passed to execute has lanes for all groups
    const plan = mockExecute.mock.calls[0][0];
    expect(plan.lanes.length).toBe(2); // Two groups -> two lanes

    expect(execution.status).toBe('completed');
  });

  it('mixed results: some blocks succeed, some fail', async () => {
    const pool = createMockContainerPool();
    const engine = new ExecutionEngine(mockMainWindow, { mockMode: true });
    engine.containerPool = pool;

    const workflow = makeParallelWorkflow([
      { id: 'g1', label: 'Group 1', laneNodeIds: ['p-node-1', 'p-node-2'] },
    ]);

    mockExecute.mockResolvedValue([
      { blockId: 'p-node-1', success: true, output: {}, durationMs: 50 },
      { blockId: 'p-node-2', success: false, output: null, error: 'test build failed', durationMs: 200 },
    ]);

    const execution = await engine.start(workflow);

    expect(execution.nodeStates['p-node-1'].status).toBe('completed');
    expect(execution.nodeStates['p-node-2'].status).toBe('failed');
    expect(execution.nodeStates['p-node-2'].error).toBe('test build failed');
    expect(execution.status).toBe('failed');
  });
});
