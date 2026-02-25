/**
 * Dagre-based layout engine for the ExecutionCanvas.
 *
 * Computes top-to-bottom (TB) positions for workflow nodes using the dagre
 * graph layout library. Parallel branches (nodes sharing the same fork source
 * and converging to the same join target) are automatically placed side by
 * side at the same rank.
 */
import dagre from '@dagrejs/dagre';
import type { AgentNode, Transition, HITLGateDefinition } from '../../../shared/types/workflow';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Default dimensions assumed per node for dagre layout */
const DEFAULT_NODE_WIDTH = 180;
const DEFAULT_NODE_HEIGHT = 60;

/** Spacing between ranks (vertical gap in TB layout) */
const RANK_SEP = 80;

/** Spacing between nodes within the same rank (horizontal gap) */
const NODE_SEP = 60;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface LayoutPosition {
  x: number;
  y: number;
}

/**
 * Compute dagre-based positions for all agent nodes and gate nodes.
 *
 * Returns a map from node ID to computed { x, y } position.
 * The layout uses `rankdir: 'TB'` (top-to-bottom) so parallel branches
 * naturally receive the same rank (y) and different column (x).
 */
export function computeDagreLayout(
  nodes: AgentNode[],
  transitions: Transition[],
  gates: HITLGateDefinition[],
): Map<string, LayoutPosition> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: 'TB',
    ranksep: RANK_SEP,
    nodesep: NODE_SEP,
    marginx: 20,
    marginy: 20,
  });
  g.setDefaultEdgeLabel(() => ({}));

  // Add agent nodes
  for (const node of nodes) {
    g.setNode(node.id, {
      width: DEFAULT_NODE_WIDTH,
      height: DEFAULT_NODE_HEIGHT,
    });
  }

  // Add gate nodes (positioned relative to their parent agent node)
  for (const gate of gates) {
    g.setNode(gate.id, {
      width: DEFAULT_NODE_WIDTH,
      height: DEFAULT_NODE_HEIGHT,
    });
    // Gate is associated with an agent node -- add an edge so dagre knows
    // the gate should be ranked near its parent
    if (gate.nodeId) {
      g.setEdge(gate.nodeId, gate.id);
    }
  }

  // Add transition edges
  for (const t of transitions) {
    g.setEdge(t.sourceNodeId, t.targetNodeId);
  }

  // Run the layout algorithm
  dagre.layout(g);

  // Collect results
  const positions = new Map<string, LayoutPosition>();
  for (const nodeId of g.nodes()) {
    const nodeInfo = g.node(nodeId);
    if (nodeInfo) {
      // Dagre outputs center coordinates; shift to top-left for React Flow
      positions.set(nodeId, {
        x: nodeInfo.x - DEFAULT_NODE_WIDTH / 2,
        y: nodeInfo.y - DEFAULT_NODE_HEIGHT / 2,
      });
    }
  }

  return positions;
}
