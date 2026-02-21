/**
 * Search Store - Zustand store for KnowledgeStore search state
 *
 * Part of P05-F08 KnowledgeStore Search UI
 *
 * Manages:
 * - Recent and favorite searches (persisted to localStorage)
 * - Selected backend mode
 * - Filter panel visibility
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  SearchBackendMode,
  SearchFilters,
  SavedSearch,
} from '../api/types';

// ============================================================================
// Constants
// ============================================================================

const MAX_RECENT_SEARCHES = 10;
const STORAGE_KEY = 'asdlc:knowledge-search-store';

// ============================================================================
// Types
// ============================================================================

export interface SearchState {
  // Recent and favorite searches
  recentSearches: SavedSearch[];
  favoriteSearches: SavedSearch[];

  // UI state
  selectedBackend: SearchBackendMode;
  filtersOpen: boolean;

  // Actions
  addRecentSearch: (query: string, filters?: SearchFilters) => void;
  toggleFavorite: (searchId: string) => void;
  removeFromHistory: (searchId: string) => void;
  clearHistory: () => void;
  setBackend: (mode: SearchBackendMode) => void;
  toggleFilters: () => void;
  setFiltersOpen: (open: boolean) => void;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Generate unique ID for saved search
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useSearchStore = create<SearchState>()(
  persist(
    (set, get) => ({
      // Initial state
      recentSearches: [],
      favoriteSearches: [],
      selectedBackend: 'mock',
      filtersOpen: true,

      // Add a search to recent history
      addRecentSearch: (query: string, filters?: SearchFilters) => {
        const trimmedQuery = query.trim();
        if (!trimmedQuery) return;

        const newSearch: SavedSearch = {
          id: generateId(),
          query: trimmedQuery,
          filters,
          timestamp: new Date().toISOString(),
          isFavorite: false,
        };

        set((state) => {
          // Remove duplicate if exists (by query)
          const filtered = state.recentSearches.filter(
            (s) => s.query.toLowerCase() !== trimmedQuery.toLowerCase()
          );

          // Add new search at beginning, limit to max
          const updated = [newSearch, ...filtered].slice(0, MAX_RECENT_SEARCHES);

          return { recentSearches: updated };
        });
      },

      // Toggle favorite status for a search
      toggleFavorite: (searchId: string) => {
        set((state) => {
          // Find the search in recent or favorites
          const fromRecent = state.recentSearches.find((s) => s.id === searchId);
          const fromFavorites = state.favoriteSearches.find((s) => s.id === searchId);
          const search = fromRecent || fromFavorites;

          if (!search) return state;

          if (search.isFavorite) {
            // Remove from favorites
            return {
              favoriteSearches: state.favoriteSearches.filter(
                (s) => s.id !== searchId
              ),
              recentSearches: state.recentSearches.map((s) =>
                s.id === searchId ? { ...s, isFavorite: false } : s
              ),
            };
          } else {
            // Add to favorites
            const favSearch = { ...search, isFavorite: true };
            return {
              favoriteSearches: [...state.favoriteSearches, favSearch],
              recentSearches: state.recentSearches.map((s) =>
                s.id === searchId ? { ...s, isFavorite: true } : s
              ),
            };
          }
        });
      },

      // Remove a specific search from history
      removeFromHistory: (searchId: string) => {
        set((state) => ({
          recentSearches: state.recentSearches.filter((s) => s.id !== searchId),
          favoriteSearches: state.favoriteSearches.filter((s) => s.id !== searchId),
        }));
      },

      // Clear all recent searches (favorites are preserved)
      clearHistory: () => {
        set({ recentSearches: [] });
      },

      // Set the backend mode
      setBackend: (mode: SearchBackendMode) => {
        set({ selectedBackend: mode });
      },

      // Toggle filters panel visibility
      toggleFilters: () => {
        set((state) => ({ filtersOpen: !state.filtersOpen }));
      },

      // Set filters panel visibility explicitly
      setFiltersOpen: (open: boolean) => {
        set({ filtersOpen: open });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Only persist these fields
      partialize: (state) => ({
        recentSearches: state.recentSearches,
        favoriteSearches: state.favoriteSearches,
        selectedBackend: state.selectedBackend,
      }),
    }
  )
);

// ============================================================================
// Selectors (for convenience)
// ============================================================================

/**
 * Get combined list of all saved searches (favorites first, then recent)
 */
export const selectAllSearches = (state: SearchState): SavedSearch[] => {
  const favoriteIds = new Set(state.favoriteSearches.map((s) => s.id));
  // Filter out favorites from recent to avoid duplicates
  const recentOnly = state.recentSearches.filter((s) => !favoriteIds.has(s.id));
  return [...state.favoriteSearches, ...recentOnly];
};

/**
 * Get count of active searches
 */
export const selectSearchCount = (state: SearchState): number => {
  return state.recentSearches.length + state.favoriteSearches.length;
};
