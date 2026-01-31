# P02-F08: Agent Telemetry API - User Stories

## US-01: View All Agent Status
**As a** developer **I want** to see all agent statuses **So that** I can monitor system activity

**Acceptance Criteria:**
- GET /api/agents/status returns list of all agents
- Each shows: id, type, status, current_task, progress
- Response time < 200ms

## US-02: View Agent Logs
**As a** developer **I want** to view agent logs **So that** I can debug issues

**Acceptance Criteria:**
- GET /api/agents/{id}/logs returns recent logs
- Supports limit (default 100) and level filter
- Returns 404 for unknown agent

## US-03: View Metrics
**As a** PM **I want** aggregate metrics **So that** I understand performance

**Acceptance Criteria:**
- GET /api/agents/metrics returns metrics by type
- Includes: executions, success_rate, avg_duration

## US-04: Real-time Updates
**As a** developer **I want** real-time updates **So that** I see progress live

**Acceptance Criteria:**
- WS /ws/agents broadcasts status changes
- Supports heartbeat for connection health
