/**
 * Guardrails Configuration Zustand Store (P11-F01)
 *
 * Manages UI state for the guardrails management page including
 * guidelines list, selection, filters, pagination, editor state,
 * and audit panel visibility.
 */

import { create } from 'zustand';
import type { Guideline, GuidelineCategory } from '../api/types/guardrails';

// ============================================================================
// Types
// ============================================================================

export interface GuardrailsState {
  // Guidelines list
  guidelines: Guideline[];
  totalCount: number;

  // Selection
  selectedGuidelineId: string | null;

  // Filters
  categoryFilter: GuidelineCategory | null;
  enabledFilter: boolean | null;
  searchQuery: string;
  sortBy: 'priority' | 'name' | 'updated_at';
  sortOrder: 'asc' | 'desc';

  // Pagination
  page: number;
  pageSize: number;

  // Editor state
  isEditorOpen: boolean;
  isCreating: boolean; // true for new, false for editing

  // Audit panel
  isAuditPanelOpen: boolean;

  // Loading
  isLoading: boolean;

  // Actions
  setGuidelines: (guidelines: Guideline[], total: number) => void;
  selectGuideline: (id: string | null) => void;
  setCategoryFilter: (category: GuidelineCategory | null) => void;
  setEnabledFilter: (enabled: boolean | null) => void;
  setSearchQuery: (query: string) => void;
  setSortBy: (sortBy: 'priority' | 'name' | 'updated_at') => void;
  setSortOrder: (order: 'asc' | 'desc') => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  openEditor: (creating?: boolean) => void;
  closeEditor: () => void;
  toggleAuditPanel: () => void;
  setLoading: (loading: boolean) => void;
  resetFilters: () => void;
}

// ============================================================================
// Store
// ============================================================================

export const useGuardrailsStore = create<GuardrailsState>((set) => ({
  // Initial state
  guidelines: [],
  totalCount: 0,
  selectedGuidelineId: null,
  categoryFilter: null,
  enabledFilter: null,
  searchQuery: '',
  sortBy: 'priority',
  sortOrder: 'desc',
  page: 1,
  pageSize: 20,
  isEditorOpen: false,
  isCreating: false,
  isAuditPanelOpen: false,
  isLoading: false,

  // Actions
  setGuidelines: (guidelines, total) => set({ guidelines, totalCount: total }),

  selectGuideline: (id) => set({ selectedGuidelineId: id }),

  setCategoryFilter: (category) => set({ categoryFilter: category, page: 1 }),

  setEnabledFilter: (enabled) => set({ enabledFilter: enabled, page: 1 }),

  setSearchQuery: (query) => set({ searchQuery: query, page: 1 }),

  setSortBy: (sortBy) => set({ sortBy }),

  setSortOrder: (order) => set({ sortOrder: order }),

  setPage: (page) => set({ page }),

  setPageSize: (size) => set({ pageSize: size, page: 1 }),

  openEditor: (creating = false) => set({ isEditorOpen: true, isCreating: creating }),

  closeEditor: () => set({ isEditorOpen: false, isCreating: false }),

  toggleAuditPanel: () =>
    set((state) => ({ isAuditPanelOpen: !state.isAuditPanelOpen })),

  setLoading: (loading) => set({ isLoading: loading }),

  resetFilters: () =>
    set({ categoryFilter: null, enabledFilter: null, searchQuery: '', page: 1 }),
}));

// ============================================================================
// Selectors (for optimized component subscriptions)
// ============================================================================

export const selectGuidelines = (state: GuardrailsState) => state.guidelines;
export const selectTotalCount = (state: GuardrailsState) => state.totalCount;
export const selectSelectedGuidelineId = (state: GuardrailsState) =>
  state.selectedGuidelineId;
export const selectCategoryFilter = (state: GuardrailsState) =>
  state.categoryFilter;
export const selectEnabledFilter = (state: GuardrailsState) =>
  state.enabledFilter;
export const selectSearchQuery = (state: GuardrailsState) => state.searchQuery;
export const selectSortBy = (state: GuardrailsState) => state.sortBy;
export const selectSortOrder = (state: GuardrailsState) => state.sortOrder;
export const selectPage = (state: GuardrailsState) => state.page;
export const selectPageSize = (state: GuardrailsState) => state.pageSize;
export const selectIsEditorOpen = (state: GuardrailsState) => state.isEditorOpen;
export const selectIsCreating = (state: GuardrailsState) => state.isCreating;
export const selectIsAuditPanelOpen = (state: GuardrailsState) =>
  state.isAuditPanelOpen;
export const selectIsLoading = (state: GuardrailsState) => state.isLoading;

/**
 * Get the currently selected guideline object from the list.
 * Returns undefined if no guideline is selected or the selected ID
 * is not found in the current guidelines array.
 */
export const selectSelectedGuideline = (state: GuardrailsState) =>
  state.guidelines.find((g) => g.id === state.selectedGuidelineId);

/**
 * Calculate total number of pages based on totalCount and pageSize.
 */
export const selectTotalPages = (state: GuardrailsState) =>
  Math.ceil(state.totalCount / state.pageSize) || 1;
