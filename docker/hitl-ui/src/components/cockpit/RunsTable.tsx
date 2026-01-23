/**
 * RunsTable - Sortable, filterable table of agent runs
 *
 * Displays runs with sorting, filtering by cluster/status/search,
 * and pagination.
 */

import { useState, useMemo, useCallback } from 'react';
import {
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

/** Run status */
export type RunStatus = 'pending' | 'running' | 'completed' | 'failed';

/** Run definition */
export interface Run {
  /** Unique identifier */
  id: string;
  /** Display run ID */
  runId: string;
  /** Cluster name */
  cluster: string;
  /** Agent name */
  agent: string;
  /** Current status */
  status: RunStatus;
  /** Model used */
  model: string;
  /** Duration in seconds */
  duration?: number;
  /** Start timestamp */
  startedAt: string;
  /** Completion timestamp */
  completedAt?: string;
  /** Epic ID */
  epicId: string;
  /** Repository ID */
  repoId: string;
  /** Environment */
  environment: string;
  /** Error message if failed */
  error?: string;
}

export interface RunsTableProps {
  /** Runs to display */
  runs: Run[];
  /** Loading state */
  isLoading?: boolean;
  /** Page size */
  pageSize?: number;
  /** Show filter dropdowns */
  showFilters?: boolean;
  /** Custom class name */
  className?: string;
  /** Callback when row is clicked */
  onRowClick?: (runId: string) => void;
}

// Status colors
const statusColors: Record<RunStatus, string> = {
  completed: 'bg-status-success',
  running: 'bg-accent-teal',
  pending: 'bg-status-warning',
  failed: 'bg-status-error',
};

// Sortable columns
type SortField = 'runId' | 'cluster' | 'agent' | 'status' | 'model' | 'duration' | 'startedAt';
type SortDirection = 'asc' | 'desc';

// Format duration
function formatDuration(seconds?: number): string {
  if (seconds === undefined || seconds === null) return '--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

export default function RunsTable({
  runs,
  isLoading = false,
  pageSize = 50,
  showFilters = false,
  className,
  onRowClick,
}: RunsTableProps) {
  const [sort, setSort] = useState<{ field: SortField; direction: SortDirection }>({
    field: 'startedAt',
    direction: 'desc',
  });
  const sortField = sort.field;
  const sortDirection = sort.direction;
  const [searchQuery, setSearchQuery] = useState('');
  const [clusterFilter, setClusterFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);

  // Get unique clusters for filter dropdown
  const clusters = useMemo(() => {
    return Array.from(new Set(runs.map((r) => r.cluster))).sort();
  }, [runs]);

  // Filter runs
  const filteredRuns = useMemo(() => {
    let result = runs;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.runId.toLowerCase().includes(query) ||
          r.epicId.toLowerCase().includes(query) ||
          r.agent.toLowerCase().includes(query)
      );
    }

    // Cluster filter
    if (clusterFilter) {
      result = result.filter((r) => r.cluster === clusterFilter);
    }

    // Status filter
    if (statusFilter) {
      result = result.filter((r) => r.status === statusFilter);
    }

    return result;
  }, [runs, searchQuery, clusterFilter, statusFilter]);

  // Sort runs
  const sortedRuns = useMemo(() => {
    const sorted = [...filteredRuns].sort((a, b) => {
      let aVal: string | number = a[sortField] ?? '';
      let bVal: string | number = b[sortField] ?? '';

      // Handle numeric fields
      if (sortField === 'duration') {
        aVal = a.duration ?? 0;
        bVal = b.duration ?? 0;
      }

      // Compare
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [filteredRuns, sortField, sortDirection]);

  // Paginate runs
  const paginatedRuns = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRuns.slice(start, start + pageSize);
  }, [sortedRuns, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedRuns.length / pageSize);

  // Handle sort - single state update to avoid nested setState issues
  const handleSort = useCallback((field: SortField) => {
    setSort((prev) => {
      if (field === prev.field) {
        // Same field: toggle direction
        return { ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      // New field: set to ascending
      return { field, direction: 'asc' };
    });
    setCurrentPage(1);
  }, []);

  // Handle row click
  const handleRowClick = useCallback(
    (runId: string) => {
      onRowClick?.(runId);
    },
    [onRowClick]
  );

  // Reset to first page on filter change
  const handleFilterChange = useCallback((setter: (v: string) => void, value: string) => {
    setter(value);
    setCurrentPage(1);
  }, []);

  // Column header component
  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider cursor-pointer hover:text-text-primary"
      onClick={() => handleSort(field)}
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleSort(field)}
      data-testid={`sort-${field}`}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortField === field && (
          <span data-testid="sort-indicator">
            {sortDirection === 'asc' ? (
              <ChevronUpIcon className="h-4 w-4" />
            ) : (
              <ChevronDownIcon className="h-4 w-4" />
            )}
          </span>
        )}
      </div>
    </th>
  );

  // Loading state
  if (isLoading) {
    return (
      <div className={clsx('rounded-lg border border-border-primary bg-bg-secondary', className)} data-testid="runs-table-loading">
        <div className="p-4">
          <div className="h-8 w-64 bg-bg-tertiary rounded animate-pulse mb-4" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} data-testid="row-skeleton">
                  <td className="px-4 py-3">
                    <div className="h-4 bg-bg-tertiary rounded animate-pulse" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 bg-bg-tertiary rounded animate-pulse" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 bg-bg-tertiary rounded animate-pulse" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 bg-bg-tertiary rounded animate-pulse" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx('rounded-lg border border-border-primary bg-bg-secondary', className)}
      data-testid="runs-table"
    >
      {/* Filters */}
      <div className="p-4 border-b border-border-primary">
        <div className="flex flex-wrap gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleFilterChange(setSearchQuery, e.target.value)}
              placeholder="Search by Run ID, Epic, Agent..."
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-border-primary bg-bg-primary text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-teal focus:border-transparent"
              data-testid="filter-input"
            />
          </div>

          {/* Dropdown filters */}
          {showFilters && (
            <>
              <select
                value={clusterFilter}
                onChange={(e) => handleFilterChange(setClusterFilter, e.target.value)}
                className="h-9 px-3 rounded-lg border border-border-primary bg-bg-primary text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-teal"
                data-testid="filter-cluster"
              >
                <option value="">All Clusters</option>
                {clusters.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => handleFilterChange(setStatusFilter, e.target.value)}
                className="h-9 px-3 rounded-lg border border-border-primary bg-bg-primary text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-teal"
                data-testid="filter-status"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="running">Running</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full" role="table">
          <thead className="bg-bg-tertiary" role="rowgroup">
            <tr>
              <SortHeader field="runId" label="Run ID" />
              <SortHeader field="cluster" label="Cluster" />
              <SortHeader field="agent" label="Agent" />
              <SortHeader field="status" label="Status" />
              <SortHeader field="model" label="Model" />
              <SortHeader field="duration" label="Duration" />
              <SortHeader field="startedAt" label="Started" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border-primary">
            {paginatedRuns.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-text-muted">
                  No runs found
                </td>
              </tr>
            ) : (
              paginatedRuns.map((run) => (
                <tr
                  key={run.id}
                  className={clsx(
                    'hover:bg-bg-tertiary transition-colors',
                    onRowClick && 'cursor-pointer'
                  )}
                  onClick={() => handleRowClick(run.id)}
                  data-testid={`row-${run.id}`}
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm text-accent-teal">{run.runId}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-text-secondary">{run.cluster}</td>
                  <td className="px-4 py-3 text-sm text-text-secondary">{run.agent}</td>
                  <td className="px-4 py-3">
                    <span
                      className={clsx(
                        'px-2 py-0.5 rounded-full text-xs text-white capitalize',
                        statusColors[run.status]
                      )}
                      data-testid="status-badge"
                    >
                      {run.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">{run.model}</td>
                  <td className="px-4 py-3 text-sm text-text-secondary font-mono">
                    {formatDuration(run.duration)}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">
                    {new Date(run.startedAt).toLocaleTimeString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-border-primary flex items-center justify-between" data-testid="pagination">
          <div className="text-sm text-text-muted" data-testid="page-info">
            Page {currentPage} of {totalPages} ({sortedRuns.length} runs)
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={clsx(
                'p-2 rounded-lg transition-colors',
                currentPage === 1
                  ? 'text-text-muted cursor-not-allowed'
                  : 'text-text-secondary hover:bg-bg-tertiary'
              )}
              data-testid="prev-page"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={clsx(
                'p-2 rounded-lg transition-colors',
                currentPage === totalPages
                  ? 'text-text-muted cursor-not-allowed'
                  : 'text-text-secondary hover:bg-bg-tertiary'
              )}
              data-testid="next-page"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
