/**
 * DevOpsActivityPanel - Panel displaying current and recent DevOps operations
 *
 * Shows:
 * - Current operation section with step list (if any operation is in progress)
 * - Recent operations section with status and duration
 * - Empty state when no operations
 * - Manual refresh button
 */

import { useCallback } from 'react';
import {
  ArrowPathIcon,
  CommandLineIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import DevOpsStepList from './DevOpsStepList';
import type { DevOpsActivity, DevOpsActivityResponse, DevOpsActivityStatus } from '../../api/types/devops';

export interface DevOpsActivityPanelProps {
  /** Activity data including current and recent operations */
  activity?: DevOpsActivityResponse;
  /** Loading state */
  isLoading?: boolean;
  /** Refresh callback */
  onRefresh?: () => void;
  /** Custom class name */
  className?: string;
}

// Status badge configuration
const statusBadgeConfig: Record<DevOpsActivityStatus, { bg: string; text: string; label: string }> = {
  in_progress: {
    bg: 'bg-accent-blue',
    text: 'text-white',
    label: 'In Progress',
  },
  completed: {
    bg: 'bg-status-success',
    text: 'text-white',
    label: 'Completed',
  },
  failed: {
    bg: 'bg-status-error',
    text: 'text-white',
    label: 'Failed',
  },
};

/**
 * Calculate duration between two ISO timestamps
 */
function calculateDuration(startedAt: string, completedAt?: string): string {
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const durationMs = end - start;

  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${seconds}s`;
}

/**
 * Status badge component
 */
function StatusBadge({
  status,
  testId,
}: {
  status: DevOpsActivityStatus;
  testId: string;
}) {
  const config = statusBadgeConfig[status];
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        config.bg,
        config.text,
      )}
      data-testid={testId}
    >
      {config.label}
    </span>
  );
}

/**
 * Recent operation item
 */
function RecentOperationItem({ activity }: { activity: DevOpsActivity }) {
  const duration = calculateDuration(activity.startedAt, activity.completedAt);

  return (
    <div
      className="flex items-center justify-between p-3 bg-bg-tertiary/30 rounded-lg"
      data-testid={`recent-operation-${activity.id}`}
    >
      <div className="flex-1 min-w-0 mr-4">
        <p className="text-sm font-medium text-text-primary truncate">
          {activity.operation}
        </p>
        <p className="text-xs text-text-muted mt-0.5">
          {new Date(activity.startedAt).toLocaleString()} - {duration}
        </p>
      </div>
      <StatusBadge
        status={activity.status}
        testId={`recent-operation-${activity.id}-status`}
      />
    </div>
  );
}

export default function DevOpsActivityPanel({
  activity,
  isLoading = false,
  onRefresh,
  className,
}: DevOpsActivityPanelProps) {
  const handleRefresh = useCallback(() => {
    onRefresh?.();
  }, [onRefresh]);

  // Loading state
  if (isLoading && !activity) {
    return (
      <div className={clsx('space-y-4', className)} data-testid="devops-activity-loading">
        <div className="h-8 w-32 bg-bg-secondary animate-pulse rounded" />
        <div className="h-24 bg-bg-secondary animate-pulse rounded-lg" />
        <div className="h-8 w-40 bg-bg-secondary animate-pulse rounded mt-6" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-bg-secondary animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const hasCurrentActivity = activity?.current !== undefined;
  const hasRecentActivities = activity?.recent && activity.recent.length > 0;
  const isEmpty = !hasCurrentActivity && !hasRecentActivities;

  // Empty state
  if (isEmpty) {
    return (
      <div
        className={clsx('p-6 text-center bg-bg-secondary rounded-lg', className)}
        data-testid="devops-activity-panel"
      >
        <div data-testid="devops-empty-state">
          <CommandLineIcon className="h-12 w-12 mx-auto mb-2 text-text-muted opacity-50" />
          <p className="text-text-muted">No DevOps activity</p>
          <p className="text-xs text-text-muted mt-1">
            Operations will appear here when they start
          </p>
        </div>
        {onRefresh && (
          <button
            onClick={handleRefresh}
            className="mt-4 px-4 py-2 bg-accent-blue text-white rounded-lg hover:bg-accent-blue/90 text-sm"
            data-testid="refresh-button"
          >
            Refresh
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={clsx('space-y-6', className)}
      data-testid="devops-activity-panel"
    >
      {/* Header with refresh button */}
      {onRefresh && (
        <div className="flex justify-end">
          <button
            onClick={handleRefresh}
            className="p-2 rounded-lg hover:bg-bg-tertiary transition-colors"
            aria-label="Refresh DevOps activity"
            data-testid="refresh-button"
          >
            <ArrowPathIcon className="h-5 w-5 text-text-secondary" />
          </button>
        </div>
      )}

      {/* Current Operation Section */}
      {hasCurrentActivity && activity.current && (
        <div data-testid="current-operation-section">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide">
              Current Operation
            </h3>
            <StatusBadge
              status={activity.current.status}
              testId="current-status-badge"
            />
          </div>
          <div className="bg-bg-secondary rounded-lg p-4">
            <h4 className="text-base font-medium text-text-primary mb-3">
              {activity.current.operation}
            </h4>
            <DevOpsStepList steps={activity.current.steps} />
          </div>
        </div>
      )}

      {/* Recent Operations Section */}
      {hasRecentActivities && (
        <div data-testid="recent-operations-section">
          <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide mb-3">
            Recent Operations
          </h3>
          <div className="space-y-2">
            {activity.recent.map((op) => (
              <RecentOperationItem key={op.id} activity={op} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
