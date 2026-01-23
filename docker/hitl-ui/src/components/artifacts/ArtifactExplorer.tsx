/**
 * ArtifactExplorer - Sortable table for browsing artifacts with filters and search
 */

import { useState, useCallback, useMemo } from 'react';
import {
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FunnelIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

/** Artifact status */
export type ArtifactStatus = 'draft' | 'pending_review' | 'approved' | 'rejected';

/** Artifact */
export interface Artifact {
  /** Artifact ID */
  id: string;
  /** Artifact name */
  name: string;
  /** Artifact type */
  type: string;
  /** Epic ID */
  epic: string;
  /** Status */
  status: ArtifactStatus;
  /** Created timestamp */
  createdAt: string;
  /** Approved timestamp */
  approvedAt?: string;
  /** Git SHA */
  sha: string;
  /** Agent that created the artifact */
  agent: string;
  /** Gate for approval */
  gate?: string;
}

export interface ArtifactExplorerProps {
  /** Artifacts to display */
  artifacts: Artifact[];
  /** Loading state */
  isLoading?: boolean;
  /** Items per page */
  pageSize?: number;
  /** Custom class name */
  className?: string;
  /** Callback when artifact row is clicked */
  onArtifactClick?: (artifactId: string) => void;
}

/** Column definition */
type ColumnKey = 'name' | 'type' | 'epic' | 'status' | 'createdAt' | 'approvedAt' | 'sha';

/** Sort direction */
type SortDirection = 'asc' | 'desc';

// Status badge styles
const statusStyles: Record<ArtifactStatus, string> = {
  draft: 'text-text-muted bg-bg-tertiary',
  pending_review: 'text-status-warning bg-status-warning/10',
  approved: 'text-status-success bg-status-success/10',
  rejected: 'text-status-error bg-status-error/10',
};

// Status labels
const statusLabels: Record<ArtifactStatus, string> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
};

// Format date
function formatDate(dateStr?: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

// Get unique values from array
function getUniqueValues<T>(items: T[], key: keyof T): string[] {
  const values = new Set<string>();
  for (const item of items) {
    const value = item[key];
    if (value !== undefined && value !== null) {
      values.add(String(value));
    }
  }
  return Array.from(values).sort();
}

export default function ArtifactExplorer({
  artifacts,
  isLoading = false,
  pageSize = 50,
  className,
  onArtifactClick,
}: ArtifactExplorerProps) {
  // State
  const [sortColumn, setSortColumn] = useState<ColumnKey>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | null>>({
    epic: null,
    type: null,
    status: null,
    agent: null,
    gate: null,
  });
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Get unique filter values
  const filterOptions = useMemo(
    () => ({
      epic: getUniqueValues(artifacts, 'epic'),
      type: getUniqueValues(artifacts, 'type'),
      status: ['draft', 'pending_review', 'approved', 'rejected'],
      agent: getUniqueValues(artifacts, 'agent'),
      gate: getUniqueValues(artifacts, 'gate'),
    }),
    [artifacts]
  );

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    return Object.values(filters).filter((v) => v !== null).length;
  }, [filters]);

  // Filter artifacts
  const filteredArtifacts = useMemo(() => {
    return artifacts.filter((artifact) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!artifact.name.toLowerCase().includes(query)) {
          return false;
        }
      }

      // Apply filters
      if (filters.epic && artifact.epic !== filters.epic) return false;
      if (filters.type && artifact.type !== filters.type) return false;
      if (filters.status && artifact.status !== filters.status) return false;
      if (filters.agent && artifact.agent !== filters.agent) return false;
      if (filters.gate && artifact.gate !== filters.gate) return false;

      return true;
    });
  }, [artifacts, searchQuery, filters]);

  // Sort artifacts
  const sortedArtifacts = useMemo(() => {
    const sorted = [...filteredArtifacts];
    sorted.sort((a, b) => {
      let aVal: string | undefined = '';
      let bVal: string | undefined = '';

      switch (sortColumn) {
        case 'name':
          aVal = a.name;
          bVal = b.name;
          break;
        case 'type':
          aVal = a.type;
          bVal = b.type;
          break;
        case 'epic':
          aVal = a.epic;
          bVal = b.epic;
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
        case 'createdAt':
          aVal = a.createdAt;
          bVal = b.createdAt;
          break;
        case 'approvedAt':
          aVal = a.approvedAt || '';
          bVal = b.approvedAt || '';
          break;
        case 'sha':
          aVal = a.sha;
          bVal = b.sha;
          break;
      }

      const comparison = (aVal || '').localeCompare(bVal || '');
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [filteredArtifacts, sortColumn, sortDirection]);

  // Paginate
  const paginatedArtifacts = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return sortedArtifacts.slice(start, end);
  }, [sortedArtifacts, page, pageSize]);

  // Calculate pagination info
  const totalPages = Math.ceil(sortedArtifacts.length / pageSize);
  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, sortedArtifacts.length);

  // Handle sort
  const handleSort = useCallback(
    (column: ColumnKey) => {
      if (sortColumn === column) {
        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortColumn(column);
        setSortDirection('asc');
      }
    },
    [sortColumn]
  );

  // Handle filter change
  const handleFilterChange = useCallback((filterKey: string, value: string | null) => {
    setFilters((prev) => ({ ...prev, [filterKey]: value }));
    setOpenFilter(null);
    setPage(1);
  }, []);

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setFilters({
      epic: null,
      type: null,
      status: null,
      agent: null,
      gate: null,
    });
    setSearchQuery('');
    setPage(1);
  }, []);

  // Handle row click
  const handleRowClick = useCallback(
    (artifactId: string) => {
      onArtifactClick?.(artifactId);
    },
    [onArtifactClick]
  );

  // Handle row key down
  const handleRowKeyDown = useCallback(
    (e: React.KeyboardEvent, artifactId: string) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onArtifactClick?.(artifactId);
      }
    },
    [onArtifactClick]
  );

  // Render sort indicator
  const renderSortIndicator = (column: ColumnKey) => {
    if (sortColumn !== column) return null;
    return (
      <span data-testid={`sort-indicator-${column}`} className="ml-1 inline-flex">
        {sortDirection === 'asc' ? (
          <ChevronUpIcon className="h-3 w-3" />
        ) : (
          <ChevronDownIcon className="h-3 w-3" />
        )}
      </span>
    );
  };

  // Render filter dropdown
  const renderFilter = (filterKey: string, options: string[]) => {
    const isOpen = openFilter === filterKey;
    const selectedValue = filters[filterKey];

    return (
      <div className="relative">
        <button
          onClick={() => setOpenFilter(isOpen ? null : filterKey)}
          className={clsx(
            'flex items-center gap-1 px-2 py-1 rounded text-xs',
            'border border-border-primary hover:border-accent-blue',
            selectedValue ? 'bg-accent-blue/10 text-accent-blue' : 'text-text-muted'
          )}
          data-testid={`filter-${filterKey}`}
        >
          <FunnelIcon className="h-3 w-3" />
          <span className="capitalize">{filterKey}</span>
          {selectedValue && (
            <span className="ml-1 px-1 bg-accent-blue text-white rounded text-xs">1</span>
          )}
        </button>

        {isOpen && (
          <div className="absolute z-10 mt-1 py-1 rounded-lg border border-border-primary bg-bg-secondary shadow-lg min-w-32 max-h-60 overflow-y-auto">
            <button
              onClick={() => handleFilterChange(filterKey, null)}
              className={clsx(
                'w-full px-3 py-1 text-left text-sm hover:bg-bg-tertiary',
                !selectedValue && 'font-medium text-accent-blue'
              )}
              data-testid={`filter-option-all`}
            >
              All
            </button>
            {options.map((option) => (
              <button
                key={option}
                onClick={() => handleFilterChange(filterKey, option)}
                className={clsx(
                  'w-full px-3 py-1 text-left text-sm hover:bg-bg-tertiary',
                  selectedValue === option && 'font-medium text-accent-blue'
                )}
                data-testid={`filter-option-${option}`}
              >
                {option}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={clsx('p-4', className)} data-testid="artifact-explorer-loading">
        <div className="h-10 w-full bg-bg-tertiary rounded animate-pulse mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="h-12 bg-bg-tertiary rounded animate-pulse"
              data-testid="skeleton-row"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('flex flex-col h-full', className)} data-testid="artifact-explorer">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 p-4 border-b border-border-primary">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search by filename..."
            aria-label="Search artifacts"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-border-primary bg-bg-secondary text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue"
            data-testid="search-input"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          {renderFilter('epic', filterOptions.epic)}
          {renderFilter('type', filterOptions.type)}
          {renderFilter('status', filterOptions.status)}
          {renderFilter('agent', filterOptions.agent)}
          {renderFilter('gate', filterOptions.gate)}

          {activeFiltersCount > 0 && (
            <>
              <span
                className="px-2 py-0.5 rounded-full bg-accent-blue text-white text-xs"
                data-testid="active-filters-count"
              >
                {activeFiltersCount}
              </span>
              <button
                onClick={handleClearFilters}
                className="p-1 rounded hover:bg-bg-tertiary text-text-muted"
                data-testid="clear-filters"
                aria-label="Clear filters"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        {/* Count */}
        <span className="text-sm text-text-muted">
          <span data-testid="artifact-count">{sortedArtifacts.length}</span> artifacts
        </span>
      </div>

      {/* Empty state */}
      {artifacts.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-text-muted">
          No artifacts found
        </div>
      ) : sortedArtifacts.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-text-muted">
          No artifacts found matching your criteria
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full" role="table">
              <thead className="sticky top-0 bg-bg-secondary border-b border-border-primary">
                <tr>
                  <th
                    onClick={() => handleSort('name')}
                    className="px-4 py-3 text-left text-sm font-medium text-text-muted cursor-pointer hover:text-text-primary"
                  >
                    Name {renderSortIndicator('name')}
                  </th>
                  <th
                    onClick={() => handleSort('type')}
                    className="px-4 py-3 text-left text-sm font-medium text-text-muted cursor-pointer hover:text-text-primary"
                  >
                    Type {renderSortIndicator('type')}
                  </th>
                  <th
                    onClick={() => handleSort('epic')}
                    className="px-4 py-3 text-left text-sm font-medium text-text-muted cursor-pointer hover:text-text-primary"
                  >
                    Epic {renderSortIndicator('epic')}
                  </th>
                  <th
                    onClick={() => handleSort('status')}
                    className="px-4 py-3 text-left text-sm font-medium text-text-muted cursor-pointer hover:text-text-primary"
                  >
                    Status {renderSortIndicator('status')}
                  </th>
                  <th
                    onClick={() => handleSort('createdAt')}
                    className="px-4 py-3 text-left text-sm font-medium text-text-muted cursor-pointer hover:text-text-primary"
                  >
                    Created {renderSortIndicator('createdAt')}
                  </th>
                  <th
                    onClick={() => handleSort('approvedAt')}
                    className="px-4 py-3 text-left text-sm font-medium text-text-muted cursor-pointer hover:text-text-primary"
                  >
                    Approved {renderSortIndicator('approvedAt')}
                  </th>
                  <th
                    onClick={() => handleSort('sha')}
                    className="px-4 py-3 text-left text-sm font-medium text-text-muted cursor-pointer hover:text-text-primary"
                  >
                    SHA {renderSortIndicator('sha')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedArtifacts.map((artifact) => (
                  <tr
                    key={artifact.id}
                    onClick={() => handleRowClick(artifact.id)}
                    onKeyDown={(e) => handleRowKeyDown(e, artifact.id)}
                    tabIndex={0}
                    className="border-b border-border-secondary hover:bg-bg-tertiary cursor-pointer transition-colors"
                    data-testid={`row-${artifact.id}`}
                  >
                    <td className="px-4 py-3 text-sm text-text-primary font-medium">
                      {artifact.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">{artifact.type}</td>
                    <td className="px-4 py-3 text-sm text-text-secondary">{artifact.epic}</td>
                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          'inline-flex px-2 py-0.5 rounded text-xs font-medium',
                          statusStyles[artifact.status]
                        )}
                        data-testid="status-badge"
                      >
                        {statusLabels[artifact.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      {formatDate(artifact.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      {formatDate(artifact.approvedAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-muted font-mono">{artifact.sha}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div
            className="flex items-center justify-between p-4 border-t border-border-primary"
            data-testid="pagination"
          >
            <span className="text-sm text-text-muted" data-testid="page-info">
              {startItem}-{endItem} of {sortedArtifacts.length}
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 1}
                className={clsx(
                  'p-1 rounded hover:bg-bg-tertiary',
                  page === 1 ? 'text-text-muted cursor-not-allowed' : 'text-text-secondary'
                )}
                data-testid="prev-page"
                aria-label="Previous page"
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
              <span className="text-sm text-text-secondary">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
                className={clsx(
                  'p-1 rounded hover:bg-bg-tertiary',
                  page >= totalPages ? 'text-text-muted cursor-not-allowed' : 'text-text-secondary'
                )}
                data-testid="next-page"
                aria-label="Next page"
              >
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
