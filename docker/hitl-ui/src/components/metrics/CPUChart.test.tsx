/**
 * Unit tests for CPUChart component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CPUChart from './CPUChart';
import type { VMMetricsTimeSeries } from '../../api/types/metrics';

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('CPUChart', () => {
  const mockData: VMMetricsTimeSeries = {
    metric: 'cpu_usage_percent',
    service: 'orchestrator',
    dataPoints: [
      { timestamp: '2026-01-25T11:00:00Z', value: 40 },
      { timestamp: '2026-01-25T11:01:00Z', value: 45 },
      { timestamp: '2026-01-25T11:02:00Z', value: 42 },
    ],
  };

  describe('Rendering', () => {
    it('renders with data', () => {
      render(<CPUChart data={mockData} />);
      expect(screen.getByTestId('cpu-chart')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<CPUChart data={mockData} className="custom-class" />);
      expect(screen.getByTestId('cpu-chart')).toHaveClass('custom-class');
    });

    it('applies custom height', () => {
      render(<CPUChart data={mockData} height={300} />);
      const chart = screen.getByTestId('cpu-chart');
      expect(chart).toHaveStyle({ height: '300px' });
    });
  });

  describe('Loading State', () => {
    it('shows loading state when isLoading and no data', () => {
      render(<CPUChart isLoading />);
      expect(screen.getByTestId('cpu-chart-loading')).toBeInTheDocument();
    });

    it('shows skeleton with pulse animation', () => {
      render(<CPUChart isLoading />);
      expect(screen.getByTestId('cpu-chart-loading')).toHaveClass('animate-pulse');
    });

    it('shows chart when loading but data exists', () => {
      render(<CPUChart data={mockData} isLoading />);
      expect(screen.getByTestId('cpu-chart')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no data', () => {
      render(<CPUChart />);
      expect(screen.getByTestId('cpu-chart-empty')).toBeInTheDocument();
    });

    it('shows empty message', () => {
      render(<CPUChart />);
      expect(screen.getByText('No CPU data available')).toBeInTheDocument();
    });

    it('shows empty state for empty dataPoints array', () => {
      const emptyData: VMMetricsTimeSeries = {
        metric: 'cpu_usage_percent',
        service: 'test',
        dataPoints: [],
      };
      render(<CPUChart data={emptyData} />);
      expect(screen.getByTestId('cpu-chart-empty')).toBeInTheDocument();
    });
  });
});
