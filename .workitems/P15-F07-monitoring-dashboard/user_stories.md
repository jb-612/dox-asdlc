---
id: P15-F07
parent_id: P15
type: user_stories
version: 1
status: draft
constraints_hash: null
created_by: planner
created_at: "2026-02-22T00:00:00Z"
updated_at: "2026-02-22T00:00:00Z"
---

# User Stories: Monitoring Dashboard (P15-F07)

## Epic Summary

As a workflow developer using the aSDLC Workflow Studio, I want real-time visibility into what
all running agent containers are doing — what tools they call, what commands they run, and how
much they cost — so that I can debug failures, monitor progress, and attribute costs without
leaving the Workflow Studio app.

---

## US-01: Live Event Stream

**As a** workflow developer,
**I want** a live stream of telemetry events from all running agent containers,
**So that** I can see in real time which tools agents are calling and what files they are
accessing, without tailing Docker logs.

### Acceptance Criteria

- [ ] The Monitoring tab shows an EventStream table that updates automatically as events arrive
- [ ] Each row shows: timestamp, agent ID, event type, tool/command name, and file paths (if any)
- [ ] New events appear at the top of the table within 1 second of the container emitting them
- [ ] The table scrolls smoothly and does not lose scroll position when new events arrive unless
      the user is at the top (latest events)
- [ ] Events with `event_type: bash_command` show the truncated command string

---

## US-02: Per-Agent View

**As a** workflow developer running a multi-container workflow,
**I want** to filter the event stream to a single agent/container,
**So that** I can focus on one agent's behavior without noise from other containers.

### Acceptance Criteria

- [ ] An AgentSelector dropdown lists all active and recently active containers by `agent_id`
- [ ] Selecting an agent filters the EventStream to show only that agent's events
- [ ] Selecting "All agents" (default) shows the combined event stream
- [ ] The AgentSelector auto-populates as new containers emit their first event (no page reload
      needed)

---

## US-03: Summary Dashboard

**As a** DevOps operator,
**I want** summary cards that aggregate telemetry across all active agents,
**So that** I can quickly assess the overall health and cost of a running workflow.

### Acceptance Criteria

- [ ] Four summary cards are shown: Total Events, Active Agents, Error Rate, Total Cost (USD)
- [ ] Cards update with each incoming telemetry event (live, no refresh required)
- [ ] Error Rate shows `(error lifecycle events) / (total events)` as a percentage
- [ ] Total Cost shows cumulative `estimated_cost_usd` summed across all `token_usage` events
- [ ] Active Agents shows the count of containers that have sent a `lifecycle: start` event but
      not yet a `lifecycle: finalized` or `lifecycle: error` event

---

## US-04: Session List

**As a** workflow developer,
**I want** a list of all active and recently completed workflow sessions,
**So that** I can see which runs are still in progress and which have finished, with their
start time, end time, and total cost.

### Acceptance Criteria

- [ ] SessionList shows each `AgentSession` with: agent ID, container ID, started_at, ended_at
      (or "running"), event count, error count, total cost
- [ ] A new entry appears when a container emits `lifecycle: start`
- [ ] `ended_at` is populated when a container emits `lifecycle: finalized` or `lifecycle: error`
- [ ] Sessions are sorted with active (no `ended_at`) first, then most recently started
- [ ] Clicking a session row filters the EventStream to that session (same as AgentSelector but
      session-scoped)

---

## US-05: Workflow Step View

**As a** PM CLI operator,
**I want** to see which workflow step each container is currently executing,
**So that** I can monitor DAG progress without clicking into individual agent logs.

### Acceptance Criteria

- [ ] WorkflowView shows a row per active container with: agent ID, current step index, current
      step name, and time elapsed in current step
- [ ] Step index and name update when a `lifecycle: step_start` event is received
- [ ] A step marked "complete" via `lifecycle: step_complete` shows in a muted/completed style
- [ ] Containers with no `step_start` event yet show "Initializing"
- [ ] Containers with `lifecycle: error` show the step name where the error occurred

---

## US-06: Container Hook Telemetry

**As a** workflow developer running agents in Docker,
**I want** agent containers to automatically emit telemetry without modifying agent prompts or
workflow definitions,
**So that** observability is transparent and does not affect agent behavior.

### Acceptance Criteria

- [ ] Containers launched with `TELEMETRY_URL` set automatically emit PostToolUse, PreToolUse,
      SubagentStart, and Stop events via HTTP POST
- [ ] The hook script (`docker-telemetry-hook.py`) has no external Python dependencies
- [ ] Hook failures (e.g., receiver not reachable) are silent: the hook exits 0 and does not
      block the Claude CLI from proceeding
- [ ] Tool input and result payloads are truncated to 512 characters before sending to prevent
      large event payloads
- [ ] The hook correctly populates `container_id` from the `hostname` command or
      `/proc/self/cgroup`

---

## US-07: Graceful Startup and Shutdown

**As a** Workflow Studio user,
**I want** the telemetry receiver to start and stop reliably with the app,
**So that** I do not need to manage a separate process or port conflicts manually.

### Acceptance Criteria

- [ ] The telemetry receiver starts automatically when Workflow Studio launches and binds to
      `localhost:9292`
- [ ] If port 9292 is already in use, the app logs a warning and the Monitoring tab shows a
      "Receiver unavailable" notice rather than crashing
- [ ] The receiver shuts down gracefully when the app quits (all in-flight requests complete
      before the port is released)
- [ ] The port is configurable via AppSettings (`telemetryReceiverPort`, default `9292`)
