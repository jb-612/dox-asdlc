import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import CostBreakdown from '../../../../src/renderer/components/analytics/CostBreakdown';
import type { ExecutionCostSummary } from '../../../../src/shared/types/analytics';

function makeSummary(overrides: Partial<ExecutionCostSummary> = {}): ExecutionCostSummary {
  return {
    executionId: 'exec-1',
    workflowId: 'wf-1',
    workflowName: 'Test',
    status: 'completed',
    startedAt: '2026-03-01T12:00:00Z',
    completedAt: '2026-03-01T12:01:00Z',
    durationMs: 60000,
    totalInputTokens: 1000,
    totalOutputTokens: 500,
    totalCostUsd: 0.05,
    blockCosts: [
      { blockId: 'b1', nodeId: 'n1', inputTokens: 600, outputTokens: 300, estimatedCostUsd: 0.03 },
      { blockId: 'b2', nodeId: 'n2', inputTokens: 400, outputTokens: 200, estimatedCostUsd: 0.02 },
    ],
    ...overrides,
  };
}

describe('F16-T09: CostBreakdown', () => {
  it('shows placeholder when no execution selected', () => {
    render(<CostBreakdown execution={null} />);
    expect(screen.getByText(/select an execution/i)).toBeInTheDocument();
  });

  it('renders block rows', () => {
    render(<CostBreakdown execution={makeSummary()} />);
    expect(screen.getByText('b1')).toBeInTheDocument();
    expect(screen.getByText('b2')).toBeInTheDocument();
  });

  it('shows N/A for missing cost', () => {
    const summary = makeSummary({
      blockCosts: [
        { blockId: 'b1', nodeId: 'n1', inputTokens: 100, outputTokens: 50 },
      ],
    });
    render(<CostBreakdown execution={summary} />);
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('shows total row', () => {
    render(<CostBreakdown execution={makeSummary()} />);
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('$0.0500')).toBeInTheDocument();
  });
});
