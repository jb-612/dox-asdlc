/**
 * Documentation API endpoints
 *
 * Handles fetching documents and diagrams with React Query hooks
 * and mock fallback support.
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';
import type {
  DocumentMeta,
  DocumentContent,
  DiagramMeta,
  DiagramContent,
} from './types';
import {
  listMockDocuments,
  listMockDiagrams,
  getMockDocumentContent,
  getMockDiagramContent,
} from './mocks/docs';

// Check if we should use mocks
const shouldUseMocks = (): boolean => {
  return import.meta.env.VITE_USE_MOCKS === 'true';
};

// ============================================================================
// API Functions
// ============================================================================

/**
 * List all available documents
 */
export async function listDocuments(): Promise<DocumentMeta[]> {
  if (shouldUseMocks()) {
    return listMockDocuments();
  }
  const response = await apiClient.get<DocumentMeta[]>('/docs');
  return response.data;
}

/**
 * Get a document by ID with its content
 */
export async function getDocument(docId: string): Promise<DocumentContent> {
  if (shouldUseMocks()) {
    const doc = getMockDocumentContent(docId);
    if (!doc) {
      throw new Error(`Document not found: ${docId}`);
    }
    return doc;
  }
  const response = await apiClient.get<DocumentContent>(`/docs/${docId}`);
  return response.data;
}

/**
 * List all available diagrams
 */
export async function listDiagrams(): Promise<DiagramMeta[]> {
  if (shouldUseMocks()) {
    return listMockDiagrams();
  }
  const response = await apiClient.get<DiagramMeta[]>('/diagrams');
  return response.data;
}

/**
 * Get a diagram by ID with its content
 */
export async function getDiagram(diagramId: string): Promise<DiagramContent> {
  if (shouldUseMocks()) {
    const diagram = await getMockDiagramContent(diagramId);
    if (!diagram) {
      throw new Error(`Diagram not found: ${diagramId}`);
    }
    return diagram;
  }
  const response = await apiClient.get<DiagramContent>(`/diagrams/${diagramId}`);
  return response.data;
}

// ============================================================================
// React Query Hooks
// ============================================================================

/** Stale time for documentation queries (5 minutes) */
const DOCS_STALE_TIME = 5 * 60 * 1000;

/**
 * Hook to fetch all documents
 */
export function useDocuments() {
  return useQuery({
    queryKey: ['documents'],
    queryFn: listDocuments,
    staleTime: DOCS_STALE_TIME,
  });
}

/**
 * Hook to fetch a single document by ID
 */
export function useDocument(docId: string | undefined) {
  return useQuery({
    queryKey: ['document', docId],
    queryFn: () => getDocument(docId!),
    enabled: !!docId,
    staleTime: DOCS_STALE_TIME,
  });
}

/**
 * Hook to fetch all diagrams
 */
export function useDiagrams() {
  return useQuery({
    queryKey: ['diagrams'],
    queryFn: listDiagrams,
    staleTime: DOCS_STALE_TIME,
  });
}

/**
 * Hook to fetch a single diagram by ID
 */
export function useDiagram(diagramId: string | undefined) {
  return useQuery({
    queryKey: ['diagram', diagramId],
    queryFn: () => getDiagram(diagramId!),
    enabled: !!diagramId,
    staleTime: DOCS_STALE_TIME,
  });
}

/**
 * Hook to fetch documents filtered by category
 */
export function useDocumentsByCategory(category: DocumentMeta['category']) {
  const { data: documents, ...rest } = useDocuments();

  const filteredDocuments = documents?.filter((doc) => doc.category === category);

  return {
    data: filteredDocuments,
    ...rest,
  };
}

/**
 * Hook to fetch diagrams filtered by category
 */
export function useDiagramsByCategory(category: DiagramMeta['category']) {
  const { data: diagrams, ...rest } = useDiagrams();

  const filteredDiagrams = diagrams?.filter((d) => d.category === category);

  return {
    data: filteredDiagrams,
    ...rest,
  };
}
