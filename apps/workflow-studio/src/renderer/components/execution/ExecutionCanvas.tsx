import { useMemo, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';

import type { Execution, NodeExecutionStatus } from '../../../shared/types/execution';
import type { AgentNode, Transition } from '../../../shared/types/workflow';
import { NODE_TYPE_METADATA } from '../../../shared/constants';
import type { AgentNodeData } from '../designer/AgentNodeComponent';
import type { GateNodeData } from '../designer/GateNodeComponent';
import type { TransitionEdgeData } from '../designer/TransitionEdge';
import ExecutionAgentNode from './ExecutionAgentNode';
import ExecutionGateNode from './ExecutionGateNode';
import ExecutionTransitionEdge from './ExecutionTransitionEdge';

// ---------------------------------------------------------------------------
// Custom node / edge registries for execution mode
// ---------------------------------------------------------------------------

const nodeTypes: NodeTypes = {
  agent: ExecutionAgentNode,
  gate: ExecutionGateNode,
};

const edgeTypes: EdgeTypes = {
  transition: ExecutionTransitionEdge,
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ExecutionCanvasProps {
  execution: Execution;
  onNodeSelect?: (nodeId: string | null) => void;
}

// ---------------------------------------------------------------------------
// Helpers -- convert domain model into React Flow nodes & edges
// ---------------------------------------------------------------------------

/**
 * Border CSS class based on node execution status.
 */
function borderClassForStatus(status: NodeExecutionStatus): string {
  switch (status) {
    case 'running':
      return 'execution-node-running';
    case 'completed':
      return 'execution-node-completed';
    case 'failed':
      return 'execution-node-failed';
    case 'waiting_gate':
      return 'execution-node-waiting';
    case 'skipped':
      return 'execution-node-skipped';
    case 'pending':
    default:
      return 'execution-node-pending';
  }
}

function buildNodes(execution: Execution): Node[] {
  const { workflow, nodeStates } = execution;

  const agentNodes: Node<AgentNodeData & { executionStatus: NodeExecutionStatus; statusClass: string }>[] =
    workflow.nodes.map((agentNode: AgentNode) => {
      const nodeState = nodeStates[agentNode.id];
      const status: NodeExecutionStatus = nodeState?.status ?? 'pending';
      return {
        id: agentNode.id,
        type: 'agent',
        position: agentNode.position,
        draggable: false,
        connectable: false,
        data: {
          type: agentNode.type,
          label: agentNode.label,
          config: agentNode.config,
          description: agentNode.description,
          executionStatus: status,
          statusClass: borderClassForStatus(status),
        },
      };
    });

  const gateNodes: Node<GateNodeData & { executionStatus: NodeExecutionStatus; statusClass: string }>[] =
    workflow.gates.map((gate) => {
      const parentNode = workflow.nodes.find((n) => n.id === gate.nodeId);
      const nodeState = nodeStates[gate.nodeId];
      const status: NodeExecutionStatus = nodeState?.status ?? 'pending';
      return {
        id: gate.id,
        type: 'gate',
        position: parentNode
          ? { x: parentNode.position.x + 200, y: parentNode.position.y }
          : { x: 0, y: 0 },
        draggable: false,
        connectable: false,
        data: {
          gateType: gate.gateType,
          prompt: gate.prompt,
          options: gate.options,
          required: gate.required,
          executionStatus: status,
          statusClass: borderClassForStatus(status),
        },
      };
    });

  return [...agentNodes, ...gateNodes];
}

function buildEdges(execution: Execution): Edge<TransitionEdgeData & { isActive: boolean }>[] {
  const { workflow, currentNodeId, nodeStates } = execution;

  return workflow.transitions.map((t: Transition) => {
    const sourceState = nodeStates[t.sourceNodeId]?.status;
    const targetState = nodeStates[t.targetNodeId]?.status;

    // An edge is "active" when the source just completed and the target is the current node
    const isActive =
      sourceState === 'completed' && t.targetNodeId === currentNodeId;

    // An edge is "completed" when both source and target completed
    const isCompleted =
      sourceState === 'completed' &&
      (targetState === 'completed' || targetState === 'running');

    return {
      id: t.id,
      source: t.sourceNodeId,
      target: t.targetNodeId,
      type: 'transition',
      animated: isActive,
      style: {
        stroke: isActive ? '#3B82F6' : isCompleted ? '#10B981' : '#4B5563',
        strokeWidth: isActive ? 2.5 : 1.5,
        opacity: isCompleted || isActive ? 1 : 0.4,
      },
      data: {
        condition: t.condition,
        label: t.label,
        isActive,
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Inner canvas (must be inside ReactFlowProvider)
// ---------------------------------------------------------------------------

function CanvasInner({ execution, onNodeSelect }: ExecutionCanvasProps): JSX.Element {
  const nodes = useMemo(() => buildNodes(execution), [execution]);
  const edges = useMemo(() => buildEdges(execution), [execution]);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onNodeSelect?.(node.id);
    },
    [onNodeSelect],
  );

  const handlePaneClick = useCallback(() => {
    onNodeSelect?.(null);
  }, [onNodeSelect]);

  const miniMapNodeColor = useCallback((node: Node): string => {
    const status = node.data?.executionStatus as NodeExecutionStatus | undefined;
    switch (status) {
      case 'running':
        return '#3B82F6';
      case 'completed':
        return '#10B981';
      case 'failed':
        return '#EF4444';
      case 'waiting_gate':
        return '#F59E0B';
      default:
        return '#4B5563';
    }
  }, []);

  return (
    <div className="w-full h-full bg-gray-900 relative">
      {/* Inject keyframe animation for the pulsing running border */}
      <style>{`
        .execution-node-running {
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.7);
          animation: execution-pulse 2s ease-in-out infinite;
        }
        @keyframes execution-pulse {
          0%, 100% { box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.7); }
          50% { box-shadow: 0 0 0 6px rgba(59, 130, 246, 0.2); }
        }
        .execution-node-completed {
          box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.7);
        }
        .execution-node-failed {
          box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.7);
        }
        .execution-node-waiting {
          box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.7);
          animation: execution-pulse-amber 2s ease-in-out infinite;
        }
        @keyframes execution-pulse-amber {
          0%, 100% { box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.7); }
          50% { box-shadow: 0 0 0 6px rgba(245, 158, 11, 0.2); }
        }
        .execution-node-pending {
          opacity: 0.5;
        }
        .execution-node-skipped {
          opacity: 0.35;
        }
      `}</style>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        className="bg-gray-900"
      >
        <Background color="#374151" gap={20} size={1} />
        <Controls
          className="!bg-gray-800 !border-gray-600 !rounded-lg !shadow-lg [&>button]:!bg-gray-800 [&>button]:!border-gray-600 [&>button]:!text-gray-300 [&>button:hover]:!bg-gray-700"
          showInteractive={false}
        />
        <MiniMap
          nodeColor={miniMapNodeColor}
          maskColor="rgba(17, 24, 39, 0.7)"
          className="!bg-gray-800 !border !border-gray-600 !rounded-lg"
          pannable
          zoomable
        />
      </ReactFlow>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

/**
 * ExecutionCanvas renders the workflow graph in read-only mode with execution
 * status overlays on each node. Nodes cannot be dragged or connected. Active
 * transitions are animated and color-coded by status.
 */
export default function ExecutionCanvas(props: ExecutionCanvasProps): JSX.Element {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
