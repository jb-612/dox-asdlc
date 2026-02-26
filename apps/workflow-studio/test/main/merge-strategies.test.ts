// @vitest-environment node
// ---------------------------------------------------------------------------
// Merge strategies tests (P15-F05 Phase C, T31)
//
// Tests for concatenate, workspace, and custom merge strategies.
// ---------------------------------------------------------------------------
import { describe, it, expect } from 'vitest';
import type { ParallelBlockResult } from '../../src/shared/types/execution';
import { mergeResults } from '../../src/main/services/merge-strategies';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeResult(
  blockId: string,
  output: unknown,
  success = true,
  error?: string,
): ParallelBlockResult {
  return {
    blockId,
    success,
    output,
    error,
    durationMs: 100,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('mergeResults', () => {
  // -----------------------------------------------------------------------
  // concatenate strategy
  // -----------------------------------------------------------------------
  describe('concatenate strategy', () => {
    it('joins outputs as an array', () => {
      const results: ParallelBlockResult[] = [
        makeResult('b1', { data: 'first' }),
        makeResult('b2', { data: 'second' }),
        makeResult('b3', { data: 'third' }),
      ];

      const merged = mergeResults('concatenate', results);

      expect(Array.isArray(merged)).toBe(true);
      expect(merged).toHaveLength(3);
      expect((merged as unknown[])[0]).toEqual({ data: 'first' });
      expect((merged as unknown[])[1]).toEqual({ data: 'second' });
      expect((merged as unknown[])[2]).toEqual({ data: 'third' });
    });

    it('handles empty results array', () => {
      const merged = mergeResults('concatenate', []);

      expect(Array.isArray(merged)).toBe(true);
      expect(merged).toHaveLength(0);
    });

    it('includes failed block outputs (may be undefined)', () => {
      const results: ParallelBlockResult[] = [
        makeResult('b1', { ok: true }),
        makeResult('b2', undefined, false, 'failed'),
      ];

      const merged = mergeResults('concatenate', results) as unknown[];
      expect(merged).toHaveLength(2);
      expect(merged[1]).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // workspace strategy
  // -----------------------------------------------------------------------
  describe('workspace strategy', () => {
    it('detects no conflicts when files are disjoint', () => {
      const results: ParallelBlockResult[] = [
        makeResult('b1', { filesChanged: ['src/a.ts', 'src/b.ts'] }),
        makeResult('b2', { filesChanged: ['src/c.ts', 'src/d.ts'] }),
      ];

      const merged = mergeResults('workspace', results) as {
        files: string[];
        conflicts: string[];
      };

      expect(merged.conflicts).toHaveLength(0);
      expect(merged.files).toContain('src/a.ts');
      expect(merged.files).toContain('src/c.ts');
      expect(merged.files).toHaveLength(4);
    });

    it('detects file conflicts when same file modified by multiple blocks', () => {
      const results: ParallelBlockResult[] = [
        makeResult('b1', { filesChanged: ['src/shared.ts', 'src/a.ts'] }),
        makeResult('b2', { filesChanged: ['src/shared.ts', 'src/b.ts'] }),
      ];

      const merged = mergeResults('workspace', results) as {
        files: string[];
        conflicts: string[];
      };

      expect(merged.conflicts).toContain('src/shared.ts');
      expect(merged.conflicts).toHaveLength(1);
    });

    it('handles missing filesChanged in output', () => {
      const results: ParallelBlockResult[] = [
        makeResult('b1', { noFiles: true }),
        makeResult('b2', { filesChanged: ['src/a.ts'] }),
      ];

      const merged = mergeResults('workspace', results) as {
        files: string[];
        conflicts: string[];
      };

      expect(merged.conflicts).toHaveLength(0);
      expect(merged.files).toContain('src/a.ts');
    });

    it('handles empty results', () => {
      const merged = mergeResults('workspace', []) as {
        files: string[];
        conflicts: string[];
      };

      expect(merged.files).toHaveLength(0);
      expect(merged.conflicts).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // custom strategy
  // -----------------------------------------------------------------------
  describe('custom strategy', () => {
    it('passes through results as-is (no transformation)', () => {
      const results: ParallelBlockResult[] = [
        makeResult('b1', { custom: true }),
        makeResult('b2', { custom: false }),
      ];

      const merged = mergeResults('custom', results);

      // Custom just returns the raw results array for user-provided processing
      expect(merged).toEqual(results);
    });

    it('accepts a custom merge function when provided', () => {
      const results: ParallelBlockResult[] = [
        makeResult('b1', 10),
        makeResult('b2', 20),
        makeResult('b3', 30),
      ];

      const customFn = (rs: ParallelBlockResult[]) =>
        rs.reduce((sum, r) => sum + (r.output as number), 0);

      const merged = mergeResults('custom', results, customFn);

      expect(merged).toBe(60);
    });
  });

  // -----------------------------------------------------------------------
  // Unknown strategy
  // -----------------------------------------------------------------------
  describe('unknown strategy', () => {
    it('falls back to concatenate for unrecognized strategy', () => {
      const results: ParallelBlockResult[] = [
        makeResult('b1', 'x'),
        makeResult('b2', 'y'),
      ];

      // Force an unknown strategy
      const merged = mergeResults('unknown-strategy' as any, results);

      expect(Array.isArray(merged)).toBe(true);
      expect(merged).toHaveLength(2);
    });
  });
});
