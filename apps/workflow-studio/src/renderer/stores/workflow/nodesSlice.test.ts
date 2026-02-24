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

describe('nodesSlice', () => {
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

  it('addNode creates a node and returns its id', () => {
    const id = useWorkflowStore.getState().addNode('backend', { x: 10, y: 20 });
    expect(id).toBeTruthy();
    const nodes = useWorkflowStore.getState().workflow!.nodes;
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe('backend');
    expect(nodes[0].position).toEqual({ x: 10, y: 20 });
  });

  it('removeNode removes node and its transitions/gates', () => {
    const nodeId = useWorkflowStore.getState().addNode('coding', { x: 0, y: 0 });
    const node2Id = useWorkflowStore.getState().addNode('reviewer', { x: 100, y: 0 });
    useWorkflowStore.getState().addEdge(nodeId, node2Id);
    useWorkflowStore.getState().addGate(nodeId);

    useWorkflowStore.getState().removeNode(nodeId);

    const state = useWorkflowStore.getState();
    expect(state.workflow!.nodes).toHaveLength(1);
    expect(state.workflow!.transitions).toHaveLength(0);
    expect(state.workflow!.gates).toHaveLength(0);
  });

  it('updateNode preserves node id', () => {
    const id = useWorkflowStore.getState().addNode('backend', { x: 0, y: 0 });
    useWorkflowStore.getState().updateNode(id, { label: 'Custom' });

    const node = useWorkflowStore.getState().workflow!.nodes[0];
    expect(node.id).toBe(id);
    expect(node.label).toBe('Custom');
  });

  it('updateNodeConfig merges config', () => {
    const id = useWorkflowStore.getState().addNode('backend', { x: 0, y: 0 });
    useWorkflowStore.getState().updateNodeConfig(id, { model: 'claude-3' });
    useWorkflowStore.getState().updateNodeConfig(id, { maxTurns: 5 });

    const config = useWorkflowStore.getState().workflow!.nodes[0].config;
    expect(config.model).toBe('claude-3');
    expect(config.maxTurns).toBe(5);
  });

  it('moveNode updates position', () => {
    const id = useWorkflowStore.getState().addNode('backend', { x: 0, y: 0 });
    useWorkflowStore.getState().moveNode(id, { x: 50, y: 75 });

    const node = useWorkflowStore.getState().workflow!.nodes[0];
    expect(node.position).toEqual({ x: 50, y: 75 });
  });

  it('addEdge creates a transition', () => {
    const n1 = useWorkflowStore.getState().addNode('backend', { x: 0, y: 0 });
    const n2 = useWorkflowStore.getState().addNode('reviewer', { x: 100, y: 0 });
    const edgeId = useWorkflowStore.getState().addEdge(n1, n2);

    expect(edgeId).toBeTruthy();
    const transitions = useWorkflowStore.getState().workflow!.transitions;
    expect(transitions).toHaveLength(1);
    expect(transitions[0].sourceNodeId).toBe(n1);
    expect(transitions[0].condition.type).toBe('always');
  });

  it('removeEdge clears selection if selected', () => {
    const n1 = useWorkflowStore.getState().addNode('backend', { x: 0, y: 0 });
    const n2 = useWorkflowStore.getState().addNode('reviewer', { x: 100, y: 0 });
    const edgeId = useWorkflowStore.getState().addEdge(n1, n2);
    useWorkflowStore.getState().selectEdge(edgeId);

    useWorkflowStore.getState().removeEdge(edgeId);
    expect(useWorkflowStore.getState().selectedEdgeId).toBeNull();
  });

  it('selectNode clears edge selection', () => {
    useWorkflowStore.setState({ selectedEdgeId: 'e1' });
    useWorkflowStore.getState().selectNode('n1');

    expect(useWorkflowStore.getState().selectedNodeId).toBe('n1');
    expect(useWorkflowStore.getState().selectedEdgeId).toBeNull();
  });

  it('clearSelection clears both', () => {
    useWorkflowStore.setState({ selectedNodeId: 'n1', selectedEdgeId: 'e1' });
    useWorkflowStore.getState().clearSelection();

    expect(useWorkflowStore.getState().selectedNodeId).toBeNull();
    expect(useWorkflowStore.getState().selectedEdgeId).toBeNull();
  });

  it('addNode returns empty string when no workflow', () => {
    useWorkflowStore.getState().clearWorkflow();
    const id = useWorkflowStore.getState().addNode('backend', { x: 0, y: 0 });
    expect(id).toBe('');
  });
});
