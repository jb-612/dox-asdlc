/**
 * DocSearch - Client-side fuzzy search across documents and diagrams
 *
 * Provides a search input with dropdown results, keyboard navigation,
 * and recent searches stored in localStorage.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { MagnifyingGlassIcon, ClockIcon } from '@heroicons/react/24/outline';
import { DocumentTextIcon } from '@heroicons/react/24/solid';
import clsx from 'clsx';
import type { DocumentMeta, DiagramMeta } from '../../api/types';

/** Search result item */
export interface SearchResult {
  type: 'document' | 'diagram';
  id: string;
}

export interface DocSearchProps {
  /** Available documents to search */
  documents: DocumentMeta[];
  /** Available diagrams to search */
  diagrams: DiagramMeta[];
  /** Callback when a result is selected */
  onResultSelect: (result: SearchResult) => void;
  /** Custom class name */
  className?: string;
  /** Placeholder text */
  placeholder?: string;
}

/** Maximum number of recent searches to store */
const MAX_RECENT_SEARCHES = 5;
/** LocalStorage key for recent searches */
const RECENT_SEARCHES_KEY = 'doc-search-recent';

/** Internal search result with score for sorting */
interface ScoredResult extends SearchResult {
  title: string;
  description: string;
  score: number;
}

/**
 * Simple fuzzy search scoring function
 * Returns higher scores for better matches
 */
function fuzzyScore(query: string, text: string): number {
  if (!query || !text) return 0;

  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();

  // Exact match gets highest score
  if (lowerText === lowerQuery) return 100;

  // Contains exact query
  if (lowerText.includes(lowerQuery)) return 80;

  // Check word-by-word matching
  const queryWords = lowerQuery.split(/\s+/).filter(Boolean);
  const textWords = lowerText.split(/\s+/).filter(Boolean);

  let matchedWords = 0;
  for (const qWord of queryWords) {
    for (const tWord of textWords) {
      if (tWord.includes(qWord) || qWord.includes(tWord)) {
        matchedWords++;
        break;
      }
    }
  }

  if (matchedWords === queryWords.length) return 60;
  if (matchedWords > 0) return 40 * (matchedWords / queryWords.length);

  // Character-based fuzzy matching
  let qi = 0;
  let ti = 0;
  while (qi < lowerQuery.length && ti < lowerText.length) {
    if (lowerQuery[qi] === lowerText[ti]) {
      qi++;
    }
    ti++;
  }

  if (qi === lowerQuery.length) {
    return 20 * (lowerQuery.length / lowerText.length);
  }

  return 0;
}

/**
 * DocSearch component
 */
export default function DocSearch({
  documents,
  diagrams,
  onResultSelect,
  className,
  placeholder = 'Search docs and diagrams...',
}: DocSearchProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [showRecent, setShowRecent] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get recent searches from localStorage
  const recentSearches = useMemo(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as string[];
        return parsed.slice(0, MAX_RECENT_SEARCHES);
      }
    } catch {
      // Ignore parse errors
    }
    return [];
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Re-read when showRecent changes
  }, [showRecent]);

  // Perform fuzzy search
  const searchResults = useMemo(() => {
    if (!query.trim()) return { documents: [], diagrams: [] };

    const docResults: ScoredResult[] = [];
    const diagramResults: ScoredResult[] = [];

    // Search documents
    for (const doc of documents) {
      const titleScore = fuzzyScore(query, doc.title);
      const descScore = fuzzyScore(query, doc.description);
      const maxScore = Math.max(titleScore, descScore);

      if (maxScore > 0) {
        docResults.push({
          type: 'document',
          id: doc.id,
          title: doc.title,
          description: doc.description,
          score: maxScore,
        });
      }
    }

    // Search diagrams
    for (const diagram of diagrams) {
      const titleScore = fuzzyScore(query, diagram.title);
      const descScore = fuzzyScore(query, diagram.description);
      const maxScore = Math.max(titleScore, descScore);

      if (maxScore > 0) {
        diagramResults.push({
          type: 'diagram',
          id: diagram.id,
          title: diagram.title,
          description: diagram.description,
          score: maxScore,
        });
      }
    }

    // Sort by score descending
    docResults.sort((a, b) => b.score - a.score);
    diagramResults.sort((a, b) => b.score - a.score);

    return {
      documents: docResults,
      diagrams: diagramResults,
    };
  }, [query, documents, diagrams]);

  // All results in flat array for keyboard navigation
  const allResults = useMemo(() => {
    return [...searchResults.documents, ...searchResults.diagrams];
  }, [searchResults]);

  const hasResults = allResults.length > 0;
  const hasQuery = query.trim().length > 0;

  // Save search to recent
  const saveToRecent = useCallback((searchQuery: string) => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      let recent: string[] = stored ? JSON.parse(stored) : [];

      // Remove duplicate if exists
      recent = recent.filter((s) => s !== searchQuery);

      // Add to front
      recent.unshift(searchQuery);

      // Limit to max
      recent = recent.slice(0, MAX_RECENT_SEARCHES);

      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent));
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Handle result selection
  const handleSelect = useCallback(
    (result: SearchResult) => {
      if (query.trim()) {
        saveToRecent(query.trim());
      }
      onResultSelect(result);
      setQuery('');
      setIsOpen(false);
      setShowRecent(false);
      setHighlightedIndex(-1);
    },
    [query, onResultSelect, saveToRecent]
  );

  // Handle recent search click
  const handleRecentClick = useCallback((recentQuery: string) => {
    setQuery(recentQuery);
    setShowRecent(false);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < allResults.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < allResults.length) {
          const result = allResults[highlightedIndex];
          handleSelect({ type: result.type, id: result.id });
        }
      } else if (e.key === 'Escape') {
        setIsOpen(false);
        setShowRecent(false);
        setHighlightedIndex(-1);
      }
    },
    [allResults, highlightedIndex, handleSelect]
  );

  // Handle input change
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
      setHighlightedIndex(-1);
      setIsOpen(true);
      setShowRecent(false);
    },
    []
  );

  // Handle input focus
  const handleFocus = useCallback(() => {
    if (!query.trim() && recentSearches.length > 0) {
      setShowRecent(true);
    }
    setIsOpen(true);
  }, [query, recentSearches.length]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setShowRecent(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Render search result item
  const renderResultItem = (result: ScoredResult, index: number) => {
    const isHighlighted = index === highlightedIndex;

    return (
      <button
        key={`${result.type}-${result.id}`}
        data-testid={`search-result-${result.id}`}
        data-highlighted={isHighlighted ? 'true' : 'false'}
        className={clsx(
          'w-full px-3 py-2 text-left flex items-start gap-3 transition-colors',
          isHighlighted
            ? 'bg-accent-teal/10 text-accent-teal'
            : 'hover:bg-bg-secondary'
        )}
        onClick={() => handleSelect({ type: result.type, id: result.id })}
        role="option"
        aria-selected={isHighlighted}
      >
        <DocumentTextIcon className="h-5 w-5 flex-shrink-0 mt-0.5 opacity-60" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{result.title}</div>
          <div className="text-xs text-text-muted truncate">
            {result.description}
          </div>
        </div>
        <span className="text-xs text-text-muted capitalize">
          {result.type}
        </span>
      </button>
    );
  };

  // Calculate index offset for diagram results
  const docCount = searchResults.documents.length;

  return (
    <div
      ref={containerRef}
      className={clsx('relative', className)}
      data-testid="doc-search"
    >
      {/* Search input */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-2 bg-bg-secondary border border-border-primary rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-teal/50 focus:border-accent-teal"
          aria-label="Search documents and diagrams"
          aria-expanded={isOpen}
          aria-controls="search-results"
          aria-activedescendant={
            highlightedIndex >= 0 ? `result-${highlightedIndex}` : undefined
          }
        />
      </div>

      {/* Results dropdown */}
      {isOpen && hasQuery && (
        <div
          id="search-results"
          data-testid="search-results"
          className="absolute top-full left-0 right-0 mt-1 bg-bg-primary border border-border-primary rounded-lg shadow-lg overflow-hidden z-50 max-h-96 overflow-y-auto"
          role="listbox"
        >
          {hasResults ? (
            <>
              {/* Documents group */}
              {searchResults.documents.length > 0 && (
                <div data-testid="results-group-documents">
                  <div className="px-3 py-1.5 text-xs font-medium text-text-muted bg-bg-secondary border-b border-border-primary">
                    Documents
                  </div>
                  {searchResults.documents.map((result, idx) =>
                    renderResultItem(result, idx)
                  )}
                </div>
              )}

              {/* Diagrams group */}
              {searchResults.diagrams.length > 0 && (
                <div data-testid="results-group-diagrams">
                  <div className="px-3 py-1.5 text-xs font-medium text-text-muted bg-bg-secondary border-b border-border-primary">
                    Diagrams
                  </div>
                  {searchResults.diagrams.map((result, idx) =>
                    renderResultItem(result, docCount + idx)
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="px-4 py-8 text-center text-text-muted">
              <p>No results found for &quot;{query}&quot;</p>
            </div>
          )}
        </div>
      )}

      {/* Recent searches dropdown */}
      {isOpen && showRecent && !hasQuery && recentSearches.length > 0 && (
        <div
          data-testid="recent-searches"
          className="absolute top-full left-0 right-0 mt-1 bg-bg-primary border border-border-primary rounded-lg shadow-lg overflow-hidden z-50"
        >
          <div className="px-3 py-1.5 text-xs font-medium text-text-muted bg-bg-secondary border-b border-border-primary flex items-center gap-1">
            <ClockIcon className="h-3 w-3" />
            Recent Searches
          </div>
          {recentSearches.map((recent) => (
            <button
              key={recent}
              data-testid={`recent-search-${recent}`}
              className="w-full px-3 py-2 text-left text-sm hover:bg-bg-secondary transition-colors flex items-center gap-2"
              onClick={() => handleRecentClick(recent)}
            >
              <ClockIcon className="h-4 w-4 text-text-muted" />
              <span>{recent}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
