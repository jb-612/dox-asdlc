# P05-F11: PRD Ideation Studio - Tasks

## Progress

- Started: 2026-01-28
- Tasks Complete: 24/24
- Percentage: 100%
- Status: COMPLETE
- Blockers: None

---

## Phase 1: Foundation & State Management

### T01: Create ideation TypeScript types

- [x] Estimate: 1hr
- [x] Tests: N/A (types only)
- [x] Dependencies: None
- [x] Notes: Define MaturityState, IdeationMessage, UserStory, CategoryMaturity interfaces

**File:** `docker/hitl-ui/src/types/ideation.ts`

**Implemented:**
- `MaturityLevelId`, `MaturityLevel`, `SectionMaturity`, `CategoryMaturity`, `MaturityState`
- `Gap` for gap identification
- `IdeationMessage` (standalone interface, NOT extending ChatMessage)
- `Requirement`, `RequirementType`, `RequirementPriority`
- `PRDDocument`, `PRDSection`, `PRDStatus`
- `UserStory`
- `IdeationSession`
- `IdeationChatRequest`, `IdeationChatResponse`
- `PRDSubmission`, `PRDSubmissionResult`
- `SaveDraftRequest`
- Constants: `MATURITY_LEVELS`, `REQUIRED_CATEGORIES`, `SUBMIT_THRESHOLD`
- Type guards: `isMaturityLevelId`, `isRequirementType`, `isRequirementPriority`

---

### T02: Create ideationStore with Zustand

- [x] Estimate: 2hr
- [x] Tests: `docker/hitl-ui/src/stores/ideationStore.test.ts` (30 tests passing)
- [x] Dependencies: T01
- [x] Notes: Manage session, messages, maturity, requirements state

**File:** `docker/hitl-ui/src/stores/ideationStore.ts`

**Implemented state:**
- `sessionId`, `projectName`, `messages`, `isLoading`
- `maturity`, `extractedRequirements`, `userStories`
- `prdDraft`, `submittedGateId`, `isSubmitting`, `error`

**Implemented actions:**
- `startSession`, `addMessage`, `sendMessage`, `updateMaturity`
- `addRequirement`, `removeRequirement`, `updateRequirement`
- `submitForPRD`, `resetSession`, `setError`

---

### T03: Implement maturity calculation algorithm

- [x] Estimate: 1.5hr
- [x] Tests: `docker/hitl-ui/src/utils/maturityCalculator.test.ts` (26 tests passing)
- [x] Dependencies: T01
- [x] Notes: Calculate weighted score from category coverage

**File:** `docker/hitl-ui/src/utils/maturityCalculator.ts`

**Implemented functions:**
- `calculateMaturity(categories: CategoryMaturity[]): number` - weighted score
- `getMaturityLevel(score: number): MaturityLevel` - maps score to level
- `identifyGaps(categories: CategoryMaturity[]): Gap[]` - finds weak areas with suggested questions
- `createInitialCategories(): CategoryMaturity[]` - initial empty state
- `createInitialMaturityState(): MaturityState` - initial session state
- `updateMaturityState(currentState, updates): MaturityState` - update helper

---

### T04: Create ideation API client functions

- [x] Estimate: 1hr
- [x] Tests: `docker/hitl-ui/src/api/ideation.test.ts` (8 tests passing)
- [x] Dependencies: T01
- [x] Notes: API calls for chat, submit, maturity

**File:** `docker/hitl-ui/src/api/ideation.ts`

**Implemented functions:**
- `sendIdeationMessage(request): Promise<IdeationChatResponse>`
- `submitForPRD(request): Promise<PRDSubmissionResult>`
- `getSessionMaturity(sessionId): Promise<MaturityState>`
- `saveIdeationDraft(sessionId, draft): Promise<void>`
- `loadIdeationDraft(sessionId): Promise<...>`
- `deleteIdeationDraft(sessionId): Promise<void>`
- `listIdeationDrafts(): Promise<...>`

---

### T05: Create mock data for ideation API

- [x] Estimate: 1hr
- [x] Tests: N/A (test utility)
- [x] Dependencies: T01, T04
- [x] Notes: Mock responses for development without backend

**File:** `docker/hitl-ui/src/api/mocks/ideation.ts`

**Implemented mocks:**
- `mockChatHistory` - sample conversation
- `mockMaturityStates` - states at various progression levels
- `mockRequirements` - sample extracted requirements
- `mockUserStories` - sample user stories
- `mockPRDDocument` - complete sample PRD
- `generateMockIdeationResponse()` - dynamic response generation with keyword detection
- `submitMockPRD()` - mock PRD submission
- `getMockSessionMaturity()` - retrieve session maturity
- `saveMockDraft()`, `loadMockDraft()`, `deleteMockDraft()`, `listMockDrafts()` - draft management

---

## Phase 2: Maturity Tracker Components

### T06: Create MaturityTracker component

- [x] Estimate: 2hr
- [x] Tests: `docker/hitl-ui/src/components/studio/ideation/MaturityTracker.test.tsx` (25 tests passing)
- [x] Dependencies: T01, T03
- [x] Notes: Main progress visualization with level labels

**File:** `docker/hitl-ui/src/components/studio/ideation/MaturityTracker.tsx`

**Implemented:**
- Progress bar with percentage (0-100%)
- Level indicator showing current level (Concept -> Complete)
- Color coding: red (<40%), yellow (40-79%), green (80%+)
- Animated transitions on score changes (CSS transition-all)
- "Ready to Submit" indicator at 80%+
- Accessible progress bar with ARIA attributes
- Compact mode option

---

### T07: Create CategoryProgress component

- [x] Estimate: 1.5hr
- [x] Tests: `docker/hitl-ui/src/components/studio/ideation/CategoryProgress.test.tsx` (31 tests passing)
- [x] Dependencies: T01
- [x] Notes: Individual category progress with expand/collapse

**File:** `docker/hitl-ui/src/components/studio/ideation/CategoryProgress.tsx`

**Implemented:**
- Category name with score percentage
- Progress bar per category with color coding
- Expandable section showing captured details
- Visual status indicator (empty/partial/complete icons)
- Click to expand/collapse with keyboard support
- Required category indicator (star icon)
- Section names and captured items in expanded view

---

### T08: Create GapsPanel component

- [x] Estimate: 1hr
- [x] Tests: `docker/hitl-ui/src/components/studio/ideation/GapsPanel.test.tsx` (26 tests passing)
- [x] Dependencies: T03
- [x] Notes: Display gaps with suggested questions

**File:** `docker/hitl-ui/src/components/studio/ideation/GapsPanel.tsx`

**Implemented:**
- List categories below threshold sorted by severity
- Severity indicators: critical (red), moderate (yellow), minor (blue)
- Severity count badges in header
- Display suggested questions for each gap
- "Ask about this" button that triggers callback
- Empty state with success icon when no gaps
- Filtering by severity level
- Collapsible panel option

---

## Phase 3: Chat & Interview Components

### T09: Create IdeationChat component

- [x] Estimate: 2hr
- [x] Tests: `docker/hitl-ui/src/components/studio/ideation/IdeationChat.test.tsx` (34 tests passing)
- [x] Dependencies: T02, T04
- [x] Notes: Chat interface with maturity delta indicators

**File:** `docker/hitl-ui/src/components/studio/ideation/IdeationChat.tsx`

**Implemented:**
- Message list showing conversation history from ideationStore
- Input field with send button
- Shows maturity delta after each AI response (e.g., "+5%")
- Displays suggested follow-up questions as clickable chips
- Loading state with animated typing indicator
- Auto-scroll to newest message
- Simple markdown rendering for message content (bold, code)
- Initial context display when provided

---

### T10: Create RequirementCard component

- [x] Estimate: 1hr
- [x] Tests: `docker/hitl-ui/src/components/studio/ideation/RequirementCard.test.tsx` (43 tests passing)
- [x] Dependencies: T01
- [x] Notes: Display extracted requirement with edit/delete

**File:** `docker/hitl-ui/src/components/studio/ideation/RequirementCard.tsx`

**Implemented:**
- Display requirement ID, description, type badge, priority badge
- Edit mode with inline form (description, type, priority dropdowns)
- Delete button with confirmation dialog
- Category indicator in expanded view
- Compact display that expands on click
- Read-only mode support
- Full keyboard accessibility (Enter/Space to expand)
- ARIA attributes for accessibility

---

### T11: Create RequirementsList component

- [x] Estimate: 1hr
- [x] Tests: `docker/hitl-ui/src/components/studio/ideation/RequirementsList.test.tsx` (36 tests passing)
- [x] Dependencies: T10
- [x] Notes: Scrollable list of extracted requirements

**File:** `docker/hitl-ui/src/components/studio/ideation/RequirementsList.tsx`

**Implemented:**
- Scrollable list of RequirementCard components
- Filter dropdown by type (Functional, Non-Functional, Constraint)
- Filter dropdown by category (all 7 PRD categories)
- Sort dropdown (Newest First, Oldest First, Priority High/Low)
- Count indicator showing total requirements and filtered count
- Empty state when no requirements extracted
- Empty state when filter matches nothing
- Loading state with skeleton cards
- maxHeight prop for controlling scroll container
- Read-only mode passed to child cards

---

## Phase 4: Output & Submission Components

### T12: Create SubmitPRDButton component

- [x] Estimate: 1.5hr
- [x] Tests: `docker/hitl-ui/src/components/studio/ideation/SubmitPRDButton.test.tsx` (27 tests passing)
- [x] Dependencies: T02
- [x] Notes: Submit button with maturity gate and confirmation

**File:** `docker/hitl-ui/src/components/studio/ideation/SubmitPRDButton.tsx`

**Implemented:**
- Disabled state below 80% maturity with aria-label explaining why
- Progress bar showing current maturity vs required threshold (65% / 80% required)
- Enabled state at 80%+ with "Submit for PRD" label
- Confirmation dialog before submission with maturity score display
- Loading spinner during submission with "Submitting..." text
- Success dialog with gate ID display
- Error dialog with retry option
- Full accessibility with ARIA attributes

---

### T13: Create PRDPreviewPanel component

- [x] Estimate: 1.5hr
- [x] Tests: `docker/hitl-ui/src/components/studio/ideation/PRDPreviewPanel.test.tsx` (34 tests passing)
- [x] Dependencies: T01
- [x] Notes: Display generated PRD draft with sections

**File:** `docker/hitl-ui/src/components/studio/ideation/PRDPreviewPanel.tsx`

**Implemented:**
- Document title, version, and status badge
- Collapsible sections with expand/collapse all buttons
- Section headers with chevron indicators
- Markdown content rendering using MarkdownRenderer component
- Download button (exports as markdown file)
- Print button with print-friendly styling
- Empty state with helpful message before PRD is generated
- Accessibility with ARIA region roles and aria-expanded attributes

---

### T14: Create UserStoryCard component

- [x] Estimate: 1hr
- [x] Tests: `docker/hitl-ui/src/components/studio/ideation/UserStoryCard.test.tsx` (34 tests passing)
- [x] Dependencies: T01
- [x] Notes: Display user story with As/I Want/So That

**File:** `docker/hitl-ui/src/components/studio/ideation/UserStoryCard.tsx`

**Implemented:**
- Story ID and title header with priority badge
- "As a / I want / So that" format with distinct colors
- Expandable acceptance criteria list with count indicator
- Priority badge (Must Have: red, Should Have: yellow, Could Have: blue)
- Linked requirements shown as clickable badges
- Compact mode support
- Full keyboard accessibility (Enter/Space to toggle)
- ARIA attributes for accessibility

---

### T15: Create UserStoriesList component

- [x] Estimate: 1hr
- [x] Tests: `docker/hitl-ui/src/components/studio/ideation/UserStoriesList.test.tsx` (40 tests passing)
- [x] Dependencies: T14
- [x] Notes: List of generated user stories

**File:** `docker/hitl-ui/src/components/studio/ideation/UserStoriesList.tsx`

**Implemented:**
- List of UserStoryCard components
- Group by priority option (must_have, should_have, could_have groups)
- Search/filter input with case-insensitive search
- Priority filter buttons (toggleable, combinable)
- Export as markdown button with date-stamped filename
- Count indicator showing filtered/total count
- Empty state when no stories
- No results state when search finds nothing
- Event handlers for story click and requirement click

---

### T16: Create GateStatusBanner component

- [x] Estimate: 1hr
- [x] Tests: `docker/hitl-ui/src/components/studio/ideation/GateStatusBanner.test.tsx` (36 tests passing)
- [x] Dependencies: None
- [x] Notes: Show HITL gate status in studio

**File:** `docker/hitl-ui/src/components/studio/ideation/GateStatusBanner.tsx`

**Implemented:**
- Status badge (pending: warning, approved: success, rejected: error)
- Gate ID display with status-specific border colors
- Link to gate detail page (/gates/{gateId})
- Auto-refresh status polling (configurable interval, default 30s)
- Manual refresh button with loading indicator
- Only auto-refreshes for pending status (stops when approved/rejected)
- onStatusChange callback when status changes
- Hidden when no gateId exists
- Accessibility with role="status" and aria-live="polite"

---

## Phase 5: Page Assembly & Integration

### T17: Create StudioIdeationPage layout

- [x] Estimate: 2hr
- [x] Tests: `docker/hitl-ui/src/pages/StudioIdeationPage.test.tsx` (36 tests passing)
- [x] Dependencies: T06-T16
- [x] Notes: Assemble 3-column layout with all components

**File:** `docker/hitl-ui/src/pages/StudioIdeationPage.tsx`

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ Session Bar: Title | Save Draft | Model Select  │
├──────────────┬────────────────┬─────────────────┤
│ Chat Panel   │ Maturity Panel │ Output Panel    │
│              │                │                 │
│ IdeationChat │ MaturityTracker│ PRDPreview      │
│              │ CategoryProgress│ UserStories     │
│              │ GapsPanel      │ SubmitButton    │
│              │ Requirements   │ GateStatus      │
└──────────────┴────────────────┴─────────────────┘
```

**Implemented:**
- Session bar with project title input, Save Draft button, model selector dropdown
- Responsive 3-column grid with collapsible panels
- Start session view when no active session
- Initialize store on mount with startSession
- Connect all components to ideationStore
- Handle GapsPanel "Ask about this" -> send message to chat
- Error toast for displaying errors
- Collapsible maturity and output panels

---

### T18: Add route for /studio/ideation

- [x] Estimate: 30min
- [x] Tests: Route added in App.tsx
- [x] Dependencies: T17
- [x] Notes: Add route in App.tsx, update navigation

**File:** `docker/hitl-ui/src/App.tsx`

**Implemented:**
- Import StudioIdeationPage component
- Add route: `/studio/ideation` -> StudioIdeationPage

---

### T19: Create IdeationDraftsList component

- [x] Estimate: 1.5hr
- [x] Tests: `docker/hitl-ui/src/components/studio/ideation/IdeationDraftsList.test.tsx` (24 tests passing)
- [x] Dependencies: T02
- [x] Notes: List saved drafts with resume/delete

**File:** `docker/hitl-ui/src/components/studio/ideation/IdeationDraftsList.tsx`

**Implemented:**
- List saved drafts with name, date, maturity score
- "Resume" button to load draft into store
- "Delete" button with confirmation dialog
- Empty state when no drafts
- Loading state with skeleton cards
- Error state with retry
- Refresh button to reload drafts
- Maturity score color coding

---

### T20: Implement auto-save for ideation sessions

- [x] Estimate: 1hr
- [x] Tests: `docker/hitl-ui/src/hooks/useAutoSave.test.ts` (18 tests passing)
- [x] Dependencies: T02, T04
- [x] Notes: Auto-save every 2 minutes, debounced

**File:** `docker/hitl-ui/src/hooks/useAutoSave.ts`

**Implemented:**
- Auto-save at configurable intervals (default: 2 minutes)
- Debounce rapid changes (default: 500ms)
- Skip save if no changes since last save
- Show toast notification on save (optional)
- Handle save errors gracefully with lastError state
- Manual saveNow() function
- Status tracking: isSaving, lastSaveTime
- Cleanup on unmount

---

## Phase 6: Backend Integration

**Note:** Phase 6 tasks require the **backend agent** (not frontend). These tasks create code in `src/orchestrator/` and `src/workers/` which is outside the frontend agent's scope.

### T21: Create ideation API routes in orchestrator

- [x] Estimate: 2hr
- [x] Tests: `tests/unit/orchestrator/routes/test_ideation_api.py` (15 tests passing)
- [x] Dependencies: T04
- [x] Notes: Backend endpoints for chat, submit, maturity
- [x] Agent: backend

**File:** `src/orchestrator/routes/ideation_api.py`

**Endpoints:**
- `POST /api/studio/ideation/chat`
- `POST /api/studio/ideation/submit-prd`
- `GET /api/studio/ideation/{sessionId}/maturity`
- `POST /api/studio/ideation/{sessionId}/draft`

**Implemented:**
- FastAPI router with 4 endpoints
- Pydantic request/response models with camelCase aliases
- IdeationService interface (placeholder for agent integration)
- Mock responses for development
- Maturity threshold validation (80% required for PRD submission)
- Registered in orchestrator main.py

---

### T22: Create IdeationAgent for interview flow

- [x] Estimate: 2hr
- [x] Tests: `tests/unit/workers/agents/ideation/test_ideation_agent.py` (20 tests passing)
- [x] Dependencies: T21
- [x] Notes: Agent that conducts structured interviews
- [x] Agent: backend

**File:** `src/workers/agents/ideation/ideation_agent.py`

**Behavior:**
- Structured interview prompts
- Requirement extraction from responses
- Maturity assessment logic
- Follow-up question generation

**Implemented:**
- `IdeationAgent` class implementing BaseAgent protocol
- `IdeationConfig` dataclass with model, retries, temperature settings
- `InterviewPhase` enum for interview flow stages
- `MaturityCategory` dataclass and `MATURITY_CATEGORIES` list (7 categories, weights sum to 100)
- System prompt for structured interviews with JSON output
- `execute()` method processing user messages and returning maturity updates
- `calculate_overall_maturity()` with weighted category scores
- `can_submit()` checking 80% threshold
- `get_maturity_level()` mapping score to level (concept/exploration/defined/refined/complete)
- `identify_gaps()` finding categories below threshold
- JSON parsing with code block extraction support

---

### T23: Integrate with PRDAgent for generation

- [x] Estimate: 1.5hr
- [x] Tests: `tests/unit/workers/agents/ideation/test_prd_generator.py` (9 tests passing)
- [x] Dependencies: T22
- [x] Notes: Connect ideation output to PRDAgent input
- [x] Agent: backend

**File:** `src/workers/agents/ideation/prd_generator.py`

**Implemented:**
- `PRDGenerator` class for converting ideation output to PRD
- `PRDGeneratorConfig` dataclass with model/token/retry settings
- `IdeationToPRDInput` dataclass with session_id, project_title, conversation_summary, requirements, maturity_scores
- `PRDGeneratorResult` dataclass with success, prd_document, artifact_path, error_message
- System prompt for PRD generation with JSON output structure
- `generate()` method building PRD from ideation input
- Integration with `PRDDocument` and `PRDSection` models from discovery
- Requirement conversion using `RequirementPriority` and `RequirementType` enums
- Fallback PRD generation when LLM fails
- Artifact writing support (JSON and markdown)
- JSON parsing with code block extraction support

---

### T24: Create user story extraction logic

- [x] Estimate: 1.5hr
- [x] Tests: `tests/unit/workers/agents/ideation/test_user_story_extractor.py` (13 tests passing)
- [x] Dependencies: T22
- [x] Notes: Extract user stories from requirements
- [x] Agent: backend

**File:** `src/workers/agents/ideation/user_story_extractor.py`

**Implemented:**
- `UserStoryExtractor` class for generating user stories from requirements
- `UserStoryExtractorConfig` dataclass with model/token/retry settings
- `ExtractedUserStory` dataclass with id, title, as_a, i_want, so_that, acceptance_criteria, linked_requirements, priority
- `UserStoryExtractionInput` dataclass with requirements and prd_context
- `UserStoryExtractionResult` dataclass with success, user_stories, coverage_report, error_message
- System prompt for "As a / I want / So that" story generation
- `extract()` method converting requirements to user stories
- Coverage report generation (covered/uncovered requirements, percentage)
- Priority derivation from linked requirements
- JSON parsing with code block extraction support

---

## Task Dependencies Graph

```
T01 ─────┬───► T02 ───► T09 ───────────┐
         │                              │
         ├───► T03 ───► T06 ───────────┤
         │              │               │
         │              ├───► T07      │
         │              │               │
         │              └───► T08      │
         │                              │
         ├───► T04 ───► T05            │
         │       │                      │
         │       └───► T21 ───► T22 ───┼───► T23
         │                    │        │
         │                    └───► T24│
         │                              │
         ├───► T10 ───► T11            │
         │                              │
         ├───► T12                      │
         │                              │
         ├───► T13                      │
         │                              │
         └───► T14 ───► T15            │
                                        │
T16 ────────────────────────────────────┤
                                        │
T17 ◄───────────────────────────────────┘
  │
  ├───► T18
  │
  ├───► T19
  │
  └───► T20
```

---

## Verification Checklist

### Unit Tests
- [ ] `npm test -- --coverage src/components/studio/ideation/`
- [ ] `npm test -- --coverage src/stores/ideationStore`
- [ ] `npm test -- --coverage src/utils/maturityCalculator`

### Integration Tests
- [ ] `npm test -- src/pages/StudioIdeationPage.test.tsx`
- [ ] `pytest tests/integration/workers/agents/test_ideation_to_prd.py`

### E2E Tests
- [ ] Start session → Chat → Submit → Gate created
- [ ] Resume draft → Continue conversation → Submit
- [ ] Edit/delete requirements → Maturity updates

### Manual Verification
1. Navigate to /studio/ideation
2. Start new session, verify 0% maturity
3. Conduct conversation, verify maturity increases
4. Verify requirements are extracted
5. Reach 80%, submit for PRD
6. Verify PRD draft and user stories generated
7. Verify HITL gate created
