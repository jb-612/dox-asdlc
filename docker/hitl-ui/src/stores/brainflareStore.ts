/**
 * Zustand store for Brainflare Hub (P08-F05)
 *
 * Manages state for ideas including:
 * - Ideas list and filtering
 * - Selected idea for detail view
 * - CRUD operations
 * - UI state (loading, errors, form visibility)
 * - Classification counts (P08-F03 T18)
 */

import { create } from 'zustand';
import type {
  Idea,
  IdeaFilters,
  CreateIdeaRequest,
  UpdateIdeaRequest,
} from '../types/ideas';
import * as ideasApi from '../api/ideas';

/**
 * Classification counts for filter display
 */
export interface ClassificationCounts {
  functional: number;
  non_functional: number;
  undetermined: number;
  total: number;
}

/**
 * Brainflare store state interface
 */
export interface BrainflareState {
  // Data
  ideas: Idea[];
  selectedIdea: Idea | null;
  total: number;
  classificationCounts: ClassificationCounts | null;

  // Filters
  filters: IdeaFilters;

  // UI State
  isLoading: boolean;
  error: string | null;
  isFormOpen: boolean;
  editingIdea: Idea | null;

  // Actions
  fetchIdeas: () => Promise<void>;
  fetchClassificationCounts: () => Promise<void>;
  selectIdea: (id: string | null) => void;
  setFilters: (filters: Partial<IdeaFilters>) => void;
  clearFilters: () => void;
  createIdea: (request: CreateIdeaRequest) => Promise<Idea>;
  updateIdea: (id: string, request: UpdateIdeaRequest) => Promise<void>;
  deleteIdea: (id: string) => Promise<void>;
  archiveIdea: (id: string) => Promise<void>;
  openForm: (idea?: Idea) => void;
  closeForm: () => void;
  clearError: () => void;
}

/**
 * Brainflare Hub store
 */
export const useBrainflareStore = create<BrainflareState>((set, get) => ({
  // Initial state
  ideas: [],
  selectedIdea: null,
  total: 0,
  classificationCounts: null,
  filters: {},
  isLoading: false,
  error: null,
  isFormOpen: false,
  editingIdea: null,

  /**
   * Fetch ideas with current filters
   */
  fetchIdeas: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await ideasApi.fetchIdeas(get().filters);
      set({
        ideas: response.ideas,
        total: response.total,
        isLoading: false,
      });
    } catch (e) {
      set({
        error: (e as Error).message,
        isLoading: false,
      });
    }
  },

  /**
   * Fetch classification counts (P08-F03 T18)
   */
  fetchClassificationCounts: async () => {
    try {
      const counts = await ideasApi.fetchClassificationCounts(get().filters.status);
      set({ classificationCounts: counts });
    } catch (e) {
      // Silently fail - counts are optional enhancement
      console.warn('Failed to fetch classification counts:', (e as Error).message);
    }
  },

  /**
   * Select an idea by ID for detail view
   */
  selectIdea: (id) => {
    if (!id) {
      set({ selectedIdea: null });
      return;
    }

    const idea = get().ideas.find((i) => i.id === id);
    set({ selectedIdea: idea || null });
  },

  /**
   * Update filters and refetch ideas
   */
  setFilters: (filters) => {
    set({ filters: { ...get().filters, ...filters } });
    get().fetchIdeas();
  },

  /**
   * Clear all filters and refetch
   */
  clearFilters: () => {
    set({ filters: {} });
    get().fetchIdeas();
  },

  /**
   * Create a new idea
   */
  createIdea: async (request) => {
    const idea = await ideasApi.createIdea(request);
    set({
      ideas: [idea, ...get().ideas],
      total: get().total + 1,
    });
    return idea;
  },

  /**
   * Update an existing idea
   */
  updateIdea: async (id, request) => {
    const updated = await ideasApi.updateIdea(id, request);
    set({
      ideas: get().ideas.map((i) => (i.id === id ? updated : i)),
      selectedIdea: get().selectedIdea?.id === id ? updated : get().selectedIdea,
    });
  },

  /**
   * Delete an idea
   */
  deleteIdea: async (id) => {
    await ideasApi.deleteIdea(id);
    set({
      ideas: get().ideas.filter((i) => i.id !== id),
      total: get().total - 1,
      selectedIdea: get().selectedIdea?.id === id ? null : get().selectedIdea,
    });
  },

  /**
   * Archive an idea (set status to archived)
   */
  archiveIdea: async (id) => {
    await get().updateIdea(id, { status: 'archived' });

    // If filtering for active only, remove from list
    const currentFilters = get().filters;
    if (!currentFilters.status || currentFilters.status === 'active') {
      set({
        ideas: get().ideas.filter((i) => i.id !== id),
        selectedIdea: get().selectedIdea?.id === id ? null : get().selectedIdea,
      });
    }
  },

  /**
   * Open the idea form (for create or edit)
   */
  openForm: (idea) => {
    set({
      isFormOpen: true,
      editingIdea: idea || null,
    });
  },

  /**
   * Close the idea form
   */
  closeForm: () => {
    set({
      isFormOpen: false,
      editingIdea: null,
    });
  },

  /**
   * Clear error state
   */
  clearError: () => {
    set({ error: null });
  },
}));
