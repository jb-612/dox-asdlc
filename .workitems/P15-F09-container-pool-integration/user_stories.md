---
id: P15-F09
parent_id: P15
type: user_stories
version: 1
status: draft
created_by: planner
created_at: "2026-02-26T00:00:00Z"
updated_at: "2026-02-26T00:00:00Z"
---

# User Stories: Container Pool Integration (P15-F09)

## US-01: Run Parallel Block Workflows

**As a** workflow author,
**I want to** execute workflows with parallel groups using Docker containers,
**So that** multiple blocks run concurrently and results are merged automatically.

### Acceptance Criteria

- [ ] Workflows with `parallelGroups` execute blocks in parallel Docker containers
- [ ] Sequential workflows (no parallelGroups) continue using existing CLISpawner
- [ ] Execution events stream to the EventLogPanel during parallel execution
- [ ] Final merged output appears in the deliverables viewer

## US-02: See Container Status

**As a** workflow operator,
**I want to** see the status of running containers in the ContainerPoolPanel,
**So that** I know which blocks are executing and their health state.

### Acceptance Criteria

- [ ] ContainerPoolPanel shows live container states (starting, idle, busy, dormant)
- [ ] Container count, active count, and health status visible
- [ ] Panel updates in real-time via IPC events from the pool

## US-03: Resolve Merge Conflicts

**As a** workflow operator,
**I want to** see and resolve file conflicts when parallel blocks modify the same file,
**So that** I maintain control over the final output.

### Acceptance Criteria

- [ ] When parallel blocks produce conflicting file changes, a dialog appears
- [ ] Dialog shows which file, which blocks modified it, and resolution options
- [ ] Per-file resolution: "Keep Block A", "Keep Block B", "Abort Execution"
- [ ] Execution pauses until all conflicts are resolved
- [ ] Resolved files are written to the merged output

## US-04: Configure Container Pool Settings

**As a** workflow administrator,
**I want to** configure the Docker image and dormancy timeout in Settings,
**So that** I control which image containers use and how long idle containers persist.

### Acceptance Criteria

- [ ] Settings > Environment shows "Container Image" text input (default: asdlc-agent:1.0.0)
- [ ] Settings > Environment shows "Dormancy Timeout" numeric input in seconds (default: 300)
- [ ] Changes take effect on next workflow execution (no app restart required)
- [ ] Invalid image reference shows validation error

## US-05: Graceful Degradation Without Docker

**As a** user without Docker installed,
**I want to** see a clear error message when attempting parallel workflows,
**So that** I understand what's needed without the app crashing.

### Acceptance Criteria

- [ ] App starts normally when Docker is not available
- [ ] Sequential workflows work without Docker
- [ ] Attempting a parallel workflow shows: "Docker is required for parallel execution"
- [ ] ContainerPoolPanel shows "Docker not available" state

## US-06: Container Telemetry

**As a** workflow operator,
**I want** container tool calls to appear in the Monitoring dashboard,
**So that** I have full observability over parallel block execution.

### Acceptance Criteria

- [ ] Containers receive TELEMETRY_ENABLED and TELEMETRY_URL env vars
- [ ] Tool calls inside containers appear in the MonitoringPage EventStream
- [ ] Telemetry env vars use the correct port from settings
- [ ] If TelemetryReceiver is not running, containers start without telemetry (no error)
