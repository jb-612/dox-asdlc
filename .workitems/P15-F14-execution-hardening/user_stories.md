---
id: P15-F14
parent_id: P15
type: user_stories
version: 2
status: draft
created_by: planner
created_at: "2026-03-01T00:00:00Z"
updated_at: "2026-03-01T00:00:00Z"
---

# User Stories: Execution Hardening (P15-F14)

## US-01: Automatic Retry on Transient Failures

**As a** workflow operator,
**I want** failed blocks to retry automatically based on a configured policy,
**So that** transient errors (timeouts, rate limits) don't require manual re-runs.

### Acceptance Criteria
- [ ] Per-block `maxRetries` configurable in block config panel (default: 0)
- [ ] Global `defaultMaxRetries` in Settings (default: 0)
- [ ] Exponential backoff between retry attempts
- [ ] Retry count visible in execution state and monitoring events
- [ ] `node_retry` event emitted on each retry attempt
- [ ] `node_retry_exhausted` event when max retries exceeded

## US-02: Timeout Warning and Grace Period

**As a** workflow operator,
**I want** to receive a warning before a block times out and have partial results captured,
**So that** I can intervene or at least recover partial work.

### Acceptance Criteria
- [ ] `node_timeout_warning` event at 80% of timeout threshold
- [ ] 5-second grace period before hard kill to capture partial output
- [ ] On retry, timeout increases by 50% per attempt
- [ ] Workflow-level timeout caps total execution time

## US-03: Execution History

**As a** workflow operator,
**I want** past workflow executions persisted and browsable,
**So that** I can review results from prior runs.

### Acceptance Criteria
- [ ] Last 100 executions saved automatically on complete/fail/abort
- [ ] History list retrievable via IPC with id, name, status, timestamps
- [ ] Individual history entry retrievable with full nodeStates
- [ ] History clearable via IPC

## US-04: Replay from History

**As a** workflow operator,
**I want** to replay a prior execution fully or resume from the first failure,
**So that** I don't have to manually reconfigure and re-run workflows.

### Acceptance Criteria
- [ ] Full replay: re-executes entire workflow from history entry
- [ ] Resume replay: skips completed nodes, starts from first failed
- [ ] Replay uses original workflow definition from history
- [ ] Replay emits standard events (monitoring works as-is)
- [ ] Replay creates its own history entry
