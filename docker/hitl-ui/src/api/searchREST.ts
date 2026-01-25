/**
 * REST Search Service - HTTP implementation for KnowledgeStore search
 *
 * Part of P05-F08 KnowledgeStore Search UI
 *
 * Implements SearchService using REST API calls to the backend.
 */

import { apiClient } from './client';
import { registerSearchService, type SearchService } from './searchService';
import type {
  SearchQuery,
  SearchResponse,
  KSDocument,
  KSHealthStatus,
  KSSearchResult,
  ReindexRequest,
  ReindexResponse,
  ReindexStatus,
} from './types';

// API response types with snake_case (as returned by Python backend)
interface APISearchResult {
  doc_id: string;
  content: string;
  metadata: {
    file_path?: string;
    file_type?: string;
    language?: string;
    line_start?: number;
    line_end?: number;
    indexed_at?: string;
    [key: string]: unknown;
  };
  score: number;
  source: string;
}

interface APISearchResponse {
  results: APISearchResult[];
  total: number;
  query: string;
  took_ms?: number;
}

interface APIDocument {
  doc_id: string;
  content: string;
  metadata: Record<string, unknown>;
}

interface APIHealthStatus {
  status: 'healthy' | 'unhealthy';
  backend: string;
  index_count?: number;
  document_count?: number;
}

/**
 * Convert snake_case API result to camelCase frontend type
 */
function mapSearchResult(result: APISearchResult): KSSearchResult {
  return {
    docId: result.doc_id,
    content: result.content,
    metadata: result.metadata,
    score: result.score,
    source: result.source,
  };
}

/**
 * Convert API document to frontend type
 */
function mapDocument(doc: APIDocument): KSDocument {
  return {
    docId: doc.doc_id,
    content: doc.content,
    metadata: doc.metadata,
  };
}

/**
 * REST implementation of SearchService
 */
export const restSearchService: SearchService = {
  async search(query: SearchQuery): Promise<SearchResponse> {
    const requestBody = {
      query: query.query,
      top_k: query.topK ?? 10,
      filters: query.filters
        ? {
            file_types: query.filters.fileTypes,
            date_from: query.filters.dateFrom,
            date_to: query.filters.dateTo,
            metadata: query.filters.metadata,
          }
        : undefined,
    };

    const response = await apiClient.post<APISearchResponse>(
      '/knowledge-store/search',
      requestBody
    );

    return {
      results: response.data.results.map(mapSearchResult),
      total: response.data.total,
      query: response.data.query,
      took_ms: response.data.took_ms,
    };
  },

  async getDocument(docId: string): Promise<KSDocument | null> {
    try {
      const response = await apiClient.get<APIDocument>(
        `/knowledge-store/documents/${encodeURIComponent(docId)}`
      );
      return mapDocument(response.data);
    } catch (error: unknown) {
      // Handle 404 - document not found
      if (
        error &&
        typeof error === 'object' &&
        'response' in error &&
        (error as { response?: { status?: number } }).response?.status === 404
      ) {
        return null;
      }
      throw error;
    }
  },

  async healthCheck(): Promise<KSHealthStatus> {
    const response = await apiClient.get<APIHealthStatus>(
      '/knowledge-store/health'
    );

    return {
      status: response.data.status,
      backend: response.data.backend,
      index_count: response.data.index_count,
      document_count: response.data.document_count,
    };
  },
};

// Register with factory
registerSearchService('rest', restSearchService);

// ============================================================================
// Reindex API Functions (admin operations, not part of SearchService)
// ============================================================================

interface APIReindexResponse {
  status: 'started' | 'already_running' | 'completed';
  job_id: string | null;
  message: string;
}

interface APIReindexStatus {
  status: 'idle' | 'running' | 'completed' | 'failed';
  job_id: string | null;
  progress: number | null;
  files_indexed: number | null;
  total_files: number | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
}

/**
 * Trigger a reindex of the knowledge store
 */
export async function triggerReindex(request: ReindexRequest = {}): Promise<ReindexResponse> {
  const response = await apiClient.post<APIReindexResponse>(
    '/knowledge-store/reindex',
    {
      path: request.path,
      force: request.force ?? false,
    }
  );

  return {
    status: response.data.status,
    job_id: response.data.job_id ?? undefined,
    message: response.data.message,
  };
}

/**
 * Get the current reindex status
 */
export async function getReindexStatus(): Promise<ReindexStatus> {
  const response = await apiClient.get<APIReindexStatus>(
    '/knowledge-store/reindex/status'
  );

  return {
    status: response.data.status,
    job_id: response.data.job_id ?? undefined,
    progress: response.data.progress ?? undefined,
    files_indexed: response.data.files_indexed ?? undefined,
    total_files: response.data.total_files ?? undefined,
    error: response.data.error ?? undefined,
    started_at: response.data.started_at ?? undefined,
    completed_at: response.data.completed_at ?? undefined,
  };
}
