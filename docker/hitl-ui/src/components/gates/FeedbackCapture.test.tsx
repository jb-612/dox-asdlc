/**
 * Tests for FeedbackCapture component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import FeedbackCapture, { type FeedbackData } from './FeedbackCapture';

describe('FeedbackCapture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<FeedbackCapture />);
      expect(screen.getByTestId('feedback-capture')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<FeedbackCapture className="my-custom-class" />);
      expect(screen.getByTestId('feedback-capture')).toHaveClass('my-custom-class');
    });

    it('displays form title', () => {
      render(<FeedbackCapture />);
      // Check for exact heading text without the button
      expect(screen.getByText('Category Tags')).toBeInTheDocument();
    });
  });

  describe('Tag Selection', () => {
    it('renders all tag options', () => {
      render(<FeedbackCapture />);
      expect(screen.getByTestId('tag-quality')).toBeInTheDocument();
      expect(screen.getByTestId('tag-completeness')).toBeInTheDocument();
      expect(screen.getByTestId('tag-scope')).toBeInTheDocument();
      expect(screen.getByTestId('tag-style')).toBeInTheDocument();
      expect(screen.getByTestId('tag-other')).toBeInTheDocument();
    });

    it('allows selecting multiple tags', () => {
      render(<FeedbackCapture />);

      fireEvent.click(screen.getByTestId('tag-quality'));
      fireEvent.click(screen.getByTestId('tag-completeness'));

      expect(screen.getByTestId('tag-quality')).toHaveClass('bg-accent-blue');
      expect(screen.getByTestId('tag-completeness')).toHaveClass('bg-accent-blue');
    });

    it('allows deselecting tags', () => {
      render(<FeedbackCapture />);

      fireEvent.click(screen.getByTestId('tag-quality'));
      expect(screen.getByTestId('tag-quality')).toHaveClass('bg-accent-blue');

      fireEvent.click(screen.getByTestId('tag-quality'));
      expect(screen.getByTestId('tag-quality')).not.toHaveClass('bg-accent-blue');
    });
  });

  describe('Correction Summary', () => {
    it('renders correction summary textarea', () => {
      render(<FeedbackCapture />);
      expect(screen.getByTestId('correction-summary')).toBeInTheDocument();
    });

    it('allows typing in correction summary', () => {
      render(<FeedbackCapture />);
      const textarea = screen.getByTestId('correction-summary');

      fireEvent.change(textarea, { target: { value: 'Missing acceptance criteria' } });

      expect(textarea).toHaveValue('Missing acceptance criteria');
    });

    it('shows character count', () => {
      render(<FeedbackCapture />);
      const textarea = screen.getByTestId('correction-summary');

      fireEvent.change(textarea, { target: { value: 'Test text' } });

      expect(screen.getByTestId('char-count')).toHaveTextContent('9');
    });

    it('shows max character limit', () => {
      render(<FeedbackCapture />);
      expect(screen.getByTestId('char-limit')).toBeInTheDocument();
    });
  });

  describe('Severity Selector', () => {
    it('renders severity selector', () => {
      render(<FeedbackCapture />);
      expect(screen.getByTestId('severity-selector')).toBeInTheDocument();
    });

    it('shows all severity options', () => {
      render(<FeedbackCapture />);
      expect(screen.getByTestId('severity-low')).toBeInTheDocument();
      expect(screen.getByTestId('severity-medium')).toBeInTheDocument();
      expect(screen.getByTestId('severity-high')).toBeInTheDocument();
    });

    it('defaults to medium severity', () => {
      render(<FeedbackCapture />);
      expect(screen.getByTestId('severity-medium')).toHaveClass('bg-status-warning');
    });

    it('allows changing severity', () => {
      render(<FeedbackCapture />);

      fireEvent.click(screen.getByTestId('severity-high'));

      expect(screen.getByTestId('severity-high')).toHaveClass('bg-status-error');
      expect(screen.getByTestId('severity-medium')).not.toHaveClass('bg-status-warning');
    });
  });

  describe('Consider for Improvement Checkbox', () => {
    it('renders checkbox', () => {
      render(<FeedbackCapture />);
      expect(screen.getByTestId('consider-improvement')).toBeInTheDocument();
    });

    it('shows checkbox label', () => {
      render(<FeedbackCapture />);
      expect(screen.getByText(/consider for system improvement/i)).toBeInTheDocument();
    });

    it('allows toggling checkbox', () => {
      render(<FeedbackCapture />);
      const checkbox = screen.getByTestId('consider-improvement');

      fireEvent.click(checkbox);
      expect(checkbox).toBeChecked();

      fireEvent.click(checkbox);
      expect(checkbox).not.toBeChecked();
    });
  });

  describe('Review Duration Tracking', () => {
    it('displays review duration', () => {
      render(<FeedbackCapture />);
      expect(screen.getByTestId('review-duration')).toBeInTheDocument();
    });

    it('shows elapsed time format', () => {
      render(<FeedbackCapture />);
      const duration = screen.getByTestId('review-duration');
      // Should show time format like "0:00" or "00:00"
      expect(duration.textContent).toMatch(/\d+:\d{2}/);
    });
  });

  describe('Form Submission', () => {
    it('calls onSubmit with feedback data', () => {
      const onSubmit = vi.fn();
      render(<FeedbackCapture onSubmit={onSubmit} />);

      // Fill form
      fireEvent.click(screen.getByTestId('tag-quality'));
      fireEvent.change(screen.getByTestId('correction-summary'), {
        target: { value: 'Test feedback' },
      });
      fireEvent.click(screen.getByTestId('severity-high'));
      fireEvent.click(screen.getByTestId('consider-improvement'));

      // Submit
      fireEvent.click(screen.getByTestId('submit-feedback'));

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: ['quality'],
          summary: 'Test feedback',
          severity: 'high',
          considerForImprovement: true,
        })
      );
    });

    it('includes review duration in submission', () => {
      const onSubmit = vi.fn();
      render(<FeedbackCapture onSubmit={onSubmit} />);

      fireEvent.change(screen.getByTestId('correction-summary'), {
        target: { value: 'Test' },
      });
      fireEvent.click(screen.getByTestId('submit-feedback'));

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          durationSeconds: expect.any(Number),
        })
      );
    });

    it('shows submit button', () => {
      render(<FeedbackCapture />);
      expect(screen.getByTestId('submit-feedback')).toBeInTheDocument();
    });

    it('disables submit when summary is empty', () => {
      render(<FeedbackCapture />);
      expect(screen.getByTestId('submit-feedback')).toBeDisabled();
    });

    it('enables submit when summary has content', () => {
      render(<FeedbackCapture />);

      fireEvent.change(screen.getByTestId('correction-summary'), {
        target: { value: 'Test feedback' },
      });

      expect(screen.getByTestId('submit-feedback')).toBeEnabled();
    });
  });

  describe('Optional Mode', () => {
    it('can render in optional mode', () => {
      render(<FeedbackCapture optional />);
      expect(screen.getByText(/optional/i)).toBeInTheDocument();
    });

    it('shows skip button in optional mode', () => {
      render(<FeedbackCapture optional />);
      expect(screen.getByTestId('skip-feedback')).toBeInTheDocument();
    });

    it('calls onSkip when skip button clicked', () => {
      const onSkip = vi.fn();
      render(<FeedbackCapture optional onSkip={onSkip} />);

      fireEvent.click(screen.getByTestId('skip-feedback'));

      expect(onSkip).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('tags are keyboard accessible', () => {
      render(<FeedbackCapture />);
      const tag = screen.getByTestId('tag-quality');

      fireEvent.keyDown(tag, { key: 'Enter' });

      expect(tag).toHaveClass('bg-accent-blue');
    });

    it('severity options are keyboard accessible', () => {
      render(<FeedbackCapture />);
      const option = screen.getByTestId('severity-high');

      fireEvent.keyDown(option, { key: 'Enter' });

      expect(option).toHaveClass('bg-status-error');
    });

    it('textarea has accessible label', () => {
      render(<FeedbackCapture />);
      const textarea = screen.getByTestId('correction-summary');
      expect(textarea).toHaveAttribute('aria-label');
    });
  });
});
