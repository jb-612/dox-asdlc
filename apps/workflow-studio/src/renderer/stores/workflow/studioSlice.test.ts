import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkflowStore } from '../workflowStore';
import type { WorkflowDefinition } from '../../../shared/types/workflow';

function makeWorkflow(): WorkflowDefinition {
  return {
    id: 'wf-1',
    metadata: {
      name: 'Test',
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

describe('studioSlice', () => {
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
    useWorkflowStore.getState().setWorkflow(makeWorkflow());
  });

  it('setNodeSystemPromptPrefix updates node config', () => {
    const id = useWorkflowStore.getState().addNode('backend', { x: 0, y: 0 });
    useWorkflowStore.getState().setNodeSystemPromptPrefix(id, 'Be concise.');

    const node = useWorkflowStore.getState().workflow!.nodes[0];
    expect(node.config.systemPromptPrefix).toBe('Be concise.');
  });

  it('setNodeOutputChecklist sets checklist', () => {
    const id = useWorkflowStore.getState().addNode('coding', { x: 0, y: 0 });
    useWorkflowStore.getState().setNodeOutputChecklist(id, ['tests', 'docs']);

    const node = useWorkflowStore.getState().workflow!.nodes[0];
    expect(node.config.outputChecklist).toEqual(['tests', 'docs']);
  });

  it('setNodeBackend updates backend', () => {
    const id = useWorkflowStore.getState().addNode('coding', { x: 0, y: 0 });
    useWorkflowStore.getState().setNodeBackend(id, 'cursor');

    const node = useWorkflowStore.getState().workflow!.nodes[0];
    expect(node.config.backend).toBe('cursor');
  });

  it('addWorkflowRule and removeWorkflowRule manage rules', () => {
    useWorkflowStore.getState().addWorkflowRule('rule1');
    useWorkflowStore.getState().addWorkflowRule('rule2');

    expect(useWorkflowStore.getState().workflow!.rules).toEqual(['rule1', 'rule2']);

    useWorkflowStore.getState().removeWorkflowRule(0);
    expect(useWorkflowStore.getState().workflow!.rules).toEqual(['rule2']);
  });

  it('addParallelGroup creates a group', () => {
    const groupId = useWorkflowStore.getState().addParallelGroup('My Group');
    expect(groupId).toBeTruthy();

    const groups = useWorkflowStore.getState().workflow!.parallelGroups ?? [];
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('My Group');
    expect(groups[0].laneNodeIds).toEqual([]);
  });

  it('addNodeToParallelGroup adds a node', () => {
    const groupId = useWorkflowStore.getState().addParallelGroup('G');
    const nodeId = useWorkflowStore.getState().addNode('backend', { x: 0, y: 0 });

    useWorkflowStore.getState().addNodeToParallelGroup(groupId, nodeId);

    const group = useWorkflowStore.getState().workflow!.parallelGroups![0];
    expect(group.laneNodeIds).toContain(nodeId);
  });

  it('addNodeToParallelGroup prevents duplicates', () => {
    const groupId = useWorkflowStore.getState().addParallelGroup('G');
    const nodeId = useWorkflowStore.getState().addNode('backend', { x: 0, y: 0 });

    useWorkflowStore.getState().addNodeToParallelGroup(groupId, nodeId);
    useWorkflowStore.getState().addNodeToParallelGroup(groupId, nodeId);

    const group = useWorkflowStore.getState().workflow!.parallelGroups![0];
    expect(group.laneNodeIds).toHaveLength(1);
  });

  it('removeNodeFromParallelGroup removes node', () => {
    const groupId = useWorkflowStore.getState().addParallelGroup('G');
    const n1 = useWorkflowStore.getState().addNode('backend', { x: 0, y: 0 });
    const n2 = useWorkflowStore.getState().addNode('frontend', { x: 100, y: 0 });

    useWorkflowStore.getState().addNodeToParallelGroup(groupId, n1);
    useWorkflowStore.getState().addNodeToParallelGroup(groupId, n2);
    useWorkflowStore.getState().removeNodeFromParallelGroup(groupId, n1);

    const group = useWorkflowStore.getState().workflow!.parallelGroups![0];
    expect(group.laneNodeIds).toEqual([n2]);
  });

  it('setParallelGroupLanes replaces lane array', () => {
    const groupId = useWorkflowStore.getState().addParallelGroup('G');
    useWorkflowStore.getState().setParallelGroupLanes(groupId, ['a', 'b', 'c']);

    const group = useWorkflowStore.getState().workflow!.parallelGroups![0];
    expect(group.laneNodeIds).toEqual(['a', 'b', 'c']);
  });

  it('removeParallelGroup removes the group', () => {
    const g1 = useWorkflowStore.getState().addParallelGroup('G1');
    useWorkflowStore.getState().addParallelGroup('G2');
    useWorkflowStore.getState().removeParallelGroup(g1);

    const groups = useWorkflowStore.getState().workflow!.parallelGroups ?? [];
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('G2');
  });
});
