/**
 * SearchPage - Main search page composing all search components
 *
 * Part of P05-F08 KnowledgeStore Search UI
 *
 * Uses Zustand store for state management and React Query hooks for data fetching.
 */

import { useState, useCallback, useMemo } from 'react';
import clsx from 'clsx';
import type {
  SearchFilters as SearchFiltersType,
  KSSearchResult,
  SavedSearch,
  SearchQuery,
} from '../../api/types';
import { useSearch, useKnowledgeHealth } from '../../api/searchHooks';
import { useSearchStore } from '../../stores/searchStore';
import SearchBar from './SearchBar';
import SearchResults from './SearchResults';
import SearchFilters from './SearchFilters';
import BackendSelector from './BackendSelector';
import SearchHistory from './SearchHistory';
import DocumentDetail from './DocumentDetail';

export default function SearchPage() {
  // Local search state (not persisted)
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFiltersType>({});
  const [page, setPage] = useState(1);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Store state (persisted)
  const {
    recentSearches,
    favoriteSearches,
    selectedBackend,
    filtersOpen,
    addRecentSearch,
    toggleFavorite,
    clearHistory,
    setBackend,
    toggleFilters,
  } = useSearchStore();

  // Build search query object
  const searchQuery: SearchQuery | null = useMemo(() => {
    if (!query.trim()) return null;
    return {
      query: query.trim(),
      topK: 10,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
    };
  }, [query, filters]);

  // Search query using hooks
  const {
    data: searchResults,
    isLoading,
    error,
    refetch,
  } = useSearch(searchQuery, { mode: selectedBackend });

  // Health check query
  const { data: healthData } = useKnowledgeHealth({ mode: selectedBackend });

  // Handle search
  const handleSearch = useCallback(
    (newQuery: string) => {
      setQuery(newQuery);
      setPage(1);
      if (newQuery.trim()) {
        addRecentSearch(newQuery, filters);
      }
    },
    [filters, addRecentSearch]
  );

  // Handle filter change
  const handleFiltersChange = useCallback((newFilters: SearchFiltersType) => {
    setFilters(newFilters);
    setPage(1);
  }, []);

  // Handle result click
  const handleResultClick = useCallback((result: KSSearchResult) => {
    setSelectedDocId(result.docId);
  }, []);

  // Handle close document detail
  const handleCloseDocument = useCallback(() => {
    setSelectedDocId(null);
  }, []);

  // Handle history select
  const handleHistorySelect = useCallback((search: SavedSearch) => {
    setQuery(search.query);
    if (search.filters) {
      setFilters(search.filters);
    }
    setPage(1);
  }, []);

  // Handle clear search
  const handleClear = useCallback(() => {
    setQuery('');
    setPage(1);
  }, []);

  // Extract highlight terms from query
  const highlightTerms = useMemo(() => {
    if (!query.trim()) return [];
    return query.trim().split(/\s+/).filter(Boolean);
  }, [query]);

  // If document is selected, show document detail
  if (selectedDocId) {
    return (
      <DocumentDetail
        docId={selectedDocId}
        onClose={handleCloseDocument}
        backendMode={selectedBackend}
      />
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary" data-testid="search-page">
      {/* Header */}
      <div className="border-b border-border-primary bg-bg-secondary">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-text-primary mb-4">
            Knowledge Search
          </h1>

          {/* Search bar and controls */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <SearchBar
                onSearch={handleSearch}
                initialQuery={query}
                isLoading={isLoading}
                showFiltersToggle
                onFiltersToggle={toggleFilters}
                onClear={handleClear}
              />
            </div>
            <BackendSelector
              mode={selectedBackend}
              onChange={setBackend}
              disabled={isLoading}
              showHealth
              healthStatus={healthData?.status}
              data-testid="backend-selector"
            />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Mobile sidebar toggle */}
        <button
          className="lg:hidden flex items-center gap-2 mb-4 px-4 py-2 bg-bg-secondary rounded-lg border border-border-primary text-sm font-medium text-text-secondary hover:bg-bg-tertiary"
          onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          aria-expanded={mobileSidebarOpen}
          data-testid="mobile-sidebar-toggle"
        >
          <svg
            className={clsx('h-4 w-4 transition-transform', mobileSidebarOpen && 'rotate-180')}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          {mobileSidebarOpen ? 'Hide Filters' : 'Show Filters & History'}
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar: Filters and History */}
          <div
            className={clsx(
              'lg:col-span-1 space-y-6',
              'lg:block',
              mobileSidebarOpen ? 'block' : 'hidden lg:block'
            )}
          >
            {/* Filters */}
            <SearchFilters
              filters={filters}
              onChange={handleFiltersChange}
              isExpanded={filtersOpen}
              data-testid="search-filters"
            />

            {/* History */}
            <SearchHistory
              recentSearches={recentSearches}
              favoriteSearches={favoriteSearches}
              onSelect={handleHistorySelect}
              onToggleFavorite={toggleFavorite}
              onClearHistory={clearHistory}
            />
          </div>

          {/* Main: Results */}
          <div className="lg:col-span-3">
            <SearchResults
              results={searchResults?.results ?? []}
              total={searchResults?.total ?? 0}
              page={page}
              pageSize={10}
              isLoading={isLoading}
              onPageChange={setPage}
              onResultClick={handleResultClick}
              highlightTerms={highlightTerms}
              error={error ? String(error) : undefined}
              onRetry={() => refetch()}
              tookMs={searchResults?.took_ms}
              data-testid="search-results"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
