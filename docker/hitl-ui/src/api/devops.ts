/**
 * DevOps Activity API client functions (P06-F07)
 *
 * Handles fetching DevOps operation activity from the backend.
 * Supports mock data fallback for development mode.
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';
import {
  getMockDevOpsActivity,
  simulateDevOpsDelay,
} from './mocks/index';
import type { DevOpsActivityResponse } from './types/devops';

// ============================================================================
// Configuration
// ============================================================================

/** Auto-refresh interval for DevOps activity (10 seconds) */
const DEVOPS_REFRESH_INTERVAL = 10000;

/** Stale time for DevOps activity queries */
const DEVOPS_STALE_TIME = 5000;

// ============================================================================
// Query Keys
// ============================================================================

export const devopsQueryKeys = {
  activity: () => ['devops', 'activity'] as const,
};

// ============================================================================
// API Functions
// ============================================================================

/**
 * Check if we should use mock data
 */
function shouldUseMocks(): boolean {
  return import.meta.env.VITE_USE_MOCKS === 'true' || import.meta.env.DEV;
}

/**
 * Fetch DevOps activity from the API
 *
 * Returns current operation (if any) and recent operations.
 * Falls back to mock data in development mode.
 */
export async function getDevOpsActivity(): Promise<DevOpsActivityResponse> {
  // Use mock data in development or when VITE_USE_MOCKS is enabled
  if (shouldUseMocks()) {
    await simulateDevOpsDelay(50, 150);
    return getMockDevOpsActivity();
  }

  try {
    const response = await apiClient.get<DevOpsActivityResponse>('/devops/activity');
    return response.data;
  } catch (error) {
    console.error('DevOps API unavailable:', error);
    throw error;
  }
}

// ============================================================================
// React Query Hooks
// ============================================================================

export interface UseDevOpsActivityOptions {
  /** Enable auto-refresh (default: true) */
  enabled?: boolean;
  /** Custom refresh interval in ms (default: 10000) */
  refetchInterval?: number;
}

/**
 * Hook to fetch DevOps activity with auto-refresh
 *
 * @param options - Hook options
 * @returns React Query result with DevOps activity data
 *
 * @example
 * ```tsx
 * const { data, isLoading, error, refetch } = useDevOpsActivity();
 *
 * if (data?.current) {
 *   // Show current operation banner
 * }
 * ```
 */
export function useDevOpsActivity(options?: UseDevOpsActivityOptions) {
  const {
    enabled = true,
    refetchInterval = DEVOPS_REFRESH_INTERVAL,
  } = options ?? {};

  return useQuery({
    queryKey: devopsQueryKeys.activity(),
    queryFn: getDevOpsActivity,
    enabled,
    refetchInterval,
    staleTime: DEVOPS_STALE_TIME,
  });
}
