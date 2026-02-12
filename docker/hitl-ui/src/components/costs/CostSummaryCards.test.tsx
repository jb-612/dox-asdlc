import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CostSummaryCards from './CostSummaryCards';
import type { CostSummaryResponse } from '../../types/costs';

const mockData: CostSummaryResponse = {
  groups: [
    { key: 'pm', total_input_tokens: 100000, total_output_tokens: 50000, total_cost_usd: 5.25, record_count: 40 },
    { key: 'backend', total_input_tokens: 80000, total_output_tokens: 35000, total_cost_usd: 3.10, record_count: 30 },
    { key: 'frontend', total_input_tokens: 20000, total_output_tokens: 10000, total_cost_usd: 0.90, record_count: 15 },
  ],
  total_cost_usd: 9.25,
  total_input_tokens: 200000,
  total_output_tokens: 95000,
  period: {
    date_from: '2026-02-10T00:00:00Z',
    date_to: '2026-02-10T12:00:00Z',
  },
};

describe('CostSummaryCards', () => {
  it('renders all 4 cards with correct values', () => {
    render(<CostSummaryCards data={mockData} />);
    expect(screen.getByTestId('cost-summary-cards')).toBeInTheDocument();
    expect(screen.getByText('$9.25')).toBeInTheDocument();
    expect(screen.getByText('pm')).toBeInTheDocument();
    expect(screen.getByText('295K')).toBeInTheDocument();
  });

  it('renders loading state when data is null', () => {
    render(<CostSummaryCards data={null} loading />);
    expect(screen.getByTestId('cost-summary-loading')).toBeInTheDocument();
  });

  it('renders loading state when loading is true', () => {
    render(<CostSummaryCards data={null} loading={true} />);
    expect(screen.getByTestId('cost-summary-loading')).toBeInTheDocument();
  });

  it('shows top agent name and cost', () => {
    render(<CostSummaryCards data={mockData} />);
    expect(screen.getByText('pm')).toBeInTheDocument();
    expect(screen.getByText('$5.25')).toBeInTheDocument();
  });

  it('handles zero cost data with null period', () => {
    const zeroData: CostSummaryResponse = {
      groups: [],
      total_cost_usd: 0,
      total_input_tokens: 0,
      total_output_tokens: 0,
      period: null,
    };
    render(<CostSummaryCards data={zeroData} />);
    expect(screen.getByText('$0.00')).toBeInTheDocument();
    const naElements = screen.getAllByText('N/A');
    expect(naElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('formats token subtitle correctly', () => {
    render(<CostSummaryCards data={mockData} />);
    expect(screen.getByText('200K in / 95K out')).toBeInTheDocument();
  });
});
