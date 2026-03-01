import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ExecutionTable from '../../../../src/renderer/components/analytics/ExecutionTable';
import type { ExecutionCostSummary } from '../../../../src/shared/types/analytics';

function makeSummary(overrides: Partial<ExecutionCostSummary> = {}): ExecutionCostSummary {
  return {
    executionId: 'exec-1',
    workflowId: 'wf-1',
    workflowName: 'Test Workflow',
    status: 'completed',
    startedAt: '2026-03-01T12:00:00Z',
    completedAt: '2026-03-01T12:01:00Z',
    durationMs: 60000,
    totalInputTokens: 1000,
    totalOutputTokens: 500,
    totalCostUsd: 0.05,
    blockCosts: [],
    ...overrides,
  };
}

describe('F16-T06: ExecutionTable', () => {
  it('shows empty state when no data', () => {
    render(<ExecutionTable executions={[]} onSelect={vi.fn()} />);
    expect(screen.getByText(/no executions/i)).toBeInTheDocument();
  });

  it('renders rows for executions', () => {
    const data = [
      makeSummary({ executionId: 'exec-1', workflowName: 'Alpha' }),
      makeSummary({ executionId: 'exec-2', workflowName: 'Beta' }),
    ];
    render(<ExecutionTable executions={data} onSelect={vi.fn()} />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('row click calls onSelect with executionId', () => {
    const onSelect = vi.fn();
    render(<ExecutionTable executions={[makeSummary()]} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Test Workflow'));
    expect(onSelect).toHaveBeenCalledWith('exec-1');
  });

  it('shows N/A when totalCostUsd is 0', () => {
    render(
      <ExecutionTable
        executions={[makeSummary({ totalCostUsd: 0, totalInputTokens: 0, totalOutputTokens: 0 })]}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });
});
