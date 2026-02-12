# P13-F01: Agent Cost Tracker - Tasks

**Version:** 1.0
**Date:** 2026-02-10
**Status:** Not Started

## Progress

- Total Tasks: 18
- Completed: 0
- In Progress: 0
- Remaining: 18

## Phase 1: Core Backend Models and Pricing (backend)

### T01: Create cost data models
- **Owner:** backend
- **Estimate:** 1 hour
- **Story:** US-06
- **Dependencies:** None
- **Files:**
  - `src/core/costs/__init__.py`
  - `src/core/costs/models.py`
  - `tests/unit/core/costs/test_models.py`
- **Description:** Create frozen dataclasses for CostRecord and CostFilter. CostRecord fields: id, timestamp, session_id, agent_id, model, input_tokens, output_tokens, estimated_cost_usd, tool_name, hook_event_id. CostFilter fields: agent_id, session_id, model, date_from, date_to. Include to_dict() and from_dict() methods following the Guideline model pattern.
- **TDD:** Write tests for CostRecord creation, serialization, and CostFilter validation first.
- [ ] Complete

### T02: Create model pricing table
- **Owner:** backend
- **Estimate:** 45 minutes
- **Story:** US-07
- **Dependencies:** None
- **Files:**
  - `src/core/costs/pricing.py`
  - `tests/unit/core/costs/test_pricing.py`
- **Description:** Create MODEL_PRICING dict mapping model name prefixes to (input_rate_per_million, output_rate_per_million) tuples. Include get_pricing(model_name) function that matches by prefix (e.g., "claude-opus" matches "claude-opus-4-6"). Include calculate_cost(model, input_tokens, output_tokens) function. Support environment variable overrides via COST_PRICING_OPUS_INPUT, COST_PRICING_OPUS_OUTPUT, etc. Unknown models fall back to Opus pricing.
- **TDD:** Write tests for exact match, prefix match, fallback to Opus, env var override, and cost calculation.
- [ ] Complete

### T03: Create cost collector
- **Owner:** backend
- **Estimate:** 1 hour
- **Story:** US-06
- **Dependencies:** T01, T02
- **Files:**
  - `src/core/costs/collector.py`
  - `tests/unit/core/costs/test_collector.py`
- **Description:** Create extract_cost_from_hook_event(payload: dict) -> CostRecord | None function. Extract input_tokens, output_tokens from payload["usage"] or payload["response"]["usage"]. Extract model from payload["model"] or session metadata. If token counts are missing, return None (skip). Calculate estimated_cost_usd using pricing.calculate_cost(). Never raise exceptions (return None on any error).
- **TDD:** Write tests for successful extraction, missing usage field, missing model, malformed payload, and cost calculation correctness.
- [ ] Complete

## Phase 2: SQLite Storage Extension (backend)

### T04: Extend SQLite schema with cost_records table
- **Owner:** backend
- **Estimate:** 1 hour
- **Story:** US-06
- **Dependencies:** T01
- **Files:**
  - `scripts/telemetry/sqlite_store.py` (MODIFY)
  - `tests/unit/telemetry/test_sqlite_cost_records.py`
- **Description:** Add cost_records table to _SCHEMA_SQL in sqlite_store.py with columns: id, timestamp, session_id, agent_id, model, input_tokens, output_tokens, estimated_cost_usd, tool_name, hook_event_id, payload_json. Add indexes on timestamp, session_id, agent_id, model. Add functions: record_cost(), get_costs(filters, page, page_size), get_cost_summary(group_by, filters), get_session_costs(session_id). All functions fail silently on write errors (matching existing pattern).
- **TDD:** Write tests for record_cost insertion, get_costs with filters, get_cost_summary grouping by agent/model/day, get_session_costs with model and tool breakdown, pagination, and empty result sets.
- [ ] Complete

### T05: Integrate cost collector into hook-wrapper.py
- **Owner:** backend
- **Estimate:** 45 minutes
- **Story:** US-06
- **Dependencies:** T03, T04
- **Files:**
  - `scripts/hooks/hook-wrapper.py` (MODIFY)
  - `tests/unit/hooks/test_hook_wrapper_cost.py`
- **Description:** After the existing SQLite record_event call in hook-wrapper.py, add a conditional block: if event_type == "PostToolUse", attempt to extract cost using collector.extract_cost_from_hook_event() and write via sqlite_store.record_cost(). Wrap in try/except to never break hooks. Import cost collector lazily (same pattern as sqlite_store import).
- **TDD:** Write tests for: PostToolUse event triggers cost recording, non-PostToolUse events skip cost recording, collector failure does not break hook, cost record contains correct session_id and agent_id from hook context.
- [ ] Complete

## Phase 3: REST API (backend)

### T06: Create API Pydantic models
- **Owner:** backend
- **Estimate:** 45 minutes
- **Story:** US-01, US-04
- **Dependencies:** T01
- **Files:**
  - `src/orchestrator/api/models/costs.py`
  - `tests/unit/orchestrator/api/models/test_costs_models.py`
- **Description:** Create Pydantic models: CostRecordResponse, CostRecordsListResponse (records, total, page, page_size), CostSummaryGroupResponse, CostSummaryResponse (groups, total_cost_usd, total_input_tokens, total_output_tokens, period), SessionCostBreakdownResponse, PricingResponse. Follow the pattern from src/orchestrator/api/models/guardrails.py.
- **TDD:** Write tests for model creation, JSON serialization, and field validation.
- [ ] Complete

### T07: Implement cost API router
- **Owner:** backend
- **Estimate:** 1.5 hours
- **Story:** US-01, US-02, US-03, US-04, US-07
- **Dependencies:** T04, T06
- **Files:**
  - `src/orchestrator/routes/cost_api.py`
  - `tests/unit/orchestrator/routes/test_cost_api.py`
- **Description:** Create FastAPI APIRouter with prefix="/api/costs", tags=["costs"]. Implement 4 endpoints: GET / (list with filters + pagination), GET /summary (grouped aggregation), GET /sessions/{session_id} (per-session breakdown), GET /pricing (model pricing table). Each endpoint reads from sqlite_store using the functions from T04. The SQLite DB path is resolved from environment variable TELEMETRY_DB_PATH or defaults to ~/.asdlc/telemetry.db. Follow the pattern from metrics_api.py and guardrails_api.py.
- **TDD:** Write tests using TestClient for each endpoint: list with no filters, list with agent filter, list with date range, summary grouped by agent, summary grouped by model, session breakdown with valid session, session breakdown with nonexistent session (empty result), pricing endpoint returns all models. Test pagination (page, page_size). Test error handling for invalid parameters.
- [ ] Complete

### T08: Register cost router in orchestrator app
- **Owner:** backend
- **Estimate:** 15 minutes
- **Story:** US-01
- **Dependencies:** T07
- **Files:**
  - `src/orchestrator/routes/__init__.py` (MODIFY or main app file)
- **Description:** Import the cost_api router and register it with the FastAPI app, following the same pattern used for metrics_api and guardrails_api routers.
- **TDD:** Verify the /api/costs endpoint is reachable (integration test or manual check).
- [ ] Complete

## Phase 4: Frontend Types and API Client (frontend)

### T09: Create TypeScript types for costs
- **Owner:** frontend
- **Estimate:** 30 minutes
- **Story:** US-01
- **Dependencies:** None (uses design.md types specification)
- **Files:**
  - `docker/hitl-ui/src/types/costs.ts`
- **Description:** Create TypeScript interfaces: CostRecord, CostSummaryGroup, CostSummaryResponse, SessionCostBreakdown, CostRecordsResponse, ModelPricing, PricingResponse, CostGroupBy union type, CostTimeRange union type. Follow the types pattern from docker/hitl-ui/src/api/types/metrics.ts or docker/hitl-ui/src/types/agents.ts.
- **TDD:** Types are verified at compile time. No runtime tests needed, but ensure types compile with tsc.
- [ ] Complete

### T10: Create mock data for costs
- **Owner:** frontend
- **Estimate:** 45 minutes
- **Story:** US-01, US-02, US-03, US-04
- **Dependencies:** T09
- **Files:**
  - `docker/hitl-ui/src/api/mocks/costs.ts`
  - `docker/hitl-ui/src/api/mocks/index.ts` (MODIFY)
- **Description:** Create mock data generators following the pattern in docker/hitl-ui/src/api/mocks/metrics.ts. Functions: getMockCostSummary(groupBy, timeRange), getMockCostRecords(page, pageSize), getMockSessionCosts(sessionId), getMockPricing(). Generate realistic data with 3-5 agents, 3 models, 10-20 sessions. Export from mocks/index.ts barrel.
- **TDD:** Write a simple test to verify mock functions return valid data matching TypeScript types.
- [ ] Complete

### T11: Create costs API client and React Query hooks
- **Owner:** frontend
- **Estimate:** 1 hour
- **Story:** US-01, US-02, US-03, US-04, US-05, US-07
- **Dependencies:** T09, T10
- **Files:**
  - `docker/hitl-ui/src/api/costs.ts`
  - `docker/hitl-ui/src/api/costs.test.ts`
- **Description:** Create API client following the metrics.ts pattern. Functions: getCostSummary(groupBy, timeRange), getCostRecords(filters), getSessionCosts(sessionId), getPricing(). Each function checks if mock mode is enabled (areMocksEnabled()) and returns mock data or calls apiClient. Create React Query hooks: useCostSummary(groupBy, timeRange, refetchInterval), useCostRecords(filters, refetchInterval), useSessionCosts(sessionId), usePricing(). Define query keys factory: costsQueryKeys.
- **TDD:** Write tests for API functions: verify mock mode returns mock data, verify real mode calls correct endpoint, verify query keys are unique per parameters.
- [ ] Complete

### T12: Create Zustand store for cost dashboard state
- **Owner:** frontend
- **Estimate:** 30 minutes
- **Story:** US-05
- **Dependencies:** T09
- **Files:**
  - `docker/hitl-ui/src/stores/costsStore.ts`
  - `docker/hitl-ui/src/stores/costsStore.test.ts`
- **Description:** Create Zustand store with state: selectedTimeRange (CostTimeRange, default "24h"), selectedGroupBy (CostGroupBy, default "agent"), selectedSessionId (string | null), autoRefresh (boolean, default true). Actions: setTimeRange, setGroupBy, setSelectedSession, toggleAutoRefresh. Follow the pattern from metricsStore.ts.
- **TDD:** Write tests for initial state, each setter action, and state persistence.
- [ ] Complete

## Phase 5: Frontend Components (frontend)

### T13: Create CostSummaryCards component
- **Owner:** frontend
- **Estimate:** 1 hour
- **Story:** US-01
- **Dependencies:** T11
- **Files:**
  - `docker/hitl-ui/src/components/costs/CostSummaryCards.tsx`
  - `docker/hitl-ui/src/components/costs/CostSummaryCards.test.tsx`
- **Description:** Create a component that displays 4 summary cards: Total Spend (formatted USD), Spend Rate (USD/hour from recent data), Top Agent (agent name + cost), Total Tokens (input + output formatted). Accept CostSummaryResponse as props. Show loading skeletons when data is null. Use the same card styling as MetricsPage summary sections.
- **TDD:** Write tests for: renders all 4 cards with correct values, renders loading state, renders zero state, formats currency correctly ($X.XX), formats large token counts (e.g., "245K").
- [ ] Complete

### T14: Create CostBreakdownChart component
- **Owner:** frontend
- **Estimate:** 1.5 hours
- **Story:** US-02, US-03
- **Dependencies:** T11
- **Files:**
  - `docker/hitl-ui/src/components/costs/CostBreakdownChart.tsx`
  - `docker/hitl-ui/src/components/costs/CostBreakdownChart.test.tsx`
- **Description:** Create a component with two chart modes: bar chart for agent breakdown and pie/donut chart for model breakdown. Accept CostSummaryResponse data and a mode prop ("agent" | "model"). Use Recharts BarChart and PieChart. Include a mode toggle button. Show tooltips with cost details on hover. Show empty state when no data. Follow the chart styling from MetricsPage components.
- **TDD:** Write tests for: renders bar chart in agent mode, renders pie chart in model mode, toggles between modes, shows empty state, renders correct number of bars/segments matching data.
- [ ] Complete

### T15: Create SessionCostTable component
- **Owner:** frontend
- **Estimate:** 1.5 hours
- **Story:** US-04
- **Dependencies:** T11
- **Files:**
  - `docker/hitl-ui/src/components/costs/SessionCostTable.tsx`
  - `docker/hitl-ui/src/components/costs/SessionCostTable.test.tsx`
- **Description:** Create a sortable, paginated table showing session costs. Columns: Session ID, Agent, Model, Input Tokens, Output Tokens, Cost (USD), Time. Support sorting by clicking column headers (default: timestamp desc). Support pagination with page size 50. Clicking a row expands to show per-model and per-tool breakdown (uses useSessionCosts hook). Use the same table styling as other HITL UI tables.
- **TDD:** Write tests for: renders rows matching data, sorts by cost column, paginates when more than 50 rows, expands row on click showing breakdown, shows empty state with no records.
- [ ] Complete

### T16: Create costs barrel export and TimeRangeFilter
- **Owner:** frontend
- **Estimate:** 30 minutes
- **Story:** US-05
- **Dependencies:** T12
- **Files:**
  - `docker/hitl-ui/src/components/costs/TimeRangeFilter.tsx`
  - `docker/hitl-ui/src/components/costs/index.ts`
- **Description:** Create TimeRangeFilter component with buttons for 1h, 24h, 7d, 30d, All. Reads and writes selectedTimeRange from costsStore. Highlighted button indicates current selection. Create barrel index.ts exporting all cost components.
- **TDD:** Write a test verifying the correct button is highlighted based on store state and that clicking a button updates the store.
- [ ] Complete

## Phase 6: Page Assembly and Integration (frontend)

### T17: Create CostDashboardPage
- **Owner:** frontend
- **Estimate:** 1.5 hours
- **Story:** US-01, US-02, US-03, US-04, US-05, US-08
- **Dependencies:** T13, T14, T15, T16
- **Files:**
  - `docker/hitl-ui/src/pages/CostDashboardPage.tsx`
  - `docker/hitl-ui/src/pages/CostDashboardPage.test.tsx`
- **Description:** Create the main cost dashboard page composing all cost components. Layout: header with title + time range filter + refresh button, then summary cards row, then breakdown chart section (with group-by toggle), then session cost table. Use TanStack Query hooks from costs.ts. Wire up costsStore for state management. Include loading states and error handling following MetricsPage patterns. Add auto-refresh toggle.
- **TDD:** Write tests for: page renders with all sections, loading state shows skeletons, error state shows retry button, time range filter updates data, group-by toggle switches chart mode.
- [ ] Complete

### T18: Register /costs route in App.tsx
- **Owner:** frontend
- **Estimate:** 30 minutes
- **Story:** US-08
- **Dependencies:** T17
- **Files:**
  - `docker/hitl-ui/src/App.tsx` (MODIFY)
- **Description:** Add lazy import for CostDashboardPage. Add Route path="costs" element={<CostDashboardPage />} inside the Layout route, following the same pattern as the existing MetricsPage and GuardrailsPage routes. Add navigation entry to the sidebar component if one exists (or note for follow-up).
- **TDD:** Verify the /costs route renders the CostDashboardPage component (can be tested with React Router MemoryRouter in test).
- [ ] Complete

## Task Dependency Graph

```
T01 (models) ----+
                  |
T02 (pricing) ---+---> T03 (collector) ---> T05 (hook integration)
                  |
                  +---> T04 (sqlite) -------> T07 (API router) ---> T08 (register)
                  |
                  +---> T06 (API models) ---> T07

T09 (TS types) --+---> T10 (mocks) ---> T11 (API client) ---> T13 (summary cards)
                  |                                        ---> T14 (breakdown chart)
                  |                                        ---> T15 (session table)
                  +---> T12 (store) ---> T16 (filter + barrel)

T13 + T14 + T15 + T16 ---> T17 (page) ---> T18 (route)
```

## Parallel Execution Plan

Backend (T01-T08) and Frontend (T09-T18) can proceed in parallel since the frontend uses mock data.

**Backend parallelism:**
- T01 and T02 can run in parallel (no dependencies)
- T03 depends on T01 + T02
- T04 depends on T01
- T06 depends on T01
- T04 and T06 can run in parallel
- T07 depends on T04 + T06
- T05 depends on T03 + T04
- T08 depends on T07

**Frontend parallelism:**
- T09 has no dependencies
- T10 and T12 can run in parallel (both depend only on T09)
- T11 depends on T09 + T10
- T13, T14, T15 can run in parallel (all depend on T11)
- T16 depends on T12
- T17 depends on T13 + T14 + T15 + T16
- T18 depends on T17

**Estimated total time (sequential):** ~14.5 hours
**Estimated total time (with parallelism):** ~8 hours
