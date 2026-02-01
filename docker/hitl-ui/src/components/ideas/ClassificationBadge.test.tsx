/**
 * Tests for ClassificationBadge component (P08-F03 T13)
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ClassificationBadge } from './ClassificationBadge';

describe('ClassificationBadge', () => {
  describe('Rendering', () => {
    it('renders with functional classification', () => {
      render(<ClassificationBadge classification="functional" />);
      expect(screen.getByTestId('classification-badge')).toBeInTheDocument();
      expect(screen.getByText('Functional')).toBeInTheDocument();
    });

    it('renders with non_functional classification', () => {
      render(<ClassificationBadge classification="non_functional" />);
      expect(screen.getByText('Non-Functional')).toBeInTheDocument();
    });

    it('renders with undetermined classification', () => {
      render(<ClassificationBadge classification="undetermined" />);
      expect(screen.getByText('Undetermined')).toBeInTheDocument();
    });
  });

  describe('Confidence Display', () => {
    it('shows confidence percentage when provided', () => {
      render(<ClassificationBadge classification="functional" confidence={0.85} />);
      expect(screen.getByText('(85%)')).toBeInTheDocument();
    });

    it('rounds confidence to nearest whole number', () => {
      render(<ClassificationBadge classification="functional" confidence={0.867} />);
      expect(screen.getByText('(87%)')).toBeInTheDocument();
    });

    it('hides confidence when showConfidence is false', () => {
      render(
        <ClassificationBadge
          classification="functional"
          confidence={0.85}
          showConfidence={false}
        />
      );
      expect(screen.queryByText('(85%)')).not.toBeInTheDocument();
    });

    it('does not show confidence when not provided', () => {
      render(<ClassificationBadge classification="functional" />);
      expect(screen.queryByText(/\(\d+%\)/)).not.toBeInTheDocument();
    });
  });

  describe('Processing State', () => {
    it('shows processing state when isProcessing is true', () => {
      render(<ClassificationBadge classification="functional" isProcessing />);
      expect(screen.getByTestId('classification-badge-processing')).toBeInTheDocument();
      expect(screen.getByText('Processing...')).toBeInTheDocument();
    });

    it('has aria-label for processing state', () => {
      render(<ClassificationBadge classification="functional" isProcessing />);
      expect(screen.getByTestId('classification-badge-processing')).toHaveAttribute(
        'aria-label',
        'Classification in progress'
      );
    });

    it('does not show classification text when processing', () => {
      render(<ClassificationBadge classification="functional" isProcessing />);
      expect(screen.queryByText('Functional')).not.toBeInTheDocument();
    });
  });

  describe('Tooltip', () => {
    it('shows tooltip on hover when reasoning is provided', () => {
      render(
        <ClassificationBadge
          classification="functional"
          reasoning="This idea describes a user-facing feature"
        />
      );

      fireEvent.mouseEnter(screen.getByTestId('classification-badge').parentElement!);

      expect(screen.getByTestId('classification-tooltip')).toBeInTheDocument();
      expect(screen.getByText('Classification Reasoning')).toBeInTheDocument();
      expect(screen.getByText('This idea describes a user-facing feature')).toBeInTheDocument();
    });

    it('hides tooltip on mouse leave', () => {
      render(
        <ClassificationBadge
          classification="functional"
          reasoning="Test reasoning"
        />
      );

      const wrapper = screen.getByTestId('classification-badge').parentElement!;
      fireEvent.mouseEnter(wrapper);
      expect(screen.getByTestId('classification-tooltip')).toBeInTheDocument();

      fireEvent.mouseLeave(wrapper);
      expect(screen.queryByTestId('classification-tooltip')).not.toBeInTheDocument();
    });

    it('does not show tooltip when no reasoning provided', () => {
      render(<ClassificationBadge classification="functional" />);

      fireEvent.mouseEnter(screen.getByTestId('classification-badge').parentElement!);
      expect(screen.queryByTestId('classification-tooltip')).not.toBeInTheDocument();
    });
  });

  describe('Click Handler', () => {
    it('calls onClick when clicked', () => {
      const handleClick = vi.fn();
      render(<ClassificationBadge classification="functional" onClick={handleClick} />);

      fireEvent.click(screen.getByTestId('classification-badge'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('has role="button" when onClick is provided', () => {
      render(<ClassificationBadge classification="functional" onClick={() => {}} />);
      expect(screen.getByTestId('classification-badge')).toHaveAttribute('role', 'button');
    });

    it('is keyboard accessible when onClick is provided', () => {
      const handleClick = vi.fn();
      render(<ClassificationBadge classification="functional" onClick={handleClick} />);

      const badge = screen.getByTestId('classification-badge');
      fireEvent.keyDown(badge, { key: 'Enter' });
      expect(handleClick).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(badge, { key: ' ' });
      expect(handleClick).toHaveBeenCalledTimes(2);
    });

    it('does not have role="button" when onClick is not provided', () => {
      render(<ClassificationBadge classification="functional" />);
      expect(screen.getByTestId('classification-badge')).not.toHaveAttribute('role');
    });
  });

  describe('Styling', () => {
    it('applies correct classes for functional classification', () => {
      render(<ClassificationBadge classification="functional" />);
      const badge = screen.getByTestId('classification-badge');
      expect(badge).toHaveClass('bg-emerald-100');
      expect(badge).toHaveClass('text-emerald-800');
    });

    it('applies correct classes for non_functional classification', () => {
      render(<ClassificationBadge classification="non_functional" />);
      const badge = screen.getByTestId('classification-badge');
      expect(badge).toHaveClass('bg-purple-100');
      expect(badge).toHaveClass('text-purple-800');
    });

    it('applies correct classes for undetermined classification', () => {
      render(<ClassificationBadge classification="undetermined" />);
      const badge = screen.getByTestId('classification-badge');
      expect(badge).toHaveClass('bg-gray-100');
      expect(badge).toHaveClass('text-gray-700');
    });

    it('applies custom className', () => {
      render(<ClassificationBadge classification="functional" className="custom-class" />);
      expect(screen.getByTestId('classification-badge').parentElement).toHaveClass('custom-class');
    });

    it('applies size classes correctly', () => {
      const { rerender } = render(<ClassificationBadge classification="functional" size="sm" />);
      expect(screen.getByTestId('classification-badge')).toHaveClass('text-xs');

      rerender(<ClassificationBadge classification="functional" size="md" />);
      expect(screen.getByTestId('classification-badge')).toHaveClass('text-sm');

      rerender(<ClassificationBadge classification="functional" size="lg" />);
      expect(screen.getByTestId('classification-badge')).toHaveClass('text-base');
    });
  });

  describe('Accessibility', () => {
    it('has appropriate aria-label', () => {
      render(<ClassificationBadge classification="functional" confidence={0.9} />);
      expect(screen.getByTestId('classification-badge')).toHaveAttribute(
        'aria-label',
        'Classification: Functional, 90% confidence'
      );
    });

    it('has aria-label without confidence when not provided', () => {
      render(<ClassificationBadge classification="functional" />);
      expect(screen.getByTestId('classification-badge')).toHaveAttribute(
        'aria-label',
        'Classification: Functional'
      );
    });

    it('tooltip has role="tooltip"', () => {
      render(
        <ClassificationBadge
          classification="functional"
          reasoning="Test reasoning"
        />
      );

      fireEvent.mouseEnter(screen.getByTestId('classification-badge').parentElement!);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it('is focusable when onClick is provided', () => {
      render(<ClassificationBadge classification="functional" onClick={() => {}} />);
      const badge = screen.getByTestId('classification-badge');
      expect(badge).toHaveAttribute('tabIndex', '0');
    });
  });
});
