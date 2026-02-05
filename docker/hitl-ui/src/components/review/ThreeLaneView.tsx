/**
 * ThreeLaneView Component (T10)
 *
 * Visual progress display with three lanes for each reviewer type.
 * Features:
 * - Color-coded lanes (Security=purple, Performance=teal, Style=blue)
 * - Progress bars with animation
 * - Status badges with icons
 * - File count and findings count
 * - Duration display on completion
 */

import clsx from 'clsx';
import {
  ShieldCheckIcon,
  BoltIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';
import type { ReviewerProgress } from '../../stores/reviewStore';
import type { ReviewerType } from '../../api/types';

interface ThreeLaneViewProps {
  reviewers: ReviewerProgress[];
}

/**
 * Configuration for each reviewer type
 */
interface ReviewerConfig {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  color: string;
  bgColor: string;
  textColor: string;
}

const REVIEWER_CONFIG: Record<ReviewerType, ReviewerConfig> = {
  security: {
    icon: ShieldCheckIcon,
    label: 'Security',
    color: 'purple',
    bgColor: 'bg-purple-500',
    textColor: 'text-purple-500',
  },
  performance: {
    icon: BoltIcon,
    label: 'Performance',
    color: 'teal',
    bgColor: 'bg-teal-500',
    textColor: 'text-teal-500',
  },
  style: {
    icon: DocumentTextIcon,
    label: 'Style',
    color: 'blue',
    bgColor: 'bg-blue-500',
    textColor: 'text-blue-500',
  },
};

/**
 * Status badge component showing current reviewer status
 */
function StatusBadge({ status }: { status: ReviewerProgress['status'] }) {
  const styles: Record<ReviewerProgress['status'], string> = {
    pending: 'bg-gray-500/20 text-gray-400',
    in_progress: 'bg-blue-500/20 text-blue-400 animate-pulse',
    complete: 'bg-green-500/20 text-green-400',
    failed: 'bg-red-500/20 text-red-400',
  };

  const labels: Record<ReviewerProgress['status'], string> = {
    pending: 'pending',
    in_progress: 'in progress',
    complete: 'complete',
    failed: 'failed',
  };

  const renderIcon = () => {
    switch (status) {
      case 'in_progress':
        return (
          <span className="animate-spin" data-testid="spinner-icon">
            &#8987;
          </span>
        );
      case 'complete':
        return <CheckCircleIcon className="h-3 w-3" data-testid="check-icon" />;
      case 'failed':
        return <XCircleIcon className="h-3 w-3" data-testid="x-icon" />;
      default:
        return null;
    }
  };

  return (
    <span
      className={clsx(
        'px-2 py-0.5 rounded-full text-xs flex items-center gap-1',
        styles[status]
      )}
      data-testid={`status-badge-${status}`}
    >
      {renderIcon()}
      {labels[status]}
    </span>
  );
}

export function ThreeLaneView({ reviewers }: ThreeLaneViewProps) {
  // Order reviewers: security, performance, style
  const orderedReviewers = (['security', 'performance', 'style'] as ReviewerType[])
    .map((type) => reviewers.find((r) => r.type === type))
    .filter((r): r is ReviewerProgress => r !== undefined);

  return (
    <div
      className="grid grid-cols-3 gap-4"
      data-testid="three-lane-view"
    >
      {orderedReviewers.map((reviewer) => {
        const config = REVIEWER_CONFIG[reviewer.type];
        const Icon = config.icon;

        return (
          <div
            key={reviewer.type}
            className="p-4 rounded-lg bg-bg-secondary border border-bg-tertiary"
            data-testid={`reviewer-lane-${reviewer.type}`}
          >
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
              <Icon className={clsx('h-5 w-5', config.textColor)} />
              <span className="font-medium text-text-primary">
                {config.label}
              </span>
              <StatusBadge status={reviewer.status} />
            </div>

            {/* Progress Bar */}
            <div
              className="h-2 bg-bg-tertiary rounded-full overflow-hidden mb-2"
              data-testid={`progress-bar-${reviewer.type}`}
            >
              <div
                className={clsx(
                  'h-full transition-all duration-500 ease-out',
                  config.bgColor,
                  reviewer.status === 'in_progress' && 'animate-pulse'
                )}
                style={{ width: `${reviewer.progress}%` }}
                data-testid={`progress-fill-${reviewer.type}`}
              />
            </div>

            {/* Stats */}
            <div className="flex justify-between text-xs text-text-tertiary">
              <span data-testid={`files-count-${reviewer.type}`}>
                {reviewer.filesReviewed} files
              </span>
              <span data-testid={`findings-count-${reviewer.type}`}>
                {reviewer.findingsCount} findings
              </span>
            </div>

            {/* Duration (if complete) */}
            {reviewer.durationSeconds !== undefined && (
              <p
                className="mt-2 text-xs text-text-tertiary"
                data-testid={`duration-${reviewer.type}`}
              >
                Completed in {reviewer.durationSeconds.toFixed(1)}s
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default ThreeLaneView;
