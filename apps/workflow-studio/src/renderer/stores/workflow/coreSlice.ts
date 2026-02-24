import type { StateCreator } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type {
  WorkflowDefinition,
  WorkflowMetadata,
} from '../../../shared/types/workflow';

/** Deep-clone a workflow definition so undo/redo snapshots are independent. */
function cloneWorkflow(wf: WorkflowDefinition): WorkflowDefinition {
  return JSON.parse(JSON.stringify(wf));
}

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

export interface WorkflowCoreSlice {
  workflow: WorkflowDefinition | null;
  isDirty: boolean;
  filePath: string | null;

  setWorkflow: (workflow: WorkflowDefinition) => void;
  clearWorkflow: () => void;
  newWorkflow: (name?: string) => void;
  updateMetadata: (updates: Partial<WorkflowMetadata>) => void;
  setFilePath: (path: string | null) => void;
  markClean: () => void;
}

export const createCoreSlice: StateCreator<
  WorkflowCoreSlice & { undoStack: WorkflowDefinition[]; redoStack: WorkflowDefinition[]; selectedNodeId: string | null; selectedEdgeId: string | null; pushHistory: () => void },
  [],
  [],
  WorkflowCoreSlice
> = (set, get) => ({
  workflow: null,
  isDirty: false,
  filePath: null,

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

  updateMetadata: (updates) => {
    const { workflow } = get();
    if (!workflow) return;

    get().pushHistory();
    const updated: WorkflowDefinition = {
      ...workflow,
      metadata: {
        ...workflow.metadata,
        ...updates,
        updatedAt: new Date().toISOString(),
      },
    };
    set({ workflow: updated, isDirty: true });
  },

  setFilePath: (path) => set({ filePath: path }),

  markClean: () => set({ isDirty: false }),
});
