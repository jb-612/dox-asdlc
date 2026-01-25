/**
 * Tests for SearchPage component (P05-F08 Task 2.7)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SearchPage from './SearchPage';
import { useSearchStore } from '../../stores/searchStore';

// Create a wrapper with QueryClientProvider
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

describe('SearchPage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Clear localStorage before each test
    localStorage.clear();
    // Reset store state
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

  describe('Basic Rendering', () => {
    it('renders all sections', () => {
      render(<SearchPage />, { wrapper: createWrapper() });

      expect(screen.getByTestId('search-page')).toBeInTheDocument();
      expect(screen.getByTestId('search-bar')).toBeInTheDocument();
      expect(screen.getByTestId('backend-selector')).toBeInTheDocument();
      expect(screen.getByTestId('search-filters')).toBeInTheDocument();
      expect(screen.getByTestId('search-results')).toBeInTheDocument();
    });

    it('renders page title', () => {
      render(<SearchPage />, { wrapper: createWrapper() });
      expect(screen.getByRole('heading', { name: /knowledge search/i })).toBeInTheDocument();
    });

    it('renders history panel', () => {
      render(<SearchPage />, { wrapper: createWrapper() });
      expect(screen.getByTestId('search-history')).toBeInTheDocument();
    });
  });

  describe('Search Flow', () => {
    it('shows empty state initially', () => {
      render(<SearchPage />, { wrapper: createWrapper() });
      // Initially should show some kind of empty or initial state
      expect(screen.getByTestId('search-results')).toBeInTheDocument();
    });

    it('updates input value on change', () => {
      render(<SearchPage />, { wrapper: createWrapper() });
      const input = screen.getByRole('textbox');

      fireEvent.change(input, { target: { value: 'KnowledgeStore' } });
      expect(input).toHaveValue('KnowledgeStore');
    });
  });

  describe('Filter Integration', () => {
    it('shows filter toggle button', () => {
      render(<SearchPage />, { wrapper: createWrapper() });
      expect(screen.getByTestId('filters-toggle')).toBeInTheDocument();
    });
  });

  describe('Backend Selector', () => {
    it('defaults to mock backend', () => {
      render(<SearchPage />, { wrapper: createWrapper() });
      expect(screen.getByRole('combobox')).toHaveValue('mock');
    });

    it('allows changing backend mode', () => {
      render(<SearchPage />, { wrapper: createWrapper() });

      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'rest' } });
      expect(screen.getByRole('combobox')).toHaveValue('rest');
    });
  });

  describe('Responsive Layout', () => {
    it('has responsive grid classes', () => {
      render(<SearchPage />, { wrapper: createWrapper() });
      const container = screen.getByTestId('search-page');
      // Check for responsive layout classes
      expect(container.querySelector('.lg\\:grid-cols-4')).toBeInTheDocument();
    });
  });

  describe('History Integration', () => {
    it('shows history panel', () => {
      render(<SearchPage />, { wrapper: createWrapper() });
      // History panel should be visible
      const history = screen.getByTestId('search-history');
      expect(history).toBeInTheDocument();
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
  });

  describe('Store Integration', () => {
    it('uses store for backend selection', () => {
      // Set backend in store
      useSearchStore.setState({ selectedBackend: 'rest' });

      render(<SearchPage />, { wrapper: createWrapper() });

      expect(screen.getByRole('combobox')).toHaveValue('rest');
    });

    it('updates store when backend changes', () => {
      render(<SearchPage />, { wrapper: createWrapper() });

      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'rest' } });

      expect(useSearchStore.getState().selectedBackend).toBe('rest');
    });

    it('uses store for filters visibility', () => {
      useSearchStore.setState({ filtersOpen: false });

      render(<SearchPage />, { wrapper: createWrapper() });

      // Filters panel should be collapsed
      const filtersPanel = screen.getByTestId('search-filters');
      expect(filtersPanel).toBeInTheDocument();
    });
  });
});
