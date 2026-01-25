# P05-F08 ELK Search UI - Technical Design

**Version:** 1.0
**Date:** 2026-01-25
**Status:** Draft

## 1. Overview

Build a KnowledgeStore search interface in the HITL UI that enables semantic search across indexed codebase documents via Elasticsearch. The UI supports three backend modes (REST, GraphQL, MCP) with a mock-first development approach.

### 1.1 Goals

1. Provide a modern, responsive search interface for the ELK KnowledgeStore backend
2. Support three backend connection modes: REST API, GraphQL, and MCP
3. Use mock data during development, seamlessly switch to real backend
4. Syntax highlighting for code results
5. Faceted filtering by file type, date range, and metadata
6. Save recent and favorite searches

### 1.2 Non-Goals

- Modifying the KnowledgeStore backend (P02-F04 scope)
- Full-text indexing within the UI (backend responsibility)
- Document editing or annotation
- Real-time search streaming (future enhancement)

## 2. Dependencies

### 2.1 Internal Dependencies

| Dependency | Status | Description |
|------------|--------|-------------|
| P02-F04-elk-knowledgestore | Complete | Backend KnowledgeStore with Elasticsearch |
| P05-F01-hitl-ui | Complete | Base HITL UI infrastructure |
| P05-F06-hitl-ui-v2 | Complete | Enhanced UI components and patterns |
| P05-F07-documentation-spa | Complete | DocSearch component pattern to extend |

### 2.2 Backend Contract (from P02-F04)

The Elasticsearch KnowledgeStore exposes these operations via the KnowledgeStore protocol:

```python
# From src/core/interfaces.py
async def search(
    query: str,
    top_k: int = 10,
    filters: dict[str, Any] | None = None,
) -> list[SearchResult]

async def get_by_id(doc_id: str) -> Document | None

async def health_check() -> dict[str, Any]
```

**SearchResult structure:**
```python
@dataclass
class SearchResult:
    doc_id: str
    content: str
    metadata: dict[str, Any]
    score: float
    source: str  # "elasticsearch"
```

**Document structure:**
```python
@dataclass
class Document:
    doc_id: str
    content: str
    metadata: dict[str, Any]
    embedding: list[float] | None = None
```

### 2.3 External Dependencies

No new npm packages required. Leverage existing:
- `@tanstack/react-query` - Data fetching and caching
- `axios` - HTTP client for REST
- `zustand` - State management
- Tailwind CSS - Styling
- `clsx` - Conditional classes

## 3. Technical Architecture

### 3.1 Backend Mode Architecture

The search UI supports three backend modes to accommodate different deployment scenarios:

```
+------------------+
|   SearchPage     |
+--------+---------+
         |
         v
+------------------+
| SearchService    |  <- Abstract interface
+--------+---------+
         |
    +----+----+----+
    |         |    |
    v         v    v
+-------+ +------+ +------+
| REST  | | GQL  | | MCP  |
+-------+ +------+ +------+
```

**Mode Selection:**
- Environment variable `VITE_SEARCH_BACKEND` controls mode
- Values: `rest` (default), `graphql`, `mcp`, `mock`
- UI provides toggle for switching during development

### 3.2 REST API Endpoints (Primary)

When the orchestrator exposes REST endpoints for KnowledgeStore:

```
POST /api/knowledge/search
  Request:  { query: string, top_k: number, filters?: object }
  Response: { results: SearchResult[], total: number }

GET /api/knowledge/document/:doc_id
  Response: Document | 404

GET /api/knowledge/health
  Response: { status: "healthy"|"unhealthy", backend: string, ... }
```

### 3.3 GraphQL Schema (Alternative)

```graphql
type Query {
  searchKnowledge(
    query: String!
    topK: Int = 10
    filters: SearchFilters
  ): SearchResults!

  getDocument(docId: String!): Document

  knowledgeHealth: HealthStatus!
}

type SearchResults {
  results: [SearchResult!]!
  total: Int!
}

type SearchResult {
  docId: String!
  content: String!
  metadata: JSON
  score: Float!
  source: String!
}

type Document {
  docId: String!
  content: String!
  metadata: JSON
}

input SearchFilters {
  fileTypes: [String!]
  dateFrom: String
  dateTo: String
  metadata: JSON
}
```

### 3.4 MCP Tool Interface (Alternative)

When using KnowledgeStore MCP server directly:

```typescript
// Via existing MCP configuration
const results = await mcpClient.invoke('ks_search', {
  query: searchQuery,
  top_k: 10,
  filters: { file_type: '.py' }
});

const document = await mcpClient.invoke('ks_get', {
  doc_id: 'src/core/interfaces.py:0'
});
```

### 3.5 Component Architecture

```
docker/hitl-ui/src/
  components/
    search/
      SearchPage.tsx           # Main search page with all sections
      SearchPage.test.tsx
      SearchBar.tsx            # Input, filters toggle, backend selector
      SearchBar.test.tsx
      SearchResults.tsx        # Results list with pagination
      SearchResults.test.tsx
      SearchResultCard.tsx     # Individual result with highlighting
      SearchResultCard.test.tsx
      SearchFilters.tsx        # Faceted filter panel
      SearchFilters.test.tsx
      BackendSelector.tsx      # REST/GraphQL/MCP toggle
      BackendSelector.test.tsx
      SearchHistory.tsx        # Recent/favorite searches
      SearchHistory.test.tsx
      index.ts                 # Barrel export
  api/
    search.ts                  # REST API functions
    search.test.ts
    searchGraphQL.ts           # GraphQL queries (optional)
    searchGraphQL.test.ts
    searchMCP.ts               # MCP tool calls (optional)
    searchMCP.test.ts
    mocks/
      search.ts                # Mock data and handlers
      search.test.ts
  stores/
    searchStore.ts             # Search state management
    searchStore.test.ts
  pages/
    SearchPage.tsx             # Route page (thin wrapper)
```

### 3.6 Data Types

```typescript
// src/api/types.ts additions

// Backend mode selection
export type SearchBackendMode = 'rest' | 'graphql' | 'mcp' | 'mock';

// Search query parameters
export interface SearchQuery {
  query: string;
  topK?: number;
  filters?: SearchFilters;
}

// Filters for faceted search
export interface SearchFilters {
  fileTypes?: string[];       // e.g., ['.py', '.ts', '.md']
  dateFrom?: string;          // ISO date
  dateTo?: string;            // ISO date
  metadata?: Record<string, unknown>;
}

// Search result from backend
export interface KSSearchResult {
  docId: string;
  content: string;
  metadata: {
    file_path?: string;
    file_type?: string;
    language?: string;
    line_start?: number;
    line_end?: number;
    indexed_at?: string;
    [key: string]: unknown;
  };
  score: number;
  source: string;
}

// Full document
export interface KSDocument {
  docId: string;
  content: string;
  metadata: Record<string, unknown>;
}

// Search response wrapper
export interface SearchResponse {
  results: KSSearchResult[];
  total: number;
  query: string;
  took_ms?: number;
}

// Health check response
export interface KSHealthStatus {
  status: 'healthy' | 'unhealthy';
  backend: string;
  index_count?: number;
  document_count?: number;
}

// Saved search
export interface SavedSearch {
  id: string;
  query: string;
  filters?: SearchFilters;
  timestamp: string;
  isFavorite: boolean;
}
```

### 3.7 Search Store (Zustand)

```typescript
// src/stores/searchStore.ts

interface SearchState {
  // Current search
  query: string;
  filters: SearchFilters;
  results: KSSearchResult[];
  isLoading: boolean;
  error: string | null;

  // Pagination
  page: number;
  pageSize: number;
  total: number;

  // Backend mode
  backendMode: SearchBackendMode;

  // History
  recentSearches: SavedSearch[];
  favoriteSearches: SavedSearch[];

  // Actions
  setQuery: (query: string) => void;
  setFilters: (filters: SearchFilters) => void;
  setBackendMode: (mode: SearchBackendMode) => void;
  setResults: (results: KSSearchResult[], total: number) => void;
  setPage: (page: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  addToHistory: (search: SavedSearch) => void;
  toggleFavorite: (searchId: string) => void;
  clearHistory: () => void;
}
```

## 4. Component Specifications

### 4.1 SearchPage

Main container component orchestrating all search functionality.

**Layout:**
```
+------------------------------------------+
| Header: "Knowledge Search"               |
+------------------------------------------+
| SearchBar                                |
|   [Query Input                    ] [Go] |
|   [Backend: REST v] [Filters ^]          |
+------------------------------------------+
| SearchFilters (collapsible)              |
|   File Type: [ ] .py [ ] .ts [ ] .md     |
|   Date Range: [From] - [To]              |
+------------------------------------------+
| SearchHistory (recent/favorites)         |
+------------------------------------------+
| SearchResults                            |
|   Result 1 - filename.py (0.95)          |
|   Result 2 - module.ts (0.89)            |
|   ...                                    |
|   [< Prev] Page 1 of 5 [Next >]          |
+------------------------------------------+
```

**Props:** None (uses store and React Query)

### 4.2 SearchBar

Input field with integrated controls.

**Props:**
```typescript
interface SearchBarProps {
  onSearch: (query: string) => void;
  initialQuery?: string;
  isLoading?: boolean;
  showBackendSelector?: boolean;
  showFiltersToggle?: boolean;
  onFiltersToggle?: () => void;
  className?: string;
}
```

**Features:**
- Debounced input (300ms)
- Clear button when query present
- Enter key submits
- Keyboard shortcut (Cmd/Ctrl + K) focuses
- Loading indicator during search

### 4.3 SearchResults

List of search results with pagination.

**Props:**
```typescript
interface SearchResultsProps {
  results: KSSearchResult[];
  total: number;
  page: number;
  pageSize: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onResultClick: (result: KSSearchResult) => void;
  highlightTerms?: string[];
}
```

**Features:**
- Result count and timing
- Loading skeleton
- Empty state with suggestions
- Error state with retry
- Pagination controls

### 4.4 SearchResultCard

Individual search result display.

**Props:**
```typescript
interface SearchResultCardProps {
  result: KSSearchResult;
  highlightTerms?: string[];
  onClick?: () => void;
}
```

**Features:**
- File path with icon based on type
- Relevance score badge
- Content preview with term highlighting
- Line number range if available
- Metadata tags (language, indexed date)
- Click to view full document

### 4.5 SearchFilters

Faceted filter panel.

**Props:**
```typescript
interface SearchFiltersProps {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  availableFileTypes?: string[];
  isExpanded?: boolean;
}
```

**Features:**
- File type checkboxes (dynamic from results)
- Date range picker
- Clear all filters button
- Filter count indicator

### 4.6 BackendSelector

Toggle between backend modes.

**Props:**
```typescript
interface BackendSelectorProps {
  mode: SearchBackendMode;
  onChange: (mode: SearchBackendMode) => void;
  disabled?: boolean;
  showHealth?: boolean;
}
```

**Features:**
- Dropdown or segmented control
- Health indicator per backend
- Disabled state during search
- Tooltip explaining each mode

### 4.7 SearchHistory

Recent and favorite searches.

**Props:**
```typescript
interface SearchHistoryProps {
  recentSearches: SavedSearch[];
  favoriteSearches: SavedSearch[];
  onSelect: (search: SavedSearch) => void;
  onToggleFavorite: (searchId: string) => void;
  onClearHistory: () => void;
  maxRecent?: number;
}
```

**Features:**
- Collapsible sections
- Star to favorite
- Click to re-run search
- Clear history option
- Persist in localStorage

## 5. API Layer

### 5.1 Search Service Interface

```typescript
// src/api/searchService.ts

export interface SearchService {
  search(query: SearchQuery): Promise<SearchResponse>;
  getDocument(docId: string): Promise<KSDocument | null>;
  healthCheck(): Promise<KSHealthStatus>;
}

export function getSearchService(mode: SearchBackendMode): SearchService {
  switch (mode) {
    case 'rest':
      return restSearchService;
    case 'graphql':
      return graphqlSearchService;
    case 'mcp':
      return mcpSearchService;
    case 'mock':
    default:
      return mockSearchService;
  }
}
```

### 5.2 REST Implementation

```typescript
// src/api/search.ts

export const restSearchService: SearchService = {
  async search(query: SearchQuery): Promise<SearchResponse> {
    const response = await apiClient.post('/knowledge/search', {
      query: query.query,
      top_k: query.topK ?? 10,
      filters: query.filters,
    });
    return response.data;
  },

  async getDocument(docId: string): Promise<KSDocument | null> {
    try {
      const response = await apiClient.get(`/knowledge/document/${encodeURIComponent(docId)}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  async healthCheck(): Promise<KSHealthStatus> {
    const response = await apiClient.get('/knowledge/health');
    return response.data;
  },
};
```

### 5.3 Mock Implementation

```typescript
// src/api/mocks/search.ts

export const mockSearchResults: KSSearchResult[] = [
  {
    docId: 'src/core/interfaces.py:0',
    content: 'class KnowledgeStore(Protocol):\n    """Protocol for knowledge store backends.\n\n    Defines the interface that all knowledge store implementations must follow.',
    metadata: {
      file_path: 'src/core/interfaces.py',
      file_type: '.py',
      language: 'python',
      line_start: 14,
      line_end: 42,
      indexed_at: '2026-01-25T10:00:00Z',
    },
    score: 0.95,
    source: 'mock',
  },
  {
    docId: 'src/infrastructure/knowledge_store/elasticsearch_store.py:0',
    content: 'class ElasticsearchStore:\n    """Elasticsearch implementation of KnowledgeStore protocol.\n\n    Provides vector storage and semantic search using Elasticsearch',
    metadata: {
      file_path: 'src/infrastructure/knowledge_store/elasticsearch_store.py',
      file_type: '.py',
      language: 'python',
      line_start: 28,
      line_end: 95,
      indexed_at: '2026-01-25T10:00:00Z',
    },
    score: 0.89,
    source: 'mock',
  },
  // ... more mock results
];

export const mockSearchService: SearchService = {
  async search(query: SearchQuery): Promise<SearchResponse> {
    await delay(300); // Simulate network latency

    const filtered = mockSearchResults.filter(result => {
      // Basic query matching
      if (!result.content.toLowerCase().includes(query.query.toLowerCase())) {
        return false;
      }
      // Apply filters
      if (query.filters?.fileTypes?.length) {
        if (!query.filters.fileTypes.includes(result.metadata.file_type)) {
          return false;
        }
      }
      return true;
    });

    const topK = query.topK ?? 10;
    return {
      results: filtered.slice(0, topK),
      total: filtered.length,
      query: query.query,
      took_ms: 45,
    };
  },

  async getDocument(docId: string): Promise<KSDocument | null> {
    await delay(100);
    const result = mockSearchResults.find(r => r.docId === docId);
    if (!result) return null;
    return {
      docId: result.docId,
      content: result.content,
      metadata: result.metadata,
    };
  },

  async healthCheck(): Promise<KSHealthStatus> {
    return {
      status: 'healthy',
      backend: 'mock',
      index_count: 1,
      document_count: mockSearchResults.length,
    };
  },
};
```

### 5.4 React Query Hooks

```typescript
// src/api/search.ts

export function useSearch(query: SearchQuery | null, mode: SearchBackendMode) {
  return useQuery({
    queryKey: ['knowledge-search', query, mode],
    queryFn: () => getSearchService(mode).search(query!),
    enabled: !!query?.query,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useDocument(docId: string | null, mode: SearchBackendMode) {
  return useQuery({
    queryKey: ['knowledge-document', docId, mode],
    queryFn: () => getSearchService(mode).getDocument(docId!),
    enabled: !!docId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useKnowledgeHealth(mode: SearchBackendMode) {
  return useQuery({
    queryKey: ['knowledge-health', mode],
    queryFn: () => getSearchService(mode).healthCheck(),
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 60 * 1000,
  });
}
```

## 6. State Management

### 6.1 Search Store Implementation

```typescript
// src/stores/searchStore.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const MAX_RECENT_SEARCHES = 10;

export const useSearchStore = create<SearchState>()(
  persist(
    (set, get) => ({
      // Initial state
      query: '',
      filters: {},
      results: [],
      isLoading: false,
      error: null,
      page: 1,
      pageSize: 10,
      total: 0,
      backendMode: (import.meta.env.VITE_SEARCH_BACKEND as SearchBackendMode) || 'mock',
      recentSearches: [],
      favoriteSearches: [],

      // Actions
      setQuery: (query) => set({ query, page: 1 }),
      setFilters: (filters) => set({ filters, page: 1 }),
      setBackendMode: (mode) => set({ backendMode: mode }),
      setResults: (results, total) => set({ results, total }),
      setPage: (page) => set({ page }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      addToHistory: (search) => set((state) => {
        const recent = [
          search,
          ...state.recentSearches.filter(s => s.query !== search.query)
        ].slice(0, MAX_RECENT_SEARCHES);
        return { recentSearches: recent };
      }),

      toggleFavorite: (searchId) => set((state) => {
        const search = [...state.recentSearches, ...state.favoriteSearches]
          .find(s => s.id === searchId);
        if (!search) return state;

        if (search.isFavorite) {
          return {
            favoriteSearches: state.favoriteSearches.filter(s => s.id !== searchId),
            recentSearches: state.recentSearches.map(s =>
              s.id === searchId ? { ...s, isFavorite: false } : s
            ),
          };
        } else {
          return {
            favoriteSearches: [...state.favoriteSearches, { ...search, isFavorite: true }],
            recentSearches: state.recentSearches.map(s =>
              s.id === searchId ? { ...s, isFavorite: true } : s
            ),
          };
        }
      }),

      clearHistory: () => set({ recentSearches: [] }),
    }),
    {
      name: 'knowledge-search-store',
      partialize: (state) => ({
        recentSearches: state.recentSearches,
        favoriteSearches: state.favoriteSearches,
        backendMode: state.backendMode,
      }),
    }
  )
);
```

## 7. Routing

Add route to existing router:

```typescript
// App.tsx additions
import SearchPage from './pages/SearchPage';

<Route path="search" element={<SearchPage />} />
```

Add navigation item to sidebar/header.

## 8. UI Patterns

### 8.1 Following Existing DocSearch Pattern

The existing `DocSearch.tsx` component provides these patterns to follow:
- Fuzzy search scoring
- Keyboard navigation (ArrowUp/Down, Enter, Escape)
- Recent searches in localStorage
- Debounced input
- Result grouping and highlighting

### 8.2 Syntax Highlighting

Use existing `CodeDiff` or `MarkdownRenderer` patterns for code snippets:

```typescript
// Highlight search terms in content
function highlightTerms(content: string, terms: string[]): React.ReactNode {
  if (!terms.length) return content;

  const regex = new RegExp(`(${terms.join('|')})`, 'gi');
  const parts = content.split(regex);

  return parts.map((part, i) =>
    terms.some(t => t.toLowerCase() === part.toLowerCase())
      ? <mark key={i} className="bg-accent-teal/30 text-inherit">{part}</mark>
      : part
  );
}
```

### 8.3 Loading States

Follow existing `LoadingStates.tsx` patterns:
- Skeleton for results list
- Spinner for search button
- Pulse animation for cards

### 8.4 Empty States

Follow existing `EmptyState.tsx` pattern:
- Icon, message, and suggestion
- Different states: no query, no results, error

## 9. Accessibility

- Search input has proper `aria-label`
- Results list uses `role="listbox"` with `role="option"` items
- Keyboard navigation: Tab, ArrowUp/Down, Enter, Escape
- Focus management when results load
- Screen reader announcements for result count
- Color contrast for score badges and highlights

## 10. Performance Considerations

1. **Debounced Search:** 300ms debounce on input
2. **Query Caching:** React Query caches results
3. **Pagination:** Server-side pagination via top_k and offset
4. **Virtual Scrolling:** Consider for large result sets (future)
5. **Lazy Loading:** Load document content on demand

## 11. Error Handling

- Network errors show retry button
- Backend unhealthy shows status message
- Invalid queries show validation message
- Rate limiting shows backoff message

## 12. Testing Strategy

### 12.1 Unit Tests

- Each component with mocked props
- Search service implementations
- Store actions and selectors
- Utility functions (highlighting, filtering)

### 12.2 Integration Tests

- Full search flow with mock backend
- Backend switching
- Filter application
- Pagination
- History management

### 12.3 Test Coverage Targets

- Components: 80%+
- API layer: 90%+
- Store: 95%+

## 13. Migration Path

1. Create mock data layer and service interface
2. Build components with mock backend
3. Implement REST backend integration
4. Add GraphQL backend (optional)
5. Add MCP backend (optional)
6. Remove development-only code for production

## 14. Open Questions

1. Should we support search suggestions/autocomplete?
2. Should we add export functionality (CSV, JSON)?
3. Should we support saved search alerts?
4. How should we handle very long code snippets in results?

## 15. Future Enhancements

- Real-time search suggestions
- Search analytics dashboard
- Saved search notifications
- Code context expansion (show surrounding lines)
- Integration with IDE (open in editor)
- Search result bookmarking
