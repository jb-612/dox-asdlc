# P12-F02 Token Budget Enforcement & Circuit Breaker - Technical Design

**Version:** 1.0
**Date:** 2026-02-09
**Status:** Draft

## 1. Overview

Implement a **Token Budget Enforcement** system and **Circuit Breaker** module to prevent runaway agent behavior and control costs. This addresses two critical gaps:

- **CRITICAL (C2):** No per-task cost cap with automatic pause. Runaway agents can consume unlimited tokens.
- **HIGH (H2):** No loop detection, no confidence scoring, no automatic termination of spinning agents.

### 1.1 Goals

1. Track cumulative token usage per task and per session
2. Enforce configurable token budgets with alert thresholds and mandatory pause at limit
3. Detect and terminate looping or spinning agents via circuit breaker
4. Provide HITL escalation when budgets are exceeded or circuits trip
5. Expose token spend and circuit breaker status in the HITL UI
6. Integrate with the existing guardrails hook pipeline for enforcement
7. Emit Prometheus metrics for observability

### 1.2 Non-Goals

- Real-time dollar cost estimation (requires API pricing data that changes; token counts are the proxy)
- Replacing the existing `ContextPack.token_budget` field (that controls context window size, not spend)
- Billing or payment integration
- Automatic budget adjustment based on task complexity (future enhancement)
- Modifying Claude API call patterns (this system monitors, not intercepts API calls)

## 2. Dependencies

### 2.1 Internal Dependencies

| Dependency | Status | Description |
|------------|--------|-------------|
| P11-F01 | Complete (95%) | Guardrails system: hooks, evaluator, models, guidelines |
| P02-F07 | Complete | Prometheus metrics collection infrastructure |
| P02-F08 | Partial | Agent Telemetry API (AgentMetrics model has `total_tokens_used`) |
| P01-F01 | Complete | Redis infrastructure for state persistence |
| P05-F01 | Complete | HITL UI infrastructure |

### 2.2 External Dependencies

- No new Python packages required (`prometheus_client` already present)
- No new npm packages required (React + Zustand already present)
- Redis already deployed in all environments

## 3. Architecture

### 3.1 High-Level Design

```
+---------------------------------------------------------------------+
|  Claude CLI Session                                                  |
|                                                                      |
|  User Prompt ------> guardrails-inject.py (UserPromptSubmit)         |
|                       | Injects budget status as additionalContext   |
|                       | Reads from budget tracker (Redis)            |
|                                                                      |
|  Tool Call ---------> guardrails-enforce.py (PreToolUse)             |
|                       | Checks circuit breaker state                 |
|                       | Blocks if budget exhausted or circuit open   |
|                                                                      |
|  After Tool Call ---> budget-tracker.py (PostToolUse)                |
|                       | Records token usage from tool response       |
|                       | Updates cumulative counter in Redis          |
|                       | Checks budget threshold + circuit breaker    |
|                       | Trips circuit if anomaly detected            |
+---------------------------------------------------------------------+
         |                                    |
         v                                    v
+------------------+              +------------------------+
| Redis            |              | Prometheus             |
| Budget State     |              | /metrics               |
| Circuit State    |              | asdlc_token_*          |
| Iteration Log    |              | asdlc_circuit_*        |
+------------------+              +------------------------+
         |
         v
+------------------+
| HITL UI          |
| /cost-dashboard  |
| Budget bars      |
| Circuit status   |
+------------------+
```

### 3.2 Component Overview

| Component | Location | Purpose |
|-----------|----------|---------|
| TokenBudgetTracker | `src/core/budget/tracker.py` | Core logic: cumulative token tracking per task/session |
| TokenBudgetConfig | `src/core/budget/config.py` | Environment-based configuration for budgets |
| CircuitBreaker | `src/core/budget/circuit_breaker.py` | Loop detection, iteration limits, anomaly detection |
| Budget Models | `src/core/budget/models.py` | Frozen dataclasses: BudgetState, CircuitState, BudgetAlert |
| Budget Exceptions | `src/core/budget/exceptions.py` | BudgetExceededError, CircuitOpenError |
| Budget Redis Store | `src/infrastructure/budget/budget_store.py` | Redis persistence for budget and circuit state |
| Budget Metrics | `src/infrastructure/budget/budget_metrics.py` | Prometheus metric definitions |
| PostToolUse Hook | `.claude/hooks/budget-track.py` | Captures token usage after each tool call |
| Budget REST API | `src/orchestrator/routes/budget_api.py` | REST endpoints for budget status and management |
| Budget API Models | `src/orchestrator/api/models/budget.py` | Pydantic request/response models |
| Cost Dashboard | `docker/hitl-ui/src/components/budget/` | React components for token spend visualization |
| Budget Guidelines | `scripts/bootstrap_budget_guidelines.py` | Default guardrails guidelines for budget enforcement |

## 4. Token Budget Tracker

### 4.1 Core Data Models

```python
@dataclass(frozen=True)
class BudgetState:
    """Current budget state for a task or session.

    Attributes:
        budget_id: Unique ID (e.g., "session:{session_id}" or "task:{task_id}")
        budget_type: "session" or "task"
        max_tokens: Configured maximum token budget
        tokens_used: Cumulative tokens consumed
        alert_threshold: Fraction at which to alert (default 0.8)
        status: "active", "warning", "paused", "exhausted"
        started_at: When tracking began
        last_updated: Last token usage update
        agent: Agent role associated with this budget
        task_description: Human-readable task context
    """
    budget_id: str
    budget_type: str  # "session" | "task"
    max_tokens: int
    tokens_used: int
    alert_threshold: float
    status: str  # "active" | "warning" | "paused" | "exhausted"
    started_at: datetime
    last_updated: datetime
    agent: str
    task_description: str

    @property
    def utilization(self) -> float:
        """Budget utilization as a fraction (0.0 to 1.0+)."""
        if self.max_tokens <= 0:
            return 0.0
        return self.tokens_used / self.max_tokens

    @property
    def remaining(self) -> int:
        """Tokens remaining before budget exhaustion."""
        return max(0, self.max_tokens - self.tokens_used)


@dataclass(frozen=True)
class CircuitState:
    """Circuit breaker state for an agent session.

    Attributes:
        circuit_id: Unique ID (matches session or task budget_id)
        state: "closed" (normal), "open" (tripped), "half_open" (testing)
        iteration_count: Total tool call iterations in current task
        max_iterations: Configured maximum iterations
        duplicate_call_count: Consecutive identical tool calls detected
        duplicate_threshold: Threshold for duplicate detection
        last_tool_call: Signature of the most recent tool call
        trip_reason: Why the circuit was tripped (if open)
        tripped_at: When the circuit was tripped
        last_updated: Last state update
    """
    circuit_id: str
    state: str  # "closed" | "open" | "half_open"
    iteration_count: int
    max_iterations: int
    duplicate_call_count: int
    duplicate_threshold: int
    last_tool_call: str  # hash of tool name + arguments
    trip_reason: str
    tripped_at: datetime | None
    last_updated: datetime


@dataclass(frozen=True)
class BudgetAlert:
    """Alert generated when budget threshold is reached.

    Attributes:
        alert_id: Unique alert identifier
        budget_id: Associated budget
        alert_type: "warning_threshold", "budget_exhausted", "circuit_tripped"
        message: Human-readable alert message
        utilization: Budget utilization at time of alert
        timestamp: When the alert was generated
        acknowledged: Whether the user has acknowledged the alert
    """
    alert_id: str
    budget_id: str
    alert_type: str
    message: str
    utilization: float
    timestamp: datetime
    acknowledged: bool
```

### 4.2 TokenBudgetTracker Class

```python
class TokenBudgetTracker:
    """Tracks cumulative token usage and enforces budgets.

    The tracker operates per session and per task. Each tool call that
    returns token usage metadata is recorded. When cumulative usage
    crosses the alert threshold (default 80%), a warning is injected.
    When it hits 100%, execution is paused via HITL escalation.

    Usage:
        tracker = TokenBudgetTracker(store, config)
        state = await tracker.start_budget("session:abc", agent="backend", max_tokens=100000)
        state = await tracker.record_usage("session:abc", tokens=5000)
        if state.status == "paused":
            # HITL escalation required
    """

    def __init__(self, store: BudgetStore, config: TokenBudgetConfig) -> None:
        ...

    async def start_budget(
        self,
        budget_id: str,
        budget_type: str,
        agent: str,
        task_description: str = "",
        max_tokens: int | None = None,
    ) -> BudgetState:
        """Initialize or resume a token budget."""

    async def record_usage(
        self,
        budget_id: str,
        input_tokens: int = 0,
        output_tokens: int = 0,
    ) -> BudgetState:
        """Record token usage and update budget state.

        Returns updated BudgetState. Status transitions:
        - active -> warning (at alert_threshold)
        - warning -> paused (at 100%)
        - paused -> active (after HITL approval with budget increase)
        """

    async def get_state(self, budget_id: str) -> BudgetState | None:
        """Get current budget state."""

    async def extend_budget(
        self,
        budget_id: str,
        additional_tokens: int,
    ) -> BudgetState:
        """Extend budget after HITL approval."""

    async def reset_budget(self, budget_id: str) -> None:
        """Reset budget state (for new task)."""

    async def list_active_budgets(self) -> list[BudgetState]:
        """List all active budget states."""
```

### 4.3 Configuration

```python
@dataclass(frozen=True)
class TokenBudgetConfig:
    """Configuration for token budget enforcement.

    Loaded from environment variables via from_env().
    """
    enabled: bool = True
    default_session_budget: int = 500_000    # 500K tokens per session
    default_task_budget: int = 100_000       # 100K tokens per task
    alert_threshold: float = 0.8              # Alert at 80%
    pause_threshold: float = 1.0              # Pause at 100%
    budget_by_task_type: dict[str, int] = field(default_factory=lambda: {
        "planning": 50_000,
        "implement": 100_000,
        "review": 30_000,
        "test": 50_000,
        "deploy": 20_000,
        "design": 50_000,
    })
    redis_key_prefix: str = "asdlc:budget"
    budget_ttl_seconds: int = 86400          # 24 hours

    @classmethod
    def from_env(cls) -> TokenBudgetConfig:
        """Load configuration from environment variables."""
```

**Environment Variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `TOKEN_BUDGET_ENABLED` | `true` | Master enable/disable |
| `TOKEN_BUDGET_SESSION_DEFAULT` | `500000` | Default session budget (tokens) |
| `TOKEN_BUDGET_TASK_DEFAULT` | `100000` | Default task budget (tokens) |
| `TOKEN_BUDGET_ALERT_THRESHOLD` | `0.8` | Alert at this fraction (0.0-1.0) |
| `TOKEN_BUDGET_PAUSE_THRESHOLD` | `1.0` | Pause at this fraction |
| `TOKEN_BUDGET_TTL` | `86400` | Budget state TTL in seconds |

## 5. Circuit Breaker

### 5.1 Core Logic

```python
class CircuitBreaker:
    """Monitors agent behavior and trips on anomalies.

    Detection strategies:
    1. Iteration limit: Total tool calls exceed max_iterations
    2. Loop detection: Same tool + args called N consecutive times
    3. Rapid-fire detection: More than N calls in M seconds

    When tripped, the circuit moves to "open" state. The PreToolUse
    hook checks circuit state and blocks further tool calls until
    the user acknowledges via HITL gate.

    Usage:
        cb = CircuitBreaker(store, config)
        state = await cb.record_call("session:abc", tool="Write", args_hash="abc123")
        if state.state == "open":
            # Circuit tripped, block execution
    """

    def __init__(self, store: BudgetStore, config: CircuitBreakerConfig) -> None:
        ...

    async def record_call(
        self,
        circuit_id: str,
        tool: str,
        args_hash: str,
    ) -> CircuitState:
        """Record a tool call and evaluate circuit state.

        Returns updated CircuitState. State transitions:
        - closed -> open (on anomaly detection)
        - open -> half_open (after HITL acknowledgment)
        - half_open -> closed (after successful call)
        - half_open -> open (after another anomaly)
        """

    async def get_state(self, circuit_id: str) -> CircuitState | None:
        """Get current circuit state."""

    async def reset(self, circuit_id: str) -> CircuitState:
        """Reset circuit to closed state (after HITL approval)."""

    async def acknowledge(self, circuit_id: str) -> CircuitState:
        """Acknowledge tripped circuit (moves open -> half_open)."""

    def _detect_loop(self, state: CircuitState, args_hash: str) -> bool:
        """Check if current call is a repeated loop."""

    def _detect_iteration_limit(self, state: CircuitState) -> bool:
        """Check if iteration count exceeds maximum."""
```

### 5.2 Circuit Breaker Configuration

```python
@dataclass(frozen=True)
class CircuitBreakerConfig:
    """Configuration for the circuit breaker."""
    enabled: bool = True
    max_iterations_per_task: int = 50         # Hard limit on tool calls per task
    duplicate_call_threshold: int = 5         # Trip after N identical consecutive calls
    rapid_fire_window_seconds: int = 10       # Window for rapid-fire detection
    rapid_fire_threshold: int = 20            # Max calls in rapid-fire window
    cooldown_seconds: int = 60                # Cooldown before half_open -> closed

    @classmethod
    def from_env(cls) -> CircuitBreakerConfig:
        """Load configuration from environment variables."""
```

**Environment Variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `CIRCUIT_BREAKER_ENABLED` | `true` | Master enable/disable |
| `CIRCUIT_BREAKER_MAX_ITERATIONS` | `50` | Max tool calls per task |
| `CIRCUIT_BREAKER_DUPLICATE_THRESHOLD` | `5` | Identical consecutive calls to trip |
| `CIRCUIT_BREAKER_RAPID_FIRE_WINDOW` | `10` | Seconds for rapid-fire window |
| `CIRCUIT_BREAKER_RAPID_FIRE_THRESHOLD` | `20` | Max calls in rapid-fire window |
| `CIRCUIT_BREAKER_COOLDOWN` | `60` | Seconds before half_open -> closed |

## 6. Redis Storage

### 6.1 BudgetStore Class

```python
class BudgetStore:
    """Redis-backed storage for budget and circuit breaker state.

    Uses atomic Redis operations (INCRBY, HSET) for thread safety.
    All keys have configurable TTL to prevent stale state.
    """

    def __init__(self, redis_client, config: TokenBudgetConfig) -> None:
        ...

    # Budget operations
    async def get_budget(self, budget_id: str) -> BudgetState | None: ...
    async def set_budget(self, state: BudgetState) -> None: ...
    async def increment_usage(self, budget_id: str, tokens: int) -> int: ...
    async def list_budgets(self, pattern: str = "*") -> list[BudgetState]: ...
    async def delete_budget(self, budget_id: str) -> None: ...

    # Circuit breaker operations
    async def get_circuit(self, circuit_id: str) -> CircuitState | None: ...
    async def set_circuit(self, state: CircuitState) -> None: ...
    async def increment_iteration(self, circuit_id: str) -> int: ...
    async def record_tool_signature(self, circuit_id: str, sig: str) -> int: ...
    async def delete_circuit(self, circuit_id: str) -> None: ...

    # Alert operations
    async def add_alert(self, alert: BudgetAlert) -> None: ...
    async def list_alerts(self, budget_id: str | None = None) -> list[BudgetAlert]: ...
    async def acknowledge_alert(self, alert_id: str) -> None: ...
```

### 6.2 Redis Key Structure

```
asdlc:budget:state:{budget_id}            -> Hash (BudgetState fields)
asdlc:budget:usage:{budget_id}            -> String (atomic counter)
asdlc:circuit:state:{circuit_id}          -> Hash (CircuitState fields)
asdlc:circuit:iterations:{circuit_id}     -> String (atomic counter)
asdlc:circuit:toollog:{circuit_id}        -> List (recent tool call signatures, capped)
asdlc:budget:alerts:{budget_id}           -> List (BudgetAlert JSON entries)
asdlc:budget:active                       -> Set (active budget IDs)
```

All keys use the configured TTL (default 24 hours) to auto-expire.

## 7. Hook Integration

### 7.1 PostToolUse Hook (New)

**File:** `.claude/hooks/budget-track.py`

This is a **new** hook type. It runs after each tool call completes and captures token usage from the response metadata.

**Input (stdin JSON):**
```json
{
  "tool": "Task",
  "arguments": {"agent": "backend", "prompt": "..."},
  "response": {"content": "...", "usage": {"input_tokens": 5000, "output_tokens": 2000}},
  "sessionId": "session-abc123"
}
```

**Behavior:**
1. Extract token usage from response metadata (if available)
2. Compute args hash for circuit breaker (tool name + hash of key arguments)
3. Update budget tracker via Redis (atomic increment)
4. Update circuit breaker via Redis (record call)
5. Check thresholds:
   - If budget at warning threshold: output `additionalContext` with warning
   - If budget exhausted: output blocking message, exit 2
   - If circuit tripped: output blocking message, exit 2
6. Write updated state to session cache file for cross-hook access

**Output (budget warning, exit 0):**
```json
{
  "additionalContext": "## Budget Warning\nToken usage at 82% (82,000 / 100,000). Consider wrapping up current task."
}
```

**Output (budget exhausted, exit 2):**
```json
{
  "reason": "Token budget exhausted (100,000 / 100,000 tokens used). HITL review required to continue."
}
```

### 7.2 PreToolUse Hook Extension

The existing `guardrails-enforce.py` hook is extended (not replaced) to also check:

1. Budget state from cache: if status is "paused" or "exhausted", block tool call
2. Circuit state from cache: if state is "open", block tool call

This ensures enforcement even if the PostToolUse hook has not run yet (e.g., first call of a session where budget was exhausted in a previous session).

### 7.3 UserPromptSubmit Hook Extension

The existing `guardrails-inject.py` hook is extended to inject budget status into the context:

```json
{
  "additionalContext": "## Active Guardrails\n...\n\n## Budget Status\nSession budget: 45,000 / 100,000 tokens (45%)\nCircuit breaker: closed (12/50 iterations)"
}
```

### 7.4 Cross-Hook State

Budget and circuit state is shared between hooks via the existing session cache mechanism:

```
/tmp/guardrails-{sessionId}.json
```

Extended structure:
```json
{
  "timestamp": "...",
  "ttl_seconds": 300,
  "context": {"agent": "backend", "domain": "P01", "action": "implement"},
  "evaluated": { ... },
  "budget": {
    "budget_id": "session:abc123",
    "tokens_used": 45000,
    "max_tokens": 100000,
    "status": "active",
    "utilization": 0.45
  },
  "circuit": {
    "circuit_id": "session:abc123",
    "state": "closed",
    "iteration_count": 12,
    "max_iterations": 50
  }
}
```

## 8. Prometheus Metrics

### 8.1 New Metric Definitions

Add to `src/infrastructure/budget/budget_metrics.py`:

```python
# Token budget metrics
TOKENS_USED_TOTAL = Counter(
    "asdlc_tokens_used_total",
    "Cumulative tokens consumed",
    ["agent", "budget_type", "token_type"],  # token_type: input/output
)

BUDGET_UTILIZATION = Gauge(
    "asdlc_budget_utilization_ratio",
    "Current budget utilization (0.0 to 1.0+)",
    ["agent", "budget_type"],
)

BUDGET_ALERTS_TOTAL = Counter(
    "asdlc_budget_alerts_total",
    "Total budget alerts generated",
    ["agent", "alert_type"],
)

BUDGET_PAUSES_TOTAL = Counter(
    "asdlc_budget_pauses_total",
    "Total times execution was paused due to budget",
    ["agent"],
)

# Circuit breaker metrics
CIRCUIT_TRIPS_TOTAL = Counter(
    "asdlc_circuit_trips_total",
    "Total circuit breaker trips",
    ["agent", "trip_reason"],
)

CIRCUIT_STATE = Gauge(
    "asdlc_circuit_state",
    "Circuit breaker state (0=closed, 1=half_open, 2=open)",
    ["agent"],
)

TOOL_ITERATIONS_TOTAL = Counter(
    "asdlc_tool_iterations_total",
    "Total tool call iterations",
    ["agent", "tool"],
)
```

### 8.2 Metric Labels

Following the established `asdlc_` prefix convention from `src/infrastructure/metrics/definitions.py`.

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `asdlc_tokens_used_total` | Counter | agent, budget_type, token_type | Cumulative token consumption |
| `asdlc_budget_utilization_ratio` | Gauge | agent, budget_type | Current utilization fraction |
| `asdlc_budget_alerts_total` | Counter | agent, alert_type | Alert count by type |
| `asdlc_budget_pauses_total` | Counter | agent | Execution pauses from budget |
| `asdlc_circuit_trips_total` | Counter | agent, trip_reason | Circuit breaker trips |
| `asdlc_circuit_state` | Gauge | agent | Current circuit state |
| `asdlc_tool_iterations_total` | Counter | agent, tool | Tool call iteration count |

## 9. REST API

### 9.1 Endpoints

```python
# src/orchestrator/routes/budget_api.py

@router.get("/api/budget")
async def list_budgets() -> BudgetListResponse:
    """List all active budget states."""

@router.get("/api/budget/{budget_id}")
async def get_budget(budget_id: str) -> BudgetStateResponse:
    """Get budget state for a specific task or session."""

@router.post("/api/budget/{budget_id}/extend")
async def extend_budget(
    budget_id: str, request: ExtendBudgetRequest
) -> BudgetStateResponse:
    """Extend budget after HITL approval."""

@router.post("/api/budget/{budget_id}/reset")
async def reset_budget(budget_id: str) -> None:
    """Reset budget state."""

@router.get("/api/circuit")
async def list_circuits() -> CircuitListResponse:
    """List all circuit breaker states."""

@router.get("/api/circuit/{circuit_id}")
async def get_circuit(circuit_id: str) -> CircuitStateResponse:
    """Get circuit breaker state."""

@router.post("/api/circuit/{circuit_id}/reset")
async def reset_circuit(circuit_id: str) -> CircuitStateResponse:
    """Reset circuit breaker (HITL approval)."""

@router.post("/api/circuit/{circuit_id}/acknowledge")
async def acknowledge_circuit(circuit_id: str) -> CircuitStateResponse:
    """Acknowledge tripped circuit (moves to half_open)."""

@router.get("/api/budget/alerts")
async def list_alerts(
    budget_id: str | None = None,
    acknowledged: bool | None = None,
) -> AlertListResponse:
    """List budget alerts."""

@router.post("/api/budget/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str) -> None:
    """Acknowledge a budget alert."""
```

### 9.2 Request/Response Models

```python
class BudgetStateResponse(BaseModel):
    budget_id: str
    budget_type: str
    max_tokens: int
    tokens_used: int
    utilization: float
    remaining: int
    status: str
    alert_threshold: float
    agent: str
    task_description: str
    started_at: str
    last_updated: str

class ExtendBudgetRequest(BaseModel):
    additional_tokens: int = Field(gt=0, le=1_000_000)
    reason: str

class CircuitStateResponse(BaseModel):
    circuit_id: str
    state: str
    iteration_count: int
    max_iterations: int
    duplicate_call_count: int
    trip_reason: str
    tripped_at: str | None
    last_updated: str

class BudgetListResponse(BaseModel):
    budgets: list[BudgetStateResponse]
    total: int

class CircuitListResponse(BaseModel):
    circuits: list[CircuitStateResponse]
    total: int

class AlertResponse(BaseModel):
    alert_id: str
    budget_id: str
    alert_type: str
    message: str
    utilization: float
    timestamp: str
    acknowledged: bool

class AlertListResponse(BaseModel):
    alerts: list[AlertResponse]
    total: int
```

## 10. HITL UI Components

### 10.1 Component Architecture

```
docker/hitl-ui/src/
  components/
    budget/
      CostDashboard.tsx              # Main cost dashboard page
      CostDashboard.test.tsx
      BudgetStatusBar.tsx            # Visual budget utilization bar
      BudgetStatusBar.test.tsx
      BudgetTable.tsx                # Table of all active budgets
      BudgetTable.test.tsx
      CircuitBreakerStatus.tsx       # Circuit breaker state display
      CircuitBreakerStatus.test.tsx
      AlertPanel.tsx                 # Budget alerts with acknowledge
      AlertPanel.test.tsx
      TokenSpendChart.tsx            # Historical token spend line chart
      TokenSpendChart.test.tsx
      index.ts                       # Barrel export
  api/
    budget.ts                        # API client functions
    budget.test.ts
    mocks/
      budgetData.ts                  # Mock data for development
  stores/
    budgetStore.ts                   # Zustand store
    budgetStore.test.ts
```

### 10.2 Page Layout

```
+----------------------------------------------------------+
| Header: "Cost & Budget Dashboard"      [Refresh] [Config] |
+----------------------------------------------------------+
| Summary Cards                                             |
| +--------+ +--------+ +--------+ +--------+              |
| | Active | | Total  | | Budget | | Circuit|              |
| | Agents | | Tokens | | Status | | Status |              |
| |   3    | | 245K   | | 2 OK   | | All OK |              |
| +--------+ +--------+ +--------+ +--------+              |
+----------------------------------------------------------+
| Active Budgets                                            |
| +------------------------------------------------------+ |
| | Agent   | Task       | Used   | Budget | Status      | |
| | backend | P04-T03    | 82K    | 100K   | [=====-] W  | |
| | planner | P12-F02    | 15K    | 50K    | [=------ ] A | |
| | review  | code-rev   | 28K    | 30K    | [======-] W  | |
| +------------------------------------------------------+ |
+----------------------------------------------------------+
| Circuit Breakers                                          |
| +------------------------------------------------------+ |
| | Agent   | State   | Iterations | Duplicates | Action | |
| | backend | closed  | 12/50      | 0/5        |        | |
| | review  | closed  | 8/50       | 0/5        |        | |
| +------------------------------------------------------+ |
+----------------------------------------------------------+
| Alerts (collapsible)                                      |
| +------------------------------------------------------+ |
| | 10:30 | backend | Warning: 80% budget | [Ack]       | |
| | 10:25 | review  | Warning: 93% budget | [Ack]       | |
| +------------------------------------------------------+ |
+----------------------------------------------------------+
```

### 10.3 TypeScript Types

```typescript
interface BudgetState {
  budget_id: string;
  budget_type: "session" | "task";
  max_tokens: number;
  tokens_used: number;
  utilization: number;
  remaining: number;
  status: "active" | "warning" | "paused" | "exhausted";
  alert_threshold: number;
  agent: string;
  task_description: string;
  started_at: string;
  last_updated: string;
}

interface CircuitState {
  circuit_id: string;
  state: "closed" | "half_open" | "open";
  iteration_count: number;
  max_iterations: number;
  duplicate_call_count: number;
  trip_reason: string;
  tripped_at: string | null;
  last_updated: string;
}

interface BudgetAlert {
  alert_id: string;
  budget_id: string;
  alert_type: "warning_threshold" | "budget_exhausted" | "circuit_tripped";
  message: string;
  utilization: number;
  timestamp: string;
  acknowledged: boolean;
}
```

## 11. Guardrails Integration

### 11.1 New Guidelines

Two new guardrails guidelines are bootstrapped for budget enforcement:

```python
# Token budget enforcement guideline
Guideline(
    id="token-budget-enforcement",
    name="Token Budget Enforcement",
    description="Enforces per-task and per-session token budgets with HITL escalation.",
    enabled=True,
    category=GuidelineCategory.CONTEXT_CONSTRAINT,
    priority=850,
    condition=GuidelineCondition(
        actions=["implement", "code", "review", "test", "design", "plan"]
    ),
    action=GuidelineAction(
        type=ActionType.CONSTRAINT,
        instruction="Token budget is enforced. Monitor usage in budget status. "
                    "At 80%, wrap up current work. At 100%, execution pauses for HITL review.",
        parameters={"budget_type": "task", "enforcement": "mandatory"},
    ),
)

# Circuit breaker guideline
Guideline(
    id="circuit-breaker-enforcement",
    name="Circuit Breaker: Runaway Agent Protection",
    description="Detects and terminates looping or spinning agents.",
    enabled=True,
    category=GuidelineCategory.CONTEXT_CONSTRAINT,
    priority=900,
    condition=GuidelineCondition(),  # Matches all contexts (wildcard)
    action=GuidelineAction(
        type=ActionType.CONSTRAINT,
        instruction="Circuit breaker is active. Avoid repetitive identical tool calls. "
                    "If stuck in a loop, stop and request help rather than retrying the same approach.",
        parameters={"max_iterations": 50, "duplicate_threshold": 5},
    ),
)
```

### 11.2 New GuidelineCategory Value

No new category needed. Both guidelines use the existing `CONTEXT_CONSTRAINT` category.

### 11.3 New ActionType

No new action type needed. The existing `CONSTRAINT` type with `parameters` dict is sufficient.

## 12. File Structure

```
src/
  core/
    budget/
      __init__.py
      models.py                # BudgetState, CircuitState, BudgetAlert dataclasses
      tracker.py               # TokenBudgetTracker class
      circuit_breaker.py       # CircuitBreaker class
      config.py                # TokenBudgetConfig, CircuitBreakerConfig
      exceptions.py            # BudgetExceededError, CircuitOpenError
  infrastructure/
    budget/
      __init__.py
      budget_store.py          # Redis persistence
      budget_metrics.py        # Prometheus metric definitions
  orchestrator/
    routes/
      budget_api.py            # REST API endpoints
    api/
      models/
        budget.py              # Pydantic request/response models

.claude/hooks/
  budget-track.py              # PostToolUse hook for token tracking

docker/hitl-ui/src/
  api/
    budget.ts                  # API client
    budget.test.ts
    mocks/
      budgetData.ts            # Mock data
  components/
    budget/
      CostDashboard.tsx
      CostDashboard.test.tsx
      BudgetStatusBar.tsx
      BudgetStatusBar.test.tsx
      BudgetTable.tsx
      BudgetTable.test.tsx
      CircuitBreakerStatus.tsx
      CircuitBreakerStatus.test.tsx
      AlertPanel.tsx
      AlertPanel.test.tsx
      TokenSpendChart.tsx
      TokenSpendChart.test.tsx
      index.ts
  stores/
    budgetStore.ts
    budgetStore.test.ts

scripts/
  bootstrap_budget_guidelines.py   # Bootstrap budget/circuit guidelines

tests/
  unit/
    core/
      budget/
        test_models.py
        test_tracker.py
        test_circuit_breaker.py
        test_config.py
    infrastructure/
      budget/
        test_budget_store.py
        test_budget_metrics.py
    orchestrator/
      routes/
        test_budget_api.py
    hooks/
      test_budget_track.py
  integration/
    test_budget_store_redis.py
    test_budget_api_integration.py
```

## 13. Security Considerations

1. **Budget state isolation**: Budget IDs include session/task scope to prevent cross-session interference
2. **No secrets in Redis**: Budget state contains only token counts and metadata, no sensitive data
3. **HITL required for budget extension**: Users must explicitly approve additional token spend
4. **Rate limiting on API**: Budget extension endpoint should have rate limiting to prevent abuse
5. **TTL on all keys**: Redis keys auto-expire to prevent unbounded growth

## 14. Performance Considerations

1. **Atomic Redis operations**: `INCRBY` for token counter, `HINCRBY` for iteration counter -- no read-modify-write races
2. **Hook latency**: PostToolUse hook must complete within 2 seconds. Redis operations are sub-millisecond. Total expected latency < 50ms.
3. **Cache reuse**: Budget state is cached in the session temp file; Redis is only queried when cache is stale or missing
4. **Metric cardinality**: Limited label values (agent roles, budget types) prevent Prometheus cardinality explosion

## 15. Fail-Safe Behavior

The system follows fail-safe (allow) principles:

| Failure | Behavior |
|---------|----------|
| Redis unavailable | Allow execution, log warning |
| Hook timeout | Allow execution (exit 0) |
| Cache file missing | Query Redis directly; if Redis also fails, allow |
| Malformed token usage | Skip recording, log warning, allow execution |

This ensures that monitoring failures never block legitimate agent work.

## 16. Testing Strategy

### 16.1 Unit Tests

- Model creation and serialization
- TokenBudgetTracker threshold logic (active -> warning -> paused transitions)
- CircuitBreaker loop detection and iteration limits
- Configuration loading from environment
- Hook input/output parsing

### 16.2 Integration Tests

- Redis store operations (requires Redis)
- REST API endpoints
- Full tracker + store flow
- Budget extension flow
- Circuit breaker trip and recovery flow

### 16.3 UI Tests

- Component rendering with mock data
- Budget status bar visualization
- Alert acknowledgment flow
- Store state transitions

### 16.4 Hook Tests

- PostToolUse hook with various response formats
- Cross-hook state sharing (cache file read/write)
- Budget exhaustion blocking behavior
- Circuit breaker blocking behavior

## 17. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Token usage not available in hook response | No tracking data | Graceful degradation: skip recording when metadata absent |
| Redis latency affects hook performance | Slow tool calls | Sub-ms Redis ops; async where possible; timeout + allow |
| False positive circuit trips | Legitimate repetitive work blocked | Configurable thresholds; HITL review before blocking |
| Budget too restrictive for complex tasks | Agents paused frequently | Per-task-type budgets; easy HITL extension flow |
| Race conditions in budget updates | Inaccurate counts | Atomic Redis operations (INCRBY) |
| Hook not triggered for all tool calls | Incomplete tracking | Document which tools report usage; aggregate at session level |

## 18. Open Questions

1. Should budget extension require a reason/justification that is logged?
2. Should there be a "soft" mode where budget warnings are injected but execution is never paused?
3. Should circuit breaker detect semantic similarity (not just exact match) for loop detection?
4. Should we integrate with the Agent Telemetry API (P02-F08) for historical analysis?
