# P06-F07: Service Health Dashboard and DevOps Activity Monitoring

## Overview

Replace the original "full cluster monitoring" approach with a focused, service-centric dashboard that monitors the 5 aSDLC services (HITL-UI, Orchestrator, Workers, Redis, Elasticsearch) and provides real-time visibility into DevOps agent operations.

## Goals

1. **Service Health Dashboard** - Monitor aSDLC services with interactive topology, health indicators, and resource sparklines
2. **DevOps Activity Monitoring** - Real-time visibility into DevOps agent operations via Redis coordination
3. **Connect Existing K8s Components** - Replace mock data in ClusterOverview.tsx, NodesPanel.tsx, PodsTable.tsx with real API calls

## Architecture

```
+-------------------------------------------------------------------+
|                     Service Health Dashboard                       |
+-------------------------------------------------------------------+
|                                                                   |
|  +-------------------------------------------------------------+  |
|  |                  ServiceTopologyMap                          |  |
|  |  [HITL-UI] --> [Orchestrator] --> [Workers]                 |  |
|  |       |              |                |                      |  |
|  |       v              v                v                      |  |
|  |    [Redis]  <-----> [Elasticsearch]                         |  |
|  |   (health indicators on each node)                          |  |
|  +-------------------------------------------------------------+  |
|                                                                   |
|  +---------------+ +---------------+ +---------------+            |
|  | HITL-UI       | | Orchestrator  | | Workers       |            |
|  | [CPU spark]   | | [CPU spark]   | | [CPU spark]   |            |
|  | [Mem spark]   | | [Mem spark]   | | [Mem spark]   |            |
|  | 12 req/s      | | 45 req/s      | | 3 active      |            |
|  | p50: 12ms     | | p50: 8ms      | | restarts: 0   |            |
|  +---------------+ +---------------+ +---------------+            |
|                                                                   |
|  +---------------+ +---------------+                              |
|  | Redis         | | Elasticsearch |                              |
|  | [CPU spark]   | | [CPU spark]   |                              |
|  | [Mem spark]   | | [Mem spark]   |                              |
|  | connections:45| | indices: 3    |                              |
|  +---------------+ +---------------+                              |
|                                                                   |
+-------------------------------------------------------------------+
|                  DevOps Activity Panel                            |
+-------------------------------------------------------------------+
|  [Active] Deploy workers chart v2.1.0                             |
|    [x] Pulling images                                             |
|    [x] Creating pods                                              |
|    [ ] Waiting for rollout                                        |
|  ---------------------------------------------------------------- |
|  Recent:                                                          |
|  - 10:32 - Helm upgrade redis (completed, 45s)                    |
|  - 10:15 - kubectl apply configmap (completed, 2s)                |
|  - 09:58 - Build docker image (completed, 120s)                   |
+-------------------------------------------------------------------+
```

## Components

### Part 1: Service Health Dashboard

#### 1.1 ServiceTopologyMap Component

Interactive diagram showing service connections and real-time health status.

```typescript
interface ServiceTopologyMapProps {
  services: ServiceHealthInfo[];
  connections: ServiceConnection[];
  onServiceClick?: (service: ServiceHealthInfo) => void;
}

interface ServiceHealthInfo {
  name: string;                    // e.g., "hitl-ui", "orchestrator"
  status: 'healthy' | 'degraded' | 'unhealthy';
  cpuPercent: number;
  memoryPercent: number;
  podCount: number;
  requestRate?: number;            // req/s (for HTTP services)
  latencyP50?: number;             // ms (for HTTP services)
}

interface ServiceConnection {
  from: string;
  to: string;
  type: 'http' | 'redis' | 'elasticsearch';
}
```

#### 1.2 ServiceCard Component

Compact card with health status and mini time-series charts.

```typescript
interface ServiceCardProps {
  service: ServiceHealthInfo;
  cpuHistory: SparklineDataPoint[];   // Last 15 minutes, 1-point/minute
  memoryHistory: SparklineDataPoint[];
  onClick?: () => void;
}

interface SparklineDataPoint {
  timestamp: number;
  value: number;
}
```

#### 1.3 New Backend Endpoints

All service health endpoints are added to the existing `/api/metrics/` router for consistency.

| Endpoint | Description |
|----------|-------------|
| `GET /api/metrics/services/health` | Health status for all 5 aSDLC services |
| `GET /api/metrics/services/{name}/sparkline` | 15-min history for sparkline charts |

### Part 2: DevOps Activity Monitoring

#### 2.1 Coordination Message Types Extension

Extend existing `MessageType` enum in `src/infrastructure/coordination/types.py` with DevOps-specific types:

```python
class MessageType(str, Enum):
    # ... existing types ...

    # DevOps coordination
    DEVOPS_STARTED = "DEVOPS_STARTED"
    DEVOPS_STEP_UPDATE = "DEVOPS_STEP_UPDATE"
    DEVOPS_COMPLETE = "DEVOPS_COMPLETE"
    DEVOPS_FAILED = "DEVOPS_FAILED"
```

#### 2.2 DevOps Activity Data Structure

```typescript
interface DevOpsActivity {
  id: string;
  operation: string;               // e.g., "Deploy workers chart v2.1.0"
  status: 'in_progress' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  steps: DevOpsStep[];
}

interface DevOpsStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  error?: string;
}
```

#### 2.3 DevOps Activity Endpoint

| Endpoint | Description |
|----------|-------------|
| `GET /api/devops/activity` | Current + recent DevOps operations (last 10) |

#### 2.4 DevOpsActivityPanel Component

```typescript
interface DevOpsActivityPanelProps {
  currentActivity?: DevOpsActivity;
  recentActivities: DevOpsActivity[];
  onRefresh?: () => void;
}
```

#### 2.5 DevOpsNotificationBanner Component

Visual banner shown when DevOps agent is active:

```typescript
interface DevOpsNotificationBannerProps {
  activity: DevOpsActivity;
  onDismiss?: () => void;
}
```

### Part 3: Connect Existing K8s Components

Update existing components to use real API data instead of mocks:

| Component | Current State | Target State |
|-----------|--------------|--------------|
| ClusterOverview.tsx | Uses mock data from parent | Connect to `/api/k8s/health` |
| NodesPanel.tsx | Uses mock data from parent | Connect to `/api/k8s/nodes` |
| PodsTable.tsx | Uses mock data from parent | Connect to `/api/k8s/pods` |

## Dependencies

### Existing (Keep)

- VictoriaMetrics chart with vmagent (P06-F06)
- Service metrics API (`/api/metrics/services`, `/cpu`, `/memory`, `/requests`, `/latency`)
- K8s frontend components (ClusterOverview, NodesPanel, PodsTable)
- Redis MCP sidecar for coordination
- Coordination MCP tools (`mcp__coordination__coord_publish_message`, `mcp__coordination__coord_check_messages`)

### New Dependencies

- `kubernetes` Python package for K8s API access
- In-cluster kubeconfig detection (for production)
- Local kubeconfig fallback (for development)
- Mock mode for development (same pattern as VictoriaMetrics mock)

### Not Needed (Remove from original design)

- node_exporter DaemonSet - Not needed for service-focused monitoring
- kube-state-metrics - Not needed
- ServiceMonitor CRDs - Already using annotation-based scraping
- Generic cluster/node endpoints (T06-T10 from original) - Replace with service-focused endpoints

## API Contracts

### GET /api/metrics/services/health

Response:
```json
{
  "services": [
    {
      "name": "hitl-ui",
      "status": "healthy",
      "cpuPercent": 12.5,
      "memoryPercent": 45.2,
      "podCount": 2,
      "requestRate": 12.3,
      "latencyP50": 15,
      "lastRestart": "2026-01-27T08:00:00Z"
    }
  ],
  "timestamp": "2026-01-27T10:30:00Z"
}
```

### GET /api/metrics/services/{name}/sparkline

Response:
```json
{
  "service": "orchestrator",
  "metric": "cpu",
  "dataPoints": [
    { "timestamp": 1706354400, "value": 12.5 },
    { "timestamp": 1706354460, "value": 13.2 }
  ],
  "interval": "1m",
  "duration": "15m"
}
```

### GET /api/devops/activity

Response:
```json
{
  "current": {
    "id": "devops-123",
    "operation": "Deploy workers chart v2.1.0",
    "status": "in_progress",
    "startedAt": "2026-01-27T10:30:00Z",
    "steps": [
      { "name": "Pulling images", "status": "completed" },
      { "name": "Creating pods", "status": "running" },
      { "name": "Waiting for rollout", "status": "pending" }
    ]
  },
  "recent": [
    {
      "id": "devops-122",
      "operation": "Helm upgrade redis",
      "status": "completed",
      "startedAt": "2026-01-27T10:32:00Z",
      "completedAt": "2026-01-27T10:32:45Z",
      "steps": []
    }
  ]
}
```

### GET /api/k8s/health

Response (matches existing ClusterHealth interface):
```json
{
  "status": "healthy",
  "nodesReady": 3,
  "nodesTotal": 3,
  "podsRunning": 12,
  "podsTotal": 15,
  "podsPending": 2,
  "podsFailed": 1,
  "cpuUsagePercent": 45,
  "memoryUsagePercent": 62,
  "lastUpdated": "2026-01-27T10:30:00Z"
}
```

### GET /api/k8s/nodes

Response (matches existing K8sNodesResponse interface):
```json
{
  "nodes": [...],
  "total": 3
}
```

### GET /api/k8s/pods

Response (matches existing K8sPodsResponse interface):
```json
{
  "pods": [...],
  "total": 15
}
```

## File Structure

### New Files (Frontend)

```
docker/hitl-ui/src/
  components/
    services/
      ServiceTopologyMap.tsx
      ServiceTopologyMap.test.tsx
      ServiceCard.tsx
      ServiceCard.test.tsx
      SparklineChart.tsx
      SparklineChart.test.tsx
      index.ts
    devops/
      DevOpsActivityPanel.tsx
      DevOpsActivityPanel.test.tsx
      DevOpsNotificationBanner.tsx
      DevOpsNotificationBanner.test.tsx
      DevOpsStepList.tsx
      DevOpsStepList.test.tsx
      index.ts
  api/
    services.ts              # Service health API hooks
    devops.ts                # DevOps activity API hooks
    k8s.ts                   # K8s API hooks (update existing or create)
    types/
      services.ts            # Service health types
      devops.ts              # DevOps activity types
  stores/
    devopsStore.ts           # DevOps activity state
```

### Modified Files (Backend)

```
src/infrastructure/coordination/types.py  # Add DEVOPS_* message types
src/orchestrator/routes/metrics_api.py    # Add service health endpoints
```

### New Files (Backend)

```
src/orchestrator/api/
  devops_endpoints.py        # DevOps activity endpoints
  k8s_endpoints.py           # K8s cluster endpoints
src/orchestrator/services/
  service_health.py          # Service health aggregation
  devops_activity.py         # DevOps activity from coordination MCP
  k8s_cluster.py             # K8s cluster data service
```

## Integration Points

### VictoriaMetrics Queries

Service health will query VictoriaMetrics for:
- `process_cpu_seconds_total` - CPU usage by service
- `process_resident_memory_bytes` - Memory usage by service
- `http_requests_total` - Request rate by service
- `http_request_duration_seconds_bucket` - Latency percentiles

### Coordination MCP Integration

DevOps activity monitoring uses existing coordination MCP tools:
- `mcp__coordination__coord_publish_message` - For publishing devops activity (DevOps agent)
- `mcp__coordination__coord_check_messages` - For reading activity (Dashboard API)

Message types used:
- `DEVOPS_STARTED` - Published when operation begins
- `DEVOPS_STEP_UPDATE` - Published on step status changes
- `DEVOPS_COMPLETE` - Published when operation succeeds
- `DEVOPS_FAILED` - Published when operation fails

### Kubernetes Python Client

K8s cluster service uses the official `kubernetes` Python package:
- Auto-detects in-cluster config via `KUBERNETES_SERVICE_HOST`
- Falls back to local kubeconfig for development
- Mock mode available when K8s is unavailable (same pattern as VictoriaMetrics)

### Existing K8s Types

Reuse existing TypeScript interfaces from `api/types/kubernetes.ts`:
- `ClusterHealth`
- `K8sNode`, `K8sNodesResponse`
- `K8sPod`, `K8sPodsResponse`

## Estimated Effort

| Part | Hours |
|------|-------|
| Phase 0: Coordination Types Extension | 0.5 |
| Part 1: Service Health Dashboard | 10 |
| Part 2: DevOps Activity Monitoring | 8 |
| Part 3: Connect K8s Components | 9 |
| **Total** | **27.5** |
