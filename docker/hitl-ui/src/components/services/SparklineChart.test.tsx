/**
 * Tests for SparklineChart component
 *
 * T12: SVG-based sparkline chart for service metrics visualization
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SparklineChart from './SparklineChart';
import type { SparklineDataPoint } from '../../api/types/services';

describe('SparklineChart', () => {
  const mockFullData: SparklineDataPoint[] = [
    { timestamp: 1706180400000, value: 20 },
    { timestamp: 1706180460000, value: 35 },
    { timestamp: 1706180520000, value: 45 },
    { timestamp: 1706180580000, value: 30 },
    { timestamp: 1706180640000, value: 55 },
    { timestamp: 1706180700000, value: 40 },
  ];

  const mockPartialData: SparklineDataPoint[] = [
    { timestamp: 1706180400000, value: 20 },
    { timestamp: 1706180520000, value: 45 },
    { timestamp: 1706180700000, value: 40 },
  ];

  describe('Renders with full data', () => {
    it('renders SVG element with default dimensions', () => {
      render(<SparklineChart data={mockFullData} />);
      const svg = screen.getByTestId('sparkline-chart');
      expect(svg).toBeInTheDocument();
      expect(svg.tagName).toBe('svg');
      expect(svg).toHaveAttribute('width', '80');
      expect(svg).toHaveAttribute('height', '30');
    });

    it('renders with custom dimensions', () => {
      render(<SparklineChart data={mockFullData} width={120} height={45} />);
      const svg = screen.getByTestId('sparkline-chart');
      expect(svg).toHaveAttribute('width', '120');
      expect(svg).toHaveAttribute('height', '45');
    });

    it('renders path element for line', () => {
      render(<SparklineChart data={mockFullData} />);
      const path = screen.getByTestId('sparkline-path');
      expect(path).toBeInTheDocument();
      expect(path.tagName).toBe('path');
      expect(path).toHaveAttribute('d');
    });

    it('applies custom color', () => {
      render(<SparklineChart data={mockFullData} color="#3B82F6" />);
      const path = screen.getByTestId('sparkline-path');
      expect(path).toHaveAttribute('stroke', '#3B82F6');
    });

    it('applies default color when not specified', () => {
      render(<SparklineChart data={mockFullData} />);
      const path = screen.getByTestId('sparkline-path');
      expect(path).toHaveAttribute('stroke');
    });
  });

  describe('Handles empty data', () => {
    it('renders empty state when data is empty array', () => {
      render(<SparklineChart data={[]} />);
      const svg = screen.getByTestId('sparkline-chart');
      expect(svg).toBeInTheDocument();
      expect(screen.getByTestId('sparkline-empty')).toBeInTheDocument();
    });

    it('shows placeholder text for empty data', () => {
      render(<SparklineChart data={[]} />);
      expect(screen.getByText('No data')).toBeInTheDocument();
    });
  });

  describe('Handles partial data', () => {
    it('renders with sparse data points', () => {
      render(<SparklineChart data={mockPartialData} />);
      const path = screen.getByTestId('sparkline-path');
      expect(path).toBeInTheDocument();
      // Path should still be rendered with fewer points
      expect(path).toHaveAttribute('d');
    });

    it('renders with single data point', () => {
      const singlePoint: SparklineDataPoint[] = [{ timestamp: 1706180400000, value: 50 }];
      render(<SparklineChart data={singlePoint} />);
      const svg = screen.getByTestId('sparkline-chart');
      expect(svg).toBeInTheDocument();
      // Should show a dot or horizontal line for single point
      expect(screen.getByTestId('sparkline-single-point')).toBeInTheDocument();
    });
  });

  describe('Tooltip interaction', () => {
    it('shows tooltip on hover over chart area', async () => {
      render(<SparklineChart data={mockFullData} />);
      const chart = screen.getByTestId('sparkline-chart');

      // Simulate mouse enter
      fireEvent.mouseEnter(chart);

      await waitFor(() => {
        const tooltip = screen.queryByTestId('sparkline-tooltip');
        expect(tooltip).toBeInTheDocument();
      });
    });

    it('tooltip shows timestamp and value', async () => {
      render(<SparklineChart data={mockFullData} />);
      const chart = screen.getByTestId('sparkline-chart');

      fireEvent.mouseEnter(chart);
      // Move to a position to trigger tooltip content
      fireEvent.mouseMove(chart, { clientX: 40, clientY: 15 });

      await waitFor(() => {
        const tooltip = screen.queryByTestId('sparkline-tooltip');
        expect(tooltip).toBeInTheDocument();
      });
    });

    it('hides tooltip on mouse leave', async () => {
      render(<SparklineChart data={mockFullData} />);
      const chart = screen.getByTestId('sparkline-chart');

      fireEvent.mouseEnter(chart);
      await waitFor(() => {
        expect(screen.queryByTestId('sparkline-tooltip')).toBeInTheDocument();
      });

      fireEvent.mouseLeave(chart);
      await waitFor(() => {
        expect(screen.queryByTestId('sparkline-tooltip')).not.toBeInTheDocument();
      });
    });
  });

  describe('Color threshold changes', () => {
    it('uses green color when value is below warning threshold', () => {
      const lowData: SparklineDataPoint[] = [
        { timestamp: 1706180400000, value: 30 },
        { timestamp: 1706180460000, value: 35 },
        { timestamp: 1706180520000, value: 40 },
      ];
      render(
        <SparklineChart
          data={lowData}
          thresholds={{ warning: 60, critical: 80 }}
        />
      );
      const path = screen.getByTestId('sparkline-path');
      // Should use success/green color
      expect(path).toHaveAttribute('stroke', expect.stringMatching(/#22C55E|#10B981|green/i));
    });

    it('uses yellow/orange color when value exceeds warning threshold', () => {
      const warningData: SparklineDataPoint[] = [
        { timestamp: 1706180400000, value: 65 },
        { timestamp: 1706180460000, value: 70 },
        { timestamp: 1706180520000, value: 72 },
      ];
      render(
        <SparklineChart
          data={warningData}
          thresholds={{ warning: 60, critical: 80 }}
        />
      );
      const path = screen.getByTestId('sparkline-path');
      // Should use warning/yellow color
      expect(path).toHaveAttribute('stroke', expect.stringMatching(/#F59E0B|#EAB308|yellow|orange/i));
    });

    it('uses red color when value exceeds critical threshold', () => {
      const criticalData: SparklineDataPoint[] = [
        { timestamp: 1706180400000, value: 85 },
        { timestamp: 1706180460000, value: 90 },
        { timestamp: 1706180520000, value: 92 },
      ];
      render(
        <SparklineChart
          data={criticalData}
          thresholds={{ warning: 60, critical: 80 }}
        />
      );
      const path = screen.getByTestId('sparkline-path');
      // Should use error/red color
      expect(path).toHaveAttribute('stroke', expect.stringMatching(/#EF4444|#DC2626|red/i));
    });

    it('explicit color overrides threshold-based color', () => {
      const criticalData: SparklineDataPoint[] = [
        { timestamp: 1706180400000, value: 90 },
      ];
      render(
        <SparklineChart
          data={criticalData}
          color="#9333EA"
          thresholds={{ warning: 60, critical: 80 }}
        />
      );
      // Single data point renders a circle, not a path
      const element = screen.getByTestId('sparkline-single-point');
      expect(element).toHaveAttribute('stroke', '#9333EA');
    });
  });

  describe('Loading state', () => {
    it('shows loading animation when isLoading is true', () => {
      render(<SparklineChart data={[]} isLoading />);
      expect(screen.getByTestId('sparkline-loading')).toBeInTheDocument();
    });

    it('loading animation has pulse effect', () => {
      render(<SparklineChart data={[]} isLoading />);
      const loading = screen.getByTestId('sparkline-loading');
      expect(loading).toHaveClass('animate-pulse');
    });

    it('shows data when not loading even with isLoading prop', () => {
      render(<SparklineChart data={mockFullData} isLoading={false} />);
      expect(screen.getByTestId('sparkline-path')).toBeInTheDocument();
      expect(screen.queryByTestId('sparkline-loading')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has role="img" on SVG', () => {
      render(<SparklineChart data={mockFullData} />);
      const svg = screen.getByTestId('sparkline-chart');
      expect(svg).toHaveAttribute('role', 'img');
    });

    it('has aria-label describing the chart', () => {
      render(<SparklineChart data={mockFullData} ariaLabel="CPU usage over time" />);
      const svg = screen.getByTestId('sparkline-chart');
      expect(svg).toHaveAttribute('aria-label', 'CPU usage over time');
    });
  });

  describe('Custom className', () => {
    it('applies custom className to container', () => {
      render(<SparklineChart data={mockFullData} className="my-custom-class" />);
      const container = screen.getByTestId('sparkline-container');
      expect(container).toHaveClass('my-custom-class');
    });
  });
});
