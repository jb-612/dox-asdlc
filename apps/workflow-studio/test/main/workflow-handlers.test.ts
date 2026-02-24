// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import type { WorkflowDefinition } from '../../src/shared/types/workflow';

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
// Import after mocks
// ---------------------------------------------------------------------------

import { registerWorkflowHandlers, seedWorkflow } from '../../src/main/ipc/workflow-handlers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWorkflow(overrides?: Partial<WorkflowDefinition>): WorkflowDefinition {
  return {
    id: uuidv4(),
    metadata: {
      name: 'Test Workflow',
      version: '1.0.0',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      tags: ['test'],
    },
    nodes: [],
    transitions: [],
    gates: [],
    variables: [],
    ...overrides,
  };
}

async function invokeHandler(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = handlers.get(channel);
  if (!handler) throw new Error(`No handler for ${channel}`);
  return handler({} as Electron.IpcMainInvokeEvent, ...args);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('workflow-handlers WORKFLOW_TOUCH', () => {
  beforeEach(() => {
    handlers.clear();
    // Register with null file service for in-memory mode
    registerWorkflowHandlers(null);
  });

  it('updates lastUsedAt on a seeded workflow', async () => {
    const wf = makeWorkflow();
    expect(wf.metadata.lastUsedAt).toBeUndefined();

    seedWorkflow(wf);

    const result = await invokeHandler('workflow:touch', wf.id) as { success: boolean; lastUsedAt: string };
    expect(result.success).toBe(true);
    expect(result.lastUsedAt).toBeTruthy();
    expect(new Date(result.lastUsedAt).getTime()).toBeGreaterThan(0);
  });

  it('returns error for non-existent workflow', async () => {
    const result = await invokeHandler('workflow:touch', 'nonexistent-id') as { success: boolean; error: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it('persists the lastUsedAt value to the workflow object', async () => {
    const wf = makeWorkflow();
    seedWorkflow(wf);

    await invokeHandler('workflow:touch', wf.id);

    // Load the workflow back
    const loaded = await invokeHandler('workflow:load', wf.id) as WorkflowDefinition;
    expect(loaded.metadata.lastUsedAt).toBeTruthy();
  });
});
