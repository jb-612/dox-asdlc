import type { ExecutionStatus } from '../../../shared/types/execution';
import type { WorkItemReference } from '../../../shared/types/workitem';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ExecutionHeaderProps {
  workflowName: string;
  executionId: string;
  status: ExecutionStatus;
  workItem?: WorkItemReference;
}

// ---------------------------------------------------------------------------
// Status pill config
// ---------------------------------------------------------------------------

const STATUS_PILL_STYLES: Record<ExecutionStatus, string> = {
  pending: 'bg-gray-600/30 text-gray-300 border-gray-500',
  running: 'bg-blue-600/20 text-blue-400 border-blue-500',
  paused: 'bg-yellow-600/20 text-yellow-400 border-yellow-500',
  waiting_gate: 'bg-amber-600/20 text-amber-400 border-amber-500',
  completed: 'bg-green-600/20 text-green-400 border-green-500',
  failed: 'bg-red-600/20 text-red-400 border-red-500',
  aborted: 'bg-gray-600/20 text-gray-400 border-gray-500',
};

const STATUS_LABELS: Record<ExecutionStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  paused: 'Paused',
  waiting_gate: 'Waiting for Gate',
  completed: 'Completed',
  failed: 'Failed',
  aborted: 'Aborted',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Displays the workflow name, work item badge, truncated execution ID,
 * and a colored status pill.
 */
export default function ExecutionHeader({
  workflowName,
  executionId,
  status,
  workItem,
}: ExecutionHeaderProps): JSX.Element {
  const truncatedId = executionId.length > 12
    ? `${executionId.slice(0, 8)}...`
    : executionId;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-850 border-b border-gray-700 min-h-[44px]">
      {/* Workflow name */}
      <h2 className="text-sm font-semibold text-gray-100 truncate max-w-[240px]">
        {workflowName}
      </h2>

      {/* Work item badge */}
      {workItem && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 truncate max-w-[200px]">
          <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm3 1h6v1H7V5zm6 4H7v1h6V9zm-6 4h4v1H7v-1z"
              clipRule="evenodd"
            />
          </svg>
          {workItem.title}
        </span>
      )}

      {/* Execution ID */}
      <span
        className="text-[10px] text-gray-500 font-mono"
        title={executionId}
      >
        {truncatedId}
      </span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Status pill */}
      <span
        className={`
          inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border
          ${STATUS_PILL_STYLES[status]}
        `}
      >
        {STATUS_LABELS[status]}
      </span>
    </div>
  );
}
