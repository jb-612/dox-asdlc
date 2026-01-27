/**
 * DevOpsNotificationBanner - Fixed position notification banner for DevOps operations
 *
 * Features:
 * - Fixed position at top of viewport
 * - Color-coded: blue (in-progress), green (completed), red (failed)
 * - Dismiss button (X icon)
 * - Click banner to open DevOps activity (callback prop)
 * - Slide-in animation on mount
 * - Auto-hide after 10 seconds when completed or failed
 */

import { useEffect, useCallback } from 'react';
import { XMarkIcon } from '@heroicons/react/24/solid';
import clsx from 'clsx';
import type { DevOpsActivity, DevOpsActivityStatus } from '../../api/types/devops';

export interface DevOpsNotificationBannerProps {
  /** Activity to display */
  activity: DevOpsActivity;
  /** Callback when banner is dismissed */
  onDismiss?: () => void;
  /** Callback when banner is clicked (to open DevOps activity panel) */
  onClick?: () => void;
}

// Status configuration for colors and labels
const statusConfig: Record<DevOpsActivityStatus, {
  bg: string;
  text: string;
  label: string;
}> = {
  in_progress: {
    bg: 'bg-accent-blue',
    text: 'text-white',
    label: 'Deploying...',
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

// Auto-hide delay in milliseconds (10 seconds)
const AUTO_HIDE_DELAY = 10000;

/**
 * Get the current step based on activity status
 */
function getCurrentStep(activity: DevOpsActivity): string {
  // For completed, show completed message
  if (activity.status === 'completed') {
    return 'All steps completed';
  }

  // Find running or failed step
  const runningStep = activity.steps.find((s) => s.status === 'running');
  if (runningStep) {
    return runningStep.name;
  }

  const failedStep = activity.steps.find((s) => s.status === 'failed');
  if (failedStep) {
    return failedStep.name;
  }

  // Fallback to last completed or first pending
  const lastCompleted = [...activity.steps].reverse().find((s) => s.status === 'completed');
  if (lastCompleted) {
    const completedIndex = activity.steps.indexOf(lastCompleted);
    const nextStep = activity.steps[completedIndex + 1];
    if (nextStep) {
      return nextStep.name;
    }
    return lastCompleted.name;
  }

  return activity.steps[0]?.name || 'Starting...';
}

export default function DevOpsNotificationBanner({
  activity,
  onDismiss,
  onClick,
}: DevOpsNotificationBannerProps) {
  const config = statusConfig[activity.status];
  const currentStep = getCurrentStep(activity);
  const shouldAutoHide = activity.status === 'completed' || activity.status === 'failed';

  // Auto-hide timer for completed/failed status
  useEffect(() => {
    if (!shouldAutoHide || !onDismiss) {
      return;
    }

    const timer = setTimeout(() => {
      onDismiss();
    }, AUTO_HIDE_DELAY);

    return () => {
      clearTimeout(timer);
    };
  }, [shouldAutoHide, onDismiss]);

  // Handle banner click
  const handleClick = useCallback(() => {
    onClick?.();
  }, [onClick]);

  // Handle dismiss button click
  const handleDismiss = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering onClick
    onDismiss?.();
  }, [onDismiss]);

  return (
    <div
      className={clsx(
        'fixed top-0 left-0 right-0 z-50',
        'flex items-center justify-between px-4 py-3',
        'shadow-lg',
        'animate-slide-in-down',
        config.bg,
        config.text,
        onClick && 'cursor-pointer hover:opacity-95 transition-opacity',
      )}
      onClick={handleClick}
      data-testid="devops-notification-banner"
      role="alert"
    >
      {/* Content */}
      <div className="flex items-center gap-4 flex-1 min-w-0">
        {/* Status indicator */}
        <div className="flex-shrink-0">
          <span className="text-sm font-semibold uppercase tracking-wide">
            {config.label}
          </span>
        </div>

        {/* Operation name */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {activity.operation}
          </p>
        </div>

        {/* Current step */}
        <div className="flex-shrink-0">
          <span
            className="text-sm opacity-90"
            data-testid="current-step"
          >
            {currentStep}
          </span>
        </div>
      </div>

      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className={clsx(
          'flex-shrink-0 ml-4 p-1 rounded-full',
          'hover:bg-white/20 transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-white/50',
        )}
        aria-label="Dismiss notification"
        data-testid="dismiss-button"
      >
        <XMarkIcon className="h-5 w-5" />
      </button>
    </div>
  );
}
