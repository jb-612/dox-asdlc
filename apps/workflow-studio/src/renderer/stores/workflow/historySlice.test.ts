import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkflowStore } from '../workflowStore';
import type { WorkflowDefinition } from '../../../shared/types/workflow';

function makeWorkflow(name = 'Test'): WorkflowDefinition {
  return {
    id: 'wf-1',
    metadata: {
      name,
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
  };
}

describe('historySlice', () => {
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

  it('undo restores previous state', () => {
    useWorkflowStore.getState().setWorkflow(makeWorkflow('Original'));
    useWorkflowStore.getState().updateMetadata({ name: 'Changed' });

    expect(useWorkflowStore.getState().workflow!.metadata.name).toBe('Changed');

    useWorkflowStore.getState().undo();
    expect(useWorkflowStore.getState().workflow!.metadata.name).toBe('Original');
  });

  it('redo restores undone state', () => {
    useWorkflowStore.getState().setWorkflow(makeWorkflow('Original'));
    useWorkflowStore.getState().updateMetadata({ name: 'Changed' });
    useWorkflowStore.getState().undo();
    useWorkflowStore.getState().redo();

    expect(useWorkflowStore.getState().workflow!.metadata.name).toBe('Changed');
  });

  it('undo does nothing when stack is empty', () => {
    useWorkflowStore.getState().setWorkflow(makeWorkflow('Original'));
    useWorkflowStore.getState().undo();

    expect(useWorkflowStore.getState().workflow!.metadata.name).toBe('Original');
  });

  it('redo does nothing when stack is empty', () => {
    useWorkflowStore.getState().setWorkflow(makeWorkflow('Original'));
    useWorkflowStore.getState().redo();

    expect(useWorkflowStore.getState().workflow!.metadata.name).toBe('Original');
  });

  it('new mutation after undo clears redo stack', () => {
    useWorkflowStore.getState().setWorkflow(makeWorkflow('A'));
    useWorkflowStore.getState().updateMetadata({ name: 'B' });
    useWorkflowStore.getState().undo();

    expect(useWorkflowStore.getState().redoStack).toHaveLength(1);

    useWorkflowStore.getState().updateMetadata({ name: 'C' });
    expect(useWorkflowStore.getState().redoStack).toHaveLength(0);
  });

  it('pushHistory is called by mutations', () => {
    useWorkflowStore.getState().setWorkflow(makeWorkflow());
    useWorkflowStore.getState().addNode('backend', { x: 0, y: 0 });

    expect(useWorkflowStore.getState().undoStack).toHaveLength(1);
  });
});
