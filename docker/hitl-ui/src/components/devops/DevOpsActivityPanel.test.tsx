/**
 * Tests for DevOpsActivityPanel component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DevOpsActivityPanel from './DevOpsActivityPanel';
import type { DevOpsActivity, DevOpsActivityResponse } from '../../api/types/devops';

describe('DevOpsActivityPanel', () => {
  const mockCurrentActivity: DevOpsActivity = {
    id: 'activity-1',
    operation: 'Deploy workers chart v2.1.0',
    status: 'in_progress',
    startedAt: '2026-01-27T10:00:00Z',
    steps: [
      { name: 'Pull images', status: 'completed', startedAt: '2026-01-27T10:00:00Z', completedAt: '2026-01-27T10:01:00Z' },
      { name: 'Apply manifests', status: 'running', startedAt: '2026-01-27T10:01:00Z' },
      { name: 'Wait for rollout', status: 'pending' },
      { name: 'Health check', status: 'pending' },
    ],
  };

  const mockRecentActivities: DevOpsActivity[] = [
    {
      id: 'activity-2',
      operation: 'Deploy hitl-ui chart v1.5.0',
      status: 'completed',
      startedAt: '2026-01-27T09:00:00Z',
      completedAt: '2026-01-27T09:05:00Z',
      steps: [
        { name: 'Pull images', status: 'completed', startedAt: '2026-01-27T09:00:00Z', completedAt: '2026-01-27T09:02:00Z' },
        { name: 'Apply manifests', status: 'completed', startedAt: '2026-01-27T09:02:00Z', completedAt: '2026-01-27T09:04:00Z' },
        { name: 'Health check', status: 'completed', startedAt: '2026-01-27T09:04:00Z', completedAt: '2026-01-27T09:05:00Z' },
      ],
    },
    {
      id: 'activity-3',
      operation: 'Deploy redis chart v3.0.0',
      status: 'failed',
      startedAt: '2026-01-27T08:00:00Z',
      completedAt: '2026-01-27T08:02:00Z',
      steps: [
        { name: 'Pull images', status: 'completed', startedAt: '2026-01-27T08:00:00Z', completedAt: '2026-01-27T08:01:00Z' },
        { name: 'Apply manifests', status: 'failed', startedAt: '2026-01-27T08:01:00Z', completedAt: '2026-01-27T08:02:00Z', error: 'Invalid config' },
      ],
    },
  ];

  const mockActivityResponse: DevOpsActivityResponse = {
    current: mockCurrentActivity,
    recent: mockRecentActivities,
  };

  const emptyActivityResponse: DevOpsActivityResponse = {
    current: undefined,
    recent: [],
  };

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<DevOpsActivityPanel activity={mockActivityResponse} />);
      expect(screen.getByTestId('devops-activity-panel')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<DevOpsActivityPanel activity={mockActivityResponse} className="my-custom-class" />);
      expect(screen.getByTestId('devops-activity-panel')).toHaveClass('my-custom-class');
    });
  });

  describe('Current Operation Section', () => {
    it('shows current operation section when activity is running', () => {
      render(<DevOpsActivityPanel activity={mockActivityResponse} />);
      expect(screen.getByTestId('current-operation-section')).toBeInTheDocument();
    });

    it('displays operation name', () => {
      render(<DevOpsActivityPanel activity={mockActivityResponse} />);
      expect(screen.getByText('Deploy workers chart v2.1.0')).toBeInTheDocument();
    });

    it('shows status badge with in_progress status', () => {
      render(<DevOpsActivityPanel activity={mockActivityResponse} />);
      const statusBadge = screen.getByTestId('current-status-badge');
      expect(statusBadge).toBeInTheDocument();
      expect(statusBadge).toHaveTextContent(/in progress/i);
    });

    it('includes DevOpsStepList for current operation', () => {
      render(<DevOpsActivityPanel activity={mockActivityResponse} />);
      expect(screen.getByTestId('devops-step-list')).toBeInTheDocument();
    });

    it('hides current operation section when no current activity', () => {
      render(<DevOpsActivityPanel activity={emptyActivityResponse} />);
      expect(screen.queryByTestId('current-operation-section')).not.toBeInTheDocument();
    });
  });

  describe('Recent Operations Section', () => {
    it('shows recent operations section', () => {
      render(<DevOpsActivityPanel activity={mockActivityResponse} />);
      expect(screen.getByTestId('recent-operations-section')).toBeInTheDocument();
    });

    it('displays all recent operations', () => {
      render(<DevOpsActivityPanel activity={mockActivityResponse} />);
      expect(screen.getByText('Deploy hitl-ui chart v1.5.0')).toBeInTheDocument();
      expect(screen.getByText('Deploy redis chart v3.0.0')).toBeInTheDocument();
    });

    it('shows operation status for each recent operation', () => {
      render(<DevOpsActivityPanel activity={mockActivityResponse} />);
      // Match recent-operation-activity-X but not recent-operation-activity-X-status
      const recentItems = screen.getAllByTestId(/^recent-operation-activity-\d+$/);
      expect(recentItems).toHaveLength(2);
    });

    it('shows operation duration for completed operations', () => {
      render(<DevOpsActivityPanel activity={mockActivityResponse} />);
      // Duration of 5 minutes (09:00 to 09:05)
      expect(screen.getByText(/5m/)).toBeInTheDocument();
    });

    it('shows status badge with completed status', () => {
      render(<DevOpsActivityPanel activity={mockActivityResponse} />);
      const completedBadge = screen.getByTestId('recent-operation-activity-2-status');
      expect(completedBadge).toHaveTextContent(/completed/i);
    });

    it('shows status badge with failed status', () => {
      render(<DevOpsActivityPanel activity={mockActivityResponse} />);
      const failedBadge = screen.getByTestId('recent-operation-activity-3-status');
      expect(failedBadge).toHaveTextContent(/failed/i);
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no operations', () => {
      render(<DevOpsActivityPanel activity={emptyActivityResponse} />);
      expect(screen.getByTestId('devops-empty-state')).toBeInTheDocument();
    });

    it('displays empty state message', () => {
      render(<DevOpsActivityPanel activity={emptyActivityResponse} />);
      expect(screen.getByText(/no devops activity/i)).toBeInTheDocument();
    });
  });

  describe('Refresh Button', () => {
    it('shows refresh button when onRefresh provided', () => {
      const onRefresh = vi.fn();
      render(<DevOpsActivityPanel activity={mockActivityResponse} onRefresh={onRefresh} />);
      expect(screen.getByTestId('refresh-button')).toBeInTheDocument();
    });

    it('hides refresh button when onRefresh not provided', () => {
      render(<DevOpsActivityPanel activity={mockActivityResponse} />);
      expect(screen.queryByTestId('refresh-button')).not.toBeInTheDocument();
    });

    it('calls onRefresh when clicked', () => {
      const onRefresh = vi.fn();
      render(<DevOpsActivityPanel activity={mockActivityResponse} onRefresh={onRefresh} />);

      fireEvent.click(screen.getByTestId('refresh-button'));

      expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it('shows refresh button in empty state when onRefresh provided', () => {
      const onRefresh = vi.fn();
      render(<DevOpsActivityPanel activity={emptyActivityResponse} onRefresh={onRefresh} />);
      expect(screen.getByTestId('refresh-button')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading skeleton when isLoading is true and no data', () => {
      render(<DevOpsActivityPanel isLoading />);
      expect(screen.getByTestId('devops-activity-loading')).toBeInTheDocument();
    });

    it('shows data when isLoading but data exists', () => {
      render(<DevOpsActivityPanel activity={mockActivityResponse} isLoading />);
      expect(screen.getByTestId('devops-activity-panel')).toBeInTheDocument();
      expect(screen.queryByTestId('devops-activity-loading')).not.toBeInTheDocument();
    });
  });

  describe('Status Badge Colors', () => {
    it('shows blue badge for in_progress status', () => {
      render(<DevOpsActivityPanel activity={mockActivityResponse} />);
      const badge = screen.getByTestId('current-status-badge');
      expect(badge).toHaveClass('bg-accent-blue');
    });

    it('shows green badge for completed status', () => {
      const completedActivity: DevOpsActivityResponse = {
        current: undefined,
        recent: [mockRecentActivities[0]],
      };
      render(<DevOpsActivityPanel activity={completedActivity} />);
      const badge = screen.getByTestId('recent-operation-activity-2-status');
      expect(badge).toHaveClass('bg-status-success');
    });

    it('shows red badge for failed status', () => {
      const failedActivity: DevOpsActivityResponse = {
        current: undefined,
        recent: [mockRecentActivities[1]],
      };
      render(<DevOpsActivityPanel activity={failedActivity} />);
      const badge = screen.getByTestId('recent-operation-activity-3-status');
      expect(badge).toHaveClass('bg-status-error');
    });
  });
});
