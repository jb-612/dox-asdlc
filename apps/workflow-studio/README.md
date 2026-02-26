# Parallel Container Execution (P15-F05)

Workflow Studio can execute parallel groups of workflow blocks by running each block in its own Docker container. This document covers the architecture, configuration, execution modes, and renderer integration for that feature.

---

## Overview

When a workflow definition includes `parallelGroups`, the execution engine fans out the grouped blocks to separate containers rather than running them sequentially. Each container hosts an agent endpoint on a dynamically allocated host port. After a block finishes, its container is paused (dormant) instead of destroyed, so it can be reused for the next parallel run without the cost of a full restart.

Key components:

| Component | File | Responsibility |
|---|---|---|
| `ContainerPool` | `src/main/services/container-pool.ts` | Lifecycle management (spawn, acquire, release, terminate) |
| `PortAllocator` | `src/main/services/port-allocator.ts` | Sequential port assignment within a configured range |
| `DockerClient` | `src/main/services/docker-client.ts` | Thin async wrapper over dockerode |
| `WorkflowPlanBuilder` | `src/main/services/workflow-plan-builder.ts` | DAG topological sort and lane computation |
| `WorkflowExecutor` | `src/main/services/workflow-executor.ts` | Sequential / parallel lane dispatch |
| `WorkspaceIsolator` | `src/main/services/workspace-isolator.ts` | Per-block temp directory copies |
| `mergeResults` | `src/main/services/merge-strategies.ts` | Output aggregation after fan-in |
| `computePrewarmPoint` | `src/main/services/lazy-prewarm.ts` | Deferred pre-warming trigger point |
| IPC handlers | `src/main/ipc/parallel-handlers.ts` | Bridge between main process and renderer |

---

## Architecture

```
WorkflowDefinition
        |
        v
buildWorkflowPlan()          <- topological sort + group collapse
        |
        v
WorkflowPlan { lanes: (string | ParallelLane)[] }
        |
        v
WorkflowExecutor.execute()
    |                   |
    | string lane        | ParallelLane
    v                   v
sequential block     Promise.allSettled(blocks)
    |                   |
    +-------------------+
    v
ContainerPool.acquire(blockId)
    -> idle container (immediate)
    -> dormant container (unpause + health check)
    -> spawn new container (if under cap)
        |
        v
ExecutorEngine.executeBlock(blockId, container)
        |
        v
ContainerPool.release(containerId)   <- pause -> dormant
        |
        v
mergeResults(strategy, parallelResults)
```

Each container is tagged with `asdlc.managed=true`. On startup, `cleanupOrphans()` removes any leftover containers from a previous run.

---

## Configuration

### ContainerPool

`ContainerPoolOptions` is passed to the `ContainerPool` constructor.

| Option | Type | Default | Description |
|---|---|---|---|
| `image` | `string` | (required) | Docker image used for every spawned container (e.g. `node:20-alpine`). |
| `maxContainers` | `number` | (required) | Maximum number of non-terminated containers. Acquire throws when this cap is reached and no idle/dormant container exists. |
| `healthCheckIntervalMs` | `number` | (required) | Milliseconds between `/health` poll retries after a container starts or wakes. |
| `healthCheckTimeoutMs` | `number` | (required) | Total milliseconds to wait for a healthy response before giving up. |
| `dormancyTimeoutMs` | `number` | (required) | Milliseconds a dormant container is kept before automatic termination. Per-group override available via `ParallelGroup.dormancyTimeoutMs`. |
| `parallelismModel` | `'multi-container' \| 'single-container'` | `'multi-container'` | See Execution Modes below. |

### PortAllocator

`PortAllocatorOptions` is passed to the `PortAllocator` constructor.

| Option | Type | Default | Description |
|---|---|---|---|
| `start` | `number` | `49200` | First port in the allocatable range (inclusive). |
| `end` | `number` | `49300` | Last port in the allocatable range (inclusive). |

The allocator assigns ports sequentially and wraps around when the cursor reaches `end`. Ports are released back to the pool when a container is terminated. The range supports up to `end - start + 1` concurrent containers (101 with defaults).

### Per-Group Dormancy

`ParallelGroup.dormancyTimeoutMs` lets individual parallel groups override the pool-level dormancy timeout. Useful when different groups have different re-use patterns.

---

## Execution Modes

### Parallelism model

| Model | Behaviour |
|---|---|
| `multi-container` | One container per concurrent block. Each block gets exclusive access to its container. On release the container is paused (dormant). Default. |
| `single-container` | One shared container for all blocks. Blocks run via `docker exec` (entrypoint: `sleep infinity`). The acquire count is incremented per acquire; the container stays in `running` until all counts are released. |

### Failure mode

Set on `WorkflowPlan.failureMode`, produced by `buildWorkflowPlan`.

| Mode | Behaviour |
|---|---|
| `strict` | First failure in a parallel lane signals the internal `AbortController`. Other in-flight blocks detect the abort signal and bail out immediately after acquiring their container. Pool is torn down after settlement. |
| `lenient` | All blocks in the lane run to completion regardless of failures. Results for failed blocks are collected with `success: false`. |

`buildWorkflowPlan` always emits `failureMode: 'strict'` today. Override on the returned plan object before passing to the executor when lenient behaviour is needed.

---

## Merge Strategies

After a parallel lane settles, `mergeResults(strategy, results, customFn?)` combines the `ParallelBlockResult[]` from all blocks.

| Strategy | Output type | Behaviour |
|---|---|---|
| `concatenate` | `unknown[]` | Collects `result.output` for every block into a flat array. Falls back to this when an unknown strategy string is supplied. |
| `workspace` | `{ files: string[], conflicts: string[] }` | Expects each block output to contain a `filesChanged: string[]` field. Returns the union of all changed files and flags paths that appear in more than one block as conflicts. |
| `custom` | `unknown` | Calls the provided `customFn(results)`. If no function is supplied, returns the raw `ParallelBlockResult[]` as a pass-through. |

---

## Container Lifecycle States

```
          +-----------+
          |  starting |  (container created, health check pending)
          +-----+-----+
                |
                v
           +----+----+
      +--->|  idle   |<---+  (healthy, available for acquisition)
      |    +----+----+    |
      |         |         |  wake (unpause + health check)
      |    acquire        |
      |         |         |
      |         v         |
      |    +----+----+    |
      |    | running |    |  (assigned to a block)
      |    +----+----+    |
      |         |         |
      |       release     |
      |         |         |
      |         v         |
      |    +----+----+    |
      +----| dormant +----+  (paused, dormancy timer running)
           +----+----+
                |
          terminate / timeout
                |
                v
          +-----+-----+
          | terminated |  (stopped, removed, port released)
          +-----------+
```

Valid transitions (enforced by `assertTransition`):

| From | To |
|---|---|
| `starting` | `idle`, `terminated` |
| `idle` | `running`, `terminated` |
| `running` | `dormant`, `terminated` |
| `dormant` | `idle` (wake), `terminated` |
| `terminated` | `terminated` (no-op) |

Any invalid transition throws immediately.

---

## Workflow Plan Building

`buildWorkflowPlan(workflow)` converts a `WorkflowDefinition` into a `WorkflowPlan`:

1. Builds an adjacency list from `workflow.transitions`.
2. Runs Kahn's algorithm for a stable topological sort respecting node definition order.
3. Walks the sorted list and collapses any nodes that appear in `workflow.parallelGroups[].laneNodeIds` into a single `ParallelLane` entry.
4. Nodes not in any group become sequential `string` lanes.

The resulting `WorkflowPlan.lanes` is an ordered mix of `string` (sequential block ID) and `ParallelLane` (`{ nodeIds: string[] }`) entries.

---

## Pre-warming Strategy

`computePrewarmPoint(plan)` returns the lane index at which the pool should start pre-warming.

- Returns the index of the lane **immediately before** the first `ParallelLane`.
- Returns `-1` when the first lane is already parallel (pre-warm at execution start) or when there are no parallel lanes at all.

`getFirstParallelWidth(plan)` returns the `nodeIds.length` of the first parallel lane, which is the number of containers to pre-warm.

The intent is to avoid spinning up containers until the workflow is about to need them. Sequential blocks at the front of a plan complete while containers are warming in the background, so parallel execution starts with no cold-start delay.

---

## IPC Channels

The main process registers these channels via `registerParallelHandlers(pool)`.

### Invoke (renderer -> main)

| Channel | Argument | Return | Description |
|---|---|---|---|
| `container:pool-status` | none | `ContainerRecord[]` | Returns a snapshot of all containers in the pool. |
| `container:pool-start` | `{ count: number }` | `{ success: boolean, error?: string }` | Pre-warms `count` containers (capped by `maxContainers`). |
| `container:pool-stop` | none | `{ success: boolean, error?: string }` | Tears down all non-terminated containers. |

### Push (main -> renderer)

These are sent automatically; the renderer listens with `ipcRenderer.on`.

| Channel | Payload | Trigger |
|---|---|---|
| `container:pool-status` | `ContainerRecord[]` | Any container state transition. |
| `container:pull-progress` | `PullProgress` | Incremental Docker image pull progress. |
| `execution:lane-start` | `{ blockId?, nodeIds?, type }` | A lane (sequential or parallel) begins execution. |
| `execution:lane-complete` | `{ blockId?, nodeIds?, type, resultCount? }` | A lane finishes. |
| `execution:block-error` | `{ blockId, error }` | A block within a lane fails. |
| `execution:aborted` | `{ timestamp }` | The executor was aborted and the pool torn down. |

The renderer hook `usePoolStatus` (`src/renderer/hooks/usePoolStatus.ts`) subscribes to `container:pool-status` and exposes live pool state to components.

---

## Workspace Isolation

For parallel blocks that read or write files, `WorkspaceIsolator` prevents concurrent access conflicts:

- `isolate(workspacePath, blockId)` creates a temp directory at `os.tmpdir()/asdlc-workspace-<blockId>-<timestamp>` and copies the source workspace into it recursively. Returns the isolated path.
- `cleanup(isolatedPath)` removes the temp directory. Refuses to delete paths outside `os.tmpdir()` as a safety guard.

The executor is responsible for calling `isolate` before `executeBlock` and `cleanup` after `release`.

---

## Orphan Cleanup

On application start, call `pool.cleanupOrphans()` before any prewarm. It lists all containers with the `asdlc.managed=true` label and attempts to stop and remove them. Errors per container are swallowed so a stuck orphan does not block startup.

All containers created by the pool carry this label via `DockerClient.createContainer`, which injects it unconditionally.
