import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';
import type { WorkerPoolStatus } from './types';
import { mockWorkerPool } from './mocks';

// Query keys for cache management
export const workerKeys = {
  all: ['workers'] as const,
  status: () => [...workerKeys.all, 'status'] as const,
};

// Check if we're in mock mode
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

// Fetch worker pool status
async function fetchWorkerPoolStatus(): Promise<WorkerPoolStatus> {
  if (USE_MOCKS) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return mockWorkerPool;
  }

  const { data } = await apiClient.get<WorkerPoolStatus>('/workers/status');
  return data;
}

/**
 * Hook to fetch worker pool status with polling
 */
export function useWorkerPoolStatus() {
  return useQuery({
    queryKey: workerKeys.status(),
    queryFn: fetchWorkerPoolStatus,
    refetchInterval: 30000, // Poll every 30 seconds
    staleTime: 10000,
  });
}
