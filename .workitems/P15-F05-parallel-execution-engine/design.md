---
id: P15-F05
parent_id: P15
type: design
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

# Design: Parallel Execution Engine + Docker Lifecycle (P15-F05)

## Overview

This feature introduces parallel block execution and Docker container lifecycle management for the
Workflow Studio execution engine. When a workflow contains parallel tracks (fan-out lanes), multiple
agent containers run simultaneously. The Execution Coordinator (in the Electron main process) manages
a container pool — pre-warming containers before they are needed, assigning them to blocks at runtime,
and transitioning finished containers to a dormant state rather than terminating them, so re-use
avoids cold-start latency.

## Goals

1. Fan-out: start all blocks in a parallel lane simultaneously.
2. Fan-in: wait for all blocks in a lane to complete before advancing the DAG.
3. Pre-warming: start containers before they are needed so no block hangs on cold-start.
4. Dormancy: keep finished containers alive but paused; wake on re-use; terminate after idle timeout.
5. Configurable parallelism model per template (single-container multi-process vs. multi-container).

## Parallelism Models

Configured per workflow template via `template.parallelismModel`:

| Model | Value | Description |
|-------|-------|-------------|
| Multi-container | `"multi-container"` (default) | One Docker container per parallel block — stronger isolation |
| Single-container | `"single-container"` | N `claude` CLI processes inside one container — lower overhead |

For MVP, `"multi-container"` is the primary model. The `"single-container"` model is also implemented
(see Single-Container Model section below).

### Single-Container Model

When `parallelismModel` is `"single-container"`:

1. A single Docker container is spawned with `Cmd: ['sleep', 'infinity']`.
2. `ContainerPool` size is always 1 for this model.
3. `acquire()` returns the **same** `ContainerRecord` for all blocks (no new containers spawned).
4. Each block runs concurrently via `docker exec -it <container> claude <args>` — separate PTY
   instances within the same container.
5. Lower overhead than multi-container (no per-block image pull / container create) but weaker
   isolation (blocks share filesystem and process namespace).

This model is suitable for workflows where blocks don't modify conflicting files and where
container startup overhead is unacceptable.

## Container Pool

### Data Structure

The container pool is an in-memory map keyed by container ID:

```typescript
interface ContainerRecord {
  id: string;                    // Docker container ID (short form)
  state: ContainerState;         // 'starting' | 'idle' | 'running' | 'dormant' | 'terminated'
  blockId?: string;              // assigned block (when running)
  agentUrl: string;              // http://localhost:<port>
  port: number;                  // host port (ephemeral, allocated by allocatePort())
  createdAt: number;             // Date.now()
  dormantSince?: number;         // Date.now() when dormancy started
  dormancyTimer?: NodeJS.Timeout;
}

type ContainerState = 'starting' | 'idle' | 'running' | 'dormant' | 'terminated';

type ContainerPool = Map<string, ContainerRecord>;
```

### Container States

```
         prewarm()
            |
            v
        STARTING ──── docker.pull / docker.create / docker.start
            |
            v (container healthy)
           IDLE <──────────────────────────────────────────┐
            |                                              |
      assign(blockId)                                wake()
            |                                              |
            v                                              |
         RUNNING ──── block executing (executeNodeRemote)  |
            |                                              |
      blockComplete()                                      |
            |                                              |
            v                                              |
         DORMANT ─── docker.pause(); dormancyTimer starts ─┘
            |
     timer expires (dormancyTimeoutMs)
            |
            v
        TERMINATED ── docker.stop(); docker.remove()
```

Transitions:
- `STARTING -> IDLE`: container reports `/health` OK
- `IDLE -> RUNNING`: `assign(blockId)` called by fan-out
- `RUNNING -> DORMANT`: block completes (success or failure)
- `DORMANT -> RUNNING`: `wake(blockId)` called (re-use)
- `DORMANT -> TERMINATED`: dormancy timer expires

## Pre-Warming Algorithm

Pre-warming reduces perceived cold-start time by starting containers before they are needed.

### Steps

1. At workflow launch: parse the workflow DAG and count the maximum number of parallel lanes across any single parallel block.
2. Compute warm count: `warmCount = min(maxParallelLanes, poolConfig.maxContainers)`. Start warming that many containers immediately.
3. After template load: re-run the analysis for the newly loaded template. If `warmCount` exceeds the current ready count, start the difference.
4. After lane completion: if `readyCount < poolConfig.minReady`, start a replacement container in the background.
5. Backpressure: if `totalContainers >= poolConfig.maxContainers`, skip warming until a slot frees up.

### Algorithm (pseudocode)

```
function ensurePrewarmed(plan: WorkflowPlan) {
  const needed = computeMaxParallelLanes(plan)
  const currentIdle = pool.countByState('idle')
  const gap = needed - currentIdle
  for (let i = 0; i < gap; i++) {
    if (pool.total() < options.maxContainers) {
      spawnAndWarm()
    }
  }
}

function computeMaxParallelLanes(plan: WorkflowPlan): number {
  return max(plan.lanes.map(lane =>
    typeof lane === 'string' ? 1 : lane.blocks.length
  ))
}
```

Pre-warming is initiated immediately when `execution:start` IPC is received, before the first block runs.

## Dormancy

### Idle Detection and Mechanism

When a block completes, `release(containerId)` is called:

1. Transition container state to `dormant`.
2. Record `dormantSince = Date.now()`.
3. Issue `docker.pause()` — freezes all processes in the container's cgroup, preserving memory but consuming no CPU.
4. Start dormancy timer (`dormancyTimeoutMs`).
5. Emit `container:state-change` IPC event to renderer.

`docker pause` is preferred over `docker stop` because it preserves in-memory state and allows fast wake-up.

### Wake Protocol

When the engine needs a dormant container:

1. Clear dormancy timer.
2. Issue `docker.unpause()`.
3. Poll `/health` up to `healthCheckTimeoutMs` (fast path: typically < 1s for paused containers).
4. On success: transition to `idle`, then immediately to `running` if assigned to a block.
5. On failure: transition to `terminated`; fall back to warming a new container.

### Termination

When dormancy timer expires:
1. Issue `docker.stop()` then `docker.remove()`.
2. Transition state to `terminated`.
3. Return the allocated port to the free pool.
4. Emit `container:state-change` IPC event.

`acquire()` preference order: `idle` -> `dormant` (wake) -> create new (if under `maxContainers`).

## Fan-Out / Fan-In

### Fan-Out

When the execution engine reaches a `ParallelLane` node:

1. Resolve `lane.blocks` (array of `blockId` strings).
2. Request one container per block from the pool (may wake dormant or start new).
3. Assign each block a container record.
4. Emit `execution:lane-start` IPC event with `{ lane, blockIds }`.
5. Start all block executions simultaneously via `Promise.allSettled`.

### Fan-In

When all block promises settle:

1. Collect results (fulfilled or rejected).
2. Emit `execution:lane-complete` IPC event with `{ lane, results }`.
3. Return all lane containers to `dormant` state via `release()`.
4. If any block failed and `template.failureMode === 'strict'`: mark the entire lane as failed and propagate.
5. Continue workflow DAG with the merged lane output.

### Error Handling in Parallel Lanes

| Strategy | Behavior |
|----------|----------|
| `strict` | First lane failure cancels remaining lanes via `AbortController`; workflow halts |
| `lenient` | All lanes run to completion; partial failures captured; workflow continues with available results |

Error strategy is set per template via `template.failureMode`.

## Container Cleanup

### Shutdown Hooks

When the Electron app exits, all managed containers must be terminated to prevent orphans:

```typescript
// In main process initialization
app.on('before-quit', async (e) => {
  e.preventDefault();
  await pool.teardown();
  app.exit(0);
});

process.on('SIGTERM', async () => {
  await pool.teardown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await pool.teardown();
  process.exit(0);
});
```

### Startup Orphan Scan

On app startup (before pool initialization), scan for orphan containers from previous crashed
sessions:

```typescript
async function cleanupOrphanContainers(docker: Dockerode): Promise<void> {
  const orphans = await docker.listContainers({
    filters: { label: ['asdlc.managed=true'] }
  });
  for (const info of orphans) {
    const container = docker.getContainer(info.Id);
    await container.stop().catch(() => {});  // may already be stopped
    await container.remove().catch(() => {});
  }
}
```

This runs before `ContainerPool` is instantiated and ensures a clean slate on every app start.

## WorkflowPlan Derivation from WorkflowDefinition

The committed `WorkflowDefinition` type includes `parallelGroups?: ParallelGroup[]` where each
group has `laneNodeIds: string[]`. The execution engine needs to convert this design-time structure
into a runtime `WorkflowPlan`:

```typescript
function buildWorkflowPlan(workflow: WorkflowDefinition): WorkflowPlan {
  // 1. Build adjacency list from workflow.transitions
  // 2. Topological sort to determine execution order
  // 3. For each node:
  //    - If node is in a ParallelGroup.laneNodeIds → collect into ParallelLane
  //    - Otherwise → emit as sequential string lane
  // 4. Return WorkflowPlan with ordered lanes

  const groupMap = new Map<string, ParallelGroup>();
  for (const group of workflow.parallelGroups ?? []) {
    for (const nodeId of group.laneNodeIds) {
      groupMap.set(nodeId, group);
    }
  }

  // ... topological sort and lane assembly ...
}
```

**Key invariant:** `ParallelGroup.laneNodeIds` (committed field name) maps to `ParallelLane.blocks`
in the runtime `WorkflowPlan`.

## Merge Strategies for Parallel Block Outputs

When parallel blocks complete at fan-in, their outputs must be merged. The merge strategy is
configured per parallel lane:

| Strategy | Value | Use Case | Behavior |
|----------|-------|----------|----------|
| Concatenate | `"concatenate"` | Reviews, analysis | Join text outputs in lane order |
| Workspace | `"workspace"` | Coding, file edits | Detect file conflicts at fan-in |
| Custom | `"custom"` | User-defined | Invoke user-provided merge function |

```typescript
interface ParallelLane {
  blocks: string[];
  mergeStrategy?: 'concatenate' | 'workspace' | 'custom';
  customMerge?: (results: BlockResult[]) => BlockResult;
}
```

**Workspace merge conflict detection:**
- After all blocks complete, compare modified file lists
- If two blocks modified the same file: emit `execution:merge-conflict` IPC event
- User decides resolution strategy (last-write-wins, manual merge, abort)

## Coordinator (Electron Main Process)

The coordinator is instantiated once in the Electron main process. It owns the `ContainerPool` and `WorkflowExecutor`.

```typescript
class ContainerPool {
  constructor(options: ContainerPoolOptions);

  // Pre-warm N containers for upcoming workflow execution
  prewarm(count: number): Promise<void>;

  // Assign an idle/dormant container to a block; wakes dormant if none idle
  acquire(blockId: string): Promise<ContainerRecord>;

  // Release a container after block completes; transitions to dormant
  release(containerId: string): void;

  // Return a snapshot of all containers for monitoring
  snapshot(): ContainerRecord[];

  // Terminate all containers (on workflow abort or app shutdown)
  teardown(): Promise<void>;
}

interface ContainerPoolOptions {
  image: string;                 // Docker image name (e.g. "claude-agent:latest")
  dormancyTimeoutMs: number;     // default: 5 * 60 * 1000 (5 minutes)
  maxContainers: number;         // default: 10
  portRangeStart: number;        // default: 9100
  portRangeEnd: number;          // default: 9199
  healthCheckIntervalMs: number; // default: 500
  healthCheckTimeoutMs: number;  // default: 30_000
}
```

### dockerode Integration

```typescript
import Dockerode from 'dockerode';

const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });

// Create container
const container = await docker.createContainer({
  Image: options.image,
  Cmd: ['sleep', 'infinity'],
  HostConfig: {
    AutoRemove: false,
    NetworkMode: 'bridge',
    PortBindings: { '8080/tcp': [{ HostPort: String(port) }] },
    ExtraHosts: ['host.docker.internal:host-gateway'],  // Required for Linux Docker
  },
  Labels: { 'asdlc.managed': 'true', 'asdlc.pool': 'workflow-studio' }
});

await container.start();

// Pause / unpause for dormancy
await container.pause();
await container.unpause();

// Remove on termination
await container.stop();
await container.remove();
```

## IPC Contracts

### Renderer -> Main (requests)

| Channel | Constant | Payload | Response |
|---------|----------|---------|----------|
| `execution:start` | `EXECUTION_START` | `{ workflowId, plan: WorkflowPlan }` | `{ executionId: string }` |
| `execution:abort` | `EXECUTION_ABORT` | `{ executionId: string }` | `{ ok: boolean }` |
| `container:pool-status` | `CONTAINER_POOL_STATUS` | `{}` | `ContainerRecord[]` snapshot |

### Main -> Renderer (push events)

| Channel | Constant | Payload |
|---------|----------|---------|
| `container:pool-status` | `CONTAINER_POOL_STATUS` | `ContainerRecord[]` (emitted on every state change) |
| `execution:lane-start` | `{ lane: number, blockIds: string[] }` |
| `execution:lane-complete` | `{ lane: number, results: BlockResult[] }` |
| `execution:block-error` | `{ blockId: string, error: string }` |
| `execution:aborted` | `{ executionId: string }` |

### Workflow Plan Types

```typescript
interface ParallelLane {
  blocks: string[];    // blockIds that execute concurrently
}

interface WorkflowPlan {
  lanes: (string | ParallelLane)[];   // string = single sequential block; ParallelLane = fan-out
  parallelismModel: 'multi-container' | 'single-container';
  failureMode: 'strict' | 'lenient';
}
```

## Architecture

```
Electron Main Process
+──────────────────────────────────────────────────────────+
|  Execution Coordinator                                    |
|  +────────────────────────────+  ContainerPool            |
|  |  WorkflowExecutor          |  +──────────────────────+ |
|  |  ─────────────────────     |  | container-a  RUNNING  | |
|  |  execute(workflowPlan)     |  | container-b  DORMANT  | |
|  |    -> prewarm(plan)        |  | container-c  IDLE     | |
|  |    -> fanOut(parallelLane) |  | container-d  STARTING | |
|  |    -> fanIn(results)       |  +──────────────────────+ |
|  +────────────────────────────+                           |
|           |                                               |
|  IPC: execution:start / CONTAINER_POOL_STATUS             |
+──────────────────────────────────────────────────────────+
           | dockerode (Unix socket)
           v
Docker Engine (local)
+─────────────────────────────────────────────────────+
|  claude-agent-<uuid>    (RUNNING -- block A)         |
|  claude-agent-<uuid>    (RUNNING -- block B)         |
|  claude-agent-<uuid>    (DORMANT -- paused)          |
+─────────────────────────────────────────────────────+
```

## Port Allocation

Each container gets a unique host port from a configurable range (default 9100-9199). A `Set<number>` within the pool tracks allocated ports. `allocatePort()` iterates the range and returns the first unused port. On container termination, the port is returned to the free set.

## File Structure

```
apps/workflow-studio/src/main/
├── services/
│   ├── execution-engine.ts          # existing -- extend with executeBlock(blockId, agentUrl)
│   ├── container-pool.ts            # NEW -- ContainerPool class + ContainerRecord types
│   └── workflow-executor.ts         # NEW -- WorkflowExecutor (fan-out/fan-in + pre-warming)
├── ipc/
│   └── execution-handlers.ts        # existing -- add pool-status, lane-start, lane-complete channels
└── utils/
    └── port-allocator.ts            # NEW -- ephemeral port allocation utility

apps/workflow-studio/src/shared/types/
├── workflow.ts                      # extend -- WorkflowPlan, ParallelLane, parallelismModel field
└── execution.ts                     # extend -- ContainerRecord, ContainerState, BlockResult

apps/workflow-studio/src/renderer/
└── components/monitoring/
    └── ContainerPoolPanel.tsx       # NEW -- renders pool snapshot for Monitoring tab

apps/workflow-studio/test/main/
├── container-pool.test.ts           # NEW -- unit tests for ContainerPool
└── workflow-executor.test.ts        # NEW -- unit tests for fan-out/fan-in and pre-warming
```

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Container lifecycle library | `dockerode` | Native Node.js, no shell injection risk, structured error types |
| Dormancy mechanism | `docker pause` (cgroup freeze) | Faster wake than stop/start; preserves in-memory state |
| Pool residence | Electron main process | Avoids renderer crash killing containers; single authority for lifecycle |
| Fan-out concurrency | `Promise.allSettled` | Captures all outcomes; no silent failures in lenient mode |
| Port allocation | In-memory Set within pool | Simple, fast; no external dependency for ephemeral port tracking |
| Pre-warm trigger | Execution start IPC | Warms exactly what is needed; re-evaluated on each execution start |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| P14-F07 (Cursor CLI Backend) | Internal | `executeNodeRemote` pattern extended by this feature |
| `apps/workflow-studio/src/main/ipc/execution-handlers.ts` | File | Execution IPC entry point |
| `apps/workflow-studio/src/main/services/execution-engine.ts` | File | DAG traversal and block dispatch |
| `dockerode` npm package | External | Node.js Docker API client |

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Port exhaustion (100-port range) | Low | Range configurable; add dynamic expansion if needed |
| `docker pause` not supported on all platforms | Low | Detect and skip pause on unsupported runtimes (keep DORMANT state without actual cgroup freeze) |
| Pre-warming exceeds cold-start time for small workflows | Medium | Pre-warming is non-blocking; no downside if container is not ready before first block |
| Fan-in deadlock if one block never completes | Low | Per-block timeout + `AbortController` propagation |
| `dockerode` not installed | Low | Add to `package.json`; document in setup guide |

## Open Questions

1. ~~**Single-container model**: MVP defers this~~ **RESOLVED:** Implemented as T26. Container runs `sleep infinity`; blocks execute via `docker exec`.
2. **Dormancy thresholds**: 5 minutes default. Per-template override via `ParallelGroup.dormancyTimeoutMs` (committed field). Global default in Settings is deferred.
3. ~~**Multi-container aggregation**: When parallel blocks produce conflicting file edits~~ **RESOLVED:** Merge strategies added (T31): `concatenate`, `workspace` (conflict detection), `custom`.
4. **Container image versioning**: Which image tag should the pool use? `latest` risks silent regressions. Recommend pinned digest or explicit version tag.
5. **Windows support**: `docker pause` is Linux/macOS (cgroup-based). Windows Docker Desktop may require a different dormancy strategy.
6. **Container cleanup on crash**: Addressed by T23 (shutdown hooks) and T24 (startup orphan scan). Covers normal exit, SIGTERM, SIGINT, and crash recovery.
