# P02-F08: Agent Telemetry API - Tasks

## Progress
- Started: 2026-01-29
- Tasks Complete: 10/10
- Percentage: 100%
- Status: COMPLETE

---

### T01: Create AgentTelemetryService class
- [x] Estimate: 1hr
- [x] Tests: tests/unit/orchestrator/services/test_agent_telemetry.py
- [x] Dependencies: None
- [x] Notes: Core service with Redis client, status/log CRUD
- [x] Files: src/orchestrator/services/agent_telemetry.py, src/orchestrator/api/models/agent_telemetry.py

### T02: Implement get_all_agent_status()
- [x] Estimate: 30min
- [x] Tests: tests/unit/orchestrator/services/test_agent_telemetry.py
- [x] Dependencies: T01
- [x] Notes: Returns list of AgentStatus from agent:active set and agent:status:{id} keys

### T03: Implement get_agent_logs()
- [x] Estimate: 30min
- [x] Tests: tests/unit/orchestrator/services/test_agent_telemetry.py
- [x] Dependencies: T01
- [x] Notes: Returns logs from agent:logs:{id} list with limit/level filtering

### T04: Implement get_agent_metrics()
- [x] Estimate: 30min
- [x] Tests: tests/unit/orchestrator/services/test_agent_telemetry.py
- [x] Dependencies: T01
- [x] Notes: Returns metrics from agent:metrics:{type} keys

### T05: Create agents_api.py router
- [x] Estimate: 30min
- [x] Tests: tests/unit/orchestrator/routes/test_agents_api.py
- [x] Dependencies: T01
- [x] Files: src/orchestrator/routes/agents_api.py

### T06: Implement GET /api/agents/status
- [x] Estimate: 30min
- [x] Tests: tests/unit/orchestrator/routes/test_agents_api.py
- [x] Dependencies: T05, T02
- [x] Notes: Returns AgentStatusResponse with list of agent statuses

### T07: Implement GET /api/agents/{id}/logs
- [x] Estimate: 30min
- [x] Tests: tests/unit/orchestrator/routes/test_agents_api.py
- [x] Dependencies: T05, T03
- [x] Notes: Returns AgentLogsResponse with limit (1-1000) and level filters

### T08: Implement GET /api/agents/metrics
- [x] Estimate: 30min
- [x] Tests: tests/unit/orchestrator/routes/test_agents_api.py
- [x] Dependencies: T05, T04
- [x] Notes: Returns AgentMetricsResponse with metrics by agent type

### T09: Implement WebSocket /ws/agents
- [x] Estimate: 1hr
- [x] Tests: tests/unit/orchestrator/routes/test_agents_api.py
- [x] Dependencies: T05
- [x] Notes: ConnectionManager with ping/pong, heartbeat, subscribe support

### T10: Register router in main.py
- [x] Estimate: 15min
- [x] Tests: tests/unit/orchestrator/routes/test_agents_api.py
- [x] Dependencies: T06, T07, T08, T09
- [x] Files: src/orchestrator/main.py (added agents_api_router and agents_ws_router)

---

## Test Summary
- Service tests: 18 tests passing
- Route tests: 24 tests passing
- Total: 42 tests passing
