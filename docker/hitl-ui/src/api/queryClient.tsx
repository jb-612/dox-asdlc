/**
 * TanStack Query client configuration
 *
 * Provides centralized query client setup, query keys, and utilities
 * for data fetching throughout the application.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

/**
 * Query key factory for type-safe, consistent query keys
 */
export const QueryKeys = {
  // Gates
  gates: {
    all: ['gates'] as const,
    list: (filters?: { status?: string; type?: string; epicId?: string }) =>
      filters ? ['gates', 'list', filters] as const : ['gates', 'list'] as const,
    detail: (id: string) => ['gates', 'detail', id] as const,
    pending: () => ['gates', 'pending'] as const,
  },

  // Runs
  runs: {
    all: ['runs'] as const,
    list: (filters?: { status?: string; agentType?: string; epicId?: string }) =>
      filters ? ['runs', 'list', filters] as const : ['runs', 'list'] as const,
    detail: (id: string) => ['runs', 'detail', id] as const,
    kpis: () => ['runs', 'kpis'] as const,
    workflow: (runId: string) => ['runs', 'workflow', runId] as const,
  },

  // Artifacts
  artifacts: {
    all: ['artifacts'] as const,
    list: (filters?: { type?: string; epicId?: string; status?: string }) =>
      filters ? ['artifacts', 'list', filters] as const : ['artifacts', 'list'] as const,
    detail: (id: string) => ['artifacts', 'detail', id] as const,
    history: (id: string) => ['artifacts', 'history', id] as const,
    provenance: (id: string) => ['artifacts', 'provenance', id] as const,
    specIndex: () => ['artifacts', 'spec-index'] as const,
  },

  // Sessions
  sessions: {
    all: ['sessions'] as const,
    list: () => ['sessions', 'list'] as const,
    current: () => ['sessions', 'current'] as const,
    detail: (id: string) => ['sessions', 'detail', id] as const,
  },

  // Studio
  studio: {
    all: ['studio'] as const,
    chat: (sessionId: string) => ['studio', 'chat', sessionId] as const,
    outline: (sessionId: string) => ['studio', 'outline', sessionId] as const,
    contextPack: (sessionId: string) => ['studio', 'context-pack', sessionId] as const,
  },

  // Docs
  docs: {
    all: ['docs'] as const,
    list: () => ['docs', 'list'] as const,
    detail: (path: string) => ['docs', 'detail', path] as const,
  },

  // Guardrails
  guardrails: {
    all: ['guardrails'] as const,
    list: (params?: Record<string, unknown>) =>
      params ? ['guardrails', 'list', params] as const : ['guardrails', 'list'] as const,
    detail: (id: string) => ['guardrails', 'detail', id] as const,
    audit: (params?: Record<string, unknown>) =>
      params ? ['guardrails', 'audit', params] as const : ['guardrails', 'audit'] as const,
  },
};

/**
 * Default query client configuration
 */
const defaultOptions = {
  queries: {
    // Stale time: how long before data is considered stale
    staleTime: 1000 * 60 * 5, // 5 minutes

    // Cache time: how long to keep data in cache after becoming unused
    gcTime: 1000 * 60 * 30, // 30 minutes

    // Retry configuration
    retry: 3,
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),

    // Refetch configuration
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  },
  mutations: {
    // Retry configuration for mutations
    retry: 1,
    retryDelay: 1000,
  },
};

/**
 * Create a new QueryClient instance
 */
export function createQueryClient(options?: Partial<typeof defaultOptions>): QueryClient {
  return new QueryClient({
    defaultOptions: {
      ...defaultOptions,
      ...options,
    },
  });
}

/**
 * Singleton query client instance for the application
 */
export const queryClient = createQueryClient();

/**
 * Create a wrapper component for testing
 */
export function createQueryWrapper(client?: QueryClient) {
  const queryClientInstance = client || queryClient;

  return function QueryWrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClientInstance}>
        {children}
      </QueryClientProvider>
    );
  };
}

/**
 * Invalidate all queries related to a specific entity
 */
export function invalidateEntity(entity: keyof typeof QueryKeys) {
  const keys = QueryKeys[entity];
  queryClient.invalidateQueries({ queryKey: keys.all });
}

/**
 * Prefetch a query for faster subsequent loads
 */
export async function prefetchQuery<T>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<T>
) {
  await queryClient.prefetchQuery({
    queryKey,
    queryFn,
  });
}

/**
 * Set query data manually (useful for optimistic updates)
 */
export function setQueryData<T>(
  queryKey: readonly unknown[],
  updater: T | ((old: T | undefined) => T)
) {
  queryClient.setQueryData(queryKey, updater);
}

/**
 * Get query data from cache
 */
export function getQueryData<T>(queryKey: readonly unknown[]): T | undefined {
  return queryClient.getQueryData(queryKey);
}

/**
 * Remove query from cache
 */
export function removeQuery(queryKey: readonly unknown[]) {
  queryClient.removeQueries({ queryKey });
}

// Re-export QueryClientProvider for convenience
export { QueryClientProvider };
