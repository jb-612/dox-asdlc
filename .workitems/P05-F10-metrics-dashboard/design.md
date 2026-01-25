# P05-F10 Metrics Dashboard - Technical Design

## Overview

This feature adds a MetricsPage to the HITL-UI SPA for visualizing time series metrics from VictoriaMetrics. The dashboard enables operators to monitor system health, resource utilization, and request patterns across all aSDLC services.

## Goals

1. Provide real-time visibility into CPU, memory, and request metrics
2. Enable filtering by service and time range
3. Support auto-refresh for live monitoring scenarios
4. Follow existing K8s dashboard patterns for consistency

## Technical Approach

### Architecture

```
+------------------+     +------------------+     +-------------------+
|   MetricsPage    |---->|  metrics.ts API  |---->| VictoriaMetrics   |
|   (React)        |     |  (React Query)   |     | /api/v1/query_range|
+------------------+     +------------------+     +-------------------+
        |
        v
+------------------+
|  metricsStore    |
|  (Zustand)       |
+------------------+
```

### VictoriaMetrics Integration

VictoriaMetrics exposes a Prometheus-compatible HTTP API. The frontend queries via the backend proxy to avoid CORS issues.

**Endpoint:** `GET /api/metrics/query_range`

**Query Parameters:**
- `query`: PromQL expression
- `start`: RFC3339 timestamp
- `end`: RFC3339 timestamp
- `step`: Query resolution (e.g., "15s", "1m")

**PromQL Queries Used:**

Based on metrics defined in P02-F07 (all prefixed with `asdlc_`):

| Metric | PromQL Query |
|--------|--------------|
| Memory Usage | `asdlc_process_memory_bytes{type="rss"} / 1024 / 1024` |
| Request Rate | `sum by (service) (rate(asdlc_http_requests_total[1m]))` |
| Latency p50 | `histogram_quantile(0.50, sum by (le, service) (rate(asdlc_http_request_duration_seconds_bucket[5m])))` |
| Latency p95 | `histogram_quantile(0.95, sum by (le, service) (rate(asdlc_http_request_duration_seconds_bucket[5m])))` |
| Latency p99 | `histogram_quantile(0.99, sum by (le, service) (rate(asdlc_http_request_duration_seconds_bucket[5m])))` |
| Active Tasks | `asdlc_active_tasks` |
| Active Workers | `asdlc_active_workers` |
| Redis Status | `asdlc_redis_connection_up` |
| Events Processed | `sum by (service, status) (rate(asdlc_events_processed_total[5m]))` |

**Note:** CPU metrics are not directly exposed by aSDLC services. Container-level CPU metrics should be scraped from cAdvisor or kubelet metrics-server if needed.

### Component Hierarchy

```
MetricsPage
├── Header (title, controls)
│   ├── ServiceSelector (dropdown)
│   ├── TimeRangeSelector (button group)
│   ├── AutoRefreshToggle (button)
│   └── RefreshButton (manual refresh)
├── MetricsGrid
│   ├── ResourceMetricsPanel
│   │   ├── CPUChart (LineChart)
│   │   └── MemoryChart (LineChart)
│   ├── RequestMetricsPanel
│   │   ├── RequestRateChart (AreaChart)
│   │   └── LatencyChart (LineChart with p50/p95/p99)
│   └── TaskMetricsPanel
│       └── ActiveTasksGauge (custom gauge)
└── MetricsLegend
```

### State Management

A new Zustand store (`metricsStore.ts`) manages:

```typescript
interface MetricsState {
  // Filters
  selectedService: string | null;  // null = all services
  timeRange: TimeRange;            // '15m' | '1h' | '6h' | '24h' | '7d'

  // UI state
  autoRefresh: boolean;
  refreshInterval: number;         // 30000ms default

  // Actions
  setSelectedService: (service: string | null) => void;
  setTimeRange: (range: TimeRange) => void;
  toggleAutoRefresh: () => void;
}
```

### API Client Pattern

Following the existing `kubernetes.ts` pattern:

```typescript
// Query keys for React Query
export const metricsQueryKeys = {
  cpuUsage: (service: string | null, range: TimeRange) =>
    ['metrics', 'cpu', service, range] as const,
  memoryUsage: (service: string | null, range: TimeRange) =>
    ['metrics', 'memory', service, range] as const,
  requestRate: (service: string | null, range: TimeRange) =>
    ['metrics', 'requests', service, range] as const,
  latency: (service: string | null, range: TimeRange) =>
    ['metrics', 'latency', service, range] as const,
  activeTasks: () => ['metrics', 'tasks'] as const,
  services: () => ['metrics', 'services'] as const,
};

// Hooks with auto-refresh support
export function useCPUMetrics(
  service: string | null,
  range: TimeRange,
  refetchInterval?: number
) { ... }
```

### Mock Data Strategy

Similar to K8s mocks, provide realistic mock data when `VITE_USE_MOCKS=true`:

- Generate time series with sinusoidal patterns + noise
- Simulate multiple services (orchestrator, worker-pool, hitl-ui)
- Include edge cases (spikes, gaps)

## Interfaces

### TypeScript Types

```typescript
// New file: docker/hitl-ui/src/api/types/metrics.ts

export type TimeRange = '15m' | '1h' | '6h' | '24h' | '7d';

export interface MetricsDataPoint {
  timestamp: string;  // ISO 8601
  value: number;
}

export interface MetricsTimeSeries {
  metric: string;
  service: string;
  dataPoints: MetricsDataPoint[];
}

export interface LatencyMetrics {
  p50: MetricsTimeSeries;
  p95: MetricsTimeSeries;
  p99: MetricsTimeSeries;
}

export interface ServiceInfo {
  name: string;
  displayName: string;
  healthy: boolean;
}

// API response types
export interface MetricsQueryResponse {
  status: 'success' | 'error';
  data: {
    resultType: 'matrix' | 'vector';
    result: VictoriaMetricsResult[];
  };
  errorType?: string;
  error?: string;
}

export interface VictoriaMetricsResult {
  metric: Record<string, string>;
  values: [number, string][];  // [timestamp, value]
}
```

### API Endpoints (Backend Proxy)

The backend will need to proxy VictoriaMetrics requests. For now, assume:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/metrics/query_range` | Proxy to VictoriaMetrics query_range |
| `GET /api/metrics/services` | List available services with health |

**Note:** Backend implementation is P02-F07 scope, not this feature.

## Dependencies

### Internal Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| P06-F06 VictoriaMetrics Infra | Required | TSDB must be deployed |
| P02-F07 Metrics Collection | Required | Services must emit metrics |
| recharts | Available | Already in package.json |
| @tanstack/react-query | Available | Already configured |
| zustand | Available | Already used for stores |
| clsx | Available | Styling utility |
| heroicons | Available | Icons |

### External Dependencies

- VictoriaMetrics HTTP API (Prometheus-compatible)

## Architecture Decisions

### AD-1: Reuse Existing MetricsChart Component

**Decision:** Create new specialized chart components rather than extending MetricsChart.

**Rationale:** The existing `MetricsChart.tsx` is K8s-specific (CPU/Memory only). The metrics dashboard needs:
- Request rate (different Y-axis scale)
- Latency percentiles (multiple lines, seconds scale)
- Active tasks gauge (not a line chart)

Creating specialized components avoids overcomplicating the existing component.

### AD-2: Zustand Store per Feature

**Decision:** Create `metricsStore.ts` separate from `k8sStore.ts`.

**Rationale:** Follows existing pattern where each dashboard has its own store. Prevents unrelated state from coupling.

### AD-3: Mock-First Development

**Decision:** Implement with mocks before backend is ready.

**Rationale:** Follows project patterns (see `kubernetes.ts`). Enables parallel development with P02-F07.

### AD-4: Time Range as Duration, Not Absolute

**Decision:** Use duration strings ('15m', '1h') rather than absolute timestamps.

**Rationale:** Simpler UX. Backend converts to timestamps relative to current time.

## File Structure

```
docker/hitl-ui/src/
├── api/
│   ├── metrics.ts                    # API client + React Query hooks
│   ├── types/
│   │   └── metrics.ts                # TypeScript interfaces
│   └── mocks/
│       └── metrics.ts                # Mock data generators
├── stores/
│   └── metricsStore.ts               # Zustand store
├── pages/
│   └── MetricsPage.tsx               # Main page component
└── components/
    └── metrics/
        ├── ServiceSelector.tsx       # Service filter dropdown
        ├── TimeRangeSelector.tsx     # Time range button group
        ├── CPUChart.tsx              # CPU usage line chart
        ├── MemoryChart.tsx           # Memory usage line chart
        ├── RequestRateChart.tsx      # Request rate area chart
        ├── LatencyChart.tsx          # Latency percentiles chart
        └── ActiveTasksGauge.tsx      # Current active tasks gauge
```

## Navigation Integration

Add to Sidebar.tsx navigation:

```typescript
{ name: 'Metrics', href: '/metrics', icon: ChartBarIcon },
```

Add route in App.tsx:

```typescript
<Route path="metrics" element={<MetricsPage />} />
```

## Testing Strategy

### Unit Tests
- Store actions and selectors
- Mock data generators
- Chart data transformations

### Component Tests
- ServiceSelector selection behavior
- TimeRangeSelector active state
- Chart rendering with mock data
- Loading and error states

### Integration Tests
- Full page render with mocks
- Auto-refresh behavior
- Filter interactions

## Security Considerations

- All API calls go through backend proxy (no direct VictoriaMetrics access)
- Read-only metrics (no write operations)
- No sensitive data in metrics (avoid PII in labels)

## Performance Considerations

- Use React Query caching to avoid duplicate requests
- Limit data points per chart (max 500 points)
- Use `step` parameter to control resolution based on time range
- Debounce rapid filter changes
