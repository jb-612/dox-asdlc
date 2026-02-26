// ---------------------------------------------------------------------------
// Pool startup logic (P15-F09, T04/T06)
//
// Extracted from index.ts for testability. Encapsulates the full sequence:
//   1. Check Docker availability
//   2. Instantiate DockerClient, PortAllocator, ContainerPool
//   3. Clean up orphan containers from previous runs
//   4. Register IPC handlers for the pool
//
// Returns the ContainerPool instance (or null if Docker unavailable).
// ---------------------------------------------------------------------------

import { checkDockerAvailable } from './docker-utils';
import { DockerClient } from './docker-client';
import { PortAllocator } from './port-allocator';
import { ContainerPool } from './container-pool';
import { registerParallelHandlers } from '../ipc/parallel-handlers';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Options for initializing the container pool at startup.
 */
export interface PoolStartupOptions {
  /** Path to the Docker socket (forwarded to DockerClient). */
  dockerSocketPath?: string;
  /** Docker image for spawning containers. */
  containerImage?: string;
  /** Max containers in the pool. */
  maxContainers?: number;
  /** Health check interval in ms. */
  healthCheckIntervalMs?: number;
  /** Health check timeout in ms. */
  healthCheckTimeoutMs?: number;
  /** Dormancy timeout in ms before idle containers are terminated. */
  dormancyTimeoutMs?: number;
  /** Whether to enable telemetry in spawned containers (default true). */
  telemetryEnabled?: boolean;
  /** Port for the telemetry receiver on the host (default 9292). */
  telemetryReceiverPort?: number;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Initialize the container pool if Docker is available.
 *
 * This function is the single entry point for pool startup logic. It is
 * called from index.ts at app ready time and is independently testable
 * without Electron.
 *
 * @param options Configuration for the pool.
 * @returns The initialized ContainerPool, or null if Docker is unavailable.
 */
export async function initContainerPool(
  options: PoolStartupOptions,
): Promise<ContainerPool | null> {
  let dockerAvailable: boolean;
  try {
    dockerAvailable = await checkDockerAvailable();
  } catch {
    console.warn('[P15-F09] Docker check failed — parallel execution disabled');
    return null;
  }

  if (!dockerAvailable) {
    console.warn('[P15-F09] Docker not available — parallel execution disabled');
    return null;
  }

  try {
    const docker = new DockerClient(options.dockerSocketPath);
    const ports = new PortAllocator();
    const poolOptions = {
      image: options.containerImage ?? 'asdlc-agent:1.0.0',
      maxContainers: options.maxContainers ?? 10,
      healthCheckIntervalMs: options.healthCheckIntervalMs ?? 500,
      healthCheckTimeoutMs: options.healthCheckTimeoutMs ?? 30_000,
      dormancyTimeoutMs: options.dormancyTimeoutMs ?? 300_000,
      telemetryEnabled: options.telemetryEnabled ?? true,
      telemetryUrl: `http://host.docker.internal:${options.telemetryReceiverPort ?? 9292}/telemetry`,
    };

    const pool = new ContainerPool(docker, ports, poolOptions);
    await pool.cleanupOrphans();
    registerParallelHandlers(pool);

    console.log('[P15-F09] Container pool initialized');
    return pool;
  } catch (err) {
    console.error('[P15-F09] Failed to initialize container pool:', err);
    return null;
  }
}
