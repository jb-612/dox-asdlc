/**
 * Guardrails API client functions and React Query hooks (P11-F01)
 *
 * Provides typed API functions and TanStack Query hooks for the
 * Guardrails Configuration System, including CRUD operations,
 * context evaluation, audit logging, and import/export.
 *
 * Supports mock data fallback for development mode via VITE_USE_MOCKS
 * or when running in DEV mode (import.meta.env.DEV).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import {
  mockGuidelines,
  mockEvaluatedContext,
  getMockGuidelinesListResponse,
  getMockAuditLogResponse,
  simulateGuardrailsDelay,
} from './mocks/guardrailsData';
import type {
  Guideline,
  GuidelinesListResponse,
  GuidelineCreateRequest,
  GuidelineUpdateRequest,
  GuidelinesListParams,
  TaskContextRequest,
  EvaluatedContextResponse,
  AuditLogResponse,
  AuditListParams,
  ImportResult,
} from './types/guardrails';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Check if we should use mock data.
 */
function shouldUseMocks(): boolean {
  return import.meta.env.VITE_USE_MOCKS === 'true';
}

// ============================================================================
// Query key factory
// ============================================================================

/**
 * Factory for guardrails query keys, following the project pattern
 * of hierarchical key arrays for targeted cache invalidation.
 */
export const guardrailsQueryKeys = {
  all: ['guardrails'] as const,
  lists: () => [...guardrailsQueryKeys.all, 'list'] as const,
  list: (params?: GuidelinesListParams) => [...guardrailsQueryKeys.lists(), params] as const,
  details: () => [...guardrailsQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...guardrailsQueryKeys.details(), id] as const,
  audit: () => [...guardrailsQueryKeys.all, 'audit'] as const,
  auditList: (params?: AuditListParams) => [...guardrailsQueryKeys.audit(), params] as const,
};

// ============================================================================
// API functions
// ============================================================================

/**
 * List guidelines with optional filtering and pagination.
 */
export async function listGuidelines(params?: GuidelinesListParams): Promise<GuidelinesListResponse> {
  if (shouldUseMocks()) {
    await simulateGuardrailsDelay(50, 150);
    return getMockGuidelinesListResponse(params);
  }

  try {
    const { data } = await apiClient.get<GuidelinesListResponse>('/guardrails', { params });
    return data;
  } catch (error) {
    console.error('Guardrails API unavailable:', error);
    throw error;
  }
}

/**
 * Fetch a single guideline by ID.
 */
export async function getGuideline(id: string): Promise<Guideline> {
  if (shouldUseMocks()) {
    await simulateGuardrailsDelay(50, 150);
    const found = mockGuidelines.find((g) => g.id === id);
    if (!found) throw new Error(`Guideline not found: ${id}`);
    return found;
  }

  try {
    const { data } = await apiClient.get<Guideline>(`/guardrails/${id}`);
    return data;
  } catch (error) {
    console.error('Guardrails API unavailable:', error);
    throw error;
  }
}

/**
 * Create a new guideline.
 */
export async function createGuideline(body: GuidelineCreateRequest): Promise<Guideline> {
  if (shouldUseMocks()) {
    await simulateGuardrailsDelay(100, 250);
    const newGuideline: Guideline = {
      id: `gl-mock-${Date.now()}`,
      name: body.name,
      description: body.description ?? '',
      category: body.category,
      priority: body.priority ?? 500,
      enabled: body.enabled ?? true,
      condition: body.condition,
      action: body.action,
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: 'mock-user',
    };
    return newGuideline;
  }

  try {
    const { data } = await apiClient.post<Guideline>('/guardrails', body);
    return data;
  } catch (error) {
    console.error('Guardrails API unavailable:', error);
    throw error;
  }
}

/**
 * Update an existing guideline. The body must include the current version
 * number for optimistic locking.
 */
export async function updateGuideline(id: string, body: GuidelineUpdateRequest): Promise<Guideline> {
  if (shouldUseMocks()) {
    await simulateGuardrailsDelay(100, 250);
    const existing = mockGuidelines.find((g) => g.id === id);
    if (!existing) throw new Error(`Guideline not found: ${id}`);
    return {
      ...existing,
      ...body,
      version: existing.version + 1,
      updated_at: new Date().toISOString(),
    };
  }

  try {
    const { data } = await apiClient.put<Guideline>(`/guardrails/${id}`, body);
    return data;
  } catch (error) {
    console.error('Guardrails API unavailable:', error);
    throw error;
  }
}

/**
 * Delete a guideline by ID.
 */
export async function deleteGuideline(id: string): Promise<void> {
  if (shouldUseMocks()) {
    await simulateGuardrailsDelay(50, 150);
    return;
  }

  try {
    await apiClient.delete(`/guardrails/${id}`);
  } catch (error) {
    console.error('Guardrails API unavailable:', error);
    throw error;
  }
}

/**
 * Toggle a guideline's enabled state.
 */
export async function toggleGuideline(id: string): Promise<Guideline> {
  if (shouldUseMocks()) {
    await simulateGuardrailsDelay(50, 150);
    const existing = mockGuidelines.find((g) => g.id === id);
    if (!existing) throw new Error(`Guideline not found: ${id}`);
    return { ...existing, enabled: !existing.enabled, updated_at: new Date().toISOString() };
  }

  try {
    const { data } = await apiClient.post<Guideline>(`/guardrails/${id}/toggle`);
    return data;
  } catch (error) {
    console.error('Guardrails API unavailable:', error);
    throw error;
  }
}

/**
 * List audit log entries with optional filtering.
 */
export async function listAuditLogs(params?: AuditListParams): Promise<AuditLogResponse> {
  if (shouldUseMocks()) {
    await simulateGuardrailsDelay(50, 150);
    return getMockAuditLogResponse(params);
  }

  try {
    const { data } = await apiClient.get<AuditLogResponse>('/guardrails/audit', { params });
    return data;
  } catch (error) {
    console.error('Guardrails API unavailable:', error);
    throw error;
  }
}

/**
 * Evaluate guidelines against a task context to determine which
 * guidelines apply and what actions to take.
 */
export async function evaluateContext(body: TaskContextRequest): Promise<EvaluatedContextResponse> {
  if (shouldUseMocks()) {
    await simulateGuardrailsDelay(100, 250);
    return mockEvaluatedContext;
  }

  try {
    const { data } = await apiClient.post<EvaluatedContextResponse>('/guardrails/evaluate', body);
    return data;
  } catch (error) {
    console.error('Guardrails API unavailable:', error);
    throw error;
  }
}

/**
 * Export guidelines, optionally filtered by category.
 */
export async function exportGuidelines(category?: string): Promise<Guideline[]> {
  if (shouldUseMocks()) {
    await simulateGuardrailsDelay(50, 150);
    if (category) {
      return mockGuidelines.filter((g) => g.category === category);
    }
    return [...mockGuidelines];
  }

  try {
    const params = category ? { category } : undefined;
    const { data } = await apiClient.get<Guideline[]>('/guardrails/export', { params });
    return data;
  } catch (error) {
    console.error('Guardrails API unavailable:', error);
    throw error;
  }
}

/**
 * Import guidelines from an array of create requests.
 */
export async function importGuidelines(guidelines: GuidelineCreateRequest[]): Promise<ImportResult> {
  if (shouldUseMocks()) {
    await simulateGuardrailsDelay(200, 400);
    return { imported: guidelines.length, errors: [] };
  }

  try {
    const { data } = await apiClient.post<ImportResult>('/guardrails/import', guidelines);
    return data;
  } catch (error) {
    console.error('Guardrails API unavailable:', error);
    throw error;
  }
}

// ============================================================================
// React Query hooks
// ============================================================================

/**
 * Hook to fetch paginated guidelines list.
 */
export function useGuidelinesList(params?: GuidelinesListParams) {
  return useQuery({
    queryKey: guardrailsQueryKeys.list(params),
    queryFn: () => listGuidelines(params),
  });
}

/**
 * Hook to fetch a single guideline by ID.
 * The query is disabled when id is null.
 */
export function useGuideline(id: string | null) {
  return useQuery({
    queryKey: guardrailsQueryKeys.detail(id ?? ''),
    queryFn: () => getGuideline(id!),
    enabled: !!id,
  });
}

/**
 * Hook to fetch audit log entries.
 */
export function useAuditLogs(params?: AuditListParams) {
  return useQuery({
    queryKey: guardrailsQueryKeys.auditList(params),
    queryFn: () => listAuditLogs(params),
  });
}

/**
 * Hook to create a new guideline.
 * Invalidates the guidelines list cache on success.
 */
export function useCreateGuideline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createGuideline,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: guardrailsQueryKeys.lists() });
    },
  });
}

/**
 * Hook to update an existing guideline.
 * Invalidates both the list and detail cache on success.
 */
export function useUpdateGuideline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: GuidelineUpdateRequest }) =>
      updateGuideline(id, body),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: guardrailsQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: guardrailsQueryKeys.detail(id) });
    },
  });
}

/**
 * Hook to delete a guideline.
 * Invalidates the guidelines list cache on success.
 */
export function useDeleteGuideline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteGuideline,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: guardrailsQueryKeys.lists() });
    },
  });
}

/**
 * Hook to toggle a guideline's enabled state.
 * Invalidates the guidelines list cache on success.
 */
export function useToggleGuideline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: toggleGuideline,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: guardrailsQueryKeys.lists() });
    },
  });
}

/**
 * Hook to evaluate guidelines against a task context.
 */
export function useEvaluateContext() {
  return useMutation({
    mutationFn: evaluateContext,
  });
}

/**
 * Hook to export guidelines.
 */
export function useExportGuidelines() {
  return useMutation({
    mutationFn: (category?: string) => exportGuidelines(category),
  });
}

/**
 * Hook to import guidelines.
 * Invalidates the guidelines list cache on success.
 */
export function useImportGuidelines() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: importGuidelines,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: guardrailsQueryKeys.lists() });
    },
  });
}
