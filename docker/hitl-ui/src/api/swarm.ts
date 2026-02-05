/**
 * Swarm Review API (P04-F06)
 *
 * API client and React Query hooks for the parallel code review feature.
 * Supports mock mode for development.
 */

import { useMutation, useQuery, UseQueryResult, UseMutationResult } from '@tanstack/react-query';
import { apiClient } from './client';
import { areMocksEnabled } from './mocks/index';
import { mockTriggerSwarmReview, mockFetchSwarmStatus } from './mocks/swarm';
import type {
  SwarmReviewRequest,
  SwarmReviewResponse,
  SwarmStatusResponse,
} from './types';

// ============================================================================
// Query Keys
// ============================================================================

export const swarmKeys = {
  all: ['swarm'] as const,
  status: (id: string) => [...swarmKeys.all, 'status', id] as const,
};

// ============================================================================
// API Functions
// ============================================================================

/**
 * Trigger a new swarm review
 */
export async function triggerSwarmReview(
  request: SwarmReviewRequest
): Promise<SwarmReviewResponse> {
  if (areMocksEnabled()) {
    return mockTriggerSwarmReview(request);
  }

  const response = await apiClient.post<SwarmReviewResponse>(
    '/swarm/review',
    request
  );
  return response.data;
}

/**
 * Fetch the status of a swarm review
 */
export async function fetchSwarmStatus(
  swarmId: string
): Promise<SwarmStatusResponse> {
  if (areMocksEnabled()) {
    return mockFetchSwarmStatus(swarmId);
  }

  const response = await apiClient.get<SwarmStatusResponse>(
    `/swarm/review/${swarmId}`
  );
  return response.data;
}

// ============================================================================
// React Query Hooks
// ============================================================================

/**
 * Hook to trigger a swarm review
 *
 * @example
 * ```tsx
 * const mutation = useSwarmReview();
 *
 * const handleStartReview = () => {
 *   mutation.mutate({
 *     target_path: 'src/',
 *     reviewer_types: ['security', 'performance'],
 *   });
 * };
 * ```
 */
export function useSwarmReview(): UseMutationResult<
  SwarmReviewResponse,
  Error,
  SwarmReviewRequest
> {
  return useMutation({
    mutationFn: triggerSwarmReview,
  });
}

/**
 * Hook to poll swarm review status
 *
 * Automatically polls every 2 seconds while enabled.
 * Stops polling when swarm is complete or failed.
 *
 * @param swarmId - The ID of the swarm to poll
 * @param options - Optional configuration
 * @param options.enabled - Whether polling is enabled (default: true when swarmId is provided)
 * @param options.refetchInterval - Polling interval in ms (default: 2000)
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useSwarmStatus(swarmId);
 *
 * if (data?.status === 'complete') {
 *   // Handle completion
 * }
 * ```
 */
export function useSwarmStatus(
  swarmId: string | null,
  options?: {
    enabled?: boolean;
    refetchInterval?: number;
  }
): UseQueryResult<SwarmStatusResponse> {
  const { enabled = true, refetchInterval = 2000 } = options || {};

  return useQuery({
    queryKey: swarmKeys.status(swarmId || ''),
    queryFn: () => fetchSwarmStatus(swarmId!),
    enabled: enabled && !!swarmId,
    refetchInterval: (query) => {
      // Stop polling when review is complete or failed
      const data = query.state.data;
      if (data?.status === 'complete' || data?.status === 'failed') {
        return false;
      }
      return refetchInterval;
    },
    refetchIntervalInBackground: false,
    staleTime: 1000, // Consider data fresh for 1 second
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a swarm status indicates it's still running
 */
export function isSwarmRunning(status: SwarmStatusResponse['status']): boolean {
  return status === 'pending' || status === 'in_progress' || status === 'aggregating';
}

/**
 * Check if a swarm status indicates it's finished (complete or failed)
 */
export function isSwarmFinished(status: SwarmStatusResponse['status']): boolean {
  return status === 'complete' || status === 'failed';
}

/**
 * Get the overall progress percentage from swarm status
 */
export function getSwarmProgress(swarmStatus: SwarmStatusResponse): number {
  const reviewers = Object.values(swarmStatus.reviewers);
  if (reviewers.length === 0) return 0;

  const totalProgress = reviewers.reduce(
    (sum, r) => sum + r.progress_percent,
    0
  );
  return Math.round(totalProgress / reviewers.length);
}

/**
 * Format duration in seconds to human-readable string
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}
