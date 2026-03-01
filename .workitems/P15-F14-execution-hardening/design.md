---
id: P15-F14
parent_id: P15
type: design
version: 3
status: approved
created_by: planner
created_at: "2026-02-28T00:00:00Z"
updated_at: "2026-03-01T00:00:00Z"
dependencies:
  - P15-F05
  - P15-F09
tags:
  - execution
  - reliability
  - phase-3
estimated_hours: 20
---

# Design: Execution Hardening (P15-F14)

## Overview

Add retry logic, enhanced timeout controls, persistent execution history, and replay to the execution engine. Dependencies F05 and F09 are complete (verified, 1331 tests passing).

## 1. Retry Logic

Extract `executeWithRetry(attemptFn, policy)` helper (CC<=5) and `computeBackoffMs(attempt, baseMs)` pure function. Retry loop checks `this.isAborted` before each attempt and during backoff sleep.

- Retry triggers: exit code -1 (timeout), or codes in `retryableExitCodes` (empty = timeout only)
- Backoff: `computeBackoffMs` — exponential with jitter, extracted as pure function
- Per-node: `AgentNodeConfig.maxRetries` (default: 0). Global: `AppSettings.defaultMaxRetries` (default: 0)
- Parallel: retry failed blocks at engine level after `startParallel()` returns
- Events: `node_retry`, `node_retry_exhausted`. Abort cancels mid-backoff sleep.

## 2. Timeout Enhancements

- Workflow timeout: `WorkflowDefinition.timeoutSeconds?` override, or auto = max(lane timeouts) for parallel + sum(sequential) + 20%
- 80% warning: `node_timeout_warning` event — surfaces through existing event log (no new UI)
- Grace period: 5s before hard kill to capture partial output
- Progressive: +50% per retry attempt, capped at 2x original

## 3. Execution History

```typescript
interface ExecutionHistoryEntry {
  id: string;                    // same as Execution.id
  workflowId: string;
  workflowName: string;          // from workflow.name
  workflow: WorkflowDefinition;  // full definition for replay
  workItem?: WorkItemReference;
  status: ExecutionStatus;
  startedAt: string;
  completedAt?: string;
  nodeStates: Record<string, NodeExecutionState>;
  retryStats: Record<string, number>; // nodeId -> total retry count
}
// Summary type for list endpoint (omits workflow, nodeStates, retryStats)
type ExecutionHistorySummary = Pick<ExecutionHistoryEntry, 'id'|'workflowId'|'workflowName'|'status'|'startedAt'|'completedAt'>;
```

- Service: `ExecutionHistoryService` — JSON ring buffer (100 entries), `<userData>/execution-history.json`
- Auto-save on execution complete/fail/abort via normal `start()` path
- IPC: `LIST` returns `ExecutionHistorySummary[]`, `GET` returns full entry, `CLEAR` empties

## 4. Replay

- Request: `{ historyEntryId: string, mode: 'full' | 'resume' }`
- Response: `{ success: boolean, executionId?: string, error?: string }`
- Blocked if execution already active (`isActive()` returns true)
- `full`: re-executes entire workflow from history entry's definition
- `resume`: pre-populates completed nodeStates, treats `waiting_gate`/`failed` as re-execute
- Always invokes normal `start()` path — auto-saves to history, emits standard events
- Replay creates its own separate history entry

## Type Changes

- `NodeExecutionState`: add `retryCount?: number`, `lastRetryAt?: string`
- `AgentNodeConfig`: add `maxRetries?: number`, `retryableExitCodes?: number[]` (empty=timeout only)
- `AppSettings`: add `defaultMaxRetries?: number` (default: 0), `retryBackoffMs?: number` (default: 1000)
- `WorkflowDefinition`: add `timeoutSeconds?: number`
- `ExecutionEventType`: add `node_retry`, `node_retry_exhausted`, `node_timeout_warning`
- `IPC_CHANNELS`: add `EXECUTION_HISTORY_LIST/GET/CLEAR`, `EXECUTION_REPLAY` (4 new)
- New types: `ExecutionHistoryEntry`, `ExecutionHistorySummary` in `execution.ts`

## File Changes

### New Files
```
src/main/services/execution-history-service.ts
src/main/ipc/execution-history-handlers.ts
test/main/execution-history-service.test.ts
test/main/execution-history-handlers.test.ts
test/main/execution-retry.test.ts
test/main/execution-replay.test.ts
```

### Modified Files
```
src/main/services/execution-engine.ts          # executeWithRetry, timeout warning, history save
src/shared/types/execution.ts                  # New types + field additions
src/shared/types/settings.ts                   # defaultMaxRetries, retryBackoffMs + DEFAULT_SETTINGS
src/shared/types/workflow.ts                   # timeoutSeconds on WorkflowDefinition
src/shared/ipc-channels.ts                     # 4 new channels
src/main/index.ts                              # Register history handlers
src/renderer/stores/executionStore.ts          # Handle retry + history events
```

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| JSON vs SQLite | JSON ring buffer | Simpler, no native dep, 100 entries sufficient |
| Retry at engine level | Yes | Centralized, works for sequential + parallel |
| CC compliance | Extract `executeWithRetry` + `computeBackoffMs` | Keep each function CC<=5 |
| Progressive timeout cap | 2x original | Prevents unbounded growth |

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Retry masks real failures | Medium | Default maxRetries=0, opt-in only |
| Abort during backoff sleep | Medium | Check `isAborted` at loop start + during sleep |
| History file grows large | Low | Ring buffer capped at 100, summary type for list |
| Replay with changed code | Medium | Documented: replays original workflow def, current code |
