/**
 * Unit tests for RequestRateChart component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RequestRateChart from './RequestRateChart';
import type { VMMetricsTimeSeries } from '../../api/types/metrics';

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('RequestRateChart', () => {
  const mockData: VMMetricsTimeSeries = {
    metric: 'request_rate',
    service: 'orchestrator',
    dataPoints: [
      { timestamp: '2026-01-25T11:00:00Z', value: 150 },
      { timestamp: '2026-01-25T11:01:00Z', value: 180 },
      { timestamp: '2026-01-25T11:02:00Z', value: 165 },
    ],
  };

  describe('Rendering', () => {
    it('renders with data', () => {
      render(<RequestRateChart data={mockData} />);
      expect(screen.getByTestId('request-rate-chart')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<RequestRateChart data={mockData} className="custom-class" />);
      expect(screen.getByTestId('request-rate-chart')).toHaveClass('custom-class');
    });

    it('applies custom height', () => {
      render(<RequestRateChart data={mockData} height={180} />);
      const chart = screen.getByTestId('request-rate-chart');
      expect(chart).toHaveStyle({ height: '180px' });
    });
  });

  describe('Loading State', () => {
    it('shows loading state when isLoading and no data', () => {
      render(<RequestRateChart isLoading />);
      expect(screen.getByTestId('request-rate-chart-loading')).toBeInTheDocument();
    });

    it('shows skeleton with pulse animation', () => {
      render(<RequestRateChart isLoading />);
      expect(screen.getByTestId('request-rate-chart-loading')).toHaveClass('animate-pulse');
    });

    it('shows chart when loading but data exists', () => {
      render(<RequestRateChart data={mockData} isLoading />);
      expect(screen.getByTestId('request-rate-chart')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no data', () => {
      render(<RequestRateChart />);
      expect(screen.getByTestId('request-rate-chart-empty')).toBeInTheDocument();
    });

    it('shows empty message', () => {
      render(<RequestRateChart />);
      expect(screen.getByText('No request rate data available')).toBeInTheDocument();
    });

    it('shows empty state for empty dataPoints array', () => {
      const emptyData: VMMetricsTimeSeries = {
        metric: 'request_rate',
        service: 'test',
        dataPoints: [],
      };
      render(<RequestRateChart data={emptyData} />);
      expect(screen.getByTestId('request-rate-chart-empty')).toBeInTheDocument();
    });
  });
});
