/**
 * Ideas API client for Brainflare Hub (P08-F05)
 *
 * Handles CRUD operations for ideas with mock mode support.
 * Enable mock mode with VITE_USE_MOCK_API=true
 */

import type {
  Idea,
  CreateIdeaRequest,
  UpdateIdeaRequest,
  IdeaListResponse,
  IdeaFilters,
} from '../types/ideas';
import { mockIdeas, generateMockIdea, simulateIdeaDelay } from './mocks/ideas';

const API_BASE = '/api/brainflare/ideas';
const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true';

/**
 * Fetch a paginated list of ideas with optional filters
 */
export async function fetchIdeas(
  filters?: IdeaFilters,
  limit = 50,
  offset = 0
): Promise<IdeaListResponse> {
  if (USE_MOCK) {
    await simulateIdeaDelay();

    let ideas = [...mockIdeas];

    // Apply filters
    if (filters?.status) {
      ideas = ideas.filter((i) => i.status === filters.status);
    }
    if (filters?.classification) {
      ideas = ideas.filter((i) => i.classification === filters.classification);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      ideas = ideas.filter(
        (i) =>
          i.content.toLowerCase().includes(q) ||
          i.author_name.toLowerCase().includes(q) ||
          i.labels.some((label) => label.toLowerCase().includes(q))
      );
    }

    // Sort by created_at descending (newest first)
    ideas.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return {
      ideas: ideas.slice(offset, offset + limit),
      total: ideas.length,
      limit,
      offset,
    };
  }

  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.classification) params.set('classification', filters.classification);
  if (filters?.search) params.set('search', filters.search);
  params.set('limit', String(limit));
  params.set('offset', String(offset));

  const res = await fetch(`${API_BASE}?${params}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch ideas: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Fetch a single idea by ID
 */
export async function fetchIdea(id: string): Promise<Idea> {
  if (USE_MOCK) {
    await simulateIdeaDelay();

    const idea = mockIdeas.find((i) => i.id === id);
    if (!idea) {
      throw new Error('Idea not found');
    }
    return idea;
  }

  const res = await fetch(`${API_BASE}/${id}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch idea: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Create a new idea
 */
export async function createIdea(request: CreateIdeaRequest): Promise<Idea> {
  if (USE_MOCK) {
    await simulateIdeaDelay(200, 400);

    const idea = generateMockIdea(request);
    mockIdeas.unshift(idea);
    return idea;
  }

  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || 'Failed to create idea');
  }
  return res.json();
}

/**
 * Update an existing idea
 */
export async function updateIdea(id: string, request: UpdateIdeaRequest): Promise<Idea> {
  if (USE_MOCK) {
    await simulateIdeaDelay(150, 300);

    const idx = mockIdeas.findIndex((i) => i.id === id);
    if (idx === -1) {
      throw new Error('Idea not found');
    }

    // Update the idea with new values
    const updated: Idea = {
      ...mockIdeas[idx],
      ...request,
      updated_at: new Date().toISOString(),
    };

    // Recalculate word count if content changed
    if (request.content !== undefined) {
      updated.word_count = request.content.split(/\s+/).filter(Boolean).length;
    }

    mockIdeas[idx] = updated;
    return updated;
  }

  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    throw new Error(`Failed to update idea: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Delete an idea by ID
 */
export async function deleteIdea(id: string): Promise<void> {
  if (USE_MOCK) {
    await simulateIdeaDelay(100, 200);

    const idx = mockIdeas.findIndex((i) => i.id === id);
    if (idx !== -1) {
      mockIdeas.splice(idx, 1);
    }
    return;
  }

  const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    throw new Error(`Failed to delete idea: ${res.statusText}`);
  }
}

/**
 * Classification counts response
 */
export interface ClassificationCountsResponse {
  functional: number;
  non_functional: number;
  undetermined: number;
  total: number;
}

/**
 * Fetch classification counts for ideas
 *
 * Returns the count of ideas per classification type.
 * Optionally filters by status.
 */
export async function fetchClassificationCounts(
  status?: 'active' | 'archived'
): Promise<ClassificationCountsResponse> {
  if (USE_MOCK) {
    await simulateIdeaDelay(50, 100);

    // Filter by status if provided
    const filteredIdeas = status
      ? mockIdeas.filter((i) => i.status === status)
      : mockIdeas;

    // Count by classification
    const counts = filteredIdeas.reduce(
      (acc, idea) => {
        acc[idea.classification]++;
        acc.total++;
        return acc;
      },
      { functional: 0, non_functional: 0, undetermined: 0, total: 0 }
    );

    return counts;
  }

  const params = new URLSearchParams();
  if (status) params.set('status', status);

  const res = await fetch(`${API_BASE}/counts?${params}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch classification counts: ${res.statusText}`);
  }
  return res.json();
}
