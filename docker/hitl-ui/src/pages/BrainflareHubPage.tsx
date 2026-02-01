/**
 * BrainflareHubPage - Main page for Brainflare Hub idea management (P08-F05 T19)
 *
 * Layout (2-column with modal):
 * - Left: Ideas list with search and filters
 * - Right: Snowflake graph visualization (P08-F06) + detail panel
 * - Modal: New/Edit Idea form (popup)
 */

import { useCallback } from 'react';
import { useBrainflareStore } from '../stores/brainflareStore';
import { useGraphViewStore } from '../stores/graphViewStore';
import {
  IdeasListPanel,
  IdeaDetailPanel,
  SnowflakeGraph,
  GraphControls,
  NewIdeaModal,
} from '../components/brainflare';
import { SparklesIcon } from '@heroicons/react/24/outline';
import type { CreateIdeaRequest } from '../types/ideas';
import { fetchGraph } from '../api/correlations';
import clsx from 'clsx';

export interface BrainflareHubPageProps {
  /** Custom class name */
  className?: string;
}

/**
 * BrainflareHubPage component
 */
export function BrainflareHubPage({ className }: BrainflareHubPageProps) {
  const {
    isFormOpen,
    editingIdea,
    selectedIdea,
    closeForm,
    createIdea,
    updateIdea,
    error,
    clearError,
    fetchIdeas,
  } = useBrainflareStore();
  const { setGraphData, setLoading, setError } = useGraphViewStore();

  /**
   * Handle form submission (create or update)
   */
  const handleSubmit = useCallback(
    async (data: CreateIdeaRequest) => {
      if (editingIdea) {
        await updateIdea(editingIdea.id, data);
      } else {
        await createIdea(data);
      }
      // Refresh ideas list after create/update
      fetchIdeas();
    },
    [editingIdea, createIdea, updateIdea, fetchIdeas]
  );

  /**
   * Refresh graph data
   */
  const handleRefreshGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGraph();
      setGraphData(data.nodes, data.edges);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [setGraphData, setLoading, setError]);

  return (
    <div
      className={clsx('h-full flex flex-col bg-bg-primary', className)}
      data-testid="brainflare-hub-page"
      role="main"
    >
      {/* Header Bar */}
      <div className="bg-bg-secondary border-b border-border-primary px-4 py-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SparklesIcon className="h-6 w-6 text-yellow-500" />
            <h1 className="text-xl font-semibold text-text-primary">Brainflare Hub</h1>
            <span className="text-sm text-text-muted">Capture and organize ideas</span>
          </div>
        </div>
      </div>

      {/* Error Toast */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 px-4 py-2 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
            <button
              type="button"
              className="text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100"
              onClick={clearError}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Main Content - 2 Column Layout */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Panel - Ideas List */}
        <div className="w-80 min-w-80 border-r border-border-primary bg-bg-primary flex flex-col">
          <IdeasListPanel />
        </div>

        {/* Right Panel - Graph and Detail */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Graph Area */}
          <div className="flex-1 min-h-0 bg-bg-tertiary relative">
            <SnowflakeGraph className="w-full h-full" />
            {/* Graph Controls - top right corner */}
            <div className="absolute top-3 right-3 w-56 bg-bg-primary rounded-lg shadow-lg border border-border-primary max-h-[calc(100%-24px)] overflow-hidden">
              <GraphControls onRefresh={handleRefreshGraph} />
            </div>
          </div>

          {/* Detail Panel - bottom */}
          {selectedIdea && (
            <div className="h-48 min-h-48 border-t border-border-primary bg-bg-primary overflow-y-auto">
              <IdeaDetailPanel />
            </div>
          )}
        </div>
      </div>

      {/* New/Edit Idea Modal */}
      <NewIdeaModal
        isOpen={isFormOpen}
        idea={editingIdea}
        onSubmit={handleSubmit}
        onClose={closeForm}
      />
    </div>
  );
}

export default BrainflareHubPage;
