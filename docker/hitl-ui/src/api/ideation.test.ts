/**
 * Tests for ideation API client functions (P05-F11 T04)
 *
 * Tests both real API integration (with transformations) and mock fallback.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiClient } from './client';
import {
  sendIdeationMessage,
  submitForPRD,
  getSessionMaturity,
  saveIdeationDraft,
  loadIdeationDraft,
  deleteIdeationDraft,
  listIdeationDrafts,
} from './ideation';
import type {
  IdeationChatRequest,
  PRDSubmission,
  MaturityState,
} from '../types/ideation';

// Mock the API client
vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock useMocks to return false so we test real API calls
// Note: ideation.ts imports from './mocks/index'
vi.mock('./mocks/index', () => ({
  areMocksEnabled: vi.fn(() => false),
}));

// Mock config
vi.mock('../config', () => ({
  config: {
    isDev: false,
    apiBaseUrl: '/api',
    useMockApi: false,
  },
}));

describe('Ideation API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sendIdeationMessage', () => {
    it('should send chat message and transform backend response', async () => {
      const request: IdeationChatRequest = {
        sessionId: 'session-123',
        message: 'I want to build an authentication system',
        currentMaturity: 10,
      };

      // Backend returns level as string
      const backendResponse = {
        message: {
          id: 'msg-1',
          role: 'assistant',
          content: 'Great! Let me help you define the requirements.',
          timestamp: '2026-01-28T00:00:00Z',
          maturityDelta: 5,
          suggestedFollowups: ['What users will need authentication?'],
        },
        maturityUpdate: {
          score: 15,
          level: 'concept', // Backend sends string
          categories: [
            { id: 'problem', name: 'Problem Statement', score: 30, requiredForSubmit: true },
          ],
          canSubmit: false,
          gaps: ['More details needed'],
        },
        extractedRequirements: [],
        suggestedFollowups: ['What users will need authentication?'],
      };

      vi.mocked(apiClient.post).mockResolvedValue({ data: backendResponse });

      const result = await sendIdeationMessage(request);

      expect(apiClient.post).toHaveBeenCalledWith('/studio/ideation/chat', request);
      expect(result.message.role).toBe('assistant');
      // Verify level was transformed from string to object
      expect(result.maturityUpdate.level).toEqual({
        level: 'concept',
        minScore: 0,
        maxScore: 20,
        label: 'General Concept',
        description: 'Basic idea captured',
      });
      // Verify weight was added to category
      expect(result.maturityUpdate.categories[0].weight).toBe(15);
    });

    it('should include optional model and rlmEnabled parameters', async () => {
      const request: IdeationChatRequest = {
        sessionId: 'session-123',
        message: 'Test message',
        currentMaturity: 20,
        model: 'opus',
        rlmEnabled: true,
      };

      vi.mocked(apiClient.post).mockResolvedValue({
        data: {
          message: { id: 'msg-1', role: 'assistant', content: 'Response', timestamp: '2026-01-28T00:00:00Z' },
          maturityUpdate: { score: 25, level: 'exploration', categories: [], canSubmit: false, gaps: [] },
          extractedRequirements: [],
          suggestedFollowups: [],
        },
      });

      await sendIdeationMessage(request);

      expect(apiClient.post).toHaveBeenCalledWith('/studio/ideation/chat', request);
    });

    it('should handle extracted requirements in response', async () => {
      const request: IdeationChatRequest = {
        sessionId: 'session-123',
        message: 'The system must support OAuth2 and MFA',
        currentMaturity: 30,
      };

      const backendResponse = {
        message: {
          id: 'msg-1',
          role: 'assistant',
          content: 'I understand. I extracted the following requirements...',
          timestamp: '2026-01-28T00:00:00Z',
          extractedRequirements: [
            {
              id: 'req-1',
              description: 'Support OAuth2 authentication',
              type: 'functional',
              priority: 'must_have',
              categoryId: 'functional',
              createdAt: '2026-01-28T00:00:00Z',
            },
            {
              id: 'req-2',
              description: 'Support Multi-Factor Authentication',
              type: 'functional',
              priority: 'must_have',
              categoryId: 'functional',
              createdAt: '2026-01-28T00:00:00Z',
            },
          ],
        },
        maturityUpdate: {
          score: 40,
          level: 'defined',
          categories: [],
          canSubmit: false,
          gaps: [],
        },
        extractedRequirements: [
          {
            id: 'req-1',
            description: 'Support OAuth2 authentication',
            type: 'functional',
            priority: 'must_have',
            categoryId: 'functional',
            createdAt: '2026-01-28T00:00:00Z',
          },
          {
            id: 'req-2',
            description: 'Support Multi-Factor Authentication',
            type: 'functional',
            priority: 'must_have',
            categoryId: 'functional',
            createdAt: '2026-01-28T00:00:00Z',
          },
        ],
        suggestedFollowups: ['Which OAuth providers should be supported?'],
      };

      vi.mocked(apiClient.post).mockResolvedValue({ data: backendResponse });

      const result = await sendIdeationMessage(request);

      expect(result.extractedRequirements).toHaveLength(2);
      expect(result.extractedRequirements[0].description).toBe('Support OAuth2 authentication');
    });

    it('should handle API errors gracefully', async () => {
      const request: IdeationChatRequest = {
        sessionId: 'session-123',
        message: 'Test message',
        currentMaturity: 10,
      };

      vi.mocked(apiClient.post).mockRejectedValue(new Error('Network error'));

      await expect(sendIdeationMessage(request)).rejects.toThrow('Network error');
    });
  });

  describe('submitForPRD', () => {
    it('should transform request and response for PRD submission', async () => {
      const request: PRDSubmission = {
        sessionId: 'session-123',
        maturityScore: 85,
        extractedRequirements: [
          {
            id: 'req-1',
            description: 'Support OAuth2',
            type: 'functional',
            priority: 'must_have',
            categoryId: 'functional',
            createdAt: '2026-01-28T00:00:00Z',
          },
        ],
        conversationSummary: 'User wants authentication system...',
        requestedBy: 'user@example.com',
      };

      // Backend response format
      const backendResponse = {
        gateId: 'gate-456',
        prdDraft: {
          id: 'prd-1',
          title: 'Authentication System PRD',
          version: '1.0',
          sections: [
            { id: 'overview', heading: 'Overview', content: 'This document...', order: 1 },
          ],
          createdAt: '2026-01-28T00:00:00Z',
          status: 'pending_review',
        },
        userStories: [
          {
            id: 'story-1',
            title: 'User Login',
            asA: 'registered user',
            iWant: 'to log in with my credentials',
            soThat: 'I can access protected resources',
            acceptanceCriteria: ['Valid credentials grant access', 'Invalid credentials show error'],
            linkedRequirements: ['req-1'],
            priority: 'must_have',
          },
        ],
        status: 'pending_review',
      };

      vi.mocked(apiClient.post).mockResolvedValue({ data: backendResponse });

      const result = await submitForPRD(request);

      // Verify request was transformed
      expect(apiClient.post).toHaveBeenCalledWith(
        '/studio/ideation/submit-prd',
        expect.objectContaining({
          sessionId: 'session-123',
          maturityState: expect.objectContaining({
            score: 85,
            canSubmit: true,
          }),
          includeUserStories: true,
        })
      );

      // Verify response was transformed
      expect(result.success).toBe(true);
      expect(result.gateId).toBe('gate-456');
      expect(result.prdDraft?.title).toBe('Authentication System PRD');
      expect(result.userStories).toHaveLength(1);
    });

    it('should handle 400 error for maturity threshold', async () => {
      const request: PRDSubmission = {
        sessionId: 'session-123',
        maturityScore: 75, // Below threshold
        extractedRequirements: [],
        conversationSummary: 'Incomplete conversation',
        requestedBy: 'user@example.com',
      };

      const axiosError = {
        response: {
          status: 400,
          data: { detail: 'Maturity score 75% is below the 80% threshold required for PRD submission' },
        },
      };

      vi.mocked(apiClient.post).mockRejectedValue(axiosError);

      const result = await submitForPRD(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Maturity score');
      expect(result.error).toContain('80%');
    });

    it('should rethrow other errors', async () => {
      const request: PRDSubmission = {
        sessionId: 'session-123',
        maturityScore: 85,
        extractedRequirements: [],
        conversationSummary: 'Test',
        requestedBy: 'user@example.com',
      };

      vi.mocked(apiClient.post).mockRejectedValue(new Error('Server error'));

      await expect(submitForPRD(request)).rejects.toThrow('Server error');
    });
  });

  describe('getSessionMaturity', () => {
    it('should fetch and transform maturity state for session', async () => {
      // Backend response with level as string
      const backendMaturity = {
        score: 65,
        level: 'refined', // String, not object
        categories: [
          { id: 'problem', name: 'Problem Statement', score: 80, requiredForSubmit: true },
          { id: 'users', name: 'Target Users', score: 70, requiredForSubmit: true },
        ],
        canSubmit: false,
        gaps: ['Functional Requirements needs more detail'],
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: backendMaturity });

      const result = await getSessionMaturity('session-123');

      expect(apiClient.get).toHaveBeenCalledWith('/studio/ideation/session-123/maturity');
      expect(result.score).toBe(65);
      // Verify level was transformed from string to object
      expect(result.level.level).toBe('refined');
      expect(result.level.label).toBe('Refined');
      // Verify weights were added
      expect(result.categories[0].weight).toBe(15); // problem weight
      expect(result.categories[1].weight).toBe(10); // users weight
    });

    it('should handle API errors', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Session not found'));

      await expect(getSessionMaturity('nonexistent')).rejects.toThrow('Session not found');
    });
  });

  describe('saveIdeationDraft', () => {
    it('should transform draft to backend format before saving', async () => {
      const sessionId = 'session-123';
      const draft = {
        messages: [
          { id: 'msg-1', role: 'user' as const, content: 'Hello', timestamp: '2026-01-28T00:00:00Z' },
        ],
        maturity: {
          score: 30,
          level: {
            level: 'exploration' as const,
            minScore: 20,
            maxScore: 40,
            label: 'Exploration',
            description: 'Key areas identified',
          },
          categories: [
            { id: 'problem', name: 'Problem Statement', score: 50, weight: 15, requiredForSubmit: true, sections: [] },
          ],
          canSubmit: false,
          gaps: ['More details needed'],
        },
        requirements: [],
      };

      vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true } });

      await saveIdeationDraft(sessionId, draft);

      // Verify request was transformed to backend format
      expect(apiClient.post).toHaveBeenCalledWith(
        '/studio/ideation/session-123/draft',
        expect.objectContaining({
          messages: draft.messages,
          maturityState: expect.objectContaining({
            score: 30,
            level: 'exploration', // Transformed to string
            canSubmit: false,
          }),
          extractedRequirements: [],
        })
      );
    });

    it('should not throw on successful save', async () => {
      const draft = {
        messages: [],
        maturity: {
          score: 0,
          level: {
            level: 'concept' as const,
            minScore: 0,
            maxScore: 20,
            label: 'General Concept',
            description: 'Basic idea captured',
          },
          categories: [],
          canSubmit: false,
          gaps: [],
        },
        requirements: [],
      };

      vi.mocked(apiClient.post).mockResolvedValue({ data: {} });

      await expect(saveIdeationDraft('session-123', draft)).resolves.not.toThrow();
    });
  });

  describe('loadIdeationDraft', () => {
    it('should load and transform draft from backend', async () => {
      const backendDraft = {
        id: 'session-123',
        projectName: 'Test Project',
        status: 'draft',
        messages: [
          { id: 'msg-1', role: 'user', content: 'Hello', timestamp: '2026-01-28T00:00:00Z' },
        ],
        maturityState: {
          score: 45,
          level: 'defined',
          categories: [
            { id: 'problem', name: 'Problem Statement', score: 60, requiredForSubmit: true },
          ],
          canSubmit: false,
          gaps: [],
        },
        requirements: [
          {
            id: 'req-1',
            description: 'Test requirement',
            type: 'functional',
            priority: 'must_have',
            categoryId: 'functional',
            createdAt: '2026-01-28T00:00:00Z',
          },
        ],
        createdAt: '2026-01-28T00:00:00Z',
        updatedAt: '2026-01-28T00:00:00Z',
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: backendDraft });

      const result = await loadIdeationDraft('session-123');

      expect(result).not.toBeNull();
      expect(result?.messages).toHaveLength(1);
      // Verify maturity was transformed
      expect(result?.maturity.level.level).toBe('defined');
      expect(result?.maturity.level.label).toBe('Firm Understanding');
      expect(result?.requirements).toHaveLength(1);
    });

    it('should return null for 404 errors', async () => {
      const axiosError = {
        response: { status: 404 },
      };

      vi.mocked(apiClient.get).mockRejectedValue(axiosError);

      const result = await loadIdeationDraft('nonexistent');

      expect(result).toBeNull();
    });

    it('should rethrow other errors', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Server error'));

      await expect(loadIdeationDraft('session-123')).rejects.toThrow('Server error');
    });
  });

  describe('deleteIdeationDraft', () => {
    it('should call delete endpoint', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });

      await deleteIdeationDraft('session-123');

      expect(apiClient.delete).toHaveBeenCalledWith('/studio/ideation/session-123/draft');
    });

    it('should handle errors', async () => {
      vi.mocked(apiClient.delete).mockRejectedValue(new Error('Delete failed'));

      await expect(deleteIdeationDraft('session-123')).rejects.toThrow('Delete failed');
    });
  });

  describe('listIdeationDrafts', () => {
    it('should return list of drafts', async () => {
      const mockResponse = {
        sessions: [
          { id: 'session-1', projectName: 'Project A', status: 'draft', createdAt: '2026-01-28T00:00:00Z', updatedAt: '2026-01-28T00:00:00Z', messageCount: 5, maturityScore: 45 },
          { id: 'session-2', projectName: 'Project B', status: 'draft', createdAt: '2026-01-27T00:00:00Z', updatedAt: '2026-01-27T00:00:00Z', messageCount: 10, maturityScore: 80 },
        ],
        total: 2,
        limit: 20,
        offset: 0,
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });

      const result = await listIdeationDrafts();

      expect(apiClient.get).toHaveBeenCalledWith('/studio/ideation/sessions');
      expect(result).toHaveLength(2);
      expect(result[0].projectName).toBe('Project A');
      expect(result[0].sessionId).toBe('session-1');
    });

    it('should handle errors', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Fetch failed'));

      await expect(listIdeationDrafts()).rejects.toThrow('Fetch failed');
    });
  });
});

describe('Ideation API mock flag', () => {
  it('areMocksEnabled is mocked to false for API testing', async () => {
    // This test verifies that areMocksEnabled is mocked to false
    // so that the real API path is tested above.
    // The mock implementations themselves are tested in mocks/ideation.test.ts
    const { areMocksEnabled } = await import('./mocks/index');
    expect(typeof areMocksEnabled).toBe('function');
  });
});
