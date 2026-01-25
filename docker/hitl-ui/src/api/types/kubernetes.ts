/**
 * Kubernetes TypeScript interfaces for K8s Visibility Dashboard
 * @see .workitems/P05-F09-k8s-visibility-dashboard/design.md
 */

// ============================================================================
// Cluster Health
// ============================================================================

export type ClusterHealthStatus = 'healthy' | 'degraded' | 'critical';

export interface ClusterHealth {
  status: ClusterHealthStatus;
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

// ============================================================================
// Node Types
// ============================================================================

export type NodeStatus = 'Ready' | 'NotReady' | 'Unknown';
export type ConditionStatus = 'True' | 'False' | 'Unknown';

export interface NodeCondition {
  type: string;
  status: ConditionStatus;
  reason: string;
  message: string;
  lastTransition: string;
}

export interface NodeCapacity {
  cpu: string;
  memory: string;
  pods: number;
}

export interface NodeUsage {
  cpuPercent: number;
  memoryPercent: number;
  podsCount: number;
}

export interface K8sNode {
  name: string;
  status: NodeStatus;
  roles: string[];
  version: string;
  os: string;
  containerRuntime: string;
  capacity: NodeCapacity;
  allocatable: NodeCapacity;
  usage: NodeUsage;
  conditions: NodeCondition[];
  createdAt: string;
}

// ============================================================================
// Pod Types
// ============================================================================

export type PodStatus = 'Running' | 'Pending' | 'Succeeded' | 'Failed' | 'Unknown';
export type ContainerStateType = 'running' | 'waiting' | 'terminated';

export interface ContainerState {
  state: ContainerStateType;
  reason?: string;
  exitCode?: number;
  startedAt?: string;
  finishedAt?: string;
}

export interface Container {
  name: string;
  image: string;
  ready: boolean;
  restartCount: number;
  state: ContainerStateType;
  stateReason?: string;
  lastState?: ContainerState;
}

export interface K8sPod {
  name: string;
  namespace: string;
  status: PodStatus;
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

// ============================================================================
// Service Types
// ============================================================================

export type ServiceType = 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'ExternalName';
export type PortProtocol = 'TCP' | 'UDP';

export interface ServicePort {
  name: string;
  protocol: PortProtocol;
  port: number;
  targetPort: number;
  nodePort?: number;
}

export interface K8sService {
  name: string;
  namespace: string;
  type: ServiceType;
  clusterIP: string;
  externalIPs: string[];
  ports: ServicePort[];
  selector: Record<string, string>;
  createdAt: string;
}

// ============================================================================
// Ingress Types
// ============================================================================

export interface IngressPath {
  host: string;
  path: string;
  serviceName: string;
  servicePort: number;
}

export interface K8sIngress {
  name: string;
  namespace: string;
  hosts: string[];
  paths: IngressPath[];
  tls: boolean;
  createdAt: string;
}

// ============================================================================
// Metrics Types
// ============================================================================

export interface MetricsDataPoint {
  timestamp: string;
  cpuPercent: number;
  memoryPercent: number;
}

export type MetricsResourceType = 'cluster' | 'node' | 'pod';
export type MetricsInterval = '1m' | '5m' | '15m' | '1h';

export interface MetricsTimeSeries {
  resourceType: MetricsResourceType;
  resourceName: string;
  dataPoints: MetricsDataPoint[];
  interval: MetricsInterval;
  startTime: string;
  endTime: string;
}

// ============================================================================
// Command Execution Types
// ============================================================================

export interface CommandRequest {
  command: string;
  namespace?: string;
  timeout?: number;
}

export interface CommandResponse {
  success: boolean;
  output: string;
  error?: string;
  exitCode: number;
  duration: number;
}

// ============================================================================
// Health Check Types
// ============================================================================

export type HealthCheckType =
  | 'dns'
  | 'connectivity'
  | 'storage'
  | 'api-server'
  | 'etcd'
  | 'scheduler'
  | 'controller';

export type HealthCheckStatus = 'pass' | 'fail' | 'warning' | 'pending';

export interface HealthCheckResult {
  type: HealthCheckType;
  status: HealthCheckStatus;
  message: string;
  details?: Record<string, unknown>;
  duration: number;
  timestamp: string;
}

// ============================================================================
// K8s Event Types (WebSocket)
// ============================================================================

export type K8sEventType = 'ADDED' | 'MODIFIED' | 'DELETED';
export type K8sObjectKind = 'Pod' | 'Node' | 'Service' | 'Deployment';

export interface K8sEventObject {
  kind: K8sObjectKind;
  name: string;
  namespace?: string;
  reason: string;
  message: string;
  timestamp: string;
  count?: number;
}

export interface K8sEvent {
  type: K8sEventType;
  object: K8sEventObject;
}

// ============================================================================
// Command Whitelist (Client-side UX feedback only)
// ============================================================================

export const ALLOWED_COMMAND_PREFIXES = [
  'kubectl get',
  'kubectl describe',
  'kubectl logs',
  'kubectl top',
  'docker ps',
  'docker logs',
  'docker stats',
] as const;

export type AllowedCommandPrefix = typeof ALLOWED_COMMAND_PREFIXES[number];

// ============================================================================
// API Query Parameters
// ============================================================================

export interface K8sPodsQueryParams {
  namespace?: string;
  status?: PodStatus;
  nodeName?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface K8sMetricsQueryParams {
  resourceType: MetricsResourceType;
  resourceName?: string;
  interval: MetricsInterval;
  startTime?: string;
  endTime?: string;
}

// ============================================================================
// API Response Wrappers
// ============================================================================

export interface K8sNodesResponse {
  nodes: K8sNode[];
  total: number;
}

export interface K8sPodsResponse {
  pods: K8sPod[];
  total: number;
}

export interface K8sServicesResponse {
  services: K8sService[];
  total: number;
}

export interface K8sIngressesResponse {
  ingresses: K8sIngress[];
  total: number;
}

export interface K8sNamespacesResponse {
  namespaces: string[];
}

// ============================================================================
// Helper Labels
// ============================================================================

export const healthCheckTypeLabels: Record<HealthCheckType, string> = {
  dns: 'DNS Resolution',
  connectivity: 'Pod Connectivity',
  storage: 'Storage (PV/PVC)',
  'api-server': 'API Server',
  etcd: 'etcd Cluster',
  scheduler: 'Scheduler',
  controller: 'Controller Manager',
};

export const podStatusLabels: Record<PodStatus, string> = {
  Running: 'Running',
  Pending: 'Pending',
  Succeeded: 'Succeeded',
  Failed: 'Failed',
  Unknown: 'Unknown',
};

export const nodeStatusLabels: Record<NodeStatus, string> = {
  Ready: 'Ready',
  NotReady: 'Not Ready',
  Unknown: 'Unknown',
};

export const clusterHealthStatusLabels: Record<ClusterHealthStatus, string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  critical: 'Critical',
};
