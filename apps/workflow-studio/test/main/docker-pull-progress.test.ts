// @vitest-environment node
// ---------------------------------------------------------------------------
// T33: Docker image pull progress reporting tests
//
// Tests:
//   - pullImageWithProgress streams progress events
//   - Progress includes layer count, bytes, percentage
//   - Callback receives progress updates
//   - Resolves when stream ends
//   - Rejects on stream error
// ---------------------------------------------------------------------------
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

// ---------------------------------------------------------------------------
// Mock dockerode
// ---------------------------------------------------------------------------

const mockPull = vi.fn();
const mockCreateContainer = vi.fn();
const mockListContainers = vi.fn();
const mockGetContainer = vi.fn().mockReturnValue({
  start: vi.fn(),
  pause: vi.fn(),
  unpause: vi.fn(),
  stop: vi.fn(),
  remove: vi.fn(),
});

vi.mock('dockerode', () => {
  return {
    default: class MockDocker {
      pull = mockPull;
      createContainer = mockCreateContainer;
      listContainers = mockListContainers;
      getContainer = mockGetContainer;
    },
  };
});

// Mock global fetch for healthCheck
vi.stubGlobal('fetch', vi.fn());

import { DockerClient } from '../../src/main/services/docker-client';
import type { PullProgress } from '../../src/main/services/docker-client';

describe('T33: pullImageWithProgress', () => {
  let client: DockerClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new DockerClient();
  });

  // -------------------------------------------------------------------------
  // Basic pull with progress
  // -------------------------------------------------------------------------

  it('calls docker.pull and streams progress events via callback', async () => {
    const stream = new EventEmitter();
    mockPull.mockImplementation((_image: string, cb: (err: null, s: EventEmitter) => void) => {
      cb(null, stream);
      // Simulate dockerode pull progress events
      setTimeout(() => {
        stream.emit('data', Buffer.from(JSON.stringify({
          status: 'Downloading',
          id: 'abc123',
          progressDetail: { current: 500, total: 1000 },
        }) + '\n'));
      }, 0);
      setTimeout(() => {
        stream.emit('data', Buffer.from(JSON.stringify({
          status: 'Downloading',
          id: 'def456',
          progressDetail: { current: 200, total: 800 },
        }) + '\n'));
      }, 5);
      setTimeout(() => {
        stream.emit('data', Buffer.from(JSON.stringify({
          status: 'Download complete',
          id: 'abc123',
        }) + '\n'));
      }, 10);
      setTimeout(() => {
        stream.emit('end');
      }, 15);
    });

    const progressUpdates: PullProgress[] = [];
    await client.pullImageWithProgress('node:20-alpine', (progress) => {
      progressUpdates.push({ ...progress });
    });

    expect(mockPull).toHaveBeenCalledWith('node:20-alpine', expect.any(Function));
    expect(progressUpdates.length).toBeGreaterThan(0);
  });

  it('progress includes layerCount, downloadedBytes, totalBytes, percentage', async () => {
    const stream = new EventEmitter();
    mockPull.mockImplementation((_image: string, cb: (err: null, s: EventEmitter) => void) => {
      cb(null, stream);
      setTimeout(() => {
        stream.emit('data', Buffer.from(JSON.stringify({
          status: 'Downloading',
          id: 'layer1',
          progressDetail: { current: 500, total: 1000 },
        }) + '\n'));
      }, 0);
      setTimeout(() => {
        stream.emit('end');
      }, 5);
    });

    const progressUpdates: PullProgress[] = [];
    await client.pullImageWithProgress('test:latest', (progress) => {
      progressUpdates.push({ ...progress });
    });

    const lastProgress = progressUpdates[progressUpdates.length - 1];
    expect(lastProgress).toHaveProperty('layerCount');
    expect(lastProgress).toHaveProperty('downloadedBytes');
    expect(lastProgress).toHaveProperty('totalBytes');
    expect(lastProgress).toHaveProperty('percentage');
    expect(lastProgress.layerCount).toBeGreaterThan(0);
    expect(lastProgress.percentage).toBeGreaterThanOrEqual(0);
    expect(lastProgress.percentage).toBeLessThanOrEqual(100);
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  it('rejects when docker.pull returns an error', async () => {
    mockPull.mockImplementation((_image: string, cb: (err: Error) => void) => {
      cb(new Error('pull auth failed'));
    });

    await expect(
      client.pullImageWithProgress('bad:image', vi.fn()),
    ).rejects.toThrow(/pull.*bad:image/i);
  });

  it('rejects on stream error', async () => {
    const stream = new EventEmitter();
    mockPull.mockImplementation((_image: string, cb: (err: null, s: EventEmitter) => void) => {
      cb(null, stream);
      setTimeout(() => {
        stream.emit('error', new Error('network error'));
      }, 5);
    });

    await expect(
      client.pullImageWithProgress('test:latest', vi.fn()),
    ).rejects.toThrow(/network error/i);
  });

  // -------------------------------------------------------------------------
  // No callback still resolves
  // -------------------------------------------------------------------------

  it('resolves even without progress callback', async () => {
    const stream = new EventEmitter();
    mockPull.mockImplementation((_image: string, cb: (err: null, s: EventEmitter) => void) => {
      cb(null, stream);
      setTimeout(() => {
        stream.emit('end');
      }, 5);
    });

    // Cast to pass undefined callback
    await expect(
      (client as { pullImageWithProgress: (img: string, cb?: (p: PullProgress) => void) => Promise<void> })
        .pullImageWithProgress('test:latest'),
    ).resolves.toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Percentage calculation
  // -------------------------------------------------------------------------

  it('percentage is 0 when no total bytes known', async () => {
    const stream = new EventEmitter();
    mockPull.mockImplementation((_image: string, cb: (err: null, s: EventEmitter) => void) => {
      cb(null, stream);
      setTimeout(() => {
        stream.emit('data', Buffer.from(JSON.stringify({
          status: 'Pulling fs layer',
          id: 'layer1',
        }) + '\n'));
      }, 0);
      setTimeout(() => {
        stream.emit('end');
      }, 5);
    });

    const progressUpdates: PullProgress[] = [];
    await client.pullImageWithProgress('test:latest', (progress) => {
      progressUpdates.push({ ...progress });
    });

    if (progressUpdates.length > 0) {
      // With no progressDetail, percentage should be 0
      expect(progressUpdates[0].percentage).toBe(0);
    }
  });
});
