---
id: P15-F16
parent_id: P15
type: tasks
version: 2
updated_at: "2026-03-01T00:00:00Z"
status: draft
created_by: planner
created_at: "2026-03-01T00:00:00Z"
estimated_hours: 17
---

# Tasks: Observability (P15-F16)

## Dependency Graph

```
T01(types) -> T03a(trace) -> T03b(thread) -> T08(env verify)
T01 -> T04(analytics svc) -> T07(IPC) -> T05(chart),T06(table),T09(breakdown)
T02(recharts) -> T05 | T05,T06,T09 -> T10(tab) -> T11(wire) <- T03b,T04
```

## Tasks

### T01: Analytics and trace types (1hr) [US-01,US-02]
- RED: type guard tests — TraceSpan requires traceId/spanId/nodeId, ExecutionCostSummary requires executionId/totalCostUsd, BlockCost requires blockId/tokens
- GREEN: `src/shared/types/analytics.ts` — TraceSpan, BlockCost, ExecutionCostSummary, DailyAnalytics. Extend ExecutionEvent + TelemetryEvent with optional traceId/spanId
- Deps: none

### T02: Install recharts (0.5hr) [US-03]
- Add recharts to package.json, verify build. Deps: none

### T03a: Trace types on Execution + emitEvent (1.5hr) [US-01]
- RED: Execution interface has traceId; emitEvent includes traceId/spanId on events
- GREEN: add traceId to Execution, generate in start(); spanId param in emitEvent(). Deps: T01

### T03b: Thread spanId through execution paths (1.5hr) [US-01]
- RED: each execution path (mock, real, parallel) generates spanId per node
- GREEN: update executeNodeReal/Mock/startParallel to pass spanId. Set TRACE_ID/SPAN_ID on CLISpawnConfig.env (no CLISpawner API change). Deps: T03a

### T04: AnalyticsService — JSON persistence (2hr) [US-02]
- RED: saveExecution writes daily file; getExecutions returns by date range; getDailyCosts aggregates; pruneOldData removes old files
- GREEN: `src/main/services/analytics-service.ts` — userData/analytics/ dir, daily JSON files, 200/day cap, 90-day prune on init
- Deps: T01

### T05: CostChart component (1.5hr) [US-03]
- RED: empty state; renders bars with data; 7d/30d toggle works
- GREEN: `CostChart.tsx` — recharts BarChart, XAxis, YAxis, Tooltip. Props: data[], window, onWindowChange
- Deps: T01, T02, T07

### T06: ExecutionTable component (1.5hr) [US-04]
- RED: empty state; renders rows; column sort; row click calls onSelect; default limit 50 rows; cost column shows N/A when tokenUsage absent
- GREEN: `ExecutionTable.tsx` — sortable table (date, workflow, status, duration, cost, blocks). Client-side sort
- Deps: T01, T07

### T07: Analytics IPC channels + handlers (1.5hr) [US-02,US-03,US-04]
- RED: ANALYTICS_GET_EXECUTIONS returns array; ANALYTICS_GET_DAILY_COSTS returns aggregated; ANALYTICS_GET_EXECUTION returns single; ANALYTICS_DATA_UPDATED emitted after saveExecution
- GREEN: add 4 channels to ipc-channels.ts, create handlers wiring AnalyticsService, emit ANALYTICS_DATA_UPDATED from saveExecution callback, add electronAPI bridge in preload
- Deps: T04

### T08: Verify trace env vars reach CLI processes (0.5hr) [US-01]
- RED: spawned process env includes TRACE_ID/SPAN_ID when set on config.env; absent when not set
- GREEN: verification test only — env propagation handled in T03b via CLISpawnConfig.env
- Deps: T03b

### T09: CostBreakdown component (1hr) [US-05]
- RED: "Select an execution" when null; renders block rows; "N/A" for missing cost; total row sums
- GREEN: `CostBreakdown.tsx` — table (Block ID, Input Tokens, Output Tokens, Cost), footer totals
- Deps: T01, T07

### T10: AnalyticsTab container (1.5hr) [US-03,US-04,US-05]
- RED: renders all children; fetches on mount; re-fetches on ANALYTICS_DATA_UPDATED IPC; selection updates breakdown; N/A for missing traceId/spanId
- GREEN: `AnalyticsTab.tsx` — state: selectedExecutionId, chartWindow. Fetches via IPC; listens for ANALYTICS_DATA_UPDATED to re-fetch. Wire into MonitoringPage
- Deps: T05, T06, T09

### T11: Wire persistence + integration test (1.5hr) [US-02]
- RED: execution_completed queries MonitoringStore for per-node tokenUsage by sessionId, triggers saveExecution; per-block data included; execution_failed also persists
- GREEN: ExecutionEngine accepts AnalyticsService in opts, calls saveExecution on completion/failure
- Integration: full mock execution -> verify traceId, cost persisted, analytics IPC returns data
- Deps: T03b, T04, T10

### T12: Retention + cleanup test (1hr) [US-02]
- Test: pruning removes files >90 days; analytics tab renders after prune; fresh install with no data works
- Deps: T11

## Summary

| Phase | Tasks | Hours |
|-------|-------|-------|
| Types + setup | T01, T02 | 1.5 |
| Trace context | T03a, T03b, T08 | 3.5 |
| Analytics service | T04, T07, T11 | 5 |
| UI components | T05, T06, T09, T10 | 5.5 |
| Integration | T12 | 1 |
| **Total** | **13 tasks** | **17** |
