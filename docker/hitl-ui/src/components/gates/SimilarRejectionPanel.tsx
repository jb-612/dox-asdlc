/**
 * SimilarRejectionPanel - Displays similar rejection patterns for HITL gates
 */

import { useState, useCallback } from 'react';
import {
  ExclamationTriangleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  XMarkIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

/** Example of a rejection */
export interface RejectionExample {
  /** Artifact name */
  artifactName: string;
  /** Reason for rejection */
  rejectReason: string;
}

/** Rejection pattern */
export interface RejectionPattern {
  /** Pattern ID */
  id: string;
  /** Pattern description */
  description: string;
  /** Number of occurrences */
  occurrences: number;
  /** Last seen timestamp */
  lastSeen: string;
  /** Example rejections */
  examples: RejectionExample[];
  /** Severity level */
  severity: 'high' | 'medium' | 'low';
}

export interface SimilarRejectionPanelProps {
  /** Rejection patterns */
  patterns: RejectionPattern[];
  /** Loading state */
  isLoading?: boolean;
  /** Custom class name */
  className?: string;
  /** Callback when pattern is ignored */
  onIgnorePattern?: (patternId: string) => void;
}

// Severity styles
const severityStyles = {
  high: 'bg-status-error/10 text-status-error',
  medium: 'bg-status-warning/10 text-status-warning',
  low: 'bg-bg-tertiary text-text-muted',
};

// Format date
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
}

export default function SimilarRejectionPanel({
  patterns,
  isLoading = false,
  className,
  onIgnorePattern,
}: SimilarRejectionPanelProps) {
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [expandedPatterns, setExpandedPatterns] = useState<Set<string>>(new Set());

  // Toggle pattern expansion
  const handleToggleExpand = useCallback((patternId: string) => {
    setExpandedPatterns((prev) => {
      const next = new Set(prev);
      if (next.has(patternId)) {
        next.delete(patternId);
      } else {
        next.add(patternId);
      }
      return next;
    });
  }, []);

  // Handle expand keyboard
  const handleExpandKeyDown = useCallback(
    (e: React.KeyboardEvent, patternId: string) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleToggleExpand(patternId);
      }
    },
    [handleToggleExpand]
  );

  // Handle ignore
  const handleIgnore = useCallback(
    (patternId: string) => {
      onIgnorePattern?.(patternId);
    },
    [onIgnorePattern]
  );

  // Handle ignore keyboard
  const handleIgnoreKeyDown = useCallback(
    (e: React.KeyboardEvent, patternId: string) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleIgnore(patternId);
      }
    },
    [handleIgnore]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className={clsx('rounded-lg border border-border-primary bg-bg-secondary', className)} data-testid="panel-loading">
        <div className="p-4">
          <div className="h-6 w-48 bg-bg-tertiary rounded animate-pulse mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 bg-bg-tertiary rounded animate-pulse"
                data-testid="skeleton-pattern"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (patterns.length === 0) {
    return (
      <div
        className={clsx('rounded-lg border border-border-primary bg-bg-secondary p-4', className)}
        data-testid="similar-rejection-panel"
      >
        <div className="flex items-center justify-center h-24 text-text-muted">
          No similar rejections found
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx('rounded-lg border border-border-primary bg-bg-secondary', className)}
      data-testid="similar-rejection-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border-primary">
        <div className="flex items-center gap-2">
          <ExclamationTriangleIcon className="h-5 w-5 text-status-warning" />
          <span className="font-medium text-text-primary">Similar Rejection Patterns</span>
          <span className="text-sm text-text-muted">
            (<span data-testid="pattern-count">{patterns.length}</span> found)
          </span>
        </div>
        <button
          onClick={() => setIsPanelCollapsed((prev) => !prev)}
          className="p-1 rounded hover:bg-bg-tertiary"
          data-testid="collapse-toggle"
        >
          {isPanelCollapsed ? (
            <ChevronDownIcon className="h-4 w-4 text-text-muted" />
          ) : (
            <ChevronUpIcon className="h-4 w-4 text-text-muted" />
          )}
        </button>
      </div>

      {/* Pattern list */}
      {!isPanelCollapsed && (
        <div className="p-4 space-y-3" data-testid="pattern-list">
          {patterns.map((pattern) => {
            const isExpanded = expandedPatterns.has(pattern.id);

            return (
              <div
                key={pattern.id}
                className="rounded-lg border border-border-primary bg-bg-primary"
                data-testid={`pattern-${pattern.id}`}
              >
                {/* Pattern header */}
                <div className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={clsx(
                            'px-2 py-0.5 rounded text-xs font-medium capitalize',
                            severityStyles[pattern.severity]
                          )}
                          data-testid="severity-badge"
                        >
                          {pattern.severity}
                        </span>
                        <span className="text-xs text-text-muted" data-testid="occurrence-count">
                          {pattern.occurrences} occurrences
                        </span>
                        <span className="text-xs text-text-muted" data-testid="last-seen">
                          Last: {formatDate(pattern.lastSeen)}
                        </span>
                      </div>
                      <p className="text-sm text-text-primary">{pattern.description}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleIgnore(pattern.id)}
                        onKeyDown={(e) => handleIgnoreKeyDown(e, pattern.id)}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs text-text-muted hover:text-text-primary hover:bg-bg-tertiary"
                        data-testid={`ignore-${pattern.id}`}
                      >
                        <XMarkIcon className="h-3 w-3" />
                        Ignore
                      </button>
                      <button
                        onClick={() => handleToggleExpand(pattern.id)}
                        onKeyDown={(e) => handleExpandKeyDown(e, pattern.id)}
                        className="p-1 rounded hover:bg-bg-tertiary"
                        data-testid={`expand-${pattern.id}`}
                      >
                        {isExpanded ? (
                          <ChevronUpIcon className="h-4 w-4 text-text-muted" />
                        ) : (
                          <ChevronDownIcon className="h-4 w-4 text-text-muted" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Examples */}
                {isExpanded && (
                  <div
                    className="px-3 pb-3 border-t border-border-primary bg-bg-tertiary rounded-b-lg"
                    data-testid={`examples-${pattern.id}`}
                  >
                    <div className="pt-3 space-y-2">
                      <p className="text-xs font-medium text-text-muted uppercase">Examples</p>
                      {pattern.examples.map((example, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2 text-sm"
                        >
                          <DocumentTextIcon className="h-4 w-4 text-text-muted flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="font-medium text-text-primary">{example.artifactName}</span>
                            <span className="text-text-muted"> - {example.rejectReason}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
