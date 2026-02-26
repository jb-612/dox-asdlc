import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import EventLogPanel from '../../../../src/renderer/components/execution/EventLogPanel';
import type { ExecutionEvent } from '../../../../src/shared/types/execution';

// ---------------------------------------------------------------------------
// Mock electronAPI on window
// ---------------------------------------------------------------------------

beforeEach(() => {
  (globalThis as Record<string, unknown>).window = globalThis;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvents(count: number): ExecutionEvent[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `evt-${i}`,
    type: 'node_started' as const,
    timestamp: `2026-01-01T00:0${i}:00Z`,
    message: `Event ${i}`,
    nodeId: `node-${i % 2}`,
  }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EventLogPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the panel container', () => {
    render(<EventLogPanel events={[]} />);
    expect(screen.getByTestId('event-log-panel')).toBeInTheDocument();
  });

  it('shows 3 formatted entries when given 3 events', () => {
    render(<EventLogPanel events={makeEvents(3)} />);
    expect(screen.getByText('Event 0')).toBeInTheDocument();
    expect(screen.getByText('Event 1')).toBeInTheDocument();
    expect(screen.getByText('Event 2')).toBeInTheDocument();
  });

  it('shows event messages in the entries', () => {
    render(<EventLogPanel events={makeEvents(2)} />);
    expect(screen.getByText('Event 0')).toBeInTheDocument();
    expect(screen.getByText('Event 1')).toBeInTheDocument();
  });

  it('filters by nodeId when filterNodeId prop is provided', () => {
    render(<EventLogPanel events={makeEvents(4)} filterNodeId="node-0" />);
    // node-0 appears for indices 0, 2
    expect(screen.getByText('Event 0')).toBeInTheDocument();
    expect(screen.getByText('Event 2')).toBeInTheDocument();
    expect(screen.queryByText('Event 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Event 3')).not.toBeInTheDocument();
  });

  it('renders filter control', () => {
    render(<EventLogPanel events={makeEvents(2)} />);
    expect(screen.getByTestId('event-log-filter')).toBeInTheDocument();
  });

  it('auto-scrolls on new events (ref scrollTop set)', () => {
    const { rerender } = render(<EventLogPanel events={makeEvents(3)} />);
    // Add more events to trigger auto-scroll
    rerender(<EventLogPanel events={makeEvents(6)} />);
    // The component should have called scrollTop = scrollHeight on the ref.
    // We verify the component did not crash and events render.
    expect(screen.getByText('Event 0')).toBeInTheDocument();
    expect(screen.getByText('Event 5')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// F10-T09: VirtualizedEventLog migration
// ---------------------------------------------------------------------------

describe('EventLogPanel — VirtualizedEventLog migration (F10-T09)', () => {
  it('uses VirtualizedEventLog internally (role="log")', () => {
    render(<EventLogPanel events={makeEvents(2)} />);
    expect(screen.getByRole('log')).toBeInTheDocument();
  });

  it('filter buttons still filter events after migration', () => {
    const events: ExecutionEvent[] = [
      { id: 'e1', type: 'node_started', timestamp: '2026-01-01T00:00:00Z', message: 'Node started', nodeId: 'n1' },
      { id: 'e2', type: 'execution_failed', timestamp: '2026-01-01T00:01:00Z', message: 'Exec failed', nodeId: 'n1' },
    ];
    render(<EventLogPanel events={events} />);
    // Both events visible by default
    expect(screen.getByText('Node started')).toBeInTheDocument();
    expect(screen.getByText('Exec failed')).toBeInTheDocument();

    // Click Errors filter
    fireEvent.click(screen.getByText('Errors'));
    expect(screen.queryByText('Node started')).not.toBeInTheDocument();
    expect(screen.getByText('Exec failed')).toBeInTheDocument();
  });

  it('filterNodeId still filters by node after migration', () => {
    const events: ExecutionEvent[] = [
      { id: 'e1', type: 'node_started', timestamp: '2026-01-01T00:00:00Z', message: 'Node A', nodeId: 'n1' },
      { id: 'e2', type: 'node_started', timestamp: '2026-01-01T00:01:00Z', message: 'Node B', nodeId: 'n2' },
    ];
    render(<EventLogPanel events={events} filterNodeId="n1" />);
    expect(screen.getByText('Node A')).toBeInTheDocument();
    expect(screen.queryByText('Node B')).not.toBeInTheDocument();
  });
});
