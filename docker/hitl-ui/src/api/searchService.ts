/**
 * SearchService - Abstract interface and factory for KnowledgeStore search
 *
 * Part of P05-F08 KnowledgeStore Search UI
 *
 * Provides a unified interface for different backend implementations:
 * - REST: HTTP calls to /api/knowledge-store/*
 * - GraphQL: GraphQL queries (deferred)
 * - MCP: MCP tool calls (deferred)
 * - Mock: Development mock data
 */

import type {
  SearchQuery,
  SearchResponse,
  KSDocument,
  KSHealthStatus,
  SearchBackendMode,
} from './types';

/**
 * Abstract interface for search service implementations
 */
export interface SearchService {
  /**
   * Search the knowledge store
   * @param query - Search query with optional filters
   * @returns Search response with results and metadata
   */
  search(query: SearchQuery): Promise<SearchResponse>;

  /**
   * Get a document by ID
   * @param docId - Document identifier
   * @returns Document or null if not found
   */
  getDocument(docId: string): Promise<KSDocument | null>;

  /**
   * Check the health of the backend
   * @returns Health status
   */
  healthCheck(): Promise<KSHealthStatus>;
}

// Service registry - populated by implementations
const serviceRegistry: Partial<Record<SearchBackendMode, SearchService>> = {};

/**
 * Register a search service implementation
 * @param mode - Backend mode
 * @param service - Service implementation
 */
export function registerSearchService(
  mode: SearchBackendMode,
  service: SearchService
): void {
  serviceRegistry[mode] = service;
}

/**
 * Get the appropriate search service for the given mode
 * @param mode - Backend mode (rest, graphql, mcp, mock)
 * @returns SearchService implementation
 * @throws Error if no service registered for mode
 */
export function getSearchService(mode: SearchBackendMode): SearchService {
  const service = serviceRegistry[mode];

  if (!service) {
    throw new Error(
      `No search service registered for mode: ${mode}. ` +
        `Available modes: ${Object.keys(serviceRegistry).join(', ')}`
    );
  }

  return service;
}

/**
 * Check if a search service is registered for the given mode
 * @param mode - Backend mode
 * @returns true if service is registered
 */
export function hasSearchService(mode: SearchBackendMode): boolean {
  return mode in serviceRegistry;
}

/**
 * Get the default backend mode from environment
 * Falls back to 'mock' if not specified or invalid
 */
export function getDefaultBackendMode(): SearchBackendMode {
  const envMode = import.meta.env.VITE_SEARCH_BACKEND as string | undefined;
  const useMocks = import.meta.env.VITE_USE_MOCKS === 'true';

  // If mocks are explicitly enabled, use mock mode
  if (useMocks) {
    return 'mock';
  }

  // Validate environment mode
  const validModes: SearchBackendMode[] = ['rest', 'graphql', 'mcp', 'mock'];
  if (envMode && validModes.includes(envMode as SearchBackendMode)) {
    return envMode as SearchBackendMode;
  }

  // Default to mock for development
  return 'mock';
}
