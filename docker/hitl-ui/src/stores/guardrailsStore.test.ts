/**
 * Unit tests for guardrailsStore (P11-F01)
 *
 * Tests Zustand store for guardrails UI state management including
 * guidelines list, filters, pagination, editor state, and audit panel.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useGuardrailsStore } from './guardrailsStore';
import type { Guideline, GuidelineCategory } from '../api/types/guardrails';

// ============================================================================
// Test Data
// ============================================================================

const mockGuideline: Guideline = {
  id: 'gl-001',
  name: 'TDD Required',
  description: 'All code must follow TDD protocol',
  category: 'tdd_protocol',
  priority: 90,
  enabled: true,
  condition: {
    agents: ['backend', 'frontend'],
    domains: null,
    actions: ['code_write'],
    paths: null,
    events: null,
    gate_types: null,
  },
  action: {
    action_type: 'instruction',
    instruction: 'Follow Red-Green-Refactor cycle',
  },
  version: 1,
  created_at: '2026-01-15T10:00:00Z',
  updated_at: '2026-01-15T10:00:00Z',
  created_by: 'admin',
  tenant_id: null,
};

const mockGuideline2: Guideline = {
  id: 'gl-002',
  name: 'Path Restriction - Backend',
  description: 'Backend agent can only modify backend paths',
  category: 'path_restriction',
  priority: 100,
  enabled: true,
  condition: {
    agents: ['backend'],
    domains: null,
    actions: null,
    paths: ['src/workers/', 'src/orchestrator/'],
    events: null,
    gate_types: null,
  },
  action: {
    action_type: 'tool_deny',
    tools_denied: ['write_file', 'edit_file'],
  },
  version: 2,
  created_at: '2026-01-14T08:00:00Z',
  updated_at: '2026-01-16T12:00:00Z',
  created_by: 'admin',
  tenant_id: null,
};

// ============================================================================
// Tests
// ============================================================================

describe('guardrailsStore', () => {
  beforeEach(() => {
    const { result } = renderHook(() => useGuardrailsStore());
    act(() => {
      result.current.resetFilters();
      // Reset all state to defaults
      result.current.setGuidelines([], 0);
      result.current.selectGuideline(null);
      result.current.closeEditor();
      result.current.setLoading(false);
      if (result.current.isAuditPanelOpen) {
        result.current.toggleAuditPanel();
      }
      result.current.setSortBy('priority');
      result.current.setSortOrder('desc');
    });
  });

  describe('Initial State', () => {
    it('has empty guidelines array', () => {
      const { result } = renderHook(() => useGuardrailsStore());
      expect(result.current.guidelines).toEqual([]);
    });

    it('has totalCount of 0', () => {
      const { result } = renderHook(() => useGuardrailsStore());
      expect(result.current.totalCount).toBe(0);
    });

    it('has null selectedGuidelineId', () => {
      const { result } = renderHook(() => useGuardrailsStore());
      expect(result.current.selectedGuidelineId).toBeNull();
    });

    it('has null categoryFilter', () => {
      const { result } = renderHook(() => useGuardrailsStore());
      expect(result.current.categoryFilter).toBeNull();
    });

    it('has null enabledFilter', () => {
      const { result } = renderHook(() => useGuardrailsStore());
      expect(result.current.enabledFilter).toBeNull();
    });

    it('has empty searchQuery', () => {
      const { result } = renderHook(() => useGuardrailsStore());
      expect(result.current.searchQuery).toBe('');
    });

    it('has default sortBy of priority', () => {
      const { result } = renderHook(() => useGuardrailsStore());
      expect(result.current.sortBy).toBe('priority');
    });

    it('has default sortOrder of desc', () => {
      const { result } = renderHook(() => useGuardrailsStore());
      expect(result.current.sortOrder).toBe('desc');
    });

    it('has page 1', () => {
      const { result } = renderHook(() => useGuardrailsStore());
      expect(result.current.page).toBe(1);
    });

    it('has pageSize of 20', () => {
      const { result } = renderHook(() => useGuardrailsStore());
      expect(result.current.pageSize).toBe(20);
    });

    it('has isEditorOpen false', () => {
      const { result } = renderHook(() => useGuardrailsStore());
      expect(result.current.isEditorOpen).toBe(false);
    });

    it('has isCreating false', () => {
      const { result } = renderHook(() => useGuardrailsStore());
      expect(result.current.isCreating).toBe(false);
    });

    it('has isAuditPanelOpen false', () => {
      const { result } = renderHook(() => useGuardrailsStore());
      expect(result.current.isAuditPanelOpen).toBe(false);
    });

    it('has isLoading false', () => {
      const { result } = renderHook(() => useGuardrailsStore());
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('setGuidelines', () => {
    it('updates guidelines and totalCount', () => {
      const { result } = renderHook(() => useGuardrailsStore());

      act(() => {
        result.current.setGuidelines([mockGuideline, mockGuideline2], 2);
      });

      expect(result.current.guidelines).toEqual([mockGuideline, mockGuideline2]);
      expect(result.current.totalCount).toBe(2);
    });

    it('can set empty guidelines', () => {
      const { result } = renderHook(() => useGuardrailsStore());

      act(() => {
        result.current.setGuidelines([mockGuideline], 1);
      });

      act(() => {
        result.current.setGuidelines([], 0);
      });

      expect(result.current.guidelines).toEqual([]);
      expect(result.current.totalCount).toBe(0);
    });

    it('supports total different from array length (pagination)', () => {
      const { result } = renderHook(() => useGuardrailsStore());

      act(() => {
        result.current.setGuidelines([mockGuideline], 50);
      });

      expect(result.current.guidelines.length).toBe(1);
      expect(result.current.totalCount).toBe(50);
    });
  });

  describe('selectGuideline', () => {
    it('sets selectedGuidelineId', () => {
      const { result } = renderHook(() => useGuardrailsStore());

      act(() => {
        result.current.selectGuideline('gl-001');
      });

      expect(result.current.selectedGuidelineId).toBe('gl-001');
    });

    it('clears selectedGuidelineId with null', () => {
      const { result } = renderHook(() => useGuardrailsStore());

      act(() => {
        result.current.selectGuideline('gl-001');
      });

      act(() => {
        result.current.selectGuideline(null);
      });

      expect(result.current.selectedGuidelineId).toBeNull();
    });
  });

  describe('setCategoryFilter', () => {
    it('sets category filter', () => {
      const { result } = renderHook(() => useGuardrailsStore());

      act(() => {
        result.current.setCategoryFilter('tdd_protocol');
      });

      expect(result.current.categoryFilter).toBe('tdd_protocol');
    });

    it('resets page to 1 when filter changes', () => {
      const { result } = renderHook(() => useGuardrailsStore());

      act(() => {
        result.current.setPage(3);
      });

      act(() => {
        result.current.setCategoryFilter('hitl_gate');
      });

      expect(result.current.page).toBe(1);
    });

    it('clears category filter with null', () => {
      const { result } = renderHook(() => useGuardrailsStore());

      act(() => {
        result.current.setCategoryFilter('path_restriction');
      });

      act(() => {
        result.current.setCategoryFilter(null);
      });

      expect(result.current.categoryFilter).toBeNull();
    });
  });

  describe('setEnabledFilter', () => {
    it('sets enabled filter to true', () => {
      const { result } = renderHook(() => useGuardrailsStore());

      act(() => {
        result.current.setEnabledFilter(true);
      });

      expect(result.current.enabledFilter).toBe(true);
    });

    it('sets enabled filter to false', () => {
      const { result } = renderHook(() => useGuardrailsStore());

      act(() => {
        result.current.setEnabledFilter(false);
      });

      expect(result.current.enabledFilter).toBe(false);
    });

    it('resets page to 1 when filter changes', () => {
      const { result } = renderHook(() => useGuardrailsStore());

      act(() => {
        result.current.setPage(5);
      });

      act(() => {
        result.current.setEnabledFilter(true);
      });

      expect(result.current.page).toBe(1);
    });

    it('clears enabled filter with null', () => {
      const { result } = renderHook(() => useGuardrailsStore());

      act(() => {
        result.current.setEnabledFilter(true);
      });

      act(() => {
        result.current.setEnabledFilter(null);
      });

      expect(result.current.enabledFilter).toBeNull();
    });
  });

  describe('setSearchQuery', () => {
    it('sets search query', () => {
      const { result } = renderHook(() => useGuardrailsStore());

      act(() => {
        result.current.setSearchQuery('tdd');
      });

      expect(result.current.searchQuery).toBe('tdd');
    });

    it('resets page to 1 when query changes', () => {
      const { result } = renderHook(() => useGuardrailsStore());

      act(() => {
        result.current.setPage(4);
      });

      act(() => {
        result.current.setSearchQuery('path');
      });

      expect(result.current.page).toBe(1);
    });

    it('can set empty search query', () => {
      const { result } = renderHook(() => useGuardrailsStore());

      act(() => {
        result.current.setSearchQuery('test');
      });

      act(() => {
        result.current.setSearchQuery('');
      });

      expect(result.current.searchQuery).toBe('');
    });
  });

  describe('setSortBy', () => {
    it('sets sort by to name', () => {
      const { result } = renderHook(() => useGuardrailsStore());

      act(() => {
        result.current.setSortBy('name');
      });

      expect(result.current.sortBy).toBe('name');
    });

    it('sets sort by to updated_at', () => {
      const { result } = renderHook(() => useGuardrailsStore());

      act(() => {
        result.current.setSortBy('updated_at');
      });

      expect(result.current.sortBy).toBe('updated_at');
    });

    it('sets sort by to priority', () => {
      const { result } = renderHook(() => useGuardrailsStore());

      act(() => {
        result.current.setSortBy('name');
      });

      act(() => {
        result.current.setSortBy('priority');
      });

      expect(result.current.sortBy).toBe('priority');
    });
  });

  describe('setSortOrder', () => {
    it('sets sort order to asc', () => {
      const { result } = renderHook(() => useGuardrailsStore());

      act(() => {
        result.current.setSortOrder('asc');
      });

      expect(result.current.sortOrder).toBe('asc');
    });

    it('sets sort order to desc', () => {
      const { result } = renderHook(() => useGuardrailsStore());

      act(() => {
        result.current.setSortOrder('asc');
      });

      act(() => {
        result.current.setSortOrder('desc');
      });

      expect(result.current.sortOrder).toBe('desc');
    });
  });

  describe('setPage', () => {
    it('sets page number', () => {
      const { result } = renderHook(() => useGuardrailsStore());

      act(() => {
        result.current.setPage(3);
      });

      expect(result.current.page).toBe(3);
    });
  });

  describe('setPageSize', () => {
    it('sets page size', () => {
      const { result } = renderHook(() => useGuardrailsStore());

      act(() => {
        result.current.setPageSize(50);
      });

      expect(result.current.pageSize).toBe(50);
    });

    it('resets page to 1 when page size changes', () => {
      const { result } = renderHook(() => useGuardrailsStore());

      act(() => {
        result.current.setPage(5);
      });

      act(() => {
        result.current.setPageSize(10);
      });

      expect(result.current.page).toBe(1);
    });
  });

  describe('openEditor', () => {
    it('opens editor for editing (default)', () => {
      const { result } = renderHook(() => useGuardrailsStore());

      act(() => {
        result.current.openEditor();
      });

      expect(result.current.isEditorOpen).toBe(true);
      expect(result.current.isCreating).toBe(false);
    });

    it('opens editor for creating', () => {
      const { result } = renderHook(() => useGuardrailsStore());

      act(() => {
        result.current.openEditor(true);
      });

      expect(result.current.isEditorOpen).toBe(true);
      expect(result.current.isCreating).toBe(true);
    });

    it('opens editor for editing explicitly', () => {
      const { result } = renderHook(() => useGuardrailsStore());

      act(() => {
        result.current.openEditor(false);
      });

      expect(result.current.isEditorOpen).toBe(true);
      expect(result.current.isCreating).toBe(false);
    });
  });

  describe('closeEditor', () => {
    it('closes editor and resets isCreating', () => {
      const { result } = renderHook(() => useGuardrailsStore());

      act(() => {
        result.current.openEditor(true);
      });

      act(() => {
        result.current.closeEditor();
      });

      expect(result.current.isEditorOpen).toBe(false);
      expect(result.current.isCreating).toBe(false);
    });
  });

  describe('toggleAuditPanel', () => {
    it('opens audit panel when closed', () => {
      const { result } = renderHook(() => useGuardrailsStore());

      act(() => {
        result.current.toggleAuditPanel();
      });

      expect(result.current.isAuditPanelOpen).toBe(true);
    });

    it('closes audit panel when open', () => {
      const { result } = renderHook(() => useGuardrailsStore());

      act(() => {
        result.current.toggleAuditPanel();
      });

      act(() => {
        result.current.toggleAuditPanel();
      });

      expect(result.current.isAuditPanelOpen).toBe(false);
    });
  });

  describe('setLoading', () => {
    it('sets loading to true', () => {
      const { result } = renderHook(() => useGuardrailsStore());

      act(() => {
        result.current.setLoading(true);
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('sets loading to false', () => {
      const { result } = renderHook(() => useGuardrailsStore());

      act(() => {
        result.current.setLoading(true);
      });

      act(() => {
        result.current.setLoading(false);
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('resetFilters', () => {
    it('clears category filter', () => {
      const { result } = renderHook(() => useGuardrailsStore());

      act(() => {
        result.current.setCategoryFilter('tdd_protocol');
      });

      act(() => {
        result.current.resetFilters();
      });

      expect(result.current.categoryFilter).toBeNull();
    });

    it('clears enabled filter', () => {
      const { result } = renderHook(() => useGuardrailsStore());

      act(() => {
        result.current.setEnabledFilter(true);
      });

      act(() => {
        result.current.resetFilters();
      });

      expect(result.current.enabledFilter).toBeNull();
    });

    it('clears search query', () => {
      const { result } = renderHook(() => useGuardrailsStore());

      act(() => {
        result.current.setSearchQuery('test query');
      });

      act(() => {
        result.current.resetFilters();
      });

      expect(result.current.searchQuery).toBe('');
    });

    it('resets page to 1', () => {
      const { result } = renderHook(() => useGuardrailsStore());

      act(() => {
        result.current.setPage(7);
      });

      act(() => {
        result.current.resetFilters();
      });

      expect(result.current.page).toBe(1);
    });

    it('does not affect sort settings', () => {
      const { result } = renderHook(() => useGuardrailsStore());

      act(() => {
        result.current.setSortBy('name');
        result.current.setSortOrder('asc');
      });

      act(() => {
        result.current.resetFilters();
      });

      expect(result.current.sortBy).toBe('name');
      expect(result.current.sortOrder).toBe('asc');
    });

    it('does not affect guidelines data', () => {
      const { result } = renderHook(() => useGuardrailsStore());

      act(() => {
        result.current.setGuidelines([mockGuideline], 1);
        result.current.setCategoryFilter('tdd_protocol');
      });

      act(() => {
        result.current.resetFilters();
      });

      expect(result.current.guidelines).toEqual([mockGuideline]);
      expect(result.current.totalCount).toBe(1);
    });

    it('does not affect editor state', () => {
      const { result } = renderHook(() => useGuardrailsStore());

      act(() => {
        result.current.openEditor(true);
        result.current.setCategoryFilter('custom');
      });

      act(() => {
        result.current.resetFilters();
      });

      expect(result.current.isEditorOpen).toBe(true);
      expect(result.current.isCreating).toBe(true);
    });
  });
});
