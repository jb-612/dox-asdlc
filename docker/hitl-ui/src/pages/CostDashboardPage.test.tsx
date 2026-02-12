import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CostDashboardPage from './CostDashboardPage';
import type { CostSummaryResponse, CostRecordsResponse } from '../types/costs';

// Mock the API hooks
const mockSummary: CostSummaryResponse = {
  groups: [
    { key: 'pm', total_input_tokens: 100000, total_output_tokens: 50000, total_cost_usd: 5.25, record_count: 40 },
    { key: 'backend', total_input_tokens: 80000, total_output_tokens: 35000, total_cost_usd: 3.10, record_count: 30 },
  ],
  total_cost_usd: 8.35,
  total_input_tokens: 180000,
  total_output_tokens: 85000,
  period: { date_from: '2026-02-10T00:00:00Z', date_to: '2026-02-10T12:00:00Z' },
};

const mockRecords: CostRecordsResponse = {
  records: [
    {
      id: 1,
      session_id: 'sess-abc123',
      agent_id: 'pm',
      model: 'claude-opus-4-6',
      input_tokens: 1500,
      output_tokens: 800,
      estimated_cost_usd: 0.0825,
      timestamp: 1739180400,
      tool_name: 'Read',
      hook_event_id: 1,
    },
  ],
  total: 1,
  page: 1,
  page_size: 50,
};

vi.mock('../api/costs', () => ({
  useCostSummary: () => ({ data: mockSummary, isLoading: false, error: null, refetch: vi.fn() }),
  useCostRecords: () => ({ data: mockRecords, isLoading: false }),
  costsQueryKeys: { all: ['costs'] },
}));

// Mock recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pie: () => null,
  Cell: () => null,
  Legend: () => null,
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('CostDashboardPage', () => {
  it('renders page with all sections', () => {
    render(
      <Wrapper>
        <CostDashboardPage />
      </Wrapper>
    );
    expect(screen.getByTestId('cost-dashboard-page')).toBeInTheDocument();
    expect(screen.getByTestId('summary-section')).toBeInTheDocument();
    expect(screen.getByTestId('chart-section')).toBeInTheDocument();
    expect(screen.getByTestId('table-section')).toBeInTheDocument();
  });

  it('renders header with title', () => {
    render(
      <Wrapper>
        <CostDashboardPage />
      </Wrapper>
    );
    expect(screen.getByText('Cost Dashboard')).toBeInTheDocument();
  });

  it('renders time range filter', () => {
    render(
      <Wrapper>
        <CostDashboardPage />
      </Wrapper>
    );
    expect(screen.getByTestId('time-range-filter')).toBeInTheDocument();
  });

  it('renders auto-refresh toggle', () => {
    render(
      <Wrapper>
        <CostDashboardPage />
      </Wrapper>
    );
    const toggle = screen.getByTestId('auto-refresh-toggle');
    expect(toggle).toBeInTheDocument();
  });

  it('renders refresh button', () => {
    render(
      <Wrapper>
        <CostDashboardPage />
      </Wrapper>
    );
    expect(screen.getByTestId('page-refresh')).toBeInTheDocument();
  });
});
