# P13-F01: Agent Cost Tracker - Design

**Version:** 1.0
**Date:** 2026-02-10
**Status:** Draft
**Pillar:** P13 - Observability & Analytics

## Overview and Goals

Track API token usage and estimated costs per agent, session, and model across the aSDLC project. Provide a backend REST API for cost data and a React dashboard in the HITL UI with breakdown charts.

### Goals

1. Capture token usage (input/output) from PostToolUse hook telemetry
2. Estimate USD costs using a configurable model pricing table
3. Expose cost data via FastAPI REST endpoints for querying and aggregation
4. Display cost insights in a dedicated HITL UI dashboard page at `/costs`
5. Support filtering by agent, session, model, and time range

### Non-Goals

- Real-time streaming of cost events (polling is sufficient)
- Integration with billing systems or payment APIs
- Cost budgets or alerting (future feature)
- Modifying the Claude API to extract actual token counts (uses estimates from hook metadata)

## Technical Approach

### Data Flow

```
Claude API call
    |
    v
PostToolUse hook fires
    |
    v
hook-wrapper.py captures payload (includes tool response metadata)
    |
    v
cost_collector.py extracts token counts from payload_json
    |
    v
sqlite_store.py writes to cost_records table in ~/.asdlc/telemetry.db
    |
    v
cost_api.py (FastAPI) serves REST endpoints
    |
    v
HITL UI CostDashboardPage.tsx renders charts and tables
```

### Token Extraction Strategy

Claude Code hooks receive structured JSON payloads. The PostToolUse hook payload contains metadata about the tool execution. Token usage information is available in the hook payload's `usage` field when present. The cost collector will:

1. Listen for PostToolUse events in the hook pipeline
2. Extract `input_tokens`, `output_tokens`, and `model` from the payload
3. If token counts are not directly available, estimate from payload size using model-specific tokenizer ratios
4. Apply pricing from the model pricing table
5. Write a `cost_record` to SQLite

### Model Pricing Table

Pricing is stored as a Python dictionary in `src/core/costs/pricing.py` and can be updated without code changes via environment variables.

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------------------|------------------------|
| claude-opus-4-6 | $15.00 | $75.00 |
| claude-sonnet-4-5 | $3.00 | $15.00 |
| claude-haiku-4-5 | $0.80 | $4.00 |

The pricing table is a simple dict that maps model name prefixes to per-token costs. Unknown models fall back to the most expensive tier (Opus) to avoid under-counting.

## Interfaces and Dependencies

### Backend Dependencies

| Dependency | Purpose | Already in Project? |
|------------|---------|---------------------|
| SQLite (stdlib) | Cost record storage | Yes (telemetry.db) |
| FastAPI | REST API | Yes (orchestrator) |
| Pydantic | Request/response models | Yes (orchestrator) |
| Python datetime | Timestamp handling | Yes (stdlib) |

No new Python dependencies are required.

### Frontend Dependencies

| Dependency | Purpose | Already in Project? |
|------------|---------|---------------------|
| React | UI framework | Yes |
| TanStack Query | Data fetching hooks | Yes |
| Zustand | State management | Yes (stores pattern) |
| Recharts | Charts (bar, pie) | Yes (used by metrics) |
| Axios | HTTP client | Yes (apiClient) |
| Heroicons | Icons | Yes |

No new frontend dependencies are required. Recharts should already be available since the MetricsPage uses chart components. If not, it will need to be added.

### Internal Dependencies

| Component | Depends On |
|-----------|-----------|
| cost_collector.py | sqlite_store.py (writes cost_records) |
| cost_api.py | sqlite_store.py (reads cost_records) |
| hook-wrapper.py | cost_collector.py (invoked after PostToolUse) |
| CostDashboardPage.tsx | costs.ts API client |
| costs.ts | apiClient.ts (axios instance) |
| costsStore.ts | Zustand |

## Architecture Decisions

### AD-1: Extend existing SQLite telemetry database

**Decision:** Add a `cost_records` table to the existing `~/.asdlc/telemetry.db` rather than creating a separate database.

**Rationale:** The telemetry database already uses WAL mode for concurrent access, has an established init pattern in `sqlite_store.py`, and is already read by the dashboard server. Adding a table is simpler and maintains a single source of truth for telemetry data.

### AD-2: Backend reads SQLite directly rather than proxying through the telemetry dashboard

**Decision:** The FastAPI cost API reads SQLite directly using the same `sqlite_store.py` module, rather than proxying through the standalone dashboard server at localhost:9191.

**Rationale:** The standalone dashboard is a lightweight Python HTTP server for workstation use. The orchestrator FastAPI service is the canonical API backend for the HITL UI. Having the orchestrator read SQLite directly avoids an unnecessary network hop and coupling to the standalone dashboard's API.

### AD-3: PostToolUse hook integration for cost capture

**Decision:** Integrate cost collection into the existing PostToolUse hook pipeline via `hook-wrapper.py`, rather than creating a separate hook.

**Rationale:** The hook-wrapper already captures all hook events and writes to SQLite. Adding cost extraction as a post-processing step in the wrapper avoids additional hook overhead and keeps the pipeline unified.

### AD-4: Mock-first frontend with backend mode switching

**Decision:** Follow the established pattern from MetricsPage: provide mock data for development, with runtime backend switching (mock/api).

**Rationale:** Consistent with existing patterns (see `docker/hitl-ui/src/api/metrics.ts` and `docker/hitl-ui/src/api/mocks/`). Enables frontend development without a running backend.

### AD-5: Configurable pricing via Python dict, not database

**Decision:** Store model pricing in a Python module (`src/core/costs/pricing.py`) with environment variable overrides, not in SQLite or Elasticsearch.

**Rationale:** Pricing changes infrequently and is static configuration. A Python dict is simpler to maintain, version in git, and override via environment variables than a database table. If dynamic pricing management is needed in the future, a database-backed approach can be added.

## File Structure

### Backend Files (new)

```
src/core/costs/
    __init__.py              # Package init
    models.py                # Pydantic models: CostRecord, CostSummary, CostFilter
    pricing.py               # Model pricing table with env var overrides
    collector.py             # Token extraction + cost calculation logic

src/orchestrator/routes/
    cost_api.py              # FastAPI router: /api/costs endpoints

src/orchestrator/api/models/
    costs.py                 # API request/response Pydantic models

scripts/telemetry/
    sqlite_store.py          # MODIFIED: add cost_records table schema + CRUD functions
```

### Frontend Files (new)

```
docker/hitl-ui/src/api/
    costs.ts                 # API client functions + React Query hooks

docker/hitl-ui/src/api/mocks/
    costs.ts                 # Mock data for development

docker/hitl-ui/src/stores/
    costsStore.ts            # Zustand store for cost dashboard state

docker/hitl-ui/src/pages/
    CostDashboardPage.tsx    # Main cost dashboard page
    CostDashboardPage.test.tsx  # Page tests

docker/hitl-ui/src/components/costs/
    index.ts                 # Barrel export
    CostSummaryCards.tsx     # Summary cards (total, rate, top agent)
    CostBreakdownChart.tsx   # Bar/pie chart by agent and model
    SessionCostTable.tsx     # Sortable session cost table
    TimeRangeFilter.tsx      # Date range picker for filtering

docker/hitl-ui/src/types/
    costs.ts                 # TypeScript type definitions
```

### Modified Files

```
scripts/telemetry/sqlite_store.py   # Add cost_records schema + functions
scripts/hooks/hook-wrapper.py       # Add cost collection call for PostToolUse events
docker/hitl-ui/src/App.tsx          # Add /costs route
docker/hitl-ui/src/api/mocks/index.ts  # Export cost mock functions
```

## API Specification

### REST Endpoints

All endpoints prefixed with `/api/costs`.

#### GET /api/costs

List cost records with optional filters.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| agent_id | string | null | Filter by agent ID |
| session_id | string | null | Filter by session ID |
| model | string | null | Filter by model name |
| date_from | string | null | ISO date lower bound |
| date_to | string | null | ISO date upper bound |
| page | int | 1 | Page number (1-based) |
| page_size | int | 50 | Results per page (1-200) |

**Response:**

```json
{
  "records": [
    {
      "id": 1,
      "session_id": "sess-abc123",
      "agent_id": "pm",
      "model": "claude-opus-4-6",
      "input_tokens": 1500,
      "output_tokens": 800,
      "estimated_cost_usd": 0.0825,
      "timestamp": "2026-02-10T10:30:00Z",
      "tool_name": "Read",
      "hook_event_id": 42
    }
  ],
  "total": 150,
  "page": 1,
  "page_size": 50
}
```

#### GET /api/costs/summary

Aggregated costs grouped by dimensions.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| group_by | string | "agent" | Grouping: "agent", "model", "session", "hour", "day" |
| date_from | string | null | ISO date lower bound |
| date_to | string | null | ISO date upper bound |
| agent_id | string | null | Filter by agent |

**Response:**

```json
{
  "groups": [
    {
      "key": "pm",
      "total_input_tokens": 150000,
      "total_output_tokens": 85000,
      "total_cost_usd": 8.625,
      "record_count": 120
    },
    {
      "key": "backend",
      "total_input_tokens": 95000,
      "total_output_tokens": 42000,
      "total_cost_usd": 4.575,
      "record_count": 85
    }
  ],
  "total_cost_usd": 13.20,
  "total_input_tokens": 245000,
  "total_output_tokens": 127000,
  "period": {
    "from": "2026-02-10T00:00:00Z",
    "to": "2026-02-10T23:59:59Z"
  }
}
```

#### GET /api/costs/sessions/{session_id}

Per-session cost breakdown.

**Response:**

```json
{
  "session_id": "sess-abc123",
  "agent_id": "pm",
  "model_breakdown": [
    {
      "model": "claude-opus-4-6",
      "input_tokens": 50000,
      "output_tokens": 25000,
      "cost_usd": 2.625
    }
  ],
  "tool_breakdown": [
    {
      "tool_name": "Read",
      "call_count": 15,
      "total_cost_usd": 0.85
    }
  ],
  "total_cost_usd": 2.625,
  "started_at": "2026-02-10T09:00:00Z",
  "duration_minutes": 45
}
```

#### GET /api/costs/pricing

Return the current model pricing table.

**Response:**

```json
{
  "models": {
    "claude-opus-4-6": {
      "input_per_million": 15.0,
      "output_per_million": 75.0
    },
    "claude-sonnet-4-5": {
      "input_per_million": 3.0,
      "output_per_million": 15.0
    },
    "claude-haiku-4-5": {
      "input_per_million": 0.80,
      "output_per_million": 4.0
    }
  }
}
```

### SQLite Schema Extension

```sql
CREATE TABLE IF NOT EXISTS cost_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp REAL NOT NULL,
    session_id TEXT,
    agent_id TEXT,
    model TEXT,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    estimated_cost_usd REAL DEFAULT 0.0,
    tool_name TEXT,
    hook_event_id INTEGER,
    payload_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_cost_records_timestamp ON cost_records(timestamp);
CREATE INDEX IF NOT EXISTS idx_cost_records_session_id ON cost_records(session_id);
CREATE INDEX IF NOT EXISTS idx_cost_records_agent_id ON cost_records(agent_id);
CREATE INDEX IF NOT EXISTS idx_cost_records_model ON cost_records(model);
```

### TypeScript Types

```typescript
// docker/hitl-ui/src/types/costs.ts

export interface CostRecord {
  id: number;
  session_id: string;
  agent_id: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
  timestamp: string;
  tool_name: string | null;
  hook_event_id: number | null;
}

export interface CostSummaryGroup {
  key: string;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: number;
  record_count: number;
}

export interface CostSummaryResponse {
  groups: CostSummaryGroup[];
  total_cost_usd: number;
  total_input_tokens: number;
  total_output_tokens: number;
  period: {
    from: string;
    to: string;
  };
}

export interface SessionCostBreakdown {
  session_id: string;
  agent_id: string;
  model_breakdown: Array<{
    model: string;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
  }>;
  tool_breakdown: Array<{
    tool_name: string;
    call_count: number;
    total_cost_usd: number;
  }>;
  total_cost_usd: number;
  started_at: string;
  duration_minutes: number;
}

export interface CostRecordsResponse {
  records: CostRecord[];
  total: number;
  page: number;
  page_size: number;
}

export interface ModelPricing {
  input_per_million: number;
  output_per_million: number;
}

export interface PricingResponse {
  models: Record<string, ModelPricing>;
}

export type CostGroupBy = 'agent' | 'model' | 'session' | 'hour' | 'day';

export type CostTimeRange = '1h' | '24h' | '7d' | '30d' | 'all';
```

## Component Architecture

### Backend

```
src/core/costs/
    pricing.py          # MODEL_PRICING dict, get_pricing(model) -> (input_rate, output_rate)
    models.py           # CostRecord dataclass (frozen), CostFilter dataclass
    collector.py        # extract_cost_from_hook_event(payload) -> CostRecord | None

scripts/telemetry/
    sqlite_store.py     # record_cost(), get_costs(), get_cost_summary(), get_session_costs()

src/orchestrator/routes/
    cost_api.py         # FastAPI router with 4 endpoints
```

### Frontend

```
CostDashboardPage
    |-- CostSummaryCards       (total spend, rate, top agent)
    |-- CostBreakdownChart     (bar chart by agent, pie by model)
    |-- SessionCostTable       (sortable paginated table)
    |-- TimeRangeFilter        (date range picker)
```

The page uses a Zustand store (`costsStore.ts`) for managing selected time range, group-by dimension, and selected session. TanStack Query hooks in `costs.ts` handle data fetching with configurable auto-refresh.

## Security Considerations

- Cost data is read from local SQLite; no external API calls
- No sensitive data in cost records (no API keys, no request content)
- SQLite is WAL mode; concurrent reads from dashboard and API are safe
- No authentication required (matches existing HITL UI pattern)

## Testing Strategy

- **Unit tests** for pricing calculation (`test_pricing.py`)
- **Unit tests** for cost collector token extraction (`test_collector.py`)
- **Unit tests** for SQLite CRUD functions (`test_sqlite_costs.py`)
- **Integration tests** for FastAPI cost endpoints (`test_cost_api.py`)
- **Frontend tests** for React components (`CostDashboardPage.test.tsx`)
- **Frontend tests** for API client (`costs.test.ts`)
- **Frontend tests** for Zustand store (`costsStore.test.ts`)
