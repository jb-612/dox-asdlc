/**
 * Zustand store for Snowflake Graph View (P08-F06)
 *
 * Manages state for graph visualization including:
 * - Graph data (nodes and edges)
 * - Selection state (selected/hovered nodes)
 * - Filters (search, correlation types)
 * - Loading/error states
 */

import { create } from 'zustand';
import type { GraphNode, GraphEdge, GraphFilters, CorrelationType } from '../types/graph';

export interface GraphViewState {
  // Data
  nodes: GraphNode[];
  edges: GraphEdge[];

  // Selection
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  highlightedNeighbors: Set<string>;

  // Filters
  filters: GraphFilters;

  // UI State
  isLoading: boolean;
  error: string | null;

  // Actions
  setGraphData: (nodes: GraphNode[], edges: GraphEdge[]) => void;
  selectNode: (nodeId: string | null) => void;
  setHoveredNode: (nodeId: string | null) => void;
  setFilters: (filters: Partial<GraphFilters>) => void;
  resetView: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

/**
 * Extract ID from edge source or target (can be string, number, or GraphNode)
 */
function getNodeId(ref: string | number | GraphNode): string {
  if (typeof ref === 'string') return ref;
  if (typeof ref === 'number') return String(ref);
  return ref.id;
}

/**
 * Helper function to find neighbor IDs for a given node
 */
function findNeighbors(nodeId: string, edges: GraphEdge[]): Set<string> {
  const neighbors = new Set<string>();
  edges.forEach((edge) => {
    const sourceId = getNodeId(edge.source);
    const targetId = getNodeId(edge.target);
    if (sourceId === nodeId) neighbors.add(targetId);
    if (targetId === nodeId) neighbors.add(sourceId);
  });
  return neighbors;
}

export const useGraphViewStore = create<GraphViewState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  hoveredNodeId: null,
  highlightedNeighbors: new Set(),
  filters: {
    searchQuery: '',
    correlationTypes: ['similar', 'related', 'contradicts'] as CorrelationType[],
  },
  isLoading: false,
  error: null,

  setGraphData: (nodes, edges) => set({ nodes, edges }),

  selectNode: (nodeId) => {
    const { edges } = get();
    if (!nodeId) {
      set({ selectedNodeId: null, highlightedNeighbors: new Set() });
      return;
    }

    // Find neighbors
    const neighbors = findNeighbors(nodeId, edges);
    set({ selectedNodeId: nodeId, highlightedNeighbors: neighbors });
  },

  setHoveredNode: (nodeId) => {
    const { edges, selectedNodeId } = get();
    if (!nodeId) {
      set({ hoveredNodeId: null });
      // Keep highlighted neighbors from selection if there is one
      if (!selectedNodeId) set({ highlightedNeighbors: new Set() });
      return;
    }

    // Find neighbors for hover
    const neighbors = findNeighbors(nodeId, edges);
    set({ hoveredNodeId: nodeId, highlightedNeighbors: neighbors });
  },

  setFilters: (filters) =>
    set({
      filters: { ...get().filters, ...filters },
    }),

  resetView: () =>
    set({
      selectedNodeId: null,
      hoveredNodeId: null,
      highlightedNeighbors: new Set(),
      filters: {
        searchQuery: '',
        correlationTypes: ['similar', 'related', 'contradicts'],
      },
    }),

  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}));
