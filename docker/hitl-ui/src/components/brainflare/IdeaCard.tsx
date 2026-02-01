/**
 * IdeaCard - Displays a single idea in a card format (P08-F05 T15, P08-F03 T16)
 *
 * Shows idea content, author, classification, labels, and metadata.
 * Supports selection state for detail view.
 * Updated to use ClassificationBadge and support re-classification.
 */

import { useCallback } from 'react';
import type { Idea } from '../../types/ideas';
import type { ClassificationType, ClassificationResult } from '../../types/classification';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { ClassificationBadge } from '../ideas/ClassificationBadge';
import { DEFAULT_LABELS } from '../../types/classification';

export interface IdeaCardProps {
  /** The idea to display */
  idea: Idea;
  /** Whether this card is currently selected */
  isSelected?: boolean;
  /** Click handler for selection */
  onClick?: () => void;
  /** Classification result with confidence and reasoning */
  classificationResult?: ClassificationResult | null;
  /** Whether classification is currently in progress */
  isClassifying?: boolean;
  /** Callback to trigger re-classification */
  onReclassify?: (ideaId: string) => void;
  /** Whether to show the re-classify button */
  showReclassifyButton?: boolean;
}

/**
 * Get label display name from taxonomy
 */
function getLabelName(labelId: string): string {
  const label = DEFAULT_LABELS.find((l) => l.id === labelId);
  return label?.name || labelId;
}

/**
 * Get label color from taxonomy
 */
function getLabelColor(labelId: string): string {
  const label = DEFAULT_LABELS.find((l) => l.id === labelId);
  return label?.color || '#6b7280';
}

/**
 * IdeaCard component
 */
export function IdeaCard({
  idea,
  isSelected,
  onClick,
  classificationResult,
  isClassifying = false,
  onReclassify,
  showReclassifyButton = true,
}: IdeaCardProps) {
  const handleReclassify = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onReclassify?.(idea.id);
    },
    [idea.id, onReclassify]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick?.();
      }
    },
    [onClick]
  );

  // Use classification result if available, otherwise fall back to idea.classification
  const classification: ClassificationType = classificationResult?.classification || idea.classification;
  const confidence = classificationResult?.confidence;
  const reasoning = classificationResult?.reasoning;

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
      onKeyDown={handleKeyDown}
      aria-selected={isSelected}
      data-testid={`idea-card-${idea.id}`}
    >
      {/* Header: Author, timestamp, and re-classify button */}
      <div className="flex items-start justify-between mb-2">
        <span className="text-sm text-text-secondary">{idea.author_name}</span>
        <div className="flex items-center gap-2">
          {showReclassifyButton && onReclassify && !isClassifying && (
            <button
              onClick={handleReclassify}
              className="p-1 hover:bg-bg-tertiary rounded transition-colors"
              title="Re-classify this idea"
              aria-label="Re-classify idea"
              data-testid={`reclassify-${idea.id}`}
            >
              <ArrowPathIcon className="h-3.5 w-3.5 text-text-muted hover:text-text-secondary" />
            </button>
          )}
          <span className="text-xs text-text-muted">
            {formatDistanceToNow(new Date(idea.created_at), { addSuffix: true })}
          </span>
        </div>
      </div>

      {/* Content */}
      <p className="text-text-primary mb-3 line-clamp-3">{idea.content}</p>

      {/* Classification Badge */}
      <div className="mb-2">
        <ClassificationBadge
          classification={classification}
          confidence={confidence}
          reasoning={reasoning}
          isProcessing={isClassifying}
          size="sm"
          showConfidence={!!confidence}
        />
      </div>

      {/* Labels Row */}
      {idea.labels.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2" data-testid={`labels-${idea.id}`}>
          {idea.labels.slice(0, 4).map((labelId) => {
            const color = getLabelColor(labelId);
            const name = getLabelName(labelId);
            return (
              <span
                key={labelId}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border"
                style={{
                  backgroundColor: `${color}15`,
                  borderColor: `${color}30`,
                  color: color,
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
                {name}
              </span>
            );
          })}
          {idea.labels.length > 4 && (
            <span className="px-2 py-0.5 text-xs text-text-muted">
              +{idea.labels.length - 4} more
            </span>
          )}
        </div>
      )}

      {/* Footer: Word count */}
      <div className="text-xs text-text-muted">{idea.word_count} words</div>
    </div>
  );
}
