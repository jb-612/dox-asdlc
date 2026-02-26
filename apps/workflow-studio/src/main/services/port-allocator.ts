// ---------------------------------------------------------------------------
// Port allocator (P15-F05 parallel execution)
//
// Manages a range of host ports for mapping to Docker containers. Ports are
// allocated sequentially and tracked in a Set. When the cursor reaches the
// end of the range it wraps around to find released ports.
// ---------------------------------------------------------------------------

import { PortExhaustedError } from '../../shared/types/errors';

export interface PortAllocatorOptions {
  /** First port in the allocatable range (inclusive). Default 49200. */
  start?: number;
  /** Last port in the allocatable range (inclusive). Default 49300. */
  end?: number;
}

export class PortAllocator {
  private readonly start: number;
  private readonly end: number;
  private readonly used: Set<number> = new Set();
  /** Next port to try when allocating. */
  private cursor: number;

  constructor(opts?: PortAllocatorOptions) {
    this.start = opts?.start ?? 49200;
    this.end = opts?.end ?? 49300;
    this.cursor = this.start;
  }

  /**
   * Allocate the next available port. Ports are assigned sequentially; when
   * the cursor reaches the end of the range it wraps around to search for
   * previously released ports.
   *
   * @throws PortExhaustedError when no ports are available.
   */
  allocate(): number {
    const rangeSize = this.end - this.start + 1;

    // Try up to rangeSize candidates starting from cursor
    for (let i = 0; i < rangeSize; i++) {
      const candidate = this.start + ((this.cursor - this.start + i) % rangeSize);
      if (!this.used.has(candidate)) {
        this.used.add(candidate);
        // Advance cursor past the allocated port
        this.cursor = this.start + ((candidate - this.start + 1) % rangeSize);
        return candidate;
      }
    }

    throw new PortExhaustedError(
      `All ports exhausted in range ${this.start}-${this.end} (${rangeSize} ports)`,
    );
  }

  /**
   * Release a previously allocated port, making it available for re-use.
   * No-op if the port was not allocated.
   */
  release(port: number): void {
    this.used.delete(port);
  }

  /** Number of ports still available for allocation. */
  available(): number {
    const rangeSize = this.end - this.start + 1;
    return rangeSize - this.used.size;
  }
}
