/**
 * Unit tests for ActiveTasksGauge component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ActiveTasksGauge from './ActiveTasksGauge';
import type { ActiveTasksMetrics } from '../../api/types/metrics';

describe('ActiveTasksGauge', () => {
  const mockData: ActiveTasksMetrics = {
    activeTasks: 12,
    maxTasks: 50,
    activeWorkers: 4,
    lastUpdated: '2026-01-25T12:00:00Z',
  };

  describe('Rendering', () => {
    it('renders with data', () => {
      render(<ActiveTasksGauge data={mockData} />);
      expect(screen.getByTestId('active-tasks-gauge')).toBeInTheDocument();
    });

    it('displays active tasks count', () => {
      render(<ActiveTasksGauge data={mockData} />);
      expect(screen.getByTestId('active-tasks-count')).toHaveTextContent('12');
    });

    it('displays max tasks capacity', () => {
      render(<ActiveTasksGauge data={mockData} />);
      expect(screen.getByText('/ 50')).toBeInTheDocument();
    });

    it('displays active workers count', () => {
      render(<ActiveTasksGauge data={mockData} />);
      expect(screen.getByTestId('active-workers-count')).toHaveTextContent('4');
    });

    it('displays utilization percentage', () => {
      render(<ActiveTasksGauge data={mockData} />);
      expect(screen.getByTestId('utilization-percent')).toHaveTextContent('24.0%');
    });

    it('displays last updated time', () => {
      render(<ActiveTasksGauge data={mockData} />);
      expect(screen.getByTestId('last-updated')).toBeInTheDocument();
    });

    it('renders progress bar', () => {
      render(<ActiveTasksGauge data={mockData} />);
      expect(screen.getByTestId('active-tasks-progress')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<ActiveTasksGauge data={mockData} className="custom-class" />);
      expect(screen.getByTestId('active-tasks-gauge')).toHaveClass('custom-class');
    });
  });

  describe('Loading State', () => {
    it('shows loading state when isLoading and no data', () => {
      render(<ActiveTasksGauge isLoading />);
      expect(screen.getByTestId('active-tasks-gauge-loading')).toBeInTheDocument();
    });

    it('shows data when loading but data exists', () => {
      render(<ActiveTasksGauge data={mockData} isLoading />);
      expect(screen.getByTestId('active-tasks-gauge')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no data', () => {
      render(<ActiveTasksGauge />);
      expect(screen.getByTestId('active-tasks-gauge-empty')).toBeInTheDocument();
    });

    it('shows empty message', () => {
      render(<ActiveTasksGauge />);
      expect(screen.getByText('No task data available')).toBeInTheDocument();
    });
  });

  describe('Progress Bar Width', () => {
    it('calculates correct progress width', () => {
      render(<ActiveTasksGauge data={mockData} />);
      const progressBar = screen.getByTestId('active-tasks-progress');
      expect(progressBar).toHaveStyle({ width: '24%' });
    });

    it('handles 100% utilization', () => {
      const fullData: ActiveTasksMetrics = {
        ...mockData,
        activeTasks: 50,
      };
      render(<ActiveTasksGauge data={fullData} />);
      const progressBar = screen.getByTestId('active-tasks-progress');
      expect(progressBar).toHaveStyle({ width: '100%' });
    });

    it('caps at 100% even if over capacity', () => {
      const overData: ActiveTasksMetrics = {
        ...mockData,
        activeTasks: 60,
      };
      render(<ActiveTasksGauge data={overData} />);
      const progressBar = screen.getByTestId('active-tasks-progress');
      expect(progressBar).toHaveStyle({ width: '100%' });
    });
  });

  describe('Status Colors', () => {
    it('uses normal color for low utilization', () => {
      const lowData: ActiveTasksMetrics = {
        ...mockData,
        activeTasks: 10,
      };
      render(<ActiveTasksGauge data={lowData} />);
      expect(screen.getByTestId('active-tasks-count')).toHaveClass('text-accent-teal');
    });

    it('uses warning color for high utilization (70-90%)', () => {
      const highData: ActiveTasksMetrics = {
        ...mockData,
        activeTasks: 40,
      };
      render(<ActiveTasksGauge data={highData} />);
      expect(screen.getByTestId('active-tasks-count')).toHaveClass('text-status-warning');
    });

    it('uses error color for critical utilization (90%+)', () => {
      const criticalData: ActiveTasksMetrics = {
        ...mockData,
        activeTasks: 48,
      };
      render(<ActiveTasksGauge data={criticalData} />);
      expect(screen.getByTestId('active-tasks-count')).toHaveClass('text-status-error');
    });
  });
});
