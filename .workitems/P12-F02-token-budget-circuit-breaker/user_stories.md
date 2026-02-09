# User Stories: P12-F02 Token Budget Enforcement & Circuit Breaker

## Epic Reference

This feature implements **Token Budget Enforcement** and a **Circuit Breaker** module to address two critical gaps in the aSDLC system: runaway agent cost control and loop detection/termination.

## Epic Summary

As a project operator, I want automatic enforcement of token budgets and circuit breakers for agent sessions, so that runaway agents are paused before consuming excessive resources, and looping agents are detected and terminated promptly.

## User Stories

### US-F02-01: Define Budget and Circuit Breaker Data Models

**As a** system architect
**I want** well-defined data models for budget state, circuit state, and alerts
**So that** the system has a consistent schema for tracking and enforcement

**Acceptance Criteria:**
- [ ] `BudgetState` frozen dataclass defined with budget_id, budget_type, max_tokens, tokens_used, status, and all required fields
- [ ] `CircuitState` frozen dataclass defined with circuit_id, state, iteration_count, duplicate tracking, and trip reason
- [ ] `BudgetAlert` frozen dataclass defined with alert_id, alert_type, message, utilization, and acknowledged flag
- [ ] All models support JSON serialization via to_dict() and from_dict()
- [ ] BudgetState has computed properties: utilization and remaining
- [ ] Unit tests verify model constraints and serialization round-trips

**Priority:** High

---

### US-F02-02: Define Budget and Circuit Breaker Configuration

**As a** platform engineer
**I want** environment-based configuration for token budgets and circuit breaker thresholds
**So that** budgets can be tuned per environment without code changes

**Acceptance Criteria:**
- [ ] `TokenBudgetConfig` loads from environment variables via `from_env()`
- [ ] `CircuitBreakerConfig` loads from environment variables via `from_env()`
- [ ] Default budget values provided for all task types (planning: 50K, implement: 100K, review: 30K, test: 50K, deploy: 20K, design: 50K)
- [ ] Default session budget of 500K tokens
- [ ] Alert threshold configurable (default 0.8)
- [ ] Master enable/disable flags for both systems
- [ ] Unit tests verify default values and environment override

**Priority:** High

---

### US-F02-03: Define Budget and Circuit Breaker Exceptions

**As a** developer
**I want** specific exception types for budget and circuit breaker errors
**So that** error handling is clear and consistent

**Acceptance Criteria:**
- [ ] `BudgetExceededError` exception defined, inheriting from `ASDLCError`
- [ ] `CircuitOpenError` exception defined, inheriting from `ASDLCError`
- [ ] Both exceptions include relevant context (budget_id, tokens_used, etc.)
- [ ] Exceptions support `to_dict()` serialization
- [ ] Unit tests verify exception creation and inheritance

**Priority:** High

---

### US-F02-04: Implement Redis Budget Store

**As a** platform engineer
**I want** Redis-backed persistence for budget and circuit breaker state
**So that** state survives hook process restarts and is accessible across hooks

**Acceptance Criteria:**
- [ ] `BudgetStore` class uses Redis for all state operations
- [ ] Token usage increment uses atomic `INCRBY` (no read-modify-write races)
- [ ] Iteration count uses atomic `HINCRBY`
- [ ] All keys have configurable TTL (default 24 hours)
- [ ] Key prefix is configurable (`asdlc:budget` and `asdlc:circuit`)
- [ ] Active budget IDs tracked in a Redis set
- [ ] Tool call signatures stored in a capped Redis list for loop detection
- [ ] Alert entries stored in a Redis list per budget
- [ ] Integration tests verify Redis operations (requires running Redis)
- [ ] Graceful degradation when Redis is unavailable (log warning, allow execution)

**Priority:** High

---

### US-F02-05: Implement TokenBudgetTracker Core

**As a** developer
**I want** a tracker that manages cumulative token usage and enforces budgets
**So that** agents are paused when they exceed their token allocation

**Acceptance Criteria:**
- [ ] `start_budget()` initializes or resumes a budget with configurable limits
- [ ] `record_usage()` atomically increments usage and evaluates thresholds
- [ ] Status transitions: active -> warning (at alert_threshold), warning -> paused (at 100%)
- [ ] `extend_budget()` adds tokens after HITL approval, transitioning paused -> active
- [ ] `reset_budget()` clears state for a new task
- [ ] `get_state()` retrieves current budget without side effects
- [ ] `list_active_budgets()` returns all non-expired budgets
- [ ] Budget type defaults are applied from config based on task type
- [ ] Unit tests cover all state transitions
- [ ] Unit tests verify threshold math with edge cases (exact boundary, off-by-one)

**Priority:** High

---

### US-F02-06: Implement Circuit Breaker Core

**As a** developer
**I want** a circuit breaker that detects looping or spinning agents
**So that** runaway agents are stopped before wasting resources

**Acceptance Criteria:**
- [ ] `record_call()` records each tool call, increments iteration count, and checks for anomalies
- [ ] Loop detection: trips if same tool+args hash appears N consecutive times (default 5)
- [ ] Iteration limit: trips if total tool calls exceed max_iterations (default 50)
- [ ] State transitions: closed -> open (on trip), open -> half_open (on acknowledge), half_open -> closed (on successful call)
- [ ] `trip_reason` is set to descriptive text when circuit opens
- [ ] `acknowledge()` moves open -> half_open for HITL recovery
- [ ] `reset()` moves any state -> closed
- [ ] Unit tests cover all detection strategies and state transitions
- [ ] Unit tests verify hash computation for tool call signatures

**Priority:** High

---

### US-F02-07: Implement Prometheus Metrics for Budget and Circuit Breaker

**As a** platform engineer
**I want** Prometheus metrics for token usage, budget status, and circuit breaker state
**So that** I can monitor agent cost and health in observability dashboards

**Acceptance Criteria:**
- [ ] `asdlc_tokens_used_total` counter tracks cumulative tokens by agent, budget_type, and token_type
- [ ] `asdlc_budget_utilization_ratio` gauge tracks current utilization
- [ ] `asdlc_budget_alerts_total` counter tracks alerts by type
- [ ] `asdlc_budget_pauses_total` counter tracks execution pauses
- [ ] `asdlc_circuit_trips_total` counter tracks circuit trips by reason
- [ ] `asdlc_circuit_state` gauge tracks circuit state (0=closed, 1=half_open, 2=open)
- [ ] `asdlc_tool_iterations_total` counter tracks tool call iterations
- [ ] All metrics use the `asdlc_` prefix and follow naming conventions
- [ ] Metrics are registered in the Prometheus registry
- [ ] Unit tests verify metric increment behavior

**Priority:** Medium

---

### US-F02-08: Implement PostToolUse Hook for Token Tracking

**As an** agent
**I want** my token usage automatically recorded after each tool call
**So that** my budget is tracked without manual intervention

**Acceptance Criteria:**
- [ ] PostToolUse hook script at `.claude/hooks/budget-track.py`
- [ ] Hook reads tool response metadata for token usage (input_tokens, output_tokens)
- [ ] Hook computes tool call signature hash for circuit breaker
- [ ] Hook updates budget tracker and circuit breaker via Redis
- [ ] Hook writes updated state to session cache file
- [ ] If budget warning threshold reached: outputs `additionalContext` with warning (exit 0)
- [ ] If budget exhausted: outputs reason to stderr (exit 2, BLOCK)
- [ ] If circuit tripped: outputs reason to stderr (exit 2, BLOCK)
- [ ] If Redis unavailable: exits 0 (fail-safe, allow execution)
- [ ] If token usage metadata is absent: exits 0 (skip recording)
- [ ] Hook completes within 2 seconds
- [ ] Unit tests verify all exit paths
- [ ] Unit tests verify cache file format

**Priority:** High

---

### US-F02-09: Extend PreToolUse Hook for Budget/Circuit Enforcement

**As an** agent
**I want** tool calls blocked when my budget is exhausted or circuit is open
**So that** I cannot continue spending tokens without HITL approval

**Acceptance Criteria:**
- [ ] `guardrails-enforce.py` reads budget and circuit state from session cache
- [ ] If budget status is "paused" or "exhausted": block tool call (exit 2) with descriptive reason
- [ ] If circuit state is "open": block tool call (exit 2) with trip reason
- [ ] If cache is missing or expired: query Redis directly; if Redis unavailable, allow through
- [ ] Existing guardrails enforcement behavior is not affected
- [ ] Unit tests verify blocking for each condition
- [ ] Unit tests verify pass-through when budget/circuit is OK

**Priority:** High

---

### US-F02-10: Extend UserPromptSubmit Hook for Budget Status Injection

**As an** agent
**I want** to see my current budget status in my context
**So that** I can self-regulate my token consumption

**Acceptance Criteria:**
- [ ] `guardrails-inject.py` reads budget and circuit state from Redis or cache
- [ ] Budget status injected as `additionalContext` section
- [ ] Status includes: tokens used / max, utilization percentage, status
- [ ] Circuit breaker status includes: state, iteration count / max
- [ ] If budget system is disabled or unavailable: no budget section injected
- [ ] Unit tests verify output format

**Priority:** Medium

---

### US-F02-11: Implement Budget REST API Endpoints

**As a** UI developer
**I want** REST endpoints to query and manage budgets and circuits
**So that** the cost dashboard can display and control budget state

**Acceptance Criteria:**
- [ ] `GET /api/budget` lists all active budgets
- [ ] `GET /api/budget/{budget_id}` returns specific budget state
- [ ] `POST /api/budget/{budget_id}/extend` extends budget (requires additional_tokens and reason)
- [ ] `POST /api/budget/{budget_id}/reset` resets a budget
- [ ] `GET /api/circuit` lists all circuit breaker states
- [ ] `GET /api/circuit/{circuit_id}` returns specific circuit state
- [ ] `POST /api/circuit/{circuit_id}/reset` resets circuit to closed
- [ ] `POST /api/circuit/{circuit_id}/acknowledge` moves open -> half_open
- [ ] `GET /api/budget/alerts` lists alerts with optional filtering
- [ ] `POST /api/budget/alerts/{alert_id}/acknowledge` acknowledges an alert
- [ ] All endpoints return proper HTTP status codes (200, 404, 400)
- [ ] Unit tests cover all endpoints

**Priority:** High

---

### US-F02-12: Create Pydantic API Models for Budget Endpoints

**As a** backend developer
**I want** Pydantic models for budget API request/response
**So that** the API has validated, documented contracts

**Acceptance Criteria:**
- [ ] `BudgetStateResponse` model with all BudgetState fields plus computed properties
- [ ] `ExtendBudgetRequest` model with validation (additional_tokens > 0, reason required)
- [ ] `CircuitStateResponse` model with all CircuitState fields
- [ ] `BudgetListResponse` and `CircuitListResponse` with pagination
- [ ] `AlertResponse` and `AlertListResponse` models
- [ ] Field validation with proper error messages
- [ ] Unit tests verify validation rules

**Priority:** High

---

### US-F02-13: Build CostDashboard Page Component

**As a** project operator
**I want** a cost dashboard showing all active budgets and circuit breakers
**So that** I can monitor agent spending at a glance

**Acceptance Criteria:**
- [ ] Page accessible via `/cost-dashboard` route
- [ ] Summary cards showing: active agents, total tokens used, budget status summary, circuit status summary
- [ ] Active budgets table with agent, task, used/max, status
- [ ] Circuit breakers table with agent, state, iterations, duplicates
- [ ] Collapsible alerts panel at bottom
- [ ] Auto-refresh (configurable interval, default 15s)
- [ ] Manual refresh button
- [ ] Navigation item in sidebar
- [ ] Responsive layout
- [ ] Unit tests verify page composition

**Priority:** High

---

### US-F02-14: Build BudgetStatusBar Component

**As a** UI user
**I want** a visual progress bar showing budget utilization
**So that** I can quickly see how much budget remains

**Acceptance Criteria:**
- [ ] Horizontal bar showing utilization percentage
- [ ] Color coding: green (0-60%), yellow (60-80%), orange (80-95%), red (95%+)
- [ ] Numeric display of tokens used / max tokens
- [ ] "Warning" and "Paused" badges when applicable
- [ ] Tooltip with detailed breakdown
- [ ] Animated transitions on updates
- [ ] Unit tests verify color coding logic and rendering

**Priority:** High

---

### US-F02-15: Build BudgetTable Component

**As a** UI user
**I want** a table of all active budgets
**So that** I can see which agents are consuming tokens

**Acceptance Criteria:**
- [ ] Table columns: Agent, Task Description, Tokens Used, Budget, Utilization Bar, Status, Actions
- [ ] Sortable by any column
- [ ] Row click expands detail view
- [ ] "Extend" action button for paused budgets (opens dialog)
- [ ] "Reset" action button for completed tasks
- [ ] Loading skeleton during data fetch
- [ ] Empty state when no active budgets
- [ ] Unit tests verify rendering and interactions

**Priority:** High

---

### US-F02-16: Build CircuitBreakerStatus Component

**As a** UI user
**I want** to see circuit breaker status for all agents
**So that** I can detect and resolve agent issues

**Acceptance Criteria:**
- [ ] Table showing: Agent, State (with color indicator), Iterations (count/max), Duplicate Count, Trip Reason, Actions
- [ ] State colors: green (closed), yellow (half_open), red (open)
- [ ] "Reset" action for open circuits
- [ ] "Acknowledge" action for open circuits (moves to half_open)
- [ ] Trip reason displayed when state is open
- [ ] Unit tests verify rendering and actions

**Priority:** High

---

### US-F02-17: Build AlertPanel Component

**As a** UI user
**I want** to see and acknowledge budget alerts
**So that** I can respond to budget warnings and circuit trips

**Acceptance Criteria:**
- [ ] List of alerts sorted by timestamp (newest first)
- [ ] Alert shows: timestamp, agent, alert type, message, acknowledge button
- [ ] Unacknowledged alerts visually distinct from acknowledged
- [ ] Filter by acknowledged/unacknowledged
- [ ] Bulk acknowledge button for all unacknowledged
- [ ] Collapsible panel that shows unacknowledged count in header
- [ ] Unit tests verify rendering, filtering, and acknowledge flow

**Priority:** Medium

---

### US-F02-18: Create TypeScript API Client and Store for Budget

**As a** frontend developer
**I want** API client functions and a Zustand store for budget data
**So that** components can fetch, cache, and update budget state

**Acceptance Criteria:**
- [ ] API client functions for all budget REST endpoints
- [ ] API client functions for all circuit REST endpoints
- [ ] API client functions for alerts
- [ ] React Query hooks for data fetching with configurable refresh interval
- [ ] Zustand store for budget list, circuit list, alerts, and UI state
- [ ] Mock data and mock service for development (toggle via VITE_USE_MOCKS)
- [ ] Unit tests for API functions and store

**Priority:** High

---

### US-F02-19: Create Budget Guardrails Guidelines

**As a** system operator
**I want** guardrails guidelines for budget enforcement and circuit breaker
**So that** agents are informed about budget constraints in their context

**Acceptance Criteria:**
- [ ] Bootstrap script creates "token-budget-enforcement" guideline in Elasticsearch
- [ ] Bootstrap script creates "circuit-breaker-enforcement" guideline in Elasticsearch
- [ ] Both guidelines use existing `CONTEXT_CONSTRAINT` category
- [ ] Token budget guideline matches all implementation actions with priority 850
- [ ] Circuit breaker guideline matches all contexts (wildcard) with priority 900
- [ ] Bootstrap is idempotent (skips existing)
- [ ] Unit tests verify guideline structure

**Priority:** Medium

---

### US-F02-20: Configure Hooks in Settings

**As a** system operator
**I want** the budget tracking hook registered in Claude Code settings
**So that** token tracking activates automatically in all sessions

**Acceptance Criteria:**
- [ ] PostToolUse hook entry added to `.claude/settings.json`
- [ ] Hook configured with appropriate timeout (2000ms)
- [ ] Existing PreToolUse and UserPromptSubmit hook configurations updated to include budget checks
- [ ] Documentation updated to describe new hook behavior

**Priority:** Medium

---

## Non-Functional Requirements

### Performance

- PostToolUse hook completes in < 100ms (Redis operations only)
- Budget status query returns in < 50ms
- Circuit breaker evaluation completes in < 10ms
- UI dashboard renders within 1 second with 10 active budgets
- Auto-refresh does not cause UI jank

### Reliability

- Redis unavailable does not block agent execution (fail-safe)
- Hook timeout does not block tool call completion
- Budget state persists across session restarts (Redis-backed)
- Atomic Redis operations prevent race conditions

### Observability

- All budget transitions emit Prometheus metrics
- Circuit breaker trips are logged and metriced
- Budget extension requests are auditable via alerts log

### Security

- Budget extension requires explicit HITL approval (cannot be automated)
- No sensitive data in Redis keys (only token counts and metadata)
- Budget IDs are scoped per session/task to prevent cross-session interference

## Story Dependencies

```
US-F02-01 (Models) ──────────┐
US-F02-02 (Config) ──────────┤
US-F02-03 (Exceptions) ──────┤
                              ├──> US-F02-04 (Redis Store)
                              │           │
                              │           ├──> US-F02-05 (Budget Tracker)
                              │           │           │
                              │           ├──> US-F02-06 (Circuit Breaker)
                              │           │           │
                              │           └──> US-F02-07 (Metrics)
                              │                       │
                              │    ┌────────────────────┘
                              │    │
                              ├──> US-F02-08 (PostToolUse Hook)
                              │           │
                              ├──> US-F02-09 (PreToolUse Extension)
                              │           │
                              └──> US-F02-10 (UserPromptSubmit Extension)

US-F02-04 ──> US-F02-12 (API Models) ──> US-F02-11 (REST API)
                                                  │
US-F02-18 (API Client + Store) <──────────────────┘
         │
         ├──> US-F02-13 (CostDashboard)
         │         │
         │         ├──> US-F02-14 (BudgetStatusBar)
         │         │
         │         ├──> US-F02-15 (BudgetTable)
         │         │
         │         ├──> US-F02-16 (CircuitBreakerStatus)
         │         │
         │         └──> US-F02-17 (AlertPanel)
         │
         └──> US-F02-19 (Guidelines)
                    │
                    └──> US-F02-20 (Hook Config)
```

## Priority Summary

| Priority | Stories |
|----------|---------|
| High | US-F02-01, 02, 03, 04, 05, 06, 08, 09, 11, 12, 13, 14, 15, 16, 18 |
| Medium | US-F02-07, 10, 17, 19, 20 |
