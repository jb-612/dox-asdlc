---
id: P15-F05
parent_id: P15
type: user_stories
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

# User Stories: Parallel Execution Engine + Docker Lifecycle (P15-F05)

## Epic Summary

As a workflow author or operator using the Workflow Studio, I want workflows with parallel tracks
to execute all lanes simultaneously and for containers to be pre-warmed and reused across executions,
so that total workflow time is minimized and I do not pay cold-start penalties on repeated runs.

---

## US-01: Parallel Block Execution (Fan-Out)

**As a** workflow author,
**I want** all blocks in a parallel lane to start executing at the same time,
**So that** the total time for a parallel lane is bounded by the slowest block, not the sum of all blocks.

### Acceptance Criteria

- All blocks in a `ParallelLane` start within 200ms of each other (p95).
- The Monitoring tab shows all blocks in the lane as `RUNNING` simultaneously.
- The workflow does not advance past the parallel lane until all blocks have completed (per the configured failure mode).
- An `execution:lane-start` IPC event is emitted with the full list of block IDs for the lane.

### Test Scenarios

**Given** a workflow with a parallel lane containing blocks A, B, and C,
**When** the executor reaches that lane,
**Then** containers for A, B, and C start within 200ms of each other.

**Given** block B fails while A and C are still running,
**When** A and C complete,
**Then** `execution:lane-complete` is emitted with B marked `failed` and A, C marked with their results.

---

## US-02: Fan-In Completion Gate

**As a** workflow author,
**I want** the workflow to wait for every parallel block to finish before moving to the next sequential step,
**So that** downstream blocks always receive the complete output from all parallel lanes.

### Acceptance Criteria

- The workflow executor does not advance the DAG to the next node until every `Promise` in the fan-out `Promise.allSettled` call has settled.
- An `execution:lane-complete` IPC event is emitted only after all blocks in the lane have settled.
- If one block finishes early, its container transitions to `dormant` immediately while the others continue running.
- The merged lane output is passed to the next sequential block as input.

### Test Scenarios

**Given** a 3-block parallel lane where block A finishes in 1s, B in 3s, and C in 2s,
**When** block A finishes at T+1s,
**Then** the workflow does not advance; block A's container goes dormant while B and C continue.
**And** when B finishes at T+3s, `execution:lane-complete` is emitted with all three results.

---

## US-03: Container Pre-Warming

**As a** workflow author,
**I want** Docker containers to be started and ready before the first parallel lane begins executing,
**So that** I do not experience Docker cold-start latency during the critical execution path.

### Acceptance Criteria

- Pre-warming begins immediately when `execution:start` IPC is received.
- The pool starts a number of containers equal to the maximum parallel width across any lane in the plan.
- Pre-warming runs concurrently with sequential blocks that precede the first parallel lane.
- If all containers are ready when the fan-out begins, they are assigned without waiting for Docker startup.
- Pre-warming respects `maxContainers` and does not exceed the configured cap.

### Test Scenarios

**Given** a workflow with a parallel lane of width 3,
**When** execution starts,
**Then** 3 containers begin warming (STARTING state) before the first block executes.

**Given** all 3 pre-warmed containers reach IDLE before the parallel lane begins,
**When** the parallel lane starts,
**Then** all 3 blocks are dispatched immediately without additional health-check wait.

---

## US-04: Cold-Start Performance

**As an** operator,
**I want** a freshly started container to be ready and accepting requests in under 10 seconds (image cached),
**So that** even worst-case cold-starts do not unacceptably delay short workflow executions.

### Acceptance Criteria

- From `docker.start()` to first successful `/health` response takes less than 10 seconds when the image is already present on the host.
- Health-check polling occurs every 500ms.
- If the health-check has not succeeded within 30 seconds, the container is marked `terminated` and the pool attempts to create a replacement.
- Cold-start duration is captured in the `container:state-change` event payload (from `starting` to `idle`) for observability.

### Test Scenarios

**Given** the Docker image is already present on the host,
**When** a new container is created and started,
**Then** the container reaches `idle` state within 10 seconds.

**Given** the health-check does not succeed within 30 seconds,
**When** the timeout fires,
**Then** the container transitions to `terminated` and the pool starts a replacement.

---

## US-05: Container Dormancy After Block Completion

**As an** operator,
**I want** containers to transition to a low-resource dormant state after their assigned block finishes,
**So that** idle containers do not consume CPU while remaining available for rapid reuse.

### Acceptance Criteria

- Within 500ms of a block completing (success or failure), `docker.pause()` is issued for the container.
- The container record transitions to state `dormant` and `dormantSince` is recorded.
- A `container:state-change` IPC event is emitted with `{ fromState: 'running', toState: 'dormant' }`.
- The `ContainerPoolPanel` in the Monitoring tab reflects the `DORMANT` state without a full page refresh.
- A dormant container does not appear as `idle`; the pool wakes it on demand rather than treating it as immediately assignable.

### Test Scenarios

**Given** a block completes successfully,
**When** the executor calls `pool.release(containerId)`,
**Then** the container state is `dormant` and `docker.pause()` was called.

**Given** a dormant container,
**When** the pool needs a container for a new block and no idle containers exist,
**Then** the dormant container is woken (transitioning through idle to running) rather than a new container being created.

---

## US-06: Dormant Container Wake and Reuse

**As an** operator,
**I want** dormant containers to wake and be reused for subsequent blocks within the same session,
**So that** I avoid repeated cold-starts when re-running or chaining workflows.

### Acceptance Criteria

- When `pool.acquire()` is called and no `idle` containers exist, the pool wakes the longest-dormant container via `docker.unpause()`.
- Wake time (from `docker.unpause()` to successful `/health` probe) is less than 2 seconds in the typical case.
- After waking, the container transitions from `dormant` to `running` and is assigned to the requesting block.
- Wake time is measurably less than cold-start time (new container) for the same image.
- If wake fails (health-check timeout), the container transitions to `terminated` and the pool falls back to creating a new container.

### Test Scenarios

**Given** no idle containers exist and one dormant container exists,
**When** `pool.acquire("blockX")` is called,
**Then** `docker.unpause()` is called on the dormant container and the container is assigned to `blockX`.

**Given** a dormant container fails its wake health-check,
**When** the health-check timeout expires,
**Then** the container is terminated and a new cold-start container is created as fallback.

---

## US-07: Dormancy Expiry and Container Termination

**As an** operator,
**I want** dormant containers that remain idle beyond the dormancy threshold to be automatically terminated,
**So that** long-lived sessions do not accumulate paused containers consuming unbounded host memory.

### Acceptance Criteria

- After a container has been dormant for `dormancyTimeoutMs` (default 5 minutes), it is stopped and removed via `docker.stop()` and `docker.remove()`.
- The container record transitions to `terminated` and its allocated port is returned to the free pool.
- A `container:state-change` IPC event is emitted with `{ fromState: 'dormant', toState: 'terminated' }`.
- If `pool.teardown()` is called before the timer fires, all dormant containers are terminated immediately.
- The dormancy timer is cancelled if the container is woken before it expires.

### Test Scenarios

**Given** a container in DORMANT state,
**When** the dormancy timer fires after `dormancyTimeoutMs`,
**Then** `docker.stop()` and `docker.remove()` are called and the container state is `terminated`.

**Given** a container is woken before the dormancy timer fires,
**When** the container transitions to RUNNING,
**Then** the dormancy timer is cancelled and no termination occurs.

---

## US-08: Error in One Parallel Branch Does Not Block Fan-In

**As a** workflow author,
**I want** the fan-in to complete even when one parallel branch fails,
**So that** partial results from healthy branches are not lost and I can inspect what succeeded vs. what failed.

### Acceptance Criteria

- With `failureMode: 'lenient'`, a single block failure does not cancel other in-flight blocks; `Promise.allSettled` collects all outcomes before fan-in.
- The `execution:lane-complete` event includes both successful results and error details for failed blocks.
- With `failureMode: 'strict'`, a single block failure triggers `AbortController.abort()` for remaining blocks and the lane is marked as failed.
- In both modes, every container used by the lane transitions to `dormant` after fan-in completes (or `terminated` if the container itself errored fatally).
- An `execution:block-error` IPC event is emitted for each failed block with `{ blockId, error }`.

### Test Scenarios

**Given** a 3-block parallel lane with `failureMode: 'lenient'` and block B fails at T+1s,
**When** A and C complete at T+2s,
**Then** `execution:lane-complete` is emitted with A and C as successful and B as failed.

**Given** a 3-block parallel lane with `failureMode: 'strict'` and block B fails at T+1s,
**When** the failure is detected,
**Then** blocks A and C receive abort signals and the lane is marked failed immediately.
