---
id: P15-F09
parent_id: P15
type: design
version: 1
status: approved
created_by: planner
created_at: "2026-02-26T00:00:00Z"
updated_at: "2026-02-28T00:00:00Z"
dependencies:
  - P15-F05
  - P15-F07
  - P15-F08
tags:
  - docker
  - container-pool
  - integration
  - phase-2
  - parallel-execution
---

# Design: Container Pool Integration (P15-F09)

## Overview

Phase 1 (P15-F05) built and individually tested all container pool components: `ContainerPool`,
`WorkflowExecutor`, `registerParallelHandlers()`, `WorkspaceIsolator`, `mergeResults()`, and
`container-pool-shutdown`. None are wired into the running Electron app. The app uses
single-block sequential execution via `CLISpawner` through `ExecutionEngine`.

Phase 2 connects all Phase 1 components into the live application, adds configuration surfaces,
and creates merge-conflict resolution UI for fully functional parallel block execution.

## Goals

1. Wire pool at startup in `main/index.ts` after Docker availability check
2. Route multi-block workflows from `ExecutionEngine` to `WorkflowExecutor`
3. Add `containerImage` and `dormancyTimeoutMs` to `AppSettings`
4. Define `EXECUTION_MERGE_CONFLICT` IPC channel with user-facing resolution modal
5. Forward telemetry env vars from `TelemetryReceiver` into pool containers
6. E2E test: multi-block workflow -> parallel containers -> merge -> result

## Architecture

```
Electron Main Process (main/index.ts)
+----------------------------------------------------------------------+
|  app.whenReady()                                                     |
|    +-> checkDockerAvailable()                                        |
|    |     +-> YES: ContainerPool + registerParallelHandlers           |
|    |     |        + setContainerPoolTeardown                         |
|    |     +-> NO:  Log warning, skip pool init                        |
|    |                                                                  |
|    +-> ExecutionEngine (receives pool reference)                     |
|         +-> start(workflow)                                          |
|              +-> Has parallelGroups?                                 |
|              |     YES -> buildWorkflowPlan -> WorkflowExecutor      |
|              |            -> fan-out/fan-in -> mergeResults           |
|              |            -> conflicts? -> IPC to renderer            |
|              |     NO  -> Sequential traversal (existing)            |
|              +-> ContainerPool                                       |
|                   +-> DockerClient -> Docker Engine                  |
|                   +-> PortAllocator                                  |
|                   +-> onStateChange -> IPC -> Renderer               |
+----------------------------------------------------------------------+

Renderer Process
+----------------------------------------------------------------------+
|  ExecutionPage                                                       |
|    +-> Execution walkthrough (existing)                              |
|    +-> ContainerPoolPanel (existing, now live data)                  |
|    +-> MergeConflictDialog (NEW)                                     |
|  SettingsPage                                                        |
|    +-> Environment section                                           |
|         +-> Container Image input (NEW)                              |
|         +-> Dormancy Timeout input (NEW)                             |
+----------------------------------------------------------------------+
```

## Technical Approach

### 1. App Startup Wiring

The existing `main/index.ts` has a Phase 2 comment at lines 214-217 and
`setContainerPoolTeardown()` ready. Startup sequence becomes:

```
app.whenReady()
  -> Load settings
  -> Create BrowserWindow
  -> Register all IPC handlers (existing)
  -> Check Docker availability (docker version --format json)
  -> If Docker available:
       -> Create DockerClient(settings.dockerSocketPath)
       -> Create PortAllocator
       -> Create ContainerPool(docker, ports, poolOptions)
       -> pool.cleanupOrphans()
       -> registerParallelHandlers(pool)
       -> setContainerPoolTeardown(() => pool.teardown())
  -> Start TelemetryReceiver
```

Pool options from AppSettings:

```typescript
const poolOptions: ContainerPoolOptions = {
  image: settings.containerImage ?? 'asdlc-agent:1.0.0',
  maxContainers: 10,
  healthCheckIntervalMs: 500,
  healthCheckTimeoutMs: 30_000,
  dormancyTimeoutMs: settings.dormancyTimeoutMs ?? 300_000,
};
```

If Docker unavailable, pool is null. Workflows with `parallelGroups` show error message.

### 2. ExecutionEngine Multi-Block Detection

Current `ExecutionEngine.start()` walks the DAG sequentially. Add branch:

```
start(workflow, workItem)
  -> Topological sort (existing)
  -> workflow.parallelGroups?.length > 0 AND pool !== null?
       YES -> buildWorkflowPlan(workflow)
              -> WorkflowExecutor.execute(plan)
              -> map results back to nodeStates
       NO  -> Sequential traversal (existing)
```

Adapter pattern: `ExecutorEngineAdapter` bridges `WorkflowExecutor.executeBlock()` to
the execution engine's dispatch logic. Since `executeNodeReal()` and `executeNodeMock()` are
private, the adapter re-implements the dispatch (backend routing + CLI spawn) using the same
`CLISpawner` and `buildSystemPrompt()` (which is public). This avoids exposing internal methods.

### 3. Settings Additions

New fields in `AppSettings`:

```typescript
/** Docker image for container pool (default: asdlc-agent:1.0.0) */
containerImage?: string;
/** Dormancy timeout in ms before idle containers are terminated (default: 300000) */
dormancyTimeoutMs?: number;
```

Settings UI: text input for container image (validated against Docker reference pattern),
numeric input for dormancy timeout in seconds (converted to/from ms).

### 4. Merge Conflict Resolution

New IPC channel:

```typescript
EXECUTION_MERGE_CONFLICT: 'execution:merge-conflict',
```

Flow:
1. `WorkflowExecutor` fan-in calls `mergeResults('workspace', results)`
2. If `conflicts.length > 0`, emit `EXECUTION_MERGE_CONFLICT` to renderer
3. Execution pauses (gate pattern, same as HITL gates)
4. Renderer shows `MergeConflictDialog` with per-file resolution options
5. User resolves: "Keep Block A", "Keep Block B", or "Abort"
6. Resolution sent back via `ipcMain.handle(EXECUTION_MERGE_CONFLICT)`
7. Execution resumes with resolved file set

### 5. Telemetry Forwarding

`ContainerPool.spawnContainer()` currently hardcodes telemetry env vars (lines 352-354).
Refactor to accept telemetry config via constructor options:

```typescript
interface ContainerPoolOptions {
  // ... existing
  telemetryEnabled?: boolean;
  telemetryUrl?: string;
}
```

**Note**: `spawnContainer()` already sets `TELEMETRY_ENABLED=1` and
`TELEMETRY_URL=http://host.docker.internal:9292/telemetry` as hardcoded values.
This task replaces those hardcoded values with configurable ones from options.

Read `telemetryReceiverPort` from AppSettings. If TelemetryReceiver is running, pass
`TELEMETRY_ENABLED=1` and `TELEMETRY_URL=http://host.docker.internal:{port}/telemetry`.

## ADRs

### Image Versioning

**Decision**: User-configurable with pinned tag default (`asdlc-agent:1.0.0`).
**Rationale**: `latest` risks silent regressions. Pinned tag is safe. Users can override.

### Conflict Resolution

**Decision**: User-presented modal. Never silent last-write-wins.
**Rationale**: Matches constraint "must be presented to user, not silently resolved."

## Modified Files

```
src/main/index.ts                              # Wire pool at startup
src/main/services/execution-engine.ts          # Parallel detection + delegation
src/main/services/container-pool.ts            # Accept telemetry config
src/main/ipc/execution-handlers.ts             # Pass pool to engine, merge conflict
src/shared/ipc-channels.ts                     # EXECUTION_MERGE_CONFLICT
src/shared/types/settings.ts                   # containerImage, dormancyTimeoutMs
src/renderer/components/settings/              # Container image + dormancy inputs
src/renderer/stores/executionStore.ts          # Merge conflict state
```

## New Files

```
src/main/services/docker-utils.ts              # checkDockerAvailable()
src/main/services/executor-engine-adapter.ts   # WorkflowExecutor <-> ExecutionEngine bridge
src/renderer/components/execution/MergeConflictDialog.tsx
test/main/docker-utils.test.ts
test/main/executor-engine-adapter.test.ts
test/main/pool-integration.test.ts
test/renderer/components/execution/MergeConflictDialog.test.tsx
test/e2e/parallel-execution.spec.ts
```

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Docker unavailable on user machine | Medium | Graceful degradation, error message |
| Pool init slows app startup | Low | Async init after window, orphan cleanup fast |
| Merge conflict modal blocks indefinitely | Low | Timeout with auto-abort |
| Container image not pre-pulled | Medium | pullImageWithProgress, progress in UI |
| Race: pool init vs first execution request | Low | Guard: pool null -> error for parallel |
