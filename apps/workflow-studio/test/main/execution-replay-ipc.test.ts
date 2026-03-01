// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

async function invokeHandler(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = handlers.get(channel);
  if (!handler) throw new Error(`No handler for ${channel}`);
  return handler({}, ...args);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('F14-T10: Replay IPC handler', () => {
  let mockEngine: { replay: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    handlers.clear();
    vi.resetModules();

    mockEngine = {
      replay: vi.fn(),
    };

    const { registerReplayHandler } = await import('../../src/main/ipc/execution-history-handlers');
    registerReplayHandler(mockEngine as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('EXECUTION_REPLAY with mode=full starts new execution', async () => {
    mockEngine.replay.mockResolvedValue({ success: true, executionId: 'exec-new' });

    const result = await invokeHandler(
      IPC_CHANNELS.EXECUTION_REPLAY,
      { historyEntryId: 'exec-1', mode: 'full' },
    );

    expect(mockEngine.replay).toHaveBeenCalledWith({ historyEntryId: 'exec-1', mode: 'full' });
    expect(result).toEqual({ success: true, executionId: 'exec-new' });
  });

  it('EXECUTION_REPLAY with mode=resume skips completed', async () => {
    mockEngine.replay.mockResolvedValue({ success: true, executionId: 'exec-resume' });

    const result = await invokeHandler(
      IPC_CHANNELS.EXECUTION_REPLAY,
      { historyEntryId: 'exec-1', mode: 'resume' },
    );

    expect(mockEngine.replay).toHaveBeenCalledWith({ historyEntryId: 'exec-1', mode: 'resume' });
    expect(result).toEqual({ success: true, executionId: 'exec-resume' });
  });

  it('EXECUTION_REPLAY with invalid id returns error', async () => {
    mockEngine.replay.mockResolvedValue({ success: false, error: 'History entry not found: bad-id' });

    const result = await invokeHandler(
      IPC_CHANNELS.EXECUTION_REPLAY,
      { historyEntryId: 'bad-id', mode: 'full' },
    );

    expect(result).toEqual({ success: false, error: 'History entry not found: bad-id' });
  });
});
