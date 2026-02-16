/**
 * Mock data for Brainflare Hub Ideas (P08-F05)
 *
 * Provides mock ideas for development without a backend.
 * Enable with VITE_USE_MOCKS=true in .env.local
 */

import type { Idea, CreateIdeaRequest } from '../../types/ideas';
import { workItemFeatureIdeas } from './workItemIdeas';

/**
 * Original user-submitted mock ideas
 */
const userMockIdeas: Idea[] = [
  {
    id: 'idea-001',
    content:
      'Add dark mode support to the application for better accessibility and reduced eye strain during night-time usage',
    author_id: 'user-1',
    author_name: 'Alice Chen',
    status: 'active',
    classification: 'functional',
    labels: ['ui', 'accessibility'],
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
    word_count: 17,
  },
  {
    id: 'idea-002',
    content:
      'Implement Redis caching layer to improve API response times for frequently accessed data',
    author_id: 'user-2',
    author_name: 'Bob Smith',
    status: 'active',
    classification: 'non_functional',
    labels: ['performance', 'backend'],
    created_at: new Date(Date.now() - 172800000).toISOString(),
    updated_at: new Date(Date.now() - 172800000).toISOString(),
    word_count: 13,
  },
  {
    id: 'idea-003',
    content:
      'Create a unified notification system that aggregates alerts from different services into a single dashboard',
    author_id: 'user-1',
    author_name: 'Alice Chen',
    status: 'active',
    classification: 'functional',
    labels: ['notifications', 'dashboard'],
    created_at: new Date(Date.now() - 259200000).toISOString(),
    updated_at: new Date(Date.now() - 259200000).toISOString(),
    word_count: 15,
  },
  {
    id: 'idea-004',
    content:
      'Integrate with Slack to allow team members to submit ideas directly from their workspace without switching context',
    author_id: 'user-3',
    author_name: 'Carol Davis',
    status: 'active',
    classification: 'functional',
    labels: ['integration', 'slack'],
    created_at: new Date(Date.now() - 345600000).toISOString(),
    updated_at: new Date(Date.now() - 345600000).toISOString(),
    word_count: 18,
  },
  {
    id: 'idea-005',
    content:
      'Add rate limiting to API endpoints to prevent abuse and ensure fair usage across all clients',
    author_id: 'user-2',
    author_name: 'Bob Smith',
    status: 'archived',
    classification: 'non_functional',
    labels: ['security', 'api'],
    created_at: new Date(Date.now() - 432000000).toISOString(),
    updated_at: new Date(Date.now() - 100000000).toISOString(),
    word_count: 16,
  },
  {
    id: 'idea-006',
    content:
      'Build a graph visualization to show relationships between ideas and help identify patterns and clusters',
    author_id: 'user-1',
    author_name: 'Alice Chen',
    status: 'active',
    classification: 'functional',
    labels: ['visualization', 'graph'],
    created_at: new Date(Date.now() - 518400000).toISOString(),
    updated_at: new Date(Date.now() - 518400000).toISOString(),
    word_count: 16,
  },
];

/**
 * Combined mock ideas: work item features + user-submitted ideas
 * Work item features appear first (older timestamps), then user ideas
 */
export const mockIdeas: Idea[] = [...workItemFeatureIdeas, ...userMockIdeas];

/**
 * Counter for generating unique mock IDs
 */
let idCounter = mockIdeas.length + 1;

/**
 * Generate a new mock idea from a create request
 */
export function generateMockIdea(request: CreateIdeaRequest): Idea {
  const now = new Date().toISOString();
  return {
    id: `idea-${String(idCounter++).padStart(3, '0')}`,
    content: request.content,
    author_id: request.author_id || 'anonymous',
    author_name: request.author_name || 'Anonymous',
    status: 'active',
    classification: request.classification || 'undetermined',
    labels: request.labels || [],
    created_at: now,
    updated_at: now,
    word_count: request.content.split(/\s+/).filter(Boolean).length,
  };
}

/**
 * Simulate network delay for mock API calls
 */
export function simulateIdeaDelay(minMs = 100, maxMs = 300): Promise<void> {
  const delay = Math.random() * (maxMs - minMs) + minMs;
  return new Promise((resolve) => setTimeout(resolve, delay));
}
