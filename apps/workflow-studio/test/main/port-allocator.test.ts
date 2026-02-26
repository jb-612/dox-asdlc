// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { PortAllocator } from '../../src/main/services/port-allocator';
import { PortExhaustedError } from '../../src/shared/types/errors';

describe('PortAllocator', () => {
  let allocator: PortAllocator;

  beforeEach(() => {
    // Small range for easy testing
    allocator = new PortAllocator({ start: 49200, end: 49205 });
  });

  // -----------------------------------------------------------------------
  // Sequential allocation
  // -----------------------------------------------------------------------

  describe('allocate', () => {
    it('allocates ports sequentially starting from the start port', () => {
      expect(allocator.allocate()).toBe(49200);
      expect(allocator.allocate()).toBe(49201);
      expect(allocator.allocate()).toBe(49202);
    });

    it('skips ports that are already in use (after release and re-allocation)', () => {
      const p1 = allocator.allocate(); // 49200
      const p2 = allocator.allocate(); // 49201
      allocator.release(p1);
      // Next allocate continues sequentially
      const p3 = allocator.allocate(); // 49202
      expect(p2).toBe(49201);
      expect(p3).toBe(49202);
    });

    it('wraps around and reuses released ports when reaching end of range', () => {
      // Allocate all 6 ports (49200-49205)
      for (let i = 0; i < 6; i++) {
        allocator.allocate();
      }
      // Release one in the middle
      allocator.release(49202);
      // Next allocation should find the released port
      const port = allocator.allocate();
      expect(port).toBe(49202);
    });
  });

  // -----------------------------------------------------------------------
  // Exhaustion
  // -----------------------------------------------------------------------

  describe('exhaustion', () => {
    it('throws PortExhaustedError when all ports are in use', () => {
      // Allocate all 6 ports
      for (let i = 0; i < 6; i++) {
        allocator.allocate();
      }

      expect(() => allocator.allocate()).toThrow(PortExhaustedError);
    });

    it('error message mentions the range', () => {
      for (let i = 0; i < 6; i++) {
        allocator.allocate();
      }

      expect(() => allocator.allocate()).toThrow(/49200.*49205|port.*exhaust/i);
    });
  });

  // -----------------------------------------------------------------------
  // Release
  // -----------------------------------------------------------------------

  describe('release', () => {
    it('frees a port so it can be re-allocated', () => {
      const port = allocator.allocate();
      // Use all remaining
      for (let i = 1; i < 6; i++) {
        allocator.allocate();
      }
      // All used, release one
      allocator.release(port);
      // Should be able to allocate again
      const reused = allocator.allocate();
      expect(reused).toBe(port);
    });

    it('is a no-op if the port was not allocated', () => {
      // Should not throw
      expect(() => allocator.release(99999)).not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // No double allocation
  // -----------------------------------------------------------------------

  describe('no double allocation', () => {
    it('never allocates the same port twice without release', () => {
      const ports = new Set<number>();
      for (let i = 0; i < 6; i++) {
        const p = allocator.allocate();
        expect(ports.has(p)).toBe(false);
        ports.add(p);
      }
    });
  });

  // -----------------------------------------------------------------------
  // available
  // -----------------------------------------------------------------------

  describe('available', () => {
    it('returns total range size initially', () => {
      expect(allocator.available()).toBe(6);
    });

    it('decreases as ports are allocated', () => {
      allocator.allocate();
      allocator.allocate();
      expect(allocator.available()).toBe(4);
    });

    it('increases when ports are released', () => {
      const p = allocator.allocate();
      expect(allocator.available()).toBe(5);
      allocator.release(p);
      expect(allocator.available()).toBe(6);
    });

    it('returns 0 when all ports are allocated', () => {
      for (let i = 0; i < 6; i++) {
        allocator.allocate();
      }
      expect(allocator.available()).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Default range
  // -----------------------------------------------------------------------

  describe('default range', () => {
    it('uses 49200-49300 when no options provided', () => {
      const defaultAllocator = new PortAllocator();
      // 101 ports: 49200 through 49300 inclusive
      expect(defaultAllocator.available()).toBe(101);
      expect(defaultAllocator.allocate()).toBe(49200);
    });
  });
});
