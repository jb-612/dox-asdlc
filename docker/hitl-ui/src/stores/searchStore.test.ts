/**
 * Tests for Search Store
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSearchStore, selectAllSearches, selectSearchCount } from './searchStore';
import type { SavedSearch } from '../api/types';

describe('searchStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useSearchStore.setState({
      recentSearches: [],
      favoriteSearches: [],
      selectedBackend: 'mock',
      filtersOpen: true,
    });
    // Clear localStorage
    localStorage.clear();
  });

  describe('addRecentSearch', () => {
    it('adds search to recent history', () => {
      const { result } = renderHook(() => useSearchStore());

      act(() => {
        result.current.addRecentSearch('test query');
      });

      expect(result.current.recentSearches).toHaveLength(1);
      expect(result.current.recentSearches[0].query).toBe('test query');
      expect(result.current.recentSearches[0].isFavorite).toBe(false);
    });

    it('adds search with filters', () => {
      const { result } = renderHook(() => useSearchStore());
      const filters = { fileTypes: ['.py', '.ts'] };

      act(() => {
        result.current.addRecentSearch('test', filters);
      });

      expect(result.current.recentSearches[0].filters).toEqual(filters);
    });

    it('removes duplicate queries', () => {
      const { result } = renderHook(() => useSearchStore());

      act(() => {
        result.current.addRecentSearch('query 1');
        result.current.addRecentSearch('query 2');
        result.current.addRecentSearch('query 1'); // Duplicate
      });

      expect(result.current.recentSearches).toHaveLength(2);
      // Most recent should be first
      expect(result.current.recentSearches[0].query).toBe('query 1');
    });

    it('ignores empty queries', () => {
      const { result } = renderHook(() => useSearchStore());

      act(() => {
        result.current.addRecentSearch('');
        result.current.addRecentSearch('   ');
      });

      expect(result.current.recentSearches).toHaveLength(0);
    });

    it('limits to max recent searches', () => {
      const { result } = renderHook(() => useSearchStore());

      act(() => {
        for (let i = 0; i < 15; i++) {
          result.current.addRecentSearch(`query ${i}`);
        }
      });

      expect(result.current.recentSearches).toHaveLength(10);
      // Most recent should be first
      expect(result.current.recentSearches[0].query).toBe('query 14');
    });

    it('generates unique IDs', () => {
      const { result } = renderHook(() => useSearchStore());

      act(() => {
        result.current.addRecentSearch('query 1');
        result.current.addRecentSearch('query 2');
      });

      const ids = result.current.recentSearches.map((s) => s.id);
      expect(new Set(ids).size).toBe(2);
    });

    it('sets timestamp on new search', () => {
      const { result } = renderHook(() => useSearchStore());
      const beforeTime = new Date().toISOString();

      act(() => {
        result.current.addRecentSearch('test');
      });

      const timestamp = result.current.recentSearches[0].timestamp;
      expect(timestamp >= beforeTime).toBe(true);
    });
  });

  describe('toggleFavorite', () => {
    it('adds search to favorites', () => {
      const { result } = renderHook(() => useSearchStore());

      act(() => {
        result.current.addRecentSearch('test query');
      });

      const searchId = result.current.recentSearches[0].id;

      act(() => {
        result.current.toggleFavorite(searchId);
      });

      expect(result.current.favoriteSearches).toHaveLength(1);
      expect(result.current.favoriteSearches[0].query).toBe('test query');
      expect(result.current.favoriteSearches[0].isFavorite).toBe(true);
      // Should also update in recent
      expect(result.current.recentSearches[0].isFavorite).toBe(true);
    });

    it('removes search from favorites', () => {
      const { result } = renderHook(() => useSearchStore());

      act(() => {
        result.current.addRecentSearch('test query');
      });

      const searchId = result.current.recentSearches[0].id;

      act(() => {
        result.current.toggleFavorite(searchId); // Add
        result.current.toggleFavorite(searchId); // Remove
      });

      expect(result.current.favoriteSearches).toHaveLength(0);
      expect(result.current.recentSearches[0].isFavorite).toBe(false);
    });

    it('does nothing for unknown searchId', () => {
      const { result } = renderHook(() => useSearchStore());

      act(() => {
        result.current.addRecentSearch('test');
        result.current.toggleFavorite('nonexistent-id');
      });

      expect(result.current.favoriteSearches).toHaveLength(0);
    });
  });

  describe('removeFromHistory', () => {
    it('removes search from recent', () => {
      const { result } = renderHook(() => useSearchStore());

      act(() => {
        result.current.addRecentSearch('test 1');
        result.current.addRecentSearch('test 2');
      });

      const searchId = result.current.recentSearches[0].id;

      act(() => {
        result.current.removeFromHistory(searchId);
      });

      expect(result.current.recentSearches).toHaveLength(1);
    });

    it('removes search from favorites', () => {
      const { result } = renderHook(() => useSearchStore());

      act(() => {
        result.current.addRecentSearch('test');
      });

      const searchId = result.current.recentSearches[0].id;

      act(() => {
        result.current.toggleFavorite(searchId);
        result.current.removeFromHistory(searchId);
      });

      expect(result.current.favoriteSearches).toHaveLength(0);
    });
  });

  describe('clearHistory', () => {
    it('clears all recent searches', () => {
      const { result } = renderHook(() => useSearchStore());

      act(() => {
        result.current.addRecentSearch('test 1');
        result.current.addRecentSearch('test 2');
        result.current.clearHistory();
      });

      expect(result.current.recentSearches).toHaveLength(0);
    });

    it('preserves favorites', () => {
      const { result } = renderHook(() => useSearchStore());

      act(() => {
        result.current.addRecentSearch('test 1');
        result.current.addRecentSearch('test 2');
      });

      const searchId = result.current.recentSearches[0].id;

      act(() => {
        result.current.toggleFavorite(searchId);
        result.current.clearHistory();
      });

      expect(result.current.favoriteSearches).toHaveLength(1);
    });
  });

  describe('setBackend', () => {
    it('updates selected backend', () => {
      const { result } = renderHook(() => useSearchStore());

      act(() => {
        result.current.setBackend('rest');
      });

      expect(result.current.selectedBackend).toBe('rest');
    });
  });

  describe('toggleFilters', () => {
    it('toggles filters open state', () => {
      const { result } = renderHook(() => useSearchStore());

      expect(result.current.filtersOpen).toBe(true);

      act(() => {
        result.current.toggleFilters();
      });

      expect(result.current.filtersOpen).toBe(false);

      act(() => {
        result.current.toggleFilters();
      });

      expect(result.current.filtersOpen).toBe(true);
    });
  });

  describe('setFiltersOpen', () => {
    it('sets filters open state explicitly', () => {
      const { result } = renderHook(() => useSearchStore());

      act(() => {
        result.current.setFiltersOpen(false);
      });

      expect(result.current.filtersOpen).toBe(false);

      act(() => {
        result.current.setFiltersOpen(true);
      });

      expect(result.current.filtersOpen).toBe(true);
    });
  });

  describe('selectors', () => {
    describe('selectAllSearches', () => {
      it('returns favorites first then recent', () => {
        const { result } = renderHook(() => useSearchStore());

        act(() => {
          result.current.addRecentSearch('recent 1');
          result.current.addRecentSearch('recent 2');
        });

        const firstId = result.current.recentSearches[1].id;

        act(() => {
          result.current.toggleFavorite(firstId);
        });

        const allSearches = selectAllSearches(result.current);

        expect(allSearches[0].query).toBe('recent 1');
        expect(allSearches[0].isFavorite).toBe(true);
      });

      it('avoids duplicate entries', () => {
        const { result } = renderHook(() => useSearchStore());

        act(() => {
          result.current.addRecentSearch('test');
        });

        const searchId = result.current.recentSearches[0].id;

        act(() => {
          result.current.toggleFavorite(searchId);
        });

        const allSearches = selectAllSearches(result.current);

        // Should only appear once (in favorites section)
        expect(allSearches.filter((s) => s.query === 'test')).toHaveLength(1);
      });
    });

    describe('selectSearchCount', () => {
      it('returns total count of all searches', () => {
        const { result } = renderHook(() => useSearchStore());

        act(() => {
          result.current.addRecentSearch('test 1');
          result.current.addRecentSearch('test 2');
        });

        const firstId = result.current.recentSearches[0].id;

        act(() => {
          result.current.toggleFavorite(firstId);
        });

        const count = selectSearchCount(result.current);

        // 2 recent + 1 favorite = 3
        expect(count).toBe(3);
      });
    });
  });

  describe('persistence', () => {
    it('persists to localStorage', () => {
      const { result } = renderHook(() => useSearchStore());

      act(() => {
        result.current.addRecentSearch('persisted search');
        result.current.setBackend('rest');
      });

      // Check localStorage
      const stored = JSON.parse(
        localStorage.getItem('knowledge-search-store') || '{}'
      );

      expect(stored.state.recentSearches).toHaveLength(1);
      expect(stored.state.selectedBackend).toBe('rest');
    });

    it('does not persist filtersOpen', () => {
      const { result } = renderHook(() => useSearchStore());

      act(() => {
        result.current.setFiltersOpen(false);
      });

      const stored = JSON.parse(
        localStorage.getItem('knowledge-search-store') || '{}'
      );

      expect(stored.state.filtersOpen).toBeUndefined();
    });
  });
});
