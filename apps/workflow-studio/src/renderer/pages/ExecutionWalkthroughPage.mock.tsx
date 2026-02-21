/**
 * ExecutionWalkthroughPage -- MOCK/STUB VERSION (Phase 4)
 *
 * This is the original mock-first UI reference from Phase 4.
 * Kept for visual comparison with the integrated version.
 *
 * The live version is in ExecutionWalkthroughPage.tsx which uses
 * real executionStore + IPC events.
 */
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Node, Edge, NodeChange, EdgeChange, Connection } from 'reactflow';
import type { ExecutionStatus, NodeExecutionStatus, ExecutionEvent } from '../../shared/types/execution';
import type { AgentNodeType } from '../../shared/types/workflow';
import ReactFlowCanvas from '../components/designer/ReactFlowCanvas';

// ---------------------------------------------------------------------------
// Mock execution state -- will come from executionStore when implemented
// ---------------------------------------------------------------------------

interface MockExecutionState {
  id: string;
  workflowName: string;
  status: ExecutionStatus;
  currentNodeId: string;
  nodeStates: Record<string, { status: NodeExecutionStatus; startedAt?: string; completedAt?: string }>;
  events: ExecutionEvent[];
  elapsedSeconds: number;
}

function createMockExecution(): MockExecutionState {
  const now = new Date().toISOString();
  return {
    id: 'exec-001',
    workflowName: 'TDD Pipeline',
    status: 'running',
    currentNodeId: 'n2',
    nodeStates: {
      n1: { status: 'completed', startedAt: now, completedAt: now },
      n2: { status: 'running', startedAt: now },
      n3: { status: 'pending' },
    },
    events: [
      { id: 'ev1', type: 'execution_started', timestamp: now, message: 'Execution started' },
      { id: 'ev2', type: 'node_started', timestamp: now, nodeId: 'n1', message: 'Unit Test agent started' },
      { id: 'ev3', type: 'node_completed', timestamp: now, nodeId: 'n1', message: 'Unit Test agent completed (3 tests written)' },
      { id: 'ev4', type: 'node_started', timestamp: now, nodeId: 'n2', message: 'Coder agent started' },
      { id: 'ev5', type: 'cli_output', timestamp: now, nodeId: 'n2', message: 'Writing implementation for auth module...' },
    ],
    elapsedSeconds: 47,
  };
}

// Mock React Flow nodes/edges for the execution canvas
function createMockNodes(): Node[] {
  return [
    {
      id: 'n1',
      type: 'agent',
      position: { x: 50, y: 100 },
      data: {
        label: 'Unit Test',
        type: 'utest' as AgentNodeType,
        executionStatus: 'completed',
      },
    },
    {
      id: 'n2',
      type: 'agent',
      position: { x: 300, y: 100 },
      data: {
        label: 'Coder',
        type: 'coding' as AgentNodeType,
        executionStatus: 'running',
      },
    },
    {
      id: 'n3',
      type: 'agent',
      position: { x: 550, y: 100 },
      data: {
        label: 'Reviewer',
        type: 'reviewer' as AgentNodeType,
        executionStatus: 'pending',
      },
    },
  ];
}

function createMockEdges(): Edge[] {
  return [
    { id: 'e1', source: 'n1', target: 'n2', type: 'transition', animated: true },
    { id: 'e2', source: 'n2', target: 'n3', type: 'transition' },
  ];
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<ExecutionStatus, { color: string; label: string; bg: string }> = {
  pending: { color: 'text-gray-400', label: 'Pending', bg: 'bg-gray-600' },
  running: { color: 'text-blue-400', label: 'Running', bg: 'bg-blue-600' },
  paused: { color: 'text-yellow-400', label: 'Paused', bg: 'bg-yellow-600' },
  waiting_gate: { color: 'text-orange-400', label: 'Waiting for Gate', bg: 'bg-orange-600' },
  completed: { color: 'text-green-400', label: 'Completed', bg: 'bg-green-600' },
  failed: { color: 'text-red-400', label: 'Failed', bg: 'bg-red-600' },
  aborted: { color: 'text-gray-400', label: 'Aborted', bg: 'bg-gray-600' },
};

const NODE_STATUS_DOT: Record<NodeExecutionStatus, string> = {
  pending: 'bg-gray-600',
  running: 'bg-blue-500 animate-pulse',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  skipped: 'bg-gray-500',
  waiting_gate: 'bg-orange-500 animate-pulse',
};

// ---------------------------------------------------------------------------
// Detail panel tabs
// ---------------------------------------------------------------------------

type DetailTab = 'events' | 'nodes' | 'output';

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

/**
 * ExecutionWalkthroughPage (Mock) -- full-screen layout for active execution monitoring.
 *
 * Layout:
 *  - Left: ExecutionCanvas (70% width) -- read-only React Flow view
 *  - Right: Details panel with tabs (Events, Nodes, Output)
 *  - Top: Header with execution status, controls, and back button
 *
 * Uses mock execution state for UI development.
 */
export default function ExecutionWalkthroughPageMock(): JSX.Element {
  const navigate = useNavigate();
  const [execution] = useState<MockExecutionState>(createMockExecution);
  const [detailTab, setDetailTab] = useState<DetailTab>('events');

  // React Flow state (read-only canvas)
  const [nodes] = useState<Node[]>(createMockNodes);
  const [edges] = useState<Edge[]>(createMockEdges);

  // No-op handlers for read-only canvas
  const handleNodesChange = useCallback((_changes: NodeChange[]) => {}, []);
  const handleEdgesChange = useCallback((_changes: EdgeChange[]) => {}, []);
  const handleConnect = useCallback((_connection: Connection) => {}, []);

  const statusStyle = STATUS_STYLES[execution.status];

  const handleBack = useCallback(() => {
    navigate('/execute');
  }, [navigate]);

  const handlePause = useCallback(() => {
    // Will call IPC execution:pause
  }, []);

  const handleAbort = useCallback(() => {
    // Will call IPC execution:abort
  }, []);

  const formatElapsed = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="h-12 bg-gray-800 border-b border-gray-700 flex items-center px-4 gap-3 shrink-0">
        {/* Back button */}
        <button
          type="button"
          onClick={handleBack}
          className="text-gray-400 hover:text-gray-200 transition-colors"
          title="Back to execution launcher"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </button>

        {/* Execution info */}
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-sm font-semibold text-gray-100 truncate">
            {execution.workflowName}
          </h2>
          <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${statusStyle.bg} text-white`}>
            {statusStyle.label}
          </span>
          <span className="text-xs text-gray-500">
            {formatElapsed(execution.elapsedSeconds)}
          </span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Controls */}
        <div className="flex items-center gap-2">
          {execution.status === 'running' && (
            <button
              type="button"
              onClick={handlePause}
              className="px-3 py-1 text-xs font-medium rounded bg-yellow-600 hover:bg-yellow-500 text-white transition-colors"
            >
              Pause
            </button>
          )}
          {(execution.status === 'running' || execution.status === 'paused') && (
            <button
              type="button"
              onClick={handleAbort}
              className="px-3 py-1 text-xs font-medium rounded bg-red-600 hover:bg-red-500 text-white transition-colors"
            >
              Abort
            </button>
          )}
        </div>
      </div>

      {/* Main Content -- Split Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Canvas (70%) */}
        <div className="flex-[7] min-w-0">
          <ReactFlowCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={handleConnect}
            readOnly
          />
        </div>

        {/* Right: Details Panel (30%) */}
        <div className="w-[340px] min-w-[280px] bg-gray-800 border-l border-gray-700 flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-gray-700 shrink-0">
            {(['events', 'nodes', 'output'] as DetailTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setDetailTab(tab)}
                className={`
                  flex-1 px-3 py-2 text-xs font-medium capitalize transition-colors
                  ${
                    detailTab === tab
                      ? 'text-white border-b-2 border-blue-500'
                      : 'text-gray-400 hover:text-gray-200'
                  }
                `}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-3">
            {detailTab === 'events' && (
              <div className="space-y-1">
                {execution.events.map((event) => (
                  <div
                    key={event.id}
                    className="px-2 py-1.5 rounded text-xs hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] font-mono text-gray-600">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="text-[10px] px-1 rounded bg-gray-700 text-gray-400">
                        {event.type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-gray-300">{event.message}</p>
                  </div>
                ))}
              </div>
            )}

            {detailTab === 'nodes' && (
              <div className="space-y-2">
                {Object.entries(execution.nodeStates).map(([nodeId, state]) => {
                  const node = nodes.find((n) => n.id === nodeId);
                  return (
                    <div
                      key={nodeId}
                      className="flex items-center gap-2.5 px-2 py-2 rounded bg-gray-700/30"
                    >
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${NODE_STATUS_DOT[state.status]}`} />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium text-gray-200 block truncate">
                          {node?.data?.label ?? nodeId}
                        </span>
                        <span className="text-[10px] text-gray-500 capitalize">
                          {state.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {detailTab === 'output' && (
              <div className="font-mono text-xs text-gray-400 bg-gray-900 rounded p-3 min-h-[200px]">
                <p className="text-gray-600">$ Running coder agent...</p>
                <p className="text-green-400 mt-1">Writing implementation for auth module...</p>
                <p className="text-gray-500 mt-1">Files modified: src/auth/handler.ts</p>
                <p className="text-gray-600 mt-2 animate-pulse">_</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
