---
id: P15-F07
parent_id: P15
type: tasks
version: 1
status: complete
constraints_hash: null
created_by: planner
created_at: "2026-02-22T00:00:00Z"
updated_at: "2026-02-22T00:00:00Z"
---

# Tasks: Monitoring Dashboard (P15-F07)

## Progress

- [x] T01 Update shared telemetry types (monitoring.ts already exists — UPDATE, not create)
- [x] T02 TelemetryReceiver HTTP server
- [x] T03 MonitoringStore (in-memory ring buffer)
- [x] T04 IPC handlers for monitoring queries
- [x] T05 Wire receiver + store into main process startup/shutdown
- [x] T06 Zustand monitoringStore (renderer)
- [x] T07 MonitoringPage layout + navigation wiring
- [x] T08 SummaryCards component
- [x] T09 EventStream component
- [x] T10 AgentSelector component
- [x] T11 SessionList component
- [x] T12 WorkflowView component
- [x] T13 docker-telemetry-hook.py container hook
- [x] T14 Unit tests: TelemetryReceiver + MonitoringStore
- [x] T15 Unit tests: renderer components + Zustand store

## Phase 1: Backend Foundation (T01–T05)

### T01 — Update shared telemetry types (monitoring.ts already exists) --- DONE

**File:** `apps/workflow-studio/src/shared/types/monitoring.ts`

**CRITICAL:** `monitoring.ts` already exists in committed code with camelCase types (`TelemetryEvent`,
`AgentSession`, `TelemetryStats`). This task is an UPDATE, not a creation. Extend the existing types:

- Extend `TelemetryEvent`: add `containerId`, `workflowId`, `nodeId`, `tokenUsage` (nested object
  with `inputTokens`, `outputTokens`, `estimatedCostUsd`, `model`), `lifecycleStage`, `stepIndex`,
  `stepName`, `errorMessage`, `toolName`, `toolInputSummary`, `filePaths`, `toolResultSummary`,
  `toolExitCode`, `command`, `commandExitCode` fields
- Extend `AgentSession`: add `containerId`, `currentStepIndex`, `currentStepName`, `totalCostUsd`,
  `errorCount` fields
- Extend `TelemetryStats`: add `totalCostUsd` field
- Add `LifecycleStage` and `EventFilter` types
- **Use camelCase throughout** (TypeScript convention) — the committed types already use camelCase

**Estimate:** 1.5 hours
**Depends on:** none

---

### T02 — TelemetryReceiver HTTP server

**File:** `apps/workflow-studio/src/main/services/telemetry-receiver.ts`

Implement a lightweight `http.createServer` (Node.js built-in) that:
- Listens on `localhost:<port>` (default 9292; read from settings)
- Handles `POST /telemetry`: parse JSON body → validate required fields (`id`, `sessionId`,
  `type`, `timestamp`) → call `MonitoringStore.append(event)` → respond 202
- Handles `GET /health`: respond 200 `{"status":"ok"}`
- Rejects malformed JSON with 400; unknown routes with 404
- Handles port-in-use error: logs warning, emits `receiver:unavailable` event (no crash)
- `start()` / `stop()` lifecycle methods; `stop()` calls `server.close()` and waits for
  in-flight requests

**Estimate:** 1.5 hours
**Depends on:** T01

---

### T03 — MonitoringStore (in-memory ring buffer)

**File:** `apps/workflow-studio/src/main/services/monitoring-store.ts`

Implement an EventEmitter-backed store:
- Ring buffer of max 10,000 `TelemetryEvent` objects (FIFO eviction)
- `append(event)`: insert event, update `AgentSession` for the `sessionId`, emit `'event'`
- Session lifecycle: new session created on first event for a `sessionId`; `startedAt` from
  first `lifecycleStage: start` event; `completedAt` from `lifecycleStage: finalized` or `lifecycleStage: error`
- `getEvents(filter?)`: return filtered/sliced event list
- `getSessions()`: return all `AgentSession` objects sorted by active-first
- `getStats()`: compute `TelemetryStats` from current state (committed type name)
- `clear()`: reset all state (for testing)

**Estimate:** 1.5 hours
**Depends on:** T01

---

### T04 — IPC handlers for monitoring

**File:** `apps/workflow-studio/src/main/ipc/monitoring-handlers.ts`

Register the following `ipcMain.handle` and push channels:
- `monitoring:get-events` → call `store.getEvents(filter)` → return `TelemetryEvent[]`
- `monitoring:get-sessions` → call `store.getSessions()` → return `AgentSession[]`
- `monitoring:get-stats` → call `store.getStats()` → return `TelemetryStats`
- Subscribe to `store.on('event', ...)` and push to renderer via
  `mainWindow.webContents.send('monitoring:event', event)`

Register handler in `src/main/ipc/index.ts`.

**Estimate:** 1 hour
**Depends on:** T02, T03

---

### T05 — Wire receiver + store into main process startup/shutdown

**File:** `apps/workflow-studio/src/main/index.ts`

- Instantiate `MonitoringStore` and `TelemetryReceiver` after `SettingsService` is ready
- Call `receiver.start()` before the window is shown
- On `app.on('before-quit')`, call `receiver.stop()` and await completion
- Pass `telemetryReceiverPort` from `AppSettings` to the receiver constructor; add `telemetryReceiverPort: number` (default `9292`) to `AppSettings` type and `SettingsService` defaults

**Estimate:** 0.5 hours
**Depends on:** T04

---

## Phase 2: Renderer (T06–T12)

### T06 — Zustand monitoringStore (renderer)

**File:** `apps/workflow-studio/src/renderer/stores/monitoringStore.ts`

Create a Zustand store that:
- Subscribes to `ipcRenderer.on('monitoring:event', ...)` and appends to local `events[]`
- On mount, calls `monitoring:get-events`, `monitoring:get-sessions`, `monitoring:get-stats`
  to hydrate initial state
- Derives `stats` reactively from `events[]` and `sessions[]` (uses `TelemetryStats` type)
- Exposes: `events`, `sessions`, `stats`, `selectedAgentId`, `setSelectedAgentId(id)`
- Filters `events` by `selectedAgentId` when set (derived `filteredEvents` selector)
- All fields use camelCase to match committed monitoring.ts types

**Estimate:** 1.5 hours
**Depends on:** T04

---

### T07 — MonitoringPage layout + navigation wiring

**Files:**
- `apps/workflow-studio/src/renderer/pages/MonitoringPage.tsx`
- `apps/workflow-studio/src/renderer/App.tsx` (add tab)

Create the page layout: two-column with a left sidebar (SummaryCards + AgentSelector +
SessionList) and a right main area (EventStream on top, WorkflowView below). Add a "Monitoring"
tab to the top navigation bar in `App.tsx` (next to Execute tab).

**Estimate:** 1 hour
**Depends on:** T06

---

### T08 — SummaryCards component

**File:** `apps/workflow-studio/src/renderer/components/monitoring/SummaryCards.tsx`

Four metric cards reading from `monitoringStore.stats` (uses committed `TelemetryStats` type):
- **Total Events** — `stats.totalEvents`
- **Active Sessions** — `stats.activeSessions`
- **Error Rate** — `(stats.errorRate * 100).toFixed(1)%`
- **Total Cost** — `$${stats.totalCostUsd.toFixed(4)}`

Cards animate on value change using CSS transition. No external animation library.

**Estimate:** 1 hour
**Depends on:** T07

---

### T09 — EventStream component

**File:** `apps/workflow-studio/src/renderer/components/monitoring/EventStream.tsx`

Virtualized table (use `react-window` if already in deps, else plain `<tbody>`) showing
`monitoringStore.filteredEvents` newest-first:

| Column | Source field |
|--------|-------------|
| Time | `timestamp` (relative, e.g. "2s ago") |
| Agent | `agentId` |
| Type | `type` badge |
| Tool / Command | `toolName` or `command` |
| Paths | `filePaths` (comma-separated, truncated) |
| Details | `toolResultSummary` or `errorMessage` |

- Rows with `lifecycle: error` highlighted in red
- Auto-scroll to top on new event (only when user is already at top)
- Row click shows full event JSON in a collapsible panel below the table

**Estimate:** 1.5 hours
**Depends on:** T07

---

### T10 — AgentSelector component

**File:** `apps/workflow-studio/src/renderer/components/monitoring/AgentSelector.tsx`

Dropdown that reads unique `agentId` values from `monitoringStore.sessions`. Default is "All
agents". On selection, calls `monitoringStore.setSelectedAgentId(id)`. Shows agent count badge.

**Estimate:** 0.5 hours
**Depends on:** T07

---

### T11 — SessionList component

**File:** `apps/workflow-studio/src/renderer/components/monitoring/SessionList.tsx`

Renders `monitoringStore.sessions` as a compact list:
- Active sessions at top with a green dot indicator
- Each item: `agentId`, `startedAt` relative time, event count, cost, status badge
- Click selects the session (sets `selectedAgentId` to that session's `agentId` and filters
  the event stream to that session's `sessionId`)
- Ended sessions shown with muted style and `completedAt`

**Estimate:** 1 hour
**Depends on:** T07

---

### T12 — WorkflowView component

**File:** `apps/workflow-studio/src/renderer/components/monitoring/WorkflowView.tsx`

Table of active containers (one row per active `AgentSession`):

| Column | Source |
|--------|--------|
| Agent | `agentId` |
| Step | `currentStepIndex` + `currentStepName` |
| Elapsed | Time since last `stepStart` event |
| Status | "Running" / "Initializing" / "Error" / "Complete" |

- Rows update in real time as `lifecycle` events arrive
- Completed/errored sessions are removed after 60 seconds

**Estimate:** 1 hour
**Depends on:** T07

---

## Phase 3: Container Hook + Tests (T13–T15)

### T13 — docker-telemetry-hook.py

**File:** `scripts/hooks/docker-telemetry-hook.py`

A Python 3 hook script (stdlib only) that:
- Reads hook payload JSON from stdin
- Extracts `toolName`, `toolInput`, `toolResult`, `sessionId`, `type` from the payload
- Reads `TELEMETRY_URL` env var (default: no-op if not set)
- Reads `CLAUDE_INSTANCE_ID` for `agentId`; falls back to `socket.gethostname()`
- Reads `containerId` from `/proc/self/cgroup` (first 12 chars of container hash) or `hostname`
- Truncates `toolInput` / `toolResult` JSON strings to 512 chars
- Sends `TelemetryEvent` via `urllib.request.urlopen` with a 2-second timeout
- On any exception: logs to stderr (not stdout), exits 0 (never blocks Claude CLI)
- Supports hook types: `PostToolUse` → `tool_call`, `PreToolUse` → `tool_call` (pending),
  `SubagentStart` → `lifecycle: start`, `Stop` → `lifecycle: finalized`

Also update `docker/*/Dockerfile` base images to copy this script into
`.claude/hooks/docker-telemetry-hook.py` and add the hook entry to the container's
`.claude/settings.json`.

**Estimate:** 2 hours
**Depends on:** T01 (schema reference)

---

### T14 — Unit tests: TelemetryReceiver + MonitoringStore

**Files:**
- `apps/workflow-studio/src/main/services/__tests__/telemetry-receiver.test.ts`
- `apps/workflow-studio/src/main/services/__tests__/monitoring-store.test.ts`

**TelemetryReceiver tests:**
- Valid POST → 202, event added to store
- Malformed JSON → 400
- Missing required field → 400
- GET /health → 200
- Unknown route → 404
- Port in use → emits `receiver:unavailable`, does not throw

**MonitoringStore tests:**
- `append` adds event and emits `'event'`
- Ring buffer evicts oldest when >10,000 events
- Session created on first event for new `sessionId`
- Session `completedAt` set on `lifecycleStage: finalized`
- `getStats` computes correct `activeSessions`, `errorRate`, `totalCostUsd`
- `getEvents` filter by `sessionId`, `eventType`, `since`, `limit`

**Estimate:** 2 hours
**Depends on:** T02, T03

---

### T15 — Unit tests: renderer components + Zustand store

**Files:**
- `apps/workflow-studio/src/renderer/stores/__tests__/monitoringStore.test.ts`
- `apps/workflow-studio/src/renderer/components/monitoring/__tests__/SummaryCards.test.tsx`
- `apps/workflow-studio/src/renderer/components/monitoring/__tests__/EventStream.test.tsx`

**monitoringStore tests:**
- Initial state is empty
- IPC `monitoring:event` push appends to `events`
- `setSelectedAgentId` filters `filteredEvents`
- `filteredEvents` returns all when `selectedAgentId` is null

**Component tests (React Testing Library):**
- `SummaryCards` renders correct values from store
- `EventStream` renders event rows and highlights error rows
- `EventStream` shows "No events yet" when empty

**Estimate:** 1.5 hours
**Depends on:** T06, T08, T09

---

## Phase 4: Design Review Findings

### T16 — Reconcile monitoring.ts types with committed code (CRITICAL) --- DONE

**File:** `apps/workflow-studio/src/shared/types/monitoring.ts`

The F07 design.md uses snake_case field names (`event_id`, `session_id`, `agent_id`, etc.) but the
committed monitoring.ts uses camelCase (`id`, `sessionId`, `agentId`). This task reconciles the
design with committed code:

- All new fields must use camelCase: `containerId`, `workflowId`, `nodeId`, `tokenUsage`,
  `lifecycleStage`, `errorCount`, `totalCostUsd`
- The committed `TelemetryStats` (not `MonitoringStats`) type name must be used
- The committed `AgentSessionStatus` type must be preserved
- Update all references in T02–T15 to use camelCase field names

**Estimate:** 1.5 hours
**Depends on:** T01

---

### T17 — Add `TELEMETRY_ENABLED` + `TELEMETRY_URL` env vars to F05 container creation

**File:** `apps/workflow-studio/src/main/services/container-pool.ts` (F05 file)

When F05's `ContainerPool` creates containers, include these environment variables:
- `TELEMETRY_ENABLED=1`
- `TELEMETRY_URL=http://host.docker.internal:<receiverPort>/telemetry`

Read the receiver port from `AppSettings.telemetryReceiverPort` (default 9292).

**Estimate:** 30 minutes
**Depends on:** T01, T05 (also depends on F05 T06)

---

### T18 — Wrap MonitoringStore EventEmitter IPC push in try-catch

**File:** `apps/workflow-studio/src/main/services/monitoring-store.ts`

When `MonitoringStore` emits events and the IPC push calls `mainWindow.webContents.send()`,
wrap in try-catch for the case where the BrowserWindow has been closed or destroyed. Without this,
an unhandled exception crashes the main process when the monitoring tab is closed while events
are still arriving.

Pattern:
```typescript
try {
  mainWindow.webContents.send('monitoring:event', event);
} catch (err) {
  // Window closed — silently ignore
}
```

**Estimate:** 15 minutes
**Depends on:** T04

---

### T19 — Dynamic telemetry receiver start/stop

**File:** `apps/workflow-studio/src/main/services/telemetry-receiver.ts`

Instead of starting the TelemetryReceiver at app startup (which binds a port even when not needed),
implement lazy start/stop:
- Start receiver when user opens the Monitoring tab (via IPC from renderer)
- Stop receiver when Monitoring tab is closed or app quits
- Add `MONITORING_START` / `MONITORING_STOP` IPC channels (or reuse tab navigation events)
- Handle port-bind failure gracefully: renderer shows "Receiver unavailable" message

**Estimate:** 1 hour
**Depends on:** T05

---

### T20 — Document subagent telemetry depth limitation

**File:** Documentation in design.md and code comments

Document that the telemetry hook inside Docker containers only captures top-level tool calls from
the Claude CLI session. If the agent spawns subagents (nested Claude calls), those inner tool calls
are not captured unless the hook is configured recursively inside the subagent's `.claude/settings.json`.

This is a known limitation, not a bug. Add a note to the design.md and a code comment in
`docker-telemetry-hook.py`.

**Estimate:** 15 minutes
**Depends on:** T13

---

## Dependency Graph

```
T01 ──► T02 ──► T04 ──► T05
     └► T03 ──► T04  └► T18 (try-catch IPC push)
                     └► T19 (dynamic start/stop)
                          T06 ──► T07 ──► T08
                                       ├──► T09
                                       ├──► T10
                                       ├──► T11
                                       └──► T12
T01 ──► T13 ──► T20 (document depth limitation)
T01 ──► T16 (reconcile types, CRITICAL)
T01, T05 ──► T17 (telemetry env vars in F05 containers)
T02, T03 ──► T14
T06, T08, T09 ──► T15
```

## Estimates

| Task | Est. Hours |
|------|-----------|
| T01 | 1.5 |
| T02 | 1.5 |
| T03 | 1.5 |
| T04 | 1.0 |
| T05 | 0.5 |
| T06 | 1.5 |
| T07 | 1.0 |
| T08 | 1.0 |
| T09 | 1.5 |
| T10 | 0.5 |
| T11 | 1.0 |
| T12 | 1.0 |
| T13 | 2.0 |
| T14 | 2.0 |
| T15 | 1.5 |
| T16 | 1.5 |
| T17 | 0.5 |
| T18 | 0.25 |
| T19 | 1.0 |
| T20 | 0.25 |
| **Total** | **23.0 hrs** |

All tasks are ≤ 2 hours. Critical path: T01 → T02 → T04 → T05 → (app ready) and
T06 → T07 → T09 → T15 (longest renderer chain). T16 is CRITICAL and should be done
alongside T01 since it affects all downstream field name usage.
