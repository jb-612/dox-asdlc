/**
 * GraphControls component tests (P08-F06)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GraphControls } from './GraphControls';
import type { GraphNode, GraphEdge, CorrelationType } from '../../../types/graph';

// Mock graph view store
const mockSetFilters = vi.fn();
const mockResetView = vi.fn();

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
  setGraphData: vi.fn(),
  selectNode: vi.fn(),
  setHoveredNode: vi.fn(),
  setFilters: mockSetFilters,
  resetView: mockResetView,
  setLoading: vi.fn(),
  setError: vi.fn(),
};

vi.mock('../../../stores/graphViewStore', () => ({
  useGraphViewStore: (selector?: (state: typeof mockGraphViewStore) => unknown) => {
    return selector ? selector(mockGraphViewStore) : mockGraphViewStore;
  },
}));

describe('GraphControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGraphViewStore.nodes = [];
    mockGraphViewStore.edges = [];
    mockGraphViewStore.filters = {
      searchQuery: '',
      correlationTypes: ['similar', 'related', 'contradicts'],
    };
  });

  describe('Rendering', () => {
    it('renders the controls panel', () => {
      render(<GraphControls />);

      expect(screen.getByTestId('graph-controls')).toBeInTheDocument();
      expect(screen.getByText('Graph Controls')).toBeInTheDocument();
    });

    it('displays node and edge counts', () => {
      mockGraphViewStore.nodes = [
        { id: 'idea-1', label: 'Test 1', degree: 1 },
        { id: 'idea-2', label: 'Test 2', degree: 1 },
      ];
      mockGraphViewStore.edges = [
        { id: 'edge-1', source: 'idea-1', target: 'idea-2', correlationType: 'related' },
      ];

      render(<GraphControls />);

      expect(screen.getByText('2 nodes, 1 edges')).toBeInTheDocument();
    });

    it('renders search input', () => {
      render(<GraphControls />);

      expect(screen.getByTestId('graph-search-input')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search nodes...')).toBeInTheDocument();
    });

    it('renders edge type checkboxes', () => {
      render(<GraphControls />);

      expect(screen.getByTestId('edge-type-similar')).toBeInTheDocument();
      expect(screen.getByTestId('edge-type-related')).toBeInTheDocument();
      expect(screen.getByTestId('edge-type-contradicts')).toBeInTheDocument();
      expect(screen.getByText('Similar')).toBeInTheDocument();
      expect(screen.getByText('Related')).toBeInTheDocument();
      expect(screen.getByText('Contradicts')).toBeInTheDocument();
    });

    it('renders reset view button', () => {
      render(<GraphControls />);

      expect(screen.getByTestId('reset-view-button')).toBeInTheDocument();
      expect(screen.getByText('Reset View')).toBeInTheDocument();
    });

    it('renders refresh button when onRefresh is provided', () => {
      const onRefresh = vi.fn();

      render(<GraphControls onRefresh={onRefresh} />);

      expect(screen.getByTestId('refresh-button')).toBeInTheDocument();
    });

    it('does not render refresh button when onRefresh is not provided', () => {
      render(<GraphControls />);

      expect(screen.queryByTestId('refresh-button')).not.toBeInTheDocument();
    });

    it('renders legend', () => {
      render(<GraphControls />);

      expect(screen.getByText('Node Colors')).toBeInTheDocument();
      expect(screen.getByText('Functional')).toBeInTheDocument();
      expect(screen.getByText('Non-Functional')).toBeInTheDocument();
      expect(screen.getByText('Undetermined')).toBeInTheDocument();
    });
  });

  describe('Search', () => {
    it('calls setFilters when search input changes', () => {
      render(<GraphControls />);

      const searchInput = screen.getByTestId('graph-search-input');
      fireEvent.change(searchInput, { target: { value: 'test query' } });

      expect(mockSetFilters).toHaveBeenCalledWith({ searchQuery: 'test query' });
    });

    it('displays current search query', () => {
      mockGraphViewStore.filters.searchQuery = 'existing query';

      render(<GraphControls />);

      const searchInput = screen.getByTestId('graph-search-input');
      expect(searchInput).toHaveValue('existing query');
    });
  });

  describe('Edge Type Filters', () => {
    it('shows all edge types checked by default', () => {
      render(<GraphControls />);

      expect(screen.getByTestId('edge-type-similar')).toBeChecked();
      expect(screen.getByTestId('edge-type-related')).toBeChecked();
      expect(screen.getByTestId('edge-type-contradicts')).toBeChecked();
    });

    it('unchecks edge type when clicked', () => {
      render(<GraphControls />);

      const similarCheckbox = screen.getByTestId('edge-type-similar');
      fireEvent.click(similarCheckbox);

      expect(mockSetFilters).toHaveBeenCalledWith({
        correlationTypes: ['related', 'contradicts'],
      });
    });

    it('checks edge type when clicked', () => {
      mockGraphViewStore.filters.correlationTypes = ['related', 'contradicts'];

      render(<GraphControls />);

      const similarCheckbox = screen.getByTestId('edge-type-similar');
      fireEvent.click(similarCheckbox);

      expect(mockSetFilters).toHaveBeenCalledWith({
        correlationTypes: ['related', 'contradicts', 'similar'],
      });
    });

    it('does not allow unchecking the last edge type', () => {
      mockGraphViewStore.filters.correlationTypes = ['similar'];

      render(<GraphControls />);

      const similarCheckbox = screen.getByTestId('edge-type-similar');
      fireEvent.click(similarCheckbox);

      // Should still have similar selected (cannot uncheck last one)
      expect(mockSetFilters).toHaveBeenCalledWith({
        correlationTypes: ['similar'],
      });
    });
  });

  describe('Actions', () => {
    it('calls resetView when Reset View button is clicked', () => {
      render(<GraphControls />);

      const resetButton = screen.getByTestId('reset-view-button');
      fireEvent.click(resetButton);

      expect(mockResetView).toHaveBeenCalled();
    });

    it('calls onRefresh when Refresh button is clicked', () => {
      const onRefresh = vi.fn();

      render(<GraphControls onRefresh={onRefresh} />);

      const refreshButton = screen.getByTestId('refresh-button');
      fireEvent.click(refreshButton);

      expect(onRefresh).toHaveBeenCalled();
    });
  });
});
