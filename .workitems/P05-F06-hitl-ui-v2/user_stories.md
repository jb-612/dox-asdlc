# P05-F06: HITL UI v2 (Full SPA) - User Stories

## Overview

User stories for the complete aSDLC SPA, covering all MVP Phase 1 (P0) pages and workflows.

---

## Epic: Documentation Page

### US-DOC-01: View Interactive Blueprint
**As a** new aSDLC user
**I want to** see an interactive diagram of the aSDLC workflow clusters
**So that** I can understand the system architecture and workflow stages

**Acceptance Criteria:**
- [ ] Blueprint diagram displays all 6 clusters (Governance, Discovery, Design, Development, Validation, Deployment)
- [ ] Each cluster is clickable and shows:
  - Agents in that cluster
  - Required artifacts
  - Entry and exit events
  - Related HITL gates
- [ ] Diagram is responsive and works on desktop and tablet
- [ ] Clicking a cluster element navigates to relevant page (e.g., gate, agent run)

### US-DOC-02: Interactive Methodology Walkthrough
**As a** product manager learning aSDLC
**I want to** step through the methodology with interactive examples
**So that** I understand how my work translates into agent workflows

**Acceptance Criteria:**
- [ ] Stepper UI shows 8 stages (Spec Index → PRD → ... → Release)
- [ ] Each step explains:
  - Why this stage exists
  - Inputs and outputs
  - What humans approve
  - Common issues and mitigations
- [ ] "Show me in the system" links navigate to live examples
- [ ] Navigation between steps with prev/next buttons
- [ ] Progress indicator shows current step

### US-DOC-03: Glossary with Deep Links
**As a** user encountering unfamiliar terms
**I want to** search the glossary and jump to examples
**So that** I can learn terms in context

**Acceptance Criteria:**
- [ ] Searchable glossary with 20+ aSDLC terms
- [ ] Each term has definition and "Show me" link
- [ ] Links navigate to relevant pages (e.g., "Context Pack" → artifacts page)
- [ ] Terms are alphabetically organized
- [ ] Search filters glossary in real-time

---

## Epic: Agent Cockpit

### US-COCKPIT-01: View Real-Time KPIs
**As a** system operator
**I want to** see current system health metrics at a glance
**So that** I can identify issues quickly

**Acceptance Criteria:**
- [ ] KPI header displays:
  - Active runs count
  - Queued events count
  - Blocked gates count
  - Failures (24h) count
  - Burn rate (tokens/hour and USD/hour)
- [ ] Metrics update in real-time (WebSocket or 10s polling)
- [ ] Metrics are color-coded (green/yellow/red based on thresholds)
- [ ] Clicking a metric filters the runs table

### US-COCKPIT-02: Monitor Worker Pool
**As a** system operator
**I want to** see worker status and utilization
**So that** I can identify bottlenecks and scale appropriately

**Acceptance Criteria:**
- [ ] Worker panel shows list of all workers with:
  - Worker ID
  - Status (idle, busy, draining, offline)
  - Current agent type
  - Current task/epic
  - Model being used
- [ ] Workers update in real-time
- [ ] Can filter workers by status
- [ ] Visual indicator of pool utilization (e.g., "8/10 busy")

### US-COCKPIT-03: View Workflow Graph
**As a** system architect
**I want to** visualize the workflow as a graph
**So that** I can understand event flow and identify bottlenecks

**Acceptance Criteria:**
- [ ] Sankey or node graph displays:
  - Cluster stages as nodes
  - Event flows as edges with volume indicators
  - Gate nodes with approval rates
- [ ] Clicking an edge filters runs table to runs on that path
- [ ] Graph updates periodically (30s)
- [ ] Tooltip shows detailed metrics on hover

### US-COCKPIT-04: Browse Agent Runs
**As a** developer debugging a failure
**I want to** browse all agent runs with filters
**So that** I can find the run I'm investigating

**Acceptance Criteria:**
- [ ] Runs table displays:
  - run_id (link to detail)
  - Epic
  - Agent type
  - State (running, completed, failed, blocked)
  - Last event
  - Elapsed time
  - Budget consumed
- [ ] Filters available for: cluster, agent, status, model, repo, environment, date range
- [ ] Table is sortable by all columns
- [ ] Pagination (50 runs per page)
- [ ] Search by run_id or epic

### US-COCKPIT-05: View Git Integration Status
**As a** release manager
**I want to** see git state for each environment
**So that** I know what code is deployed and what's pending

**Acceptance Criteria:**
- [ ] Git panel displays per environment:
  - Current branch
  - Current commit SHA (short)
  - Pending commits in gateway queue
  - Recent commits with agent attribution
- [ ] "View in Git" links to GitHub/GitLab
- [ ] "Force sync" action available (with confirmation)
- [ ] Drift indicator if uncommitted changes exist

### US-COCKPIT-06: View Agent Run Detail
**As a** developer
**I want to** drill into a specific run and see all events
**So that** I can debug failures or understand agent behavior

**Acceptance Criteria:**
- [ ] Run detail page has 4 tabs: Timeline, Inputs, Outputs, Evidence
- [ ] Timeline tab shows:
  - Chronological events
  - Tool calls with parameters and results
  - Visual markers for start, completion, failure
  - Expandable event details
- [ ] Inputs tab shows:
  - Artifacts consumed
  - Context packs used (with token counts)
  - Configuration parameters
- [ ] Outputs tab shows:
  - Created/updated artifacts
  - Patches generated (with diffs)
  - Test results
- [ ] Evidence tab shows:
  - Test reports
  - Diffs with syntax highlighting
  - Security scan results

### US-COCKPIT-07: View RLM Trajectory
**As a** AI engineer
**I want to** see the RLM subcall tree for a run
**So that** I can understand how the agent broke down the task

**Acceptance Criteria:**
- [ ] RLM Trajectory Viewer displays:
  - Root call description
  - Nested subcalls as expandable tree
  - Tool calls per subcall
  - Result summary per subcall
  - Token/cost metrics per subcall
- [ ] Expand/collapse all functionality
- [ ] Visual indicator for success/failure
- [ ] Subcall depth limit of 10 levels
- [ ] Tokens and cost totals at bottom

---

## Epic: Discovery Studio

### US-STUDIO-01: Start Discovery Chat
**As a** product manager
**I want to** chat with an AI assistant to draft a PRD
**So that** I can quickly create structured requirements

**Acceptance Criteria:**
- [ ] Chat interface at `/studio/discovery`
- [ ] Message input with send button
- [ ] Chat history displays user and assistant messages
- [ ] Streaming responses (show "typing..." indicator)
- [ ] Message timestamps
- [ ] Scrollable history

### US-STUDIO-02: View Working Outline
**As a** product manager in discovery chat
**I want to** see a live outline of my PRD as I chat
**So that** I know what sections are complete and what's missing

**Acceptance Criteria:**
- [ ] Working Outline panel displays:
  - PRD sections as checklist (✓ complete, ⏳ in progress, ○ not started)
  - Completeness percentage
  - Section status indicators
- [ ] Outline updates in real-time as chat progresses
- [ ] Clicking a section scrolls to relevant chat messages
- [ ] "Preview PRD" button shows draft markdown
- [ ] "Save Draft" button persists to backend

### US-STUDIO-03: Generate and Preview Artifacts
**As a** product manager
**I want to** see artifact cards as they're generated
**So that** I can review and download them

**Acceptance Criteria:**
- [ ] Output Quickview panel displays artifact cards
- [ ] Each card shows:
  - Artifact name and type (PRD, Test Spec)
  - Status (Draft, Not started)
  - Validation status (schema checks)
  - Diff view (changes from last version)
- [ ] Card actions:
  - Download markdown
  - Save to repo
  - Submit to next agent
  - Open in full view
- [ ] Validation warnings prominently displayed

### US-STUDIO-04: Select Model and Cost
**As a** budget-conscious user
**I want to** select which model to use for chat
**So that** I can balance cost and quality

**Acceptance Criteria:**
- [ ] Model selector dropdown (Sonnet, Opus, Haiku)
- [ ] RLM mode toggle with warning:
  - "RLM mode enabled"
  - "Estimated cost: $X - $Y per task"
  - "Subcall limit: 10"
- [ ] Confirmation required to enable RLM
- [ ] Cost estimate updates based on selection

### US-STUDIO-05: Query Context Packs
**As a** architect in design chat
**I want to** query the codebase for relevant context
**So that** my architecture aligns with existing code

**Acceptance Criteria:**
- [ ] Natural language query input
- [ ] Example queries shown as placeholders
- [ ] Query sends to Repo Mapper
- [ ] Response displays:
  - File list with relevance scores
  - Token count breakdown
  - Cost estimate
  - Citations (file path, line ranges)
- [ ] "Add to current session" action
- [ ] Loading indicator during generation (can take 10-30s)

---

## Epic: Artifacts

### US-ARTIFACTS-01: Browse Artifacts
**As a** team member
**I want to** browse all artifacts in the system
**So that** I can find specs, patches, and reports

**Acceptance Criteria:**
- [ ] Artifacts table displays:
  - Name (filename)
  - Type (PRD, Test Spec, Architecture, Task, Patch, Report)
  - Epic
  - Status (Draft, Pending Review, Approved, Superseded)
  - Created (timestamp and producing agent)
  - Approved (gate and timestamp)
  - Git SHA
- [ ] Filters: epic, type, status, date range, producing agent, approving gate
- [ ] Sortable columns
- [ ] Pagination (50 per page)
- [ ] Search by filename

### US-ARTIFACTS-02: View Artifact Detail
**As a** reviewer
**I want to** view a single artifact with full metadata
**So that** I can understand its context and provenance

**Acceptance Criteria:**
- [ ] Detail page has 4 tabs: Content, History, Provenance, Context Pack
- [ ] Content tab shows:
  - Rendered markdown with syntax highlighting
  - Table of contents navigation
  - Validation status (schema checks)
  - Copy content button
- [ ] History tab shows:
  - Version timeline
  - Click any version to view
  - Compare any two versions (diff view)
- [ ] Provenance tab shows:
  - Which run created this artifact
  - Input artifacts used
  - Which gate approved it
  - Who approved it and when
  - Associated feedback
- [ ] Context Pack tab shows (if applicable):
  - Files included in context when created
  - Token count breakdown
  - "Regenerate with current context" action

### US-ARTIFACTS-03: View Spec Index for Epic
**As a** project manager
**I want to** see the spec index tree for an epic
**So that** I know what artifacts exist and what's pending

**Acceptance Criteria:**
- [ ] Spec index displays as interactive tree:
  - Discovery folder (PRD, Test Specs)
  - Design folder (Architecture, Contracts, Audit)
  - Development folder (Task Plan, Tasks)
  - Validation folder (Release Notes)
- [ ] Each artifact shows status icon (✓ approved, ⏳ pending, 🔄 in progress, ○ not started)
- [ ] Clicking artifact opens detail view
- [ ] Progress summary at top (e.g., "6/9 artifacts complete")
- [ ] Current stage indicator (e.g., "Current Stage: Development")
- [ ] Blocking indicator if artifacts are pending gates

---

## Epic: Enhanced HITL Gates

### US-GATES-01: View Similar Rejection Patterns
**As a** reviewer
**I want to** see if similar issues were rejected before
**So that** I can make consistent decisions and improve agent quality

**Acceptance Criteria:**
- [ ] Gate detail page shows "Similar Past Feedback Panel" if patterns exist
- [ ] Panel displays:
  - Pattern description
  - Occurrence count (last 30 days)
  - Affected agents
  - Example rejections (up to 3)
  - Suggested action
- [ ] "View Pattern Details" expands to full feedback list
- [ ] "Ignore for this review" dismisses panel

### US-GATES-02: Provide Structured Feedback
**As a** reviewer
**I want to** provide structured feedback on my decision
**So that** the system can learn from my corrections

**Acceptance Criteria:**
- [ ] Decision panel includes "Feedback for Learning" section:
  - Tags (Quality, Completeness, Scope, Style, Other)
  - Correction summary text area (for Approve with Changes)
  - Severity selector (Low, Medium, High, Critical)
  - Checkbox "This feedback should be considered for system improvement"
- [ ] Review duration is auto-tracked
- [ ] Feedback is submitted with decision
- [ ] Feedback ID is returned and logged

---

## Epic: Global Layout

### US-LAYOUT-01: Navigate Between Pages
**As a** user
**I want to** use the sidebar to navigate between pages
**So that** I can access different features quickly

**Acceptance Criteria:**
- [ ] Sidebar displays:
  - Workflow section: Documentation, Agent Cockpit, Discovery Studio, HITL Gates, Artifacts
  - Operations section (collapsed): Budget, Admin
- [ ] Active page is highlighted
- [ ] Sidebar is collapsible (hamburger menu)
- [ ] Sidebar persists open/closed state in localStorage
- [ ] Responsive: sidebar becomes overlay on mobile

### US-LAYOUT-02: View System Status Bar
**As a** operator
**I want to** see system status at all times
**So that** I'm aware of current state and issues

**Acceptance Criteria:**
- [ ] Bottom status bar displays:
  - Current git branch and SHA (short)
  - Active workers count
  - Pending gates count
  - System health indicator (green/yellow/red)
- [ ] Clicking status items navigates to relevant pages
- [ ] Status updates in real-time (WebSocket or polling)

### US-LAYOUT-03: View Live Event Feed
**As a** operator watching the system
**I want to** see a live stream of events
**So that** I can monitor activity in real-time

**Acceptance Criteria:**
- [ ] Right utility panel (collapsible) displays live event feed
- [ ] Events show:
  - Timestamp
  - Event type icon
  - Event description
  - Related epic/agent
- [ ] Auto-scroll with pause button
- [ ] Filter by event type, epic, agent
- [ ] Expandable event details
- [ ] WebSocket connection with reconnect logic
- [ ] Max 100 events displayed (older ones pruned)

### US-LAYOUT-04: Access Evidence Drawer
**As a** reviewer
**I want to** see contextual evidence in the right panel
**So that** I have relevant information without navigating away

**Acceptance Criteria:**
- [ ] Right panel shows evidence for currently selected item (task, gate, run)
- [ ] Evidence displays:
  - Artifact previews
  - Test results
  - Diffs
  - Related runs
- [ ] Quick actions available (Approve, Reject, Rerun, Export)
- [ ] Panel is context-aware based on current page

---

## Epic: WebSocket Integration

### US-WEBSOCKET-01: Receive Real-Time Updates
**As a** user
**I want to** see changes as they happen
**So that** I have the latest information without refreshing

**Acceptance Criteria:**
- [ ] WebSocket connection established on app load
- [ ] Connection status indicator in UI
- [ ] Reconnect logic if connection drops (exponential backoff)
- [ ] Updates received for:
  - Run status changes
  - Gate queue changes
  - Worker status changes
  - New events
- [ ] Polling fallback if WebSocket fails

---

## Non-Functional Requirements

### NFR-PERFORMANCE-01: Page Load Time
**Given** the SPA is deployed
**When** I navigate to any page
**Then** the page should load within 2 seconds on a standard connection

### NFR-PERFORMANCE-02: Real-Time Latency
**Given** a WebSocket connection is established
**When** an event occurs on the backend
**Then** it should appear in the UI within 500ms

### NFR-ACCESSIBILITY-01: Keyboard Navigation
**Given** I am using keyboard only
**When** I navigate the SPA
**Then** all interactive elements should be reachable via Tab/Shift-Tab

### NFR-ACCESSIBILITY-02: Screen Reader Support
**Given** I am using a screen reader
**When** I use the SPA
**Then** all content and actions should be announced appropriately

### NFR-SECURITY-01: XSS Prevention
**Given** markdown content from the backend
**When** it is rendered in the UI
**Then** no script tags or event handlers should execute

### NFR-USABILITY-01: Mobile Responsive
**Given** I am using a tablet (768px width)
**When** I view the SPA
**Then** all pages should be usable with adjusted layouts

---

## Success Metrics

### Adoption Metrics
- 80%+ of team uses the SPA instead of CLI for viewing artifacts
- 60%+ of gate approvals done via SPA

### Performance Metrics
- Average page load time < 2s
- WebSocket uptime > 99%
- Real-time update latency < 500ms

### Quality Metrics
- < 5 critical bugs in first 30 days
- Accessibility audit score > 90 (WAVE or axe)
- User satisfaction > 4/5 in feedback survey

### Completion Criteria
- All P0 user stories implemented and tested
- All pages accessible from navigation
- WebSocket connection stable and resilient
- Mock data layer complete for development
- Integration tests passing for all workflows
- E2E tests passing for critical paths
- Deployed to staging environment
