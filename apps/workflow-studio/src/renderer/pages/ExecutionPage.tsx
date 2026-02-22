import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { WorkflowDefinition } from '../../shared/types/workflow';
import type { WorkItemReference } from '../../shared/types/workitem';
import { DEFAULT_SETTINGS } from '../../shared/types/settings';
import { NODE_TYPE_METADATA } from '../../shared/constants';
import WorkItemPickerDialog from '../components/workitems/WorkItemPickerDialog';
import { useExecutionStore } from '../stores/executionStore';

// ---------------------------------------------------------------------------
// Workflow Summary Card
// ---------------------------------------------------------------------------

interface WorkflowSummaryProps {
  workflow: WorkflowDefinition;
  selected: boolean;
  onClick: (wf: WorkflowDefinition) => void;
}

function WorkflowSummaryCard({ workflow, selected, onClick }: WorkflowSummaryProps): JSX.Element {
  const handleClick = useCallback(() => onClick(workflow), [onClick, workflow]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`
        w-full text-left p-4 rounded-lg border transition-colors
        ${
          selected
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-gray-700 hover:border-gray-500 hover:bg-gray-700/50'
        }
      `}
    >
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-gray-100">{workflow.metadata.name}</h3>
        <div className="flex items-center gap-2 text-[10px] text-gray-500">
          <span>{workflow.nodes.length} nodes</span>
          <span>{workflow.gates.length} gates</span>
        </div>
      </div>
      {workflow.metadata.description && (
        <p className="text-xs text-gray-400 line-clamp-1">{workflow.metadata.description}</p>
      )}
      {/* Mini node dots */}
      <div className="flex items-center gap-1 mt-2">
        {workflow.nodes.slice(0, 8).map((node) => {
          const meta = NODE_TYPE_METADATA[node.type];
          return (
            <div
              key={node.id}
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: meta?.color ?? '#6B7280' }}
              title={node.label}
            />
          );
        })}
        {workflow.nodes.length > 8 && (
          <span className="text-[10px] text-gray-500">+{workflow.nodes.length - 8}</span>
        )}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Variable Overrides Form
// ---------------------------------------------------------------------------

interface VariableOverridesFormProps {
  workflow: WorkflowDefinition;
  values: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
}

function VariableOverridesForm({ workflow, values, onChange }: VariableOverridesFormProps): JSX.Element | null {
  if (workflow.variables.length === 0) return null;

  return (
    <div className="mt-4">
      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        Variable Overrides
      </h4>
      <div className="space-y-2">
        {workflow.variables.map((v) => (
          <div key={v.name}>
            <label className="block text-xs text-gray-400 mb-0.5">
              {v.name}
              {v.required && <span className="text-red-400 ml-0.5">*</span>}
              {v.description && (
                <span className="text-gray-600 ml-1">-- {v.description}</span>
              )}
            </label>
            {v.type === 'boolean' ? (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(values[v.name] ?? v.defaultValue)}
                  onChange={(e) => onChange(v.name, e.target.checked)}
                  className="rounded bg-gray-900 border-gray-600 text-blue-500 focus:ring-blue-500/30"
                />
                <span className="text-xs text-gray-300">
                  {String(values[v.name] ?? v.defaultValue ?? false)}
                </span>
              </label>
            ) : (
              <input
                type={v.type === 'number' ? 'number' : 'text'}
                value={String(values[v.name] ?? v.defaultValue ?? '')}
                onChange={(e) =>
                  onChange(
                    v.name,
                    v.type === 'number' ? Number(e.target.value) : e.target.value,
                  )
                }
                className="w-full text-xs bg-gray-900 text-gray-200 placeholder-gray-500 border border-gray-600 rounded px-2.5 py-1.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

/**
 * ExecutionPage -- launch page for starting workflow executions.
 *
 * Features:
 *  - Workflow selector (card list of saved workflows)
 *  - Work item selector (opens WorkItemPickerDialog)
 *  - Selected workflow summary (name, node count, gate count)
 *  - Selected work item summary
 *  - Variable overrides form (if workflow defines variables)
 *  - "Start Execution" button (disabled if no workflow selected)
 *  - On start, navigates to /execute/run
 */
export default function ExecutionPage(): JSX.Element {
  const navigate = useNavigate();
  const startExecution = useExecutionStore((s) => s.startExecution);

  const [mockMode, setMockMode] = useState<boolean>(DEFAULT_SETTINGS.executionMockMode);

  // Load executionMockMode from persisted settings on mount
  useEffect(() => {
    window.electronAPI?.settings?.load().then((s) => {
      setMockMode(s.executionMockMode ?? DEFAULT_SETTINGS.executionMockMode);
    }).catch(() => {});
  }, []);

  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [workflowsLoading, setWorkflowsLoading] = useState(false);
  const [workflowsError, setWorkflowsError] = useState<string | null>(null);

  useEffect(() => {
    setWorkflowsLoading(true);
    window.electronAPI.workflow
      .list()
      .then((summaries) =>
        Promise.all(summaries.map((s) => window.electronAPI.workflow.load(s.id)))
      )
      .then((loaded) => setWorkflows(loaded.filter(Boolean) as WorkflowDefinition[]))
      .catch((err) => setWorkflowsError(err?.message ?? 'Failed to load workflows'))
      .finally(() => setWorkflowsLoading(false));
  }, []);

  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowDefinition | null>(null);
  const [selectedWorkItem, setSelectedWorkItem] = useState<WorkItemReference | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [variableOverrides, setVariableOverrides] = useState<Record<string, unknown>>({});

  const handleSelectWorkflow = useCallback((wf: WorkflowDefinition) => {
    setSelectedWorkflow(wf);
    // Reset variable overrides when workflow changes
    const defaults: Record<string, unknown> = {};
    for (const v of wf.variables) {
      if (v.defaultValue !== undefined) {
        defaults[v.name] = v.defaultValue;
      }
    }
    setVariableOverrides(defaults);
  }, []);

  const handleSelectWorkItem = useCallback((item: WorkItemReference) => {
    setSelectedWorkItem(item);
  }, []);

  const handleVariableChange = useCallback((name: string, value: unknown) => {
    setVariableOverrides((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleStart = useCallback(async () => {
    if (!selectedWorkflow) return;
    await startExecution(selectedWorkflow, selectedWorkItem ?? undefined, variableOverrides, mockMode);
    navigate('/execute/run');
  }, [selectedWorkflow, selectedWorkItem, variableOverrides, mockMode, startExecution, navigate]);

  const canStart = selectedWorkflow !== null;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-700 shrink-0">
        <h2 className="text-xl font-bold text-gray-100">Execute Workflow</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          Select a workflow and work item, then start execution.
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column: Workflow selection */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">
              1. Select Workflow
            </h3>
            <div className="space-y-2">
              {workflowsLoading && <p className="text-sm text-gray-400">Loading workflows…</p>}
              {workflowsError && <p className="text-sm text-red-500">{workflowsError}</p>}
              {workflows.map((wf) => (
                <WorkflowSummaryCard
                  key={wf.id}
                  workflow={wf}
                  selected={selectedWorkflow?.id === wf.id}
                  onClick={handleSelectWorkflow}
                />
              ))}
            </div>
          </div>

          {/* Right column: Work item + summary + variables */}
          <div className="space-y-6">
            {/* Work item selection */}
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-3">
                2. Select Work Item (optional)
              </h3>
              {selectedWorkItem ? (
                <div className="p-3 rounded-lg border border-gray-700 bg-gray-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-gray-100">
                        {selectedWorkItem.title}
                      </span>
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-400 uppercase">
                        {selectedWorkItem.type}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedWorkItem(null)}
                      className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                  {selectedWorkItem.description && (
                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                      {selectedWorkItem.description}
                    </p>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsPickerOpen(true)}
                  className="w-full p-4 rounded-lg border border-dashed border-gray-600 text-sm text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-colors"
                >
                  + Choose a work item...
                </button>
              )}
            </div>

            {/* Selected workflow summary */}
            {selectedWorkflow && (
              <div>
                <h3 className="text-sm font-semibold text-gray-300 mb-3">
                  3. Review Configuration
                </h3>
                <div className="p-4 rounded-lg border border-gray-700 bg-gray-800">
                  <h4 className="text-sm font-medium text-gray-100 mb-2">
                    {selectedWorkflow.metadata.name}
                  </h4>
                  <div className="flex items-center gap-4 text-xs text-gray-400 mb-2">
                    <span>{selectedWorkflow.nodes.length} nodes</span>
                    <span>{selectedWorkflow.gates.length} HITL gates</span>
                    <span>{selectedWorkflow.transitions.length} transitions</span>
                  </div>
                  {/* Node list */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {selectedWorkflow.nodes.map((node) => {
                      const meta = NODE_TYPE_METADATA[node.type];
                      return (
                        <span
                          key={node.id}
                          className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-gray-700"
                        >
                          <span
                            className="w-2 h-2 rounded-full inline-block"
                            style={{ backgroundColor: meta?.color ?? '#6B7280' }}
                          />
                          <span className="text-gray-300">{node.label}</span>
                        </span>
                      );
                    })}
                  </div>

                  {/* Variable overrides */}
                  <VariableOverridesForm
                    workflow={selectedWorkflow}
                    values={variableOverrides}
                    onChange={handleVariableChange}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-700 flex items-center justify-end shrink-0">
        <button
          type="button"
          onClick={handleStart}
          disabled={!canStart}
          className={`
            px-6 py-2.5 text-sm font-semibold rounded-lg transition-colors
            ${
              canStart
                ? 'bg-green-600 hover:bg-green-500 text-white'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }
          `}
        >
          Start Execution
        </button>
      </div>

      {/* Work Item Picker Dialog */}
      <WorkItemPickerDialog
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelect={handleSelectWorkItem}
      />
    </div>
  );
}
