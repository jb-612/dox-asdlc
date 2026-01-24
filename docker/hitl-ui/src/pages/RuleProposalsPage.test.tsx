/**
 * Tests for RuleProposalsPage - Meta-HITL UI for reviewing rule proposals
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RuleProposalsPage from './RuleProposalsPage';

// Mock the feedback API
vi.mock('@/api/feedback', () => ({
  usePendingRules: vi.fn(() => ({
    data: {
      rules: [
        {
          id: 'rule-001',
          title: 'Require acceptance criteria in all PRDs',
          description: 'Automatically flag PRD artifacts without acceptance criteria.',
          proposedBy: 'evaluator-agent',
          proposedAt: new Date().toISOString(),
          affectedAgents: ['prd-agent', 'review-agent'],
          evidenceCount: 12,
          evidence: [
            { type: 'rejection', description: 'PRD rejected 12 times for missing criteria' },
          ],
          impact: {
            estimatedReductionPercent: 30,
            affectedGatesCount: 25,
            riskLevel: 'low',
          },
          status: 'pending',
          confidence: 0.92,
          ruleType: 'GUIDELINE',
          ruleContent: 'PRD documents MUST include an "Acceptance Criteria" section.',
        },
        {
          id: 'rule-002',
          title: 'Include error handling in API implementations',
          description: 'Code review should verify API error handling.',
          proposedBy: 'evaluator-agent',
          proposedAt: new Date().toISOString(),
          affectedAgents: ['coding-agent'],
          evidenceCount: 8,
          evidence: [],
          impact: {
            estimatedReductionPercent: 15,
            affectedGatesCount: 40,
            riskLevel: 'medium',
          },
          status: 'pending',
          confidence: 0.78,
          ruleType: 'CONSTRAINT',
          ruleContent: 'All API endpoints MUST include try-catch blocks.',
        },
      ],
      total: 2,
    },
    isLoading: false,
    error: null,
  })),
  useApproveRule: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useRejectRule: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>{children}</BrowserRouter>
      </QueryClientProvider>
    );
  };
}

describe('RuleProposalsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<RuleProposalsPage />, { wrapper: createWrapper() });
      expect(screen.getByTestId('rule-proposals-page')).toBeInTheDocument();
    });

    it('displays page title', () => {
      render(<RuleProposalsPage />, { wrapper: createWrapper() });
      expect(screen.getByText('Rule Proposals')).toBeInTheDocument();
    });

    it('displays page description', () => {
      render(<RuleProposalsPage />, { wrapper: createWrapper() });
      expect(screen.getByText(/review and approve/i)).toBeInTheDocument();
    });
  });

  describe('Rule List', () => {
    it('displays rule proposals', () => {
      render(<RuleProposalsPage />, { wrapper: createWrapper() });
      expect(screen.getByText('Require acceptance criteria in all PRDs')).toBeInTheDocument();
      expect(screen.getByText('Include error handling in API implementations')).toBeInTheDocument();
    });

    it('shows proposal count', () => {
      render(<RuleProposalsPage />, { wrapper: createWrapper() });
      expect(screen.getByTestId('proposal-count')).toHaveTextContent('2');
    });
  });

  describe('Filtering', () => {
    it('shows filter controls', () => {
      render(<RuleProposalsPage />, { wrapper: createWrapper() });
      expect(screen.getByTestId('agent-filter')).toBeInTheDocument();
      expect(screen.getByTestId('type-filter')).toBeInTheDocument();
    });
  });

  describe('Rule Cards', () => {
    it('displays rule cards with actions', () => {
      render(<RuleProposalsPage />, { wrapper: createWrapper() });
      // Each rule card should have approve/reject buttons
      const approveButtons = screen.getAllByTestId('approve-rule');
      expect(approveButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Loading State', () => {
    it('shows loading state when data is loading', async () => {
      const { usePendingRules } = await import('@/api/feedback');
      vi.mocked(usePendingRules).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      } as ReturnType<typeof usePendingRules>);

      render(<RuleProposalsPage />, { wrapper: createWrapper() });
      expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no proposals', async () => {
      const { usePendingRules } = await import('@/api/feedback');
      vi.mocked(usePendingRules).mockReturnValue({
        data: { rules: [], total: 0 },
        isLoading: false,
        error: null,
      } as ReturnType<typeof usePendingRules>);

      render(<RuleProposalsPage />, { wrapper: createWrapper() });
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });
  });
});
