/**
 * Types for Snowflake Graph Visualization (P08-F06)
 */

import type { IdeaClassification } from './ideas';

export type CorrelationType = 'similar' | 'related' | 'contradicts';

/**
 * Node in the graph visualization
 * Note: fx/fy are typed as number | undefined (not null) for react-force-graph-2d compatibility
 */
export interface GraphNode {
  id: string;
  label: string;
  classification?: IdeaClassification;
  labels?: string[];
  degree: number;

  // Layout (set by force simulation)
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
  // Allow index signature for react-force-graph compatibility
  [key: string]: unknown;
}

/**
 * Edge in the graph visualization
 */
export interface GraphEdge {
  id: string;
  source: string | number | GraphNode;
  target: string | number | GraphNode;
  correlationType: CorrelationType;
  // Allow index signature for react-force-graph compatibility
  [key: string]: unknown;
}

/**
 * Graph data bundle from API
 */
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * Graph filter state
 */
export interface GraphFilters {
  searchQuery: string;
  correlationTypes: CorrelationType[];
}
