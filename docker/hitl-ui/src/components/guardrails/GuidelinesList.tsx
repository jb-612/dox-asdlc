/**
 * GuidelinesList - Renders a filterable, sortable, paginated list of guidelines (P11-F01 T21)
 *
 * Uses the Zustand store for filter/sort/pagination state and React Query
 * for data fetching. Renders GuidelineCard components with search, category,
 * enabled filters, sort controls, and pagination.
 */

import { useGuardrailsStore } from '../../stores/guardrailsStore';
import { useGuidelinesList, useToggleGuideline } from '../../api/guardrails';
import { GuidelineCard } from './GuidelineCard';
import type { GuidelineCategory } from '../../api/types/guardrails';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface GuidelinesListProps {
  onCreateNew?: () => void;
}

// ---------------------------------------------------------------------------
// Category dropdown options
// ---------------------------------------------------------------------------

const CATEGORY_OPTIONS: { value: GuidelineCategory | ''; label: string }[] = [
  { value: '', label: 'All Categories' },
  { value: 'cognitive_isolation', label: 'Cognitive Isolation' },
  { value: 'tdd_protocol', label: 'TDD Protocol' },
  { value: 'hitl_gate', label: 'HITL Gate' },
  { value: 'tool_restriction', label: 'Tool Restriction' },
  { value: 'path_restriction', label: 'Path Restriction' },
  { value: 'commit_policy', label: 'Commit Policy' },
  { value: 'custom', label: 'Custom' },
];

// ---------------------------------------------------------------------------
// Sort-by dropdown options
// ---------------------------------------------------------------------------

const SORT_OPTIONS: { value: 'priority' | 'name' | 'updated_at'; label: string }[] = [
  { value: 'priority', label: 'Priority' },
  { value: 'name', label: 'Name' },
  { value: 'updated_at', label: 'Last Updated' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GuidelinesList({ onCreateNew }: GuidelinesListProps) {
  const {
    categoryFilter,
    enabledFilter,
    searchQuery,
    sortBy,
    sortOrder,
    page,
    pageSize,
    selectedGuidelineId,
    setCategoryFilter,
    setEnabledFilter,
    setSearchQuery,
    setSortBy,
    setSortOrder,
    setPage,
    selectGuideline,
  } = useGuardrailsStore();

  const { data, isLoading } = useGuidelinesList({
    category: categoryFilter ?? undefined,
    enabled: enabledFilter ?? undefined,
    page,
    page_size: pageSize,
  });

  const toggleMutation = useToggleGuideline();

  // -------------------------------------------------------------------------
  // Client-side search filter
  // -------------------------------------------------------------------------

  const filteredGuidelines =
    data?.guidelines.filter(
      (g) =>
        !searchQuery ||
        g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.description.toLowerCase().includes(searchQuery.toLowerCase()),
    ) ?? [];

  // -------------------------------------------------------------------------
  // Client-side sort
  // -------------------------------------------------------------------------

  const sortedGuidelines = [...filteredGuidelines].sort((a, b) => {
    const multiplier = sortOrder === 'asc' ? 1 : -1;
    if (sortBy === 'priority') return (a.priority - b.priority) * multiplier;
    if (sortBy === 'name') return a.name.localeCompare(b.name) * multiplier;
    return a.updated_at.localeCompare(b.updated_at) * multiplier;
  });

  // -------------------------------------------------------------------------
  // Pagination
  // -------------------------------------------------------------------------

  const totalPages = Math.ceil((data?.total ?? 0) / pageSize);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setCategoryFilter(value === '' ? null : (value as GuidelineCategory));
  };

  const handleEnabledChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === '') {
      setEnabledFilter(null);
    } else {
      setEnabledFilter(value === 'true');
    }
  };

  const handleSortByChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortBy(e.target.value as 'priority' | 'name' | 'updated_at');
  };

  const handleSortOrderToggle = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  // -------------------------------------------------------------------------
  // Loading skeleton
  // -------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div data-testid="guidelines-loading" className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-9 w-36 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div data-testid="guidelines-list" className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2
          data-testid="guidelines-heading"
          className="text-lg font-semibold text-gray-900 dark:text-gray-100"
        >
          Guardrails
        </h2>
        <button
          data-testid="guidelines-new-btn"
          onClick={() => onCreateNew?.()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium
            text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
        >
          <span aria-hidden="true">+</span> New Guideline
        </button>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        {/* Search input */}
        <input
          data-testid="guidelines-search"
          type="text"
          placeholder="Search guidelines..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 text-sm border rounded-md
            border-gray-300 dark:border-gray-600
            bg-white dark:bg-gray-800
            text-gray-900 dark:text-gray-100
            placeholder-gray-400 dark:placeholder-gray-500
            focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {/* Category + Enabled row */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
            Category:
            <select
              data-testid="guidelines-category-filter"
              value={categoryFilter ?? ''}
              onChange={handleCategoryChange}
              className="px-2 py-1 text-sm border rounded
                border-gray-300 dark:border-gray-600
                bg-white dark:bg-gray-800
                text-gray-900 dark:text-gray-100"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
            Enabled:
            <select
              data-testid="guidelines-enabled-filter"
              value={enabledFilter === null ? '' : String(enabledFilter)}
              onChange={handleEnabledChange}
              className="px-2 py-1 text-sm border rounded
                border-gray-300 dark:border-gray-600
                bg-white dark:bg-gray-800
                text-gray-900 dark:text-gray-100"
            >
              <option value="">All</option>
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </label>
        </div>

        {/* Sort row */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
            Sort:
            <select
              data-testid="guidelines-sort-by"
              value={sortBy}
              onChange={handleSortByChange}
              className="px-2 py-1 text-sm border rounded
                border-gray-300 dark:border-gray-600
                bg-white dark:bg-gray-800
                text-gray-900 dark:text-gray-100"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <button
            data-testid="guidelines-sort-order"
            onClick={handleSortOrderToggle}
            className="px-2 py-1 text-sm border rounded
              border-gray-300 dark:border-gray-600
              bg-white dark:bg-gray-800
              text-gray-700 dark:text-gray-300
              hover:bg-gray-100 dark:hover:bg-gray-700
              transition-colors"
            aria-label={sortOrder === 'asc' ? 'Sort descending' : 'Sort ascending'}
          >
            {sortOrder === 'asc' ? '\u2191' : '\u2193'}
          </button>
        </div>
      </div>

      {/* Guidelines list or empty state */}
      {sortedGuidelines.length === 0 ? (
        <div
          data-testid="guidelines-empty"
          className="py-12 text-center text-gray-500 dark:text-gray-400"
        >
          <p className="text-sm">No guidelines found matching your filters.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedGuidelines.map((guideline) => (
            <GuidelineCard
              key={guideline.id}
              guideline={guideline}
              isSelected={guideline.id === selectedGuidelineId}
              onSelect={(id) => selectGuideline(id)}
              onToggle={(id) => toggleMutation.mutate(id)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          data-testid="guidelines-pagination"
          className="flex items-center justify-center gap-4 pt-2"
        >
          <button
            data-testid="guidelines-prev-page"
            onClick={() => setPage(page - 1)}
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
            data-testid="guidelines-next-page"
            onClick={() => setPage(page + 1)}
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

export default GuidelinesList;
