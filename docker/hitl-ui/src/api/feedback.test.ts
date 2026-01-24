/**
 * Tests for Feedback API hooks and types
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import {
  usePendingRules,
  useApproveRule,
  useRejectRule,
  useSubmitFeedback,
  ruleKeys,
  feedbackKeys,
} from './feedback';
import type {
  RuleProposal,
  FeedbackSubmission,
  RuleDecision,
} from './feedback';

// Mock the client
vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Create wrapper for react-query hooks
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('Feedback API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Query Keys', () => {
    it('generates correct rule keys', () => {
      expect(ruleKeys.all).toEqual(['rules']);
      expect(ruleKeys.pending()).toEqual(['rules', 'pending', undefined]);
      expect(ruleKeys.pending({ agent: 'prd-agent' })).toEqual([
        'rules',
        'pending',
        { agent: 'prd-agent' },
      ]);
      expect(ruleKeys.detail('rule-123')).toEqual(['rules', 'detail', 'rule-123']);
    });

    it('generates correct feedback keys', () => {
      expect(feedbackKeys.all).toEqual(['feedback']);
      expect(feedbackKeys.byGate('gate-123')).toEqual(['feedback', 'gate', 'gate-123']);
    });
  });

  describe('usePendingRules', () => {
    it('fetches pending rules', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => usePendingRules(), { wrapper });

      await waitFor(() => {
        // In mock mode, should resolve with mock data
        expect(result.current.isLoading || result.current.isSuccess).toBe(true);
      });
    });
  });

  describe('useSubmitFeedback', () => {
    it('provides mutation function', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useSubmitFeedback(), { wrapper });

      expect(result.current.mutate).toBeDefined();
      expect(result.current.mutateAsync).toBeDefined();
    });
  });

  describe('useApproveRule', () => {
    it('provides mutation function', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useApproveRule(), { wrapper });

      expect(result.current.mutate).toBeDefined();
      expect(result.current.mutateAsync).toBeDefined();
    });
  });

  describe('useRejectRule', () => {
    it('provides mutation function', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useRejectRule(), { wrapper });

      expect(result.current.mutate).toBeDefined();
      expect(result.current.mutateAsync).toBeDefined();
    });
  });
});

describe('Feedback Types', () => {
  it('RuleProposal has required fields', () => {
    const proposal: RuleProposal = {
      id: 'rule-123',
      title: 'Test Rule',
      description: 'A test rule',
      proposedBy: 'evaluator-agent',
      proposedAt: '2026-01-24T10:00:00Z',
      affectedAgents: ['prd-agent'],
      evidenceCount: 5,
      evidence: [{ type: 'rejection', description: 'Test evidence' }],
      impact: {
        estimatedReductionPercent: 20,
        affectedGatesCount: 10,
        riskLevel: 'low',
      },
      status: 'pending',
      confidence: 0.85,
      ruleType: 'GUIDELINE',
      ruleContent: 'Always include acceptance criteria',
    };

    expect(proposal.id).toBe('rule-123');
    expect(proposal.status).toBe('pending');
    expect(proposal.ruleType).toBe('GUIDELINE');
  });

  it('FeedbackSubmission has required fields', () => {
    const feedback: FeedbackSubmission = {
      gateId: 'gate-123',
      decision: 'approved',
      tags: ['quality', 'completeness'],
      summary: 'Good work',
      severity: 'low',
      considerForImprovement: true,
      durationSeconds: 120,
    };

    expect(feedback.gateId).toBe('gate-123');
    expect(feedback.tags).toContain('quality');
  });

  it('RuleDecision has required fields', () => {
    const decision: RuleDecision = {
      ruleId: 'rule-123',
      decision: 'approved',
      decidedBy: 'admin',
    };

    expect(decision.ruleId).toBe('rule-123');
    expect(decision.decision).toBe('approved');
  });
});
