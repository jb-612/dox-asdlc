/**
 * Tests for TanStack Query integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, QueryKeys, createQueryWrapper } from '@/api/queryClient';
import { ReactNode } from 'react';

// Test component that uses a query
function TestQueryComponent({ queryKey, queryFn }: { queryKey: string[]; queryFn: () => Promise<unknown> }) {
  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn,
  });

  if (isLoading) return <div data-testid="loading">Loading...</div>;
  if (error) return <div data-testid="error">Error: {String(error)}</div>;
  return <div data-testid="data">{JSON.stringify(data)}</div>;
}

// Test component that uses a mutation
function TestMutationComponent({
  mutationFn,
  onSuccess,
}: {
  mutationFn: (data: unknown) => Promise<unknown>;
  onSuccess?: () => void;
}) {
  const mutation = useMutation({
    mutationFn,
    onSuccess,
  });

  return (
    <div>
      <span data-testid="status">{mutation.status}</span>
      <button
        data-testid="mutate"
        onClick={() => mutation.mutate({ test: 'data' })}
        disabled={mutation.isPending}
      >
        Mutate
      </button>
      {mutation.data && <span data-testid="result">{JSON.stringify(mutation.data)}</span>}
      {mutation.error && <span data-testid="mutation-error">{String(mutation.error)}</span>}
    </div>
  );
}

// Helper to create a query client for tests
function createTestQueryClient() {
  return new QueryClient({
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
}

// Test wrapper provider
function TestWrapper({ children, client }: { children: ReactNode; client?: QueryClient }) {
  const queryClient = client || createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

describe('TanStack Query Integration', () => {
  let testClient: QueryClient;

  beforeEach(() => {
    testClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    testClient.clear();
  });

  describe('Query Client Configuration', () => {
    it('creates query client with default options', () => {
      expect(queryClient).toBeDefined();
      expect(queryClient.getDefaultOptions()).toBeDefined();
    });

    it('has retry disabled for tests', () => {
      const defaultOptions = testClient.getDefaultOptions();
      expect(defaultOptions.queries?.retry).toBe(false);
    });
  });

  describe('Query Keys', () => {
    it('exports query keys for all endpoints', () => {
      expect(QueryKeys).toBeDefined();
      expect(QueryKeys.gates).toBeDefined();
      expect(QueryKeys.runs).toBeDefined();
      expect(QueryKeys.artifacts).toBeDefined();
      expect(QueryKeys.sessions).toBeDefined();
    });

    it('gates query keys are arrays', () => {
      expect(Array.isArray(QueryKeys.gates.all)).toBe(true);
      expect(Array.isArray(QueryKeys.gates.list())).toBe(true);
    });

    it('gates detail key includes id', () => {
      const key = QueryKeys.gates.detail('gate-123');
      expect(key).toContain('gate-123');
    });

    it('runs query keys are arrays', () => {
      expect(Array.isArray(QueryKeys.runs.all)).toBe(true);
      expect(Array.isArray(QueryKeys.runs.list())).toBe(true);
    });

    it('runs detail key includes id', () => {
      const key = QueryKeys.runs.detail('run-123');
      expect(key).toContain('run-123');
    });

    it('artifacts query keys are arrays', () => {
      expect(Array.isArray(QueryKeys.artifacts.all)).toBe(true);
      expect(Array.isArray(QueryKeys.artifacts.list())).toBe(true);
    });

    it('artifacts detail key includes id', () => {
      const key = QueryKeys.artifacts.detail('artifact-123');
      expect(key).toContain('artifact-123');
    });
  });

  describe('Query Wrapper', () => {
    it('creates wrapper function', () => {
      const Wrapper = createQueryWrapper();
      expect(typeof Wrapper).toBe('function');
    });

    it('wrapper renders children', () => {
      const Wrapper = createQueryWrapper(testClient);
      render(
        <Wrapper>
          <div data-testid="child">Child</div>
        </Wrapper>
      );
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });
  });

  describe('Query Fetching', () => {
    it('shows loading state initially', () => {
      const queryFn = vi.fn(() => new Promise(() => {})); // Never resolves
      render(
        <TestWrapper client={testClient}>
          <TestQueryComponent queryKey={['test']} queryFn={queryFn} />
        </TestWrapper>
      );

      expect(screen.getByTestId('loading')).toBeInTheDocument();
    });

    it('displays data when fetch succeeds', async () => {
      const queryFn = vi.fn(() => Promise.resolve({ message: 'success' }));
      render(
        <TestWrapper client={testClient}>
          <TestQueryComponent queryKey={['test']} queryFn={queryFn} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('data')).toBeInTheDocument();
      });

      expect(screen.getByTestId('data')).toHaveTextContent('success');
    });

    it('displays error when fetch fails', async () => {
      const queryFn = vi.fn(() => Promise.reject(new Error('Fetch failed')));
      render(
        <TestWrapper client={testClient}>
          <TestQueryComponent queryKey={['test']} queryFn={queryFn} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('error')).toBeInTheDocument();
      });

      expect(screen.getByTestId('error')).toHaveTextContent('Fetch failed');
    });

    it('caches query results', async () => {
      const queryFn = vi.fn(() => Promise.resolve({ cached: true }));

      const { rerender } = render(
        <TestWrapper client={testClient}>
          <TestQueryComponent queryKey={['cached']} queryFn={queryFn} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('data')).toBeInTheDocument();
      });

      // Rerender with same key
      rerender(
        <TestWrapper client={testClient}>
          <TestQueryComponent queryKey={['cached']} queryFn={queryFn} />
        </TestWrapper>
      );

      // Should use cached data (queryFn called only once for initial fetch)
      expect(queryFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Mutations', () => {
    it('shows idle state initially', () => {
      const mutationFn = vi.fn();
      render(
        <TestWrapper client={testClient}>
          <TestMutationComponent mutationFn={mutationFn} />
        </TestWrapper>
      );

      expect(screen.getByTestId('status')).toHaveTextContent('idle');
    });

    it('shows pending state during mutation', async () => {
      const mutationFn = vi.fn(() => new Promise(() => {})); // Never resolves
      render(
        <TestWrapper client={testClient}>
          <TestMutationComponent mutationFn={mutationFn} />
        </TestWrapper>
      );

      act(() => {
        screen.getByTestId('mutate').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('status')).toHaveTextContent('pending');
      });
    });

    it('shows success state after mutation', async () => {
      const mutationFn = vi.fn(() => Promise.resolve({ success: true }));
      render(
        <TestWrapper client={testClient}>
          <TestMutationComponent mutationFn={mutationFn} />
        </TestWrapper>
      );

      act(() => {
        screen.getByTestId('mutate').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('status')).toHaveTextContent('success');
      });

      expect(screen.getByTestId('result')).toHaveTextContent('success');
    });

    it('shows error state on mutation failure', async () => {
      const mutationFn = vi.fn(() => Promise.reject(new Error('Mutation failed')));
      render(
        <TestWrapper client={testClient}>
          <TestMutationComponent mutationFn={mutationFn} />
        </TestWrapper>
      );

      act(() => {
        screen.getByTestId('mutate').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('status')).toHaveTextContent('error');
      });

      expect(screen.getByTestId('mutation-error')).toHaveTextContent('Mutation failed');
    });

    it('calls onSuccess callback after mutation', async () => {
      const onSuccess = vi.fn();
      const mutationFn = vi.fn(() => Promise.resolve({ success: true }));
      render(
        <TestWrapper client={testClient}>
          <TestMutationComponent mutationFn={mutationFn} onSuccess={onSuccess} />
        </TestWrapper>
      );

      act(() => {
        screen.getByTestId('mutate').click();
      });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
    });
  });

  describe('Cache Invalidation', () => {
    it('invalidates queries by key', async () => {
      const queryFn = vi.fn(() => Promise.resolve({ data: 'value' }));
      render(
        <TestWrapper client={testClient}>
          <TestQueryComponent queryKey={['invalidate-test']} queryFn={queryFn} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('data')).toBeInTheDocument();
      });

      // Invalidate the query
      act(() => {
        testClient.invalidateQueries({ queryKey: ['invalidate-test'] });
      });

      // Query should refetch
      await waitFor(() => {
        expect(queryFn).toHaveBeenCalledTimes(2);
      });
    });

    it('removes queries from cache', async () => {
      const queryFn = vi.fn(() => Promise.resolve({ data: 'value' }));
      render(
        <TestWrapper client={testClient}>
          <TestQueryComponent queryKey={['remove-test']} queryFn={queryFn} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('data')).toBeInTheDocument();
      });

      // Remove query from cache
      act(() => {
        testClient.removeQueries({ queryKey: ['remove-test'] });
      });

      // Query should be removed
      const cacheState = testClient.getQueryState(['remove-test']);
      expect(cacheState).toBeUndefined();
    });
  });
});
