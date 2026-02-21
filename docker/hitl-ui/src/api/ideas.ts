/**
 * Ideas API client for Brainflare Hub (P08-F05)
 *
 * Handles CRUD operations for ideas with mock mode support.
 * Enable mock mode with VITE_USE_MOCKS=true
 */

import type {
  Idea,
  CreateIdeaRequest,
  UpdateIdeaRequest,
  IdeaListResponse,
  IdeaFilters,
} from '../types/ideas';
import { mockIdeas, generateMockIdea, simulateIdeaDelay } from './mocks/ideas';
import { apiClient } from './client';

const API_BASE = '/brainflare/ideas';
const USE_MOCK = import.meta.env.VITE_USE_MOCKS === 'true';

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

  const params: Record<string, string> = {
    limit: String(limit),
    offset: String(offset),
  };
  if (filters?.status) params.status = filters.status;
  if (filters?.classification) params.classification = filters.classification;
  if (filters?.search) params.search = filters.search;

  const res = await apiClient.get<IdeaListResponse>(API_BASE, { params });
  return res.data;
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

  const res = await apiClient.get<Idea>(`${API_BASE}/${id}`);
  return res.data;
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

  const res = await apiClient.post<Idea>(API_BASE, request);
  return res.data;
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

  const res = await apiClient.put<Idea>(`${API_BASE}/${id}`, request);
  return res.data;
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

  await apiClient.delete(`${API_BASE}/${id}`);
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

  const params: Record<string, string> = {};
  if (status) params.status = status;

  const res = await apiClient.get<ClassificationCountsResponse>(`${API_BASE}/counts`, { params });
  return res.data;
}
