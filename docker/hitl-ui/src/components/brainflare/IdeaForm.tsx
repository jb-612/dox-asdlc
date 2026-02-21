/**
 * IdeaForm - Form for creating or editing ideas (P08-F05 T16)
 *
 * Features:
 * - Content textarea with word count validation (max 144 words)
 * - Classification selector
 * - Labels input (comma-separated)
 * - Submit/cancel actions
 */

import { useState, useCallback } from 'react';
import type { Idea, CreateIdeaRequest, IdeaClassification } from '../../types/ideas';
import { MAX_IDEA_WORDS } from '../../types/ideas';
import clsx from 'clsx';

export interface IdeaFormProps {
  /** Existing idea for editing, or null for create */
  idea?: Idea | null;
  /** Submit handler */
  onSubmit: (data: CreateIdeaRequest) => Promise<void>;
  /** Cancel handler */
  onCancel: () => void;
}

/**
 * IdeaForm component
 */
export function IdeaForm({ idea, onSubmit, onCancel }: IdeaFormProps) {
  // Form state
  const [content, setContent] = useState(idea?.content || '');
  const [classification, setClassification] = useState<IdeaClassification>(
    idea?.classification || 'undetermined'
  );
  const [labels, setLabels] = useState(idea?.labels.join(', ') || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Word count calculation
  const wordCount = content
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  const isOverLimit = wordCount > MAX_IDEA_WORDS;

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (isOverLimit) {
        setError(`Idea exceeds ${MAX_IDEA_WORDS} word limit`);
        return;
      }

      if (!content.trim()) {
        setError('Idea content is required');
        return;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        await onSubmit({
          content: content.trim(),
          classification,
          labels: labels
            .split(',')
            .map((l) => l.trim())
            .filter(Boolean),
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setIsSubmitting(false);
      }
    },
    [content, classification, labels, isOverLimit, onSubmit]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="idea-form">
      {/* Content textarea */}
      <div>
        <label
          htmlFor="idea-content"
          className="block text-sm font-medium text-text-primary mb-1"
        >
          Idea Content
        </label>
        <textarea
          id="idea-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          className={clsx(
            'w-full border rounded-lg p-3 bg-bg-primary text-text-primary',
            'focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            'placeholder:text-text-muted',
            isOverLimit ? 'border-red-500' : 'border-border-primary'
          )}
          placeholder={`Describe your idea in up to ${MAX_IDEA_WORDS} words...`}
          required
          aria-describedby="word-count"
        />
        <div
          id="word-count"
          className={clsx('text-sm mt-1', isOverLimit ? 'text-red-600' : 'text-text-muted')}
        >
          {wordCount}/{MAX_IDEA_WORDS} words
        </div>
      </div>

      {/* Classification select */}
      <div>
        <label
          htmlFor="idea-classification"
          className="block text-sm font-medium text-text-primary mb-1"
        >
          Classification
        </label>
        <select
          id="idea-classification"
          value={classification}
          onChange={(e) => setClassification(e.target.value as IdeaClassification)}
          className="w-full border border-border-primary rounded-lg p-2 bg-bg-primary text-text-primary"
        >
          <option value="undetermined">Undetermined</option>
          <option value="functional">Functional</option>
          <option value="non_functional">Non-Functional</option>
        </select>
      </div>

      {/* Labels input */}
      <div>
        <label
          htmlFor="idea-labels"
          className="block text-sm font-medium text-text-primary mb-1"
        >
          Labels (comma-separated)
        </label>
        <input
          id="idea-labels"
          type="text"
          value={labels}
          onChange={(e) => setLabels(e.target.value)}
          className="w-full border border-border-primary rounded-lg p-2 bg-bg-primary text-text-primary placeholder:text-text-muted"
          placeholder="ui, performance, backend..."
        />
      </div>

      {/* Error message */}
      {error && (
        <div className="text-red-600 text-sm" role="alert">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-text-secondary hover:bg-bg-tertiary rounded-lg transition-colors"
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || isOverLimit || !content.trim()}
          className={clsx(
            'px-4 py-2 rounded-lg transition-colors',
            'bg-blue-600 text-white hover:bg-blue-700',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {isSubmitting ? 'Saving...' : idea ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
}
