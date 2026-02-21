import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type {
  WorkflowDefinition,
  WorkflowMetadata,
  AgentNode,
  AgentNodeType,
  AgentNodeConfig,
  Transition,
  TransitionCondition,
  HITLGateDefinition,
} from '../../shared/types/workflow';
import { NODE_TYPE_METADATA } from '../../shared/constants';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface WorkflowState {
  // Current workflow
  workflow: WorkflowDefinition | null;

  // Selection
  selectedNodeId: string | null;
  selectedEdgeId: string | null;

  // Undo / redo
  undoStack: WorkflowDefinition[];
  redoStack: WorkflowDefinition[];

  // Dirty flag & file tracking
  isDirty: boolean;
  filePath: string | null;

  // --- Actions ---

  // Workflow lifecycle
  setWorkflow: (workflow: WorkflowDefinition) => void;
  clearWorkflow: () => void;
  newWorkflow: (name?: string) => void;

  // Node actions
  addNode: (type: AgentNodeType, position: { x: number; y: number }) => string;
  removeNode: (nodeId: string) => void;
  updateNode: (nodeId: string, updates: Partial<AgentNode>) => void;
  updateNodeConfig: (nodeId: string, config: Partial<AgentNodeConfig>) => void;
  moveNode: (nodeId: string, position: { x: number; y: number }) => void;

  // Edge actions
  addEdge: (
    sourceNodeId: string,
    targetNodeId: string,
    condition?: TransitionCondition,
  ) => string;
  removeEdge: (edgeId: string) => void;
  updateEdge: (edgeId: string, updates: Partial<Transition>) => void;

  // Gate actions
  addGate: (nodeId: string) => string;
  removeGate: (gateId: string) => void;
  updateGate: (gateId: string, updates: Partial<HITLGateDefinition>) => void;

  // Selection
  selectNode: (nodeId: string | null) => void;
  selectEdge: (edgeId: string | null) => void;
  clearSelection: () => void;

  // Undo / redo
  undo: () => void;
  redo: () => void;

  // Metadata & file path
  updateMetadata: (updates: Partial<WorkflowMetadata>) => void;
  setFilePath: (path: string | null) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createEmptyWorkflow(name = 'Untitled Workflow'): WorkflowDefinition {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    metadata: {
      name,
      description: '',
      version: '0.1.0',
      createdAt: now,
      updatedAt: now,
      tags: [],
    },
    nodes: [],
    transitions: [],
    gates: [],
    variables: [],
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

/** Deep-clone a workflow definition so undo/redo snapshots are independent. */
function cloneWorkflow(wf: WorkflowDefinition): WorkflowDefinition {
  return JSON.parse(JSON.stringify(wf));
}

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

// Maximum undo history depth to bound memory usage.
const MAX_UNDO_DEPTH = 50;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  // ---- Initial state ----
  workflow: null,
  selectedNodeId: null,
  selectedEdgeId: null,
  undoStack: [],
  redoStack: [],
  isDirty: false,
  filePath: null,

  // -----------------------------------------------------------------------
  // Workflow lifecycle
  // -----------------------------------------------------------------------

  setWorkflow: (workflow) =>
    set({
      workflow: cloneWorkflow(workflow),
      undoStack: [],
      redoStack: [],
      isDirty: false,
    }),

  clearWorkflow: () =>
    set({
      workflow: null,
      selectedNodeId: null,
      selectedEdgeId: null,
      undoStack: [],
      redoStack: [],
      isDirty: false,
      filePath: null,
    }),

  newWorkflow: (name) =>
    set({
      workflow: createEmptyWorkflow(name),
      selectedNodeId: null,
      selectedEdgeId: null,
      undoStack: [],
      redoStack: [],
      isDirty: false,
      filePath: null,
    }),

  // -----------------------------------------------------------------------
  // Node actions
  // -----------------------------------------------------------------------

  addNode: (type, position) => {
    const { workflow, undoStack } = get();
    if (!workflow) return '';

    const node = createDefaultNode(type, position);
    const snapshot = cloneWorkflow(workflow);
    const updated = touchUpdatedAt({
      ...workflow,
      nodes: [...workflow.nodes, node],
    });

    set({
      workflow: updated,
      undoStack: [...undoStack, snapshot].slice(-MAX_UNDO_DEPTH),
      redoStack: [],
      isDirty: true,
    });

    return node.id;
  },

  removeNode: (nodeId) => {
    const { workflow, undoStack } = get();
    if (!workflow) return;

    const snapshot = cloneWorkflow(workflow);
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
      undoStack: [...undoStack, snapshot].slice(-MAX_UNDO_DEPTH),
      redoStack: [],
      isDirty: true,
      selectedNodeId:
        get().selectedNodeId === nodeId ? null : get().selectedNodeId,
    });
  },

  updateNode: (nodeId, updates) => {
    const { workflow, undoStack } = get();
    if (!workflow) return;

    const snapshot = cloneWorkflow(workflow);
    const updated = touchUpdatedAt({
      ...workflow,
      nodes: workflow.nodes.map((n) =>
        n.id === nodeId ? { ...n, ...updates, id: nodeId } : n,
      ),
    });

    set({
      workflow: updated,
      undoStack: [...undoStack, snapshot].slice(-MAX_UNDO_DEPTH),
      redoStack: [],
      isDirty: true,
    });
  },

  updateNodeConfig: (nodeId, config) => {
    const { workflow, undoStack } = get();
    if (!workflow) return;

    const snapshot = cloneWorkflow(workflow);
    const updated = touchUpdatedAt({
      ...workflow,
      nodes: workflow.nodes.map((n) =>
        n.id === nodeId ? { ...n, config: { ...n.config, ...config } } : n,
      ),
    });

    set({
      workflow: updated,
      undoStack: [...undoStack, snapshot].slice(-MAX_UNDO_DEPTH),
      redoStack: [],
      isDirty: true,
    });
  },

  moveNode: (nodeId, position) => {
    const { workflow, undoStack } = get();
    if (!workflow) return;

    const snapshot = cloneWorkflow(workflow);
    const updated = touchUpdatedAt({
      ...workflow,
      nodes: workflow.nodes.map((n) =>
        n.id === nodeId ? { ...n, position } : n,
      ),
    });

    set({
      workflow: updated,
      undoStack: [...undoStack, snapshot].slice(-MAX_UNDO_DEPTH),
      redoStack: [],
      isDirty: true,
    });
  },

  // -----------------------------------------------------------------------
  // Edge actions
  // -----------------------------------------------------------------------

  addEdge: (sourceNodeId, targetNodeId, condition) => {
    const { workflow, undoStack } = get();
    if (!workflow) return '';

    const edge: Transition = {
      id: uuidv4(),
      sourceNodeId,
      targetNodeId,
      condition: condition ?? { type: 'always' },
    };

    const snapshot = cloneWorkflow(workflow);
    const updated = touchUpdatedAt({
      ...workflow,
      transitions: [...workflow.transitions, edge],
    });

    set({
      workflow: updated,
      undoStack: [...undoStack, snapshot].slice(-MAX_UNDO_DEPTH),
      redoStack: [],
      isDirty: true,
    });

    return edge.id;
  },

  removeEdge: (edgeId) => {
    const { workflow, undoStack } = get();
    if (!workflow) return;

    const snapshot = cloneWorkflow(workflow);
    const updated = touchUpdatedAt({
      ...workflow,
      transitions: workflow.transitions.filter((t) => t.id !== edgeId),
    });

    set({
      workflow: updated,
      undoStack: [...undoStack, snapshot].slice(-MAX_UNDO_DEPTH),
      redoStack: [],
      isDirty: true,
      selectedEdgeId:
        get().selectedEdgeId === edgeId ? null : get().selectedEdgeId,
    });
  },

  updateEdge: (edgeId, updates) => {
    const { workflow, undoStack } = get();
    if (!workflow) return;

    const snapshot = cloneWorkflow(workflow);
    const updated = touchUpdatedAt({
      ...workflow,
      transitions: workflow.transitions.map((t) =>
        t.id === edgeId ? { ...t, ...updates, id: edgeId } : t,
      ),
    });

    set({
      workflow: updated,
      undoStack: [...undoStack, snapshot].slice(-MAX_UNDO_DEPTH),
      redoStack: [],
      isDirty: true,
    });
  },

  // -----------------------------------------------------------------------
  // Gate actions
  // -----------------------------------------------------------------------

  addGate: (nodeId) => {
    const { workflow, undoStack } = get();
    if (!workflow) return '';

    const gate = createDefaultGate(nodeId);
    const snapshot = cloneWorkflow(workflow);
    const updated = touchUpdatedAt({
      ...workflow,
      gates: [...workflow.gates, gate],
    });

    set({
      workflow: updated,
      undoStack: [...undoStack, snapshot].slice(-MAX_UNDO_DEPTH),
      redoStack: [],
      isDirty: true,
    });

    return gate.id;
  },

  removeGate: (gateId) => {
    const { workflow, undoStack } = get();
    if (!workflow) return;

    const snapshot = cloneWorkflow(workflow);
    const updated = touchUpdatedAt({
      ...workflow,
      gates: workflow.gates.filter((g) => g.id !== gateId),
    });

    set({
      workflow: updated,
      undoStack: [...undoStack, snapshot].slice(-MAX_UNDO_DEPTH),
      redoStack: [],
      isDirty: true,
    });
  },

  updateGate: (gateId, updates) => {
    const { workflow, undoStack } = get();
    if (!workflow) return;

    const snapshot = cloneWorkflow(workflow);
    const updated = touchUpdatedAt({
      ...workflow,
      gates: workflow.gates.map((g) =>
        g.id === gateId ? { ...g, ...updates, id: gateId } : g,
      ),
    });

    set({
      workflow: updated,
      undoStack: [...undoStack, snapshot].slice(-MAX_UNDO_DEPTH),
      redoStack: [],
      isDirty: true,
    });
  },

  // -----------------------------------------------------------------------
  // Selection
  // -----------------------------------------------------------------------

  selectNode: (nodeId) =>
    set({ selectedNodeId: nodeId, selectedEdgeId: null }),

  selectEdge: (edgeId) =>
    set({ selectedEdgeId: edgeId, selectedNodeId: null }),

  clearSelection: () =>
    set({ selectedNodeId: null, selectedEdgeId: null }),

  // -----------------------------------------------------------------------
  // Undo / redo
  // -----------------------------------------------------------------------

  undo: () => {
    const { undoStack, redoStack, workflow } = get();
    if (undoStack.length === 0 || !workflow) return;

    const previous = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);

    set({
      workflow: previous,
      undoStack: newUndoStack,
      redoStack: [...redoStack, cloneWorkflow(workflow)],
      isDirty: true,
    });
  },

  redo: () => {
    const { undoStack, redoStack, workflow } = get();
    if (redoStack.length === 0 || !workflow) return;

    const next = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);

    set({
      workflow: next,
      undoStack: [...undoStack, cloneWorkflow(workflow)],
      redoStack: newRedoStack,
      isDirty: true,
    });
  },

  // -----------------------------------------------------------------------
  // Metadata & file path
  // -----------------------------------------------------------------------

  updateMetadata: (updates) => {
    const { workflow, undoStack } = get();
    if (!workflow) return;

    const snapshot = cloneWorkflow(workflow);
    const updated: WorkflowDefinition = {
      ...workflow,
      metadata: {
        ...workflow.metadata,
        ...updates,
        updatedAt: new Date().toISOString(),
      },
    };

    set({
      workflow: updated,
      undoStack: [...undoStack, snapshot].slice(-MAX_UNDO_DEPTH),
      redoStack: [],
      isDirty: true,
    });
  },

  setFilePath: (path) => set({ filePath: path }),
}));
