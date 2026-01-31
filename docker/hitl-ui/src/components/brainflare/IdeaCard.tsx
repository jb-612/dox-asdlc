/**
 * IdeaCard - Displays a single idea in a card format (P08-F05 T15)
 *
 * Shows idea content, author, classification, labels, and metadata.
 * Supports selection state for detail view.
 */

import type { Idea } from '../../types/ideas';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';

export interface IdeaCardProps {
  /** The idea to display */
  idea: Idea;
  /** Whether this card is currently selected */
  isSelected?: boolean;
  /** Click handler for selection */
  onClick?: () => void;
}

/**
 * Classification badge colors
 */
const classificationColors: Record<string, string> = {
  functional: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  non_functional: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  undetermined: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

/**
 * Format classification for display
 */
function formatClassification(classification: string): string {
  return classification.replace('_', '-');
}

/**
 * IdeaCard component
 */
export function IdeaCard({ idea, isSelected, onClick }: IdeaCardProps) {
  return (
    <div
      className={clsx(
        'p-4 border rounded-lg cursor-pointer transition-all',
        isSelected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-border-primary hover:border-gray-400 dark:hover:border-gray-500 bg-bg-primary'
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      aria-selected={isSelected}
      data-testid={`idea-card-${idea.id}`}
    >
      {/* Header: Author and timestamp */}
      <div className="flex items-start justify-between mb-2">
        <span className="text-sm text-text-secondary">{idea.author_name}</span>
        <span className="text-xs text-text-muted">
          {formatDistanceToNow(new Date(idea.created_at), { addSuffix: true })}
        </span>
      </div>

      {/* Content */}
      <p className="text-text-primary mb-3 line-clamp-3">{idea.content}</p>

      {/* Tags: Classification and labels */}
      <div className="flex flex-wrap gap-2">
        <span
          className={clsx(
            'px-2 py-0.5 text-xs rounded-full font-medium',
            classificationColors[idea.classification]
          )}
        >
          {formatClassification(idea.classification)}
        </span>
        {idea.labels.slice(0, 3).map((label) => (
          <span
            key={label}
            className="px-2 py-0.5 text-xs bg-bg-tertiary text-text-secondary rounded-full"
          >
            {label}
          </span>
        ))}
        {idea.labels.length > 3 && (
          <span className="px-2 py-0.5 text-xs text-text-muted">
            +{idea.labels.length - 3} more
          </span>
        )}
      </div>

      {/* Footer: Word count */}
      <div className="mt-2 text-xs text-text-muted">{idea.word_count} words</div>
    </div>
  );
}
