/**
 * IdeasListPanel - Left panel showing list of ideas with filters (P08-F05 T17, T30)
 *
 * Features:
 * - Header with count and new idea button
 * - Search input
 * - Status and classification filters
 * - Scrollable list of IdeaCard components
 * - Loading and empty states
 * - Syncs selection with graph view store
 */

import { useEffect, useCallback } from 'react';
import { useBrainflareStore } from '../../stores/brainflareStore';
import { useGraphViewStore } from '../../stores/graphViewStore';
import { IdeaCard } from './IdeaCard';
import { PlusIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

/**
 * IdeasListPanel component
 */
export function IdeasListPanel() {
  const {
    ideas,
    selectedIdea,
    filters,
    isLoading,
    error,
    total,
    fetchIdeas,
    selectIdea,
    setFilters,
    clearFilters,
    openForm,
  } = useBrainflareStore();

  const { selectNode } = useGraphViewStore();

  // Fetch ideas on mount
  useEffect(() => {
    fetchIdeas();
  }, [fetchIdeas]);

  // Check if any filters are active
  const hasActiveFilters = !!(filters.status || filters.classification || filters.search);

  /**
   * Handle idea selection with graph sync
   * Updates both brainflare store and graph view store
   */
  const handleSelectIdea = useCallback(
    (ideaId: string) => {
      selectIdea(ideaId);
      selectNode(ideaId);
    },
    [selectIdea, selectNode]
  );

  return (
    <div className="h-full flex flex-col" data-testid="ideas-list-panel">
      {/* Header */}
      <div className="p-4 border-b border-border-primary">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">Ideas ({total})</h2>
          <button
            onClick={() => openForm()}
            className={clsx(
              'flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors',
              'bg-blue-600 text-white hover:bg-blue-700'
            )}
            data-testid="new-idea-button"
          >
            <PlusIcon className="h-4 w-4" />
            New Idea
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search ideas..."
            value={filters.search || ''}
            onChange={(e) => setFilters({ search: e.target.value || undefined })}
            className={clsx(
              'w-full pl-9 pr-3 py-2 text-sm rounded-lg',
              'border border-border-primary bg-bg-primary text-text-primary',
              'placeholder:text-text-muted',
              'focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            )}
            aria-label="Search ideas"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2 mt-3">
          <select
            value={filters.status || ''}
            onChange={(e) =>
              setFilters({
                status: (e.target.value as 'active' | 'archived') || undefined,
              })
            }
            className="text-sm border border-border-primary rounded-lg px-2 py-1 bg-bg-primary text-text-primary"
            aria-label="Filter by status"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>

          <select
            value={filters.classification || ''}
            onChange={(e) =>
              setFilters({
                classification:
                  (e.target.value as 'functional' | 'non_functional' | 'undetermined') ||
                  undefined,
              })
            }
            className="text-sm border border-border-primary rounded-lg px-2 py-1 bg-bg-primary text-text-primary"
            aria-label="Filter by classification"
          >
            <option value="">All Types</option>
            <option value="functional">Functional</option>
            <option value="non_functional">Non-Functional</option>
            <option value="undetermined">Undetermined</option>
          </select>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-text-muted hover:text-text-primary flex items-center gap-1"
              aria-label="Clear filters"
            >
              <XMarkIcon className="h-4 w-4" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="text-center py-8 text-text-muted" data-testid="loading-state">
            <div className="animate-pulse">Loading ideas...</div>
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-500" role="alert" data-testid="error-state">
            {error}
          </div>
        ) : ideas.length === 0 ? (
          <div className="text-center py-8 text-text-muted" data-testid="empty-state">
            {hasActiveFilters ? (
              <p>No ideas match your filters.</p>
            ) : (
              <p>No ideas yet. Click "New Idea" to add one.</p>
            )}
          </div>
        ) : (
          ideas.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              isSelected={selectedIdea?.id === idea.id}
              onClick={() => handleSelectIdea(idea.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
