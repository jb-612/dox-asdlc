// @vitest-environment node
// ---------------------------------------------------------------------------
// F14-T12: End-to-end integration test for Execution Hardening
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { BrowserWindow } from 'electron';
import type { WorkflowDefinition } from '../../src/shared/types/workflow';
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
  v4: () => `e2e-uuid-${++uuidCounter}`,
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
    id: 'wf-e2e',
    metadata: { name: 'E2E Test', version: '1', createdAt: '', updatedAt: '', tags: [] },
    nodes: [
      { id: 'node-1', type: 'backend' as const, label: 'Step 1', config: {}, inputs: [], outputs: [], position: { x: 0, y: 0 } },
      { id: 'node-2', type: 'frontend' as const, label: 'Step 2', config: {}, inputs: [], outputs: [], position: { x: 0, y: 100 } },
    ],
    transitions: [
      { id: 't1', sourceNodeId: 'node-1', targetNodeId: 'node-2', condition: { type: 'always' as const } },
    ],
    gates: [],
    variables: [],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('F14-T12: Execution Hardening E2E', { timeout: 30000 }, () => {
  let ExecutionEngine: typeof import('../../src/main/services/execution-engine').ExecutionEngine;
  let ExecutionHistoryService: typeof import('../../src/main/services/execution-history-service').ExecutionHistoryService;
  let tmpDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    uuidCounter = 0;
    tmpDir = mkdtempSync(join(tmpdir(), 'e2e-hardening-'));

    const engineMod = await import('../../src/main/services/execution-engine');
    ExecutionEngine = engineMod.ExecutionEngine;

    const histMod = await import('../../src/main/services/execution-history-service');
    ExecutionHistoryService = histMod.ExecutionHistoryService;
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('execution saves to history -> list shows entry -> get returns full', async () => {
    const historyService = new ExecutionHistoryService(tmpDir);
    const engine = new ExecutionEngine(createMockMainWindow(), {
      mockMode: true,
      historyService,
    });

    const execution = await engine.start(createWorkflow());

    // List should show the entry
    const summaries = historyService.list();
    expect(summaries).toHaveLength(1);
    expect(summaries[0].workflowId).toBe('wf-e2e');
    expect(summaries[0].status).toBe('completed');

    // Get full entry
    const fullEntry = historyService.getById(execution.id);
    expect(fullEntry).not.toBeNull();
    expect(fullEntry!.workflow.id).toBe('wf-e2e');
    expect(fullEntry!.nodeStates).toBeDefined();
    expect(Object.keys(fullEntry!.nodeStates)).toHaveLength(2);
  });

  it('replay from history -> new execution created', async () => {
    const historyService = new ExecutionHistoryService(tmpDir);
    const engine = new ExecutionEngine(createMockMainWindow(), {
      mockMode: true,
      historyService,
    });

    // Execute original workflow
    const original = await engine.start(createWorkflow());
    expect(original.status).toBe('completed');

    // Replay from history
    const replayResult = await engine.replay({
      historyEntryId: original.id,
      mode: 'full',
    });

    expect(replayResult.success).toBe(true);
    expect(replayResult.executionId).toBeDefined();
    expect(replayResult.executionId).not.toBe(original.id);

    // Should now have 2 history entries
    const summaries = historyService.list();
    expect(summaries).toHaveLength(2);
  });

  it('retry/history types are correctly wired', async () => {
    const historyService = new ExecutionHistoryService(tmpDir);
    const engine = new ExecutionEngine(createMockMainWindow(), {
      mockMode: true,
      historyService,
    });

    const execution = await engine.start(createWorkflow());

    // Verify the entry has retryStats (empty for no retries)
    const entry = historyService.getById(execution.id);
    expect(entry!.retryStats).toEqual({});

    // Verify all node states are completed
    for (const state of Object.values(entry!.nodeStates)) {
      expect(state.status).toBe('completed');
    }
  });
});
