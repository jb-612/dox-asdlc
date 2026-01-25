/**
 * Tests for MetricsChart component
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MetricsChart from './MetricsChart';
import { useK8sStore } from '../../stores/k8sStore';
import type { MetricsTimeSeries } from '../../api/types/kubernetes';

// Mock Recharts to avoid rendering issues in tests
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  AreaChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="area-chart">{children}</div>
  ),
  Line: () => <div data-testid="line" />,
  Area: () => <div data-testid="area" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
}));

describe('MetricsChart', () => {
  const mockMetricsData: MetricsTimeSeries = {
    resourceType: 'cluster',
    resourceName: 'cluster',
    dataPoints: [
      { timestamp: '2026-01-25T09:00:00Z', cpuPercent: 40, memoryPercent: 55 },
      { timestamp: '2026-01-25T09:05:00Z', cpuPercent: 45, memoryPercent: 58 },
      { timestamp: '2026-01-25T09:10:00Z', cpuPercent: 42, memoryPercent: 60 },
      { timestamp: '2026-01-25T09:15:00Z', cpuPercent: 48, memoryPercent: 62 },
      { timestamp: '2026-01-25T09:20:00Z', cpuPercent: 50, memoryPercent: 65 },
    ],
    interval: '5m',
    startTime: '2026-01-25T09:00:00Z',
    endTime: '2026-01-25T09:20:00Z',
  };

  beforeEach(() => {
    // Reset store before each test
    useK8sStore.getState().reset();
  });

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<MetricsChart data={mockMetricsData} />);
      expect(screen.getByTestId('metrics-chart')).toBeInTheDocument();
    });

    it('renders chart container', () => {
      render(<MetricsChart data={mockMetricsData} />);
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('renders line chart by default', () => {
      render(<MetricsChart data={mockMetricsData} />);
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<MetricsChart data={mockMetricsData} className="my-custom-class" />);
      expect(screen.getByTestId('metrics-chart')).toHaveClass('my-custom-class');
    });
  });

  describe('Current Values Display', () => {
    it('shows current CPU value', () => {
      render(<MetricsChart data={mockMetricsData} />);
      expect(screen.getByTestId('current-cpu')).toHaveTextContent('50.0%');
    });

    it('shows current Memory value', () => {
      render(<MetricsChart data={mockMetricsData} />);
      expect(screen.getByTestId('current-memory')).toHaveTextContent('65.0%');
    });

    it('hides memory value when type is cpu only', () => {
      render(<MetricsChart data={mockMetricsData} type="cpu" />);
      expect(screen.getByTestId('current-cpu')).toBeInTheDocument();
      expect(screen.queryByTestId('current-memory')).not.toBeInTheDocument();
    });

    it('hides CPU value when type is memory only', () => {
      render(<MetricsChart data={mockMetricsData} type="memory" />);
      expect(screen.queryByTestId('current-cpu')).not.toBeInTheDocument();
      expect(screen.getByTestId('current-memory')).toBeInTheDocument();
    });
  });

  describe('Interval Selector', () => {
    it('renders interval selector by default', () => {
      render(<MetricsChart data={mockMetricsData} />);
      expect(screen.getByTestId('interval-selector')).toBeInTheDocument();
    });

    it('renders all interval options', () => {
      render(<MetricsChart data={mockMetricsData} />);
      expect(screen.getByTestId('interval-1m')).toBeInTheDocument();
      expect(screen.getByTestId('interval-5m')).toBeInTheDocument();
      expect(screen.getByTestId('interval-15m')).toBeInTheDocument();
      expect(screen.getByTestId('interval-1h')).toBeInTheDocument();
    });

    it('highlights current interval', () => {
      render(<MetricsChart data={mockMetricsData} />);
      // Default interval is 5m
      expect(screen.getByTestId('interval-5m')).toHaveClass('bg-accent-blue');
    });

    it('changes interval when clicked', () => {
      render(<MetricsChart data={mockMetricsData} />);

      fireEvent.click(screen.getByTestId('interval-15m'));

      expect(screen.getByTestId('interval-15m')).toHaveClass('bg-accent-blue');
      expect(screen.getByTestId('interval-5m')).not.toHaveClass('bg-accent-blue');
    });

    it('hides interval selector when showIntervalSelector is false', () => {
      render(<MetricsChart data={mockMetricsData} showIntervalSelector={false} />);
      expect(screen.queryByTestId('interval-selector')).not.toBeInTheDocument();
    });
  });

  describe('Chart Type Variations', () => {
    it('renders CPU only chart', () => {
      render(<MetricsChart data={mockMetricsData} type="cpu" />);
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    it('renders memory only chart', () => {
      render(<MetricsChart data={mockMetricsData} type="memory" />);
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    it('renders both metrics chart', () => {
      render(<MetricsChart data={mockMetricsData} type="both" />);
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });
  });

  describe('Sparkline Mode', () => {
    it('renders area chart in sparkline mode', () => {
      render(<MetricsChart data={mockMetricsData} sparkline />);
      expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    });

    it('hides controls in sparkline mode', () => {
      render(<MetricsChart data={mockMetricsData} sparkline />);
      expect(screen.queryByTestId('interval-selector')).not.toBeInTheDocument();
      expect(screen.queryByTestId('current-cpu')).not.toBeInTheDocument();
    });
  });

  describe('Legend', () => {
    it('shows legend by default', () => {
      render(<MetricsChart data={mockMetricsData} />);
      expect(screen.getByTestId('legend')).toBeInTheDocument();
    });

    it('hides legend when showLegend is false', () => {
      render(<MetricsChart data={mockMetricsData} showLegend={false} />);
      expect(screen.queryByTestId('legend')).not.toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading state when isLoading and no data', () => {
      render(<MetricsChart isLoading />);
      expect(screen.getByTestId('metrics-chart-loading')).toBeInTheDocument();
    });

    it('shows chart when isLoading but data exists', () => {
      render(<MetricsChart data={mockMetricsData} isLoading />);
      expect(screen.getByTestId('metrics-chart')).toBeInTheDocument();
      expect(screen.queryByTestId('metrics-chart-loading')).not.toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no data', () => {
      render(<MetricsChart />);
      expect(screen.getByTestId('metrics-chart-empty')).toBeInTheDocument();
      expect(screen.getByText(/no metrics data/i)).toBeInTheDocument();
    });

    it('shows empty state when data has no points', () => {
      const emptyData: MetricsTimeSeries = {
        ...mockMetricsData,
        dataPoints: [],
      };
      render(<MetricsChart data={emptyData} />);
      expect(screen.getByTestId('metrics-chart-empty')).toBeInTheDocument();
    });
  });

  describe('Height Configuration', () => {
    it('applies default height', () => {
      render(<MetricsChart data={mockMetricsData} />);
      // Chart container should exist and be rendered properly
      expect(screen.getByTestId('metrics-chart')).toBeInTheDocument();
    });

    it('applies custom height', () => {
      render(<MetricsChart data={mockMetricsData} height={400} />);
      expect(screen.getByTestId('metrics-chart')).toBeInTheDocument();
    });
  });
});
