/**
 * Tests for MaturityTracker component (P05-F11 T06)
 *
 * Tests:
 * - Progress bar displays correct percentage
 * - Level indicator shows current maturity level
 * - Color coding: red (<40%), yellow (40-79%), green (80%+)
 * - Animated transitions on score changes
 * - "Ready to Submit" indicator at 80%+
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MaturityTracker from './MaturityTracker';
import type { MaturityState, MaturityLevel } from '../../../types/ideation';
import { createInitialMaturityState } from '../../../utils/maturityCalculator';

// Helper to create a maturity state at a specific score
function createMaturityStateAtScore(score: number): MaturityState {
  const levelMap: Record<string, MaturityLevel> = {
    concept: {
      level: 'concept',
      minScore: 0,
      maxScore: 20,
      label: 'General Concept',
      description: 'Basic idea captured',
    },
    exploration: {
      level: 'exploration',
      minScore: 20,
      maxScore: 40,
      label: 'Exploration',
      description: 'Key areas identified',
    },
    defined: {
      level: 'defined',
      minScore: 40,
      maxScore: 60,
      label: 'Firm Understanding',
      description: 'Core requirements clear',
    },
    refined: {
      level: 'refined',
      minScore: 60,
      maxScore: 80,
      label: 'Refined',
      description: 'Details mostly complete',
    },
    complete: {
      level: 'complete',
      minScore: 80,
      maxScore: 100,
      label: 'Tightly Defined',
      description: 'Ready for PRD generation',
    },
  };

  let levelId: string;
  if (score < 20) levelId = 'concept';
  else if (score < 40) levelId = 'exploration';
  else if (score < 60) levelId = 'defined';
  else if (score < 80) levelId = 'refined';
  else levelId = 'complete';

  const baseState = createInitialMaturityState();
  return {
    ...baseState,
    score,
    level: levelMap[levelId],
    canSubmit: score >= 80,
  };
}

describe('MaturityTracker', () => {
  describe('Progress Bar', () => {
    it('displays 0% for initial state', () => {
      const maturity = createMaturityStateAtScore(0);
      render(<MaturityTracker maturity={maturity} />);

      const percentage = screen.getByTestId('maturity-percentage');
      expect(percentage).toHaveTextContent('0%');
    });

    it('displays correct percentage for 50% maturity', () => {
      const maturity = createMaturityStateAtScore(50);
      render(<MaturityTracker maturity={maturity} />);

      const percentage = screen.getByTestId('maturity-percentage');
      expect(percentage).toHaveTextContent('50%');
    });

    it('displays 100% when fully mature', () => {
      const maturity = createMaturityStateAtScore(100);
      render(<MaturityTracker maturity={maturity} />);

      const percentage = screen.getByTestId('maturity-percentage');
      expect(percentage).toHaveTextContent('100%');
    });

    it('renders progress bar with correct width style', () => {
      const maturity = createMaturityStateAtScore(65);
      render(<MaturityTracker maturity={maturity} />);

      const progressFill = screen.getByTestId('maturity-progress-fill');
      expect(progressFill).toHaveStyle({ width: '65%' });
    });
  });

  describe('Level Indicator', () => {
    it('shows "General Concept" level at score 0-19', () => {
      const maturity = createMaturityStateAtScore(15);
      render(<MaturityTracker maturity={maturity} />);

      expect(screen.getByTestId('maturity-level')).toHaveTextContent('General Concept');
    });

    it('shows "Exploration" level at score 20-39', () => {
      const maturity = createMaturityStateAtScore(25);
      render(<MaturityTracker maturity={maturity} />);

      expect(screen.getByTestId('maturity-level')).toHaveTextContent('Exploration');
    });

    it('shows "Firm Understanding" level at score 40-59', () => {
      const maturity = createMaturityStateAtScore(45);
      render(<MaturityTracker maturity={maturity} />);

      expect(screen.getByTestId('maturity-level')).toHaveTextContent('Firm Understanding');
    });

    it('shows "Refined" level at score 60-79', () => {
      const maturity = createMaturityStateAtScore(70);
      render(<MaturityTracker maturity={maturity} />);

      expect(screen.getByTestId('maturity-level')).toHaveTextContent('Refined');
    });

    it('shows "Tightly Defined" level at score 80-100', () => {
      const maturity = createMaturityStateAtScore(85);
      render(<MaturityTracker maturity={maturity} />);

      expect(screen.getByTestId('maturity-level')).toHaveTextContent('Tightly Defined');
    });

    it('displays level description', () => {
      const maturity = createMaturityStateAtScore(50);
      render(<MaturityTracker maturity={maturity} />);

      expect(screen.getByTestId('maturity-description')).toHaveTextContent('Core requirements clear');
    });
  });

  describe('Color Coding', () => {
    it('applies red color class for score below 40', () => {
      const maturity = createMaturityStateAtScore(25);
      render(<MaturityTracker maturity={maturity} />);

      const progressFill = screen.getByTestId('maturity-progress-fill');
      expect(progressFill).toHaveClass('bg-status-error');
    });

    it('applies yellow color class for score 40-79', () => {
      const maturity = createMaturityStateAtScore(55);
      render(<MaturityTracker maturity={maturity} />);

      const progressFill = screen.getByTestId('maturity-progress-fill');
      expect(progressFill).toHaveClass('bg-status-warning');
    });

    it('applies green color class for score 80+', () => {
      const maturity = createMaturityStateAtScore(85);
      render(<MaturityTracker maturity={maturity} />);

      const progressFill = screen.getByTestId('maturity-progress-fill');
      expect(progressFill).toHaveClass('bg-status-success');
    });

    it('applies green at exactly 80', () => {
      const maturity = createMaturityStateAtScore(80);
      render(<MaturityTracker maturity={maturity} />);

      const progressFill = screen.getByTestId('maturity-progress-fill');
      expect(progressFill).toHaveClass('bg-status-success');
    });

    it('applies yellow at exactly 40', () => {
      const maturity = createMaturityStateAtScore(40);
      render(<MaturityTracker maturity={maturity} />);

      const progressFill = screen.getByTestId('maturity-progress-fill');
      expect(progressFill).toHaveClass('bg-status-warning');
    });
  });

  describe('Ready to Submit Indicator', () => {
    it('does not show "Ready to Submit" below 80%', () => {
      const maturity = createMaturityStateAtScore(79);
      render(<MaturityTracker maturity={maturity} />);

      expect(screen.queryByTestId('ready-to-submit')).not.toBeInTheDocument();
    });

    it('shows "Ready to Submit" at 80%', () => {
      const maturity = createMaturityStateAtScore(80);
      render(<MaturityTracker maturity={maturity} />);

      expect(screen.getByTestId('ready-to-submit')).toBeInTheDocument();
      expect(screen.getByTestId('ready-to-submit')).toHaveTextContent('Ready to Submit');
    });

    it('shows "Ready to Submit" at 100%', () => {
      const maturity = createMaturityStateAtScore(100);
      render(<MaturityTracker maturity={maturity} />);

      expect(screen.getByTestId('ready-to-submit')).toBeInTheDocument();
    });
  });

  describe('Animation', () => {
    it('has transition class for smooth animations', () => {
      const maturity = createMaturityStateAtScore(50);
      render(<MaturityTracker maturity={maturity} />);

      const progressFill = screen.getByTestId('maturity-progress-fill');
      expect(progressFill).toHaveClass('transition-all');
    });
  });

  describe('Accessibility', () => {
    it('has accessible progress bar role', () => {
      const maturity = createMaturityStateAtScore(50);
      render(<MaturityTracker maturity={maturity} />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
    });

    it('has aria-valuenow attribute', () => {
      const maturity = createMaturityStateAtScore(65);
      render(<MaturityTracker maturity={maturity} />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '65');
    });

    it('has aria-valuemin and aria-valuemax attributes', () => {
      const maturity = createMaturityStateAtScore(50);
      render(<MaturityTracker maturity={maturity} />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    });

    it('has accessible label', () => {
      const maturity = createMaturityStateAtScore(50);
      render(<MaturityTracker maturity={maturity} />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-label', 'PRD maturity progress');
    });
  });

  describe('Custom Props', () => {
    it('accepts custom className', () => {
      const maturity = createMaturityStateAtScore(50);
      render(<MaturityTracker maturity={maturity} className="custom-class" />);

      const container = screen.getByTestId('maturity-tracker');
      expect(container).toHaveClass('custom-class');
    });

    it('renders compact variant without description', () => {
      const maturity = createMaturityStateAtScore(50);
      render(<MaturityTracker maturity={maturity} compact />);

      expect(screen.queryByTestId('maturity-description')).not.toBeInTheDocument();
    });
  });
});
