/**
 * Classification API client (P08-F03)
 *
 * Handles classification operations and taxonomy management.
 * Enable mock mode with VITE_USE_MOCKS=true
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  LabelDefinition,
  LabelTaxonomy,
  ClassificationResult,
  ClassificationJob,
} from '../types/classification';
import {
  getMockTaxonomy,
  getMockLabels,
  getMockLabelById,
  addMockLabel,
  updateMockLabel,
  deleteMockLabel,
  getMockClassificationResult,
  classifyMockIdea,
  createMockBatchJob,
  getMockJob,
  simulateClassificationDelay,
} from './mocks/classification';

const API_BASE = '/api';
const USE_MOCK = import.meta.env.VITE_USE_MOCKS === 'true';

// ============================================================================
// Query Keys
// ============================================================================

export const classificationQueryKeys = {
  all: ['classification'] as const,
  taxonomy: () => [...classificationQueryKeys.all, 'taxonomy'] as const,
  labels: () => [...classificationQueryKeys.all, 'labels'] as const,
  label: (id: string) => [...classificationQueryKeys.labels(), id] as const,
  result: (ideaId: string) => [...classificationQueryKeys.all, 'result', ideaId] as const,
  job: (jobId: string) => [...classificationQueryKeys.all, 'job', jobId] as const,
};

// ============================================================================
// Taxonomy API
// ============================================================================

/**
 * Fetch the current taxonomy
 */
export async function fetchTaxonomy(): Promise<LabelTaxonomy> {
  if (USE_MOCK) {
    await simulateClassificationDelay();
    return getMockTaxonomy();
  }

  const res = await fetch(`${API_BASE}/admin/labels/taxonomy`);
  if (!res.ok) {
    throw new Error(`Failed to fetch taxonomy: ${res.statusText}`);
  }
  const data = await res.json();
  return data.taxonomy;
}

/**
 * Fetch all labels from the taxonomy
 */
export async function fetchLabels(): Promise<LabelDefinition[]> {
  if (USE_MOCK) {
    await simulateClassificationDelay();
    return getMockLabels();
  }

  const res = await fetch(`${API_BASE}/admin/labels/taxonomy/labels`);
  if (!res.ok) {
    throw new Error(`Failed to fetch labels: ${res.statusText}`);
  }
  const data = await res.json();
  return data.labels;
}

/**
 * Add a new label to the taxonomy
 */
export async function createLabel(
  label: Omit<LabelDefinition, 'id'> & { id?: string }
): Promise<LabelDefinition> {
  if (USE_MOCK) {
    await simulateClassificationDelay(150, 300);
    return addMockLabel(label);
  }

  const res = await fetch(`${API_BASE}/admin/labels/taxonomy/labels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(label),
  });

  if (!res.ok) {
    throw new Error(`Failed to create label: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Update an existing label
 */
export async function updateLabel(
  id: string,
  updates: Partial<LabelDefinition>
): Promise<LabelDefinition> {
  if (USE_MOCK) {
    await simulateClassificationDelay(100, 200);
    const result = updateMockLabel(id, updates);
    if (!result) {
      throw new Error('Label not found');
    }
    return result;
  }

  const res = await fetch(`${API_BASE}/admin/labels/taxonomy/labels/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    throw new Error(`Failed to update label: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Delete a label from the taxonomy
 */
export async function deleteLabel(id: string): Promise<void> {
  if (USE_MOCK) {
    await simulateClassificationDelay(100, 200);
    deleteMockLabel(id);
    return;
  }

  const res = await fetch(`${API_BASE}/admin/labels/taxonomy/labels/${id}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    throw new Error(`Failed to delete label: ${res.statusText}`);
  }
}

// ============================================================================
// Classification API
// ============================================================================

/**
 * Get classification result for an idea
 */
export async function fetchClassification(ideaId: string): Promise<ClassificationResult | null> {
  if (USE_MOCK) {
    await simulateClassificationDelay();
    return getMockClassificationResult(ideaId) || null;
  }

  const res = await fetch(`${API_BASE}/ideas/${ideaId}/classification`);
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch classification: ${res.statusText}`);
  }
  const data = await res.json();
  return data.result;
}

/**
 * Trigger classification for an idea
 */
export async function classifyIdea(ideaId: string): Promise<ClassificationResult> {
  if (USE_MOCK) {
    await simulateClassificationDelay(500, 1000);
    return classifyMockIdea(ideaId);
  }

  const res = await fetch(`${API_BASE}/ideas/${ideaId}/classify`, {
    method: 'POST',
  });

  if (!res.ok) {
    throw new Error(`Failed to classify idea: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Start batch classification job
 */
export async function classifyBatch(ideaIds: string[]): Promise<ClassificationJob> {
  if (USE_MOCK) {
    await simulateClassificationDelay(100, 200);
    return createMockBatchJob(ideaIds);
  }

  const res = await fetch(`${API_BASE}/ideas/classify/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idea_ids: ideaIds }),
  });

  if (!res.ok) {
    throw new Error(`Failed to start batch classification: ${res.statusText}`);
  }
  const data = await res.json();
  return data.job;
}

/**
 * Get batch classification job status
 */
export async function fetchJob(jobId: string): Promise<ClassificationJob | null> {
  if (USE_MOCK) {
    await simulateClassificationDelay(50, 100);
    return getMockJob(jobId) || null;
  }

  const res = await fetch(`${API_BASE}/ideas/classify/job/${jobId}`);
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch job: ${res.statusText}`);
  }
  const data = await res.json();
  return data.job;
}

// ============================================================================
// React Query Hooks
// ============================================================================

/**
 * Hook to fetch taxonomy
 */
export function useTaxonomy() {
  return useQuery({
    queryKey: classificationQueryKeys.taxonomy(),
    queryFn: fetchTaxonomy,
  });
}

/**
 * Hook to fetch labels
 */
export function useLabels() {
  return useQuery({
    queryKey: classificationQueryKeys.labels(),
    queryFn: fetchLabels,
  });
}

/**
 * Hook to create a new label
 */
export function useCreateLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createLabel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: classificationQueryKeys.labels() });
      queryClient.invalidateQueries({ queryKey: classificationQueryKeys.taxonomy() });
    },
  });
}

/**
 * Hook to update a label
 */
export function useUpdateLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<LabelDefinition> }) =>
      updateLabel(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: classificationQueryKeys.labels() });
      queryClient.invalidateQueries({ queryKey: classificationQueryKeys.taxonomy() });
    },
  });
}

/**
 * Hook to delete a label
 */
export function useDeleteLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteLabel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: classificationQueryKeys.labels() });
      queryClient.invalidateQueries({ queryKey: classificationQueryKeys.taxonomy() });
    },
  });
}

/**
 * Hook to get classification result for an idea
 */
export function useClassification(ideaId: string | undefined) {
  return useQuery({
    queryKey: classificationQueryKeys.result(ideaId || ''),
    queryFn: () => fetchClassification(ideaId!),
    enabled: !!ideaId,
  });
}

/**
 * Hook to classify an idea
 */
export function useClassifyIdea() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: classifyIdea,
    onSuccess: (result) => {
      queryClient.setQueryData(classificationQueryKeys.result(result.idea_id), result);
    },
  });
}

/**
 * Hook to start batch classification
 */
export function useClassifyBatch() {
  return useMutation({
    mutationFn: classifyBatch,
  });
}

/**
 * Hook to poll for job status
 */
export function useClassificationJob(jobId: string | undefined, pollInterval = 2000) {
  return useQuery({
    queryKey: classificationQueryKeys.job(jobId || ''),
    queryFn: () => fetchJob(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === 'completed' || data?.status === 'failed') {
        return false;
      }
      return pollInterval;
    },
  });
}
