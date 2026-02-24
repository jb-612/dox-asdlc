---
id: P15-F05
parent_id: P15
type: prd
version: 1
status: draft
created_by: planner
created_at: "2026-02-22T00:00:00Z"
updated_at: "2026-02-22T00:00:00Z"
tags:
  - docker
  - parallel-execution
  - cold-start
  - workflow-engine
---

# PRD: Parallel Execution Engine + Docker Lifecycle (P15-F05)

## Business Intent

The Workflow Studio currently executes blocks sequentially, one at a time. Workflows that contain
independent parallel tracks waste wall-clock time. This feature introduces parallel block execution
with a container pool that pre-warms Docker containers and reuses dormant ones -- eliminating cold-start
latency from the critical path and reducing total workflow execution time proportional to the degree
of parallelism.

## Goals

1. Allow workflow templates to declare parallel lanes (fan-out/fan-in) in their execution plan.
2. Start all blocks in a parallel lane simultaneously so total time is bounded by the slowest block, not the sum of all blocks.
3. Pre-warm containers ahead of execution so no block waits on Docker cold-start.
4. Reuse dormant containers across executions to eliminate repeated cold-starts within a session.
5. Surface live container pool state to the operator in the Monitoring tab.

## Non-Goals

- Cross-host or distributed container execution.
- The `single-container` parallelism model (multi-CLI inside one container) -- interface is scaffolded but execution is deferred.
- Container resource limits (CPU/memory cgroup quotas) -- deferred to a follow-on feature.
- Workflow editor UI for authoring parallel lanes -- assumed defined in template JSON for this feature.
- Conflict resolution for parallel blocks writing the same file -- last-write-wins for now; policy deferred.

## Performance Targets

| Operation | Target |
|-----------|--------|
| Cold-start time (image cached, single container) | < 10 seconds |
| Dormant container wake time | < 2 seconds |
| Fan-out launch spread (time between first and last block start) | < 200ms p95 |
| Default dormancy threshold (idle before pause) | 5 minutes |
| Health-check polling interval | 500ms |
| Health-check timeout | 30 seconds |
| Block abort propagation latency | < 1 second |

## Success Criteria

| Criterion | Measurement |
|-----------|-------------|
| Parallel blocks start within 200ms of each other | Timing captured in `execution:lane-start` event |
| Pre-warmed containers available before first block for >= 90% of executions | Logged in container pool telemetry |
| Dormant wake time <= 30% of cold-start time | Measured in integration tests |
| Zero container leaks after workflow completion or abort | `teardown()` verified in integration tests |
| Fan-in completes only when all parallel blocks finish | Unit test assertion |
| All new code paths covered by at least one automated test | Test coverage report |

## User Impact

| User | Impact |
|------|--------|
| Workflow author | Parallel lanes execute simultaneously; total time approaches longest-block time, not sum |
| Workflow author | Dormant containers allow rapid step re-execution without cold-start penalty |
| Developer / operator | Monitoring tab shows live container pool state (STARTING, IDLE, RUNNING, DORMANT, TERMINATED) |
| Developer / operator | `maxContainers` and `dormancyTimeoutMs` configurable per workflow template |

## Scope

### In Scope

- `ContainerPool` class: pre-warm, acquire, release (-> dormant), wake, teardown
- Container lifecycle state machine: STARTING -> IDLE -> RUNNING -> DORMANT -> TERMINATED
- `WorkflowExecutor` coordinator: fan-out/fan-in pattern, sequential lane advancement
- Workflow plan types: `WorkflowPlan`, `ParallelLane`, `parallelismModel` field, `failureMode` field
- Pre-warming algorithm: count max parallel blocks in plan, start containers before first lane executes
- Dormancy: `docker.pause()` on release; `docker.unpause()` on wake; timer-based termination after `dormancyTimeoutMs`
- Port allocation utility: ephemeral host port tracking within configurable range (default 9100-9199)
- IPC channels: `execution:pool-status`, `execution:lane-start`, `execution:lane-complete`, `execution:block-error`, `execution:aborted`
- `ContainerPoolPanel` React component: live pool state in Monitoring tab
- Unit tests for `ContainerPool` and `WorkflowExecutor` with mocked `dockerode`
- Integration test verifying end-to-end parallel lane execution with real Docker

### Out of Scope

- `single-container` parallelism model (interface defined only; execution deferred)
- Multi-region or cross-host container distribution
- Container resource limits (CPU/memory cgroup quotas) -- deferred
- Conflict resolution policy for parallel blocks editing the same file -- deferred (last-write-wins)
- Workflow editor UI changes for specifying parallel lanes
- Container image management (pull, tag, build) -- assumes image pre-pulled or pullable on demand

## Constraints

- Must use `dockerode` npm package (not shell exec or Docker Compose) for container control.
- Must not exceed `maxContainers` limit (default 10) to prevent runaway resource usage.
- Container images must be pullable; pull errors must fail container creation gracefully without crashing the pool.
- Dormant containers consume host memory; `dormancyTimeoutMs` must have a sane default (5 minutes) and must be configurable.
- Port range (9100-9199) must not conflict with other Workflow Studio services.
- Electron main process owns all container lifecycle; renderer may only query state and receive events.

## Acceptance Criteria

1. A workflow with 3 parallel blocks starts all 3 containers simultaneously (fan-out) and advances only after all 3 complete (fan-in).
2. Pre-warming starts immediately on `execution:start` IPC and completes before the first parallel lane begins executing.
3. A container that completes its block transitions to `dormant` (docker.pause applied) within 500ms.
4. A dormant container wakes and becomes `running` faster than starting a new cold container for the same block.
5. After `dormancyTimeoutMs` of inactivity, a dormant container is stopped, removed, and its port freed.
6. `pool.teardown()` terminates and removes all non-terminated containers regardless of current state.
7. `execution:pool-status` IPC is emitted after every container state transition.
8. Aborting a workflow marks all in-flight blocks as failed within approximately 1 second.
9. Port allocation never assigns the same port to two concurrent containers within a session.
10. All `ContainerPool` and `WorkflowExecutor` unit tests pass with mocked `dockerode`.
11. `ContainerPoolPanel` renders real-time pool state without requiring a page refresh.
