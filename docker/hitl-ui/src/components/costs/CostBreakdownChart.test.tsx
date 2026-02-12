import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CostBreakdownChart from './CostBreakdownChart';
import type { CostSummaryResponse } from '../../types/costs';

// Mock recharts to avoid canvas issues in tests
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="recharts-bar">{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="recharts-pie">{children}</div>,
  Pie: () => null,
  Cell: () => null,
  Legend: () => null,
}));

const mockData: CostSummaryResponse = {
  groups: [
    { key: 'pm', total_input_tokens: 100000, total_output_tokens: 50000, total_cost_usd: 5.25, record_count: 40 },
    { key: 'backend', total_input_tokens: 80000, total_output_tokens: 35000, total_cost_usd: 3.10, record_count: 30 },
  ],
  total_cost_usd: 8.35,
  total_input_tokens: 180000,
  total_output_tokens: 85000,
  period: { from: '2026-02-10T00:00:00Z', to: '2026-02-10T12:00:00Z' },
};

describe('CostBreakdownChart', () => {
  it('renders bar chart in agent mode', () => {
    render(<CostBreakdownChart data={mockData} mode="agent" onModeChange={() => {}} />);
    expect(screen.getByTestId('chart-bar')).toBeInTheDocument();
  });

  it('renders pie chart in model mode', () => {
    render(<CostBreakdownChart data={mockData} mode="model" onModeChange={() => {}} />);
    expect(screen.getByTestId('chart-pie')).toBeInTheDocument();
  });

  it('calls onModeChange when toggle is clicked', () => {
    const onModeChange = vi.fn();
    render(<CostBreakdownChart data={mockData} mode="agent" onModeChange={onModeChange} />);
    fireEvent.click(screen.getByTestId('mode-model'));
    expect(onModeChange).toHaveBeenCalledWith('model');
  });

  it('shows empty state when no data', () => {
    const emptyData: CostSummaryResponse = {
      groups: [],
      total_cost_usd: 0,
      total_input_tokens: 0,
      total_output_tokens: 0,
      period: { from: '2026-02-10T00:00:00Z', to: '2026-02-10T12:00:00Z' },
    };
    render(<CostBreakdownChart data={emptyData} mode="agent" onModeChange={() => {}} />);
    expect(screen.getByTestId('chart-empty')).toBeInTheDocument();
  });

  it('shows empty state when data is null', () => {
    render(<CostBreakdownChart data={null} mode="agent" onModeChange={() => {}} />);
    expect(screen.getByTestId('chart-empty')).toBeInTheDocument();
  });
});
