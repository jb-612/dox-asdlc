/**
 * Tests for ideation store (P05-F11 T02)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useIdeationStore } from './ideationStore';
import type { IdeationMessage, Requirement, MaturityState } from '../types/ideation';

// Mock the API module
vi.mock('../api/ideation', () => ({
  sendIdeationMessage: vi.fn(),
  submitForPRD: vi.fn(),
  getSessionMaturity: vi.fn(),
  saveIdeationDraft: vi.fn(),
}));

import * as ideationApi from '../api/ideation';

describe('ideationStore', () => {
  beforeEach(() => {
    useIdeationStore.getState().resetSession();
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have null sessionId initially', () => {
      expect(useIdeationStore.getState().sessionId).toBeNull();
    });

    it('should have empty messages array', () => {
      expect(useIdeationStore.getState().messages).toHaveLength(0);
    });

    it('should have initial maturity state with 0 score', () => {
      const { maturity } = useIdeationStore.getState();
      expect(maturity.score).toBe(0);
      expect(maturity.canSubmit).toBe(false);
    });

    it('should have empty extracted requirements', () => {
      expect(useIdeationStore.getState().extractedRequirements).toHaveLength(0);
    });

    it('should not be submitting', () => {
      expect(useIdeationStore.getState().isSubmitting).toBe(false);
    });
  });

  describe('startSession', () => {
    it('should create a new session with project name', () => {
      useIdeationStore.getState().startSession('Test Project');

      const state = useIdeationStore.getState();
      expect(state.sessionId).toBeTruthy();
      expect(state.sessionId).toMatch(/^ideation-/);
      expect(state.projectName).toBe('Test Project');
    });

    it('should add a system welcome message', () => {
      useIdeationStore.getState().startSession('Test Project');

      const { messages } = useIdeationStore.getState();
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('assistant');
      expect(messages[0].content).toContain('Test Project');
    });

    it('should reset maturity to initial state', () => {
      // First set some state
      useIdeationStore.setState({ maturity: { score: 50 } as MaturityState });

      // Then start new session
      useIdeationStore.getState().startSession('New Project');

      const { maturity } = useIdeationStore.getState();
      expect(maturity.score).toBe(0);
    });
  });

  describe('addMessage', () => {
    beforeEach(() => {
      useIdeationStore.getState().startSession('Test Project');
    });

    it('should add a user message', () => {
      useIdeationStore.getState().addMessage({
        role: 'user',
        content: 'I want to build an authentication system',
      });

      const { messages } = useIdeationStore.getState();
      expect(messages).toHaveLength(2); // welcome + user message
      expect(messages[1].role).toBe('user');
      expect(messages[1].content).toBe('I want to build an authentication system');
    });

    it('should auto-generate message id', () => {
      useIdeationStore.getState().addMessage({
        role: 'user',
        content: 'Test message',
      });

      const { messages } = useIdeationStore.getState();
      expect(messages[1].id).toMatch(/^msg-/);
    });

    it('should set timestamp automatically', () => {
      const before = new Date().toISOString();

      useIdeationStore.getState().addMessage({
        role: 'user',
        content: 'Test message',
      });

      const after = new Date().toISOString();
      const { messages } = useIdeationStore.getState();
      const timestamp = messages[1].timestamp;

      expect(timestamp >= before).toBe(true);
      expect(timestamp <= after).toBe(true);
    });
  });

  describe('updateMaturity', () => {
    beforeEach(() => {
      useIdeationStore.getState().startSession('Test Project');
    });

    it('should update maturity state', () => {
      const newMaturity: Partial<MaturityState> = {
        score: 45,
        canSubmit: false,
      };

      useIdeationStore.getState().updateMaturity(newMaturity);

      const { maturity } = useIdeationStore.getState();
      expect(maturity.score).toBe(45);
    });

    it('should set canSubmit to true when score >= 80', () => {
      useIdeationStore.getState().updateMaturity({ score: 80 });

      const { maturity } = useIdeationStore.getState();
      expect(maturity.canSubmit).toBe(true);
    });

    it('should keep canSubmit false when score < 80', () => {
      useIdeationStore.getState().updateMaturity({ score: 79 });

      const { maturity } = useIdeationStore.getState();
      expect(maturity.canSubmit).toBe(false);
    });
  });

  describe('addRequirement', () => {
    beforeEach(() => {
      useIdeationStore.getState().startSession('Test Project');
    });

    it('should add a requirement', () => {
      const requirement: Requirement = {
        id: 'req-1',
        description: 'System must support OAuth2 authentication',
        type: 'functional',
        priority: 'must_have',
        categoryId: 'functional',
        createdAt: new Date().toISOString(),
      };

      useIdeationStore.getState().addRequirement(requirement);

      const { extractedRequirements } = useIdeationStore.getState();
      expect(extractedRequirements).toHaveLength(1);
      expect(extractedRequirements[0].description).toBe('System must support OAuth2 authentication');
    });

    it('should not add duplicate requirements', () => {
      const requirement: Requirement = {
        id: 'req-1',
        description: 'System must support OAuth2 authentication',
        type: 'functional',
        priority: 'must_have',
        categoryId: 'functional',
        createdAt: new Date().toISOString(),
      };

      useIdeationStore.getState().addRequirement(requirement);
      useIdeationStore.getState().addRequirement(requirement);

      const { extractedRequirements } = useIdeationStore.getState();
      expect(extractedRequirements).toHaveLength(1);
    });
  });

  describe('removeRequirement', () => {
    beforeEach(() => {
      useIdeationStore.getState().startSession('Test Project');

      const requirement: Requirement = {
        id: 'req-1',
        description: 'Test requirement',
        type: 'functional',
        priority: 'must_have',
        categoryId: 'functional',
        createdAt: new Date().toISOString(),
      };
      useIdeationStore.getState().addRequirement(requirement);
    });

    it('should remove a requirement by id', () => {
      useIdeationStore.getState().removeRequirement('req-1');

      const { extractedRequirements } = useIdeationStore.getState();
      expect(extractedRequirements).toHaveLength(0);
    });

    it('should not error when removing non-existent requirement', () => {
      useIdeationStore.getState().removeRequirement('req-999');

      const { extractedRequirements } = useIdeationStore.getState();
      expect(extractedRequirements).toHaveLength(1);
    });
  });

  describe('sendMessage', () => {
    beforeEach(() => {
      useIdeationStore.getState().startSession('Test Project');
    });

    it('should add user message and call API', async () => {
      const mockResponse = {
        message: {
          id: 'msg-response',
          role: 'assistant' as const,
          content: 'That sounds like an interesting project.',
          timestamp: new Date().toISOString(),
        },
        maturityUpdate: {
          score: 10,
          level: { level: 'concept' as const, minScore: 0, maxScore: 20, label: 'General Concept', description: 'Basic idea' },
          categories: [],
          canSubmit: false,
          gaps: [],
        },
        extractedRequirements: [],
        suggestedFollowups: ['What problem are you solving?'],
      };

      vi.mocked(ideationApi.sendIdeationMessage).mockResolvedValue(mockResponse);

      await useIdeationStore.getState().sendMessage('I want to build an authentication system');

      expect(ideationApi.sendIdeationMessage).toHaveBeenCalledWith(expect.objectContaining({
        message: 'I want to build an authentication system',
      }));
    });

    it('should add assistant response to messages', async () => {
      const mockResponse = {
        message: {
          id: 'msg-response',
          role: 'assistant' as const,
          content: 'I understand, let me help you with that.',
          timestamp: new Date().toISOString(),
        },
        maturityUpdate: {
          score: 10,
          level: { level: 'concept' as const, minScore: 0, maxScore: 20, label: 'General Concept', description: 'Basic idea' },
          categories: [],
          canSubmit: false,
          gaps: [],
        },
        extractedRequirements: [],
        suggestedFollowups: [],
      };

      vi.mocked(ideationApi.sendIdeationMessage).mockResolvedValue(mockResponse);

      await useIdeationStore.getState().sendMessage('Test message');

      const { messages } = useIdeationStore.getState();
      const assistantMessages = messages.filter(m => m.role === 'assistant');
      expect(assistantMessages.length).toBeGreaterThan(1);
    });

    it('should update maturity from response', async () => {
      const mockResponse = {
        message: {
          id: 'msg-response',
          role: 'assistant' as const,
          content: 'Good start!',
          timestamp: new Date().toISOString(),
        },
        maturityUpdate: {
          score: 25,
          level: { level: 'exploration' as const, minScore: 20, maxScore: 40, label: 'Exploration', description: 'Key areas identified' },
          categories: [],
          canSubmit: false,
          gaps: [],
        },
        extractedRequirements: [],
        suggestedFollowups: [],
      };

      vi.mocked(ideationApi.sendIdeationMessage).mockResolvedValue(mockResponse);

      await useIdeationStore.getState().sendMessage('Test message');

      const { maturity } = useIdeationStore.getState();
      expect(maturity.score).toBe(25);
    });

    it('should set isLoading during API call', async () => {
      let loadingDuringCall = false;

      vi.mocked(ideationApi.sendIdeationMessage).mockImplementation(async () => {
        loadingDuringCall = useIdeationStore.getState().isLoading;
        return {
          message: { id: 'msg', role: 'assistant', content: 'test', timestamp: new Date().toISOString() },
          maturityUpdate: { score: 0, level: { level: 'concept', minScore: 0, maxScore: 20, label: '', description: '' }, categories: [], canSubmit: false, gaps: [] },
          extractedRequirements: [],
          suggestedFollowups: [],
        };
      });

      await useIdeationStore.getState().sendMessage('Test');

      expect(loadingDuringCall).toBe(true);
      expect(useIdeationStore.getState().isLoading).toBe(false);
    });
  });

  describe('submitForPRD', () => {
    beforeEach(() => {
      useIdeationStore.getState().startSession('Test Project');
      useIdeationStore.getState().updateMaturity({ score: 85, canSubmit: true });
    });

    it('should call API with session data', async () => {
      const mockResult = {
        success: true,
        gateId: 'gate-123',
        prdDraft: {
          id: 'prd-1',
          title: 'Test PRD',
          version: '1.0',
          sections: [],
          createdAt: new Date().toISOString(),
          status: 'draft' as const,
        },
        userStories: [],
      };

      vi.mocked(ideationApi.submitForPRD).mockResolvedValue(mockResult);

      const result = await useIdeationStore.getState().submitForPRD();

      expect(ideationApi.submitForPRD).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should update store with PRD draft', async () => {
      const mockResult = {
        success: true,
        gateId: 'gate-123',
        prdDraft: {
          id: 'prd-1',
          title: 'Test PRD',
          version: '1.0',
          sections: [],
          createdAt: new Date().toISOString(),
          status: 'draft' as const,
        },
        userStories: [],
      };

      vi.mocked(ideationApi.submitForPRD).mockResolvedValue(mockResult);

      await useIdeationStore.getState().submitForPRD();

      const { prdDraft, submittedGateId } = useIdeationStore.getState();
      expect(prdDraft?.id).toBe('prd-1');
      expect(submittedGateId).toBe('gate-123');
    });

    it('should set isSubmitting during API call', async () => {
      let submittingDuringCall = false;

      vi.mocked(ideationApi.submitForPRD).mockImplementation(async () => {
        submittingDuringCall = useIdeationStore.getState().isSubmitting;
        return { success: true, gateId: 'gate-123' };
      });

      await useIdeationStore.getState().submitForPRD();

      expect(submittingDuringCall).toBe(true);
      expect(useIdeationStore.getState().isSubmitting).toBe(false);
    });

    it('should handle API error gracefully', async () => {
      vi.mocked(ideationApi.submitForPRD).mockRejectedValue(new Error('Network error'));

      const result = await useIdeationStore.getState().submitForPRD();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('resetSession', () => {
    beforeEach(() => {
      useIdeationStore.getState().startSession('Test Project');
      useIdeationStore.getState().addMessage({ role: 'user', content: 'Test' });
      useIdeationStore.getState().updateMaturity({ score: 50 });
    });

    it('should clear sessionId', () => {
      useIdeationStore.getState().resetSession();
      expect(useIdeationStore.getState().sessionId).toBeNull();
    });

    it('should clear messages', () => {
      useIdeationStore.getState().resetSession();
      expect(useIdeationStore.getState().messages).toHaveLength(0);
    });

    it('should reset maturity to initial state', () => {
      useIdeationStore.getState().resetSession();
      expect(useIdeationStore.getState().maturity.score).toBe(0);
    });

    it('should clear prdDraft and submittedGateId', () => {
      useIdeationStore.setState({
        prdDraft: { id: 'prd-1' } as any,
        submittedGateId: 'gate-1',
      });

      useIdeationStore.getState().resetSession();

      expect(useIdeationStore.getState().prdDraft).toBeNull();
      expect(useIdeationStore.getState().submittedGateId).toBeNull();
    });
  });
});
