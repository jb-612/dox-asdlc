/**
 * UserStoryCard - Display user story with As/I Want/So That format (P05-F11 T14)
 *
 * Features:
 * - Story ID and title header
 * - "As a / I want / So that" format display
 * - Expandable acceptance criteria list
 * - Priority badge
 * - Linked requirements shown as small badges
 */

import { useState, useCallback } from 'react';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import type { UserStory, RequirementPriority } from '../../../types/ideation';

export interface UserStoryCardProps {
  /** The user story to display */
  story: UserStory;
  /** Custom class name */
  className?: string;
  /** Start with acceptance criteria expanded */
  defaultExpanded?: boolean;
  /** Compact display mode */
  compact?: boolean;
  /** Click handler for the card */
  onClick?: (story: UserStory) => void;
  /** Click handler for linked requirement badges */
  onRequirementClick?: (requirementId: string) => void;
}

const priorityConfig: Record<RequirementPriority, { label: string; className: string }> = {
  must_have: { label: 'Must Have', className: 'bg-status-error/20 text-status-error' },
  should_have: { label: 'Should Have', className: 'bg-status-warning/20 text-status-warning' },
  could_have: { label: 'Could Have', className: 'bg-status-info/20 text-status-info' },
};

export default function UserStoryCard({
  story,
  className,
  defaultExpanded = false,
  compact = false,
  onClick,
  onRequirementClick,
}: UserStoryCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const toggleExpanded = useCallback((e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    setIsExpanded((prev) => !prev);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleExpanded(e);
    }
  }, [toggleExpanded]);

  const handleCardClick = useCallback(() => {
    onClick?.(story);
  }, [onClick, story]);

  const handleRequirementClick = useCallback(
    (e: React.MouseEvent, reqId: string) => {
      e.stopPropagation();
      onRequirementClick?.(reqId);
    },
    [onRequirementClick]
  );

  const { label: priorityLabel, className: priorityClassName } = priorityConfig[story.priority];

  return (
    <article
      data-testid="user-story-card"
      onClick={onClick ? handleCardClick : undefined}
      className={clsx(
        'bg-bg-secondary border border-border-secondary rounded-lg',
        'hover:border-border-primary transition-colors',
        compact ? 'p-3' : 'p-4',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              data-testid="story-id"
              className="text-xs font-mono text-text-muted"
            >
              {story.id}
            </span>
            <span
              data-testid="priority-badge"
              className={clsx(
                'px-2 py-0.5 rounded-full text-xs font-medium',
                priorityClassName
              )}
            >
              {priorityLabel}
            </span>
          </div>
          <h3
            data-testid="story-title"
            className={clsx(
              'font-medium text-text-primary',
              compact ? 'text-sm' : 'text-base'
            )}
          >
            {story.title}
          </h3>
        </div>
      </div>

      {/* Story Format: As a / I want / So that */}
      <div className={clsx('space-y-2', compact ? 'text-sm' : 'text-base')}>
        <div>
          <span
            data-testid="as-a-label"
            className="font-semibold text-accent-purple"
          >
            As a{' '}
          </span>
          <span data-testid="as-a-value" className="text-text-secondary">
            {story.asA}
          </span>
        </div>
        <div>
          <span
            data-testid="i-want-label"
            className="font-semibold text-accent-teal"
          >
            I want{' '}
          </span>
          <span data-testid="i-want-value" className="text-text-secondary">
            {story.iWant}
          </span>
        </div>
        <div>
          <span
            data-testid="so-that-label"
            className="font-semibold text-accent-blue"
          >
            So that{' '}
          </span>
          <span data-testid="so-that-value" className="text-text-secondary">
            {story.soThat}
          </span>
        </div>
      </div>

      {/* Acceptance Criteria */}
      <div className="mt-4 pt-3 border-t border-border-secondary">
        <button
          data-testid="toggle-criteria"
          onClick={toggleExpanded}
          onKeyDown={handleKeyDown}
          aria-expanded={isExpanded}
          aria-controls={`criteria-${story.id}`}
          className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors w-full"
        >
          {isExpanded ? (
            <ChevronDownIcon className="h-4 w-4" />
          ) : (
            <ChevronRightIcon className="h-4 w-4" />
          )}
          <span>Acceptance Criteria</span>
          <span
            data-testid="criteria-count"
            className="ml-auto px-2 py-0.5 rounded-full bg-bg-tertiary text-xs"
          >
            {story.acceptanceCriteria.length}
          </span>
        </button>

        <ul
          id={`criteria-${story.id}`}
          data-testid="criteria-list"
          aria-label={`Acceptance criteria for ${story.title}`}
          className={clsx(
            'mt-2 space-y-2 pl-6',
            !isExpanded && 'hidden'
          )}
          style={{ visibility: isExpanded ? 'visible' : 'hidden' }}
        >
          {story.acceptanceCriteria.map((criterion, index) => (
            <li
              key={index}
              data-testid={`criteria-item-${index}`}
              className="flex items-start gap-2 text-sm text-text-secondary"
            >
              <CheckCircleIcon className="h-4 w-4 text-status-success flex-shrink-0 mt-0.5" />
              <span>{criterion}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Linked Requirements */}
      {story.linkedRequirements.length > 0 && (
        <div
          data-testid="linked-requirements"
          className="mt-3 pt-3 border-t border-border-secondary"
        >
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs text-text-muted mr-1">Linked:</span>
            {story.linkedRequirements.map((reqId) => (
              <button
                key={reqId}
                data-testid={`requirement-badge-${reqId}`}
                onClick={(e) => handleRequirementClick(e, reqId)}
                className="px-2 py-0.5 rounded bg-bg-tertiary text-xs font-mono text-text-secondary hover:bg-accent-teal/20 hover:text-accent-teal transition-colors"
              >
                {reqId}
              </button>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
