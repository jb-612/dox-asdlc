# P05-F09: Kubernetes Visibility Dashboard - Technical Design

## Overview

Add a comprehensive Kubernetes visibility dashboard to the HITL UI, providing real-time monitoring of the aSDLC cluster. This dashboard enables operators to monitor cluster health, inspect pods/nodes/services, execute diagnostic commands, and view resource utilization trends.

**Goals:**
1. Provide cluster-wide health visibility at a glance
2. Enable quick diagnostics with command-line terminal interface
3. Visualize network topology and resource hierarchy
4. Display real-time CPU/Memory metrics with trend charts
5. Support pod log inspection and event viewing

## Dependencies

### Required Features
- **P05-F06**: HITL UI v2 (React, Vite, TypeScript, Tailwind, TanStack Query, Zustand)
- **P02-F02**: Manager Agent (orchestrator API with kubectl proxy)

### External Dependencies
- Orchestrator service with kubectl proxy endpoints
- Kubernetes Metrics Server (for CPU/Memory metrics)
- Existing HITL UI infrastructure:
  - Recharts (already installed - for charts)
  - react-d3-tree (already installed - for resource hierarchy)
  - WebSocket client (existing - for real-time pod events)
  - TanStack Query (existing - for data fetching)
  - Zustand (existing - for UI state)

### Existing Patterns to Leverage
- Mock pattern: `VITE_USE_MOCKS` flag, mocks in `api/mocks/`
- API client: `api/client.ts` with axios, tenant headers
- WebSocket: `api/websocket.ts` and `utils/websocket.ts`
- Component patterns: KPIHeader, WorkerUtilizationPanel from CockpitPage
- Chart patterns: Recharts usage in existing components

## Interfaces

### Provided Interfaces

**SPA Routes:**
```
/k8s                          # Main K8s dashboard page
/k8s/nodes                    # Nodes detail view
/k8s/pods/:pod_name           # Pod detail/logs view (optional future)
```

**Component Exports:**
```typescript
// Shared components for other features
export { K8sDashboard } from '@/components/k8s/K8sDashboard';
export { ClusterOverview } from '@/components/k8s/ClusterOverview';
export { CommandTerminal } from '@/components/k8s/CommandTerminal';
export { MetricsChart } from '@/components/k8s/MetricsChart';
```

### Required Interfaces

**API Endpoints (from orchestrator):**
```
# Cluster Overview
GET  /api/k8s/cluster/health     # Cluster-wide health summary
GET  /api/k8s/namespaces         # List namespaces

# Nodes
GET  /api/k8s/nodes              # List nodes with status/capacity
GET  /api/k8s/nodes/:name        # Node detail

# Pods
GET  /api/k8s/pods               # List pods (all namespaces or filtered)
GET  /api/k8s/pods/:namespace/:name  # Pod detail
GET  /api/k8s/pods/:namespace/:name/logs  # Pod logs (streaming)

# Networking
GET  /api/k8s/services           # List services
GET  /api/k8s/ingresses          # List ingresses
GET  /api/k8s/network-policies   # List network policies

# Metrics
GET  /api/k8s/metrics/nodes      # Node CPU/Memory metrics
GET  /api/k8s/metrics/pods       # Pod CPU/Memory metrics
GET  /api/k8s/metrics/history    # Historical metrics (time series)

# Commands
POST /api/k8s/exec               # Execute kubectl/docker command
GET  /api/k8s/health-check/:type # Run specific health check

# Events (WebSocket)
WS   /api/k8s/events             # Real-time pod/node events
```

**TypeScript Interfaces:**

```typescript
// Cluster Health
interface ClusterHealth {
  status: 'healthy' | 'degraded' | 'critical';
  nodesReady: number;
  nodesTotal: number;
  podsRunning: number;
  podsTotal: number;
  podsPending: number;
  podsFailed: number;
  cpuUsagePercent: number;
  memoryUsagePercent: number;
  lastUpdated: string;
}

// Node
interface K8sNode {
  name: string;
  status: 'Ready' | 'NotReady' | 'Unknown';
  roles: string[];
  version: string;
  os: string;
  containerRuntime: string;
  capacity: {
    cpu: string;
    memory: string;
    pods: number;
  };
  allocatable: {
    cpu: string;
    memory: string;
    pods: number;
  };
  usage: {
    cpuPercent: number;
    memoryPercent: number;
    podsCount: number;
  };
  conditions: NodeCondition[];
  createdAt: string;
}

interface NodeCondition {
  type: string;
  status: 'True' | 'False' | 'Unknown';
  reason: string;
  message: string;
  lastTransition: string;
}

// Pod
interface K8sPod {
  name: string;
  namespace: string;
  status: 'Running' | 'Pending' | 'Succeeded' | 'Failed' | 'Unknown';
  phase: string;
  nodeName: string;
  podIP: string;
  hostIP: string;
  containers: Container[];
  restarts: number;
  age: string;
  createdAt: string;
  labels: Record<string, string>;
  ownerKind: string;
  ownerName: string;
}

interface Container {
  name: string;
  image: string;
  ready: boolean;
  restartCount: number;
  state: 'running' | 'waiting' | 'terminated';
  stateReason?: string;
  lastState?: ContainerState;
}

interface ContainerState {
  state: 'running' | 'waiting' | 'terminated';
  reason?: string;
  exitCode?: number;
  startedAt?: string;
  finishedAt?: string;
}

// Service
interface K8sService {
  name: string;
  namespace: string;
  type: 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'ExternalName';
  clusterIP: string;
  externalIPs: string[];
  ports: ServicePort[];
  selector: Record<string, string>;
  createdAt: string;
}

interface ServicePort {
  name: string;
  protocol: 'TCP' | 'UDP';
  port: number;
  targetPort: number;
  nodePort?: number;
}

// Ingress
interface K8sIngress {
  name: string;
  namespace: string;
  hosts: string[];
  paths: IngressPath[];
  tls: boolean;
  createdAt: string;
}

interface IngressPath {
  host: string;
  path: string;
  serviceName: string;
  servicePort: number;
}

// Metrics
interface MetricsDataPoint {
  timestamp: string;
  cpuPercent: number;
  memoryPercent: number;
}

interface MetricsTimeSeries {
  resourceType: 'cluster' | 'node' | 'pod';
  resourceName: string;
  dataPoints: MetricsDataPoint[];
  interval: '1m' | '5m' | '15m' | '1h';
  startTime: string;
  endTime: string;
}

// Command Execution
interface CommandRequest {
  command: string;  // kubectl or docker command
  namespace?: string;
  timeout?: number;  // seconds
}

interface CommandResponse {
  success: boolean;
  output: string;
  error?: string;
  exitCode: number;
  duration: number;  // ms
}

// Health Checks
type HealthCheckType =
  | 'dns'           // Check DNS resolution
  | 'connectivity'  // Check pod-to-pod connectivity
  | 'storage'       // Check PV/PVC status
  | 'api-server'    // Check API server health
  | 'etcd'          // Check etcd cluster health
  | 'scheduler'     // Check scheduler health
  | 'controller';   // Check controller-manager health

interface HealthCheckResult {
  type: HealthCheckType;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: Record<string, unknown>;
  duration: number;  // ms
  timestamp: string;
}

// K8s Events (WebSocket)
interface K8sEvent {
  type: 'ADDED' | 'MODIFIED' | 'DELETED';
  object: K8sEventObject;
}

interface K8sEventObject {
  kind: 'Pod' | 'Node' | 'Service' | 'Deployment';
  name: string;
  namespace?: string;
  reason: string;
  message: string;
  timestamp: string;
  count?: number;
}
```

## Technical Approach

### Architecture

```
src/
├── api/
│   ├── kubernetes.ts           # K8s API client functions
│   └── mocks/kubernetes.ts     # Mock data for development
├── components/
│   └── k8s/
│       ├── K8sDashboard.tsx         # Main dashboard page component
│       ├── ClusterOverview.tsx      # Cluster health summary panel
│       ├── NetworkingPanel.tsx      # Services/Ingresses visualization
│       ├── NodesPanel.tsx           # Node cards with metrics
│       ├── PodsTable.tsx            # Filterable pod listing
│       ├── PodDetailDrawer.tsx      # Pod details, logs, events drawer
│       ├── ResourceHierarchy.tsx    # D3 tree of namespace/deployment/pods
│       ├── CommandTerminal.tsx      # Terminal-style command execution
│       ├── HealthCheckPanel.tsx     # Health check buttons and results
│       ├── MetricsChart.tsx         # CPU/Memory trend charts
│       └── index.ts                 # Public exports
├── pages/
│   └── K8sPage.tsx             # Route page wrapper
└── stores/
    └── k8sStore.ts             # K8s dashboard state (Zustand)
```

### Data Flow

**1. Real-Time Pod Events (WebSocket)**
```
Orchestrator WebSocket → subscribeToEvent('k8s:*') → k8sStore → Component Updates
                                                         ↓
                                              PodDetailDrawer events tab
                                              ClusterOverview status updates
```

**2. Metrics Polling**
```
TanStack Query (polling) → GET /api/k8s/metrics/history → MetricsChart
    ↓
refetchInterval: 30000 (30s for charts)
refetchInterval: 10000 (10s for cluster health)
```

**3. Command Execution**
```
CommandTerminal input → POST /api/k8s/exec → Response display
                            ↓
                     Sanitized commands only (whitelist)
                     Timeout enforcement
```

### Key Components

#### 1. ClusterOverview
```typescript
interface ClusterOverviewProps {
  health: ClusterHealth;
  isLoading?: boolean;
  onRefresh?: () => void;
}

// Features:
// - Status indicator (green/yellow/red based on health.status)
// - KPI cards: Nodes Ready, Pods Running, CPU%, Memory%
// - Quick status icons for each component
// - Click to expand detailed view
```

#### 2. CommandTerminal
```typescript
interface CommandTerminalProps {
  onExecute: (command: string) => Promise<CommandResponse>;
  allowedCommands?: string[];  // Whitelist prefixes
  className?: string;
}

// Features:
// - Dark terminal aesthetic (monospace font, dark bg)
// - Command history (up/down arrows)
// - Output display with syntax highlighting
// - Loading indicator during execution
// - Error display in red
// - Scroll to bottom on new output
// - Clear command
// - Copy output button
```

#### 3. MetricsChart
```typescript
interface MetricsChartProps {
  data: MetricsTimeSeries;
  type: 'cpu' | 'memory' | 'both';
  height?: number;
  showLegend?: boolean;
  interval?: '1m' | '5m' | '15m' | '1h';
  onIntervalChange?: (interval: string) => void;
}

// Features:
// - Line/Area chart using Recharts
// - CPU line (blue), Memory line (purple)
// - Hover tooltip with exact values
// - Time range selector (1h, 6h, 24h, 7d)
// - Sparkline variant for cards
// - Responsive sizing
```

#### 4. ResourceHierarchy
```typescript
interface ResourceHierarchyProps {
  namespace?: string;  // Filter to namespace
  onNodeClick?: (type: string, name: string) => void;
}

// Features:
// - D3 tree visualization
// - Hierarchy: Namespace → Deployment/StatefulSet → ReplicaSet → Pods
// - Color-coded nodes by status
// - Collapsible branches
// - Zoom and pan
// - Click to select and show details
```

#### 5. PodsTable
```typescript
interface PodsTableProps {
  pods: K8sPod[];
  isLoading?: boolean;
  onPodClick?: (pod: K8sPod) => void;
  showFilters?: boolean;
}

// Features:
// - Sortable columns (Name, Namespace, Status, Node, Age, Restarts)
// - Filters: Namespace, Status, Node
// - Search by pod name
// - Color-coded status badges (green=Running, yellow=Pending, red=Failed)
// - Row click opens PodDetailDrawer
// - Pagination (50 per page)
// - Virtual scrolling for large lists
```

#### 6. HealthCheckPanel
```typescript
interface HealthCheckPanelProps {
  results: HealthCheckResult[];
  isLoading?: boolean;
  onRunCheck: (type: HealthCheckType) => void;
  onRunAll: () => void;
}

// Features:
// - Grid of health check buttons
// - Status indicator per check (pass/fail/warning/pending)
// - "Run All" button
// - Expandable result details
// - Last run timestamp
// - Duration display
```

### State Management

**k8sStore (Zustand):**
```typescript
interface K8sStore {
  // Selected resources
  selectedNamespace: string | null;
  selectedPod: K8sPod | null;
  selectedNode: K8sNode | null;

  // UI state
  terminalHistory: CommandHistoryEntry[];
  terminalOutput: string[];
  drawerOpen: boolean;
  metricsInterval: '1m' | '5m' | '15m' | '1h';

  // Actions
  setSelectedNamespace: (ns: string | null) => void;
  setSelectedPod: (pod: K8sPod | null) => void;
  setSelectedNode: (node: K8sNode | null) => void;
  addTerminalCommand: (cmd: string, output: string) => void;
  clearTerminal: () => void;
  setDrawerOpen: (open: boolean) => void;
  setMetricsInterval: (interval: string) => void;
}
```

**TanStack Query Keys:**
```typescript
const k8sQueryKeys = {
  clusterHealth: ['k8s', 'cluster', 'health'],
  nodes: ['k8s', 'nodes'],
  node: (name: string) => ['k8s', 'nodes', name],
  pods: (namespace?: string) => ['k8s', 'pods', { namespace }],
  pod: (namespace: string, name: string) => ['k8s', 'pods', namespace, name],
  podLogs: (namespace: string, name: string) => ['k8s', 'pods', namespace, name, 'logs'],
  services: (namespace?: string) => ['k8s', 'services', { namespace }],
  ingresses: (namespace?: string) => ['k8s', 'ingresses', { namespace }],
  metrics: (type: string, name?: string) => ['k8s', 'metrics', type, name],
  metricsHistory: (interval: string) => ['k8s', 'metrics', 'history', interval],
  healthChecks: ['k8s', 'health-checks'],
};
```

### UI Design Specifications

**Color Palette (extending existing theme):**
```css
/* Pod Status Colors */
--status-running: var(--status-success);      /* green */
--status-pending: var(--status-warning);      /* yellow/amber */
--status-failed: var(--status-error);         /* red */
--status-succeeded: var(--accent-teal);       /* teal */
--status-unknown: var(--text-muted);          /* gray */

/* Terminal Theme */
--terminal-bg: #0d1117;
--terminal-text: #c9d1d9;
--terminal-prompt: #58a6ff;
--terminal-success: #3fb950;
--terminal-error: #f85149;
--terminal-border: #30363d;
```

**Terminal Design:**
- Background: Very dark (#0d1117)
- Font: JetBrains Mono or Fira Code (monospace)
- Prompt: Blue colored `$ ` prefix
- Output: Light gray text
- Errors: Red text
- Border: Subtle dark border
- Scrollable with fixed height (300-400px default)
- Expandable to full screen

**Metrics Chart Design:**
- CPU line: Blue (#3b82f6)
- Memory line: Purple (#8b5cf6)
- Grid lines: Very subtle
- Background: Transparent (inherits panel bg)
- Hover: Tooltip with time and values
- Y-axis: 0-100%

**Resource Hierarchy:**
- Namespace nodes: Large, blue
- Deployment nodes: Medium, teal
- Pod nodes: Small, status-colored
- Connecting lines: Subtle gray
- Selected node: Highlighted with ring

### Security Considerations

1. **Command Execution Whitelist:**
   - Only allow read-only kubectl commands by default
   - `kubectl get`, `kubectl describe`, `kubectl logs`, `kubectl top`
   - `docker ps`, `docker logs`, `docker stats`
   - Block: `kubectl delete`, `kubectl apply`, `kubectl exec`, `docker rm`

2. **API Authentication:**
   - Inherit existing session authentication
   - Add X-Tenant-ID header for multi-tenancy

3. **Rate Limiting:**
   - Command execution: Max 10 per minute per user
   - Health checks: Max 5 per minute

4. **Log Streaming:**
   - Limit log lines returned (default 1000)
   - Timeout long-running streams (30s)

### Server-Side Validation (Mandatory)

Command whitelist validation MUST be enforced server-side in the orchestrator API. Client-side validation is for UX feedback only and MUST NOT be relied upon for security.

**Backend requirements:**
- Parse commands into structured parameters (action, resource, namespace, etc.)
- Reconstruct commands from validated parameters, never accept raw command strings
- Validate against server-side whitelist before execution
- Log all command execution attempts for audit

Example API structure:
```json
// Request - parameterized, not raw command
POST /api/k8s/exec
{
  "action": "get",
  "resource": "pods",
  "namespace": "default",
  "flags": ["-o", "json"]
}

// NOT this - raw command string is a security risk
POST /api/k8s/exec
{ "command": "kubectl get pods -n default -o json" }
```

### Performance Considerations

1. **Polling Intervals:**
   - Cluster health: 10 seconds
   - Pods list: 15 seconds
   - Metrics history: 30 seconds
   - Disable polling when tab not visible

2. **Virtual Scrolling:**
   - Pod table uses virtual scrolling for 100+ pods
   - Log viewer uses virtual scrolling

3. **Lazy Loading:**
   - ResourceHierarchy loaded on demand
   - Metrics charts loaded when visible
   - Pod logs fetched on drawer open

4. **Data Caching:**
   - TanStack Query caching with stale-while-revalidate
   - Terminal history persisted in Zustand (limited to 100 entries)

## File Structure

```
docker/hitl-ui/
├── src/
│   ├── api/
│   │   ├── kubernetes.ts           # ~200 lines
│   │   └── mocks/kubernetes.ts     # ~300 lines
│   ├── components/
│   │   └── k8s/
│   │       ├── K8sDashboard.tsx         # ~150 lines
│   │       ├── ClusterOverview.tsx      # ~120 lines
│   │       ├── NetworkingPanel.tsx      # ~180 lines
│   │       ├── NodesPanel.tsx           # ~200 lines
│   │       ├── PodsTable.tsx            # ~250 lines
│   │       ├── PodDetailDrawer.tsx      # ~200 lines
│   │       ├── ResourceHierarchy.tsx    # ~180 lines
│   │       ├── CommandTerminal.tsx      # ~200 lines
│   │       ├── HealthCheckPanel.tsx     # ~150 lines
│   │       ├── MetricsChart.tsx         # ~150 lines
│   │       └── index.ts                 # ~20 lines
│   ├── pages/
│   │   └── K8sPage.tsx             # ~50 lines
│   └── stores/
│       └── k8sStore.ts             # ~80 lines
└── Estimated Total: ~2,030 lines
```

## Environment Variables

```bash
# Existing
VITE_API_BASE_URL=http://orchestrator:8080/api
VITE_WS_URL=ws://orchestrator:8080/ws
VITE_USE_MOCKS=false

# New
VITE_K8S_METRICS_POLL_INTERVAL=30000     # Metrics polling (ms)
VITE_K8S_HEALTH_POLL_INTERVAL=10000      # Health polling (ms)
VITE_K8S_COMMAND_TIMEOUT=30000           # Command exec timeout (ms)
VITE_K8S_LOG_LINES_LIMIT=1000            # Max log lines to fetch
```

## Testing Strategy

### Unit Tests (Vitest)
- All component rendering and interactions
- Store actions and state updates
- API client functions
- Mock data validation

### Integration Tests
- Dashboard composition and data flow
- Command execution flow
- Pod detail drawer lifecycle
- WebSocket event handling

### E2E Tests (Playwright)
- Navigate to K8s dashboard
- View cluster health
- Filter pods by namespace
- Execute read-only command
- Open pod detail and view logs
- Run health check

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Backend K8s API not ready | Comprehensive mock data layer |
| Large pod counts (1000+) | Virtual scrolling, pagination |
| Command execution security | Strict whitelist, rate limiting |
| Metrics server unavailable | Graceful degradation, empty state |
| WebSocket disconnection | Polling fallback, reconnection |

## Open Questions

1. **Command Whitelist:** Should we allow `kubectl exec` for debugging?
   - Recommendation: No for MVP, add later with audit logging

2. **Log Streaming:** Should logs auto-scroll or pause on scroll up?
   - Recommendation: Auto-scroll with pause on user scroll

3. **Metrics Retention:** How long to show historical metrics?
   - Recommendation: 24 hours in UI, backend determines storage

4. **Multi-cluster:** Support multiple K8s clusters?
   - Recommendation: Out of scope for MVP, design for extensibility
