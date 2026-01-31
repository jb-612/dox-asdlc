/**
 * Correlations and Graph API client for Brainflare Hub (P08-F06)
 *
 * Handles graph data fetching and correlation CRUD operations.
 * Enable mock mode with VITE_USE_MOCK_API=true
 */

import type { GraphData, GraphNode, GraphEdge, CorrelationType } from '../types/graph';

const API_BASE = '/api/brainflare';
const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true';

// Mock graph data for development and testing
const mockGraphData: GraphData = {
  nodes: [
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
      degree: 2,
    },
    {
      id: 'idea-003',
      label: 'Unified notification system',
      classification: 'functional',
      labels: ['notifications'],
      degree: 2,
    },
    {
      id: 'idea-004',
      label: 'Mobile responsive design',
      classification: 'functional',
      labels: ['ui', 'mobile'],
      degree: 1,
    },
    {
      id: 'idea-005',
      label: 'API rate limiting',
      classification: 'non_functional',
      labels: ['security'],
      degree: 1,
    },
  ],
  edges: [
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
  ],
};

/**
 * Fetch graph data (nodes and edges)
 */
export async function fetchGraph(): Promise<GraphData> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 300));
    // Return a deep copy to prevent mutation issues
    return {
      nodes: mockGraphData.nodes.map((n) => ({ ...n })),
      edges: mockGraphData.edges.map((e) => ({ ...e })),
    };
  }

  const res = await fetch(`${API_BASE}/graph`);
  if (!res.ok) throw new Error(`Failed to fetch graph: ${res.statusText}`);
  const data = await res.json();

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
export async function createCorrelation(request: CreateCorrelationRequest): Promise<void> {
  if (USE_MOCK) {
    const newEdge: GraphEdge = {
      id: `corr-${Date.now()}`,
      source: request.source_idea_id,
      target: request.target_idea_id,
      correlationType: request.correlation_type,
    };
    mockGraphData.edges.push(newEdge);
    return;
  }

  const res = await fetch(`${API_BASE}/correlations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(`Failed to create correlation: ${res.statusText}`);
}

/**
 * Delete a correlation
 */
export async function deleteCorrelation(
  correlationId: string,
  sourceIdeaId: string,
  targetIdeaId: string,
  correlationType: CorrelationType
): Promise<void> {
  if (USE_MOCK) {
    const idx = mockGraphData.edges.findIndex((e) => e.id === correlationId);
    if (idx !== -1) mockGraphData.edges.splice(idx, 1);
    return;
  }

  const params = new URLSearchParams({
    source_idea_id: sourceIdeaId,
    target_idea_id: targetIdeaId,
    correlation_type: correlationType,
  });

  const res = await fetch(`${API_BASE}/correlations/${correlationId}?${params}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Failed to delete correlation: ${res.statusText}`);
}
