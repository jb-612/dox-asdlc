# P15 Backend Design Review — F03, F05, F06, F07

**Reviewer:** Backend Design Reviewer (Code Reviewer Agent)
**Date:** 2026-02-22
**Scope:** Backend/infrastructure features — container lifecycle, Docker orchestration, repo mounting, telemetry pipeline, file restriction enforcement, stateless agent contract
**Artifacts reviewed:**
- `.workitems/P15-F03-execute-launcher/` (design.md, prd.md, user_stories.md, tasks.md)
- `.workitems/P15-F05-parallel-execution-engine/` (design.md, prd.md, user_stories.md, tasks.md)
- `.workitems/P15-F06-cli-session-enhancement/` (design.md, prd.md, user_stories.md, tasks.md)
- `.workitems/P15-F07-monitoring-dashboard/` (design.md, prd.md, user_stories.md, tasks.md)
- Existing code: `shared/types/execution.ts`, `shared/types/monitoring.ts`, `shared/types/workflow.ts`, `shared/types/repo.ts`, `shared/types/settings.ts`, `shared/ipc-channels.ts`, `preload/electron-api.d.ts`

---

## Executive Summary

The four backend features collectively introduce Docker container lifecycle management, a telemetry pipeline, repo mounting with file restrictions, and enhanced CLI sessions. The designs are individually well-structured with clear task breakdowns and dependency graphs. However, several **critical gaps** exist when evaluated against the product owner's stated requirements:

1. **File restriction enforcement is soft-only (F03):** The product owner requires "sets restrictions via rules to work only on specific chunk of files." The design only appends text to the agent system prompt — no hard enforcement at filesystem or Docker bind-mount level. This is explicitly deferred to F08 but was called out as a P15 requirement.

2. **Single-container multi-CLI model deferred (F05):** The product owner specifically asked to "consider several CLI instances in the same docker, or if not possible mount another docker." The design scaffolds the interface for `single-container` but defers execution entirely. This leaves the cheaper/lighter parallelism option unavailable at launch.

3. **Orphaned container cleanup missing (F05):** No mechanism to clean up Docker containers on abnormal Electron exit — containers persist indefinitely consuming resources.

4. **Monitoring schema mismatch (F07):** The committed `monitoring.ts` types have a different schema than what F07's design proposes. The existing code uses `agent_start`/`agent_complete` while the design uses `lifecycle` with sub-stages. These must be reconciled.

5. **Stateless agent contract undefined:** The product owner emphasizes "stateless remote agents" and "agents are stateless." None of the four designs define how state is passed between sequential workflow steps or how agent outputs become inputs to downstream blocks.

**Verdict:** The designs need targeted fixes before implementation. The highest-priority items are container cleanup (safety), file restriction hardening (requirement gap), and the stateless agent contract (architectural gap).

---

## Feature-by-Feature Review

### F03: Execute — Workflow Launcher

#### Coverage (Well-Addressed)

| Requirement | Design Coverage | Location |
|-------------|----------------|----------|
| Mount code repo to agent | Local directory picker + GitHub clone | design.md "Repository Mount Types" |
| Template status filtering | `status?: 'active' \| 'paused'` on `WorkflowMetadata` | design.md "Template Status Field" |
| `lastUsedAt` tracking | ISO-8601 timestamp, fire-and-forget touch | US-03, T07 |
| IPC for repo operations | `REPO_CLONE`, `REPO_VALIDATE_PATH`, `DIALOG_OPEN_DIRECTORY` | `ipc-channels.ts:96-103` |
| Work item FS wiring | `WORKITEM_LIST_FS` replaces mock data | T08, US-09 |
| RepoMount type | Already committed with `source`, `localPath`, `githubUrl`, `fileRestrictions` | `repo.ts:1-15` |
| Preload type safety | `window.electronAPI.repo.*` typed | `electron-api.d.ts:125-132` |

The design is thorough on the happy-path launcher flow. Template filtering, search, repo mounting, and work item wiring are all well-specified with clear task boundaries.

#### Gaps

**GAP-F03-1: File restriction enforcement is soft-only (CRITICAL)**

The product owner says: "Execute mounts the code repo to agent, **sets restrictions via rules to work only on specific chunk of files.**" The design (ADR-4) implements restrictions by appending `"Only modify files matching: [patterns]"` to the agent system prompt. This is a textual instruction that the LLM may or may not follow.

- **Current design:** System prompt text injection (`design.md:290-299`)
- **What's needed:** At minimum, Docker bind mounts with specific subdirectory paths instead of full repo access. For host-mode execution, a PreToolUse hook that validates file paths against the restriction patterns before allowing Write/Edit tools.
- **What's deferred:** "Hard filesystem-level restrictions via Docker bind mounts deferred to P15-F08" (`prd.md:48`)

**Recommendation:** Add a task to implement a PreToolUse hook-based file restriction enforcement for host-mode execution (non-Docker). This provides real enforcement without waiting for F08. For Docker execution, add specific `-v` bind mounts for each allowed path pattern instead of mounting the entire repo.

**GAP-F03-2: Git clone executes repository hooks (HIGH — Security)**

`git clone` automatically runs `.git/hooks/post-checkout` after checkout. The design validates URL scheme (`https://` only) but does not prevent hook execution. A malicious public repo can execute arbitrary code on the user's machine.

- **File:** Planned `repo-handlers.ts`
- **Fix:** Add `--config core.hooksPath=/dev/null` to the clone command:
  ```
  git clone --depth=1 --config core.hooksPath=/dev/null <url> <targetDir>
  ```
- **Status:** Not addressed in any task (T05 omits this)

**GAP-F03-3: RepoMount type field name mismatch**

The F03 design.md defines `RepoMount.type: 'local' | 'github'` but the committed code in `repo.ts` uses `RepoMount.source: 'local' | 'github'`. Additionally, the design uses `localPath: string` (required) while the committed type has `localPath?: string` (optional).

- **Design says:** `type: 'local' | 'github'`, `localPath: string` (required)
- **Code has:** `source: 'local' | 'github'`, `localPath?: string` (optional)

Tasks T02, T09 reference the design's naming convention. Implementation must use the committed field names or a reconciliation task is needed.

**GAP-F03-4: No temp directory cleanup on app quit**

GitHub clones go to `os.tmpdir()` (`design.md:119`). No cleanup is wired to `app.on('before-quit')`. While the OS eventually clears temp, multiple clone sessions accumulate large repo copies.

- **Not addressed in:** Any task
- **Recommendation:** Add `cleanup-cloned-repos` to app shutdown sequence

**GAP-F03-5: Clone cancellation not implemented**

`tasks.md` open question #2 asks about clone cancellation but no task implements it. The committed `ipc-channels.ts` already has `REPO_CLONE_CANCEL` (line 99) and `electron-api.d.ts` has `cancelClone()` (line 129), meaning the IPC contract expects this capability but no backend task delivers it.

- **IPC declared:** `REPO_CLONE_CANCEL` in `ipc-channels.ts:99`
- **API declared:** `cancelClone()` in `electron-api.d.ts:129`
- **Task missing:** No T-number implements the abort logic

#### Risks

| Risk | Severity | Description |
|------|----------|-------------|
| File restrictions bypassed | HIGH | LLM may ignore system prompt instruction |
| Malicious repo code execution | HIGH | Git hooks execute on clone |
| Clone hangs on large repos | MEDIUM | `--depth=1` helps but large repos still slow; no cancel |
| Work item directory not configured | LOW | Falls back to empty list — good graceful degradation |

---

### F05: Parallel Execution Engine + Docker Lifecycle

#### Coverage (Well-Addressed)

| Requirement | Design Coverage | Location |
|-------------|----------------|----------|
| Docker-based execution | `dockerode` client, ContainerPool class | design.md "dockerode Integration" |
| Cold start optimization (Lambda-like) | Pre-warming algorithm with `computeMaxParallelLanes` | design.md "Pre-Warming Algorithm" |
| Dormancy ("dormant inactive docker") | `docker pause`/`unpause` with timer-based termination | design.md "Dormancy" |
| Fan-out/fan-in | `Promise.allSettled` with strict/lenient failure modes | design.md "Fan-Out / Fan-In" |
| Container state machine | 5 states with explicit transition guards | design.md "Container States" |
| Abort propagation | `AbortController` signal through `executeBlock` | T13 |
| Port allocation | `PortAllocator` with `Set<number>` tracking | T05 |
| Container labels | `asdlc.managed=true` label on all containers | design.md "dockerode Integration" |

The container lifecycle design is the strongest of the four features. The state machine is well-defined, pre-warming addresses cold-start, and dormancy via `docker pause` is an excellent choice (fast wake, no CPU consumption).

#### Gaps

**GAP-F05-1: Single-container multi-CLI model deferred (CRITICAL requirement gap)**

The product owner explicitly says: "consider several CLI instances in the same docker, or if not possible mount another docker." The design acknowledges `single-container` as an option (`design.md:39-45`) but defers execution entirely to post-MVP. The interface is defined but no implementation path exists.

- **Impact:** For lightweight parallel tasks (e.g., three code review agents), spinning up three full Docker containers is wasteful. Three `claude` CLI processes in one container would be faster and cheaper.
- **Recommendation:** At minimum, implement a basic `single-container` spawner that uses `docker exec` to launch N `claude` processes in one container. The infrastructure for this is simple: the container stays running, and `docker exec -it <container> claude <args>` is run N times.

**GAP-F05-2: No container cleanup on abnormal exit (CRITICAL — Safety)**

The `pool.teardown()` method exists but is only called on explicit `execution:abort`. No wiring exists for:
- `app.on('before-quit')` — user closes Electron
- `process.on('SIGTERM')` / `process.on('SIGINT')` — OS termination
- Electron crash — renderer or main process crash
- Startup cleanup — containers from a previous crashed session

The `asdlc.managed=true` label is applied to containers (design.md line 256) which enables cleanup, but no task uses it.

- **Missing tasks:** Startup scan for orphaned containers, quit-time teardown
- **Fix:** Wire `pool.teardown()` into `app.on('before-quit')`. On startup, scan with `docker.listContainers({ filters: { label: ['asdlc.managed=true'] } })` and stop/remove any found.

**GAP-F05-3: `host.docker.internal` resolution on Linux (HIGH)**

`host.docker.internal` resolves automatically on Docker Desktop (macOS/Windows) but NOT on native Linux Docker. The F07 telemetry hook uses `http://host.docker.internal:9292/telemetry`. Without `--add-host=host.docker.internal:host-gateway` on container creation, telemetry is broken on Linux.

- **Affected:** F05 `ContainerPool.createContainer()` and F07 telemetry hook
- **Not in any task:** Must be added to container creation HostConfig
- **Fix:** Add to `createContainer()` options:
  ```typescript
  HostConfig: {
    ExtraHosts: ['host.docker.internal:host-gateway'],
    // ... existing config
  }
  ```

**GAP-F05-4: Wake failure sequencing under maxContainers pressure**

When `wake()` fails and the pool is at `maxContainers`, the failed container must be `terminate()`d before `spawnContainer()` checks `pool.total()` against the cap. The design doesn't specify whether `terminate()` is awaited before the fallback `spawnContainer()`.

- **Scenario:** Pool at `maxContainers=10`. `acquire()` attempts to wake a dormant container. Wake fails. Pool tries `spawnContainer()`. But `pool.total()` is still 10 (the failed container hasn't been removed yet). `spawnContainer()` rejects with "max containers reached."
- **Fix:** `acquire()` must `await terminate(containerId)` before attempting `spawnContainer()` in the wake-failure fallback path.

**GAP-F05-5: No Docker image pull progress reporting**

The design mentions `pullImage` in the DockerClient (T04) but no task reports pull progress to the renderer. On first run, `docker pull` for a large image appears to hang. The user sees no feedback.

- **Recommendation:** Add a `container:pull-progress` IPC push event. `dockerode`'s `pull()` returns a stream with progress objects that can be forwarded.

**GAP-F05-6: Parallel execution model alignment with F01**

The committed `workflow.ts` has `ParallelGroup` (from F01) with `laneNodeIds: string[]` on `WorkflowDefinition.parallelGroups`. F05's design introduces a separate `WorkflowPlan` with `ParallelLane` as an execution-time concept. These are intended as complementary (data model vs execution plan), but:

- F05's `WorkflowPlan.lanes` must be derived from F01's `parallelGroups` in `WorkflowDefinition`
- No task in F05 implements this derivation logic
- `computeMaxParallelLanes` in T07 operates on `WorkflowPlan.lanes`, not on `WorkflowDefinition.parallelGroups`

**Recommendation:** Add a task: "Implement `buildWorkflowPlan(workflow: WorkflowDefinition): WorkflowPlan`" that converts the persisted `parallelGroups` into the execution plan structure.

**GAP-F05-7: Conflict resolution for parallel file edits**

When parallel blocks edit the same file, the current strategy is "last-write-wins" (design.md open question #3). For the product owner's example (three code review agents), this is fine since reviews are read-only. But for coding blocks, this causes silent data loss.

- **Status:** Explicitly deferred
- **Recommendation:** At minimum, detect conflicting file edits at fan-in and emit a `lane:conflict-detected` event to the renderer rather than silently losing changes.

#### Risks

| Risk | Severity | Description |
|------|----------|-------------|
| Orphaned containers on crash | CRITICAL | No cleanup on abnormal exit |
| Single-container model unavailable | HIGH | Product owner requirement deferred |
| Linux telemetry broken | HIGH | `host.docker.internal` not resolved |
| Wake-then-spawn sequencing | MEDIUM | May hit max container cap incorrectly |
| Image pull appears to hang | MEDIUM | No progress reporting |
| Parallel file edit conflicts | MEDIUM | Last-write-wins loses data silently |

---

### F06: CLI Session Enhancement

#### Coverage (Well-Addressed)

| Requirement | Design Coverage | Location |
|-------------|----------------|----------|
| Docker-backed CLI sessions | `docker run -it --rm` via node-pty | design.md "Docker Container Spawning" |
| Testing stateless agents | Context injection (repo, issue, template) | design.md "Context Injection" |
| Local mode unchanged | Dual-mode spawning with dispatch by `config.mode` | design.md "Dual-mode spawning" |
| Session history | JSON file, ring buffer (50), persist across restarts | design.md "Session History" |
| Quick-start presets | Raw Session, Issue Focus, Template Run | US-07, T08 |
| Docker availability check | `docker version` with 2s timeout, 30s cache | T03 |

The PTY-wrapped Docker approach is elegant — zero new dependencies, same IPC pipeline, full TTY support. This is the strongest architectural decision in the feature set.

#### Gaps

**GAP-F06-1: IPC channel naming mismatch between design and committed code**

The F06 design defines:
- `CLI_HISTORY_LIST`, `CLI_HISTORY_CLEAR`, `CLI_DOCKER_STATUS`

But the committed `ipc-channels.ts` has:
- `CLI_SESSION_SAVE`, `CLI_SESSION_HISTORY`, `CLI_PRESETS_LOAD`, `CLI_PRESETS_SAVE`, `CLI_LIST_IMAGES`

These are different channel sets with different semantics. The committed code has `CLI_LIST_IMAGES` (listing Docker images) and `CLI_PRESETS_*` (quick-start presets), which the design doesn't define as IPC channels. Conversely, the design's `CLI_DOCKER_STATUS` is not in the committed code (though `electron-api.d.ts` doesn't have it either — Docker status may be checked differently).

- **Impact:** Tasks T02, T06 reference design channel names but code has different names
- **Fix:** Reconcile before implementation — use the committed channel names

**GAP-F06-2: Session history path ambiguity**

The design says `~/.workflow-studio/cli-sessions.json` but also says "Uses `app.getPath('userData')`." On macOS, `app.getPath('userData')` resolves to `~/Library/Application Support/workflow-studio/`, not `~/.workflow-studio/`.

- **Impact:** History file may be written to unexpected location
- **Fix:** Use `app.getPath('userData')` consistently and document the actual path

**GAP-F06-3: Docker image pull on first run**

T04 spawns `docker run -it --rm <image> claude ...` but if the image isn't cached locally, `docker run` implicitly pulls it. This could take minutes for a large image, during which the PTY shows Docker pull progress but the UI has no explicit "Pulling image..." indicator.

- **Recommendation:** Before `docker run`, check if image exists via `docker image inspect`. If not, show a "Pulling image..." dialog with progress before spawning.

**GAP-F06-4: PTY back-pressure / buffer overflow**

No discussion of back-pressure for PTY data events. Docker containers can produce output faster than xterm.js can render (e.g., `npm install` or `git log`). The IPC channel (`CLI_OUTPUT`) could buffer unboundedly in the Electron main process.

- **Recommendation:** Add a bounded buffer or flow control. When the renderer falls behind, either drop oldest events or pause the PTY read until the renderer catches up.

**GAP-F06-5: Container ID not available from `docker run -it`**

The design stores `containerId` on `CLISession` but `docker run -it` in PTY mode doesn't return the container ID in a parseable way — it goes straight to the interactive session. To get the container ID, you'd need to:
1. Run `docker run -d` (detached) first, capture the ID, then `docker exec -it`
2. Or parse `docker ps --filter` after launch

This is not addressed in any task.

**GAP-F06-6: Stateless agent testing — no session output capture**

The product owner says CLI sessions are "good for testing stateless agent." But the design doesn't capture session output for post-mortem analysis. `SessionHistoryEntry` stores config and timing but not what the agent actually did. For testing purposes, capturing at least a summary of tool calls would be valuable.

- **Recommendation:** Consider adding a `sessionSummary` field to `SessionHistoryEntry` that captures tool call count, files modified, and exit status for quick triage.

#### Risks

| Risk | Severity | Description |
|------|----------|-------------|
| IPC channel name mismatch | HIGH | Design vs committed code names differ |
| Image pull delay on first use | MEDIUM | No explicit progress UI |
| PTY buffer overflow | MEDIUM | No back-pressure on output |
| Container ID parsing | MEDIUM | Not available from `docker run -it` directly |
| Session history path confusion | LOW | macOS path differs from design |

---

### F07: Monitoring Dashboard (Backend)

#### Coverage (Well-Addressed)

| Requirement | Design Coverage | Location |
|-------------|----------------|----------|
| Agent start/finalize messages | `lifecycle` events with `start`, `finalized`, `error` stages | design.md "Telemetry Event Schema" |
| Tool calls | `event_type: 'tool_call'` with `tool_name`, `file_paths` | design.md `TelemetryEvent` |
| Bash commands | `event_type: 'bash_command'` with `command`, `exit_code` | design.md `TelemetryEvent` |
| Subagent calls | `SubagentStart` hook in container | design.md "docker-telemetry-hook.py" |
| HTTP telemetry from Docker | POST `http://host.docker.internal:9292/telemetry` | design.md "Architecture" |
| In-memory ring buffer | 10,000 events, FIFO eviction | T03 |
| Live push to renderer | `monitoring:event` IPC channel | T04 |
| Fail-open container hook | Exit 0 on any exception | T13 |
| Token cost tracking | `token_usage` event type with `estimated_cost_usd` | design.md `TelemetryEvent` |

The telemetry architecture is well-designed. HTTP POST from containers via `host.docker.internal` is the simplest reliable transport. The fail-open hook behavior (exit 0 on failure) is critical — telemetry should never block agent execution.

#### Gaps

**GAP-F07-1: Monitoring type schema mismatch with committed code (CRITICAL)**

The committed `monitoring.ts` has a fundamentally different schema than the F07 design:

| Field | Committed Code (`monitoring.ts`) | F07 Design |
|-------|-----------------------------------|------------|
| Event types | `agent_start`, `agent_complete`, `agent_error`, `tool_call`, `bash_command`, `metric`, `custom` | `tool_call`, `bash_command`, `lifecycle`, `token_usage` |
| Session type | `AgentSession { sessionId, agentId, startedAt, completedAt, status, eventCount }` | `AgentSession { session_id, agent_id, container_id, started_at, ended_at, current_step_index, current_step_name, total_cost_usd, event_count, error_count }` |
| Stats type | `TelemetryStats { totalEvents, errorRate, eventsPerMinute, activeSessions, byType }` | `MonitoringStats { total_events, active_agents, error_rate, total_cost_usd, events_per_minute }` |
| Naming style | camelCase | snake_case |
| Container ID | Not present | `container_id` field on events and sessions |

The committed code uses camelCase and a simpler schema. The design uses snake_case and adds `container_id`, `total_cost_usd`, `current_step_*`, `error_count`. These are incompatible. T01 says "define shared types" but the types already exist.

- **Fix:** T01 must be a type *update*, not creation. Decide on naming convention (camelCase for TypeScript consistency) and add the missing fields to the existing types.

**GAP-F07-2: EventEmitter listener exception propagation**

`MonitoringStore` uses `EventEmitter.on('event', handler)`. The IPC push handler (`mainWindow.webContents.send`) will throw if the window is closed or destroyed. This exception propagates into the `append()` call stack, potentially crashing the store.

- **Fix:** Wrap the IPC push in a try-catch:
  ```typescript
  store.on('event', (event) => {
    try {
      mainWindow?.webContents?.send('monitoring:event', event);
    } catch (e) {
      // Window closed — ignore
    }
  });
  ```

**GAP-F07-3: No dynamic start/stop of telemetry receiver**

The telemetry HTTP server starts on app launch and binds port 9292 unconditionally. No IPC channel allows the user to start/stop it dynamically. If the user doesn't need monitoring, the port is occupied.

- **Recommendation:** Add `MONITORING_RECEIVER_START` / `MONITORING_RECEIVER_STOP` IPC channels, or make the receiver lazy-start (only bind when the Monitoring tab is first opened).

**GAP-F07-4: Subagent telemetry depth**

The hook captures `SubagentStart` events but not tool calls made *within* subagents. A Claude CLI session that spawns a subagent via the Agent SDK will report the `SubagentStart` event, but the subagent's individual tool calls are not captured unless the subagent also has the telemetry hook configured.

- **Impact:** For workflows where a block spawns sub-agents (e.g., a planner block that delegates to a backend sub-agent), the monitoring dashboard only sees the top-level block's tool calls.
- **Recommendation:** Document this limitation. For full depth, the telemetry hook must be configured recursively in the container's `.claude/settings.json` for all hook levels.

**GAP-F07-5: Port conflict handling**

The design mentions handling port-in-use (T02: "emits `receiver:unavailable` event, does not throw"). But no task creates a renderer-side component that shows the "Receiver unavailable" notice when this event fires.

- **Recommendation:** T07 (MonitoringPage layout) should include an unavailable state that renders when the receiver fails to bind.

**GAP-F07-6: No persistence — all telemetry lost on app restart**

The in-memory ring buffer is cleared when the app restarts. For debugging workflow failures, the operator may need to review events from a previous session. Persistence is explicitly deferred but should be noted as a significant limitation.

- **Status:** Explicitly out of scope ("SQLite persistence of monitoring events deferred to follow-on")
- **Impact:** If the app crashes during a long workflow, all telemetry is lost. The operator must re-run the workflow to reproduce.

#### Risks

| Risk | Severity | Description |
|------|----------|-------------|
| Schema mismatch with committed code | CRITICAL | F07 design vs existing `monitoring.ts` |
| EventEmitter exception propagation | HIGH | Window close crashes store |
| Linux telemetry broken | HIGH | `host.docker.internal` (shared with F05) |
| Telemetry lost on restart | MEDIUM | In-memory only, no persistence |
| Subagent depth limitation | MEDIUM | Only top-level tool calls captured |
| Port conflict UX | LOW | No renderer-side notice |

---

## Cross-Cutting Backend Concerns

### 1. Container Lifecycle: Cold Start, Warm Pool, Dormancy

**Assessment: Well-designed in F05, but integration points are underspecified.**

- **Cold start:** Pre-warming algorithm is solid. `computeMaxParallelLanes` starts the right number of containers before the first parallel lane. Performance target (<10s cold start with cached image) is achievable.
- **Warm pool:** Container reuse via dormancy (`docker pause`/`unpause`) is the right approach. Expected wake time (<2s) is fast enough for interactive workflows.
- **Dormancy:** Timer-based termination after `dormancyTimeoutMs` (default 5 min) prevents resource accumulation. `docker pause` preserves memory state while consuming no CPU.

**Missing integration:**
- F05's `ContainerPool` is not connected to F03's `ExecutionEngine`. The design says `ExecutionEngine` gains `workingDirectory` but there's no task connecting `ContainerPool.acquire()` → `ExecutionEngine.executeBlock()`.
- No shared container image configuration. F06 uses a configurable image (`ghcr.io/anthropics/claude-code:latest`). F05 uses `ContainerPoolOptions.image`. These should read from the same `AppSettings` field.

### 2. Repo Mounting and File Restriction Enforcement

**Assessment: Mounting is well-covered; enforcement is critically weak.**

The repo mounting path is clean:
1. F03: User selects local path or clones GitHub repo → `RepoMount` stored
2. F03: `RepoMount.localPath` passed to `ExecutionEngine` as `workingDirectory`
3. F05: `ContainerPool` containers get `-v <localPath>:/workspace` bind mount
4. F06: CLI sessions get `-v <repoPath>:/workspace` mount

**File restriction enforcement gap:**

| Layer | Enforcement | Status |
|-------|------------|--------|
| System prompt | "Only modify files matching: [patterns]" | Designed (F03 ADR-4) — soft only |
| PreToolUse hook | Validate file paths against patterns before Write/Edit | **NOT designed** |
| Docker bind mount | Mount only specific subdirectories matching patterns | **Deferred to F08** |
| Read-only mount | `:ro` flag for review-only workflows | **Not addressed** |

For the product owner's requirement ("sets restrictions via rules"), the system prompt approach alone is insufficient. The LLM can and will violate soft restrictions. At minimum, a PreToolUse hook inside the container should block Write/Edit to paths outside the allowed patterns.

**Recommendation:** Add a container-side `file-restriction-hook.py` (similar to the existing `guardrails-enforce.py` pattern) that reads `FILE_RESTRICTIONS` from an environment variable and blocks tool calls targeting disallowed paths. This hook is injected into containers alongside the telemetry hook.

### 3. Multi-CLI-in-One-Docker vs Multi-Docker Decision

**Assessment: Decision made (multi-container default) but single-container model is a product requirement.**

The product owner's example: "three code review agents each taking different angle (security/quality/performance) — either manage in same docker with three CLI instances, or three dockers run simultaneously."

F05 correctly identifies both models:
- `multi-container` (default): One Docker container per parallel block
- `single-container`: N `claude` CLI processes inside one container

But `single-container` is deferred. For the review agent use case, three containers for three review angles is heavy — same image, same repo, no isolation needed between reviewers. A single container with three `claude` processes would:
- Start faster (one cold start, not three)
- Use less memory (shared base layers)
- Be simpler to monitor (one container in the pool)

**Implementation path for single-container:** The container runs `sleep infinity`. F05's `ContainerPool.acquire()` returns the same `ContainerRecord` for all three blocks. Instead of assigning one block per container, it runs `docker exec -it <container> claude <args>` three times. This is essentially what F06's `spawnDocker()` already does.

**Recommendation:** Implement basic `single-container` in the MVP. The infrastructure already exists between F05 and F06.

### 4. Telemetry Pipeline: How Docker Agents Report Back

**Assessment: Well-designed with one integration gap.**

The pipeline:
```
Container (hook.py) → HTTP POST → Electron (TelemetryReceiver :9292) → MonitoringStore → IPC → Renderer
```

This is correct and simple. Key properties:
- **No Redis dependency** inside containers (good — reduces container complexity)
- **Fail-open** hook behavior (exit 0 always — agent never blocked by telemetry failure)
- **Stdlib-only** Python hook (`urllib.request` — no pip install needed in container)
- **2-second HTTP timeout** prevents hung agent on telemetry receiver crash

**Integration gap:** The telemetry hook must be injected into containers created by F05's `ContainerPool`. The design says containers receive `TELEMETRY_ENABLED=1` and `TELEMETRY_URL` environment variables, but no F05 task sets these env vars during container creation. They must be added to `ContainerPool.createContainer()` options:

```typescript
Env: [
  `TELEMETRY_ENABLED=1`,
  `TELEMETRY_URL=http://host.docker.internal:${monitoringPort}/telemetry`,
]
```

Additionally, the `.claude/settings.json` with the telemetry hook must be bind-mounted or pre-baked into the Docker image. No task addresses this for F05-created containers (only F06's `docker run` CLI sessions).

### 5. Stateless Agent Contract: How State Is Passed Between Steps

**Assessment: NOT ADDRESSED — significant architectural gap.**

The product owner emphasizes stateless agents: "Execute mounts the code repo to agent, sets restrictions" and "Agents are stateless — should send messages when they start, when they finalize."

None of the four designs define:

1. **How a block's output becomes the next block's input.** The `ExecutionEngine` traverses DAG transitions but there's no specification for how Block A's output (e.g., a plan document) is passed to Block B (e.g., a coder). The `WorkflowVariable` mechanism exists (`workflow.ts:131-137`) but no design shows how agent outputs map to variables.

2. **What "stateless" means for Docker containers.** If a container runs Block A, goes dormant, then wakes for Block B, does it retain Block A's working state (files, env vars)? With `docker pause`/`unpause`, yes — memory is preserved. But this contradicts "stateless." If the container is restarted (cold start), all state is lost.

3. **How the repo state evolves between sequential blocks.** Block A modifies files in `/workspace`. Block B runs in a different container with the same repo mount. Does Block B see Block A's changes? With bind mounts, yes (both containers share the host filesystem). But this means file conflicts are possible. Without bind mounts, Block B starts with the original repo state and Block A's changes are lost.

**Recommendation:** Define the stateless agent contract explicitly:
- **Input contract:** Each block receives its input via (a) system prompt text, (b) environment variables, and (c) the repo working directory.
- **Output contract:** Each block's output is (a) the modified repo working directory state, and (b) a structured output written to a well-known path (e.g., `/workspace/.output/block-<id>.json`).
- **State passing:** For sequential blocks sharing a repo mount, changes are visible via the shared bind mount. For parallel blocks, each gets a separate workspace (or git worktree branch).

### 6. Lambda-Style Cold Start Optimization

**Assessment: Well-addressed in F05.**

The pre-warming algorithm (`design.md:107-135`) correctly implements Lambda-like cold start optimization:
1. Parse workflow DAG at launch to count maximum parallel width
2. Start that many containers immediately (before first block executes)
3. Sequential blocks before the first parallel lane provide "warm time" for containers to boot
4. Backpressure: never exceed `maxContainers`

The dormancy system extends this: containers that finish a block go dormant instead of terminating, so subsequent blocks (or re-executions) skip cold start entirely.

**One concern:** Pre-warming starts all containers at `execution:start`, even if the first parallel lane is far down the DAG. For a workflow like `Sequential(A) → Sequential(B) → Parallel(C, D, E)`, containers warm during A and B execution (potentially minutes). The containers sit idle consuming memory during this time.

**Recommendation:** Consider lazy pre-warming — start warming containers when the DAG traversal reaches N-1 blocks before the parallel lane, not at the very start. This reduces memory waste for long sequential prefixes.

### 7. Parallel Execution: Fan-Out/Fan-In, Error Handling, Merge Strategy

**Assessment: Well-designed with one gap on merge.**

- **Fan-out:** `Promise.allSettled` over `pool.acquire → engine.executeBlock → pool.release` for each blockId. Correct.
- **Fan-in:** Waits for all promises to settle. Correct.
- **Error handling:** `strict` (first failure aborts) vs `lenient` (all complete, collect partials). Correct.
- **Abort:** `AbortController` propagation. Correct.

**Merge gap:** After fan-in, "continue workflow DAG with the merged lane output" (design.md:192). But what is the "merged output"? For three code review agents, the merge is "concatenate all review reports." For three coding agents, the merge is "apply all file changes to the working directory." The merge strategy is undefined.

**Recommendation:** Define merge strategies:
- `concatenate` — combine all block outputs (default for review/analysis blocks)
- `workspace` — file changes applied in order of completion (default for coding blocks)
- `custom` — user-defined merge function (future)

---

## Existing Code vs Design Alignment

### Aligned (Good)

| Artifact | Code | Design | Status |
|----------|------|--------|--------|
| `WorkflowMetadata.status` | `workflow.ts:154` | F03 design | Aligned |
| `WorkflowMetadata.lastUsedAt` | `workflow.ts:156` | F03 design | Aligned |
| `ParallelGroup` type | `workflow.ts:72-83` | F05 design | Aligned |
| `WorkflowDefinition.parallelGroups` | `workflow.ts:167` | F05 design | Aligned |
| `WorkflowDefinition.rules` | `workflow.ts:169` | F01 design | Aligned |
| `GateMode` type | `workflow.ts:37` | F04 design | Aligned |
| `RepoMount` type | `repo.ts:1-15` | F03 design | **Partially aligned** (field names differ) |
| `NodeExecutionState.revisionCount` | `execution.ts:31` | F04 design | Aligned |
| `ScrutinyLevel`, `BlockDeliverables` | `execution.ts:76-98` | F04 design | Aligned |
| `Execution.repoMount` | `execution.ts:110` | F03 design | Aligned |

### Misaligned (Needs Reconciliation)

| Item | Code | Design | Impact |
|------|------|--------|--------|
| `RepoMount` field names | `source`, optional `localPath` | `type`, required `localPath` | F03 tasks reference wrong field names |
| `monitoring.ts` schema | camelCase, simple types | snake_case, richer schema | F07 T01 must update, not create |
| F06 IPC channels | `CLI_SESSION_SAVE`, `CLI_SESSION_HISTORY`, `CLI_PRESETS_*`, `CLI_LIST_IMAGES` | `CLI_HISTORY_LIST`, `CLI_HISTORY_CLEAR`, `CLI_DOCKER_STATUS` | Tasks reference wrong channel names |
| `execution:pool-status` | `CONTAINER_POOL_STATUS` in code | `execution:pool-status` (bidirectional) in F05 design | Already resolved in committed code — uses dedicated channels |

---

## Prioritized Findings

### Critical (Must fix before implementation)

| # | Finding | Feature | Description |
|---|---------|---------|-------------|
| C1 | Container cleanup on exit | F05 | Wire `pool.teardown()` into `app.on('before-quit')`, `SIGTERM`, `SIGINT`. Add startup orphan scan using `asdlc.managed=true` label. |
| C2 | Monitoring type schema reconciliation | F07 | Committed `monitoring.ts` has different types than F07 design. T01 must update existing types, not create new ones. Decide on camelCase convention. |
| C3 | Git clone hook execution | F03 | Add `--config core.hooksPath=/dev/null` to clone command in T05. |
| C4 | Stateless agent contract | All | Define how block outputs become next block's inputs. Document the repo-mount state sharing model. |
| C5 | `host.docker.internal` on Linux | F05/F07 | Add `--add-host=host.docker.internal:host-gateway` to `ContainerPool.createContainer()` HostConfig. |

### High (Should fix before implementation)

| # | Finding | Feature | Description |
|---|---------|---------|-------------|
| H1 | File restriction enforcement | F03 | Add container-side PreToolUse hook that enforces file restrictions, not just system prompt text. |
| H2 | Single-container parallelism model | F05 | Implement basic `single-container` mode using `docker exec` for N processes in one container. |
| H3 | Clone cancellation missing | F03 | IPC contract already declared (`REPO_CLONE_CANCEL`); implement `AbortController` + process kill in T05. |
| H4 | F06 IPC channel name mismatch | F06 | Reconcile design channel names with committed code names before tasks begin. |
| H5 | Telemetry env vars in F05 containers | F07 | Add `TELEMETRY_ENABLED`, `TELEMETRY_URL` to F05 `ContainerPool.createContainer()` Env config. |
| H6 | `WorkflowPlan` derivation from `parallelGroups` | F05 | Add task to convert `WorkflowDefinition.parallelGroups` into `WorkflowPlan.lanes` for execution. |

### Medium (Should fix before release)

| # | Finding | Feature | Description |
|---|---------|---------|-------------|
| M1 | RepoMount field name mismatch | F03 | Design uses `type`/required `localPath`; code uses `source`/optional `localPath`. Update tasks to use committed field names. |
| M2 | Docker image pull progress | F05/F06 | Surface `dockerode` pull progress to renderer via IPC event. |
| M3 | Temp directory cleanup | F03 | Clean `wf-repo-*` dirs from tmpdir on `app.on('before-quit')`. |
| M4 | EventEmitter exception handling | F07 | Wrap `MonitoringStore` IPC push in try-catch for window-closed case. |
| M5 | PTY back-pressure | F06 | Add bounded buffer or flow control for high-output Docker containers. |
| M6 | Wake-then-spawn sequencing | F05 | `acquire()` must `await terminate()` before `spawnContainer()` in wake-failure fallback. |
| M7 | Merge strategy for parallel outputs | F05 | Define how parallel block results are merged before continuing DAG. |
| M8 | Lazy pre-warming | F05 | Start warming closer to the parallel lane instead of at `execution:start` for long sequential prefixes. |

### Low (Consider improving)

| # | Finding | Feature | Description |
|---|---------|---------|-------------|
| L1 | Session history path | F06 | Clarify `~/.workflow-studio/` vs `app.getPath('userData')` — use latter consistently. |
| L2 | Container ID parsing | F06 | `docker run -it` doesn't return container ID. Consider `docker run -d` + `docker exec` pattern. |
| L3 | Dynamic receiver start/stop | F07 | Allow user to start/stop telemetry receiver or lazy-start on tab open. |
| L4 | Subagent telemetry depth | F07 | Document that only top-level tool calls are captured; sub-agents need their own hook config. |
| L5 | Read-only mounts | F03/F06 | For review-only workflows, use `:ro` bind mount flag. |
| L6 | Session output capture | F06 | Add tool call summary to `SessionHistoryEntry` for post-mortem analysis. |

---

## Missing Backend Tasks (Across Features)

| # | Task Description | Feature | Priority | Estimated Effort |
|---|------------------|---------|----------|-----------------|
| 1 | Wire `pool.teardown()` into `app.on('before-quit')` and signal handlers | F05 | CRITICAL | 1hr |
| 2 | Startup orphan container cleanup (scan `asdlc.managed=true` label) | F05 | CRITICAL | 1hr |
| 3 | Add `--config core.hooksPath=/dev/null` to git clone command | F03 | CRITICAL | 15min |
| 4 | Reconcile `monitoring.ts` types with F07 design (update, not create) | F07 | CRITICAL | 1hr |
| 5 | Add `--add-host=host.docker.internal:host-gateway` to container creation | F05 | HIGH | 30min |
| 6 | Implement file-restriction PreToolUse hook for containers | F03 | HIGH | 2hr |
| 7 | Implement clone cancellation backend (REPO_CLONE_CANCEL already declared) | F03 | HIGH | 1hr |
| 8 | Add `TELEMETRY_ENABLED` + `TELEMETRY_URL` env vars to F05 container creation | F07 | HIGH | 30min |
| 9 | Implement `buildWorkflowPlan()` derivation from `parallelGroups` | F05 | HIGH | 1.5hr |
| 10 | Reconcile F06 IPC channel names with committed code | F06 | HIGH | 30min |
| 11 | Temp directory cleanup for cloned repos on app quit | F03 | MEDIUM | 30min |
| 12 | Wrap MonitoringStore EventEmitter IPC push in try-catch | F07 | MEDIUM | 15min |
| 13 | Define stateless agent input/output contract | All | MEDIUM | 2hr (design) |
| 14 | Docker image pull progress reporting to renderer | F05/F06 | MEDIUM | 1.5hr |

---

## Summary Verdict

The four backend features represent a well-structured architecture for Docker-based agent execution with monitoring. The container pool lifecycle, pre-warming, and dormancy design in F05 is particularly strong. The telemetry pipeline in F07 is clean and minimal.

However, **five items must be addressed before implementation begins:**

1. Container cleanup safety (C1) — prevents resource leaks on crash
2. Monitoring type reconciliation (C2) — prevents wasted work implementing against wrong types
3. Git clone security (C3) — prevents code execution from malicious repos
4. Stateless agent contract (C4) — prevents architectural confusion during implementation
5. Linux Docker networking (C5) — prevents telemetry failures on Linux

The file restriction enforcement (H1) and single-container model (H2) are product requirement gaps that should be addressed in this release cycle, not deferred further.
