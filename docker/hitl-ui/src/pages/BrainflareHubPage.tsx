/**
 * BrainflareHubPage - Main page for Brainflare Hub idea management (P08-F05 T19)
 *
 * Layout (3-column):
 * - Left: Ideas list with search and filters
 * - Center: Snowflake graph visualization (P08-F06)
 * - Right: Idea detail view or form
 */

import { useCallback } from 'react';
import { useBrainflareStore } from '../stores/brainflareStore';
import { useGraphViewStore } from '../stores/graphViewStore';
import {
  IdeasListPanel,
  IdeaDetailPanel,
  IdeaForm,
  SnowflakeGraph,
  GraphControls,
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
  const { isFormOpen, editingIdea, closeForm, createIdea, updateIdea, error, clearError } =
    useBrainflareStore();
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
      closeForm();
    },
    [editingIdea, createIdea, updateIdea, closeForm]
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
      <div className="bg-bg-secondary border-b border-border-primary px-4 py-3">
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
        <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 px-4 py-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
            <button
              type="button"
              className="text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100"
              onClick={clearError}
              aria-label="Dismiss error"
            >
              x
            </button>
          </div>
        </div>
      )}

      {/* Main Content - 3 Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Ideas List */}
        <div className="w-72 min-w-72 border-r border-border-primary bg-bg-primary overflow-y-auto">
          <IdeasListPanel />
        </div>

        {/* Center Panel - Snowflake Graph (P08-F06) */}
        <div className="flex-1 min-w-0 bg-bg-tertiary relative">
          <SnowflakeGraph className="w-full h-full" />
          <div className="absolute top-4 right-4 w-64 bg-bg-primary rounded-lg shadow-lg border border-border-primary">
            <GraphControls onRefresh={handleRefreshGraph} />
          </div>
        </div>

        {/* Right Panel - Detail or Form */}
        <div className="w-80 min-w-80 border-l border-border-primary bg-bg-primary overflow-y-auto">
          {isFormOpen ? (
            <div className="p-4">
              <h2 className="text-lg font-semibold text-text-primary mb-4">
                {editingIdea ? 'Edit Idea' : 'New Idea'}
              </h2>
              <IdeaForm idea={editingIdea} onSubmit={handleSubmit} onCancel={closeForm} />
            </div>
          ) : (
            <IdeaDetailPanel />
          )}
        </div>
      </div>
    </div>
  );
}

export default BrainflareHubPage;
