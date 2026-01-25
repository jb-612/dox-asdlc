/**
 * Tests for KnowledgeStore Search mock data (P05-F08)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  mockSearchResults,
  mockSearchService,
  availableFileTypes,
  delay,
} from './search';
import { hasSearchService, getSearchService } from '../searchService';

describe('search mock data', () => {
  describe('service registration', () => {
    it('registers mock service with factory', () => {
      expect(hasSearchService('mock')).toBe(true);
    });

    it('returns mock service from factory', () => {
      const service = getSearchService('mock');
      expect(service).toBe(mockSearchService);
    });
  });

  describe('mockSearchResults', () => {
    it('has at least 15 mock results', () => {
      expect(mockSearchResults.length).toBeGreaterThanOrEqual(15);
    });

    it('includes various file types', () => {
      const types = new Set(mockSearchResults.map((r) => r.metadata.file_type));
      expect(types.has('.py')).toBe(true);
      expect(types.has('.ts')).toBe(true);
      expect(types.has('.tsx')).toBe(true);
      expect(types.has('.md')).toBe(true);
      expect(types.has('.json')).toBe(true);
    });

    it('all results have required fields', () => {
      mockSearchResults.forEach((result) => {
        expect(result).toHaveProperty('docId');
        expect(result).toHaveProperty('content');
        expect(result).toHaveProperty('score');
        expect(result).toHaveProperty('source');
        expect(result.metadata).toHaveProperty('file_path');
        expect(result.metadata).toHaveProperty('file_type');
      });
    });

    it('all scores are between 0 and 1', () => {
      mockSearchResults.forEach((result) => {
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
      });
    });

    it('all results have valid metadata', () => {
      mockSearchResults.forEach((result) => {
        expect(typeof result.metadata.file_path).toBe('string');
        expect(typeof result.metadata.file_type).toBe('string');
        if (result.metadata.line_start !== undefined) {
          expect(typeof result.metadata.line_start).toBe('number');
        }
        if (result.metadata.line_end !== undefined) {
          expect(typeof result.metadata.line_end).toBe('number');
        }
      });
    });
  });

  describe('mockSearchService', () => {
    describe('search', () => {
      it('returns results matching query', async () => {
        const response = await mockSearchService.search({
          query: 'KnowledgeStore',
          topK: 5,
        });

        expect(response.results.length).toBeGreaterThan(0);
        expect(response.results.length).toBeLessThanOrEqual(5);
        expect(response.query).toBe('KnowledgeStore');
      });

      it('returns empty results for empty query', async () => {
        const response = await mockSearchService.search({
          query: '',
        });

        expect(response.results).toHaveLength(0);
        expect(response.total).toBe(0);
      });

      it('applies file type filter', async () => {
        const response = await mockSearchService.search({
          query: 'class',
          filters: { fileTypes: ['.py'] },
        });

        response.results.forEach((r) => {
          expect(r.metadata.file_type).toBe('.py');
        });
      });

      it('applies multiple file type filters', async () => {
        const response = await mockSearchService.search({
          query: 'class',
          filters: { fileTypes: ['.py', '.ts'] },
        });

        response.results.forEach((r) => {
          expect(['.py', '.ts']).toContain(r.metadata.file_type);
        });
      });

      it('respects topK parameter', async () => {
        const response = await mockSearchService.search({
          query: 'class',
          topK: 3,
        });

        expect(response.results.length).toBeLessThanOrEqual(3);
      });

      it('sorts results by score descending', async () => {
        const response = await mockSearchService.search({
          query: 'class',
        });

        for (let i = 1; i < response.results.length; i++) {
          expect(response.results[i - 1].score).toBeGreaterThanOrEqual(
            response.results[i].score
          );
        }
      });

      it('includes took_ms in response', async () => {
        const response = await mockSearchService.search({
          query: 'test',
        });

        expect(response.took_ms).toBeDefined();
        expect(typeof response.took_ms).toBe('number');
      });

      it('matches on file path as well as content', async () => {
        const response = await mockSearchService.search({
          query: 'gates',
        });

        // Should find results with 'gates' in the file path
        const hasGatesPath = response.results.some(
          (r) => r.metadata.file_path?.includes('gates')
        );
        expect(hasGatesPath).toBe(true);
      });
    });

    describe('getDocument', () => {
      it('returns document for valid docId', async () => {
        const doc = await mockSearchService.getDocument('src/core/interfaces.py:0');
        expect(doc).not.toBeNull();
        expect(doc?.docId).toBe('src/core/interfaces.py:0');
        expect(doc?.content).toBeDefined();
      });

      it('returns null for nonexistent docId', async () => {
        const doc = await mockSearchService.getDocument('nonexistent-doc-id');
        expect(doc).toBeNull();
      });

      it('returns document from search results if not in documents map', async () => {
        // Use a docId from search results that might not be in the detailed documents
        const searchResult = mockSearchResults[1];
        const doc = await mockSearchService.getDocument(searchResult.docId);

        expect(doc).not.toBeNull();
        expect(doc?.docId).toBe(searchResult.docId);
      });
    });

    describe('healthCheck', () => {
      it('returns healthy status', async () => {
        const health = await mockSearchService.healthCheck();

        expect(health.status).toBe('healthy');
        expect(health.backend).toBe('mock');
      });

      it('includes document count', async () => {
        const health = await mockSearchService.healthCheck();

        expect(health.document_count).toBe(mockSearchResults.length);
        expect(health.index_count).toBe(1);
      });
    });
  });

  describe('availableFileTypes', () => {
    it('includes common file types', () => {
      expect(availableFileTypes).toContain('.py');
      expect(availableFileTypes).toContain('.ts');
      expect(availableFileTypes).toContain('.tsx');
      expect(availableFileTypes).toContain('.md');
      expect(availableFileTypes).toContain('.json');
    });
  });

  describe('delay helper', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('delays for specified time', async () => {
      const callback = vi.fn();

      delay(100).then(callback);

      expect(callback).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(100);

      expect(callback).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });
});
