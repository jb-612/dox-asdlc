// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { ExecutionHistoryEntry } from '../../src/shared/types/execution';
import type { WorkflowDefinition } from '../../src/shared/types/workflow';
import { IPC_CHANNELS } from '../../src/shared/ipc-channels';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => Promise<unknown>) => {
      handlers.set(channel, handler);
    },
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(id: string): ExecutionHistoryEntry {
  return {
    id,
    workflowId: 'wf-1',
    workflowName: 'Test',
    workflow: { id: 'wf-1', metadata: { name: 'Test', version: '1', createdAt: '', updatedAt: '', tags: [] }, nodes: [], transitions: [], gates: [], variables: [] } as WorkflowDefinition,
    status: 'completed',
    startedAt: '2026-03-01T10:00:00Z',
    nodeStates: {},
    retryStats: {},
  };
}

async function invokeHandler(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = handlers.get(channel);
  if (!handler) throw new Error(`No handler for ${channel}`);
  return handler({}, ...args);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('F14-T07: Execution history IPC handlers', () => {
  let tmpDir: string;

  beforeEach(async () => {
    handlers.clear();
    tmpDir = mkdtempSync(join(tmpdir(), 'hist-ipc-'));

    const { ExecutionHistoryService } = await import('../../src/main/services/execution-history-service');
    const service = new ExecutionHistoryService(tmpDir);

    // Pre-populate with test data
    await service.addEntry(makeEntry('exec-1'));
    await service.addEntry(makeEntry('exec-2'));

    const { registerExecutionHistoryHandlers } = await import('../../src/main/ipc/execution-history-handlers');
    registerExecutionHistoryHandlers(service);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    vi.resetModules();
  });

  it('EXECUTION_HISTORY_LIST returns summary array', async () => {
    const result = await invokeHandler(IPC_CHANNELS.EXECUTION_HISTORY_LIST);
    expect(Array.isArray(result)).toBe(true);
    const summaries = result as any[];
    expect(summaries).toHaveLength(2);
    expect(summaries[0].id).toBe('exec-1');
    expect(summaries[0]).not.toHaveProperty('workflow');
  });

  it('EXECUTION_HISTORY_GET returns entry by id', async () => {
    const result = await invokeHandler(IPC_CHANNELS.EXECUTION_HISTORY_GET, 'exec-1') as any;
    expect(result.id).toBe('exec-1');
    expect(result.workflow).toBeDefined();
    expect(result.nodeStates).toBeDefined();
  });

  it('EXECUTION_HISTORY_GET returns error for missing id', async () => {
    const result = await invokeHandler(IPC_CHANNELS.EXECUTION_HISTORY_GET, 'nonexistent') as any;
    expect(result).toEqual({ success: false, error: 'Not found' });
  });

  it('EXECUTION_HISTORY_CLEAR empties history', async () => {
    await invokeHandler(IPC_CHANNELS.EXECUTION_HISTORY_CLEAR);
    const result = await invokeHandler(IPC_CHANNELS.EXECUTION_HISTORY_LIST) as any[];
    expect(result).toHaveLength(0);
  });
});
