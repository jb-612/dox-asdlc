/**
 * UserStoriesList - List of generated user stories (P05-F11 T15)
 *
 * Features:
 * - List of UserStoryCard components
 * - Group by priority (must_have, should_have, could_have)
 * - Search/filter input
 * - Export as markdown button
 * - Count indicator
 */

import { useState, useMemo, useCallback } from 'react';
import {
  MagnifyingGlassIcon,
  DocumentArrowDownIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import UserStoryCard from './UserStoryCard';
import type { UserStory, RequirementPriority } from '../../../types/ideation';

export interface UserStoriesListProps {
  /** List of user stories to display */
  stories: UserStory[];
  /** Custom class name */
  className?: string;
  /** Group stories by priority */
  groupByPriority?: boolean;
  /** Show search input */
  showSearch?: boolean;
  /** Show export button */
  showExport?: boolean;
  /** Show priority filters */
  showFilters?: boolean;
  /** Click handler for story cards */
  onStoryClick?: (story: UserStory) => void;
  /** Click handler for linked requirement badges */
  onRequirementClick?: (requirementId: string) => void;
}

const priorityOrder: RequirementPriority[] = ['must_have', 'should_have', 'could_have'];

const priorityConfig: Record<RequirementPriority, { label: string; activeClass: string; inactiveClass: string }> = {
  must_have: {
    label: 'Must Have',
    activeClass: 'bg-status-error text-white',
    inactiveClass: 'bg-bg-tertiary text-text-secondary hover:bg-status-error/20',
  },
  should_have: {
    label: 'Should Have',
    activeClass: 'bg-status-warning text-white',
    inactiveClass: 'bg-bg-tertiary text-text-secondary hover:bg-status-warning/20',
  },
  could_have: {
    label: 'Could Have',
    activeClass: 'bg-status-info text-white',
    inactiveClass: 'bg-bg-tertiary text-text-secondary hover:bg-status-info/20',
  },
};

export default function UserStoriesList({
  stories,
  className,
  groupByPriority = false,
  showSearch = true,
  showExport = true,
  showFilters = true,
  onStoryClick,
  onRequirementClick,
}: UserStoriesListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<RequirementPriority>>(new Set());

  // Filter stories based on search and priority filters
  const filteredStories = useMemo(() => {
    return stories.filter((story) => {
      // Apply priority filter
      if (activeFilters.size > 0 && !activeFilters.has(story.priority)) {
        return false;
      }

      // Apply search filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const searchableText = [
          story.title,
          story.asA,
          story.iWant,
          story.soThat,
          ...story.acceptanceCriteria,
        ]
          .join(' ')
          .toLowerCase();

        if (!searchableText.includes(term)) {
          return false;
        }
      }

      return true;
    });
  }, [stories, searchTerm, activeFilters]);

  // Group stories by priority
  const groupedStories = useMemo(() => {
    if (!groupByPriority) return null;

    const groups: Record<RequirementPriority, UserStory[]> = {
      must_have: [],
      should_have: [],
      could_have: [],
    };

    filteredStories.forEach((story) => {
      groups[story.priority].push(story);
    });

    return groups;
  }, [filteredStories, groupByPriority]);

  const toggleFilter = useCallback((priority: RequirementPriority) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(priority)) {
        next.delete(priority);
      } else {
        next.add(priority);
      }
      return next;
    });
  }, []);

  const handleFilterKeyDown = useCallback(
    (e: React.KeyboardEvent, priority: RequirementPriority) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleFilter(priority);
      }
    },
    [toggleFilter]
  );

  const generateMarkdown = useCallback((): string => {
    let md = '# User Stories\n\n';

    const sortedStories = [...filteredStories].sort((a, b) => {
      const priorityA = priorityOrder.indexOf(a.priority);
      const priorityB = priorityOrder.indexOf(b.priority);
      return priorityA - priorityB;
    });

    for (const story of sortedStories) {
      md += `## ${story.title}\n\n`;
      md += `**ID:** ${story.id}\n`;
      md += `**Priority:** ${priorityConfig[story.priority].label}\n\n`;
      md += `**As a** ${story.asA}\n`;
      md += `**I want** ${story.iWant}\n`;
      md += `**So that** ${story.soThat}\n\n`;
      md += `### Acceptance Criteria\n\n`;
      story.acceptanceCriteria.forEach((criterion) => {
        md += `- ${criterion}\n`;
      });
      md += '\n---\n\n';
    }

    return md;
  }, [filteredStories]);

  const handleExport = useCallback(() => {
    const markdown = generateMarkdown();
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `user-stories-${new Date().toISOString().split('T')[0]}.md`;
    a.click();

    URL.revokeObjectURL(url);
  }, [generateMarkdown]);

  // Empty state
  if (stories.length === 0) {
    return (
      <div
        data-testid="user-stories-list"
        className={clsx(
          'flex flex-col items-center justify-center p-8 text-center',
          'bg-bg-secondary rounded-lg border border-border-secondary',
          className
        )}
      >
        <div data-testid="empty-state">
          <DocumentTextIcon className="h-16 w-16 text-text-muted mb-4 mx-auto" />
          <h3 className="text-lg font-medium text-text-secondary mb-2">
            No User Stories Yet
          </h3>
          <p className="text-sm text-text-muted max-w-sm">
            User stories will be generated when you submit your PRD.
          </p>
        </div>
        {showExport && (
          <button
            data-testid="export-button"
            disabled
            aria-label="Export user stories as markdown"
            className="mt-4 px-4 py-2 rounded-lg bg-bg-tertiary text-text-muted cursor-not-allowed"
          >
            <DocumentArrowDownIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      data-testid="user-stories-list"
      className={clsx('space-y-4', className)}
    >
      {/* Header with search, filters, and export */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        {showSearch && (
          <div className="relative flex-1 min-w-[200px]">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <input
              data-testid="search-input"
              type="text"
              placeholder="Search user stories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search user stories"
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-bg-tertiary border border-border-secondary text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-teal"
            />
          </div>
        )}

        {/* Priority Filters */}
        {showFilters && (
          <div className="flex gap-2">
            {priorityOrder.map((priority) => (
              <button
                key={priority}
                data-testid={`filter-${priority}`}
                onClick={() => toggleFilter(priority)}
                onKeyDown={(e) => handleFilterKeyDown(e, priority)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  activeFilters.has(priority)
                    ? priorityConfig[priority].activeClass
                    : priorityConfig[priority].inactiveClass
                )}
              >
                {priorityConfig[priority].label}
              </button>
            ))}
          </div>
        )}

        {/* Count & Export */}
        <div className="flex items-center gap-3 ml-auto">
          <span
            data-testid="stories-count"
            className="px-3 py-1 rounded-lg bg-bg-tertiary text-sm text-text-secondary"
          >
            {filteredStories.length}
          </span>
          {showExport && (
            <button
              data-testid="export-button"
              onClick={handleExport}
              disabled={filteredStories.length === 0}
              aria-label="Export user stories as markdown"
              className={clsx(
                'p-2 rounded-lg transition-colors',
                filteredStories.length > 0
                  ? 'bg-bg-tertiary text-text-secondary hover:bg-bg-primary'
                  : 'bg-bg-tertiary text-text-muted cursor-not-allowed'
              )}
            >
              <DocumentArrowDownIcon className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* No results message */}
      {filteredStories.length === 0 && stories.length > 0 && (
        <div
          data-testid="no-results"
          className="text-center py-8 text-text-muted"
        >
          No user stories match your search criteria.
        </div>
      )}

      {/* Story List */}
      {filteredStories.length > 0 && (
        groupByPriority && groupedStories ? (
          // Grouped view
          <div role="list" className="space-y-6">
            {priorityOrder.map((priority) => {
              const group = groupedStories[priority];
              if (group.length === 0) return null;

              return (
                <div
                  key={priority}
                  data-testid={`group-${priority}`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-sm font-semibold text-text-primary">
                      {priorityConfig[priority].label}
                    </h3>
                    <span
                      data-testid={`group-count-${priority}`}
                      className="px-2 py-0.5 rounded-full bg-bg-tertiary text-xs text-text-secondary"
                    >
                      {group.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {group.map((story) => (
                      <UserStoryCard
                        key={story.id}
                        story={story}
                        onClick={onStoryClick}
                        onRequirementClick={onRequirementClick}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Flat list view
          <div role="list" className="space-y-3">
            {filteredStories.map((story) => (
              <UserStoryCard
                key={story.id}
                story={story}
                onClick={onStoryClick}
                onRequirementClick={onRequirementClick}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}
