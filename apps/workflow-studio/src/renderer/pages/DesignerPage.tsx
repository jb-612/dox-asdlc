import { useCallback, useMemo, useEffect, useState } from 'react';
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
import type { WorkflowSummary } from '../../preload/electron-api';

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
        type: node.type,
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
// Load workflow dialog
// ---------------------------------------------------------------------------

interface LoadDialogProps {
  workflows: WorkflowSummary[];
  onSelect: (id: string) => void;
  onClose: () => void;
}

function LoadDialog({ workflows, onSelect, onClose }: LoadDialogProps): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl w-96 max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 className="text-sm font-semibold text-white">Load Workflow</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {workflows.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">
              No workflows found in the configured directory.
            </p>
          )}
          {workflows.map((wf) => (
            <button
              key={wf.id}
              type="button"
              onClick={() => onSelect(wf.id)}
              className="w-full text-left px-3 py-2 rounded hover:bg-gray-700 transition-colors"
            >
              <p className="text-sm font-medium text-gray-100">{wf.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {wf.nodeCount} node{wf.nodeCount !== 1 ? 's' : ''} ·{' '}
                {new Date(wf.updatedAt).toLocaleDateString()}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
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
  const setWorkflow = useWorkflowStore((s) => s.setWorkflow);
  const markClean = useWorkflowStore((s) => s.markClean);

  // Save/load UI state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [loadWorkflows, setLoadWorkflows] = useState<WorkflowSummary[]>([]);

  // Ensure there is always a workflow loaded
  useEffect(() => {
    if (!workflow) {
      newWorkflow();
    }
  }, [workflow, newWorkflow]);

  // Clear "saved" indicator after 2 seconds
  useEffect(() => {
    if (saveStatus === 'saved') {
      const t = setTimeout(() => setSaveStatus('idle'), 2000);
      return () => clearTimeout(t);
    }
  }, [saveStatus]);

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
  // Toolbar callbacks
  // -----------------------------------------------------------------------

  const handleSave = useCallback(async () => {
    if (!workflow) return;
    setSaveStatus('saving');
    try {
      const result = await window.electronAPI.workflow.save(workflow);
      if (result.success) {
        markClean();
        setSaveStatus('saved');
      } else {
        console.error('Save failed:', result.error);
        setSaveStatus('error');
      }
    } catch (err) {
      console.error('Save error:', err);
      setSaveStatus('error');
    }
  }, [workflow, markClean]);

  const handleLoad = useCallback(async () => {
    try {
      const summaries = await window.electronAPI.workflow.list();
      setLoadWorkflows(summaries);
      setShowLoadDialog(true);
    } catch (err) {
      console.error('Failed to list workflows:', err);
    }
  }, []);

  const handleLoadSelect = useCallback(
    async (id: string) => {
      setShowLoadDialog(false);
      try {
        const loaded = await window.electronAPI.workflow.load(id);
        if (loaded) {
          setWorkflow(loaded);
        }
      } catch (err) {
        console.error('Failed to load workflow:', err);
      }
    },
    [setWorkflow],
  );

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

      {/* Save status indicator */}
      {saveStatus !== 'idle' && (
        <div
          className={`text-xs text-center py-0.5 ${
            saveStatus === 'saving'
              ? 'bg-blue-900 text-blue-200'
              : saveStatus === 'saved'
              ? 'bg-green-900 text-green-200'
              : 'bg-red-900 text-red-200'
          }`}
        >
          {saveStatus === 'saving' && 'Saving…'}
          {saveStatus === 'saved' && 'Saved'}
          {saveStatus === 'error' && 'Save failed'}
        </div>
      )}

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

      {/* Load dialog */}
      {showLoadDialog && (
        <LoadDialog
          workflows={loadWorkflows}
          onSelect={handleLoadSelect}
          onClose={() => setShowLoadDialog(false)}
        />
      )}
    </div>
  );
}
