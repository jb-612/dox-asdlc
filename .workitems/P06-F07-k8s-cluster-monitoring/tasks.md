# P06-F07: Tasks

## Phase 0: Coordination Types Extension (Backend)

### T00: Add DEVOPS message types to coordination
**Story:** US-08, US-09
**Estimate:** 0.5 hours
**Agent:** backend

- [x] Modify `src/infrastructure/coordination/types.py`
- [x] Add `DEVOPS_STARTED = "DEVOPS_STARTED"` to `MessageType` enum
- [x] Add `DEVOPS_STEP_UPDATE = "DEVOPS_STEP_UPDATE"` to `MessageType` enum
- [x] Add `DEVOPS_COMPLETE = "DEVOPS_COMPLETE"` to `MessageType` enum
- [x] Add `DEVOPS_FAILED = "DEVOPS_FAILED"` to `MessageType` enum
- [x] Add comment block grouping these as "# DevOps coordination"
- [x] Run existing coordination tests to ensure no regressions
- [x] Add unit tests for new message types in test file

---

## Phase 1: TypeScript Types and API Contracts (Frontend)

### T01: Create service health TypeScript types
**Story:** US-01, US-02, US-04
**Estimate:** 0.5 hours
**Agent:** frontend

- [x] Create `docker/hitl-ui/src/api/types/services.ts`
- [x] Define `ServiceHealthStatus` type ('healthy' | 'degraded' | 'unhealthy')
- [x] Define `ServiceHealthInfo` interface (name, status, cpuPercent, memoryPercent, podCount, requestRate, latencyP50, lastRestart)
- [x] Define `ServiceConnection` interface (from, to, type)
- [x] Define `SparklineDataPoint` interface (timestamp, value)
- [x] Define `ServicesHealthResponse` interface
- [x] Define `ServiceSparklineResponse` interface
- [x] Export all types

### T02: Create DevOps activity TypeScript types
**Story:** US-05, US-06, US-07, US-08
**Estimate:** 0.5 hours
**Agent:** frontend

- [x] Create `docker/hitl-ui/src/api/types/devops.ts`
- [x] Define `DevOpsActivityStatus` type ('in_progress' | 'completed' | 'failed')
- [x] Define `DevOpsStepStatus` type ('pending' | 'running' | 'completed' | 'failed')
- [x] Define `DevOpsStep` interface (name, status, startedAt, completedAt, error)
- [x] Define `DevOpsActivity` interface (id, operation, status, startedAt, completedAt, steps)
- [x] Define `DevOpsActivityResponse` interface (current, recent)
- [x] Export all types

---

## Phase 2: Backend Service Health API (Backend)

### T03: Create service health Pydantic models
**Story:** US-04
**Estimate:** 0.5 hours
**Agent:** backend

- [x] Create `src/orchestrator/api/models/service_health.py`
- [x] Define `ServiceHealthStatus` enum
- [x] Define `ServiceHealthInfo` model (matches TypeScript interface)
- [x] Define `SparklineDataPoint` model (timestamp, value)
- [x] Define `ServicesHealthResponse` model
- [x] Define `ServiceSparklineResponse` model
- [x] Add tests for model validation

### T04: Implement service health aggregation service
**Story:** US-04
**Estimate:** 1.5 hours
**Agent:** backend

- [x] Create `src/orchestrator/services/service_health.py`
- [x] Implement `get_service_health(service_name)` - query VictoriaMetrics for single service
- [x] Implement `get_all_services_health()` - aggregate health for 5 aSDLC services
- [x] Implement `get_service_sparkline(service_name, metric)` - 15-minute history
- [x] Define service name to pod label mappings
- [x] Add caching (5 minute TTL for health, 1 minute for sparkline)
- [x] Handle VictoriaMetrics unavailability gracefully
- [x] Add unit tests with mocked VM responses

### T05: Add service health endpoints to metrics_api.py
**Story:** US-04
**Estimate:** 1.0 hour
**Agent:** backend

- [x] Modify existing `src/orchestrator/routes/metrics_api.py`
- [x] Implement `GET /api/metrics/services/health` endpoint
- [x] Implement `GET /api/metrics/services/{name}/sparkline` endpoint with metric query param
- [x] Add input validation for service names (hitl-ui, orchestrator, workers, redis, elasticsearch)
- [x] Add error handling with appropriate HTTP status codes
- [x] Add integration tests

---

## Phase 3: Backend DevOps Activity API (Backend)

### T06: Create DevOps activity Pydantic models
**Story:** US-08
**Estimate:** 0.5 hours
**Agent:** backend

- [x] Create `src/orchestrator/api/models/devops_activity.py`
- [x] Define `DevOpsStepStatus` enum
- [x] Define `DevOpsActivityStatus` enum
- [x] Define `DevOpsStep` model
- [x] Define `DevOpsActivity` model
- [x] Define `DevOpsActivityResponse` model
- [x] Add tests for model validation

### T07: Implement DevOps activity service using coordination MCP
**Story:** US-08
**Estimate:** 1.0 hour
**Agent:** backend

- [x] Create `src/orchestrator/services/devops_activity.py`
- [x] Implement `get_current_activity()` - read DEVOPS_STARTED messages not yet completed
- [x] Implement `get_recent_activities(limit=10)` - read DEVOPS_COMPLETE/DEVOPS_FAILED messages
- [x] Use `mcp__coordination__coord_check_messages` to read coordination messages
- [x] Filter by message types: DEVOPS_STARTED, DEVOPS_STEP_UPDATE, DEVOPS_COMPLETE, DEVOPS_FAILED
- [x] Aggregate step updates into activity objects
- [x] Handle coordination MCP unavailability gracefully
- [x] Add unit tests with mocked coordination responses

### T08: Create DevOps activity API endpoint
**Story:** US-08
**Estimate:** 0.5 hours
**Agent:** backend

- [x] Create `src/orchestrator/api/routes/devops.py`
- [x] Implement `GET /api/devops/activity` endpoint
- [x] Add error handling with appropriate HTTP status codes
- [x] Register routes in main API router
- [x] Add integration tests

---

## Phase 4: Backend K8s Cluster API (Backend)

### T09: Create K8s cluster API Pydantic models and add kubernetes package
**Story:** US-13
**Estimate:** 0.5 hours
**Agent:** backend

- [x] Add `kubernetes>=28.0.0` to `requirements.txt`
- [x] Create `src/orchestrator/api/models/k8s.py`
- [x] Define models matching existing TypeScript interfaces in `kubernetes.ts`
- [x] Define `ClusterHealth` model
- [x] Define `K8sNode` model with nested types
- [x] Define `K8sPod` model with nested types
- [x] Define response wrapper models
- [x] Add tests for model validation

### T10: Implement K8s cluster service with mock mode
**Story:** US-13
**Estimate:** 1.5 hours
**Agent:** backend

- [x] Create `src/orchestrator/services/k8s_cluster.py`
- [x] Implement config detection: check `KUBERNETES_SERVICE_HOST` for in-cluster config
- [x] Implement fallback: use local kubeconfig (`~/.kube/config`) for development
- [x] Implement mock mode: if neither available, return mock data (same pattern as VictoriaMetrics)
- [x] Implement `get_cluster_health()` - aggregate node/pod counts and resource usage
- [x] Implement `get_nodes()` - list all nodes with status and resource info
- [x] Implement `get_pods(namespace, status, nodeName, search, limit, offset)` - filtered pod list
- [x] Add caching (10 second TTL)
- [x] Handle K8s API unavailability gracefully
- [x] Add unit tests with mocked K8s client

### T11: Create K8s cluster API endpoints
**Story:** US-13
**Estimate:** 1.0 hour
**Agent:** backend

- [x] Create `src/orchestrator/api/routes/k8s.py`
- [x] Implement `GET /api/k8s/health` endpoint
- [x] Implement `GET /api/k8s/nodes` endpoint
- [x] Implement `GET /api/k8s/pods` endpoint with query params
- [x] Add input validation for query params
- [x] Add error handling with appropriate HTTP status codes
- [x] Register routes in main API router
- [x] Add integration tests

---

## Phase 5: Frontend SparklineChart Component (Frontend)

### T12: Create SparklineChart component
**Story:** US-03
**Estimate:** 1.5 hours
**Agent:** frontend

- [x] Create `docker/hitl-ui/src/components/services/SparklineChart.tsx`
- [x] Implement SVG-based line chart (80x30 pixels default)
- [x] Accept `data: SparklineDataPoint[]`, `color`, `height`, `width` props
- [x] Render smooth line path connecting data points
- [x] Handle missing data points (interpolate or gap)
- [x] Support color based on threshold (green/yellow/red)
- [x] Add hover tooltip showing timestamp and value
- [x] Add loading state (placeholder animation)
- [x] Create `SparklineChart.test.tsx` with tests for:
  - Renders with full data
  - Handles empty data
  - Handles partial data
  - Tooltip interaction
  - Color threshold changes

---

## Phase 6: Frontend ServiceCard Component (Frontend)

### T13: Create ServiceCard component
**Story:** US-02
**Estimate:** 1.5 hours
**Agent:** frontend

- [x] Create `docker/hitl-ui/src/components/services/ServiceCard.tsx`
- [x] Display service name as card header
- [x] Display health status indicator (colored badge)
- [x] Display CPU sparkline using SparklineChart
- [x] Display memory sparkline using SparklineChart
- [x] Display request rate (req/s) if available
- [x] Display latency p50 (ms) if available
- [x] Display pod count
- [x] Display last restart time if within 24 hours
- [x] Add click handler prop for opening detail view
- [x] Style with color-coded border based on health status
- [x] Create `ServiceCard.test.tsx` with tests for:
  - Renders all metrics
  - Shows correct status color
  - Hides optional metrics when null
  - Click handler fires

---

## Phase 7: Frontend ServiceTopologyMap Component (Frontend)

### T14: Create ServiceTopologyMap component
**Story:** US-01
**Estimate:** 2.0 hours
**Agent:** frontend

- [x] Create `docker/hitl-ui/src/components/services/ServiceTopologyMap.tsx`
- [x] Define fixed layout for 5 services (positioned in diagram)
- [x] Render service nodes with health-colored circles/rectangles
- [x] Render connection lines between services
- [x] Color-code connections by type (HTTP: blue, Redis: red, Elasticsearch: yellow)
- [x] Add service name labels on each node
- [x] Add click handler for each service node
- [x] Add hover effect on nodes
- [x] Responsive sizing (scales with container)
- [x] Create `ServiceTopologyMap.test.tsx` with tests for:
  - Renders all 5 services
  - Renders connections
  - Click handler fires with correct service
  - Health colors applied correctly

---

## Phase 8: Frontend API Hooks for Services (Frontend)

### T15: Create service health API hooks
**Story:** US-01, US-02, US-04
**Estimate:** 1.0 hour
**Agent:** frontend

- [x] Create `docker/hitl-ui/src/api/services.ts`
- [x] Implement `getServicesHealth()` function calling `/api/metrics/services/health`
- [x] Implement `getServiceSparkline(name, metric)` function calling `/api/metrics/services/{name}/sparkline`
- [x] Create `useServicesHealth()` hook with 30s auto-refresh
- [x] Create `useServiceSparkline(name, metric)` hook with 1min auto-refresh
- [x] Add mock data fallback for development mode
- [x] Add error handling
- [x] Export query keys for invalidation

---

## Phase 9: Frontend DevOps Activity Components (Frontend)

### T16: Create DevOpsStepList component
**Story:** US-06
**Estimate:** 1.0 hour
**Agent:** frontend

- [x] Create `docker/hitl-ui/src/components/devops/DevOpsStepList.tsx`
- [x] Display list of steps in order
- [x] Show checkmark icon for completed steps (green)
- [x] Show spinner icon for running step (blue)
- [x] Show circle icon for pending steps (gray)
- [x] Show X icon for failed steps (red) with error message
- [x] Animate transitions between states (CSS transitions)
- [x] Create `DevOpsStepList.test.tsx` with tests for:
  - Renders all step states correctly
  - Shows error message for failed step
  - Animations applied

### T17: Create DevOpsActivityPanel component
**Story:** US-05
**Estimate:** 1.5 hours
**Agent:** frontend

- [x] Create `docker/hitl-ui/src/components/devops/DevOpsActivityPanel.tsx`
- [x] Display current operation section (if any)
- [x] Show operation name and status badge
- [x] Include DevOpsStepList for current operation
- [x] Display recent operations section
- [x] Show operation name, status, duration for each recent
- [x] Add manual refresh button
- [x] Show empty state when no operations
- [x] Create `DevOpsActivityPanel.test.tsx` with tests for:
  - Shows current operation
  - Shows recent operations
  - Empty state renders
  - Refresh button works

### T18: Create DevOpsNotificationBanner component
**Story:** US-07
**Estimate:** 1.0 hour
**Agent:** frontend

- [x] Create `docker/hitl-ui/src/components/devops/DevOpsNotificationBanner.tsx`
- [x] Fixed position at top of viewport
- [x] Display operation name and current step
- [x] Color-code: blue (in-progress), green (completed), red (failed)
- [x] Add dismiss button (X icon)
- [x] Click banner to open DevOps activity (callback prop)
- [x] Slide-in animation on mount
- [x] Auto-hide after 10 seconds when completed
- [x] Create `DevOpsNotificationBanner.test.tsx` with tests for:
  - Renders with correct color
  - Dismiss button works
  - Click handler fires
  - Auto-hide timer works

---

## Phase 10: Frontend API Hooks for DevOps (Frontend)

### T19: Create DevOps activity API hooks and store
**Story:** US-05, US-08
**Estimate:** 1.0 hour
**Agent:** frontend

- [x] Create `docker/hitl-ui/src/api/devops.ts`
- [x] Implement `getDevOpsActivity()` function
- [x] Create `useDevOpsActivity()` hook with 10s auto-refresh
- [x] Create `docker/hitl-ui/src/stores/devopsStore.ts`
- [x] Add `bannerDismissed` state
- [x] Add `setBannerDismissed` action
- [x] Add mock data fallback for development mode
- [x] Export query keys for invalidation

---

## Phase 11: Connect K8s Components to Real API (Frontend)

### T20: Create K8s API hooks with mock data fallback
**Story:** US-10, US-11, US-12
**Estimate:** 1.0 hour
**Agent:** frontend

- [x] Create or update `docker/hitl-ui/src/api/k8s.ts`
- [x] Implement `getClusterHealth()` function
- [x] Implement `getNodes()` function
- [x] Implement `getPods(params)` function with query params
- [x] Create `useClusterHealth()` hook with 30s auto-refresh
- [x] Create `useNodes()` hook with 30s auto-refresh
- [x] Create `usePods(params)` hook with 30s auto-refresh
- [x] Add mock data fallback for development mode (when K8s API unavailable)
- [x] Export query keys for invalidation

### T21: Update ClusterOverview to use real API
**Story:** US-10
**Estimate:** 0.5 hours
**Agent:** frontend

- [x] Update `docker/hitl-ui/src/components/k8s/ClusterOverview.tsx`
- [x] Add `useClusterHealth()` hook call (optional, can be passed via props)
- [x] Update K8sPage or parent to fetch and pass data
- [x] Verify loading state works
- [x] Verify error state works
- [x] Update tests if needed

### T22: Update NodesPanel to use real API
**Story:** US-11
**Estimate:** 0.5 hours
**Agent:** frontend

- [x] Update `docker/hitl-ui/src/components/k8s/NodesPanel.tsx` or parent page
- [x] Add `useNodes()` hook call (optional, can be passed via props)
- [x] Update K8sPage or parent to fetch and pass data
- [x] Verify filtering works with real data
- [x] Verify loading state works
- [x] Update tests if needed

### T23: Update PodsTable to use real API
**Story:** US-12
**Estimate:** 0.5 hours
**Agent:** frontend

- [x] Update `docker/hitl-ui/src/components/k8s/PodsTable.tsx` or parent page
- [x] Add `usePods()` hook call (optional, can be passed via props)
- [x] Update K8sPage or parent to fetch and pass data
- [x] Verify filtering works with real data
- [x] Verify pagination works with real data
- [x] Verify sorting works with real data
- [x] Update tests if needed

---

## Phase 12: DevOps Agent Progress Publishing (Backend/DevOps)

### T24: Extend DevOps agent to publish progress via coordination MCP
**Story:** US-09
**Estimate:** 1.5 hours
**Agent:** devops

- [x] Update `.claude/agents/devops.md` to document progress publishing
- [x] Create helper script `scripts/devops/publish-progress.sh`
- [x] Implement `publish_operation_start(operation, steps)` using `mcp__coordination__coord_publish_message`
  - Message type: `DEVOPS_STARTED`
  - Payload: operation name, step list, timestamp
- [x] Implement `publish_step_update(step_name, status, error)` using `mcp__coordination__coord_publish_message`
  - Message type: `DEVOPS_STEP_UPDATE`
  - Payload: step name, status, error (if any), timestamp
- [x] Implement `publish_operation_complete(status)` using `mcp__coordination__coord_publish_message`
  - Message type: `DEVOPS_COMPLETE` or `DEVOPS_FAILED`
  - Payload: final status, duration, timestamp
- [x] Add documentation for DevOps agent integration

---

## Phase 13: Integration and Page Assembly (Frontend)

### T25: Create ServiceHealthDashboard page section
**Story:** US-01, US-02
**Estimate:** 1.0 hour
**Agent:** frontend

- [x] Create `docker/hitl-ui/src/components/services/ServiceHealthDashboard.tsx`
- [x] Compose ServiceTopologyMap at top
- [x] Compose ServiceCards in grid below
- [x] Wire up data fetching with hooks
- [x] Handle loading and error states
- [x] Add auto-refresh indicator
- [x] Create index.ts to export all service components

### T26: Add DevOps activity to MetricsPage or create dedicated page
**Story:** US-05, US-07
**Estimate:** 1.0 hour
**Agent:** frontend

- [x] Decide: Add to MetricsPage or create DevOpsPage
- [x] Integrate DevOpsActivityPanel component
- [x] Integrate DevOpsNotificationBanner (at App level for global visibility)
- [x] Wire up data fetching with hooks
- [x] Handle loading and error states
- [x] Create index.ts to export all devops components

---

## Phase 14: End-to-End Testing

### T27: Backend integration tests
**Story:** US-04, US-08, US-13
**Estimate:** 1.0 hour
**Agent:** backend

- [x] Test `/api/metrics/services/health` with mock VictoriaMetrics
- [x] Test `/api/metrics/services/{name}/sparkline` with mock VM
- [x] Test `/api/devops/activity` with mock coordination messages
- [x] Test `/api/k8s/health` with mock K8s client
- [x] Test `/api/k8s/nodes` with mock K8s client
- [x] Test `/api/k8s/pods` with pagination and filtering

### T28: Frontend E2E tests
**Story:** All
**Estimate:** 1.0 hour
**Agent:** frontend

- [x] Test ServiceHealthDashboard renders with mock data
- [x] Test ServiceCard interactions
- [x] Test DevOpsActivityPanel renders with mock data
- [x] Test DevOpsNotificationBanner appears and dismisses
- [x] Test K8s components with mock API

---

## Progress Tracking

### Phase Summary

| Phase | Description | Tasks | Estimate |
|-------|-------------|-------|----------|
| 0 | Coordination Types Extension | T00 | 0.5h |
| 1 | TypeScript Types | T01-T02 | 1.0h |
| 2 | Backend Service Health API | T03-T05 | 3.0h |
| 3 | Backend DevOps Activity API | T06-T08 | 2.0h |
| 4 | Backend K8s Cluster API | T09-T11 | 3.0h |
| 5 | SparklineChart Component | T12 | 1.5h |
| 6 | ServiceCard Component | T13 | 1.5h |
| 7 | ServiceTopologyMap Component | T14 | 2.0h |
| 8 | Service API Hooks | T15 | 1.0h |
| 9 | DevOps Activity Components | T16-T18 | 3.5h |
| 10 | DevOps API Hooks | T19 | 1.0h |
| 11 | Connect K8s Components | T20-T23 | 2.5h |
| 12 | DevOps Agent Progress | T24 | 1.5h |
| 13 | Page Assembly | T25-T26 | 2.0h |
| 14 | E2E Testing | T27-T28 | 2.0h |
| **Total** | | **29 tasks** | **27.5h** |

### Task Status

- Phase 0: 1/1 tasks (100%)
- Phase 1: 2/2 tasks (100%)
- Phase 2: 3/3 tasks (100%)
- Phase 3: 3/3 tasks (100%)
- Phase 4: 3/3 tasks (100%)
- Phase 5: 1/1 tasks (100%)
- Phase 6: 1/1 tasks (100%)
- Phase 7: 1/1 tasks (100%)
- Phase 8: 1/1 tasks (100%)
- Phase 9: 3/3 tasks (100%)
- Phase 10: 1/1 tasks (100%)
- Phase 11: 4/4 tasks (100%)
- Phase 12: 1/1 tasks (100%)
- Phase 13: 2/2 tasks (100%)
- Phase 14: 2/2 tasks (100%)
- **Total: 29/29 tasks (100%)**

---

## Dependencies

```
T00 (DEVOPS Message Types) ────────────────────────────┐
                                                        │
T01, T02 (Types) ─────────────────────────────────┐    │
                                                   │    │
T03 (Backend Models) ──► T04 (Service) ──► T05 (Endpoints)
                                                   │
T00 ──► T06 (Backend Models) ──► T07 (Service) ──► T08 (Endpoints)
                                                   │
T09 (Backend Models) ──► T10 (Service) ──► T11 (Endpoints)
                                                   │
T01 ──► T12 (SparklineChart) ──► T13 (ServiceCard) ──► T14 (TopologyMap)
                                                   │
T02 ──► T16 (StepList) ──► T17 (ActivityPanel) ──► T18 (Banner)
                                                   │
T05 ──► T15 (Service Hooks) ──► T25 (ServiceHealthDashboard)
                                                   │
T08 ──► T19 (DevOps Hooks) ──► T26 (Page Assembly)
                                                   │
T11 ──► T20 (K8s Hooks) ──► T21, T22, T23 (Connect Components)
                                                   │
T00 ──► T24 (DevOps Agent) ────────────────────────────
                                                   │
                              T27, T28 (E2E Tests) ◄┘
```

**Critical Path:** T00 (Message Types) -> Types -> Backend APIs -> Frontend Hooks -> Components -> Page Assembly -> E2E Tests
