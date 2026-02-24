import type { StateCreator } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type {
  WorkflowDefinition,
  AgentNode,
  AgentNodeType,
  AgentNodeConfig,
  Transition,
  TransitionCondition,
  HITLGateDefinition,
} from '../../../shared/types/workflow';
import { NODE_TYPE_METADATA } from '../../../shared/constants';

/**
 * Touch the updatedAt timestamp of a workflow and return a fresh clone
 * suitable for storing as the new current state.
 */
function touchUpdatedAt(wf: WorkflowDefinition): WorkflowDefinition {
  return {
    ...wf,
    metadata: {
      ...wf.metadata,
      updatedAt: new Date().toISOString(),
    },
  };
}

function createDefaultNode(
  type: AgentNodeType,
  position: { x: number; y: number },
): AgentNode {
  const meta = NODE_TYPE_METADATA[type];
  return {
    id: uuidv4(),
    type,
    label: meta.label,
    config: {},
    inputs: [],
    outputs: [],
    position,
    description: meta.description,
  };
}

function createDefaultGate(nodeId: string): HITLGateDefinition {
  return {
    id: uuidv4(),
    nodeId,
    gateType: 'approval',
    prompt: 'Approve this step?',
    options: [
      { label: 'Approve', value: 'approve', isDefault: true },
      { label: 'Reject', value: 'reject' },
    ],
    required: true,
  };
}

export interface WorkflowNodesSlice {
  selectedNodeId: string | null;
  selectedEdgeId: string | null;

  addNode: (type: AgentNodeType, position: { x: number; y: number }) => string;
  removeNode: (nodeId: string) => void;
  updateNode: (nodeId: string, updates: Partial<AgentNode>) => void;
  updateNodeConfig: (nodeId: string, config: Partial<AgentNodeConfig>) => void;
  moveNode: (nodeId: string, position: { x: number; y: number }) => void;

  addEdge: (
    sourceNodeId: string,
    targetNodeId: string,
    condition?: TransitionCondition,
  ) => string;
  removeEdge: (edgeId: string) => void;
  updateEdge: (edgeId: string, updates: Partial<Transition>) => void;

  addGate: (nodeId: string) => string;
  removeGate: (gateId: string) => void;
  updateGate: (gateId: string, updates: Partial<HITLGateDefinition>) => void;

  selectNode: (nodeId: string | null) => void;
  selectEdge: (edgeId: string | null) => void;
  clearSelection: () => void;
}

export const createNodesSlice: StateCreator<
  WorkflowNodesSlice & { workflow: WorkflowDefinition | null; isDirty: boolean; pushHistory: () => void },
  [],
  [],
  WorkflowNodesSlice
> = (set, get) => ({
  selectedNodeId: null,
  selectedEdgeId: null,

  // --- Node actions ---

  addNode: (type, position) => {
    const { workflow } = get();
    if (!workflow) return '';

    get().pushHistory();
    const node = createDefaultNode(type, position);
    const updated = touchUpdatedAt({
      ...workflow,
      nodes: [...workflow.nodes, node],
    });
    set({ workflow: updated, isDirty: true });
    return node.id;
  },

  removeNode: (nodeId) => {
    const { workflow } = get();
    if (!workflow) return;

    get().pushHistory();
    const updated = touchUpdatedAt({
      ...workflow,
      nodes: workflow.nodes.filter((n) => n.id !== nodeId),
      transitions: workflow.transitions.filter(
        (t) => t.sourceNodeId !== nodeId && t.targetNodeId !== nodeId,
      ),
      gates: workflow.gates.filter((g) => g.nodeId !== nodeId),
    });
    set({
      workflow: updated,
      isDirty: true,
      selectedNodeId:
        get().selectedNodeId === nodeId ? null : get().selectedNodeId,
    });
  },

  updateNode: (nodeId, updates) => {
    const { workflow } = get();
    if (!workflow) return;

    get().pushHistory();
    const updated = touchUpdatedAt({
      ...workflow,
      nodes: workflow.nodes.map((n) =>
        n.id === nodeId ? { ...n, ...updates, id: nodeId } : n,
      ),
    });
    set({ workflow: updated, isDirty: true });
  },

  updateNodeConfig: (nodeId, config) => {
    const { workflow } = get();
    if (!workflow) return;

    get().pushHistory();
    const updated = touchUpdatedAt({
      ...workflow,
      nodes: workflow.nodes.map((n) =>
        n.id === nodeId ? { ...n, config: { ...n.config, ...config } } : n,
      ),
    });
    set({ workflow: updated, isDirty: true });
  },

  moveNode: (nodeId, position) => {
    const { workflow } = get();
    if (!workflow) return;

    get().pushHistory();
    const updated = touchUpdatedAt({
      ...workflow,
      nodes: workflow.nodes.map((n) =>
        n.id === nodeId ? { ...n, position } : n,
      ),
    });
    set({ workflow: updated, isDirty: true });
  },

  // --- Edge actions ---

  addEdge: (sourceNodeId, targetNodeId, condition) => {
    const { workflow } = get();
    if (!workflow) return '';

    get().pushHistory();
    const edge: Transition = {
      id: uuidv4(),
      sourceNodeId,
      targetNodeId,
      condition: condition ?? { type: 'always' },
    };
    const updated = touchUpdatedAt({
      ...workflow,
      transitions: [...workflow.transitions, edge],
    });
    set({ workflow: updated, isDirty: true });
    return edge.id;
  },

  removeEdge: (edgeId) => {
    const { workflow } = get();
    if (!workflow) return;

    get().pushHistory();
    const updated = touchUpdatedAt({
      ...workflow,
      transitions: workflow.transitions.filter((t) => t.id !== edgeId),
    });
    set({
      workflow: updated,
      isDirty: true,
      selectedEdgeId:
        get().selectedEdgeId === edgeId ? null : get().selectedEdgeId,
    });
  },

  updateEdge: (edgeId, updates) => {
    const { workflow } = get();
    if (!workflow) return;

    get().pushHistory();
    const updated = touchUpdatedAt({
      ...workflow,
      transitions: workflow.transitions.map((t) =>
        t.id === edgeId ? { ...t, ...updates, id: edgeId } : t,
      ),
    });
    set({ workflow: updated, isDirty: true });
  },

  // --- Gate actions ---

  addGate: (nodeId) => {
    const { workflow } = get();
    if (!workflow) return '';

    get().pushHistory();
    const gate = createDefaultGate(nodeId);
    const updated = touchUpdatedAt({
      ...workflow,
      gates: [...workflow.gates, gate],
    });
    set({ workflow: updated, isDirty: true });
    return gate.id;
  },

  removeGate: (gateId) => {
    const { workflow } = get();
    if (!workflow) return;

    get().pushHistory();
    const updated = touchUpdatedAt({
      ...workflow,
      gates: workflow.gates.filter((g) => g.id !== gateId),
    });
    set({ workflow: updated, isDirty: true });
  },

  updateGate: (gateId, updates) => {
    const { workflow } = get();
    if (!workflow) return;

    get().pushHistory();
    const updated = touchUpdatedAt({
      ...workflow,
      gates: workflow.gates.map((g) =>
        g.id === gateId ? { ...g, ...updates, id: gateId } : g,
      ),
    });
    set({ workflow: updated, isDirty: true });
  },

  // --- Selection ---

  selectNode: (nodeId) =>
    set({ selectedNodeId: nodeId, selectedEdgeId: null }),

  selectEdge: (edgeId) =>
    set({ selectedEdgeId: edgeId, selectedNodeId: null }),

  clearSelection: () =>
    set({ selectedNodeId: null, selectedEdgeId: null }),
});
