/**
 * Kubernetes API client functions for K8s Visibility Dashboard
 * Handles cluster health, nodes, pods, services, metrics, and commands
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import {
  mockClusterHealth,
  mockNodes,
  mockServices,
  mockIngresses,
  mockNamespaces,
  getMockMetricsHistory,
  getMockCommandResponse,
  getMockHealthCheckResult,
  filterPods,
  getNodeByName,
  getPodByName,
} from './mocks/index';

// Check if mocks are enabled (not a hook, just a helper)
const isMocksEnabled = () => import.meta.env.VITE_USE_MOCKS === 'true';
import type {
  ClusterHealth,
  K8sNode,
  K8sPod,
  K8sService,
  K8sIngress,
  MetricsTimeSeries,
  MetricsInterval,
  CommandRequest,
  CommandResponse,
  HealthCheckType,
  HealthCheckResult,
  K8sNodesResponse,
  K8sPodsResponse,
  K8sPodsQueryParams,
  K8sServicesResponse,
  K8sIngressesResponse,
  K8sNamespacesResponse,
} from './types/kubernetes';

// ============================================================================
// Query Keys
// ============================================================================

export const k8sQueryKeys = {
  clusterHealth: ['k8s', 'cluster', 'health'] as const,
  namespaces: ['k8s', 'namespaces'] as const,
  nodes: ['k8s', 'nodes'] as const,
  node: (name: string) => ['k8s', 'nodes', name] as const,
  pods: (params?: K8sPodsQueryParams) => ['k8s', 'pods', params] as const,
  pod: (namespace: string, name: string) => ['k8s', 'pods', namespace, name] as const,
  podLogs: (namespace: string, name: string, container?: string) =>
    ['k8s', 'pods', namespace, name, 'logs', container] as const,
  services: (namespace?: string) => ['k8s', 'services', { namespace }] as const,
  ingresses: (namespace?: string) => ['k8s', 'ingresses', { namespace }] as const,
  metricsHistory: (interval: MetricsInterval) => ['k8s', 'metrics', 'history', interval] as const,
  healthChecks: ['k8s', 'health-checks'] as const,
};

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get cluster-wide health summary
 */
export async function getClusterHealth(): Promise<ClusterHealth> {
  if (isMocksEnabled()) {
    return mockClusterHealth;
  }
  const response = await apiClient.get<ClusterHealth>('/k8s/cluster/health');
  return response.data;
}

/**
 * Get list of namespaces
 */
export async function getNamespaces(): Promise<string[]> {
  if (isMocksEnabled()) {
    return mockNamespaces;
  }
  const response = await apiClient.get<K8sNamespacesResponse>('/k8s/namespaces');
  return response.data.namespaces;
}

/**
 * Get all nodes with status and capacity
 */
export async function getNodes(): Promise<K8sNode[]> {
  if (isMocksEnabled()) {
    return mockNodes;
  }
  const response = await apiClient.get<K8sNodesResponse>('/k8s/nodes');
  return response.data.nodes;
}

/**
 * Get node details by name
 */
export async function getNode(name: string): Promise<K8sNode | null> {
  if (isMocksEnabled()) {
    return getNodeByName(name) || null;
  }
  const response = await apiClient.get<K8sNode>(`/k8s/nodes/${name}`);
  return response.data;
}

/**
 * Get pods with optional filters
 */
export async function getPods(params?: K8sPodsQueryParams): Promise<K8sPod[]> {
  if (isMocksEnabled()) {
    return filterPods(params?.namespace, params?.status, params?.nodeName, params?.search);
  }
  const response = await apiClient.get<K8sPodsResponse>('/k8s/pods', { params });
  return response.data.pods;
}

/**
 * Get pod details by namespace and name
 */
export async function getPod(namespace: string, name: string): Promise<K8sPod | null> {
  if (isMocksEnabled()) {
    return getPodByName(namespace, name) || null;
  }
  const response = await apiClient.get<K8sPod>(`/k8s/pods/${namespace}/${name}`);
  return response.data;
}

/**
 * Get pod logs
 */
export async function getPodLogs(
  namespace: string,
  name: string,
  container?: string,
  tailLines: number = 100
): Promise<string> {
  if (isMocksEnabled()) {
    return `[Mock logs for ${namespace}/${name}${container ? `/${container}` : ''}]
2026-01-25T10:00:00Z INFO  Container started
2026-01-25T10:00:01Z INFO  Initializing service...
2026-01-25T10:00:02Z INFO  Connected to dependencies
2026-01-25T10:00:03Z INFO  Service ready
2026-01-25T10:05:00Z INFO  Processing request
2026-01-25T10:05:01Z DEBUG Request processed in 45ms`;
  }
  const params = { container, tailLines };
  const response = await apiClient.get<string>(`/k8s/pods/${namespace}/${name}/logs`, { params });
  return response.data;
}

/**
 * Get services with optional namespace filter
 */
export async function getServices(namespace?: string): Promise<K8sService[]> {
  if (isMocksEnabled()) {
    if (namespace) {
      return mockServices.filter((s) => s.namespace === namespace);
    }
    return mockServices;
  }
  const params = namespace ? { namespace } : undefined;
  const response = await apiClient.get<K8sServicesResponse>('/k8s/services', { params });
  return response.data.services;
}

/**
 * Get ingresses with optional namespace filter
 */
export async function getIngresses(namespace?: string): Promise<K8sIngress[]> {
  if (isMocksEnabled()) {
    if (namespace) {
      return mockIngresses.filter((i) => i.namespace === namespace);
    }
    return mockIngresses;
  }
  const params = namespace ? { namespace } : undefined;
  const response = await apiClient.get<K8sIngressesResponse>('/k8s/ingresses', { params });
  return response.data.ingresses;
}

/**
 * Get metrics history time series
 */
export async function getMetricsHistory(interval: MetricsInterval): Promise<MetricsTimeSeries> {
  if (isMocksEnabled()) {
    return getMockMetricsHistory(interval);
  }
  const response = await apiClient.get<MetricsTimeSeries>('/k8s/metrics/history', {
    params: { interval },
  });
  return response.data;
}

/**
 * Execute a kubectl/docker command (read-only)
 */
export async function executeCommand(request: CommandRequest): Promise<CommandResponse> {
  if (isMocksEnabled()) {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 300));
    return getMockCommandResponse(request.command);
  }
  const response = await apiClient.post<CommandResponse>('/k8s/exec', request);
  return response.data;
}

/**
 * Run a specific health check
 */
export async function runHealthCheck(type: HealthCheckType): Promise<HealthCheckResult> {
  if (isMocksEnabled()) {
    // Simulate check duration
    await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 400));
    return getMockHealthCheckResult(type);
  }
  const response = await apiClient.get<HealthCheckResult>(`/k8s/health-check/${type}`);
  return response.data;
}

// ============================================================================
// React Query Hooks
// ============================================================================

/**
 * Hook to fetch cluster health with auto-refresh
 */
export function useClusterHealth(refetchInterval = 10000) {
  return useQuery({
    queryKey: k8sQueryKeys.clusterHealth,
    queryFn: getClusterHealth,
    refetchInterval,
    staleTime: 5000,
  });
}

/**
 * Hook to fetch namespaces
 */
export function useNamespaces() {
  return useQuery({
    queryKey: k8sQueryKeys.namespaces,
    queryFn: getNamespaces,
    staleTime: 60000, // Namespaces change infrequently
  });
}

/**
 * Hook to fetch nodes with auto-refresh
 */
export function useNodes(refetchInterval = 15000) {
  return useQuery({
    queryKey: k8sQueryKeys.nodes,
    queryFn: getNodes,
    refetchInterval,
    staleTime: 10000,
  });
}

/**
 * Hook to fetch a specific node
 */
export function useNode(name: string) {
  return useQuery({
    queryKey: k8sQueryKeys.node(name),
    queryFn: () => getNode(name),
    enabled: !!name,
  });
}

/**
 * Hook to fetch pods with filters and auto-refresh
 */
export function usePods(params?: K8sPodsQueryParams, refetchInterval = 15000) {
  return useQuery({
    queryKey: k8sQueryKeys.pods(params),
    queryFn: () => getPods(params),
    refetchInterval,
    staleTime: 10000,
  });
}

/**
 * Hook to fetch a specific pod
 */
export function usePod(namespace: string, name: string) {
  return useQuery({
    queryKey: k8sQueryKeys.pod(namespace, name),
    queryFn: () => getPod(namespace, name),
    enabled: !!namespace && !!name,
  });
}

/**
 * Hook to fetch pod logs
 */
export function usePodLogs(
  namespace: string,
  name: string,
  container?: string,
  tailLines = 100
) {
  return useQuery({
    queryKey: k8sQueryKeys.podLogs(namespace, name, container),
    queryFn: () => getPodLogs(namespace, name, container, tailLines),
    enabled: !!namespace && !!name,
    refetchInterval: 5000, // Refresh logs frequently
  });
}

/**
 * Hook to fetch services
 */
export function useServices(namespace?: string) {
  return useQuery({
    queryKey: k8sQueryKeys.services(namespace),
    queryFn: () => getServices(namespace),
    staleTime: 30000,
  });
}

/**
 * Hook to fetch ingresses
 */
export function useIngresses(namespace?: string) {
  return useQuery({
    queryKey: k8sQueryKeys.ingresses(namespace),
    queryFn: () => getIngresses(namespace),
    staleTime: 30000,
  });
}

/**
 * Hook to fetch metrics history with auto-refresh
 */
export function useMetricsHistory(interval: MetricsInterval, refetchInterval = 30000) {
  return useQuery({
    queryKey: k8sQueryKeys.metricsHistory(interval),
    queryFn: () => getMetricsHistory(interval),
    refetchInterval,
    staleTime: 15000,
  });
}

/**
 * Hook to execute a command
 */
export function useExecuteCommand() {
  return useMutation({
    mutationFn: executeCommand,
    // For read-only commands, no need to invalidate queries
  });
}

/**
 * Hook to run a health check
 */
export function useRunHealthCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: runHealthCheck,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: k8sQueryKeys.healthChecks });
    },
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a command is in the allowed whitelist (client-side UX only)
 * NOTE: Server-side validation is mandatory for security
 */
export function isCommandAllowed(command: string): boolean {
  const allowedPrefixes = [
    'kubectl get',
    'kubectl describe',
    'kubectl logs',
    'kubectl top',
    'docker ps',
    'docker logs',
    'docker stats',
  ];

  const trimmedCommand = command.trim().toLowerCase();
  return allowedPrefixes.some((prefix) => trimmedCommand.startsWith(prefix.toLowerCase()));
}

/**
 * Get a user-friendly error message for command validation
 */
export function getCommandValidationError(command: string): string | null {
  if (!command.trim()) {
    return 'Please enter a command';
  }

  if (!isCommandAllowed(command)) {
    return 'Only read-only commands are allowed (kubectl get/describe/logs/top, docker ps/logs/stats)';
  }

  return null;
}
