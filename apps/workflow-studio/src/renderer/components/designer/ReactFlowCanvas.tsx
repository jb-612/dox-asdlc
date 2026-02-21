import { useCallback, useMemo, type DragEvent } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type EdgeChange,
  type NodeTypes,
  type EdgeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';

import AgentNodeComponent from './AgentNodeComponent';
import GateNodeComponent from './GateNodeComponent';
import TransitionEdge from './TransitionEdge';

/**
 * Custom node type registry for React Flow.
 * Keys must match the `type` field on Node objects.
 */
const nodeTypes: NodeTypes = {
  agent: AgentNodeComponent,
  gate: GateNodeComponent,
};

/**
 * Custom edge type registry for React Flow.
 * Keys must match the `type` field on Edge objects.
 */
const edgeTypes: EdgeTypes = {
  transition: TransitionEdge,
};

export interface ReactFlowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  onNodeSelect?: (node: Node | null) => void;
  onEdgeSelect?: (edge: Edge | null) => void;
  onDrop?: (nodeKind: string, agentType: string, position: { x: number; y: number }) => void;
  readOnly?: boolean;
}

/**
 * Internal canvas component that uses the useReactFlow hook.
 * Must be rendered inside a ReactFlowProvider.
 */
function CanvasInner({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeSelect,
  onEdgeSelect,
  onDrop,
  readOnly = false,
}: ReactFlowCanvasProps): JSX.Element {
  const reactFlowInstance = useReactFlow();

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onNodeSelect?.(node);
    },
    [onNodeSelect],
  );

  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      onEdgeSelect?.(edge);
    },
    [onEdgeSelect],
  );

  const handlePaneClick = useCallback(() => {
    onNodeSelect?.(null);
    onEdgeSelect?.(null);
  }, [onNodeSelect, onEdgeSelect]);

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (readOnly || !onDrop) return;

      const raw = event.dataTransfer.getData('application/reactflow');
      if (!raw) return;

      let parsed: { nodeKind: string; agentType: string };
      try {
        parsed = JSON.parse(raw);
      } catch {
        return;
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      onDrop(parsed.nodeKind, parsed.agentType, position);
    },
    [readOnly, onDrop, reactFlowInstance],
  );

  /** MiniMap node color based on node type */
  const miniMapNodeColor = useCallback((node: Node): string => {
    if (node.type === 'gate') return '#F59E0B';
    return '#6B7280';
  }, []);

  const defaultEdgeOptions = useMemo(
    () => ({
      type: 'transition' as const,
      animated: false,
    }),
    [],
  );

  return (
    <div className="w-full h-full bg-gray-900">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={readOnly ? undefined : onNodesChange}
        onEdgesChange={readOnly ? undefined : onEdgesChange}
        onConnect={readOnly ? undefined : onConnect}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={true}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        className="bg-gray-900"
      >
        <Background color="#374151" gap={20} size={1} />
        <Controls
          className="!bg-gray-800 !border-gray-600 !rounded-lg !shadow-lg [&>button]:!bg-gray-800 [&>button]:!border-gray-600 [&>button]:!text-gray-300 [&>button:hover]:!bg-gray-700"
          showInteractive={!readOnly}
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

/**
 * ReactFlowCanvas wraps the React Flow canvas with a ReactFlowProvider.
 *
 * Provides:
 * - Custom agent and gate node types
 * - Custom transition edge type
 * - Dark theme with MiniMap, Controls, and Background grid
 * - Drag-and-drop from palette support via onDrop callback
 * - Read-only mode for execution monitoring
 */
export default function ReactFlowCanvas(props: ReactFlowCanvasProps): JSX.Element {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
