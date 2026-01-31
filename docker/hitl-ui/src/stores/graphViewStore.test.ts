/**
 * graphViewStore tests (P08-F06)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useGraphViewStore } from './graphViewStore';
import type { GraphNode, GraphEdge } from '../types/graph';

describe('graphViewStore', () => {
  beforeEach(() => {
    // Reset store between tests
    useGraphViewStore.setState({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      hoveredNodeId: null,
      highlightedNeighbors: new Set(),
      filters: {
        searchQuery: '',
        correlationTypes: ['similar', 'related', 'contradicts'],
      },
      isLoading: false,
      error: null,
    });
  });

  describe('Initial State', () => {
    it('has empty nodes array', () => {
      expect(useGraphViewStore.getState().nodes).toEqual([]);
    });

    it('has empty edges array', () => {
      expect(useGraphViewStore.getState().edges).toEqual([]);
    });

    it('has no selected node', () => {
      expect(useGraphViewStore.getState().selectedNodeId).toBeNull();
    });

    it('has no hovered node', () => {
      expect(useGraphViewStore.getState().hoveredNodeId).toBeNull();
    });

    it('has empty highlighted neighbors', () => {
      expect(useGraphViewStore.getState().highlightedNeighbors.size).toBe(0);
    });

    it('has default filter values', () => {
      const { filters } = useGraphViewStore.getState();
      expect(filters.searchQuery).toBe('');
      expect(filters.correlationTypes).toEqual(['similar', 'related', 'contradicts']);
    });

    it('is not loading', () => {
      expect(useGraphViewStore.getState().isLoading).toBe(false);
    });

    it('has no error', () => {
      expect(useGraphViewStore.getState().error).toBeNull();
    });
  });

  describe('setGraphData', () => {
    it('sets nodes and edges', () => {
      const nodes: GraphNode[] = [
        { id: 'idea-1', label: 'Test 1', degree: 1 },
        { id: 'idea-2', label: 'Test 2', degree: 1 },
      ];
      const edges: GraphEdge[] = [
        { id: 'edge-1', source: 'idea-1', target: 'idea-2', correlationType: 'related' },
      ];

      useGraphViewStore.getState().setGraphData(nodes, edges);

      expect(useGraphViewStore.getState().nodes).toEqual(nodes);
      expect(useGraphViewStore.getState().edges).toEqual(edges);
    });
  });

  describe('selectNode', () => {
    const nodes: GraphNode[] = [
      { id: 'idea-1', label: 'Test 1', degree: 2 },
      { id: 'idea-2', label: 'Test 2', degree: 1 },
      { id: 'idea-3', label: 'Test 3', degree: 1 },
    ];
    const edges: GraphEdge[] = [
      { id: 'edge-1', source: 'idea-1', target: 'idea-2', correlationType: 'related' },
      { id: 'edge-2', source: 'idea-1', target: 'idea-3', correlationType: 'similar' },
    ];

    beforeEach(() => {
      useGraphViewStore.getState().setGraphData(nodes, edges);
    });

    it('sets selectedNodeId', () => {
      useGraphViewStore.getState().selectNode('idea-1');

      expect(useGraphViewStore.getState().selectedNodeId).toBe('idea-1');
    });

    it('clears selection when null', () => {
      useGraphViewStore.getState().selectNode('idea-1');
      useGraphViewStore.getState().selectNode(null);

      expect(useGraphViewStore.getState().selectedNodeId).toBeNull();
    });

    it('sets highlighted neighbors', () => {
      useGraphViewStore.getState().selectNode('idea-1');

      const { highlightedNeighbors } = useGraphViewStore.getState();
      expect(highlightedNeighbors.has('idea-2')).toBe(true);
      expect(highlightedNeighbors.has('idea-3')).toBe(true);
      expect(highlightedNeighbors.has('idea-1')).toBe(false);
    });

    it('clears highlighted neighbors when deselecting', () => {
      useGraphViewStore.getState().selectNode('idea-1');
      useGraphViewStore.getState().selectNode(null);

      expect(useGraphViewStore.getState().highlightedNeighbors.size).toBe(0);
    });
  });

  describe('setHoveredNode', () => {
    const nodes: GraphNode[] = [
      { id: 'idea-1', label: 'Test 1', degree: 1 },
      { id: 'idea-2', label: 'Test 2', degree: 1 },
    ];
    const edges: GraphEdge[] = [
      { id: 'edge-1', source: 'idea-1', target: 'idea-2', correlationType: 'related' },
    ];

    beforeEach(() => {
      useGraphViewStore.getState().setGraphData(nodes, edges);
    });

    it('sets hoveredNodeId', () => {
      useGraphViewStore.getState().setHoveredNode('idea-1');

      expect(useGraphViewStore.getState().hoveredNodeId).toBe('idea-1');
    });

    it('clears hover when null', () => {
      useGraphViewStore.getState().setHoveredNode('idea-1');
      useGraphViewStore.getState().setHoveredNode(null);

      expect(useGraphViewStore.getState().hoveredNodeId).toBeNull();
    });

    it('sets highlighted neighbors on hover', () => {
      useGraphViewStore.getState().setHoveredNode('idea-1');

      const { highlightedNeighbors } = useGraphViewStore.getState();
      expect(highlightedNeighbors.has('idea-2')).toBe(true);
    });
  });

  describe('setFilters', () => {
    it('updates search query', () => {
      useGraphViewStore.getState().setFilters({ searchQuery: 'test' });

      expect(useGraphViewStore.getState().filters.searchQuery).toBe('test');
    });

    it('updates correlation types', () => {
      useGraphViewStore.getState().setFilters({ correlationTypes: ['similar'] });

      expect(useGraphViewStore.getState().filters.correlationTypes).toEqual(['similar']);
    });

    it('preserves other filter values', () => {
      useGraphViewStore.getState().setFilters({ searchQuery: 'test' });
      useGraphViewStore.getState().setFilters({ correlationTypes: ['similar'] });

      const { filters } = useGraphViewStore.getState();
      expect(filters.searchQuery).toBe('test');
      expect(filters.correlationTypes).toEqual(['similar']);
    });
  });

  describe('resetView', () => {
    it('clears selection', () => {
      useGraphViewStore.getState().selectNode('idea-1');
      useGraphViewStore.getState().resetView();

      expect(useGraphViewStore.getState().selectedNodeId).toBeNull();
    });

    it('clears hover', () => {
      useGraphViewStore.getState().setHoveredNode('idea-1');
      useGraphViewStore.getState().resetView();

      expect(useGraphViewStore.getState().hoveredNodeId).toBeNull();
    });

    it('clears highlighted neighbors', () => {
      useGraphViewStore.setState({ highlightedNeighbors: new Set(['idea-1', 'idea-2']) });
      useGraphViewStore.getState().resetView();

      expect(useGraphViewStore.getState().highlightedNeighbors.size).toBe(0);
    });

    it('resets filters to defaults', () => {
      useGraphViewStore.getState().setFilters({
        searchQuery: 'test',
        correlationTypes: ['similar'],
      });
      useGraphViewStore.getState().resetView();

      const { filters } = useGraphViewStore.getState();
      expect(filters.searchQuery).toBe('');
      expect(filters.correlationTypes).toEqual(['similar', 'related', 'contradicts']);
    });
  });

  describe('setLoading', () => {
    it('sets loading to true', () => {
      useGraphViewStore.getState().setLoading(true);

      expect(useGraphViewStore.getState().isLoading).toBe(true);
    });

    it('sets loading to false', () => {
      useGraphViewStore.getState().setLoading(true);
      useGraphViewStore.getState().setLoading(false);

      expect(useGraphViewStore.getState().isLoading).toBe(false);
    });
  });

  describe('setError', () => {
    it('sets error message', () => {
      useGraphViewStore.getState().setError('Test error');

      expect(useGraphViewStore.getState().error).toBe('Test error');
    });

    it('clears error with null', () => {
      useGraphViewStore.getState().setError('Test error');
      useGraphViewStore.getState().setError(null);

      expect(useGraphViewStore.getState().error).toBeNull();
    });
  });

  describe('Edge handling with number IDs', () => {
    it('handles edges with number source/target', () => {
      const nodes: GraphNode[] = [
        { id: '1', label: 'Test 1', degree: 1 },
        { id: '2', label: 'Test 2', degree: 1 },
      ];
      const edges: GraphEdge[] = [
        { id: 'edge-1', source: 1, target: 2, correlationType: 'related' },
      ];

      useGraphViewStore.getState().setGraphData(nodes, edges);
      useGraphViewStore.getState().selectNode('1');

      const { highlightedNeighbors } = useGraphViewStore.getState();
      expect(highlightedNeighbors.has('2')).toBe(true);
    });
  });
});
