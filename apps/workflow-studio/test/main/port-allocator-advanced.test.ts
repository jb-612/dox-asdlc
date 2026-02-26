// @vitest-environment node
// ---------------------------------------------------------------------------
// T19: Port allocator advanced tests
//
// Covers:
//   - Allocate full range -> PortExhaustedError
//   - Release -> allocate again succeeds
//   - Concurrent allocation (no duplicates)
//   - Wrap-around after release
// ---------------------------------------------------------------------------
import { describe, it, expect, beforeEach } from 'vitest';
import { PortAllocator } from '../../src/main/services/port-allocator';
import { PortExhaustedError } from '../../src/shared/types/errors';

describe('T19: port-allocator-advanced', () => {
  // -------------------------------------------------------------------------
  // Full range exhaustion
  // -------------------------------------------------------------------------

  describe('full range exhaustion', () => {
    it('allocating the full range (3 ports) then allocating once more throws PortExhaustedError', () => {
      const alloc = new PortAllocator({ start: 50000, end: 50002 });
      // Range is 50000, 50001, 50002 -> 3 ports
      alloc.allocate(); // 50000
      alloc.allocate(); // 50001
      alloc.allocate(); // 50002

      expect(() => alloc.allocate()).toThrow(PortExhaustedError);
    });

    it('available returns 0 when all ports are allocated', () => {
      const alloc = new PortAllocator({ start: 50000, end: 50002 });
      alloc.allocate();
      alloc.allocate();
      alloc.allocate();

      expect(alloc.available()).toBe(0);
    });

    it('PortExhaustedError message contains the range', () => {
      const alloc = new PortAllocator({ start: 50000, end: 50002 });
      alloc.allocate();
      alloc.allocate();
      alloc.allocate();

      try {
        alloc.allocate();
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(PortExhaustedError);
        const msg = (err as Error).message;
        expect(msg).toContain('50000');
        expect(msg).toContain('50002');
      }
    });
  });

  // -------------------------------------------------------------------------
  // Release then re-allocate
  // -------------------------------------------------------------------------

  describe('release then re-allocate', () => {
    it('release a port, then allocate retrieves it', () => {
      const alloc = new PortAllocator({ start: 50000, end: 50002 });
      const p1 = alloc.allocate(); // 50000
      const p2 = alloc.allocate(); // 50001
      const p3 = alloc.allocate(); // 50002

      // All exhausted
      expect(() => alloc.allocate()).toThrow(PortExhaustedError);

      alloc.release(p2); // Free 50001
      const reused = alloc.allocate();
      expect(reused).toBe(50001);
    });

    it('releasing all ports then allocating gives them back', () => {
      const alloc = new PortAllocator({ start: 50000, end: 50002 });
      const ports = [alloc.allocate(), alloc.allocate(), alloc.allocate()];

      for (const p of ports) alloc.release(p);

      // All 3 should be available again
      expect(alloc.available()).toBe(3);
      const reallocated = new Set<number>();
      for (let i = 0; i < 3; i++) {
        reallocated.add(alloc.allocate());
      }
      expect(reallocated.size).toBe(3);
    });

    it('multiple release-allocate cycles produce no duplicates', () => {
      const alloc = new PortAllocator({ start: 50000, end: 50004 });
      const seen = new Set<number>();

      // Allocate 3
      for (let i = 0; i < 3; i++) {
        const p = alloc.allocate();
        expect(seen.has(p)).toBe(false);
        seen.add(p);
      }

      // Release first, allocate again
      const first = 50000;
      alloc.release(first);
      seen.delete(first);

      // Allocate 3 more (2 fresh + 1 reused)
      for (let i = 0; i < 3; i++) {
        const p = alloc.allocate();
        expect(seen.has(p)).toBe(false);
        seen.add(p);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Concurrent allocation (no duplicates)
  // -------------------------------------------------------------------------

  describe('concurrent allocation (no duplicates)', () => {
    it('allocating the full range produces all unique ports', () => {
      const alloc = new PortAllocator({ start: 49200, end: 49210 });
      const ports = new Set<number>();

      for (let i = 0; i <= 10; i++) {
        const p = alloc.allocate();
        expect(ports.has(p)).toBe(false);
        ports.add(p);
      }

      expect(ports.size).toBe(11);
    });

    it('rapid allocate-release-allocate never returns duplicates within active set', () => {
      const alloc = new PortAllocator({ start: 49200, end: 49204 });
      const active = new Set<number>();

      // Simulate rapid concurrent-like usage
      for (let cycle = 0; cycle < 20; cycle++) {
        if (alloc.available() > 0) {
          const p = alloc.allocate();
          expect(active.has(p)).toBe(false);
          active.add(p);
        }
        // Release a random active port every other cycle
        if (cycle % 2 === 0 && active.size > 0) {
          const toRelease = active.values().next().value!;
          alloc.release(toRelease);
          active.delete(toRelease);
        }
      }
    });
  });

  // -------------------------------------------------------------------------
  // Wrap-around after release
  // -------------------------------------------------------------------------

  describe('wrap-around after release', () => {
    it('cursor wraps around to find a released port at the beginning', () => {
      const alloc = new PortAllocator({ start: 50000, end: 50003 });
      // Allocate all 4
      alloc.allocate(); // 50000
      alloc.allocate(); // 50001
      alloc.allocate(); // 50002
      alloc.allocate(); // 50003

      // Release the first port
      alloc.release(50000);

      // Next allocate should wrap around and find 50000
      const reused = alloc.allocate();
      expect(reused).toBe(50000);
    });

    it('cursor wraps around multiple times', () => {
      const alloc = new PortAllocator({ start: 50000, end: 50002 });

      // First cycle: allocate all 3
      const p1 = alloc.allocate(); // 50000
      const p2 = alloc.allocate(); // 50001
      const p3 = alloc.allocate(); // 50002

      // Release all
      alloc.release(p1);
      alloc.release(p2);
      alloc.release(p3);

      // Second cycle
      const q1 = alloc.allocate();
      const q2 = alloc.allocate();
      const q3 = alloc.allocate();

      // All ports should be unique within this cycle
      const cycle2 = new Set([q1, q2, q3]);
      expect(cycle2.size).toBe(3);

      // Release all again
      alloc.release(q1);
      alloc.release(q2);
      alloc.release(q3);

      // Third cycle
      const r1 = alloc.allocate();
      expect(r1).toBeGreaterThanOrEqual(50000);
      expect(r1).toBeLessThanOrEqual(50002);
    });

    it('wrap-around with partial release finds correct gaps', () => {
      const alloc = new PortAllocator({ start: 50000, end: 50004 });

      // Allocate all 5
      for (let i = 0; i < 5; i++) alloc.allocate();

      // Release ports at positions 1 and 3
      alloc.release(50001);
      alloc.release(50003);

      // Should find the released ports
      const reused1 = alloc.allocate();
      const reused2 = alloc.allocate();

      const reusedSet = new Set([reused1, reused2]);
      expect(reusedSet).toContain(50001);
      expect(reusedSet).toContain(50003);
    });
  });

  // -------------------------------------------------------------------------
  // Single-port range edge case
  // -------------------------------------------------------------------------

  describe('single-port range', () => {
    it('range of 1 port works correctly', () => {
      const alloc = new PortAllocator({ start: 50000, end: 50000 });
      expect(alloc.available()).toBe(1);

      const p = alloc.allocate();
      expect(p).toBe(50000);
      expect(alloc.available()).toBe(0);

      expect(() => alloc.allocate()).toThrow(PortExhaustedError);

      alloc.release(p);
      expect(alloc.available()).toBe(1);

      const reused = alloc.allocate();
      expect(reused).toBe(50000);
    });
  });
});
