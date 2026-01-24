import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { apiClient } from './client';
import {
  listDocuments,
  getDocument,
  listDiagrams,
  getDiagram,
  useDocuments,
  useDocument,
  useDiagrams,
  useDiagram,
} from './docs';
import type { DocumentMeta, DocumentContent, DiagramMeta, DiagramContent } from './types';

// Mock the API client
vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

// Mock the environment variable checker
vi.mock('../config/env', () => ({
  useMocks: () => false,
}));

describe('Docs API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listDocuments', () => {
    it('should fetch documents list', async () => {
      const mockDocuments: DocumentMeta[] = [
        {
          id: 'system-design',
          title: 'System Design',
          path: 'System_Design.md',
          category: 'system',
          description: 'Core system architecture',
        },
        {
          id: 'main-features',
          title: 'Main Features',
          path: 'Main_Features.md',
          category: 'feature',
          description: 'Feature specifications',
        },
      ];

      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: mockDocuments,
      });

      const result = await listDocuments();

      expect(apiClient.get).toHaveBeenCalledWith('/docs');
      expect(result).toEqual(mockDocuments);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('system-design');
    });

    it('should return metadata array', async () => {
      const mockDocuments: DocumentMeta[] = [
        {
          id: 'doc-1',
          title: 'Doc 1',
          path: 'doc1.md',
          category: 'system',
          description: 'Description 1',
        },
      ];

      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: mockDocuments,
      });

      const docs = await listDocuments();

      expect(Array.isArray(docs)).toBe(true);
      expect(docs[0]).toHaveProperty('id');
      expect(docs[0]).toHaveProperty('title');
      expect(docs[0]).toHaveProperty('path');
      expect(docs[0]).toHaveProperty('category');
    });
  });

  describe('getDocument', () => {
    it('should fetch document by ID', async () => {
      const mockDocument: DocumentContent = {
        meta: {
          id: 'system-design',
          title: 'System Design',
          path: 'System_Design.md',
          category: 'system',
          description: 'Core system architecture',
        },
        content: '# System Design\n\nContent here...',
      };

      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: mockDocument,
      });

      const result = await getDocument('system-design');

      expect(apiClient.get).toHaveBeenCalledWith('/docs/system-design');
      expect(result).toEqual(mockDocument);
      expect(result.meta.id).toBe('system-design');
      expect(result.content).toContain('System Design');
    });

    it('should return content with meta', async () => {
      const mockDocument: DocumentContent = {
        meta: {
          id: 'test-doc',
          title: 'Test',
          path: 'test.md',
          category: 'system',
          description: 'Test',
        },
        content: '# Test',
      };

      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: mockDocument,
      });

      const doc = await getDocument('test-doc');

      expect(doc).toHaveProperty('meta');
      expect(doc).toHaveProperty('content');
      expect(doc.meta).toHaveProperty('id');
    });
  });

  describe('listDiagrams', () => {
    it('should fetch diagrams list', async () => {
      const mockDiagrams: DiagramMeta[] = [
        {
          id: '01-system-architecture',
          title: 'System Architecture',
          filename: '01-System-Architecture.mmd',
          category: 'architecture',
          description: 'System component overview',
        },
        {
          id: '02-container-topology',
          title: 'Container Topology',
          filename: '02-Container-Topology.mmd',
          category: 'architecture',
          description: 'Docker container deployment model',
        },
      ];

      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: mockDiagrams,
      });

      const result = await listDiagrams();

      expect(apiClient.get).toHaveBeenCalledWith('/diagrams');
      expect(result).toEqual(mockDiagrams);
      expect(result).toHaveLength(2);
    });

    it('should return diagram metadata array', async () => {
      const mockDiagrams: DiagramMeta[] = [
        {
          id: 'diagram-1',
          title: 'Diagram 1',
          filename: 'diagram1.mmd',
          category: 'flow',
          description: 'Desc 1',
        },
      ];

      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: mockDiagrams,
      });

      const diagrams = await listDiagrams();

      expect(Array.isArray(diagrams)).toBe(true);
      expect(diagrams[0]).toHaveProperty('id');
      expect(diagrams[0]).toHaveProperty('title');
      expect(diagrams[0]).toHaveProperty('filename');
      expect(diagrams[0]).toHaveProperty('category');
    });
  });

  describe('getDiagram', () => {
    it('should fetch diagram by ID', async () => {
      const mockDiagram: DiagramContent = {
        meta: {
          id: '01-system-architecture',
          title: 'System Architecture',
          filename: '01-System-Architecture.mmd',
          category: 'architecture',
          description: 'System component overview',
        },
        content: 'graph TD\n  A-->B',
      };

      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: mockDiagram,
      });

      const result = await getDiagram('01-system-architecture');

      expect(apiClient.get).toHaveBeenCalledWith('/diagrams/01-system-architecture');
      expect(result).toEqual(mockDiagram);
      expect(result.meta.id).toBe('01-system-architecture');
      expect(result.content).toContain('graph TD');
    });

    it('should return content with meta', async () => {
      const mockDiagram: DiagramContent = {
        meta: {
          id: 'test-diagram',
          title: 'Test',
          filename: 'test.mmd',
          category: 'flow',
          description: 'Test',
        },
        content: 'graph LR; A-->B',
      };

      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: mockDiagram,
      });

      const diagram = await getDiagram('test-diagram');

      expect(diagram).toHaveProperty('meta');
      expect(diagram).toHaveProperty('content');
    });
  });
});

describe('Docs Hooks', () => {
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('useDocuments', () => {
    it('returns query result', async () => {
      const mockDocuments: DocumentMeta[] = [
        {
          id: 'doc-1',
          title: 'Doc 1',
          path: 'doc1.md',
          category: 'system',
          description: 'Desc',
        },
      ];

      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: mockDocuments,
      });

      const { result } = renderHook(() => useDocuments(), { wrapper });

      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('error');

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(mockDocuments);
    });
  });

  describe('useDocument', () => {
    it('fetches document when ID provided', async () => {
      const mockDocument: DocumentContent = {
        meta: {
          id: 'doc-1',
          title: 'Doc 1',
          path: 'doc1.md',
          category: 'system',
          description: 'Desc',
        },
        content: '# Doc 1',
      };

      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: mockDocument,
      });

      const { result } = renderHook(() => useDocument('doc-1'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(mockDocument);
    });

    it('does not fetch when ID is undefined', async () => {
      const { result } = renderHook(() => useDocument(undefined), { wrapper });

      expect(result.current.isLoading).toBe(false);
      expect(apiClient.get).not.toHaveBeenCalled();
    });
  });

  describe('useDiagrams', () => {
    it('returns query result', async () => {
      const mockDiagrams: DiagramMeta[] = [
        {
          id: 'diagram-1',
          title: 'Diagram 1',
          filename: 'diagram1.mmd',
          category: 'flow',
          description: 'Desc',
        },
      ];

      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: mockDiagrams,
      });

      const { result } = renderHook(() => useDiagrams(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(mockDiagrams);
    });
  });

  describe('useDiagram', () => {
    it('fetches diagram when ID provided', async () => {
      const mockDiagram: DiagramContent = {
        meta: {
          id: 'diagram-1',
          title: 'Diagram 1',
          filename: 'diagram1.mmd',
          category: 'flow',
          description: 'Desc',
        },
        content: 'graph TD; A-->B',
      };

      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: mockDiagram,
      });

      const { result } = renderHook(() => useDiagram('diagram-1'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(mockDiagram);
    });

    it('does not fetch when ID is undefined', async () => {
      const { result } = renderHook(() => useDiagram(undefined), { wrapper });

      expect(result.current.isLoading).toBe(false);
      expect(apiClient.get).not.toHaveBeenCalled();
    });
  });
});
