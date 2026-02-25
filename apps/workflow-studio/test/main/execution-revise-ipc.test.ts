// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { BrowserWindow } from 'electron';

// ---------------------------------------------------------------------------
// Mocks
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
// Import after mocks
// ---------------------------------------------------------------------------

import { registerExecutionHandlers } from '../../src/main/ipc/execution-handlers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function invokeHandler(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = handlers.get(channel);
  if (!handler) throw new Error(`No handler for ${channel}`);
  return handler({} as Electron.IpcMainInvokeEvent, ...args);
}

function createSimpleWorkflow() {
  return {
    id: 'workflow-1',
    metadata: {
      name: 'Test Workflow',
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
    },
    nodes: [
      {
        id: 'node-1',
        type: 'planner' as const,
        label: 'Planner',
        config: { gateMode: 'gate' as const },
        inputs: [],
        outputs: [],
        position: { x: 0, y: 0 },
      },
    ],
    transitions: [],
    gates: [
      {
        id: 'gate-1',
        nodeId: 'node-1',
        gateType: 'approval' as const,
        prompt: 'Review the plan',
        options: [
          { label: 'Continue', value: 'continue', isDefault: true },
          { label: 'Reject', value: 'reject' },
        ],
        required: true,
      },
    ],
    variables: [],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('execution:revise IPC handler', () => {
  beforeEach(async () => {
    handlers.clear();
    onHandlers.clear();
    uuidCounter = 0;
    registerExecutionHandlers();
  });

  afterEach(async () => {
    // Abort any active execution to prevent state leaking between tests
    const abortHandler = handlers.get('execution:abort');
    if (abortHandler) {
      await abortHandler({} as Electron.IpcMainInvokeEvent);
    }
    vi.restoreAllMocks();
  });

  it('should return "Execution not found" when executionId is missing from payload', async () => {
    // Start an execution first so there is an active engine
    const workflow = createSimpleWorkflow();
    const startResult = (await invokeHandler('execution:start', {
      workflowId: 'workflow-1',
      workflow,
      mockMode: true,
    })) as { success: boolean; executionId: string };
    expect(startResult.success).toBe(true);
    const executionId = startResult.executionId;

    // Wait for the gate to be reached
    await new Promise((r) => setTimeout(r, 200));

    // Send revise WITHOUT executionId (the bug in preload.ts)
    const result = (await invokeHandler('execution:revise', {
      nodeId: 'node-1',
      feedback: 'Please improve the plan',
    })) as { success: boolean; error?: string };

    // This should fail because executionId is undefined, which won't match
    expect(result.success).toBe(false);
    expect(result.error).toBe('Execution not found');
  });

  it('should succeed when executionId is included in the payload', async () => {
    // Start an execution
    const workflow = createSimpleWorkflow();
    const startResult = (await invokeHandler('execution:start', {
      workflowId: 'workflow-1',
      workflow,
      mockMode: true,
    })) as { success: boolean; executionId: string };
    expect(startResult.success).toBe(true);
    const executionId = startResult.executionId;

    // Wait for the gate to be reached
    await new Promise((r) => setTimeout(r, 200));

    // Send revise WITH executionId (the correct payload shape)
    const result = (await invokeHandler('execution:revise', {
      executionId,
      nodeId: 'node-1',
      feedback: 'Please improve the plan',
    })) as { success: boolean; error?: string };

    // This should succeed because executionId matches
    expect(result.success).toBe(true);
  });
});

describe('preload revise method contract', () => {
  it('should include executionId in the revise method signature', () => {
    // Read the preload source to verify the revise method accepts executionId.
    // This catches the exact bug from issue #279 where the preload bridge
    // sent { nodeId, feedback } instead of { executionId, nodeId, feedback }.
    const fs = require('fs');
    const path = require('path');
    const preloadPath = path.resolve(
      __dirname,
      '../../src/preload/preload.ts',
    );
    const source = fs.readFileSync(preloadPath, 'utf-8');

    // Find the revise method and its parameter definition.
    // The method must accept executionId either as a positional parameter
    // or as part of a config object type annotation.
    const reviseMatch = source.match(
      /revise:\s*\(([^)]+)\)/s,
    );
    expect(reviseMatch).not.toBeNull();

    const params = reviseMatch![1];
    // The parameter list must reference executionId
    expect(params).toContain('executionId');
  });
});
