import type { StateCreator } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type {
  WorkflowDefinition,
  ParallelGroup,
} from '../../../shared/types/workflow';

/**
 * Touch the updatedAt timestamp of a workflow.
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

export interface WorkflowStudioSlice {
  setNodeSystemPromptPrefix: (nodeId: string, prefix: string) => void;
  setNodeOutputChecklist: (nodeId: string, checklist: string[]) => void;
  setNodeBackend: (nodeId: string, backend: 'claude' | 'cursor' | 'codex') => void;

  addWorkflowRule: (rule: string) => void;
  removeWorkflowRule: (index: number) => void;

  addParallelGroup: (label: string) => string;
  removeParallelGroup: (groupId: string) => void;
  addNodeToParallelGroup: (groupId: string, nodeId: string) => void;
  removeNodeFromParallelGroup: (groupId: string, nodeId: string) => void;
  setParallelGroupLanes: (groupId: string, laneNodeIds: string[]) => void;
}

export const createStudioSlice: StateCreator<
  WorkflowStudioSlice & { workflow: WorkflowDefinition | null; isDirty: boolean; pushHistory: () => void },
  [],
  [],
  WorkflowStudioSlice
> = (set, get) => ({
  setNodeSystemPromptPrefix: (nodeId, prefix) => {
    const { workflow } = get();
    if (!workflow) return;

    get().pushHistory();
    const updated = touchUpdatedAt({
      ...workflow,
      nodes: workflow.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, config: { ...n.config, systemPromptPrefix: prefix } }
          : n,
      ),
    });
    set({ workflow: updated, isDirty: true });
  },

  setNodeOutputChecklist: (nodeId, checklist) => {
    const { workflow } = get();
    if (!workflow) return;

    get().pushHistory();
    const updated = touchUpdatedAt({
      ...workflow,
      nodes: workflow.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, config: { ...n.config, outputChecklist: checklist } }
          : n,
      ),
    });
    set({ workflow: updated, isDirty: true });
  },

  setNodeBackend: (nodeId, backend) => {
    const { workflow } = get();
    if (!workflow) return;

    get().pushHistory();
    const updated = touchUpdatedAt({
      ...workflow,
      nodes: workflow.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, config: { ...n.config, backend } }
          : n,
      ),
    });
    set({ workflow: updated, isDirty: true });
  },

  addWorkflowRule: (rule) => {
    const { workflow } = get();
    if (!workflow) return;

    get().pushHistory();
    const updated = touchUpdatedAt({
      ...workflow,
      rules: [...(workflow.rules ?? []), rule],
    });
    set({ workflow: updated, isDirty: true });
  },

  removeWorkflowRule: (index) => {
    const { workflow } = get();
    if (!workflow || !workflow.rules) return;

    get().pushHistory();
    const newRules = [...workflow.rules];
    newRules.splice(index, 1);
    const updated = touchUpdatedAt({
      ...workflow,
      rules: newRules,
    });
    set({ workflow: updated, isDirty: true });
  },

  addParallelGroup: (label) => {
    const { workflow } = get();
    if (!workflow) return '';

    get().pushHistory();
    const group: ParallelGroup = {
      id: uuidv4(),
      label,
      laneNodeIds: [],
    };
    const updated = touchUpdatedAt({
      ...workflow,
      parallelGroups: [...(workflow.parallelGroups ?? []), group],
    });
    set({ workflow: updated, isDirty: true });
    return group.id;
  },

  removeParallelGroup: (groupId) => {
    const { workflow } = get();
    if (!workflow) return;

    get().pushHistory();
    const updated = touchUpdatedAt({
      ...workflow,
      parallelGroups: (workflow.parallelGroups ?? []).filter(
        (g) => g.id !== groupId,
      ),
    });
    set({ workflow: updated, isDirty: true });
  },

  addNodeToParallelGroup: (groupId, nodeId) => {
    const { workflow } = get();
    if (!workflow) return;

    get().pushHistory();
    const updated = touchUpdatedAt({
      ...workflow,
      parallelGroups: (workflow.parallelGroups ?? []).map((g) =>
        g.id === groupId && !g.laneNodeIds.includes(nodeId)
          ? { ...g, laneNodeIds: [...g.laneNodeIds, nodeId] }
          : g,
      ),
    });
    set({ workflow: updated, isDirty: true });
  },

  removeNodeFromParallelGroup: (groupId, nodeId) => {
    const { workflow } = get();
    if (!workflow) return;

    get().pushHistory();
    const updated = touchUpdatedAt({
      ...workflow,
      parallelGroups: (workflow.parallelGroups ?? []).map((g) =>
        g.id === groupId
          ? { ...g, laneNodeIds: g.laneNodeIds.filter((id) => id !== nodeId) }
          : g,
      ),
    });
    set({ workflow: updated, isDirty: true });
  },

  setParallelGroupLanes: (groupId, laneNodeIds) => {
    const { workflow } = get();
    if (!workflow) return;

    get().pushHistory();
    const updated = touchUpdatedAt({
      ...workflow,
      parallelGroups: (workflow.parallelGroups ?? []).map((g) =>
        g.id === groupId ? { ...g, laneNodeIds } : g,
      ),
    });
    set({ workflow: updated, isDirty: true });
  },
});
