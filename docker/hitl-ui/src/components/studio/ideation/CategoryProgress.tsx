/**
 * CategoryProgress - Individual category progress with expand/collapse (P05-F11 T07)
 *
 * Features:
 * - Category name with score percentage
 * - Progress bar per category
 * - Expandable section showing captured details
 * - Visual status indicator (empty/partial/complete icons)
 * - Click to expand/collapse
 */

import { useState, useCallback } from 'react';
import {
  ChevronRightIcon,
  ChevronDownIcon,
  CheckCircleIcon,
  MinusCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import clsx from 'clsx';
import type { CategoryMaturity } from '../../../types/ideation';

export interface CategoryProgressProps {
  /** Category maturity data */
  category: CategoryMaturity;
  /** Callback when toggled */
  onToggle?: (categoryId: string, expanded: boolean) => void;
  /** Show required indicator */
  showRequired?: boolean;
  /** Default expanded state */
  defaultExpanded?: boolean;
  /** Custom class name */
  className?: string;
}

/**
 * Get status icon based on score
 * - 0%: empty (ExclamationCircleIcon)
 * - 1-99%: partial (MinusCircleIcon)
 * - 100%: complete (CheckCircleIcon)
 */
function getStatusIcon(score: number) {
  if (score === 0) {
    return {
      Icon: ExclamationCircleIcon,
      testId: 'status-icon-empty',
      colorClass: 'text-text-muted',
    };
  }
  if (score === 100) {
    return {
      Icon: CheckCircleIcon,
      testId: 'status-icon-complete',
      colorClass: 'text-status-success',
    };
  }
  return {
    Icon: MinusCircleIcon,
    testId: 'status-icon-partial',
    colorClass: 'text-status-warning',
  };
}

export default function CategoryProgress({
  category,
  onToggle,
  showRequired = false,
  defaultExpanded = false,
  className,
}: CategoryProgressProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const { id, name, score, sections, requiredForSubmit } = category;

  const statusInfo = getStatusIcon(score);
  const StatusIcon = statusInfo.Icon;

  const handleToggle = useCallback(() => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    onToggle?.(id, newExpanded);
  }, [isExpanded, id, onToggle]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleToggle();
      }
    },
    [handleToggle]
  );

  // Get all captured items from sections
  const allCapturedItems = sections.flatMap((section) => section.captured);
  const hasContent = allCapturedItems.length > 0 || sections.length > 0;

  return (
    <div
      data-testid="category-progress"
      className={clsx('border border-border-primary rounded-lg', className)}
    >
      {/* Header - clickable to expand/collapse */}
      <div
        data-testid="category-header"
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className={clsx(
          'flex items-center gap-3 p-3 cursor-pointer transition-colors',
          'hover:bg-bg-tertiary',
          isExpanded && 'bg-bg-tertiary'
        )}
      >
        {/* Chevron */}
        {isExpanded ? (
          <ChevronDownIcon
            data-testid="chevron-down"
            className="h-4 w-4 text-text-muted flex-shrink-0"
          />
        ) : (
          <ChevronRightIcon
            data-testid="chevron-right"
            className="h-4 w-4 text-text-muted flex-shrink-0"
          />
        )}

        {/* Status Icon */}
        <StatusIcon
          data-testid={statusInfo.testId}
          className={clsx('h-5 w-5 flex-shrink-0', statusInfo.colorClass)}
        />

        {/* Category Name */}
        <span
          data-testid="category-name"
          className="flex-1 text-sm font-medium text-text-primary truncate"
        >
          {name}
        </span>

        {/* Required Indicator */}
        {showRequired && requiredForSubmit && (
          <StarIcon
            data-testid="required-indicator"
            className="h-4 w-4 text-status-warning flex-shrink-0"
            aria-label="Required for submission"
          />
        )}

        {/* Score */}
        <span
          data-testid="category-score"
          className="text-sm font-medium text-text-secondary"
        >
          {score}%
        </span>

        {/* Progress Bar (inline mini) */}
        <div className="w-20 h-2 bg-bg-tertiary rounded-full overflow-hidden flex-shrink-0">
          <div
            data-testid="category-progress-fill"
            className={clsx(
              'h-full rounded-full transition-all duration-300',
              score >= 80
                ? 'bg-status-success'
                : score >= 40
                ? 'bg-status-warning'
                : 'bg-status-error'
            )}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div
          data-testid="category-details"
          className="border-t border-border-primary p-3 bg-bg-primary"
        >
          {!hasContent ? (
            <p className="text-sm text-text-muted italic">
              No details captured yet for this category.
            </p>
          ) : (
            <div className="space-y-3">
              {sections.map((section) => (
                <div key={section.id} className="space-y-1">
                  <h4 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                    {section.name}
                  </h4>
                  {section.captured.length > 0 ? (
                    <ul className="space-y-1">
                      {section.captured.map((item, idx) => (
                        <li
                          key={idx}
                          className="text-sm text-text-primary pl-3 border-l-2 border-status-success/50"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-text-muted italic pl-3">
                      No items captured
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
