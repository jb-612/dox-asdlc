/**
 * Tests for REST Search Service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { restSearchService } from './searchREST';
import { apiClient } from './client';
import { hasSearchService, getSearchService } from './searchService';

// Mock the apiClient
vi.mock('./client', () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

describe('restSearchService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('service registration', () => {
    it('registers with factory', () => {
      expect(hasSearchService('rest')).toBe(true);
    });

    it('returns rest service from factory', () => {
      const service = getSearchService('rest');
      expect(service).toBe(restSearchService);
    });
  });

  describe('search', () => {
    it('calls correct endpoint', async () => {
      const mockResponse = {
        data: {
          results: [],
          total: 0,
          query: 'test',
          took_ms: 10,
        },
      };
      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);

      await restSearchService.search({ query: 'test' });

      expect(apiClient.post).toHaveBeenCalledWith(
        '/knowledge-store/search',
        expect.objectContaining({ query: 'test' })
      );
    });

    it('sends top_k in snake_case', async () => {
      const mockResponse = {
        data: {
          results: [],
          total: 0,
          query: 'test',
        },
      };
      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);

      await restSearchService.search({ query: 'test', topK: 5 });

      expect(apiClient.post).toHaveBeenCalledWith(
        '/knowledge-store/search',
        expect.objectContaining({ top_k: 5 })
      );
    });

    it('converts filters to snake_case', async () => {
      const mockResponse = {
        data: {
          results: [],
          total: 0,
          query: 'test',
        },
      };
      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);

      await restSearchService.search({
        query: 'test',
        filters: {
          fileTypes: ['.py'],
          dateFrom: '2026-01-01',
          dateTo: '2026-01-31',
        },
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        '/knowledge-store/search',
        expect.objectContaining({
          filters: {
            file_types: ['.py'],
            date_from: '2026-01-01',
            date_to: '2026-01-31',
            metadata: undefined,
          },
        })
      );
    });

    it('maps doc_id to docId in results', async () => {
      const mockResponse = {
        data: {
          results: [
            {
              doc_id: 'test-doc-1',
              content: 'test content',
              metadata: { file_path: 'test.py' },
              score: 0.9,
              source: 'elasticsearch',
            },
          ],
          total: 1,
          query: 'test',
        },
      };
      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);

      const response = await restSearchService.search({ query: 'test' });

      expect(response.results[0].docId).toBe('test-doc-1');
      expect(response.results[0].content).toBe('test content');
      expect(response.results[0].score).toBe(0.9);
    });

    it('returns total and query in response', async () => {
      const mockResponse = {
        data: {
          results: [],
          total: 42,
          query: 'search term',
          took_ms: 15,
        },
      };
      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);

      const response = await restSearchService.search({ query: 'search term' });

      expect(response.total).toBe(42);
      expect(response.query).toBe('search term');
      expect(response.took_ms).toBe(15);
    });
  });

  describe('getDocument', () => {
    it('calls correct endpoint with encoded docId', async () => {
      const mockResponse = {
        data: {
          doc_id: 'src/core/file.py:0',
          content: 'content',
          metadata: {},
        },
      };
      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      await restSearchService.getDocument('src/core/file.py:0');

      expect(apiClient.get).toHaveBeenCalledWith(
        '/knowledge-store/documents/src%2Fcore%2Ffile.py%3A0'
      );
    });

    it('maps doc_id to docId in result', async () => {
      const mockResponse = {
        data: {
          doc_id: 'test-doc',
          content: 'document content',
          metadata: { language: 'python' },
        },
      };
      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      const doc = await restSearchService.getDocument('test-doc');

      expect(doc?.docId).toBe('test-doc');
      expect(doc?.content).toBe('document content');
      expect(doc?.metadata).toEqual({ language: 'python' });
    });

    it('returns null for 404 response', async () => {
      vi.mocked(apiClient.get).mockRejectedValue({
        response: { status: 404 },
      });

      const doc = await restSearchService.getDocument('nonexistent');

      expect(doc).toBeNull();
    });

    it('throws for other errors', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Network error'));

      await expect(restSearchService.getDocument('test')).rejects.toThrow(
        'Network error'
      );
    });
  });

  describe('healthCheck', () => {
    it('calls correct endpoint', async () => {
      const mockResponse = {
        data: {
          status: 'healthy',
          backend: 'elasticsearch',
          index_count: 1,
          document_count: 100,
        },
      };
      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      await restSearchService.healthCheck();

      expect(apiClient.get).toHaveBeenCalledWith('/knowledge-store/health');
    });

    it('returns health status', async () => {
      const mockResponse = {
        data: {
          status: 'healthy',
          backend: 'elasticsearch',
          index_count: 2,
          document_count: 500,
        },
      };
      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      const health = await restSearchService.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.backend).toBe('elasticsearch');
      expect(health.index_count).toBe(2);
      expect(health.document_count).toBe(500);
    });

    it('handles unhealthy status', async () => {
      const mockResponse = {
        data: {
          status: 'unhealthy',
          backend: 'elasticsearch',
        },
      };
      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      const health = await restSearchService.healthCheck();

      expect(health.status).toBe('unhealthy');
    });
  });
});
