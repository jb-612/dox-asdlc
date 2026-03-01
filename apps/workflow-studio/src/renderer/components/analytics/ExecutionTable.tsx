import type { ExecutionCostSummary } from '../../../shared/types/analytics';

export interface ExecutionTableProps {
  executions: ExecutionCostSummary[];
  onSelect: (executionId: string) => void;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatCost(summary: ExecutionCostSummary): string {
  if (summary.totalCostUsd === 0 && summary.totalInputTokens === 0) {
    return 'N/A';
  }
  return `$${summary.totalCostUsd.toFixed(4)}`;
}

export default function ExecutionTable({
  executions,
  onSelect,
}: ExecutionTableProps): JSX.Element {
  if (executions.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500">
        No executions found
      </div>
    );
  }

  return (
    <div className="overflow-auto max-h-96">
      <table className="w-full text-sm text-left text-gray-300">
        <thead className="text-xs uppercase bg-gray-800 text-gray-400">
          <tr>
            <th className="px-3 py-2">Workflow</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Duration</th>
            <th className="px-3 py-2">Cost</th>
          </tr>
        </thead>
        <tbody>
          {executions.map((exec) => (
            <tr
              key={exec.executionId}
              className="border-b border-gray-700 hover:bg-gray-800 cursor-pointer"
              onClick={() => onSelect(exec.executionId)}
            >
              <td className="px-3 py-2">{exec.workflowName}</td>
              <td className="px-3 py-2">{exec.status}</td>
              <td className="px-3 py-2">{formatDuration(exec.durationMs)}</td>
              <td className="px-3 py-2">{formatCost(exec)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
