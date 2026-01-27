# P06-F07: Tasks

## Phase 0: Coordination Types Extension (Backend)

### T00: Add DEVOPS message types to coordination
**Story:** US-08, US-09
**Estimate:** 0.5 hours
**Agent:** backend

- [ ] Modify `src/infrastructure/coordination/types.py`
- [ ] Add `DEVOPS_STARTED = "DEVOPS_STARTED"` to `MessageType` enum
- [ ] Add `DEVOPS_STEP_UPDATE = "DEVOPS_STEP_UPDATE"` to `MessageType` enum
- [ ] Add `DEVOPS_COMPLETE = "DEVOPS_COMPLETE"` to `MessageType` enum
- [ ] Add `DEVOPS_FAILED = "DEVOPS_FAILED"` to `MessageType` enum
- [ ] Add comment block grouping these as "# DevOps coordination"
- [ ] Run existing coordination tests to ensure no regressions
- [ ] Add unit tests for new message types in test file

---

## Phase 1: TypeScript Types and API Contracts (Frontend)

### T01: Create service health TypeScript types
**Story:** US-01, US-02, US-04
**Estimate:** 0.5 hours
**Agent:** frontend

- [ ] Create `docker/hitl-ui/src/api/types/services.ts`
- [ ] Define `ServiceHealthStatus` type ('healthy' | 'degraded' | 'unhealthy')
- [ ] Define `ServiceHealthInfo` interface (name, status, cpuPercent, memoryPercent, podCount, requestRate, latencyP50, lastRestart)
- [ ] Define `ServiceConnection` interface (from, to, type)
- [ ] Define `SparklineDataPoint` interface (timestamp, value)
- [ ] Define `ServicesHealthResponse` interface
- [ ] Define `ServiceSparklineResponse` interface
- [ ] Export all types

### T02: Create DevOps activity TypeScript types
**Story:** US-05, US-06, US-07, US-08
**Estimate:** 0.5 hours
**Agent:** frontend

- [ ] Create `docker/hitl-ui/src/api/types/devops.ts`
- [ ] Define `DevOpsActivityStatus` type ('in_progress' | 'completed' | 'failed')
- [ ] Define `DevOpsStepStatus` type ('pending' | 'running' | 'completed' | 'failed')
- [ ] Define `DevOpsStep` interface (name, status, startedAt, completedAt, error)
- [ ] Define `DevOpsActivity` interface (id, operation, status, startedAt, completedAt, steps)
- [ ] Define `DevOpsActivityResponse` interface (current, recent)
- [ ] Export all types

---

## Phase 2: Backend Service Health API (Backend)

### T03: Create service health Pydantic models
**Story:** US-04
**Estimate:** 0.5 hours
**Agent:** backend

- [ ] Create `src/orchestrator/api/models/service_health.py`
- [ ] Define `ServiceHealthStatus` enum
- [ ] Define `ServiceHealthInfo` model (matches TypeScript interface)
- [ ] Define `SparklineDataPoint` model (timestamp, value)
- [ ] Define `ServicesHealthResponse` model
- [ ] Define `ServiceSparklineResponse` model
- [ ] Add tests for model validation

### T04: Implement service health aggregation service
**Story:** US-04
**Estimate:** 1.5 hours
**Agent:** backend

- [ ] Create `src/orchestrator/services/service_health.py`
- [ ] Implement `get_service_health(service_name)` - query VictoriaMetrics for single service
- [ ] Implement `get_all_services_health()` - aggregate health for 5 aSDLC services
- [ ] Implement `get_service_sparkline(service_name, metric)` - 15-minute history
- [ ] Define service name to pod label mappings
- [ ] Add caching (5 minute TTL for health, 1 minute for sparkline)
- [ ] Handle VictoriaMetrics unavailability gracefully
- [ ] Add unit tests with mocked VM responses

### T05: Add service health endpoints to metrics_api.py
**Story:** US-04
**Estimate:** 1.0 hour
**Agent:** backend

- [ ] Modify existing `src/orchestrator/routes/metrics_api.py`
- [ ] Implement `GET /api/metrics/services/health` endpoint
- [ ] Implement `GET /api/metrics/services/{name}/sparkline` endpoint with metric query param
- [ ] Add input validation for service names (hitl-ui, orchestrator, workers, redis, elasticsearch)
- [ ] Add error handling with appropriate HTTP status codes
- [ ] Add integration tests

---

## Phase 3: Backend DevOps Activity API (Backend)

### T06: Create DevOps activity Pydantic models
**Story:** US-08
**Estimate:** 0.5 hours
**Agent:** backend

- [ ] Create `src/orchestrator/api/models/devops_activity.py`
- [ ] Define `DevOpsStepStatus` enum
- [ ] Define `DevOpsActivityStatus` enum
- [ ] Define `DevOpsStep` model
- [ ] Define `DevOpsActivity` model
- [ ] Define `DevOpsActivityResponse` model
- [ ] Add tests for model validation

### T07: Implement DevOps activity service using coordination MCP
**Story:** US-08
**Estimate:** 1.0 hour
**Agent:** backend

- [ ] Create `src/orchestrator/services/devops_activity.py`
- [ ] Implement `get_current_activity()` - read DEVOPS_STARTED messages not yet completed
- [ ] Implement `get_recent_activities(limit=10)` - read DEVOPS_COMPLETE/DEVOPS_FAILED messages
- [ ] Use `mcp__coordination__coord_check_messages` to read coordination messages
- [ ] Filter by message types: DEVOPS_STARTED, DEVOPS_STEP_UPDATE, DEVOPS_COMPLETE, DEVOPS_FAILED
- [ ] Aggregate step updates into activity objects
- [ ] Handle coordination MCP unavailability gracefully
- [ ] Add unit tests with mocked coordination responses

### T08: Create DevOps activity API endpoint
**Story:** US-08
**Estimate:** 0.5 hours
**Agent:** backend

- [ ] Create `src/orchestrator/api/routes/devops.py`
- [ ] Implement `GET /api/devops/activity` endpoint
- [ ] Add error handling with appropriate HTTP status codes
- [ ] Register routes in main API router
- [ ] Add integration tests

---

## Phase 4: Backend K8s Cluster API (Backend)

### T09: Create K8s cluster API Pydantic models and add kubernetes package
**Story:** US-13
**Estimate:** 0.5 hours
**Agent:** backend

- [ ] Add `kubernetes>=28.0.0` to `requirements.txt`
- [ ] Create `src/orchestrator/api/models/k8s.py`
- [ ] Define models matching existing TypeScript interfaces in `kubernetes.ts`
- [ ] Define `ClusterHealth` model
- [ ] Define `K8sNode` model with nested types
- [ ] Define `K8sPod` model with nested types
- [ ] Define response wrapper models
- [ ] Add tests for model validation

### T10: Implement K8s cluster service with mock mode
**Story:** US-13
**Estimate:** 1.5 hours
**Agent:** backend

- [ ] Create `src/orchestrator/services/k8s_cluster.py`
- [ ] Implement config detection: check `KUBERNETES_SERVICE_HOST` for in-cluster config
- [ ] Implement fallback: use local kubeconfig (`~/.kube/config`) for development
- [ ] Implement mock mode: if neither available, return mock data (same pattern as VictoriaMetrics)
- [ ] Implement `get_cluster_health()` - aggregate node/pod counts and resource usage
- [ ] Implement `get_nodes()` - list all nodes with status and resource info
- [ ] Implement `get_pods(namespace, status, nodeName, search, limit, offset)` - filtered pod list
- [ ] Add caching (10 second TTL)
- [ ] Handle K8s API unavailability gracefully
- [ ] Add unit tests with mocked K8s client

### T11: Create K8s cluster API endpoints
**Story:** US-13
**Estimate:** 1.0 hour
**Agent:** backend

- [ ] Create `src/orchestrator/api/routes/k8s.py`
- [ ] Implement `GET /api/k8s/health` endpoint
- [ ] Implement `GET /api/k8s/nodes` endpoint
- [ ] Implement `GET /api/k8s/pods` endpoint with query params
- [ ] Add input validation for query params
- [ ] Add error handling with appropriate HTTP status codes
- [ ] Register routes in main API router
- [ ] Add integration tests

---

## Phase 5: Frontend SparklineChart Component (Frontend)

### T12: Create SparklineChart component
**Story:** US-03
**Estimate:** 1.5 hours
**Agent:** frontend

- [ ] Create `docker/hitl-ui/src/components/services/SparklineChart.tsx`
- [ ] Implement SVG-based line chart (80x30 pixels default)
- [ ] Accept `data: SparklineDataPoint[]`, `color`, `height`, `width` props
- [ ] Render smooth line path connecting data points
- [ ] Handle missing data points (interpolate or gap)
- [ ] Support color based on threshold (green/yellow/red)
- [ ] Add hover tooltip showing timestamp and value
- [ ] Add loading state (placeholder animation)
- [ ] Create `SparklineChart.test.tsx` with tests for:
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

- [ ] Create `docker/hitl-ui/src/components/services/ServiceCard.tsx`
- [ ] Display service name as card header
- [ ] Display health status indicator (colored badge)
- [ ] Display CPU sparkline using SparklineChart
- [ ] Display memory sparkline using SparklineChart
- [ ] Display request rate (req/s) if available
- [ ] Display latency p50 (ms) if available
- [ ] Display pod count
- [ ] Display last restart time if within 24 hours
- [ ] Add click handler prop for opening detail view
- [ ] Style with color-coded border based on health status
- [ ] Create `ServiceCard.test.tsx` with tests for:
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

- [ ] Create `docker/hitl-ui/src/components/services/ServiceTopologyMap.tsx`
- [ ] Define fixed layout for 5 services (positioned in diagram)
- [ ] Render service nodes with health-colored circles/rectangles
- [ ] Render connection lines between services
- [ ] Color-code connections by type (HTTP: blue, Redis: red, Elasticsearch: yellow)
- [ ] Add service name labels on each node
- [ ] Add click handler for each service node
- [ ] Add hover effect on nodes
- [ ] Responsive sizing (scales with container)
- [ ] Create `ServiceTopologyMap.test.tsx` with tests for:
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

- [ ] Create `docker/hitl-ui/src/api/services.ts`
- [ ] Implement `getServicesHealth()` function calling `/api/metrics/services/health`
- [ ] Implement `getServiceSparkline(name, metric)` function calling `/api/metrics/services/{name}/sparkline`
- [ ] Create `useServicesHealth()` hook with 30s auto-refresh
- [ ] Create `useServiceSparkline(name, metric)` hook with 1min auto-refresh
- [ ] Add mock data fallback for development mode
- [ ] Add error handling
- [ ] Export query keys for invalidation

---

## Phase 9: Frontend DevOps Activity Components (Frontend)

### T16: Create DevOpsStepList component
**Story:** US-06
**Estimate:** 1.0 hour
**Agent:** frontend

- [ ] Create `docker/hitl-ui/src/components/devops/DevOpsStepList.tsx`
- [ ] Display list of steps in order
- [ ] Show checkmark icon for completed steps (green)
- [ ] Show spinner icon for running step (blue)
- [ ] Show circle icon for pending steps (gray)
- [ ] Show X icon for failed steps (red) with error message
- [ ] Animate transitions between states (CSS transitions)
- [ ] Create `DevOpsStepList.test.tsx` with tests for:
  - Renders all step states correctly
  - Shows error message for failed step
  - Animations applied

### T17: Create DevOpsActivityPanel component
**Story:** US-05
**Estimate:** 1.5 hours
**Agent:** frontend

- [ ] Create `docker/hitl-ui/src/components/devops/DevOpsActivityPanel.tsx`
- [ ] Display current operation section (if any)
- [ ] Show operation name and status badge
- [ ] Include DevOpsStepList for current operation
- [ ] Display recent operations section
- [ ] Show operation name, status, duration for each recent
- [ ] Add manual refresh button
- [ ] Show empty state when no operations
- [ ] Create `DevOpsActivityPanel.test.tsx` with tests for:
  - Shows current operation
  - Shows recent operations
  - Empty state renders
  - Refresh button works

### T18: Create DevOpsNotificationBanner component
**Story:** US-07
**Estimate:** 1.0 hour
**Agent:** frontend

- [ ] Create `docker/hitl-ui/src/components/devops/DevOpsNotificationBanner.tsx`
- [ ] Fixed position at top of viewport
- [ ] Display operation name and current step
- [ ] Color-code: blue (in-progress), green (completed), red (failed)
- [ ] Add dismiss button (X icon)
- [ ] Click banner to open DevOps activity (callback prop)
- [ ] Slide-in animation on mount
- [ ] Auto-hide after 10 seconds when completed
- [ ] Create `DevOpsNotificationBanner.test.tsx` with tests for:
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

- [ ] Create `docker/hitl-ui/src/api/devops.ts`
- [ ] Implement `getDevOpsActivity()` function
- [ ] Create `useDevOpsActivity()` hook with 10s auto-refresh
- [ ] Create `docker/hitl-ui/src/stores/devopsStore.ts`
- [ ] Add `bannerDismissed` state
- [ ] Add `setBannerDismissed` action
- [ ] Add mock data fallback for development mode
- [ ] Export query keys for invalidation

---

## Phase 11: Connect K8s Components to Real API (Frontend)

### T20: Create K8s API hooks with mock data fallback
**Story:** US-10, US-11, US-12
**Estimate:** 1.0 hour
**Agent:** frontend

- [ ] Create or update `docker/hitl-ui/src/api/k8s.ts`
- [ ] Implement `getClusterHealth()` function
- [ ] Implement `getNodes()` function
- [ ] Implement `getPods(params)` function with query params
- [ ] Create `useClusterHealth()` hook with 30s auto-refresh
- [ ] Create `useNodes()` hook with 30s auto-refresh
- [ ] Create `usePods(params)` hook with 30s auto-refresh
- [ ] Add mock data fallback for development mode (when K8s API unavailable)
- [ ] Export query keys for invalidation

### T21: Update ClusterOverview to use real API
**Story:** US-10
**Estimate:** 0.5 hours
**Agent:** frontend

- [ ] Update `docker/hitl-ui/src/components/k8s/ClusterOverview.tsx`
- [ ] Add `useClusterHealth()` hook call (optional, can be passed via props)
- [ ] Update K8sPage or parent to fetch and pass data
- [ ] Verify loading state works
- [ ] Verify error state works
- [ ] Update tests if needed

### T22: Update NodesPanel to use real API
**Story:** US-11
**Estimate:** 0.5 hours
**Agent:** frontend

- [ ] Update `docker/hitl-ui/src/components/k8s/NodesPanel.tsx` or parent page
- [ ] Add `useNodes()` hook call (optional, can be passed via props)
- [ ] Update K8sPage or parent to fetch and pass data
- [ ] Verify filtering works with real data
- [ ] Verify loading state works
- [ ] Update tests if needed

### T23: Update PodsTable to use real API
**Story:** US-12
**Estimate:** 0.5 hours
**Agent:** frontend

- [ ] Update `docker/hitl-ui/src/components/k8s/PodsTable.tsx` or parent page
- [ ] Add `usePods()` hook call (optional, can be passed via props)
- [ ] Update K8sPage or parent to fetch and pass data
- [ ] Verify filtering works with real data
- [ ] Verify pagination works with real data
- [ ] Verify sorting works with real data
- [ ] Update tests if needed

---

## Phase 12: DevOps Agent Progress Publishing (Backend/DevOps)

### T24: Extend DevOps agent to publish progress via coordination MCP
**Story:** US-09
**Estimate:** 1.5 hours
**Agent:** devops

- [ ] Update `.claude/agents/devops.md` to document progress publishing
- [ ] Create helper script `scripts/devops/publish-progress.sh`
- [ ] Implement `publish_operation_start(operation, steps)` using `mcp__coordination__coord_publish_message`
  - Message type: `DEVOPS_STARTED`
  - Payload: operation name, step list, timestamp
- [ ] Implement `publish_step_update(step_name, status, error)` using `mcp__coordination__coord_publish_message`
  - Message type: `DEVOPS_STEP_UPDATE`
  - Payload: step name, status, error (if any), timestamp
- [ ] Implement `publish_operation_complete(status)` using `mcp__coordination__coord_publish_message`
  - Message type: `DEVOPS_COMPLETE` or `DEVOPS_FAILED`
  - Payload: final status, duration, timestamp
- [ ] Add documentation for DevOps agent integration

---

## Phase 13: Integration and Page Assembly (Frontend)

### T25: Create ServiceHealthDashboard page section
**Story:** US-01, US-02
**Estimate:** 1.0 hour
**Agent:** frontend

- [ ] Create `docker/hitl-ui/src/components/services/ServiceHealthDashboard.tsx`
- [ ] Compose ServiceTopologyMap at top
- [ ] Compose ServiceCards in grid below
- [ ] Wire up data fetching with hooks
- [ ] Handle loading and error states
- [ ] Add auto-refresh indicator
- [ ] Create index.ts to export all service components

### T26: Add DevOps activity to MetricsPage or create dedicated page
**Story:** US-05, US-07
**Estimate:** 1.0 hour
**Agent:** frontend

- [ ] Decide: Add to MetricsPage or create DevOpsPage
- [ ] Integrate DevOpsActivityPanel component
- [ ] Integrate DevOpsNotificationBanner (at App level for global visibility)
- [ ] Wire up data fetching with hooks
- [ ] Handle loading and error states
- [ ] Create index.ts to export all devops components

---

## Phase 14: End-to-End Testing

### T27: Backend integration tests
**Story:** US-04, US-08, US-13
**Estimate:** 1.0 hour
**Agent:** backend

- [ ] Test `/api/metrics/services/health` with mock VictoriaMetrics
- [ ] Test `/api/metrics/services/{name}/sparkline` with mock VM
- [ ] Test `/api/devops/activity` with mock coordination messages
- [ ] Test `/api/k8s/health` with mock K8s client
- [ ] Test `/api/k8s/nodes` with mock K8s client
- [ ] Test `/api/k8s/pods` with pagination and filtering

### T28: Frontend E2E tests
**Story:** All
**Estimate:** 1.0 hour
**Agent:** frontend

- [ ] Test ServiceHealthDashboard renders with mock data
- [ ] Test ServiceCard interactions
- [ ] Test DevOpsActivityPanel renders with mock data
- [ ] Test DevOpsNotificationBanner appears and dismisses
- [ ] Test K8s components with mock API

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

- Phase 0: 0/1 tasks (0%)
- Phase 1: 0/2 tasks (0%)
- Phase 2: 0/3 tasks (0%)
- Phase 3: 0/3 tasks (0%)
- Phase 4: 0/3 tasks (0%)
- Phase 5: 0/1 tasks (0%)
- Phase 6: 0/1 tasks (0%)
- Phase 7: 0/1 tasks (0%)
- Phase 8: 0/1 tasks (0%)
- Phase 9: 0/3 tasks (0%)
- Phase 10: 0/1 tasks (0%)
- Phase 11: 0/4 tasks (0%)
- Phase 12: 0/1 tasks (0%)
- Phase 13: 0/2 tasks (0%)
- Phase 14: 0/2 tasks (0%)
- **Total: 0/29 tasks (0%)**

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
