// ---------------------------------------------------------------------------
// ContainerPoolPanel (P15-F05, T15)
//
// Renders a table of Docker containers managed by the parallel execution
// engine. Subscribes to CONTAINER_POOL_STATUS IPC via the usePoolStatus hook.
//
// Columns:
//   - Container ID (truncated to 12 chars)
//   - State badge (color-coded)
//   - Block ID (or dash if unassigned)
//   - Port
//   - Elapsed time since creation
// ---------------------------------------------------------------------------

import type { ContainerState } from '../../../shared/types/execution';
import { usePoolStatus } from '../../hooks/usePoolStatus';

// ---------------------------------------------------------------------------
// State badge colors
// ---------------------------------------------------------------------------

const STATE_COLORS: Record<ContainerState, string> = {
  idle: 'bg-green-100 text-green-800',
  running: 'bg-blue-100 text-blue-800',
  dormant: 'bg-yellow-100 text-yellow-800',
  terminated: 'bg-red-100 text-red-800',
  starting: 'bg-gray-100 text-gray-800',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Truncate a container ID to 12 characters for display. */
function truncateId(id: string): string {
  return id.slice(0, 12);
}

/** Format elapsed milliseconds as a human-readable string. */
function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ContainerPoolPanel(): JSX.Element {
  const containers = usePoolStatus();

  if (containers.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500" data-testid="empty-pool">
        No containers in pool
      </div>
    );
  }

  const now = Date.now();

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm" role="table">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Container</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">State</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Block</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Port</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Elapsed</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {containers.map((record) => {
            const elapsed = now - record.createdAt;
            return (
              <tr key={record.id}>
                <td className="px-3 py-2 font-mono text-xs">{truncateId(record.id)}</td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STATE_COLORS[record.state]}`}
                  >
                    {record.state}
                  </span>
                </td>
                <td className="px-3 py-2">{record.blockId ?? '-'}</td>
                <td className="px-3 py-2 font-mono">{record.port}</td>
                <td className="px-3 py-2 text-gray-500">{formatElapsed(elapsed)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
