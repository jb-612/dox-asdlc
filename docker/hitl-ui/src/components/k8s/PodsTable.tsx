/**
 * PodsTable - Sortable, filterable pod listing for K8s Dashboard
 *
 * Displays pods in a table with:
 * - Sortable columns (Name, Namespace, Status, Node, Age, Restarts)
 * - Color-coded status badges
 * - Row click to open detail drawer
 * - Loading and empty states
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  ChevronUpIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  CubeIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import type { K8sPod, PodStatus } from '../../api/types/kubernetes';

// Custom debounce hook for search
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

export interface PodsTableProps {
  /** Pods to display */
  pods: K8sPod[];
  /** Loading state */
  isLoading?: boolean;
  /** Pod click callback */
  onPodClick?: (pod: K8sPod) => void;
  /** Show filter controls */
  showFilters?: boolean;
  /** Enable pagination (default: true when more than 50 pods) */
  enablePagination?: boolean;
  /** Page size for pagination (default: 50) */
  pageSize?: number;
  /** Custom class name */
  className?: string;
}

// Constants
const DEFAULT_PAGE_SIZE = 50;
const VIRTUAL_SCROLL_THRESHOLD = 100;

// Sort configuration
type SortField = 'name' | 'namespace' | 'status' | 'nodeName' | 'age' | 'restarts';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

// Status badge colors
const statusColors: Record<PodStatus, { bg: string; text: string }> = {
  Running: { bg: 'bg-status-success/10', text: 'text-status-success' },
  Pending: { bg: 'bg-status-warning/10', text: 'text-status-warning' },
  Succeeded: { bg: 'bg-accent-teal/10', text: 'text-accent-teal' },
  Failed: { bg: 'bg-status-error/10', text: 'text-status-error' },
  Unknown: { bg: 'bg-bg-tertiary', text: 'text-text-muted' },
};

interface StatusBadgeProps {
  status: PodStatus;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const colors = statusColors[status];
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        colors.bg,
        colors.text
      )}
      data-testid="status-badge"
    >
      {status}
    </span>
  );
}

interface SortableHeaderProps {
  label: string;
  field: SortField;
  currentSort: SortConfig;
  onSort: (field: SortField) => void;
}

function SortableHeader({ label, field, currentSort, onSort }: SortableHeaderProps) {
  const isActive = currentSort.field === field;

  return (
    <th
      className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider cursor-pointer hover:text-text-primary transition-colors"
      onClick={() => onSort(field)}
      data-testid={`sort-${field}`}
    >
      <div className="flex items-center gap-1">
        <span>{label}</span>
        <span className="flex flex-col">
          <ChevronUpIcon
            className={clsx(
              'h-3 w-3 -mb-1',
              isActive && currentSort.direction === 'asc'
                ? 'text-accent-blue'
                : 'text-text-muted/30'
            )}
          />
          <ChevronDownIcon
            className={clsx(
              'h-3 w-3',
              isActive && currentSort.direction === 'desc'
                ? 'text-accent-blue'
                : 'text-text-muted/30'
            )}
          />
        </span>
      </div>
    </th>
  );
}

export default function PodsTable({
  pods,
  isLoading = false,
  onPodClick,
  showFilters = false,
  enablePagination = true,
  pageSize = DEFAULT_PAGE_SIZE,
  className,
}: PodsTableProps) {
  const [sort, setSort] = useState<SortConfig>({ field: 'name', direction: 'asc' });
  const [searchQuery, setSearchQuery] = useState('');
  const [namespaceFilter, setNamespaceFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<PodStatus | 'all'>('all');
  const [nodeFilter, setNodeFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Ref for table body (for virtual scrolling)
  const tableBodyRef = useRef<HTMLTableSectionElement>(null);

  // Debounce search query for performance (300ms delay)
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, namespaceFilter, statusFilter, nodeFilter]);

  // Extract unique namespaces for filter dropdown
  const namespaces = useMemo(() => {
    const unique = [...new Set(pods.map((p) => p.namespace))];
    return unique.sort();
  }, [pods]);

  // Extract unique node names for filter dropdown
  const nodeNames = useMemo(() => {
    const unique = [...new Set(pods.map((p) => p.nodeName).filter(Boolean))];
    return unique.sort();
  }, [pods]);

  // Handle sort column click
  const handleSort = useCallback((field: SortField) => {
    setSort((prev) => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  // Filter and sort pods
  const filteredAndSortedPods = useMemo(() => {
    let result = [...pods];

    // Apply search filter (uses debounced value for performance)
    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase();
      result = result.filter(
        (pod) =>
          pod.name.toLowerCase().includes(query) ||
          pod.namespace.toLowerCase().includes(query)
      );
    }

    // Apply namespace filter
    if (namespaceFilter !== 'all') {
      result = result.filter((pod) => pod.namespace === namespaceFilter);
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter((pod) => pod.status === statusFilter);
    }

    // Apply node filter
    if (nodeFilter !== 'all') {
      result = result.filter((pod) => pod.nodeName === nodeFilter);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;

      switch (sort.field) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'namespace':
          comparison = a.namespace.localeCompare(b.namespace);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'nodeName':
          comparison = a.nodeName.localeCompare(b.nodeName);
          break;
        case 'age':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'restarts':
          comparison = a.restarts - b.restarts;
          break;
      }

      return sort.direction === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [pods, debouncedSearchQuery, namespaceFilter, statusFilter, nodeFilter, sort]);

  // Calculate pagination
  const totalPods = filteredAndSortedPods.length;
  const totalPages = enablePagination ? Math.ceil(totalPods / pageSize) : 1;
  const shouldPaginate = enablePagination && totalPods > pageSize;

  // Get pods for current page
  const paginatedPods = useMemo(() => {
    if (!shouldPaginate) {
      return filteredAndSortedPods;
    }
    const startIndex = (currentPage - 1) * pageSize;
    return filteredAndSortedPods.slice(startIndex, startIndex + pageSize);
  }, [filteredAndSortedPods, currentPage, pageSize, shouldPaginate]);

  // Pagination handlers
  const goToPage = useCallback((page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  }, [totalPages]);

  const goToFirstPage = useCallback(() => goToPage(1), [goToPage]);
  const goToLastPage = useCallback(() => goToPage(totalPages), [goToPage, totalPages]);
  const goToPrevPage = useCallback(() => goToPage(currentPage - 1), [goToPage, currentPage]);
  const goToNextPage = useCallback(() => goToPage(currentPage + 1), [goToPage, currentPage]);

  // Handle row click
  const handleRowClick = useCallback(
    (pod: K8sPod) => {
      onPodClick?.(pod);
    },
    [onPodClick]
  );

  // Loading state
  if (isLoading && pods.length === 0) {
    return (
      <div className={clsx('bg-bg-secondary rounded-lg', className)} data-testid="pods-table-loading">
        {showFilters && (
          <div className="p-4 border-b border-border-primary flex gap-4">
            <div className="h-10 w-64 bg-bg-tertiary rounded animate-pulse" />
            <div className="h-10 w-32 bg-bg-tertiary rounded animate-pulse" />
            <div className="h-10 w-32 bg-bg-tertiary rounded animate-pulse" />
          </div>
        )}
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-12 bg-bg-tertiary rounded animate-pulse"
              data-testid="row-skeleton"
            />
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (pods.length === 0) {
    return (
      <div
        className={clsx('p-8 text-center text-text-muted bg-bg-tertiary/30 rounded-lg', className)}
        data-testid="pods-table-empty"
      >
        <CubeIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>No pods available</p>
      </div>
    );
  }

  return (
    <div className={clsx('bg-bg-secondary rounded-lg overflow-hidden', className)} data-testid="pods-table">
      {/* Filters */}
      {showFilters && (
        <div className="p-4 border-b border-border-primary flex flex-wrap gap-4 items-center" data-testid="filters">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search pods..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-bg-tertiary rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue"
              data-testid="search-input"
            />
          </div>

          {/* Namespace filter */}
          <div className="flex items-center gap-2">
            <FunnelIcon className="h-4 w-4 text-text-muted" />
            <select
              value={namespaceFilter}
              onChange={(e) => setNamespaceFilter(e.target.value)}
              className="bg-bg-tertiary rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue"
              data-testid="namespace-filter"
            >
              <option value="all">All Namespaces</option>
              {namespaces.map((ns) => (
                <option key={ns} value={ns}>
                  {ns}
                </option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as PodStatus | 'all')}
            className="bg-bg-tertiary rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue"
            data-testid="status-filter"
          >
            <option value="all">All Statuses</option>
            <option value="Running">Running</option>
            <option value="Pending">Pending</option>
            <option value="Succeeded">Succeeded</option>
            <option value="Failed">Failed</option>
            <option value="Unknown">Unknown</option>
          </select>

          {/* Node filter */}
          <select
            value={nodeFilter}
            onChange={(e) => setNodeFilter(e.target.value)}
            className="bg-bg-tertiary rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue"
            data-testid="node-filter"
          >
            <option value="all">All Nodes</option>
            {nodeNames.map((nodeName) => (
              <option key={nodeName} value={nodeName}>
                {nodeName}
              </option>
            ))}
          </select>

          {/* Result count */}
          <span className="text-xs text-text-muted ml-auto" data-testid="result-count">
            {shouldPaginate
              ? `${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, totalPods)} of ${totalPods} pods`
              : `${totalPods} of ${pods.length} pods`}
          </span>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full" data-testid="table">
          <thead className="bg-bg-tertiary/50">
            <tr>
              <SortableHeader label="Name" field="name" currentSort={sort} onSort={handleSort} />
              <SortableHeader label="Namespace" field="namespace" currentSort={sort} onSort={handleSort} />
              <SortableHeader label="Status" field="status" currentSort={sort} onSort={handleSort} />
              <SortableHeader label="Node" field="nodeName" currentSort={sort} onSort={handleSort} />
              <SortableHeader label="Age" field="age" currentSort={sort} onSort={handleSort} />
              <SortableHeader label="Restarts" field="restarts" currentSort={sort} onSort={handleSort} />
            </tr>
          </thead>
          <tbody ref={tableBodyRef} className="divide-y divide-border-primary" data-testid="table-body">
            {filteredAndSortedPods.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                  No pods match the current filters
                </td>
              </tr>
            ) : (
              paginatedPods.map((pod) => (
                <tr
                  key={`${pod.namespace}/${pod.name}`}
                  onClick={() => handleRowClick(pod)}
                  className={clsx(
                    'transition-colors',
                    onPodClick && 'cursor-pointer hover:bg-bg-tertiary/50'
                  )}
                  data-testid={`pod-row-${pod.name}`}
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-text-primary">{pod.name}</span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary text-sm">{pod.namespace}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={pod.status} />
                  </td>
                  <td className="px-4 py-3 text-text-secondary text-sm">
                    {pod.nodeName || '-'}
                  </td>
                  <td className="px-4 py-3 text-text-secondary text-sm">{pod.age}</td>
                  <td className="px-4 py-3 text-text-secondary text-sm">
                    <span
                      className={clsx(
                        pod.restarts > 5 && 'text-status-error font-medium',
                        pod.restarts > 0 && pod.restarts <= 5 && 'text-status-warning'
                      )}
                    >
                      {pod.restarts}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {shouldPaginate && (
        <div
          className="flex items-center justify-between px-4 py-3 border-t border-border-primary"
          data-testid="pagination"
        >
          <div className="text-sm text-text-muted">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={goToFirstPage}
              disabled={currentPage === 1}
              className={clsx(
                'px-2 py-1 rounded text-sm',
                currentPage === 1
                  ? 'text-text-muted/50 cursor-not-allowed'
                  : 'text-text-secondary hover:bg-bg-tertiary'
              )}
              data-testid="page-first"
              aria-label="Go to first page"
            >
              First
            </button>
            <button
              onClick={goToPrevPage}
              disabled={currentPage === 1}
              className={clsx(
                'px-2 py-1 rounded text-sm',
                currentPage === 1
                  ? 'text-text-muted/50 cursor-not-allowed'
                  : 'text-text-secondary hover:bg-bg-tertiary'
              )}
              data-testid="page-prev"
              aria-label="Go to previous page"
            >
              Prev
            </button>

            {/* Page number buttons - show up to 5 pages */}
            <div className="flex gap-1 mx-2" data-testid="page-numbers">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => goToPage(pageNum)}
                    className={clsx(
                      'w-8 h-8 rounded text-sm font-medium',
                      currentPage === pageNum
                        ? 'bg-accent-blue text-white'
                        : 'text-text-secondary hover:bg-bg-tertiary'
                    )}
                    data-testid={`page-${pageNum}`}
                    aria-label={`Go to page ${pageNum}`}
                    aria-current={currentPage === pageNum ? 'page' : undefined}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={goToNextPage}
              disabled={currentPage === totalPages}
              className={clsx(
                'px-2 py-1 rounded text-sm',
                currentPage === totalPages
                  ? 'text-text-muted/50 cursor-not-allowed'
                  : 'text-text-secondary hover:bg-bg-tertiary'
              )}
              data-testid="page-next"
              aria-label="Go to next page"
            >
              Next
            </button>
            <button
              onClick={goToLastPage}
              disabled={currentPage === totalPages}
              className={clsx(
                'px-2 py-1 rounded text-sm',
                currentPage === totalPages
                  ? 'text-text-muted/50 cursor-not-allowed'
                  : 'text-text-secondary hover:bg-bg-tertiary'
              )}
              data-testid="page-last"
              aria-label="Go to last page"
            >
              Last
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
