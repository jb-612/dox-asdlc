/**
 * Tests for IdeaCard component (P08-F05 T15, P08-F03 T16)
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IdeaCard } from './IdeaCard';
import type { Idea } from '../../types/ideas';
import type { ClassificationResult } from '../../types/classification';

const mockIdea: Idea = {
  id: 'idea-001',
  content: 'Add dark mode support to the application for better accessibility',
  author_id: 'user-1',
  author_name: 'Alice Chen',
  status: 'active',
  classification: 'functional',
  labels: ['feature', 'enhancement'],
  created_at: new Date(Date.now() - 86400000).toISOString(),
  updated_at: new Date(Date.now() - 86400000).toISOString(),
  word_count: 10,
};

const mockClassificationResult: ClassificationResult = {
  idea_id: 'idea-001',
  classification: 'functional',
  confidence: 0.92,
  labels: ['feature', 'enhancement'],
  reasoning: 'This idea describes a user-facing feature improvement.',
  model_version: '1.0.0',
};

describe('IdeaCard', () => {
  describe('Basic Rendering', () => {
    it('renders with data-testid', () => {
      render(<IdeaCard idea={mockIdea} />);
      expect(screen.getByTestId('idea-card-idea-001')).toBeInTheDocument();
    });

    it('renders idea content', () => {
      render(<IdeaCard idea={mockIdea} />);
      expect(
        screen.getByText('Add dark mode support to the application for better accessibility')
      ).toBeInTheDocument();
    });

    it('renders author name', () => {
      render(<IdeaCard idea={mockIdea} />);
      expect(screen.getByText('Alice Chen')).toBeInTheDocument();
    });

    it('renders word count', () => {
      render(<IdeaCard idea={mockIdea} />);
      expect(screen.getByText('10 words')).toBeInTheDocument();
    });

    it('renders relative timestamp', () => {
      render(<IdeaCard idea={mockIdea} />);
      expect(screen.getByText(/ago/)).toBeInTheDocument();
    });
  });

  describe('Selection State', () => {
    it('applies selected styles when isSelected is true', () => {
      render(<IdeaCard idea={mockIdea} isSelected />);
      const card = screen.getByTestId('idea-card-idea-001');
      expect(card).toHaveClass('border-blue-500');
    });

    it('applies unselected styles when isSelected is false', () => {
      render(<IdeaCard idea={mockIdea} isSelected={false} />);
      const card = screen.getByTestId('idea-card-idea-001');
      expect(card).toHaveClass('border-border-primary');
    });

    it('has aria-selected attribute', () => {
      render(<IdeaCard idea={mockIdea} isSelected />);
      expect(screen.getByTestId('idea-card-idea-001')).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Click Handling', () => {
    it('calls onClick when clicked', () => {
      const handleClick = vi.fn();
      render(<IdeaCard idea={mockIdea} onClick={handleClick} />);

      fireEvent.click(screen.getByTestId('idea-card-idea-001'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('is keyboard accessible', () => {
      const handleClick = vi.fn();
      render(<IdeaCard idea={mockIdea} onClick={handleClick} />);

      const card = screen.getByTestId('idea-card-idea-001');
      fireEvent.keyDown(card, { key: 'Enter' });
      expect(handleClick).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(card, { key: ' ' });
      expect(handleClick).toHaveBeenCalledTimes(2);
    });

    it('has role="button"', () => {
      render(<IdeaCard idea={mockIdea} />);
      expect(screen.getByTestId('idea-card-idea-001')).toHaveAttribute('role', 'button');
    });

    it('has tabIndex for keyboard focus', () => {
      render(<IdeaCard idea={mockIdea} />);
      expect(screen.getByTestId('idea-card-idea-001')).toHaveAttribute('tabIndex', '0');
    });
  });

  describe('Classification Badge', () => {
    it('renders ClassificationBadge component', () => {
      render(<IdeaCard idea={mockIdea} />);
      expect(screen.getByTestId('classification-badge')).toBeInTheDocument();
    });

    it('shows classification from idea by default', () => {
      render(<IdeaCard idea={mockIdea} />);
      expect(screen.getByText('Functional')).toBeInTheDocument();
    });

    it('uses classificationResult when provided', () => {
      const result: ClassificationResult = {
        ...mockClassificationResult,
        classification: 'non_functional',
      };
      render(<IdeaCard idea={mockIdea} classificationResult={result} />);
      expect(screen.getByText('Non-Functional')).toBeInTheDocument();
    });

    it('shows confidence when classificationResult provided', () => {
      render(<IdeaCard idea={mockIdea} classificationResult={mockClassificationResult} />);
      expect(screen.getByText('(92%)')).toBeInTheDocument();
    });

    it('shows processing state when isClassifying is true', () => {
      render(<IdeaCard idea={mockIdea} isClassifying />);
      expect(screen.getByTestId('classification-badge-processing')).toBeInTheDocument();
      expect(screen.getByText('Processing...')).toBeInTheDocument();
    });
  });

  describe('Labels Display', () => {
    it('renders labels', () => {
      render(<IdeaCard idea={mockIdea} />);
      expect(screen.getByTestId('labels-idea-001')).toBeInTheDocument();
    });

    it('shows up to 4 labels', () => {
      const ideaWithManyLabels: Idea = {
        ...mockIdea,
        labels: ['feature', 'enhancement', 'bug', 'performance', 'security', 'docs'],
      };
      render(<IdeaCard idea={ideaWithManyLabels} />);

      expect(screen.getByText('Feature')).toBeInTheDocument();
      expect(screen.getByText('Enhancement')).toBeInTheDocument();
      expect(screen.getByText('+2 more')).toBeInTheDocument();
    });

    it('does not render labels container when no labels', () => {
      const ideaNoLabels: Idea = { ...mockIdea, labels: [] };
      render(<IdeaCard idea={ideaNoLabels} />);
      expect(screen.queryByTestId('labels-idea-001')).not.toBeInTheDocument();
    });
  });

  describe('Re-classify Button', () => {
    it('renders re-classify button when onReclassify provided', () => {
      const handleReclassify = vi.fn();
      render(<IdeaCard idea={mockIdea} onReclassify={handleReclassify} />);
      expect(screen.getByTestId('reclassify-idea-001')).toBeInTheDocument();
    });

    it('hides re-classify button when showReclassifyButton is false', () => {
      const handleReclassify = vi.fn();
      render(
        <IdeaCard
          idea={mockIdea}
          onReclassify={handleReclassify}
          showReclassifyButton={false}
        />
      );
      expect(screen.queryByTestId('reclassify-idea-001')).not.toBeInTheDocument();
    });

    it('hides re-classify button when isClassifying', () => {
      const handleReclassify = vi.fn();
      render(<IdeaCard idea={mockIdea} onReclassify={handleReclassify} isClassifying />);
      expect(screen.queryByTestId('reclassify-idea-001')).not.toBeInTheDocument();
    });

    it('calls onReclassify with idea ID when clicked', () => {
      const handleReclassify = vi.fn();
      render(<IdeaCard idea={mockIdea} onReclassify={handleReclassify} />);

      fireEvent.click(screen.getByTestId('reclassify-idea-001'));
      expect(handleReclassify).toHaveBeenCalledWith('idea-001');
    });

    it('does not trigger card onClick when re-classify clicked', () => {
      const handleClick = vi.fn();
      const handleReclassify = vi.fn();
      render(
        <IdeaCard idea={mockIdea} onClick={handleClick} onReclassify={handleReclassify} />
      );

      fireEvent.click(screen.getByTestId('reclassify-idea-001'));
      expect(handleReclassify).toHaveBeenCalled();
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('has aria-label for accessibility', () => {
      const handleReclassify = vi.fn();
      render(<IdeaCard idea={mockIdea} onReclassify={handleReclassify} />);
      expect(screen.getByTestId('reclassify-idea-001')).toHaveAttribute(
        'aria-label',
        'Re-classify idea'
      );
    });
  });

  describe('Different Classifications', () => {
    it('renders functional classification', () => {
      render(<IdeaCard idea={{ ...mockIdea, classification: 'functional' }} />);
      expect(screen.getByText('Functional')).toBeInTheDocument();
    });

    it('renders non_functional classification', () => {
      render(<IdeaCard idea={{ ...mockIdea, classification: 'non_functional' }} />);
      expect(screen.getByText('Non-Functional')).toBeInTheDocument();
    });

    it('renders undetermined classification', () => {
      render(<IdeaCard idea={{ ...mockIdea, classification: 'undetermined' }} />);
      expect(screen.getByText('Undetermined')).toBeInTheDocument();
    });
  });
});
