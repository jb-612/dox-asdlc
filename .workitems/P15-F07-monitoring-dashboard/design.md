---
id: P15-F07
parent_id: P15
type: design
version: 1
status: draft
constraints_hash: null
created_by: planner
created_at: "2026-02-22T00:00:00Z"
updated_at: "2026-02-22T00:00:00Z"
dependencies:
  - P14-F04
  - P14-F05
tags:
  - monitoring
  - telemetry
  - docker
  - electron
  - workflow-studio
---

# Design: Monitoring Dashboard (P15-F07)

## Overview

This feature adds a **Monitoring** tab to the Workflow Studio Electron app that shows real-time
telemetry from all running agent Docker containers. It extends the existing aSDLC observability
concept (local Claude Code hooks → SQLite → SSE dashboard) to cover Docker-containerized agents
that cannot write to the host filesystem.

The approach is **additive**: the existing local hook dashboard (`scripts/telemetry/`) continues
to work unchanged. This feature adds a parallel telemetry pipeline scoped to the Electron app.

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| P14-F04 (Execution Walkthrough) | Internal | `ExecutionEngine` class, execution IPC channels |
| P14-F05 (CLI Backend Wiring) | Internal | IPC infrastructure, `monitoringStore` pattern |
| `scripts/telemetry/dashboard_server.py` | Reference | Existing SSE + SQLite pattern to mirror |
| `scripts/telemetry/sqlite_store.py` | Reference | Event schema and session model |
| Claude Code hooks (PostToolUse, PreToolUse) | External | Source of tool-call telemetry inside containers |

## Architecture

> Diagram: [`docs/diagrams/32-monitoring-dashboard-architecture.mmd`](../../../docs/diagrams/32-monitoring-dashboard-architecture.mmd)

```
Docker Container (Claude CLI agent)
┌──────────────────────────────────────────┐
│  .claude/hooks/ (injected at launch)      │
│  ┌──────────────────────────────────┐    │
│  │  docker-telemetry-hook.py        │    │
│  │  Wraps: PostToolUse, PreToolUse, │    │
│  │         SubagentStart, Stop      │    │
│  └──────────────┬───────────────────┘    │
└─────────────────┼────────────────────────┘
                  │ HTTP POST /telemetry
                  │ (host.docker.internal:9292)
                  ▼
Electron Main Process
┌──────────────────────────────────────────┐
│  TelemetryReceiver (HTTP :9292)           │
│  ┌──────────────────────────────────┐    │
│  │  POST /telemetry → validate →    │    │
│  │  MonitoringStore.append(event)   │    │
│  └──────────────┬───────────────────┘    │
│                 │                        │
│  MonitoringStore (in-memory + optional   │
│  SQLite flush)                           │
│  ┌──────────────────────────────────┐    │
│  │  events: TelemetryEvent[]        │    │
│  │  sessions: AgentSession[]        │    │
│  │  broadcast → mainWindow IPC      │    │
│  └──────────────┬───────────────────┘    │
└─────────────────┼────────────────────────┘
                  │ ipcMain → ipcRenderer
                  │ channel: monitoring:event
                  ▼
Renderer (React)
┌──────────────────────────────────────────┐
│  monitoringStore (Zustand)               │
│  ┌──────────────────────────────────┐    │
│  │  events[], sessions[], stats{}   │    │
│  └──────────────┬───────────────────┘    │
│                 │                        │
│  MonitoringPage → MonitoringTab          │
│  ┌──────────────────────────────────┐    │
│  │  SummaryCards                    │    │
│  │  AgentSelector + EventStream     │    │
│  │  SessionList                     │    │
│  │  WorkflowView                    │    │
│  └──────────────────────────────────┘    │
└──────────────────────────────────────────┘
```

## Telemetry Event Schema

All events share a common envelope. The `type` field discriminates the payload.

**CRITICAL:** The committed `monitoring.ts` already exists and uses **camelCase** field names
(TypeScript convention). All types below use camelCase to match the committed code. The committed
types are: `TelemetryEvent`, `AgentSession`, `TelemetryStats` (not `MonitoringStats`),
`TelemetryEventType`, `AgentSessionStatus`.

```typescript
// EXTENDS existing: apps/workflow-studio/src/shared/types/monitoring.ts
// The base types (TelemetryEvent, AgentSession, TelemetryStats) already exist.
// This design describes the EXTENDED versions with additional fields.

export type LifecycleStage =
  | 'start'
  | 'stepStart'
  | 'stepComplete'
  | 'finalized'
  | 'error';

// Already committed — preserved as-is:
export type TelemetryEventType =
  | 'agent_start'
  | 'agent_complete'
  | 'agent_error'
  | 'tool_call'
  | 'bash_command'
  | 'metric'
  | 'custom';

export interface TelemetryEvent {
  // --- Envelope (already committed) ---
  id: string;                    // UUID v4
  type: TelemetryEventType;     // Committed field name (not event_type)
  agentId: string;               // CLAUDE_INSTANCE_ID or container hostname
  timestamp: string;             // ISO 8601
  data: unknown;                 // Committed field — generic payload
  sessionId?: string;            // CLAUDE_SESSION_ID from container env

  // --- New fields (F07 additions) ---
  containerId?: string;          // Docker container ID (first 12 chars)
  workflowId?: string;           // Workflow execution ID
  nodeId?: string;               // Workflow node being executed

  // --- tool_call ---
  toolName?: string;             // e.g. "Read", "Write", "Bash", "Edit"
  toolInputSummary?: string;     // Truncated JSON of tool arguments
  filePaths?: string[];          // Extracted file paths from tool input
  toolResultSummary?: string;    // Truncated tool result
  toolExitCode?: number;         // For Bash tool

  // --- bash_command ---
  command?: string;              // Shell command string (truncated at 512 chars)
  commandExitCode?: number;

  // --- lifecycle ---
  lifecycleStage?: LifecycleStage;
  stepIndex?: number;
  stepName?: string;
  errorMessage?: string;

  // --- token_usage ---
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
    model: string;
  };
}

export interface AgentSession {
  // --- Already committed ---
  sessionId: string;
  agentId: string;
  startedAt: string;
  completedAt?: string;          // Committed field (not ended_at)
  status: AgentSessionStatus;    // Committed type
  eventCount: number;

  // --- New fields (F07 additions) ---
  containerId?: string;
  currentStepIndex?: number;
  currentStepName?: string;
  totalCostUsd: number;
  errorCount: number;
}

// Committed name is TelemetryStats (not MonitoringStats)
export interface TelemetryStats {
  // --- Already committed ---
  totalEvents: number;
  errorRate: number;             // errors / totalEvents
  eventsPerMinute: number;
  activeSessions: number;        // Committed field (not active_agents)
  byType: Record<TelemetryEventType, number>;

  // --- New fields (F07 additions) ---
  totalCostUsd: number;
}

export interface EventFilter {
  sessionId?: string;
  eventType?: TelemetryEventType;
  since?: string;    // ISO 8601
  limit?: number;
}
```

### HTTP Receiver Endpoint

```
POST http://localhost:9292/telemetry
Content-Type: application/json
Authorization: Bearer <MONITORING_TOKEN>   (optional, default: no auth)

Body: TelemetryEvent (JSON)

Response: 202 Accepted | 400 Bad Request | 401 Unauthorized
```

## Component Interfaces

### TelemetryReceiver (main process service)

```typescript
// src/main/services/telemetry-receiver.ts
class TelemetryReceiver {
  constructor(port: number, token?: string, store: MonitoringStore);
  start(): Promise<void>;       // binds HTTP server
  stop(): Promise<void>;        // graceful shutdown
  readonly port: number;
}
```

### MonitoringStore (main process, in-memory)

```typescript
// src/main/services/monitoring-store.ts
class MonitoringStore {
  append(event: TelemetryEvent): void;
  getSessions(): AgentSession[];
  getEvents(filter?: EventFilter): TelemetryEvent[];
  getStats(): TelemetryStats;  // Uses committed TelemetryStats type
  on('event', handler: (e: TelemetryEvent) => void): void;
}
```

**EventEmitter exception handling:** When pushing events to the renderer via
`mainWindow.webContents.send()`, wrap in try-catch to handle the case where the
BrowserWindow has been closed:

```typescript
store.on('event', (event) => {
  try {
    mainWindow.webContents.send('monitoring:event', event);
  } catch {
    // Window closed or destroyed — silently ignore
  }
});
```

### IPC Channels

| Channel | Direction | Payload |
|---------|-----------|---------|
| `monitoring:event` | main → renderer | `TelemetryEvent` (live push) |
| `monitoring:get-events` | renderer → main | `EventFilter` → `TelemetryEvent[]` |
| `monitoring:get-sessions` | renderer → main | void → `AgentSession[]` |
| `monitoring:get-stats` | renderer → main | void → `TelemetryStats` |

### docker-telemetry-hook.py (container hook)

The hook script is injected into each container at launch by setting the
`CLAUDE_CODE_HOOKS` environment variable (or by bind-mounting `.claude/settings.json`).
It wraps PostToolUse, PreToolUse, SubagentStart, and Stop events.

```python
# scripts/hooks/docker-telemetry-hook.py
# Usage: TELEMETRY_URL=http://host.docker.internal:9292/telemetry python docker-telemetry-hook.py
# Reads hook payload from stdin, emits TelemetryEvent via HTTP POST, passes through exit code.
```

## Port Conflict Handling

When the TelemetryReceiver attempts to bind its port (default 9292) and the port is already in use:

1. The receiver emits a `receiver:unavailable` event (does not crash).
2. The renderer's Monitoring tab checks receiver availability on mount.
3. If unavailable, show a banner: "Telemetry receiver unavailable — port 9292 in use."
4. User can change the port in Settings (Environment tab) and retry.

Consider implementing **dynamic telemetry receiver start/stop**: only bind the port when the user
opens the Monitoring tab, and release it when they navigate away. This avoids port conflicts when
the monitoring feature is not actively used.

## Ring Buffer Memory Budget

The MonitoringStore ring buffer holds up to 10,000 `TelemetryEvent` objects. To prevent memory
bloat from large payloads:

- Cap per-event size at **10KB** (truncate `data`, `toolInputSummary`, `toolResultSummary` fields
  if they exceed this).
- At 10KB per event × 10,000 events = **~100MB** maximum memory footprint.
- If memory pressure is detected, consider reducing the buffer size or flushing to SQLite.

## ExtraHosts Requirement for Linux Docker

Containers need to reach the host's TelemetryReceiver at `host.docker.internal:9292`. On Linux,
`host.docker.internal` is not natively available in Docker. The solution:

- F05's `ContainerPool.createContainer()` must include `ExtraHosts: ['host.docker.internal:host-gateway']`
  in the `HostConfig`.
- F06's `docker run` command must include `--add-host=host.docker.internal:host-gateway`.
- This is harmless on macOS/Windows where `host.docker.internal` already resolves.

## Subagent Telemetry Depth Limitation

The `docker-telemetry-hook.py` script captures tool calls from the top-level Claude CLI session
inside the container. If the agent spawns subagents (nested Claude calls), the inner tool calls
are **not captured** unless the hook is configured recursively in the subagent's
`.claude/settings.json`.

This is a known limitation. For MVP, only top-level tool calls are tracked. Recursive hook
configuration is deferred to a follow-on feature.

## Architecture Decisions

### Why HTTP POST (not Redis pub/sub or WebSocket)?

| Option | Pros | Cons |
|--------|------|------|
| **HTTP POST (chosen)** | Simplest; no Redis dependency; works across Docker networks; Electron can bind a port easily | Request-response latency; no streaming |
| Redis pub/sub | Already in stack; decouples sender/receiver | Adds Redis dependency inside containers; requires Redis accessible from containers |
| WebSocket | Full duplex; low latency | Electron must run WS server; more complex hook client |

HTTP POST is the lowest-friction option. The hook script is a simple `urllib.request` call with
no dependencies beyond the Python standard library (matching `dashboard_server.py` approach).

### Why in-memory MonitoringStore (not SQLite)?

The in-process store avoids file I/O latency for live event streaming. Capacity is bounded at
10,000 events in a ring buffer (configurable). Persistence is optional via periodic flush to
`userData/monitoring.db` — deferred to a follow-on feature.

### Hook Injection Strategy

Containers launched by the execution engine receive two additional environment variables
(injected by F05's `ContainerPool.createContainer()`):

```
TELEMETRY_ENABLED=1
TELEMETRY_URL=http://host.docker.internal:9292/telemetry
```

These environment variables must be added to F05's container creation options (see F05 T17).

The `docker-telemetry-hook.py` script reads `TELEMETRY_URL` and is pre-configured in the
container's `.claude/settings.json` as a PostToolUse + PreToolUse hook (similar to the
existing `hook-wrapper.py` pattern).

## File Structure

```
apps/workflow-studio/src/
├── shared/types/
│   └── monitoring.ts                      # TelemetryEvent, AgentSession, TelemetryStats (existing file — UPDATE)
├── main/
│   ├── services/
│   │   ├── telemetry-receiver.ts          # HTTP server (POST /telemetry)
│   │   └── monitoring-store.ts            # In-memory ring buffer + session tracking
│   └── ipc/
│       └── monitoring-handlers.ts         # IPC handlers for renderer queries
└── renderer/
    ├── stores/
    │   └── monitoringStore.ts             # Zustand store with IPC integration
    ├── components/
    │   └── monitoring/
    │       ├── index.ts                   # Barrel export
    │       ├── MonitoringTab.tsx          # Page layout
    │       ├── SummaryCards.tsx           # Stats cards (events, agents, cost, errors)
    │       ├── AgentSelector.tsx          # Dropdown to pick agent/container
    │       ├── EventStream.tsx            # Live-updating event table
    │       ├── SessionList.tsx            # Active + recent sessions
    │       └── WorkflowView.tsx           # Step-by-step status per container
    └── pages/
        └── MonitoringPage.tsx             # Route page wrapper

scripts/hooks/
└── docker-telemetry-hook.py              # Container-side hook script

docs/diagrams/
└── 32-monitoring-dashboard-architecture.mmd
```
