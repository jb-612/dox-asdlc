# P08-F05: Mindflare Hub UI - Tasks

## Progress

- Started: Not started
- Tasks Complete: 0/22
- Percentage: 0%
- Status: PLANNED
- Blockers: P08-F01, P08-F03, P08-F04

---

## Phase 1: Core Components

### T01: Create IdeaCard component

- [ ] Estimate: 2hr
- [ ] Tests: `docker/hitl-ui/src/components/mindflare/IdeaCard.test.tsx`
- [ ] Dependencies: P08-F01 (types)
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/components/mindflare/IdeaCard.tsx`

**Implement:**
- Twitter-style card layout
- Author avatar and name
- Relative timestamp (date-fns)
- Content preview with truncation
- Classification badge
- Label badges (max 3 + overflow)
- Source badge (Manual/Slack)
- Correlation count
- Word count
- "Bake" button
- Hover and focus states
- Click to select handler

---

### T02: Create WordCountIndicator component

- [ ] Estimate: 30min
- [ ] Tests: `docker/hitl-ui/src/components/mindflare/WordCountIndicator.test.tsx`
- [ ] Dependencies: None
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/components/mindflare/WordCountIndicator.tsx`

**Implement:**
- Display current/max word count (e.g., "85/144")
- Color coding (green < 120, yellow 120-140, red 141+)
- Progress bar visualization
- Warning icon when near limit

---

### T03: Create SourceBadge component

- [ ] Estimate: 30min
- [ ] Tests: `docker/hitl-ui/src/components/mindflare/SourceBadge.test.tsx`
- [ ] Dependencies: P08-F01 (types)
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/components/mindflare/SourceBadge.tsx`

**Implement:**
- Badge showing idea source
- Slack icon for Slack source
- Manual icon for manual entry
- Import icon for imported ideas
- Tooltip with details

---

### T04: Create IdeaForm component

- [ ] Estimate: 2hr
- [ ] Tests: `docker/hitl-ui/src/components/mindflare/IdeaForm.test.tsx`
- [ ] Dependencies: T02, P08-F01
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/components/mindflare/IdeaForm.tsx`

**Implement:**
- Textarea with placeholder
- Real-time word count (WordCountIndicator)
- Label input with autocomplete
- Submit/Cancel buttons
- Loading state during submission
- Error display
- Edit mode (pre-fill content)
- Validation (144 word limit)

---

### T05: Create CreateIdeaButton component

- [ ] Estimate: 30min
- [ ] Tests: `docker/hitl-ui/src/components/mindflare/CreateIdeaButton.test.tsx`
- [ ] Dependencies: T04
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/components/mindflare/CreateIdeaButton.tsx`

**Implement:**
- Floating action button (FAB) style
- Opens IdeaForm modal on click
- Fixed position on mobile
- Tooltip "Create new idea"
- Keyboard shortcut (Ctrl+N)

---

## Phase 2: List & Detail Views

### T06: Create IdeasListView component

- [ ] Estimate: 2hr
- [ ] Tests: `docker/hitl-ui/src/components/mindflare/IdeasListView.test.tsx`
- [ ] Dependencies: T01
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/components/mindflare/IdeasListView.tsx`

**Implement:**
- Responsive grid layout (1/2/3 columns)
- IdeaCard rendering
- Loading skeleton cards
- Empty state ("No ideas yet")
- No results state ("No matching ideas")
- Infinite scroll or pagination
- Selection state highlighting

---

### T07: Create IdeaDetailPanel component

- [ ] Estimate: 2hr
- [ ] Tests: `docker/hitl-ui/src/components/mindflare/IdeaDetailPanel.test.tsx`
- [ ] Dependencies: T01, P08-F03, P08-F04
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/components/mindflare/IdeaDetailPanel.tsx`

**Implement:**
- Full content display
- Author info with avatar
- Timestamps (created, updated)
- Classification badge with confidence
- Labels with edit capability
- Source badge
- "Bake in Studio" button
- "Find Similar" button
- "Edit" button (author only)
- "Delete" button (author only)
- Tabs: Overview, Correlations, Suggestions
- Close button

---

### T08: Create IdeasFilter component (enhanced)

- [ ] Estimate: 1.5hr
- [ ] Tests: `docker/hitl-ui/src/components/mindflare/IdeasFilter.test.tsx`
- [ ] Dependencies: P08-F01, P08-F03
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/components/mindflare/IdeasFilter.tsx` (update)

**Implement:**
- Search input with debounce
- Classification dropdown
- Labels multi-select with counts
- Status filter (All, Active, Baking, Archived)
- Source filter (All, Manual, Slack)
- Date range picker
- Sort dropdown (Newest, Oldest, etc.)
- Active filters as removable pills
- Clear all filters button
- Mobile: collapsible/bottom sheet

---

## Phase 3: Correlation UI

### T09: Create SimilarIdeasPanel component (enhanced)

- [ ] Estimate: 1.5hr
- [ ] Tests: `docker/hitl-ui/src/components/mindflare/SimilarIdeasPanel.test.tsx`
- [ ] Dependencies: P08-F04
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/components/mindflare/SimilarIdeasPanel.tsx` (update)

**Implement:**
- List similar ideas with mini cards
- Similarity percentage display
- Correlation type badge
- "Link" button to create correlation
- "View" button to open idea
- Loading state
- Empty state
- Pagination/load more

---

### T10: Create CorrelationsList component (enhanced)

- [ ] Estimate: 1.5hr
- [ ] Tests: `docker/hitl-ui/src/components/mindflare/CorrelationsList.test.tsx`
- [ ] Dependencies: P08-F04
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/components/mindflare/CorrelationsList.tsx` (update)

**Implement:**
- Group by correlation type
- Type header with count
- Each item shows target idea preview
- Status badge (accepted, refined)
- Remove button with confirmation
- Edit type dropdown
- Notes display/edit
- Empty state

---

### T11: Create CorrelationReviewPanel component

- [ ] Estimate: 2hr
- [ ] Tests: `docker/hitl-ui/src/components/mindflare/CorrelationReviewPanel.test.tsx`
- [ ] Dependencies: P08-F04
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/components/mindflare/CorrelationReviewPanel.tsx`

**Implement:**
- Pending suggestions list
- Count badge in header
- Suggestion card with both ideas
- Similarity score and reasoning
- Accept/Reject/Refine buttons
- Refine modal with type dropdown
- Notes input for refine
- Keyboard shortcuts (A/R keys)
- Bulk actions (accept all, reject all)
- Empty state ("All caught up!")

---

## Phase 4: Graph Visualization

### T12: Create IdeasGraph component (enhanced)

- [ ] Estimate: 2.5hr
- [ ] Tests: `docker/hitl-ui/src/components/mindflare/IdeasGraph.test.tsx`
- [ ] Dependencies: P08-F04
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/components/mindflare/IdeasGraph.tsx` (update)

**Implement:**
- D3.js force-directed graph
- Nodes: colored by classification, sized by correlations
- Edges: styled by correlation type
- Zoom/pan controls
- Node click -> opens idea detail
- Node hover -> shows tooltip
- Filter controls (label, classification)
- Legend for colors and edge types
- Responsive container
- Performance optimization (limit nodes)

---

### T13: Create ClustersPanel component (enhanced)

- [ ] Estimate: 1.5hr
- [ ] Tests: `docker/hitl-ui/src/components/mindflare/ClustersPanel.test.tsx`
- [ ] Dependencies: P08-F04
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/components/mindflare/ClustersPanel.tsx` (update)

**Implement:**
- List clusters with name and count
- Expand to see member ideas
- Rename cluster inline
- Click idea to open detail
- "View in Graph" button
- Merge clusters (drag-drop or button)
- Empty state

---

## Phase 5: Pages

### T14: Create MindflareHubPage

- [ ] Estimate: 2hr
- [ ] Tests: `docker/hitl-ui/src/pages/MindflareHubPage.test.tsx`
- [ ] Dependencies: T06, T07, T08, T05
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/pages/MindflareHubPage.tsx`

**Layout:**
- Header with title and CreateIdeaButton
- Search and filter bar
- Active filter pills
- Two-column layout (list + detail panel)
- Responsive: single column on mobile
- URL sync for filters and selection
- Route: `/mindflare`

---

### T15: Create MindflareGraphPage

- [ ] Estimate: 1.5hr
- [ ] Tests: `docker/hitl-ui/src/pages/MindflareGraphPage.test.tsx`
- [ ] Dependencies: T12, T13
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/pages/MindflareGraphPage.tsx`

**Layout:**
- Full-page graph view
- Filter controls in header
- Clusters sidebar (collapsible)
- Full-screen toggle
- Route: `/mindflare/graph`

---

### T16: Create MindflareIdeaDetailPage (mobile)

- [ ] Estimate: 1hr
- [ ] Tests: `docker/hitl-ui/src/pages/MindflareIdeaDetailPage.test.tsx`
- [ ] Dependencies: T07
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/pages/MindflareIdeaDetailPage.tsx`

**Layout:**
- Full-page detail view for mobile
- Back button to list
- All detail panel features
- Route: `/mindflare/:ideaId`

---

## Phase 6: Store & Integration

### T17: Enhance ideasStore with correlations

- [ ] Estimate: 1.5hr
- [ ] Tests: `docker/hitl-ui/src/stores/mindflareStore.test.ts`
- [ ] Dependencies: P08-F01, P08-F04
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/stores/mindflareStore.ts` (update)

**Implement:**
- Add correlation state (correlations, pendingSuggestions)
- Add graph state (nodes, edges, clusters)
- `fetchCorrelations()` action
- `findSimilar()` action
- `acceptCorrelation()` action
- `rejectCorrelation()` action
- `refineCorrelation()` action
- `fetchGraph()` action
- `fetchClusters()` action

---

### T18: Implement "Bake in Studio" flow

- [ ] Estimate: 1hr
- [ ] Tests: `docker/hitl-ui/src/stores/mindflareStore.test.ts`
- [ ] Dependencies: T17, P05-F11
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/stores/mindflareStore.ts` (addition)

**Implement:**
- `bakeIdea()` action
- Call bake API endpoint
- Update idea status to "baking"
- Navigate to Ideation Studio
- Pass idea content as initial context
- Handle errors

---

### T19: Add routes to App.tsx

- [ ] Estimate: 30min
- [ ] Tests: Route verification
- [ ] Dependencies: T14, T15, T16
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/App.tsx`

**Implement:**
- `/mindflare` -> MindflareHubPage
- `/mindflare/graph` -> MindflareGraphPage
- `/mindflare/:ideaId` -> MindflareIdeaDetailPage (mobile redirect)
- Add to navigation sidebar

---

### T20: Update navigation sidebar

- [ ] Estimate: 30min
- [ ] Tests: Manual verification
- [ ] Dependencies: T19
- [ ] Agent: frontend

**File:** `docker/hitl-ui/src/components/layout/Sidebar.tsx`

**Implement:**
- Add "Mindflare Hub" nav item
- Add "Ideas Graph" sub-item
- Active state styling
- Icon (LightBulbIcon)

---

## Phase 7: Testing & Polish

### T21: Integration tests for Mindflare Hub

- [ ] Estimate: 2hr
- [ ] Tests: `docker/hitl-ui/src/pages/MindflareHubPage.integration.test.tsx`
- [ ] Dependencies: T14
- [ ] Agent: frontend

**Implement:**
- Test create idea flow
- Test search and filter
- Test select and view detail
- Test bake flow
- Test correlation review
- Test graph visualization
- Test responsive behavior

---

### T22: Accessibility audit and fixes

- [ ] Estimate: 1.5hr
- [ ] Tests: Manual + axe-core
- [ ] Dependencies: T14, T15
- [ ] Agent: frontend

**Implement:**
- Keyboard navigation
- ARIA labels and roles
- Focus management
- Screen reader testing
- Color contrast verification
- Reduced motion support

---

## Task Dependencies Graph

```
T01 ───┬──► T06 ───────────────────────────────────┬──► T14 ───► T19
       │                                           │
T02 ───┼──► T04 ───► T05 ──────────────────────────┤
       │                                           │
T03 ───┘                                           │
                                                   │
T07 ───────────────────────────────────────────────┼──► T16
                                                   │
T08 ─────────────────────────────────────────────► T14
                                                   │
T09 ───────────────────────────────────────────────┤
                                                   │
T10 ───────────────────────────────────────────────┤
                                                   │
T11 ───────────────────────────────────────────────┤
                                                   │
T12 ───┬──► T15 ───────────────────────────────────┤
       │                                           │
T13 ───┘                                           │
                                                   │
T17 ───► T18 ─────────────────────────────────────►┤
                                                   │
T19 ───► T20                                       │
                                                   │
T21 depends on: T14                                │
T22 depends on: T14, T15 ─────────────────────────►┘
```

---

## Verification Checklist

### Unit Tests
- [ ] `npm test -- src/components/mindflare/IdeaCard`
- [ ] `npm test -- src/components/mindflare/IdeaForm`
- [ ] `npm test -- src/components/mindflare/IdeasListView`
- [ ] `npm test -- src/components/mindflare/IdeaDetailPanel`
- [ ] `npm test -- src/components/mindflare/IdeasFilter`
- [ ] `npm test -- src/components/mindflare/CorrelationReviewPanel`
- [ ] `npm test -- src/components/mindflare/IdeasGraph`
- [ ] `npm test -- src/pages/MindflareHubPage`

### Integration Tests
- [ ] `npm test -- src/pages/MindflareHubPage.integration.test`

### Manual Verification
1. Create idea with 100 words -> Success
2. Search for keyword -> Results shown
3. Filter by label -> Filtered correctly
4. Click "Bake" -> Opens Ideation Studio
5. Accept correlation -> Saved correctly
6. View graph -> Visualizes connections
7. Mobile view -> Layout adapts
8. Keyboard navigation -> All accessible

### Accessibility
- [ ] Keyboard-only navigation works
- [ ] Screen reader announces content
- [ ] Color contrast passes WCAG AA
- [ ] Focus indicators visible

---

## Estimates Summary

| Phase | Tasks | Total Estimate |
|-------|-------|----------------|
| Phase 1: Core Components | T01-T05 | 5.5hr |
| Phase 2: List & Detail | T06-T08 | 5.5hr |
| Phase 3: Correlation UI | T09-T11 | 5hr |
| Phase 4: Graph | T12-T13 | 4hr |
| Phase 5: Pages | T14-T16 | 4.5hr |
| Phase 6: Store & Routes | T17-T20 | 3.5hr |
| Phase 7: Testing | T21-T22 | 3.5hr |

**Total Estimate:** ~31.5 hours
