// ---------------------------------------------------------------------------
// Workflow plan builder (P15-F05 parallel execution)
//
// Converts a WorkflowDefinition into a WorkflowPlan by:
//   1. Building an adjacency list from transitions
//   2. Topologically sorting the node DAG
//   3. Grouping nodes that belong to a ParallelGroup into ParallelLane objects
//   4. Emitting remaining nodes as sequential string lanes
// ---------------------------------------------------------------------------

import type {
  WorkflowDefinition,
  ParallelLane,
  WorkflowPlan,
} from '../../shared/types/workflow';

/**
 * Compute a linear execution plan from a workflow definition.
 *
 * - Sequential nodes (not in any parallel group) become string lanes.
 * - Nodes listed in `workflow.parallelGroups[].laneNodeIds` are collapsed
 *   into a single `ParallelLane` entry in the lane list.
 * - The ordering respects the topological sort of the transition DAG.
 */
export function buildWorkflowPlan(workflow: WorkflowDefinition): WorkflowPlan {
  const { nodes, transitions, parallelGroups } = workflow;

  if (nodes.length === 0) {
    return { lanes: [], parallelismModel: 'multi-container', failureMode: 'strict' };
  }

  // Build adjacency list and in-degree map
  const nodeIds = new Set(nodes.map((n) => n.id));
  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const id of nodeIds) {
    adj.set(id, []);
    inDegree.set(id, 0);
  }

  for (const t of transitions) {
    if (nodeIds.has(t.sourceNodeId) && nodeIds.has(t.targetNodeId)) {
      adj.get(t.sourceNodeId)!.push(t.targetNodeId);
      inDegree.set(t.targetNodeId, (inDegree.get(t.targetNodeId) ?? 0) + 1);
    }
  }

  // Kahn's algorithm for topological sort
  const sorted: string[] = [];
  const queue: string[] = [];

  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }
  // Stable ordering: sort the initial queue by node position in definition
  const nodeOrder = new Map(nodes.map((n, i) => [n.id, i]));
  queue.sort((a, b) => (nodeOrder.get(a) ?? 0) - (nodeOrder.get(b) ?? 0));

  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    const neighbours = adj.get(current) ?? [];
    // Sort neighbours for deterministic ordering
    neighbours.sort((a, b) => (nodeOrder.get(a) ?? 0) - (nodeOrder.get(b) ?? 0));

    for (const neighbour of neighbours) {
      const newDeg = (inDegree.get(neighbour) ?? 1) - 1;
      inDegree.set(neighbour, newDeg);
      if (newDeg === 0) {
        queue.push(neighbour);
        // Re-sort to keep stable ordering
        queue.sort((a, b) => (nodeOrder.get(a) ?? 0) - (nodeOrder.get(b) ?? 0));
      }
    }
  }

  // If no parallel groups, every node is a sequential string lane
  if (!parallelGroups || parallelGroups.length === 0) {
    return {
      lanes: sorted,
      parallelismModel: 'multi-container',
      failureMode: 'strict',
    };
  }

  // Build a lookup: nodeId -> parallelGroup
  const nodeToGroup = new Map<string, typeof parallelGroups[number]>();
  for (const pg of parallelGroups) {
    for (const nid of pg.laneNodeIds) {
      nodeToGroup.set(nid, pg);
    }
  }

  // Walk sorted list and collapse parallel group members into ParallelLane
  const lanes: (string | ParallelLane)[] = [];
  const emittedGroups = new Set<string>();

  for (const nodeId of sorted) {
    const group = nodeToGroup.get(nodeId);

    if (!group) {
      // Sequential node
      lanes.push(nodeId);
    } else if (!emittedGroups.has(group.id)) {
      // First time we encounter a node from this group -- emit the full lane
      emittedGroups.add(group.id);
      lanes.push({
        nodeIds: group.laneNodeIds,
      } satisfies ParallelLane);
    }
    // If group already emitted, skip (node is already part of the lane)
  }

  return {
    lanes,
    parallelismModel: 'multi-container',
    failureMode: 'strict',
  };
}
