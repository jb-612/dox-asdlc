import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { ExecutionCostSummary } from '../../../../src/shared/types/analytics';

// Mock recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ children, data }: { children: React.ReactNode; data: unknown[] }) => (
    <div data-testid="bar-chart" data-count={data.length}>{children}</div>
  ),
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  CartesianGrid: () => <div />,
}));

// Mock electronAPI with analytics namespace
const mockGetExecutions = vi.fn();
const mockGetDailyCosts = vi.fn();
vi.stubGlobal('electronAPI', {
  analytics: {
    getExecutions: mockGetExecutions,
    getDailyCosts: mockGetDailyCosts,
    onDataUpdated: vi.fn(() => vi.fn()),
  },
});

import AnalyticsTab from '../../../../src/renderer/components/analytics/AnalyticsTab';

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
    blockCosts: [],
    ...overrides,
  };
}

describe('F16-T10: AnalyticsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetExecutions.mockResolvedValue([]);
    mockGetDailyCosts.mockResolvedValue([]);
  });

  it('renders all child sections', () => {
    render(<AnalyticsTab />);
    expect(screen.getByText(/cost overview/i)).toBeInTheDocument();
    expect(screen.getByText('Executions')).toBeInTheDocument();
    expect(screen.getByText(/select an execution/i)).toBeInTheDocument();
  });

  it('renders execution data when available', async () => {
    const data = [makeSummary({ workflowName: 'My Workflow' })];
    mockGetExecutions.mockResolvedValue(data);
    mockGetDailyCosts.mockResolvedValue([{ date: '2026-03-01', totalCostUsd: 0.05 }]);

    render(<AnalyticsTab />);

    const workflowName = await screen.findByText('My Workflow');
    expect(workflowName).toBeInTheDocument();
  });

  it('renders without crashing when trace data absent', () => {
    render(<AnalyticsTab />);
    expect(screen.getByText(/cost overview/i)).toBeInTheDocument();
  });
});
