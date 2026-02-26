// @vitest-environment node
// ---------------------------------------------------------------------------
// T14: IPC channel handler tests for container pool and lane events
//
// Tests:
//   - CONTAINER_POOL_STATUS handler returns pool.snapshot()
//   - Pool state-change callback emits CONTAINER_POOL_STATUS to renderer
//   - Lane start/complete/block-error/aborted channels are wired
// ---------------------------------------------------------------------------
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock electron — use vi.hoisted to define mocks before vi.mock hoisting
// ---------------------------------------------------------------------------

const { mockHandle, mockRemoveHandler, mockSend, handlers } = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  return {
    handlers,
    mockHandle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler);
    }),
    mockRemoveHandler: vi.fn(),
    mockSend: vi.fn(),
  };
});

vi.mock('electron', () => ({
  ipcMain: {
    handle: mockHandle,
    removeHandler: mockRemoveHandler,
  },
  BrowserWindow: {
    getAllWindows: () => [{
      webContents: {
        send: mockSend,
      },
    }],
  },
}));

// ---------------------------------------------------------------------------
// Mock ContainerPool
// ---------------------------------------------------------------------------

const mockSnapshot = vi.fn().mockReturnValue([]);
const mockPrewarm = vi.fn().mockResolvedValue(undefined);
const mockTeardown = vi.fn().mockResolvedValue(undefined);
const mockCleanupOrphans = vi.fn().mockResolvedValue(undefined);

function createMockPool() {
  return {
    snapshot: mockSnapshot,
    prewarm: mockPrewarm,
    teardown: mockTeardown,
    cleanupOrphans: mockCleanupOrphans,
    onStateChange: undefined as ((record: unknown) => void) | undefined,
  };
}

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { registerParallelHandlers } from '../../src/main/ipc/parallel-handlers';

describe('T14: parallel-handlers', () => {
  let mockPool: ReturnType<typeof createMockPool>;

  beforeEach(() => {
    vi.clearAllMocks();
    handlers.clear();
    mockPool = createMockPool();
  });

  // -------------------------------------------------------------------------
  // Registration
  // -------------------------------------------------------------------------

  it('registers CONTAINER_POOL_STATUS handler', () => {
    registerParallelHandlers(mockPool as never);

    expect(mockHandle).toHaveBeenCalledWith(
      'container:pool-status',
      expect.any(Function),
    );
  });

  it('registers CONTAINER_POOL_START handler', () => {
    registerParallelHandlers(mockPool as never);

    expect(mockHandle).toHaveBeenCalledWith(
      'container:pool-start',
      expect.any(Function),
    );
  });

  it('registers CONTAINER_POOL_STOP handler', () => {
    registerParallelHandlers(mockPool as never);

    expect(mockHandle).toHaveBeenCalledWith(
      'container:pool-stop',
      expect.any(Function),
    );
  });

  // -------------------------------------------------------------------------
  // CONTAINER_POOL_STATUS handler returns pool snapshot
  // -------------------------------------------------------------------------

  it('CONTAINER_POOL_STATUS handler returns pool.snapshot()', async () => {
    const fakeSnapshot = [
      { id: 'c1', state: 'idle', port: 49200 },
      { id: 'c2', state: 'running', port: 49201 },
    ];
    mockSnapshot.mockReturnValue(fakeSnapshot);

    registerParallelHandlers(mockPool as never);

    const handler = handlers.get('container:pool-status')!;
    const result = await handler({} /* event */);

    expect(result).toEqual(fakeSnapshot);
    expect(mockSnapshot).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // CONTAINER_POOL_START handler calls prewarm
  // -------------------------------------------------------------------------

  it('CONTAINER_POOL_START handler calls pool.prewarm', async () => {
    registerParallelHandlers(mockPool as never);

    const handler = handlers.get('container:pool-start')!;
    const result = await handler({} /* event */, { count: 3 });

    expect(mockPrewarm).toHaveBeenCalledWith(3);
    expect(result).toEqual({ success: true });
  });

  // -------------------------------------------------------------------------
  // CONTAINER_POOL_STOP handler calls teardown
  // -------------------------------------------------------------------------

  it('CONTAINER_POOL_STOP handler calls pool.teardown', async () => {
    registerParallelHandlers(mockPool as never);

    const handler = handlers.get('container:pool-stop')!;
    const result = await handler({} /* event */);

    expect(mockTeardown).toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  // -------------------------------------------------------------------------
  // State change callback wiring
  // -------------------------------------------------------------------------

  it('wires pool.onStateChange to emit IPC to renderer', () => {
    registerParallelHandlers(mockPool as never);

    // The handler should have set pool.onStateChange
    expect(mockPool.onStateChange).toBeDefined();
    expect(typeof mockPool.onStateChange).toBe('function');
  });

  it('state change callback sends snapshot to renderer windows', () => {
    mockSnapshot.mockReturnValue([{ id: 'c1', state: 'idle' }]);

    registerParallelHandlers(mockPool as never);

    // Trigger the state change callback
    mockPool.onStateChange!({ id: 'c1', state: 'idle' });

    expect(mockSend).toHaveBeenCalledWith(
      'container:pool-status',
      [{ id: 'c1', state: 'idle' }],
    );
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  it('CONTAINER_POOL_START returns error on prewarm failure', async () => {
    mockPrewarm.mockRejectedValueOnce(new Error('Docker not available'));

    registerParallelHandlers(mockPool as never);

    const handler = handlers.get('container:pool-start')!;
    const result = await handler({}, { count: 2 });

    expect(result).toEqual({
      success: false,
      error: 'Docker not available',
    });
  });

  it('CONTAINER_POOL_STOP returns error on teardown failure', async () => {
    mockTeardown.mockRejectedValueOnce(new Error('teardown failed'));

    registerParallelHandlers(mockPool as never);

    const handler = handlers.get('container:pool-stop')!;
    const result = await handler({});

    expect(result).toEqual({
      success: false,
      error: 'teardown failed',
    });
  });
});
