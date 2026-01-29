/**
 * Tests for GapsPanel component (P05-F11 T08)
 *
 * Tests:
 * - List categories below threshold (< 50%)
 * - Show severity (high/medium based on gap size)
 * - Display suggested questions for each gap
 * - "Ask about this" button that triggers callback
 * - Empty state when no gaps
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GapsPanel from './GapsPanel';
import type { Gap } from '../../../types/ideation';

// Helper to create gaps
function createGaps(): Gap[] {
  return [
    {
      categoryId: 'problem',
      categoryName: 'Problem Statement',
      severity: 'critical',
      description: 'Problem Statement (required) has not been addressed. This is essential for a complete PRD.',
      suggestedQuestions: [
        'What specific problem are you trying to solve?',
        'Who experiences this problem and how often?',
        'What is the impact of not solving this problem?',
      ],
    },
    {
      categoryId: 'functional',
      categoryName: 'Functional Requirements',
      severity: 'moderate',
      description: 'Functional Requirements (required) needs more detail (currently at 30%).',
      suggestedQuestions: [
        'What are the core features this system must have?',
        'Can you describe the main user workflows?',
      ],
    },
    {
      categoryId: 'risks',
      categoryName: 'Risks & Assumptions',
      severity: 'minor',
      description: 'Risks & Assumptions could be improved (currently at 60%).',
      suggestedQuestions: [
        'What are the main risks you foresee?',
        'What assumptions are you making?',
      ],
    },
  ];
}

describe('GapsPanel', () => {
  describe('Gap List', () => {
    it('displays all gaps', () => {
      const gaps = createGaps();
      render(<GapsPanel gaps={gaps} onAskQuestion={vi.fn()} />);

      expect(screen.getByText('Problem Statement')).toBeInTheDocument();
      expect(screen.getByText('Functional Requirements')).toBeInTheDocument();
      expect(screen.getByText('Risks & Assumptions')).toBeInTheDocument();
    });

    it('displays gap descriptions', () => {
      const gaps = createGaps();
      render(<GapsPanel gaps={gaps} onAskQuestion={vi.fn()} />);

      expect(screen.getByText(/has not been addressed/)).toBeInTheDocument();
    });

    it('displays suggested questions', () => {
      const gaps = createGaps();
      render(<GapsPanel gaps={gaps} onAskQuestion={vi.fn()} />);

      expect(screen.getByText('What specific problem are you trying to solve?')).toBeInTheDocument();
      expect(screen.getByText('What are the core features this system must have?')).toBeInTheDocument();
    });
  });

  describe('Severity Indicators', () => {
    it('shows high severity indicator for critical gaps', () => {
      const gaps = createGaps();
      render(<GapsPanel gaps={gaps} onAskQuestion={vi.fn()} />);

      const highSeverity = screen.getByTestId('severity-critical-problem');
      expect(highSeverity).toBeInTheDocument();
      expect(highSeverity).toHaveClass('text-status-error');
    });

    it('shows medium severity indicator for moderate gaps', () => {
      const gaps = createGaps();
      render(<GapsPanel gaps={gaps} onAskQuestion={vi.fn()} />);

      const mediumSeverity = screen.getByTestId('severity-moderate-functional');
      expect(mediumSeverity).toBeInTheDocument();
      expect(mediumSeverity).toHaveClass('text-status-warning');
    });

    it('shows low severity indicator for minor gaps', () => {
      const gaps = createGaps();
      render(<GapsPanel gaps={gaps} onAskQuestion={vi.fn()} />);

      const lowSeverity = screen.getByTestId('severity-minor-risks');
      expect(lowSeverity).toBeInTheDocument();
      expect(lowSeverity).toHaveClass('text-status-info');
    });

    it('displays severity badge text', () => {
      const gaps = createGaps();
      render(<GapsPanel gaps={gaps} onAskQuestion={vi.fn()} />);

      expect(screen.getByText('Critical')).toBeInTheDocument();
      expect(screen.getByText('Moderate')).toBeInTheDocument();
      expect(screen.getByText('Minor')).toBeInTheDocument();
    });
  });

  describe('Ask About This Button', () => {
    it('renders "Ask about this" button for each suggested question', () => {
      const gaps = createGaps();
      render(<GapsPanel gaps={gaps} onAskQuestion={vi.fn()} />);

      const askButtons = screen.getAllByRole('button', { name: /ask about this/i });
      // 3 questions for problem + 2 for functional + 2 for risks = 7 buttons
      expect(askButtons.length).toBe(7);
    });

    it('calls onAskQuestion with the question text when clicked', () => {
      const onAskQuestion = vi.fn();
      const gaps = createGaps();
      render(<GapsPanel gaps={gaps} onAskQuestion={onAskQuestion} />);

      const askButtons = screen.getAllByRole('button', { name: /ask about this/i });
      fireEvent.click(askButtons[0]);

      expect(onAskQuestion).toHaveBeenCalledWith('What specific problem are you trying to solve?');
    });

    it('calls onAskQuestion with correct question for each button', () => {
      const onAskQuestion = vi.fn();
      const gaps = [
        {
          categoryId: 'test',
          categoryName: 'Test Category',
          severity: 'critical' as const,
          description: 'Test description',
          suggestedQuestions: ['Question A', 'Question B'],
        },
      ];
      render(<GapsPanel gaps={gaps} onAskQuestion={onAskQuestion} />);

      const askButtons = screen.getAllByRole('button', { name: /ask about this/i });
      fireEvent.click(askButtons[1]);

      expect(onAskQuestion).toHaveBeenCalledWith('Question B');
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no gaps', () => {
      render(<GapsPanel gaps={[]} onAskQuestion={vi.fn()} />);

      expect(screen.getByTestId('gaps-empty-state')).toBeInTheDocument();
    });

    it('displays positive message in empty state', () => {
      render(<GapsPanel gaps={[]} onAskQuestion={vi.fn()} />);

      expect(screen.getByText(/all categories are well-covered/i)).toBeInTheDocument();
    });

    it('shows success icon in empty state', () => {
      render(<GapsPanel gaps={[]} onAskQuestion={vi.fn()} />);

      expect(screen.getByTestId('empty-state-success-icon')).toBeInTheDocument();
    });
  });

  describe('Sorting', () => {
    it('displays gaps sorted by severity (critical first)', () => {
      // Pass gaps in non-sorted order
      const gaps: Gap[] = [
        {
          categoryId: 'risks',
          categoryName: 'Risks',
          severity: 'minor',
          description: 'Minor issue',
          suggestedQuestions: [],
        },
        {
          categoryId: 'problem',
          categoryName: 'Problem Statement',
          severity: 'critical',
          description: 'Critical issue',
          suggestedQuestions: [],
        },
        {
          categoryId: 'functional',
          categoryName: 'Functional',
          severity: 'moderate',
          description: 'Moderate issue',
          suggestedQuestions: [],
        },
      ];
      render(<GapsPanel gaps={gaps} onAskQuestion={vi.fn()} />);

      const gapItems = screen.getAllByTestId(/^gap-item-/);
      expect(gapItems[0]).toHaveAttribute('data-testid', 'gap-item-problem');
      expect(gapItems[1]).toHaveAttribute('data-testid', 'gap-item-functional');
      expect(gapItems[2]).toHaveAttribute('data-testid', 'gap-item-risks');
    });
  });

  describe('Filtering', () => {
    it('can filter by severity level', () => {
      const gaps = createGaps();
      render(<GapsPanel gaps={gaps} onAskQuestion={vi.fn()} filterSeverity="critical" />);

      expect(screen.getByText('Problem Statement')).toBeInTheDocument();
      expect(screen.queryByText('Functional Requirements')).not.toBeInTheDocument();
      expect(screen.queryByText('Risks & Assumptions')).not.toBeInTheDocument();
    });

    it('shows all when filter is "all"', () => {
      const gaps = createGaps();
      render(<GapsPanel gaps={gaps} onAskQuestion={vi.fn()} filterSeverity="all" />);

      expect(screen.getByText('Problem Statement')).toBeInTheDocument();
      expect(screen.getByText('Functional Requirements')).toBeInTheDocument();
      expect(screen.getByText('Risks & Assumptions')).toBeInTheDocument();
    });
  });

  describe('Header', () => {
    it('displays header with gap count', () => {
      const gaps = createGaps();
      render(<GapsPanel gaps={gaps} onAskQuestion={vi.fn()} />);

      expect(screen.getByTestId('gaps-header')).toHaveTextContent('3 Gaps Identified');
    });

    it('displays singular "Gap" for single gap', () => {
      const gaps = [createGaps()[0]];
      render(<GapsPanel gaps={gaps} onAskQuestion={vi.fn()} />);

      expect(screen.getByTestId('gaps-header')).toHaveTextContent('1 Gap Identified');
    });

    it('shows count by severity', () => {
      const gaps = createGaps();
      render(<GapsPanel gaps={gaps} onAskQuestion={vi.fn()} />);

      expect(screen.getByTestId('severity-count-critical')).toHaveTextContent('1');
      expect(screen.getByTestId('severity-count-moderate')).toHaveTextContent('1');
      expect(screen.getByTestId('severity-count-minor')).toHaveTextContent('1');
    });
  });

  describe('Accessibility', () => {
    it('has accessible list structure', () => {
      const gaps = createGaps();
      render(<GapsPanel gaps={gaps} onAskQuestion={vi.fn()} />);

      expect(screen.getByRole('list')).toBeInTheDocument();
      expect(screen.getAllByRole('listitem')).toHaveLength(3);
    });

    it('buttons have accessible names', () => {
      const gaps = createGaps();
      render(<GapsPanel gaps={gaps} onAskQuestion={vi.fn()} />);

      const askButtons = screen.getAllByRole('button', { name: /ask about this/i });
      expect(askButtons.length).toBeGreaterThan(0);
    });

    it('severity badges have aria-labels', () => {
      const gaps = createGaps();
      render(<GapsPanel gaps={gaps} onAskQuestion={vi.fn()} />);

      const criticalBadge = screen.getByTestId('severity-critical-problem');
      expect(criticalBadge).toHaveAttribute('aria-label', 'Critical severity');
    });
  });

  describe('Custom Props', () => {
    it('accepts custom className', () => {
      const gaps = createGaps();
      render(<GapsPanel gaps={gaps} onAskQuestion={vi.fn()} className="custom-class" />);

      const container = screen.getByTestId('gaps-panel');
      expect(container).toHaveClass('custom-class');
    });

    it('can hide suggested questions', () => {
      const gaps = createGaps();
      render(<GapsPanel gaps={gaps} onAskQuestion={vi.fn()} showSuggestions={false} />);

      expect(screen.queryByText('What specific problem are you trying to solve?')).not.toBeInTheDocument();
    });

    it('can be collapsed by default', () => {
      const gaps = createGaps();
      render(<GapsPanel gaps={gaps} onAskQuestion={vi.fn()} defaultCollapsed />);

      expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });

    it('can expand collapsed panel', () => {
      const gaps = createGaps();
      render(<GapsPanel gaps={gaps} onAskQuestion={vi.fn()} defaultCollapsed />);

      fireEvent.click(screen.getByTestId('gaps-header'));

      expect(screen.getByRole('list')).toBeInTheDocument();
    });
  });
});
