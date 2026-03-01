---
id: P15-F14
parent_id: P15
type: tasks
version: 1
status: pending
created_by: planner
created_at: "2026-03-01T00:00:00Z"
updated_at: "2026-03-01T00:00:00Z"
estimated_hours: 20
---

# Tasks: Execution Hardening (P15-F14)

## Dependency Graph

```
Phase 1 (Types + Utils)
  T01 (types) -> T02 (backoff util)
Phase 2 (Retry)
  T03 (executeWithRetry) -> T04 (parallel retry) -> T05 (timeout enhancements)
Phase 3 (History)
  T06 (history service) -> T07 (history IPC handlers) -> T08 (history store)
Phase 4 (Replay)
  T09 (replay engine) -> T10 (replay IPC)
Phase 5 (Integration)
  T11 (wiring) -> T12 (E2E test)
```

## Phase 1: Types and Utilities (T01-T02)

### T01: Add retry/history types to shared types

- [ ] Estimate: 1hr
- [ ] Notes:
  - RED: test NodeExecutionState has retryCount, lastRetryAt fields
  - RED: test ExecutionHistoryEntry and ExecutionHistorySummary interfaces exist
  - RED: test ExecutionEventType includes node_retry, node_retry_exhausted, node_timeout_warning
  - RED: test AgentNodeConfig has maxRetries, retryableExitCodes
  - RED: test AppSettings has defaultMaxRetries (0), retryBackoffMs (1000) in DEFAULT_SETTINGS
  - RED: test WorkflowDefinition has timeoutSeconds
  - RED: test IPC_CHANNELS has EXECUTION_HISTORY_LIST/GET/CLEAR, EXECUTION_REPLAY
  - GREEN: add all type additions to execution.ts, settings.ts, workflow.ts, ipc-channels.ts
  - Dependencies: none

### T02: Create computeBackoffMs pure function

- [ ] Estimate: 0.5hr
- [ ] Notes:
  - RED: test computeBackoffMs(0, 1000) returns ~1000 (base)
  - RED: test computeBackoffMs(3, 1000) returns ~8000 (exponential)
  - RED: test result includes jitter (not exact powers of 2)
  - RED: test result is always >= 0
  - GREEN: create src/main/services/retry-utils.ts with computeBackoffMs(attempt, baseMs)
  - Formula: baseMs * 2^attempt + random(0, baseMs)
  - Dependencies: none

## Phase 2: Retry Logic (T03-T05)

### T03: Implement executeWithRetry wrapper

- [ ] Estimate: 2hr
- [ ] Notes:
  - RED: test executeWithRetry calls attemptFn once when maxRetries=0
  - RED: test retries on timeout (exit -1) up to maxRetries
  - RED: test does NOT retry on exit 0 (success)
  - RED: test retries on specific retryableExitCodes
  - RED: test emits node_retry event on each retry
  - RED: test emits node_retry_exhausted when max reached
  - RED: test checks isAborted before each attempt
  - RED: test aborts mid-backoff sleep when isAborted becomes true
  - GREEN: add executeWithRetry to execution-engine.ts, CC<=5
  - Dependencies: T01, T02

### T04: Wire retry for parallel execution path

- [ ] Estimate: 1.5hr
- [ ] Notes:
  - RED: test failed parallel blocks are retried at engine level
  - RED: test retry respects per-node maxRetries config
  - RED: test parallel retry updates nodeStates with retryCount
  - GREEN: after startParallel() returns, collect failed results, retry individually
  - Dependencies: T03

### T05: Implement timeout enhancements

- [ ] Estimate: 2hr
- [ ] Notes:
  - RED: test node_timeout_warning emitted at 80% of timeout
  - RED: test progressive timeout increases by 50% per retry, capped at 2x
  - RED: test workflow-level timeout computed as sum(sequential) + max(parallel) + 20%
  - RED: test WorkflowDefinition.timeoutSeconds overrides auto-computed value
  - RED: test 5s grace period before hard kill
  - GREEN: add warning timer, progressive calc, workflow timeout to execution-engine.ts
  - Dependencies: T03

## Phase 3: Execution History (T06-T08)

### T06: Create ExecutionHistoryService

- [ ] Estimate: 2hr
- [ ] Notes:
  - RED: test addEntry stores entry and persists to JSON
  - RED: test ring buffer evicts oldest when > 100 entries
  - RED: test list returns ExecutionHistorySummary[] (no workflow/nodeStates)
  - RED: test getById returns full ExecutionHistoryEntry
  - RED: test getById returns null for missing id
  - RED: test clear empties history and persists
  - RED: test concurrent writes are serialized (write queue)
  - GREEN: create src/main/services/execution-history-service.ts
  - Dependencies: T01

### T07: Create execution history IPC handlers

- [ ] Estimate: 1hr
- [ ] Notes:
  - RED: test EXECUTION_HISTORY_LIST returns summary array
  - RED: test EXECUTION_HISTORY_GET returns entry by id
  - RED: test EXECUTION_HISTORY_GET returns error for missing id
  - RED: test EXECUTION_HISTORY_CLEAR empties history
  - GREEN: create src/main/ipc/execution-history-handlers.ts
  - Dependencies: T06

### T08: Wire history save into ExecutionEngine

- [ ] Estimate: 1hr
- [ ] Notes:
  - RED: test execution complete triggers history save
  - RED: test execution failed triggers history save
  - RED: test execution aborted triggers history save
  - RED: test saved entry contains full workflow, nodeStates, retryStats
  - GREEN: call historyService.addEntry() in start() completion path
  - Dependencies: T06, T03

## Phase 4: Replay (T09-T10)

### T09: Implement replay in ExecutionEngine

- [ ] Estimate: 2hr
- [ ] Notes:
  - RED: test full replay re-executes entire workflow from history
  - RED: test resume replay skips completed nodes
  - RED: test resume treats waiting_gate nodes as re-execute
  - RED: test replay blocked when execution already active
  - RED: test replay creates its own history entry
  - RED: test replay returns { success, executionId } on success
  - RED: test replay returns { success: false, error } for missing history entry
  - GREEN: add replay() method to execution-engine.ts, CC<=5
  - Dependencies: T06, T08

### T10: Create replay IPC handler

- [ ] Estimate: 0.5hr
- [ ] Notes:
  - RED: test EXECUTION_REPLAY with mode=full starts new execution
  - RED: test EXECUTION_REPLAY with mode=resume skips completed
  - RED: test EXECUTION_REPLAY with invalid id returns error
  - GREEN: add handler in execution-history-handlers.ts
  - Dependencies: T09

## Phase 5: Integration (T11-T12)

### T11: Wire history service and handlers into app startup

- [ ] Estimate: 1hr
- [ ] Notes:
  - RED: test history handlers registered in main/index.ts
  - RED: test ExecutionEngine receives historyService in constructor
  - RED: test executionStore handles node_retry events
  - GREEN: register handlers, pass service to engine, update store
  - Dependencies: T07, T08

### T12: End-to-end integration test

- [ ] Estimate: 1.5hr
- [ ] Notes:
  - Test: execute workflow with retries -> verify retryCount in nodeStates
  - Test: execution saves to history -> list shows entry -> get returns full
  - Test: replay from history -> new execution created
  - Test: timeout warning emitted at 80%
  - Dependencies: T11

## Summary

| Phase | Tasks | Est. Hours |
|-------|-------|-----------|
| Phase 1: Types + Utils | T01-T02 | 1.5hr |
| Phase 2: Retry | T03-T05 | 5.5hr |
| Phase 3: History | T06-T08 | 4hr |
| Phase 4: Replay | T09-T10 | 2.5hr |
| Phase 5: Integration | T11-T12 | 2.5hr |
| **Total** | **12 tasks** | **16hr** |
