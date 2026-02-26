// ---------------------------------------------------------------------------
// Container state machine (P15-F05 parallel execution)
//
// Valid transitions:
//   starting -> idle
//   idle     -> running
//   running  -> dormant
//   dormant  -> idle        (wake)
//   *        -> terminated  (any state can terminate)
// ---------------------------------------------------------------------------

import type { ContainerState } from '../../shared/types/execution';

/**
 * Adjacency map of valid transitions.
 * Each key maps to the set of states it can transition to.
 * 'terminated' is always reachable from any state (including itself).
 */
const VALID_TRANSITIONS: Record<ContainerState, ReadonlySet<ContainerState>> = {
  starting: new Set<ContainerState>(['idle', 'terminated']),
  idle: new Set<ContainerState>(['running', 'terminated']),
  running: new Set<ContainerState>(['dormant', 'terminated']),
  dormant: new Set<ContainerState>(['idle', 'terminated']),
  terminated: new Set<ContainerState>(['terminated']),
};

/**
 * Returns true if the transition from `from` to `to` is valid according to
 * the container lifecycle state machine.
 */
export function isValidTransition(from: ContainerState, to: ContainerState): boolean {
  return VALID_TRANSITIONS[from].has(to);
}

/**
 * Asserts that the transition from `from` to `to` is valid.
 * Throws an Error with a descriptive message if the transition is invalid.
 */
export function assertTransition(from: ContainerState, to: ContainerState): void {
  if (!isValidTransition(from, to)) {
    throw new Error(
      `Invalid transition: ${from} -> ${to}. ` +
        `Allowed transitions from '${from}': ${[...VALID_TRANSITIONS[from]].join(', ')}`,
    );
  }
}
