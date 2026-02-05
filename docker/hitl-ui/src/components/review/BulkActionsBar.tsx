/**
 * BulkActionsBar Component (T18)
 *
 * Sticky bar for bulk actions on selected findings.
 * Features:
 * - Shows count of selected findings
 * - Select all / Clear selection actions
 * - Bulk create issues button
 */

import { useReviewStore } from '../../stores/reviewStore';

interface BulkActionsBarProps {
  selectedCount: number;
  onCreateIssues: () => void;
}

export function BulkActionsBar({
  selectedCount,
  onCreateIssues,
}: BulkActionsBarProps) {
  const selectAllFindings = useReviewStore((state) => state.selectAllFindings);
  const clearSelection = useReviewStore((state) => state.clearSelection);

  return (
    <div
      className="sticky top-0 z-10 flex items-center justify-between p-3 bg-accent-teal/10 rounded-lg border border-accent-teal"
      data-testid="bulk-actions-bar"
    >
      <div className="flex items-center gap-4">
        <span
          className="font-medium text-accent-teal"
          data-testid="selection-count"
        >
          {selectedCount} finding{selectedCount !== 1 ? 's' : ''} selected
        </span>

        <button
          type="button"
          onClick={selectAllFindings}
          className="text-sm text-accent-teal hover:underline"
          data-testid="select-all-button"
        >
          Select all
        </button>

        <button
          type="button"
          onClick={clearSelection}
          className="text-sm text-text-secondary hover:underline"
          data-testid="clear-selection-button"
        >
          Clear selection
        </button>
      </div>

      <button
        type="button"
        onClick={onCreateIssues}
        className="px-4 py-2 bg-accent-teal text-white rounded-lg hover:bg-accent-teal/90 transition-colors text-sm font-medium"
        data-testid="bulk-create-issues-button"
      >
        Create {selectedCount} Issue{selectedCount !== 1 ? 's' : ''}
      </button>
    </div>
  );
}

export default BulkActionsBar;
