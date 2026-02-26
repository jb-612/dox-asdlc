import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useExecutionStore } from '../../../src/renderer/stores/executionStore';
import type { Execution, MergeConflict } from '../../../src/shared/types/execution';

// ---------------------------------------------------------------------------
// Mock window.electronAPI
// ---------------------------------------------------------------------------

const mockRevise = vi.fn();
const mockOnEvent = vi.fn();
const mockRemoveListener = vi.fn();
const mockGateDecision = vi.fn().mockResolvedValue({ success: true });
const mockMergeConflictResolve = vi.fn().mockResolvedValue({ success: true });

vi.stubGlobal('window', {
  ...globalThis.window,
  electronAPI: {
    execution: {
      start: vi.fn().mockResolvedValue({ success: true }),
      pause: vi.fn().mockResolvedValue({ success: true }),
      resume: vi.fn().mockResolvedValue({ success: true }),
      abort: vi.fn().mockResolvedValue({ success: true }),
      gateDecision: mockGateDecision,
      revise: mockRevise,
      mergeConflictResolve: mockMergeConflictResolve,
    },
    onEvent: mockOnEvent,
    removeListener: mockRemoveListener,
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createExecution(overrides?: Partial<Execution>): Execution {
  return {
    id: 'exec-1',
    workflowId: 'wf-1',
    workflow: {
      id: 'wf-1',
      metadata: {
        name: 'Test',
        version: '1.0.0',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        tags: [],
      },
      nodes: [],
      transitions: [],
      gates: [],
      variables: [],
    },
    status: 'running',
    nodeStates: {},
    events: [],
    variables: {},
    startedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('executionStore extensions (P15-F04)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useExecutionStore.setState({
      execution: null,
      events: [],
      isRunning: false,
      isPaused: false,
      isWaitingGate: false,
      lastError: null,
      subscribed: false,
      scrutinyLevel: 'summary',
    });
  });

  it('has scrutinyLevel defaulting to summary', () => {
    const state = useExecutionStore.getState();
    expect(state.scrutinyLevel).toBe('summary');
  });

  it('setScrutinyLevel updates the level', () => {
    useExecutionStore.getState().setScrutinyLevel('full_detail');
    expect(useExecutionStore.getState().scrutinyLevel).toBe('full_detail');
  });

  it('reviseBlock calls IPC and sets lastError on failure', async () => {
    mockRevise.mockResolvedValueOnce({ success: false, error: 'Node not in gate mode' });

    useExecutionStore.setState({ execution: createExecution() });
    await useExecutionStore.getState().reviseBlock('node-1', 'Please fix the output formatting');

    expect(mockRevise).toHaveBeenCalledWith({
      executionId: 'exec-1',
      nodeId: 'node-1',
      feedback: 'Please fix the output formatting',
    });
    expect(useExecutionStore.getState().lastError).toBe('Node not in gate mode');
  });

  it('reviseBlock clears lastError on success', async () => {
    mockRevise.mockResolvedValueOnce({ success: true });

    useExecutionStore.setState({
      execution: createExecution(),
      lastError: 'previous error',
    });
    await useExecutionStore.getState().reviseBlock('node-1', 'Better formatting please');

    expect(useExecutionStore.getState().lastError).toBeNull();
  });

  it('reviseBlock sets lastError when no active execution', async () => {
    await useExecutionStore.getState().reviseBlock('node-1', 'Some feedback text');
    expect(useExecutionStore.getState().lastError).toBe('No active execution');
  });

  it('reviseBlock sets lastError on thrown exception', async () => {
    mockRevise.mockRejectedValueOnce(new Error('IPC failed'));

    useExecutionStore.setState({ execution: createExecution() });
    await useExecutionStore.getState().reviseBlock('node-1', 'Please fix the output');

    expect(useExecutionStore.getState().lastError).toBe('IPC failed');
  });

  it('initScrutinyFromWorkflow sets level from workflow defaultScrutinyLevel', () => {
    const exec = createExecution();
    exec.workflow.defaultScrutinyLevel = 'full_content';
    useExecutionStore.getState().setExecution(exec);

    // After setting execution with a workflow that has defaultScrutinyLevel,
    // the store should pick it up
    expect(useExecutionStore.getState().scrutinyLevel).toBe('full_content');
  });
});

// ---------------------------------------------------------------------------
// Merge conflict state (P15-F09)
// ---------------------------------------------------------------------------

describe('executionStore merge conflicts (P15-F09)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useExecutionStore.setState({
      execution: null,
      events: [],
      isRunning: false,
      isPaused: false,
      isWaitingGate: false,
      lastError: null,
      subscribed: false,
      scrutinyLevel: 'summary',
      mergeConflicts: null,
    });
  });

  it('initial mergeConflicts is null', () => {
    const state = useExecutionStore.getState();
    expect(state.mergeConflicts).toBeNull();
  });

  it('setMergeConflicts stores conflicts array', () => {
    const conflicts: MergeConflict[] = [
      { filePath: 'src/a.ts', blockAId: 'b1', blockBId: 'b2' },
      { filePath: 'src/b.ts', blockAId: 'b1', blockBId: 'b3' },
    ];
    useExecutionStore.getState().setMergeConflicts(conflicts);
    expect(useExecutionStore.getState().mergeConflicts).toEqual(conflicts);
  });

  it('resolveMergeConflicts sends IPC and clears state to null', async () => {
    const conflicts: MergeConflict[] = [
      { filePath: 'src/a.ts', blockAId: 'b1', blockBId: 'b2' },
    ];
    useExecutionStore.setState({ mergeConflicts: conflicts });

    await useExecutionStore.getState().resolveMergeConflicts([
      { filePath: 'src/a.ts', keepBlockId: 'b1' },
    ]);

    expect(mockMergeConflictResolve).toHaveBeenCalledWith([
      { filePath: 'src/a.ts', keepBlockId: 'b1' },
    ]);
    expect(useExecutionStore.getState().mergeConflicts).toBeNull();
  });
});
