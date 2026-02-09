# P12-F02: Token Budget Enforcement & Circuit Breaker - Tasks

## Overview

This task breakdown covers implementing the Token Budget Enforcement system and Circuit Breaker module. Tasks are organized into 6 phases matching the feature's technical architecture.

## Dependencies

### External Dependencies

- P11-F01: Guardrails system (hooks, evaluator, models) - COMPLETE (95%)
- P02-F07: Prometheus metrics infrastructure - COMPLETE
- P01-F01: Redis infrastructure - COMPLETE
- P05-F01: HITL UI infrastructure - COMPLETE

### Phase Dependencies

```
Phase 1 (Models, Config, Exceptions) ─────┐
                                            ├──> Phase 2 (Redis Store + Core Logic)
                                            │              │
                                            │              ├──> Phase 3 (Hooks)
                                            │              │
                                            │              └──> Phase 4 (REST API)
                                            │                         │
                                            │              Phase 5 (UI) <──┘
                                            │
                                            └──> Phase 6 (Guidelines + Integration)
```

---

## Phase 1: Data Models, Configuration, and Exceptions (Backend)

### T01: Create Budget and Circuit Breaker Data Models

**Estimate**: 1.5hr
**Stories**: US-F02-01

**Description**: Define frozen dataclasses for BudgetState, CircuitState, and BudgetAlert.

**Subtasks**:
- [ ] Create `src/core/budget/__init__.py` with public exports
- [ ] Create `src/core/budget/models.py`
- [ ] Define `BudgetState` frozen dataclass with all fields, `utilization` and `remaining` properties
- [ ] Define `CircuitState` frozen dataclass with all fields
- [ ] Define `BudgetAlert` frozen dataclass with all fields
- [ ] Add `to_dict()` and `from_dict()` methods on all models
- [ ] Write unit tests at `tests/unit/core/budget/test_models.py`

**Acceptance Criteria**:
- [ ] All dataclasses are frozen (immutable)
- [ ] BudgetState.utilization returns correct fraction
- [ ] BudgetState.remaining returns correct non-negative count
- [ ] JSON serialization round-trips correctly
- [ ] Unit tests cover all field combinations and edge cases

**Test Cases**:
- [ ] Test BudgetState creation with all fields
- [ ] Test BudgetState.utilization at 0%, 50%, 100%, 120% (over budget)
- [ ] Test BudgetState.remaining at various utilization levels
- [ ] Test CircuitState creation with all states (closed, open, half_open)
- [ ] Test BudgetAlert creation for each alert type
- [ ] Test to_dict/from_dict round-trip for all models
- [ ] Test BudgetState with max_tokens=0 edge case

---

### T02: Create Budget Configuration Classes

**Estimate**: 1hr
**Stories**: US-F02-02

**Description**: Create environment-based configuration for token budgets and circuit breaker.

**Subtasks**:
- [ ] Create `src/core/budget/config.py`
- [ ] Define `TokenBudgetConfig` frozen dataclass with `from_env()` classmethod
- [ ] Define `CircuitBreakerConfig` frozen dataclass with `from_env()` classmethod
- [ ] Include default budgets per task type (planning: 50K, implement: 100K, etc.)
- [ ] Include master enable/disable flags
- [ ] Write unit tests at `tests/unit/core/budget/test_config.py`

**Acceptance Criteria**:
- [ ] Configs load correctly from environment variables
- [ ] Default values match design spec
- [ ] Invalid values (negative budget, threshold > 1.0) raise ValueError
- [ ] `from_env()` handles missing env vars gracefully

**Test Cases**:
- [ ] Test default config values
- [ ] Test environment variable override
- [ ] Test invalid budget value raises error
- [ ] Test invalid threshold value raises error
- [ ] Test disabled flag parsing (true/false/1/0)
- [ ] Test task type budget lookup

---

### T03: Create Budget Exceptions

**Estimate**: 30min
**Stories**: US-F02-03

**Description**: Define budget-specific exceptions.

**Subtasks**:
- [ ] Create `src/core/budget/exceptions.py`
- [ ] Define `BudgetExceededError` inheriting from `ASDLCError`
- [ ] Define `CircuitOpenError` inheriting from `ASDLCError`
- [ ] Include context fields (budget_id, tokens_used, max_tokens, etc.)
- [ ] Add `to_dict()` method
- [ ] Write unit tests at `tests/unit/core/budget/test_exceptions.py`

**Acceptance Criteria**:
- [ ] Exceptions inherit from ASDLCError
- [ ] Context information is accessible from exception
- [ ] to_dict() produces useful diagnostic output

**Test Cases**:
- [ ] Test BudgetExceededError creation with context
- [ ] Test CircuitOpenError creation with context
- [ ] Test inheritance chain (BudgetExceededError -> ASDLCError -> Exception)
- [ ] Test to_dict() output

---

## Phase 2: Redis Store and Core Logic (Backend)

### T04: Implement BudgetStore (Redis Persistence)

**Estimate**: 2hr
**Stories**: US-F02-04

**Description**: Create Redis-backed store for budget and circuit breaker state.

**Subtasks**:
- [ ] Create `src/infrastructure/budget/__init__.py`
- [ ] Create `src/infrastructure/budget/budget_store.py`
- [ ] Implement budget CRUD: `get_budget()`, `set_budget()`, `delete_budget()`
- [ ] Implement atomic token increment: `increment_usage()` using Redis INCRBY
- [ ] Implement `list_budgets()` using Redis SCAN on active set
- [ ] Implement circuit CRUD: `get_circuit()`, `set_circuit()`, `delete_circuit()`
- [ ] Implement atomic iteration increment: `increment_iteration()` using HINCRBY
- [ ] Implement `record_tool_signature()` using Redis LPUSH + LTRIM (capped list)
- [ ] Implement alert operations: `add_alert()`, `list_alerts()`, `acknowledge_alert()`
- [ ] Apply TTL on all keys
- [ ] Handle Redis connection errors gracefully (return None, log warning)
- [ ] Write unit tests with mocked Redis at `tests/unit/infrastructure/budget/test_budget_store.py`

**Acceptance Criteria**:
- [ ] All CRUD operations work correctly
- [ ] Token increment is truly atomic (INCRBY)
- [ ] Keys have TTL applied
- [ ] Active budget set is maintained
- [ ] Tool signature list is capped (default 100 entries)
- [ ] Redis unavailable returns None/empty, does not raise

**Test Cases**:
- [ ] Test set and get budget state
- [ ] Test increment_usage returns new total
- [ ] Test list_budgets returns all active
- [ ] Test delete_budget removes from active set
- [ ] Test set and get circuit state
- [ ] Test increment_iteration returns new count
- [ ] Test record_tool_signature caps list size
- [ ] Test add and list alerts
- [ ] Test acknowledge_alert updates flag
- [ ] Test TTL is set on keys
- [ ] Test Redis connection failure returns gracefully

---

### T05: Implement TokenBudgetTracker

**Estimate**: 1.5hr
**Stories**: US-F02-05

**Description**: Implement the core token budget tracking logic.

**Subtasks**:
- [ ] Create `src/core/budget/tracker.py`
- [ ] Implement `__init__()` with BudgetStore and TokenBudgetConfig
- [ ] Implement `start_budget()` - initializes budget in Redis
- [ ] Implement `record_usage()` - atomic increment + threshold evaluation
- [ ] Implement status transitions: active -> warning -> paused
- [ ] Implement `extend_budget()` - adds tokens, paused -> active
- [ ] Implement `reset_budget()` - clears state
- [ ] Implement `get_state()` and `list_active_budgets()`
- [ ] Emit Prometheus metrics on state transitions
- [ ] Generate BudgetAlert on threshold crossings
- [ ] Write unit tests at `tests/unit/core/budget/test_tracker.py`

**Acceptance Criteria**:
- [ ] Budgets start in "active" status
- [ ] Warning alert generated when usage crosses alert_threshold
- [ ] Status transitions to "warning" at alert_threshold
- [ ] Status transitions to "paused" at 100%
- [ ] extend_budget moves paused -> active with increased max_tokens
- [ ] Metrics emitted on each transition

**Test Cases**:
- [ ] Test start_budget creates correct initial state
- [ ] Test record_usage increments tokens correctly
- [ ] Test transition active -> warning at 80%
- [ ] Test transition warning -> paused at 100%
- [ ] Test extend_budget from paused state
- [ ] Test extend_budget increases max_tokens
- [ ] Test reset_budget clears state
- [ ] Test record_usage with budget disabled (no-op)
- [ ] Test get_state for non-existent budget returns None
- [ ] Test list_active_budgets with multiple budgets

---

### T06: Implement CircuitBreaker

**Estimate**: 1.5hr
**Stories**: US-F02-06

**Description**: Implement the circuit breaker logic.

**Subtasks**:
- [ ] Create `src/core/budget/circuit_breaker.py`
- [ ] Implement `__init__()` with BudgetStore and CircuitBreakerConfig
- [ ] Implement `record_call()` - records tool call, evaluates anomalies
- [ ] Implement `_detect_loop()` - checks for N identical consecutive calls
- [ ] Implement `_detect_iteration_limit()` - checks total call count
- [ ] Implement `_compute_args_hash()` - deterministic hash of tool name + args
- [ ] Implement state transitions: closed -> open, open -> half_open, half_open -> closed
- [ ] Implement `acknowledge()` and `reset()`
- [ ] Emit Prometheus metrics on trips
- [ ] Generate BudgetAlert when circuit trips
- [ ] Write unit tests at `tests/unit/core/budget/test_circuit_breaker.py`

**Acceptance Criteria**:
- [ ] Loop detection trips after N identical consecutive calls
- [ ] Iteration limit trips after max_iterations calls
- [ ] Trip reason is descriptive
- [ ] Acknowledge moves open -> half_open
- [ ] Reset moves any state -> closed
- [ ] Half_open -> closed after one successful non-duplicate call
- [ ] Half_open -> open if another anomaly detected

**Test Cases**:
- [ ] Test record_call increments iteration count
- [ ] Test loop detection with N identical calls
- [ ] Test loop detection resets on different call
- [ ] Test iteration limit trip
- [ ] Test closed -> open transition
- [ ] Test open -> half_open via acknowledge
- [ ] Test half_open -> closed after good call
- [ ] Test half_open -> open on another loop
- [ ] Test reset from open state
- [ ] Test args hash consistency (same args = same hash)
- [ ] Test args hash uniqueness (different args = different hash)
- [ ] Test circuit disabled (no-op)

---

### T07: Implement Budget Prometheus Metrics

**Estimate**: 1hr
**Stories**: US-F02-07

**Description**: Define and register Prometheus metrics for budget and circuit breaker.

**Subtasks**:
- [ ] Create `src/infrastructure/budget/budget_metrics.py`
- [ ] Define TOKENS_USED_TOTAL Counter
- [ ] Define BUDGET_UTILIZATION Gauge
- [ ] Define BUDGET_ALERTS_TOTAL Counter
- [ ] Define BUDGET_PAUSES_TOTAL Counter
- [ ] Define CIRCUIT_TRIPS_TOTAL Counter
- [ ] Define CIRCUIT_STATE Gauge
- [ ] Define TOOL_ITERATIONS_TOTAL Counter
- [ ] Add __all__ exports
- [ ] Write unit tests at `tests/unit/infrastructure/budget/test_budget_metrics.py`

**Acceptance Criteria**:
- [ ] All metrics follow asdlc_ prefix convention
- [ ] Correct metric types (Counter vs Gauge)
- [ ] Correct label sets
- [ ] No cardinality explosion (limited label values)

**Test Cases**:
- [ ] Test metric definition (name, type, labels)
- [ ] Test Counter.inc() increments correctly
- [ ] Test Gauge.set() updates correctly
- [ ] Test label cardinality is bounded

---

## Phase 3: Hook Integration (Backend)

### T08: Implement PostToolUse Budget Tracking Hook

**Estimate**: 1.5hr
**Stories**: US-F02-08

**Description**: Create the PostToolUse hook that captures token usage and updates budget/circuit state.

**Subtasks**:
- [ ] Create `.claude/hooks/budget-track.py`
- [ ] Parse hook input from stdin (tool, arguments, response, sessionId)
- [ ] Extract token usage from response metadata (input_tokens, output_tokens)
- [ ] Compute tool call args hash for circuit breaker
- [ ] Connect to Redis and update budget tracker
- [ ] Connect to Redis and update circuit breaker
- [ ] Read/update session cache file (`/tmp/guardrails-{sessionId}.json`)
- [ ] On budget warning: output additionalContext (exit 0)
- [ ] On budget exhausted: output reason to stderr (exit 2)
- [ ] On circuit tripped: output reason to stderr (exit 2)
- [ ] On Redis failure or missing token data: exit 0 (fail-safe)
- [ ] Write unit tests at `tests/unit/hooks/test_budget_track.py`

**Acceptance Criteria**:
- [ ] Hook correctly extracts token usage from response
- [ ] Hook updates Redis state atomically
- [ ] Hook outputs appropriate response for each state
- [ ] Hook completes within 2 seconds
- [ ] Hook fails safely (exit 0) on any error

**Test Cases**:
- [ ] Test token extraction from response with usage metadata
- [ ] Test token extraction when usage metadata is absent
- [ ] Test budget warning output format
- [ ] Test budget exhausted blocking output
- [ ] Test circuit tripped blocking output
- [ ] Test Redis failure graceful degradation
- [ ] Test cache file update
- [ ] Test args hash computation
- [ ] Test hook with malformed stdin (graceful failure)

---

### T09: Extend PreToolUse Hook for Budget/Circuit Enforcement

**Estimate**: 1hr
**Stories**: US-F02-09

**Description**: Add budget and circuit breaker checks to the existing guardrails-enforce.py hook.

**Subtasks**:
- [ ] Add budget state check to `guardrails-enforce.py` main()
- [ ] Read budget and circuit state from session cache
- [ ] If budget status is "paused" or "exhausted": exit 2 with descriptive reason
- [ ] If circuit state is "open": exit 2 with trip reason
- [ ] If cache missing: attempt Redis query; if Redis unavailable, allow through
- [ ] Maintain backward compatibility with existing guardrails enforcement
- [ ] Write unit tests at `tests/unit/hooks/test_guardrails_enforce_budget.py`

**Acceptance Criteria**:
- [ ] Budget exhaustion blocks tool calls
- [ ] Open circuit blocks tool calls
- [ ] Existing guardrails enforcement still works
- [ ] Missing cache does not block

**Test Cases**:
- [ ] Test tool call blocked when budget paused
- [ ] Test tool call blocked when budget exhausted
- [ ] Test tool call blocked when circuit open
- [ ] Test tool call allowed when budget active
- [ ] Test tool call allowed when circuit closed
- [ ] Test tool call allowed when cache missing
- [ ] Test existing guardrails enforcement unaffected

---

### T10: Extend UserPromptSubmit Hook for Budget Status

**Estimate**: 45min
**Stories**: US-F02-10

**Description**: Add budget status injection to the existing guardrails-inject.py hook.

**Subtasks**:
- [ ] Add budget status section to additionalContext output in `guardrails-inject.py`
- [ ] Read budget state from Redis or session cache
- [ ] Format budget status: "Session budget: X / Y tokens (Z%)"
- [ ] Format circuit status: "Circuit breaker: state (N/M iterations)"
- [ ] If budget system disabled: skip budget section
- [ ] Write unit tests at `tests/unit/hooks/test_guardrails_inject_budget.py`

**Acceptance Criteria**:
- [ ] Budget status appears in additionalContext
- [ ] Format is clear and concise
- [ ] Disabled budget system produces no output

**Test Cases**:
- [ ] Test budget status output format
- [ ] Test circuit status output format
- [ ] Test disabled system produces no budget section
- [ ] Test Redis unavailable produces no budget section

---

## Phase 4: REST API (Backend)

### T11: Create Pydantic Models for Budget API

**Estimate**: 1hr
**Stories**: US-F02-12

**Description**: Create Pydantic request/response models for the budget REST API.

**Subtasks**:
- [ ] Create `src/orchestrator/api/models/budget.py`
- [ ] Define BudgetStateResponse with all fields plus utilization, remaining
- [ ] Define ExtendBudgetRequest with validation (additional_tokens > 0, reason required)
- [ ] Define CircuitStateResponse with all fields
- [ ] Define BudgetListResponse and CircuitListResponse
- [ ] Define AlertResponse and AlertListResponse
- [ ] Write unit tests at `tests/unit/orchestrator/api/models/test_budget.py`

**Acceptance Criteria**:
- [ ] Models have proper field validation
- [ ] ExtendBudgetRequest rejects non-positive tokens
- [ ] ExtendBudgetRequest requires reason
- [ ] Response models handle None/optional fields correctly

**Test Cases**:
- [ ] Test BudgetStateResponse creation
- [ ] Test ExtendBudgetRequest validation (positive tokens)
- [ ] Test ExtendBudgetRequest validation (reason required)
- [ ] Test CircuitStateResponse creation
- [ ] Test list response models

---

### T12: Implement Budget REST API Endpoints

**Estimate**: 2hr
**Stories**: US-F02-11

**Description**: Implement all REST endpoints for budget and circuit breaker management.

**Subtasks**:
- [ ] Create `src/orchestrator/routes/budget_api.py`
- [ ] Implement GET /api/budget (list active budgets)
- [ ] Implement GET /api/budget/{budget_id} (get specific budget)
- [ ] Implement POST /api/budget/{budget_id}/extend
- [ ] Implement POST /api/budget/{budget_id}/reset
- [ ] Implement GET /api/circuit (list circuits)
- [ ] Implement GET /api/circuit/{circuit_id} (get specific circuit)
- [ ] Implement POST /api/circuit/{circuit_id}/reset
- [ ] Implement POST /api/circuit/{circuit_id}/acknowledge
- [ ] Implement GET /api/budget/alerts (list alerts)
- [ ] Implement POST /api/budget/alerts/{alert_id}/acknowledge
- [ ] Register router in orchestrator main app
- [ ] Write unit tests at `tests/unit/orchestrator/routes/test_budget_api.py`

**Acceptance Criteria**:
- [ ] All endpoints return correct HTTP status codes
- [ ] GET endpoints return proper JSON responses
- [ ] POST extend requires valid body
- [ ] 404 returned for non-existent budget/circuit/alert
- [ ] Router registered and accessible

**Test Cases**:
- [ ] Test list budgets returns all active
- [ ] Test get specific budget by ID
- [ ] Test get non-existent budget returns 404
- [ ] Test extend budget with valid request
- [ ] Test extend budget with invalid tokens (400)
- [ ] Test reset budget
- [ ] Test list circuits
- [ ] Test reset circuit
- [ ] Test acknowledge circuit
- [ ] Test list alerts with filter
- [ ] Test acknowledge alert

---

## Phase 5: HITL UI Components (Frontend)

### T13: Create TypeScript Types, API Client, and Store

**Estimate**: 1.5hr
**Stories**: US-F02-18

**Description**: Create TypeScript types, API client functions, and Zustand store for budget data.

**Subtasks**:
- [ ] Create `docker/hitl-ui/src/api/budget.ts` with API client functions
- [ ] Create TypeScript interfaces (BudgetState, CircuitState, BudgetAlert)
- [ ] Implement listBudgets(), getBudget(), extendBudget(), resetBudget()
- [ ] Implement listCircuits(), getCircuit(), resetCircuit(), acknowledgeCircuit()
- [ ] Implement listAlerts(), acknowledgeAlert()
- [ ] Create React Query hooks with configurable refresh interval
- [ ] Create `docker/hitl-ui/src/api/mocks/budgetData.ts` with mock data
- [ ] Create `docker/hitl-ui/src/stores/budgetStore.ts` Zustand store
- [ ] Write unit tests at `docker/hitl-ui/src/api/budget.test.ts`
- [ ] Write unit tests at `docker/hitl-ui/src/stores/budgetStore.test.ts`

**Acceptance Criteria**:
- [ ] Types match backend API models
- [ ] All API functions implemented with error handling
- [ ] React Query hooks support auto-refresh
- [ ] Store holds budgets, circuits, alerts, and UI state
- [ ] Mock data covers all states (active, warning, paused, exhausted; closed, open, half_open)

**Test Cases**:
- [ ] Test API function calls with mocked HTTP
- [ ] Test error handling for API failures
- [ ] Test React Query hook configuration
- [ ] Test store state transitions
- [ ] Test mock data structure

---

### T14: Build BudgetStatusBar Component

**Estimate**: 1hr
**Stories**: US-F02-14

**Description**: Create the visual budget utilization progress bar component.

**Subtasks**:
- [ ] Create `docker/hitl-ui/src/components/budget/BudgetStatusBar.tsx`
- [ ] Implement horizontal progress bar with utilization percentage
- [ ] Color coding: green (0-60%), yellow (60-80%), orange (80-95%), red (95%+)
- [ ] Numeric display: "X / Y tokens (Z%)"
- [ ] Status badge: "Warning", "Paused", "Exhausted"
- [ ] Tooltip with breakdown
- [ ] Write unit tests at `docker/hitl-ui/src/components/budget/BudgetStatusBar.test.tsx`

**Acceptance Criteria**:
- [ ] Correct color at each threshold
- [ ] Numeric display is accurate
- [ ] Badge shows for non-active states

**Test Cases**:
- [ ] Test green color at 50%
- [ ] Test yellow color at 70%
- [ ] Test orange color at 85%
- [ ] Test red color at 98%
- [ ] Test "Warning" badge at warning status
- [ ] Test "Paused" badge at paused status

---

### T15: Build BudgetTable Component

**Estimate**: 1.5hr
**Stories**: US-F02-15

**Description**: Create table showing all active budgets.

**Subtasks**:
- [ ] Create `docker/hitl-ui/src/components/budget/BudgetTable.tsx`
- [ ] Table columns: Agent, Task, Tokens Used, Budget, Status Bar, Status, Actions
- [ ] Integrate BudgetStatusBar for utilization visualization
- [ ] Sortable columns
- [ ] "Extend" action button for paused budgets (triggers dialog)
- [ ] "Reset" action button
- [ ] Loading skeleton and empty state
- [ ] Write unit tests at `docker/hitl-ui/src/components/budget/BudgetTable.test.tsx`

**Acceptance Criteria**:
- [ ] Table renders all active budgets
- [ ] Sort changes column order
- [ ] Extend button only visible for paused/exhausted budgets
- [ ] Loading and empty states render correctly

**Test Cases**:
- [ ] Test table rendering with multiple budgets
- [ ] Test sort by tokens used
- [ ] Test extend button visibility
- [ ] Test reset button callback
- [ ] Test loading skeleton
- [ ] Test empty state

---

### T16: Build CircuitBreakerStatus Component

**Estimate**: 1hr
**Stories**: US-F02-16

**Description**: Create table showing circuit breaker status for all agents.

**Subtasks**:
- [ ] Create `docker/hitl-ui/src/components/budget/CircuitBreakerStatus.tsx`
- [ ] Table: Agent, State (color dot), Iterations, Duplicates, Trip Reason, Actions
- [ ] State colors: green (closed), yellow (half_open), red (open)
- [ ] "Reset" and "Acknowledge" action buttons
- [ ] Write unit tests at `docker/hitl-ui/src/components/budget/CircuitBreakerStatus.test.tsx`

**Acceptance Criteria**:
- [ ] Correct state colors
- [ ] Trip reason displayed when open
- [ ] Actions appropriate for state

**Test Cases**:
- [ ] Test closed state rendering (green)
- [ ] Test open state rendering (red, trip reason visible)
- [ ] Test half_open state rendering (yellow)
- [ ] Test reset button callback
- [ ] Test acknowledge button callback

---

### T17: Build AlertPanel Component

**Estimate**: 1hr
**Stories**: US-F02-17

**Description**: Create collapsible panel for budget alerts.

**Subtasks**:
- [ ] Create `docker/hitl-ui/src/components/budget/AlertPanel.tsx`
- [ ] Alert list sorted by timestamp (newest first)
- [ ] Each alert: timestamp, agent, type, message, acknowledge button
- [ ] Visual distinction for acknowledged vs unacknowledged
- [ ] Filter toggle: all / unacknowledged
- [ ] Bulk acknowledge button
- [ ] Collapsible with unacknowledged count in header
- [ ] Write unit tests at `docker/hitl-ui/src/components/budget/AlertPanel.test.tsx`

**Acceptance Criteria**:
- [ ] Alerts display correctly
- [ ] Acknowledge button works
- [ ] Bulk acknowledge works
- [ ] Filter toggles visibility

**Test Cases**:
- [ ] Test alert rendering
- [ ] Test acknowledge single alert
- [ ] Test bulk acknowledge
- [ ] Test filter by acknowledged status
- [ ] Test collapsible toggle

---

### T18: Build CostDashboard Page and Navigation

**Estimate**: 1.5hr
**Stories**: US-F02-13

**Description**: Create the main cost dashboard page and add to navigation.

**Subtasks**:
- [ ] Create `docker/hitl-ui/src/components/budget/CostDashboard.tsx`
- [ ] Summary cards: Active Agents, Total Tokens, Budget Status, Circuit Status
- [ ] Integrate BudgetTable
- [ ] Integrate CircuitBreakerStatus
- [ ] Integrate AlertPanel (collapsible)
- [ ] Auto-refresh with configurable interval (default 15s)
- [ ] Manual refresh button
- [ ] Create barrel export at `docker/hitl-ui/src/components/budget/index.ts`
- [ ] Add route `/cost-dashboard` to router
- [ ] Add navigation item to sidebar
- [ ] Write unit tests at `docker/hitl-ui/src/components/budget/CostDashboard.test.tsx`

**Acceptance Criteria**:
- [ ] Page accessible via /cost-dashboard
- [ ] Summary cards show aggregate data
- [ ] Auto-refresh updates data
- [ ] Navigation item visible in sidebar
- [ ] All sub-components integrated

**Test Cases**:
- [ ] Test page rendering
- [ ] Test summary card calculations
- [ ] Test auto-refresh timer
- [ ] Test manual refresh
- [ ] Test navigation link

---

## Phase 6: Guidelines, Configuration, and Integration

### T19: Create Budget Guardrails Guidelines Bootstrap

**Estimate**: 1hr
**Stories**: US-F02-19

**Description**: Create bootstrap script for budget and circuit breaker guardrails guidelines.

**Subtasks**:
- [ ] Create `scripts/bootstrap_budget_guidelines.py`
- [ ] Define "token-budget-enforcement" guideline (category: context_constraint, priority: 850)
- [ ] Define "circuit-breaker-enforcement" guideline (category: context_constraint, priority: 900)
- [ ] Implement idempotent upsert (skip existing)
- [ ] Add CLI interface (--es-url, --dry-run, --index-prefix)
- [ ] Write unit tests at `tests/unit/scripts/test_bootstrap_budget_guidelines.py`

**Acceptance Criteria**:
- [ ] Both guidelines created with correct structure
- [ ] Bootstrap is idempotent
- [ ] Dry-run mode previews without writing
- [ ] CLI works correctly

**Test Cases**:
- [ ] Test guideline structure matches design spec
- [ ] Test idempotent behavior (run twice, no duplicates)
- [ ] Test dry-run output
- [ ] Test CLI argument parsing

---

### T20: Configure Hooks in Settings and Documentation

**Estimate**: 45min
**Stories**: US-F02-20

**Description**: Register the PostToolUse hook in settings.json and update documentation.

**Subtasks**:
- [ ] Add PostToolUse hook entry to `.claude/settings.json` for budget-track.py
- [ ] Verify existing PreToolUse hooks still work with budget extensions
- [ ] Update CLAUDE.md with budget system section
- [ ] Document environment variables in docs/
- [ ] Document hook behavior and fail-safe guarantees

**Acceptance Criteria**:
- [ ] PostToolUse hook registered with 2000ms timeout
- [ ] Existing hooks unaffected
- [ ] Documentation is clear and complete

**Test Cases**:
- [ ] Verify settings.json is valid JSON after modification
- [ ] Verify hook script is executable
- [ ] Verify documentation links are valid

---

### T21: Write Integration Tests

**Estimate**: 1.5hr
**Stories**: US-F02-04, US-F02-05, US-F02-06, US-F02-11

**Description**: Create integration tests for the full budget and circuit breaker system.

**Subtasks**:
- [ ] Create `tests/integration/test_budget_store_redis.py` (requires Redis)
- [ ] Test budget CRUD against real Redis
- [ ] Test atomic token increment against real Redis
- [ ] Test circuit breaker state persistence
- [ ] Test alert lifecycle
- [ ] Create `tests/integration/test_budget_api_integration.py`
- [ ] Test REST API endpoints against mocked store
- [ ] Test budget extension flow
- [ ] Test circuit reset flow

**Acceptance Criteria**:
- [ ] Integration tests pass against running Redis
- [ ] API integration tests pass with mocked dependencies
- [ ] State is correctly persisted and retrieved

**Test Cases**:
- [ ] Test budget create-read-update-delete in Redis
- [ ] Test concurrent token increments (simulate parallel calls)
- [ ] Test circuit breaker state transitions in Redis
- [ ] Test budget extension via REST API
- [ ] Test circuit reset via REST API
- [ ] Test alert acknowledge via REST API

---

## Progress

- **Started**: Not started
- **Tasks Complete**: 0/21
- **Percentage**: 0%
- **Status**: PLANNED
- **Blockers**: None

## Task Summary

| Phase | Tasks | Estimate | Status |
|-------|-------|----------|--------|
| Phase 1: Models, Config, Exceptions | T01-T03 | 3hr | [ ] |
| Phase 2: Redis Store + Core Logic | T04-T07 | 6hr | [ ] |
| Phase 3: Hooks | T08-T10 | 3.25hr | [ ] |
| Phase 4: REST API | T11-T12 | 3hr | [ ] |
| Phase 5: UI | T13-T18 | 7.5hr | [ ] |
| Phase 6: Guidelines + Integration | T19-T21 | 3.25hr | [ ] |

**Total Estimated Time**: ~26 hours

## Task Dependencies

```
T01 ──┐
T02 ──┼──> T04 ──> T05 ──> T08 ──> T09
T03 ──┘         │         │
                ├──> T06 ──┘
                │
                ├──> T07
                │
                └──> T11 ──> T12 ──> T13 ──> T14
                                            ├──> T15
                                            ├──> T16
                                            ├──> T17
                                            └──> T18

T05 ──> T10

T19 (independent, needs ES only)
T20 (depends on T08, T09, T10)
T21 (depends on T04, T05, T06, T12)
```

## Implementation Order (Recommended Build Sequence)

**Week 1: Core Backend**
1. T01, T02, T03 (Models, Config, Exceptions) - parallel
2. T04 (Redis Store)
3. T05, T06 (Budget Tracker, Circuit Breaker) - parallel
4. T07 (Metrics)

**Week 2: Hooks + API**
5. T08 (PostToolUse Hook)
6. T09, T10 (PreToolUse Extension, UserPromptSubmit Extension) - parallel
7. T11 (API Models)
8. T12 (REST API)

**Week 3: UI + Integration**
9. T13 (Types, API Client, Store)
10. T14, T15, T16, T17 (UI Components) - can be partially parallelized
11. T18 (CostDashboard Page)
12. T19 (Guidelines Bootstrap)
13. T20 (Hook Configuration)
14. T21 (Integration Tests)

## Testing Strategy

- Unit tests mock Redis for fast execution
- Integration tests use real Redis in Docker
- UI tests use mock data by default
- Hook tests verify stdin/stdout JSON contract and exit codes
- All state transitions tested via unit tests
- Concurrency tested in integration tests

## Risk Mitigation

1. **Token Usage Availability**: Not all tool responses include token metadata. PostToolUse hook handles missing data gracefully (skip, allow).
2. **Redis Latency**: All Redis operations use atomic commands (INCRBY, HINCRBY). Expected sub-ms latency. Hooks have 2s timeout.
3. **False Positive Trips**: Circuit breaker thresholds are configurable. Start with generous defaults (50 iterations, 5 duplicates). Easy HITL reset.
4. **Hook Compatibility**: New PostToolUse hook is independent. PreToolUse/UserPromptSubmit extensions are additive (existing behavior preserved).
5. **UI Complexity**: Start with minimal dashboard, add features incrementally. Use mock data for development.

## Completion Checklist

- [ ] All tasks in Task List are marked complete
- [ ] All unit tests pass: `./tools/test.sh tests/unit/`
- [ ] All integration tests pass: `./tools/test.sh tests/integration/`
- [ ] Linter passes: `./tools/lint.sh src/`
- [ ] Documentation updated
- [ ] Interface contracts verified against design.md
- [ ] Progress marked as 100% in tasks.md
