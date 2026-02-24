import type { StateCreator } from 'zustand';
import type { WorkflowDefinition } from '../../../shared/types/workflow';

const MAX_UNDO_DEPTH = 50;

/** Deep-clone a workflow definition so undo/redo snapshots are independent. */
function cloneWorkflow(wf: WorkflowDefinition): WorkflowDefinition {
  return JSON.parse(JSON.stringify(wf));
}

export interface WorkflowHistorySlice {
  undoStack: WorkflowDefinition[];
  redoStack: WorkflowDefinition[];

  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
}

export const createHistorySlice: StateCreator<
  WorkflowHistorySlice & { workflow: WorkflowDefinition | null; isDirty: boolean },
  [],
  [],
  WorkflowHistorySlice
> = (set, get) => ({
  undoStack: [],
  redoStack: [],

  pushHistory: () => {
    const { workflow, undoStack } = get();
    if (!workflow) return;
    set({
      undoStack: [...undoStack, cloneWorkflow(workflow)].slice(-MAX_UNDO_DEPTH),
      redoStack: [],
    });
  },

  undo: () => {
    const { undoStack, redoStack, workflow } = get();
    if (undoStack.length === 0 || !workflow) return;

    const previous = undoStack[undoStack.length - 1];
    set({
      workflow: previous,
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, cloneWorkflow(workflow)],
      isDirty: true,
    });
  },

  redo: () => {
    const { undoStack, redoStack, workflow } = get();
    if (redoStack.length === 0 || !workflow) return;

    const next = redoStack[redoStack.length - 1];
    set({
      workflow: next,
      undoStack: [...undoStack, cloneWorkflow(workflow)],
      redoStack: redoStack.slice(0, -1),
      isDirty: true,
    });
  },
});
