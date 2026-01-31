# P02-F08: Agent Telemetry API

## Overview
REST API and WebSocket endpoints for real-time agent activity monitoring.

## Dependencies
- P01-F01: Core infrastructure (Redis)
- P04-F03: Development Agents (agents to monitor)

## Interfaces

### REST Endpoints

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| /api/agents/status | GET | All agent statuses | Implemented |
| /api/agents/{id}/logs | GET | Agent logs with limit/level filters | Implemented |
| /api/agents/{id}/detail | GET | Full agent detail | **NOT IMPLEMENTED** |
| /api/agents/metrics | GET | Aggregated metrics by type | Implemented |
| /api/agents/timeline | GET | Execution timeline for Gantt view | **NOT IMPLEMENTED** |
| /ws/agents | WS | Real-time updates | Partial (no broadcast) |

### Query Parameters

**GET /api/agents/{id}/logs:**
- `limit` (int, 1-1000, default 100): Maximum logs to return
- `level` (enum): Filter by log level

**GET /api/agents/metrics:**
- `timeRange` (string): Time range filter (1h, 24h, 7d) - **NOT IMPLEMENTED**

**GET /api/agents/timeline:**
- `timeRange` (string): Time range for timeline data - **NOT IMPLEMENTED**

### Canonical Data Models

These models define the contract between backend and frontend. Both must use identical field names.

```python
# Status Enum - MUST be identical in backend and frontend
class AgentStatusEnum(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    BLOCKED = "blocked"
    ERROR = "error"       # Backend uses "error"
    COMPLETED = "completed"

# Agent Type Enum
class AgentTypeEnum(str, Enum):
    WORKER = "worker"
    ORCHESTRATOR = "orchestrator"
    VALIDATOR = "validator"
    DISCOVERY = "discovery"
    CODING = "coding"
    TEST = "test"
    DESIGN = "design"

# Log Level Enum
class AgentLogLevel(str, Enum):
    DEBUG = "debug"
    INFO = "info"
    WARN = "warn"
    ERROR = "error"
```

**AgentStatus Model:**
```typescript
interface AgentStatus {
  agent_id: string;        // Canonical: agent_id (not "id")
  agent_type: AgentTypeEnum;  // Canonical: agent_type (not "type")
  status: AgentStatusEnum;
  current_task: string | null;
  progress: number;        // 0-100
  last_updated: string;    // ISO 8601 timestamp
  error_message?: string;
  // Optional extended fields
  session_id?: string;
  started_at?: string;
  last_heartbeat?: string;
  metadata?: Record<string, unknown>;
}
```

**AgentLog Model:**
```typescript
interface AgentLog {
  timestamp: string;       // ISO 8601
  level: AgentLogLevel;
  message: string;
  agent_id: string;
  task_id?: string;
  context?: Record<string, unknown>;
}
```

**AgentMetrics Model:**
```typescript
interface AgentMetrics {
  agent_type: AgentTypeEnum;
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
  success_rate: number;    // 0.0-1.0
  avg_duration_ms: number;
  total_tokens_used: number;
}

interface AgentMetricsResponse {
  metrics: AgentMetrics[];
  summary: {
    total_agents: number;
    active_agents: number;
    overall_success_rate: number;
  };
  time_range: string;
  timestamp: string;
}
```

**AgentTimelineEntry Model:**
```typescript
interface AgentTimelineEntry {
  agent_id: string;
  agent_type: AgentTypeEnum;
  task_id: string;
  task_name: string;
  status: AgentStatusEnum;
  start_time: string;
  end_time?: string;
  duration_ms?: number;
}

interface AgentTimelineResponse {
  entries: AgentTimelineEntry[];
  time_range: {
    start: string;
    end: string;
  };
}
```

### WebSocket Protocol

**Connection:** `ws://host/ws/agents`

**Client -> Server Messages:**
```json
{"type": "ping"}
{"type": "heartbeat"}
{"type": "subscribe", "channel": "status"}
```

**Server -> Client Messages:**
```json
{"type": "pong", "timestamp": "..."}
{"type": "heartbeat", "timestamp": "..."}
{"type": "status_update", "data": {...}, "timestamp": "..."}
{"type": "error", "message": "..."}
```

**Broadcast Requirement (NOT IMPLEMENTED):**
Server SHOULD broadcast status changes to all connected clients when agent status changes in Redis. Current implementation only responds to explicit subscribe requests.

## Error Handling

| Status Code | Condition | Response |
|-------------|-----------|----------|
| 200 | Success | Data payload |
| 404 | Agent not found | `{"detail": "Agent not found"}` |
| 422 | Invalid parameters | Validation error details |
| 503 | Service unavailable | `{"detail": "Service temporarily unavailable"}` |

**Security:** Error responses MUST NOT expose internal error details.

## File Structure
```
src/orchestrator/
├── routes/agents_api.py          # REST + WS endpoints
├── services/agent_telemetry.py   # Business logic
└── api/models/agent_telemetry.py # Pydantic models

tests/unit/orchestrator/
├── routes/test_agents_api.py
└── services/test_agent_telemetry.py
```

## Redis Keys
- `agent:status:{id}` - JSON status (TTL: 5 min)
- `agent:logs:{id}` - Log list (capped 1000)
- `agent:metrics:{type}` - Metrics JSON
- `agent:active` - Set of active agent IDs
- `agent:timeline:{id}` - Timeline entries list

## Implementation Gaps

| Gap | Priority | Issue |
|-----|----------|-------|
| GET /api/agents/{id}/detail | Critical | Service method exists, route missing |
| GET /api/agents/timeline | Critical | Required for US-05 timeline view |
| WebSocket broadcast | Warning | Only responds, doesn't push changes |
| timeRange parameter | Warning | Frontend sends, backend ignores |
| 404 for unknown agent | Warning | Returns empty list instead |

## Architecture Diagram

See `docs/diagrams/agent-telemetry-flow.mmd` (to be created)
