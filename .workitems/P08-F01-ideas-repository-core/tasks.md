# P08-F01: Ideas Repository Core - Tasks

## Progress

- Started: Not started
- Tasks Complete: 0/20
- Percentage: 0%
- Status: PLANNED
- Blockers: None

---

## Phase 1: Data Models & Types

### T01: Create Idea Pydantic models (Backend)

- [ ] Estimate: 1hr
- [ ] Tests: `tests/unit/orchestrator/api/models/test_idea.py`
- [ ] Dependencies: None
- [ ] Agent: backend

**File:** `src/orchestrator/api/models/idea.py`

**Implement:**
- `IdeaSource` enum (manual, slack, import)
- `IdeaStatus` enum (draft, active, baking, archived)
- `IdeaClassification` enum (functional, non_functional, undetermined)
- `Idea` model with all fields
- `CreateIdeaRequest`, `CreateIdeaResponse` models
- `UpdateIdeaRequest` model
- `ListIdeasRequest`, `ListIdeasResponse` models
- `BakeIdeaRequest`, `BakeIdeaResponse` models
- Word count validation helper function

---

### T02: Create Idea TypeScript types (Frontend)

- [ ] Estimate: 45min
- [ ] Tests: N/A (types only)
- [ ] Dependencies: T01
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/types/ideas.ts`

**Implement:**
- `IdeaSource`, `IdeaStatus`, `IdeaClassification` types
- `Idea` interface matching backend model
- `CreateIdeaRequest`, `CreateIdeaResponse` interfaces
- `UpdateIdeaRequest` interface
- `ListIdeasRequest`, `ListIdeasResponse` interfaces
- `BakeIdeaRequest`, `BakeIdeaResponse` interfaces
- `IdeasFilter` interface for filter state
- `WORD_LIMIT` constant (144)

---

## Phase 2: Backend Service Layer

### T03: Create IdeasService class

- [ ] Estimate: 2hr
- [ ] Tests: `tests/unit/orchestrator/services/test_ideas_service.py`
- [ ] Dependencies: T01
- [ ] Agent: backend

**File:** `src/orchestrator/services/ideas_service.py`

**Implement:**
- `IdeasService` class with ES client injection
- `create_idea()` method with word validation and embedding
- `get_idea()` method
- `update_idea()` method
- `delete_idea()` method (soft delete to archived)
- `list_ideas()` method with pagination
- `search_ideas()` method with full-text search
- `_get_index_name()` for tenant-prefixed index
- `_index_idea()` helper
- `_hit_to_idea()` converter

---

### T04: Create Elasticsearch index mapping for ideas

- [ ] Estimate: 1hr
- [ ] Tests: `tests/unit/orchestrator/services/test_ideas_service.py`
- [ ] Dependencies: T03
- [ ] Agent: backend

**File:** `src/orchestrator/services/ideas_service.py` (addition)

**Implement:**
- `IDEAS_INDEX_MAPPING` constant with all field mappings
- `_ensure_index_exists()` method
- Dense vector field for embeddings (dims: 384)
- Keyword fields for filtering
- Text field with english analyzer for search

---

### T05: Implement idea embedding generation

- [ ] Estimate: 1hr
- [ ] Tests: `tests/unit/orchestrator/services/test_ideas_service.py`
- [ ] Dependencies: T03
- [ ] Agent: backend

**File:** `src/orchestrator/services/ideas_service.py` (addition)

**Implement:**
- Integration with `EmbeddingService` from knowledge_store
- Generate embedding on idea creation
- Update embedding on content edit
- Handle embedding service failures gracefully

---

### T06: Implement bake idea to Ideation Studio

- [ ] Estimate: 1.5hr
- [ ] Tests: `tests/unit/orchestrator/services/test_ideas_service.py`
- [ ] Dependencies: T03
- [ ] Agent: backend

**File:** `src/orchestrator/services/ideas_service.py` (addition)

**Implement:**
- `bake_idea()` method
- Create Ideation Studio session with idea as context
- Update idea status to "baking"
- Link idea to session via `bake_session_id`
- Generate redirect URL to Ideation Studio

---

## Phase 3: Backend API Routes

### T07: Create ideas API router

- [ ] Estimate: 2hr
- [ ] Tests: `tests/unit/orchestrator/routes/test_ideas_api.py`
- [ ] Dependencies: T03, T04, T05, T06
- [ ] Agent: backend

**File:** `src/orchestrator/routes/ideas_api.py`

**Endpoints:**
- `POST /api/ideas` - Create idea
- `GET /api/ideas` - List ideas with filters
- `GET /api/ideas/{idea_id}` - Get single idea
- `PUT /api/ideas/{idea_id}` - Update idea
- `DELETE /api/ideas/{idea_id}` - Archive idea
- `POST /api/ideas/{idea_id}/bake` - Start baking

**Implement:**
- FastAPI router with dependency injection
- Input validation (144 word limit)
- Error handling (404, 400, 409)
- Mock responses for development mode

---

### T08: Register ideas router in main.py

- [ ] Estimate: 15min
- [ ] Tests: Manual verification
- [ ] Dependencies: T07
- [ ] Agent: backend

**File:** `src/orchestrator/main.py`

**Implement:**
- Import ideas_api router
- Register with prefix `/api/ideas`
- Add to OpenAPI tags

---

## Phase 4: Frontend API Client

### T09: Create ideas API client functions

- [ ] Estimate: 1.5hr
- [ ] Tests: `docker/hitl-ui/src/api/ideas.test.ts`
- [ ] Dependencies: T02, T07
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/api/ideas.ts`

**Implement:**
- `createIdea(request): Promise<CreateIdeaResponse>`
- `listIdeas(request): Promise<ListIdeasResponse>`
- `getIdea(ideaId): Promise<Idea>`
- `updateIdea(ideaId, request): Promise<Idea>`
- `deleteIdea(ideaId): Promise<void>`
- `bakeIdea(ideaId, request): Promise<BakeIdeaResponse>`
- Error handling with typed errors

---

### T10: Create mock data for ideas API

- [ ] Estimate: 1hr
- [ ] Tests: N/A (test utility)
- [ ] Dependencies: T02
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/api/mocks/ideas.ts`

**Implement:**
- `mockIdeas` - 20+ sample ideas with variety
- `generateMockIdea()` - random idea generator
- `mockCreateIdea()` - simulate creation
- `mockListIdeas()` - simulate listing with filters
- `mockUpdateIdea()` - simulate update
- `mockDeleteIdea()` - simulate deletion
- `mockBakeIdea()` - simulate baking flow

---

## Phase 5: Frontend State Management

### T11: Create ideasStore with Zustand

- [ ] Estimate: 2hr
- [ ] Tests: `docker/hitl-ui/src/stores/ideasStore.test.ts`
- [ ] Dependencies: T02, T09
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/stores/ideasStore.ts`

**State:**
- `ideas: Idea[]`
- `selectedIdea: Idea | null`
- `isLoading: boolean`
- `error: string | null`
- `filters: IdeasFilter`
- `pagination: { page, pageSize, total, hasMore }`

**Actions:**
- `fetchIdeas()` - load ideas with current filters
- `createIdea(content, labels)` - create and add to list
- `updateIdea(ideaId, updates)` - update in list
- `deleteIdea(ideaId)` - remove from list
- `selectIdea(ideaId)` - set selected
- `clearSelection()` - clear selected
- `setFilter(filter)` - update filters
- `clearFilters()` - reset filters
- `setPage(page)` - change page
- `bakeIdea(ideaId)` - start baking flow

---

### T12: Create word count validation utility

- [ ] Estimate: 30min
- [ ] Tests: `docker/hitl-ui/src/utils/wordCount.test.ts`
- [ ] Dependencies: None
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/utils/wordCount.ts`

**Implement:**
- `countWords(text): number` - accurate word count
- `validateWordLimit(text, limit): { valid, count, limit }`
- `getWordCountColor(count, limit): string` - color coding
- Handle edge cases (multiple spaces, newlines, etc.)

---

## Phase 6: Frontend Components

### T13: Create IdeaCard component

- [ ] Estimate: 1.5hr
- [ ] Tests: `docker/hitl-ui/src/components/ideas/IdeaCard.test.tsx`
- [ ] Dependencies: T02, T11
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/components/ideas/IdeaCard.tsx`

**Implement:**
- Content preview (truncated with "...")
- Author name and avatar
- Timestamp (relative: "2 hours ago")
- Labels as colored badges
- Status badge
- Source icon (manual, Slack)
- Click handler to select
- Hover state styling
- Compact and expanded modes

---

### T14: Create IdeaDetail component

- [ ] Estimate: 1.5hr
- [ ] Tests: `docker/hitl-ui/src/components/ideas/IdeaDetail.test.tsx`
- [ ] Dependencies: T02, T11, T13
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/components/ideas/IdeaDetail.tsx`

**Implement:**
- Full content display
- All labels with add/remove UI
- Edit button (author only)
- Delete button (author only)
- "Bake in Studio" button
- Source information
- Timestamps (created, updated)
- Status badge with color
- Close button

---

### T15: Create IdeaForm component

- [ ] Estimate: 1.5hr
- [ ] Tests: `docker/hitl-ui/src/components/ideas/IdeaForm.test.tsx`
- [ ] Dependencies: T02, T11, T12
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/components/ideas/IdeaForm.tsx`

**Implement:**
- Textarea with word count display
- Real-time word count (color-coded)
- Word limit enforcement (144 words)
- Label input with suggestions
- Submit button (disabled when invalid)
- Cancel button
- Loading state during submission
- Error display
- Edit mode support (pre-fill content)

---

### T16: Create IdeasList component

- [ ] Estimate: 1.5hr
- [ ] Tests: `docker/hitl-ui/src/components/ideas/IdeasList.test.tsx`
- [ ] Dependencies: T13
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/components/ideas/IdeasList.tsx`

**Implement:**
- Grid/list of IdeaCard components
- Loading skeleton cards
- Empty state ("No ideas yet")
- No results state ("No matching ideas")
- Infinite scroll or pagination
- Pull-to-refresh (mobile)
- Responsive grid layout

---

### T17: Create IdeasFilter component

- [ ] Estimate: 1hr
- [ ] Tests: `docker/hitl-ui/src/components/ideas/IdeasFilter.test.tsx`
- [ ] Dependencies: T02, T11
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/components/ideas/IdeasFilter.tsx`

**Implement:**
- Search input with debounce
- Status dropdown (All, Draft, Active, Baking, Archived)
- Label multi-select with counts
- Source filter (All, Manual, Slack)
- Clear filters button
- Filter count badge
- Collapsible on mobile

---

## Phase 7: Integration & Testing

### T18: Create MindflareHubPage layout

- [ ] Estimate: 1.5hr
- [ ] Tests: `docker/hitl-ui/src/pages/MindflareHubPage.test.tsx`
- [ ] Dependencies: T13-T17
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/pages/MindflareHubPage.tsx`

**Layout:**
```
+----------------------------------------------------------+
| Header: Mindflare Hub                [+ New Idea]        |
+----------------------------------------------------------+
| Search: [_______________]  Filters: [v]                  |
+----------------------------------------------------------+
| IdeasList                          | IdeaDetail          |
| +------+  +------+  +------+       | (shown when         |
| | Idea |  | Idea |  | Idea |       |  idea selected)     |
| +------+  +------+  +------+       |                     |
| +------+  +------+  +------+       |                     |
| | Idea |  | Idea |  | Idea |       |                     |
| +------+  +------+  +------+       |                     |
+----------------------------------------------------------+
| Pagination: < 1 2 3 ... 10 >                             |
+----------------------------------------------------------+
```

**Implement:**
- Header with "New Idea" button
- Search and filter bar
- Two-column layout (list + detail panel)
- Connect to ideasStore
- Handle URL parameters for deep linking
- Responsive: stack on mobile

---

### T19: Add route for /mindflare

- [ ] Estimate: 15min
- [ ] Tests: Route verification
- [ ] Dependencies: T18
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/App.tsx`

**Implement:**
- Import MindflareHubPage
- Add route: `/mindflare` -> MindflareHubPage
- Add route: `/mindflare/:ideaId` -> MindflareHubPage with selection

---

### T20: Integration tests for Ideas API

- [ ] Estimate: 1.5hr
- [ ] Tests: `tests/integration/orchestrator/test_ideas_api.py`
- [ ] Dependencies: T07, T08
- [ ] Agent: backend

**Implement:**
- Test create idea flow
- Test list with filters
- Test update idea
- Test delete (archive) idea
- Test bake idea flow
- Test word limit enforcement
- Test error responses

---

## Task Dependencies Graph

```
T01 ───┬──► T02 ───────────────────────┬───────────────────┐
       │                               │                   │
       └──► T03 ───► T04 ───► T05 ─────┼───► T07 ───► T08 ─┼──► T20
                      │                │                   │
                      └──► T06 ────────┘                   │
                                                           │
T02 ───┬──► T09 ───────────────────────────────────────────┤
       │                                                   │
       ├──► T10 ───────────────────────────────────────────┤
       │                                                   │
       └──► T11 ───┬──► T13 ───► T16 ───┬──► T18 ───► T19 │
                   │                    │                  │
                   ├──► T14 ────────────┤                  │
                   │                    │                  │
                   └──► T15 ────────────┤                  │
                                        │                  │
T12 ───────────────────────────────────►├──► T17 ─────────┘
```

---

## Verification Checklist

### Unit Tests
- [ ] `pytest tests/unit/orchestrator/api/models/test_idea.py`
- [ ] `pytest tests/unit/orchestrator/services/test_ideas_service.py`
- [ ] `pytest tests/unit/orchestrator/routes/test_ideas_api.py`
- [ ] `npm test -- --coverage src/stores/ideasStore`
- [ ] `npm test -- --coverage src/components/ideas/`

### Integration Tests
- [ ] `pytest tests/integration/orchestrator/test_ideas_api.py`
- [ ] `npm test -- src/pages/MindflareHubPage.test.tsx`

### Manual Verification
1. Create idea with 100 words -> Success
2. Create idea with 145 words -> Blocked
3. Search ideas -> Returns relevant results
4. Filter by label -> Shows matching ideas
5. Click "Bake in Studio" -> Opens Ideation Studio
6. Edit idea -> Updates successfully
7. Delete idea -> Archived (not shown in active list)

---

## Estimates Summary

| Phase | Tasks | Total Estimate |
|-------|-------|----------------|
| Phase 1: Data Models | T01-T02 | 1.75hr |
| Phase 2: Service Layer | T03-T06 | 5.5hr |
| Phase 3: API Routes | T07-T08 | 2.25hr |
| Phase 4: API Client | T09-T10 | 2.5hr |
| Phase 5: State Mgmt | T11-T12 | 2.5hr |
| Phase 6: Components | T13-T17 | 7hr |
| Phase 7: Integration | T18-T20 | 3.25hr |

**Total Estimate:** ~25 hours
