---
id: P15-F05
parent_id: P15
type: tasks
version: 1
status: complete
created_by: planner
created_at: "2026-02-22T00:00:00Z"
updated_at: "2026-02-22T00:00:00Z"
tags:
  - docker
  - parallel-execution
  - cold-start
  - workflow-engine
---

# Tasks: Parallel Execution Engine + Docker Lifecycle (P15-F05)

## Progress

- Started: 2026-02-22
- Completed: 2026-02-26
- Tasks Complete: 34/34
- Percentage: 100%
- Status: COMPLETE

---

## Phase 1: Container Pool Data Model and State Machine

### T01: Add `dockerode` dependency and TypeScript types

- [x] Estimate: 30min
- [x] Tests: `tsc --noEmit` passes; `import Docker from 'dockerode'` compiles without errors
- [x] Dependencies: None
- [x] Notes: Run `npm install dockerode @types/dockerode` in `apps/workflow-studio`. Confirm existing docker-compose dev stack is unaffected (dockerode uses the Docker socket directly, not Compose).

### T02: Define shared types — WorkflowPlan, ParallelLane, ContainerRecord, error types

- [x] Estimate: 45min
- [x] Tests: TypeScript compiles; existing tests pass unchanged
- [x] Dependencies: None
- [x] Notes: Extend `apps/workflow-studio/src/shared/types/workflow.ts` with `WorkflowPlan`, `ParallelLane`, `parallelismModel` field, and `failureMode` field. Extend `execution.ts` with `ContainerRecord`, `ContainerState` (union type), and `BlockResult`. Add `ValidationError` and `PortExhaustedError` to `shared/types/errors.ts`.

### T03: Implement ContainerState transition guard functions

- [x] Estimate: 45min
- [x] Tests: Unit tests — each valid transition is allowed; invalid transitions throw; all 5 states covered
- [x] Dependencies: T02
- [x] Notes: Create `apps/workflow-studio/src/main/services/container-states.ts`. Export `isValidTransition(from: ContainerState, to: ContainerState): boolean` and `assertTransition(from, to): void`. Document the state machine in a JSDoc block. Reference the design.md state diagram.

---

## Phase 2: dockerode Integration in Electron Main

### T04: Implement docker-client wrapper with typed helpers

- [x] Estimate: 1hr
- [x] Tests: Unit tests with mocked `dockerode` — pull, create, start, pause, unpause, stop, remove all invoked correctly
- [x] Dependencies: T01, T02
- [x] Notes: Create `apps/workflow-studio/src/main/services/docker-client.ts`. Export a `DockerClient` class wrapping `dockerode`. Methods: `pullImage(image)`, `createContainer(options)`, `startContainer(id)`, `pauseContainer(id)`, `unpauseContainer(id)`, `stopContainer(id)`, `removeContainer(id)`, `healthCheck(port, intervalMs, timeoutMs): Promise<void>`. Health check polls `GET http://localhost:<port>/health` using `node-fetch` or `http.get`. All errors are wrapped in a `DockerClientError` with the original cause attached.

### T05: Implement port allocator utility

- [x] Estimate: 1hr
- [x] Tests: Unit tests — allocates sequentially, returns port on release, throws `PortExhaustedError` when range is exhausted, never double-allocates
- [x] Dependencies: T02
- [x] Notes: Create `apps/workflow-studio/src/main/utils/port-allocator.ts`. `PortAllocator` class with a `Set<number>` of used ports. Constructor takes `{ start: number, end: number }`. Methods: `allocate(): number`, `release(port: number): void`, `available(): number` (count of free ports). Pure TypeScript — no Docker dependency.

---

## Phase 3: Pre-Warming Algorithm

### T06: Implement ContainerPool — STARTING and IDLE lifecycle (prewarm)

- [x] Estimate: 2hr
- [x] Tests: Unit tests (mocked docker-client) — `prewarm(3)` creates 3 containers, each reaches `idle` after health-check resolves; `prewarm` respects `maxContainers` cap
- [x] Dependencies: T03, T04, T05
- [x] Notes: Create `apps/workflow-studio/src/main/services/container-pool.ts`. Implement `prewarm(count: number): Promise<void>` using `Promise.all` over `count` `spawnContainer()` calls. Each `spawnContainer()`: pull image if absent, create container, start, poll health-check, transition `starting -> idle`. Emit state-change callback on each transition. Store records in `Map<string, ContainerRecord>`.

### T07: Implement `computeMaxParallelLanes` helper and integrate with prewarm

- [x] Estimate: 45min
- [x] Tests: Unit tests — returns 1 for sequential-only plans; returns max lane width for plans with multiple parallel lanes of different widths
- [x] Dependencies: T06
- [x] Notes: Add `computeMaxParallelLanes(plan: WorkflowPlan): number` to `workflow-executor.ts` (or a `plan-utils.ts` helper). Used by `WorkflowExecutor.execute()` to call `pool.prewarm(n)` immediately on execution start.

---

## Phase 4: Dormancy and Wake Management

### T08: Implement ContainerPool — RUNNING and DORMANT lifecycle (acquire/release)

- [x] Estimate: 2hr
- [x] Tests: Unit tests — `acquire` transitions `idle->running`; `release` transitions `running->dormant` and calls `docker.pause`; `acquire` preference order: idle > dormant (wake) > create new
- [x] Dependencies: T06
- [x] Notes: Add `acquire(blockId: string): Promise<ContainerRecord>` and `release(containerId: string): void`. `acquire()` must check for idle containers first, then dormant (call `wake()`), then call `spawnContainer()` if under `maxContainers`. `release()` calls `docker.pause()`, records `dormantSince`, and starts the dormancy timer via `setTimeout`.

### T09: Implement ContainerPool — wake protocol (DORMANT -> RUNNING)

- [x] Estimate: 1hr
- [x] Tests: Unit tests — `wake` calls `docker.unpause`, clears dormancy timer, runs health-check; wake failure transitions container to `terminated` and returns rejection
- [x] Dependencies: T08
- [x] Notes: Add `wake(containerId: string): Promise<void>` to `ContainerPool`. Steps: clear dormancy timer, call `docker.unpause()`, run health-check probe (reuse `DockerClient.healthCheck`). On health-check success: transition `dormant -> idle`. On health-check failure: call `terminate(containerId)`, throw `WakeFailedError`. `acquire()` catches `WakeFailedError` and falls back to `spawnContainer()`.

### T10: Implement ContainerPool — TERMINATED lifecycle and teardown

- [x] Estimate: 1hr
- [x] Tests: Unit tests — dormancy timer fires -> `terminate` called -> `docker.stop` + `docker.remove` + port released; `teardown()` terminates all non-TERMINATED containers
- [x] Dependencies: T09
- [x] Notes: Add `terminate(containerId: string): Promise<void>` (called by dormancy timer and wake failure): `docker.stop -> docker.remove -> portAllocator.release(port) -> state = terminated`. Add `teardown(): Promise<void>`: iterate all records, call `terminate` for any not already `terminated`. Verify `snapshot()` returns all records with state `terminated` after teardown.

---

## Phase 5: Fan-Out / Fan-In Coordinator

### T11: Implement WorkflowExecutor — sequential lane execution

- [x] Estimate: 1.5hr
- [x] Tests: Unit tests — single-block lanes execute in order; results returned per lane; `execution:lane-start` and `execution:lane-complete` emitted for each lane
- [x] Dependencies: T06, T08, T10
- [x] Notes: Create `apps/workflow-studio/src/main/services/workflow-executor.ts`. `WorkflowExecutor` constructor takes `ContainerPool` and `ExecutionEngine`. `execute(plan)` iterates `plan.lanes`. For `string` (single-block) lanes: `pool.acquire -> engine.executeBlock -> pool.release`. Use mocked `ExecutionEngine` in unit tests.

### T12: Implement WorkflowExecutor — fan-out / fan-in for parallel lanes

- [x] Estimate: 2hr
- [x] Tests: Unit tests — 3 parallel blocks start via `Promise.allSettled`; fan-in collects all results; `failureMode: 'strict'` aborts remaining blocks on first failure; `failureMode: 'lenient'` collects partial results
- [x] Dependencies: T11
- [x] Notes: For `ParallelLane` entries: `Promise.allSettled` over `pool.acquire -> engine.executeBlock -> pool.release` for each `blockId`. Pass an `AbortSignal` to `engine.executeBlock` for strict abort. Aggregate settled results into `BlockResult[]`. Mark lane as `failed` if any block failed (strict) or collect partial (lenient). Emit `execution:block-error` for each failed block.

### T13: Add abort propagation to WorkflowExecutor

- [x] Estimate: 1hr
- [x] Tests: Unit tests — `abort()` cancels in-flight blocks within ~1s; all containers transition to `terminated` after abort; `execution:aborted` IPC is emitted
- [x] Dependencies: T12
- [x] Notes: `WorkflowExecutor.abort()` sets `isAborted = true` and signals the internal `AbortController`. After all `Promise.allSettled` settle (with failures from abort), call `pool.teardown()`. Emit `execution:aborted` IPC event. Ensure no dangling containers remain after abort (verified in unit test via `pool.snapshot()`).

---

## Phase 6: IPC Events to Renderer

### T14: Register IPC channels for pool status and lane events

- [x] Estimate: 1hr
- [x] Tests: Integration test (with mocked pool) — state transitions cause `CONTAINER_POOL_STATUS` to be sent to renderer; `execution:lane-start` and `execution:lane-complete` are emitted at correct moments
- [x] Dependencies: T10, T11
- [x] Notes: In `apps/workflow-studio/src/main/ipc/execution-handlers.ts`, register `ipcMain.handle(IPC_CHANNELS.CONTAINER_POOL_STATUS, ...)` returning `pool.snapshot()`. Wire `ContainerPool` state-change callback to emit `mainWindow.webContents.send(IPC_CHANNELS.CONTAINER_POOL_STATUS, pool.snapshot())` on every transition. Add `execution:lane-start`, `execution:lane-complete`, `execution:block-error`, and `execution:aborted` channels. Use the committed `CONTAINER_POOL_STATUS` constant from `ipc-channels.ts`.

### T15: Implement ContainerPoolPanel React component

- [x] Estimate: 1.5hr
- [x] Tests: Renderer unit test (React Testing Library) — renders container rows with correct state badges; updates when `CONTAINER_POOL_STATUS` IPC fires; shows correct block ID for running containers
- [x] Dependencies: T14
- [x] Notes: Create `apps/workflow-studio/src/renderer/components/monitoring/ContainerPoolPanel.tsx`. Subscribe to `CONTAINER_POOL_STATUS` IPC channel via `window.electronAPI.onPoolStatus(...)` (or `ipcRenderer.on`). Render table: short container ID, state badge (colour-coded per state), assigned block ID (if running), port, elapsed time in current state. Integrate into the existing Monitoring tab. Use existing design system components — no new UI library.

### T16: Add `usePoolStatus` renderer hook

- [x] Estimate: 45min
- [x] Tests: Unit test — hook initialises with empty array; updates on IPC event; cleans up listener on unmount
- [x] Dependencies: T15
- [x] Notes: Create `apps/workflow-studio/src/renderer/hooks/usePoolStatus.ts`. Custom React hook that subscribes to `CONTAINER_POOL_STATUS` IPC events, stores `ContainerRecord[]` in `useState`, and removes the listener in the `useEffect` cleanup. Used by `ContainerPoolPanel`.

---

## Phase 7: Integration Tests

### T17: Unit tests — ContainerPool state machine completeness

- [x] Estimate: 1hr
- [x] Tests: All valid state transitions covered; all invalid transitions assert `throw`; edge cases: prewarm when `maxContainers` is 1, acquire when all containers are dormant
- [x] Dependencies: T10
- [x] Notes: `apps/workflow-studio/test/main/container-pool.test.ts`. Use `jest.fn()` mocks for `DockerClient`. Parameterise valid/invalid transition cases. Confirm `snapshot()` reflects state accurately throughout.

### T18: Unit tests — WorkflowExecutor edge cases

- [x] Estimate: 1hr
- [x] Tests: Empty plan (no lanes), plan with all sequential lanes (no parallelism), plan with max-width parallel lane equal to `maxContainers`, abort before any block starts
- [x] Dependencies: T13
- [x] Notes: `apps/workflow-studio/test/main/workflow-executor.test.ts`. Mock `ContainerPool` and `ExecutionEngine`. Cover all `failureMode` combinations (strict/lenient) with single failure and multiple failures.

### T19: Unit tests — PortAllocator exhaustion and concurrent allocation

- [x] Estimate: 30min
- [x] Tests: Allocate full range, assert `PortExhaustedError`; release one, allocate again succeeds; rapid sequential allocation never duplicates
- [x] Dependencies: T05
- [x] Notes: `apps/workflow-studio/test/main/port-allocator.test.ts`. Verify that `allocate()` is deterministic for sequential calls in the Node.js event loop.

### T20: Integration test — full parallel workflow with mocked dockerode

- [x] Estimate: 1.5hr
- [x] Tests: End-to-end with mocked `dockerode` — plan: sequential -> parallel(3) -> sequential. Assert: prewarm called with 3; all 3 parallel blocks run concurrently; fan-in produces correct merged results; all containers DORMANT after lane; `teardown()` terminates all.
- [x] Dependencies: T13, T14
- [x] Notes: `apps/workflow-studio/test/main/workflow-executor.integration.test.ts`. Mock `dockerode` at module level with `jest.mock`. Construct real `ContainerPool` and `WorkflowExecutor` instances (not mocked). Assert IPC emission order matches expected sequence.

### T21: Integration test — abort during parallel execution

- [x] Estimate: 1hr
- [x] Tests: 3 parallel blocks in flight; `abort()` called after 100ms; all blocks fail with abort error; pool snapshot shows 0 non-terminated containers
- [x] Dependencies: T20
- [x] Notes: Extend `workflow-executor.integration.test.ts`. Use fake timers to control abort timing. Verify `execution:aborted` IPC is emitted. Verify no port leaks (all ports returned to allocator).

### T22: Documentation, JSDoc, and error message review

- [x] Estimate: 30min
- [x] Tests: N/A (documentation and review)
- [x] Dependencies: T21
- [x] Notes: Add JSDoc to all public methods of `ContainerPool`, `WorkflowExecutor`, `PortAllocator`, and `DockerClient`. Verify all `ValidationError` messages are human-readable (e.g., `"parallelismModel must be 'multi-container' or 'single-container', got: 'invalid'"`). Update `apps/workflow-studio/README.md` with container pool configuration options (image, port range, dormancy timeout, max containers).

---

## Phase 8: Design Review Findings (Critical Additions)

### T23: Wire `pool.teardown()` to app shutdown hooks

- [x] Estimate: 1hr
- [x] Tests: Unit test — `before-quit` triggers teardown; all containers terminated; SIGTERM and SIGINT handlers fire teardown
- [x] Dependencies: T10
- [x] Priority: CRITICAL
- [x] Notes: Wire `pool.teardown()` to `app.on('before-quit')`, `process.on('SIGTERM')`, and `process.on('SIGINT')`. Ensures no orphan containers remain when the Electron app exits or is killed. Must `await` teardown before allowing app to close.

### T24: Startup orphan container cleanup

- [x] Estimate: 1hr
- [x] Tests: Unit test (mocked dockerode) — startup scan finds containers with `asdlc.managed=true` label; stops and removes them; no-op when no orphans exist
- [x] Dependencies: T04
- [x] Priority: CRITICAL
- [x] Notes: On app startup (before pool initialization), scan `docker.listContainers({ filters: { label: ['asdlc.managed=true'] } })` and stop/remove any found. Prevents stale containers from previous crashed sessions from consuming resources.

### T25: Add `ExtraHosts` to container creation for Linux support

- [x] Estimate: 30min
- [x] Tests: Unit test — `createContainer()` HostConfig includes `ExtraHosts: ['host.docker.internal:host-gateway']`
- [x] Dependencies: T04
- [x] Priority: CRITICAL
- [x] Notes: Add `ExtraHosts: ['host.docker.internal:host-gateway']` to the `createContainer()` HostConfig in `docker-client.ts`. Required for Linux Docker where `host.docker.internal` is not natively available. macOS/Windows Docker Desktop resolves this automatically, but the extra host entry is harmless on those platforms.

### T26: Implement basic `single-container` parallelism model

- [x] Estimate: 3hr
- [x] Tests: Unit tests — single container spawned with `sleep infinity`; `acquire()` returns same ContainerRecord for all blocks; concurrent `docker exec` calls execute in parallel
- [x] Dependencies: T06, T08
- [x] Priority: HIGH
- [x] Notes: Implement the `single-container` parallelism model. Container runs `sleep infinity`. `acquire()` returns the same `ContainerRecord` for all blocks. Each block runs `docker exec -it <container> claude <args>` concurrently via separate PTY instances. Pool size is always 1 for this model. Add `parallelismModel` check in `ContainerPool` constructor to select the behavior.

### T27: Implement `buildWorkflowPlan()` — convert parallelGroups to WorkflowPlan

- [x] Estimate: 1.5hr
- [x] Tests: Unit tests — converts `WorkflowDefinition.parallelGroups` (with `laneNodeIds`) into execution-time `WorkflowPlan.lanes`; sequential nodes become string lanes; parallel groups become `ParallelLane` entries
- [x] Dependencies: T02
- [x] Notes: Implement `buildWorkflowPlan(workflow: WorkflowDefinition): WorkflowPlan` that reads `workflow.parallelGroups[].laneNodeIds` and the transition graph to produce an ordered `WorkflowPlan` with correctly sequenced lanes. Must handle workflows with no parallel groups (all sequential).

### T28: Wire `ContainerPool.acquire()` into `ExecutionEngine.executeBlock()`

- [x] Estimate: 2hr
- [x] Tests: Integration test (mocked pool) — `executeBlock()` calls `pool.acquire(blockId)` before execution and `pool.release(containerId)` after; container URL used for remote execution
- [x] Dependencies: T08, T11
- [x] Notes: Modify `ExecutionEngine.executeBlock()` to accept a `ContainerPool` reference. Before executing a block, call `pool.acquire(blockId)` to get a container. Use `container.agentUrl` for remote execution. After block completes (success or failure), call `pool.release(container.id)`.

### T29: Per-block workspace isolation for parallel execution

- [x] Estimate: 3hr
- [x] Tests: Unit tests — each parallel block gets its own workspace copy; workspaces cleaned up after fan-in; git worktree or temp copy created per block
- [x] Dependencies: T12
- [x] Notes: When running parallel blocks that modify files, each block needs an isolated workspace to prevent conflicts. Options: (1) git worktree per block, (2) temp copy of workspace. Implement as a `WorkspaceIsolator` utility that creates/destroys per-block workspaces. Bind-mount the isolated workspace into each container.

### T30: Fix wake-then-spawn sequencing in `acquire()`

- [x] Estimate: 30min
- [x] Tests: Unit test — when wake fails, `acquire()` awaits `terminate(containerId)` before fallback `spawnContainer()`; no orphan containers from failed wakes
- [x] Dependencies: T09
- [x] Notes: Fix a race condition in `acquire()`: when waking a dormant container fails, the current code may call `spawnContainer()` before `terminate()` completes on the failed container. Fix: `acquire()` must `await terminate(containerId)` before the fallback `spawnContainer()` call.

### T31: Define merge strategies for parallel block outputs

- [x] Estimate: 1hr
- [x] Tests: Unit tests — `concatenate` strategy joins outputs; `workspace` strategy detects conflicts at fan-in; custom strategy invokes user-provided merge function
- [x] Dependencies: T12
- [x] Notes: Define merge strategies for collecting parallel block outputs at fan-in: `concatenate` (for reviews — join text outputs), `workspace` (for coding — detect file conflicts), `custom` (user-provided merge function). Add `mergeStrategy` field to `ParallelLane`. Implement `mergeResults(strategy, results[])` utility.

### T32: Parallel group dispatch via `Promise.allSettled` (moved from F01-T06)

- [x] Estimate: 2hr
- [x] Tests: Unit tests — parallel group nodes dispatched via `Promise.allSettled`; all results collected; strict mode aborts on first failure
- [x] Dependencies: T12
- [x] Notes: Originally F01-T06 — moved to F05 as it belongs to the parallel execution engine. When `WorkflowExecutor` encounters a `ParallelGroup`, dispatch all `laneNodeIds` via `Promise.allSettled`. This is the core fan-out mechanism. Integrates with `ContainerPool.acquire()` for container assignment.

### T33: Docker image pull progress reporting

- [x] Estimate: 1.5hr
- [x] Tests: Unit test — pull progress events forwarded to renderer via `container:pull-progress` IPC; progress includes layer count and percentage
- [x] Dependencies: T04, T14
- [x] Notes: When `DockerClient.pullImage()` is called, stream pull progress events from dockerode and forward them to the renderer via a `container:pull-progress` IPC event. Show progress in the ContainerPoolPanel UI. Useful for first-time image pulls which can take minutes.

### T34: Lazy pre-warming — defer warming closer to parallel lane

- [x] Estimate: 1hr
- [x] Tests: Unit test — pre-warming starts when execution reaches N-1 lane before parallel group, not at execution start
- [x] Dependencies: T07
- [x] Notes: Current pre-warming starts at execution start, which may waste resources for workflows with long sequential prefixes. Implement lazy pre-warming: analyze the plan and start warming when execution reaches the lane immediately before a parallel group. Reduces idle container time.

---

## Task Dependency Graph

```
T01 ──► T04 ──► T06 ──► T07 ──► T34
         |       |        |
T02 ──► T03 ──► T08 ──► T11 ──► T12 ──► T13 ──► T20 ──► T21 ──► T22
   |     |       |        |       |        |
   |  T05 ─────┘ T09 ──► T10     T14 ──► T15     T29 (per-block isolation)
   |               |       |       |               T31 (merge strategies)
   |               └───────┴──► T16               T32 (F01-T06 moved, fan-out)
   |                              |
   |                             T17 (parallel to implementation)
   |                             T18 (parallel to implementation)
   |                             T19 (parallel to implementation)
   |
   └──► T27 (buildWorkflowPlan)

Design Review Additions:
T10 ──► T23 (shutdown teardown, CRITICAL)
T04 ──► T24 (orphan cleanup, CRITICAL)
T04 ──► T25 (ExtraHosts, CRITICAL)
T06, T08 ──► T26 (single-container model)
T08, T11 ──► T28 (wire pool.acquire into executeBlock)
T09 ──► T30 (wake-then-spawn fix)
T04, T14 ──► T33 (pull progress reporting)
```

## Phase Summary

| Phase | Tasks | Estimated Total |
|-------|-------|----------------|
| 1: Data model and state machine | T01-T03 | ~2hr |
| 2: dockerode integration | T04-T05 | ~2hr |
| 3: Pre-warming algorithm | T06-T07 | ~2.75hr |
| 4: Dormancy and wake management | T08-T10 | ~4hr |
| 5: Fan-out / fan-in coordinator | T11-T13 | ~4.5hr |
| 6: IPC events to renderer | T14-T16 | ~3.25hr |
| 7: Integration tests | T17-T22 | ~5.5hr |
| 8: Design review findings | T23-T34 | ~17hr |
| **Total** | **34 tasks** | **~41hr** |
