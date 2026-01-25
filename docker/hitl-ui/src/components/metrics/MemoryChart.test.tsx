/**
 * Unit tests for MemoryChart component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MemoryChart from './MemoryChart';
import type { VMMetricsTimeSeries } from '../../api/types/metrics';

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('MemoryChart', () => {
  const mockData: VMMetricsTimeSeries = {
    metric: 'memory_usage_percent',
    service: 'orchestrator',
    dataPoints: [
      { timestamp: '2026-01-25T11:00:00Z', value: 55 },
      { timestamp: '2026-01-25T11:01:00Z', value: 58 },
      { timestamp: '2026-01-25T11:02:00Z', value: 52 },
    ],
  };

  describe('Rendering', () => {
    it('renders with data', () => {
      render(<MemoryChart data={mockData} />);
      expect(screen.getByTestId('memory-chart')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<MemoryChart data={mockData} className="custom-class" />);
      expect(screen.getByTestId('memory-chart')).toHaveClass('custom-class');
    });

    it('applies custom height', () => {
      render(<MemoryChart data={mockData} height={250} />);
      const chart = screen.getByTestId('memory-chart');
      expect(chart).toHaveStyle({ height: '250px' });
    });
  });

  describe('Loading State', () => {
    it('shows loading state when isLoading and no data', () => {
      render(<MemoryChart isLoading />);
      expect(screen.getByTestId('memory-chart-loading')).toBeInTheDocument();
    });

    it('shows skeleton with pulse animation', () => {
      render(<MemoryChart isLoading />);
      expect(screen.getByTestId('memory-chart-loading')).toHaveClass('animate-pulse');
    });

    it('shows chart when loading but data exists', () => {
      render(<MemoryChart data={mockData} isLoading />);
      expect(screen.getByTestId('memory-chart')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no data', () => {
      render(<MemoryChart />);
      expect(screen.getByTestId('memory-chart-empty')).toBeInTheDocument();
    });

    it('shows empty message', () => {
      render(<MemoryChart />);
      expect(screen.getByText('No memory data available')).toBeInTheDocument();
    });

    it('shows empty state for empty dataPoints array', () => {
      const emptyData: VMMetricsTimeSeries = {
        metric: 'memory_usage_percent',
        service: 'test',
        dataPoints: [],
      };
      render(<MemoryChart data={emptyData} />);
      expect(screen.getByTestId('memory-chart-empty')).toBeInTheDocument();
    });
  });
});
