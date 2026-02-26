// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { isValidTransition, assertTransition } from '../../src/main/services/container-states';
import type { ContainerState } from '../../src/shared/types/execution';

describe('container-states', () => {
  // -----------------------------------------------------------------------
  // Valid transitions
  // -----------------------------------------------------------------------

  describe('isValidTransition', () => {
    const validTransitions: [ContainerState, ContainerState][] = [
      ['starting', 'idle'],
      ['idle', 'running'],
      ['running', 'dormant'],
      ['dormant', 'idle'],
      // any -> terminated
      ['starting', 'terminated'],
      ['idle', 'terminated'],
      ['running', 'terminated'],
      ['dormant', 'terminated'],
      ['terminated', 'terminated'],
    ];

    it.each(validTransitions)(
      'allows %s -> %s',
      (from, to) => {
        expect(isValidTransition(from, to)).toBe(true);
      },
    );

    // -----------------------------------------------------------------------
    // Invalid transitions
    // -----------------------------------------------------------------------

    const invalidTransitions: [ContainerState, ContainerState][] = [
      ['starting', 'running'],     // must go through idle
      ['starting', 'dormant'],     // must go through idle -> running
      ['idle', 'dormant'],         // must go through running
      ['idle', 'starting'],        // cannot go back to starting
      ['running', 'idle'],         // running goes to dormant, not idle
      ['running', 'starting'],     // cannot go back to starting
      ['dormant', 'running'],      // dormant wakes to idle, not running
      ['dormant', 'starting'],     // cannot go back to starting
      ['terminated', 'starting'],  // terminated is final (except terminated->terminated)
      ['terminated', 'idle'],      // terminated is final
      ['terminated', 'running'],   // terminated is final
      ['terminated', 'dormant'],   // terminated is final
    ];

    it.each(invalidTransitions)(
      'rejects %s -> %s',
      (from, to) => {
        expect(isValidTransition(from, to)).toBe(false);
      },
    );
  });

  // -----------------------------------------------------------------------
  // assertTransition
  // -----------------------------------------------------------------------

  describe('assertTransition', () => {
    it('does not throw for valid transitions', () => {
      expect(() => assertTransition('starting', 'idle')).not.toThrow();
      expect(() => assertTransition('idle', 'running')).not.toThrow();
      expect(() => assertTransition('running', 'dormant')).not.toThrow();
      expect(() => assertTransition('dormant', 'idle')).not.toThrow();
      expect(() => assertTransition('running', 'terminated')).not.toThrow();
    });

    it('throws for invalid transitions with descriptive message', () => {
      expect(() => assertTransition('starting', 'running')).toThrow(
        /invalid.*transition.*starting.*running/i,
      );
    });

    it('throws an Error instance', () => {
      try {
        assertTransition('idle', 'starting');
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
      }
    });
  });
});
