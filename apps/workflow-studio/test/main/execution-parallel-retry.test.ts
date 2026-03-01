// @vitest-environment node
// ---------------------------------------------------------------------------
// F14-T04: Parallel retry after startParallel()
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
  v4: () => `retry-uuid-${++uuidCounter}`,
}));

const mockExecute = vi.fn<[], Promise<ParallelBlockResult[]>>();
const mockWorkflowExecutorInstance = { execute: mockExecute, abort: vi.fn() };
const MockWorkflowExecutor = vi.fn().mockReturnValue(mockWorkflowExecutorInstance);

vi.mock('../../src/main/services/workflow-executor', () => ({
  WorkflowExecutor: MockWorkflowExecutor,
}));

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

function createParallelWorkflow(
  parallelGroups: ParallelGroup[],
  nodeConfigs?: Record<string, { maxRetries?: number; retryableExitCodes?: number[] }>,
): WorkflowDefinition {
  const nodeIds = parallelGroups.flatMap((g) => g.laneNodeIds);
  const nodes = nodeIds.map((id) => ({
    id,
    type: 'backend' as const,
    label: `Node ${id}`,
    config: { ...(nodeConfigs?.[id] ?? {}) },
    inputs: [],
    outputs: [],
    position: { x: 0, y: 0 },
  }));

  return {
    id: 'workflow-parallel-retry',
    metadata: {
      name: 'Parallel Retry Workflow',
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('F14-T04: Parallel retry', () => {
  let ExecutionEngine: typeof import('../../src/main/services/execution-engine').ExecutionEngine;
  let mockMainWindow: BrowserWindow;

  beforeEach(async () => {
    vi.clearAllMocks();
    uuidCounter = 0;
    // Re-establish mock return values after clearAllMocks
    MockWorkflowExecutor.mockReturnValue(mockWorkflowExecutorInstance);
    MockExecutorEngineAdapter.mockReturnValue({ executeBlock: vi.fn() });
    mockMainWindow = createMockMainWindow();
    const mod = await import('../../src/main/services/execution-engine');
    ExecutionEngine = mod.ExecutionEngine;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retries failed parallel blocks when node has maxRetries > 0', async () => {
    const pool = createMockContainerPool();
    const engine = new ExecutionEngine(mockMainWindow, { mockMode: true });
    engine.containerPool = pool;

    const workflow = createParallelWorkflow(
      [{ id: 'group-1', label: 'Group', laneNodeIds: ['node-a', 'node-b'] }],
      { 'node-a': { maxRetries: 2 }, 'node-b': {} },
    );

    // First execution: node-a fails, node-b succeeds
    // After retry: node-a succeeds
    mockExecute
      .mockResolvedValueOnce([
        { blockId: 'node-a', success: false, output: null, error: 'timeout', durationMs: 1000 },
        { blockId: 'node-b', success: true, output: 'ok', durationMs: 500 },
      ])
      .mockResolvedValueOnce([
        { blockId: 'node-a', success: true, output: 'retry-ok', durationMs: 800 },
      ]);

    const result = await engine.start(workflow);

    // node-a should end up completed after retry
    expect(result.nodeStates['node-a']?.status).toBe('completed');
    expect(result.nodeStates['node-b']?.status).toBe('completed');
    expect(result.status).toBe('completed');
  });

  it('respects per-node maxRetries config', async () => {
    const pool = createMockContainerPool();
    const engine = new ExecutionEngine(mockMainWindow, { mockMode: true });
    engine.containerPool = pool;

    const workflow = createParallelWorkflow(
      [{ id: 'group-1', label: 'Group', laneNodeIds: ['node-a'] }],
      { 'node-a': { maxRetries: 0 } }, // no retries
    );

    mockExecute.mockResolvedValueOnce([
      { blockId: 'node-a', success: false, output: null, error: 'timeout', durationMs: 1000 },
    ]);

    const result = await engine.start(workflow);

    // With maxRetries=0, no retry should happen
    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(result.nodeStates['node-a']?.status).toBe('failed');
    expect(result.status).toBe('failed');
  });

  it('updates nodeStates with retryCount after parallel retry', async () => {
    const pool = createMockContainerPool();
    const engine = new ExecutionEngine(mockMainWindow, { mockMode: true });
    engine.containerPool = pool;

    const workflow = createParallelWorkflow(
      [{ id: 'group-1', label: 'Group', laneNodeIds: ['node-a'] }],
      { 'node-a': { maxRetries: 3 } },
    );

    // Fails twice, succeeds on 3rd try (2 retries)
    mockExecute
      .mockResolvedValueOnce([
        { blockId: 'node-a', success: false, output: null, error: 'timeout', durationMs: 1000 },
      ])
      .mockResolvedValueOnce([
        { blockId: 'node-a', success: false, output: null, error: 'timeout', durationMs: 1000 },
      ])
      .mockResolvedValueOnce([
        { blockId: 'node-a', success: true, output: 'ok', durationMs: 800 },
      ]);

    const result = await engine.start(workflow);

    expect(result.nodeStates['node-a']?.status).toBe('completed');
    expect(result.nodeStates['node-a']?.retryCount).toBe(2);
  });
});
