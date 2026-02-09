/**
 * Tests for GuidelinesList component (P11-F01 T21)
 *
 * Verifies list rendering, search filtering, category/enabled dropdowns,
 * sort controls, pagination, loading skeleton, empty state, and
 * new guideline button.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { GuidelinesList } from './GuidelinesList';
import type { Guideline, GuidelinesListResponse } from '@/api/types/guardrails';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

const mockSetCategoryFilter = vi.fn();
const mockSetEnabledFilter = vi.fn();
const mockSetSearchQuery = vi.fn();
const mockSetSortBy = vi.fn();
const mockSetSortOrder = vi.fn();
const mockSetPage = vi.fn();
const mockSelectGuideline = vi.fn();

const defaultStoreState = {
  categoryFilter: null as null | string,
  enabledFilter: null as null | boolean,
  searchQuery: '',
  sortBy: 'priority' as const,
  sortOrder: 'desc' as const,
  page: 1,
  pageSize: 20,
  selectedGuidelineId: null as null | string,
  setCategoryFilter: mockSetCategoryFilter,
  setEnabledFilter: mockSetEnabledFilter,
  setSearchQuery: mockSetSearchQuery,
  setSortBy: mockSetSortBy,
  setSortOrder: mockSetSortOrder,
  setPage: mockSetPage,
  selectGuideline: mockSelectGuideline,
};

let storeState = { ...defaultStoreState };

vi.mock('../../stores/guardrailsStore', () => ({
  useGuardrailsStore: () => storeState,
}));

const mockToggleMutate = vi.fn();

let mockQueryResult: {
  data: GuidelinesListResponse | undefined;
  isLoading: boolean;
};

vi.mock('../../api/guardrails', () => ({
  useGuidelinesList: () => mockQueryResult,
  useToggleGuideline: () => ({ mutate: mockToggleMutate }),
}));

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const makeGuideline = (overrides: Partial<Guideline> = {}): Guideline => ({
  id: 'gl-test-001',
  name: 'Test Guideline Alpha',
  description: 'Alpha description for testing.',
  category: 'cognitive_isolation',
  priority: 900,
  enabled: true,
  condition: { agents: ['backend'] },
  action: { action_type: 'instruction', instruction: 'Follow the rules.' },
  version: 1,
  created_at: '2026-01-15T10:00:00Z',
  updated_at: '2026-01-15T10:00:00Z',
  created_by: 'admin',
  ...overrides,
});

const mockGuidelines: Guideline[] = [
  makeGuideline({ id: 'gl-1', name: 'Alpha Guideline', priority: 900, category: 'cognitive_isolation' }),
  makeGuideline({ id: 'gl-2', name: 'Beta Guideline', priority: 800, category: 'tdd_protocol', description: 'Beta description.' }),
  makeGuideline({ id: 'gl-3', name: 'Gamma Guideline', priority: 700, category: 'hitl_gate', enabled: false }),
];

const mockListResponse: GuidelinesListResponse = {
  guidelines: mockGuidelines,
  total: 3,
  page: 1,
  page_size: 20,
};

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  storeState = { ...defaultStoreState };
  mockQueryResult = { data: mockListResponse, isLoading: false };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GuidelinesList', () => {
  describe('Rendering guideline cards', () => {
    it('renders a list of GuidelineCard components', () => {
      render(<GuidelinesList />);

      expect(screen.getByTestId('guideline-card-gl-1')).toBeInTheDocument();
      expect(screen.getByTestId('guideline-card-gl-2')).toBeInTheDocument();
      expect(screen.getByTestId('guideline-card-gl-3')).toBeInTheDocument();
    });

    it('displays the correct number of guidelines', () => {
      render(<GuidelinesList />);

      const cards = screen.getAllByTestId(/^guideline-card-/);
      expect(cards).toHaveLength(3);
    });
  });

  describe('Loading state', () => {
    it('shows loading skeleton when data is loading', () => {
      mockQueryResult = { data: undefined, isLoading: true };
      render(<GuidelinesList />);

      expect(screen.getByTestId('guidelines-loading')).toBeInTheDocument();
    });

    it('does not show cards while loading', () => {
      mockQueryResult = { data: undefined, isLoading: true };
      render(<GuidelinesList />);

      expect(screen.queryByTestId(/^guideline-card-/)).not.toBeInTheDocument();
    });
  });

  describe('Empty state', () => {
    it('shows empty state when no guidelines match filters', () => {
      mockQueryResult = {
        data: { guidelines: [], total: 0, page: 1, page_size: 20 },
        isLoading: false,
      };
      render(<GuidelinesList />);

      expect(screen.getByTestId('guidelines-empty')).toBeInTheDocument();
    });

    it('shows empty state message text', () => {
      mockQueryResult = {
        data: { guidelines: [], total: 0, page: 1, page_size: 20 },
        isLoading: false,
      };
      render(<GuidelinesList />);

      expect(screen.getByText(/no guidelines/i)).toBeInTheDocument();
    });
  });

  describe('Search input', () => {
    it('renders a search input', () => {
      render(<GuidelinesList />);

      expect(screen.getByTestId('guidelines-search')).toBeInTheDocument();
    });

    it('search input triggers setSearchQuery on change', () => {
      render(<GuidelinesList />);

      const input = screen.getByTestId('guidelines-search');
      fireEvent.change(input, { target: { value: 'Alpha' } });
      expect(mockSetSearchQuery).toHaveBeenCalledWith('Alpha');
    });

    it('filters displayed cards by search query (client-side)', () => {
      storeState = { ...defaultStoreState, searchQuery: 'Beta' };
      render(<GuidelinesList />);

      // Only Beta should be visible since client-side filter applies
      expect(screen.getByTestId('guideline-card-gl-2')).toBeInTheDocument();
      expect(screen.queryByTestId('guideline-card-gl-1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('guideline-card-gl-3')).not.toBeInTheDocument();
    });
  });

  describe('Category dropdown filter', () => {
    it('renders a category filter dropdown', () => {
      render(<GuidelinesList />);

      expect(screen.getByTestId('guidelines-category-filter')).toBeInTheDocument();
    });

    it('category change calls setCategoryFilter', () => {
      render(<GuidelinesList />);

      const select = screen.getByTestId('guidelines-category-filter');
      fireEvent.change(select, { target: { value: 'tdd_protocol' } });
      expect(mockSetCategoryFilter).toHaveBeenCalledWith('tdd_protocol');
    });

    it('category set to empty string calls setCategoryFilter with null', () => {
      render(<GuidelinesList />);

      const select = screen.getByTestId('guidelines-category-filter');
      fireEvent.change(select, { target: { value: '' } });
      expect(mockSetCategoryFilter).toHaveBeenCalledWith(null);
    });
  });

  describe('Enabled dropdown filter', () => {
    it('renders an enabled filter dropdown', () => {
      render(<GuidelinesList />);

      expect(screen.getByTestId('guidelines-enabled-filter')).toBeInTheDocument();
    });

    it('enabled change to "true" calls setEnabledFilter with true', () => {
      render(<GuidelinesList />);

      const select = screen.getByTestId('guidelines-enabled-filter');
      fireEvent.change(select, { target: { value: 'true' } });
      expect(mockSetEnabledFilter).toHaveBeenCalledWith(true);
    });

    it('enabled change to "false" calls setEnabledFilter with false', () => {
      render(<GuidelinesList />);

      const select = screen.getByTestId('guidelines-enabled-filter');
      fireEvent.change(select, { target: { value: 'false' } });
      expect(mockSetEnabledFilter).toHaveBeenCalledWith(false);
    });

    it('enabled change to "" calls setEnabledFilter with null', () => {
      render(<GuidelinesList />);

      const select = screen.getByTestId('guidelines-enabled-filter');
      fireEvent.change(select, { target: { value: '' } });
      expect(mockSetEnabledFilter).toHaveBeenCalledWith(null);
    });
  });

  describe('Sort controls', () => {
    it('renders a sort-by dropdown', () => {
      render(<GuidelinesList />);

      expect(screen.getByTestId('guidelines-sort-by')).toBeInTheDocument();
    });

    it('sort by change calls setSortBy', () => {
      render(<GuidelinesList />);

      const select = screen.getByTestId('guidelines-sort-by');
      fireEvent.change(select, { target: { value: 'name' } });
      expect(mockSetSortBy).toHaveBeenCalledWith('name');
    });

    it('renders a sort order toggle button', () => {
      render(<GuidelinesList />);

      expect(screen.getByTestId('guidelines-sort-order')).toBeInTheDocument();
    });

    it('sort order toggle switches from desc to asc', () => {
      storeState = { ...defaultStoreState, sortOrder: 'desc' };
      render(<GuidelinesList />);

      fireEvent.click(screen.getByTestId('guidelines-sort-order'));
      expect(mockSetSortOrder).toHaveBeenCalledWith('asc');
    });

    it('sort order toggle switches from asc to desc', () => {
      storeState = { ...defaultStoreState, sortOrder: 'asc' };
      render(<GuidelinesList />);

      fireEvent.click(screen.getByTestId('guidelines-sort-order'));
      expect(mockSetSortOrder).toHaveBeenCalledWith('desc');
    });

    it('sorts guidelines by priority descending by default', () => {
      render(<GuidelinesList />);

      const cards = screen.getAllByTestId(/^guideline-card-/);
      // Default: priority desc -> gl-1 (900), gl-2 (800), gl-3 (700)
      expect(cards[0]).toHaveAttribute('data-testid', 'guideline-card-gl-1');
      expect(cards[1]).toHaveAttribute('data-testid', 'guideline-card-gl-2');
      expect(cards[2]).toHaveAttribute('data-testid', 'guideline-card-gl-3');
    });

    it('sorts guidelines by name ascending', () => {
      storeState = { ...defaultStoreState, sortBy: 'name', sortOrder: 'asc' };
      render(<GuidelinesList />);

      const cards = screen.getAllByTestId(/^guideline-card-/);
      // Alpha, Beta, Gamma alphabetically
      expect(cards[0]).toHaveAttribute('data-testid', 'guideline-card-gl-1');
      expect(cards[1]).toHaveAttribute('data-testid', 'guideline-card-gl-2');
      expect(cards[2]).toHaveAttribute('data-testid', 'guideline-card-gl-3');
    });
  });

  describe('New Guideline button', () => {
    it('renders a New Guideline button', () => {
      render(<GuidelinesList />);

      expect(screen.getByTestId('guidelines-new-btn')).toBeInTheDocument();
    });

    it('New Guideline button calls onCreateNew', () => {
      const onCreateNew = vi.fn();
      render(<GuidelinesList onCreateNew={onCreateNew} />);

      fireEvent.click(screen.getByTestId('guidelines-new-btn'));
      expect(onCreateNew).toHaveBeenCalledTimes(1);
    });

    it('New Guideline button is present even without onCreateNew', () => {
      render(<GuidelinesList />);
      expect(screen.getByTestId('guidelines-new-btn')).toBeInTheDocument();
    });
  });

  describe('Card selection', () => {
    it('clicking a card calls selectGuideline from the store', () => {
      render(<GuidelinesList />);

      fireEvent.click(screen.getByTestId('guideline-card-gl-2'));
      expect(mockSelectGuideline).toHaveBeenCalledWith('gl-2');
    });

    it('selected card has selected styling', () => {
      storeState = { ...defaultStoreState, selectedGuidelineId: 'gl-1' };
      render(<GuidelinesList />);

      const card = screen.getByTestId('guideline-card-gl-1');
      expect(card).toHaveClass('border-blue-500');
    });
  });

  describe('Toggle guideline', () => {
    it('toggling a card calls toggleMutation.mutate', () => {
      render(<GuidelinesList />);

      fireEvent.click(screen.getByTestId('toggle-gl-1'));
      expect(mockToggleMutate).toHaveBeenCalledWith('gl-1');
    });
  });

  describe('Pagination controls', () => {
    it('renders pagination when there are multiple pages', () => {
      mockQueryResult = {
        data: { guidelines: mockGuidelines, total: 45, page: 1, page_size: 20 },
        isLoading: false,
      };
      render(<GuidelinesList />);

      expect(screen.getByTestId('guidelines-pagination')).toBeInTheDocument();
    });

    it('shows current page information', () => {
      mockQueryResult = {
        data: { guidelines: mockGuidelines, total: 45, page: 1, page_size: 20 },
        isLoading: false,
      };
      render(<GuidelinesList />);

      expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();
    });

    it('next page button calls setPage with page + 1', () => {
      mockQueryResult = {
        data: { guidelines: mockGuidelines, total: 45, page: 1, page_size: 20 },
        isLoading: false,
      };
      render(<GuidelinesList />);

      fireEvent.click(screen.getByTestId('guidelines-next-page'));
      expect(mockSetPage).toHaveBeenCalledWith(2);
    });

    it('previous page button calls setPage with page - 1', () => {
      storeState = { ...defaultStoreState, page: 2 };
      mockQueryResult = {
        data: { guidelines: mockGuidelines, total: 45, page: 2, page_size: 20 },
        isLoading: false,
      };
      render(<GuidelinesList />);

      fireEvent.click(screen.getByTestId('guidelines-prev-page'));
      expect(mockSetPage).toHaveBeenCalledWith(1);
    });

    it('previous page button is disabled on first page', () => {
      mockQueryResult = {
        data: { guidelines: mockGuidelines, total: 45, page: 1, page_size: 20 },
        isLoading: false,
      };
      render(<GuidelinesList />);

      expect(screen.getByTestId('guidelines-prev-page')).toBeDisabled();
    });

    it('next page button is disabled on last page', () => {
      storeState = { ...defaultStoreState, page: 3 };
      mockQueryResult = {
        data: { guidelines: mockGuidelines, total: 45, page: 3, page_size: 20 },
        isLoading: false,
      };
      render(<GuidelinesList />);

      expect(screen.getByTestId('guidelines-next-page')).toBeDisabled();
    });

    it('does not render pagination for single page', () => {
      mockQueryResult = {
        data: { guidelines: mockGuidelines, total: 3, page: 1, page_size: 20 },
        isLoading: false,
      };
      render(<GuidelinesList />);

      expect(screen.queryByTestId('guidelines-pagination')).not.toBeInTheDocument();
    });
  });

  describe('Header', () => {
    it('renders the Guardrails heading', () => {
      render(<GuidelinesList />);

      expect(screen.getByTestId('guidelines-heading')).toBeInTheDocument();
      expect(screen.getByText('Guardrails')).toBeInTheDocument();
    });
  });
});
