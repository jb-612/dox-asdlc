/**
 * SearchResults - Results list container with pagination and loading states
 *
 * Part of P05-F08 KnowledgeStore Search UI
 */

import { ChevronLeftIcon, ChevronRightIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { MagnifyingGlassIcon } from '@heroicons/react/24/solid';
import clsx from 'clsx';
import type { KSSearchResult } from '../../api/types';
import SearchResultCard from './SearchResultCard';

export interface SearchResultsProps {
  /** Search results to display */
  results: KSSearchResult[];
  /** Total number of results (for pagination) */
  total: number;
  /** Current page (1-indexed) */
  page: number;
  /** Results per page */
  pageSize: number;
  /** Loading state */
  isLoading: boolean;
  /** Page change callback */
  onPageChange: (page: number) => void;
  /** Result click callback */
  onResultClick: (result: KSSearchResult) => void;
  /** Terms to highlight in results */
  highlightTerms?: string[];
  /** Error message */
  error?: string | null;
  /** Retry callback for error state */
  onRetry?: () => void;
  /** Search duration in milliseconds */
  tookMs?: number;
  /** Custom class name */
  className?: string;
}

/**
 * Loading skeleton for results
 */
function ResultsSkeleton() {
  return (
    <div className="space-y-4" data-testid="results-skeleton">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="p-4 rounded-lg border border-border-primary bg-bg-secondary animate-pulse"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="h-5 w-5 rounded bg-bg-tertiary" />
            <div className="h-4 w-48 rounded bg-bg-tertiary" />
            <div className="ml-auto h-5 w-12 rounded bg-bg-tertiary" />
          </div>
          <div className="space-y-2 mb-3">
            <div className="h-3 w-full rounded bg-bg-tertiary" />
            <div className="h-3 w-3/4 rounded bg-bg-tertiary" />
          </div>
          <div className="flex gap-2">
            <div className="h-5 w-16 rounded bg-bg-tertiary" />
            <div className="h-5 w-12 rounded bg-bg-tertiary" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Empty state when no results
 */
function EmptyState() {
  return (
    <div className="text-center py-12" data-testid="empty-state">
      <MagnifyingGlassIcon className="h-12 w-12 mx-auto text-text-muted mb-4" />
      <h3 className="text-lg font-medium text-text-primary mb-2">No results found</h3>
      <p className="text-text-muted">
        Try different keywords or adjust your filters
      </p>
    </div>
  );
}

/**
 * Error state with retry button
 */
function ErrorState({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="text-center py-12" data-testid="error-state">
      <ExclamationCircleIcon className="h-12 w-12 mx-auto text-red-400 mb-4" />
      <h3 className="text-lg font-medium text-text-primary mb-2">Search failed</h3>
      <p className="text-text-muted mb-4">{error}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 rounded-lg bg-accent-teal text-white hover:bg-accent-teal/80 transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export default function SearchResults({
  results,
  total,
  page,
  pageSize,
  isLoading,
  onPageChange,
  onResultClick,
  highlightTerms = [],
  error,
  onRetry,
  tookMs,
  className,
}: SearchResultsProps) {
  // Calculate pagination
  const totalPages = Math.ceil(total / pageSize);
  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, startItem + results.length - 1);
  const showPagination = totalPages > 1;

  // Handle loading state
  if (isLoading) {
    return (
      <div className={className} data-testid="search-results">
        <ResultsSkeleton />
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <div className={className} data-testid="search-results">
        <ErrorState error={error} onRetry={onRetry} />
      </div>
    );
  }

  // Handle empty state
  if (results.length === 0) {
    return (
      <div className={className} data-testid="search-results">
        <EmptyState />
      </div>
    );
  }

  return (
    <div className={className} data-testid="search-results">
      {/* Results count and timing */}
      <div className="flex items-center justify-between mb-4 text-sm text-text-muted">
        <span>
          Showing {startItem}-{endItem} of {total}
          {tookMs !== undefined && (
            <span className="ml-2">({tookMs}ms)</span>
          )}
        </span>
      </div>

      {/* Results list */}
      <div className="space-y-3">
        {results.map((result, index) => (
          <div key={result.docId} data-testid={`search-result-${index}`}>
            <SearchResultCard
              result={result}
              highlightTerms={highlightTerms}
              onClick={() => onResultClick(result)}
            />
          </div>
        ))}
      </div>

      {/* Pagination */}
      {showPagination && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border-primary">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className={clsx(
              'flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              page <= 1
                ? 'text-text-muted cursor-not-allowed'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
            )}
            aria-label="Previous page"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            Previous
          </button>

          <span className="text-sm text-text-muted">
            Page {page} of {totalPages}
          </span>

          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className={clsx(
              'flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              page >= totalPages
                ? 'text-text-muted cursor-not-allowed'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
            )}
            aria-label="Next page"
          >
            Next
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
