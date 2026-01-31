# P08-F06: Snowflake Graph View (MVP) - Task Breakdown

## Overview

**Feature:** Snowflake Graph View MVP
**Estimated Total:** 22-26 hours
**Task Count:** 17 tasks

## Dependencies

```
T01 (types) ─────────────────┬───> T02 (store)
                             │
T03 (mock data) ─────────────┼───> T04 (useGraphData hook)
                             │
                             ├───> T05 (SnowflakeGraph component)
                             │
T02 (store) ─────────────────┼───> T06 (zoom/pan)
                             │
T05 (component) ─────────────┼───> T07 (interactions)
                             │
T04 (hook) ──────────────────┼───> T08 (selection detail)
                             │
T02 (store) + T05 ───────────┼───> T09 (GraphControls)
                             │
T04 (hook) + T09 ────────────┴───> T10 (filtering)

T08, T09, T10 ───────────────────> T11 (sidebar integration)

T11 ─────────────────────────────> T12 (page & routing)

T12 ─────────────────────────────> T13 (loading/error states)

T05, T06, T07, T10 ──────────────> T14 (performance optimization)

T14 ─────────────────────────────> T15 (integration tests)

All ─────────────────────────────> T16 (documentation)

T16 ─────────────────────────────> T17 (final review)
```

---

## Phase 1: Foundation (4-5 hours)

### T01: Create Graph Types

**Description:** Define TypeScript interfaces for graph nodes, edges, and data structures.

**Files:**
- `docker/hitl-ui/src/types/graph.ts`

**Acceptance Criteria:**
- [ ] GraphNode interface with id, nodeType, label, degree, position fields
- [ ] GraphEdge interface with id, source, target, edgeType, weight fields
- [ ] GraphData interface combining nodes and edges
- [ ] Re-export CorrelationType and CorrelationStatus from existing types
- [ ] Unit tests for type guards if any

**Estimate:** 1 hour

**Story:** US-01, US-02, US-03

---

### T02: Create Graph View Store

**Description:** Implement Zustand store for graph view state including filters, selection, and view settings.

**Files:**
- `docker/hitl-ui/src/stores/graphViewStore.ts`
- `docker/hitl-ui/src/stores/graphViewStore.test.ts`

**Acceptance Criteria:**
- [ ] searchQuery state and setSearchQuery action
- [ ] showTags boolean and toggle action
- [ ] showInferredEdges boolean and toggle action
- [ ] selectedNodeId and selectNode action
- [ ] hoveredNodeId and setHoveredNode action
- [ ] zoom, centerX, centerY view state
- [ ] isLayoutRunning state
- [ ] resetView action to restore defaults
- [ ] Unit tests for all actions and state transitions

**Estimate:** 1.5 hours

**Story:** US-08, US-09, US-10, US-11

**Dependencies:** T01

---

### T03: Create Mock Graph Data

**Description:** Create mock graph data for development and testing.

**Files:**
- `docker/hitl-ui/src/api/mocks/graph.ts`

**Acceptance Criteria:**
- [ ] Mock data with 20-30 idea nodes
- [ ] Mock data with 5-10 tag nodes
- [ ] Mix of explicit and inferred edges
- [ ] Varying similarity scores for edge weights
- [ ] Helper function to generate larger test datasets

**Estimate:** 1 hour

**Story:** US-01

---

### T04: Create useGraphData Hook

**Description:** Implement data fetching hook that retrieves graph data from API and transforms it for rendering.

**Files:**
- `docker/hitl-ui/src/components/mindflare/graph/useGraphData.ts`
- `docker/hitl-ui/src/components/mindflare/graph/useGraphData.test.ts`

**Acceptance Criteria:**
- [ ] Fetch graph data from GET /api/ideas/graph endpoint
- [ ] Support includeTags and includeInferred options
- [ ] Compute degree for each node based on edge count
- [ ] Return data, isLoading, error, refetch
- [ ] Use React Query for caching
- [ ] Unit tests with mock API responses

**Estimate:** 1.5 hours

**Story:** US-01, US-09, US-10

**Dependencies:** T01, T03

---

## Phase 2: Core Graph Component (5-6 hours)

### T05: Create SnowflakeGraph Component

**Description:** Implement the main graph visualization component using react-force-graph-2d.

**Files:**
- `docker/hitl-ui/src/components/mindflare/graph/SnowflakeGraph.tsx`
- `docker/hitl-ui/src/components/mindflare/graph/SnowflakeGraph.test.tsx`

**Acceptance Criteria:**
- [ ] Install react-force-graph-2d dependency
- [ ] Render graph with nodes and edges from data prop
- [ ] Custom node rendering (circles, colors by type, size by degree)
- [ ] Custom edge rendering (solid vs dashed, opacity, thickness by weight)
- [ ] Label rendering at zoom threshold
- [ ] Near-white background (#fafafa)
- [ ] Proper cleanup on unmount
- [ ] Basic render tests

**Estimate:** 2 hours

**Story:** US-01, US-02, US-03

**Dependencies:** T01, T04

---

### T06: Implement Zoom and Pan

**Description:** Configure and enhance zoom/pan behavior in the graph component.

**Files:**
- `docker/hitl-ui/src/components/mindflare/graph/SnowflakeGraph.tsx` (update)

**Acceptance Criteria:**
- [ ] Scroll wheel zooms centered on cursor
- [ ] Drag on empty space pans the view
- [ ] Zoom level affects label visibility
- [ ] Smooth animation for zoom transitions
- [ ] Store zoom/center state in graphViewStore

**Estimate:** 1 hour

**Story:** US-04

**Dependencies:** T02, T05

---

### T07: Implement Node Interactions

**Description:** Add click, hover, and double-click handlers for node interactions.

**Files:**
- `docker/hitl-ui/src/components/mindflare/graph/SnowflakeGraph.tsx` (update)

**Acceptance Criteria:**
- [ ] Click selects/deselects node, updates store
- [ ] Hover highlights node and fades non-neighbors to 20%
- [ ] Double-click centers and zooms to node (animate 500ms)
- [ ] Maintain highlightedNeighbors set for hover effect
- [ ] onNodeSelect and onNodeDoubleClick callback props
- [ ] Unit tests for interaction handlers

**Estimate:** 1.5 hours

**Story:** US-05, US-06, US-07

**Dependencies:** T02, T05

---

### T08: Implement Selection Detail Panel Integration

**Description:** Wire selected node to display details in sidebar panel.

**Files:**
- `docker/hitl-ui/src/components/mindflare/graph/SnowflakeGraph.tsx` (update)
- `docker/hitl-ui/src/pages/MindflareGraphPage.tsx` (partial)

**Acceptance Criteria:**
- [ ] When idea node selected, fetch full idea details
- [ ] Pass selectedNodeId to parent for detail display
- [ ] Handle tag node selection (show tag info or no-op)
- [ ] Clear selection when clicking empty space

**Estimate:** 1 hour

**Story:** US-05, US-13

**Dependencies:** T04, T07

---

## Phase 3: Controls Panel (3-4 hours)

### T09: Create GraphControls Component

**Description:** Implement the simple controls panel with search, toggles, and buttons.

**Files:**
- `docker/hitl-ui/src/components/mindflare/graph/GraphControls.tsx`
- `docker/hitl-ui/src/components/mindflare/graph/GraphControls.test.tsx`

**Acceptance Criteria:**
- [ ] Search input with debounced onChange
- [ ] "Show Tags" checkbox toggle
- [ ] "Show Inferred Edges" checkbox toggle
- [ ] "Reset View" button
- [ ] "Re-run Layout" button with loading state
- [ ] Wired to graphViewStore actions
- [ ] Clean Tailwind styling
- [ ] Unit tests for control interactions

**Estimate:** 1.5 hours

**Story:** US-08, US-09, US-10, US-11, US-12

**Dependencies:** T02, T05

---

### T10: Implement Filtering Logic

**Description:** Apply search and toggle filters to graph data.

**Files:**
- `docker/hitl-ui/src/components/mindflare/graph/useGraphData.ts` (update)
- `docker/hitl-ui/src/components/mindflare/graph/SnowflakeGraph.tsx` (update)

**Acceptance Criteria:**
- [ ] Filter nodes by search query (match label)
- [ ] Include direct neighbors of matching nodes
- [ ] Filter out tag nodes when showTags is false
- [ ] Filter out inferred edges when showInferredEdges is false
- [ ] Re-trigger layout when filters change significantly
- [ ] Show "No results" when filter returns empty
- [ ] Unit tests for filter logic

**Estimate:** 1.5 hours

**Story:** US-08, US-09, US-10

**Dependencies:** T04, T09

---

## Phase 4: Integration (4-5 hours)

### T11: Implement Sidebar Detail Panel

**Description:** Add sidebar panel to graph page showing selected node details.

**Files:**
- `docker/hitl-ui/src/pages/MindflareGraphPage.tsx` (update)

**Acceptance Criteria:**
- [ ] Right sidebar shows selected idea details
- [ ] Display idea content, classification, labels, correlation count
- [ ] "View Details" button navigates to idea detail page
- [ ] "Bake in Studio" button triggers bake action
- [ ] Placeholder message when nothing selected
- [ ] Reuse existing IdeaDetailPanel component if available

**Estimate:** 1.5 hours

**Story:** US-13

**Dependencies:** T08, T09, T10

---

### T12: Create MindflareGraphPage and Routing

**Description:** Create the full-page graph view and add routing.

**Files:**
- `docker/hitl-ui/src/pages/MindflareGraphPage.tsx`
- `docker/hitl-ui/src/pages/MindflareGraphPage.test.tsx`
- `docker/hitl-ui/src/App.tsx` (update routes)
- `docker/hitl-ui/src/components/layout/Sidebar.tsx` (update nav)

**Acceptance Criteria:**
- [ ] Full-page layout with graph canvas and controls
- [ ] Route registered at /mindflare/graph
- [ ] Navigation link in sidebar under Mindflare section
- [ ] Link to switch back to list view
- [ ] Responsive layout (graph fills available space)
- [ ] Page title and header

**Estimate:** 1.5 hours

**Story:** US-14

**Dependencies:** T11

---

### T13: Implement Loading and Error States

**Description:** Add proper loading, error, and empty state handling.

**Files:**
- `docker/hitl-ui/src/pages/MindflareGraphPage.tsx` (update)
- `docker/hitl-ui/src/components/mindflare/graph/SnowflakeGraph.tsx` (update)

**Acceptance Criteria:**
- [ ] Loading spinner while data fetches
- [ ] Error banner with retry button on API failure
- [ ] Empty state when no ideas exist
- [ ] Warning when node count exceeds 2000
- [ ] Graceful handling of partial data

**Estimate:** 1 hour

**Story:** US-15

**Dependencies:** T12

---

## Phase 5: Polish (4-5 hours)

### T14: Performance Optimization

**Description:** Optimize graph rendering for larger datasets.

**Files:**
- `docker/hitl-ui/src/components/mindflare/graph/SnowflakeGraph.tsx` (update)
- `docker/hitl-ui/src/components/mindflare/graph/useGraphData.ts` (update)

**Acceptance Criteria:**
- [ ] Memoize node and edge render functions
- [ ] Use warmupTicks for initial layout
- [ ] Limit node count with warning (>2000)
- [ ] Optimize neighbor set computation
- [ ] Test with 500 nodes, ensure <2s initial render
- [ ] Verify 60fps during interaction

**Estimate:** 1.5 hours

**Story:** US-01, US-04

**Dependencies:** T05, T06, T07, T10

---

### T15: Integration Tests

**Description:** Write integration tests for the graph page.

**Files:**
- `docker/hitl-ui/src/pages/MindflareGraphPage.integration.test.tsx`

**Acceptance Criteria:**
- [ ] Test page loads with mock data
- [ ] Test search filter reduces visible nodes
- [ ] Test tag toggle hides/shows tag nodes
- [ ] Test node selection shows details
- [ ] Test navigation to/from graph view
- [ ] Test error state display

**Estimate:** 1.5 hours

**Story:** All

**Dependencies:** T14

---

### T16: Documentation

**Description:** Update documentation with graph view usage.

**Files:**
- `docker/hitl-ui/README.md` (update if exists)
- Component JSDoc comments (all graph components)

**Acceptance Criteria:**
- [ ] JSDoc comments on all exported functions/components
- [ ] Brief usage guide for graph view
- [ ] Document keyboard shortcuts if any
- [ ] Note deferred features and link to F07

**Estimate:** 1 hour

**Story:** All

**Dependencies:** All implementation tasks

---

### T17: Final Review and Cleanup

**Description:** Final code review, cleanup, and validation.

**Files:**
- All graph-related files

**Acceptance Criteria:**
- [ ] All tests passing
- [ ] No ESLint errors
- [ ] No TypeScript errors
- [ ] Remove any debug code
- [ ] Verify all user stories are met
- [ ] Manual testing on sample data

**Estimate:** 1 hour

**Story:** All

**Dependencies:** T16

---

## Progress Tracking

### Summary

| Phase | Tasks | Estimated Hours | Status |
|-------|-------|-----------------|--------|
| Foundation | T01-T04 | 5 hours | Not Started |
| Core Graph | T05-T08 | 5.5 hours | Not Started |
| Controls | T09-T10 | 3 hours | Not Started |
| Integration | T11-T13 | 4 hours | Not Started |
| Polish | T14-T17 | 5 hours | Not Started |
| **Total** | **17 tasks** | **22.5 hours** | **Not Started** |

### Task Status

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| T01 | Graph Types | [ ] Not Started | |
| T02 | Graph View Store | [ ] Not Started | |
| T03 | Mock Graph Data | [ ] Not Started | |
| T04 | useGraphData Hook | [ ] Not Started | |
| T05 | SnowflakeGraph Component | [ ] Not Started | |
| T06 | Zoom and Pan | [ ] Not Started | |
| T07 | Node Interactions | [ ] Not Started | |
| T08 | Selection Detail | [ ] Not Started | |
| T09 | GraphControls Component | [ ] Not Started | |
| T10 | Filtering Logic | [ ] Not Started | |
| T11 | Sidebar Detail Panel | [ ] Not Started | |
| T12 | Page and Routing | [ ] Not Started | |
| T13 | Loading/Error States | [ ] Not Started | |
| T14 | Performance Optimization | [ ] Not Started | |
| T15 | Integration Tests | [ ] Not Started | |
| T16 | Documentation | [ ] Not Started | |
| T17 | Final Review | [ ] Not Started | |

### Blockers

_None identified at planning time._

### Notes

- P08-F04 (Correlation Engine) provides the GET /api/ideas/graph endpoint
- P08-F05 (Mindflare Hub UI) provides IdeaDetailPanel for reuse
- react-force-graph-2d needs to be added to package.json dependencies
- Mobile support is explicitly excluded from MVP scope
