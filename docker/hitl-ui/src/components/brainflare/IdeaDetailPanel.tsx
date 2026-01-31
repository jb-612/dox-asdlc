/**
 * IdeaDetailPanel - Right panel showing selected idea details (P08-F05 T18, T29)
 *
 * Features:
 * - Action buttons (edit, archive, delete, link)
 * - Full idea content display
 * - Metadata display (author, classification, status, labels, timestamps)
 * - Linked ideas / correlations display
 * - Empty state when no idea selected
 */

import { useCallback, useState } from 'react';
import { useBrainflareStore } from '../../stores/brainflareStore';
import { useGraphViewStore } from '../../stores/graphViewStore';
import {
  PencilIcon,
  TrashIcon,
  ArchiveBoxIcon,
  ArchiveBoxXMarkIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import clsx from 'clsx';
import { LinkIdeaModal } from './LinkIdeaModal';
import { fetchGraph } from '../../api/correlations';
import type { GraphNode } from '../../types/graph';

/**
 * Classification badge colors for detail view
 */
const classificationColors: Record<string, string> = {
  functional: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  non_functional: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  undetermined: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

/**
 * Status badge colors
 */
const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  archived: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

/**
 * IdeaDetailPanel component
 */
/**
 * Helper to extract node ID from edge source/target
 */
function getNodeId(ref: string | number | GraphNode): string {
  if (typeof ref === 'string') return ref;
  if (typeof ref === 'number') return String(ref);
  return ref.id;
}

/**
 * Correlation type badge colors
 */
const correlationColors: Record<string, string> = {
  similar: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  contradicts: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  related: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

export function IdeaDetailPanel() {
  const { selectedIdea, ideas, openForm, deleteIdea, archiveIdea, updateIdea, selectIdea } =
    useBrainflareStore();
  const { edges, nodes, setGraphData, selectNode } = useGraphViewStore();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);

  /**
   * Handle delete with confirmation
   */
  const handleDelete = useCallback(async () => {
    if (!selectedIdea) return;

    const confirmed = window.confirm('Are you sure you want to delete this idea?');
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await deleteIdea(selectedIdea.id);
    } finally {
      setIsDeleting(false);
    }
  }, [selectedIdea, deleteIdea]);

  /**
   * Handle archive/unarchive
   */
  const handleArchiveToggle = useCallback(async () => {
    if (!selectedIdea) return;

    setIsArchiving(true);
    try {
      if (selectedIdea.status === 'archived') {
        // Unarchive
        await updateIdea(selectedIdea.id, { status: 'active' });
      } else {
        // Archive
        await archiveIdea(selectedIdea.id);
      }
    } finally {
      setIsArchiving(false);
    }
  }, [selectedIdea, archiveIdea, updateIdea]);

  /**
   * Handle successful link creation
   */
  const handleLinked = useCallback(async () => {
    setIsLinkModalOpen(false);
    // Refresh graph data to show the new correlation
    try {
      const data = await fetchGraph();
      setGraphData(data.nodes, data.edges);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to refresh graph after linking:', e);
    }
  }, [setGraphData]);

  /**
   * Handle clicking on a linked idea to navigate to it
   */
  const handleLinkedIdeaClick = useCallback(
    (ideaId: string) => {
      selectIdea(ideaId);
      selectNode(ideaId);
    },
    [selectIdea, selectNode]
  );

  // Get correlations for the selected idea
  const ideaCorrelations = selectedIdea
    ? edges.filter((e) => {
        const sourceId = getNodeId(e.source);
        const targetId = getNodeId(e.target);
        return sourceId === selectedIdea.id || targetId === selectedIdea.id;
      })
    : [];

  // Build a map of linked idea IDs to their data
  const linkedIdeasMap = new Map<string, { label: string; correlationType: string }>();
  if (selectedIdea) {
    ideaCorrelations.forEach((edge) => {
      const sourceId = getNodeId(edge.source);
      const targetId = getNodeId(edge.target);
      const linkedId = sourceId === selectedIdea.id ? targetId : sourceId;

      // Try to find the label from nodes or ideas
      const node = nodes.find((n) => n.id === linkedId);
      const idea = ideas.find((i) => i.id === linkedId);
      const label = node?.label || idea?.content.slice(0, 50) || linkedId;

      linkedIdeasMap.set(linkedId, {
        label: label.length > 50 ? label.slice(0, 47) + '...' : label,
        correlationType: edge.correlationType,
      });
    });
  }

  // Empty state when no idea selected
  if (!selectedIdea) {
    return (
      <div
        className="h-full flex items-center justify-center text-text-muted"
        data-testid="idea-detail-empty"
      >
        Select an idea to view details
      </div>
    );
  }

  const isArchived = selectedIdea.status === 'archived';

  return (
    <div className="h-full flex flex-col p-4" data-testid="idea-detail-panel">
      {/* Actions */}
      <div className="flex justify-end gap-2 mb-4">
        <button
          onClick={() => openForm(selectedIdea)}
          className="p-2 hover:bg-bg-tertiary rounded-lg transition-colors"
          title="Edit"
          aria-label="Edit idea"
        >
          <PencilIcon className="h-5 w-5 text-text-secondary" />
        </button>

        <button
          onClick={() => setIsLinkModalOpen(true)}
          className="p-2 hover:bg-bg-tertiary rounded-lg transition-colors"
          title="Link to another idea"
          aria-label="Link to another idea"
          data-testid="link-idea-button"
        >
          <LinkIcon className="h-5 w-5 text-text-secondary" />
        </button>

        <button
          onClick={handleArchiveToggle}
          disabled={isArchiving}
          className="p-2 hover:bg-bg-tertiary rounded-lg transition-colors disabled:opacity-50"
          title={isArchived ? 'Unarchive' : 'Archive'}
          aria-label={isArchived ? 'Unarchive idea' : 'Archive idea'}
        >
          {isArchived ? (
            <ArchiveBoxXMarkIcon className="h-5 w-5 text-text-secondary" />
          ) : (
            <ArchiveBoxIcon className="h-5 w-5 text-text-secondary" />
          )}
        </button>

        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
          title="Delete"
          aria-label="Delete idea"
        >
          <TrashIcon className="h-5 w-5 text-red-600" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <p className="text-lg text-text-primary mb-6 leading-relaxed">{selectedIdea.content}</p>

        <div className="space-y-4 text-sm">
          {/* Author */}
          <div>
            <span className="text-text-muted">Author:</span>{' '}
            <span className="text-text-primary">{selectedIdea.author_name}</span>
          </div>

          {/* Classification */}
          <div className="flex items-center gap-2">
            <span className="text-text-muted">Classification:</span>
            <span
              className={clsx(
                'px-2 py-0.5 text-xs rounded-full font-medium',
                classificationColors[selectedIdea.classification]
              )}
            >
              {selectedIdea.classification.replace('_', '-')}
            </span>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="text-text-muted">Status:</span>
            <span
              className={clsx(
                'px-2 py-0.5 text-xs rounded-full font-medium',
                statusColors[selectedIdea.status]
              )}
            >
              {selectedIdea.status}
            </span>
          </div>

          {/* Labels */}
          <div>
            <span className="text-text-muted">Labels:</span>{' '}
            {selectedIdea.labels.length > 0 ? (
              <span className="inline-flex flex-wrap gap-1 ml-1">
                {selectedIdea.labels.map((label) => (
                  <span
                    key={label}
                    className="px-2 py-0.5 text-xs bg-bg-tertiary text-text-secondary rounded-full"
                  >
                    {label}
                  </span>
                ))}
              </span>
            ) : (
              <span className="text-text-muted">None</span>
            )}
          </div>

          {/* Created */}
          <div>
            <span className="text-text-muted">Created:</span>{' '}
            <span className="text-text-primary">
              {format(new Date(selectedIdea.created_at), 'MMM d, yyyy h:mm a')}
            </span>
          </div>

          {/* Updated (if different from created) */}
          {selectedIdea.updated_at !== selectedIdea.created_at && (
            <div>
              <span className="text-text-muted">Updated:</span>{' '}
              <span className="text-text-primary">
                {format(new Date(selectedIdea.updated_at), 'MMM d, yyyy h:mm a')}
              </span>
            </div>
          )}

          {/* Word count */}
          <div>
            <span className="text-text-muted">Word count:</span>{' '}
            <span className="text-text-primary">{selectedIdea.word_count}</span>
          </div>

          {/* ID (for debugging/reference) */}
          <div>
            <span className="text-text-muted">ID:</span>{' '}
            <span className="text-text-muted font-mono text-xs">{selectedIdea.id}</span>
          </div>

          {/* Linked ideas / Correlations section */}
          {linkedIdeasMap.size > 0 && (
            <div className="mt-6 pt-4 border-t border-border-primary">
              <h4 className="text-sm font-medium text-text-primary mb-3">
                Linked Ideas ({linkedIdeasMap.size})
              </h4>
              <div className="space-y-2">
                {Array.from(linkedIdeasMap.entries()).map(([linkedId, data]) => (
                  <button
                    key={linkedId}
                    onClick={() => handleLinkedIdeaClick(linkedId)}
                    className="w-full text-left p-2 rounded-lg hover:bg-bg-tertiary transition-colors flex items-start gap-2"
                    data-testid={`linked-idea-${linkedId}`}
                  >
                    <span
                      className={clsx(
                        'px-2 py-0.5 rounded text-xs font-medium flex-shrink-0',
                        correlationColors[data.correlationType]
                      )}
                    >
                      {data.correlationType}
                    </span>
                    <span className="text-sm text-text-secondary truncate">{data.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Empty correlations state */}
          {linkedIdeasMap.size === 0 && (
            <div className="mt-6 pt-4 border-t border-border-primary">
              <p className="text-sm text-text-muted">
                No linked ideas yet.{' '}
                <button
                  onClick={() => setIsLinkModalOpen(true)}
                  className="text-blue-600 hover:underline"
                >
                  Create a link
                </button>{' '}
                to connect this idea with others.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Link Idea Modal */}
      {isLinkModalOpen && (
        <LinkIdeaModal
          sourceIdea={selectedIdea}
          onClose={() => setIsLinkModalOpen(false)}
          onLinked={handleLinked}
        />
      )}
    </div>
  );
}
