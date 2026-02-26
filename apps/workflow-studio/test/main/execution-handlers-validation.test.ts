// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IpcMainInvokeEvent } from 'electron';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const handleMap = new Map<string, (...args: unknown[]) => unknown>();
const onMap = new Map<string, (...args: unknown[]) => unknown>();

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      handleMap.set(channel, handler);
    }),
    on: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      onMap.set(channel, handler);
    }),
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => [
      { webContents: { send: vi.fn() } },
    ]),
  },
}));

vi.mock('uuid', () => ({
  v4: () => 'test-validation-uuid',
}));

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(() => false),
}));

vi.mock('child_process', () => ({
  execSync: vi.fn(() => 'abc123\n'),
}));

vi.mock('../../src/main/services/diff-capture', () => ({
  captureGitDiff: vi.fn().mockResolvedValue([]),
  parseUnifiedDiff: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { registerExecutionHandlers } from '../../src/main/ipc/execution-handlers';
import { IPC_CHANNELS } from '../../src/shared/ipc-channels';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fakeEvent = {} as IpcMainInvokeEvent;

function getHandler(channel: string) {
  const handler = handleMap.get(channel);
  if (!handler) throw new Error(`No handler registered for ${channel}`);
  return handler;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Execution IPC endpoint validation (#292)', () => {
  beforeEach(() => {
    handleMap.clear();
    onMap.clear();
    registerExecutionHandlers();
  });

  // -----------------------------------------------------------------------
  // EXECUTION_START validation
  // -----------------------------------------------------------------------
  describe('EXECUTION_START', () => {
    it('rejects null payload', async () => {
      const handler = getHandler(IPC_CHANNELS.EXECUTION_START);
      const result = await handler(fakeEvent, null) as { success: boolean; error: string };
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/invalid|missing|required/i);
    });

    it('rejects undefined payload', async () => {
      const handler = getHandler(IPC_CHANNELS.EXECUTION_START);
      const result = await handler(fakeEvent, undefined) as { success: boolean; error: string };
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/invalid|missing|required/i);
    });

    it('rejects payload with missing workflowId', async () => {
      const handler = getHandler(IPC_CHANNELS.EXECUTION_START);
      const result = await handler(fakeEvent, { variables: {} }) as { success: boolean; error: string };
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/workflowId/i);
    });

    it('rejects payload with non-string workflowId', async () => {
      const handler = getHandler(IPC_CHANNELS.EXECUTION_START);
      const result = await handler(fakeEvent, { workflowId: 123 }) as { success: boolean; error: string };
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/workflowId/i);
    });

    it('rejects payload with empty string workflowId', async () => {
      const handler = getHandler(IPC_CHANNELS.EXECUTION_START);
      const result = await handler(fakeEvent, { workflowId: '' }) as { success: boolean; error: string };
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/workflowId/i);
    });
  });

  // -----------------------------------------------------------------------
  // EXECUTION_GATE_DECISION validation
  // -----------------------------------------------------------------------
  describe('EXECUTION_GATE_DECISION', () => {
    it('rejects null payload', async () => {
      const handler = getHandler(IPC_CHANNELS.EXECUTION_GATE_DECISION);
      const result = await handler(fakeEvent, null) as { success: boolean; error: string };
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/invalid|missing|required/i);
    });

    it('rejects payload missing executionId', async () => {
      const handler = getHandler(IPC_CHANNELS.EXECUTION_GATE_DECISION);
      const result = await handler(fakeEvent, {
        gateId: 'g1',
        nodeId: 'n1',
        selectedOption: 'approve',
      }) as { success: boolean; error: string };
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/executionId/i);
    });

    it('rejects payload missing selectedOption', async () => {
      const handler = getHandler(IPC_CHANNELS.EXECUTION_GATE_DECISION);
      const result = await handler(fakeEvent, {
        executionId: 'e1',
        gateId: 'g1',
        nodeId: 'n1',
      }) as { success: boolean; error: string };
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/selectedOption/i);
    });
  });

  // -----------------------------------------------------------------------
  // EXECUTION_REVISE validation
  // -----------------------------------------------------------------------
  describe('EXECUTION_REVISE', () => {
    it('rejects null payload', async () => {
      const handler = getHandler(IPC_CHANNELS.EXECUTION_REVISE);
      const result = await handler(fakeEvent, null) as { success: boolean; error: string };
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/invalid|missing|required/i);
    });

    it('rejects payload missing nodeId', async () => {
      const handler = getHandler(IPC_CHANNELS.EXECUTION_REVISE);
      const result = await handler(fakeEvent, {
        executionId: 'e1',
        feedback: 'try again',
      }) as { success: boolean; error: string };
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/nodeId/i);
    });

    it('rejects payload missing feedback', async () => {
      const handler = getHandler(IPC_CHANNELS.EXECUTION_REVISE);
      const result = await handler(fakeEvent, {
        executionId: 'e1',
        nodeId: 'n1',
      }) as { success: boolean; error: string };
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/feedback/i);
    });
  });
});
