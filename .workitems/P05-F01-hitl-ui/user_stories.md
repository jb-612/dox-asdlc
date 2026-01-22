# P05-F01: HITL Web UI - User Stories

## Overview

User stories for the Human-in-the-Loop (HITL) Web UI dashboard that enables human reviewers to manage governance gates in the aSDLC workflow.

## Personas

### Reviewer (Primary)
A human operator who reviews gate requests, inspects artifacts, and makes approve/reject decisions for the aSDLC workflow.

### Administrator
A system administrator who monitors worker pool health and session progress.

---

## Epic: Gate Management

### US-001: View Pending Gates
**As a** Reviewer
**I want to** see a list of all pending governance gates
**So that** I can identify which items need my attention

**Acceptance Criteria:**
- [ ] Dashboard shows count of pending gates in summary card
- [ ] Gates page displays all pending gates in a sortable list
- [ ] Each gate shows: type badge, session ID, summary preview, time since creation
- [ ] Gates are automatically refreshed via polling (10s interval)
- [ ] Empty state shown when no pending gates exist

### US-002: Filter Gates by Type
**As a** Reviewer
**I want to** filter gates by their type (PRD, Design, Code, Test, Deploy)
**So that** I can focus on specific review categories

**Acceptance Criteria:**
- [ ] Filter dropdown available on Gates page
- [ ] Filter options match gate types from contract
- [ ] URL reflects current filter for shareability
- [ ] Filter persists across page navigation

### US-003: View Gate Details
**As a** Reviewer
**I want to** view the full details of a gate request
**So that** I can make an informed decision

**Acceptance Criteria:**
- [ ] Clicking gate card navigates to detail page
- [ ] Detail page shows: type, status, session ID, timestamps
- [ ] Full summary text is visible
- [ ] Context metadata is displayed as key-value pairs
- [ ] Back navigation returns to gates list

### US-004: View Gate Artifacts
**As a** Reviewer
**I want to** view the artifacts attached to a gate request
**So that** I can review the evidence supporting the request

**Acceptance Criteria:**
- [ ] Artifacts list shows all attached items
- [ ] Each artifact shows: icon by type, path, size
- [ ] File artifacts show content in viewer
- [ ] Diff artifacts show colored diff view
- [ ] Report artifacts show formatted JSON
- [ ] Preview text shown when available

### US-005: Submit Approval Decision
**As a** Reviewer
**I want to** approve a gate request
**So that** the aSDLC workflow can proceed

**Acceptance Criteria:**
- [ ] Approve button visible on gate detail page
- [ ] Click opens confirmation form
- [ ] Optional feedback field available
- [ ] Submit sends decision to API
- [ ] Success redirects to gates list
- [ ] Gate removed from pending list after approval

### US-006: Submit Rejection Decision
**As a** Reviewer
**I want to** reject a gate request with feedback
**So that** the submitting agent can address the issues

**Acceptance Criteria:**
- [ ] Reject button visible on gate detail page
- [ ] Click opens rejection form
- [ ] Reason field is required for rejection
- [ ] Optional additional feedback field
- [ ] Submit sends decision to API
- [ ] Success redirects to gates list
- [ ] Gate removed from pending list after rejection

---

## Epic: Dashboard Overview

### US-007: View Dashboard Summary
**As a** Reviewer
**I want to** see a summary of system status on the dashboard
**So that** I can quickly assess the current workload

**Acceptance Criteria:**
- [ ] Dashboard is the default landing page
- [ ] Shows 3 summary cards: Pending Gates, Active Sessions, Worker Pool
- [ ] Numbers update automatically via polling
- [ ] Clicking card navigates to detailed page

### US-008: View Recent Gates on Dashboard
**As a** Reviewer
**I want to** see recent pending gates on the dashboard
**So that** I can quickly access urgent items without navigation

**Acceptance Criteria:**
- [ ] Dashboard shows up to 5 most recent pending gates
- [ ] Gates sorted by creation time (newest first)
- [ ] "View All" link navigates to full gates page
- [ ] Gate cards are clickable to detail page

---

## Epic: Worker Monitoring

### US-009: View Worker Pool Status
**As an** Administrator
**I want to** see the status of the worker pool
**So that** I can monitor system capacity

**Acceptance Criteria:**
- [ ] Workers page shows total/active/idle counts
- [ ] Visual indicator (progress ring or bar) shows utilization
- [ ] Individual worker cards show: ID, type, status
- [ ] Running workers show current task

### US-010: View Worker Details
**As an** Administrator
**I want to** see details about each worker
**So that** I can identify bottlenecks or issues

**Acceptance Criteria:**
- [ ] Worker card shows agent type (coding, test, review, etc.)
- [ ] Running workers show task description
- [ ] Session ID linked if worker assigned
- [ ] Heartbeat timestamp shows liveness
- [ ] Status color indicates health (green=running, gray=idle, red=error)

---

## Epic: Session Monitoring

### US-011: View Active Sessions
**As an** Administrator
**I want to** see all active sessions
**So that** I can monitor workflow progress

**Acceptance Criteria:**
- [ ] Sessions page shows list of sessions
- [ ] Filter by status (active, completed, all)
- [ ] Each session shows: ID, epic, status, progress
- [ ] Progress bar shows completed/total tasks
- [ ] Pending gates count displayed

### US-012: View Session Progress
**As an** Administrator
**I want to** see task completion progress for a session
**So that** I can estimate time to completion

**Acceptance Criteria:**
- [ ] Session card shows progress bar
- [ ] Percentage displayed (completed/total tasks)
- [ ] Pending gates highlighted if > 0
- [ ] Completed sessions show completion timestamp

---

## Epic: Multi-Tenancy (When Enabled)

### US-013: Select Tenant
**As a** Reviewer
**I want to** select which tenant's gates I'm viewing
**So that** I can focus on my organization's items

**Acceptance Criteria:**
- [ ] Tenant selector visible in header when multi-tenancy enabled
- [ ] Dropdown shows available tenants
- [ ] Selection filters all data to that tenant
- [ ] Selection persists in session storage
- [ ] Hidden when multi-tenancy disabled

---

## Epic: User Experience

### US-014: Responsive Layout
**As a** Reviewer
**I want to** use the dashboard on different screen sizes
**So that** I can review gates on various devices

**Acceptance Criteria:**
- [ ] Layout adapts to tablet (768px+) viewports
- [ ] Mobile (< 768px) shows collapsed sidebar
- [ ] Cards stack vertically on narrow screens
- [ ] Touch targets sized appropriately for mobile

### US-015: Loading States
**As a** Reviewer
**I want to** see loading indicators during data fetches
**So that** I know the system is working

**Acceptance Criteria:**
- [ ] Spinner shown during initial page loads
- [ ] Skeleton placeholders for card content
- [ ] Background polling doesn't show loading state
- [ ] Error states show retry action

### US-016: Navigation Feedback
**As a** Reviewer
**I want to** know which page I'm on
**So that** I can orient myself in the application

**Acceptance Criteria:**
- [ ] Active sidebar item highlighted
- [ ] Page title visible in header or content area
- [ ] Browser tab title reflects current page
- [ ] Breadcrumb for detail pages (Gates > Gate Details)

---

## Non-Functional Requirements

### NFR-001: Performance
- Initial page load < 2 seconds
- Polling updates < 500ms to render
- No layout shift during updates

### NFR-002: Accessibility
- All interactive elements keyboard accessible
- ARIA labels on icon-only buttons
- Color contrast meets WCAG AA
- Screen reader announces dynamic updates

### NFR-003: Browser Support
- Chrome 100+
- Firefox 100+
- Safari 15+
- Edge 100+

### NFR-004: Health Endpoint
- `/health` endpoint must return 200 for K8s probes
- Must not require authentication
- Response includes service name and timestamp
