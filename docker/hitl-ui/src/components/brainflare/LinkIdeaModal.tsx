/**
 * LinkIdeaModal - Modal for creating correlations between ideas (P08-F05 T28)
 *
 * Features:
 * - Select target idea from list (excluding source)
 * - Choose correlation type (related, similar, contradicts)
 * - Optional notes field
 * - Loading and error states
 */

import { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { Idea } from '../../types/ideas';
import type { CorrelationType } from '../../types/graph';
import { fetchIdeas } from '../../api/ideas';
import { createCorrelation } from '../../api/correlations';

export interface LinkIdeaModalProps {
  /** The idea to link from */
  sourceIdea: Idea;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when link is successfully created */
  onLinked: () => void;
}

/**
 * LinkIdeaModal component
 */
export function LinkIdeaModal({ sourceIdea, onClose, onLinked }: LinkIdeaModalProps) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null);
  const [correlationType, setCorrelationType] = useState<CorrelationType>('related');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load available ideas on mount
  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetchIdeas({ status: 'active' }, 100, 0);
        // Exclude the source idea from the list
        setIdeas(response.ideas.filter((i) => i.id !== sourceIdea.id));
      } catch (e) {
        setError((e instanceof Error ? e.message : String(e)));
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [sourceIdea.id]);

  /**
   * Handle form submission to create the correlation
   */
  const handleSubmit = async () => {
    if (!selectedIdeaId) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await createCorrelation({
        source_idea_id: sourceIdea.id,
        target_idea_id: selectedIdeaId,
        correlation_type: correlationType,
        notes: notes || undefined,
      });
      onLinked();
    } catch (e) {
      setError((e instanceof Error ? e.message : String(e)));
      setIsSubmitting(false);
    }
  };

  /**
   * Handle backdrop click to close modal
   */
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  /**
   * Handle escape key to close modal
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
      data-testid="link-idea-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="link-modal-title"
    >
      <div className="bg-bg-primary rounded-lg shadow-xl w-full max-w-lg mx-4 dark:border dark:border-border-primary">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-primary">
          <h3 id="link-modal-title" className="text-lg font-semibold text-text-primary">
            Link Idea
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-bg-tertiary rounded transition-colors"
            aria-label="Close modal"
          >
            <XMarkIcon className="h-5 w-5 text-text-secondary" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Source idea display */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">From</label>
            <div className="p-3 bg-bg-secondary rounded-lg text-sm text-text-primary line-clamp-2">
              {sourceIdea.content}
            </div>
          </div>

          {/* Target idea selection */}
          <div>
            <label
              htmlFor="target-idea-select"
              className="block text-sm font-medium text-text-secondary mb-1"
            >
              To
            </label>
            {isLoading ? (
              <div className="text-text-muted text-sm py-2" data-testid="loading-ideas">
                Loading ideas...
              </div>
            ) : ideas.length === 0 ? (
              <div className="text-text-muted text-sm py-2" data-testid="no-ideas">
                No other ideas available to link
              </div>
            ) : (
              <select
                id="target-idea-select"
                value={selectedIdeaId || ''}
                onChange={(e) => setSelectedIdeaId(e.target.value || null)}
                className="w-full border border-border-primary rounded-lg p-2 bg-bg-primary text-text-primary"
                aria-describedby={error ? 'link-error' : undefined}
              >
                <option value="">Select an idea...</option>
                {ideas.map((idea) => (
                  <option key={idea.id} value={idea.id}>
                    {idea.content.length > 60 ? idea.content.slice(0, 57) + '...' : idea.content}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Correlation type selection */}
          <div>
            <label
              htmlFor="correlation-type-select"
              className="block text-sm font-medium text-text-secondary mb-1"
            >
              Relationship
            </label>
            <select
              id="correlation-type-select"
              value={correlationType}
              onChange={(e) => setCorrelationType(e.target.value as CorrelationType)}
              className="w-full border border-border-primary rounded-lg p-2 bg-bg-primary text-text-primary"
            >
              <option value="related">Related</option>
              <option value="similar">Similar</option>
              <option value="contradicts">Contradicts</option>
            </select>
            <p className="text-xs text-text-muted mt-1">
              {correlationType === 'related' && 'These ideas are related to each other'}
              {correlationType === 'similar' && 'These ideas express similar concepts'}
              {correlationType === 'contradicts' && 'These ideas conflict or contradict each other'}
            </p>
          </div>

          {/* Notes field */}
          <div>
            <label
              htmlFor="link-notes"
              className="block text-sm font-medium text-text-secondary mb-1"
            >
              Notes (optional)
            </label>
            <textarea
              id="link-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-border-primary rounded-lg p-2 bg-bg-primary text-text-primary placeholder:text-text-muted"
              placeholder="Why are these ideas linked?"
            />
          </div>

          {/* Error display */}
          {error && (
            <div
              id="link-error"
              className="text-red-600 dark:text-red-400 text-sm"
              role="alert"
              data-testid="link-error"
            >
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-border-primary">
          <button
            onClick={onClose}
            className="px-4 py-2 text-text-secondary hover:bg-bg-tertiary rounded-lg transition-colors"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedIdeaId || isSubmitting || isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            data-testid="link-submit-button"
          >
            {isSubmitting ? 'Linking...' : 'Create Link'}
          </button>
        </div>
      </div>
    </div>
  );
}
