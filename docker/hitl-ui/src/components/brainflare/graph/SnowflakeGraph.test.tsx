/**
 * SnowflakeGraph component tests (P08-F06)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SnowflakeGraph } from './SnowflakeGraph';
import type { GraphNode, GraphEdge, CorrelationType } from '../../../types/graph';

// Mock react-force-graph-2d
vi.mock('react-force-graph-2d', () => ({
  default: vi.fn(({ graphData }) => (
    <div data-testid="force-graph-2d">
      <div data-testid="node-count">{graphData.nodes.length}</div>
      <div data-testid="link-count">{graphData.links.length}</div>
    </div>
  )),
}));

// Mock graph view store
const mockSetGraphData = vi.fn();
const mockSelectNode = vi.fn();
const mockSetHoveredNode = vi.fn();
const mockSetLoading = vi.fn();
const mockSetError = vi.fn();

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
  setGraphData: mockSetGraphData,
  selectNode: mockSelectNode,
  setHoveredNode: mockSetHoveredNode,
  setFilters: vi.fn(),
  resetView: vi.fn(),
  setLoading: mockSetLoading,
  setError: mockSetError,
};

vi.mock('../../../stores/graphViewStore', () => ({
  useGraphViewStore: (selector?: (state: typeof mockGraphViewStore) => unknown) => {
    return selector ? selector(mockGraphViewStore) : mockGraphViewStore;
  },
}));

// Mock brainflare store
vi.mock('../../../stores/brainflareStore', () => ({
  useBrainflareStore: () => ({
    selectIdea: vi.fn(),
  }),
}));

// Mock correlations API
const mockFetchGraph = vi.fn();
vi.mock('../../../api/correlations', () => ({
  fetchGraph: () => mockFetchGraph(),
}));

describe('SnowflakeGraph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGraphViewStore.nodes = [];
    mockGraphViewStore.edges = [];
    mockGraphViewStore.selectedNodeId = null;
    mockGraphViewStore.hoveredNodeId = null;
    mockGraphViewStore.highlightedNeighbors = new Set();
    mockGraphViewStore.isLoading = false;
    mockGraphViewStore.error = null;
    mockGraphViewStore.filters = {
      searchQuery: '',
      correlationTypes: ['similar', 'related', 'contradicts'],
    };
    mockFetchGraph.mockResolvedValue({ nodes: [], edges: [] });
  });

  describe('Loading State', () => {
    it('shows loading state when isLoading is true', () => {
      mockGraphViewStore.isLoading = true;

      render(<SnowflakeGraph />);

      expect(screen.getByTestId('snowflake-graph-loading')).toBeInTheDocument();
      expect(screen.getByText('Loading graph...')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('shows error state when error exists', () => {
      mockGraphViewStore.error = 'Failed to load graph data';

      render(<SnowflakeGraph />);

      expect(screen.getByTestId('snowflake-graph-error')).toBeInTheDocument();
      expect(screen.getByText('Error: Failed to load graph data')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no nodes', () => {
      mockGraphViewStore.nodes = [];

      render(<SnowflakeGraph />);

      expect(screen.getByTestId('snowflake-graph-empty')).toBeInTheDocument();
      expect(screen.getByText('No ideas with correlations yet')).toBeInTheDocument();
    });

    it('shows no matching ideas when filtered to empty', () => {
      mockGraphViewStore.nodes = [
        { id: 'idea-1', label: 'Test idea', degree: 1 },
      ];
      mockGraphViewStore.filters = {
        searchQuery: 'nonexistent',
        correlationTypes: ['similar', 'related', 'contradicts'],
      };

      render(<SnowflakeGraph />);

      expect(screen.getByTestId('snowflake-graph-empty')).toBeInTheDocument();
      expect(screen.getByText('No matching ideas')).toBeInTheDocument();
    });
  });

  describe('Graph Rendering', () => {
    it('renders ForceGraph2D with nodes and edges', () => {
      mockGraphViewStore.nodes = [
        { id: 'idea-1', label: 'Test idea 1', degree: 1 },
        { id: 'idea-2', label: 'Test idea 2', degree: 1 },
      ];
      mockGraphViewStore.edges = [
        { id: 'edge-1', source: 'idea-1', target: 'idea-2', correlationType: 'related' },
      ];

      render(<SnowflakeGraph />);

      expect(screen.getByTestId('snowflake-graph')).toBeInTheDocument();
      expect(screen.getByTestId('force-graph-2d')).toBeInTheDocument();
      expect(screen.getByTestId('node-count')).toHaveTextContent('2');
      expect(screen.getByTestId('link-count')).toHaveTextContent('1');
    });

    it('filters nodes by search query', () => {
      mockGraphViewStore.nodes = [
        { id: 'idea-1', label: 'Dark mode feature', degree: 1 },
        { id: 'idea-2', label: 'API caching', degree: 1 },
        { id: 'idea-3', label: 'Mobile design', degree: 0 },
      ];
      mockGraphViewStore.edges = [
        { id: 'edge-1', source: 'idea-1', target: 'idea-2', correlationType: 'related' },
      ];
      mockGraphViewStore.filters = {
        searchQuery: 'dark',
        correlationTypes: ['similar', 'related', 'contradicts'],
      };

      render(<SnowflakeGraph />);

      // Should show idea-1 (match) and idea-2 (neighbor)
      expect(screen.getByTestId('node-count')).toHaveTextContent('2');
    });

    it('filters edges by correlation type', () => {
      mockGraphViewStore.nodes = [
        { id: 'idea-1', label: 'Idea 1', degree: 2 },
        { id: 'idea-2', label: 'Idea 2', degree: 1 },
        { id: 'idea-3', label: 'Idea 3', degree: 1 },
      ];
      mockGraphViewStore.edges = [
        { id: 'edge-1', source: 'idea-1', target: 'idea-2', correlationType: 'similar' },
        { id: 'edge-2', source: 'idea-1', target: 'idea-3', correlationType: 'contradicts' },
      ];
      mockGraphViewStore.filters = {
        searchQuery: '',
        correlationTypes: ['similar'], // Only show similar edges
      };

      render(<SnowflakeGraph />);

      // Only the similar edge should be included
      expect(screen.getByTestId('link-count')).toHaveTextContent('1');
    });
  });

  describe('Data Loading', () => {
    it('calls fetchGraph on mount', async () => {
      mockFetchGraph.mockResolvedValue({
        nodes: [{ id: 'idea-1', label: 'Test', degree: 0 }],
        edges: [],
      });

      render(<SnowflakeGraph />);

      await waitFor(() => {
        expect(mockFetchGraph).toHaveBeenCalled();
      });
    });

    it('calls setLoading during fetch', async () => {
      mockFetchGraph.mockResolvedValue({ nodes: [], edges: [] });

      render(<SnowflakeGraph />);

      await waitFor(() => {
        expect(mockSetLoading).toHaveBeenCalledWith(true);
      });
    });

    it('calls setGraphData with fetched data', async () => {
      const mockData = {
        nodes: [{ id: 'idea-1', label: 'Test', degree: 0 }],
        edges: [],
      };
      mockFetchGraph.mockResolvedValue(mockData);

      render(<SnowflakeGraph />);

      await waitFor(() => {
        expect(mockSetGraphData).toHaveBeenCalledWith(mockData.nodes, mockData.edges);
      });
    });

    it('calls setError on fetch failure', async () => {
      mockFetchGraph.mockRejectedValue(new Error('Network error'));

      render(<SnowflakeGraph />);

      await waitFor(() => {
        expect(mockSetError).toHaveBeenCalledWith('Network error');
      });
    });
  });
});
