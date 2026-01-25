/**
 * SearchFilters - Faceted filter panel for search results
 *
 * Part of P05-F08 KnowledgeStore Search UI
 */

import { useMemo, useCallback } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import type { SearchFilters as SearchFiltersType } from '../../api/types';

export interface SearchFiltersProps {
  /** Current filter values */
  filters: SearchFiltersType;
  /** Filter change callback */
  onChange: (filters: SearchFiltersType) => void;
  /** Available file types to show */
  availableFileTypes?: string[];
  /** Whether the panel is expanded */
  isExpanded?: boolean;
  /** Custom class name */
  className?: string;
}

const DEFAULT_FILE_TYPES = ['.py', '.ts', '.tsx', '.md', '.json'];

export default function SearchFilters({
  filters,
  onChange,
  availableFileTypes = DEFAULT_FILE_TYPES,
  isExpanded = true,
  className,
}: SearchFiltersProps) {
  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.fileTypes?.length) {
      count += filters.fileTypes.length;
    }
    if (filters.dateFrom) {
      count += 1;
    }
    if (filters.dateTo) {
      count += 1;
    }
    return count;
  }, [filters]);

  const hasActiveFilters = activeFilterCount > 0;

  // Handle file type toggle
  const handleFileTypeToggle = useCallback(
    (fileType: string, checked: boolean) => {
      const currentTypes = filters.fileTypes || [];

      let newTypes: string[];
      if (checked) {
        newTypes = [...currentTypes, fileType];
      } else {
        newTypes = currentTypes.filter((t) => t !== fileType);
      }

      onChange({
        ...filters,
        fileTypes: newTypes.length > 0 ? newTypes : undefined,
      });
    },
    [filters, onChange]
  );

  // Handle date change
  const handleDateChange = useCallback(
    (field: 'dateFrom' | 'dateTo', value: string) => {
      onChange({
        ...filters,
        [field]: value || undefined,
      });
    },
    [filters, onChange]
  );

  // Handle clear all filters
  const handleClearAll = useCallback(() => {
    onChange({});
  }, [onChange]);

  return (
    <div className={clsx('rounded-lg border border-border-primary bg-bg-secondary', className)} data-testid="search-filters">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary">Filters</span>
          {hasActiveFilters && (
            <span
              className="px-2 py-0.5 text-xs font-medium rounded-full bg-accent-teal/20 text-accent-teal"
              data-testid="filter-count"
            >
              {activeFilterCount}
            </span>
          )}
        </div>
        {hasActiveFilters && (
          <button
            onClick={handleClearAll}
            className="text-xs text-text-muted hover:text-text-secondary transition-colors flex items-center gap-1"
            aria-label="Clear all filters"
          >
            <XMarkIcon className="h-3 w-3" />
            Clear
          </button>
        )}
      </div>

      {/* Filter content */}
      <div
        className={clsx('p-4 space-y-6', !isExpanded && 'hidden')}
        data-testid="filters-content"
      >
        {/* File Types */}
        <div>
          <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-3">
            File Types
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {availableFileTypes.map((fileType) => {
              const isChecked = filters.fileTypes?.includes(fileType) ?? false;

              return (
                <label
                  key={fileType}
                  className={clsx(
                    'flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors',
                    isChecked
                      ? 'bg-accent-teal/10 border border-accent-teal/50'
                      : 'bg-bg-tertiary border border-transparent hover:border-border-secondary'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => handleFileTypeToggle(fileType, e.target.checked)}
                    className="h-4 w-4 rounded border-border-primary bg-bg-primary text-accent-teal focus:ring-accent-teal focus:ring-offset-0"
                    aria-label={fileType}
                  />
                  <span
                    className={clsx(
                      'text-sm font-mono',
                      isChecked ? 'text-accent-teal' : 'text-text-secondary'
                    )}
                  >
                    {fileType}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Date Range */}
        <div>
          <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-3">
            Date Range
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="date-from"
                className="block text-xs text-text-muted mb-1"
              >
                From
              </label>
              <input
                id="date-from"
                type="date"
                value={filters.dateFrom ?? ''}
                onChange={(e) => handleDateChange('dateFrom', e.target.value)}
                className={clsx(
                  'w-full px-3 py-2 rounded-lg border border-border-primary bg-bg-primary',
                  'text-sm text-text-primary',
                  'focus:outline-none focus:ring-2 focus:ring-accent-teal focus:border-transparent'
                )}
              />
            </div>
            <div>
              <label
                htmlFor="date-to"
                className="block text-xs text-text-muted mb-1"
              >
                To
              </label>
              <input
                id="date-to"
                type="date"
                value={filters.dateTo ?? ''}
                onChange={(e) => handleDateChange('dateTo', e.target.value)}
                className={clsx(
                  'w-full px-3 py-2 rounded-lg border border-border-primary bg-bg-primary',
                  'text-sm text-text-primary',
                  'focus:outline-none focus:ring-2 focus:ring-accent-teal focus:border-transparent'
                )}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
