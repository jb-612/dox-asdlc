/**
 * AuditLogViewer - Displays a filterable, paginated table of audit log entries (P11-F01 T25)
 *
 * Shows audit log entries in a table with expandable rows for detail inspection.
 * Supports filtering by event type and guideline ID, pagination, and CSV export.
 */

import { useState, useEffect } from 'react';
import { useAuditLogs } from '../../api/guardrails';
import type { AuditListParams, AuditLogEntry } from '../../api/types/guardrails';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AuditLogViewerProps {
  guidelineId?: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EVENT_TYPE_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'guideline_created', label: 'Created' },
  { value: 'guideline_updated', label: 'Updated' },
  { value: 'guideline_toggled', label: 'Toggled' },
  { value: 'guideline_deleted', label: 'Deleted' },
  { value: 'context_evaluated', label: 'Evaluated' },
];

const PAGE_SIZE = 10;

// ---------------------------------------------------------------------------
// Badge color mapping
// ---------------------------------------------------------------------------

function getBadgeClasses(eventType: string): string {
  switch (eventType) {
    case 'guideline_created':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'guideline_updated':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'guideline_toggled':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
    case 'guideline_deleted':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'context_evaluated':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  }
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatEventType(eventType: string): string {
  return eventType
    .replace('guideline_', '')
    .replace('context_', '')
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return timestamp;
  }
}

// ---------------------------------------------------------------------------
// CSV export helper
// ---------------------------------------------------------------------------

function exportToCsv(entries: AuditLogEntry[]): void {
  const headers = ['ID', 'Timestamp', 'Event Type', 'Guideline ID', 'Changes', 'Decision', 'Context'];
  const rows = entries.map((entry) => [
    entry.id,
    entry.timestamp,
    entry.event_type,
    entry.guideline_id ?? '',
    entry.changes ? JSON.stringify(entry.changes) : '',
    entry.decision ? JSON.stringify(entry.decision) : '',
    entry.context ? JSON.stringify(entry.context) : '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'audit-log.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Detail renderer for expanded rows
// ---------------------------------------------------------------------------

function renderDetail(entry: AuditLogEntry) {
  const sections: { label: string; data: Record<string, unknown> }[] = [];

  if (entry.changes) {
    sections.push({ label: 'Changes', data: entry.changes });
  }
  if (entry.decision) {
    sections.push({ label: 'Decision', data: entry.decision });
  }
  if (entry.context) {
    sections.push({ label: 'Context', data: entry.context });
  }

  if (sections.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400 italic">No additional details.</p>;
  }

  return (
    <div className="space-y-2">
      {sections.map((section) => (
        <div key={section.label}>
          <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">
            {section.label}
          </h4>
          <pre className="text-xs bg-gray-50 dark:bg-gray-900 p-2 rounded overflow-x-auto text-gray-800 dark:text-gray-200">
            {JSON.stringify(section.data, null, 2)}
          </pre>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AuditLogViewer({ guidelineId }: AuditLogViewerProps) {
  // -------------------------------------------------------------------------
  // Local state
  // -------------------------------------------------------------------------

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('');
  const [guidelineFilter, setGuidelineFilter] = useState<string>(guidelineId ?? '');
  const [page, setPage] = useState<number>(1);

  useEffect(() => {
    setGuidelineFilter(guidelineId ?? '');
    setPage(1);
  }, [guidelineId]);

  // -------------------------------------------------------------------------
  // Build query params
  // -------------------------------------------------------------------------

  const params: AuditListParams = {
    page,
    page_size: PAGE_SIZE,
  };

  if (eventTypeFilter) {
    params.event_type = eventTypeFilter;
  }

  if (guidelineFilter) {
    params.guideline_id = guidelineFilter;
  }

  // -------------------------------------------------------------------------
  // Fetch data
  // -------------------------------------------------------------------------

  const { data, isLoading } = useAuditLogs(params);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const toggleExpand = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleEventFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setEventTypeFilter(e.target.value);
    setPage(1);
  };

  const handleGuidelineFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGuidelineFilter(e.target.value);
    setPage(1);
  };

  const handleExportCsv = () => {
    if (data?.entries) {
      exportToCsv(data.entries);
    }
  };

  // -------------------------------------------------------------------------
  // Pagination
  // -------------------------------------------------------------------------

  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE);

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div data-testid="audit-log-loading" className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-9 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  const entries = data?.entries ?? [];

  if (entries.length === 0 && !isLoading) {
    return (
      <div data-testid="audit-log-viewer" className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Audit Log</h2>
          <button
            data-testid="audit-export-csv"
            onClick={handleExportCsv}
            disabled
            className="px-3 py-1.5 text-sm font-medium border rounded-md
              border-gray-300 dark:border-gray-600
              text-gray-400 dark:text-gray-500
              bg-white dark:bg-gray-800
              cursor-not-allowed"
          >
            Export CSV
          </button>
        </div>

        {/* Filters */}
        {renderFilters()}

        <div
          data-testid="audit-log-empty"
          className="py-12 text-center text-gray-500 dark:text-gray-400"
        >
          <p className="text-sm">No audit log entries found.</p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Filter controls
  // -------------------------------------------------------------------------

  function renderFilters() {
    return (
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
          Event:
          <select
            data-testid="audit-event-filter"
            value={eventTypeFilter}
            onChange={handleEventFilterChange}
            className="px-2 py-1 text-sm border rounded
              border-gray-300 dark:border-gray-600
              bg-white dark:bg-gray-800
              text-gray-900 dark:text-gray-100"
          >
            {EVENT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
          Guideline:
          <input
            data-testid="audit-guideline-filter"
            type="text"
            value={guidelineFilter}
            onChange={handleGuidelineFilterChange}
            placeholder="Filter by ID..."
            className="px-2 py-1 text-sm border rounded w-40
              border-gray-300 dark:border-gray-600
              bg-white dark:bg-gray-800
              text-gray-900 dark:text-gray-100
              placeholder-gray-400 dark:placeholder-gray-500
              focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div data-testid="audit-log-viewer" className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Audit Log</h2>
        <button
          data-testid="audit-export-csv"
          onClick={handleExportCsv}
          className="px-3 py-1.5 text-sm font-medium border rounded-md
            border-gray-300 dark:border-gray-600
            text-gray-700 dark:text-gray-300
            bg-white dark:bg-gray-800
            hover:bg-gray-50 dark:hover:bg-gray-700
            transition-colors"
        >
          Export CSV
        </button>
      </div>

      {/* Filters */}
      {renderFilters()}

      {/* Table */}
      <div className="overflow-x-auto border rounded-lg border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Timestamp
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Event Type
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Guideline ID
              </th>
              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-12">
                {/* Expand toggle column */}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {entries.map((entry) => (
              <TableRow
                key={entry.id}
                entry={entry}
                isExpanded={expandedRows.has(entry.id)}
                onToggleExpand={toggleExpand}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          data-testid="audit-pagination"
          className="flex items-center justify-center gap-4 pt-2"
        >
          <button
            data-testid="audit-prev-page"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1 text-sm border rounded
              border-gray-300 dark:border-gray-600
              bg-white dark:bg-gray-800
              text-gray-700 dark:text-gray-300
              hover:bg-gray-100 dark:hover:bg-gray-700
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Page {page} of {totalPages}
          </span>
          <button
            data-testid="audit-next-page"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1 text-sm border rounded
              border-gray-300 dark:border-gray-600
              bg-white dark:bg-gray-800
              text-gray-700 dark:text-gray-300
              hover:bg-gray-100 dark:hover:bg-gray-700
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table row sub-component
// ---------------------------------------------------------------------------

interface TableRowProps {
  entry: AuditLogEntry;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
}

function TableRow({ entry, isExpanded, onToggleExpand }: TableRowProps) {
  return (
    <>
      <tr
        data-testid={`audit-row-${entry.id}`}
        className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        <td className="px-4 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
          {formatTimestamp(entry.timestamp)}
        </td>
        <td className="px-4 py-2">
          <span
            data-testid={`audit-badge-${entry.id}`}
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getBadgeClasses(entry.event_type)}`}
          >
            {formatEventType(entry.event_type)}
          </span>
        </td>
        <td className="px-4 py-2 text-gray-700 dark:text-gray-300 font-mono text-xs">
          {entry.guideline_id ?? '-'}
        </td>
        <td className="px-4 py-2 text-center">
          <button
            data-testid={`audit-expand-${entry.id}`}
            onClick={() => onToggleExpand(entry.id)}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
          >
            {isExpanded ? '\u25BE' : '\u25B8'}
          </button>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td
            colSpan={4}
            data-testid={`audit-detail-${entry.id}`}
            className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700"
          >
            {renderDetail(entry)}
          </td>
        </tr>
      )}
    </>
  );
}

export default AuditLogViewer;
