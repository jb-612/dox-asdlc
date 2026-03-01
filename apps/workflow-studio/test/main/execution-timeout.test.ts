// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import {
  computeProgressiveTimeout,
  computeWorkflowTimeout,
} from '../../src/main/services/retry-utils';

describe('F14-T05: Timeout enhancements', () => {
  describe('computeProgressiveTimeout', () => {
    it('returns base timeout for attempt 0', () => {
      expect(computeProgressiveTimeout(300_000, 0)).toBe(300_000);
    });

    it('increases by 50% per retry attempt', () => {
      // attempt 1: 300_000 * 1.5 = 450_000
      expect(computeProgressiveTimeout(300_000, 1)).toBe(450_000);
    });

    it('caps at 2x the original timeout', () => {
      // attempt 2: 300_000 * 2 = 600_000 (capped)
      expect(computeProgressiveTimeout(300_000, 2)).toBe(600_000);
      // attempt 5: would be 300_000 * 3.5, still capped at 2x
      expect(computeProgressiveTimeout(300_000, 5)).toBe(600_000);
    });
  });

  describe('computeWorkflowTimeout', () => {
    it('uses explicit timeoutSeconds when provided', () => {
      const result = computeWorkflowTimeout({
        sequentialTimeoutMs: 300_000,
        maxParallelTimeoutMs: 0,
        overrideSeconds: 600,
      });
      expect(result).toBe(600_000); // 600s * 1000
    });

    it('computes auto timeout as sum(sequential) + max(parallel) + 20%', () => {
      const result = computeWorkflowTimeout({
        sequentialTimeoutMs: 500_000,
        maxParallelTimeoutMs: 200_000,
        overrideSeconds: undefined,
      });
      // (500_000 + 200_000) * 1.2 = 840_000
      expect(result).toBe(840_000);
    });

    it('handles zero values', () => {
      const result = computeWorkflowTimeout({
        sequentialTimeoutMs: 0,
        maxParallelTimeoutMs: 0,
        overrideSeconds: undefined,
      });
      expect(result).toBe(0);
    });
  });
});
