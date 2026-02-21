/**
 * FindingsList Component (T17)
 *
 * List of findings grouped by file with filtering options.
 * Features:
 * - Group findings by file path
 * - Filter by severity level
 * - Toggle visibility of ignored findings
 * - Integrates FindingCard for each finding
 */

import { useMemo, useState } from 'react';
import type { ReviewFinding, Severity } from '../../api/types';
import { useReviewStore } from '../../stores/reviewStore';
import { FindingCard } from './FindingCard';

interface FindingsListProps {
  findings: ReviewFinding[];
  onCreateIssue: (finding: ReviewFinding) => void;
}

export function FindingsList({ findings, onCreateIssue }: FindingsListProps) {
  const ignoredFindings = useReviewStore((state) => state.ignoredFindings);
  const [showIgnored, setShowIgnored] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all');

  // Group findings by file
  const groupedFindings = useMemo(() => {
    let filtered = findings;

    // Apply severity filter
    if (severityFilter !== 'all') {
      filtered = filtered.filter((f) => f.severity === severityFilter);
    }

    // Apply ignored filter
    if (!showIgnored) {
      filtered = filtered.filter((f) => !ignoredFindings.has(f.id));
    }

    // Group by file
    const groups = new Map<string, ReviewFinding[]>();
    filtered.forEach((finding) => {
      const existing = groups.get(finding.file_path) || [];
      groups.set(finding.file_path, [...existing, finding]);
    });

    return groups;
  }, [findings, severityFilter, showIgnored, ignoredFindings]);

  const handleCopy = async (finding: ReviewFinding) => {
    const markdown = `## ${finding.title}

**Severity:** ${finding.severity}
**File:** ${finding.file_path}${finding.line_start ? `:${finding.line_start}` : ''}

${finding.description}

**Recommendation:** ${finding.recommendation}`;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(markdown);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = markdown;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
    } catch {
      console.warn('Failed to copy finding to clipboard');
    }
  };

  return (
    <div className="space-y-4" data-testid="findings-list">
      {/* Filters */}
      <div className="flex items-center gap-4" data-testid="findings-filters">
        <select
          value={severityFilter}
          onChange={(e) =>
            setSeverityFilter(e.target.value as Severity | 'all')
          }
          className="px-3 py-1.5 rounded border border-bg-tertiary bg-bg-secondary text-text-primary text-sm"
          data-testid="severity-filter"
        >
          <option value="all">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
          <option value="info">Info</option>
        </select>

        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={showIgnored}
            onChange={(e) => setShowIgnored(e.target.checked)}
            className="rounded border-bg-tertiary accent-accent-teal"
            data-testid="show-ignored-checkbox"
          />
          Show ignored
        </label>
      </div>

      {/* Grouped findings */}
      {groupedFindings.size === 0 ? (
        <p
          className="text-center text-text-tertiary py-8"
          data-testid="empty-findings-message"
        >
          No findings match the current filters
        </p>
      ) : (
        Array.from(groupedFindings.entries()).map(
          ([filePath, fileFindings]) => (
            <div
              key={filePath}
              className="space-y-2"
              data-testid={`file-group-${filePath}`}
            >
              <h3 className="text-sm font-medium text-text-secondary flex items-center gap-2">
                <span aria-hidden="true">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </span>
                <span data-testid="file-path">{filePath}</span>
                <span
                  className="text-xs text-text-tertiary"
                  data-testid="file-findings-count"
                >
                  ({fileFindings.length})
                </span>
              </h3>

              <div className="space-y-2 pl-4">
                {fileFindings.map((finding) => (
                  <FindingCard
                    key={finding.id}
                    finding={finding}
                    onCreateIssue={() => onCreateIssue(finding)}
                    onCopy={() => handleCopy(finding)}
                  />
                ))}
              </div>
            </div>
          )
        )
      )}
    </div>
  );
}

export default FindingsList;
