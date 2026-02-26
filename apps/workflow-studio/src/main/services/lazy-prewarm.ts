// ---------------------------------------------------------------------------
// Lazy pre-warming utility (P15-F05, T34)
//
// Instead of pre-warming all containers at execution start, this module
// analyzes the workflow plan and determines the optimal point to trigger
// container pre-warming: one lane before the first parallel group.
//
// This reduces resource usage for workflows that start with sequential blocks.
// ---------------------------------------------------------------------------

import type { WorkflowPlan, ParallelLane } from '../../shared/types/workflow';

/**
 * Determine whether a lane is a parallel lane (object with nodeIds) vs a
 * sequential lane (plain string).
 */
function isParallelLane(lane: string | ParallelLane): lane is ParallelLane {
  return typeof lane === 'object' && 'nodeIds' in lane;
}

/**
 * Compute the lane index at which the container pool should be pre-warmed.
 *
 * Returns the index of the lane immediately before the first parallel group,
 * so that containers are warm by the time parallel execution begins.
 *
 * @returns Lane index to trigger prewarm at, or -1 if no pre-warming is needed
 *          (all sequential or parallel group is at position 0).
 */
export function computePrewarmPoint(plan: WorkflowPlan): number {
  for (let i = 0; i < plan.lanes.length; i++) {
    if (isParallelLane(plan.lanes[i])) {
      // Found the first parallel group
      if (i === 0) {
        // Cannot prewarm before the first lane -- caller should prewarm at start
        return -1;
      }
      return i - 1;
    }
  }

  // No parallel groups found
  return -1;
}

/**
 * Get the width (number of parallel nodes) of the first parallel group
 * in the plan. Returns 0 if there are no parallel groups.
 *
 * This is useful for determining how many containers to pre-warm.
 */
export function getFirstParallelWidth(plan: WorkflowPlan): number {
  for (const lane of plan.lanes) {
    if (isParallelLane(lane)) {
      return lane.nodeIds.length;
    }
  }
  return 0;
}
