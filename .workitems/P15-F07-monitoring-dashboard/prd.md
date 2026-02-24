---
id: P15-F07
parent_id: P15
type: prd
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

# PRD: Monitoring Dashboard (P15-F07)

## Business Intent

The P14 Workflow Studio can execute multi-agent DAG workflows in Docker containers, but operators
have no live visibility into what those containers are doing. Without telemetry, debugging a
stuck or failing workflow requires `docker logs` inspection and guesswork.

This feature embeds a Monitoring tab in the Workflow Studio UI that streams real-time telemetry
from all active agent containers: tool calls, bash commands, lifecycle transitions, and LLM token
costs. It extends the proven aSDLC hook telemetry architecture to the Docker layer, giving
developers the same observability they have for local CLI sessions, directly inside the app.

## Success Metrics

| Metric | Target |
|--------|--------|
| Telemetry events received from active containers appear in UI | ≤ 1 second end-to-end latency |
| Summary cards update with each new event | Live (no manual refresh required) |
| Per-agent event stream shows tool calls with file paths | 100% of tool_call events |
| Session list correctly reflects active vs. completed runs | Accurate to ±1 lifecycle event |
| HTTP receiver handles event bursts without dropping events | 0 drops at ≤ 100 events/sec |
| All new code paths covered by automated tests | ≥ 1 test per code path |

## User Impact

| User | Impact |
|------|--------|
| Workflow developer | Real-time visibility into agent tool usage without leaving the Workflow Studio app |
| DevOps / operator | Can identify stuck agents (no events for > 30s) and error spikes without log tailing |
| PM CLI / orchestrator | Token cost visibility per container enables cost attribution during multi-agent runs |

## Scope

### In Scope

- `TelemetryReceiver`: HTTP server in Electron main process (POST `/telemetry`, port 9292)
- `MonitoringStore`: In-memory ring buffer (10,000 events max) with session tracking
- IPC channels: `monitoring:event` (push), `monitoring:get-events`, `monitoring:get-sessions`, `monitoring:get-stats`
- `monitoringStore` Zustand store in renderer
- **Monitoring tab** in Workflow Studio with:
  - Summary cards (total events, active agents, error rate, cumulative cost)
  - Agent selector (per-container view)
  - Live event stream table (type, tool/command, paths, timestamp)
  - Session list (active + recent, with start/end times and cost)
  - Workflow view (current step per container)
- `docker-telemetry-hook.py`: Container-side hook script (PostToolUse, PreToolUse, SubagentStart, Stop)
- Shared TypeScript types: `TelemetryEvent`, `AgentSession`, `MonitoringStats`
- Architecture diagram: `docs/diagrams/32-monitoring-dashboard-architecture.mmd`
- Unit tests for backend services and renderer components

### Out of Scope

- SQLite persistence of monitoring events (deferred to follow-on)
- Unified view combining local hook telemetry (`~/.asdlc/telemetry.db`) with Docker telemetry
- Authentication on the telemetry receiver (deferred; receiver binds to localhost only)
- Historical replay of past workflow runs
- Alerts or notifications on error thresholds
- Metrics export (Prometheus, VictoriaMetrics integration)
- Mobile or browser-based access (Electron-only)

## Constraints

- Telemetry receiver must bind to `localhost` only to prevent external access
- Container hook script must have no external Python dependencies (stdlib only)
- In-memory store is bounded at 10,000 events to prevent unbounded memory growth
- `host.docker.internal` must be resolvable from containers (standard Docker Desktop behavior on macOS/Windows; Linux requires `--add-host`)

## Acceptance Criteria

1. Starting the Workflow Studio app binds a TCP listener on port 9292 (localhost)
2. A Docker container with `TELEMETRY_URL=http://host.docker.internal:9292/telemetry` and the hook script fires HTTP POST for each PostToolUse event
3. Events appear in the Monitoring tab EventStream within 1 second of the container emitting them
4. SummaryCards update `total_events`, `active_agents`, and `total_cost_usd` with each incoming event
5. Selecting an agent in AgentSelector filters the EventStream to that container's events
6. SessionList shows a new entry when a container emits its first `lifecycle: start` event and marks it ended when `lifecycle: finalized` is received
7. WorkflowView shows the current `step_name` for each active container
8. Stopping the Workflow Studio app gracefully closes the telemetry receiver
9. Unit tests for `TelemetryReceiver`, `MonitoringStore`, and `monitoringStore` (Zustand) pass
