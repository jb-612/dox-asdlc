import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import type {
  GateRequest,
  GatesResponse,
  GateDecision,
  DecisionResponse,
  GatesQueryParams,
  ArtifactContentResponse,
} from './types';
import { mockGates, mockGateDetail } from './mocks';

// Query keys for cache management
export const gateKeys = {
  all: ['gates'] as const,
  pending: (params?: GatesQueryParams) =>
    [...gateKeys.all, 'pending', params] as const,
  detail: (id: string) => [...gateKeys.all, 'detail', id] as const,
  artifact: (path: string) => [...gateKeys.all, 'artifact', path] as const,
};

// Check if we're in mock mode
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true' || import.meta.env.DEV;

// Fetch pending gates
async function fetchPendingGates(
  params?: GatesQueryParams
): Promise<GatesResponse> {
  if (USE_MOCKS) {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));
    return mockGates;
  }

  const { data } = await apiClient.get<GatesResponse>('/gates/pending', {
    params,
  });
  return data;
}

// Fetch single gate detail
async function fetchGateDetail(gateId: string): Promise<GateRequest> {
  if (USE_MOCKS) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const gate = mockGateDetail(gateId);
    if (!gate) {
      throw new Error(`Gate ${gateId} not found`);
    }
    return gate;
  }

  const { data } = await apiClient.get<GateRequest>(`/gates/${gateId}`);
  return data;
}

// Submit gate decision
async function submitGateDecision(
  decision: GateDecision
): Promise<DecisionResponse> {
  if (USE_MOCKS) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return {
      success: true,
      event_id: `evt_${Date.now()}`,
    };
  }

  const { data } = await apiClient.post<DecisionResponse>(
    `/gates/${decision.gate_id}/decide`,
    decision
  );
  return data;
}

// Fetch artifact content
async function fetchArtifactContent(
  path: string
): Promise<ArtifactContentResponse> {
  if (USE_MOCKS) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return {
      content: `# Mock content for ${path}\n\nThis is placeholder content.`,
      content_type: 'text/plain',
      size_bytes: 100,
    };
  }

  const { data } = await apiClient.get<ArtifactContentResponse>(
    `/artifacts/${encodeURIComponent(path)}`
  );
  return data;
}

// React Query Hooks

/**
 * Hook to fetch pending gates with polling
 */
export function usePendingGates(params?: GatesQueryParams) {
  const pollingInterval = parseInt(
    import.meta.env.VITE_POLLING_INTERVAL || '10000',
    10
  );

  return useQuery({
    queryKey: gateKeys.pending(params),
    queryFn: () => fetchPendingGates(params),
    refetchInterval: pollingInterval,
    staleTime: 5000,
  });
}

/**
 * Hook to fetch single gate detail
 */
export function useGateDetail(gateId: string | undefined) {
  return useQuery({
    queryKey: gateKeys.detail(gateId || ''),
    queryFn: () => fetchGateDetail(gateId!),
    enabled: !!gateId,
    refetchInterval: 5000, // Poll more frequently when viewing detail
    staleTime: 2000,
  });
}

/**
 * Hook to submit gate decision
 */
export function useGateDecision() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitGateDecision,
    onSuccess: (_, variables) => {
      // Invalidate gates list to refresh
      queryClient.invalidateQueries({ queryKey: gateKeys.all });

      // Update the specific gate in cache to show it's no longer pending
      queryClient.setQueryData(
        gateKeys.detail(variables.gate_id),
        (old: GateRequest | undefined) => {
          if (!old) return old;
          return {
            ...old,
            status: variables.decision === 'approve' ? 'approved' : 'rejected',
          };
        }
      );
    },
  });
}

/**
 * Hook to fetch artifact content
 */
export function useArtifactContent(path: string | undefined) {
  return useQuery({
    queryKey: gateKeys.artifact(path || ''),
    queryFn: () => fetchArtifactContent(path!),
    enabled: !!path,
    staleTime: 60000, // Artifact content doesn't change often
  });
}
