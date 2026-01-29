/**
 * RequirementsList - Scrollable list of requirements with filter/sort (P05-F11 T11)
 *
 * Features:
 * - Filter dropdown by category or type
 * - Sort dropdown (by priority, by date)
 * - Count indicator showing total requirements
 * - Empty state when no requirements extracted
 */

import { useState, useMemo, useCallback } from 'react';
import { FunnelIcon, ArrowsUpDownIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import RequirementCard from './RequirementCard';
import type { Requirement, RequirementType, RequirementPriority } from '../../../types/ideation';

export interface RequirementsListProps {
  /** List of requirements to display */
  requirements: Requirement[];
  /** Callback when a requirement is updated */
  onUpdate?: (id: string, updates: Partial<Requirement>) => void;
  /** Callback when a requirement is deleted */
  onDelete?: (id: string) => void;
  /** Read-only mode */
  readOnly?: boolean;
  /** Maximum height of the scrollable container */
  maxHeight?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Custom empty message */
  emptyMessage?: string;
  /** Custom class name */
  className?: string;
}

// Filter options for requirement type
type TypeFilter = 'all' | RequirementType;
const TYPE_FILTER_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'functional', label: 'Functional' },
  { value: 'non_functional', label: 'Non-Functional' },
  { value: 'constraint', label: 'Constraint' },
];

// Filter options for category
type CategoryFilter = 'all' | string;
const CATEGORY_FILTER_OPTIONS: { value: CategoryFilter; label: string }[] = [
  { value: 'all', label: 'All Categories' },
  { value: 'problem', label: 'Problem Statement' },
  { value: 'users', label: 'Target Users' },
  { value: 'functional', label: 'Functional Requirements' },
  { value: 'nfr', label: 'Non-Functional Requirements' },
  { value: 'scope', label: 'Scope & Constraints' },
  { value: 'success', label: 'Success Criteria' },
  { value: 'risks', label: 'Risks & Assumptions' },
];

// Sort options
type SortOption = 'newest' | 'oldest' | 'priority_high' | 'priority_low';
const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'priority_high', label: 'Priority (High to Low)' },
  { value: 'priority_low', label: 'Priority (Low to High)' },
];

// Priority sort order
const PRIORITY_ORDER: Record<RequirementPriority, number> = {
  must_have: 3,
  should_have: 2,
  could_have: 1,
};

export default function RequirementsList({
  requirements,
  onUpdate,
  onDelete,
  readOnly = false,
  maxHeight = '500px',
  isLoading = false,
  emptyMessage = 'No requirements extracted yet. Continue the conversation to identify requirements.',
  className,
}: RequirementsListProps) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  // Consolidated dropdown state - only one dropdown can be open at a time
  const [openDropdown, setOpenDropdown] = useState<'type' | 'category' | 'sort' | null>(null);

  // Filter and sort requirements
  const filteredAndSortedRequirements = useMemo(() => {
    let result = [...requirements];

    // Apply type filter
    if (typeFilter !== 'all') {
      result = result.filter((r) => r.type === typeFilter);
    }

    // Apply category filter
    if (categoryFilter !== 'all') {
      result = result.filter((r) => r.categoryId === categoryFilter);
    }

    // Apply sort
    result.sort((a, b) => {
      switch (sortOption) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'priority_high':
          return PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority];
        case 'priority_low':
          return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        default:
          return 0;
      }
    });

    return result;
  }, [requirements, typeFilter, categoryFilter, sortOption]);

  const isFiltered = typeFilter !== 'all' || categoryFilter !== 'all';
  const filteredCount = filteredAndSortedRequirements.length;
  const totalCount = requirements.length;

  // Handle dropdown toggles - consolidated to use single state
  const toggleDropdown = useCallback((dropdown: 'type' | 'category' | 'sort') => {
    setOpenDropdown((prev) => (prev === dropdown ? null : dropdown));
  }, []);

  // Handle filter/sort selections
  const handleTypeSelect = useCallback((value: TypeFilter) => {
    setTypeFilter(value);
    setOpenDropdown(null);
  }, []);

  const handleCategorySelect = useCallback((value: CategoryFilter) => {
    setCategoryFilter(value);
    setOpenDropdown(null);
  }, []);

  const handleSortSelect = useCallback((value: SortOption) => {
    setSortOption(value);
    setOpenDropdown(null);
  }, []);

  // Get current label for dropdowns
  const currentTypeLabel =
    TYPE_FILTER_OPTIONS.find((o) => o.value === typeFilter)?.label || 'All Types';
  const currentCategoryLabel =
    CATEGORY_FILTER_OPTIONS.find((o) => o.value === categoryFilter)?.label || 'All Categories';
  const currentSortLabel =
    SORT_OPTIONS.find((o) => o.value === sortOption)?.label || 'Newest First';

  // Loading state
  if (isLoading) {
    return (
      <div className={clsx('space-y-4', className)} data-testid="requirements-loading">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            data-testid="requirement-skeleton"
            className="h-16 bg-bg-tertiary rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className={clsx('flex flex-col', className)} data-testid="requirements-list">
      {/* Header with count and controls */}
      <div className="flex items-center justify-between mb-4">
        {/* Count indicator */}
        <div
          data-testid="requirements-count"
          className="text-sm font-medium text-text-secondary"
          role="status"
        >
          {isFiltered ? (
            <span>
              {filteredCount} of {totalCount}
            </span>
          ) : (
            <span>
              {totalCount} {totalCount === 1 ? 'requirement' : 'requirements'}
            </span>
          )}
        </div>

        {/* Filter and sort controls */}
        {totalCount > 0 && (
          <div className="flex items-center gap-2">
            {/* Type filter dropdown */}
            <div className="relative">
              <button
                data-testid="filter-dropdown-trigger"
                aria-haspopup="listbox"
                aria-expanded={openDropdown === 'type'}
                onClick={() => toggleDropdown('type')}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg',
                  'bg-bg-secondary border border-border-primary',
                  'text-text-secondary hover:text-text-primary',
                  'hover:bg-bg-tertiary transition-colors'
                )}
              >
                <FunnelIcon className="h-4 w-4" />
                {currentTypeLabel}
                <ChevronDownIcon className="h-3 w-3" />
              </button>

              {openDropdown === 'type' && (
                <div
                  className={clsx(
                    'absolute top-full right-0 mt-1 z-10',
                    'bg-bg-secondary border border-border-primary rounded-lg shadow-lg',
                    'py-1 min-w-[150px]'
                  )}
                  role="listbox"
                >
                  {TYPE_FILTER_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleTypeSelect(option.value)}
                      className={clsx(
                        'w-full px-3 py-2 text-sm text-left',
                        'hover:bg-bg-tertiary transition-colors',
                        option.value === typeFilter
                          ? 'text-accent-blue font-medium'
                          : 'text-text-secondary'
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Category filter dropdown */}
            <div className="relative">
              <button
                data-testid="category-filter-trigger"
                aria-haspopup="listbox"
                aria-expanded={openDropdown === 'category'}
                onClick={() => toggleDropdown('category')}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg',
                  'bg-bg-secondary border border-border-primary',
                  'text-text-secondary hover:text-text-primary',
                  'hover:bg-bg-tertiary transition-colors'
                )}
              >
                <FunnelIcon className="h-4 w-4" />
                {currentCategoryLabel}
                <ChevronDownIcon className="h-3 w-3" />
              </button>

              {openDropdown === 'category' && (
                <div
                  className={clsx(
                    'absolute top-full right-0 mt-1 z-10',
                    'bg-bg-secondary border border-border-primary rounded-lg shadow-lg',
                    'py-1 min-w-[200px]'
                  )}
                  role="listbox"
                >
                  {CATEGORY_FILTER_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleCategorySelect(option.value)}
                      className={clsx(
                        'w-full px-3 py-2 text-sm text-left',
                        'hover:bg-bg-tertiary transition-colors',
                        option.value === categoryFilter
                          ? 'text-accent-blue font-medium'
                          : 'text-text-secondary'
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sort dropdown */}
            <div className="relative">
              <button
                data-testid="sort-dropdown-trigger"
                aria-haspopup="listbox"
                aria-expanded={openDropdown === 'sort'}
                onClick={() => toggleDropdown('sort')}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg',
                  'bg-bg-secondary border border-border-primary',
                  'text-text-secondary hover:text-text-primary',
                  'hover:bg-bg-tertiary transition-colors'
                )}
              >
                <ArrowsUpDownIcon className="h-4 w-4" />
                {currentSortLabel}
                <ChevronDownIcon className="h-3 w-3" />
              </button>

              {openDropdown === 'sort' && (
                <div
                  className={clsx(
                    'absolute top-full right-0 mt-1 z-10',
                    'bg-bg-secondary border border-border-primary rounded-lg shadow-lg',
                    'py-1 min-w-[180px]'
                  )}
                  role="listbox"
                >
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleSortSelect(option.value)}
                      className={clsx(
                        'w-full px-3 py-2 text-sm text-left',
                        'hover:bg-bg-tertiary transition-colors',
                        option.value === sortOption
                          ? 'text-accent-blue font-medium'
                          : 'text-text-secondary'
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Empty state - no requirements at all */}
      {totalCount === 0 && (
        <div
          data-testid="requirements-empty-state"
          className={clsx(
            'flex flex-col items-center justify-center py-12',
            'text-center text-text-muted'
          )}
        >
          <FunnelIcon className="h-12 w-12 mb-4 opacity-50" />
          <p className="text-sm">{emptyMessage}</p>
        </div>
      )}

      {/* Empty state - filter matches nothing */}
      {totalCount > 0 && filteredCount === 0 && (
        <div
          data-testid="requirements-filter-empty"
          className={clsx(
            'flex flex-col items-center justify-center py-12',
            'text-center text-text-muted'
          )}
        >
          <FunnelIcon className="h-12 w-12 mb-4 opacity-50" />
          <p className="text-sm">No requirements match the current filter.</p>
        </div>
      )}

      {/* Requirements list */}
      {filteredCount > 0 && (
        <div
          data-testid="requirements-scroll-container"
          className="overflow-y-auto"
          style={{ maxHeight }}
          role="list"
        >
          <div className="space-y-3">
            {filteredAndSortedRequirements.map((requirement) => (
              <RequirementCard
                key={requirement.id}
                requirement={requirement}
                onUpdate={onUpdate}
                onDelete={onDelete}
                readOnly={readOnly}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
