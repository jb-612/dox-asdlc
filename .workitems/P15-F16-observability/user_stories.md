---
id: P15-F16
parent_id: P15
type: user_stories
version: 1
status: draft
created_by: planner
created_at: "2026-03-01T00:00:00Z"
updated_at: "2026-03-01T00:00:00Z"
---

# User Stories: Observability (P15-F16)

## US-01: Trace Context for Workflow Executions

**As a** Workflow Studio user,
**I want** each workflow execution to have a unique trace ID and each block to have a span ID,
**So that** I can correlate telemetry events across blocks and agents within a single run.

### Acceptance Criteria

- [ ] Every execution_started event carries a traceId (UUIDv4)
- [ ] Every node_started event carries a spanId unique to that block execution
- [ ] traceId and spanId appear on ExecutionEvent and TelemetryEvent types
- [ ] CLI processes receive TRACE_ID and SPAN_ID as environment variables
- [ ] Events without trace context render gracefully (no errors, show "N/A")

## US-02: Persistent Cost Tracking per Execution

**As a** Workflow Studio user,
**I want** token usage and cost data to be saved after each workflow execution,
**So that** I can review historical costs without relying on in-memory telemetry.

### Acceptance Criteria

- [ ] On execution completion, an execution cost summary is persisted to JSON
- [ ] Summary includes total input/output tokens, total cost, per-block breakdown
- [ ] Data persists across app restarts
- [ ] Daily JSON files partition data for efficient access
- [ ] Files older than retention period (default 90 days) are pruned on startup

## US-03: Analytics Dashboard with Cost Chart

**As a** Workflow Studio user,
**I want** to see a bar chart of daily execution costs over 7 or 30 days,
**So that** I can understand my LLM spending trends at a glance.

### Acceptance Criteria

- [ ] Analytics tab appears in the Monitoring page
- [ ] Bar chart shows daily cost with selectable window (7d / 30d)
- [ ] Chart renders with recharts library
- [ ] Empty state shown when no analytics data exists
- [ ] Chart updates when new execution data is persisted

## US-04: Execution History Table

**As a** Workflow Studio user,
**I want** a sortable table of recent workflow executions showing duration, cost, and status,
**So that** I can identify expensive or failing executions quickly.

### Acceptance Criteria

- [ ] Table shows: date, workflow name, status, duration, total cost, block count
- [ ] Sortable by any column
- [ ] Clicking a row shows per-block cost breakdown
- [ ] Table loads data from persisted analytics JSON files
- [ ] Shows last 50 executions by default

## US-05: Per-Block Cost Breakdown

**As a** Workflow Studio user,
**I want** to drill into a single execution and see cost per block,
**So that** I can identify which workflow blocks consume the most tokens.

### Acceptance Criteria

- [ ] Selecting an execution from the table shows block-level cost detail
- [ ] Each block row shows: block ID, input tokens, output tokens, cost
- [ ] Blocks with no cost data show "N/A" rather than $0.00
- [ ] Total row at bottom sums all block costs
