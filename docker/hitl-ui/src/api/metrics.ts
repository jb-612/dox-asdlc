/**
 * Metrics API client functions for Metrics Dashboard (P05-F10)
 *
 * Handles VictoriaMetrics queries via backend proxy.
 * Supports runtime backend switching via mode parameter.
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
  MetricsHealthResponse,
} from './types/metrics';
import type { MetricsBackendMode } from '../stores/metricsStore';

// ============================================================================
// Types
// ============================================================================

export interface MetricsQueryOptions {
  /** Backend mode - 'mock' uses local data, 'victoriametrics' uses real API */
  mode?: MetricsBackendMode;
}

// ============================================================================
// Query Keys
// ============================================================================

export const metricsQueryKeys = {
  services: (mode?: MetricsBackendMode) => ['metrics', 'services', mode] as const,
  health: (mode?: MetricsBackendMode) => ['metrics', 'health', mode] as const,
  cpuUsage: (service: string | null, range: TimeRange, mode?: MetricsBackendMode) =>
    ['metrics', 'cpu', service, range, mode] as const,
  memoryUsage: (service: string | null, range: TimeRange, mode?: MetricsBackendMode) =>
    ['metrics', 'memory', service, range, mode] as const,
  requestRate: (service: string | null, range: TimeRange, mode?: MetricsBackendMode) =>
    ['metrics', 'requests', service, range, mode] as const,
  latency: (service: string | null, range: TimeRange, mode?: MetricsBackendMode) =>
    ['metrics', 'latency', service, range, mode] as const,
  activeTasks: (mode?: MetricsBackendMode) => ['metrics', 'tasks', mode] as const,
};

// ============================================================================
// API Functions
// ============================================================================

/**
 * Check VictoriaMetrics health
 */
export async function getMetricsHealth(options?: MetricsQueryOptions): Promise<MetricsHealthResponse> {
  if (options?.mode === 'mock') {
    await simulateDelay(20, 50);
    return { status: 'healthy' };
  }
  try {
    const response = await apiClient.get<MetricsHealthResponse>('/metrics/health');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch metrics health:', error);
    return { status: 'unhealthy' as MetricsHealthResponse['status'] };
  }
}

/**
 * Get list of available services with health status
 */
export async function getServices(options?: MetricsQueryOptions): Promise<ServiceInfo[]> {
  if (options?.mode === 'mock') {
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
  range: TimeRange,
  options?: MetricsQueryOptions
): Promise<VMMetricsTimeSeries> {
  if (options?.mode === 'mock') {
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
  range: TimeRange,
  options?: MetricsQueryOptions
): Promise<VMMetricsTimeSeries> {
  if (options?.mode === 'mock') {
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
  range: TimeRange,
  options?: MetricsQueryOptions
): Promise<VMMetricsTimeSeries> {
  if (options?.mode === 'mock') {
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
  range: TimeRange,
  options?: MetricsQueryOptions
): Promise<LatencyMetrics> {
  if (options?.mode === 'mock') {
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
export async function getActiveTasks(options?: MetricsQueryOptions): Promise<ActiveTasksMetrics> {
  if (options?.mode === 'mock') {
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
 * Hook to check VictoriaMetrics health
 */
export function useMetricsHealth(options?: MetricsQueryOptions) {
  return useQuery({
    queryKey: metricsQueryKeys.health(options?.mode),
    queryFn: () => getMetricsHealth(options),
    refetchInterval: 30000,
    staleTime: 15000,
  });
}

/**
 * Hook to fetch available services
 */
export function useServices(options?: MetricsQueryOptions) {
  return useQuery({
    queryKey: metricsQueryKeys.services(options?.mode),
    queryFn: () => getServices(options),
    staleTime: 60000,
  });
}

/**
 * Hook to fetch CPU metrics with optional auto-refresh
 */
export function useCPUMetrics(
  service: string | null,
  range: TimeRange,
  refetchInterval?: number,
  options?: MetricsQueryOptions
) {
  return useQuery({
    queryKey: metricsQueryKeys.cpuUsage(service, range, options?.mode),
    queryFn: () => getCPUMetrics(service, range, options),
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
  refetchInterval?: number,
  options?: MetricsQueryOptions
) {
  return useQuery({
    queryKey: metricsQueryKeys.memoryUsage(service, range, options?.mode),
    queryFn: () => getMemoryMetrics(service, range, options),
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
  refetchInterval?: number,
  options?: MetricsQueryOptions
) {
  return useQuery({
    queryKey: metricsQueryKeys.requestRate(service, range, options?.mode),
    queryFn: () => getRequestRateMetrics(service, range, options),
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
  refetchInterval?: number,
  options?: MetricsQueryOptions
) {
  return useQuery({
    queryKey: metricsQueryKeys.latency(service, range, options?.mode),
    queryFn: () => getLatencyMetrics(service, range, options),
    refetchInterval,
    staleTime: 15000,
  });
}

/**
 * Hook to fetch active tasks metrics with optional auto-refresh
 */
export function useActiveTasks(refetchInterval?: number, options?: MetricsQueryOptions) {
  return useQuery({
    queryKey: metricsQueryKeys.activeTasks(options?.mode),
    queryFn: () => getActiveTasks(options),
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
