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
// Types
// ============================================================================

export interface ServicesQueryOptions {
  /** Use mock data instead of real API */
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
  try {
    const response = await apiClient.get<ServicesHealthResponse>(
      '/metrics/services/health'
    );
    return response.data;
  } catch (error) {
    // Fall back to mock data if API fails and useMock is true
    if (options?.useMock) {
      await simulateDelay(50, 150);
      return getMockServicesHealth();
    }
    throw error;
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
  try {
    const response = await apiClient.get<ServiceSparklineResponse>(
      `/metrics/services/${serviceName}/sparkline`,
      { params: { metric } }
    );
    return response.data;
  } catch (error) {
    // Fall back to mock data if API fails and useMock is true
    if (options?.useMock) {
      await simulateDelay(50, 150);
      return getMockServiceSparkline(serviceName, metric);
    }
    throw error;
  }
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
    queryFn: async () => {
      try {
        return await getServicesHealth(options);
      } catch (error) {
        // If useMock is enabled and API fails, return mock data
        if (options?.useMock) {
          return getMockServicesHealth();
        }
        throw error;
      }
    },
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
      try {
        return await getServiceSparkline(serviceName, metric, options);
      } catch (error) {
        // If useMock is enabled and API fails, return mock data
        if (options?.useMock) {
          return getMockServiceSparkline(serviceName, metric);
        }
        throw error;
      }
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
