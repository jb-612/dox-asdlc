// ---------------------------------------------------------------------------
// Pool startup integration tests (P15-F09, T06)
//
// Tests the wiring logic that initializes ContainerPool at startup when
// Docker is available. Does NOT require Electron -- all dependencies are
// mocked. Validates the full initialization sequence: Docker check,
// ContainerPool construction, orphan cleanup, IPC registration, and
// teardown wiring.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock variables — vi.mock factories are hoisted above const
// declarations, so we must use vi.hoisted() to make them available.
// ---------------------------------------------------------------------------

const {
  mockCheckDockerAvailable,
  mockDockerClientInstance,
  MockDockerClient,
  mockPortAllocatorInstance,
  MockPortAllocator,
  mockCleanupOrphans,
  mockTeardown,
  mockContainerPoolInstance,
  MockContainerPool,
  mockRegisterParallelHandlers,
} = vi.hoisted(() => {
  const mockCheckDockerAvailable = vi.fn<() => Promise<boolean>>();

  const mockDockerClientInstance = {};
  const MockDockerClient = vi.fn().mockImplementation(() => mockDockerClientInstance);

  const mockPortAllocatorInstance = {};
  const MockPortAllocator = vi.fn().mockImplementation(() => mockPortAllocatorInstance);

  const mockCleanupOrphans = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const mockTeardown = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const mockContainerPoolInstance = {
    cleanupOrphans: mockCleanupOrphans,
    teardown: mockTeardown,
  };
  const MockContainerPool = vi.fn().mockImplementation(() => mockContainerPoolInstance);

  const mockRegisterParallelHandlers = vi.fn();

  return {
    mockCheckDockerAvailable,
    mockDockerClientInstance,
    MockDockerClient,
    mockPortAllocatorInstance,
    MockPortAllocator,
    mockCleanupOrphans,
    mockTeardown,
    mockContainerPoolInstance,
    MockContainerPool,
    mockRegisterParallelHandlers,
  };
});

// ---------------------------------------------------------------------------
// Mock modules
// ---------------------------------------------------------------------------

vi.mock('../../src/main/services/docker-utils', () => ({
  checkDockerAvailable: () => mockCheckDockerAvailable(),
}));

vi.mock('../../src/main/services/docker-client', () => ({
  DockerClient: MockDockerClient,
}));

vi.mock('../../src/main/services/port-allocator', () => ({
  PortAllocator: MockPortAllocator,
}));

vi.mock('../../src/main/services/container-pool', () => ({
  ContainerPool: MockContainerPool,
}));

vi.mock('../../src/main/ipc/parallel-handlers', () => ({
  registerParallelHandlers: (...args: unknown[]) => mockRegisterParallelHandlers(...args),
}));

// ---------------------------------------------------------------------------
// Import the function under test
// ---------------------------------------------------------------------------

import { initContainerPool } from '../../src/main/services/pool-startup';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Pool startup integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pool is created when Docker is available', async () => {
    mockCheckDockerAvailable.mockResolvedValue(true);

    const result = await initContainerPool({
      dockerSocketPath: '/var/run/docker.sock',
      containerImage: 'asdlc-agent:1.0.0',
      dormancyTimeoutMs: 300_000,
    });

    expect(MockDockerClient).toHaveBeenCalledWith('/var/run/docker.sock');
    expect(MockPortAllocator).toHaveBeenCalled();
    expect(MockContainerPool).toHaveBeenCalledWith(
      mockDockerClientInstance,
      mockPortAllocatorInstance,
      expect.objectContaining({
        image: 'asdlc-agent:1.0.0',
        maxContainers: 10,
      }),
    );
    expect(result).not.toBeNull();
  });

  it('pool is null when Docker unavailable', async () => {
    mockCheckDockerAvailable.mockResolvedValue(false);

    const result = await initContainerPool({
      dockerSocketPath: '/var/run/docker.sock',
      containerImage: 'asdlc-agent:1.0.0',
      dormancyTimeoutMs: 300_000,
    });

    expect(MockContainerPool).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('cleanupOrphans called after pool creation', async () => {
    mockCheckDockerAvailable.mockResolvedValue(true);

    await initContainerPool({
      dockerSocketPath: '/var/run/docker.sock',
      containerImage: 'asdlc-agent:1.0.0',
      dormancyTimeoutMs: 300_000,
    });

    expect(mockCleanupOrphans).toHaveBeenCalledOnce();
  });

  it('registerParallelHandlers called with pool', async () => {
    mockCheckDockerAvailable.mockResolvedValue(true);

    await initContainerPool({
      dockerSocketPath: '/var/run/docker.sock',
      containerImage: 'asdlc-agent:1.0.0',
      dormancyTimeoutMs: 300_000,
    });

    expect(mockRegisterParallelHandlers).toHaveBeenCalledWith(mockContainerPoolInstance);
  });

  it('returns null and does not throw when Docker check throws', async () => {
    mockCheckDockerAvailable.mockRejectedValue(new Error('exec failed'));

    const result = await initContainerPool({
      dockerSocketPath: '/var/run/docker.sock',
      containerImage: 'asdlc-agent:1.0.0',
      dormancyTimeoutMs: 300_000,
    });

    expect(result).toBeNull();
  });

  it('uses default image when containerImage not provided', async () => {
    mockCheckDockerAvailable.mockResolvedValue(true);

    await initContainerPool({
      dockerSocketPath: '/var/run/docker.sock',
    });

    expect(MockContainerPool).toHaveBeenCalledWith(
      mockDockerClientInstance,
      mockPortAllocatorInstance,
      expect.objectContaining({
        image: 'asdlc-agent:1.0.0',
      }),
    );
  });

  it('passes dormancyTimeoutMs to pool options', async () => {
    mockCheckDockerAvailable.mockResolvedValue(true);

    await initContainerPool({
      dockerSocketPath: '/var/run/docker.sock',
      dormancyTimeoutMs: 60_000,
    });

    expect(MockContainerPool).toHaveBeenCalledWith(
      mockDockerClientInstance,
      mockPortAllocatorInstance,
      expect.objectContaining({
        dormancyTimeoutMs: 60_000,
      }),
    );
  });
});
