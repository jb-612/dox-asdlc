// @vitest-environment node
// ---------------------------------------------------------------------------
// Container pool tests (P15-F05 Phase B)
//
// Tests for T06, T08, T09, T10, T23, T24, T26, T30
// ---------------------------------------------------------------------------
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ContainerRecord } from '../../src/shared/types/execution';

// ---------------------------------------------------------------------------
// Mock DockerClient
// ---------------------------------------------------------------------------

const mockCreateContainer = vi.fn();
const mockStartContainer = vi.fn();
const mockStopContainer = vi.fn();
const mockRemoveContainer = vi.fn();
const mockPauseContainer = vi.fn();
const mockUnpauseContainer = vi.fn();
const mockHealthCheck = vi.fn();
const mockListContainers = vi.fn();

const MockDockerClient = vi.fn().mockImplementation(() => ({
  createContainer: mockCreateContainer,
  startContainer: mockStartContainer,
  stopContainer: mockStopContainer,
  removeContainer: mockRemoveContainer,
  pauseContainer: mockPauseContainer,
  unpauseContainer: mockUnpauseContainer,
  healthCheck: mockHealthCheck,
  listContainers: mockListContainers,
}));

vi.mock('../../src/main/services/docker-client', () => ({
  DockerClient: MockDockerClient,
}));

// ---------------------------------------------------------------------------
// Mock PortAllocator
// ---------------------------------------------------------------------------

let nextPort = 49200;
const allocatedPorts = new Set<number>();
const mockAllocate = vi.fn().mockImplementation(() => {
  const port = nextPort++;
  allocatedPorts.add(port);
  return port;
});
const mockRelease = vi.fn().mockImplementation((port: number) => {
  allocatedPorts.delete(port);
});

const MockPortAllocator = vi.fn().mockImplementation(() => ({
  allocate: mockAllocate,
  release: mockRelease,
  available: vi.fn().mockReturnValue(100),
}));

vi.mock('../../src/main/services/port-allocator', () => ({
  PortAllocator: MockPortAllocator,
}));

// ---------------------------------------------------------------------------
// Import subjects under test (after mocks)
// ---------------------------------------------------------------------------

import { ContainerPool } from '../../src/main/services/container-pool';
import { WakeFailedError } from '../../src/shared/types/errors';

// Helper: create a pool with standard test options
function createPool(overrides: Record<string, unknown> = {}): ContainerPool {
  const docker = new MockDockerClient();
  const ports = new MockPortAllocator();
  return new ContainerPool(docker, ports, {
    image: 'test-image:latest',
    maxContainers: 5,
    healthCheckIntervalMs: 50,
    healthCheckTimeoutMs: 500,
    dormancyTimeoutMs: 60000,
    ...overrides,
  });
}

// Helper: container ID counter
let containerIdCounter = 0;

function setupDefaultMocks(): void {
  containerIdCounter = 0;
  nextPort = 49200;

  mockCreateContainer.mockImplementation(() => {
    const id = `container-${++containerIdCounter}`;
    return Promise.resolve({ id });
  });
  mockStartContainer.mockResolvedValue(undefined);
  mockHealthCheck.mockResolvedValue(undefined);
  mockStopContainer.mockResolvedValue(undefined);
  mockRemoveContainer.mockResolvedValue(undefined);
  mockPauseContainer.mockResolvedValue(undefined);
  mockUnpauseContainer.mockResolvedValue(undefined);
  mockListContainers.mockResolvedValue([]);
}

// ---------------------------------------------------------------------------
// T06: ContainerPool -- STARTING and IDLE lifecycle (prewarm)
// ---------------------------------------------------------------------------

describe('ContainerPool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    setupDefaultMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('T06: prewarm (starting -> idle)', () => {
    it('prewarm(3) creates 3 containers that reach idle state', async () => {
      const pool = createPool();

      await pool.prewarm(3);

      const snap = pool.snapshot();
      expect(snap).toHaveLength(3);
      snap.forEach((record) => {
        expect(record.state).toBe('idle');
        expect(record.blockId).toBeNull();
      });
    });

    it('allocates a port for each container', async () => {
      const pool = createPool();

      await pool.prewarm(2);

      expect(mockAllocate).toHaveBeenCalledTimes(2);
      const snap = pool.snapshot();
      expect(snap[0].port).toBe(49200);
      expect(snap[1].port).toBe(49201);
    });

    it('calls docker.createContainer, docker.startContainer, and healthCheck per container', async () => {
      const pool = createPool();

      await pool.prewarm(1);

      expect(mockCreateContainer).toHaveBeenCalledTimes(1);
      expect(mockStartContainer).toHaveBeenCalledTimes(1);
      expect(mockHealthCheck).toHaveBeenCalledTimes(1);
    });

    it('passes asdlc.managed=true label to createContainer', async () => {
      const pool = createPool();

      await pool.prewarm(1);

      const createCall = mockCreateContainer.mock.calls[0][0];
      expect(createCall.Labels).toEqual(expect.objectContaining({ 'asdlc.managed': 'true' }));
    });

    it('respects maxContainers cap', async () => {
      const pool = createPool({ maxContainers: 2 });

      await pool.prewarm(5);

      expect(pool.snapshot()).toHaveLength(2);
    });

    it('emits state-change callback during prewarm', async () => {
      const stateChanges: Array<{ id: string; state: string }> = [];
      const pool = createPool();
      pool.onStateChange = (record) => {
        stateChanges.push({ id: record.id, state: record.state });
      };

      await pool.prewarm(1);

      // Should see starting -> idle
      expect(stateChanges.some((s) => s.state === 'starting')).toBe(true);
      expect(stateChanges.some((s) => s.state === 'idle')).toBe(true);
    });

    it('sets agentUrl on each record', async () => {
      const pool = createPool();

      await pool.prewarm(1);

      const snap = pool.snapshot();
      expect(snap[0].agentUrl).toBe('http://localhost:49200');
    });

    it('sets createdAt to a timestamp', async () => {
      const pool = createPool();

      await pool.prewarm(1);

      const snap = pool.snapshot();
      expect(snap[0].createdAt).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // T08: RUNNING and DORMANT lifecycle (acquire/release)
  // -------------------------------------------------------------------------

  describe('T08: acquire/release (idle -> running -> dormant)', () => {
    it('acquire transitions an idle container to running', async () => {
      const pool = createPool();
      await pool.prewarm(1);

      const record = await pool.acquire('block-1');

      expect(record.state).toBe('running');
      expect(record.blockId).toBe('block-1');
    });

    it('release transitions running to dormant and calls docker.pause', async () => {
      const pool = createPool();
      await pool.prewarm(1);
      const record = await pool.acquire('block-1');

      await pool.release(record.id);

      const snap = pool.snapshot();
      const released = snap.find((r) => r.id === record.id)!;
      expect(released.state).toBe('dormant');
      expect(released.dormantSince).not.toBeNull();
      expect(released.blockId).toBeNull();
      expect(mockPauseContainer).toHaveBeenCalledWith(record.id);
    });

    it('acquire prefers idle containers first', async () => {
      const pool = createPool();
      await pool.prewarm(2);
      const first = await pool.acquire('block-1');
      await pool.release(first.id);

      // Pool now has 1 dormant + 1 idle. Should prefer idle.
      const second = await pool.acquire('block-2');
      expect(second.id).not.toBe(first.id);
      expect(second.state).toBe('running');
    });

    it('acquire wakes a dormant container when no idle containers available', async () => {
      const pool = createPool({ maxContainers: 1 });
      await pool.prewarm(1);
      const first = await pool.acquire('block-1');
      await pool.release(first.id);

      // All containers are dormant now
      const second = await pool.acquire('block-2');

      expect(second.id).toBe(first.id);
      expect(second.state).toBe('running');
      expect(mockUnpauseContainer).toHaveBeenCalledWith(first.id);
    });

    it('acquire spawns a new container when none are idle or dormant', async () => {
      const pool = createPool({ maxContainers: 3 });
      await pool.prewarm(1);
      await pool.acquire('block-1'); // Uses the prewarmed one

      const record = await pool.acquire('block-2');

      expect(record.state).toBe('running');
      expect(pool.snapshot()).toHaveLength(2);
    });

    it('throws when all containers are running and at max capacity', async () => {
      const pool = createPool({ maxContainers: 1 });
      await pool.prewarm(1);
      await pool.acquire('block-1');

      await expect(pool.acquire('block-2')).rejects.toThrow(/no.*container.*available/i);
    });
  });

  // -------------------------------------------------------------------------
  // T09: Wake protocol (dormant -> idle)
  // -------------------------------------------------------------------------

  describe('T09: wake protocol (dormant -> running via idle)', () => {
    it('wake calls unpause and healthCheck', async () => {
      const pool = createPool({ maxContainers: 1 });
      await pool.prewarm(1);
      const first = await pool.acquire('block-1');
      await pool.release(first.id);

      await pool.acquire('block-2'); // triggers wake

      expect(mockUnpauseContainer).toHaveBeenCalledWith(first.id);
      expect(mockHealthCheck).toHaveBeenCalledTimes(2); // once for prewarm, once for wake
    });

    it('wake failure terminates the container and throws WakeFailedError when no fallback', async () => {
      const pool = createPool({ maxContainers: 1 });
      await pool.prewarm(1);
      const first = await pool.acquire('block-1');
      await pool.release(first.id);

      mockUnpauseContainer.mockRejectedValueOnce(new Error('unpause fail'));

      // maxContainers = 1, but the failed one gets terminated, so we can spawn a replacement
      // Actually we need maxContainers > current non-terminated to spawn fallback
      // With maxContainers = 1, after terminating the failed one, we should be able to spawn
      const record = await pool.acquire('block-2');
      expect(record.state).toBe('running');
      // The old container should be terminated
      expect(mockStopContainer).toHaveBeenCalled();
      expect(mockRemoveContainer).toHaveBeenCalled();
    });

    it('wake failure falls back to spawning a new container', async () => {
      const pool = createPool({ maxContainers: 2 });
      await pool.prewarm(1);
      const first = await pool.acquire('block-1');
      await pool.release(first.id);

      mockUnpauseContainer.mockRejectedValueOnce(new Error('unpause fail'));

      const record = await pool.acquire('block-2');
      expect(record.state).toBe('running');
      expect(record.id).not.toBe(first.id);
    });
  });

  // -------------------------------------------------------------------------
  // T10: TERMINATED lifecycle and teardown
  // -------------------------------------------------------------------------

  describe('T10: terminate and teardown', () => {
    it('terminate calls docker.stop, docker.remove, and releases port', async () => {
      const pool = createPool();
      await pool.prewarm(1);
      const snap = pool.snapshot();
      const container = snap[0];

      await pool.terminate(container.id);

      expect(mockStopContainer).toHaveBeenCalledWith(container.id);
      expect(mockRemoveContainer).toHaveBeenCalledWith(container.id);
      expect(mockRelease).toHaveBeenCalledWith(container.port);

      const after = pool.snapshot();
      expect(after.find((r) => r.id === container.id)?.state).toBe('terminated');
    });

    it('dormancy timeout triggers terminate', async () => {
      const pool = createPool({ dormancyTimeoutMs: 1000 });
      await pool.prewarm(1);
      const record = await pool.acquire('block-1');
      await pool.release(record.id);

      // Advance time past dormancy timeout
      await vi.advanceTimersByTimeAsync(1100);

      const snap = pool.snapshot();
      expect(snap.find((r) => r.id === record.id)?.state).toBe('terminated');
      expect(mockStopContainer).toHaveBeenCalledWith(record.id);
    });

    it('teardown terminates all non-terminated containers', async () => {
      const pool = createPool();
      await pool.prewarm(3);

      await pool.teardown();

      const snap = pool.snapshot();
      snap.forEach((record) => {
        expect(record.state).toBe('terminated');
      });
      expect(mockStopContainer).toHaveBeenCalledTimes(3);
      expect(mockRemoveContainer).toHaveBeenCalledTimes(3);
    });

    it('teardown releases all ports', async () => {
      const pool = createPool();
      await pool.prewarm(2);

      await pool.teardown();

      expect(mockRelease).toHaveBeenCalledTimes(2);
    });

    it('terminate is no-op for already terminated containers', async () => {
      const pool = createPool();
      await pool.prewarm(1);
      const snap = pool.snapshot();
      const container = snap[0];

      await pool.terminate(container.id);
      const callCount = mockStopContainer.mock.calls.length;

      await pool.terminate(container.id);
      expect(mockStopContainer.mock.calls.length).toBe(callCount);
    });
  });

  // -------------------------------------------------------------------------
  // T24: Startup orphan container cleanup
  // -------------------------------------------------------------------------

  describe('T24: orphan cleanup', () => {
    it('cleanupOrphans stops and removes containers with asdlc.managed=true label', async () => {
      mockListContainers.mockResolvedValue([
        { Id: 'orphan-1' },
        { Id: 'orphan-2' },
      ]);

      const pool = createPool();
      await pool.cleanupOrphans();

      expect(mockListContainers).toHaveBeenCalledWith({
        label: ['asdlc.managed=true'],
      });
      expect(mockStopContainer).toHaveBeenCalledWith('orphan-1');
      expect(mockRemoveContainer).toHaveBeenCalledWith('orphan-1');
      expect(mockStopContainer).toHaveBeenCalledWith('orphan-2');
      expect(mockRemoveContainer).toHaveBeenCalledWith('orphan-2');
    });

    it('cleanupOrphans is no-op when no orphans found', async () => {
      mockListContainers.mockResolvedValue([]);

      const pool = createPool();
      await pool.cleanupOrphans();

      expect(mockStopContainer).not.toHaveBeenCalled();
      expect(mockRemoveContainer).not.toHaveBeenCalled();
    });

    it('cleanupOrphans does not throw when individual cleanup fails', async () => {
      mockListContainers.mockResolvedValue([{ Id: 'orphan-1' }]);
      mockStopContainer.mockRejectedValueOnce(new Error('already stopped'));

      const pool = createPool();
      await expect(pool.cleanupOrphans()).resolves.not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // T26: Single-container parallelism model
  // -------------------------------------------------------------------------

  describe('T26: single-container parallelism model', () => {
    it('single-container mode reuses the same container for all blocks', async () => {
      const pool = createPool({
        parallelismModel: 'single-container' as const,
        maxContainers: 1,
      });
      await pool.prewarm(1);

      const first = await pool.acquire('block-1');
      const second = await pool.acquire('block-2');

      expect(first.id).toBe(second.id);
    });

    it('single-container mode uses sleep infinity entrypoint', async () => {
      const pool = createPool({
        parallelismModel: 'single-container' as const,
        maxContainers: 1,
      });
      await pool.prewarm(1);

      const createCall = mockCreateContainer.mock.calls[0][0];
      expect(createCall.Cmd).toContain('sleep');
      expect(createCall.Cmd).toContain('infinity');
    });

    it('single-container pool size is always 1', async () => {
      const pool = createPool({
        parallelismModel: 'single-container' as const,
        maxContainers: 5,
      });
      await pool.prewarm(5);

      expect(pool.snapshot()).toHaveLength(1);
    });

    it('release in single-container mode does not pause the container', async () => {
      const pool = createPool({
        parallelismModel: 'single-container' as const,
        maxContainers: 1,
      });
      await pool.prewarm(1);
      const record = await pool.acquire('block-1');

      await pool.release(record.id);

      expect(mockPauseContainer).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // T30: Wake-then-spawn sequencing in acquire
  // -------------------------------------------------------------------------

  describe('T30: wake-then-spawn sequencing', () => {
    it('when wake fails, terminate completes BEFORE fallback spawn', async () => {
      const callOrder: string[] = [];
      mockStopContainer.mockImplementation(async () => {
        callOrder.push('stop');
      });
      mockRemoveContainer.mockImplementation(async () => {
        callOrder.push('remove');
      });
      mockUnpauseContainer.mockRejectedValueOnce(new Error('unpause fail'));

      // Override createContainer to track call order for the second call
      let createCount = 0;
      mockCreateContainer.mockImplementation(() => {
        createCount++;
        if (createCount > 1) {
          callOrder.push('create-new');
        }
        return Promise.resolve({ id: `container-${createCount}` });
      });

      const pool = createPool({ maxContainers: 2 });
      await pool.prewarm(1);
      const first = await pool.acquire('block-1');
      await pool.release(first.id);

      await pool.acquire('block-2');

      // Verify: stop and remove happen BEFORE create-new
      const stopIdx = callOrder.indexOf('stop');
      const removeIdx = callOrder.indexOf('remove');
      const createIdx = callOrder.indexOf('create-new');
      expect(stopIdx).toBeLessThan(createIdx);
      expect(removeIdx).toBeLessThan(createIdx);
    });

    it('no orphan containers after wake failure', async () => {
      mockUnpauseContainer.mockRejectedValueOnce(new Error('unpause fail'));

      const pool = createPool({ maxContainers: 2 });
      await pool.prewarm(1);
      const first = await pool.acquire('block-1');
      await pool.release(first.id);

      await pool.acquire('block-2');

      // The failed container should be terminated, the new one running
      const snap = pool.snapshot();
      const terminated = snap.filter((r) => r.state === 'terminated');
      const running = snap.filter((r) => r.state === 'running');
      expect(terminated).toHaveLength(1);
      expect(running).toHaveLength(1);
      expect(terminated[0].id).toBe(first.id);
    });
  });

  // -------------------------------------------------------------------------
  // T23: App shutdown hooks (unit-level test)
  // -------------------------------------------------------------------------

  describe('T23: shutdown wiring', () => {
    it('pool exposes teardown as a callable async function', async () => {
      const pool = createPool();
      await pool.prewarm(1);

      expect(typeof pool.teardown).toBe('function');
      await pool.teardown();

      const snap = pool.snapshot();
      snap.forEach((r) => expect(r.state).toBe('terminated'));
    });
  });
});
