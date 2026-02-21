import type { AgentNode, Transition } from '../../shared/types/workflow';

/**
 * Build an adjacency list from workflow transitions.
 *
 * Each node ID maps to an array of node IDs it has outgoing edges to.
 * Nodes with no outgoing edges will have an empty array.
 */
export function buildAdjacencyList(
  nodes: AgentNode[],
  transitions: Transition[],
): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const node of nodes) {
    adj.set(node.id, []);
  }
  for (const t of transitions) {
    const targets = adj.get(t.sourceNodeId) || [];
    targets.push(t.targetNodeId);
    adj.set(t.sourceNodeId, targets);
  }
  return adj;
}

/**
 * Topological sort of workflow nodes using Kahn's algorithm.
 *
 * Returns sorted node IDs (sources first, sinks last) or null if a cycle
 * is detected (i.e. not all nodes can be processed).
 */
export function topologicalSort(
  nodes: AgentNode[],
  transitions: Transition[],
): string[] | null {
  const adj = buildAdjacencyList(nodes, transitions);
  const inDegree = new Map<string, number>();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
  }
  for (const t of transitions) {
    inDegree.set(t.targetNodeId, (inDegree.get(t.targetNodeId) || 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    for (const neighbor of adj.get(current) || []) {
      const newDegree = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  return sorted.length === nodes.length ? sorted : null;
}

/**
 * Detect cycles in the workflow graph using DFS with three-color marking.
 *
 * WHITE (0) = unvisited, GRAY (1) = in current DFS path, BLACK (2) = fully processed.
 * When a GRAY node is encountered from another GRAY node, a back-edge (cycle) exists.
 *
 * Returns an array of node IDs forming a cycle, or an empty array if acyclic.
 */
export function detectCycles(
  nodes: AgentNode[],
  transitions: Transition[],
): string[] {
  const adj = buildAdjacencyList(nodes, transitions);
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  const parent = new Map<string, string | null>();

  for (const node of nodes) {
    color.set(node.id, WHITE);
    parent.set(node.id, null);
  }

  const cyclePath: string[] = [];

  function dfs(nodeId: string): boolean {
    color.set(nodeId, GRAY);

    for (const neighbor of adj.get(nodeId) || []) {
      if (color.get(neighbor) === GRAY) {
        // Found a back-edge -- reconstruct the cycle path.
        cyclePath.push(neighbor);
        let current = nodeId;
        while (current !== neighbor) {
          cyclePath.push(current);
          current = parent.get(current)!;
        }
        cyclePath.reverse();
        return true;
      }
      if (color.get(neighbor) === WHITE) {
        parent.set(neighbor, nodeId);
        if (dfs(neighbor)) return true;
      }
    }

    color.set(nodeId, BLACK);
    return false;
  }

  for (const node of nodes) {
    if (color.get(node.id) === WHITE) {
      if (dfs(node.id)) return cyclePath;
    }
  }

  return [];
}

/**
 * Check if targetNodeId is reachable from sourceNodeId via BFS.
 *
 * Returns true if there is a directed path from source to target, false otherwise.
 * Returns false if source equals target (no self-reachability without a cycle).
 */
export function isReachable(
  nodes: AgentNode[],
  transitions: Transition[],
  sourceNodeId: string,
  targetNodeId: string,
): boolean {
  if (sourceNodeId === targetNodeId) return false;

  const adj = buildAdjacencyList(nodes, transitions);
  const visited = new Set<string>();
  const queue = [sourceNodeId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === targetNodeId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    for (const neighbor of adj.get(current) || []) {
      if (!visited.has(neighbor)) queue.push(neighbor);
    }
  }

  return false;
}

/**
 * Find all start nodes -- nodes with no incoming edges.
 *
 * In a well-formed DAG workflow, there should be exactly one start node.
 * Multiple start nodes indicate independent entry points.
 */
export function findStartNodes(
  nodes: AgentNode[],
  transitions: Transition[],
): AgentNode[] {
  const hasIncoming = new Set(transitions.map((t) => t.targetNodeId));
  return nodes.filter((n) => !hasIncoming.has(n.id));
}

/**
 * Find all end nodes -- nodes with no outgoing edges.
 *
 * In a well-formed DAG workflow, there should be at least one end node.
 * Multiple end nodes indicate independent completion points.
 */
export function findEndNodes(
  nodes: AgentNode[],
  transitions: Transition[],
): AgentNode[] {
  const hasOutgoing = new Set(transitions.map((t) => t.sourceNodeId));
  return nodes.filter((n) => !hasOutgoing.has(n.id));
}

/**
 * Find disconnected nodes -- nodes with neither incoming nor outgoing edges.
 *
 * These are isolated nodes that do not participate in any workflow transitions.
 * A single-node workflow with no transitions is not considered disconnected.
 */
export function findDisconnectedNodes(
  nodes: AgentNode[],
  transitions: Transition[],
): AgentNode[] {
  const connected = new Set<string>();
  for (const t of transitions) {
    connected.add(t.sourceNodeId);
    connected.add(t.targetNodeId);
  }
  return nodes.filter((n) => !connected.has(n.id));
}
