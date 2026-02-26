// @vitest-environment node
// ---------------------------------------------------------------------------
// T16: E2E test for parallel workflow execution
//
// Exercises the full parallel execution path through ExecutionEngine with
// mocked Docker infrastructure (WorkflowExecutor, ContainerPool). No real
// Docker containers are created.
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
  v4: () => `e2e-uuid-${++uuidCounter}`,
}));

// Mock WorkflowExecutor to simulate parallel execution without Docker
const mockExecute = vi.fn<[], Promise<ParallelBlockResult[]>>();
const mockAbort = vi.fn();
const MockWorkflowExecutor = vi.fn().mockReturnValue({
  execute: mockExecute,
  abort: mockAbort,
});

vi.mock('../../src/main/services/workflow-executor', () => ({
  WorkflowExecutor: MockWorkflowExecutor,
}));

// Mock ExecutorEngineAdapter
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

/**
 * Build a workflow definition with the given parallel groups.
 * Each group's laneNodeIds become backend-typed AgentNodes.
 */
function makeParallelWorkflow(groups: ParallelGroup[]): WorkflowDefinition {
  const nodeIds = groups.flatMap((g) => g.laneNodeIds);
  return {
    id: 'e2e-parallel-wf',
    metadata: {
      name: 'E2E Parallel Workflow',
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
    },
    nodes: nodeIds.map((id) => ({
      id,
      type: 'backend' as const,
      label: `Block ${id}`,
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

/**
 * Build a sequential workflow (no parallelGroups) with the given node count.
 */
function makeSequentialWorkflow(nodeCount: number = 2): WorkflowDefinition {
  const nodes = Array.from({ length: nodeCount }, (_, i) => ({
    id: `seq-node-${i + 1}`,
    type: 'backend' as const,
    label: `Sequential Block ${i + 1}`,
    config: {},
    inputs: [],
    outputs: [],
    position: { x: 0, y: i * 100 },
  }));

  const transitions = nodes.slice(0, -1).map((node, i) => ({
    id: `trans-${i + 1}`,
    sourceNodeId: node.id,
    targetNodeId: nodes[i + 1].id,
    condition: { type: 'always' as const },
  }));

  return {
    id: 'e2e-sequential-wf',
    metadata: {
      name: 'E2E Sequential Workflow',
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
    },
    nodes,
    transitions,
    gates: [],
    variables: [],
    // No parallelGroups — sequential execution
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('E2E: Parallel workflow execution', () => {
  let ExecutionEngine: typeof import('../../src/main/services/execution-engine').ExecutionEngine;
  let mockMainWindow: BrowserWindow;

  beforeEach(async () => {
    vi.clearAllMocks();
    uuidCounter = 0;
    mockMainWindow = createMockMainWindow();

    // Re-configure mock implementations after clearAllMocks
    MockWorkflowExecutor.mockReturnValue({
      execute: mockExecute,
      abort: mockAbort,
    });

    const mod = await import('../../src/main/services/execution-engine');
    ExecutionEngine = mod.ExecutionEngine;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. Workflow with 2 parallel blocks executes via pool and returns results
  // -------------------------------------------------------------------------

  it('workflow with 2 parallel blocks executes via pool and returns results', async () => {
    const pool = createMockContainerPool();
    const engine = new ExecutionEngine(mockMainWindow, { mockMode: true });
    engine.containerPool = pool;

    const workflow = makeParallelWorkflow([
      {
        id: 'dev-group',
        label: 'Development Group',
        laneNodeIds: ['block-backend', 'block-frontend'],
      },
    ]);

    mockExecute.mockResolvedValue([
      {
        blockId: 'block-backend',
        success: true,
        output: { files: ['src/api.ts'], summary: 'Backend API implemented' },
        durationMs: 2500,
      },
      {
        blockId: 'block-frontend',
        success: true,
        output: { files: ['src/ui.tsx'], summary: 'Frontend UI implemented' },
        durationMs: 3200,
      },
    ]);

    const execution = await engine.start(workflow);

    // Both blocks should complete
    expect(execution.nodeStates['block-backend'].status).toBe('completed');
    expect(execution.nodeStates['block-frontend'].status).toBe('completed');

    // Execution should complete overall
    expect(execution.status).toBe('completed');

    // WorkflowExecutor was used (not sequential path)
    expect(MockWorkflowExecutor).toHaveBeenCalledTimes(1);
    expect(mockExecute).toHaveBeenCalledTimes(1);

    // Verify the plan structure passed to execute
    const plan = mockExecute.mock.calls[0][0];
    expect(plan.lanes).toBeDefined();
    expect(plan.lanes.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // 2. Execution completes with merged output from parallel blocks
  // -------------------------------------------------------------------------

  it('execution completes with merged output from parallel blocks', async () => {
    const pool = createMockContainerPool();
    const engine = new ExecutionEngine(mockMainWindow, { mockMode: true });
    engine.containerPool = pool;

    const workflow = makeParallelWorkflow([
      {
        id: 'multi-group',
        label: 'Multi-Block Group',
        laneNodeIds: ['block-a', 'block-b', 'block-c'],
      },
    ]);

    mockExecute.mockResolvedValue([
      { blockId: 'block-a', success: true, output: { result: 'A' }, durationMs: 100 },
      { blockId: 'block-b', success: true, output: { result: 'B' }, durationMs: 200 },
      { blockId: 'block-c', success: true, output: { result: 'C' }, durationMs: 150 },
    ]);

    const execution = await engine.start(workflow);

    // All 3 blocks should have completed nodeStates
    expect(execution.nodeStates['block-a'].status).toBe('completed');
    expect(execution.nodeStates['block-b'].status).toBe('completed');
    expect(execution.nodeStates['block-c'].status).toBe('completed');

    // Overall execution should be completed
    expect(execution.status).toBe('completed');

    // Should have emitted execution_started event
    const startEvents = execution.events.filter((e) => e.type === 'execution_started');
    expect(startEvents.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // 3. Execution fails gracefully when one parallel block fails
  // -------------------------------------------------------------------------

  it('execution fails gracefully when one parallel block fails', async () => {
    const pool = createMockContainerPool();
    const engine = new ExecutionEngine(mockMainWindow, { mockMode: true });
    engine.containerPool = pool;

    const workflow = makeParallelWorkflow([
      {
        id: 'mixed-group',
        label: 'Mixed Results Group',
        laneNodeIds: ['block-success', 'block-failure'],
      },
    ]);

    mockExecute.mockResolvedValue([
      {
        blockId: 'block-success',
        success: true,
        output: { status: 'done' },
        durationMs: 800,
      },
      {
        blockId: 'block-failure',
        success: false,
        output: null,
        error: 'Container OOM killed',
        durationMs: 1500,
      },
    ]);

    const execution = await engine.start(workflow);

    // Execution status reflects failure
    expect(execution.status).toBe('failed');

    // Successful block still has completed state
    expect(execution.nodeStates['block-success'].status).toBe('completed');

    // Failed block has failed state with error message
    expect(execution.nodeStates['block-failure'].status).toBe('failed');
    expect(execution.nodeStates['block-failure'].error).toBe('Container OOM killed');
  });

  // -------------------------------------------------------------------------
  // 4. Sequential workflow still works correctly (no regression)
  // -------------------------------------------------------------------------

  it('sequential workflow still works correctly (no regression)', { timeout: 15000 }, async () => {
    const pool = createMockContainerPool();
    const engine = new ExecutionEngine(mockMainWindow, { mockMode: true });
    engine.containerPool = pool; // Pool available but not used for sequential

    const workflow = makeSequentialWorkflow(2);
    const execution = await engine.start(workflow);

    // WorkflowExecutor should NOT have been used
    expect(MockWorkflowExecutor).not.toHaveBeenCalled();

    // Both nodes should complete via sequential mock mode
    expect(execution.nodeStates['seq-node-1'].status).toBe('completed');
    expect(execution.nodeStates['seq-node-2'].status).toBe('completed');
    expect(execution.status).toBe('completed');
  });

  // -------------------------------------------------------------------------
  // 5. Multi-group parallel workflow maps all groups into lanes
  // -------------------------------------------------------------------------

  it('multi-group parallel workflow maps all groups into separate lanes', async () => {
    const pool = createMockContainerPool();
    const engine = new ExecutionEngine(mockMainWindow, { mockMode: true });
    engine.containerPool = pool;

    const workflow = makeParallelWorkflow([
      { id: 'group-dev', label: 'Dev Group', laneNodeIds: ['block-api', 'block-db'] },
      { id: 'group-test', label: 'Test Group', laneNodeIds: ['block-unit-test'] },
    ]);

    mockExecute.mockResolvedValue([
      { blockId: 'block-api', success: true, output: {}, durationMs: 100 },
      { blockId: 'block-db', success: true, output: {}, durationMs: 200 },
      { blockId: 'block-unit-test', success: true, output: {}, durationMs: 150 },
    ]);

    const execution = await engine.start(workflow);

    // Verify the plan passed to execute has lanes for both groups
    const plan = mockExecute.mock.calls[0][0];
    expect(plan.lanes.length).toBe(2);

    // All nodes completed
    expect(execution.nodeStates['block-api'].status).toBe('completed');
    expect(execution.nodeStates['block-db'].status).toBe('completed');
    expect(execution.nodeStates['block-unit-test'].status).toBe('completed');
    expect(execution.status).toBe('completed');
  });

  // -------------------------------------------------------------------------
  // 6. Parallel execution without pool produces a clear error
  // -------------------------------------------------------------------------

  it('parallel workflow without pool fails with descriptive error', async () => {
    const engine = new ExecutionEngine(mockMainWindow, { mockMode: true });
    // Deliberately NOT setting containerPool

    const workflow = makeParallelWorkflow([
      { id: 'group-1', label: 'Dev Group', laneNodeIds: ['block-a'] },
    ]);

    const execution = await engine.start(workflow);

    expect(execution.status).toBe('failed');
    expect(MockWorkflowExecutor).not.toHaveBeenCalled();

    // Should have an error event mentioning container pool
    const failEvents = execution.events.filter((e) => e.type === 'execution_failed');
    expect(failEvents.length).toBeGreaterThan(0);
    const errorMessages = failEvents.map((e) => e.message).join(' ');
    expect(errorMessages.toLowerCase()).toContain('container pool');
  });

  // -------------------------------------------------------------------------
  // 7. WorkflowExecutor rejection is handled gracefully
  // -------------------------------------------------------------------------

  it('handles WorkflowExecutor.execute() rejection gracefully', async () => {
    const pool = createMockContainerPool();
    const engine = new ExecutionEngine(mockMainWindow, { mockMode: true });
    engine.containerPool = pool;

    const workflow = makeParallelWorkflow([
      { id: 'group-crash', label: 'Crash Group', laneNodeIds: ['block-x'] },
    ]);

    mockExecute.mockRejectedValue(new Error('Docker daemon not responding'));

    const execution = await engine.start(workflow);

    expect(execution.status).toBe('failed');

    const failEvents = execution.events.filter((e) => e.type === 'execution_failed');
    expect(failEvents.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // 8. IPC events are sent to the renderer during parallel execution
  // -------------------------------------------------------------------------

  it('sends IPC events to the renderer window during parallel execution', async () => {
    const pool = createMockContainerPool();
    const engine = new ExecutionEngine(mockMainWindow, { mockMode: true });
    engine.containerPool = pool;

    const workflow = makeParallelWorkflow([
      { id: 'group-ipc', label: 'IPC Test Group', laneNodeIds: ['block-ipc-1'] },
    ]);

    mockExecute.mockResolvedValue([
      { blockId: 'block-ipc-1', success: true, output: {}, durationMs: 100 },
    ]);

    await engine.start(workflow);

    // The engine should have sent IPC messages to the main window
    const sendMock = (mockMainWindow.webContents.send as ReturnType<typeof vi.fn>);
    expect(sendMock).toHaveBeenCalled();

    // At minimum, an execution-started or execution-state-update IPC should have been sent
    const channels = sendMock.mock.calls.map((call: unknown[]) => call[0]);
    expect(channels.length).toBeGreaterThan(0);
  });
});
