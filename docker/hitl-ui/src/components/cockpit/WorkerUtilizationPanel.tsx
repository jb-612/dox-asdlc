/**
 * WorkerUtilizationPanel - Displays worker status and utilization
 *
 * Shows list of workers with their current status, task, model,
 * and utilization metrics.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  CpuChipIcon,
  PlayIcon,
  PauseIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

/** Worker status type */
export type WorkerStatus = 'running' | 'idle' | 'error';

/** Worker definition */
export interface Worker {
  /** Unique identifier */
  id: string;
  /** Worker name */
  name: string;
  /** Current status */
  status: WorkerStatus;
  /** Current task name */
  currentTask?: string;
  /** Current task ID */
  taskId?: string;
  /** Model being used */
  model: string;
  /** Utilization percentage (0-100) */
  utilization: number;
  /** Task start time */
  startedAt?: string;
  /** Error message if status is error */
  error?: string;
}

export interface WorkerUtilizationPanelProps {
  /** Workers to display */
  workers: Worker[];
  /** Loading state */
  isLoading?: boolean;
  /** Custom class name */
  className?: string;
  /** Callback when worker is clicked */
  onWorkerClick?: (workerId: string) => void;
  /** Callback when task is clicked */
  onTaskClick?: (taskId: string) => void;
}

// Status filter options
type StatusFilter = 'all' | WorkerStatus;

// Status color mappings
const statusColors: Record<WorkerStatus, string> = {
  running: 'bg-status-success',
  idle: 'bg-text-muted',
  error: 'bg-status-error',
};

const statusLabels: Record<WorkerStatus, string> = {
  running: 'Running',
  idle: 'Idle',
  error: 'Error',
};

export default function WorkerUtilizationPanel({
  workers,
  isLoading = false,
  className,
  onWorkerClick,
  onTaskClick,
}: WorkerUtilizationPanelProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Filter workers by status
  const filteredWorkers = useMemo(() => {
    if (statusFilter === 'all') return workers;
    return workers.filter((w) => w.status === statusFilter);
  }, [workers, statusFilter]);

  // Calculate status counts
  const statusCounts = useMemo(() => ({
    all: workers.length,
    running: workers.filter((w) => w.status === 'running').length,
    idle: workers.filter((w) => w.status === 'idle').length,
    error: workers.filter((w) => w.status === 'error').length,
  }), [workers]);

  // Calculate overall utilization
  const overallUtilization = useMemo(() => {
    if (workers.length === 0) return 0;
    const total = workers.reduce((sum, w) => sum + w.utilization, 0);
    return Math.round(total / workers.length);
  }, [workers]);

  // Handle worker click
  const handleWorkerClick = useCallback(
    (workerId: string) => {
      onWorkerClick?.(workerId);
    },
    [onWorkerClick]
  );

  // Handle task click
  const handleTaskClick = useCallback(
    (e: React.MouseEvent, taskId: string) => {
      e.stopPropagation();
      onTaskClick?.(taskId);
    },
    [onTaskClick]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className={clsx('rounded-lg border border-border-primary bg-bg-secondary p-4', className)} data-testid="worker-panel-loading">
        <div className="flex items-center justify-between mb-4">
          <div className="h-6 w-40 bg-bg-tertiary rounded animate-pulse" />
          <div className="h-6 w-20 bg-bg-tertiary rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 bg-bg-tertiary rounded animate-pulse"
              data-testid="worker-skeleton"
            />
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (workers.length === 0) {
    return (
      <div className={clsx('rounded-lg border border-border-primary bg-bg-secondary p-4', className)} data-testid="worker-panel">
        <h3 className="text-lg font-semibold text-text-primary mb-4">Worker Utilization</h3>
        <p className="text-text-muted text-center py-8">No workers available</p>
      </div>
    );
  }

  return (
    <div
      className={clsx('rounded-lg border border-border-primary bg-bg-secondary p-4', className)}
      data-testid="worker-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <CpuChipIcon className="h-5 w-5" />
          Worker Utilization
        </h3>
        <div className="text-sm" data-testid="overall-utilization">
          Overall: <span className="font-semibold text-accent-teal">{overallUtilization}%</span>
        </div>
      </div>

      {/* Status filters */}
      <div className="flex gap-2 mb-4">
        {(['all', 'running', 'idle', 'error'] as StatusFilter[]).map((filter) => (
          <button
            key={filter}
            onClick={() => setStatusFilter(filter)}
            className={clsx(
              'px-3 py-1 rounded-full text-xs font-medium transition-colors',
              statusFilter === filter
                ? 'bg-accent-teal text-white'
                : 'bg-bg-tertiary text-text-secondary hover:bg-bg-tertiary/70'
            )}
            aria-pressed={statusFilter === filter}
            data-testid={`filter-${filter}`}
          >
            {filter === 'all' ? 'All' : statusLabels[filter]}
            <span className="ml-1 opacity-70">{statusCounts[filter]}</span>
          </button>
        ))}
      </div>

      {/* Workers list */}
      <div className="space-y-3">
        {filteredWorkers.map((worker) => (
          <div
            key={worker.id}
            className={clsx(
              'p-3 rounded-lg border border-border-primary bg-bg-primary',
              'hover:bg-bg-tertiary transition-colors',
              onWorkerClick && 'cursor-pointer'
            )}
            onClick={() => handleWorkerClick(worker.id)}
            aria-label={`${worker.name}: ${statusLabels[worker.status]}`}
            data-testid={`worker-${worker.id}`}
          >
            <div className="flex items-center justify-between">
              {/* Worker info */}
              <div className="flex items-center gap-3">
                {/* Status icon */}
                <div className="flex-shrink-0">
                  {worker.status === 'running' && (
                    <PlayIcon className="h-5 w-5 text-status-success" />
                  )}
                  {worker.status === 'idle' && (
                    <PauseIcon className="h-5 w-5 text-text-muted" />
                  )}
                  {worker.status === 'error' && (
                    <ExclamationTriangleIcon className="h-5 w-5 text-status-error" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text-primary">{worker.name}</span>
                    <span
                      className={clsx(
                        'px-1.5 py-0.5 rounded text-xs text-white',
                        statusColors[worker.status]
                      )}
                      data-testid="status-badge"
                    >
                      {statusLabels[worker.status]}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-text-muted mt-1">
                    <span>{worker.model}</span>
                    {worker.status === 'error' && worker.error ? (
                      <>
                        <span>•</span>
                        <span className="text-status-error">{worker.error}</span>
                      </>
                    ) : worker.currentTask ? (
                      <>
                        <span>•</span>
                        {worker.taskId && onTaskClick ? (
                          <button
                            className="text-accent-teal hover:underline"
                            onClick={(e) => handleTaskClick(e, worker.taskId!)}
                            data-testid="task-link"
                          >
                            {worker.currentTask}
                          </button>
                        ) : (
                          <span>{worker.currentTask}</span>
                        )}
                      </>
                    ) : (
                      <>
                        <span>•</span>
                        <span className="italic">No active task</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Utilization */}
              <div className="text-right">
                <div className="text-lg font-semibold text-text-primary">
                  {worker.utilization}%
                </div>
                <div className="w-24 h-2 bg-bg-tertiary rounded-full overflow-hidden mt-1" data-testid="utilization-bar">
                  <div
                    className={clsx(
                      'h-full transition-all duration-300',
                      worker.utilization >= 80 ? 'bg-status-success' :
                      worker.utilization >= 50 ? 'bg-status-warning' :
                      worker.utilization > 0 ? 'bg-accent-blue' :
                      'bg-bg-tertiary'
                    )}
                    style={{ width: `${worker.utilization}%` }}
                    data-testid="utilization-bar-fill"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
