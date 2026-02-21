import { useCallback, useMemo, useEffect } from 'react';
import type {
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  Connection,
} from 'reactflow';
import type { AgentNodeType } from '../../shared/types/workflow';
import { NODE_TYPE_METADATA } from '../../shared/constants';
import { useWorkflowStore } from '../stores/workflowStore';
import AgentNodePalette from '../components/designer/AgentNodePalette';
import ReactFlowCanvas from '../components/designer/ReactFlowCanvas';
import { PropertiesPanel } from '../components/designer/PropertiesPanel';
import { Toolbar } from '../components/designer/Toolbar';

// ---------------------------------------------------------------------------
// Helpers -- map WorkflowDefinition to React Flow nodes/edges
// ---------------------------------------------------------------------------

function workflowNodesToReactFlow(store: ReturnType<typeof useWorkflowStore.getState>): Node[] {
  const workflow = store.workflow;
  if (!workflow) return [];

  return workflow.nodes.map((node) => {
    const meta = NODE_TYPE_METADATA[node.type];
    const hasGate = workflow.gates.some((g) => g.nodeId === node.id);
    return {
      id: node.id,
      type: 'agent',
      position: node.position,
      selected: store.selectedNodeId === node.id,
      data: {
        label: node.label,
        agentType: node.type,
        color: meta?.color ?? '#6B7280',
        bgColor: meta?.bgColor ?? '#6B728020',
        description: node.description,
        hasGate,
      },
    };
  });
}

function workflowEdgesToReactFlow(store: ReturnType<typeof useWorkflowStore.getState>): Edge[] {
  const workflow = store.workflow;
  if (!workflow) return [];

  return workflow.transitions.map((t) => ({
    id: t.id,
    source: t.sourceNodeId,
    target: t.targetNodeId,
    type: 'transition',
    selected: store.selectedEdgeId === t.id,
    label: t.label,
    data: {
      condition: t.condition,
    },
  }));
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

/**
 * DesignerPage -- the main workflow designer layout.
 *
 * Layout:
 *  - Left: AgentNodePalette (~200px) for dragging nodes
 *  - Center: ReactFlowCanvas (flex-1) for building the graph
 *  - Right: PropertiesPanel (~300px) for editing selected element
 *  - Top: Toolbar for file ops, undo/redo, validation, zoom
 *
 * Reads/writes to workflowStore. Handles drag-and-drop from palette to canvas.
 */
export default function DesignerPage(): JSX.Element {
  // Store selectors
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
  const newWorkflow = useWorkflowStore((s) => s.newWorkflow);
  const addGate = useWorkflowStore((s) => s.addGate);

  // Ensure there is always a workflow loaded
  useEffect(() => {
    if (!workflow) {
      newWorkflow();
    }
  }, [workflow, newWorkflow]);

  // Build React Flow nodes/edges from store
  const rfNodes = useMemo((): Node[] => {
    const state = useWorkflowStore.getState();
    return workflowNodesToReactFlow(state);
    // Re-derive when workflow or selection changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow, selectedNodeId]);

  const rfEdges = useMemo((): Edge[] => {
    const state = useWorkflowStore.getState();
    return workflowEdgesToReactFlow(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow, selectedEdgeId]);

  // -----------------------------------------------------------------------
  // React Flow callbacks
  // -----------------------------------------------------------------------

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

  // Handle drop from palette
  const handleDrop = useCallback(
    (nodeKind: string, agentType: string, position: { x: number; y: number }) => {
      if (nodeKind === 'agent') {
        const nodeId = addNode(agentType as AgentNodeType, position);
        if (nodeId) {
          selectNode(nodeId);
        }
      } else if (nodeKind === 'gate') {
        // Gate nodes need an existing node -- for now, create a placeholder
        // reviewer node and attach a gate to it
        const nodeId = addNode('reviewer' as AgentNodeType, position);
        if (nodeId) {
          addGate(nodeId);
          selectNode(nodeId);
        }
      }
    },
    [addNode, addGate, selectNode],
  );

  // -----------------------------------------------------------------------
  // Toolbar callbacks (save/load are stubs for now)
  // -----------------------------------------------------------------------

  const handleSave = useCallback(() => {
    // Will use IPC workflow:save
  }, []);

  const handleLoad = useCallback(() => {
    // Will use IPC workflow:load
  }, []);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <Toolbar
        onSave={handleSave}
        onLoad={handleLoad}
      />

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Node Palette */}
        <AgentNodePalette />

        {/* Center: Canvas */}
        <div className="flex-1 min-w-0">
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

        {/* Right: Properties Panel */}
        <PropertiesPanel />
      </div>
    </div>
  );
}
