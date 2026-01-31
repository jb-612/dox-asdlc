/**
 * BrainflareHubPage tests (P08-F05, P08-F06)
 *
 * Tests for the Brainflare Hub page with 3-column layout:
 * - Ideas list panel (left)
 * - Snowflake graph visualization (center)
 * - Idea detail/form panel (right)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrainflareHubPage } from './BrainflareHubPage';
import type { Idea } from '../types/ideas';
import type { GraphNode, GraphEdge, CorrelationType } from '../types/graph';

// Mock store state - declared outside so it can be modified
const mockFetchIdeas = vi.fn();
const mockSelectIdea = vi.fn();
const mockSetFilters = vi.fn();
const mockClearFilters = vi.fn();
const mockCreateIdea = vi.fn().mockResolvedValue({});
const mockUpdateIdea = vi.fn().mockResolvedValue(undefined);
const mockDeleteIdea = vi.fn().mockResolvedValue(undefined);
const mockArchiveIdea = vi.fn().mockResolvedValue(undefined);
const mockOpenForm = vi.fn();
const mockCloseForm = vi.fn();
const mockClearError = vi.fn();

const mockBrainflareStore = {
  ideas: [] as Idea[],
  selectedIdea: null as Idea | null,
  total: 0,
  filters: {} as Record<string, unknown>,
  isLoading: false,
  error: null as string | null,
  isFormOpen: false,
  editingIdea: null as Idea | null,
  fetchIdeas: mockFetchIdeas,
  selectIdea: mockSelectIdea,
  setFilters: mockSetFilters,
  clearFilters: mockClearFilters,
  createIdea: mockCreateIdea,
  updateIdea: mockUpdateIdea,
  deleteIdea: mockDeleteIdea,
  archiveIdea: mockArchiveIdea,
  openForm: mockOpenForm,
  closeForm: mockCloseForm,
  clearError: mockClearError,
};

// Mock the store - handle both selector and no-selector calls
vi.mock('../stores/brainflareStore', () => ({
  useBrainflareStore: (selector?: (state: typeof mockBrainflareStore) => unknown) => {
    // If selector is provided, call it with the store state
    // Otherwise return the whole state (for destructuring usage)
    return selector ? selector(mockBrainflareStore) : mockBrainflareStore;
  },
}));

// Mock the API
vi.mock('../api/ideas', () => ({
  fetchIdeas: vi.fn(),
  createIdea: vi.fn(),
  updateIdea: vi.fn(),
  deleteIdea: vi.fn(),
}));

// Mock graph view store state
const mockGraphSetGraphData = vi.fn();
const mockGraphSelectNode = vi.fn();
const mockGraphSetHoveredNode = vi.fn();
const mockGraphSetFilters = vi.fn();
const mockGraphResetView = vi.fn();
const mockGraphSetLoading = vi.fn();
const mockGraphSetError = vi.fn();

const mockGraphViewStore = {
  nodes: [] as GraphNode[],
  edges: [] as GraphEdge[],
  selectedNodeId: null as string | null,
  hoveredNodeId: null as string | null,
  highlightedNeighbors: new Set<string>(),
  filters: {
    searchQuery: '',
    correlationTypes: ['similar', 'related', 'contradicts'] as CorrelationType[],
  },
  isLoading: false,
  error: null as string | null,
  setGraphData: mockGraphSetGraphData,
  selectNode: mockGraphSelectNode,
  setHoveredNode: mockGraphSetHoveredNode,
  setFilters: mockGraphSetFilters,
  resetView: mockGraphResetView,
  setLoading: mockGraphSetLoading,
  setError: mockGraphSetError,
};

vi.mock('../stores/graphViewStore', () => ({
  useGraphViewStore: (selector?: (state: typeof mockGraphViewStore) => unknown) => {
    return selector ? selector(mockGraphViewStore) : mockGraphViewStore;
  },
}));

// Mock correlations API
vi.mock('../api/correlations', () => ({
  fetchGraph: vi.fn().mockResolvedValue({ nodes: [], edges: [] }),
}));

describe('BrainflareHubPage', () => {
  const mockIdea: Idea = {
    id: 'idea-001',
    content: 'Test idea content for unit testing',
    author_id: 'user-1',
    author_name: 'Test User',
    status: 'active',
    classification: 'functional',
    labels: ['test', 'unit'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    word_count: 6,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset brainflare store state
    mockBrainflareStore.ideas = [];
    mockBrainflareStore.selectedIdea = null;
    mockBrainflareStore.total = 0;
    mockBrainflareStore.filters = {};
    mockBrainflareStore.isLoading = false;
    mockBrainflareStore.error = null;
    mockBrainflareStore.isFormOpen = false;
    mockBrainflareStore.editingIdea = null;
    // Reset graph view store state
    mockGraphViewStore.nodes = [];
    mockGraphViewStore.edges = [];
    mockGraphViewStore.selectedNodeId = null;
    mockGraphViewStore.hoveredNodeId = null;
    mockGraphViewStore.highlightedNeighbors = new Set();
    mockGraphViewStore.filters = {
      searchQuery: '',
      correlationTypes: ['similar', 'related', 'contradicts'],
    };
    mockGraphViewStore.isLoading = false;
    mockGraphViewStore.error = null;
  });

  describe('Basic Rendering', () => {
    it('renders the page with header', () => {
      render(<BrainflareHubPage />);

      expect(screen.getByText('Brainflare Hub')).toBeInTheDocument();
      expect(screen.getByText('Capture and organize ideas')).toBeInTheDocument();
    });

    it('renders the 3-column layout with graph', async () => {
      render(<BrainflareHubPage />);

      expect(screen.getByTestId('brainflare-hub-page')).toBeInTheDocument();
      expect(screen.getByTestId('ideas-list-panel')).toBeInTheDocument();
      // Graph empty state shows when no data loaded
      await waitFor(() => {
        expect(screen.getByTestId('snowflake-graph-empty')).toBeInTheDocument();
      });
      // Graph controls should be visible
      expect(screen.getByTestId('graph-controls')).toBeInTheDocument();
    });

    it('calls fetchIdeas on mount', () => {
      render(<BrainflareHubPage />);

      expect(mockFetchIdeas).toHaveBeenCalled();
    });
  });

  describe('Ideas List', () => {
    it('displays ideas in the list', () => {
      mockBrainflareStore.ideas = [mockIdea];
      mockBrainflareStore.total = 1;

      render(<BrainflareHubPage />);

      expect(screen.getByText('Test idea content for unit testing')).toBeInTheDocument();
      expect(screen.getByText('Test User')).toBeInTheDocument();
    });

    it('shows empty state when no ideas', () => {
      mockBrainflareStore.ideas = [];
      mockBrainflareStore.total = 0;

      render(<BrainflareHubPage />);

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText(/No ideas yet/)).toBeInTheDocument();
    });

    it('shows loading state', () => {
      mockBrainflareStore.ideas = [];
      mockBrainflareStore.isLoading = true;

      render(<BrainflareHubPage />);

      expect(screen.getByTestId('loading-state')).toBeInTheDocument();
    });

    it('shows total count in header', () => {
      mockBrainflareStore.ideas = [mockIdea];
      mockBrainflareStore.total = 5;

      render(<BrainflareHubPage />);

      expect(screen.getByText('Ideas (5)')).toBeInTheDocument();
    });

    it('calls openForm when New Idea button is clicked', () => {
      render(<BrainflareHubPage />);

      const newButton = screen.getByTestId('new-idea-button');
      fireEvent.click(newButton);

      expect(mockOpenForm).toHaveBeenCalled();
    });
  });

  describe('Detail Panel', () => {
    it('shows empty detail panel when no idea is selected', () => {
      mockBrainflareStore.selectedIdea = null;

      render(<BrainflareHubPage />);

      expect(screen.getByTestId('idea-detail-empty')).toBeInTheDocument();
      expect(screen.getByText('Select an idea to view details')).toBeInTheDocument();
    });

    it('shows idea details when selected', () => {
      mockBrainflareStore.ideas = [mockIdea];
      mockBrainflareStore.selectedIdea = mockIdea;

      render(<BrainflareHubPage />);

      expect(screen.getByTestId('idea-detail-panel')).toBeInTheDocument();
      // Content appears in both list card and detail panel
      expect(screen.getAllByText('Test idea content for unit testing').length).toBe(2);
    });

    it('shows action buttons in detail panel', () => {
      mockBrainflareStore.ideas = [mockIdea];
      mockBrainflareStore.selectedIdea = mockIdea;

      render(<BrainflareHubPage />);

      expect(screen.getByLabelText('Edit idea')).toBeInTheDocument();
      expect(screen.getByLabelText('Archive idea')).toBeInTheDocument();
      expect(screen.getByLabelText('Delete idea')).toBeInTheDocument();
    });

    it('calls openForm when edit button is clicked', () => {
      mockBrainflareStore.ideas = [mockIdea];
      mockBrainflareStore.selectedIdea = mockIdea;

      render(<BrainflareHubPage />);

      const editButton = screen.getByLabelText('Edit idea');
      fireEvent.click(editButton);

      expect(mockOpenForm).toHaveBeenCalledWith(mockIdea);
    });
  });

  describe('Form Panel', () => {
    it('shows form when isFormOpen is true', () => {
      mockBrainflareStore.isFormOpen = true;
      mockBrainflareStore.editingIdea = null;

      render(<BrainflareHubPage />);

      // "New Idea" appears as both button text and form header
      expect(screen.getAllByText('New Idea').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByTestId('idea-form')).toBeInTheDocument();
    });

    it('shows edit form when editing existing idea', () => {
      mockBrainflareStore.isFormOpen = true;
      mockBrainflareStore.editingIdea = mockIdea;

      render(<BrainflareHubPage />);

      expect(screen.getByText('Edit Idea')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test idea content for unit testing')).toBeInTheDocument();
    });

    it('renders form fields', () => {
      mockBrainflareStore.isFormOpen = true;

      render(<BrainflareHubPage />);

      expect(screen.getByLabelText('Idea Content')).toBeInTheDocument();
      expect(screen.getByLabelText('Classification')).toBeInTheDocument();
      expect(screen.getByLabelText('Labels (comma-separated)')).toBeInTheDocument();
    });

    it('shows word count', () => {
      mockBrainflareStore.isFormOpen = true;

      render(<BrainflareHubPage />);

      const textarea = screen.getByLabelText('Idea Content');
      fireEvent.change(textarea, { target: { value: 'One two three' } });

      expect(screen.getByText('3/144 words')).toBeInTheDocument();
    });

    it('validates word limit', () => {
      mockBrainflareStore.isFormOpen = true;

      render(<BrainflareHubPage />);

      const textarea = screen.getByLabelText('Idea Content');
      const words = Array(145).fill('word').join(' ');
      fireEvent.change(textarea, { target: { value: words } });

      expect(screen.getByText(/145\/144 words/)).toHaveClass('text-red-600');
    });

    it('submit button is disabled when content is empty', () => {
      mockBrainflareStore.isFormOpen = true;

      render(<BrainflareHubPage />);

      const submitButton = screen.getByText('Create');
      expect(submitButton).toBeDisabled();
    });

    it('calls closeForm when Cancel is clicked', () => {
      mockBrainflareStore.isFormOpen = true;

      render(<BrainflareHubPage />);

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(mockCloseForm).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('shows error toast when error exists', () => {
      mockBrainflareStore.error = 'Unique error message for test';

      render(<BrainflareHubPage />);

      // Error appears in both the header toast and the list panel error state
      expect(screen.getAllByText('Unique error message for test').length).toBeGreaterThanOrEqual(1);
    });

    it('calls clearError when dismiss button is clicked', () => {
      mockBrainflareStore.error = 'Another test error';

      render(<BrainflareHubPage />);

      const dismissButton = screen.getByLabelText('Dismiss error');
      fireEvent.click(dismissButton);

      expect(mockClearError).toHaveBeenCalled();
    });
  });

  describe('IdeaCard Display', () => {
    const detailedIdea: Idea = {
      id: 'idea-002',
      content: 'Test idea content for unit testing purposes',
      author_id: 'user-1',
      author_name: 'Alice',
      status: 'active',
      classification: 'functional',
      labels: ['ui', 'feature'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      word_count: 7,
    };

    it('displays classification badge', () => {
      mockBrainflareStore.ideas = [detailedIdea];
      mockBrainflareStore.total = 1;

      render(<BrainflareHubPage />);

      expect(screen.getByText('functional')).toBeInTheDocument();
    });

    it('displays labels', () => {
      mockBrainflareStore.ideas = [detailedIdea];
      mockBrainflareStore.total = 1;

      render(<BrainflareHubPage />);

      expect(screen.getByText('ui')).toBeInTheDocument();
      expect(screen.getByText('feature')).toBeInTheDocument();
    });

    it('displays word count', () => {
      mockBrainflareStore.ideas = [detailedIdea];
      mockBrainflareStore.total = 1;

      render(<BrainflareHubPage />);

      expect(screen.getByText('7 words')).toBeInTheDocument();
    });

    it('calls selectIdea when card is clicked', () => {
      mockBrainflareStore.ideas = [detailedIdea];
      mockBrainflareStore.total = 1;

      render(<BrainflareHubPage />);

      const card = screen.getByTestId('idea-card-idea-002');
      fireEvent.click(card);

      expect(mockSelectIdea).toHaveBeenCalledWith('idea-002');
    });
  });

  describe('Filters', () => {
    it('shows search input', () => {
      render(<BrainflareHubPage />);

      expect(screen.getByPlaceholderText('Search ideas...')).toBeInTheDocument();
    });

    it('shows status filter', () => {
      render(<BrainflareHubPage />);

      expect(screen.getByLabelText('Filter by status')).toBeInTheDocument();
    });

    it('shows classification filter', () => {
      render(<BrainflareHubPage />);

      expect(screen.getByLabelText('Filter by classification')).toBeInTheDocument();
    });

    it('calls setFilters when search changes', () => {
      render(<BrainflareHubPage />);

      const searchInput = screen.getByPlaceholderText('Search ideas...');
      fireEvent.change(searchInput, { target: { value: 'test query' } });

      expect(mockSetFilters).toHaveBeenCalledWith({ search: 'test query' });
    });

    it('calls setFilters when status filter changes', () => {
      render(<BrainflareHubPage />);

      const statusSelect = screen.getByLabelText('Filter by status');
      fireEvent.change(statusSelect, { target: { value: 'active' } });

      expect(mockSetFilters).toHaveBeenCalledWith({ status: 'active' });
    });

    it('shows clear filters button when filters active', () => {
      mockBrainflareStore.filters = { status: 'active' };

      render(<BrainflareHubPage />);

      expect(screen.getByLabelText('Clear filters')).toBeInTheDocument();
    });

    it('calls clearFilters when clear button clicked', () => {
      mockBrainflareStore.filters = { status: 'active' };

      render(<BrainflareHubPage />);

      const clearButton = screen.getByLabelText('Clear filters');
      fireEvent.click(clearButton);

      expect(mockClearFilters).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has main landmark', () => {
      render(<BrainflareHubPage />);

      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('idea cards are keyboard accessible', () => {
      mockBrainflareStore.ideas = [mockIdea];
      mockBrainflareStore.total = 1;

      render(<BrainflareHubPage />);

      const card = screen.getByTestId('idea-card-idea-001');
      expect(card).toHaveAttribute('tabIndex', '0');
    });
  });
});
