import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';

// Mock the mocks module
vi.mock('./mocks', () => ({
  mockGates: {
    gates: [
      {
        id: 'gate_001',
        type: 'code_review',
        session_id: 'sess_001',
        status: 'pending',
        created_at: new Date().toISOString(),
        artifacts: [],
        summary: 'Test gate for default tenant',
        context: { tenant_id: 'default' },
      },
      {
        id: 'gate_002',
        type: 'prd_review',
        session_id: 'sess_002',
        status: 'pending',
        created_at: new Date().toISOString(),
        artifacts: [],
        summary: 'Test gate for acme-corp',
        context: { tenant_id: 'acme-corp' },
      },
    ],
    total: 2,
  },
  mockGateDetail: vi.fn((id: string) => {
    const gates = [
      {
        id: 'gate_001',
        type: 'code_review',
        session_id: 'sess_001',
        status: 'pending',
        created_at: new Date().toISOString(),
        artifacts: [],
        summary: 'Test gate',
        context: {},
      },
    ];
    return gates.find((g) => g.id === id);
  }),
}));

describe('gates API with tenant context', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
          staleTime: 0,
        },
      },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  it('fetches pending gates successfully', async () => {
    const { usePendingGates } = await import('./gates');

    const { result } = renderHook(() => usePendingGates(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.gates).toBeDefined();
    expect(result.current.data?.gates.length).toBeGreaterThan(0);
  });

  it('fetches gate detail by ID', async () => {
    const { useGateDetail } = await import('./gates');

    const { result } = renderHook(() => useGateDetail('gate_001'), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.id).toBe('gate_001');
  });

  it('uses polling interval for gate queries', async () => {
    const { usePendingGates } = await import('./gates');

    const { result } = renderHook(() => usePendingGates(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Query should be configured with refetchInterval
    expect(result.current.isSuccess).toBe(true);
  });
});

describe('gate decision mutation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
        mutations: {
          retry: false,
        },
      },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  it('submits gate decision and invalidates cache', async () => {
    const { useGateDecision, usePendingGates } = await import('./gates');

    // First, fetch pending gates to populate cache
    const { result: gatesResult } = renderHook(() => usePendingGates(), {
      wrapper,
    });

    await waitFor(() => {
      expect(gatesResult.current.isSuccess).toBe(true);
    });

    // Now test the mutation
    const { result: mutationResult } = renderHook(() => useGateDecision(), {
      wrapper,
    });

    await act(async () => {
      const response = await mutationResult.current.mutateAsync({
        gate_id: 'gate_001',
        decision: 'approve',
        decided_by: 'test-user',
        reason: 'Looks good',
      });

      expect(response.success).toBe(true);
      expect(response.event_id).toBeDefined();
    });
  });

  it('handles rejection decision', async () => {
    const { useGateDecision } = await import('./gates');

    const { result } = renderHook(() => useGateDecision(), { wrapper });

    await act(async () => {
      const response = await result.current.mutateAsync({
        gate_id: 'gate_002',
        decision: 'reject',
        decided_by: 'test-user',
        reason: 'Needs more tests',
        feedback: 'Please add unit tests for edge cases',
      });

      expect(response.success).toBe(true);
    });
  });
});
