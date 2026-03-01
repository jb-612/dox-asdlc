---
id: P15-F10
parent_id: P15
type: user_stories
version: 1
status: draft
created_by: planner
created_at: "2026-02-26T00:00:00Z"
updated_at: "2026-02-26T00:00:00Z"
---

# User Stories: Shared Component Library Completion (P15-F10)

## US-01: Resilient IPC Error Handling

**As a** Workflow Studio user,
**I want** IPC failures to show a helpful error message with a retry option,
**So that** the app does not crash or show a blank screen when a backend call fails.

### Acceptance Criteria

- [ ] Pages wrapped with IpcErrorBoundary catch render-time errors
- [ ] Error fallback shows a message and "Retry" button
- [ ] Clicking "Retry" re-renders the page (clears error state)
- [ ] Error is logged to console for debugging
- [ ] 5 main pages are wrapped: Execution, Designer, Studio, Templates, Monitoring

## US-02: Transient Feedback via Toasts

**As a** Workflow Studio user,
**I want** to see brief notifications when actions succeed or fail,
**So that** I get immediate feedback without modal interruptions.

### Acceptance Criteria

- [ ] Toast appears at bottom-right for success, error, warning, info events
- [ ] Toasts auto-dismiss after 5 seconds (configurable)
- [ ] Max 5 visible toasts at once (oldest dismissed first)
- [ ] Error toasts shown for IPC failures (save, load, delete operations)
- [ ] Success toasts shown for completed actions (workflow saved, template created)

## US-03: Consistent Status Badges

**As a** developer maintaining Workflow Studio,
**I want** all status displays to use the shared StatusBadge component,
**So that** status rendering is consistent and changes propagate everywhere.

### Acceptance Criteria

- [ ] ExecutionDetailsPanel uses shared StatusBadge (not local statusBadgeClass)
- [ ] CLISessionList uses shared StatusBadge (not local statusBadge function)
- [ ] Visual appearance matches existing behavior (no regression)

## US-04: Improved Event Log

**As a** workflow operator,
**I want** the execution event log to support auto-scroll toggle, filtering, and search,
**So that** I can find relevant events in long execution runs.

### Acceptance Criteria

- [ ] Auto-scroll toggle button visible (when enabled via prop)
- [ ] Filter predicate hides events that don't match
- [ ] Search text highlights matching events
- [ ] EventLogPanel uses VirtualizedEventLog internally (not custom scroll)
