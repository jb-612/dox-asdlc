// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { computeBackoffMs } from '../../src/main/services/retry-utils';

describe('F14-T02: computeBackoffMs', () => {
  it('returns approximately baseMs for attempt 0', () => {
    const result = computeBackoffMs(0, 1000);
    // baseMs * 2^0 = 1000, plus jitter in [0, 1000)
    expect(result).toBeGreaterThanOrEqual(1000);
    expect(result).toBeLessThan(2000);
  });

  it('returns approximately 8000 for attempt 3', () => {
    const result = computeBackoffMs(3, 1000);
    // baseMs * 2^3 = 8000, plus jitter in [0, 1000)
    expect(result).toBeGreaterThanOrEqual(8000);
    expect(result).toBeLessThan(9000);
  });

  it('includes jitter (not exact powers of 2)', () => {
    // Run 20 times; at least one should differ from exact power
    const results = new Set<number>();
    for (let i = 0; i < 20; i++) {
      results.add(computeBackoffMs(1, 1000));
    }
    // With jitter, we should get more than one unique value
    expect(results.size).toBeGreaterThan(1);
  });

  it('always returns >= 0', () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      const result = computeBackoffMs(attempt, 1000);
      expect(result).toBeGreaterThanOrEqual(0);
    }
  });

  it('works with baseMs of 0', () => {
    const result = computeBackoffMs(3, 0);
    expect(result).toBe(0);
  });

  it('caps at 60 seconds regardless of attempt', () => {
    const result = computeBackoffMs(20, 5000);
    expect(result).toBeLessThanOrEqual(60_000);
  });
});
