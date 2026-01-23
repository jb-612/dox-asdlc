/**
 * InteractiveGlossary - Searchable glossary of aSDLC terms
 *
 * Features alphabetical organization, search, category filtering,
 * and "Show me in the system" deep links.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

/** Category type for terms */
export type TermCategory = 'concept' | 'artifact' | 'technical';

/** Glossary term definition */
export interface GlossaryTerm {
  /** Unique identifier */
  id: string;
  /** The term itself */
  term: string;
  /** Definition/explanation */
  definition: string;
  /** Category for filtering */
  category: TermCategory;
  /** Optional deep link to system */
  deepLink?: string;
}

export interface InteractiveGlossaryProps {
  /** Terms to display */
  terms: GlossaryTerm[];
  /** Custom class name */
  className?: string;
  /** Callback when deep link is clicked */
  onDeepLinkClick?: (path: string, termId: string) => void;
}

// Category display info
const categoryInfo: Record<TermCategory | 'all', { label: string; color: string }> = {
  all: { label: 'All', color: 'text-text-secondary' },
  concept: { label: 'Concepts', color: 'text-accent-teal' },
  artifact: { label: 'Artifacts', color: 'text-accent-purple' },
  technical: { label: 'Technical', color: 'text-accent-blue' },
};

export default function InteractiveGlossary({
  terms,
  className,
  onDeepLinkClick,
}: InteractiveGlossaryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TermCategory | 'all'>('all');
  const [expandedTerms, setExpandedTerms] = useState<Set<string>>(new Set());

  // Filter terms by search and category
  const filteredTerms = useMemo(() => {
    let result = terms;

    // Filter by category
    if (selectedCategory !== 'all') {
      result = result.filter((t) => t.category === selectedCategory);
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.term.toLowerCase().includes(query) ||
          t.definition.toLowerCase().includes(query)
      );
    }

    return result;
  }, [terms, searchQuery, selectedCategory]);

  // Group terms by first letter
  const groupedTerms = useMemo(() => {
    const groups: Record<string, GlossaryTerm[]> = {};

    // Sort terms alphabetically
    const sorted = [...filteredTerms].sort((a, b) =>
      a.term.toLowerCase().localeCompare(b.term.toLowerCase())
    );

    sorted.forEach((term) => {
      const letter = term.term[0].toUpperCase();
      if (!groups[letter]) {
        groups[letter] = [];
      }
      groups[letter].push(term);
    });

    return groups;
  }, [filteredTerms]);

  // Get available letters
  const availableLetters = useMemo(() => {
    return Object.keys(groupedTerms).sort();
  }, [groupedTerms]);

  // Calculate category counts
  const categoryCounts = useMemo(() => {
    return {
      all: terms.length,
      concept: terms.filter((t) => t.category === 'concept').length,
      artifact: terms.filter((t) => t.category === 'artifact').length,
      technical: terms.filter((t) => t.category === 'technical').length,
    };
  }, [terms]);

  // Toggle term expansion
  const toggleTerm = useCallback((termId: string) => {
    setExpandedTerms((prev) => {
      const next = new Set(prev);
      if (next.has(termId)) {
        next.delete(termId);
      } else {
        next.add(termId);
      }
      return next;
    });
  }, []);

  // Handle keyboard navigation for terms
  const handleTermKeyDown = useCallback(
    (e: React.KeyboardEvent, termId: string) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleTerm(termId);
      }
    },
    [toggleTerm]
  );

  // Handle deep link click
  const handleDeepLinkClick = useCallback(
    (e: React.MouseEvent, path: string, termId: string) => {
      e.stopPropagation();
      onDeepLinkClick?.(path, termId);
    },
    [onDeepLinkClick]
  );

  // Scroll to letter
  const scrollToLetter = useCallback((letter: string) => {
    const element = document.getElementById(`letter-group-${letter.toLowerCase()}`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  // Empty state
  if (terms.length === 0) {
    return (
      <div className={clsx('flex items-center justify-center p-8 text-text-muted', className)} data-testid="interactive-glossary">
        <p>No terms available</p>
      </div>
    );
  }

  return (
    <div className={clsx('space-y-4', className)} data-testid="interactive-glossary">
      {/* Search and filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search input */}
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search terms..."
            className="w-full h-10 pl-10 pr-10 rounded-lg border border-border-primary bg-bg-secondary text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-teal focus:border-transparent"
            aria-label="Search glossary terms"
            data-testid="glossary-search"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
              aria-label="Clear search"
              data-testid="clear-search"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Category filters */}
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(categoryInfo) as (TermCategory | 'all')[]).map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={clsx(
                'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                selectedCategory === category
                  ? 'bg-accent-teal text-white'
                  : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
              )}
              data-testid={`category-${category}`}
            >
              {categoryInfo[category].label}
              <span className="ml-1.5 text-xs opacity-75">
                {categoryCounts[category]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Alphabet navigation */}
      <div
        className="flex flex-wrap gap-1 p-2 bg-bg-secondary rounded-lg border border-border-primary"
        data-testid="alphabet-nav"
      >
        {Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ').map((letter) => {
          const hasTerms = availableLetters.includes(letter);
          return (
            <button
              key={letter}
              onClick={() => hasTerms && scrollToLetter(letter)}
              disabled={!hasTerms}
              className={clsx(
                'w-7 h-7 rounded text-sm font-medium transition-colors',
                hasTerms
                  ? 'text-accent-teal hover:bg-accent-teal/10'
                  : 'text-text-muted opacity-50 cursor-not-allowed'
              )}
              data-testid={`nav-letter-${letter.toLowerCase()}`}
            >
              {letter}
            </button>
          );
        })}
      </div>

      {/* Terms list */}
      {filteredTerms.length === 0 ? (
        <div className="text-center py-8 text-text-muted">
          <p>No terms found matching your search</p>
        </div>
      ) : (
        <div className="space-y-6" role="list" data-testid="terms-list">
          {availableLetters.map((letter) => (
            <div
              key={letter}
              id={`letter-group-${letter.toLowerCase()}`}
              data-testid={`letter-group-${letter.toLowerCase()}`}
            >
              {/* Letter header */}
              <h3 className="text-lg font-bold text-accent-teal mb-3 border-b border-border-primary pb-2">
                {letter}
              </h3>

              {/* Terms in this letter group */}
              <div className="space-y-2">
                {groupedTerms[letter].map((term) => {
                  const isExpanded = expandedTerms.has(term.id);

                  return (
                    <div
                      key={term.id}
                      className={clsx(
                        'rounded-lg border transition-colors cursor-pointer',
                        isExpanded
                          ? 'border-accent-teal/50 bg-accent-teal/5'
                          : 'border-border-primary bg-bg-secondary hover:border-border-secondary'
                      )}
                      onClick={() => toggleTerm(term.id)}
                      onKeyDown={(e) => handleTermKeyDown(e, term.id)}
                      tabIndex={0}
                      role="listitem"
                      aria-expanded={isExpanded}
                      data-testid={`term-${term.id}`}
                    >
                      {/* Term header */}
                      <div className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-text-primary">
                            {term.term}
                          </span>
                          <span
                            className={clsx(
                              'text-xs px-2 py-0.5 rounded-full',
                              term.category === 'concept' && 'bg-accent-teal/10 text-accent-teal',
                              term.category === 'artifact' && 'bg-accent-purple/10 text-accent-purple',
                              term.category === 'technical' && 'bg-accent-blue/10 text-accent-blue'
                            )}
                          >
                            {categoryInfo[term.category].label}
                          </span>
                        </div>
                        {isExpanded ? (
                          <ChevronUpIcon className="h-5 w-5 text-text-muted" />
                        ) : (
                          <ChevronDownIcon className="h-5 w-5 text-text-muted" />
                        )}
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div
                          className="px-3 pb-3 pt-0 border-t border-border-primary"
                          data-testid="term-details"
                        >
                          <p className="text-sm text-text-secondary mt-2">
                            {term.definition}
                          </p>

                          {term.deepLink && (
                            <button
                              onClick={(e) => handleDeepLinkClick(e, term.deepLink!, term.id)}
                              className="inline-flex items-center gap-1 mt-3 text-sm text-accent-teal hover:underline"
                              data-testid="deep-link"
                            >
                              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                              Show me in the system
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
