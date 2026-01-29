/**
 * MaturityTracker - Progress visualization for PRD maturity (P05-F11 T06)
 *
 * Features:
 * - Progress bar with percentage (0-100%)
 * - Level indicator showing current level (Concept -> Complete)
 * - Color coding: red (<40%), yellow (40-79%), green (80%+)
 * - Animated transitions on score changes
 * - Shows "Ready to Submit" indicator at 80%+
 */

import { CheckCircleIcon } from '@heroicons/react/24/solid';
import clsx from 'clsx';
import type { MaturityState } from '../../../types/ideation';

export interface MaturityTrackerProps {
  /** Current maturity state */
  maturity: MaturityState;
  /** Custom class name */
  className?: string;
  /** Compact mode - hides description */
  compact?: boolean;
}

/**
 * Get color class based on maturity score
 * - red (<40%): bg-status-error
 * - yellow (40-79%): bg-status-warning
 * - green (80%+): bg-status-success
 */
function getScoreColorClass(score: number): string {
  if (score >= 80) return 'bg-status-success';
  if (score >= 40) return 'bg-status-warning';
  return 'bg-status-error';
}

/**
 * Get text color class based on maturity score
 */
function getScoreTextColorClass(score: number): string {
  if (score >= 80) return 'text-status-success';
  if (score >= 40) return 'text-status-warning';
  return 'text-status-error';
}

export default function MaturityTracker({
  maturity,
  className,
  compact = false,
}: MaturityTrackerProps) {
  const { score, level, canSubmit } = maturity;
  const colorClass = getScoreColorClass(score);
  const textColorClass = getScoreTextColorClass(score);

  return (
    <div
      data-testid="maturity-tracker"
      className={clsx('p-4 bg-bg-secondary rounded-lg', className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-text-primary">PRD Maturity</h3>
        <span
          data-testid="maturity-percentage"
          className={clsx('text-2xl font-bold', textColorClass)}
        >
          {score}%
        </span>
      </div>

      {/* Progress Bar with ARIA attributes */}
      <div
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="PRD maturity progress"
        className="h-3 bg-bg-tertiary rounded-full overflow-hidden mb-3"
      >
        <div
          data-testid="maturity-progress-fill"
          className={clsx(
            'h-full rounded-full transition-all duration-500 ease-out',
            colorClass
          )}
          style={{ width: `${score}%` }}
        />
      </div>

      {/* Level Indicator */}
      <div className="flex items-center justify-between mb-2">
        <span
          data-testid="maturity-level"
          className="text-sm font-medium text-text-primary"
        >
          {level.label}
        </span>
        {!compact && (
          <span
            data-testid="maturity-description"
            className="text-sm text-text-muted"
          >
            {level.description}
          </span>
        )}
      </div>

      {/* Ready to Submit Indicator */}
      {canSubmit && (
        <div
          data-testid="ready-to-submit"
          className="flex items-center gap-2 mt-3 p-2 bg-status-success/10 border border-status-success/20 rounded-lg"
        >
          <CheckCircleIcon className="h-5 w-5 text-status-success" />
          <span className="text-sm font-medium text-status-success">
            Ready to Submit
          </span>
        </div>
      )}
    </div>
  );
}
