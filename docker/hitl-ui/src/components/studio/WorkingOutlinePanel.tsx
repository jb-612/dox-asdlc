/**
 * WorkingOutlinePanel - Displays PRD outline sections with status and progress
 */

import { useState, useCallback, useMemo } from 'react';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  ClockIcon,
  EllipsisHorizontalCircleIcon,
  DocumentTextIcon,
  DocumentArrowDownIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

/** Section status */
export type SectionStatus = 'complete' | 'in_progress' | 'pending';

/** Outline section */
export interface OutlineSection {
  /** Section ID */
  id: string;
  /** Section title */
  title: string;
  /** Section status */
  status: SectionStatus;
  /** Section content */
  content: string;
}

export interface WorkingOutlinePanelProps {
  /** Outline sections */
  sections: OutlineSection[];
  /** Loading state */
  isLoading?: boolean;
  /** Custom class name */
  className?: string;
  /** Callback when section is clicked */
  onSectionClick?: (sectionId: string) => void;
  /** Callback when Preview PRD is clicked */
  onPreviewPRD?: () => void;
  /** Callback when Save Draft is clicked */
  onSaveDraft?: () => void;
}

// Status icon mapping
const statusIcons: Record<SectionStatus, typeof CheckCircleIcon> = {
  complete: CheckCircleIcon,
  in_progress: ClockIcon,
  pending: EllipsisHorizontalCircleIcon,
};

// Status colors
const statusColors: Record<SectionStatus, string> = {
  complete: 'text-status-success',
  in_progress: 'text-status-warning',
  pending: 'text-text-muted',
};

export default function WorkingOutlinePanel({
  sections,
  isLoading = false,
  className,
  onSectionClick,
  onPreviewPRD,
  onSaveDraft,
}: WorkingOutlinePanelProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Calculate counts
  const counts = useMemo(() => {
    const result: Record<SectionStatus, number> = {
      complete: 0,
      in_progress: 0,
      pending: 0,
    };
    for (const section of sections) {
      result[section.status]++;
    }
    return result;
  }, [sections]);

  // Calculate completeness percentage
  const completenessPercent = useMemo(() => {
    if (sections.length === 0) return 0;
    return Math.round((counts.complete / sections.length) * 100);
  }, [sections.length, counts.complete]);

  // Toggle section expansion
  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
    onSectionClick?.(sectionId);
  }, [onSectionClick]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, sectionId: string) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleSection(sectionId);
      }
    },
    [toggleSection]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className={clsx('p-4', className)} data-testid="outline-loading">
        <div className="h-6 w-32 bg-bg-tertiary rounded animate-pulse mb-4" />
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-10 bg-bg-tertiary rounded animate-pulse"
              data-testid="section-skeleton"
            />
          ))}
        </div>
      </div>
    );
  }

  const canPreview = counts.complete > 0;

  return (
    <div
      className={clsx('p-4 flex flex-col h-full', className)}
      data-testid="working-outline-panel"
    >
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-text-primary mb-2">Working Outline</h3>

        {/* Progress */}
        <div className="flex items-center gap-3 mb-2">
          <div
            className="flex-1 h-2 bg-bg-tertiary rounded-full overflow-hidden"
            data-testid="progress-bar"
          >
            <div
              className="h-full bg-status-success transition-all duration-300"
              style={{ width: `${completenessPercent}%` }}
              data-testid="progress-fill"
            />
          </div>
          <span
            className="text-sm font-medium text-text-primary min-w-[3rem] text-right"
            data-testid="completeness-percentage"
          >
            {completenessPercent}%
          </span>
        </div>

        {/* Counts */}
        <div className="flex gap-4 text-xs text-text-muted">
          <span className="flex items-center gap-1">
            <CheckCircleIcon className="h-3 w-3 text-status-success" />
            <span data-testid="count-complete">{counts.complete}</span> complete
          </span>
          <span className="flex items-center gap-1">
            <ClockIcon className="h-3 w-3 text-status-warning" />
            <span data-testid="count-in_progress">{counts.in_progress}</span> in progress
          </span>
          <span className="flex items-center gap-1">
            <EllipsisHorizontalCircleIcon className="h-3 w-3 text-text-muted" />
            <span data-testid="count-pending">{counts.pending}</span> pending
          </span>
        </div>
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto">
        {sections.length === 0 ? (
          <div className="text-center py-8 text-text-muted">
            No outline sections yet
          </div>
        ) : (
          <div className="space-y-1">
            {sections.map((section) => {
              const isExpanded = expandedSections.has(section.id);
              const StatusIcon = statusIcons[section.status];

              return (
                <div key={section.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleSection(section.id)}
                    onKeyDown={(e) => handleKeyDown(e, section.id)}
                    className={clsx(
                      'flex items-center gap-2 p-2 rounded-lg cursor-pointer',
                      'hover:bg-bg-tertiary transition-colors',
                      isExpanded && 'bg-bg-tertiary'
                    )}
                    data-testid={`section-${section.id}`}
                  >
                    {isExpanded ? (
                      <ChevronDownIcon className="h-4 w-4 text-text-muted flex-shrink-0" />
                    ) : (
                      <ChevronRightIcon className="h-4 w-4 text-text-muted flex-shrink-0" />
                    )}
                    <StatusIcon
                      className={clsx('h-4 w-4 flex-shrink-0', statusColors[section.status])}
                      data-testid={`status-${section.status}`}
                    />
                    <span className="text-sm text-text-primary truncate">{section.title}</span>
                  </div>

                  {isExpanded && section.content && (
                    <div
                      className="ml-10 p-2 text-sm text-text-secondary"
                      data-testid={`section-content-${section.id}`}
                    >
                      {section.content}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 pt-4 border-t border-border-primary flex gap-2">
        <button
          onClick={onPreviewPRD}
          disabled={!canPreview}
          className={clsx(
            'flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-sm',
            canPreview
              ? 'bg-accent-blue text-white hover:bg-accent-blue/90'
              : 'bg-bg-tertiary text-text-muted cursor-not-allowed'
          )}
        >
          <DocumentTextIcon className="h-4 w-4" />
          Preview PRD
        </button>
        <button
          onClick={onSaveDraft}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-sm bg-bg-tertiary hover:bg-bg-primary transition-colors"
        >
          <DocumentArrowDownIcon className="h-4 w-4" />
          Save Draft
        </button>
      </div>
    </div>
  );
}
