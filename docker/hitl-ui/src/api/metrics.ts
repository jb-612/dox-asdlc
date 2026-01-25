/**
 * Metrics API client functions for Metrics Dashboard (P05-F10)
 *
 * Handles VictoriaMetrics queries via backend proxy.
 * Uses mock data when VITE_USE_MOCKS=true.
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';
import {
  getMockServices,
  getMockCPUMetrics,
  getMockMemoryMetrics,
  getMockRequestRateMetrics,
  getMockLatencyMetrics,
  getMockActiveTasks,
  simulateDelay,
} from './mocks/index';
import type {
  TimeRange,
  VMMetricsTimeSeries,
  LatencyMetrics,
  ActiveTasksMetrics,
  ServiceInfo,
  ServicesResponse,
} from './types/metrics';

// ============================================================================
// Check if mocks are enabled
// ============================================================================

const isMocksEnabled = () => import.meta.env.VITE_USE_MOCKS === 'true';

// ============================================================================
// Query Keys
// ============================================================================

export const metricsQueryKeys = {
  services: () => ['metrics', 'services'] as const,
  cpuUsage: (service: string | null, range: TimeRange) =>
    ['metrics', 'cpu', service, range] as const,
  memoryUsage: (service: string | null, range: TimeRange) =>
    ['metrics', 'memory', service, range] as const,
  requestRate: (service: string | null, range: TimeRange) =>
    ['metrics', 'requests', service, range] as const,
  latency: (service: string | null, range: TimeRange) =>
    ['metrics', 'latency', service, range] as const,
  activeTasks: () => ['metrics', 'tasks'] as const,
};

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get list of available services with health status
 */
export async function getServices(): Promise<ServiceInfo[]> {
  if (isMocksEnabled()) {
    await simulateDelay(50, 150);
    return getMockServices();
  }
  const response = await apiClient.get<ServicesResponse>('/metrics/services');
  return response.data.services;
}

/**
 * Get CPU usage metrics for a service or all services
 */
export async function getCPUMetrics(
  service: string | null,
  range: TimeRange
): Promise<VMMetricsTimeSeries> {
  if (isMocksEnabled()) {
    await simulateDelay(100, 250);
    return getMockCPUMetrics(service, range);
  }
  const response = await apiClient.get<VMMetricsTimeSeries>('/metrics/cpu', {
    params: { service, range },
  });
  return response.data;
}

/**
 * Get memory usage metrics for a service or all services
 */
export async function getMemoryMetrics(
  service: string | null,
  range: TimeRange
): Promise<VMMetricsTimeSeries> {
  if (isMocksEnabled()) {
    await simulateDelay(100, 250);
    return getMockMemoryMetrics(service, range);
  }
  const response = await apiClient.get<VMMetricsTimeSeries>('/metrics/memory', {
    params: { service, range },
  });
  return response.data;
}

/**
 * Get request rate metrics for a service or all services
 */
export async function getRequestRateMetrics(
  service: string | null,
  range: TimeRange
): Promise<VMMetricsTimeSeries> {
  if (isMocksEnabled()) {
    await simulateDelay(100, 250);
    return getMockRequestRateMetrics(service, range);
  }
  const response = await apiClient.get<VMMetricsTimeSeries>('/metrics/requests', {
    params: { service, range },
  });
  return response.data;
}

/**
 * Get latency percentile metrics for a service or all services
 */
export async function getLatencyMetrics(
  service: string | null,
  range: TimeRange
): Promise<LatencyMetrics> {
  if (isMocksEnabled()) {
    await simulateDelay(100, 300);
    return getMockLatencyMetrics(service, range);
  }
  const response = await apiClient.get<LatencyMetrics>('/metrics/latency', {
    params: { service, range },
  });
  return response.data;
}

/**
 * Get current active tasks and workers count
 */
export async function getActiveTasks(): Promise<ActiveTasksMetrics> {
  if (isMocksEnabled()) {
    await simulateDelay(50, 150);
    return getMockActiveTasks();
  }
  const response = await apiClient.get<ActiveTasksMetrics>('/metrics/tasks');
  return response.data;
}

// ============================================================================
// React Query Hooks
// ============================================================================

/**
 * Hook to fetch available services
 */
export function useServices() {
  return useQuery({
    queryKey: metricsQueryKeys.services(),
    queryFn: getServices,
    staleTime: 60000, // Services change infrequently
  });
}

/**
 * Hook to fetch CPU metrics with optional auto-refresh
 */
export function useCPUMetrics(
  service: string | null,
  range: TimeRange,
  refetchInterval?: number
) {
  return useQuery({
    queryKey: metricsQueryKeys.cpuUsage(service, range),
    queryFn: () => getCPUMetrics(service, range),
    refetchInterval,
    staleTime: 15000,
  });
}

/**
 * Hook to fetch memory metrics with optional auto-refresh
 */
export function useMemoryMetrics(
  service: string | null,
  range: TimeRange,
  refetchInterval?: number
) {
  return useQuery({
    queryKey: metricsQueryKeys.memoryUsage(service, range),
    queryFn: () => getMemoryMetrics(service, range),
    refetchInterval,
    staleTime: 15000,
  });
}

/**
 * Hook to fetch request rate metrics with optional auto-refresh
 */
export function useRequestRateMetrics(
  service: string | null,
  range: TimeRange,
  refetchInterval?: number
) {
  return useQuery({
    queryKey: metricsQueryKeys.requestRate(service, range),
    queryFn: () => getRequestRateMetrics(service, range),
    refetchInterval,
    staleTime: 15000,
  });
}

/**
 * Hook to fetch latency metrics with optional auto-refresh
 */
export function useLatencyMetrics(
  service: string | null,
  range: TimeRange,
  refetchInterval?: number
) {
  return useQuery({
    queryKey: metricsQueryKeys.latency(service, range),
    queryFn: () => getLatencyMetrics(service, range),
    refetchInterval,
    staleTime: 15000,
  });
}

/**
 * Hook to fetch active tasks metrics with optional auto-refresh
 */
export function useActiveTasks(refetchInterval?: number) {
  return useQuery({
    queryKey: metricsQueryKeys.activeTasks(),
    queryFn: getActiveTasks,
    refetchInterval,
    staleTime: 10000,
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let value = bytes;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Format milliseconds to human-readable latency string
 */
export function formatLatency(ms: number): string {
  if (ms < 1) {
    return `${(ms * 1000).toFixed(0)}us`;
  }
  if (ms < 1000) {
    return `${ms.toFixed(1)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Format requests per second
 */
export function formatRequestRate(rps: number): string {
  if (rps < 1) {
    return `${(rps * 60).toFixed(1)}/min`;
  }
  if (rps >= 1000) {
    return `${(rps / 1000).toFixed(1)}k/s`;
  }
  return `${rps.toFixed(1)}/s`;
}
