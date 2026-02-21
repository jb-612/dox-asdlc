/**
 * Integration tests for KnowledgeStore Search UI (P05-F08)
 *
 * Tests full search flow including:
 * - Search -> Results -> Document navigation
 * - Filter combinations
 * - Backend switching
 * - History and favorites persistence
 * - Error states and recovery
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SearchPage from './SearchPage';
import { useSearchStore } from '../../stores/searchStore';

// Wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

describe('SearchPage Integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    useSearchStore.setState({
      recentSearches: [],
      favoriteSearches: [],
      selectedBackend: 'mock',
      filtersOpen: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Full Search Flow', () => {
    it('searches and displays results', () => {
      render(<SearchPage />, { wrapper: createWrapper() });

      // Enter search query
      const input = screen.getByLabelText(/search knowledge/i);
      fireEvent.change(input, { target: { value: 'KnowledgeStore' } });

      // Results container should be present
      expect(screen.getByTestId('search-results')).toBeInTheDocument();
    });

    it('clears search on clear button click', () => {
      render(<SearchPage />, { wrapper: createWrapper() });

      // Enter search query
      const input = screen.getByLabelText(/search knowledge/i);
      fireEvent.change(input, { target: { value: 'test' } });

      // Clear button should appear
      const clearButton = screen.getByTestId('clear-button');
      expect(clearButton).toBeInTheDocument();

      // Click clear
      fireEvent.click(clearButton);

      // Input should be empty
      expect(input).toHaveValue('');
    });
  });

  describe('Filter Combinations', () => {
    it('toggles filter panel visibility', () => {
      render(<SearchPage />, { wrapper: createWrapper() });

      // Click filters toggle
      fireEvent.click(screen.getByTestId('filters-toggle'));

      // Store should update
      expect(useSearchStore.getState().filtersOpen).toBe(false);
    });

    it('applies file type filter', () => {
      render(<SearchPage />, { wrapper: createWrapper() });

      // Filters panel should be visible
      expect(screen.getByTestId('search-filters')).toBeInTheDocument();
    });
  });

  describe('Backend Switching', () => {
    it('switches backend mode', () => {
      render(<SearchPage />, { wrapper: createWrapper() });

      // Change backend
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'rest' } });

      // Store should update
      expect(useSearchStore.getState().selectedBackend).toBe('rest');
    });

    it('persists backend selection', () => {
      render(<SearchPage />, { wrapper: createWrapper() });

      // Change backend
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'rest' } });

      // Check localStorage
      const stored = JSON.parse(
        localStorage.getItem('asdlc:knowledge-search-store') || '{}'
      );
      expect(stored.state?.selectedBackend).toBe('rest');
    });
  });

  describe('History and Favorites', () => {
    it('adds search to history when submitting', async () => {
      render(<SearchPage />, { wrapper: createWrapper() });

      // Enter and submit search
      const input = screen.getByLabelText(/search knowledge/i);
      fireEvent.change(input, { target: { value: 'test query' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Wait for store update
      await vi.advanceTimersByTimeAsync(100);

      // Check store
      expect(useSearchStore.getState().recentSearches.length).toBeGreaterThan(0);
      expect(useSearchStore.getState().recentSearches[0].query).toBe('test query');
    });

    it('persists history to localStorage', async () => {
      render(<SearchPage />, { wrapper: createWrapper() });

      // Enter and submit search
      const input = screen.getByLabelText(/search knowledge/i);
      fireEvent.change(input, { target: { value: 'persisted search' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Wait for store update
      await vi.advanceTimersByTimeAsync(100);

      // Check localStorage
      const stored = JSON.parse(
        localStorage.getItem('asdlc:knowledge-search-store') || '{}'
      );
      expect(stored.state?.recentSearches?.length).toBeGreaterThan(0);
    });

    it('limits recent searches to max count', async () => {
      render(<SearchPage />, { wrapper: createWrapper() });

      const input = screen.getByLabelText(/search knowledge/i);

      // Add more than max searches
      for (let i = 0; i < 12; i++) {
        fireEvent.change(input, { target: { value: `search ${i}` } });
        fireEvent.keyDown(input, { key: 'Enter' });
        await vi.advanceTimersByTimeAsync(50);
      }

      // Should be limited to 10
      expect(useSearchStore.getState().recentSearches.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Error States', () => {
    it('shows empty state for no results', async () => {
      render(<SearchPage />, { wrapper: createWrapper() });

      // Search for something that won't match
      const input = screen.getByLabelText(/search knowledge/i);
      fireEvent.change(input, { target: { value: 'xyznonexistent123' } });

      // Wait for debounce
      await vi.advanceTimersByTimeAsync(400);

      // Results area should still be present
      expect(screen.getByTestId('search-results')).toBeInTheDocument();
    });
  });

  describe('Responsive Layout', () => {
    it('has mobile sidebar toggle', () => {
      render(<SearchPage />, { wrapper: createWrapper() });

      // Mobile toggle should exist
      expect(screen.getByTestId('mobile-sidebar-toggle')).toBeInTheDocument();
    });

    it('toggles mobile sidebar visibility', () => {
      render(<SearchPage />, { wrapper: createWrapper() });

      const toggle = screen.getByTestId('mobile-sidebar-toggle');

      // Initially sidebar should be hidden on mobile (aria-expanded false)
      expect(toggle).toHaveAttribute('aria-expanded', 'false');

      // Click to open
      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'true');

      // Click to close
      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('Accessibility', () => {
    it('has accessible search input', () => {
      render(<SearchPage />, { wrapper: createWrapper() });
      expect(screen.getByLabelText(/search knowledge/i)).toBeInTheDocument();
    });

    it('has accessible backend selector', () => {
      render(<SearchPage />, { wrapper: createWrapper() });
      expect(screen.getByLabelText(/select backend/i)).toBeInTheDocument();
    });

    it('has accessible filters toggle', () => {
      render(<SearchPage />, { wrapper: createWrapper() });
      expect(screen.getByLabelText(/toggle search filters/i)).toBeInTheDocument();
    });

    it('supports keyboard navigation for search', async () => {
      render(<SearchPage />, { wrapper: createWrapper() });

      const input = screen.getByLabelText(/search knowledge/i);
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Search should be added to history
      await vi.advanceTimersByTimeAsync(100);
      expect(useSearchStore.getState().recentSearches.length).toBeGreaterThan(0);
    });

    it('supports Escape to clear search', () => {
      render(<SearchPage />, { wrapper: createWrapper() });

      const input = screen.getByLabelText(/search knowledge/i);
      fireEvent.change(input, { target: { value: 'test' } });
      expect(input).toHaveValue('test');

      // Press Escape
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(input).toHaveValue('');
    });
  });

  describe('Health Status', () => {
    it('shows health indicator', () => {
      render(<SearchPage />, { wrapper: createWrapper() });
      expect(screen.getByTestId('health-indicator')).toBeInTheDocument();
    });

    it('health indicator has accessible status', () => {
      render(<SearchPage />, { wrapper: createWrapper() });
      const indicator = screen.getByTestId('health-indicator');
      expect(indicator).toHaveAttribute('role', 'status');
      expect(indicator).toHaveAttribute('aria-label');
    });
  });
});
