import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';
import type { SessionSummary, SessionsResponse, SessionsQueryParams } from './types';
import { mockSessions, mockSessionDetail } from './mocks';

// Query keys for cache management
export const sessionKeys = {
  all: ['sessions'] as const,
  list: (params?: SessionsQueryParams) =>
    [...sessionKeys.all, 'list', params] as const,
  detail: (id: string) => [...sessionKeys.all, 'detail', id] as const,
};

// Check if we're in mock mode
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

// Fetch sessions list
async function fetchSessions(
  params?: SessionsQueryParams
): Promise<SessionsResponse> {
  if (USE_MOCKS) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return mockSessions;
  }

  const { data } = await apiClient.get<SessionsResponse>('/sessions', {
    params,
  });
  return data;
}

// Fetch single session detail
async function fetchSessionDetail(sessionId: string): Promise<SessionSummary> {
  if (USE_MOCKS) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const session = mockSessionDetail(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    return session;
  }

  const { data } = await apiClient.get<SessionSummary>(`/sessions/${sessionId}`);
  return data;
}

/**
 * Hook to fetch sessions list with polling
 */
export function useSessions(params?: SessionsQueryParams) {
  return useQuery({
    queryKey: sessionKeys.list(params),
    queryFn: () => fetchSessions(params),
    refetchInterval: 15000, // Poll every 15 seconds
    staleTime: 5000,
  });
}

/**
 * Hook to fetch single session detail
 */
export function useSessionDetail(sessionId: string | undefined) {
  return useQuery({
    queryKey: sessionKeys.detail(sessionId || ''),
    queryFn: () => fetchSessionDetail(sessionId!),
    enabled: !!sessionId,
    refetchInterval: 10000,
    staleTime: 3000,
  });
}
