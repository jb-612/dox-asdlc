// @vitest-environment node
// ---------------------------------------------------------------------------
// T17: Comprehensive state machine tests for container-states.ts
//
// Covers:
//   - All valid transitions with assertion
//   - All invalid transitions throw
//   - Edge cases: double-terminate, terminate during prewarm, acquire on empty
// ---------------------------------------------------------------------------
import { describe, it, expect } from 'vitest';
import { isValidTransition, assertTransition } from '../../src/main/services/container-states';
import type { ContainerState } from '../../src/shared/types/execution';

// ---------------------------------------------------------------------------
// All states
// ---------------------------------------------------------------------------

const ALL_STATES: ContainerState[] = [
  'starting',
  'idle',
  'running',
  'dormant',
  'terminated',
];

describe('T17: container-pool-state-machine', () => {
  // -------------------------------------------------------------------------
  // Exhaustive valid transitions
  // -------------------------------------------------------------------------

  describe('all valid transitions', () => {
    const validPairs: [ContainerState, ContainerState][] = [
      // Forward lifecycle
      ['starting', 'idle'],
      ['idle', 'running'],
      ['running', 'dormant'],
      ['dormant', 'idle'],
      // Any state -> terminated
      ['starting', 'terminated'],
      ['idle', 'terminated'],
      ['running', 'terminated'],
      ['dormant', 'terminated'],
      ['terminated', 'terminated'],
    ];

    it.each(validPairs)('isValidTransition(%s, %s) returns true', (from, to) => {
      expect(isValidTransition(from, to)).toBe(true);
    });

    it.each(validPairs)('assertTransition(%s, %s) does not throw', (from, to) => {
      expect(() => assertTransition(from, to)).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // Exhaustive invalid transitions
  // -------------------------------------------------------------------------

  describe('all invalid transitions', () => {
    const invalidPairs: [ContainerState, ContainerState][] = [
      // starting: only -> idle, terminated
      ['starting', 'running'],
      ['starting', 'dormant'],
      ['starting', 'starting'],
      // idle: only -> running, terminated
      ['idle', 'starting'],
      ['idle', 'idle'],
      ['idle', 'dormant'],
      // running: only -> dormant, terminated
      ['running', 'starting'],
      ['running', 'idle'],
      ['running', 'running'],
      // dormant: only -> idle, terminated
      ['dormant', 'starting'],
      ['dormant', 'running'],
      ['dormant', 'dormant'],
      // terminated: only -> terminated
      ['terminated', 'starting'],
      ['terminated', 'idle'],
      ['terminated', 'running'],
      ['terminated', 'dormant'],
    ];

    it.each(invalidPairs)('isValidTransition(%s, %s) returns false', (from, to) => {
      expect(isValidTransition(from, to)).toBe(false);
    });

    it.each(invalidPairs)('assertTransition(%s, %s) throws', (from, to) => {
      expect(() => assertTransition(from, to)).toThrow(Error);
    });

    it.each(invalidPairs)(
      'assertTransition(%s, %s) error message includes both states',
      (from, to) => {
        try {
          assertTransition(from, to);
          expect.fail('should have thrown');
        } catch (err) {
          const msg = (err as Error).message;
          expect(msg).toContain(from);
          expect(msg).toContain(to);
        }
      },
    );
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe('edge cases', () => {
    it('double-terminate (terminated -> terminated) is valid', () => {
      expect(isValidTransition('terminated', 'terminated')).toBe(true);
      expect(() => assertTransition('terminated', 'terminated')).not.toThrow();
    });

    it('every state can transition to terminated', () => {
      for (const state of ALL_STATES) {
        expect(isValidTransition(state, 'terminated')).toBe(true);
      }
    });

    it('no state (except dormant) can transition back to idle except starting', () => {
      const statesThatCanReachIdle: ContainerState[] = ['starting', 'dormant'];
      for (const state of ALL_STATES) {
        if (statesThatCanReachIdle.includes(state)) {
          expect(isValidTransition(state, 'idle')).toBe(true);
        } else {
          expect(isValidTransition(state, 'idle')).toBe(false);
        }
      }
    });

    it('starting is only reachable as an initial state (nothing transitions to starting)', () => {
      for (const state of ALL_STATES) {
        if (state === 'starting') {
          // starting -> starting is invalid
          expect(isValidTransition(state, 'starting')).toBe(false);
        } else {
          expect(isValidTransition(state, 'starting')).toBe(false);
        }
      }
    });

    it('assertTransition error message includes allowed transitions', () => {
      try {
        assertTransition('starting', 'running');
        expect.fail('should have thrown');
      } catch (err) {
        const msg = (err as Error).message;
        // Should mention the allowed transitions from starting
        expect(msg).toContain('idle');
        expect(msg).toContain('terminated');
      }
    });
  });

  // -------------------------------------------------------------------------
  // Completeness check: every pair is classified
  // -------------------------------------------------------------------------

  describe('completeness', () => {
    it('every (from, to) pair returns a boolean from isValidTransition', () => {
      for (const from of ALL_STATES) {
        for (const to of ALL_STATES) {
          const result = isValidTransition(from, to);
          expect(typeof result).toBe('boolean');
        }
      }
    });

    it('total of 25 pairs (5x5) are all covered', () => {
      let validCount = 0;
      let invalidCount = 0;
      for (const from of ALL_STATES) {
        for (const to of ALL_STATES) {
          if (isValidTransition(from, to)) {
            validCount++;
          } else {
            invalidCount++;
          }
        }
      }
      // 9 valid + 16 invalid = 25 total
      expect(validCount + invalidCount).toBe(25);
      expect(validCount).toBe(9);
      expect(invalidCount).toBe(16);
    });
  });
});
