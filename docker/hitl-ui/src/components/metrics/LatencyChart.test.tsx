/**
 * Unit tests for LatencyChart component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LatencyChart from './LatencyChart';
import type { LatencyMetrics, VMMetricsTimeSeries } from '../../api/types/metrics';

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('LatencyChart', () => {
  const createTimeSeries = (metric: string, values: number[]): VMMetricsTimeSeries => ({
    metric,
    service: 'orchestrator',
    dataPoints: values.map((value, i) => ({
      timestamp: new Date(Date.now() - (values.length - i) * 60000).toISOString(),
      value,
    })),
  });

  const mockData: LatencyMetrics = {
    p50: createTimeSeries('latency_p50', [25, 28, 26]),
    p95: createTimeSeries('latency_p95', [80, 85, 82]),
    p99: createTimeSeries('latency_p99', [150, 160, 155]),
  };

  describe('Rendering', () => {
    it('renders with data', () => {
      render(<LatencyChart data={mockData} />);
      expect(screen.getByTestId('latency-chart')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<LatencyChart data={mockData} className="custom-class" />);
      expect(screen.getByTestId('latency-chart')).toHaveClass('custom-class');
    });

    it('applies custom height', () => {
      render(<LatencyChart data={mockData} height={220} />);
      const chart = screen.getByTestId('latency-chart');
      expect(chart).toHaveStyle({ height: '220px' });
    });
  });

  describe('Loading State', () => {
    it('shows loading state when isLoading and no data', () => {
      render(<LatencyChart isLoading />);
      expect(screen.getByTestId('latency-chart-loading')).toBeInTheDocument();
    });

    it('shows skeleton with pulse animation', () => {
      render(<LatencyChart isLoading />);
      expect(screen.getByTestId('latency-chart-loading')).toHaveClass('animate-pulse');
    });

    it('shows chart when loading but data exists', () => {
      render(<LatencyChart data={mockData} isLoading />);
      expect(screen.getByTestId('latency-chart')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no data', () => {
      render(<LatencyChart />);
      expect(screen.getByTestId('latency-chart-empty')).toBeInTheDocument();
    });

    it('shows empty message', () => {
      render(<LatencyChart />);
      expect(screen.getByText('No latency data available')).toBeInTheDocument();
    });

    it('shows empty state for empty dataPoints', () => {
      const emptyData: LatencyMetrics = {
        p50: { metric: 'latency_p50', service: 'test', dataPoints: [] },
        p95: { metric: 'latency_p95', service: 'test', dataPoints: [] },
        p99: { metric: 'latency_p99', service: 'test', dataPoints: [] },
      };
      render(<LatencyChart data={emptyData} />);
      expect(screen.getByTestId('latency-chart-empty')).toBeInTheDocument();
    });
  });
});
