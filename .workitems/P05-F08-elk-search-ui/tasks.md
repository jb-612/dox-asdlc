# P05-F08 ELK Search UI - Tasks

**Version:** 1.0
**Date:** 2026-01-25
**Status:** Draft

## Progress Summary

| Phase | Tasks | Completed | Progress |
|-------|-------|-----------|----------|
| Setup & Foundation | 3 | 3 | 100% |
| Core Components | 7 | 7 | 100% |
| API Layer | 4 | 4 | 100% |
| State Management | 2 | 2 | 100% |
| Page Integration | 3 | 3 | 100% |
| Polish & Testing | 3 | 3 | 100% |
| **Total** | **22** | **22** | **100%** |

---

## Phase 1: Setup & Foundation (3 tasks)

### Task 1.1: Create Type Definitions
**Estimate:** 30 min | **Status:** Complete
**Depends on:** None

**Description:**
Add KnowledgeStore search types to the existing types file.

**Steps:**
1. Open `docker/hitl-ui/src/api/types.ts`
2. Add `SearchBackendMode`, `SearchQuery`, `SearchFilters` types
3. Add `KSSearchResult`, `KSDocument`, `SearchResponse` types
4. Add `KSHealthStatus`, `SavedSearch` types
5. Export all new types

**Acceptance Criteria:**
- [x] All types defined as specified in design.md
- [x] Types are exported from types.ts
- [x] No TypeScript errors in the file

**Test:**
```typescript
// Types should compile without errors
import type {
  SearchBackendMode,
  SearchQuery,
  KSSearchResult,
  SearchResponse,
} from './types';

const mode: SearchBackendMode = 'rest';
const query: SearchQuery = { query: 'test', topK: 10 };
```

---

### Task 1.2: Create Mock Data for Search
**Estimate:** 45 min | **Status:** Complete
**Depends on:** Task 1.1

**Description:**
Create comprehensive mock data for search development and testing.

**Steps:**
1. Create `docker/hitl-ui/src/api/mocks/search.ts`
2. Add 15+ mock search results covering different file types
3. Add mock documents with realistic content
4. Add delay helper for simulating latency
5. Export from `docker/hitl-ui/src/api/mocks/index.ts`

**Acceptance Criteria:**
- [x] mockSearchResults array has 15+ diverse entries
- [x] Results include .py, .ts, .tsx, .md, .json files
- [x] Each result has complete metadata (file_path, language, line numbers)
- [x] Mock data follows KSSearchResult interface

**Test:**
```typescript
// src/api/mocks/search.test.ts
describe('search mock data', () => {
  it('has at least 15 mock results', () => {
    expect(mockSearchResults.length).toBeGreaterThanOrEqual(15);
  });

  it('includes various file types', () => {
    const types = new Set(mockSearchResults.map(r => r.metadata.file_type));
    expect(types.has('.py')).toBe(true);
    expect(types.has('.ts')).toBe(true);
    expect(types.has('.md')).toBe(true);
  });

  it('all results have required fields', () => {
    mockSearchResults.forEach(result => {
      expect(result).toHaveProperty('docId');
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('score');
      expect(result.metadata).toHaveProperty('file_path');
    });
  });
});
```

---

### Task 1.3: Create Component File Structure
**Estimate:** 15 min | **Status:** Complete
**Depends on:** None

**Description:**
Create the directory structure and empty component files with barrel exports.

**Steps:**
1. Create `docker/hitl-ui/src/components/search/` directory
2. Create empty component files: SearchPage.tsx, SearchBar.tsx, SearchResults.tsx, SearchResultCard.tsx, SearchFilters.tsx, BackendSelector.tsx, SearchHistory.tsx
3. Create corresponding test files for each component
4. Create `index.ts` barrel export

**Acceptance Criteria:**
- [x] All component files exist with basic React component structure
- [x] All test files exist with describe block
- [x] index.ts exports all components
- [x] No import errors

**Test:**
```typescript
// Verify imports work
import {
  SearchPage,
  SearchBar,
  SearchResults,
  SearchResultCard,
  SearchFilters,
  BackendSelector,
  SearchHistory,
} from '../components/search';
```

---

## Phase 2: Core Components (7 tasks)

### Task 2.1: Implement SearchBar Component
**Estimate:** 1.5 hr | **Status:** Complete
**Depends on:** Task 1.3
**User Story:** US-1, US-8

**Description:**
Build the search input component with debouncing, clear button, and keyboard support.

**Steps:**
1. Write failing tests for SearchBar behavior
2. Implement input with debounce (300ms)
3. Add clear button that appears when query is present
4. Add loading indicator prop
5. Implement Enter to submit, Escape to clear
6. Add Cmd/Ctrl+K keyboard shortcut listener
7. Style with Tailwind following existing patterns

**Acceptance Criteria:**
- [x] Input has proper aria-label
- [x] Debounce delays onSearch callback by 300ms
- [x] Clear button clears input and calls onClear
- [x] Enter key calls onSearch immediately
- [x] Escape key clears input
- [x] Loading state shows spinner in button
- [x] Follows SearchInput.tsx pattern

**Test:**
```typescript
// src/components/search/SearchBar.test.tsx
describe('SearchBar', () => {
  it('renders input with placeholder', () => {
    render(<SearchBar onSearch={vi.fn()} />);
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it('debounces onSearch callback', async () => {
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} debounceMs={100} />);
    const input = screen.getByRole('textbox');

    await userEvent.type(input, 'test');
    expect(onSearch).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(onSearch).toHaveBeenCalledWith('test');
    }, { timeout: 200 });
  });

  it('clears input on Escape', async () => {
    render(<SearchBar onSearch={vi.fn()} />);
    const input = screen.getByRole('textbox');

    await userEvent.type(input, 'query');
    await userEvent.keyboard('{Escape}');

    expect(input).toHaveValue('');
  });

  it('submits immediately on Enter', async () => {
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} />);
    const input = screen.getByRole('textbox');

    await userEvent.type(input, 'query{Enter}');
    expect(onSearch).toHaveBeenCalledWith('query');
  });
});
```

---

### Task 2.2: Implement SearchResultCard Component
**Estimate:** 1.5 hr | **Status:** Complete
**Depends on:** Task 1.1
**User Story:** US-2

**Description:**
Build the individual result card with file info, score, and highlighted content.

**Steps:**
1. Write failing tests for SearchResultCard
2. Implement card layout with file icon based on extension
3. Add file path display with line range
4. Add relevance score badge
5. Implement content preview with term highlighting
6. Add language/metadata tags
7. Implement click handler for card

**Acceptance Criteria:**
- [x] Shows appropriate file icon (.py = Python icon, etc.)
- [x] Displays file path and line range
- [x] Shows score as percentage badge
- [x] Highlights search terms in content preview
- [x] Shows language tag
- [x] Card is clickable and calls onClick
- [x] Proper accessibility (button or link role)

**Test:**
```typescript
// src/components/search/SearchResultCard.test.tsx
describe('SearchResultCard', () => {
  const mockResult: KSSearchResult = {
    docId: 'src/core/interfaces.py:14',
    content: 'class KnowledgeStore(Protocol):',
    metadata: {
      file_path: 'src/core/interfaces.py',
      file_type: '.py',
      language: 'python',
      line_start: 14,
      line_end: 42,
    },
    score: 0.95,
    source: 'mock',
  };

  it('displays file path', () => {
    render(<SearchResultCard result={mockResult} />);
    expect(screen.getByText('src/core/interfaces.py')).toBeInTheDocument();
  });

  it('displays line range', () => {
    render(<SearchResultCard result={mockResult} />);
    expect(screen.getByText(/14-42/)).toBeInTheDocument();
  });

  it('displays score as percentage', () => {
    render(<SearchResultCard result={mockResult} />);
    expect(screen.getByText('95%')).toBeInTheDocument();
  });

  it('highlights search terms', () => {
    render(<SearchResultCard result={mockResult} highlightTerms={['KnowledgeStore']} />);
    expect(screen.getByText('KnowledgeStore').tagName).toBe('MARK');
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    render(<SearchResultCard result={mockResult} onClick={onClick} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });
});
```

---

### Task 2.3: Implement SearchResults Component
**Estimate:** 1.5 hr | **Status:** Complete
**Depends on:** Task 2.2
**User Story:** US-1, US-7

**Description:**
Build the results list container with pagination and loading states.

**Steps:**
1. Write failing tests for SearchResults
2. Implement results list rendering
3. Add loading skeleton state
4. Add empty state component
5. Add error state with retry button
6. Implement pagination controls
7. Add result count display

**Acceptance Criteria:**
- [x] Renders list of SearchResultCard components
- [x] Shows loading skeleton during fetch
- [x] Shows empty state when no results
- [x] Shows error state with retry button
- [x] Pagination shows page numbers and navigation
- [x] Displays "Showing X-Y of Z results"
- [ ] Keyboard navigation through results (ArrowUp/Down) (deferred to polish phase)

**Test:**
```typescript
// src/components/search/SearchResults.test.tsx
describe('SearchResults', () => {
  it('renders result cards', () => {
    render(
      <SearchResults
        results={mockSearchResults.slice(0, 3)}
        total={3}
        page={1}
        pageSize={10}
        isLoading={false}
        onPageChange={vi.fn()}
        onResultClick={vi.fn()}
      />
    );
    expect(screen.getAllByTestId(/^search-result-/)).toHaveLength(3);
  });

  it('shows loading skeleton', () => {
    render(
      <SearchResults
        results={[]}
        total={0}
        page={1}
        pageSize={10}
        isLoading={true}
        onPageChange={vi.fn()}
        onResultClick={vi.fn()}
      />
    );
    expect(screen.getByTestId('results-skeleton')).toBeInTheDocument();
  });

  it('shows empty state when no results', () => {
    render(
      <SearchResults
        results={[]}
        total={0}
        page={1}
        pageSize={10}
        isLoading={false}
        onPageChange={vi.fn()}
        onResultClick={vi.fn()}
      />
    );
    expect(screen.getByText(/no results/i)).toBeInTheDocument();
  });

  it('shows pagination for multiple pages', () => {
    render(
      <SearchResults
        results={mockSearchResults.slice(0, 10)}
        total={25}
        page={1}
        pageSize={10}
        isLoading={false}
        onPageChange={vi.fn()}
        onResultClick={vi.fn()}
      />
    );
    expect(screen.getByText('Showing 1-10 of 25')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
  });
});
```

---

### Task 2.4: Implement SearchFilters Component
**Estimate:** 1.5 hr | **Status:** Complete
**Depends on:** Task 1.1
**User Story:** US-3

**Description:**
Build the filter panel with file type checkboxes and date range.

**Steps:**
1. Write failing tests for SearchFilters
2. Implement collapsible panel
3. Add file type checkbox group
4. Add date range inputs (from/to)
5. Add "Clear all" button
6. Implement filter count badge
7. Call onChange when filters change

**Acceptance Criteria:**
- [x] Panel collapses/expands on toggle
- [x] File type checkboxes for .py, .ts, .tsx, .md, .json
- [x] Date range uses proper date inputs
- [x] onChange called with updated filters
- [x] Clear all resets all filters
- [x] Filter count badge shows active filter count

**Test:**
```typescript
// src/components/search/SearchFilters.test.tsx
describe('SearchFilters', () => {
  it('renders file type checkboxes', () => {
    render(<SearchFilters filters={{}} onChange={vi.fn()} />);
    expect(screen.getByLabelText('.py')).toBeInTheDocument();
    expect(screen.getByLabelText('.ts')).toBeInTheDocument();
    expect(screen.getByLabelText('.md')).toBeInTheDocument();
  });

  it('calls onChange when file type checked', async () => {
    const onChange = vi.fn();
    render(<SearchFilters filters={{}} onChange={onChange} />);

    await userEvent.click(screen.getByLabelText('.py'));
    expect(onChange).toHaveBeenCalledWith({ fileTypes: ['.py'] });
  });

  it('shows filter count badge', () => {
    render(
      <SearchFilters
        filters={{ fileTypes: ['.py', '.ts'], dateFrom: '2026-01-01' }}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByTestId('filter-count')).toHaveTextContent('3');
  });

  it('clears all filters', async () => {
    const onChange = vi.fn();
    render(
      <SearchFilters
        filters={{ fileTypes: ['.py'] }}
        onChange={onChange}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /clear/i }));
    expect(onChange).toHaveBeenCalledWith({});
  });
});
```

---

### Task 2.5: Implement BackendSelector Component
**Estimate:** 1 hr | **Status:** Complete
**Depends on:** Task 1.1
**User Story:** US-4

**Description:**
Build the backend mode dropdown with health indicator.

**Steps:**
1. Write failing tests for BackendSelector
2. Implement dropdown with REST, GraphQL, MCP, Mock options
3. Add health indicator dot (green/red)
4. Add tooltip explaining each mode
5. Implement onChange callback
6. Add disabled state during search

**Acceptance Criteria:**
- [x] Dropdown shows all backend modes
- [x] Health indicator shows status
- [x] Uses useKnowledgeHealth hook for status indicator
- [x] onChange called with selected mode
- [ ] Tooltips explain each mode (deferred to polish phase)
- [x] Can be disabled

**Test:**
```typescript
// src/components/search/BackendSelector.test.tsx
describe('BackendSelector', () => {
  it('renders with current mode selected', () => {
    render(<BackendSelector mode="rest" onChange={vi.fn()} />);
    expect(screen.getByRole('combobox')).toHaveValue('rest');
  });

  it('shows all backend options', async () => {
    render(<BackendSelector mode="rest" onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole('combobox'));

    expect(screen.getByRole('option', { name: /rest/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /graphql/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /mcp/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /mock/i })).toBeInTheDocument();
  });

  it('calls onChange when mode selected', async () => {
    const onChange = vi.fn();
    render(<BackendSelector mode="rest" onChange={onChange} />);

    await userEvent.selectOptions(screen.getByRole('combobox'), 'mock');
    expect(onChange).toHaveBeenCalledWith('mock');
  });

  it('shows health indicator', () => {
    render(<BackendSelector mode="mock" onChange={vi.fn()} showHealth />);
    expect(screen.getByTestId('health-indicator')).toHaveClass('bg-green-500');
  });
});
```

---

### Task 2.6: Implement SearchHistory Component
**Estimate:** 1.5 hr | **Status:** Complete
**Depends on:** Task 1.1
**User Story:** US-5, US-6

**Description:**
Build the recent and favorite searches panel.

**Steps:**
1. Write failing tests for SearchHistory
2. Implement favorites section (collapsible)
3. Implement recent searches section
4. Add star toggle for favorites
5. Add click to re-run search
6. Add clear history button
7. Show timestamps

**Acceptance Criteria:**
- [x] Favorites section shows above recent
- [x] Each item shows query and relative timestamp
- [x] Star icon toggles favorite state
- [x] Click on item calls onSelect
- [x] Clear history button calls onClearHistory
- [ ] Sections are collapsible (deferred to polish phase)

**Test:**
```typescript
// src/components/search/SearchHistory.test.tsx
describe('SearchHistory', () => {
  const mockRecent: SavedSearch[] = [
    { id: '1', query: 'test query', timestamp: new Date().toISOString(), isFavorite: false },
    { id: '2', query: 'another query', timestamp: new Date().toISOString(), isFavorite: false },
  ];

  const mockFavorites: SavedSearch[] = [
    { id: '3', query: 'favorite query', timestamp: new Date().toISOString(), isFavorite: true },
  ];

  it('renders recent searches', () => {
    render(
      <SearchHistory
        recentSearches={mockRecent}
        favoriteSearches={[]}
        onSelect={vi.fn()}
        onToggleFavorite={vi.fn()}
        onClearHistory={vi.fn()}
      />
    );
    expect(screen.getByText('test query')).toBeInTheDocument();
    expect(screen.getByText('another query')).toBeInTheDocument();
  });

  it('renders favorites above recent', () => {
    render(
      <SearchHistory
        recentSearches={mockRecent}
        favoriteSearches={mockFavorites}
        onSelect={vi.fn()}
        onToggleFavorite={vi.fn()}
        onClearHistory={vi.fn()}
      />
    );
    const sections = screen.getAllByRole('region');
    expect(sections[0]).toHaveTextContent('Favorites');
    expect(sections[1]).toHaveTextContent('Recent');
  });

  it('calls onSelect when item clicked', async () => {
    const onSelect = vi.fn();
    render(
      <SearchHistory
        recentSearches={mockRecent}
        favoriteSearches={[]}
        onSelect={onSelect}
        onToggleFavorite={vi.fn()}
        onClearHistory={vi.fn()}
      />
    );
    await userEvent.click(screen.getByText('test query'));
    expect(onSelect).toHaveBeenCalledWith(mockRecent[0]);
  });

  it('calls onToggleFavorite when star clicked', async () => {
    const onToggleFavorite = vi.fn();
    render(
      <SearchHistory
        recentSearches={mockRecent}
        favoriteSearches={[]}
        onSelect={vi.fn()}
        onToggleFavorite={onToggleFavorite}
        onClearHistory={vi.fn()}
      />
    );
    await userEvent.click(screen.getAllByTestId('star-button')[0]);
    expect(onToggleFavorite).toHaveBeenCalledWith('1');
  });
});
```

---

### Task 2.7: Implement SearchPage Component
**Estimate:** 1.5 hr | **Status:** Complete
**Depends on:** Tasks 2.1-2.6
**User Story:** US-1, US-9

**Description:**
Build the main search page composing all components.

**Steps:**
1. Write failing tests for SearchPage layout
2. Compose SearchBar, BackendSelector in header
3. Add collapsible SearchFilters below header
4. Add SearchHistory sidebar/section
5. Add SearchResults main area
6. Wire up state and callbacks
7. Implement responsive layout

**Acceptance Criteria:**
- [x] All components render in correct positions
- [x] Search triggers API call
- [x] Filters update results
- [x] Backend mode switches work
- [x] History updates on search
- [x] Responsive on mobile/desktop
- [x] Proper loading/error states

**Test:**
```typescript
// src/components/search/SearchPage.test.tsx
describe('SearchPage', () => {
  it('renders all sections', () => {
    render(<SearchPage />);
    expect(screen.getByTestId('search-bar')).toBeInTheDocument();
    expect(screen.getByTestId('backend-selector')).toBeInTheDocument();
    expect(screen.getByTestId('search-filters')).toBeInTheDocument();
    expect(screen.getByTestId('search-results')).toBeInTheDocument();
  });

  it('performs search on submit', async () => {
    render(<SearchPage />);
    const input = screen.getByRole('textbox');

    await userEvent.type(input, 'KnowledgeStore{Enter}');

    await waitFor(() => {
      expect(screen.getByTestId('search-results')).not.toHaveTextContent(/loading/i);
    });
  });

  it('updates history after search', async () => {
    render(<SearchPage />);
    const input = screen.getByRole('textbox');

    await userEvent.type(input, 'test query{Enter}');

    await waitFor(() => {
      expect(screen.getByText('test query')).toBeInTheDocument();
    });
  });
});
```

---

## Phase 3: API Layer (4 tasks)

### Task 3.1: Implement Search Service Interface
**Estimate:** 30 min | **Status:** Complete
**Depends on:** Task 1.1
**User Story:** US-4

**Description:**
Create the abstract search service interface and factory.

**Steps:**
1. Create `docker/hitl-ui/src/api/searchService.ts`
2. Define SearchService interface
3. Implement getSearchService factory function
4. Export from api/index.ts

**Acceptance Criteria:**
- [x] SearchService interface with search, getDocument, healthCheck
- [x] Factory returns correct service for each mode
- [x] Default mode from environment variable

**Test:**
```typescript
// src/api/searchService.test.ts
describe('searchService', () => {
  it('returns mock service for mock mode', () => {
    const service = getSearchService('mock');
    expect(service).toBe(mockSearchService);
  });

  it('returns rest service for rest mode', () => {
    const service = getSearchService('rest');
    expect(service).toBe(restSearchService);
  });
});
```

---

### Task 3.2: Implement Mock Search Service
**Estimate:** 1 hr | **Status:** Complete
**Depends on:** Tasks 1.2, 3.1
**User Story:** US-4

**Description:**
Implement the mock backend for development.

**Steps:**
1. Implement search function with filtering and delay
2. Implement getDocument function
3. Implement healthCheck function
4. Add fuzzy matching for realistic results

**Acceptance Criteria:**
- [x] search filters by query match
- [x] search applies file type and date filters
- [x] search respects topK parameter
- [x] Simulates network latency (100-500ms)
- [x] getDocument returns mock or null
- [x] healthCheck returns healthy status

**Test:**
```typescript
// src/api/mocks/search.test.ts
describe('mockSearchService', () => {
  it('search returns filtered results', async () => {
    const results = await mockSearchService.search({
      query: 'KnowledgeStore',
      topK: 5,
    });
    expect(results.results.length).toBeLessThanOrEqual(5);
    results.results.forEach(r => {
      expect(r.content.toLowerCase()).toContain('knowledge');
    });
  });

  it('search applies file type filter', async () => {
    const results = await mockSearchService.search({
      query: 'test',
      filters: { fileTypes: ['.py'] },
    });
    results.results.forEach(r => {
      expect(r.metadata.file_type).toBe('.py');
    });
  });

  it('getDocument returns document or null', async () => {
    const doc = await mockSearchService.getDocument('src/core/interfaces.py:0');
    expect(doc).not.toBeNull();

    const missing = await mockSearchService.getDocument('nonexistent');
    expect(missing).toBeNull();
  });
});
```

---

### Task 3.3: Implement REST Search Service
**Estimate:** 1 hr | **Status:** Complete
**Depends on:** Task 3.1
**User Story:** US-4

**Description:**
Implement REST API calls to the KnowledgeStore backend.

**Steps:**
1. Create `docker/hitl-ui/src/api/searchREST.ts`
2. Implement search using POST /api/knowledge/search
3. Implement getDocument using GET /api/knowledge/document/:id
4. Implement healthCheck using GET /api/knowledge/health
5. Add proper error handling

**Acceptance Criteria:**
- [x] Uses existing apiClient with tenant header
- [x] Handles 404 for missing documents
- [x] Handles network errors gracefully
- [x] Request/response matches API contract
- [x] Handles snake_case to camelCase conversion (doc_id -> docId, top_k -> topK)

**Test:**
```typescript
// src/api/search.test.ts
describe('restSearchService', () => {
  beforeEach(() => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: { results: [], total: 0, query: 'test' },
    });
  });

  it('calls correct endpoint for search', async () => {
    await restSearchService.search({ query: 'test' });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/knowledge/search',
      expect.objectContaining({ query: 'test' })
    );
  });

  it('handles 404 for getDocument', async () => {
    vi.mocked(apiClient.get).mockRejectedValue({
      isAxiosError: true,
      response: { status: 404 },
    });
    const result = await restSearchService.getDocument('missing');
    expect(result).toBeNull();
  });
});
```

---

### Task 3.4: Implement React Query Hooks
**Estimate:** 1 hr | **Status:** Complete
**Depends on:** Tasks 3.2, 3.3
**User Story:** US-1

**Description:**
Create React Query hooks for search operations.

**Steps:**
1. Create `docker/hitl-ui/src/api/searchHooks.ts`
2. Implement useSearch hook with query parameter
3. Implement useDocument hook
4. Implement useKnowledgeHealth hook
5. Configure caching and refetch settings

**Acceptance Criteria:**
- [x] useSearch enabled only when query provided
- [x] useDocument enabled only when docId provided
- [x] Proper stale times configured
- [x] Health check auto-refetches every minute

**Test:**
```typescript
// src/api/search.test.ts
describe('search hooks', () => {
  it('useSearch returns results', async () => {
    const { result } = renderHook(() =>
      useSearch({ query: 'test', topK: 10 }, 'mock')
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.results).toBeDefined();
  });

  it('useSearch is disabled without query', () => {
    const { result } = renderHook(() => useSearch(null, 'mock'));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it('useKnowledgeHealth auto-refetches', async () => {
    const { result } = renderHook(() => useKnowledgeHealth('mock'));

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.status).toBe('healthy');
  });
});
```

---

### Task 3.5: Implement GraphQL Search Service (Deferred)
**Estimate:** 1.5 hr | **Status:** [ ] Deferred
**Depends on:** Task 3.1
**User Story:** US-4

Implement GraphQL backend mode for search operations.

**Acceptance Criteria:**
- [ ] Create `src/api/searchGraphQL.ts` implementing `SearchService` interface
- [ ] Define GraphQL queries for search, getDocument, healthCheck
- [ ] Integrate with Apollo Client or urql if added to project
- [ ] Add tests for GraphQL service

**Note:** Deferred until GraphQL backend endpoint is available.

---

### Task 3.6: Implement MCP Search Service (Deferred)
**Estimate:** 1.5 hr | **Status:** [ ] Deferred
**Depends on:** Task 3.1
**User Story:** US-4

Implement MCP backend mode for search operations using MCP tool calls.

**Acceptance Criteria:**
- [ ] Create `src/api/searchMCP.ts` implementing `SearchService` interface
- [ ] Use MCP tool invocation pattern (ks_search, ks_get)
- [ ] Handle MCP connection state
- [ ] Add tests for MCP service

**Note:** Deferred until MCP server integration is available in HITL UI.

---

## Phase 4: State Management (2 tasks)

### Task 4.1: Implement Search Store
**Estimate:** 1.5 hr | **Status:** Complete
**Depends on:** Task 1.1
**User Story:** US-5, US-6

**Description:**
Create Zustand store for search state management.

**Steps:**
1. Create `docker/hitl-ui/src/stores/searchStore.ts`
2. Implement state: query, filters, results, pagination
3. Implement history: recent and favorites
4. Add persist middleware for history
5. Implement all actions
6. Write tests

**Acceptance Criteria:**
- [x] State matches design spec
- [x] Actions update state correctly
- [x] History persisted to localStorage
- [x] Max 10 recent searches enforced
- [x] Favorites not cleared by clearHistory

**Test:**
```typescript
// src/stores/searchStore.test.ts
describe('searchStore', () => {
  beforeEach(() => {
    useSearchStore.getState().clearHistory();
  });

  it('setQuery updates query and resets page', () => {
    useSearchStore.getState().setPage(3);
    useSearchStore.getState().setQuery('new query');

    expect(useSearchStore.getState().query).toBe('new query');
    expect(useSearchStore.getState().page).toBe(1);
  });

  it('addToHistory adds search to recent', () => {
    const search: SavedSearch = {
      id: '1',
      query: 'test',
      timestamp: new Date().toISOString(),
      isFavorite: false,
    };

    useSearchStore.getState().addToHistory(search);
    expect(useSearchStore.getState().recentSearches).toContainEqual(search);
  });

  it('limits recent searches to 10', () => {
    for (let i = 0; i < 15; i++) {
      useSearchStore.getState().addToHistory({
        id: `${i}`,
        query: `query ${i}`,
        timestamp: new Date().toISOString(),
        isFavorite: false,
      });
    }
    expect(useSearchStore.getState().recentSearches.length).toBe(10);
  });

  it('toggleFavorite adds to favorites', () => {
    const search: SavedSearch = {
      id: '1',
      query: 'test',
      timestamp: new Date().toISOString(),
      isFavorite: false,
    };

    useSearchStore.getState().addToHistory(search);
    useSearchStore.getState().toggleFavorite('1');

    expect(useSearchStore.getState().favoriteSearches).toHaveLength(1);
  });
});
```

---

### Task 4.2: Integrate Store with Components
**Estimate:** 1 hr | **Status:** Complete
**Depends on:** Tasks 2.7, 4.1
**User Story:** US-1

**Description:**
Wire up the search store to SearchPage components.

**Steps:**
1. Connect SearchBar to store query
2. Connect SearchFilters to store filters
3. Connect BackendSelector to store mode
4. Connect SearchResults to store results/pagination
5. Connect SearchHistory to store history
6. Update SearchPage to use store

**Acceptance Criteria:**
- [x] Components read from store
- [x] Components dispatch actions to store
- [x] State changes trigger re-renders
- [x] History persists on page refresh

**Test:**
```typescript
// src/components/search/SearchPage.integration.test.tsx
describe('SearchPage store integration', () => {
  it('search updates store and UI', async () => {
    render(<SearchPage />);

    await userEvent.type(screen.getByRole('textbox'), 'test{Enter}');

    await waitFor(() => {
      expect(useSearchStore.getState().query).toBe('test');
      expect(screen.queryByTestId('results-skeleton')).not.toBeInTheDocument();
    });
  });

  it('filter changes update results', async () => {
    render(<SearchPage />);

    // First search
    await userEvent.type(screen.getByRole('textbox'), 'code{Enter}');
    await waitFor(() => expect(screen.queryByTestId('results-skeleton')).not.toBeInTheDocument());

    // Apply filter
    await userEvent.click(screen.getByLabelText('.py'));

    await waitFor(() => {
      expect(useSearchStore.getState().filters.fileTypes).toContain('.py');
    });
  });
});
```

---

## Phase 5: Page Integration (3 tasks)

### Task 5.1: Add Search Route
**Estimate:** 30 min | **Status:** Complete
**Depends on:** Task 2.7
**User Story:** US-1

**Description:**
Add the search page route to the application router.

**Steps:**
1. Import SearchPage in App.tsx
2. Add route path="/search"
3. Add navigation link in sidebar/header
4. Add route icon (magnifying glass)

**Acceptance Criteria:**
- [x] /search route renders SearchPage
- [x] Navigation link visible in sidebar
- [x] Active state shown when on search page

**Test:**
```typescript
// src/App.test.tsx
describe('Search route', () => {
  it('renders SearchPage at /search', () => {
    render(
      <MemoryRouter initialEntries={['/search']}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByTestId('search-page')).toBeInTheDocument();
  });
});
```

---

### Task 5.2: Create Document Detail Modal/Page
**Estimate:** 1.5 hr | **Status:** Complete
**Depends on:** Task 3.4
**User Story:** US-2

**Description:**
Create view for displaying full document content from search results.

**Steps:**
1. Create DocumentDetail component
2. Fetch document content using useDocument hook
3. Display content with syntax highlighting
4. Add close/back navigation
5. Show loading state while fetching

**Acceptance Criteria:**
- [x] Fetches document by docId
- [x] Shows syntax-highlighted content
- [x] Shows file metadata (path, language, lines)
- [x] Has close/back button
- [x] Shows loading state
- [x] Shows error if document not found

**Test:**
```typescript
// src/components/search/DocumentDetail.test.tsx
describe('DocumentDetail', () => {
  it('fetches and displays document', async () => {
    render(<DocumentDetail docId="src/core/interfaces.py:0" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/class KnowledgeStore/)).toBeInTheDocument();
    });
  });

  it('shows loading state', () => {
    render(<DocumentDetail docId="loading" onClose={vi.fn()} />);
    expect(screen.getByTestId('document-loading')).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', async () => {
    const onClose = vi.fn();
    render(<DocumentDetail docId="src/core/interfaces.py:0" onClose={onClose} />);

    await waitFor(() => screen.getByRole('button', { name: /close/i }));
    await userEvent.click(screen.getByRole('button', { name: /close/i }));

    expect(onClose).toHaveBeenCalled();
  });
});
```

---

### Task 5.3: Wire Search Result Click to Document View
**Estimate:** 45 min | **Status:** Complete
**Depends on:** Tasks 2.7, 5.2
**User Story:** US-2

**Description:**
Connect search result clicks to document detail view.

**Steps:**
1. Add selectedDocId state to SearchPage
2. Handle result click to set selectedDocId
3. Render DocumentDetail when docId selected
4. Handle close to clear selection
5. Test complete flow

**Acceptance Criteria:**
- [x] Clicking result opens document detail
- [x] Closing detail returns to results
- [x] Results preserved when viewing detail
- [ ] URL updates with docId (optional - deferred)

**Test:**
```typescript
// src/components/search/SearchPage.test.tsx
describe('SearchPage document view', () => {
  it('opens document on result click', async () => {
    render(<SearchPage />);

    await userEvent.type(screen.getByRole('textbox'), 'test{Enter}');
    await waitFor(() => screen.getByTestId('search-result-0'));

    await userEvent.click(screen.getByTestId('search-result-0'));

    await waitFor(() => {
      expect(screen.getByTestId('document-detail')).toBeInTheDocument();
    });
  });

  it('closes document detail', async () => {
    render(<SearchPage />);

    // Open a document
    await userEvent.type(screen.getByRole('textbox'), 'test{Enter}');
    await waitFor(() => screen.getByTestId('search-result-0'));
    await userEvent.click(screen.getByTestId('search-result-0'));
    await waitFor(() => screen.getByTestId('document-detail'));

    // Close it
    await userEvent.click(screen.getByRole('button', { name: /close/i }));

    expect(screen.queryByTestId('document-detail')).not.toBeInTheDocument();
    expect(screen.getByTestId('search-results')).toBeInTheDocument();
  });
});
```

---

## Phase 6: Polish & Testing (3 tasks)

### Task 6.1: Add Responsive Styles
**Estimate:** 1 hr | **Status:** Complete
**Depends on:** Task 2.7
**User Story:** US-9

**Description:**
Ensure all search components work well on mobile and tablet.

**Steps:**
1. Review all components at 375px, 768px, 1024px, 1440px
2. Adjust SearchBar for mobile (full width)
3. Add mobile sidebar toggle for filters/history
4. Stack history below results on mobile
5. Ensure touch targets are 44x44px minimum
6. Test with touch gestures

**Acceptance Criteria:**
- [x] SearchBar full width on mobile
- [x] Mobile sidebar toggle for filters/history
- [x] Results stack properly on all sizes
- [x] No horizontal scroll
- [x] Touch targets adequate size

**Test:**
```typescript
// Manual testing checklist + visual regression tests
// src/components/search/SearchPage.responsive.test.tsx
describe('SearchPage responsive', () => {
  it('has responsive grid classes', () => {
    render(<SearchPage />);
    const container = screen.getByTestId('search-page');
    expect(container).toHaveClass('lg:grid-cols-3');
  });
});
```

---

### Task 6.2: Accessibility Audit and Fixes
**Estimate:** 1 hr | **Status:** Complete
**Depends on:** All component tasks
**User Story:** US-8

**Description:**
Run accessibility audit and fix any issues.

**Steps:**
1. Add ARIA labels to all interactive elements
2. Verify keyboard navigation works (Enter, Escape)
3. Check focus management
4. Verify aria attributes on health indicator and controls
5. Check color contrast
6. Add accessible labels to backend selector and filters toggle

**Acceptance Criteria:**
- [x] Health indicator has role="status" and aria-label
- [x] Full keyboard navigation (Enter to submit, Escape to clear)
- [x] Focus visible on all interactive elements
- [x] Proper aria-labels on all controls
- [x] Backend selector has accessible label

**Test:**
```typescript
// src/components/search/accessibility.test.tsx
describe('Search accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = render(<SearchPage />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('search results are keyboard navigable', async () => {
    render(<SearchPage />);
    await userEvent.type(screen.getByRole('textbox'), 'test{Enter}');
    await waitFor(() => screen.getByTestId('search-result-0'));

    await userEvent.keyboard('{Tab}');
    expect(screen.getByTestId('search-result-0')).toHaveFocus();

    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByTestId('search-result-1')).toHaveFocus();
  });
});
```

---

### Task 6.3: Integration Testing
**Estimate:** 1.5 hr | **Status:** Complete
**Depends on:** All previous tasks
**User Story:** All

**Description:**
Write integration tests for complete search flows.

**Steps:**
1. Test search -> filter -> paginate flow
2. Test search -> click result -> view -> back flow
3. Test history -> re-run -> favorite flow
4. Test backend switching
5. Test error scenarios

**Acceptance Criteria:**
- [x] All happy path flows tested
- [x] Error scenarios tested
- [x] Backend switching tested
- [x] History management tested
- [x] All tests passing (223 tests)

**Test:**
```typescript
// src/components/search/SearchPage.integration.test.tsx
describe('Search integration flows', () => {
  it('complete search flow', async () => {
    render(<SearchPage />);

    // Search
    await userEvent.type(screen.getByRole('textbox'), 'KnowledgeStore{Enter}');
    await waitFor(() => screen.getByTestId('search-result-0'));

    // Apply filter
    await userEvent.click(screen.getByLabelText('.py'));
    await waitFor(() => {
      const results = screen.getAllByTestId(/^search-result-/);
      results.forEach(r => {
        expect(r).toHaveTextContent('.py');
      });
    });

    // View result
    await userEvent.click(screen.getByTestId('search-result-0'));
    await waitFor(() => screen.getByTestId('document-detail'));

    // Close and verify history
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(screen.getByText('KnowledgeStore')).toBeInTheDocument(); // In history
  });

  it('handles backend errors gracefully', async () => {
    // Mock error response
    vi.mocked(apiClient.post).mockRejectedValue(new Error('Network error'));

    render(<SearchPage />);
    await userEvent.selectOptions(screen.getByTestId('backend-selector'), 'rest');
    await userEvent.type(screen.getByRole('textbox'), 'test{Enter}');

    await waitFor(() => {
      expect(screen.getByText(/unable to connect/i)).toBeInTheDocument();
    });

    // Retry should be available
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
```

---

## Definition of Done

- [x] All tasks marked complete
- [x] All tests passing (`npm test`) - 223 tests
- [ ] Lint passing (`npm run lint`)
- [ ] Type check passing (`npm run type-check`)
- [ ] Manual testing on Chrome, Firefox, Safari
- [ ] Mobile testing on iOS and Android
- [ ] Accessibility tests passing (axe-core)
- [x] Mock backend fully functional
- [x] REST backend integration tested
- [ ] Code reviewed and approved

---

## Notes

- Tasks should be completed in order within each phase
- Each task follows TDD: write failing test first, then implement
- Follow existing patterns from DocSearch.tsx and DocsPage.tsx
- Use existing common components (Button, Badge, Spinner, etc.)
- Coordinate with backend team if API contract questions arise
