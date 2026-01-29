/**
 * Tests for SubmitPRDButton component (P05-F11 T12)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SubmitPRDButton from './SubmitPRDButton';

describe('SubmitPRDButton', () => {
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSubmit.mockResolvedValue({ success: true, gateId: 'gate-123' });
  });

  describe('Disabled State (below 80%)', () => {
    it('renders disabled button when maturity is below 80%', () => {
      render(<SubmitPRDButton maturityScore={65} onSubmit={mockOnSubmit} />);

      const button = screen.getByTestId('submit-prd-button');
      expect(button).toBeDisabled();
    });

    it('shows current maturity vs required threshold', () => {
      render(<SubmitPRDButton maturityScore={65} onSubmit={mockOnSubmit} />);

      expect(screen.getByTestId('maturity-indicator')).toHaveTextContent('65%');
      expect(screen.getByTestId('maturity-indicator')).toHaveTextContent('80%');
    });

    it('has aria-label explaining why disabled', () => {
      render(<SubmitPRDButton maturityScore={65} onSubmit={mockOnSubmit} />);

      const button = screen.getByTestId('submit-prd-button');
      // The aria-label provides accessible information about why the button is disabled
      expect(button).toHaveAttribute('aria-label', expect.stringContaining('80%'));
      expect(button).toHaveAttribute('aria-label', expect.stringContaining('Cannot submit'));
    });

    it('shows progress bar with current maturity level', () => {
      render(<SubmitPRDButton maturityScore={65} onSubmit={mockOnSubmit} />);

      const progressBar = screen.getByTestId('maturity-progress');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveStyle({ width: '65%' });
    });

    it('applies disabled styling', () => {
      render(<SubmitPRDButton maturityScore={65} onSubmit={mockOnSubmit} />);

      const button = screen.getByTestId('submit-prd-button');
      expect(button).toHaveClass('opacity-50');
      expect(button).toHaveClass('cursor-not-allowed');
    });
  });

  describe('Enabled State (80%+)', () => {
    it('renders enabled button when maturity is 80% or above', () => {
      render(<SubmitPRDButton maturityScore={85} onSubmit={mockOnSubmit} />);

      const button = screen.getByTestId('submit-prd-button');
      expect(button).toBeEnabled();
    });

    it('shows "Submit for PRD" label when enabled', () => {
      render(<SubmitPRDButton maturityScore={85} onSubmit={mockOnSubmit} />);

      expect(screen.getByText('Submit for PRD')).toBeInTheDocument();
    });

    it('renders exactly at 80% threshold', () => {
      render(<SubmitPRDButton maturityScore={80} onSubmit={mockOnSubmit} />);

      const button = screen.getByTestId('submit-prd-button');
      expect(button).toBeEnabled();
    });

    it('shows success styling when enabled', () => {
      render(<SubmitPRDButton maturityScore={85} onSubmit={mockOnSubmit} />);

      const button = screen.getByTestId('submit-prd-button');
      expect(button).toHaveClass('bg-status-success');
    });
  });

  describe('Confirmation Dialog', () => {
    it('shows confirmation dialog when enabled button is clicked', async () => {
      render(<SubmitPRDButton maturityScore={85} onSubmit={mockOnSubmit} />);

      fireEvent.click(screen.getByTestId('submit-prd-button'));

      await waitFor(() => {
        expect(screen.getByTestId('confirmation-dialog')).toBeInTheDocument();
      });
    });

    it('confirmation dialog shows submit action', async () => {
      render(<SubmitPRDButton maturityScore={85} onSubmit={mockOnSubmit} />);

      fireEvent.click(screen.getByTestId('submit-prd-button'));

      await waitFor(() => {
        expect(screen.getByText(/confirm submission/i)).toBeInTheDocument();
        expect(screen.getByTestId('confirm-submit')).toBeInTheDocument();
        expect(screen.getByTestId('cancel-submit')).toBeInTheDocument();
      });
    });

    it('calls onSubmit when confirmed', async () => {
      render(<SubmitPRDButton maturityScore={85} onSubmit={mockOnSubmit} />);

      fireEvent.click(screen.getByTestId('submit-prd-button'));

      await waitFor(() => {
        expect(screen.getByTestId('confirm-submit')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('confirm-submit'));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });
    });

    it('closes dialog when cancelled', async () => {
      render(<SubmitPRDButton maturityScore={85} onSubmit={mockOnSubmit} />);

      fireEvent.click(screen.getByTestId('submit-prd-button'));

      await waitFor(() => {
        expect(screen.getByTestId('cancel-submit')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('cancel-submit'));

      await waitFor(() => {
        expect(screen.queryByTestId('confirmation-dialog')).not.toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('shows maturity score in confirmation dialog', async () => {
      render(<SubmitPRDButton maturityScore={85} onSubmit={mockOnSubmit} />);

      fireEvent.click(screen.getByTestId('submit-prd-button'));

      await waitFor(() => {
        expect(screen.getByTestId('confirmation-dialog')).toHaveTextContent('85%');
      });
    });
  });

  describe('Loading State', () => {
    it('shows loading spinner during submission', async () => {
      mockOnSubmit.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 100)));

      render(<SubmitPRDButton maturityScore={85} onSubmit={mockOnSubmit} />);

      fireEvent.click(screen.getByTestId('submit-prd-button'));

      await waitFor(() => {
        expect(screen.getByTestId('confirm-submit')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('confirm-submit'));

      await waitFor(() => {
        expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      });
    });

    it('disables button during loading', async () => {
      mockOnSubmit.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 100)));

      render(<SubmitPRDButton maturityScore={85} onSubmit={mockOnSubmit} />);

      fireEvent.click(screen.getByTestId('submit-prd-button'));

      await waitFor(() => {
        expect(screen.getByTestId('confirm-submit')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('confirm-submit'));

      await waitFor(() => {
        expect(screen.getByTestId('confirm-submit')).toBeDisabled();
      });
    });

    it('shows "Submitting..." text during loading', async () => {
      mockOnSubmit.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 100)));

      render(<SubmitPRDButton maturityScore={85} onSubmit={mockOnSubmit} />);

      fireEvent.click(screen.getByTestId('submit-prd-button'));

      await waitFor(() => {
        fireEvent.click(screen.getByTestId('confirm-submit'));
      });

      await waitFor(() => {
        expect(screen.getByText(/submitting/i)).toBeInTheDocument();
      });
    });
  });

  describe('Success Feedback', () => {
    it('shows success message after successful submission', async () => {
      render(<SubmitPRDButton maturityScore={85} onSubmit={mockOnSubmit} />);

      fireEvent.click(screen.getByTestId('submit-prd-button'));

      await waitFor(() => {
        fireEvent.click(screen.getByTestId('confirm-submit'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('success-message')).toBeInTheDocument();
      });
    });

    it('calls onSuccess callback when provided', async () => {
      const onSuccess = vi.fn();
      render(<SubmitPRDButton maturityScore={85} onSubmit={mockOnSubmit} onSuccess={onSuccess} />);

      fireEvent.click(screen.getByTestId('submit-prd-button'));

      await waitFor(() => {
        fireEvent.click(screen.getByTestId('confirm-submit'));
      });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith({ success: true, gateId: 'gate-123' });
      });
    });
  });

  describe('Error Feedback', () => {
    it('shows error message on submission failure', async () => {
      mockOnSubmit.mockResolvedValue({ success: false, error: 'Submission failed' });

      render(<SubmitPRDButton maturityScore={85} onSubmit={mockOnSubmit} />);

      fireEvent.click(screen.getByTestId('submit-prd-button'));

      await waitFor(() => {
        fireEvent.click(screen.getByTestId('confirm-submit'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
        expect(screen.getByTestId('error-message')).toHaveTextContent('Submission failed');
      });
    });

    it('calls onError callback when provided', async () => {
      const onError = vi.fn();
      mockOnSubmit.mockResolvedValue({ success: false, error: 'Failed' });

      render(<SubmitPRDButton maturityScore={85} onSubmit={mockOnSubmit} onError={onError} />);

      fireEvent.click(screen.getByTestId('submit-prd-button'));

      await waitFor(() => {
        fireEvent.click(screen.getByTestId('confirm-submit'));
      });

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith('Failed');
      });
    });

    it('allows retry after error', async () => {
      mockOnSubmit.mockResolvedValueOnce({ success: false, error: 'Failed' })
                  .mockResolvedValueOnce({ success: true });

      render(<SubmitPRDButton maturityScore={85} onSubmit={mockOnSubmit} />);

      fireEvent.click(screen.getByTestId('submit-prd-button'));

      await waitFor(() => {
        fireEvent.click(screen.getByTestId('confirm-submit'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
      });

      // Retry
      fireEvent.click(screen.getByTestId('retry-submit'));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Accessibility', () => {
    it('has accessible button label', () => {
      render(<SubmitPRDButton maturityScore={85} onSubmit={mockOnSubmit} />);

      const button = screen.getByTestId('submit-prd-button');
      expect(button).toHaveAttribute('aria-label');
    });

    it('announces loading state to screen readers', async () => {
      mockOnSubmit.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 100)));

      render(<SubmitPRDButton maturityScore={85} onSubmit={mockOnSubmit} />);

      fireEvent.click(screen.getByTestId('submit-prd-button'));

      await waitFor(() => {
        fireEvent.click(screen.getByTestId('confirm-submit'));
      });

      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument();
      });
    });

    it('dialog has proper ARIA attributes', async () => {
      render(<SubmitPRDButton maturityScore={85} onSubmit={mockOnSubmit} />);

      fireEvent.click(screen.getByTestId('submit-prd-button'));

      await waitFor(() => {
        const dialog = screen.getByTestId('confirmation-dialog');
        expect(dialog).toHaveAttribute('role', 'dialog');
        expect(dialog).toHaveAttribute('aria-modal', 'true');
      });
    });
  });

  describe('Custom Props', () => {
    it('accepts custom className', () => {
      render(<SubmitPRDButton maturityScore={85} onSubmit={mockOnSubmit} className="my-custom-class" />);

      expect(screen.getByTestId('submit-prd-container')).toHaveClass('my-custom-class');
    });

    it('accepts custom threshold', () => {
      render(<SubmitPRDButton maturityScore={75} onSubmit={mockOnSubmit} threshold={70} />);

      const button = screen.getByTestId('submit-prd-button');
      expect(button).toBeEnabled();
    });
  });
});
