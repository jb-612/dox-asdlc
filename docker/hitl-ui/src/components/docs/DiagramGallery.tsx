/**
 * DiagramGallery - Responsive grid gallery for diagram thumbnails
 *
 * Displays diagrams in a filterable, keyboard-navigable grid with
 * category filtering and card selection.
 */

import { useState, useCallback } from 'react';
import clsx from 'clsx';
import type { DiagramMeta, DiagramCategory } from '../../api/types';
import { categoryColors } from './constants';

export interface DiagramGalleryProps {
  /** Diagrams to display */
  diagrams: DiagramMeta[];
  /** Callback when diagram is selected */
  onSelect: (diagramId: string) => void;
  /** Custom class name */
  className?: string;
}

/** Category filter options */
const categoryFilters: Array<{ value: DiagramCategory | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'architecture', label: 'Architecture' },
  { value: 'flow', label: 'Flow' },
  { value: 'sequence', label: 'Sequence' },
  { value: 'decision', label: 'Decision' },
];

/**
 * DiagramGallery component
 *
 * Grid layout with responsive columns, category filtering, and keyboard navigation.
 */
export default function DiagramGallery({
  diagrams,
  onSelect,
  className,
}: DiagramGalleryProps) {
  const [activeFilter, setActiveFilter] = useState<DiagramCategory | 'all'>('all');

  // Filter diagrams based on active category
  const filteredDiagrams =
    activeFilter === 'all'
      ? diagrams
      : diagrams.filter((d) => d.category === activeFilter);

  // Handle card click
  const handleCardClick = useCallback(
    (diagramId: string) => {
      onSelect(diagramId);
    },
    [onSelect]
  );

  // Handle keyboard navigation
  const handleCardKeyDown = useCallback(
    (e: React.KeyboardEvent, diagramId: string) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect(diagramId);
      }
    },
    [onSelect]
  );

  return (
    <div className={clsx('space-y-4', className)} data-testid="diagram-gallery">
      {/* Category filter tabs */}
      <div className="flex flex-wrap gap-2" data-testid="filter-tabs">
        {categoryFilters.map((filter) => (
          <button
            key={filter.value}
            onClick={() => setActiveFilter(filter.value)}
            className={clsx(
              'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
              activeFilter === filter.value
                ? 'bg-accent-blue text-white'
                : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
            )}
            aria-pressed={activeFilter === filter.value}
            data-testid={`filter-${filter.value}`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Diagram grid */}
      {filteredDiagrams.length > 0 ? (
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          data-testid="diagram-grid"
        >
          {filteredDiagrams.map((diagram) => (
            <div
              key={diagram.id}
              className={clsx(
                'group bg-bg-secondary rounded-lg border border-border-primary',
                'hover:border-accent-blue hover:shadow-md transition-all cursor-pointer'
              )}
              onClick={() => handleCardClick(diagram.id)}
              onKeyDown={(e) => handleCardKeyDown(e, diagram.id)}
              tabIndex={0}
              role="button"
              data-testid={`diagram-card-${diagram.id}`}
            >
              {/* Thumbnail placeholder */}
              <div className="aspect-video bg-bg-tertiary rounded-t-lg flex items-center justify-center">
                <div className="text-text-muted text-sm">
                  {/* Simplified diagram icon */}
                  <svg
                    className="h-12 w-12 mx-auto mb-1 opacity-50"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1}
                  >
                    <rect x="3" y="3" width="7" height="5" rx="1" />
                    <rect x="14" y="3" width="7" height="5" rx="1" />
                    <rect x="8.5" y="16" width="7" height="5" rx="1" />
                    <line x1="6.5" y1="8" x2="6.5" y2="11" />
                    <line x1="17.5" y1="8" x2="17.5" y2="11" />
                    <line x1="6.5" y1="11" x2="17.5" y2="11" />
                    <line x1="12" y1="11" x2="12" y2="16" />
                  </svg>
                </div>
              </div>

              {/* Card content */}
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-text-primary group-hover:text-accent-blue transition-colors line-clamp-1">
                    {diagram.title}
                  </h3>
                  <span
                    className={clsx(
                      'px-1.5 py-0.5 text-xs font-medium rounded border flex-shrink-0',
                      categoryColors[diagram.category]
                    )}
                  >
                    {diagram.category}
                  </span>
                </div>
                <p className="text-sm text-text-secondary mt-1 line-clamp-2">
                  {diagram.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Empty state
        <div className="text-center py-12 text-text-muted" data-testid="empty-state">
          <svg
            className="h-12 w-12 mx-auto mb-3 opacity-50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
          >
            <path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p>No diagrams found</p>
          {activeFilter !== 'all' && (
            <button
              onClick={() => setActiveFilter('all')}
              className="mt-2 text-sm text-accent-blue hover:underline"
            >
              Show all diagrams
            </button>
          )}
        </div>
      )}
    </div>
  );
}
