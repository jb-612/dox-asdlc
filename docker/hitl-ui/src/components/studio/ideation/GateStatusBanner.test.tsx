/**
 * Tests for GateStatusBanner component (P05-F11 T16)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GateStatusBanner from './GateStatusBanner';
import type { GateStatus } from '../../../api/types';

// Mock timer functions
vi.useFakeTimers();

// Wrapper with router for Link component
const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <MemoryRouter>
      {component}
    </MemoryRouter>
  );
};

describe('GateStatusBanner', () => {
  const mockOnStatusChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Hidden State', () => {
    it('renders nothing when no gateId provided', () => {
      const { container } = renderWithRouter(
        <GateStatusBanner gateId={null} status="pending" />
      );

      expect(container.firstChild).toBeNull();
    });

    it('renders nothing when gateId is undefined', () => {
      const { container } = renderWithRouter(
        <GateStatusBanner gateId={undefined} status="pending" />
      );

      expect(container.firstChild).toBeNull();
    });

    it('renders nothing when gateId is empty string', () => {
      const { container } = renderWithRouter(
        <GateStatusBanner gateId="" status="pending" />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('Visible State', () => {
    it('renders banner when gateId is provided', () => {
      renderWithRouter(
        <GateStatusBanner gateId="gate-123" status="pending" />
      );

      expect(screen.getByTestId('gate-status-banner')).toBeInTheDocument();
    });

    it('shows gate ID', () => {
      renderWithRouter(
        <GateStatusBanner gateId="gate-123" status="pending" />
      );

      expect(screen.getByTestId('gate-id')).toHaveTextContent('gate-123');
    });
  });

  describe('Status Badge', () => {
    it('renders status badge', () => {
      renderWithRouter(
        <GateStatusBanner gateId="gate-123" status="pending" />
      );

      expect(screen.getByTestId('status-badge')).toBeInTheDocument();
    });

    it('shows pending status', () => {
      renderWithRouter(
        <GateStatusBanner gateId="gate-123" status="pending" />
      );

      expect(screen.getByTestId('status-badge')).toHaveTextContent(/pending/i);
    });

    it('shows approved status', () => {
      renderWithRouter(
        <GateStatusBanner gateId="gate-123" status="approved" />
      );

      expect(screen.getByTestId('status-badge')).toHaveTextContent(/approved/i);
    });

    it('shows rejected status', () => {
      renderWithRouter(
        <GateStatusBanner gateId="gate-123" status="rejected" />
      );

      expect(screen.getByTestId('status-badge')).toHaveTextContent(/rejected/i);
    });

    it('pending status has warning color', () => {
      renderWithRouter(
        <GateStatusBanner gateId="gate-123" status="pending" />
      );

      expect(screen.getByTestId('status-badge')).toHaveClass('bg-status-warning');
    });

    it('approved status has success color', () => {
      renderWithRouter(
        <GateStatusBanner gateId="gate-123" status="approved" />
      );

      expect(screen.getByTestId('status-badge')).toHaveClass('bg-status-success');
    });

    it('rejected status has error color', () => {
      renderWithRouter(
        <GateStatusBanner gateId="gate-123" status="rejected" />
      );

      expect(screen.getByTestId('status-badge')).toHaveClass('bg-status-error');
    });
  });

  describe('Link to Gate Detail', () => {
    it('renders link to gate detail page', () => {
      renderWithRouter(
        <GateStatusBanner gateId="gate-123" status="pending" />
      );

      expect(screen.getByTestId('gate-link')).toBeInTheDocument();
    });

    it('link points to correct URL', () => {
      renderWithRouter(
        <GateStatusBanner gateId="gate-123" status="pending" />
      );

      expect(screen.getByTestId('gate-link')).toHaveAttribute('href', '/gates/gate-123');
    });

    it('link has accessible text', () => {
      renderWithRouter(
        <GateStatusBanner gateId="gate-123" status="pending" />
      );

      expect(screen.getByTestId('gate-link')).toHaveTextContent(/view/i);
    });
  });

  describe('Auto-Refresh', () => {
    it('calls onRefresh after interval', async () => {
      const onRefresh = vi.fn().mockResolvedValue('pending');

      renderWithRouter(
        <GateStatusBanner
          gateId="gate-123"
          status="pending"
          onRefresh={onRefresh}
          refreshInterval={30000}
        />
      );

      // Fast-forward 30 seconds
      await act(async () => {
        vi.advanceTimersByTime(30000);
      });

      expect(onRefresh).toHaveBeenCalled();
    });

    it('does not auto-refresh when status is approved', async () => {
      const onRefresh = vi.fn().mockResolvedValue('approved');

      renderWithRouter(
        <GateStatusBanner
          gateId="gate-123"
          status="approved"
          onRefresh={onRefresh}
          refreshInterval={30000}
        />
      );

      await act(async () => {
        vi.advanceTimersByTime(60000);
      });

      expect(onRefresh).not.toHaveBeenCalled();
    });

    it('does not auto-refresh when status is rejected', async () => {
      const onRefresh = vi.fn().mockResolvedValue('rejected');

      renderWithRouter(
        <GateStatusBanner
          gateId="gate-123"
          status="rejected"
          onRefresh={onRefresh}
          refreshInterval={30000}
        />
      );

      await act(async () => {
        vi.advanceTimersByTime(60000);
      });

      expect(onRefresh).not.toHaveBeenCalled();
    });

    it('calls onStatusChange when status changes', async () => {
      const onStatusChange = vi.fn();
      // Use a synchronous mock that still allows state updates
      const onRefresh = vi.fn().mockImplementation(() => Promise.resolve('approved'));

      renderWithRouter(
        <GateStatusBanner
          gateId="gate-123"
          status="pending"
          onRefresh={onRefresh}
          onStatusChange={onStatusChange}
          refreshInterval={30000}
        />
      );

      // Advance timer to trigger interval
      await act(async () => {
        vi.advanceTimersByTime(30000);
        // Allow microtask queue to process
        await Promise.resolve();
      });

      // onRefresh should have been called
      expect(onRefresh).toHaveBeenCalled();
      // And onStatusChange should be called with new status
      expect(onStatusChange).toHaveBeenCalledWith('approved');
    });

    it('shows refresh indicator when refreshing', async () => {
      const onRefresh = vi.fn().mockImplementation(() =>
        new Promise((resolve) => setTimeout(() => resolve('pending'), 100))
      );

      renderWithRouter(
        <GateStatusBanner
          gateId="gate-123"
          status="pending"
          onRefresh={onRefresh}
          refreshInterval={30000}
        />
      );

      await act(async () => {
        vi.advanceTimersByTime(30000);
      });

      expect(screen.getByTestId('refresh-indicator')).toBeInTheDocument();
    });

    it('clears interval on unmount', async () => {
      const onRefresh = vi.fn().mockResolvedValue('pending');

      const { unmount } = renderWithRouter(
        <GateStatusBanner
          gateId="gate-123"
          status="pending"
          onRefresh={onRefresh}
          refreshInterval={30000}
        />
      );

      unmount();

      await act(async () => {
        vi.advanceTimersByTime(60000);
      });

      expect(onRefresh).not.toHaveBeenCalled();
    });
  });

  describe('Manual Refresh', () => {
    it('renders manual refresh button when onRefresh provided', () => {
      const onRefresh = vi.fn().mockResolvedValue('pending');

      renderWithRouter(
        <GateStatusBanner gateId="gate-123" status="pending" onRefresh={onRefresh} />
      );

      expect(screen.getByTestId('manual-refresh')).toBeInTheDocument();
    });

    it('does not render manual refresh button when onRefresh not provided', () => {
      renderWithRouter(
        <GateStatusBanner gateId="gate-123" status="pending" />
      );

      expect(screen.queryByTestId('manual-refresh')).not.toBeInTheDocument();
    });

    it('calls onRefresh when manual refresh clicked', async () => {
      vi.useRealTimers(); // Use real timers for this test
      const onRefresh = vi.fn().mockResolvedValue('pending');

      renderWithRouter(
        <GateStatusBanner
          gateId="gate-123"
          status="pending"
          onRefresh={onRefresh}
        />
      );

      fireEvent.click(screen.getByTestId('manual-refresh'));

      await waitFor(() => {
        expect(onRefresh).toHaveBeenCalled();
      });
      vi.useFakeTimers(); // Restore fake timers
    });

    it('disables manual refresh button when refreshing', async () => {
      vi.useRealTimers(); // Use real timers for this test
      const onRefresh = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve('pending'), 50))
      );

      renderWithRouter(
        <GateStatusBanner
          gateId="gate-123"
          status="pending"
          onRefresh={onRefresh}
        />
      );

      fireEvent.click(screen.getByTestId('manual-refresh'));

      // Button should be disabled immediately during refresh
      expect(screen.getByTestId('manual-refresh')).toBeDisabled();
      vi.useFakeTimers(); // Restore fake timers
    });
  });

  describe('Status Messages', () => {
    it('shows pending message', () => {
      renderWithRouter(
        <GateStatusBanner gateId="gate-123" status="pending" />
      );

      expect(screen.getByTestId('status-message')).toHaveTextContent(/waiting for review/i);
    });

    it('shows approved message', () => {
      renderWithRouter(
        <GateStatusBanner gateId="gate-123" status="approved" />
      );

      expect(screen.getByTestId('status-message')).toHaveTextContent(/approved/i);
    });

    it('shows rejected message', () => {
      renderWithRouter(
        <GateStatusBanner gateId="gate-123" status="rejected" />
      );

      expect(screen.getByTestId('status-message')).toHaveTextContent(/rejected/i);
    });
  });

  describe('Banner Styling', () => {
    it('pending banner has warning border', () => {
      renderWithRouter(
        <GateStatusBanner gateId="gate-123" status="pending" />
      );

      expect(screen.getByTestId('gate-status-banner')).toHaveClass('border-status-warning');
    });

    it('approved banner has success border', () => {
      renderWithRouter(
        <GateStatusBanner gateId="gate-123" status="approved" />
      );

      expect(screen.getByTestId('gate-status-banner')).toHaveClass('border-status-success');
    });

    it('rejected banner has error border', () => {
      renderWithRouter(
        <GateStatusBanner gateId="gate-123" status="rejected" />
      );

      expect(screen.getByTestId('gate-status-banner')).toHaveClass('border-status-error');
    });
  });

  describe('Custom Props', () => {
    it('accepts custom className', () => {
      renderWithRouter(
        <GateStatusBanner gateId="gate-123" status="pending" className="my-custom-class" />
      );

      expect(screen.getByTestId('gate-status-banner')).toHaveClass('my-custom-class');
    });

    it('accepts custom refresh interval', async () => {
      const onRefresh = vi.fn().mockResolvedValue('pending');

      renderWithRouter(
        <GateStatusBanner
          gateId="gate-123"
          status="pending"
          onRefresh={onRefresh}
          refreshInterval={10000}
        />
      );

      await act(async () => {
        vi.advanceTimersByTime(10000);
      });

      expect(onRefresh).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has accessible banner role', () => {
      renderWithRouter(
        <GateStatusBanner gateId="gate-123" status="pending" />
      );

      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('refresh button has accessible label', () => {
      const onRefresh = vi.fn().mockResolvedValue('pending');

      renderWithRouter(
        <GateStatusBanner gateId="gate-123" status="pending" onRefresh={onRefresh} />
      );

      expect(screen.getByTestId('manual-refresh')).toHaveAttribute('aria-label');
    });

    it('announces status changes', async () => {
      const onRefresh = vi.fn().mockResolvedValue('approved');

      const { rerender } = renderWithRouter(
        <GateStatusBanner
          gateId="gate-123"
          status="pending"
          onRefresh={onRefresh}
        />
      );

      // Simulate status change
      rerender(
        <MemoryRouter>
          <GateStatusBanner
            gateId="gate-123"
            status="approved"
            onRefresh={onRefresh}
          />
        </MemoryRouter>
      );

      expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    });
  });
});
