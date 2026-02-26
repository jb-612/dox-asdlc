// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks -- these must be set before any module import that touches electron.
// ---------------------------------------------------------------------------

const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
const onHandlers = new Map<string, (...args: unknown[]) => void>();

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => Promise<unknown>) => {
      handlers.set(channel, handler);
    },
    on: (channel: string, handler: (...args: unknown[]) => void) => {
      onHandlers.set(channel, handler);
    },
  },
  BrowserWindow: {
    getAllWindows: () => [
      {
        webContents: { send: vi.fn() },
      },
    ],
  },
}));

let uuidCounter = 0;
vi.mock('uuid', () => ({
  v4: () => `test-uuid-${++uuidCounter}`,
}));

// ---------------------------------------------------------------------------
// Import IPC channel constants (no side effects).
// ---------------------------------------------------------------------------

import { IPC_CHANNELS } from '../../src/shared/ipc-channels';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function invokeHandler(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = handlers.get(channel);
  if (!handler) throw new Error(`No handler for ${channel}`);
  return handler({} as Electron.IpcMainInvokeEvent, ...args);
}

function createMockWorkflow() {
  return {
    id: 'wf-1',
    metadata: {
      name: 'Test',
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
    },
    nodes: [
      {
        id: 'n1',
        type: 'plan' as const,
        label: 'Plan',
        position: { x: 0, y: 0 },
        config: {},
        inputs: [],
        outputs: [],
      },
    ],
    transitions: [],
    gates: [],
    variables: [],
  };
}

// ---------------------------------------------------------------------------
// Tests
//
// Each test uses vi.resetModules() + dynamic import to get a fresh module-
// level `engine` variable. Without this the module-scoped `let engine` from
// execution-handlers.ts leaks between tests.
// ---------------------------------------------------------------------------

describe('execution engine cleanup (T03)', () => {
  beforeEach(() => {
    handlers.clear();
    onHandlers.clear();
    uuidCounter = 0;
    vi.resetModules();
  });

  afterEach(async () => {
    // If an engine is still running from this test, abort it to prevent
    // leaking into the next test.
    if (handlers.has(IPC_CHANNELS.EXECUTION_ABORT)) {
      await invokeHandler(IPC_CHANNELS.EXECUTION_ABORT).catch(() => {});
    }
    // Allow any pending .finally() callbacks to fire
    await new Promise((r) => setTimeout(r, 100));
  });

  it('allows a second execution after the first completes', async () => {
    const mod = await import('../../src/main/ipc/execution-handlers');
    mod.registerExecutionHandlers();

    const workflow = createMockWorkflow();

    // First execution -- mock mode uses 1-3s simulated delay
    const result1 = await invokeHandler(IPC_CHANNELS.EXECUTION_START, {
      workflowId: 'wf-1',
      workflow,
      mockMode: true,
    });
    expect((result1 as Record<string, unknown>).success).toBe(true);

    // Wait for mock execution to settle (mock mode has 1-3s delay per node)
    await new Promise((r) => setTimeout(r, 4000));

    // Second execution should succeed because engine was set to null in .finally()
    const result2 = await invokeHandler(IPC_CHANNELS.EXECUTION_START, {
      workflowId: 'wf-1',
      workflow,
      mockMode: true,
    });
    expect((result2 as Record<string, unknown>).success).toBe(true);
  }, 10000);

  it('allows restart after abort', async () => {
    const mod = await import('../../src/main/ipc/execution-handlers');
    mod.registerExecutionHandlers();

    const workflow = createMockWorkflow();

    // Start execution
    const result1 = await invokeHandler(IPC_CHANNELS.EXECUTION_START, {
      workflowId: 'wf-1',
      workflow,
      mockMode: true,
    });
    expect((result1 as Record<string, unknown>).success).toBe(true);

    // Abort -- this should null out engine immediately
    const abortResult = await invokeHandler(IPC_CHANNELS.EXECUTION_ABORT);
    expect((abortResult as Record<string, unknown>).success).toBe(true);

    // Small delay for abort cleanup
    await new Promise((r) => setTimeout(r, 200));

    // Start again should succeed because abort handler set engine to null
    const result2 = await invokeHandler(IPC_CHANNELS.EXECUTION_START, {
      workflowId: 'wf-1',
      workflow,
      mockMode: true,
    });
    expect((result2 as Record<string, unknown>).success).toBe(true);
  }, 10000);

  it('returns already-running error when engine is still active', async () => {
    const mod = await import('../../src/main/ipc/execution-handlers');
    mod.registerExecutionHandlers();

    const workflow = createMockWorkflow();

    // Start first execution
    const result1 = await invokeHandler(IPC_CHANNELS.EXECUTION_START, {
      workflowId: 'wf-1',
      workflow,
      mockMode: true,
    });
    expect((result1 as Record<string, unknown>).success).toBe(true);

    // Immediately try to start a second -- engine is still active
    const result2 = await invokeHandler(IPC_CHANNELS.EXECUTION_START, {
      workflowId: 'wf-1',
      workflow,
      mockMode: true,
    });
    expect((result2 as Record<string, unknown>).success).toBe(false);
    expect((result2 as Record<string, unknown>).error).toContain('already in progress');
  });
});
