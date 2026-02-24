# P15 Architect Synthesis — Final Decision Document

**Date:** 2026-02-22
**Author:** Architect Reviewer (reviewer agent)
**Inputs:** 8 feature design.md, 8 tasks.md, FE design review, BE design review, committed source code
**Status:** FINAL — this document supersedes all prior synthesis drafts

---

## Section 1: Executive Summary

### Overall Assessment

P15 is an ambitious 8-feature epic that transforms Workflow Studio from a workflow designer into a full execution platform with Docker container orchestration, multi-step human-in-the-loop review, and real-time monitoring. The designs are individually well-structured, but **cross-feature integration has significant gaps** that, if unaddressed, will cause rework during implementation.

The most important finding from this synthesis is that **many shared types are already committed to the codebase** (workflow.ts, execution.ts, settings.ts, repo.ts, monitoring.ts, ipc-channels.ts), but these committed types **diverge from the feature designs in multiple places**. The prior synthesis recommended a "Type Foundation PR" to add types — the actual need is a **Type Reconciliation PR** that aligns committed code with designs and fills remaining gaps.

### Top 5 Risks Ranked by Impact

| Rank | Risk | Impact | Features |
|------|------|--------|----------|
| 1 | **Stateless agent contract undefined** | Blocks all execution features — no spec for how block outputs become next block inputs | F03, F04, F05 |
| 2 | **Container cleanup on abnormal exit missing** | Docker containers leak resources on Electron crash; orphans persist indefinitely | F05, F06 |
| 3 | **Git clone executes repository hooks** | Arbitrary code execution from malicious repos — security vulnerability | F03 |
| 4 | **monitoring.ts schema fundamentally mismatched** | Committed types incompatible with F07 design; wasted implementation effort if not reconciled | F07 |
| 5 | **Single-container parallelism deferred despite being a stated product requirement** | Product owner explicitly requested "several CLI instances in the same docker" | F05 |

### Readiness Score per Feature

| Feature | Score | Rationale |
|---------|-------|-----------|
| F08 (Settings) | **Ready** | Design is complete, types partially committed, zero upstream dependencies. Minor reconciliation needed for `ProviderConfig` field names. |
| F02 (Templates) | **Ready** | IPC channels committed, types aligned. One status model clarification needed (resolved in committed code). |
| F06 (CLI Sessions) | **Needs Work** | IPC channel names in committed code differ from design. PTY back-pressure and container ID capture unaddressed. |
| F01 (Studio) | **Needs Work** | StudioPage routing decision not yet reflected in App.tsx. F08 integration contract undefined. Store growth plan needed. |
| F03 (Launcher) | **Needs Work** | Git clone security fix required. RepoMount field names mismatched. File restriction enforcement is soft-only. |
| F04 (Multi-Step UX) | **Needs Work** | `ScrutinyLevel` missing `full_detail` in committed type. Revision history unbounded. |
| F05 (Parallel Engine) | **Not Ready** | Container cleanup safety missing. Single-container model deferred. WorkflowPlan derivation from ParallelGroup missing. Stateless agent contract undefined. |
| F07 (Monitoring) | **Not Ready** | Committed monitoring.ts fundamentally different from design. HTTP server in main process needs port conflict handling. Telemetry env vars not wired to F05 containers. |

---

## Section 2: Critical Findings (Must Fix Before Implementation)

### CRIT-1: Stateless Agent Contract Undefined

**Gap:** The product owner emphasizes "agents are stateless" and "user should respond after every step." None of the 8 designs define how a block's output becomes the next block's input. The `WorkflowVariable` mechanism exists in `workflow.ts:131-137` but no design maps agent outputs to variables.

**Requirement:** "Execute mounts code repo to agent, sets restrictions via rules to work only on specific chunk of files. Workflow has multi steps — since remote agents are stateless, user should respond after every step."

**Resolution:** Define an explicit contract:
- **Input:** Each block receives (a) system prompt with workflow rules + block prefix, (b) environment variables from `WorkflowVariable`, (c) the repo working directory at `/workspace`
- **Output:** Each block produces (a) modified files in `/workspace`, (b) a structured output at `/workspace/.output/block-<id>.json` containing deliverables
- **State passing (sequential):** Blocks sharing a bind mount see each other's file changes. The `.output/` directory accumulates deliverables across blocks.
- **State passing (parallel):** Each parallel block gets an isolated workspace (copy or git worktree branch). Fan-in merge applies file changes in completion order with conflict detection.

**Effort:** 2hr design document + 1hr type additions to `execution.ts`

### CRIT-2: Container Cleanup on Abnormal Exit (Safety)

**Gap:** F05's `pool.teardown()` is only called on explicit `execution:abort`. No wiring exists for `app.on('before-quit')`, `process.on('SIGTERM')`, `process.on('SIGINT')`, Electron crashes, or startup cleanup of orphaned containers.

**Requirement:** Containers have the `asdlc.managed=true` label (F05 design.md line 255) which enables cleanup, but no task uses it.

**Resolution:** Add two tasks to F05:
1. Wire `pool.teardown()` into `app.on('before-quit')` and `process.on('SIGTERM'/'SIGINT')` — 1hr
2. On startup, scan `docker.listContainers({ filters: { label: ['asdlc.managed=true'] } })` and stop/remove orphans — 1hr

### CRIT-3: Git Clone Executes Repository Hooks (Security)

**Gap:** `git clone` automatically runs `.git/hooks/post-checkout`. The F03 design validates URL scheme (HTTPS only) but does not prevent hook execution. A malicious public repo can execute arbitrary code on the user's machine.

**Requirement:** Secure file restriction and repo mounting.

**Resolution:** Add `--config core.hooksPath=/dev/null` to the clone command in the planned `repo-handlers.ts`. One-line fix, zero risk, must-have before any F03 implementation.

### CRIT-4: monitoring.ts Schema Mismatch

**Gap:** The committed `monitoring.ts` (37 lines) has a fundamentally different schema than the F07 design:

| Aspect | Committed Code | F07 Design |
|--------|---------------|------------|
| Event types | `agent_start`, `agent_complete`, `agent_error`, `tool_call`, `bash_command`, `metric`, `custom` | `tool_call`, `bash_command`, `lifecycle`, `token_usage` |
| Naming | camelCase (`sessionId`, `agentId`) | snake_case (`session_id`, `agent_id`) |
| Container tracking | Not present | `container_id` on events and sessions |
| Cost tracking | Not present | `total_cost_usd`, `estimated_cost_usd` |
| Session model | Simple: `sessionId, agentId, startedAt, completedAt, status, eventCount` | Rich: adds `container_id, current_step_index, current_step_name, total_cost_usd, error_count` |

**Requirement:** "Telemetry should follow: tool calls, bash commands, subagent calls."

**Resolution:** The type reconciliation PR must update `monitoring.ts` to match the F07 design. Decision: use **camelCase** (TypeScript convention) but adopt the F07 schema structure. T01 of F07 tasks.md is a type UPDATE, not creation.

### CRIT-5: `host.docker.internal` Fails on Linux

**Gap:** `host.docker.internal` resolves automatically on Docker Desktop (macOS/Windows) but NOT on native Linux Docker. The F07 telemetry hook uses `http://host.docker.internal:9292/telemetry`. Without `--add-host=host.docker.internal:host-gateway` on container creation, telemetry is broken on Linux.

**Resolution:** Add `ExtraHosts: ['host.docker.internal:host-gateway']` to `ContainerPool.createContainer()` HostConfig in F05. Also applies to F06's `docker run` command.

### CRIT-6: Type Reconciliation Required (Not Type Creation)

**Gap:** The prior synthesis recommended a "P15 Type Foundation PR" to add types. In reality, many types are **already committed** but diverge from designs:

| File | Committed State | Design Divergence |
|------|----------------|-------------------|
| `workflow.ts` | Complete (171 lines) | F01 design says `nodeIds` on `ParallelGroup` but committed code uses `laneNodeIds`. F01 design says `AgentBackendType = 'claude-docker' \| 'cursor-docker'` but committed `backend` is `'claude' \| 'cursor' \| 'codex'`. |
| `execution.ts` | Partial (119 lines) | Missing `full_detail` on `ScrutinyLevel`. Missing `ContainerRecord`, `ContainerState`, `BlockResult` from F05. |
| `settings.ts` | Partial (60 lines) | `ProviderConfig` uses `id`/`modelParams?`/`hasKey?` but F08 design uses `enabled`/`params`/no `id` field. Missing `dockerSocketPath`, `defaultRepoMountPath`, `workspaceDirectory`, `agentTimeoutSeconds` on `AppSettings`. |
| `monitoring.ts` | Mismatched (37 lines) | See CRIT-4 above. |
| `repo.ts` | Committed (15 lines) | Uses `source` not `type`. `localPath` is optional, not required. Has extra `branch?`, `cloneDepth?` fields not in F03 design. |
| `ipc-channels.ts` | Mostly committed (121 lines) | F03 design channel names (`REPO_BROWSE_LOCAL`, `REPO_CLONE_GITHUB`, `REPO_VALIDATE`) differ from committed names (`REPO_CLONE`, `REPO_CLONE_CANCEL`, `REPO_VALIDATE_PATH`). F06 design names differ from committed. Missing F05 lane events. Missing `SETTINGS_GET_VERSION`. |

**Resolution:** The reconciliation PR must:
1. **Treat committed code as source of truth for field names** — designs must be updated to match committed code where code already exists
2. **Add missing fields** from designs where code has gaps
3. **Resolve naming conflicts** — committed `ipc-channels.ts` names take precedence; update tasks.md references

**Effort:** 3-4hr for reconciliation + design doc updates

---

## Section 3: Gap Analysis (Requirements vs Design)

### F01: Studio Block Composer

| Requirement | Coverage | Notes |
|-------------|----------|-------|
| Choose building blocks (plan, test, dev) | **COVERED** | `BlockType = 'plan' \| 'dev' \| 'test' \| 'review' \| 'devops'`. Phase 1 ships Plan only. |
| Per-block dedicated prompt/harness | **COVERED** | `systemPromptPrefix` + `outputChecklist` on `AgentNodeConfig`. Well-designed. |
| Per-block harness refinement (e.g., planner interviews user) | **COVERED** | Default Plan harness includes interviewing behavior. |
| Choose agent per block — Cursor or Claude Code | **PARTIAL** | `AgentBackendSelector` exists but integration with F08 `ProviderConfig` for API keys and model selection is **undefined**. |
| Workflow-level rules | **COVERED** | `WorkflowDefinition.rules: string[]`. Injected into all block prompts. |
| Save as template | **COVERED** | F01-T12 uses `template:save` IPC. |
| Edit existing templates | **PARTIAL** | F02 routes "Edit" to `/` (designer), but if Studio coexists with Designer, the Edit target (`/studio` vs `/`) is ambiguous. |

### F02: Template Repository

| Requirement | Coverage | Notes |
|-------------|----------|-------|
| List templates | **COVERED** | `template:list` IPC, TemplateManagerPage. |
| Delete templates | **COVERED** | `template:delete` IPC. Missing confirmation dialog (FE risk). |
| Pause (make unavailable for execution) | **COVERED** | `template:toggle-status`, `WorkflowStatus = 'active' \| 'paused'`. |
| Edit routes to Studio | **PARTIAL** | Routes to `/` (designer), not `/studio`. Requires clarification per CRIT-6 reconciliation. |

### F03: Execute Launcher

| Requirement | Coverage | Notes |
|-------------|----------|-------|
| Choose template (from active ones) | **COVERED** | Filters by `status !== 'paused'`. |
| Choose work item (issue, idea, feature) | **PARTIAL** | PRD tab wired to filesystem. GitHub Issues API **deferred**. |
| Mount code repo to agent | **COVERED** | `RepoMount` type, local + GitHub clone. |
| Set restrictions via rules for file scope | **PARTIAL** | System prompt soft restriction only. No hard enforcement at filesystem or Docker level. Product owner said "sets restrictions via rules to work only on specific chunk of files" — soft enforcement may not meet intent. |
| View deliverables: planning, task breakdown, code diff | **PARTIAL** | `BlockDeliverables` union defined. DiffViewer is explicitly a stub. |

### F04: Execute Multi-Step UX

| Requirement | Coverage | Notes |
|-------------|----------|-------|
| User responds after every step | **COVERED** | `gateMode: 'gate'` pauses execution after each block. |
| Choose to continue or revise | **COVERED** | ContinueReviseBar + `execution:revise` IPC. |
| Choose level of scrutiny (summary vs file diffs) | **PARTIAL** | `ScrutinyLevel` has 3 values but design requires 4 (`full_detail` missing from committed type). |
| View workflow, current node, event log | **COVERED** | EventLogPanel, StepGatePanel, DeliverablesViewer. |
| Per-block deliverables and interaction | **COVERED** | Well-designed component tree with per-block-type rendering. |

### F05: Parallel Execution Engine

| Requirement | Coverage | Notes |
|-------------|----------|-------|
| Several CLI instances in same docker | **MISSING** | Interface scaffolded (`single-container`) but execution **entirely deferred**. Product owner explicitly requested this. |
| Multiple dockers run simultaneously | **COVERED** | `multi-container` model with `Promise.allSettled` fan-out. |
| Dormant/inactive docker (cold start like Lambda) | **COVERED** | `docker pause`/`unpause` with pre-warming algorithm. Strong design. |
| Start dockers ahead so flow won't hang | **COVERED** | Pre-warming via `computeMaxParallelLanes`. |

### F06: CLI Session Enhancement

| Requirement | Coverage | Notes |
|-------------|----------|-------|
| Testing stateless agents | **PARTIAL** | Docker-backed CLI sessions exist, but no session output capture for post-mortem analysis (BE GAP-F06-6). |
| Working remotely on specific issues | **COVERED** | Context injection: repo, issue, template. |
| More scrutiny via CLI | **COVERED** | Dual-mode spawning with Docker or local. |

### F07: Monitoring Dashboard

| Requirement | Coverage | Notes |
|-------------|----------|-------|
| Agents send messages on start/finalize | **COVERED** | `lifecycle` events with `start`, `finalized`, `error` stages. |
| Telemetry: tool calls, bash commands | **COVERED** | `tool_call` and `bash_command` event types. |
| Telemetry: subagent calls | **PARTIAL** | `SubagentStart` hook captures top-level only. Sub-agent tool calls not captured unless hook configured recursively (BE GAP-F07-4). |
| Expand dashboard to monitor multi-agents on dockers | **COVERED** | MonitoringPage with SummaryCards, EventStream, AgentSelector, SessionList, WorkflowView. |

### F08: Settings

| Requirement | Coverage | Notes |
|-------------|----------|-------|
| Environment params | **COVERED** | Environment tab with Docker, workspace, timeout settings. |
| Model vendors API keys | **COVERED** | Per-provider API key management via `safeStorage`. |
| Model settings | **COVERED** | Temperature, maxTokens per provider. |
| Providers connect to block agent selection | **MISSING** | No IPC or store interface specified for F01's `AgentBackendSelector` to read F08's provider availability. |

---

## Section 4: Cross-Feature Integration Issues

### F01 to F02: Studio to Template Save

**Status: PARTIALLY COHERENT**

Both features use `WorkflowDefinition` from `workflow.ts`, so the type contract is consistent. F01-T12 calls `template:save` IPC. F02's `TemplateManagerPage` loads via `template:list`.

**Gap:** F02 introduces `activeSaveTarget` in uiStore to track new-vs-update saves. F01's save action (T12) needs to set this correctly but F01's tasks.md does not reference `activeSaveTarget`. Additionally, F02 routes "Edit" to `/` (designer page) but if Studio coexists (per Q4 decision), Edit should route to `/studio`.

**Resolution:** Add `activeSaveTarget` usage to F01-T12. Decide Edit target: if workflow has `studio-block-composer` tag, route to `/studio`; otherwise route to `/` (designer).

### F02 to F03/F04: Template Selection to Execution

**Status: HANDOFF POINT UNDEFINED**

F02's design adds a template picker to the Execute tab (filters `status !== 'paused'`). F03's launcher wizard shows template selection as Step 1. F04's multi-step UX assumes a workflow is already loaded.

**Gap:** The handoff — which store holds "currently executing workflow" and how it gets populated from template selection — is not explicitly specified. Both F02 and F03 assume the other handles it.

**Resolution:** F03's `ExecutionPage` owns the template-to-execution transition. F03-T01 (TemplatePicker) uses `template:list` (from F02) and `template:load` to populate `executionStore.workflow`. F04 reads from `executionStore`.

### F03 to F05: Single Container vs Parallel Containers

**Status: ARCHITECTURAL GAP**

F03's `ExecutionEngine` gains `workingDirectory` for the mounted repo. F05's `ContainerPool` creates Docker containers with `-v <localPath>:/workspace` bind mounts. F05 introduces `WorkflowPlan` with `ParallelLane` as an execution-time concept, while F01/F03 use `WorkflowDefinition.parallelGroups`.

**Gap 1:** No task in F05 implements the derivation from `WorkflowDefinition.parallelGroups` (design-time, uses `laneNodeIds`) to `WorkflowPlan.lanes` (execution-time, uses `blocks[]`).

**Gap 2:** F05's `ContainerPool` is not connected to F03's `ExecutionEngine`. No task shows `ContainerPool.acquire()` being called from `ExecutionEngine.executeBlock()`.

**Gap 3:** For parallel blocks, the repo mount strategy is undefined. Do all containers share one bind mount (risks file conflicts) or get isolated copies? The existing synthesis Q7 says "isolate per block" but no task implements workspace isolation.

**Resolution:**
1. Add task: `buildWorkflowPlan(workflow: WorkflowDefinition): WorkflowPlan` (1.5hr)
2. Add task: Wire `ContainerPool.acquire()` into `ExecutionEngine.executeBlock()` (2hr)
3. Add task: Implement per-block workspace isolation (git worktree or temp copy) for parallel blocks (3hr)

### F05 to F07: Container Telemetry to Monitoring

**Status: INTEGRATION GAP**

F07's telemetry hook (`docker-telemetry-hook.py`) sends HTTP POST to `host.docker.internal:9292`. F05's `ContainerPool.createContainer()` must inject `TELEMETRY_ENABLED=1` and `TELEMETRY_URL` environment variables. Additionally, the `.claude/settings.json` with the telemetry hook must be bind-mounted into containers.

**Gap:** No F05 task sets these env vars during container creation. No task addresses hook injection for F05-created containers (F06's `docker run` addresses this separately).

**Resolution:** Add to F05 `ContainerPool.createContainer()`:
```typescript
Env: ['TELEMETRY_ENABLED=1', `TELEMETRY_URL=http://host.docker.internal:${port}/telemetry`],
Binds: ['.claude/settings.json:/home/user/.claude/settings.json:ro']
```
Also add `ExtraHosts: ['host.docker.internal:host-gateway']` for Linux support.

### F08 to F01: Settings/Providers to Block Agent Selection

**Status: UNDEFINED CONTRACT**

F01's `AgentBackendSelector` lets users choose `'claude' | 'cursor' | 'codex'` per block. F08's `ProviderConfig` defines available providers, API keys, and models. There is no specified interface for F01 to read provider availability from F08.

**Gap:** When a user selects "Claude Code" as the backend for a block, the Studio needs to know: (a) Is an Anthropic API key configured? (b) Which model is selected? (c) What are the model parameters? None of this flows from F08 to F01.

**Resolution:** F08 must expose a Zustand store slice or IPC query that F01 can consume:
```typescript
// settingsStore slice
getConfiguredProviders(): ProviderId[]  // providers with hasKey === true
getProviderConfig(id: ProviderId): ProviderConfig | null
```
F01's `AgentBackendSelector` reads this to show configured vs unconfigured backends and auto-populate model settings.

### Stateless Agent Contract Across All Features

**Status: NOT ADDRESSED**

This is the single largest architectural gap. See CRIT-1 for full analysis and resolution.

---

## Section 5: Architecture Recommendations

### Decision 1: Committed Code Is Source of Truth for Field Names

Where committed code and design documents use different names for the same concept, **committed code wins**. Designs and tasks.md files must be updated to reference committed names.

Specific reconciliations:
| Design Name | Committed Name | File |
|-------------|---------------|------|
| `RepoMount.type` | `RepoMount.source` | `repo.ts` |
| `RepoMount.localPath` (required) | `RepoMount.localPath?` (optional) | `repo.ts` |
| `ParallelGroup.nodeIds` | `ParallelGroup.laneNodeIds` | `workflow.ts` |
| `ProviderConfig.enabled` | `ProviderConfig.hasKey?` | `settings.ts` (different semantics — reconcile) |
| `ProviderConfig.params` | `ProviderConfig.modelParams?` | `settings.ts` |
| `CLI_HISTORY_LIST` (F06 design) | `CLI_SESSION_HISTORY` | `ipc-channels.ts` |
| `CLI_DOCKER_STATUS` (F06 design) | not committed | needs addition |
| `execution:pool-status` (F05 design) | `CONTAINER_POOL_STATUS` | `ipc-channels.ts` |

### Decision 2: StudioPage Coexists with DesignerPage

Per the prior synthesis Q4: Studio gets its own `/studio` route. DesignerPage stays at `/` for power users. F01 must add the route to App.tsx and a sidebar entry.

**Implementation detail:** When F02 "Edit" is clicked on a template with `studio-block-composer` tag, route to `/studio`. Otherwise route to `/` (designer).

### Decision 3: F05 Owns All Parallel Execution

F01-T06 (parallel group dispatch via `Promise.all`) is **moved to F05**. F01 only defines the `ParallelGroup` data model and the Studio UI for grouping nodes. F05's `WorkflowExecutor` owns the actual execution.

This prevents two conflicting parallel dispatch implementations. F01's prompt harness injection (T05) remains in F01 since it modifies the execution engine's prompt assembly, not dispatch.

### Decision 4: File Restriction Enforcement — Add Container-Side Hook

The product owner's requirement ("sets restrictions via rules to work only on specific chunk of files") is not met by system prompt text alone. Add a container-side `file-restriction-hook.py` (modeled on `guardrails-enforce.py`) that:
1. Reads `FILE_RESTRICTIONS` from environment variable (JSON array of glob patterns)
2. On PreToolUse (Write, Edit): validates file path against patterns
3. Blocks the tool call (exit 2) if path is outside allowed patterns

This provides real enforcement while keeping the system prompt as a secondary soft guide. Effort: 2hr.

### Decision 5: Monitoring Types Use camelCase with F07 Schema Structure

The F07 design uses snake_case. The committed code uses camelCase. TypeScript convention is camelCase. **Decision:** Adopt camelCase throughout but use the F07 design's richer schema (add `containerId`, `workflowId`, `tokenUsage`, lifecycle stages).

### Decision 6: Shared Component Library Before Feature Work

Both reviews identified shared UI patterns that should be built once:
- **StatusBadge**: F02, F04, F07
- **VirtualizedEventLog**: F04 (EventLogPanel), F07 (EventStream)
- **CardLayout**: F02 (TemplateCard), F07 (SummaryCards), F08 (ProviderCard)
- **ConfirmDialog**: F02 (delete template), F04 (revise block)
- **TagInput**: F01 (WorkflowRulesBar), F02 (template tags)

Build these in `apps/workflow-studio/src/renderer/components/shared/` before feature work. Effort: 3hr.

### Decision 7: Zustand Store Slices

`workflowStore.ts` is already 523 lines. F01 adds ~8 actions. Split into slices:
- `workflowCoreSlice`: CRUD, metadata
- `workflowNodesSlice`: node/edge management
- `workflowStudioSlice`: F01 actions (prompt harness, rules, parallel groups)
- `workflowHistorySlice`: undo/redo

New stores: `monitoringStore` (F07), `settingsStore` slice for provider state (F08).

### Decision 8: Single-Container Parallelism — Implement Basic Version

The product owner explicitly said "consider several CLI instances in the same docker." Implement a basic `single-container` spawner using `docker exec`:
1. Container runs `sleep infinity`
2. `ContainerPool.acquire()` returns the same `ContainerRecord` for all parallel blocks
3. Each block runs `docker exec -it <container> claude <args>` concurrently

This reuses F06's `spawnDocker()` pattern. The infrastructure already exists. Effort: 3hr added to F05.

---

## Section 6: Missing Tasks (Consolidated)

### Critical (Must add before implementation)

| # | Task | Feature | Effort | Rationale |
|---|------|---------|--------|-----------|
| MT-1 | Define stateless agent input/output contract | Cross-cutting | 3hr | CRIT-1: blocks all execution features |
| MT-2 | Wire `pool.teardown()` to `app.on('before-quit')` + signal handlers | F05 | 1hr | CRIT-2: container resource leak |
| MT-3 | Startup orphan container cleanup (scan `asdlc.managed=true`) | F05 | 1hr | CRIT-2: orphan prevention |
| MT-4 | Add `--config core.hooksPath=/dev/null` to git clone | F03 | 15min | CRIT-3: security fix |
| MT-5 | Reconcile monitoring.ts types (update, not create) | F07 | 1.5hr | CRIT-4: type mismatch |
| MT-6 | Add `host.docker.internal` host-gateway to container creation | F05 | 30min | CRIT-5: Linux support |
| MT-7 | Type Reconciliation PR (align committed code with designs) | Cross-cutting | 3-4hr | CRIT-6: prevents merge conflicts |

### High (Should add before implementation)

| # | Task | Feature | Effort | Rationale |
|---|------|---------|--------|-----------|
| MT-8 | Implement file-restriction PreToolUse hook for containers | F03 | 2hr | Product requirement gap |
| MT-9 | Implement basic `single-container` parallelism model | F05 | 3hr | Product requirement gap |
| MT-10 | Implement clone cancellation (IPC already declared) | F03 | 1hr | `REPO_CLONE_CANCEL` exists but no backend |
| MT-11 | Add `TELEMETRY_ENABLED` + `TELEMETRY_URL` env vars to F05 containers | F07/F05 | 30min | Telemetry integration |
| MT-12 | Implement `buildWorkflowPlan()` from `parallelGroups` | F05 | 1.5hr | Missing derivation logic |
| MT-13 | Wire `ContainerPool.acquire()` into `ExecutionEngine.executeBlock()` | F05 | 2hr | Pool-to-engine connection |
| MT-14 | Add F08-to-F01 provider availability interface | F08/F01 | 1hr | Backend selector needs provider state |
| MT-15 | Add `/studio` route to App.tsx with sidebar entry | F01 | 30min | FE C1 — routing decision |
| MT-16 | Build shared component library (StatusBadge, VirtualizedEventLog, CardLayout, ConfirmDialog, TagInput) | Cross-cutting | 3hr | Prevents duplicated implementations |
| MT-17 | Add template search/filter task to F02 tasks.md | F02 | 1.5hr | PRD FR-05 not represented as task |

### Medium (Should add before release)

| # | Task | Feature | Effort | Rationale |
|---|------|---------|--------|-----------|
| MT-18 | Per-block workspace isolation for parallel execution | F05 | 3hr | Prevents file conflicts |
| MT-19 | Docker image pull progress reporting to renderer | F05/F06 | 1.5hr | UX gap on first run |
| MT-20 | Wrap MonitoringStore EventEmitter IPC push in try-catch | F07 | 15min | Window-closed crash prevention |
| MT-21 | Temp directory cleanup for cloned repos on app quit | F03 | 30min | Resource cleanup |
| MT-22 | PTY back-pressure/buffer for high-output Docker containers | F06 | 1hr | Output flooding prevention |
| MT-23 | Wake-then-spawn sequencing fix in `acquire()` | F05 | 30min | Max container cap race condition |
| MT-24 | Define merge strategies for parallel block outputs | F05 | 1hr | Fan-in merge policy |
| MT-25 | Add `ScrutinyLevel = 'full_detail'` to execution.ts | F04 | 15min | FE C2 — type mismatch |
| MT-26 | Settings migration for pre-P15 settings | F08 | 1hr | Prevents data loss on upgrade |
| MT-27 | Add `SETTINGS_GET_VERSION` IPC channel | F08 | 15min | Missing from committed channels |
| MT-28 | Reconcile F06 IPC channel names (design vs committed) | F06 | 30min | Task references wrong names |
| MT-29 | Add CLI_DOCKER_STATUS IPC channel | F06 | 30min | Docker availability check |

### Low (Consider improving)

| # | Task | Feature | Effort | Rationale |
|---|------|---------|--------|-----------|
| MT-30 | Lazy pre-warming (start closer to parallel lane) | F05 | 1hr | Memory efficiency |
| MT-31 | Read-only mounts for review-only workflows | F03/F06 | 30min | Security hardening |
| MT-32 | Session output capture for post-mortem | F06 | 1hr | Testing use case |
| MT-33 | Dynamic telemetry receiver start/stop | F07 | 1hr | Port conservation |
| MT-34 | Document subagent telemetry depth limitation | F07 | 15min | Expectation management |
| MT-35 | Navigation restructuring for 8+ pages | Cross-cutting | 2hr | Sidebar may crowd |
| MT-36 | Keyboard shortcuts for Continue/Revise | F04 | 30min | Frequent operation UX |

**Total additional effort:** ~42hr across all priorities

---

## Section 7: Revised Build Order

### Does the Planned Build Order Still Work?

The prior synthesis proposed: **F08 -> F02+F06 -> F01+F07 -> F03+F04 -> F05**

**Revised assessment:** Mostly yes, with modifications:

1. **F08 first is correct.** Zero dependencies, prerequisite for F01.
2. **F02 and F06 in parallel is correct.** Both are independent of each other. F06 is fully independent.
3. **F01 should wait for F08** (needs provider interface). **F07 should NOT be parallel with F01** — F07 depends on F05's `ContainerPool` for Docker telemetry. Move F07 later.
4. **F03 and F04 in parallel is correct.** They modify different parts of the execution pipeline.
5. **F05 after F03/F04 is correct.** Needs stable execution engine.
6. **F07 after F05.** Needs `ContainerPool` and telemetry integration.

### Revised Build Order

```
Phase 0: Foundation (blocks everything)
├── Type Reconciliation PR                    3-4hr
├── Shared component library                  3hr
├── Stateless agent contract design           2hr
└── Navigation restructuring                  2hr
                                              ─────
                                              ~10hr

Phase 1: Settings Foundation (F08)
└── F08 T01-T12                               ~13hr

Phase 2: Core Experience (parallel)
├── F02 Templates (T01-T11)                   ~10hr
├── F06 CLI Sessions (T01-T11)                ~12hr
└── F01 Studio (T01-T05, T07-T12, no T06)    ~12hr
                                              ─────
                                              ~34hr (wall time: longest path ~12hr)

Phase 3: Execute Pipeline (parallel)
├── F03 Launcher (T01-T19 + MT-4,8,10,21)    ~22hr
└── F04 Multi-Step UX (T01-T14 + MT-25)      ~13hr
                                              ─────
                                              ~35hr (wall time: ~22hr)

Phase 4: Advanced Execution (F05)
└── F05 Parallel Engine                       ~30hr
    (T01-T22 + moved F01-T06 + MT-2,3,6,9,12,13,18,23,24)

Phase 5: Observability (F07)
└── F07 Monitoring (T01-T15 + MT-5,11,20)    ~22hr
```

### Key Changes from Prior Build Order

1. **F07 moved from Phase 2 to Phase 5.** It depends on F05's `ContainerPool` for Docker telemetry. Building it before F05 means the Docker telemetry pipeline cannot be tested end-to-end.
2. **Phase 0 expanded.** Type reconciliation is more work than originally estimated because committed code diverges from designs (not just missing types).
3. **F05 effort increased.** Added container safety tasks (MT-2,3), single-container model (MT-9), workspace isolation (MT-18), and WorkflowPlan derivation (MT-12,13).
4. **F03 effort increased.** Added security fix (MT-4), file restriction hook (MT-8), clone cancellation (MT-10).

### Total Revised Estimate

| Phase | Tasks | Effort |
|-------|-------|--------|
| Phase 0 (Foundation) | ~5 tasks | ~10hr |
| Phase 1 (F08) | 12 tasks | ~13hr |
| Phase 2 (F01+F02+F06) | 34 tasks | ~34hr |
| Phase 3 (F03+F04) | 35 tasks | ~35hr |
| Phase 4 (F05) | 28 tasks | ~30hr |
| Phase 5 (F07) | 18 tasks | ~22hr |
| **TOTAL** | **~132 tasks** | **~144hr** |

---

## Open Questions — RESOLVED

| Q | Question | Decision | Rationale |
|---|----------|----------|-----------|
| Q1 | F08 <-> F01 provider integration | F08 exposes Zustand store slice; F01 reads from it | Simplest; no new IPC needed |
| Q2 | Who owns parallel dispatch? | F05 owns all; F01-T06 moved to F05 | Single execution path |
| Q3 | workItemDirectory setting | Separate setting in F08 Environment tab | Already committed on `AppSettings` |
| Q4 | StudioPage vs DesignerPage | Coexist; Studio at `/studio`, Designer at `/` | Preserve power user workflow |
| Q5 | F04 gateMode vs HITLGateDefinition | Independent systems; gateMode is Electron-native, not aSDLC HITL | P15 gates are block-level execution gates |
| Q6 | Dormancy timeout location | Per-template (`ParallelGroup.dormancyTimeoutMs`) | Already committed in workflow.ts |
| Q7 | Parallel file conflict policy | Per-block workspace isolation; diff shown at fan-in | Prevents silent data loss |
| Q8 | Container image versioning | Pinned digest (sha256); no `latest` tag | Prevents silent regressions |
| Q9 | Clone Cancel button | Yes; `REPO_CLONE_CANCEL` already in committed IPC channels | IPC contract exists |
| Q10 | DiffViewer library | Monaco Editor diff mode | Full VS Code experience |
| Q11 | Monitoring naming convention | camelCase with F07's richer schema | TypeScript convention |
| Q12 | Template Edit routing target | Route to `/studio` if `studio-block-composer` tag, else `/` | Supports both paradigms |
| Q13 | File restriction enforcement | Add container-side PreToolUse hook + keep system prompt | Real enforcement for product requirement |
| Q14 | Single-container parallelism | Implement basic version via `docker exec` | Product owner requirement; infrastructure exists |

---

## Risk Register

| Risk | Severity | Features | Mitigation |
|------|----------|----------|------------|
| Stateless agent contract undefined | **CRITICAL** | F03, F04, F05 | Phase 0: define contract before any execution feature |
| Orphaned Docker containers on crash | **CRITICAL** | F05 | MT-2, MT-3: shutdown hooks + startup cleanup |
| Git clone hook execution | **HIGH** | F03 | MT-4: `--config core.hooksPath=/dev/null` |
| monitoring.ts type mismatch | **HIGH** | F07 | MT-5: reconcile in Type Reconciliation PR |
| Type divergence (committed vs designs) | **HIGH** | All | MT-7: Type Reconciliation PR ships first |
| Single-container model missing | **HIGH** | F05 | MT-9: implement basic version |
| File restriction enforcement soft-only | **HIGH** | F03 | MT-8: container-side PreToolUse hook |
| F08<->F01 integration undefined | **HIGH** | F01, F08 | MT-14: define store/IPC interface |
| `host.docker.internal` on Linux | **HIGH** | F05, F07 | MT-6: add host-gateway |
| WorkflowPlan derivation missing | **MEDIUM** | F05 | MT-12: buildWorkflowPlan() |
| Pool-to-engine wiring missing | **MEDIUM** | F05 | MT-13: wire acquire() into executeBlock() |
| Parallel workspace conflicts | **MEDIUM** | F05 | MT-18: per-block workspace isolation |
| Zustand store sprawl | **MEDIUM** | F01, F07 | Zustand slices pattern |
| Docker image pull latency | **MEDIUM** | F05, F06 | MT-19: pull progress IPC |
| Settings migration on upgrade | **MEDIUM** | F08 | MT-26: migration strategy |
| PTY buffer overflow | **MEDIUM** | F06 | MT-22: back-pressure |
| Navigation crowding (8+ pages) | **MEDIUM** | All | MT-35: sidebar restructuring |
| F07 HTTP server port conflict | **LOW** | F07 | MT-33: dynamic start/stop or port fallback |
| IPC channel name collisions | **LOW** | All | Committed channels already namespaced |

---

## Appendix: IPC Channel Registry (Committed + Required Additions)

### Already Committed (121 lines in ipc-channels.ts)

All channels listed in the current `ipc-channels.ts` are the source of truth. Feature tasks.md files must reference committed names, not design names.

### Required Additions (not yet committed)

| Channel | Feature | Direction | Purpose |
|---------|---------|-----------|---------|
| `settings:get-version` | F08 | R->M | App/Electron/Node version info |
| `cli:docker-status` | F06 | R->M | Docker availability check (2s timeout, 30s cache) |
| `execution:lane-start` | F05 | M->R | Parallel lane fan-out notification |
| `execution:lane-complete` | F05 | M->R | Parallel lane fan-in notification |
| `execution:block-error` | F05 | M->R | Per-block error notification |
| `execution:aborted` | F05 | M->R | Execution abort confirmation |

### Channel Name Reconciliation (design vs committed)

| Design Name | Committed Name | Action |
|-------------|---------------|--------|
| `repo:browse-local` | `DIALOG_OPEN_DIRECTORY` | Use committed; remove from F03 design |
| `repo:clone-github` | `REPO_CLONE` | Use committed |
| `repo:validate` | `REPO_VALIDATE_PATH` | Use committed |
| `execution:pool-status` | `CONTAINER_POOL_STATUS` | Use committed |
| `cli:history:list` | `CLI_SESSION_HISTORY` | Use committed |
| `cli:history:clear` | Not committed | Decide: add or omit |

---

## Appendix: Dependency Graph (Revised)

```
                    [Phase 0: Type Reconciliation + Shared Components + Agent Contract]
                                            |
                              +-------------+--------------------+
                              |                                  |
                            F08                               F06 (independent)
                         (Settings)                        (CLI Enhancement)
                              |
                    +---------+---------+
                    |                   |
                  F01                 F02
            (Studio Composer)    (Templates)
                    |                   |
              +-----+-----+            |
              |           |             |
            F03          F04           /
         (Launcher)  (Multi-Step)     /
              |           |          /
              +-----------+---------+
                          |
                        F05
               (Parallel Engine)
                          |
                        F07
                   (Monitoring)
```

**Key dependency arrows:**
- F08 -> F01: Provider config needed for AgentBackendSelector
- F02 -> F01: Template IPC needed for Studio "Save as Template"
- F02 -> F03: Template list+status needed for Execute launcher
- F01, F03, F04 -> F05: ParallelGroup data model, execution engine stability needed
- F05 -> F07: ContainerPool needed for Docker telemetry integration
- F06: Fully independent from Phase 1 onward
