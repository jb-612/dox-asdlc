import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock recharts — render bars as simple divs
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ children, data }: { children: React.ReactNode; data: unknown[] }) => (
    <div data-testid="bar-chart" data-count={data.length}>{children}</div>
  ),
  Bar: ({ dataKey }: { dataKey: string }) => <div data-testid={`bar-${dataKey}`} />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  CartesianGrid: () => <div data-testid="grid" />,
}));

import CostChart from '../../../../src/renderer/components/analytics/CostChart';

describe('F16-T05: CostChart', () => {
  it('shows empty state when no data', () => {
    render(<CostChart data={[]} window="7d" onWindowChange={vi.fn()} />);
    expect(screen.getByText(/no cost data/i)).toBeInTheDocument();
  });

  it('renders bar chart with data', () => {
    const data = [
      { date: '2026-03-01', totalCostUsd: 0.10 },
      { date: '2026-03-02', totalCostUsd: 0.25 },
    ];
    render(<CostChart data={data} window="7d" onWindowChange={vi.fn()} />);
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toHaveAttribute('data-count', '2');
  });

  it('7d/30d toggle calls onWindowChange', () => {
    const onWindowChange = vi.fn();
    const data = [{ date: '2026-03-01', totalCostUsd: 0.10 }];
    render(<CostChart data={data} window="7d" onWindowChange={onWindowChange} />);

    const btn30d = screen.getByRole('button', { name: /30d/i });
    fireEvent.click(btn30d);
    expect(onWindowChange).toHaveBeenCalledWith('30d');
  });
});
