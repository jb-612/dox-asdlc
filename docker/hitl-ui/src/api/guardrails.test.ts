/**
 * Unit tests for guardrails API (P11-F01)
 *
 * Tests the API client functions and query key factory for the
 * Guardrails Configuration System.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { apiClient } from './client';
import type {
  Guideline,
  GuidelinesListResponse,
  GuidelineCreateRequest,
  GuidelineUpdateRequest,
  EvaluatedContextResponse,
  AuditLogResponse,
  ImportResult,
} from './types/guardrails';

// Mock the API client
vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

// ============================================================================
// Test fixtures
// ============================================================================

function createMockGuideline(overrides?: Partial<Guideline>): Guideline {
  return {
    id: 'guideline-001',
    name: 'Cognitive Isolation Rule',
    description: 'Agents must not share working context',
    category: 'cognitive_isolation',
    priority: 100,
    enabled: true,
    condition: {
      agents: ['backend', 'frontend'],
      domains: null,
      actions: null,
      paths: null,
      events: null,
      gate_types: null,
    },
    action: {
      action_type: 'instruction',
      instruction: 'Maintain separate context for each agent session',
      tools_allowed: null,
      tools_denied: null,
      gate_type: null,
    },
    version: 1,
    created_at: '2026-02-01T10:00:00Z',
    updated_at: '2026-02-01T10:00:00Z',
    created_by: 'admin',
    tenant_id: 'default',
    ...overrides,
  };
}

function createMockListResponse(count: number = 2): GuidelinesListResponse {
  return {
    guidelines: [
      createMockGuideline(),
      createMockGuideline({
        id: 'guideline-002',
        name: 'TDD Protocol',
        category: 'tdd_protocol',
        priority: 90,
      }),
    ].slice(0, count),
    total: count,
    page: 1,
    page_size: 20,
  };
}

// ============================================================================
// API function tests
// ============================================================================

describe('guardrails API functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Disable mock data so we test the real API client path
    vi.stubEnv('VITE_USE_MOCKS', 'false');
    vi.stubEnv('DEV', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetAllMocks();
  });

  describe('listGuidelines', () => {
    it('fetches guidelines list from API', async () => {
      const mockResponse = createMockListResponse();
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });

      const { listGuidelines } = await import('./guardrails');
      const result = await listGuidelines();

      expect(apiClient.get).toHaveBeenCalledWith('/guardrails', { params: undefined });
      expect(result).toEqual(mockResponse);
      expect(result.guidelines).toHaveLength(2);
    });

    it('passes filter parameters', async () => {
      const mockResponse = createMockListResponse(1);
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });

      const { listGuidelines } = await import('./guardrails');
      await listGuidelines({ category: 'tdd_protocol', enabled: true, page: 2, page_size: 10 });

      expect(apiClient.get).toHaveBeenCalledWith('/guardrails', {
        params: { category: 'tdd_protocol', enabled: true, page: 2, page_size: 10 },
      });
    });
  });

  describe('getGuideline', () => {
    it('fetches a single guideline by ID', async () => {
      const mockGuideline = createMockGuideline();
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockGuideline });

      const { getGuideline } = await import('./guardrails');
      const result = await getGuideline('guideline-001');

      expect(apiClient.get).toHaveBeenCalledWith('/guardrails/guideline-001');
      expect(result).toEqual(mockGuideline);
      expect(result.id).toBe('guideline-001');
    });
  });

  describe('createGuideline', () => {
    it('posts a new guideline to the API', async () => {
      const mockCreated = createMockGuideline({ id: 'guideline-new' });
      vi.mocked(apiClient.post).mockResolvedValue({ data: mockCreated });

      const body: GuidelineCreateRequest = {
        name: 'New Guideline',
        description: 'A new guideline',
        category: 'custom',
        condition: { agents: ['backend'] },
        action: { action_type: 'instruction', instruction: 'Follow this rule' },
      };

      const { createGuideline } = await import('./guardrails');
      const result = await createGuideline(body);

      expect(apiClient.post).toHaveBeenCalledWith('/guardrails', body);
      expect(result.id).toBe('guideline-new');
    });
  });

  describe('updateGuideline', () => {
    it('updates an existing guideline via PUT', async () => {
      const mockUpdated = createMockGuideline({ version: 2, name: 'Updated Name' });
      vi.mocked(apiClient.put).mockResolvedValue({ data: mockUpdated });

      const body: GuidelineUpdateRequest = {
        name: 'Updated Name',
        version: 1,
      };

      const { updateGuideline } = await import('./guardrails');
      const result = await updateGuideline('guideline-001', body);

      expect(apiClient.put).toHaveBeenCalledWith('/guardrails/guideline-001', body);
      expect(result.version).toBe(2);
      expect(result.name).toBe('Updated Name');
    });
  });

  describe('deleteGuideline', () => {
    it('deletes a guideline by ID', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({ data: undefined });

      const { deleteGuideline } = await import('./guardrails');
      await deleteGuideline('guideline-001');

      expect(apiClient.delete).toHaveBeenCalledWith('/guardrails/guideline-001');
    });
  });

  describe('toggleGuideline', () => {
    it('toggles guideline enabled state via POST', async () => {
      const mockToggled = createMockGuideline({ enabled: false });
      vi.mocked(apiClient.post).mockResolvedValue({ data: mockToggled });

      const { toggleGuideline } = await import('./guardrails');
      const result = await toggleGuideline('guideline-001');

      expect(apiClient.post).toHaveBeenCalledWith('/guardrails/guideline-001/toggle');
      expect(result.enabled).toBe(false);
    });
  });

  describe('listAuditLogs', () => {
    it('fetches audit logs from API', async () => {
      const mockResponse: AuditLogResponse = {
        entries: [
          {
            id: 'audit-001',
            event_type: 'guideline_created',
            guideline_id: 'guideline-001',
            timestamp: '2026-02-01T10:00:00Z',
            decision: null,
            context: null,
            changes: { name: 'New Guideline' },
          },
        ],
        total: 1,
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });

      const { listAuditLogs } = await import('./guardrails');
      const result = await listAuditLogs();

      expect(apiClient.get).toHaveBeenCalledWith('/guardrails/audit', { params: undefined });
      expect(result.entries).toHaveLength(1);
    });

    it('passes filter parameters for audit logs', async () => {
      const mockResponse: AuditLogResponse = { entries: [], total: 0 };
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });

      const { listAuditLogs } = await import('./guardrails');
      await listAuditLogs({
        guideline_id: 'guideline-001',
        event_type: 'guideline_updated',
        date_from: '2026-01-01',
        date_to: '2026-02-01',
      });

      expect(apiClient.get).toHaveBeenCalledWith('/guardrails/audit', {
        params: {
          guideline_id: 'guideline-001',
          event_type: 'guideline_updated',
          date_from: '2026-01-01',
          date_to: '2026-02-01',
        },
      });
    });
  });

  describe('evaluateContext', () => {
    it('evaluates guidelines against a task context', async () => {
      const mockResponse: EvaluatedContextResponse = {
        matched_count: 1,
        combined_instruction: 'Maintain separate context for each agent session',
        tools_allowed: ['git status', 'npm test'],
        tools_denied: ['rm -rf'],
        hitl_gates: ['destructive_operation'],
        guidelines: [
          {
            guideline_id: 'guideline-001',
            guideline_name: 'Cognitive Isolation Rule',
            priority: 100,
            match_score: 0.95,
            matched_fields: ['agents'],
          },
        ],
      };

      vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });

      const { evaluateContext } = await import('./guardrails');
      const result = await evaluateContext({
        agent: 'backend',
        domain: 'workers',
        action: 'implement',
      });

      expect(apiClient.post).toHaveBeenCalledWith('/guardrails/evaluate', {
        agent: 'backend',
        domain: 'workers',
        action: 'implement',
      });
      expect(result.matched_count).toBe(1);
      expect(result.guidelines).toHaveLength(1);
    });
  });

  describe('exportGuidelines', () => {
    it('exports all guidelines', async () => {
      const mockGuidelines = [createMockGuideline()];
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockGuidelines });

      const { exportGuidelines } = await import('./guardrails');
      const result = await exportGuidelines();

      expect(apiClient.get).toHaveBeenCalledWith('/guardrails/export', { params: undefined });
      expect(result).toHaveLength(1);
    });

    it('exports guidelines filtered by category', async () => {
      const mockGuidelines = [createMockGuideline({ category: 'tdd_protocol' })];
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockGuidelines });

      const { exportGuidelines } = await import('./guardrails');
      await exportGuidelines('tdd_protocol');

      expect(apiClient.get).toHaveBeenCalledWith('/guardrails/export', {
        params: { category: 'tdd_protocol' },
      });
    });
  });

  describe('importGuidelines', () => {
    it('imports guidelines from an array', async () => {
      const mockResult: ImportResult = { imported: 2, errors: [] };
      vi.mocked(apiClient.post).mockResolvedValue({ data: mockResult });

      const guidelines: GuidelineCreateRequest[] = [
        {
          name: 'Imported Rule 1',
          category: 'custom',
          condition: {},
          action: { action_type: 'instruction', instruction: 'Rule 1' },
        },
        {
          name: 'Imported Rule 2',
          category: 'custom',
          condition: {},
          action: { action_type: 'instruction', instruction: 'Rule 2' },
        },
      ];

      const { importGuidelines } = await import('./guardrails');
      const result = await importGuidelines(guidelines);

      expect(apiClient.post).toHaveBeenCalledWith('/guardrails/import', guidelines);
      expect(result.imported).toBe(2);
      expect(result.errors).toHaveLength(0);
    });
  });
});

// ============================================================================
// Query key tests
// ============================================================================

describe('guardrailsQueryKeys', () => {
  it('generates correct base keys', async () => {
    const { guardrailsQueryKeys } = await import('./guardrails');

    expect(guardrailsQueryKeys.all).toEqual(['guardrails']);
  });

  it('generates correct list keys', async () => {
    const { guardrailsQueryKeys } = await import('./guardrails');

    expect(guardrailsQueryKeys.lists()).toEqual(['guardrails', 'list']);
    expect(guardrailsQueryKeys.list()).toEqual(['guardrails', 'list', undefined]);
    expect(guardrailsQueryKeys.list({ category: 'tdd_protocol' })).toEqual([
      'guardrails',
      'list',
      { category: 'tdd_protocol' },
    ]);
  });

  it('generates correct detail keys', async () => {
    const { guardrailsQueryKeys } = await import('./guardrails');

    expect(guardrailsQueryKeys.details()).toEqual(['guardrails', 'detail']);
    expect(guardrailsQueryKeys.detail('guideline-001')).toEqual([
      'guardrails',
      'detail',
      'guideline-001',
    ]);
  });

  it('generates correct audit keys', async () => {
    const { guardrailsQueryKeys } = await import('./guardrails');

    expect(guardrailsQueryKeys.audit()).toEqual(['guardrails', 'audit']);
    expect(guardrailsQueryKeys.auditList()).toEqual(['guardrails', 'audit', undefined]);
    expect(
      guardrailsQueryKeys.auditList({ guideline_id: 'guideline-001' })
    ).toEqual(['guardrails', 'audit', { guideline_id: 'guideline-001' }]);
  });
});

// ============================================================================
// React Query hook tests
// ============================================================================

describe('guardrails React Query hooks', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    // Disable mock data so we test the real API client path
    vi.stubEnv('VITE_USE_MOCKS', 'false');
    vi.stubEnv('DEV', '');
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
          staleTime: 0,
        },
        mutations: {
          retry: false,
        },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
    vi.unstubAllEnvs();
    vi.resetAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  describe('useGuidelinesList', () => {
    it('fetches guidelines list and returns data', async () => {
      const mockResponse = createMockListResponse();
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });

      const { useGuidelinesList } = await import('./guardrails');
      const { result } = renderHook(() => useGuidelinesList(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockResponse);
      expect(result.current.data?.guidelines).toHaveLength(2);
    });

    it('passes parameters to the API call', async () => {
      const mockResponse = createMockListResponse(1);
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });

      const { useGuidelinesList } = await import('./guardrails');
      const { result } = renderHook(
        () => useGuidelinesList({ category: 'hitl_gate', enabled: true }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(apiClient.get).toHaveBeenCalledWith('/guardrails', {
        params: { category: 'hitl_gate', enabled: true },
      });
    });
  });

  describe('useGuideline', () => {
    it('fetches a single guideline when ID is provided', async () => {
      const mockGuideline = createMockGuideline();
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockGuideline });

      const { useGuideline } = await import('./guardrails');
      const { result } = renderHook(() => useGuideline('guideline-001'), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockGuideline);
    });

    it('does not fetch when ID is null', async () => {
      const { useGuideline } = await import('./guardrails');
      const { result } = renderHook(() => useGuideline(null), { wrapper });

      // Should not make any API call
      expect(apiClient.get).not.toHaveBeenCalled();
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useAuditLogs', () => {
    it('fetches audit logs', async () => {
      const mockResponse: AuditLogResponse = {
        entries: [
          {
            id: 'audit-001',
            event_type: 'guideline_created',
            guideline_id: 'guideline-001',
            timestamp: '2026-02-01T10:00:00Z',
            decision: null,
            context: null,
            changes: null,
          },
        ],
        total: 1,
      };
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });

      const { useAuditLogs } = await import('./guardrails');
      const { result } = renderHook(() => useAuditLogs(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.entries).toHaveLength(1);
    });
  });

  describe('useCreateGuideline', () => {
    it('creates a guideline and invalidates list queries', async () => {
      const mockCreated = createMockGuideline({ id: 'guideline-new' });
      vi.mocked(apiClient.post).mockResolvedValue({ data: mockCreated });

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { useCreateGuideline } = await import('./guardrails');
      const { result } = renderHook(() => useCreateGuideline(), { wrapper });

      await act(async () => {
        const response = await result.current.mutateAsync({
          name: 'New Guideline',
          category: 'custom',
          condition: {},
          action: { action_type: 'instruction', instruction: 'Do this' },
        });
        expect(response.id).toBe('guideline-new');
      });

      expect(invalidateSpy).toHaveBeenCalled();
    });
  });

  describe('useUpdateGuideline', () => {
    it('updates a guideline and invalidates relevant queries', async () => {
      const mockUpdated = createMockGuideline({ version: 2 });
      vi.mocked(apiClient.put).mockResolvedValue({ data: mockUpdated });

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { useUpdateGuideline } = await import('./guardrails');
      const { result } = renderHook(() => useUpdateGuideline(), { wrapper });

      await act(async () => {
        const response = await result.current.mutateAsync({
          id: 'guideline-001',
          body: { name: 'Updated', version: 1 },
        });
        expect(response.version).toBe(2);
      });

      expect(invalidateSpy).toHaveBeenCalled();
    });
  });

  describe('useDeleteGuideline', () => {
    it('deletes a guideline and invalidates list queries', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({ data: undefined });

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { useDeleteGuideline } = await import('./guardrails');
      const { result } = renderHook(() => useDeleteGuideline(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync('guideline-001');
      });

      expect(apiClient.delete).toHaveBeenCalledWith('/guardrails/guideline-001');
      expect(invalidateSpy).toHaveBeenCalled();
    });
  });

  describe('useToggleGuideline', () => {
    it('toggles a guideline and invalidates list queries', async () => {
      const mockToggled = createMockGuideline({ enabled: false });
      vi.mocked(apiClient.post).mockResolvedValue({ data: mockToggled });

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { useToggleGuideline } = await import('./guardrails');
      const { result } = renderHook(() => useToggleGuideline(), { wrapper });

      await act(async () => {
        const response = await result.current.mutateAsync('guideline-001');
        expect(response.enabled).toBe(false);
      });

      expect(invalidateSpy).toHaveBeenCalled();
    });
  });

  describe('useEvaluateContext', () => {
    it('evaluates context and returns matched guidelines', async () => {
      const mockResponse: EvaluatedContextResponse = {
        matched_count: 1,
        combined_instruction: 'Test instruction',
        tools_allowed: [],
        tools_denied: [],
        hitl_gates: [],
        guidelines: [
          {
            guideline_id: 'guideline-001',
            guideline_name: 'Test',
            priority: 100,
            match_score: 0.9,
            matched_fields: ['agents'],
          },
        ],
      };
      vi.mocked(apiClient.post).mockResolvedValue({ data: mockResponse });

      const { useEvaluateContext } = await import('./guardrails');
      const { result } = renderHook(() => useEvaluateContext(), { wrapper });

      await act(async () => {
        const response = await result.current.mutateAsync({
          agent: 'backend',
          domain: 'workers',
        });
        expect(response.matched_count).toBe(1);
      });
    });
  });

  describe('useImportGuidelines', () => {
    it('imports guidelines and invalidates list queries', async () => {
      const mockResult: ImportResult = { imported: 3, errors: [] };
      vi.mocked(apiClient.post).mockResolvedValue({ data: mockResult });

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { useImportGuidelines } = await import('./guardrails');
      const { result } = renderHook(() => useImportGuidelines(), { wrapper });

      await act(async () => {
        const response = await result.current.mutateAsync([
          {
            name: 'Rule 1',
            category: 'custom',
            condition: {},
            action: { action_type: 'instruction', instruction: 'Test' },
          },
        ]);
        expect(response.imported).toBe(3);
      });

      expect(invalidateSpy).toHaveBeenCalled();
    });
  });
});
