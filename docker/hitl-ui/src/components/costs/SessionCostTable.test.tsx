import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SessionCostTable from './SessionCostTable';
import type { CostRecord } from '../../types/costs';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const mockRecords: CostRecord[] = [
  {
    id: 1,
    session_id: 'sess-abc123def456',
    agent_id: 'pm',
    model: 'claude-opus-4-6',
    input_tokens: 1500,
    output_tokens: 800,
    estimated_cost_usd: 0.0825,
    timestamp: 1739180400, // Unix seconds
    tool_name: 'Read',
    hook_event_id: 1,
  },
  {
    id: 2,
    session_id: 'sess-xyz789ghi012',
    agent_id: 'backend',
    model: 'claude-sonnet-4-5',
    input_tokens: 3000,
    output_tokens: 1200,
    estimated_cost_usd: 0.027,
    timestamp: 1739182200, // Unix seconds
    tool_name: 'Write',
    hook_event_id: 2,
  },
];

describe('SessionCostTable', () => {
  it('renders rows matching data', () => {
    render(
      <Wrapper>
        <SessionCostTable
          records={mockRecords}
          total={2}
          page={1}
          pageSize={50}
          onPageChange={() => {}}
        />
      </Wrapper>
    );
    expect(screen.getByTestId('cost-table')).toBeInTheDocument();
    expect(screen.getByText('pm')).toBeInTheDocument();
    expect(screen.getByText('backend')).toBeInTheDocument();
  });

  it('shows empty state with no records', () => {
    render(
      <Wrapper>
        <SessionCostTable records={[]} total={0} page={1} pageSize={50} onPageChange={() => {}} />
      </Wrapper>
    );
    expect(screen.getByTestId('table-empty')).toBeInTheDocument();
  });

  it('sorts by cost column when header clicked', () => {
    render(
      <Wrapper>
        <SessionCostTable
          records={mockRecords}
          total={2}
          page={1}
          pageSize={50}
          onPageChange={() => {}}
        />
      </Wrapper>
    );
    const costHeader = screen.getByText('Cost');
    fireEvent.click(costHeader);
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBeGreaterThan(1);
  });

  it('shows record count', () => {
    render(
      <Wrapper>
        <SessionCostTable
          records={mockRecords}
          total={2}
          page={1}
          pageSize={50}
          onPageChange={() => {}}
        />
      </Wrapper>
    );
    expect(screen.getByText('2 records')).toBeInTheDocument();
  });
});
