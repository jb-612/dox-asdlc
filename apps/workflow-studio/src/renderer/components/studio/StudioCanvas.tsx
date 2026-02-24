import { useCallback, useMemo, type DragEvent } from 'react';
import type {
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  Connection,
} from 'reactflow';
import type { AgentNodeType, BlockType } from '../../../shared/types/workflow';
import { BLOCK_TYPE_METADATA, NODE_TYPE_METADATA } from '../../../shared/constants';
import { useWorkflowStore } from '../../stores/workflowStore';
import ReactFlowCanvas from '../designer/ReactFlowCanvas';
import { ParallelLaneOverlay } from './ParallelLaneOverlay';

function workflowNodesToReactFlow(
  store: ReturnType<typeof useWorkflowStore.getState>,
): Node[] {
  const workflow = store.workflow;
  if (!workflow) return [];

  return workflow.nodes.map((node) => {
    const hasGate = workflow.gates.some((g) => g.nodeId === node.id);
    return {
      id: node.id,
      type: 'agent',
      position: node.position,
      selected: store.selectedNodeId === node.id,
      data: {
        label: node.label,
        type: node.type,
        description: node.description,
        hasGate,
      },
    };
  });
}

function workflowEdgesToReactFlow(
  store: ReturnType<typeof useWorkflowStore.getState>,
): Edge[] {
  const workflow = store.workflow;
  if (!workflow) return [];

  return workflow.transitions.map((t) => ({
    id: t.id,
    source: t.sourceNodeId,
    target: t.targetNodeId,
    type: 'transition',
    selected: store.selectedEdgeId === t.id,
    label: t.label,
    data: { condition: t.condition },
  }));
}

export function StudioCanvas(): JSX.Element {
  const workflow = useWorkflowStore((s) => s.workflow);
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const selectedEdgeId = useWorkflowStore((s) => s.selectedEdgeId);
  const addNode = useWorkflowStore((s) => s.addNode);
  const addEdge = useWorkflowStore((s) => s.addEdge);
  const moveNode = useWorkflowStore((s) => s.moveNode);
  const removeNode = useWorkflowStore((s) => s.removeNode);
  const removeEdge = useWorkflowStore((s) => s.removeEdge);
  const selectNode = useWorkflowStore((s) => s.selectNode);
  const selectEdge = useWorkflowStore((s) => s.selectEdge);
  const setNodeSystemPromptPrefix = useWorkflowStore((s) => s.setNodeSystemPromptPrefix);
  const setNodeOutputChecklist = useWorkflowStore((s) => s.setNodeOutputChecklist);
  const setNodeBackend = useWorkflowStore((s) => s.setNodeBackend);

  const rfNodes = useMemo((): Node[] => {
    const state = useWorkflowStore.getState();
    return workflowNodesToReactFlow(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow, selectedNodeId]);

  const rfEdges = useMemo((): Edge[] => {
    const state = useWorkflowStore.getState();
    return workflowEdgesToReactFlow(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow, selectedEdgeId]);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const change of changes) {
        if (change.type === 'position' && change.position && change.id) {
          moveNode(change.id, change.position);
        }
        if (change.type === 'remove' && change.id) {
          removeNode(change.id);
        }
      }
    },
    [moveNode, removeNode],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      for (const change of changes) {
        if (change.type === 'remove' && change.id) {
          removeEdge(change.id);
        }
      }
    },
    [removeEdge],
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        addEdge(connection.source, connection.target);
      }
    },
    [addEdge],
  );

  const handleNodeSelect = useCallback(
    (node: Node | null) => {
      selectNode(node?.id ?? null);
    },
    [selectNode],
  );

  const handleEdgeSelect = useCallback(
    (edge: Edge | null) => {
      selectEdge(edge?.id ?? null);
    },
    [selectEdge],
  );

  const handleDrop = useCallback(
    (nodeKind: string, agentType: string, position: { x: number; y: number }) => {
      if (nodeKind !== 'agent') return;

      const nodeId = addNode(agentType as AgentNodeType, position);
      if (!nodeId) return;

      selectNode(nodeId);

      // Apply BLOCK_TYPE_METADATA defaults if this is a studio block drop
      const blockEntry = Object.entries(BLOCK_TYPE_METADATA).find(
        ([, meta]) => meta.agentNodeType === agentType,
      );
      if (blockEntry) {
        const [, meta] = blockEntry;
        if (meta.defaultSystemPromptPrefix) {
          setNodeSystemPromptPrefix(nodeId, meta.defaultSystemPromptPrefix);
        }
        if (meta.defaultOutputChecklist.length > 0) {
          setNodeOutputChecklist(nodeId, meta.defaultOutputChecklist);
        }
        // Default backend
        setNodeBackend(nodeId, 'claude');
      }
    },
    [addNode, selectNode, setNodeSystemPromptPrefix, setNodeOutputChecklist, setNodeBackend],
  );

  return (
    <div
      data-testid="studio-canvas"
      style={{ flex: 1, position: 'relative', minWidth: 0 }}
    >
      <ParallelLaneOverlay />
      <ReactFlowCanvas
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onNodeSelect={handleNodeSelect}
        onEdgeSelect={handleEdgeSelect}
        onDrop={handleDrop}
      />
    </div>
  );
}
