---
id: P15-F16
parent_id: P15
type: design
version: 3
status: approved
created_by: planner
created_at: "2026-02-28T00:00:00Z"
updated_at: "2026-03-01T00:00:00Z"
dependencies: [P15-F07, P15-F13, P15-F14]
tags: [observability, monitoring, analytics, phase-3]
estimated_hours: 17
---

# Design: Observability (P15-F16)

## Overview

Upgrade Monitoring to observability platform. Adds trace context (traceId/spanId), persistent cost tracking, and analytics UI with recharts. Dependencies: F07 (monitoring, complete), F13 (settings, complete), F14 (execution history, planned -- provides ExecutionHistoryService pattern).

## Existing Infrastructure

TelemetryReceiver ingests events with `tokenUsage?: {inputTokens, outputTokens, estimatedCostUsd}`. MonitoringStore (main) accumulates `totalCostUsd` per session. ExecutionEngine emits events via `emitEvent()` with no trace context yet. No charting library installed.

## Scope

### 1. Trace Context
- Add `traceId?: string`, `spanId?: string` to `ExecutionEvent` and `TelemetryEvent`
- ExecutionEngine generates traceId (UUIDv4) per run, spanId per node
- **Propagation**: ExecutionEngine sets `TRACE_ID`/`SPAN_ID` on `CLISpawnConfig.env` before calling `cliSpawner.spawn()` -- no CLISpawner API change needed, uses existing `config.env` dict
- New `TraceSpan` type in `src/shared/types/analytics.ts`

### 2. Cost Tracking
- **Data source**: On `execution_completed`/`execution_failed`, ExecutionEngine queries MonitoringStore (same main process) for accumulated per-node tokenUsage, filters by current sessionId
- New `AnalyticsService` persists `ExecutionCostSummary` to daily JSON files in `userData/analytics/`
- ExecutionEngine receives AnalyticsService in constructor opts, calls `saveExecution(execution, costData)` on completion
- 90-day retention, pruned on startup. 200/day cap (oldest evicted). Synchronous writes to prevent async interleave

### 3. Analytics UI
- Install `recharts` (new dep). `CostChart`: daily cost bar chart (7d/30d). `ExecutionTable`: sortable table, default limit 50. `CostBreakdown`: per-block token/cost. `AnalyticsTab`: container added as tab in MonitoringPage (new tab nav)

## Decisions

| Decision | Direction | Rationale |
|----------|-----------|-----------|
| Trace IDs | UUIDv4 | Existing uuid dep |
| Storage | Daily JSON files | Natural temporal grouping, easy pruning |
| Cost data source | Query MonitoringStore on completion | Same process, no new coupling |
| Propagation | config.env dict | No CLISpawner API change |

## File Changes

**New:** `src/shared/types/analytics.ts`, `src/main/services/analytics-service.ts`, `src/renderer/components/monitoring/{AnalyticsTab,CostChart,ExecutionTable,CostBreakdown}.tsx`
**Modified:** `src/shared/types/execution.ts` (+traceId/spanId on ExecutionEvent), `src/shared/types/monitoring.ts` (+traceId/spanId on TelemetryEvent), `src/main/services/execution-engine.ts` (trace gen + analytics save), `src/shared/ipc-channels.ts` (3 ANALYTICS_* channels), `src/renderer/pages/MonitoringPage.tsx` (tab layout), `package.json` (recharts), `src/preload/electron-api.d.ts` (analytics bridge)

## Risks

| Risk | Mitigation |
|------|------------|
| JSON I/O slow | Daily partitioning; 200/day cap |
| tokenUsage not sent by agents | Show "N/A" not $0 |
| Concurrent writes | Synchronous fs writes |
| TelemetryEvent trace fields unused | Document as future: agents must opt-in |
