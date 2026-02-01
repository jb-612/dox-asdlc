/**
 * NewIdeaModal - Modal dialog for creating/editing ideas (P08-F05)
 *
 * Features:
 * - Centered modal overlay
 * - Content textarea with word count validation (max 144 words)
 * - Classification selector
 * - Labels input (comma-separated)
 * - Submit/cancel actions
 * - Click outside or Escape to close
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { Idea, CreateIdeaRequest, IdeaClassification } from '../../types/ideas';
import { MAX_IDEA_WORDS } from '../../types/ideas';
import clsx from 'clsx';

export interface NewIdeaModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Existing idea for editing, or null for create */
  idea?: Idea | null;
  /** Submit handler */
  onSubmit: (data: CreateIdeaRequest) => Promise<void>;
  /** Close handler */
  onClose: () => void;
}

/**
 * NewIdeaModal component
 */
export function NewIdeaModal({ isOpen, idea, onSubmit, onClose }: NewIdeaModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Form state
  const [content, setContent] = useState(idea?.content || '');
  const [classification, setClassification] = useState<IdeaClassification>(
    idea?.classification || 'undetermined'
  );
  const [labels, setLabels] = useState(idea?.labels?.join(', ') || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens/closes or idea changes
  useEffect(() => {
    if (isOpen) {
      setContent(idea?.content || '');
      setClassification(idea?.classification || 'undetermined');
      setLabels(idea?.labels?.join(', ') || '');
      setError(null);
      // Focus textarea after a short delay
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen, idea]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

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
        onClose();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [content, classification, labels, isOverLimit, onSubmit, onClose]
  );

  /**
   * Handle click outside modal
   */
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
      data-testid="new-idea-modal-backdrop"
    >
      <div
        ref={modalRef}
        className="bg-bg-primary rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden flex flex-col"
        data-testid="new-idea-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-primary">
          <h2 id="modal-title" className="text-lg font-semibold text-text-primary">
            {idea ? 'Edit Idea' : 'New Idea'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-secondary transition-colors"
            aria-label="Close modal"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Content textarea */}
          <div>
            <label
              htmlFor="idea-content"
              className="block text-sm font-medium text-text-primary mb-2"
            >
              Idea Content
            </label>
            <textarea
              ref={textareaRef}
              id="idea-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              className={clsx(
                'w-full border rounded-lg p-3 bg-bg-primary text-text-primary resize-none',
                'focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none',
                'placeholder:text-text-muted',
                isOverLimit ? 'border-red-500' : 'border-border-primary'
              )}
              placeholder={`Describe your idea in up to ${MAX_IDEA_WORDS} words...`}
              required
              aria-describedby="word-count"
              data-testid="idea-content-input"
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
              className="block text-sm font-medium text-text-primary mb-2"
            >
              Classification
            </label>
            <select
              id="idea-classification"
              value={classification}
              onChange={(e) => setClassification(e.target.value as IdeaClassification)}
              className="w-full border border-border-primary rounded-lg p-2.5 bg-bg-primary text-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none"
              data-testid="idea-classification-select"
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
              className="block text-sm font-medium text-text-primary mb-2"
            >
              Labels (comma-separated)
            </label>
            <input
              id="idea-labels"
              type="text"
              value={labels}
              onChange={(e) => setLabels(e.target.value)}
              className="w-full border border-border-primary rounded-lg p-2.5 bg-bg-primary text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none"
              placeholder="ui, performance, backend..."
              data-testid="idea-labels-input"
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm" role="alert">
              {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border-primary bg-bg-secondary">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-text-secondary hover:bg-bg-tertiary rounded-lg transition-colors"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="idea-form"
            onClick={handleSubmit}
            disabled={isSubmitting || isOverLimit || !content.trim()}
            className={clsx(
              'px-4 py-2 rounded-lg transition-colors',
              'bg-blue-600 text-white hover:bg-blue-700',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            data-testid="idea-submit-button"
          >
            {isSubmitting ? 'Saving...' : idea ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
