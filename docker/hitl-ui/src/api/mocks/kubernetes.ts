/**
 * Mock data for Kubernetes Visibility Dashboard
 * Used when VITE_USE_MOCKS=true
 */

import type {
  ClusterHealth,
  K8sNode,
  K8sPod,
  K8sService,
  K8sIngress,
  MetricsTimeSeries,
  MetricsDataPoint,
  CommandResponse,
  HealthCheckResult,
  HealthCheckType,
  K8sEvent,
} from '../types/kubernetes';

// ============================================================================
// Cluster Health Mock
// ============================================================================

export const mockClusterHealth: ClusterHealth = {
  status: 'healthy',
  nodesReady: 2,
  nodesTotal: 3,
  podsRunning: 15,
  podsTotal: 20,
  podsPending: 3,
  podsFailed: 2,
  cpuUsagePercent: 42,
  memoryUsagePercent: 58,
  lastUpdated: new Date().toISOString(),
};

// ============================================================================
// Nodes Mocks
// ============================================================================

export const mockNodes: K8sNode[] = [
  {
    name: 'node-1',
    status: 'Ready',
    roles: ['control-plane', 'master'],
    version: 'v1.28.4',
    os: 'linux',
    containerRuntime: 'containerd://1.7.2',
    capacity: {
      cpu: '4',
      memory: '16Gi',
      pods: 110,
    },
    allocatable: {
      cpu: '3800m',
      memory: '15Gi',
      pods: 110,
    },
    usage: {
      cpuPercent: 35,
      memoryPercent: 52,
      podsCount: 12,
    },
    conditions: [
      {
        type: 'Ready',
        status: 'True',
        reason: 'KubeletReady',
        message: 'kubelet is posting ready status',
        lastTransition: '2026-01-20T10:00:00Z',
      },
      {
        type: 'MemoryPressure',
        status: 'False',
        reason: 'KubeletHasSufficientMemory',
        message: 'kubelet has sufficient memory available',
        lastTransition: '2026-01-20T10:00:00Z',
      },
    ],
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    name: 'node-2',
    status: 'Ready',
    roles: ['worker'],
    version: 'v1.28.4',
    os: 'linux',
    containerRuntime: 'containerd://1.7.2',
    capacity: {
      cpu: '8',
      memory: '32Gi',
      pods: 110,
    },
    allocatable: {
      cpu: '7800m',
      memory: '31Gi',
      pods: 110,
    },
    usage: {
      cpuPercent: 68,
      memoryPercent: 71,
      podsCount: 25,
    },
    conditions: [
      {
        type: 'Ready',
        status: 'True',
        reason: 'KubeletReady',
        message: 'kubelet is posting ready status',
        lastTransition: '2026-01-20T10:00:00Z',
      },
    ],
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    name: 'node-3',
    status: 'NotReady',
    roles: ['worker'],
    version: 'v1.28.4',
    os: 'linux',
    containerRuntime: 'containerd://1.7.2',
    capacity: {
      cpu: '8',
      memory: '32Gi',
      pods: 110,
    },
    allocatable: {
      cpu: '7800m',
      memory: '31Gi',
      pods: 110,
    },
    usage: {
      cpuPercent: 0,
      memoryPercent: 0,
      podsCount: 0,
    },
    conditions: [
      {
        type: 'Ready',
        status: 'False',
        reason: 'KubeletNotReady',
        message: 'container runtime network not ready',
        lastTransition: '2026-01-25T08:30:00Z',
      },
    ],
    createdAt: '2026-01-01T00:00:00Z',
  },
];

// ============================================================================
// Pods Mocks
// ============================================================================

export const mockPods: K8sPod[] = [
  // dox-asdlc namespace
  {
    name: 'orchestrator-7d5f8b6c9-x2k4j',
    namespace: 'dox-asdlc',
    status: 'Running',
    phase: 'Running',
    nodeName: 'node-1',
    podIP: '10.244.0.15',
    hostIP: '192.168.1.10',
    containers: [
      {
        name: 'orchestrator',
        image: 'dox-asdlc/orchestrator:latest',
        ready: true,
        restartCount: 0,
        state: 'running',
      },
    ],
    restarts: 0,
    age: '5d',
    createdAt: '2026-01-20T10:00:00Z',
    labels: { app: 'orchestrator', tier: 'backend' },
    ownerKind: 'Deployment',
    ownerName: 'orchestrator',
  },
  {
    name: 'worker-pool-5b9c6d8f7-m3n2p',
    namespace: 'dox-asdlc',
    status: 'Running',
    phase: 'Running',
    nodeName: 'node-2',
    podIP: '10.244.1.22',
    hostIP: '192.168.1.11',
    containers: [
      {
        name: 'worker',
        image: 'dox-asdlc/worker:latest',
        ready: true,
        restartCount: 2,
        state: 'running',
      },
    ],
    restarts: 2,
    age: '5d',
    createdAt: '2026-01-20T10:00:00Z',
    labels: { app: 'worker-pool', tier: 'backend' },
    ownerKind: 'Deployment',
    ownerName: 'worker-pool',
  },
  {
    name: 'worker-pool-5b9c6d8f7-k9j8h',
    namespace: 'dox-asdlc',
    status: 'Running',
    phase: 'Running',
    nodeName: 'node-2',
    podIP: '10.244.1.23',
    hostIP: '192.168.1.11',
    containers: [
      {
        name: 'worker',
        image: 'dox-asdlc/worker:latest',
        ready: true,
        restartCount: 0,
        state: 'running',
      },
    ],
    restarts: 0,
    age: '5d',
    createdAt: '2026-01-20T10:00:00Z',
    labels: { app: 'worker-pool', tier: 'backend' },
    ownerKind: 'Deployment',
    ownerName: 'worker-pool',
  },
  {
    name: 'hitl-ui-6c7d8e9f0-p4q5r',
    namespace: 'dox-asdlc',
    status: 'Running',
    phase: 'Running',
    nodeName: 'node-1',
    podIP: '10.244.0.16',
    hostIP: '192.168.1.10',
    containers: [
      {
        name: 'hitl-ui',
        image: 'dox-asdlc/hitl-ui:latest',
        ready: true,
        restartCount: 0,
        state: 'running',
      },
    ],
    restarts: 0,
    age: '3d',
    createdAt: '2026-01-22T14:00:00Z',
    labels: { app: 'hitl-ui', tier: 'frontend' },
    ownerKind: 'Deployment',
    ownerName: 'hitl-ui',
  },
  {
    name: 'redis-0',
    namespace: 'dox-asdlc',
    status: 'Running',
    phase: 'Running',
    nodeName: 'node-1',
    podIP: '10.244.0.10',
    hostIP: '192.168.1.10',
    containers: [
      {
        name: 'redis',
        image: 'redis:7-alpine',
        ready: true,
        restartCount: 0,
        state: 'running',
      },
    ],
    restarts: 0,
    age: '10d',
    createdAt: '2026-01-15T08:00:00Z',
    labels: { app: 'redis', tier: 'data' },
    ownerKind: 'StatefulSet',
    ownerName: 'redis',
  },
  {
    name: 'chromadb-0',
    namespace: 'dox-asdlc',
    status: 'Running',
    phase: 'Running',
    nodeName: 'node-2',
    podIP: '10.244.1.11',
    hostIP: '192.168.1.11',
    containers: [
      {
        name: 'chromadb',
        image: 'chromadb/chroma:latest',
        ready: true,
        restartCount: 1,
        state: 'running',
      },
    ],
    restarts: 1,
    age: '10d',
    createdAt: '2026-01-15T08:00:00Z',
    labels: { app: 'chromadb', tier: 'data' },
    ownerKind: 'StatefulSet',
    ownerName: 'chromadb',
  },
  // Pending pod
  {
    name: 'worker-pool-5b9c6d8f7-pending',
    namespace: 'dox-asdlc',
    status: 'Pending',
    phase: 'Pending',
    nodeName: '',
    podIP: '',
    hostIP: '',
    containers: [
      {
        name: 'worker',
        image: 'dox-asdlc/worker:latest',
        ready: false,
        restartCount: 0,
        state: 'waiting',
        stateReason: 'ContainerCreating',
      },
    ],
    restarts: 0,
    age: '5m',
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    labels: { app: 'worker-pool', tier: 'backend' },
    ownerKind: 'Deployment',
    ownerName: 'worker-pool',
  },
  // kube-system namespace
  {
    name: 'coredns-5d78c9869d-abc12',
    namespace: 'kube-system',
    status: 'Running',
    phase: 'Running',
    nodeName: 'node-1',
    podIP: '10.244.0.5',
    hostIP: '192.168.1.10',
    containers: [
      {
        name: 'coredns',
        image: 'registry.k8s.io/coredns/coredns:v1.10.1',
        ready: true,
        restartCount: 0,
        state: 'running',
      },
    ],
    restarts: 0,
    age: '30d',
    createdAt: '2025-12-26T00:00:00Z',
    labels: { 'k8s-app': 'kube-dns' },
    ownerKind: 'Deployment',
    ownerName: 'coredns',
  },
  {
    name: 'kube-proxy-xyz89',
    namespace: 'kube-system',
    status: 'Running',
    phase: 'Running',
    nodeName: 'node-1',
    podIP: '192.168.1.10',
    hostIP: '192.168.1.10',
    containers: [
      {
        name: 'kube-proxy',
        image: 'registry.k8s.io/kube-proxy:v1.28.4',
        ready: true,
        restartCount: 0,
        state: 'running',
      },
    ],
    restarts: 0,
    age: '30d',
    createdAt: '2025-12-26T00:00:00Z',
    labels: { 'k8s-app': 'kube-proxy' },
    ownerKind: 'DaemonSet',
    ownerName: 'kube-proxy',
  },
  // Failed pod
  {
    name: 'migration-job-failed-x1y2z',
    namespace: 'dox-asdlc',
    status: 'Failed',
    phase: 'Failed',
    nodeName: 'node-2',
    podIP: '10.244.1.50',
    hostIP: '192.168.1.11',
    containers: [
      {
        name: 'migration',
        image: 'dox-asdlc/migration:latest',
        ready: false,
        restartCount: 3,
        state: 'terminated',
        stateReason: 'Error',
        lastState: {
          state: 'terminated',
          reason: 'Error',
          exitCode: 1,
          finishedAt: '2026-01-24T15:30:00Z',
        },
      },
    ],
    restarts: 3,
    age: '1d',
    createdAt: '2026-01-24T10:00:00Z',
    labels: { app: 'migration', type: 'job' },
    ownerKind: 'Job',
    ownerName: 'migration-job',
  },
  // monitoring namespace
  {
    name: 'prometheus-server-0',
    namespace: 'monitoring',
    status: 'Running',
    phase: 'Running',
    nodeName: 'node-2',
    podIP: '10.244.1.100',
    hostIP: '192.168.1.11',
    containers: [
      {
        name: 'prometheus',
        image: 'prom/prometheus:v2.47.0',
        ready: true,
        restartCount: 0,
        state: 'running',
      },
    ],
    restarts: 0,
    age: '15d',
    createdAt: '2026-01-10T00:00:00Z',
    labels: { app: 'prometheus' },
    ownerKind: 'StatefulSet',
    ownerName: 'prometheus-server',
  },
  {
    name: 'grafana-5f4d8c7b9-g1h2i',
    namespace: 'monitoring',
    status: 'Running',
    phase: 'Running',
    nodeName: 'node-2',
    podIP: '10.244.1.101',
    hostIP: '192.168.1.11',
    containers: [
      {
        name: 'grafana',
        image: 'grafana/grafana:10.2.0',
        ready: true,
        restartCount: 0,
        state: 'running',
      },
    ],
    restarts: 0,
    age: '15d',
    createdAt: '2026-01-10T00:00:00Z',
    labels: { app: 'grafana' },
    ownerKind: 'Deployment',
    ownerName: 'grafana',
  },
];

// ============================================================================
// Services Mocks
// ============================================================================

export const mockServices: K8sService[] = [
  {
    name: 'orchestrator',
    namespace: 'dox-asdlc',
    type: 'ClusterIP',
    clusterIP: '10.96.100.10',
    externalIPs: [],
    ports: [
      { name: 'http', protocol: 'TCP', port: 8080, targetPort: 8080 },
      { name: 'grpc', protocol: 'TCP', port: 9090, targetPort: 9090 },
    ],
    selector: { app: 'orchestrator' },
    createdAt: '2026-01-15T00:00:00Z',
  },
  {
    name: 'hitl-ui',
    namespace: 'dox-asdlc',
    type: 'NodePort',
    clusterIP: '10.96.100.20',
    externalIPs: [],
    ports: [
      { name: 'http', protocol: 'TCP', port: 80, targetPort: 3000, nodePort: 30080 },
    ],
    selector: { app: 'hitl-ui' },
    createdAt: '2026-01-15T00:00:00Z',
  },
  {
    name: 'redis',
    namespace: 'dox-asdlc',
    type: 'ClusterIP',
    clusterIP: '10.96.100.30',
    externalIPs: [],
    ports: [
      { name: 'redis', protocol: 'TCP', port: 6379, targetPort: 6379 },
    ],
    selector: { app: 'redis' },
    createdAt: '2026-01-15T00:00:00Z',
  },
  {
    name: 'chromadb',
    namespace: 'dox-asdlc',
    type: 'ClusterIP',
    clusterIP: '10.96.100.40',
    externalIPs: [],
    ports: [
      { name: 'http', protocol: 'TCP', port: 8000, targetPort: 8000 },
    ],
    selector: { app: 'chromadb' },
    createdAt: '2026-01-15T00:00:00Z',
  },
  {
    name: 'prometheus',
    namespace: 'monitoring',
    type: 'ClusterIP',
    clusterIP: '10.96.200.10',
    externalIPs: [],
    ports: [
      { name: 'web', protocol: 'TCP', port: 9090, targetPort: 9090 },
    ],
    selector: { app: 'prometheus' },
    createdAt: '2026-01-10T00:00:00Z',
  },
];

// ============================================================================
// Ingresses Mocks
// ============================================================================

export const mockIngresses: K8sIngress[] = [
  {
    name: 'hitl-ui-ingress',
    namespace: 'dox-asdlc',
    hosts: ['hitl.asdlc.local'],
    paths: [
      {
        host: 'hitl.asdlc.local',
        path: '/',
        serviceName: 'hitl-ui',
        servicePort: 80,
      },
    ],
    tls: true,
    createdAt: '2026-01-15T00:00:00Z',
  },
  {
    name: 'api-ingress',
    namespace: 'dox-asdlc',
    hosts: ['api.asdlc.local'],
    paths: [
      {
        host: 'api.asdlc.local',
        path: '/api',
        serviceName: 'orchestrator',
        servicePort: 8080,
      },
    ],
    tls: true,
    createdAt: '2026-01-15T00:00:00Z',
  },
];

// ============================================================================
// Namespaces Mock
// ============================================================================

export const mockNamespaces: string[] = [
  'default',
  'dox-asdlc',
  'kube-system',
  'kube-public',
  'monitoring',
];

// ============================================================================
// Metrics Mocks
// ============================================================================

function generateMetricsDataPoints(hours: number, interval: number): MetricsDataPoint[] {
  const points: MetricsDataPoint[] = [];
  const now = Date.now();
  const intervalMs = interval * 60 * 1000;
  const totalPoints = (hours * 60) / interval;

  for (let i = totalPoints; i >= 0; i--) {
    const timestamp = new Date(now - i * intervalMs).toISOString();
    // Generate realistic-looking metrics with some variance
    const baseCpu = 40 + Math.sin(i / 10) * 15;
    const baseMemory = 55 + Math.cos(i / 8) * 10;
    points.push({
      timestamp,
      cpuPercent: Math.max(5, Math.min(95, baseCpu + (Math.random() - 0.5) * 10)),
      memoryPercent: Math.max(20, Math.min(90, baseMemory + (Math.random() - 0.5) * 8)),
    });
  }

  return points;
}

export const mockClusterMetrics: MetricsTimeSeries = {
  resourceType: 'cluster',
  resourceName: 'cluster',
  dataPoints: generateMetricsDataPoints(24, 5), // 24 hours, 5-min intervals
  interval: '5m',
  startTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  endTime: new Date().toISOString(),
};

export function getMockMetricsHistory(interval: string): MetricsTimeSeries {
  const intervalMinutes = {
    '1m': 1,
    '5m': 5,
    '15m': 15,
    '1h': 60,
  }[interval] || 5;

  const hours = interval === '1h' ? 168 : 24; // 7 days for hourly, 24h for others

  return {
    resourceType: 'cluster',
    resourceName: 'cluster',
    dataPoints: generateMetricsDataPoints(hours, intervalMinutes),
    interval: interval as MetricsTimeSeries['interval'],
    startTime: new Date(Date.now() - hours * 60 * 60 * 1000).toISOString(),
    endTime: new Date().toISOString(),
  };
}

// ============================================================================
// Command Execution Mocks
// ============================================================================

export function getMockCommandResponse(command: string): CommandResponse {
  const startTime = Date.now();

  // Simulate different command outputs
  if (command.startsWith('kubectl get pods')) {
    return {
      success: true,
      output: `NAME                                    READY   STATUS    RESTARTS   AGE
orchestrator-7d5f8b6c9-x2k4j           1/1     Running   0          5d
worker-pool-5b9c6d8f7-m3n2p            1/1     Running   2          5d
worker-pool-5b9c6d8f7-k9j8h            1/1     Running   0          5d
hitl-ui-6c7d8e9f0-p4q5r                1/1     Running   0          3d
redis-0                                 1/1     Running   0          10d`,
      exitCode: 0,
      duration: Date.now() - startTime + 150,
    };
  }

  if (command.startsWith('kubectl get nodes')) {
    return {
      success: true,
      output: `NAME     STATUS     ROLES           AGE   VERSION
node-1   Ready      control-plane   25d   v1.28.4
node-2   Ready      worker          25d   v1.28.4
node-3   NotReady   worker          25d   v1.28.4`,
      exitCode: 0,
      duration: Date.now() - startTime + 120,
    };
  }

  if (command.startsWith('kubectl describe')) {
    return {
      success: true,
      output: `Name:         orchestrator-7d5f8b6c9-x2k4j
Namespace:    dox-asdlc
Priority:     0
Node:         node-1/192.168.1.10
Start Time:   Mon, 20 Jan 2026 10:00:00 +0000
Labels:       app=orchestrator
              pod-template-hash=7d5f8b6c9
Status:       Running
IP:           10.244.0.15
...`,
      exitCode: 0,
      duration: Date.now() - startTime + 200,
    };
  }

  if (command.startsWith('kubectl logs')) {
    return {
      success: true,
      output: `2026-01-25T10:00:00Z INFO  Starting orchestrator service...
2026-01-25T10:00:01Z INFO  Connected to Redis at redis:6379
2026-01-25T10:00:02Z INFO  Connected to ChromaDB at chromadb:8000
2026-01-25T10:00:03Z INFO  HTTP server listening on :8080
2026-01-25T10:00:03Z INFO  gRPC server listening on :9090
2026-01-25T10:05:00Z INFO  Processing task TASK-001
2026-01-25T10:05:15Z INFO  Task TASK-001 completed successfully`,
      exitCode: 0,
      duration: Date.now() - startTime + 180,
    };
  }

  if (command.startsWith('kubectl top')) {
    return {
      success: true,
      output: `NAME                                    CPU(cores)   MEMORY(bytes)
orchestrator-7d5f8b6c9-x2k4j           125m         256Mi
worker-pool-5b9c6d8f7-m3n2p            350m         512Mi
worker-pool-5b9c6d8f7-k9j8h            280m         480Mi
hitl-ui-6c7d8e9f0-p4q5r                45m          128Mi`,
      exitCode: 0,
      duration: Date.now() - startTime + 250,
    };
  }

  if (command.startsWith('docker ps')) {
    return {
      success: true,
      output: `CONTAINER ID   IMAGE                    STATUS         NAMES
abc123def456   dox-asdlc/orchestrator   Up 5 days      orchestrator
def456abc789   dox-asdlc/worker         Up 5 days      worker-1
789abc123def   dox-asdlc/hitl-ui        Up 3 days      hitl-ui`,
      exitCode: 0,
      duration: Date.now() - startTime + 100,
    };
  }

  // Default: command not recognized
  return {
    success: false,
    output: '',
    error: `Command not allowed or not recognized: ${command}`,
    exitCode: 1,
    duration: Date.now() - startTime + 50,
  };
}

// ============================================================================
// Health Check Mocks
// ============================================================================

export const mockHealthCheckResults: Record<HealthCheckType, HealthCheckResult> = {
  dns: {
    type: 'dns',
    status: 'pass',
    message: 'DNS resolution working correctly',
    details: { resolved: 'kubernetes.default.svc.cluster.local', ip: '10.96.0.1' },
    duration: 45,
    timestamp: new Date().toISOString(),
  },
  connectivity: {
    type: 'connectivity',
    status: 'pass',
    message: 'Pod-to-pod connectivity verified',
    details: { tested_pods: 5, successful: 5 },
    duration: 230,
    timestamp: new Date().toISOString(),
  },
  storage: {
    type: 'storage',
    status: 'pass',
    message: 'All PVCs bound and healthy',
    details: { total_pvcs: 3, bound: 3, pending: 0 },
    duration: 120,
    timestamp: new Date().toISOString(),
  },
  'api-server': {
    type: 'api-server',
    status: 'pass',
    message: 'API server responding normally',
    details: { latency_ms: 12, version: 'v1.28.4' },
    duration: 35,
    timestamp: new Date().toISOString(),
  },
  etcd: {
    type: 'etcd',
    status: 'pass',
    message: 'etcd cluster healthy',
    details: { members: 1, leader: 'node-1' },
    duration: 88,
    timestamp: new Date().toISOString(),
  },
  scheduler: {
    type: 'scheduler',
    status: 'warning',
    message: 'Scheduler running with elevated pending queue',
    details: { pending_pods: 3, scheduling_latency_ms: 450 },
    duration: 65,
    timestamp: new Date().toISOString(),
  },
  controller: {
    type: 'controller',
    status: 'pass',
    message: 'Controller manager operating normally',
    details: { reconciliation_rate: '15/s' },
    duration: 42,
    timestamp: new Date().toISOString(),
  },
};

export function getMockHealthCheckResult(type: HealthCheckType): HealthCheckResult {
  return {
    ...mockHealthCheckResults[type],
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// K8s Events Mock
// ============================================================================

export const mockK8sEvents: K8sEvent[] = [
  {
    type: 'ADDED',
    object: {
      kind: 'Pod',
      name: 'worker-pool-5b9c6d8f7-new',
      namespace: 'dox-asdlc',
      reason: 'Scheduled',
      message: 'Successfully assigned dox-asdlc/worker-pool-5b9c6d8f7-new to node-2',
      timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    },
  },
  {
    type: 'MODIFIED',
    object: {
      kind: 'Pod',
      name: 'worker-pool-5b9c6d8f7-m3n2p',
      namespace: 'dox-asdlc',
      reason: 'Started',
      message: 'Started container worker',
      timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    },
  },
  {
    type: 'MODIFIED',
    object: {
      kind: 'Node',
      name: 'node-3',
      reason: 'NodeNotReady',
      message: 'Node node-3 status is now: NodeNotReady',
      timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    },
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

export function filterPods(
  namespace?: string,
  status?: string,
  nodeName?: string,
  search?: string
): K8sPod[] {
  return mockPods.filter((pod) => {
    if (namespace && pod.namespace !== namespace) return false;
    if (status && pod.status !== status) return false;
    if (nodeName && pod.nodeName !== nodeName) return false;
    if (search && !pod.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
}

export function getNodeByName(name: string): K8sNode | undefined {
  return mockNodes.find((node) => node.name === name);
}

export function getPodByName(namespace: string, name: string): K8sPod | undefined {
  return mockPods.find((pod) => pod.namespace === namespace && pod.name === name);
}
