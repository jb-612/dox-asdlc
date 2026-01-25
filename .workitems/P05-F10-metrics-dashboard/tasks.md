# P05-F10 Metrics Dashboard - Task Breakdown

## Task Summary

| ID | Task | Estimate | Dependencies | Status |
|----|------|----------|--------------|--------|
| T01 | Create metrics TypeScript types | 30m | - | [x] |
| T02 | Create mock data generators | 1h | T01 | [x] |
| T03 | Create metrics API client and hooks | 1.5h | T01, T02 | [x] |
| T04 | Create metricsStore (Zustand) | 45m | T01 | [x] |
| T05 | Create ServiceSelector component | 45m | T03 | [x] |
| T06 | Create TimeRangeSelector component | 30m | T04 | [x] |
| T07 | Create CPUChart component | 1h | T03 | [x] |
| T08 | Create MemoryChart component | 45m | T07 | [x] |
| T09 | Create RequestRateChart component | 1h | T03 | [x] |
| T10 | Create LatencyChart component | 1h | T03 | [x] |
| T11 | Create ActiveTasksGauge component | 45m | T03 | [x] |
| T12 | Create MetricsPage layout | 1.5h | T05-T11 | [x] |
| T13 | Add navigation and routing | 30m | T12 | [x] |
| T14 | Add loading and error states | 45m | T12 | [x] |
| T15 | Write component tests | 1.5h | T12 | [x] |
| T16 | Write integration tests | 1h | T15 | [x] |

**Total Estimate:** ~14 hours

---

## Detailed Tasks

### T01: Create metrics TypeScript types

**Objective:** Define all TypeScript interfaces for metrics data.

**File:** `docker/hitl-ui/src/api/types/metrics.ts`

**Acceptance Criteria:**
- [x] Define `TimeRange` type ('15m' | '1h' | '6h' | '24h' | '7d')
- [x] Define `VMMetricsDataPoint` interface (timestamp, value)
- [x] Define `VMMetricsTimeSeries` interface (metric, service, dataPoints)
- [x] Define `LatencyMetrics` interface (p50, p95, p99 series)
- [x] Define `ServiceInfo` interface (name, displayName, healthy)
- [x] Define `VictoriaMetricsResult` and `MetricsQueryResponse` for API responses
- [x] Define helper constants (TIME_RANGE_OPTIONS, SERVICE_COLORS, CHART_COLORS)
- [x] Export all types

**Estimate:** 30 minutes

---

### T02: Create mock data generators

**Objective:** Implement mock data generators for development without backend.

**File:** `docker/hitl-ui/src/api/mocks/metrics.ts`

**Acceptance Criteria:**
- [x] Implement `generateMetricsTimeSeries(metric, service, range)` function
- [x] Generate realistic data with sinusoidal patterns and random noise
- [x] Implement `mockServices` array with service info
- [x] Implement `getMockCPUMetrics(service, range)` function
- [x] Implement `getMockMemoryMetrics(service, range)` function
- [x] Implement `getMockRequestRateMetrics(service, range)` function
- [x] Implement `getMockLatencyMetrics(service, range)` function
- [x] Implement `getMockActiveTasks()` function
- [x] Add to `mocks/index.ts` exports

**Estimate:** 1 hour

---

### T03: Create metrics API client and hooks

**Objective:** Implement API client functions and React Query hooks.

**File:** `docker/hitl-ui/src/api/metrics.ts`

**Acceptance Criteria:**
- [x] Define `metricsQueryKeys` object for React Query cache keys
- [x] Implement `getServices()` API function with mock fallback
- [x] Implement `getCPUMetrics(service, range)` API function
- [x] Implement `getMemoryMetrics(service, range)` API function
- [x] Implement `getRequestRateMetrics(service, range)` API function
- [x] Implement `getLatencyMetrics(service, range)` API function
- [x] Implement `getActiveTasks()` API function
- [x] Implement `useServices()` hook
- [x] Implement `useCPUMetrics(service, range, refetchInterval)` hook
- [x] Implement `useMemoryMetrics(service, range, refetchInterval)` hook
- [x] Implement `useRequestRateMetrics(service, range, refetchInterval)` hook
- [x] Implement `useLatencyMetrics(service, range, refetchInterval)` hook
- [x] Implement `useActiveTasks(refetchInterval)` hook
- [x] All hooks support optional refetch interval for auto-refresh

**Estimate:** 1.5 hours

---

### T04: Create metricsStore (Zustand)

**Objective:** Implement Zustand store for metrics UI state.

**File:** `docker/hitl-ui/src/stores/metricsStore.ts`

**Acceptance Criteria:**
- [x] Define `MetricsState` interface
- [x] Implement `selectedService` state (string | null)
- [x] Implement `timeRange` state (TimeRange)
- [x] Implement `autoRefresh` state (boolean)
- [x] Implement `refreshInterval` constant (30000)
- [x] Implement `setSelectedService(service)` action
- [x] Implement `setTimeRange(range)` action
- [x] Implement `toggleAutoRefresh()` action
- [x] Implement `reset()` action
- [x] Export selectors for optimized component subscriptions
- [x] Default timeRange is '1h'
- [x] Default autoRefresh is true

**Estimate:** 45 minutes

---

### T05: Create ServiceSelector component

**Objective:** Dropdown to filter metrics by service.

**File:** `docker/hitl-ui/src/components/metrics/ServiceSelector.tsx`

**Acceptance Criteria:**
- [x] Render dropdown with "All Services" as first option
- [x] List all services from `useServices()` hook
- [x] Show health indicator (green dot = healthy, yellow = unhealthy)
- [x] Call `setSelectedService` from store on selection
- [x] Highlight current selection
- [x] Handle loading state while services load
- [x] Include data-testid attributes for testing
- [x] Export component

**Estimate:** 45 minutes

---

### T06: Create TimeRangeSelector component

**Objective:** Button group to select time range.

**File:** `docker/hitl-ui/src/components/metrics/TimeRangeSelector.tsx`

**Acceptance Criteria:**
- [x] Render button group with options: 15m, 1h, 6h, 24h, 7d
- [x] Highlight active time range
- [x] Call `setTimeRange` from store on selection
- [x] Use consistent styling with K8s interval selector
- [x] Include data-testid attributes for testing
- [x] Export component

**Estimate:** 30 minutes

---

### T07: Create CPUChart component

**Objective:** Line chart for CPU usage percentage.

**File:** `docker/hitl-ui/src/components/metrics/CPUChart.tsx`

**Acceptance Criteria:**
- [x] Use Recharts LineChart component
- [x] X-axis shows time with appropriate formatting based on range
- [x] Y-axis shows 0-100% scale
- [x] Line color matches design (blue)
- [x] Custom tooltip shows timestamp and percentage
- [x] Handle empty data with empty state message
- [x] Handle loading state with skeleton
- [x] Responsive container
- [x] Include data-testid attributes
- [x] Export component

**Estimate:** 1 hour

---

### T08: Create MemoryChart component

**Objective:** Line chart for memory usage percentage.

**File:** `docker/hitl-ui/src/components/metrics/MemoryChart.tsx`

**Acceptance Criteria:**
- [x] Use Recharts LineChart component (same pattern as CPUChart)
- [x] Different color (purple) to distinguish from CPU
- [x] Y-axis shows 0-100% scale
- [x] Custom tooltip shows timestamp and percentage
- [x] Reuse patterns from CPUChart
- [x] Handle loading and empty states
- [x] Include data-testid attributes
- [x] Export component

**Estimate:** 45 minutes (reuses T07 patterns)

---

### T09: Create RequestRateChart component

**Objective:** Area chart for request rate (req/s).

**File:** `docker/hitl-ui/src/components/metrics/RequestRateChart.tsx`

**Acceptance Criteria:**
- [x] Use Recharts AreaChart component
- [x] X-axis shows time
- [x] Y-axis shows req/s with automatic scale
- [x] Area fill with gradient
- [x] Custom tooltip shows timestamp and rate
- [x] Handle loading and empty states
- [x] Include data-testid attributes
- [x] Export component

**Estimate:** 1 hour

---

### T10: Create LatencyChart component

**Objective:** Multi-line chart for latency percentiles.

**File:** `docker/hitl-ui/src/components/metrics/LatencyChart.tsx`

**Acceptance Criteria:**
- [x] Use Recharts LineChart component
- [x] Three lines: p50 (blue), p95 (orange), p99 (red)
- [x] X-axis shows time
- [x] Y-axis shows latency in ms with automatic scale
- [x] Legend shows all three percentiles
- [x] Custom tooltip shows all three values at hover point
- [x] Handle loading and empty states
- [x] Include data-testid attributes
- [x] Export component

**Estimate:** 1 hour

---

### T11: Create ActiveTasksGauge component

**Objective:** Display current active task count.

**File:** `docker/hitl-ui/src/components/metrics/ActiveTasksGauge.tsx`

**Acceptance Criteria:**
- [x] Display large number for current active tasks
- [x] Show label "Active Tasks"
- [x] Show context (e.g., "/ 50 max" or trend indicator)
- [x] Use appropriate styling (card with prominent number)
- [x] Handle loading state
- [x] Include data-testid attributes
- [x] Export component

**Estimate:** 45 minutes

---

### T12: Create MetricsPage layout

**Objective:** Compose all components into the main page.

**File:** `docker/hitl-ui/src/pages/MetricsPage.tsx`

**Acceptance Criteria:**
- [x] Page header with title "Metrics Dashboard" and icon
- [x] Header controls: ServiceSelector, TimeRangeSelector, AutoRefreshToggle, RefreshButton
- [x] Grid layout for charts (responsive)
- [x] Resource section: CPUChart and MemoryChart side by side
- [x] Request section: RequestRateChart and LatencyChart side by side
- [x] Tasks section: ActiveTasksGauge
- [x] Use store state for filters and auto-refresh
- [x] Pass refetch interval to hooks when auto-refresh enabled
- [x] Manual refresh button triggers refetch on all queries
- [x] Follow K8sPage patterns for consistency
- [x] Include data-testid="metrics-page"
- [x] Export as default

**Estimate:** 1.5 hours

---

### T13: Add navigation and routing

**Objective:** Add Metrics page to app navigation.

**Files:**
- `docker/hitl-ui/src/components/layout/Sidebar.tsx`
- `docker/hitl-ui/src/App.tsx`

**Acceptance Criteria:**
- [x] Add "Metrics" item to Sidebar navigation under Workflow section
- [x] Use ChartBarIcon (or similar) from heroicons
- [x] href is "/metrics"
- [x] Position after Kubernetes in nav order
- [x] Add Route for /metrics in App.tsx
- [x] Import MetricsPage component

**Estimate:** 30 minutes

---

### T14: Add loading and error states

**Objective:** Implement comprehensive loading and error handling.

**Files:**
- `docker/hitl-ui/src/pages/MetricsPage.tsx`
- Chart components as needed

**Acceptance Criteria:**
- [x] Initial page load shows skeleton loaders for all charts
- [x] Individual chart errors show inline error with retry button
- [x] Global error (all metrics fail) shows error banner at top
- [x] Retry button triggers refetch for failed queries
- [x] Error messages are user-friendly
- [x] Console logs detailed error for debugging

**Estimate:** 45 minutes

---

### T15: Write component tests

**Objective:** Unit tests for all new components.

**Files:**
- `docker/hitl-ui/src/components/metrics/TimeRangeSelector.test.tsx`
- `docker/hitl-ui/src/components/metrics/CPUChart.test.tsx`
- `docker/hitl-ui/src/components/metrics/MemoryChart.test.tsx`
- `docker/hitl-ui/src/components/metrics/RequestRateChart.test.tsx`
- `docker/hitl-ui/src/components/metrics/LatencyChart.test.tsx`
- `docker/hitl-ui/src/components/metrics/ActiveTasksGauge.test.tsx`
- `docker/hitl-ui/src/stores/metricsStore.test.ts`

**Acceptance Criteria:**
- [x] TimeRangeSelector: renders all options, highlights active, handles click
- [x] CPUChart: renders with data, handles loading, handles empty
- [x] MemoryChart: renders with data, handles loading, handles empty
- [x] RequestRateChart: renders with data, handles loading, handles empty
- [x] LatencyChart: renders all three lines, handles loading, handles empty
- [x] ActiveTasksGauge: renders count, handles loading
- [x] metricsStore: test all actions, test initial state, test reset

**Estimate:** 1.5 hours

---

### T16: Write integration tests

**Objective:** Integration tests for MetricsPage.

**File:** `docker/hitl-ui/src/pages/MetricsPage.test.tsx`

**Acceptance Criteria:**
- [x] Page renders all charts with mock data
- [x] Time range selector updates all charts
- [x] Auto-refresh toggle changes query behavior
- [x] Manual refresh button triggers refetch
- [x] Error state renders correctly
- [x] Loading state renders correctly

**Estimate:** 1 hour

---

## Progress Tracking

### Phase 1: Foundation (T01-T04)
- [x] T01: Types
- [x] T02: Mocks
- [x] T03: API Client
- [x] T04: Store

### Phase 2: Components (T05-T11)
- [x] T05: ServiceSelector
- [x] T06: TimeRangeSelector
- [x] T07: CPUChart
- [x] T08: MemoryChart
- [x] T09: RequestRateChart
- [x] T10: LatencyChart
- [x] T11: ActiveTasksGauge

### Phase 3: Integration (T12-T14)
- [x] T12: MetricsPage
- [x] T13: Navigation
- [x] T14: Error States

### Phase 4: Testing (T15-T16)
- [x] T15: Component Tests
- [x] T16: Integration Tests

---

## Definition of Done

- [x] All tasks marked complete
- [x] All tests pass (`npm test`)
- [x] Lint passes (`npm run lint`)
- [x] Page accessible via /metrics route
- [x] Sidebar navigation updated
- [x] Mock mode works (VITE_USE_MOCKS=true)
- [x] Loading states implemented
- [x] Error states implemented
- [ ] Code reviewed
