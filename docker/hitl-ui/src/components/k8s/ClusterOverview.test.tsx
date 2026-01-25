/**
 * Tests for ClusterOverview component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ClusterOverview from './ClusterOverview';
import type { ClusterHealth } from '../../api/types/kubernetes';

describe('ClusterOverview', () => {
  const mockHealthyCluster: ClusterHealth = {
    status: 'healthy',
    nodesReady: 3,
    nodesTotal: 3,
    podsRunning: 18,
    podsTotal: 20,
    podsPending: 1,
    podsFailed: 1,
    cpuUsagePercent: 45,
    memoryUsagePercent: 60,
    lastUpdated: '2026-01-25T10:00:00Z',
  };

  const mockDegradedCluster: ClusterHealth = {
    status: 'degraded',
    nodesReady: 2,
    nodesTotal: 3,
    podsRunning: 12,
    podsTotal: 20,
    podsPending: 5,
    podsFailed: 3,
    cpuUsagePercent: 75,
    memoryUsagePercent: 82,
    lastUpdated: '2026-01-25T10:00:00Z',
  };

  const mockCriticalCluster: ClusterHealth = {
    status: 'critical',
    nodesReady: 1,
    nodesTotal: 3,
    podsRunning: 5,
    podsTotal: 20,
    podsPending: 8,
    podsFailed: 7,
    cpuUsagePercent: 95,
    memoryUsagePercent: 92,
    lastUpdated: '2026-01-25T10:00:00Z',
  };

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<ClusterOverview health={mockHealthyCluster} />);
      expect(screen.getByTestId('cluster-overview')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<ClusterOverview health={mockHealthyCluster} className="my-custom-class" />);
      expect(screen.getByTestId('cluster-overview')).toHaveClass('my-custom-class');
    });

    it('renders all 4 KPI cards', () => {
      render(<ClusterOverview health={mockHealthyCluster} />);
      expect(screen.getByTestId('kpi-grid')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-nodes-ready')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-pods-running')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-cpu-usage')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-memory-usage')).toBeInTheDocument();
    });
  });

  describe('Status Display', () => {
    it('shows healthy status correctly', () => {
      render(<ClusterOverview health={mockHealthyCluster} />);
      expect(screen.getByTestId('status-label')).toHaveTextContent('Cluster Healthy');
      expect(screen.getByTestId('status-icon')).toBeInTheDocument();
    });

    it('shows degraded status correctly', () => {
      render(<ClusterOverview health={mockDegradedCluster} />);
      expect(screen.getByTestId('status-label')).toHaveTextContent('Cluster Degraded');
    });

    it('shows critical status correctly', () => {
      render(<ClusterOverview health={mockCriticalCluster} />);
      expect(screen.getByTestId('status-label')).toHaveTextContent('Cluster Critical');
    });
  });

  describe('KPI Values', () => {
    it('displays node ready count', () => {
      render(<ClusterOverview health={mockHealthyCluster} />);
      expect(screen.getByTestId('kpi-nodes-ready')).toHaveTextContent('3/3');
    });

    it('displays pods running count', () => {
      render(<ClusterOverview health={mockHealthyCluster} />);
      expect(screen.getByTestId('kpi-pods-running')).toHaveTextContent('18/20');
    });

    it('displays pending and failed pod counts in subtitle', () => {
      render(<ClusterOverview health={mockHealthyCluster} />);
      expect(screen.getByTestId('kpi-pods-running')).toHaveTextContent('1 pending, 1 failed');
    });

    it('displays CPU usage percentage', () => {
      render(<ClusterOverview health={mockHealthyCluster} />);
      expect(screen.getByTestId('kpi-cpu-usage')).toHaveTextContent('45');
      expect(screen.getByTestId('kpi-cpu-usage')).toHaveTextContent('%');
    });

    it('displays memory usage percentage', () => {
      render(<ClusterOverview health={mockHealthyCluster} />);
      expect(screen.getByTestId('kpi-memory-usage')).toHaveTextContent('60');
      expect(screen.getByTestId('kpi-memory-usage')).toHaveTextContent('%');
    });
  });

  describe('KPI Color Coding', () => {
    it('shows success color for healthy values', () => {
      render(<ClusterOverview health={mockHealthyCluster} />);
      expect(screen.getByTestId('kpi-cpu-usage')).toHaveClass('border-status-success');
    });

    it('shows warning color for elevated values', () => {
      render(<ClusterOverview health={mockDegradedCluster} />);
      expect(screen.getByTestId('kpi-cpu-usage')).toHaveClass('border-status-warning');
    });

    it('shows error color for critical values', () => {
      render(<ClusterOverview health={mockCriticalCluster} />);
      expect(screen.getByTestId('kpi-cpu-usage')).toHaveClass('border-status-error');
    });
  });

  describe('Refresh Button', () => {
    it('shows refresh button when onRefresh provided', () => {
      const onRefresh = vi.fn();
      render(<ClusterOverview health={mockHealthyCluster} onRefresh={onRefresh} />);
      expect(screen.getByTestId('refresh-button')).toBeInTheDocument();
    });

    it('hides refresh button when onRefresh not provided', () => {
      render(<ClusterOverview health={mockHealthyCluster} />);
      expect(screen.queryByTestId('refresh-button')).not.toBeInTheDocument();
    });

    it('calls onRefresh when clicked', () => {
      const onRefresh = vi.fn();
      render(<ClusterOverview health={mockHealthyCluster} onRefresh={onRefresh} />);

      fireEvent.click(screen.getByTestId('refresh-button'));

      expect(onRefresh).toHaveBeenCalledTimes(1);
    });
  });

  describe('Loading State', () => {
    it('shows loading skeletons when isLoading and no data', () => {
      render(<ClusterOverview isLoading />);
      expect(screen.getByTestId('cluster-overview-loading')).toBeInTheDocument();
      expect(screen.getAllByTestId('kpi-skeleton')).toHaveLength(4);
    });

    it('shows data when isLoading but data exists', () => {
      render(<ClusterOverview health={mockHealthyCluster} isLoading />);
      expect(screen.getByTestId('cluster-overview')).toBeInTheDocument();
      expect(screen.queryByTestId('cluster-overview-loading')).not.toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no health data', () => {
      render(<ClusterOverview />);
      expect(screen.getByText(/no cluster health data/i)).toBeInTheDocument();
    });

    it('shows retry button in empty state when onRefresh provided', () => {
      const onRefresh = vi.fn();
      render(<ClusterOverview onRefresh={onRefresh} />);

      const retryButton = screen.getByTestId('refresh-button');
      expect(retryButton).toBeInTheDocument();

      fireEvent.click(retryButton);
      expect(onRefresh).toHaveBeenCalled();
    });
  });

  describe('Last Updated Display', () => {
    it('displays last updated time', () => {
      render(<ClusterOverview health={mockHealthyCluster} />);
      expect(screen.getByText(/last updated:/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has refresh button with aria-label', () => {
      const onRefresh = vi.fn();
      render(<ClusterOverview health={mockHealthyCluster} onRefresh={onRefresh} />);
      expect(screen.getByTestId('refresh-button')).toHaveAttribute('aria-label');
    });
  });
});
