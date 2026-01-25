/**
 * Tests for React Query search hooks
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useSearch, useDocument, useKnowledgeHealth, searchKeys } from './searchHooks';
import { mockSearchService } from './mocks/search';

// Create a wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe('searchHooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('searchKeys', () => {
    it('generates correct search key', () => {
      const key = searchKeys.search({ query: 'test', topK: 10 }, 'mock');
      expect(key).toEqual([
        'knowledge-search',
        'search',
        { query: 'test', topK: 10 },
        'mock',
      ]);
    });

    it('generates correct document key', () => {
      const key = searchKeys.document('doc-123', 'rest');
      expect(key).toEqual(['knowledge-search', 'document', 'doc-123', 'rest']);
    });

    it('generates correct health key', () => {
      const key = searchKeys.health('mock');
      expect(key).toEqual(['knowledge-search', 'health', 'mock']);
    });
  });

  describe('useSearch', () => {
    it('returns results for valid query', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useSearch({ query: 'KnowledgeStore', topK: 5 }, { mode: 'mock' }),
        { wrapper }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.results.length).toBeGreaterThan(0);
      expect(result.current.data?.query).toBe('KnowledgeStore');
    });

    it('is disabled without query', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useSearch(null, { mode: 'mock' }), {
        wrapper,
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });

    it('is disabled with empty query string', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useSearch({ query: '   ' }, { mode: 'mock' }),
        { wrapper }
      );

      expect(result.current.isLoading).toBe(false);
    });

    it('respects enabled option', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () =>
          useSearch({ query: 'test' }, { mode: 'mock', enabled: false }),
        { wrapper }
      );

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });

    it('applies filters to search', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () =>
          useSearch(
            {
              query: 'class',
              topK: 10,
              filters: { fileTypes: ['.py'] },
            },
            { mode: 'mock' }
          ),
        { wrapper }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // All results should be Python files
      result.current.data?.results.forEach((r) => {
        expect(r.metadata.file_type).toBe('.py');
      });
    });
  });

  describe('useDocument', () => {
    it('returns document for valid docId', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useDocument('src/core/interfaces.py:0', { mode: 'mock' }),
        { wrapper }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.docId).toBe('src/core/interfaces.py:0');
      expect(result.current.data?.content).toBeDefined();
    });

    it('is disabled without docId', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useDocument(null, { mode: 'mock' }), {
        wrapper,
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });

    it('returns null for nonexistent document', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useDocument('nonexistent-doc', { mode: 'mock' }),
        { wrapper }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeNull();
    });
  });

  describe('useKnowledgeHealth', () => {
    it('returns health status', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useKnowledgeHealth({ mode: 'mock' }),
        { wrapper }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.status).toBe('healthy');
      expect(result.current.data?.backend).toBe('mock');
    });

    it('includes document count', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useKnowledgeHealth({ mode: 'mock' }),
        { wrapper }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.document_count).toBeGreaterThan(0);
    });

    it('respects enabled option', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useKnowledgeHealth({ mode: 'mock', enabled: false }),
        { wrapper }
      );

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });
  });
});
