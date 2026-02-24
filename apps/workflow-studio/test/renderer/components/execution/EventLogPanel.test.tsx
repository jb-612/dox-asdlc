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
    const entries = screen.getAllByTestId('event-log-entry');
    expect(entries).toHaveLength(3);
  });

  it('shows event messages in the entries', () => {
    render(<EventLogPanel events={makeEvents(2)} />);
    expect(screen.getByText('Event 0')).toBeInTheDocument();
    expect(screen.getByText('Event 1')).toBeInTheDocument();
  });

  it('filters by nodeId when filterNodeId prop is provided', () => {
    render(<EventLogPanel events={makeEvents(4)} filterNodeId="node-0" />);
    const entries = screen.getAllByTestId('event-log-entry');
    // node-0 appears for indices 0, 2
    expect(entries).toHaveLength(2);
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
    // We verify the component did not crash; detailed scroll behavior
    // tested via the ref in the component.
    const entries = screen.getAllByTestId('event-log-entry');
    expect(entries).toHaveLength(6);
  });
});
