// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { BrowserWindow } from 'electron';
import type { WorkflowDefinition } from '../../src/shared/types/workflow';
import type { ExecutionHistoryEntry } from '../../src/shared/types/execution';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
}));

let uuidCounter = 0;
vi.mock('uuid', () => ({
  v4: () => `hist-wire-uuid-${++uuidCounter}`,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockMainWindow(): BrowserWindow {
  return {
    webContents: { send: vi.fn() },
  } as unknown as BrowserWindow;
}

function createSimpleWorkflow(): WorkflowDefinition {
  return {
    id: 'wf-1',
    metadata: { name: 'Test', version: '1', createdAt: '', updatedAt: '', tags: [] },
    nodes: [{
      id: 'node-1',
      type: 'backend' as const,
      label: 'Backend',
      config: {},
      inputs: [],
      outputs: [],
      position: { x: 0, y: 0 },
    }],
    transitions: [],
    gates: [],
    variables: [],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('F14-T08: History save wiring', () => {
  let ExecutionEngine: typeof import('../../src/main/services/execution-engine').ExecutionEngine;
  let mockHistoryService: { addEntry: ReturnType<typeof vi.fn>; list: ReturnType<typeof vi.fn>; getById: ReturnType<typeof vi.fn>; clear: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.clearAllMocks();
    uuidCounter = 0;

    mockHistoryService = {
      addEntry: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockReturnValue([]),
      getById: vi.fn().mockReturnValue(null),
      clear: vi.fn().mockResolvedValue(undefined),
    };

    const mod = await import('../../src/main/services/execution-engine');
    ExecutionEngine = mod.ExecutionEngine;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('execution complete triggers history save', async () => {
    const mainWindow = createMockMainWindow();
    const engine = new ExecutionEngine(mainWindow, { mockMode: true, historyService: mockHistoryService as any });
    const workflow = createSimpleWorkflow();

    await engine.start(workflow);

    expect(mockHistoryService.addEntry).toHaveBeenCalledTimes(1);
    const entry = mockHistoryService.addEntry.mock.calls[0][0] as ExecutionHistoryEntry;
    expect(entry.status).toBe('completed');
    expect(entry.workflowId).toBe('wf-1');
    expect(entry.workflowName).toBe('Test');
  });

  it('execution failed triggers history save', async () => {
    const mainWindow = createMockMainWindow();
    // Create workflow with a node that will fail (non-mock, no spawner = error)
    const engine = new ExecutionEngine(mainWindow, { mockMode: false, historyService: mockHistoryService as any });
    const workflow = createSimpleWorkflow();

    const result = await engine.start(workflow);

    expect(mockHistoryService.addEntry).toHaveBeenCalledTimes(1);
    const entry = mockHistoryService.addEntry.mock.calls[0][0] as ExecutionHistoryEntry;
    expect(['failed', 'completed']).toContain(entry.status);
  });

  it('execution aborted triggers history save', async () => {
    const mainWindow = createMockMainWindow();
    const engine = new ExecutionEngine(mainWindow, { mockMode: true, historyService: mockHistoryService as any });
    const workflow = createSimpleWorkflow();

    // Start and immediately abort
    const startPromise = engine.start(workflow);
    engine.abort();
    await startPromise;

    expect(mockHistoryService.addEntry).toHaveBeenCalledTimes(1);
  });

  it('saved entry contains workflow, nodeStates, retryStats', async () => {
    const mainWindow = createMockMainWindow();
    const engine = new ExecutionEngine(mainWindow, { mockMode: true, historyService: mockHistoryService as any });
    const workflow = createSimpleWorkflow();

    await engine.start(workflow);

    const entry = mockHistoryService.addEntry.mock.calls[0][0] as ExecutionHistoryEntry;
    expect(entry.workflow).toBeDefined();
    expect(entry.nodeStates).toBeDefined();
    expect(entry.retryStats).toBeDefined();
    expect(entry.startedAt).toBeDefined();
  });
});
