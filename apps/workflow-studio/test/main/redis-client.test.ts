// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { BrowserWindow } from 'electron';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockXread = vi.fn();
const mockQuit = vi.fn().mockResolvedValue('OK');
const mockOn = vi.fn();

vi.mock('ioredis', () => {
  return {
    default: class MockRedis {
      xread = mockXread;
      quit = mockQuit;
      on = mockOn;
      status = 'ready';
      disconnect = vi.fn();
      constructor() {}
    },
  };
});

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('RedisEventClient', () => {
  let RedisEventClient: typeof import('../../src/main/services/redis-client').RedisEventClient;
  let mockMainWindow: BrowserWindow;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockXread.mockReset();
    mockQuit.mockReset().mockResolvedValue('OK');
    mockOn.mockReset();

    mockMainWindow = {
      webContents: {
        send: vi.fn(),
      },
    } as unknown as BrowserWindow;

    const mod = await import('../../src/main/services/redis-client');
    RedisEventClient = mod.RedisEventClient;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create a client with the provided URL', () => {
      const client = new RedisEventClient({
        url: 'redis://localhost:6379',
        mainWindow: mockMainWindow,
      });

      expect(client).toBeDefined();
      expect(client.isConnected).toBe(false);
    });
  });

  describe('connect()', () => {
    it('should create a Redis connection and register error handler', async () => {
      const client = new RedisEventClient({
        url: 'redis://localhost:6379',
        mainWindow: mockMainWindow,
      });

      await client.connect();

      expect(client.isConnected).toBe(true);
      expect(mockOn).toHaveBeenCalled();
      const eventNames = mockOn.mock.calls.map((c: unknown[]) => c[0]);
      expect(eventNames).toContain('error');
    });
  });

  describe('disconnect()', () => {
    it('should close the Redis connection', async () => {
      const client = new RedisEventClient({
        url: 'redis://localhost:6379',
        mainWindow: mockMainWindow,
      });

      await client.connect();
      await client.disconnect();

      expect(mockQuit).toHaveBeenCalled();
      expect(client.isConnected).toBe(false);
    });
  });

  describe('subscribe()', () => {
    it('should forward stream events to the renderer via IPC', async () => {
      const client = new RedisEventClient({
        url: 'redis://localhost:6379',
        mainWindow: mockMainWindow,
      });

      await client.connect();

      // XREAD returns one event on first call, then we disconnect to stop loop
      const mockStreamResult = [
        [
          'test-stream',
          [
            ['1234567890-0', ['type', 'task_started', 'data', '{"taskId":"123"}']],
          ],
        ],
      ];

      let callCount = 0;
      mockXread.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) return mockStreamResult;
        // Stop the loop on subsequent calls
        client.disconnect();
        return null;
      });

      await client.subscribe('test-stream');

      expect(mockMainWindow.webContents.send).toHaveBeenCalledWith(
        'redis:event',
        {
          streamKey: 'test-stream',
          id: '1234567890-0',
          fields: { type: 'task_started', data: '{"taskId":"123"}' },
        },
      );
    });

    it('should call XREAD with BLOCK and COUNT arguments', async () => {
      const client = new RedisEventClient({
        url: 'redis://localhost:6379',
        mainWindow: mockMainWindow,
      });

      await client.connect();

      // Immediately stop the loop
      mockXread.mockImplementation(async () => {
        client.disconnect();
        return null;
      });

      await client.subscribe('my-stream');

      expect(mockXread).toHaveBeenCalledWith(
        'BLOCK',
        expect.any(Number),
        'COUNT',
        expect.any(Number),
        'STREAMS',
        'my-stream',
        '$',
      );
    });

    it('should throw if not connected', async () => {
      const client = new RedisEventClient({
        url: 'redis://localhost:6379',
        mainWindow: mockMainWindow,
      });

      await expect(client.subscribe('stream')).rejects.toThrow(
        'Not connected',
      );
    });
  });

  describe('isConnected', () => {
    it('should return false before connect', () => {
      const client = new RedisEventClient({
        url: 'redis://localhost:6379',
        mainWindow: mockMainWindow,
      });

      expect(client.isConnected).toBe(false);
    });

    it('should return true after connect', async () => {
      const client = new RedisEventClient({
        url: 'redis://localhost:6379',
        mainWindow: mockMainWindow,
      });

      await client.connect();

      expect(client.isConnected).toBe(true);
    });

    it('should return false after disconnect', async () => {
      const client = new RedisEventClient({
        url: 'redis://localhost:6379',
        mainWindow: mockMainWindow,
      });

      await client.connect();
      await client.disconnect();

      expect(client.isConnected).toBe(false);
    });
  });
});
