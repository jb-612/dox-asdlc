/**
 * IdeasListPanel - Left panel showing list of ideas with filters (P08-F05 T17, T30)
 *
 * Features:
 * - Header with count and new idea button
 * - IdeasFilter component with classification counts (P08-F03 T18)
 * - Scrollable list of IdeaCard components
 * - Loading and empty states
 * - Syncs selection with graph view store
 */

import { useEffect, useCallback } from 'react';
import { useBrainflareStore } from '../../stores/brainflareStore';
import { useGraphViewStore } from '../../stores/graphViewStore';
import { IdeaCard } from './IdeaCard';
import { IdeasFilter } from '../ideas/IdeasFilter';
import { PlusIcon } from '@heroicons/react/24/outline';
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
    classificationCounts,
    fetchIdeas,
    fetchClassificationCounts,
    selectIdea,
    setFilters,
    clearFilters,
    openForm,
  } = useBrainflareStore();

  const { selectNode } = useGraphViewStore();

  // Fetch ideas and classification counts on mount
  useEffect(() => {
    fetchIdeas();
    fetchClassificationCounts();
  }, [fetchIdeas, fetchClassificationCounts]);

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

        {/* IdeasFilter component with classification counts (P08-F03 T18) */}
        <IdeasFilter
          filters={filters}
          onFiltersChange={setFilters}
          onClearFilters={clearFilters}
          classificationCounts={classificationCounts ?? undefined}
          isLoading={isLoading}
        />
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
