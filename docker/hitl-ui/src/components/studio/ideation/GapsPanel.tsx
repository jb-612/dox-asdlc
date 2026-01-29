/**
 * GapsPanel - Display gaps in PRD coverage with suggested questions (P05-F11 T08)
 *
 * Features:
 * - List categories below threshold (< 50%)
 * - Show severity (high/medium based on gap size)
 * - Display suggested questions for each gap
 * - "Ask about this" button that triggers callback
 * - Empty state when no gaps
 */

import { useState, useCallback, useMemo } from 'react';
import {
  ChevronRightIcon,
  ChevronDownIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import type { Gap } from '../../../types/ideation';

export interface GapsPanelProps {
  /** List of gaps to display */
  gaps: Gap[];
  /** Callback when "Ask about this" is clicked */
  onAskQuestion: (question: string) => void;
  /** Filter by severity */
  filterSeverity?: 'all' | 'critical' | 'moderate' | 'minor';
  /** Show suggested questions */
  showSuggestions?: boolean;
  /** Start collapsed */
  defaultCollapsed?: boolean;
  /** Custom class name */
  className?: string;
}

/** Severity order for sorting: critical (0), moderate (1), minor (2) */
const severityOrder: Record<string, number> = {
  critical: 0,
  moderate: 1,
  minor: 2,
};

/** Severity display config */
const severityConfig: Record<
  string,
  { label: string; colorClass: string; bgClass: string; Icon: typeof ExclamationCircleIcon }
> = {
  critical: {
    label: 'Critical',
    colorClass: 'text-status-error',
    bgClass: 'bg-status-error/10 border-status-error/20',
    Icon: ExclamationCircleIcon,
  },
  moderate: {
    label: 'Moderate',
    colorClass: 'text-status-warning',
    bgClass: 'bg-status-warning/10 border-status-warning/20',
    Icon: ExclamationTriangleIcon,
  },
  minor: {
    label: 'Minor',
    colorClass: 'text-status-info',
    bgClass: 'bg-status-info/10 border-status-info/20',
    Icon: InformationCircleIcon,
  },
};

export default function GapsPanel({
  gaps,
  onAskQuestion,
  filterSeverity = 'all',
  showSuggestions = true,
  defaultCollapsed = false,
  className,
}: GapsPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  // Sort and filter gaps
  const processedGaps = useMemo(() => {
    let filtered = [...gaps];

    // Apply severity filter
    if (filterSeverity !== 'all') {
      filtered = filtered.filter((g) => g.severity === filterSeverity);
    }

    // Sort by severity (critical first)
    return filtered.sort(
      (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
    );
  }, [gaps, filterSeverity]);

  // Count by severity
  const severityCounts = useMemo(() => {
    return gaps.reduce(
      (acc, gap) => {
        acc[gap.severity]++;
        return acc;
      },
      { critical: 0, moderate: 0, minor: 0 } as Record<string, number>
    );
  }, [gaps]);

  const handleHeaderClick = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleHeaderClick();
      }
    },
    [handleHeaderClick]
  );

  // Empty state
  if (gaps.length === 0) {
    return (
      <div
        data-testid="gaps-panel"
        className={clsx(
          'p-4 bg-bg-secondary rounded-lg border border-border-primary',
          className
        )}
      >
        <div
          data-testid="gaps-empty-state"
          className="flex flex-col items-center justify-center py-6 text-center"
        >
          <CheckCircleIcon
            data-testid="empty-state-success-icon"
            className="h-12 w-12 text-status-success mb-3"
          />
          <p className="text-sm text-text-primary font-medium">
            All categories are well-covered!
          </p>
          <p className="text-xs text-text-muted mt-1">
            Continue refining details to improve maturity.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="gaps-panel"
      className={clsx(
        'bg-bg-secondary rounded-lg border border-border-primary overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div
        data-testid="gaps-header"
        role="button"
        tabIndex={0}
        onClick={handleHeaderClick}
        onKeyDown={handleKeyDown}
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-bg-tertiary transition-colors"
      >
        {isCollapsed ? (
          <ChevronRightIcon className="h-4 w-4 text-text-muted flex-shrink-0" />
        ) : (
          <ChevronDownIcon className="h-4 w-4 text-text-muted flex-shrink-0" />
        )}

        <span className="flex-1 text-sm font-semibold text-text-primary">
          {processedGaps.length} Gap{processedGaps.length !== 1 ? 's' : ''} Identified
        </span>

        {/* Severity counts */}
        <div className="flex items-center gap-2 text-xs">
          {severityCounts.critical > 0 && (
            <span
              data-testid="severity-count-critical"
              className="flex items-center gap-1 text-status-error"
            >
              <ExclamationCircleIcon className="h-3 w-3" />
              {severityCounts.critical}
            </span>
          )}
          {severityCounts.moderate > 0 && (
            <span
              data-testid="severity-count-moderate"
              className="flex items-center gap-1 text-status-warning"
            >
              <ExclamationTriangleIcon className="h-3 w-3" />
              {severityCounts.moderate}
            </span>
          )}
          {severityCounts.minor > 0 && (
            <span
              data-testid="severity-count-minor"
              className="flex items-center gap-1 text-status-info"
            >
              <InformationCircleIcon className="h-3 w-3" />
              {severityCounts.minor}
            </span>
          )}
        </div>
      </div>

      {/* Gap List */}
      {!isCollapsed && (
        <ul role="list" className="border-t border-border-primary">
          {processedGaps.map((gap) => {
            const config = severityConfig[gap.severity];
            const SeverityIcon = config.Icon;

            return (
              <li
                key={gap.categoryId}
                role="listitem"
                data-testid={`gap-item-${gap.categoryId}`}
                className="border-b border-border-primary last:border-b-0"
              >
                <div className="p-3">
                  {/* Gap header */}
                  <div className="flex items-start gap-2 mb-2">
                    <SeverityIcon
                      data-testid={`severity-${gap.severity}-${gap.categoryId}`}
                      aria-label={`${config.label} severity`}
                      className={clsx('h-5 w-5 flex-shrink-0 mt-0.5', config.colorClass)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm text-text-primary">
                          {gap.categoryName}
                        </span>
                        <span
                          className={clsx(
                            'px-2 py-0.5 text-xs font-medium rounded-full border',
                            config.bgClass,
                            config.colorClass
                          )}
                        >
                          {config.label}
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary">{gap.description}</p>
                    </div>
                  </div>

                  {/* Suggested questions */}
                  {showSuggestions && gap.suggestedQuestions.length > 0 && (
                    <div className="ml-7 space-y-2">
                      {gap.suggestedQuestions.map((question, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 text-sm"
                        >
                          <ChatBubbleLeftRightIcon className="h-4 w-4 text-text-muted flex-shrink-0" />
                          <span className="flex-1 text-text-secondary">{question}</span>
                          <button
                            onClick={() => onAskQuestion(question)}
                            className={clsx(
                              'px-2 py-1 text-xs font-medium rounded',
                              'bg-accent-blue/10 text-accent-blue',
                              'hover:bg-accent-blue/20 transition-colors',
                              'flex-shrink-0'
                            )}
                            aria-label={`Ask about this: ${question}`}
                          >
                            Ask about this
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
