/**
 * Service Health API client functions (P06-F07)
 *
 * Provides API functions and React Query hooks for fetching service health data.
 * Includes mock data fallback for development mode.
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';
import {
  getMockServicesHealth,
  getMockServiceSparkline,
  simulateDelay,
} from './mocks/services';
import type {
  ServicesHealthResponse,
  ServiceSparklineResponse,
} from './types/services';

// ============================================================================
// Constants
// ============================================================================

/**
 * Check if mocks should be used based on environment variable
 */
function shouldUseMocks(): boolean {
  return import.meta.env.VITE_USE_MOCKS === 'true';
}

// ============================================================================
// Types
// ============================================================================

export interface ServicesQueryOptions {
  /** Use mock data instead of real API (defaults to VITE_USE_MOCKS env var) */
  useMock?: boolean;
}

// ============================================================================
// Query Keys
// ============================================================================

export const servicesQueryKeys = {
  /** Key for services health query */
  health: () => ['services', 'health'] as const,
  /** Key for service sparkline query */
  sparkline: (serviceName: string, metric: string) =>
    ['services', 'sparkline', serviceName, metric] as const,
  /** Key for all services queries (for invalidation) */
  all: () => ['services'] as const,
};

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch health status for all services
 */
export async function getServicesHealth(
  options?: ServicesQueryOptions
): Promise<ServicesHealthResponse> {
  const useMock = options?.useMock ?? shouldUseMocks();

  // Use mock data directly if mocks are enabled
  if (useMock) {
    await simulateDelay(50, 150);
    return getMockServicesHealth();
  }

  try {
    const response = await apiClient.get<ServicesHealthResponse>(
      '/metrics/services/health'
    );
    return response.data;
  } catch (error) {
    console.error('Services health API unavailable:', error);
    return { services: [], connections: [], timestamp: new Date().toISOString() };
  }
}

/**
 * Fetch sparkline data for a specific service and metric
 */
export async function getServiceSparkline(
  serviceName: string,
  metric: string,
  options?: ServicesQueryOptions
): Promise<ServiceSparklineResponse> {
  const useMock = options?.useMock ?? shouldUseMocks();

  // Use mock data directly if mocks are enabled
  if (useMock) {
    await simulateDelay(50, 150);
    return getMockServiceSparkline(serviceName, metric);
  }

  const response = await apiClient.get<ServiceSparklineResponse>(
    `/metrics/services/${serviceName}/sparkline`,
    { params: { metric } }
  );
  return response.data;
}

// ============================================================================
// React Query Hooks
// ============================================================================

/**
 * Hook to fetch services health with 30s auto-refresh
 */
export function useServicesHealth(options?: ServicesQueryOptions) {
  return useQuery({
    queryKey: servicesQueryKeys.health(),
    queryFn: () => getServicesHealth(options),
    refetchInterval: 30000, // 30 seconds
    staleTime: 15000, // 15 seconds
  });
}

/**
 * Hook to fetch service sparkline data with 1min auto-refresh
 *
 * @param serviceName - Service name (null to disable query)
 * @param metric - Metric name (null to disable query)
 */
export function useServiceSparkline(
  serviceName: string | null,
  metric: string | null,
  options?: ServicesQueryOptions
) {
  return useQuery({
    queryKey: servicesQueryKeys.sparkline(serviceName || '', metric || ''),
    queryFn: async () => {
      if (!serviceName || !metric) {
        throw new Error('Service name and metric are required');
      }
      return getServiceSparkline(serviceName, metric, options);
    },
    enabled: !!serviceName && !!metric,
    refetchInterval: 60000, // 1 minute
    staleTime: 30000, // 30 seconds
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get multiple sparkline data at once (for ServiceCard optimization)
 */
export async function getServiceSparklines(
  serviceName: string,
  metrics: string[],
  options?: ServicesQueryOptions
): Promise<Record<string, ServiceSparklineResponse>> {
  const results: Record<string, ServiceSparklineResponse> = {};

  await Promise.all(
    metrics.map(async (metric) => {
      const data = await getServiceSparkline(serviceName, metric, options);
      results[metric] = data;
    })
  );

  return results;
}
