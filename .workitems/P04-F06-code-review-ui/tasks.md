# P04-F06: Code Review Page UI - Task Breakdown

## Phase 1: Foundation (Store, Types, API)

### T01: Create Review Store
**Estimate**: 1.5 hours
**Dependencies**: None
**Story**: US-03, US-04

Create Zustand store for managing review state.

- [ ] Create `src/stores/reviewStore.ts`
- [ ] Define ReviewState interface with all state fields
- [ ] Implement actions: startReview, updateProgress, setResults, reset
- [ ] Implement selection actions: toggleFinding, selectAll, clearSelection
- [ ] Implement ignore actions: ignoreFinding, unignoreFinding
- [ ] Write unit tests in `src/stores/reviewStore.test.ts`

**Acceptance**: Store exports work, all actions tested, TypeScript compiles.

---

### T02: Define Review Types
**Estimate**: 1 hour
**Dependencies**: None
**Story**: All

Add review-related types to the type system.

- [ ] Add review types to `src/api/types.ts`:
  - ReviewConfig
  - ReviewerProgress
  - CLIEntry
  - ReviewFinding (match P04-F05 model)
  - UnifiedReport (match P04-F05 model)
  - SwarmReviewRequest
  - SwarmReviewResponse
  - SwarmStatusResponse
- [ ] Add severity type and labels mapping
- [ ] Add reviewer type enum and labels mapping

**Acceptance**: All types compile, exported from types.ts.

---

### T03: Create Swarm API Hooks
**Estimate**: 1.5 hours
**Dependencies**: T02
**Story**: US-03, US-04

Create TanStack Query hooks for swarm API.

- [ ] Create `src/api/swarm.ts`
- [ ] Define query keys: swarmKeys.all, swarmKeys.status, swarmKeys.results
- [ ] Implement useSwarmReview mutation (POST /api/swarm/review)
- [ ] Implement useSwarmStatus query with polling (GET /api/swarm/review/{id})
- [ ] Create mock data in `src/api/mocks/swarmMocks.ts`
- [ ] Add mock mode support (VITE_USE_MOCKS)
- [ ] Write basic tests

**Acceptance**: Hooks work in mock mode, polling tested.

---

## Phase 2: Input Components

### T04: Create ReviewInputPanel Component
**Estimate**: 1.5 hours
**Dependencies**: T02
**Story**: US-01, US-02

Build the main input panel container.

- [ ] Create `src/components/review/ReviewInputPanel.tsx`
- [ ] Define props interface
- [ ] Layout: target input, scope selector, toggles, start button
- [ ] Wire up form state with controlled inputs
- [ ] Handle validation state
- [ ] Create `src/components/review/index.ts` barrel export
- [ ] Write unit tests

**Acceptance**: Component renders, form state works, exports from index.

---

### T05: Create TargetInput Component
**Estimate**: 1 hour
**Dependencies**: T04
**Story**: US-01

Build target input with validation.

- [ ] Create target input subcomponent in ReviewInputPanel or separate file
- [ ] Add placeholder text showing examples
- [ ] Implement validation (URL, PR number, branch format)
- [ ] Show error message below input
- [ ] Style using existing input patterns
- [ ] Test validation logic

**Acceptance**: Validates various input formats, shows errors.

---

### T06: Create ScopeSelector Component
**Estimate**: 1 hour
**Dependencies**: T04
**Story**: US-01

Build scope radio group.

- [ ] Create scope selector using @headlessui/react RadioGroup
- [ ] Three options: Full Repo, Changed Files, Custom Path
- [ ] Style to match existing UI patterns
- [ ] Emit scope change events
- [ ] Test selection behavior

**Acceptance**: Selection works, styled consistently.

---

### T07: Create ReviewerToggles Component
**Estimate**: 1 hour
**Dependencies**: T04
**Story**: US-02

Build reviewer toggle switches.

- [ ] Create toggle group for Security, Performance, Style
- [ ] Each toggle shows icon, name, brief description
- [ ] Use @headlessui/react Switch
- [ ] Show warning when all disabled
- [ ] Style with reviewer colors (purple, teal, blue)
- [ ] Test toggle logic and warning state

**Acceptance**: Toggles work, warning shows when all off.

---

### T08: Create CustomPathInput Component
**Estimate**: 0.5 hours
**Dependencies**: T06
**Story**: US-01

Build conditional path input.

- [ ] Create custom path input that shows when scope is "custom_path"
- [ ] Validate path format
- [ ] Style consistently
- [ ] Test show/hide behavior

**Acceptance**: Shows/hides with scope, validates input.

---

## Phase 3: Progress Components

### T09: Create ReviewProgressPanel Component
**Estimate**: 1 hour
**Dependencies**: T01, T03
**Story**: US-04, US-05, US-06

Build progress panel container.

- [ ] Create `src/components/review/ReviewProgressPanel.tsx`
- [ ] Layout: three-lane view, CLI mimic, token counter
- [ ] Subscribe to swarm status via useSwarmStatus hook
- [ ] Update store with progress
- [ ] Handle completion transition
- [ ] Write unit tests

**Acceptance**: Panel renders, updates from polling.

---

### T10: Create ThreeLaneView Component
**Estimate**: 1.5 hours
**Dependencies**: T09
**Story**: US-04

Build parallel reviewer progress lanes.

- [ ] Create `src/components/review/ThreeLaneView.tsx`
- [ ] Three columns for Security, Performance, Style
- [ ] Each lane: icon, status indicator, progress bar, files count
- [ ] Status colors: pending (gray), in_progress (blue pulse), complete (green), failed (red)
- [ ] Animate progress bars with CSS transitions
- [ ] Write unit tests for status states

**Acceptance**: Lanes show correct status, progress animates.

---

### T11: Create CLIMimicView Component
**Estimate**: 1.5 hours
**Dependencies**: T09
**Story**: US-05

Build terminal-style output display.

- [ ] Create `src/components/review/CLIMimicView.tsx`
- [ ] Dark terminal background with monospace font
- [ ] Color-code entries by reviewer
- [ ] Show timestamp prefix
- [ ] Implement auto-scroll with scroll lock detection
- [ ] Limit to 500 entries
- [ ] Write unit tests for scroll behavior

**Acceptance**: Terminal look, auto-scroll works, colors correct.

---

### T12: Create TokenCostCounter Component
**Estimate**: 0.5 hours
**Dependencies**: T09
**Story**: US-06

Build metrics display.

- [ ] Create `src/components/review/TokenCostCounter.tsx`
- [ ] Display tokens with thousands separator
- [ ] Display cost with 4 decimal places (e.g., $0.0023)
- [ ] Show spinner while running
- [ ] Style compactly
- [ ] Write unit tests

**Acceptance**: Numbers format correctly, spinner shows.

---

## Phase 4: Results Components

### T13: Create ReviewResultsPanel Component
**Estimate**: 1 hour
**Dependencies**: T01, T03
**Story**: US-07, US-08

Build results panel container.

- [ ] Create `src/components/review/ReviewResultsPanel.tsx`
- [ ] Layout: severity summary, bulk bar, findings list
- [ ] Fetch results from store or useSwarmResults
- [ ] Handle empty results state
- [ ] Write unit tests

**Acceptance**: Panel renders, shows results from store.

---

### T14: Create SeveritySummary Component
**Estimate**: 1 hour
**Dependencies**: T13
**Story**: US-07

Build traffic light severity display.

- [ ] Create `src/components/review/SeveritySummary.tsx`
- [ ] Three sections: red (critical+high), yellow (medium), green (low+info)
- [ ] Show counts in each section
- [ ] Click to scroll to findings section
- [ ] Visually appealing traffic light design
- [ ] Write unit tests

**Acceptance**: Counts correct, click scrolls to section.

---

### T15: Create FindingCard Component
**Estimate**: 1.5 hours
**Dependencies**: T13
**Story**: US-08, US-09, US-10, US-11

Build individual finding display.

- [ ] Create `src/components/review/FindingCard.tsx`
- [ ] Collapsed state: severity badge, title, file path, reviewer
- [ ] Expanded state: add description, code snippet, recommendation
- [ ] Action buttons: Create Issue, Copy, Ignore
- [ ] Checkbox for selection
- [ ] Dimmed style when ignored
- [ ] Write unit tests for states

**Acceptance**: Expand/collapse works, actions emit events.

---

### T16: Create CodeSnippetDisplay Component
**Estimate**: 1 hour
**Dependencies**: T15
**Story**: US-08

Build syntax-highlighted code display.

- [ ] Create `src/components/review/CodeSnippetDisplay.tsx`
- [ ] Add prism-react-renderer dependency if needed
- [ ] Display code with line numbers starting at lineStart
- [ ] Highlight specific lines if provided
- [ ] Handle missing code gracefully
- [ ] Write unit tests

**Acceptance**: Code highlighted, line numbers correct.

---

### T17: Create FindingsList Component
**Estimate**: 1.5 hours
**Dependencies**: T15
**Story**: US-08

Build grouped findings list.

- [ ] Create `src/components/review/FindingsList.tsx`
- [ ] Group findings by file path
- [ ] Collapsible file groups
- [ ] Filter by severity (optional)
- [ ] Show/hide ignored toggle
- [ ] Scroll to finding by ID
- [ ] Write unit tests

**Acceptance**: Grouping works, filtering works, scroll works.

---

### T18: Create BulkActionsBar Component
**Estimate**: 1 hour
**Dependencies**: T13
**Story**: US-12

Build bulk action toolbar.

- [ ] Create `src/components/review/BulkActionsBar.tsx`
- [ ] Show when findings selected: count, select all, clear, create issues
- [ ] Sticky position at top of findings area
- [ ] Style consistent with header bars
- [ ] Write unit tests

**Acceptance**: Actions work, count updates.

---

## Phase 5: GitHub Integration

### T19: Create GitHub API Client
**Estimate**: 1.5 hours
**Dependencies**: T02
**Story**: US-09, US-12

Build GitHub API integration.

- [ ] Create `src/api/github.ts`
- [ ] Implement listRepositories() with mock support
- [ ] Implement listLabels(repo) with mock support
- [ ] Implement createIssue(repo, issue) with mock support
- [ ] Implement createBulkIssues() with mock support
- [ ] Add error handling
- [ ] Write tests

**Acceptance**: API calls work in mock mode.

---

### T20: Create GitHubIssueModal Component
**Estimate**: 2 hours
**Dependencies**: T15, T19
**Story**: US-09, US-12

Build issue creation modal.

- [ ] Create `src/components/review/GitHubIssueModal.tsx`
- [ ] Repository picker dropdown with search
- [ ] Label selector multi-select
- [ ] Issue title template input
- [ ] Issue body preview (Markdown rendered)
- [ ] Support single and bulk modes
- [ ] Progress indicator for bulk creation
- [ ] Success/error handling
- [ ] Write unit tests

**Acceptance**: Modal creates issues, preview accurate.

---

### T21: Create Issue Templates
**Estimate**: 0.5 hours
**Dependencies**: T20
**Story**: US-09

Define issue content templates.

- [ ] Create `src/utils/issueTemplates.ts`
- [ ] Define default title template
- [ ] Define default body template with placeholders
- [ ] Implement template interpolation function
- [ ] Test template output

**Acceptance**: Templates produce well-formatted issues.

---

## Phase 6: Export and Utilities

### T22: Create Report Export Utility
**Estimate**: 1.5 hours
**Dependencies**: T02
**Story**: US-13

Build export functionality.

- [ ] Create `src/utils/reportExport.ts`
- [ ] Implement exportToMarkdown(report) function
- [ ] Implement exportToPDF(report) function (use browser print or library)
- [ ] Format with summary, metrics, all findings
- [ ] Generate filename with swarm ID and date
- [ ] Write unit tests for Markdown output

**Acceptance**: Markdown export correct, PDF downloads.

---

### T23: Create Clipboard Utility
**Estimate**: 0.5 hours
**Dependencies**: None
**Story**: US-10

Build clipboard copy function.

- [ ] Create `src/utils/clipboardUtils.ts`
- [ ] Implement copyToClipboard(text) with Clipboard API
- [ ] Fallback for older browsers
- [ ] Implement findingToMarkdown(finding) formatter
- [ ] Test copy functionality

**Acceptance**: Copy works, formatted as Markdown.

---

## Phase 7: Page Integration

### T24: Create CodeReviewPage Component
**Estimate**: 1.5 hours
**Dependencies**: T04, T09, T13
**Story**: All

Assemble the full page.

- [ ] Create `src/pages/CodeReviewPage.tsx`
- [ ] Manage phase state: input | progress | results
- [ ] Wire ReviewInputPanel with startReview handler
- [ ] Transition to progress on start
- [ ] Transition to results on complete
- [ ] Handle back/reset navigation
- [ ] Write integration tests

**Acceptance**: Full flow works from input to results.

---

### T25: Add Route and Navigation
**Estimate**: 0.5 hours
**Dependencies**: T24
**Story**: US-14

Integrate into app routing.

- [ ] Add route in App.tsx: `/review` -> CodeReviewPage
- [ ] Add "Code Review" link in Sidebar.tsx
- [ ] Choose appropriate icon (CodeBracketIcon or similar)
- [ ] Verify navigation highlighting
- [ ] Test navigation

**Acceptance**: Route works, sidebar link works.

---

## Phase 8: Polish and Error Handling

### T26: Add Error Toast Notifications
**Estimate**: 1 hour
**Dependencies**: T03
**Story**: US-15

Implement error feedback.

- [ ] Use existing Toast component or create if needed
- [ ] Show toast on API errors with retry option
- [ ] Show toast on GitHub issue creation result
- [ ] Show toast on copy success
- [ ] Test error scenarios

**Acceptance**: Errors show toasts, retry works.

---

### T27: Handle Partial Failures
**Estimate**: 1 hour
**Dependencies**: T13
**Story**: US-15

Handle reviewer failures gracefully.

- [ ] Detect when some reviewers fail in SwarmStatusResponse
- [ ] Show warning banner in results with failed reviewer names
- [ ] Display partial results from successful reviewers
- [ ] Option to retry failed reviewers (future enhancement marker)
- [ ] Test partial failure display

**Acceptance**: Partial results shown with warning.

---

### T28: Add Loading and Empty States
**Estimate**: 1 hour
**Dependencies**: T24
**Story**: All

Polish loading and empty states.

- [ ] Loading skeleton for results panel
- [ ] Empty state for no findings ("No issues found!")
- [ ] Loading spinner during initial fetch
- [ ] Reconnecting indicator if polling fails
- [ ] Test all states

**Acceptance**: All states have appropriate UI.

---

## Phase 9: Testing

### T29: Write Integration Tests
**Estimate**: 2 hours
**Dependencies**: T24, T25
**Story**: All

End-to-end component tests.

- [ ] Test full review flow: configure -> start -> progress -> results
- [ ] Test GitHub issue creation flow
- [ ] Test bulk selection and actions
- [ ] Test export functionality
- [ ] Test error scenarios
- [ ] Use React Testing Library

**Acceptance**: All major flows covered by tests.

---

### T30: Manual QA and Bug Fixes
**Estimate**: 2 hours
**Dependencies**: T29
**Story**: All

Manual testing and polish.

- [ ] Test with mock backend
- [ ] Test responsive layout
- [ ] Test keyboard navigation
- [ ] Fix any visual issues
- [ ] Test accessibility with screen reader
- [ ] Document any known issues

**Acceptance**: Feature ready for review.

---

## Progress Tracking

### Summary

| Phase | Tasks | Estimated Hours |
|-------|-------|-----------------|
| 1. Foundation | T01-T03 | 4.0 |
| 2. Input Components | T04-T08 | 5.0 |
| 3. Progress Components | T09-T12 | 4.5 |
| 4. Results Components | T13-T18 | 7.0 |
| 5. GitHub Integration | T19-T21 | 4.0 |
| 6. Export and Utilities | T22-T23 | 2.0 |
| 7. Page Integration | T24-T25 | 2.0 |
| 8. Polish and Error Handling | T26-T28 | 3.0 |
| 9. Testing | T29-T30 | 4.0 |
| **Total** | **30 tasks** | **35.5 hours** |

### Task Completion

```
Phase 1: Foundation
[ ] T01 - Create Review Store (1.5h)
[ ] T02 - Define Review Types (1h)
[ ] T03 - Create Swarm API Hooks (1.5h)

Phase 2: Input Components
[ ] T04 - Create ReviewInputPanel Component (1.5h)
[ ] T05 - Create TargetInput Component (1h)
[ ] T06 - Create ScopeSelector Component (1h)
[ ] T07 - Create ReviewerToggles Component (1h)
[ ] T08 - Create CustomPathInput Component (0.5h)

Phase 3: Progress Components
[ ] T09 - Create ReviewProgressPanel Component (1h)
[ ] T10 - Create ThreeLaneView Component (1.5h)
[ ] T11 - Create CLIMimicView Component (1.5h)
[ ] T12 - Create TokenCostCounter Component (0.5h)

Phase 4: Results Components
[ ] T13 - Create ReviewResultsPanel Component (1h)
[ ] T14 - Create SeveritySummary Component (1h)
[ ] T15 - Create FindingCard Component (1.5h)
[ ] T16 - Create CodeSnippetDisplay Component (1h)
[ ] T17 - Create FindingsList Component (1.5h)
[ ] T18 - Create BulkActionsBar Component (1h)

Phase 5: GitHub Integration
[ ] T19 - Create GitHub API Client (1.5h)
[ ] T20 - Create GitHubIssueModal Component (2h)
[ ] T21 - Create Issue Templates (0.5h)

Phase 6: Export and Utilities
[ ] T22 - Create Report Export Utility (1.5h)
[ ] T23 - Create Clipboard Utility (0.5h)

Phase 7: Page Integration
[ ] T24 - Create CodeReviewPage Component (1.5h)
[ ] T25 - Add Route and Navigation (0.5h)

Phase 8: Polish and Error Handling
[ ] T26 - Add Error Toast Notifications (1h)
[ ] T27 - Handle Partial Failures (1h)
[ ] T28 - Add Loading and Empty States (1h)

Phase 9: Testing
[ ] T29 - Write Integration Tests (2h)
[ ] T30 - Manual QA and Bug Fixes (2h)

Progress: 0/30 tasks (0%)
```

## Dependency Graph

```
T02 (Types) ----+
                |
T01 (Store) ----+----> T03 (API Hooks) ----> T09 (ProgressPanel)
                |                                    |
                |                             +------+------+
                |                             |      |      |
                |                           T10    T11    T12
                |
                +----> T04 (InputPanel) ----> T05, T06, T07, T08
                |
                +----> T13 (ResultsPanel) ----> T14, T15, T17, T18
                |                                    |
                |                                   T16
                |
                +----> T19 (GitHub API) ----> T20 (Modal) ----> T21
                |
                +----> T22 (Export)
                |
                +----> T23 (Clipboard)

T04 + T09 + T13 ----> T24 (Page) ----> T25 (Route)
                                   |
                                   +----> T26, T27, T28 (Polish)
                                   |
                                   +----> T29, T30 (Testing)
```

## Notes

- All component tasks include writing unit tests
- Mock mode enabled via `VITE_USE_MOCKS=true` for development
- PDF export may require additional library evaluation
- GitHub API requires authentication token configuration
