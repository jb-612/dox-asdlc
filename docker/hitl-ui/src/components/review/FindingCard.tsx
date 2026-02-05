/**
 * FindingCard Component (T15)
 *
 * Expandable card for displaying a single code review finding.
 * Features:
 * - Collapsible header with severity badge, title, file path
 * - Selection checkbox for bulk actions
 * - Expanded view with description, code snippet, recommendation
 * - Actions: Create Issue, Copy, Ignore/Unignore
 */

import { useState } from 'react';
import clsx from 'clsx';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import type { ReviewFinding } from '../../api/types';
import { SEVERITY_COLORS, REVIEWER_LABELS } from '../../api/types';
import { useReviewStore } from '../../stores/reviewStore';
import { CodeSnippetDisplay } from './CodeSnippetDisplay';

interface FindingCardProps {
  finding: ReviewFinding;
  onCreateIssue: () => void;
  onCopy: () => void;
}

export function FindingCard({ finding, onCreateIssue, onCopy }: FindingCardProps) {
  const [expanded, setExpanded] = useState(false);

  const selectedFindings = useReviewStore((state) => state.selectedFindings);
  const ignoredFindings = useReviewStore((state) => state.ignoredFindings);
  const toggleFindingSelection = useReviewStore(
    (state) => state.toggleFindingSelection
  );
  const ignoreFinding = useReviewStore((state) => state.ignoreFinding);
  const unignoreFinding = useReviewStore((state) => state.unignoreFinding);

  const isSelected = selectedFindings.has(finding.id);
  const isIgnored = ignoredFindings.has(finding.id);

  const handleToggleExpand = () => {
    setExpanded(!expanded);
  };

  const handleCheckboxChange = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFindingSelection(finding.id);
  };

  return (
    <div
      className={clsx(
        'rounded-lg border transition-opacity',
        isIgnored ? 'opacity-50 bg-bg-tertiary' : 'bg-bg-secondary',
        isSelected ? 'border-accent-teal' : 'border-bg-tertiary'
      )}
      data-testid={`finding-card-${finding.id}`}
      data-ignored={isIgnored || undefined}
      data-selected={isSelected || undefined}
    >
      {/* Header - always visible */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer"
        onClick={handleToggleExpand}
        data-testid="finding-card-header"
      >
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => toggleFindingSelection(finding.id)}
          onClick={handleCheckboxChange}
          className="h-4 w-4 rounded border-bg-tertiary accent-accent-teal"
          data-testid="finding-checkbox"
        />

        {/* Severity badge */}
        <span
          className={clsx(
            'px-2 py-0.5 rounded text-xs font-medium text-white',
            SEVERITY_COLORS[finding.severity]
          )}
          data-testid="severity-badge"
        >
          {finding.severity.toUpperCase()}
        </span>

        {/* Title */}
        <span
          className="flex-1 font-medium text-text-primary truncate"
          data-testid="finding-title"
        >
          {finding.title}
        </span>

        {/* File path */}
        <span
          className="text-xs text-text-tertiary truncate max-w-[200px]"
          data-testid="finding-file-path"
        >
          {finding.file_path}
          {finding.line_start && `:${finding.line_start}`}
        </span>

        {/* Reviewer badge */}
        <span
          className="text-xs px-2 py-0.5 rounded bg-bg-tertiary text-text-secondary"
          data-testid="reviewer-badge"
        >
          {REVIEWER_LABELS[finding.reviewer_type]}
        </span>

        {/* Expand icon */}
        {expanded ? (
          <ChevronUpIcon
            className="h-5 w-5 text-text-tertiary flex-shrink-0"
            data-testid="collapse-icon"
          />
        ) : (
          <ChevronDownIcon
            className="h-5 w-5 text-text-tertiary flex-shrink-0"
            data-testid="expand-icon"
          />
        )}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div
          className="px-4 pb-4 space-y-4 border-t border-bg-tertiary pt-4"
          data-testid="finding-expanded-content"
        >
          {/* Description */}
          <div>
            <h4 className="text-sm font-medium text-text-secondary mb-1">
              Description
            </h4>
            <p className="text-sm text-text-primary" data-testid="finding-description">
              {finding.description}
            </p>
          </div>

          {/* Code snippet */}
          {finding.code_snippet && (
            <CodeSnippetDisplay
              code={finding.code_snippet}
              lineStart={finding.line_start || undefined}
            />
          )}

          {/* Recommendation */}
          <div>
            <h4 className="text-sm font-medium text-text-secondary mb-1">
              Recommendation
            </h4>
            <p className="text-sm text-text-primary" data-testid="finding-recommendation">
              {finding.recommendation}
            </p>
          </div>

          {/* Confidence */}
          <p className="text-xs text-text-tertiary" data-testid="finding-confidence">
            Confidence: {(finding.confidence * 100).toFixed(0)}%
          </p>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onCreateIssue}
              className="px-3 py-1.5 bg-accent-teal text-white rounded hover:bg-accent-teal/90 transition-colors text-sm"
              data-testid="create-issue-button"
            >
              Create Issue
            </button>
            <button
              type="button"
              onClick={onCopy}
              className="px-3 py-1.5 bg-bg-tertiary text-text-primary rounded hover:bg-bg-tertiary/80 transition-colors text-sm"
              data-testid="copy-button"
            >
              Copy
            </button>
            {isIgnored ? (
              <button
                type="button"
                onClick={() => unignoreFinding(finding.id)}
                className="px-3 py-1.5 text-text-secondary hover:text-text-primary transition-colors text-sm"
                data-testid="unignore-button"
              >
                Unignore
              </button>
            ) : (
              <button
                type="button"
                onClick={() => ignoreFinding(finding.id)}
                className="px-3 py-1.5 text-text-secondary hover:text-text-primary transition-colors text-sm"
                data-testid="ignore-button"
              >
                Ignore
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default FindingCard;
