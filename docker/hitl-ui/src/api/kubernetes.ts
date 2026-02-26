/**
 * Kubernetes API client functions for K8s Visibility Dashboard (P06-F07)
 *
 * This module provides API functions and React Query hooks for:
 * - Cluster health monitoring
 * - Node status and metrics
 * - Pod listing with filtering and pagination
 * - Services, ingresses, and namespaces
 * - Metrics history
 * - Command execution (read-only)
 * - Health checks
 *
 * Includes mock data fallback for development mode when K8s API is unavailable.
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
import type {
  ClusterHealth,
  ClusterHealthStatus,
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
// Configuration
// ============================================================================

/** Auto-refresh interval for cluster health (30 seconds as per T20) */
const CLUSTER_HEALTH_REFRESH_INTERVAL = 30000;

/** Auto-refresh interval for nodes (30 seconds as per T22) */
const NODES_REFRESH_INTERVAL = 30000;

/** Auto-refresh interval for pods (30 seconds as per T23) */
const PODS_REFRESH_INTERVAL = 30000;

/** Stale time for K8s queries (15 seconds) */
const K8S_STALE_TIME = 15000;

/**
 * Check if mock data should be used.
 * Uses mocks when VITE_USE_MOCKS=true or in development mode.
 */
function shouldUseMocks(): boolean {
  return import.meta.env.VITE_USE_MOCKS === 'true';
}

// ============================================================================
// Query Keys (exported for cache invalidation)
// ============================================================================

export const k8sQueryKeys = {
  /** Key for all K8s queries (for bulk invalidation) */
  all: () => ['k8s'] as const,
  /** Key for cluster health query */
  clusterHealth: () => ['k8s', 'health'] as const,
  /** Key for namespaces query */
  namespaces: () => ['k8s', 'namespaces'] as const,
  /** Key for nodes list query */
  nodes: () => ['k8s', 'nodes'] as const,
  /** Key for single node query */
  node: (name: string) => ['k8s', 'nodes', name] as const,
  /** Key for pods list query (with optional params) */
  pods: (params?: K8sPodsQueryParams) => ['k8s', 'pods', params] as const,
  /** Key for single pod query */
  pod: (namespace: string, name: string) => ['k8s', 'pods', namespace, name] as const,
  /** Key for pod logs query */
  podLogs: (namespace: string, name: string, container?: string) =>
    ['k8s', 'pods', namespace, name, 'logs', container] as const,
  /** Key for services list query */
  services: (namespace?: string) => ['k8s', 'services', { namespace }] as const,
  /** Key for ingresses list query */
  ingresses: (namespace?: string) => ['k8s', 'ingresses', { namespace }] as const,
  /** Key for metrics history query */
  metricsHistory: (interval: MetricsInterval) => ['k8s', 'metrics', 'history', interval] as const,
  /** Key for health checks query */
  healthChecks: () => ['k8s', 'health-checks'] as const,
};

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get cluster-wide health summary.
 *
 * Fetches from /api/k8s/health (matches backend route from T11).
 * Falls back to mock data if API is unavailable or mocks are enabled.
 */
export async function getClusterHealth(): Promise<ClusterHealth> {
  // Use mock data in development or when VITE_USE_MOCKS is enabled
  if (shouldUseMocks()) {
    // Simulate network delay for realistic behavior
    await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 100));
    return { ...mockClusterHealth, lastUpdated: new Date().toISOString() };
  }

  try {
    // Backend endpoint: GET /api/k8s/health (T11)
    const response = await apiClient.get<{ health: ClusterHealth; mock_mode: boolean }>('/k8s/health');
    return response.data.health;
  } catch (error) {
    console.error('K8s health API unavailable:', error);
    return {
      ...mockClusterHealth,
      status: 'degraded' as ClusterHealthStatus,
      lastUpdated: new Date().toISOString(),
    };
  }
}

/**
 * Get list of namespaces.
 *
 * Falls back to mock data if API is unavailable.
 */
export async function getNamespaces(): Promise<string[]> {
  if (shouldUseMocks()) {
    await new Promise((resolve) => setTimeout(resolve, 30 + Math.random() * 50));
    return mockNamespaces;
  }

  try {
    const response = await apiClient.get<K8sNamespacesResponse>('/k8s/namespaces');
    return response.data.namespaces;
  } catch (error) {
    console.error('K8s namespaces API unavailable:', error);
    throw error;
  }
}

/**
 * Get all nodes with status and capacity.
 *
 * Fetches from /api/k8s/nodes (matches backend route from T11).
 * Falls back to mock data if API is unavailable or mocks are enabled.
 */
export async function getNodes(): Promise<K8sNode[]> {
  if (shouldUseMocks()) {
    await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 100));
    return mockNodes;
  }

  try {
    // Backend endpoint: GET /api/k8s/nodes (T11)
    const response = await apiClient.get<K8sNodesResponse>('/k8s/nodes');
    return response.data.nodes;
  } catch (error) {
    console.error('K8s nodes API unavailable:', error);
    throw error;
  }
}

/**
 * Get node details by name.
 *
 * Falls back to mock data if API is unavailable.
 */
export async function getNode(name: string): Promise<K8sNode | null> {
  if (shouldUseMocks()) {
    await new Promise((resolve) => setTimeout(resolve, 30 + Math.random() * 50));
    return getNodeByName(name) || null;
  }

  try {
    const response = await apiClient.get<K8sNode>(`/k8s/nodes/${name}`);
    return response.data;
  } catch (error) {
    console.error(`K8s node ${name} API unavailable:`, error);
    throw error;
  }
}

/**
 * Pods response type for the enhanced getPods function
 */
export interface PodsResult {
  pods: K8sPod[];
  total: number;
}

/**
 * Get pods with optional filters.
 *
 * Fetches from /api/k8s/pods (matches backend route from T11).
 * Supports filtering by namespace, status, nodeName, search, and pagination (limit, offset).
 * Falls back to mock data if API is unavailable or mocks are enabled.
 *
 * @param params - Query parameters for filtering and pagination
 * @returns Array of pods (for backward compatibility) or PodsResult with total count
 */
export async function getPods(params?: K8sPodsQueryParams): Promise<K8sPod[]> {
  if (shouldUseMocks()) {
    await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 100));
    const filtered = filterPods(params?.namespace, params?.status, params?.nodeName, params?.search);
    // Apply pagination if specified
    if (params?.limit !== undefined || params?.offset !== undefined) {
      const offset = params?.offset ?? 0;
      const limit = params?.limit ?? 50;
      return filtered.slice(offset, offset + limit);
    }
    return filtered;
  }

  try {
    // Backend endpoint: GET /api/k8s/pods (T11)
    const response = await apiClient.get<K8sPodsResponse>('/k8s/pods', { params });
    return response.data.pods;
  } catch (error) {
    console.error('K8s pods API unavailable:', error);
    throw error;
  }
}

/**
 * Get pods with total count for pagination.
 *
 * Similar to getPods but returns both pods and total count.
 *
 * @param params - Query parameters for filtering and pagination
 * @returns Object with pods array and total count
 */
export async function getPodsWithTotal(params?: K8sPodsQueryParams): Promise<PodsResult> {
  if (shouldUseMocks()) {
    await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 100));
    const allFiltered = filterPods(params?.namespace, params?.status, params?.nodeName, params?.search);
    const offset = params?.offset ?? 0;
    const limit = params?.limit ?? 50;
    return {
      pods: allFiltered.slice(offset, offset + limit),
      total: allFiltered.length,
    };
  }

  try {
    const response = await apiClient.get<K8sPodsResponse>('/k8s/pods', { params });
    return {
      pods: response.data.pods,
      total: response.data.total,
    };
  } catch (error) {
    console.error('K8s pods API unavailable:', error);
    throw error;
  }
}

/**
 * Get pod details by namespace and name.
 *
 * Falls back to mock data if API is unavailable.
 */
export async function getPod(namespace: string, name: string): Promise<K8sPod | null> {
  if (shouldUseMocks()) {
    await new Promise((resolve) => setTimeout(resolve, 30 + Math.random() * 50));
    return getPodByName(namespace, name) || null;
  }

  try {
    const response = await apiClient.get<K8sPod>(`/k8s/pods/${namespace}/${name}`);
    return response.data;
  } catch (error) {
    console.error(`K8s pod ${namespace}/${name} API unavailable:`, error);
    throw error;
  }
}

/**
 * Get pod logs.
 *
 * Falls back to mock logs if API is unavailable.
 */
export async function getPodLogs(
  namespace: string,
  name: string,
  container?: string,
  tailLines: number = 100
): Promise<string> {
  if (shouldUseMocks()) {
    await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 100));
    return `[Mock logs for ${namespace}/${name}${container ? `/${container}` : ''}]
2026-01-25T10:00:00Z INFO  Container started
2026-01-25T10:00:01Z INFO  Initializing service...
2026-01-25T10:00:02Z INFO  Connected to dependencies
2026-01-25T10:00:03Z INFO  Service ready
2026-01-25T10:05:00Z INFO  Processing request
2026-01-25T10:05:01Z DEBUG Request processed in 45ms`;
  }

  try {
    const params = { container, tailLines };
    const response = await apiClient.get<string>(`/k8s/pods/${namespace}/${name}/logs`, { params });
    return response.data;
  } catch (error) {
    console.error('K8s pod logs API unavailable:', error);
    throw error;
  }
}

/**
 * Get services with optional namespace filter.
 *
 * Falls back to mock data if API is unavailable.
 */
export async function getServices(namespace?: string): Promise<K8sService[]> {
  if (shouldUseMocks()) {
    await new Promise((resolve) => setTimeout(resolve, 30 + Math.random() * 50));
    if (namespace) {
      return mockServices.filter((s) => s.namespace === namespace);
    }
    return mockServices;
  }

  try {
    const params = namespace ? { namespace } : undefined;
    const response = await apiClient.get<K8sServicesResponse>('/k8s/services', { params });
    return response.data.services;
  } catch (error) {
    console.error('K8s services API unavailable:', error);
    throw error;
  }
}

/**
 * Get ingresses with optional namespace filter.
 *
 * Falls back to mock data if API is unavailable.
 */
export async function getIngresses(namespace?: string): Promise<K8sIngress[]> {
  if (shouldUseMocks()) {
    await new Promise((resolve) => setTimeout(resolve, 30 + Math.random() * 50));
    if (namespace) {
      return mockIngresses.filter((i) => i.namespace === namespace);
    }
    return mockIngresses;
  }

  try {
    const params = namespace ? { namespace } : undefined;
    const response = await apiClient.get<K8sIngressesResponse>('/k8s/ingresses', { params });
    return response.data.ingresses;
  } catch (error) {
    console.error('K8s ingresses API unavailable:', error);
    throw error;
  }
}

/**
 * Get metrics history time series.
 *
 * Falls back to mock data if API is unavailable.
 */
export async function getMetricsHistory(interval: MetricsInterval): Promise<MetricsTimeSeries> {
  if (shouldUseMocks()) {
    await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 100));
    return getMockMetricsHistory(interval);
  }

  try {
    const response = await apiClient.get<MetricsTimeSeries>('/k8s/metrics/history', {
      params: { interval },
    });
    return response.data;
  } catch (error) {
    console.error('K8s metrics API unavailable:', error);
    throw error;
  }
}

/**
 * Execute a kubectl/docker command (read-only).
 *
 * Falls back to mock command responses if API is unavailable.
 */
export async function executeCommand(request: CommandRequest): Promise<CommandResponse> {
  if (shouldUseMocks()) {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 300));
    return getMockCommandResponse(request.command);
  }

  try {
    const response = await apiClient.post<CommandResponse>('/k8s/exec', request);
    return response.data;
  } catch (error) {
    console.error('K8s exec API unavailable:', error);
    throw error;
  }
}

/**
 * Run a specific health check.
 *
 * Falls back to mock health check results if API is unavailable.
 */
export async function runHealthCheck(type: HealthCheckType): Promise<HealthCheckResult> {
  if (shouldUseMocks()) {
    // Simulate check duration
    await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 400));
    return getMockHealthCheckResult(type);
  }

  try {
    const response = await apiClient.get<HealthCheckResult>(`/k8s/health-check/${type}`);
    return response.data;
  } catch (error) {
    console.error(`K8s health check ${type} API unavailable:`, error);
    return {
      type,
      status: 'fail' as HealthCheckResult['status'],
      message: 'Health check endpoint unavailable',
      duration: 0,
      timestamp: new Date().toISOString(),
    };
  }
}

// ============================================================================
// React Query Hooks
// ============================================================================

export interface UseK8sQueryOptions {
  /** Enable auto-refresh (default: true) */
  enabled?: boolean;
  /** Custom refresh interval in ms (overrides default) */
  refetchInterval?: number;
}

/**
 * Hook to fetch cluster health with 30s auto-refresh (T20).
 *
 * @param options - Optional configuration for the query
 * @returns React Query result with cluster health data
 *
 * @example
 * ```tsx
 * const { data, isLoading, error, refetch } = useClusterHealth();
 *
 * if (data) {
 *   console.log(`Cluster status: ${data.status}`);
 * }
 * ```
 */
export function useClusterHealth(options?: UseK8sQueryOptions | number) {
  // Support legacy number argument for backward compatibility
  const refetchInterval =
    typeof options === 'number'
      ? options
      : options?.refetchInterval ?? CLUSTER_HEALTH_REFRESH_INTERVAL;
  const enabled = typeof options === 'object' ? options.enabled ?? true : true;

  return useQuery({
    queryKey: k8sQueryKeys.clusterHealth(),
    queryFn: getClusterHealth,
    enabled,
    refetchInterval,
    staleTime: K8S_STALE_TIME,
  });
}

/**
 * Hook to fetch namespaces.
 *
 * Namespaces change infrequently, so uses longer stale time.
 */
export function useNamespaces() {
  return useQuery({
    queryKey: k8sQueryKeys.namespaces(),
    queryFn: getNamespaces,
    staleTime: 60000, // Namespaces change infrequently
  });
}

/**
 * Hook to fetch nodes with 30s auto-refresh (T22).
 *
 * @param options - Optional configuration for the query
 * @returns React Query result with nodes array
 *
 * @example
 * ```tsx
 * const { data: nodes, isLoading, error } = useNodes();
 *
 * if (nodes) {
 *   const readyCount = nodes.filter(n => n.status === 'Ready').length;
 *   console.log(`${readyCount}/${nodes.length} nodes ready`);
 * }
 * ```
 */
export function useNodes(options?: UseK8sQueryOptions | number) {
  // Support legacy number argument for backward compatibility
  const refetchInterval =
    typeof options === 'number' ? options : options?.refetchInterval ?? NODES_REFRESH_INTERVAL;
  const enabled = typeof options === 'object' ? options.enabled ?? true : true;

  return useQuery({
    queryKey: k8sQueryKeys.nodes(),
    queryFn: getNodes,
    enabled,
    refetchInterval,
    staleTime: K8S_STALE_TIME,
  });
}

/**
 * Hook to fetch a specific node.
 *
 * @param name - Node name to fetch
 * @returns React Query result with node data or null
 */
export function useNode(name: string) {
  return useQuery({
    queryKey: k8sQueryKeys.node(name),
    queryFn: () => getNode(name),
    enabled: !!name,
    staleTime: K8S_STALE_TIME,
  });
}

/**
 * Hook to fetch pods with filters and 30s auto-refresh (T23).
 *
 * Supports all filter parameters from the backend API:
 * - namespace: Filter by namespace
 * - status: Filter by pod status (Running, Pending, Failed, etc.)
 * - nodeName: Filter by node name
 * - search: Search term for pod name
 * - limit: Pagination limit (default 50)
 * - offset: Pagination offset
 *
 * @param params - Query parameters for filtering and pagination
 * @param options - Optional configuration for the query
 * @returns React Query result with pods array
 *
 * @example
 * ```tsx
 * const { data: pods, isLoading } = usePods({
 *   namespace: 'dox-asdlc',
 *   status: 'Running',
 *   limit: 25,
 *   offset: 0,
 * });
 * ```
 */
export function usePods(params?: K8sPodsQueryParams, options?: UseK8sQueryOptions | number) {
  // Support legacy number argument for backward compatibility
  const refetchInterval =
    typeof options === 'number' ? options : options?.refetchInterval ?? PODS_REFRESH_INTERVAL;
  const enabled = typeof options === 'object' ? options.enabled ?? true : true;

  return useQuery({
    queryKey: k8sQueryKeys.pods(params),
    queryFn: () => getPods(params),
    enabled,
    refetchInterval,
    staleTime: K8S_STALE_TIME,
  });
}

/**
 * Hook to fetch pods with total count (for server-side pagination).
 *
 * @param params - Query parameters for filtering and pagination
 * @param options - Optional configuration for the query
 * @returns React Query result with { pods, total } object
 */
export function usePodsWithTotal(params?: K8sPodsQueryParams, options?: UseK8sQueryOptions) {
  const refetchInterval = options?.refetchInterval ?? PODS_REFRESH_INTERVAL;
  const enabled = options?.enabled ?? true;

  return useQuery({
    queryKey: [...k8sQueryKeys.pods(params), 'withTotal'],
    queryFn: () => getPodsWithTotal(params),
    enabled,
    refetchInterval,
    staleTime: K8S_STALE_TIME,
  });
}

/**
 * Hook to fetch a specific pod.
 *
 * @param namespace - Pod namespace
 * @param name - Pod name
 * @returns React Query result with pod data or null
 */
export function usePod(namespace: string, name: string) {
  return useQuery({
    queryKey: k8sQueryKeys.pod(namespace, name),
    queryFn: () => getPod(namespace, name),
    enabled: !!namespace && !!name,
    staleTime: K8S_STALE_TIME,
  });
}

/**
 * Hook to fetch pod logs with frequent refresh.
 *
 * @param namespace - Pod namespace
 * @param name - Pod name
 * @param container - Optional container name
 * @param tailLines - Number of lines to fetch (default 100)
 * @returns React Query result with log string
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
    refetchInterval: 5000, // Refresh logs frequently (5s)
    staleTime: 2000,
  });
}

/**
 * Hook to fetch services.
 *
 * @param namespace - Optional namespace filter
 * @returns React Query result with services array
 */
export function useServices(namespace?: string) {
  return useQuery({
    queryKey: k8sQueryKeys.services(namespace),
    queryFn: () => getServices(namespace),
    staleTime: 30000,
  });
}

/**
 * Hook to fetch ingresses.
 *
 * @param namespace - Optional namespace filter
 * @returns React Query result with ingresses array
 */
export function useIngresses(namespace?: string) {
  return useQuery({
    queryKey: k8sQueryKeys.ingresses(namespace),
    queryFn: () => getIngresses(namespace),
    staleTime: 30000,
  });
}

/**
 * Hook to fetch metrics history with auto-refresh.
 *
 * @param interval - Metrics interval (1m, 5m, 15m, 1h)
 * @param refetchInterval - Custom refresh interval in ms (default 30s)
 * @returns React Query result with metrics time series
 */
export function useMetricsHistory(interval: MetricsInterval, refetchInterval = 30000) {
  return useQuery({
    queryKey: k8sQueryKeys.metricsHistory(interval),
    queryFn: () => getMetricsHistory(interval),
    refetchInterval,
    staleTime: K8S_STALE_TIME,
  });
}

/**
 * Hook to execute a kubectl/docker command.
 *
 * @returns Mutation hook for command execution
 *
 * @example
 * ```tsx
 * const { mutate: execute, data, isPending } = useExecuteCommand();
 *
 * execute({ command: 'kubectl get pods' });
 * ```
 */
export function useExecuteCommand() {
  return useMutation({
    mutationFn: executeCommand,
    // For read-only commands, no need to invalidate queries
  });
}

/**
 * Hook to run a health check.
 *
 * Invalidates health checks query on success.
 *
 * @returns Mutation hook for health check execution
 */
export function useRunHealthCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: runHealthCheck,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: k8sQueryKeys.healthChecks() });
    },
  });
}

/**
 * Hook to invalidate all K8s queries (useful for manual refresh).
 *
 * @returns Function to invalidate all K8s queries
 */
export function useInvalidateK8sQueries() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: k8sQueryKeys.all() });
  };
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
