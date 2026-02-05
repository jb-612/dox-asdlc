/**
 * ReviewResultsPanel Component (T13)
 *
 * Main container for displaying code review results.
 * Integrates:
 * - SeveritySummary for traffic light overview
 * - BulkActionsBar for bulk operations
 * - FindingsList for detailed findings
 *
 * Provides download and issue creation actions.
 */

import type { ReviewFinding } from '../../api/types';
import { useReviewStore } from '../../stores/reviewStore';
import { SeveritySummary } from './SeveritySummary';
import { FindingsList } from './FindingsList';
import { BulkActionsBar } from './BulkActionsBar';

interface ReviewResultsPanelProps {
  onCreateIssue: (finding: ReviewFinding) => void;
  onBulkCreateIssues: () => void;
  onDownloadReport: (format: 'markdown' | 'pdf') => void;
}

export function ReviewResultsPanel({
  onCreateIssue,
  onBulkCreateIssues,
  onDownloadReport,
}: ReviewResultsPanelProps) {
  const results = useReviewStore((state) => state.results);
  const selectedFindings = useReviewStore((state) => state.selectedFindings);

  if (!results) {
    return (
      <div
        className="p-6 text-center text-text-secondary"
        data-testid="no-results"
      >
        No results available
      </div>
    );
  }

  const allFindings = [
    ...results.critical_findings,
    ...results.high_findings,
    ...results.medium_findings,
    ...results.low_findings,
    ...results.info_findings,
  ];

  const hasSelection = selectedFindings.size > 0;

  return (
    <div
      className="space-y-6 p-6 bg-bg-secondary rounded-lg border border-bg-tertiary"
      data-testid="review-results-panel"
    >
      {/* Header with summary */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">
          Review Results
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onDownloadReport('markdown')}
            className="px-3 py-1.5 bg-bg-tertiary text-text-primary rounded hover:bg-bg-tertiary/80 transition-colors text-sm"
            data-testid="download-md-button"
          >
            Download MD
          </button>
          <button
            type="button"
            onClick={() => onDownloadReport('pdf')}
            className="px-3 py-1.5 bg-bg-tertiary text-text-primary rounded hover:bg-bg-tertiary/80 transition-colors text-sm"
            data-testid="download-pdf-button"
          >
            Download PDF
          </button>
        </div>
      </div>

      {/* Severity Summary */}
      <SeveritySummary
        critical={results.critical_findings.length}
        high={results.high_findings.length}
        medium={results.medium_findings.length}
        low={results.low_findings.length}
        info={results.info_findings.length}
      />

      {/* Failed reviewers warning */}
      {results.reviewers_failed.length > 0 && (
        <div
          className="p-3 bg-status-warning/10 rounded-lg border border-status-warning"
          data-testid="failed-reviewers-warning"
        >
          <p className="text-sm text-status-warning">
            Some reviewers failed: {results.reviewers_failed.join(', ')}
          </p>
        </div>
      )}

      {/* Bulk actions bar */}
      {hasSelection && (
        <BulkActionsBar
          selectedCount={selectedFindings.size}
          onCreateIssues={onBulkCreateIssues}
        />
      )}

      {/* Findings list */}
      <FindingsList findings={allFindings} onCreateIssue={onCreateIssue} />
    </div>
  );
}

export default ReviewResultsPanel;
