# P05-F06: HITL UI v2 (Full SPA) - Task Breakdown

## Progress

- Started: 2026-01-23
- Tasks Complete: 7/68
- Percentage: 10%
- Status: IN_PROGRESS
- Blockers: None

---

## Phase 1: Foundation & Infrastructure (8 tasks)

### TASK-001: Update package dependencies ✓
- [x] Add new runtime dependencies (react-markdown, prismjs, diff, socket.io-client, react-d3-tree)
- [x] Add new dev dependencies (@types/prismjs, @types/diff)
- [x] Update tailwind.config.js with extended color palette
- [x] Test that all dependencies install without conflicts
- **Estimate:** 30min
- **Tests:** `npm install` succeeds, no peer dependency warnings
- **Completed:** 2026-01-23

### TASK-002: Create new Zustand stores ✓
- [x] Create `sessionStore.ts` (environment, repo, epic, git state)
- [x] Create `studioStore.ts` (chat messages, working outline, artifacts)
- [x] Create `eventStore.ts` (WebSocket events, connection state)
- [x] Write unit tests for all store actions
- **Estimate:** 1h
- **Tests:** Store actions update state correctly
- **Completed:** 2026-01-23
- **Test Results:** 12 tests passed (sessionStore: 4, studioStore: 4, eventStore: 4)

### TASK-003: Implement WebSocket client utility ✓
- [x] Create `utils/websocket.ts` with connection management
- [x] Implement reconnection logic (exponential backoff via socket.io)
- [x] Add connection state tracking
- [x] Add event subscription/unsubscription
- [x] Write unit tests for reconnection logic
- [x] Document edge cases in code comments
- [x] Add VITE_WS_URL to .env.example
- **Estimate:** 1.5h
- **Tests:** 18 tests passed (connection, reconnection, events, error handling)
- **Completed:** 2026-01-23
- **Implementation Notes:**
  - Used socket.io-client per orchestrator recommendation
  - Built-in exponential backoff (1000-5000ms, max 10 attempts)
  - Automatic fallback to polling transport
  - Singleton instance exported as `wsClient`
  - 7 edge cases documented in code comments
  - Full integration with eventStore for connection state
  - Proper TypeScript types (EventHandler type defined)

### TASK-004: Create API client modules ✓
- [x] Create `api/runs.ts` (list runs, get run detail, KPIs, workflow graph, git states)
- [x] Create `api/studio.ts` (chat, context query, outline, PRD preview)
- [x] Create `api/artifacts.ts` (list, detail, history, provenance, spec index)
- [x] Create `api/websocket.ts` (event stream connection wrapper with EventTypes)
- [x] Extend `api/types.ts` with 50+ new interfaces/types
- **Estimate:** 1.5h
- **Tests:** 42 tests passed (runs: 9, studio: 9, artifacts: 13, websocket: 11)
- **Completed:** 2026-01-23
- **Implementation Notes:**
  - Extended types.ts with Agent Cockpit types (runs, KPIs, workflow, git)
  - Extended types.ts with Discovery Studio types (chat, outline, context)
  - Extended types.ts with Artifact Management types (detail, history, provenance)
  - API modules wrap axios client with typed responses
  - WebSocket API wrapper provides convenient interface with EventTypes constants

### TASK-005: Update layout components ✓
- [x] Update `Sidebar.tsx` with new navigation items
- [x] Update `Header.tsx` with session selector
- [x] Create `RightPanel.tsx` (evidence drawer + live event feed)
- [x] Create `StatusBar.tsx` (bottom status bar)
- [x] Write Vitest tests for layout components
- **Estimate:** 2h
- **Tests:** 54 tests passed (Sidebar: 7, Header: 11, RightPanel: 14, StatusBar: 13, Layout: 9)
- **Completed:** 2026-01-23
- **Implementation Notes:**
  - Sidebar: Collapsible navigation sections, Workflow + Operations categories
  - Header: Environment/Repo/Epic selectors with sessionStore integration
  - RightPanel: Live event feed with filtering, auto-scroll, connection status
  - StatusBar: Git info, worker count, pending gates, system health indicator
  - Layout: Updated to include RightPanel and StatusBar with toggle state

### TASK-006: Implement base utilities ✓
- [x] Create `utils/markdown.ts` (markdown parsing helpers)
- [x] Create `utils/diff.ts` (diff formatting helpers)
- [x] Extend `utils/formatters.ts` (token, cost, duration, git formatters)
- [x] Write unit tests for all utility functions
- **Estimate:** 1h
- **Tests:** 92 tests passed (formatters: 36, markdown: 36, diff: 20)
- **Completed:** 2026-01-23
- **Implementation Notes:**
  - formatters.ts: Added formatTokens, formatCost, formatDuration, formatNumber, formatGitSha, formatEpicId, formatRunId
  - markdown.ts: TOC extraction, code block parsing, word count, reading time, isMarkdown detection, stripMarkdown, excerpt generation
  - diff.ts: Line diff, word diff, unified diff parsing, stats calculation, diff collapsing

### TASK-007: Create mock data layer
- [ ] Create `api/mocks/runs.ts` (mock run data)
- [ ] Create `api/mocks/studio.ts` (mock chat responses)
- [ ] Create `api/mocks/artifacts.ts` (mock artifacts)
- [ ] Create `api/mocks/events.ts` (mock event stream)
- [ ] Add `VITE_USE_MOCKS` env var support
- **Estimate:** 1.5h
- **Tests:** Mock responses match contract schemas

### TASK-008: Update routing in App.tsx ✓
- [x] Add routes for new pages (/docs, /cockpit, /studio/*, /artifacts)
- [x] Implement lazy loading for route components
- [x] Add 404 page
- [x] Test route navigation
- **Estimate:** 45min
- **Tests:** All routes load, lazy loading works
- **Completed:** 2026-01-23
- **Implementation Notes:**
  - Created placeholder pages: DocsPage, CockpitPage, RunDetailPage, StudioDiscoveryPage, ArtifactsPage, ArtifactDetailPage, NotFoundPage
  - Implemented lazy loading with React.lazy() and Suspense
  - Dashboard loaded eagerly for fast initial render
  - Added PageLoader component for loading states

---

## Phase 2: Common Components (10 tasks)

### TASK-009: Implement MarkdownRenderer
- [ ] Create `MarkdownRenderer.tsx` with react-markdown
- [ ] Add syntax highlighting with Prism.js
- [ ] Implement view/diff/side-by-side modes
- [ ] Add table of contents generation
- [ ] Add copy code block functionality
- [ ] Write Vitest tests for all modes
- **Estimate:** 2h
- **Tests:** Markdown renders correctly, code highlights, diff mode works

### TASK-010: Implement CodeDiff component
- [ ] Create `CodeDiff.tsx` using diff library
- [ ] Implement unified and side-by-side views
- [ ] Add line number display
- [ ] Add syntax highlighting for diffs
- [ ] Write Vitest tests
- **Estimate:** 1.5h
- **Tests:** Diffs display correctly, line numbers match

### TASK-011: Implement LiveEventFeed
- [ ] Create `LiveEventFeed.tsx` connected to eventStore
- [ ] Implement auto-scroll with pause functionality
- [ ] Add event filtering (type, epic, agent)
- [ ] Add event expansion for details
- [ ] Implement 100-event limit with pruning
- [ ] Write Vitest tests with mock WebSocket
- **Estimate:** 2h
- **Tests:** Events display, filter works, auto-scroll can be paused

### TASK-012: Implement StatusBadge
- [ ] Create `StatusBadge.tsx` with variants (success, warning, error, info, pending)
- [ ] Add icon support
- [ ] Add size variants (sm, md, lg)
- [ ] Write Vitest tests
- **Estimate:** 30min
- **Tests:** All variants render with correct colors

### TASK-013: Implement ArtifactCard
- [ ] Create `ArtifactCard.tsx` for artifact previews
- [ ] Add validation status display
- [ ] Add diff view support
- [ ] Add action buttons (Download, Save, Submit, Open)
- [ ] Write Vitest tests
- **Estimate:** 1h
- **Tests:** Card displays artifact metadata, actions trigger callbacks

### TASK-014: Implement PolicyBadge
- [ ] Create `PolicyBadge.tsx` for displaying active guardrails
- [ ] Add tooltip with policy details
- [ ] Add variants for different policy types
- [ ] Write Vitest tests
- **Estimate:** 30min
- **Tests:** Badge displays, tooltip shows details

### TASK-015: Implement EvidenceBundleViewer
- [ ] Create `EvidenceBundleViewer.tsx` for test results/diffs/reports
- [ ] Add tab support for different evidence types
- [ ] Add expandable sections for raw logs
- [ ] Write Vitest tests
- **Estimate:** 1.5h
- **Tests:** Evidence displays correctly, tabs work

### TASK-016: Implement GitStatusIndicator
- [ ] Create `GitStatusIndicator.tsx` showing branch/SHA/pending commits
- [ ] Add "View in Git" link action
- [ ] Add drift warning indicator
- [ ] Write Vitest tests
- **Estimate:** 45min
- **Tests:** Git info displays, link navigates correctly

### TASK-017: Implement SearchInput component
- [ ] Create `SearchInput.tsx` with debounced input
- [ ] Add clear button
- [ ] Add loading indicator
- [ ] Write Vitest tests
- **Estimate:** 45min
- **Tests:** Debounce works, clear button resets input

### TASK-018: Implement FilterDropdown component
- [ ] Create `FilterDropdown.tsx` for multi-select filters
- [ ] Add "Select All" / "Clear All" actions
- [ ] Add badge showing active filter count
- [ ] Write Vitest tests
- **Estimate:** 1h
- **Tests:** Multi-select works, filter count updates

---

## Phase 3: Documentation Page (4 tasks)

### TASK-019: Implement BlueprintMap component
- [ ] Create `BlueprintMap.tsx` with clickable cluster diagram
- [ ] Add cluster expansion to show agents/artifacts/gates
- [ ] Implement navigation links from clusters
- [ ] Add responsive layout
- [ ] Write Vitest tests
- **Estimate:** 2h
- **Tests:** Clusters click, expansion shows details, links navigate

### TASK-020: Implement MethodologyStepper
- [ ] Create `MethodologyStepper.tsx` with 8 stages
- [ ] Add prev/next navigation
- [ ] Display stage details (why, inputs/outputs, approvals, issues)
- [ ] Add progress indicator
- [ ] Write Vitest tests
- **Estimate:** 1.5h
- **Tests:** Navigation works, all stages display

### TASK-021: Implement InteractiveGlossary
- [ ] Create `InteractiveGlossary.tsx` with search
- [ ] Add 20+ aSDLC terms with definitions
- [ ] Implement "Show me in the system" deep links
- [ ] Add alphabetical organization
- [ ] Write Vitest tests
- **Estimate:** 1h
- **Tests:** Search filters correctly, links navigate

### TASK-022: Create DocsPage
- [ ] Create `DocsPage.tsx` composing Blueprint, Stepper, Glossary
- [ ] Add Learn/Apply tab switcher
- [ ] Add page layout and styling
- [ ] Write integration test
- **Estimate:** 1h
- **Tests:** Page renders, tabs switch, all components display

---

## Phase 4: Agent Cockpit (10 tasks)

### TASK-023: Implement KPIHeader
- [ ] Create `KPIHeader.tsx` displaying 5 KPIs
- [ ] Connect to TanStack Query for data fetching
- [ ] Add color coding (green/yellow/red)
- [ ] Add click handlers to filter runs table
- [ ] Add real-time updates (polling or WebSocket)
- [ ] Write Vitest tests with mock data
- **Estimate:** 1.5h
- **Tests:** KPIs display, colors update based on thresholds, clicks filter

### TASK-024: Implement WorkerUtilizationPanel
- [ ] Create `WorkerUtilizationPanel.tsx` listing workers
- [ ] Display worker status, current task, model
- [ ] Add status filter
- [ ] Add utilization percentage indicator
- [ ] Add real-time updates
- [ ] Write Vitest tests
- **Estimate:** 1.5h
- **Tests:** Workers display, filter works, updates in real-time

### TASK-025: Implement WorkflowGraphView
- [ ] Create `WorkflowGraphView.tsx` with Sankey/node graph
- [ ] Use react-d3-tree or Recharts for visualization
- [ ] Add click handlers on edges/nodes to filter runs
- [ ] Add tooltips with metrics
- [ ] Write Vitest tests with mock graph data
- **Estimate:** 2h
- **Tests:** Graph renders, clicks filter runs, tooltips display

### TASK-026: Implement RunsTable
- [ ] Create `RunsTable.tsx` with sortable columns
- [ ] Add filters (cluster, agent, status, model, repo, environment, date range)
- [ ] Add pagination (50 per page)
- [ ] Add search by run_id/epic
- [ ] Connect to TanStack Query
- [ ] Write Vitest tests
- **Estimate:** 2h
- **Tests:** Table displays, sort works, filters work, pagination works

### TASK-027: Implement GitIntegrationPanel
- [ ] Create `GitIntegrationPanel.tsx` showing per-environment git state
- [ ] Display branch, SHA, pending commits, recent commits
- [ ] Add "View in Git" links
- [ ] Add "Force sync" action with confirmation
- [ ] Add drift indicator
- [ ] Write Vitest tests
- **Estimate:** 1.5h
- **Tests:** Git state displays, links navigate, force sync shows confirmation

### TASK-028: Create CockpitPage
- [ ] Create `CockpitPage.tsx` composing KPI, Worker, Graph, Runs, Git panels
- [ ] Add responsive grid layout
- [ ] Add page-level loading state
- [ ] Write integration test
- **Estimate:** 1h
- **Tests:** Page renders all panels, layout is responsive

### TASK-029: Implement RunTimeline component
- [ ] Create `RunTimeline.tsx` displaying chronological events
- [ ] Add visual markers (start, tool calls, completion, failure)
- [ ] Add expandable event details
- [ ] Add timeline scrolling
- [ ] Write Vitest tests
- **Estimate:** 1.5h
- **Tests:** Timeline displays events, markers show, expansion works

### TASK-030: Implement RunInputsTab
- [ ] Create `RunInputsTab.tsx` showing artifacts/context packs/config
- [ ] Display input artifacts with links
- [ ] Show context pack token counts
- [ ] Display configuration parameters
- [ ] Write Vitest tests
- **Estimate:** 1h
- **Tests:** Inputs display correctly

### TASK-031: Implement RunOutputsTab
- [ ] Create `RunOutputsTab.tsx` showing outputs/patches/test results
- [ ] Display created artifacts with links
- [ ] Show patches with diffs
- [ ] Show test result summary
- [ ] Write Vitest tests
- **Estimate:** 1h
- **Tests:** Outputs display correctly

### TASK-032: Implement EvidenceTab
- [ ] Create `EvidenceTab.tsx` using EvidenceBundleViewer
- [ ] Display test reports, diffs, security scans
- [ ] Add expandable sections
- [ ] Write Vitest tests
- **Estimate:** 45min
- **Tests:** Evidence displays

---

## Phase 5: RLM Trajectory Viewer (2 tasks)

### TASK-033: Implement RLMTrajectoryViewer
- [ ] Create `RLMTrajectoryViewer.tsx` with hierarchical tree
- [ ] Add expand/collapse functionality
- [ ] Display tool calls per subcall
- [ ] Show token/cost metrics per subcall
- [ ] Add visual success/failure indicators
- [ ] Add "Expand All" / "Collapse All" actions
- [ ] Limit to 10 subcall depth with pagination
- [ ] Write Vitest tests with nested mock data
- **Estimate:** 2h
- **Tests:** Tree displays, expand/collapse works, metrics sum correctly

### TASK-034: Create RunDetailPage
- [ ] Create `RunDetailPage.tsx` with 4 tabs
- [ ] Add tab navigation (Timeline, Inputs, Outputs, Evidence)
- [ ] Add RLM Trajectory Viewer (conditionally if RLM run)
- [ ] Add run actions (Rerun, Export, Escalate)
- [ ] Write integration test
- **Estimate:** 1h
- **Tests:** Page renders, tabs switch, RLM viewer shows for RLM runs

---

## Phase 6: Discovery Studio (6 tasks)

### TASK-035: Implement ChatInterface
- [ ] Create `ChatInterface.tsx` with message history
- [ ] Add message input with send button
- [ ] Implement streaming responses (typing indicator)
- [ ] Add message timestamps
- [ ] Add auto-scroll to latest message
- [ ] Write Vitest tests with mock streaming
- **Estimate:** 2h
- **Tests:** Messages display, streaming works, auto-scroll works

### TASK-036: Implement WorkingOutlinePanel
- [ ] Create `WorkingOutlinePanel.tsx` with section checklist
- [ ] Add completeness percentage indicator
- [ ] Add section status icons (✓, ⏳, ○)
- [ ] Add "Preview PRD" and "Save Draft" buttons
- [ ] Connect to studioStore
- [ ] Write Vitest tests
- **Estimate:** 1.5h
- **Tests:** Outline updates when store changes, percentage calculates correctly

### TASK-037: Implement OutputQuickviewPanel
- [ ] Create `OutputQuickviewPanel.tsx` displaying artifact cards
- [ ] Use ArtifactCard component
- [ ] Add validation status display
- [ ] Add card actions (Download, Save, Submit, Open)
- [ ] Write Vitest tests
- **Estimate:** 1h
- **Tests:** Cards display, actions trigger

### TASK-038: Implement ModelCostSelector
- [ ] Create `ModelCostSelector.tsx` with model dropdown
- [ ] Add RLM mode toggle
- [ ] Add cost estimate display
- [ ] Add RLM confirmation modal with warning
- [ ] Write Vitest tests
- **Estimate:** 1h
- **Tests:** Model selection updates, RLM toggle shows confirmation

### TASK-039: Implement ContextPackPreview
- [ ] Create `ContextPackPreview.tsx` showing file list with relevance scores
- [ ] Display token count breakdown
- [ ] Display cost estimate
- [ ] Add "Add to session" action
- [ ] Write Vitest tests
- **Estimate:** 1h
- **Tests:** Preview displays files, token count sums correctly

### TASK-040: Create StudioDiscoveryPage
- [ ] Create `StudioDiscoveryPage.tsx` composing Chat, Outline, Output panels
- [ ] Add 3-column layout (Chat | Outline | Output)
- [ ] Connect to studioStore and API
- [ ] Add page-level loading state
- [ ] Write integration test for full chat workflow
- **Estimate:** 1.5h
- **Tests:** Page renders, chat workflow updates outline and outputs

---

## Phase 7: Artifacts (8 tasks)

### TASK-041: Implement ArtifactExplorer table
- [ ] Create `ArtifactExplorer.tsx` with sortable table
- [ ] Add columns (name, type, epic, status, created, approved, SHA)
- [ ] Add filters (epic, type, status, date range, agent, gate)
- [ ] Add pagination (50 per page)
- [ ] Add search by filename
- [ ] Connect to TanStack Query
- [ ] Write Vitest tests
- **Estimate:** 2h
- **Tests:** Table displays, sort/filter/search work

### TASK-042: Implement SpecIndexBrowser
- [ ] Create `SpecIndexBrowser.tsx` with tree view
- [ ] Display 4 folders (Discovery, Design, Development, Validation)
- [ ] Add status icons per artifact (✓, ⏳, 🔄, ○)
- [ ] Display progress summary
- [ ] Add click handlers to open artifact detail
- [ ] Write Vitest tests with mock spec index
- **Estimate:** 2h
- **Tests:** Tree displays, clicks navigate, progress calculates

### TASK-043: Implement ArtifactDetailView Content Tab
- [ ] Create `ContentTab.tsx` using MarkdownRenderer
- [ ] Add table of contents navigation
- [ ] Display validation status
- [ ] Add copy content button
- [ ] Write Vitest tests
- **Estimate:** 1h
- **Tests:** Content renders, TOC navigates, copy works

### TASK-044: Implement ArtifactDetailView History Tab
- [ ] Create `HistoryTab.tsx` with version timeline
- [ ] Add click to view any version
- [ ] Add compare two versions (diff view)
- [ ] Use CodeDiff component
- [ ] Write Vitest tests
- **Estimate:** 1.5h
- **Tests:** Timeline displays, version view works, diff works

### TASK-045: Implement ArtifactDetailView Provenance Tab
- [ ] Create `ProvenanceTab.tsx` showing creation provenance
- [ ] Display producing run, input artifacts, approving gate, approval info
- [ ] Add links to runs and gates
- [ ] Display associated feedback
- [ ] Write Vitest tests
- **Estimate:** 1h
- **Tests:** Provenance info displays, links navigate

### TASK-046: Implement ArtifactDetailView ContextPack Tab
- [ ] Create `ContextPackTab.tsx` using ContextPackPreview
- [ ] Display files included in context when created
- [ ] Show token count breakdown
- [ ] Add "Regenerate with current context" action
- [ ] Write Vitest tests
- **Estimate:** 1h
- **Tests:** Context pack displays, regenerate triggers API call

### TASK-047: Create ArtifactDetailPage
- [ ] Create `ArtifactDetailPage.tsx` with 4 tabs
- [ ] Add tab navigation (Content, History, Provenance, Context Pack)
- [ ] Add artifact actions (Download, Export, View in Git, Submit to gate)
- [ ] Write integration test
- **Estimate:** 1h
- **Tests:** Page renders, tabs switch, actions work

### TASK-048: Create ArtifactsPage
- [ ] Create `ArtifactsPage.tsx` with ArtifactExplorer and SpecIndexBrowser
- [ ] Add tab switcher (Explorer | Spec Index)
- [ ] Add page layout and styling
- [ ] Write integration test
- **Estimate:** 45min
- **Tests:** Page renders both views, tabs switch

---

## Phase 8: Enhanced HITL Gates (4 tasks)

### TASK-049: Implement SimilarRejectionPanel
- [ ] Create `SimilarRejectionPanel.tsx` displaying pattern info
- [ ] Show pattern description, occurrence count, examples
- [ ] Add "View Pattern Details" expansion
- [ ] Add "Ignore for this review" action
- [ ] Write Vitest tests
- **Estimate:** 1.5h
- **Tests:** Panel displays when patterns exist, expansion works

### TASK-050: Implement FeedbackCapture form
- [ ] Create `FeedbackCapture.tsx` with structured feedback fields
- [ ] Add tags (Quality, Completeness, Scope, Style, Other)
- [ ] Add correction summary text area
- [ ] Add severity selector
- [ ] Add "consider for improvement" checkbox
- [ ] Track review duration
- [ ] Write Vitest tests
- **Estimate:** 1.5h
- **Tests:** Form captures all fields, review duration tracks

### TASK-051: Update GateDetailPage with feedback
- [ ] Update `GateDetailPage.tsx` to include SimilarRejectionPanel
- [ ] Update decision panel to include FeedbackCapture
- [ ] Update decision submission to include feedback
- [ ] Add feedback ID to audit log
- [ ] Write integration test
- **Estimate:** 1h
- **Tests:** Feedback submits with decision, appears in audit log

### TASK-052: Implement RuleProposalCard (for future Meta-HITL)
- [ ] Create `RuleProposalCard.tsx` for rule review gates
- [ ] Display proposed rule, affected agents, evidence
- [ ] Show impact analysis
- [ ] Add decision actions (Approve, Modify, Reject)
- [ ] Write Vitest tests
- **Estimate:** 1h
- **Tests:** Card displays rule info, decision actions trigger

---

## Phase 9: Integration & Testing (8 tasks)

### TASK-053: Implement WebSocket integration
- [ ] Connect eventStore to WebSocket on app mount
- [ ] Subscribe to event stream
- [ ] Handle connection/disconnection in UI
- [ ] Add reconnection logic
- [ ] Add polling fallback if WebSocket unavailable
- [ ] Write integration test with mock WebSocket server
- **Estimate:** 1.5h
- **Tests:** Events received, reconnection works, fallback works

### TASK-054: Implement TanStack Query integration
- [ ] Set up query client with cache configuration
- [ ] Add query keys for all endpoints
- [ ] Implement polling for non-WebSocket data
- [ ] Add cache invalidation on mutations
- [ ] Add optimistic updates for gate decisions
- [ ] Write integration tests
- **Estimate:** 1.5h
- **Tests:** Queries fetch, cache works, invalidation works

### TASK-055: Add error boundary and error handling
- [ ] Create global error boundary component
- [ ] Add error states to all pages
- [ ] Add toast notifications for errors
- [ ] Add retry logic for failed requests
- [ ] Write error handling tests
- **Estimate:** 1h
- **Tests:** Error boundary catches errors, toasts display

### TASK-056: Add loading states
- [ ] Create loading spinner component
- [ ] Add loading states to all pages
- [ ] Add skeleton screens for tables/lists
- [ ] Add streaming indicators for chat
- [ ] Write tests
- **Estimate:** 1h
- **Tests:** Loading states display during fetch

### TASK-057: Implement keyboard navigation
- [ ] Add keyboard shortcuts for common actions
- [ ] Ensure all interactive elements are keyboard accessible
- [ ] Add focus management for modals/dropdowns
- [ ] Test with keyboard only
- **Estimate:** 1h
- **Tests:** Tab navigation works, shortcuts work

### TASK-058: Add accessibility attributes
- [ ] Add ARIA labels to all interactive elements
- [ ] Add role attributes where appropriate
- [ ] Ensure color contrast meets WCAG AA
- [ ] Test with screen reader
- [ ] Run accessibility audit (axe or WAVE)
- **Estimate:** 1.5h
- **Tests:** Accessibility audit score > 90

### TASK-059: Write E2E tests for critical paths
- [ ] E2E test: Discovery workflow (chat → outline → artifact)
- [ ] E2E test: Gate approval workflow
- [ ] E2E test: Artifact browsing and detail view
- [ ] E2E test: Run detail view with RLM trajectory
- [ ] Use Playwright or Cypress
- **Estimate:** 2h
- **Tests:** All E2E tests pass

### TASK-060: Performance optimization
- [ ] Add code splitting for route components
- [ ] Add lazy loading for heavy components (graph, trajectory viewer)
- [ ] Implement virtual scrolling for long lists (runs, artifacts, events)
- [ ] Optimize markdown rendering (memoization)
- [ ] Add syntax highlighting lazy loading
- [ ] Run Lighthouse audit
- **Estimate:** 2h
- **Tests:** Lighthouse performance score > 80

---

## Phase 10: Deployment & Documentation (8 tasks)

### TASK-061: Update Dockerfile
- [ ] Update Dockerfile with new dependencies
- [ ] Ensure build stage uses correct Node version
- [ ] Verify nginx serve stage works
- [ ] Test Docker build locally
- **Estimate:** 30min
- **Tests:** Docker image builds, container runs

### TASK-062: Update environment variables
- [ ] Add all new env vars to .env.example
- [ ] Document env vars in README
- [ ] Add env var validation on app start
- **Estimate:** 30min
- **Tests:** App starts with all env vars

### TASK-063: Create component documentation
- [ ] Document all major components with JSDoc
- [ ] Add Storybook stories for common components
- [ ] Add usage examples
- **Estimate:** 2h
- **Tests:** Storybook renders all stories

### TASK-064: Update API contract validation
- [ ] Validate all API responses against contracts/current/hitl_api.json
- [ ] Add runtime type checking (Zod or similar)
- [ ] Add contract tests
- **Estimate:** 1.5h
- **Tests:** All API responses validate

### TASK-065: Add feature flags
- [ ] Implement feature flag system
- [ ] Add flags for new pages (docs, cockpit, studio, artifacts)
- [ ] Add UI to toggle flags (admin page or localStorage)
- [ ] Test incremental rollout
- **Estimate:** 1h
- **Tests:** Feature flags toggle pages on/off

### TASK-066: Create migration guide
- [ ] Document migration from P05-F01 to P05-F06
- [ ] List breaking changes (if any)
- [ ] Provide rollback plan
- **Estimate:** 1h
- **Tests:** N/A (documentation)

### TASK-067: Deploy to staging
- [ ] Build and push Docker image to registry
- [ ] Deploy to staging Kubernetes cluster
- [ ] Run smoke tests on staging
- [ ] Verify WebSocket connection works
- [ ] Verify all pages load
- **Estimate:** 1h
- **Tests:** Staging deployment successful, smoke tests pass

### TASK-068: Conduct user acceptance testing
- [ ] Create UAT test plan
- [ ] Recruit 3-5 internal users
- [ ] Conduct UAT sessions
- [ ] Collect feedback
- [ ] Fix critical issues
- [ ] Get sign-off for production
- **Estimate:** 4h (distributed over multiple days)
- **Tests:** UAT feedback addressed, sign-off obtained

---

## Task Dependencies

### Critical Path
1. TASK-001 → TASK-002 → TASK-003 → TASK-004 (Foundation)
2. TASK-005 → TASK-008 (Layout & Routing)
3. TASK-009 → TASK-010 (Markdown & Diff rendering - needed by many pages)
4. Foundation → Common Components → Page Components → Integration → Deployment

### Parallel Tracks
- **Track 1 (Docs)**: TASK-019 → TASK-020 → TASK-021 → TASK-022
- **Track 2 (Cockpit)**: TASK-023 → TASK-024 → TASK-025 → TASK-026 → TASK-027 → TASK-028
- **Track 3 (Studio)**: TASK-035 → TASK-036 → TASK-037 → TASK-038 → TASK-039 → TASK-040
- **Track 4 (Artifacts)**: TASK-041 → TASK-042 → TASK-043 → TASK-044 → TASK-045 → TASK-046 → TASK-047 → TASK-048

All tracks converge at Phase 9 (Integration & Testing).

---

## Notes

- Each task should take < 2 hours
- Mark task as complete only after tests pass
- Update progress percentage after each task
- If blocked, document blocker and move to next unblocked task
- Run linter after every 5 tasks
- Commit after every complete component or page

## Risks

1. **WebSocket complexity** - May need more time for reconnection logic
2. **Graph visualization** - D3/Recharts learning curve
3. **RLM Trajectory rendering** - Nested data structure complexity
4. **Performance** - Large datasets may need optimization beyond estimates
5. **API availability** - Backend endpoints may not be ready, requiring mock data extension

---

## Definition of Done

- All 68 tasks marked complete
- All unit tests pass (> 80% coverage)
- All integration tests pass
- All E2E tests pass for critical paths
- Linter passes with zero errors
- Accessibility audit score > 90
- Lighthouse performance score > 80
- Deployed to staging
- UAT completed and signed off
- Documentation complete
