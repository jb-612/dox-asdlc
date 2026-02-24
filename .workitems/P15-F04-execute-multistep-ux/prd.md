---
id: P15-F04
parent_id: P15
type: prd
version: 1
status: draft
constraints_hash: null
created_by: planner
created_at: "2026-02-22T00:00:00Z"
updated_at: "2026-02-22T00:00:00Z"
dependencies:
  - P14-F04
  - P14-F05
tags:
  - execution
  - ux
  - step-gate
  - deliverables
  - event-log
---

# PRD: Execute — Multi-Step Workflow UX (P15-F04)

## Business Intent

The P15 Workflow Studio can start workflows and show a basic status view, but once a workflow is
running the user has no rich visibility into what is happening or meaningful control over pacing.
This feature delivers the "while-running" and "step gate" experience: a real-time event log that
reads like an activity feed, a visual block progress rail, per-block deliverable review with
configurable scrutiny, and the ability to revise a block with inline feedback before moving on.

Together, these capabilities transform Workflow Studio from a "fire and forget" runner into an
interactive, auditable execution environment.

## Success Metrics

| Metric | Target |
|--------|--------|
| Event log shows human-readable entries for all agent activity | 100% of event types have a display entry |
| Step gate fires within 500ms of a gated block completing | p99 < 500ms |
| Deliverables render at all three scrutiny levels for plan blocks | 100% of plan block outputs |
| Revise feedback is injected and block re-runs successfully | Verifiable in mock mode |
| Revision count is tracked and displayed per block | Visible in Step Gate panel |
| No regression on existing execution controls (pause/resume/abort) | All existing E2E tests pass |

## User Impact

| User | Impact |
|------|--------|
| Workflow author | Can watch each step's activity in a readable log; can review and iterate on planner output before proceeding |
| PM CLI operator | Can use gate decisions to inject steering mid-workflow without restarting |
| Developer / reviewer | Can inspect the exact sequence of tool calls and file operations the agent performed |

## Scope

### In Scope

- `EventLogPanel` — real-time human-readable event stream with timestamps and icons
- `StepGatePanel` — deliverables display, scrutiny level selector, Continue/Revise decision bar
- `DeliverablesViewer` — renders plan deliverables at chosen scrutiny level (summary / file list / full detail)
- `ScrutinyLevelSelector` — segmented control: Summary, File List, Full Detail
- `ContinueReviseBar` — Continue button and Revise workflow with feedback textarea
- `DiffViewer` stub — component scaffold for code diff display (not yet wired to real diffs)
- Enhanced `ExecutionCanvas` — active node pulse animation, status-aware coloring, parallel branch layout
- `eventFormatter.ts` utility — pure function mapping raw ExecutionEvents → human-readable entries
- `EXECUTION_REVISE` IPC channel — renderer submits feedback; engine re-queues block
- Extended execution types — `tool_call`, `bash_command`, `block_gate_open`, `block_revised` events; `revisionCount` and `gateMode` on `NodeExecutionState`
- `gateMode` per-node config field — `'auto_continue' | 'gate'`; default `'auto_continue'`
- Deliverables schema for plan blocks stored in `NodeExecutionState.output`
- Store additions: `scrutinyLevel`, `setScrutinyLevel`, `reviseBlock`

### Out of Scope

- Real code diff from Dev blocks (DiffViewer is a stub; real impl is a follow-on feature)
- Test block deliverables (test results, coverage) — follow-on
- Review block deliverables (findings panel) — follow-on
- Persistent scrutiny level preference (in-session state only)
- AI-generated summaries from a live LLM call at gate time (summary is pre-computed by agent and stored in output)
- Multi-workflow parallel execution (one execution at a time, same as today)

## Constraints

- Must not break existing execution controls (pause, resume, abort, gate decision)
- `ExecutionWalkthroughPage` already exists at `/execute/run`; changes are enhancements, not rewrites
- `executionStore.ts` Zustand store is the single source of truth; no local state duplication of execution data
- `gateMode: 'auto_continue'` must be the default so existing workflows run without change
- The `EXECUTION_REVISE` IPC channel must be idempotent — re-queuing an already-running node must be rejected

## Acceptance Criteria

1. Event log panel displays all execution events with timestamps and human-readable messages; new events appear in real time without page refresh
2. `tool_call` and `bash_command` events from the execution engine appear in the event log
3. When a block with `gateMode: 'gate'` completes, the Step Gate panel opens automatically and execution pauses
4. The Step Gate panel shows Summary, File List, and Full Detail views for plan block outputs; switching views re-renders without a network call
5. The user can click **Continue** to advance execution to the next block
6. The user can type feedback and click **Revise**; the block re-runs with the feedback appended; `revisionCount` increments in the UI
7. The active node in `ExecutionCanvas` is visually distinct (pulse animation, highlighted border)
8. Parallel branches in the workflow render as side-by-side columns in the canvas
9. The `DiffViewer` component renders a placeholder for future code diff display
10. All existing E2E tests for execution controls pass unchanged
