---
id: P15-F09
parent_id: P15
type: tasks
version: 1
status: complete
created_by: planner
created_at: "2026-02-26T00:00:00Z"
updated_at: "2026-02-26T00:00:00Z"
estimated_hours: 24
---

# Tasks: Container Pool Integration (P15-F09)

## Dependency Graph

```
Phase 1 (Settings + Docker utils)
  T01, T02, T03 (parallel)
         |
Phase 2 (Startup wiring)
  T04 -> T05 -> T06
         |
Phase 3 (Engine routing)
  T07 -> T08 -> T09
         |
Phase 4 (Merge conflict UI)
  T10 -> T11 -> T12 -> T13
         |
Phase 5 (Telemetry + E2E)
  T14 -> T15 -> T16
```

## Phase 1: Settings + Docker Utils (T01-T03)

### T01: Add containerImage and dormancyTimeoutMs to AppSettings

- [x] Estimate: 1hr
- [x] Notes:
  - Add `containerImage?: string` to `AppSettings` in `shared/types/settings.ts`
  - Add `dormancyTimeoutMs?: number` to `AppSettings`
  - Update `DEFAULT_SETTINGS`: `containerImage: 'asdlc-agent:1.0.0'`, `dormancyTimeoutMs: 300000`
  - Update `settings.test.ts` to verify new defaults
  - Dependencies: none

### T02: Create docker-utils.ts with checkDockerAvailable()

- [x] Estimate: 1hr
- [x] Notes:
  - Create `src/main/services/docker-utils.ts`
  - `checkDockerAvailable(): Promise<boolean>` — runs `docker version` with 5s timeout
  - Returns false on error, does not throw
  - RED: write `test/main/docker-utils.test.ts` first (mock child_process)
  - GREEN: implement
  - Dependencies: none

### T03: Add container settings UI inputs

- [x] Estimate: 1.5hr
- [x] Notes:
  - Add "Container Image" text input to Settings > Environment section
  - Add "Dormancy Timeout (seconds)" numeric input
  - Validate image reference pattern: `[registry/]name[:tag][@digest]`
  - Convert seconds <-> milliseconds for dormancyTimeoutMs
  - RED: test in SettingsComponents.test.tsx
  - Dependencies: T01

## Phase 2: Startup Wiring (T04-T06)

### T04: Wire ContainerPool instantiation in index.ts

- [x] Estimate: 2hr
- [x] Notes:
  - After existing IPC registration (line 211), add Docker check
  - If `checkDockerAvailable()` returns true:
    - Create `DockerClient` from `dockerode` using `settings.dockerSocketPath`
    - Create `PortAllocator`
    - Create `ContainerPool(docker, ports, poolOptions)` with settings values
    - Call `pool.cleanupOrphans()`
    - Call `registerParallelHandlers(pool)`
    - Call `setContainerPoolTeardown(() => pool.teardown())`
  - Store pool reference in module-level variable for ExecutionEngine access
  - Log warning if Docker unavailable
  - Dependencies: T01, T02

### T05: Create ExecutorEngineAdapter

- [x] Estimate: 2.5hr
- [x] Notes:
  - Create `src/main/services/executor-engine-adapter.ts`
  - Bridges `WorkflowExecutor.executeBlock()` to execution dispatch
  - NOTE: `executeNodeReal()` and `executeNodeMock()` are private on ExecutionEngine.
    Adapter re-implements dispatch using same CLISpawner and public `buildSystemPrompt()`.
  - Adapter reads `executionMockMode` from settings to choose dispatch
  - RED: write `test/main/executor-engine-adapter.test.ts` first
  - GREEN: implement adapter
  - Dependencies: T04

### T06: Write pool startup integration test

- [x] Estimate: 1.5hr
- [x] Notes:
  - Create `test/main/pool-integration.test.ts`
  - Test: pool created when Docker available
  - Test: pool null when Docker unavailable
  - Test: registerParallelHandlers called with pool
  - Test: setContainerPoolTeardown called
  - Mock dockerode and child_process
  - Dependencies: T04, T05

## Phase 3: ExecutionEngine Routing (T07-T09)

### T07: Add parallel detection to ExecutionEngine.start()

- [x] Estimate: 2hr
- [x] Notes:
  - In `execution-engine.ts`, check `workflow.parallelGroups?.length > 0`
  - If true AND pool is available, call new `startParallel()` method
  - If true AND pool is null, emit error event: "Docker required for parallel execution"
  - If false, continue existing sequential path
  - RED: write tests for detection logic
  - Dependencies: T05

### T08: Implement startParallel() with WorkflowExecutor delegation

- [x] Estimate: 2hr
- [x] Notes:
  - `startParallel()` calls `buildWorkflowPlan(workflow)` to derive WorkflowPlan
  - Creates `WorkflowExecutor` with pool and `ExecutorEngineAdapter`
  - Runs `executor.execute(plan)`
  - Maps `ParallelBlockResult[]` back to `nodeStates` for UI rendering
  - Emits standard execution events (block_start, block_complete) via IPC
  - RED: test with mock pool and mock executor
  - Dependencies: T07

### T09: Test parallel routing end-to-end with mock pool

- [x] Estimate: 1.5hr
- [x] Notes:
  - Integration test: workflow with parallelGroups -> WorkflowExecutor called
  - Integration test: workflow without parallelGroups -> sequential path
  - Integration test: parallelGroups but no pool -> error event
  - Use mock ContainerPool, mock DockerClient
  - Dependencies: T07, T08

## Phase 4: Merge Conflict UI (T10-T13)

### T10: Add EXECUTION_MERGE_CONFLICT IPC channel

- [x] Estimate: 0.5hr
- [x] Notes:
  - Add to `shared/ipc-channels.ts`: `EXECUTION_MERGE_CONFLICT: 'execution:merge-conflict'`
  - Add TypeScript types for conflict payload: `MergeConflict { filePath, blockAId, blockBId }`
  - Add resolution type: `MergeResolution { filePath, keepBlockId | 'abort' }`
  - Dependencies: none

### T11: Create MergeConflictDialog component

- [x] Estimate: 2hr
- [x] Notes:
  - Create `src/renderer/components/execution/MergeConflictDialog.tsx`
  - Props: `conflicts: MergeConflict[]`, `onResolve: (resolutions: MergeResolution[]) => void`
  - Shows list of conflicting files with block labels
  - Per-file radio: "Keep Block A" / "Keep Block B"
  - Global actions: "Resolve All" / "Abort Execution"
  - Use ConfirmDialog pattern from shared components
  - RED: write `test/renderer/components/execution/MergeConflictDialog.test.tsx` first
  - Dependencies: T10

### T12: Add merge conflict state to executionStore

- [x] Estimate: 1hr
- [x] Notes:
  - Add `mergeConflicts: MergeConflict[] | null` to executionStore
  - Add `setMergeConflicts()` and `resolveMergeConflicts()` actions
  - Listen for `EXECUTION_MERGE_CONFLICT` IPC in ExecutionPage
  - When conflicts received, pause UI and show MergeConflictDialog
  - On resolution, send back via IPC and clear state
  - RED: test store actions
  - Dependencies: T10, T11

### T13: Wire merge conflict into WorkflowExecutor fan-in

- [x] Estimate: 2hr
- [x] Notes:
  - Call site: Add `mergeResults()` call inside `WorkflowExecutor.execute()` after the
    lane loop completes (post-fan-in). Currently `execute()` returns `ParallelBlockResult[]`
    directly with no merge step — add merge step before return.
  - In `execution-handlers.ts`, register `ipcMain.handle(EXECUTION_MERGE_CONFLICT)`
  - When `mergeResults()` returns conflicts, send to renderer via IPC
  - Wait for resolution response (Promise-based gate)
  - Apply resolution to merged file set
  - Test: conflict detected -> IPC sent -> resolution received -> execution resumes
  - Dependencies: T08, T12

## Phase 5: Telemetry + E2E (T14-T16)

### T14: Forward telemetry env vars to pool containers

- [x] Estimate: 1.5hr
- [x] Notes:
  - Add `telemetryEnabled?: boolean` and `telemetryUrl?: string` to `ContainerPoolOptions`
  - NOTE: `spawnContainer()` at container-pool.ts lines 352-354 already hardcodes
    `TELEMETRY_ENABLED=1` and `TELEMETRY_URL=http://host.docker.internal:9292/telemetry`.
    This task refactors those hardcoded values to read from `ContainerPoolOptions`.
  - Read `telemetryReceiverPort` from settings, construct URL with `host.docker.internal`
  - If TelemetryReceiver not running, set `TELEMETRY_ENABLED=0`
  - RED: test env vars in spawned container config
  - Dependencies: T04

### T15: Verify container settings round-trip persistence

- [x] Estimate: 0.5hr
- [x] Notes:
  - This is a verification task (T03 handles the UI implementation)
  - Verify round-trip: change setting -> save -> reload -> value persists
  - Verify pool picks up new settings on next execution (no restart)
  - Dependencies: T03

### T16: E2E test: parallel workflow execution

- [x] Estimate: 2hr
- [x] Notes:
  - Create `test/e2e/parallel-execution.spec.ts`
  - Scenario: load workflow with 2 parallel blocks -> start execution
  - Verify ContainerPoolPanel shows containers
  - Verify execution completes with merged output
  - Mock dockerode (no real Docker in CI)
  - Dependencies: T09, T13

## Summary

| Phase | Tasks | Est. Hours |
|-------|-------|-----------|
| Phase 1: Settings + Docker utils | T01-T03 | 3.5hr |
| Phase 2: Startup wiring | T04-T06 | 6hr |
| Phase 3: Engine routing | T07-T09 | 5.5hr |
| Phase 4: Merge conflict UI | T10-T13 | 5.5hr |
| Phase 5: Telemetry + E2E | T14-T16 | 4hr |
| **Total** | **16 tasks** | **24.5hr** |
