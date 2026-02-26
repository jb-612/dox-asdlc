// ---------------------------------------------------------------------------
// Docker client wrapper (P15-F05 parallel execution)
//
// Wraps dockerode to provide a simplified async interface for container
// lifecycle management. All errors are wrapped in DockerClientError.
// ---------------------------------------------------------------------------

import Docker from 'dockerode';
import { DockerClientError } from '../../shared/types/errors';

/**
 * Progress information emitted during a Docker image pull.
 * Aggregates progress across all layers being downloaded.
 */
export interface PullProgress {
  /** Number of unique layers seen so far. */
  layerCount: number;
  /** Total bytes downloaded across all layers. */
  downloadedBytes: number;
  /** Total bytes expected across all layers (0 if unknown). */
  totalBytes: number;
  /** Estimated overall percentage (0-100). 0 if totals are unknown. */
  percentage: number;
}

/** Options forwarded to dockerode createContainer. */
export interface CreateContainerOptions {
  Image: string;
  name?: string;
  Cmd?: string[];
  Env?: string[];
  ExposedPorts?: Record<string, object>;
  HostConfig?: {
    PortBindings?: Record<string, Array<{ HostPort: string }>>;
    Binds?: string[];
    ExtraHosts?: string[];
    [key: string]: unknown;
  };
  Labels?: Record<string, string>;
  [key: string]: unknown;
}

export class DockerClient {
  private docker: Docker;

  constructor(opts?: Docker.DockerOptions) {
    this.docker = new Docker(opts);
  }

  // -----------------------------------------------------------------------
  // Image management
  // -----------------------------------------------------------------------

  /**
   * Pull a Docker image by name (e.g. "node:20-alpine").
   * Resolves when the pull stream ends. Rejects with DockerClientError on failure.
   */
  async pullImage(image: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.docker.pull(image, (err: Error | null, stream: NodeJS.ReadableStream) => {
        if (err) {
          reject(new DockerClientError(`Failed to pull image ${image}: ${err.message}`, err));
          return;
        }
        stream.on('end', () => resolve());
        stream.on('error', (streamErr: Error) => {
          reject(new DockerClientError(`Pull stream error for ${image}: ${streamErr.message}`, streamErr));
        });
        // Consume the stream to drive it to completion
        stream.resume();
      });
    });
  }

  /**
   * Pull a Docker image with progress reporting (T33).
   *
   * Parses the newline-delimited JSON stream from dockerode's pull method and
   * aggregates per-layer download progress into a single PullProgress object.
   * The onProgress callback is invoked for each stream data chunk.
   *
   * @param image      Image name (e.g. "node:20-alpine").
   * @param onProgress Callback receiving aggregated pull progress.
   */
  async pullImageWithProgress(
    image: string,
    onProgress?: (progress: PullProgress) => void,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.docker.pull(image, (err: Error | null, stream: NodeJS.ReadableStream) => {
        if (err) {
          reject(new DockerClientError(`Failed to pull image ${image}: ${err.message}`, err));
          return;
        }

        // Track per-layer download progress
        const layerProgress = new Map<string, { current: number; total: number }>();

        stream.on('data', (chunk: Buffer) => {
          const lines = chunk.toString().split('\n').filter((l) => l.trim());
          for (const line of lines) {
            try {
              const event = JSON.parse(line) as {
                status?: string;
                id?: string;
                progressDetail?: { current?: number; total?: number };
              };

              if (event.id) {
                const detail = event.progressDetail ?? {};
                const existing = layerProgress.get(event.id) ?? { current: 0, total: 0 };

                if (detail.current != null) existing.current = detail.current;
                if (detail.total != null && detail.total > 0) existing.total = detail.total;

                layerProgress.set(event.id, existing);
              }
            } catch {
              // Ignore malformed JSON lines
            }
          }

          if (onProgress) {
            let downloadedBytes = 0;
            let totalBytes = 0;
            for (const layer of layerProgress.values()) {
              downloadedBytes += layer.current;
              totalBytes += layer.total;
            }

            const percentage = totalBytes > 0
              ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100))
              : 0;

            onProgress({
              layerCount: layerProgress.size,
              downloadedBytes,
              totalBytes,
              percentage,
            });
          }
        });

        stream.on('end', () => resolve());
        stream.on('error', (streamErr: Error) => {
          reject(new DockerClientError(
            `Pull stream error for ${image}: ${streamErr.message}`,
            streamErr,
          ));
        });
      });
    });
  }

  // -----------------------------------------------------------------------
  // Container lifecycle
  // -----------------------------------------------------------------------

  /**
   * Create a container. Automatically adds `host.docker.internal:host-gateway`
   * to HostConfig.ExtraHosts per T25 critical item.
   * Automatically adds `asdlc.managed=true` label per T24 for orphan cleanup.
   */
  async createContainer(options: CreateContainerOptions): Promise<Docker.Container> {
    try {
      const hostConfig = options.HostConfig ?? {};
      const existingExtraHosts = hostConfig.ExtraHosts ?? [];
      const extraHosts = [...existingExtraHosts];
      if (!extraHosts.includes('host.docker.internal:host-gateway')) {
        extraHosts.push('host.docker.internal:host-gateway');
      }

      // T24: Always add asdlc.managed label for orphan cleanup on restart
      const existingLabels = options.Labels ?? {};
      const labels = { ...existingLabels, 'asdlc.managed': 'true' };

      return await this.docker.createContainer({
        ...options,
        Labels: labels,
        HostConfig: {
          ...hostConfig,
          ExtraHosts: extraHosts,
        },
      } as Docker.ContainerCreateOptions);
    } catch (err) {
      throw new DockerClientError(
        `Failed to create container: ${(err as Error).message}`,
        err as Error,
      );
    }
  }

  /** Start a container by ID. */
  async startContainer(id: string): Promise<void> {
    try {
      const container = this.docker.getContainer(id);
      await container.start();
    } catch (err) {
      throw new DockerClientError(
        `Failed to start container ${id}: ${(err as Error).message}`,
        err as Error,
      );
    }
  }

  /** Pause a container by ID (used for dormancy). */
  async pauseContainer(id: string): Promise<void> {
    try {
      const container = this.docker.getContainer(id);
      await container.pause();
    } catch (err) {
      throw new DockerClientError(
        `Failed to pause container ${id}: ${(err as Error).message}`,
        err as Error,
      );
    }
  }

  /** Unpause a container by ID (used for waking from dormancy). */
  async unpauseContainer(id: string): Promise<void> {
    try {
      const container = this.docker.getContainer(id);
      await container.unpause();
    } catch (err) {
      throw new DockerClientError(
        `Failed to unpause container ${id}: ${(err as Error).message}`,
        err as Error,
      );
    }
  }

  /** Stop a container by ID. */
  async stopContainer(id: string): Promise<void> {
    try {
      const container = this.docker.getContainer(id);
      await container.stop();
    } catch (err) {
      throw new DockerClientError(
        `Failed to stop container ${id}: ${(err as Error).message}`,
        err as Error,
      );
    }
  }

  /** Remove a container by ID (force = true). */
  async removeContainer(id: string): Promise<void> {
    try {
      const container = this.docker.getContainer(id);
      await container.remove({ force: true });
    } catch (err) {
      throw new DockerClientError(
        `Failed to remove container ${id}: ${(err as Error).message}`,
        err as Error,
      );
    }
  }

  // -----------------------------------------------------------------------
  // Listing
  // -----------------------------------------------------------------------

  /** List containers with optional label filters. */
  async listContainers(
    filters?: Record<string, string[]>,
  ): Promise<Docker.ContainerInfo[]> {
    try {
      return await this.docker.listContainers({ filters: filters ?? {} });
    } catch (err) {
      throw new DockerClientError(
        `Failed to list containers: ${(err as Error).message}`,
        err as Error,
      );
    }
  }

  // -----------------------------------------------------------------------
  // Health check
  // -----------------------------------------------------------------------

  /**
   * Poll `GET http://localhost:<port>/health` until the endpoint responds with
   * an ok status. Retries every `intervalMs` until `timeoutMs` is reached.
   *
   * @throws DockerClientError if the timeout is exceeded.
   */
  async healthCheck(port: number, intervalMs: number, timeoutMs: number): Promise<void> {
    const url = `http://localhost:${port}/health`;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      try {
        const resp = await fetch(url);
        if (resp.ok) return;
      } catch {
        // Connection refused or other network error -- retry
      }

      if (Date.now() + intervalMs >= deadline) break;
      await new Promise((r) => setTimeout(r, intervalMs));
    }

    throw new DockerClientError(
      `Health check timeout: ${url} did not respond within ${timeoutMs}ms`,
    );
  }
}
