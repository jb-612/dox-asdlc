import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { TelemetryStats } from '../../../../src/shared/types/monitoring';

// ---------------------------------------------------------------------------
// Mock monitoringStore
// ---------------------------------------------------------------------------

let mockStats: TelemetryStats | null = null;

vi.mock('../../../../src/renderer/stores/monitoringStore', () => ({
  useMonitoringStore: (selector: (state: { stats: TelemetryStats | null }) => unknown) =>
    selector({ stats: mockStats }),
}));

import SummaryCards from '../../../../src/renderer/components/monitoring/SummaryCards';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStats(overrides: Partial<TelemetryStats> = {}): TelemetryStats {
  return {
    totalEvents: 42,
    activeSessions: 3,
    errorRate: 0.05,
    eventsPerMinute: 10,
    byType: {} as TelemetryStats['byType'],
    totalCostUsd: 0.1234,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('T15: SummaryCards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStats = null;
  });

  // -------------------------------------------------------------------------
  // Label rendering
  // -------------------------------------------------------------------------

  it('renders all four metric labels', () => {
    render(<SummaryCards />);

    expect(screen.getByText(/total events/i)).toBeInTheDocument();
    expect(screen.getByText(/active sessions/i)).toBeInTheDocument();
    expect(screen.getByText(/error rate/i)).toBeInTheDocument();
    expect(screen.getByText(/total cost/i)).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Values from store stats
  // -------------------------------------------------------------------------

  it('renders correct totalEvents value from stats', () => {
    mockStats = makeStats({ totalEvents: 99 });
    render(<SummaryCards />);

    expect(screen.getByText('99')).toBeInTheDocument();
  });

  it('renders correct activeSessions value from stats', () => {
    mockStats = makeStats({ activeSessions: 7 });
    render(<SummaryCards />);

    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('renders error rate formatted as percentage', () => {
    mockStats = makeStats({ errorRate: 0.125 });
    render(<SummaryCards />);

    expect(screen.getByText('12.5%')).toBeInTheDocument();
  });

  it('renders total cost formatted as dollar amount', () => {
    mockStats = makeStats({ totalCostUsd: 0.1234 });
    render(<SummaryCards />);

    expect(screen.getByText('$0.1234')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Null/zero stats (graceful defaults)
  // -------------------------------------------------------------------------

  it('renders zero totalEvents when stats is null', () => {
    mockStats = null;
    render(<SummaryCards />);

    // Both totalEvents and activeSessions default to 0, so multiple "0" elements exist
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThanOrEqual(1);
  });

  it('renders 0.0% error rate when stats is null', () => {
    mockStats = null;
    render(<SummaryCards />);

    expect(screen.getByText('0.0%')).toBeInTheDocument();
  });

  it('renders $0.0000 cost when stats is null', () => {
    mockStats = null;
    render(<SummaryCards />);

    expect(screen.getByText('$0.0000')).toBeInTheDocument();
  });

  it('renders zero activeSessions when stats is null', () => {
    mockStats = null;
    render(<SummaryCards />);

    // totalEvents=0 and activeSessions=0 both render as "0"
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThanOrEqual(2);
  });

  it('renders $0.0000 when totalCostUsd is undefined', () => {
    mockStats = makeStats({ totalCostUsd: undefined });
    render(<SummaryCards />);

    expect(screen.getByText('$0.0000')).toBeInTheDocument();
  });

  it('renders 0.0% error rate when errorRate is 0', () => {
    mockStats = makeStats({ errorRate: 0 });
    render(<SummaryCards />);

    expect(screen.getByText('0.0%')).toBeInTheDocument();
  });
});
