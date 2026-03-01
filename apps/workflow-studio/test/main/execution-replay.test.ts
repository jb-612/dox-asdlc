// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { BrowserWindow } from 'electron';
import type { WorkflowDefinition } from '../../src/shared/types/workflow';
import type { ExecutionHistoryEntry, NodeExecutionState } from '../../src/shared/types/execution';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
}));

let uuidCounter = 0;
vi.mock('uuid', () => ({
  v4: () => `replay-uuid-${++uuidCounter}`,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockMainWindow(): BrowserWindow {
  return {
    webContents: { send: vi.fn() },
  } as unknown as BrowserWindow;
}

function createWorkflow(): WorkflowDefinition {
  return {
    id: 'wf-1',
    metadata: { name: 'Test', version: '1', createdAt: '', updatedAt: '', tags: [] },
    nodes: [
      { id: 'node-1', type: 'backend' as const, label: 'Backend', config: {}, inputs: [], outputs: [], position: { x: 0, y: 0 } },
      { id: 'node-2', type: 'frontend' as const, label: 'Frontend', config: {}, inputs: [], outputs: [], position: { x: 0, y: 100 } },
    ],
    transitions: [
      { id: 't1', sourceNodeId: 'node-1', targetNodeId: 'node-2', condition: { type: 'always' as const } },
    ],
    gates: [],
    variables: [],
  };
}

function createHistoryEntry(nodeStates: Record<string, NodeExecutionState>): ExecutionHistoryEntry {
  return {
    id: 'exec-past',
    workflowId: 'wf-1',
    workflowName: 'Test',
    workflow: createWorkflow(),
    status: 'completed',
    startedAt: '2026-03-01T10:00:00Z',
    completedAt: '2026-03-01T10:05:00Z',
    nodeStates,
    retryStats: {},
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('F14-T09: Replay', { timeout: 30000 }, () => {
  let ExecutionEngine: typeof import('../../src/main/services/execution-engine').ExecutionEngine;
  let ExecutionHistoryService: typeof import('../../src/main/services/execution-history-service').ExecutionHistoryService;
  let tmpDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    uuidCounter = 0;
    tmpDir = mkdtempSync(join(tmpdir(), 'replay-'));

    const engineMod = await import('../../src/main/services/execution-engine');
    ExecutionEngine = engineMod.ExecutionEngine;

    const histMod = await import('../../src/main/services/execution-history-service');
    ExecutionHistoryService = histMod.ExecutionHistoryService;
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('full replay re-executes entire workflow from history', async () => {
    const historyService = new ExecutionHistoryService(tmpDir);
    const entry = createHistoryEntry({
      'node-1': { nodeId: 'node-1', status: 'completed' },
      'node-2': { nodeId: 'node-2', status: 'completed' },
    });
    await historyService.addEntry(entry);

    const engine = new ExecutionEngine(createMockMainWindow(), {
      mockMode: true,
      historyService,
    });

    const result = await engine.replay({ historyEntryId: 'exec-past', mode: 'full' });

    expect(result.success).toBe(true);
    expect(result.executionId).toBeDefined();
  });

  it('resume replay skips completed nodes', async () => {
    const historyService = new ExecutionHistoryService(tmpDir);
    const entry = createHistoryEntry({
      'node-1': { nodeId: 'node-1', status: 'completed' },
      'node-2': { nodeId: 'node-2', status: 'failed' },
    });
    await historyService.addEntry(entry);

    const engine = new ExecutionEngine(createMockMainWindow(), {
      mockMode: true,
      historyService,
    });

    const result = await engine.replay({ historyEntryId: 'exec-past', mode: 'resume' });

    expect(result.success).toBe(true);
    // node-1 should remain completed (skipped)
    const state = engine.getState();
    expect(state?.nodeStates['node-1']?.status).toBe('completed');
  });

  it('replay blocked when execution already active', async () => {
    const historyService = new ExecutionHistoryService(tmpDir);
    const entry = createHistoryEntry({});
    await historyService.addEntry(entry);

    const engine = new ExecutionEngine(createMockMainWindow(), {
      mockMode: true,
      historyService,
    });

    // Start a normal execution first
    const startPromise = engine.start(createWorkflow());

    // Try replay while active — should be blocked
    const result = await engine.replay({ historyEntryId: 'exec-past', mode: 'full' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('active');

    await startPromise;
  });

  it('replay creates its own history entry', async () => {
    const historyService = new ExecutionHistoryService(tmpDir);
    const entry = createHistoryEntry({
      'node-1': { nodeId: 'node-1', status: 'completed' },
      'node-2': { nodeId: 'node-2', status: 'completed' },
    });
    await historyService.addEntry(entry);

    const engine = new ExecutionEngine(createMockMainWindow(), {
      mockMode: true,
      historyService,
    });

    await engine.replay({ historyEntryId: 'exec-past', mode: 'full' });

    const allEntries = historyService.list();
    // Original + replay = 2 entries
    expect(allEntries.length).toBe(2);
  });

  it('replay returns { success, executionId } on success', async () => {
    const historyService = new ExecutionHistoryService(tmpDir);
    const entry = createHistoryEntry({
      'node-1': { nodeId: 'node-1', status: 'completed' },
      'node-2': { nodeId: 'node-2', status: 'completed' },
    });
    await historyService.addEntry(entry);

    const engine = new ExecutionEngine(createMockMainWindow(), {
      mockMode: true,
      historyService,
    });

    const result = await engine.replay({ historyEntryId: 'exec-past', mode: 'full' });

    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('executionId');
    expect(typeof result.executionId).toBe('string');
  });

  it('replay returns { success: false, error } for missing history entry', async () => {
    const historyService = new ExecutionHistoryService(tmpDir);

    const engine = new ExecutionEngine(createMockMainWindow(), {
      mockMode: true,
      historyService,
    });

    const result = await engine.replay({ historyEntryId: 'nonexistent', mode: 'full' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});
