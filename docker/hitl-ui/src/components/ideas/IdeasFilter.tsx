/**
 * IdeasFilter - Filter component for ideas list (P08-F03 T18)
 *
 * Features:
 * - Classification dropdown filter with counts
 * - Status dropdown filter
 * - Search input
 * - Clear filters button
 * - Loading state support
 */

import { useCallback } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import type { IdeaFilters, IdeaClassification, IdeaStatus } from '../../types/ideas';

/**
 * Classification counts interface for displaying counts per classification
 */
export interface ClassificationCounts {
  functional: number;
  non_functional: number;
  undetermined: number;
  total: number;
}

/**
 * Props for the IdeasFilter component
 */
export interface IdeasFilterProps {
  /** Current filter values */
  filters: IdeaFilters;
  /** Callback when filters change */
  onFiltersChange: (filters: Partial<IdeaFilters>) => void;
  /** Callback when clear button clicked */
  onClearFilters: () => void;
  /** Optional classification counts for display */
  classificationCounts?: ClassificationCounts;
  /** Whether filters are loading/disabled */
  isLoading?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Classification options with labels
 */
const CLASSIFICATION_OPTIONS: { value: IdeaClassification | ''; label: string }[] = [
  { value: '', label: 'All Types' },
  { value: 'functional', label: 'Functional' },
  { value: 'non_functional', label: 'Non-Functional' },
  { value: 'undetermined', label: 'Undetermined' },
];

/**
 * Status options with labels
 */
const STATUS_OPTIONS: { value: IdeaStatus | ''; label: string }[] = [
  { value: '', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];

/**
 * IdeasFilter component
 */
export function IdeasFilter({
  filters,
  onFiltersChange,
  onClearFilters,
  classificationCounts,
  isLoading = false,
  className,
}: IdeasFilterProps) {
  // Check if any filters are active
  const hasActiveFilters = !!(filters.status || filters.classification || filters.search);

  /**
   * Handle search input change
   */
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      onFiltersChange({ search: value || undefined });
    },
    [onFiltersChange]
  );

  /**
   * Handle status filter change
   */
  const handleStatusChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value as IdeaStatus | '';
      onFiltersChange({ status: value || undefined });
    },
    [onFiltersChange]
  );

  /**
   * Handle classification filter change
   */
  const handleClassificationChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value as IdeaClassification | '';
      onFiltersChange({ classification: value || undefined });
    },
    [onFiltersChange]
  );

  /**
   * Get label with count for classification option
   */
  const getClassificationLabel = (option: (typeof CLASSIFICATION_OPTIONS)[0]): string => {
    if (!classificationCounts) {
      return option.label;
    }

    if (option.value === '') {
      return `${option.label} (${classificationCounts.total})`;
    }

    const count = classificationCounts[option.value as IdeaClassification];
    return `${option.label} (${count})`;
  };

  return (
    <div className={clsx('space-y-3', className)} data-testid="ideas-filter">
      {/* Search Input */}
      <div className="relative">
        <MagnifyingGlassIcon
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted"
          data-testid="search-icon"
        />
        <input
          type="text"
          placeholder="Search ideas..."
          value={filters.search || ''}
          onChange={handleSearchChange}
          disabled={isLoading}
          tabIndex={0}
          className={clsx(
            'w-full pl-9 pr-3 py-2 text-sm rounded-lg',
            'border border-border-primary bg-bg-primary text-text-primary',
            'placeholder:text-text-muted',
            'focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          aria-label="Search ideas"
        />
      </div>

      {/* Filters Row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Status Filter */}
        <select
          value={filters.status || ''}
          onChange={handleStatusChange}
          disabled={isLoading}
          className={clsx(
            'text-sm border border-border-primary rounded-lg px-2 py-1.5',
            'bg-bg-primary text-text-primary',
            'focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {/* Classification Filter */}
        <select
          value={filters.classification || ''}
          onChange={handleClassificationChange}
          disabled={isLoading}
          className={clsx(
            'text-sm border border-border-primary rounded-lg px-2 py-1.5',
            'bg-bg-primary text-text-primary',
            'focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          aria-label="Filter by classification"
        >
          {CLASSIFICATION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {getClassificationLabel(option)}
            </option>
          ))}
        </select>

        {/* Loading Indicator */}
        {isLoading && (
          <div
            className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"
            data-testid="loading-indicator"
            aria-label="Loading"
          />
        )}

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            disabled={isLoading}
            className={clsx(
              'text-sm text-text-muted hover:text-text-primary flex items-center gap-1',
              'transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            aria-label="Clear filters"
            data-testid="clear-filters-button"
          >
            <XMarkIcon className="h-4 w-4" />
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

export default IdeasFilter;
