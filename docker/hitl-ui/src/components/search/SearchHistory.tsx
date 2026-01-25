/**
 * SearchHistory - Recent and favorite searches panel
 *
 * Part of P05-F08 KnowledgeStore Search UI
 */

import { useMemo } from 'react';
import {
  ClockIcon,
  StarIcon as StarOutline,
  TrashIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolid } from '@heroicons/react/24/solid';
import clsx from 'clsx';
import type { SavedSearch } from '../../api/types';

export interface SearchHistoryProps {
  /** Recent searches */
  recentSearches: SavedSearch[];
  /** Favorite searches */
  favoriteSearches: SavedSearch[];
  /** Select search callback */
  onSelect: (search: SavedSearch) => void;
  /** Toggle favorite callback */
  onToggleFavorite: (searchId: string) => void;
  /** Clear history callback */
  onClearHistory: () => void;
  /** Maximum recent searches to show */
  maxRecent?: number;
  /** Custom class name */
  className?: string;
}

/**
 * Format relative time from timestamp
 */
function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;

  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (minutes < 1) {
    return 'just now';
  } else if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  } else if (hours < 24) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  } else {
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }
}

/**
 * Single search history item
 */
function HistoryItem({
  search,
  onSelect,
  onToggleFavorite,
}: {
  search: SavedSearch;
  onSelect: (search: SavedSearch) => void;
  onToggleFavorite: (searchId: string) => void;
}) {
  const hasFilters = search.filters && Object.keys(search.filters).some(
    (key) => {
      const value = search.filters?.[key as keyof typeof search.filters];
      return Array.isArray(value) ? value.length > 0 : Boolean(value);
    }
  );

  const StarIcon = search.isFavorite ? StarSolid : StarOutline;

  return (
    <div
      className="flex items-center gap-2 group"
      data-testid="history-item"
    >
      {/* Star button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite(search.id);
        }}
        className={clsx(
          'p-1 rounded transition-colors',
          search.isFavorite
            ? 'text-yellow-400 hover:text-yellow-300'
            : 'text-text-muted hover:text-yellow-400'
        )}
        aria-label={search.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        data-testid="star-button"
        data-filled={search.isFavorite ? 'true' : 'false'}
      >
        <StarIcon className="h-4 w-4" />
      </button>

      {/* Search query button */}
      <button
        onClick={() => onSelect(search)}
        className="flex-1 text-left px-2 py-1.5 rounded-lg hover:bg-bg-tertiary transition-colors min-w-0"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-primary truncate">{search.query}</span>
          {hasFilters && (
            <FunnelIcon
              className="h-3 w-3 text-text-muted flex-shrink-0"
              data-testid="filter-indicator"
            />
          )}
        </div>
        <div className="text-xs text-text-muted">
          {formatRelativeTime(search.timestamp)}
        </div>
      </button>
    </div>
  );
}

export default function SearchHistory({
  recentSearches,
  favoriteSearches,
  onSelect,
  onToggleFavorite,
  onClearHistory,
  maxRecent = 10,
  className,
}: SearchHistoryProps) {
  // Limit recent searches
  const displayRecent = useMemo(
    () => recentSearches.slice(0, maxRecent),
    [recentSearches, maxRecent]
  );

  const hasFavorites = favoriteSearches.length > 0;
  const hasRecent = displayRecent.length > 0;
  const isEmpty = !hasFavorites && !hasRecent;

  return (
    <div
      className={clsx('rounded-lg border border-border-primary bg-bg-secondary', className)}
      data-testid="search-history"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
        <div className="flex items-center gap-2">
          <ClockIcon className="h-4 w-4 text-text-muted" />
          <span className="text-sm font-medium text-text-primary">History</span>
        </div>
        {hasRecent && (
          <button
            onClick={onClearHistory}
            className="text-xs text-text-muted hover:text-text-secondary transition-colors flex items-center gap-1"
            aria-label="Clear history"
          >
            <TrashIcon className="h-3 w-3" />
            Clear history
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-3 space-y-4">
        {/* Empty state */}
        {isEmpty && (
          <div className="text-center py-6 text-text-muted text-sm">
            No recent searches
          </div>
        )}

        {/* Favorites section */}
        {hasFavorites && (
          <section aria-label="Favorites">
            <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2 flex items-center gap-1">
              <StarSolid className="h-3 w-3 text-yellow-400" />
              Favorites
            </h3>
            <div className="space-y-1">
              {favoriteSearches.map((search) => (
                <HistoryItem
                  key={search.id}
                  search={search}
                  onSelect={onSelect}
                  onToggleFavorite={onToggleFavorite}
                />
              ))}
            </div>
          </section>
        )}

        {/* Recent section */}
        {hasRecent && (
          <section aria-label="Recent">
            <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2 flex items-center gap-1">
              <ClockIcon className="h-3 w-3" />
              Recent
            </h3>
            <div className="space-y-1">
              {displayRecent.map((search) => (
                <HistoryItem
                  key={search.id}
                  search={search}
                  onSelect={onSelect}
                  onToggleFavorite={onToggleFavorite}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
