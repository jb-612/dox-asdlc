/**
 * Tests for DevOpsNotificationBanner component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import DevOpsNotificationBanner from './DevOpsNotificationBanner';
import type { DevOpsActivity } from '../../api/types/devops';

describe('DevOpsNotificationBanner', () => {
  // Use fake timers for auto-hide testing
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mockInProgressActivity: DevOpsActivity = {
    id: 'activity-1',
    operation: 'Deploy workers chart v2.1.0',
    status: 'in_progress',
    startedAt: '2026-01-27T10:00:00Z',
    steps: [
      { name: 'Pull images', status: 'completed', startedAt: '2026-01-27T10:00:00Z', completedAt: '2026-01-27T10:01:00Z' },
      { name: 'Apply manifests', status: 'running', startedAt: '2026-01-27T10:01:00Z' },
      { name: 'Wait for rollout', status: 'pending' },
    ],
  };

  const mockCompletedActivity: DevOpsActivity = {
    id: 'activity-2',
    operation: 'Deploy hitl-ui chart v1.5.0',
    status: 'completed',
    startedAt: '2026-01-27T09:00:00Z',
    completedAt: '2026-01-27T09:05:00Z',
    steps: [
      { name: 'Pull images', status: 'completed', startedAt: '2026-01-27T09:00:00Z', completedAt: '2026-01-27T09:02:00Z' },
      { name: 'Apply manifests', status: 'completed', startedAt: '2026-01-27T09:02:00Z', completedAt: '2026-01-27T09:04:00Z' },
    ],
  };

  const mockFailedActivity: DevOpsActivity = {
    id: 'activity-3',
    operation: 'Deploy redis chart v3.0.0',
    status: 'failed',
    startedAt: '2026-01-27T08:00:00Z',
    completedAt: '2026-01-27T08:02:00Z',
    steps: [
      { name: 'Pull images', status: 'completed', startedAt: '2026-01-27T08:00:00Z', completedAt: '2026-01-27T08:01:00Z' },
      { name: 'Apply manifests', status: 'failed', startedAt: '2026-01-27T08:01:00Z', completedAt: '2026-01-27T08:02:00Z', error: 'Invalid config' },
    ],
  };

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<DevOpsNotificationBanner activity={mockInProgressActivity} />);
      expect(screen.getByTestId('devops-notification-banner')).toBeInTheDocument();
    });

    it('displays operation name', () => {
      render(<DevOpsNotificationBanner activity={mockInProgressActivity} />);
      expect(screen.getByText('Deploy workers chart v2.1.0')).toBeInTheDocument();
    });

    it('displays current step for in-progress activity', () => {
      render(<DevOpsNotificationBanner activity={mockInProgressActivity} />);
      expect(screen.getByText(/Apply manifests/)).toBeInTheDocument();
    });

    it('has fixed position styling', () => {
      render(<DevOpsNotificationBanner activity={mockInProgressActivity} />);
      const banner = screen.getByTestId('devops-notification-banner');
      expect(banner).toHaveClass('fixed');
    });
  });

  describe('Color Coding', () => {
    it('shows blue background for in_progress status', () => {
      render(<DevOpsNotificationBanner activity={mockInProgressActivity} />);
      const banner = screen.getByTestId('devops-notification-banner');
      expect(banner).toHaveClass('bg-accent-blue');
    });

    it('shows green background for completed status', () => {
      render(<DevOpsNotificationBanner activity={mockCompletedActivity} />);
      const banner = screen.getByTestId('devops-notification-banner');
      expect(banner).toHaveClass('bg-status-success');
    });

    it('shows red background for failed status', () => {
      render(<DevOpsNotificationBanner activity={mockFailedActivity} />);
      const banner = screen.getByTestId('devops-notification-banner');
      expect(banner).toHaveClass('bg-status-error');
    });
  });

  describe('Dismiss Button', () => {
    it('shows dismiss button (X icon)', () => {
      render(<DevOpsNotificationBanner activity={mockInProgressActivity} />);
      expect(screen.getByTestId('dismiss-button')).toBeInTheDocument();
    });

    it('calls onDismiss when dismiss button clicked', () => {
      const onDismiss = vi.fn();
      render(<DevOpsNotificationBanner activity={mockInProgressActivity} onDismiss={onDismiss} />);

      fireEvent.click(screen.getByTestId('dismiss-button'));

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('Click Handler', () => {
    it('calls onClick when banner clicked', () => {
      const onClick = vi.fn();
      render(<DevOpsNotificationBanner activity={mockInProgressActivity} onClick={onClick} />);

      fireEvent.click(screen.getByTestId('devops-notification-banner'));

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when dismiss button clicked', () => {
      const onClick = vi.fn();
      const onDismiss = vi.fn();
      render(
        <DevOpsNotificationBanner
          activity={mockInProgressActivity}
          onClick={onClick}
          onDismiss={onDismiss}
        />
      );

      fireEvent.click(screen.getByTestId('dismiss-button'));

      expect(onClick).not.toHaveBeenCalled();
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('has cursor-pointer when onClick provided', () => {
      const onClick = vi.fn();
      render(<DevOpsNotificationBanner activity={mockInProgressActivity} onClick={onClick} />);
      const banner = screen.getByTestId('devops-notification-banner');
      expect(banner).toHaveClass('cursor-pointer');
    });
  });

  describe('Slide-in Animation', () => {
    it('has animation classes for slide-in effect', () => {
      render(<DevOpsNotificationBanner activity={mockInProgressActivity} />);
      const banner = screen.getByTestId('devops-notification-banner');
      expect(banner).toHaveClass('animate-slide-in-down');
    });
  });

  describe('Auto-hide Timer', () => {
    it('calls onDismiss after 10 seconds when completed', () => {
      const onDismiss = vi.fn();
      render(<DevOpsNotificationBanner activity={mockCompletedActivity} onDismiss={onDismiss} />);

      // Verify not called immediately
      expect(onDismiss).not.toHaveBeenCalled();

      // Advance timers by 10 seconds
      act(() => {
        vi.advanceTimersByTime(10000);
      });

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('does not auto-hide when in_progress', () => {
      const onDismiss = vi.fn();
      render(<DevOpsNotificationBanner activity={mockInProgressActivity} onDismiss={onDismiss} />);

      // Advance timers by 15 seconds (more than auto-hide delay)
      act(() => {
        vi.advanceTimersByTime(15000);
      });

      expect(onDismiss).not.toHaveBeenCalled();
    });

    it('auto-hides after 10 seconds when failed', () => {
      const onDismiss = vi.fn();
      render(<DevOpsNotificationBanner activity={mockFailedActivity} onDismiss={onDismiss} />);

      // Advance timers by 10 seconds
      act(() => {
        vi.advanceTimersByTime(10000);
      });

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('clears timer on unmount', () => {
      const onDismiss = vi.fn();
      const { unmount } = render(
        <DevOpsNotificationBanner activity={mockCompletedActivity} onDismiss={onDismiss} />
      );

      // Unmount before timer fires
      unmount();

      // Advance timers
      act(() => {
        vi.advanceTimersByTime(10000);
      });

      // Should not be called since component unmounted
      expect(onDismiss).not.toHaveBeenCalled();
    });
  });

  describe('Status Display', () => {
    it('shows "Deploying..." for in_progress', () => {
      render(<DevOpsNotificationBanner activity={mockInProgressActivity} />);
      expect(screen.getByText('Deploying...')).toBeInTheDocument();
    });

    it('shows "Completed" for completed status', () => {
      render(<DevOpsNotificationBanner activity={mockCompletedActivity} />);
      // Use exact text to avoid matching "All steps completed"
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('shows "Failed" for failed status', () => {
      render(<DevOpsNotificationBanner activity={mockFailedActivity} />);
      expect(screen.getByText(/failed/i)).toBeInTheDocument();
    });
  });

  describe('Current Step Display', () => {
    it('shows the currently running step', () => {
      render(<DevOpsNotificationBanner activity={mockInProgressActivity} />);
      // The running step is "Apply manifests"
      expect(screen.getByTestId('current-step')).toHaveTextContent('Apply manifests');
    });

    it('shows completed message when all steps done', () => {
      render(<DevOpsNotificationBanner activity={mockCompletedActivity} />);
      expect(screen.getByTestId('current-step')).toHaveTextContent(/all steps completed/i);
    });

    it('shows failed step when operation failed', () => {
      render(<DevOpsNotificationBanner activity={mockFailedActivity} />);
      expect(screen.getByTestId('current-step')).toHaveTextContent('Apply manifests');
    });
  });
});
