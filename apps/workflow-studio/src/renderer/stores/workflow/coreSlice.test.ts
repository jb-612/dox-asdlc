import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkflowStore } from '../workflowStore';
import type { WorkflowDefinition } from '../../../shared/types/workflow';

function makeWorkflow(overrides?: Partial<WorkflowDefinition>): WorkflowDefinition {
  return {
    id: 'wf-1',
    metadata: {
      name: 'Test WF',
      description: '',
      version: '0.1.0',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      tags: [],
    },
    nodes: [],
    transitions: [],
    gates: [],
    variables: [],
    ...overrides,
  };
}

describe('coreSlice', () => {
  beforeEach(() => {
    useWorkflowStore.setState({
      workflow: null,
      isDirty: false,
      filePath: null,
      undoStack: [],
      redoStack: [],
      selectedNodeId: null,
      selectedEdgeId: null,
    });
  });

  it('setWorkflow stores a clone and clears undo/redo', () => {
    const wf = makeWorkflow();
    useWorkflowStore.getState().setWorkflow(wf);

    const state = useWorkflowStore.getState();
    expect(state.workflow).not.toBe(wf); // cloned
    expect(state.workflow?.id).toBe('wf-1');
    expect(state.undoStack).toHaveLength(0);
    expect(state.isDirty).toBe(false);
  });

  it('clearWorkflow resets everything', () => {
    useWorkflowStore.getState().setWorkflow(makeWorkflow());
    useWorkflowStore.getState().clearWorkflow();

    const state = useWorkflowStore.getState();
    expect(state.workflow).toBeNull();
    expect(state.filePath).toBeNull();
    expect(state.isDirty).toBe(false);
  });

  it('newWorkflow creates an empty workflow', () => {
    useWorkflowStore.getState().newWorkflow('My Flow');

    const state = useWorkflowStore.getState();
    expect(state.workflow).not.toBeNull();
    expect(state.workflow!.metadata.name).toBe('My Flow');
    expect(state.workflow!.nodes).toHaveLength(0);
    expect(state.isDirty).toBe(false);
  });

  it('updateMetadata pushes history and updates', () => {
    useWorkflowStore.getState().setWorkflow(makeWorkflow());
    useWorkflowStore.getState().updateMetadata({ name: 'Renamed' });

    const state = useWorkflowStore.getState();
    expect(state.workflow!.metadata.name).toBe('Renamed');
    expect(state.undoStack).toHaveLength(1);
    expect(state.isDirty).toBe(true);
  });

  it('setFilePath sets path without dirtying', () => {
    useWorkflowStore.getState().setFilePath('/tmp/test.json');
    expect(useWorkflowStore.getState().filePath).toBe('/tmp/test.json');
    expect(useWorkflowStore.getState().isDirty).toBe(false);
  });

  it('markClean clears dirty flag', () => {
    useWorkflowStore.getState().setWorkflow(makeWorkflow());
    useWorkflowStore.getState().updateMetadata({ name: 'X' });
    expect(useWorkflowStore.getState().isDirty).toBe(true);

    useWorkflowStore.getState().markClean();
    expect(useWorkflowStore.getState().isDirty).toBe(false);
  });
});
