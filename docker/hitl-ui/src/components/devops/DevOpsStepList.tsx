/**
 * DevOpsStepList - Display list of DevOps operation steps with status icons
 *
 * Shows operation steps in order with visual status indicators:
 * - Checkmark icon for completed steps (green)
 * - Spinner icon for running steps (blue)
 * - Circle icon for pending steps (gray)
 * - X icon for failed steps (red) with error message
 */

import {
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/solid';
import clsx from 'clsx';
import type { DevOpsStep, DevOpsStepStatus } from '../../api/types/devops';

export interface DevOpsStepListProps {
  /** Array of steps to display */
  steps: DevOpsStep[];
  /** Custom class name */
  className?: string;
}

// Circle icon for pending state (using a custom SVG for consistency)
function PendingCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      data-testid="icon-pending"
    >
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

// Status configuration for icons and colors
const statusConfig: Record<DevOpsStepStatus, {
  icon: React.ComponentType<{ className?: string; 'data-testid'?: string }>;
  colorClass: string;
  testId: string;
}> = {
  completed: {
    icon: ({ className, ...props }) => (
      <CheckCircleIcon className={className} {...props} />
    ),
    colorClass: 'text-status-success',
    testId: 'icon-completed',
  },
  running: {
    icon: ({ className, ...props }) => (
      <ArrowPathIcon className={clsx(className, 'animate-spin')} {...props} />
    ),
    colorClass: 'text-accent-blue',
    testId: 'icon-running',
  },
  pending: {
    icon: PendingCircleIcon,
    colorClass: 'text-text-muted',
    testId: 'icon-pending',
  },
  failed: {
    icon: ({ className, ...props }) => (
      <XCircleIcon className={className} {...props} />
    ),
    colorClass: 'text-status-error',
    testId: 'icon-failed',
  },
};

export default function DevOpsStepList({ steps, className }: DevOpsStepListProps) {
  return (
    <div
      className={clsx('space-y-2', className)}
      data-testid="devops-step-list"
    >
      {steps.map((step, index) => {
        const config = statusConfig[step.status];
        const Icon = config.icon;

        return (
          <div
            key={`${step.name}-${index}`}
            className={clsx(
              'flex items-start gap-3 p-2 rounded-lg transition-all duration-200',
              step.status === 'running' && 'bg-accent-blue/5',
              step.status === 'failed' && 'bg-status-error/5',
            )}
            data-testid={`step-${index}`}
          >
            {/* Icon container */}
            <div
              className="flex-shrink-0 w-6 h-6 transition-all duration-200"
              data-testid={`icon-container-${index}`}
            >
              <Icon
                className={clsx('w-6 h-6', config.colorClass)}
                data-testid={config.testId}
              />
            </div>

            {/* Step content */}
            <div className="flex-1 min-w-0">
              <p
                className={clsx(
                  'text-sm font-medium transition-colors duration-200',
                  step.status === 'pending' ? 'text-text-muted' : 'text-text-primary',
                )}
              >
                {step.name}
              </p>

              {/* Error message for failed steps */}
              {step.status === 'failed' && step.error && (
                <p
                  className="text-xs text-status-error mt-1"
                  data-testid={`step-${index}-error`}
                >
                  {step.error}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
