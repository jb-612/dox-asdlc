// ---------------------------------------------------------------------------
// Container pool (P15-F05 parallel execution, Phase B)
//
// Manages the lifecycle of Docker containers for parallel block execution.
//
// Lifecycle states:
//   starting -> idle       (prewarm / spawn)
//   idle     -> running    (acquire)
//   running  -> dormant    (release)
//   dormant  -> idle       (wake)
//   *        -> terminated (terminate / teardown)
//
// Supports two parallelism models:
//   - 'multi-container' (default): one container per concurrent block
//   - 'single-container': one shared container, each block runs via docker exec
// ---------------------------------------------------------------------------

import type { ContainerRecord, ContainerState } from '../../shared/types/execution';
import type { DockerClient, CreateContainerOptions } from './docker-client';
import type { PortAllocator } from './port-allocator';
import { WakeFailedError } from '../../shared/types/errors';
import { assertTransition } from './container-states';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ParallelismModel = 'multi-container' | 'single-container';

/**
 * Configuration options for the container pool.
 *
 * @property image                 Docker image to use for spawned containers.
 * @property maxContainers         Maximum number of non-terminated containers.
 * @property healthCheckIntervalMs Interval between health check retries (ms).
 * @property healthCheckTimeoutMs  Total timeout for health check polling (ms).
 * @property dormancyTimeoutMs     Time before a dormant container is terminated (ms).
 * @property parallelismModel      Execution model: 'multi-container' (default) or 'single-container'.
 */
export interface ContainerPoolOptions {
  image: string;
  maxContainers: number;
  healthCheckIntervalMs: number;
  healthCheckTimeoutMs: number;
  dormancyTimeoutMs: number;
  parallelismModel?: ParallelismModel;
}

// Internal mutable record — we store more than the readonly ContainerRecord
interface InternalRecord {
  id: string;
  state: ContainerState;
  blockId: string | null;
  port: number;
  agentUrl: string;
  createdAt: number;
  dormantSince: number | null;
  dormancyTimer: ReturnType<typeof setTimeout> | null;
  /** In single-container mode, count of concurrent acquire calls */
  acquireCount: number;
}

function toPublicRecord(r: InternalRecord): ContainerRecord {
  return {
    id: r.id,
    state: r.state,
    blockId: r.blockId,
    port: r.port,
    agentUrl: r.agentUrl,
    createdAt: r.createdAt,
    dormantSince: r.dormantSince,
  };
}

// ---------------------------------------------------------------------------
// ContainerPool
// ---------------------------------------------------------------------------

/**
 * Manages a pool of Docker containers for parallel block execution.
 *
 * The pool handles the full container lifecycle: spawning, health-checking,
 * acquiring for block execution, releasing to dormancy, waking, and
 * termination. Each container is tracked via an internal record that maps
 * to a public {@link ContainerRecord} exposed via {@link snapshot}.
 *
 * Two parallelism models are supported:
 * - **multi-container**: one container per concurrent block (default).
 * - **single-container**: a single shared container; blocks execute via `docker exec`.
 */
export class ContainerPool {
  private readonly docker: DockerClient;
  private readonly ports: PortAllocator;
  private readonly options: ContainerPoolOptions;
  private readonly records: Map<string, InternalRecord> = new Map();

  /** Optional callback fired on every state transition. Used by IPC handlers to push updates to the renderer. */
  onStateChange?: (record: ContainerRecord) => void;

  /**
   * @param docker  Docker client for container operations.
   * @param ports   Port allocator for assigning host ports to containers.
   * @param options Pool configuration options.
   */
  constructor(
    docker: DockerClient,
    ports: PortAllocator,
    options: ContainerPoolOptions,
  ) {
    this.docker = docker;
    this.ports = ports;
    this.options = {
      parallelismModel: 'multi-container',
      ...options,
    };
  }

  // -----------------------------------------------------------------------
  // Snapshot
  // -----------------------------------------------------------------------

  /** Returns a snapshot of all container records (read-only copies). */
  snapshot(): ContainerRecord[] {
    return [...this.records.values()].map(toPublicRecord);
  }

  // -----------------------------------------------------------------------
  // Prewarm (T06)
  // -----------------------------------------------------------------------

  /**
   * Pre-warm the pool by spawning `count` containers up to maxContainers.
   * In single-container mode, only one container is ever created.
   */
  async prewarm(count: number): Promise<void> {
    const effectiveMax = this.isSingleContainer() ? 1 : this.options.maxContainers;
    const existing = this.nonTerminatedCount();
    const toSpawn = Math.min(count, effectiveMax - existing);

    const promises: Promise<void>[] = [];
    for (let i = 0; i < toSpawn; i++) {
      promises.push(this.spawnContainer());
    }
    await Promise.all(promises);
  }

  // -----------------------------------------------------------------------
  // Acquire (T08, T09, T30)
  // -----------------------------------------------------------------------

  /**
   * Acquire a container for a block.
   *
   * Preference order:
   * 1. Idle container (immediately available)
   * 2. Dormant container (wake via unpause + health check)
   * 3. Spawn new container (if under maxContainers cap)
   *
   * In single-container mode, always returns the same container with an
   * incremented acquire count.
   *
   * @param blockId  The ID of the workflow block that will use this container.
   * @returns A read-only ContainerRecord snapshot of the acquired container.
   * @throws Error if all containers are in use and maxContainers has been reached.
   */
  async acquire(blockId: string): Promise<ContainerRecord> {
    // Single-container mode: reuse the single container
    if (this.isSingleContainer()) {
      return this.acquireSingleContainer(blockId);
    }

    // 1. Try idle container
    const idle = this.findByState('idle');
    if (idle) {
      this.transition(idle, 'running');
      idle.blockId = blockId;
      return toPublicRecord(idle);
    }

    // 2. Try dormant container (wake)
    const dormant = this.findByState('dormant');
    if (dormant) {
      try {
        await this.wake(dormant);
        this.transition(dormant, 'running');
        dormant.blockId = blockId;
        return toPublicRecord(dormant);
      } catch {
        // T30: terminate completes BEFORE fallback spawn
        await this.terminateInternal(dormant);

        // Fall through to spawn
      }
    }

    // 3. Spawn new container if under cap
    if (this.nonTerminatedCount() < this.options.maxContainers) {
      await this.spawnContainer();
      const fresh = this.findByState('idle');
      if (fresh) {
        this.transition(fresh, 'running');
        fresh.blockId = blockId;
        return toPublicRecord(fresh);
      }
    }

    throw new Error(
      `No container available for block '${blockId}'. ` +
        `All ${this.options.maxContainers} containers are in use.`,
    );
  }

  // -----------------------------------------------------------------------
  // Release (T08)
  // -----------------------------------------------------------------------

  /**
   * Release a running container back to the pool.
   *
   * In multi-container mode, pauses the Docker container and transitions
   * it to the dormant state. A dormancy timer is started; if not re-acquired
   * within {@link ContainerPoolOptions.dormancyTimeoutMs}, the container is
   * terminated.
   *
   * In single-container mode, decrements the acquire count without pausing.
   *
   * @param containerId  The Docker container ID to release.
   * @throws Error if the container ID is not found in the pool.
   */
  async release(containerId: string): Promise<void> {
    const record = this.records.get(containerId);
    if (!record) {
      throw new Error(`Container not found: ${containerId}`);
    }

    if (this.isSingleContainer()) {
      record.acquireCount = Math.max(0, record.acquireCount - 1);
      if (record.acquireCount === 0) {
        record.blockId = null;
      }
      return;
    }

    // Multi-container mode: pause -> dormant
    await this.docker.pauseContainer(containerId);
    this.transition(record, 'dormant');
    record.blockId = null;
    record.dormantSince = Date.now();

    // Start dormancy timer
    this.startDormancyTimer(record);
  }

  // -----------------------------------------------------------------------
  // Terminate (T10)
  // -----------------------------------------------------------------------

  /**
   * Terminate a container: stop, remove, release port, mark terminated.
   * No-op for already terminated containers.
   */
  async terminate(containerId: string): Promise<void> {
    const record = this.records.get(containerId);
    if (!record) {
      throw new Error(`Container not found: ${containerId}`);
    }
    await this.terminateInternal(record);
  }

  // -----------------------------------------------------------------------
  // Teardown (T10, T23)
  // -----------------------------------------------------------------------

  /** Terminate all non-terminated containers. Safe to call multiple times. */
  async teardown(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const record of this.records.values()) {
      if (record.state !== 'terminated') {
        promises.push(this.terminateInternal(record));
      }
    }
    await Promise.all(promises);
  }

  // -----------------------------------------------------------------------
  // Orphan cleanup (T24)
  // -----------------------------------------------------------------------

  /**
   * Clean up orphan containers from a previous app run.
   * Finds all containers with the `asdlc.managed=true` label and removes them.
   */
  async cleanupOrphans(): Promise<void> {
    let containers: Array<{ Id: string }>;
    try {
      containers = await this.docker.listContainers({
        label: ['asdlc.managed=true'],
      });
    } catch {
      // If we cannot list containers, skip cleanup silently
      return;
    }

    for (const container of containers) {
      try {
        await this.docker.stopContainer(container.Id);
      } catch {
        // May already be stopped
      }
      try {
        await this.docker.removeContainer(container.Id);
      } catch {
        // Best effort
      }
    }
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private isSingleContainer(): boolean {
    return this.options.parallelismModel === 'single-container';
  }

  private nonTerminatedCount(): number {
    let count = 0;
    for (const r of this.records.values()) {
      if (r.state !== 'terminated') count++;
    }
    return count;
  }

  private findByState(state: ContainerState): InternalRecord | undefined {
    for (const r of this.records.values()) {
      if (r.state === state) return r;
    }
    return undefined;
  }

  /**
   * Spawn a single container: allocate port, create, start, health-check,
   * and transition to idle.
   */
  private async spawnContainer(): Promise<void> {
    const port = this.ports.allocate();
    const agentUrl = `http://localhost:${port}`;

    const createOpts: CreateContainerOptions = {
      Image: this.options.image,
      Labels: { 'asdlc.managed': 'true' },
      Env: [
        'TELEMETRY_ENABLED=1',
        'TELEMETRY_URL=http://host.docker.internal:9292/telemetry',
      ],
      ExposedPorts: { '3000/tcp': {} },
      HostConfig: {
        PortBindings: { '3000/tcp': [{ HostPort: String(port) }] },
      },
    };

    // Single-container mode uses sleep infinity entrypoint
    if (this.isSingleContainer()) {
      createOpts.Cmd = ['sleep', 'infinity'];
    }

    const container = await this.docker.createContainer(createOpts);

    const record: InternalRecord = {
      id: container.id,
      state: 'starting',
      blockId: null,
      port,
      agentUrl,
      createdAt: Date.now(),
      dormantSince: null,
      dormancyTimer: null,
      acquireCount: 0,
    };
    this.records.set(container.id, record);
    this.emitStateChange(record);

    await this.docker.startContainer(container.id);
    await this.docker.healthCheck(
      port,
      this.options.healthCheckIntervalMs,
      this.options.healthCheckTimeoutMs,
    );

    this.transition(record, 'idle');
  }

  /**
   * Wake a dormant container: clear dormancy timer, unpause, health-check,
   * and transition to idle.
   *
   * @throws WakeFailedError if the container cannot be woken.
   */
  private async wake(record: InternalRecord): Promise<void> {
    this.clearDormancyTimer(record);
    record.dormantSince = null;

    try {
      await this.docker.unpauseContainer(record.id);
      await this.docker.healthCheck(
        record.port,
        this.options.healthCheckIntervalMs,
        this.options.healthCheckTimeoutMs,
      );
      this.transition(record, 'idle');
    } catch (err) {
      throw new WakeFailedError(
        `Failed to wake container ${record.id}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Internal terminate: stop, remove, release port, set state.
   * Handles already-terminated records as a no-op.
   */
  private async terminateInternal(record: InternalRecord): Promise<void> {
    if (record.state === 'terminated') return;

    this.clearDormancyTimer(record);

    try {
      await this.docker.stopContainer(record.id);
    } catch {
      // May already be stopped
    }
    try {
      await this.docker.removeContainer(record.id);
    } catch {
      // May already be removed
    }

    this.ports.release(record.port);
    this.transition(record, 'terminated');
    record.blockId = null;
    record.dormantSince = null;
  }

  /**
   * Transition a record to a new state, asserting the transition is valid.
   */
  private transition(record: InternalRecord, to: ContainerState): void {
    assertTransition(record.state, to);
    record.state = to;
    this.emitStateChange(record);
  }

  private emitStateChange(record: InternalRecord): void {
    if (this.onStateChange) {
      this.onStateChange(toPublicRecord(record));
    }
  }

  private startDormancyTimer(record: InternalRecord): void {
    this.clearDormancyTimer(record);
    record.dormancyTimer = setTimeout(async () => {
      try {
        await this.terminateInternal(record);
      } catch {
        // Best effort
      }
    }, this.options.dormancyTimeoutMs);
  }

  private clearDormancyTimer(record: InternalRecord): void {
    if (record.dormancyTimer !== null) {
      clearTimeout(record.dormancyTimer);
      record.dormancyTimer = null;
    }
  }

  /**
   * Single-container acquire: return the single container, incrementing
   * the acquire count. The container stays in 'running' state.
   */
  private async acquireSingleContainer(blockId: string): Promise<ContainerRecord> {
    const existing = this.findByState('running') || this.findByState('idle');
    if (existing) {
      if (existing.state === 'idle') {
        this.transition(existing, 'running');
      }
      existing.blockId = blockId;
      existing.acquireCount++;
      return toPublicRecord(existing);
    }

    throw new Error('No container available in single-container mode');
  }
}
