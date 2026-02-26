// @vitest-environment node
// ---------------------------------------------------------------------------
// T34: Lazy pre-warming tests
//
// Tests:
//   - computePrewarmPoint returns the lane index one before the first parallel group
//   - No parallel groups => returns -1 (no prewarm needed)
//   - Parallel group at lane 0 => returns -1 (cannot prewarm before start)
//   - Multiple parallel groups => returns index before the first one
//   - All sequential => returns -1
// ---------------------------------------------------------------------------
import { describe, it, expect } from 'vitest';
import { computePrewarmPoint, getFirstParallelWidth } from '../../src/main/services/lazy-prewarm';
import type { WorkflowPlan, ParallelLane } from '../../src/shared/types/workflow';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlan(lanes: (string | ParallelLane)[]): WorkflowPlan {
  return {
    lanes,
    parallelismModel: 'multi-container',
    failureMode: 'strict',
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('T34: computePrewarmPoint', () => {
  // -------------------------------------------------------------------------
  // Basic cases
  // -------------------------------------------------------------------------

  it('returns lane index N-1 when parallel group is at lane N', () => {
    // lanes: [seq, seq, parallel, seq]
    const plan = makePlan([
      'A',
      'B',
      { nodeIds: ['C1', 'C2', 'C3'] },
      'D',
    ]);

    const result = computePrewarmPoint(plan);

    // Parallel group is at index 2, so prewarm at index 1
    expect(result).toBe(1);
  });

  it('returns 0 when parallel group is at lane 1', () => {
    // lanes: [seq, parallel, seq]
    const plan = makePlan([
      'A',
      { nodeIds: ['B1', 'B2'] },
      'C',
    ]);

    expect(computePrewarmPoint(plan)).toBe(0);
  });

  // -------------------------------------------------------------------------
  // No parallel groups
  // -------------------------------------------------------------------------

  it('returns -1 when all lanes are sequential', () => {
    const plan = makePlan(['A', 'B', 'C', 'D']);

    expect(computePrewarmPoint(plan)).toBe(-1);
  });

  it('returns -1 for an empty plan', () => {
    const plan = makePlan([]);

    expect(computePrewarmPoint(plan)).toBe(-1);
  });

  // -------------------------------------------------------------------------
  // Parallel group at lane 0
  // -------------------------------------------------------------------------

  it('returns -1 when parallel group is at lane 0 (cannot prewarm before start)', () => {
    const plan = makePlan([
      { nodeIds: ['A1', 'A2'] },
      'B',
    ]);

    expect(computePrewarmPoint(plan)).toBe(-1);
  });

  // -------------------------------------------------------------------------
  // Multiple parallel groups
  // -------------------------------------------------------------------------

  it('returns index before the first parallel group when multiple exist', () => {
    // lanes: [seq, parallel1, seq, parallel2, seq]
    const plan = makePlan([
      'A',
      { nodeIds: ['B1', 'B2'] },
      'C',
      { nodeIds: ['D1', 'D2', 'D3'] },
      'E',
    ]);

    // First parallel is at index 1, prewarm at index 0
    expect(computePrewarmPoint(plan)).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Single lane plan
  // -------------------------------------------------------------------------

  it('returns -1 for single sequential lane', () => {
    const plan = makePlan(['only']);

    expect(computePrewarmPoint(plan)).toBe(-1);
  });

  it('returns -1 for single parallel lane', () => {
    const plan = makePlan([{ nodeIds: ['A', 'B'] }]);

    expect(computePrewarmPoint(plan)).toBe(-1);
  });

  // -------------------------------------------------------------------------
  // Parallel width extraction
  // -------------------------------------------------------------------------

  it('getFirstParallelWidth returns the number of nodes in the first parallel group', () => {
    const plan = makePlan([
      'A',
      { nodeIds: ['B1', 'B2', 'B3'] },
      'C',
    ]);

    expect(getFirstParallelWidth(plan)).toBe(3);
  });

  it('getFirstParallelWidth returns 0 for all-sequential plan', () => {
    const plan = makePlan(['A', 'B', 'C']);
    expect(getFirstParallelWidth(plan)).toBe(0);
  });
});
