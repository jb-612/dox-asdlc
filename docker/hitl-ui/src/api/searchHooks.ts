/**
 * React Query hooks for KnowledgeStore search
 *
 * Part of P05-F08 KnowledgeStore Search UI
 *
 * Provides hooks for search, document retrieval, and health checks
 * with automatic caching and refetching.
 */

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import {
  getSearchService,
  getDefaultBackendMode,
} from './searchService';
import type {
  SearchQuery,
  SearchResponse,
  KSDocument,
  KSHealthStatus,
  SearchBackendMode,
} from './types';

// Import service implementations to ensure they're registered
import './mocks/search';
import './searchREST';

// ============================================================================
// Query Key Factory
// ============================================================================

/**
 * Query key factory for knowledge store queries
 * Provides consistent keys for React Query caching
 */
export const searchKeys = {
  all: ['knowledge-search'] as const,
  search: (query: SearchQuery | null, mode: SearchBackendMode) =>
    [...searchKeys.all, 'search', query, mode] as const,
  document: (docId: string | null, mode: SearchBackendMode) =>
    [...searchKeys.all, 'document', docId, mode] as const,
  health: (mode: SearchBackendMode) =>
    [...searchKeys.all, 'health', mode] as const,
};

// ============================================================================
// useSearch Hook
// ============================================================================

/**
 * Options for useSearch hook
 */
export interface UseSearchOptions {
  /** Backend mode to use. Defaults to environment configuration */
  mode?: SearchBackendMode;
  /** Time in ms before data is considered stale */
  staleTime?: number;
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Hook for searching the knowledge store
 *
 * @param query - Search query (null to disable)
 * @param options - Hook options
 * @returns Query result with search response
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useSearch(
 *   { query: 'KnowledgeStore', topK: 10 },
 *   { mode: 'mock' }
 * );
 * ```
 */
export function useSearch(
  query: SearchQuery | null,
  options: UseSearchOptions = {}
) {
  const {
    mode = getDefaultBackendMode(),
    staleTime = 30 * 1000, // 30 seconds
    enabled = true,
  } = options;

  return useQuery<SearchResponse, Error>({
    queryKey: searchKeys.search(query, mode),
    queryFn: async () => {
      if (!query || !query.query.trim()) {
        return { results: [], total: 0, query: '' };
      }
      const service = getSearchService(mode);
      return service.search(query);
    },
    enabled: enabled && !!query?.query?.trim(),
    staleTime,
  });
}

// ============================================================================
// useDocument Hook
// ============================================================================

/**
 * Options for useDocument hook
 */
export interface UseDocumentOptions {
  /** Backend mode to use. Defaults to environment configuration */
  mode?: SearchBackendMode;
  /** Time in ms before data is considered stale */
  staleTime?: number;
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Hook for fetching a document by ID
 *
 * @param docId - Document ID (null to disable)
 * @param options - Hook options
 * @returns Query result with document
 *
 * @example
 * ```tsx
 * const { data: document, isLoading } = useDocument(
 *   'src/core/interfaces.py:0',
 *   { mode: 'mock' }
 * );
 * ```
 */
export function useDocument(
  docId: string | null,
  options: UseDocumentOptions = {}
) {
  const {
    mode = getDefaultBackendMode(),
    staleTime = 5 * 60 * 1000, // 5 minutes
    enabled = true,
  } = options;

  return useQuery<KSDocument | null, Error>({
    queryKey: searchKeys.document(docId, mode),
    queryFn: async () => {
      if (!docId) return null;
      const service = getSearchService(mode);
      return service.getDocument(docId);
    },
    enabled: enabled && !!docId,
    staleTime,
  });
}

// ============================================================================
// useKnowledgeHealth Hook
// ============================================================================

/**
 * Options for useKnowledgeHealth hook
 */
export interface UseKnowledgeHealthOptions {
  /** Backend mode to use. Defaults to environment configuration */
  mode?: SearchBackendMode;
  /** Time in ms before data is considered stale */
  staleTime?: number;
  /** Interval in ms to refetch */
  refetchInterval?: number;
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Hook for checking knowledge store health
 *
 * @param options - Hook options
 * @returns Query result with health status
 *
 * @example
 * ```tsx
 * const { data: health, isLoading } = useKnowledgeHealth({ mode: 'rest' });
 * ```
 */
export function useKnowledgeHealth(options: UseKnowledgeHealthOptions = {}) {
  const {
    mode = getDefaultBackendMode(),
    staleTime = 60 * 1000, // 1 minute
    refetchInterval = 60 * 1000, // 1 minute
    enabled = true,
  } = options;

  return useQuery<KSHealthStatus, Error>({
    queryKey: searchKeys.health(mode),
    queryFn: async () => {
      const service = getSearchService(mode);
      return service.healthCheck();
    },
    enabled,
    staleTime,
    refetchInterval,
  });
}
