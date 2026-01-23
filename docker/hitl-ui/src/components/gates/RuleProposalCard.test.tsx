/**
 * Tests for RuleProposalCard component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import RuleProposalCard, { type RuleProposal } from './RuleProposalCard';

describe('RuleProposalCard', () => {
  const defaultProposal: RuleProposal = {
    id: 'rule-123',
    title: 'Require acceptance criteria in all PRDs',
    description: 'Automatically reject PRD artifacts that do not contain acceptance criteria section.',
    proposedBy: 'evaluator-agent',
    proposedAt: '2026-01-23T10:00:00Z',
    affectedAgents: ['prd-agent', 'review-agent'],
    evidenceCount: 12,
    evidence: [
      { type: 'rejection', description: 'PRD rejected 12 times for missing criteria' },
      { type: 'pattern', description: '95% of rejections include this feedback' },
    ],
    impact: {
      estimatedReductionPercent: 30,
      affectedGatesCount: 25,
      riskLevel: 'low',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<RuleProposalCard proposal={defaultProposal} />);
      expect(screen.getByTestId('rule-proposal-card')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<RuleProposalCard proposal={defaultProposal} className="my-custom-class" />);
      expect(screen.getByTestId('rule-proposal-card')).toHaveClass('my-custom-class');
    });

    it('displays rule title', () => {
      render(<RuleProposalCard proposal={defaultProposal} />);
      expect(screen.getByText('Require acceptance criteria in all PRDs')).toBeInTheDocument();
    });

    it('displays rule description', () => {
      render(<RuleProposalCard proposal={defaultProposal} />);
      expect(screen.getByText(/automatically reject prd/i)).toBeInTheDocument();
    });
  });

  describe('Metadata', () => {
    it('displays proposed by', () => {
      render(<RuleProposalCard proposal={defaultProposal} />);
      expect(screen.getByTestId('proposed-by')).toHaveTextContent('evaluator-agent');
    });

    it('displays proposed timestamp', () => {
      render(<RuleProposalCard proposal={defaultProposal} />);
      expect(screen.getByTestId('proposed-at')).toBeInTheDocument();
    });

    it('displays evidence count', () => {
      render(<RuleProposalCard proposal={defaultProposal} />);
      expect(screen.getByTestId('evidence-count')).toHaveTextContent('12');
    });
  });

  describe('Affected Agents', () => {
    it('displays affected agents section', () => {
      render(<RuleProposalCard proposal={defaultProposal} />);
      expect(screen.getByTestId('affected-agents')).toBeInTheDocument();
    });

    it('lists all affected agents', () => {
      render(<RuleProposalCard proposal={defaultProposal} />);
      const section = screen.getByTestId('affected-agents');
      expect(within(section).getByText('prd-agent')).toBeInTheDocument();
      expect(within(section).getByText('review-agent')).toBeInTheDocument();
    });
  });

  describe('Evidence', () => {
    it('displays evidence section', () => {
      render(<RuleProposalCard proposal={defaultProposal} />);
      expect(screen.getByTestId('evidence-section')).toBeInTheDocument();
    });

    it('shows evidence items', () => {
      render(<RuleProposalCard proposal={defaultProposal} />);
      expect(screen.getByText(/prd rejected 12 times/i)).toBeInTheDocument();
    });

    it('shows evidence type badges', () => {
      render(<RuleProposalCard proposal={defaultProposal} />);
      expect(screen.getByText('rejection')).toBeInTheDocument();
      expect(screen.getByText('pattern')).toBeInTheDocument();
    });
  });

  describe('Impact Analysis', () => {
    it('displays impact section', () => {
      render(<RuleProposalCard proposal={defaultProposal} />);
      expect(screen.getByTestId('impact-section')).toBeInTheDocument();
    });

    it('shows estimated reduction', () => {
      render(<RuleProposalCard proposal={defaultProposal} />);
      expect(screen.getByTestId('estimated-reduction')).toHaveTextContent('30%');
    });

    it('shows affected gates count', () => {
      render(<RuleProposalCard proposal={defaultProposal} />);
      expect(screen.getByTestId('affected-gates')).toHaveTextContent('25');
    });

    it('shows risk level', () => {
      render(<RuleProposalCard proposal={defaultProposal} />);
      expect(screen.getByTestId('risk-level')).toHaveTextContent(/low/i);
    });

    it('shows low risk with success styling', () => {
      render(<RuleProposalCard proposal={defaultProposal} />);
      expect(screen.getByTestId('risk-level')).toHaveClass('text-status-success');
    });

    it('shows high risk with error styling', () => {
      const highRiskProposal = {
        ...defaultProposal,
        impact: { ...defaultProposal.impact, riskLevel: 'high' as const },
      };
      render(<RuleProposalCard proposal={highRiskProposal} />);
      expect(screen.getByTestId('risk-level')).toHaveClass('text-status-error');
    });
  });

  describe('Decision Actions', () => {
    it('shows approve button', () => {
      render(<RuleProposalCard proposal={defaultProposal} />);
      expect(screen.getByTestId('approve-rule')).toBeInTheDocument();
    });

    it('shows modify button', () => {
      render(<RuleProposalCard proposal={defaultProposal} />);
      expect(screen.getByTestId('modify-rule')).toBeInTheDocument();
    });

    it('shows reject button', () => {
      render(<RuleProposalCard proposal={defaultProposal} />);
      expect(screen.getByTestId('reject-rule')).toBeInTheDocument();
    });

    it('calls onApprove when approve clicked', () => {
      const onApprove = vi.fn();
      render(<RuleProposalCard proposal={defaultProposal} onApprove={onApprove} />);

      fireEvent.click(screen.getByTestId('approve-rule'));

      expect(onApprove).toHaveBeenCalledWith('rule-123');
    });

    it('calls onModify when modify clicked', () => {
      const onModify = vi.fn();
      render(<RuleProposalCard proposal={defaultProposal} onModify={onModify} />);

      fireEvent.click(screen.getByTestId('modify-rule'));

      expect(onModify).toHaveBeenCalledWith('rule-123');
    });

    it('calls onReject when reject clicked', () => {
      const onReject = vi.fn();
      render(<RuleProposalCard proposal={defaultProposal} onReject={onReject} />);

      fireEvent.click(screen.getByTestId('reject-rule'));

      expect(onReject).toHaveBeenCalledWith('rule-123');
    });
  });

  describe('Collapsed State', () => {
    it('can be rendered collapsed', () => {
      render(<RuleProposalCard proposal={defaultProposal} collapsed />);
      expect(screen.queryByTestId('evidence-section')).not.toBeInTheDocument();
    });

    it('shows expand button when collapsed', () => {
      render(<RuleProposalCard proposal={defaultProposal} collapsed />);
      expect(screen.getByTestId('expand-card')).toBeInTheDocument();
    });

    it('expands when expand button clicked', () => {
      render(<RuleProposalCard proposal={defaultProposal} collapsed />);

      fireEvent.click(screen.getByTestId('expand-card'));

      expect(screen.getByTestId('evidence-section')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('action buttons are keyboard accessible', () => {
      const onApprove = vi.fn();
      render(<RuleProposalCard proposal={defaultProposal} onApprove={onApprove} />);

      const approveBtn = screen.getByTestId('approve-rule');
      fireEvent.keyDown(approveBtn, { key: 'Enter' });

      expect(onApprove).toHaveBeenCalled();
    });
  });
});
