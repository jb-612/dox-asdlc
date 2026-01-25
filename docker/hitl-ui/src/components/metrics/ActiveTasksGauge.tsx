/**
 * ActiveTasksGauge - Display current active task count
 *
 * Features:
 * - Large number for current active tasks
 * - Shows context (max capacity, active workers)
 * - Progress bar visualization
 * - Loading state
 */

import clsx from 'clsx';
import type { ActiveTasksMetrics } from '../../api/types/metrics';

export interface ActiveTasksGaugeProps {
  /** Active tasks metrics data */
  data?: ActiveTasksMetrics;
  /** Loading state */
  isLoading?: boolean;
  /** Custom class name */
  className?: string;
}

export default function ActiveTasksGauge({
  data,
  isLoading = false,
  className,
}: ActiveTasksGaugeProps) {
  // Loading state
  if (isLoading && !data) {
    return (
      <div
        className={clsx(
          'bg-bg-secondary rounded-lg border border-border-primary p-6 animate-pulse',
          className
        )}
        data-testid="active-tasks-gauge-loading"
      >
        <div className="h-6 w-32 bg-bg-tertiary rounded mb-4" />
        <div className="h-12 w-24 bg-bg-tertiary rounded mb-4" />
        <div className="h-4 w-full bg-bg-tertiary rounded mb-2" />
        <div className="h-4 w-48 bg-bg-tertiary rounded" />
      </div>
    );
  }

  // Empty/error state
  if (!data) {
    return (
      <div
        className={clsx(
          'bg-bg-secondary rounded-lg border border-border-primary p-6 flex items-center justify-center text-text-muted',
          className
        )}
        data-testid="active-tasks-gauge-empty"
      >
        <p>No task data available</p>
      </div>
    );
  }

  const { activeTasks, maxTasks, activeWorkers, lastUpdated } = data;
  const utilizationPercent = Math.min(100, (activeTasks / maxTasks) * 100);

  // Determine status color based on utilization
  const getStatusColor = () => {
    if (utilizationPercent >= 90) return 'text-status-error';
    if (utilizationPercent >= 70) return 'text-status-warning';
    return 'text-accent-teal';
  };

  const getProgressColor = () => {
    if (utilizationPercent >= 90) return 'bg-status-error';
    if (utilizationPercent >= 70) return 'bg-status-warning';
    return 'bg-accent-teal';
  };

  // Format last updated time
  const formatLastUpdated = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div
      className={clsx(
        'bg-bg-secondary rounded-lg border border-border-primary p-6',
        className
      )}
      data-testid="active-tasks-gauge"
    >
      <h3 className="text-sm font-medium text-text-muted mb-2">Active Tasks</h3>

      {/* Main number */}
      <div className="flex items-baseline gap-2 mb-4">
        <span
          className={clsx('text-4xl font-bold', getStatusColor())}
          data-testid="active-tasks-count"
        >
          {activeTasks}
        </span>
        <span className="text-lg text-text-muted">/ {maxTasks}</span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-bg-tertiary rounded-full mb-4">
        <div
          className={clsx('h-full rounded-full transition-all duration-300', getProgressColor())}
          style={{ width: `${utilizationPercent}%` }}
          role="progressbar"
          aria-valuenow={activeTasks}
          aria-valuemin={0}
          aria-valuemax={maxTasks}
          data-testid="active-tasks-progress"
        />
      </div>

      {/* Additional stats */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-text-muted">Active Workers</span>
          <p className="font-medium text-text-primary" data-testid="active-workers-count">
            {activeWorkers}
          </p>
        </div>
        <div>
          <span className="text-text-muted">Utilization</span>
          <p className={clsx('font-medium', getStatusColor())} data-testid="utilization-percent">
            {utilizationPercent.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Last updated */}
      <p className="text-xs text-text-muted mt-4" data-testid="last-updated">
        Updated: {formatLastUpdated(lastUpdated)}
      </p>
    </div>
  );
}
