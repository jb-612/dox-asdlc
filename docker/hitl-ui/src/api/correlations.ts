/**
 * Correlations and Graph API client for Brainflare Hub (P08-F06)
 *
 * Handles graph data fetching and correlation CRUD operations.
 * Mock mode is controlled by the useMock parameter (from store).
 *
 * MIGRATION: Now includes work item features as graph nodes
 * with correlations representing dependencies and relationships.
 */

import type { GraphData, GraphNode, GraphEdge, CorrelationType } from '../types/graph';
import { getWorkItemGraphData } from './mocks/workItemCorrelations';
import { apiClient } from './client';

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

// Original user-submitted mock nodes
const userMockNodes: GraphNode[] = [
  {
    id: 'idea-001',
    label: 'Add dark mode support',
    classification: 'functional',
    labels: ['ui'],
    degree: 2,
  },
  {
    id: 'idea-002',
    label: 'Implement Redis caching',
    classification: 'non_functional',
    labels: ['performance'],
    degree: 3,
  },
  {
    id: 'idea-003',
    label: 'Unified notification system',
    classification: 'functional',
    labels: ['notifications'],
    degree: 3,
  },
  {
    id: 'idea-004',
    label: 'Mobile responsive design',
    classification: 'functional',
    labels: ['ui', 'mobile'],
    degree: 2,
  },
  {
    id: 'idea-005',
    label: 'API rate limiting',
    classification: 'non_functional',
    labels: ['security'],
    degree: 1,
  },
  {
    id: 'idea-006',
    label: 'Graph visualization for ideas',
    classification: 'functional',
    labels: ['visualization', 'graph'],
    degree: 2,
  },
];

// Original user-submitted mock edges
const userMockEdges: GraphEdge[] = [
  {
    id: 'corr-001',
    source: 'idea-001',
    target: 'idea-004',
    correlationType: 'related',
  },
  {
    id: 'corr-002',
    source: 'idea-002',
    target: 'idea-003',
    correlationType: 'similar',
  },
  {
    id: 'corr-003',
    source: 'idea-002',
    target: 'idea-005',
    correlationType: 'related',
  },
  {
    id: 'corr-004',
    source: 'idea-001',
    target: 'idea-003',
    correlationType: 'related',
  },
];

// Get work item graph data
const workItemData = getWorkItemGraphData();

// Combined mock graph data: work items + user ideas
const mockGraphData: GraphData = {
  nodes: [...workItemData.nodes, ...userMockNodes],
  edges: [...workItemData.edges, ...userMockEdges],
};

/**
 * Fetch graph data (nodes and edges)
 * @param useMock - If true, return mock data; otherwise fetch from API
 */
export async function fetchGraph(useMock: boolean = USE_MOCKS): Promise<GraphData> {
  if (useMock) {
    await new Promise((r) => setTimeout(r, 300));
    // Return a deep copy to prevent mutation issues
    return {
      nodes: mockGraphData.nodes.map((n) => ({ ...n })),
      edges: mockGraphData.edges.map((e) => ({ ...e })),
    };
  }

  const res = await apiClient.get(`/brainflare/graph`);
  const data = res.data;

  // Transform API response to our types
  return {
    nodes: data.nodes.map((n: Record<string, unknown>) => ({
      id: n.id as string,
      label: n.label as string,
      classification: n.classification as string | undefined,
      labels: (n.labels as string[]) || [],
      degree: (n.degree as number) || 0,
    })),
    edges: data.edges.map((e: Record<string, unknown>) => ({
      id: e.id as string,
      source: e.source as string,
      target: e.target as string,
      correlationType: e.correlation_type as CorrelationType,
    })),
  };
}

export interface CreateCorrelationRequest {
  source_idea_id: string;
  target_idea_id: string;
  correlation_type: CorrelationType;
  notes?: string;
}

/**
 * Create a new correlation between two ideas
 */
export async function createCorrelation(
  request: CreateCorrelationRequest,
  useMock: boolean = USE_MOCKS
): Promise<void> {
  if (useMock) {
    const newEdge: GraphEdge = {
      id: `corr-${new Date().getTime()}`,
      source: request.source_idea_id,
      target: request.target_idea_id,
      correlationType: request.correlation_type,
    };
    mockGraphData.edges.push(newEdge);
    return;
  }

  await apiClient.post(`/brainflare/correlations`, request);
}

/**
 * Delete a correlation
 */
export async function deleteCorrelation(
  correlationId: string,
  sourceIdeaId: string,
  targetIdeaId: string,
  correlationType: CorrelationType,
  useMock: boolean = USE_MOCKS
): Promise<void> {
  if (useMock) {
    const idx = mockGraphData.edges.findIndex((e) => e.id === correlationId);
    if (idx !== -1) mockGraphData.edges.splice(idx, 1);
    return;
  }

  await apiClient.delete(`/brainflare/correlations/${correlationId}`, {
    params: {
      source_idea_id: sourceIdeaId,
      target_idea_id: targetIdeaId,
      correlation_type: correlationType,
    },
  });
}
