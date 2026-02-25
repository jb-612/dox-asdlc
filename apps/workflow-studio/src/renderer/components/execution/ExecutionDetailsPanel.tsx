import { useState, useMemo } from 'react';
import type {
  Execution,
  NodeExecutionState,
  BlockDeliverables,
} from '../../../shared/types/execution';
import type { AgentNode } from '../../../shared/types/workflow';
import { NODE_TYPE_METADATA } from '../../../shared/constants';
import ExecutionEventList from './ExecutionEventList';
import StepGatePanel from './StepGatePanel';

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

/**
 * Runtime check that `v` has the shape of a BlockDeliverables object.
 * Returns false for null, undefined, non-objects, and objects without `blockType`.
 */
function isBlockDeliverables(v: unknown): v is BlockDeliverables {
  return v != null && typeof v === 'object' && 'blockType' in v;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ExecutionDetailsPanelProps {
  execution: Execution;
  selectedNodeId: string | null;
  onGateContinue?: () => void;
  onGateRevise?: (feedback: string) => void;
}

// ---------------------------------------------------------------------------
// Tab identifiers
// ---------------------------------------------------------------------------

type TabId = 'current_node' | 'event_log' | 'variables' | 'gate_decision';

interface TabDef {
  id: TabId;
  label: string;
  /** If true, only visible when certain conditions are met */
  conditional?: boolean;
}

// ---------------------------------------------------------------------------
// Timestamp formatter
// ---------------------------------------------------------------------------

function formatTime(iso?: string): string {
  if (!iso) return '--';
  try {
    return new Date(iso).toLocaleTimeString('en-GB', { hour12: false });
  } catch {
    return '--';
  }
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'running':
      return 'bg-blue-600/20 text-blue-400';
    case 'completed':
      return 'bg-green-600/20 text-green-400';
    case 'failed':
      return 'bg-red-600/20 text-red-400';
    case 'waiting_gate':
      return 'bg-amber-600/20 text-amber-400';
    case 'skipped':
      return 'bg-gray-600/20 text-gray-400';
    case 'pending':
    default:
      return 'bg-gray-600/20 text-gray-500';
  }
}

// ---------------------------------------------------------------------------
// Current Node Tab content
// ---------------------------------------------------------------------------

function CurrentNodeTab({
  agentNode,
  nodeState,
}: {
  agentNode: AgentNode | undefined;
  nodeState: NodeExecutionState | undefined;
}): JSX.Element {
  if (!agentNode) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-xs">
        Select a node on the canvas to view details
      </div>
    );
  }

  const meta = NODE_TYPE_METADATA[agentNode.type];

  return (
    <div className="p-3 space-y-3 overflow-y-auto">
      {/* Node identity */}
      <div>
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
          Node
        </h4>
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded flex-shrink-0"
            style={{ backgroundColor: meta.color }}
          />
          <span className="text-sm font-medium text-gray-100">{agentNode.label}</span>
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: meta.bgColor, color: meta.color }}
          >
            {meta.label}
          </span>
        </div>
        {agentNode.description && (
          <p className="text-xs text-gray-400 mt-1">{agentNode.description}</p>
        )}
      </div>

      {/* Execution status */}
      {nodeState && (
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Status
          </h4>
          <span
            className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${statusBadgeClass(nodeState.status)}`}
          >
            {nodeState.status}
          </span>
        </div>
      )}

      {/* Timing */}
      {nodeState && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">
              Started
            </h4>
            <span className="text-xs text-gray-300 font-mono">
              {formatTime(nodeState.startedAt)}
            </span>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">
              Ended
            </h4>
            <span className="text-xs text-gray-300 font-mono">
              {formatTime(nodeState.completedAt)}
            </span>
          </div>
        </div>
      )}

      {/* Inputs */}
      {agentNode.inputs.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Inputs
          </h4>
          <div className="space-y-1">
            {agentNode.inputs.map((port) => (
              <div key={port.name} className="flex items-center gap-2 text-xs">
                <span className="text-gray-400 font-mono">{port.name}</span>
                <span className="text-gray-600">:</span>
                <span className="text-gray-500">{port.dataType}</span>
                {port.required && (
                  <span className="text-red-500 text-[10px]">*</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Outputs */}
      {agentNode.outputs.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Outputs
          </h4>
          <div className="space-y-1">
            {agentNode.outputs.map((port) => (
              <div key={port.name} className="flex items-center gap-2 text-xs">
                <span className="text-gray-400 font-mono">{port.name}</span>
                <span className="text-gray-600">:</span>
                <span className="text-gray-500">{port.dataType}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Output data (runtime) */}
      {nodeState?.output != null && (
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Output Data
          </h4>
          <pre className="text-[10px] text-gray-400 bg-gray-900/60 rounded p-2 overflow-x-auto max-h-[120px] border border-gray-700">
            {JSON.stringify(nodeState.output, null, 2)}
          </pre>
        </div>
      )}

      {/* Error */}
      {nodeState?.error && (
        <div>
          <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-1">
            Error
          </h4>
          <pre className="text-[10px] text-red-300 bg-red-900/20 rounded p-2 overflow-x-auto max-h-[80px] border border-red-700/40">
            {nodeState.error}
          </pre>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variables Tab content
// ---------------------------------------------------------------------------

function VariablesTab({ variables }: { variables: Record<string, unknown> }): JSX.Element {
  const entries = Object.entries(variables);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 text-xs">
        <svg className="w-8 h-8 mb-2 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
        <span>No variables set</span>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto p-3">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-700">
            <th className="text-left py-1.5 px-2 text-gray-400 font-semibold uppercase tracking-wider text-[10px]">
              Variable
            </th>
            <th className="text-left py-1.5 px-2 text-gray-400 font-semibold uppercase tracking-wider text-[10px]">
              Value
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, value]) => (
            <tr key={key} className="border-b border-gray-800 hover:bg-gray-800/50">
              <td className="py-1.5 px-2 text-gray-300 font-mono">{key}</td>
              <td className="py-1.5 px-2 text-gray-400 font-mono truncate max-w-[200px]">
                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

/**
 * Tab panel displayed on the right side during execution.
 *
 * Tabs:
 * - Current Node: node type, label, status, ports, start/end time
 * - Event Log: embeds ExecutionEventList
 * - Variables: runtime key-value pairs
 * - Gate Decision: visible only when status is 'waiting_gate', embeds StepGatePanel
 */
export default function ExecutionDetailsPanel({
  execution,
  selectedNodeId,
  onGateContinue,
  onGateRevise,
}: ExecutionDetailsPanelProps): JSX.Element {
  const isWaitingGate = execution.status === 'waiting_gate';

  const tabs: TabDef[] = useMemo(() => {
    const base: TabDef[] = [
      { id: 'current_node', label: 'Current Node' },
      { id: 'event_log', label: 'Event Log' },
      { id: 'variables', label: 'Variables' },
    ];
    if (isWaitingGate) {
      base.push({ id: 'gate_decision', label: 'Gate Decision', conditional: true });
    }
    return base;
  }, [isWaitingGate]);

  const [activeTab, setActiveTab] = useState<TabId>('current_node');

  // Find the selected agent node and its state
  const selectedAgentNode = useMemo(
    () => execution.workflow.nodes.find((n) => n.id === selectedNodeId),
    [execution.workflow.nodes, selectedNodeId],
  );

  const selectedNodeState = useMemo(
    () => (selectedNodeId ? execution.nodeStates[selectedNodeId] : undefined),
    [execution.nodeStates, selectedNodeId],
  );

  // Gate node state and label for StepGatePanel
  const gateNodeState = useMemo(
    () => execution.currentNodeId ? execution.nodeStates[execution.currentNodeId] : undefined,
    [execution.nodeStates, execution.currentNodeId],
  );

  const gateNodeLabel = useMemo(() => {
    if (!execution.currentNodeId) return '';
    const node = execution.workflow.nodes.find((n) => n.id === execution.currentNodeId);
    return node?.label ?? execution.currentNodeId;
  }, [execution.workflow.nodes, execution.currentNodeId]);

  // Fallback active tab if gate tab was selected but gate cleared
  const effectiveTab = activeTab === 'gate_decision' && !isWaitingGate
    ? 'current_node'
    : activeTab;

  return (
    <div className="flex flex-col h-full bg-gray-900 border-l border-gray-700">
      {/* Tab bar */}
      <div className="flex border-b border-gray-700 flex-shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex-1 px-2 py-2 text-[11px] font-medium transition-colors text-center
              border-b-2
              ${effectiveTab === tab.id
                ? 'border-blue-500 text-blue-400 bg-gray-800/50'
                : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-gray-800/30'
              }
              ${tab.id === 'gate_decision' ? 'text-amber-400' : ''}
            `}
          >
            {tab.label}
            {tab.id === 'gate_decision' && (
              <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {effectiveTab === 'current_node' && (
          <CurrentNodeTab
            agentNode={selectedAgentNode}
            nodeState={selectedNodeState}
          />
        )}

        {effectiveTab === 'event_log' && (
          <ExecutionEventList events={execution.events} />
        )}

        {effectiveTab === 'variables' && (
          <VariablesTab variables={execution.variables} />
        )}

        {effectiveTab === 'gate_decision' && gateNodeState && (
          <StepGatePanel
            node={gateNodeState}
            nodeLabel={gateNodeLabel}
            deliverables={isBlockDeliverables(gateNodeState.output) ? gateNodeState.output : null}
            onContinue={onGateContinue ?? (() => {})}
            onRevise={onGateRevise ?? (() => {})}
          />
        )}

        {effectiveTab === 'gate_decision' && !gateNodeState && (
          <div className="flex items-center justify-center h-full text-gray-500 text-xs">
            No gate decision pending
          </div>
        )}
      </div>
    </div>
  );
}
