# P06-F07: User Stories

## Epic Summary

As a platform operator, I want to monitor the health and performance of aSDLC services and track DevOps agent operations in real-time, so that I can quickly identify issues and understand what infrastructure changes are happening.

---

## Part 1: Service Health Dashboard

### US-01: Service Topology Visualization

**As a** platform operator
**I want** to see an interactive diagram of aSDLC services and their connections
**So that** I can understand the system architecture and quickly identify which services are unhealthy

#### Acceptance Criteria

- [ ] Display 5 aSDLC services: HITL-UI, Orchestrator, Workers, Redis, Elasticsearch
- [ ] Show connections between services (HTTP, Redis, Elasticsearch)
- [ ] Color-code each service node by health status (green/yellow/red)
- [ ] Click on a service to view detailed metrics
- [ ] Update health status every 30 seconds

#### Test Scenarios

1. **Healthy cluster**: All services show green indicators
2. **Degraded service**: One service shows yellow (high latency)
3. **Unhealthy service**: One service shows red (down/unreachable)
4. **Service click**: Clicking service opens detail panel

---

### US-02: Service Health Cards

**As a** platform operator
**I want** to see compact health cards for each service with key metrics
**So that** I can monitor resource utilization and request performance at a glance

#### Acceptance Criteria

- [ ] Display one card per aSDLC service
- [ ] Show health status indicator (green/yellow/red) on each card
- [ ] Show CPU usage sparkline (15-minute history)
- [ ] Show memory usage sparkline (15-minute history)
- [ ] Show request rate (req/s) for HTTP services
- [ ] Show latency (p50 ms) for HTTP services
- [ ] Show pod count for each service
- [ ] Show last restart time if within 24 hours
- [ ] Cards refresh every 30 seconds

#### Test Scenarios

1. **Normal metrics**: All sparklines show stable values
2. **CPU spike**: CPU sparkline shows recent spike, card border turns yellow
3. **Service restart**: Last restart time shown prominently
4. **Zero pods**: Card shows warning when pod count is 0

---

### US-03: Sparkline Charts

**As a** platform operator
**I want** mini time-series charts showing recent CPU and memory trends
**So that** I can quickly spot patterns and anomalies without opening a full dashboard

#### Acceptance Criteria

- [ ] Sparkline shows 15 data points (1 per minute for 15 minutes)
- [ ] Smooth line rendering (SVG or Canvas)
- [ ] Color indicates current status (green/yellow/red based on threshold)
- [ ] Tooltip shows exact value on hover
- [ ] Graceful handling of missing data points
- [ ] Chart dimensions: approximately 80x30 pixels

#### Test Scenarios

1. **Full data**: All 15 points render correctly
2. **Partial data**: Missing points interpolated or shown as gaps
3. **Hover interaction**: Tooltip shows timestamp and value
4. **Threshold colors**: Line color changes based on current value

---

### US-04: Backend Service Health API

**As a** frontend developer
**I want** API endpoints that aggregate service health data from VictoriaMetrics
**So that** the dashboard can display real-time service status

#### Acceptance Criteria

- [ ] `GET /api/metrics/services/health` returns health for all 5 services
- [ ] Response includes: name, status, cpuPercent, memoryPercent, podCount
- [ ] Response includes: requestRate, latencyP50 for HTTP services
- [ ] Response includes: lastRestart timestamp
- [ ] Endpoint responds within 500ms
- [ ] Returns cached data if VictoriaMetrics is temporarily unavailable
- [ ] Returns 503 with error message if no data available

#### Test Scenarios

1. **Normal operation**: Returns all 5 services with current metrics
2. **VM unavailable**: Returns cached data (up to 5 minutes old)
3. **Service missing metrics**: Returns null for missing fields
4. **Load test**: Handles 100 concurrent requests

---

## Part 2: DevOps Activity Monitoring

### US-05: DevOps Activity Panel

**As a** platform operator
**I want** to see current and recent DevOps agent operations
**So that** I know what infrastructure changes are happening and their status

#### Acceptance Criteria

- [ ] Show current operation (if any) with progress steps
- [ ] Show step status: pending, running, completed, failed
- [ ] Show recent operations (last 10) with duration and final status
- [ ] Refresh automatically every 10 seconds
- [ ] Manual refresh button
- [ ] Empty state when no operations in last 24 hours

#### Test Scenarios

1. **Active operation**: Shows operation name, running step highlighted
2. **Completed operation**: Shows in recent list with duration
3. **Failed operation**: Shows in recent list with error indicator
4. **No operations**: Shows "No recent DevOps activity" message

---

### US-06: DevOps Step Progress

**As a** platform operator
**I want** to see step-by-step progress of DevOps operations
**So that** I understand exactly what is happening during deployments

#### Acceptance Criteria

- [ ] List all steps in operation order
- [ ] Show checkmark for completed steps
- [ ] Show spinner for running step
- [ ] Show circle for pending steps
- [ ] Show X for failed steps with error message
- [ ] Animate transitions between step states

#### Test Scenarios

1. **Three steps, second running**: First shows check, second shows spinner, third shows circle
2. **Step fails**: Shows X with error text, operation marked as failed
3. **All complete**: All steps show checkmarks

---

### US-07: DevOps Notification Banner

**As a** platform operator
**I want** a visual banner when DevOps agent is actively running
**So that** I am aware that infrastructure changes are in progress

#### Acceptance Criteria

- [ ] Banner appears at top of page when operation starts
- [ ] Shows operation name and current step
- [ ] Banner is dismissible (hides but operation continues)
- [ ] Banner is color-coded: blue for in-progress, green for completed, red for failed
- [ ] Banner auto-hides 10 seconds after operation completes
- [ ] Clicking banner opens DevOps Activity Panel

#### Test Scenarios

1. **Operation starts**: Banner slides in from top
2. **Dismiss**: Banner hides, operation state preserved
3. **Operation completes**: Banner turns green, then fades out
4. **Operation fails**: Banner turns red, persists until dismissed

---

### US-08: Backend DevOps Activity API

**As a** frontend developer
**I want** an API endpoint that reads DevOps activity from coordination messages
**So that** the dashboard can display current and recent operations

#### Acceptance Criteria

- [ ] `GET /api/devops/activity` returns current and recent operations
- [ ] Current operation includes: id, operation name, status, steps
- [ ] Recent operations include: last 10 completed/failed operations
- [ ] Step includes: name, status, startedAt, completedAt, error
- [ ] Reads from coordination MCP (DEVOPS_* message types)
- [ ] Returns empty response when no operations
- [ ] Endpoint responds within 200ms

#### Test Scenarios

1. **Active operation**: Returns current with steps array
2. **No active operation**: Returns null for current, recent only
3. **Coordination unavailable**: Returns 503 with error message
4. **Old operations**: Only returns operations from last 24 hours

---

### US-09: DevOps Agent Progress Publishing

**As a** DevOps agent
**I want** to publish step-by-step progress via coordination MCP
**So that** the dashboard can display real-time operation status

#### Acceptance Criteria

- [ ] Agent publishes DEVOPS_STARTED with operation and step list
- [ ] Agent publishes DEVOPS_STEP_UPDATE for step status changes (running, completed, failed)
- [ ] Agent publishes DEVOPS_COMPLETE or DEVOPS_FAILED on operation completion
- [ ] Messages use coordination MCP (`mcp__coordination__coord_publish_message`)
- [ ] Messages include timestamp for each update
- [ ] Messages are retained for 24 hours (coordination message TTL)

#### Test Scenarios

1. **Helm deployment**: Publishes steps: pull, apply, wait for rollout
2. **Docker build**: Publishes steps: build, tag, push
3. **Step failure**: Publishes step failed with error, operation failed

---

## Part 3: Connect Existing K8s Components

### US-10: Connect ClusterOverview to Real API

**As a** platform operator
**I want** the cluster overview panel to show real Kubernetes data
**So that** I see actual node and pod counts instead of mock data

#### Acceptance Criteria

- [ ] ClusterOverview fetches from `/api/k8s/health`
- [ ] Shows real node counts (ready/total)
- [ ] Shows real pod counts (running/pending/failed)
- [ ] Shows real CPU and memory usage percentages
- [ ] Loading skeleton while fetching
- [ ] Error state with retry button if API fails
- [ ] Auto-refresh every 30 seconds

#### Test Scenarios

1. **Healthy cluster**: All metrics display correctly
2. **API error**: Shows error message with retry button
3. **Loading**: Shows skeleton placeholders
4. **Data refresh**: Updates without full page reload

---

### US-11: Connect NodesPanel to Real API

**As a** platform operator
**I want** the nodes panel to show real Kubernetes node data
**So that** I can monitor actual node health and resource usage

#### Acceptance Criteria

- [ ] NodesPanel fetches from `/api/k8s/nodes`
- [ ] Shows real node names, status, roles
- [ ] Shows real CPU, memory, disk usage per node
- [ ] Shows real pod count per node
- [ ] Filtering by status works with real data
- [ ] Click node to see details
- [ ] Auto-refresh every 30 seconds

#### Test Scenarios

1. **Multi-node cluster**: Shows all nodes with correct data
2. **Filter Ready**: Only Ready nodes shown
3. **Filter NotReady**: Only NotReady nodes shown
4. **Click node**: Opens detail view (if implemented)

---

### US-12: Connect PodsTable to Real API

**As a** platform operator
**I want** the pods table to show real Kubernetes pod data
**So that** I can monitor actual pod status and troubleshoot issues

#### Acceptance Criteria

- [ ] PodsTable fetches from `/api/k8s/pods`
- [ ] Shows real pod names, namespaces, status
- [ ] Shows real node assignments
- [ ] Shows real restart counts
- [ ] Filtering by namespace, status, node works
- [ ] Search by pod name works
- [ ] Sorting by all columns works
- [ ] Pagination works with real data counts
- [ ] Auto-refresh every 30 seconds

#### Test Scenarios

1. **Many pods**: Pagination works correctly
2. **Filter namespace**: Only selected namespace shown
3. **Search**: Finds pods by partial name match
4. **Sort by restarts**: High restart pods shown first

---

### US-13: Backend K8s Cluster API

**As a** frontend developer
**I want** API endpoints that query Kubernetes cluster data
**So that** the dashboard can display real cluster, node, and pod information

#### Acceptance Criteria

- [ ] `GET /api/k8s/health` returns ClusterHealth matching existing interface
- [ ] `GET /api/k8s/nodes` returns K8sNodesResponse matching existing interface
- [ ] `GET /api/k8s/pods` returns K8sPodsResponse matching existing interface
- [ ] Pods endpoint supports query params: namespace, status, nodeName, search, limit, offset
- [ ] Endpoints respond within 1000ms
- [ ] Returns 503 if Kubernetes API is unavailable
- [ ] Caches data for 10 seconds to reduce K8s API load
- [ ] Mock mode available when K8s is not accessible (development)

#### Test Scenarios

1. **Health endpoint**: Returns correct aggregate counts
2. **Nodes endpoint**: Returns all nodes with full details
3. **Pods endpoint**: Returns pods with pagination working
4. **Pods filtering**: Query params filter correctly
5. **K8s unavailable**: Returns 503 with message or mock data in dev mode

---

## Summary

| ID | Story | Estimated Hours |
|----|-------|-----------------|
| US-01 | Service Topology Visualization | 2.0 |
| US-02 | Service Health Cards | 2.0 |
| US-03 | Sparkline Charts | 1.5 |
| US-04 | Backend Service Health API | 2.0 |
| US-05 | DevOps Activity Panel | 2.0 |
| US-06 | DevOps Step Progress | 1.0 |
| US-07 | DevOps Notification Banner | 1.5 |
| US-08 | Backend DevOps Activity API | 1.5 |
| US-09 | DevOps Agent Progress Publishing | 1.5 |
| US-10 | Connect ClusterOverview | 1.0 |
| US-11 | Connect NodesPanel | 1.0 |
| US-12 | Connect PodsTable | 1.5 |
| US-13 | Backend K8s Cluster API | 2.5 |
| **Total** | | **21.0** |

Note: Estimates include implementation and testing. Actual effort may vary based on complexity discovered during implementation.
