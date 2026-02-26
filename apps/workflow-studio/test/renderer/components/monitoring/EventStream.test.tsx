import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { TelemetryEvent } from '../../../../src/shared/types/monitoring';

// ---------------------------------------------------------------------------
// Mock monitoringStore
// ---------------------------------------------------------------------------

let mockEvents: TelemetryEvent[] = [];

vi.mock('../../../../src/renderer/stores/monitoringStore', () => ({
  useMonitoringStore: (selector: (state: { events: TelemetryEvent[]; selectedAgentId: string | null }) => unknown) =>
    selector({ events: mockEvents, selectedAgentId: null }),
  selectFilteredEvents: (state: { events: TelemetryEvent[]; selectedAgentId: string | null }) => {
    if (state.selectedAgentId === null) return state.events;
    return state.events.filter((e) => e.agentId === state.selectedAgentId);
  },
}));

import EventStream from '../../../../src/renderer/components/monitoring/EventStream';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _counter = 0;

function makeEvent(overrides: Partial<TelemetryEvent> = {}): TelemetryEvent {
  _counter++;
  return {
    id: `event-${_counter}`,
    type: 'tool_call',
    agentId: 'agent-1',
    timestamp: new Date().toISOString(),
    data: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('T15: EventStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEvents = [];
    _counter = 0;
  });

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  it('renders "No events yet" when events array is empty', () => {
    mockEvents = [];
    render(<EventStream />);

    expect(screen.getByText(/no events yet/i)).toBeInTheDocument();
  });

  it('does not render a table when events array is empty', () => {
    mockEvents = [];
    render(<EventStream />);

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Event row rendering
  // -------------------------------------------------------------------------

  it('renders a table when events exist', () => {
    mockEvents = [makeEvent()];
    render(<EventStream />);

    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('renders a row for each event', () => {
    mockEvents = [
      makeEvent({ id: 'e-1' }),
      makeEvent({ id: 'e-2' }),
      makeEvent({ id: 'e-3' }),
    ];
    render(<EventStream />);

    const rows = screen.getAllByRole('row');
    // 1 header row + 3 data rows
    expect(rows.length).toBe(4);
  });

  it('renders the agent ID in event rows', () => {
    mockEvents = [makeEvent({ agentId: 'my-special-agent' })];
    render(<EventStream />);

    expect(screen.getByText('my-special-agent')).toBeInTheDocument();
  });

  it('renders the event type badge', () => {
    mockEvents = [makeEvent({ type: 'bash_command' })];
    render(<EventStream />);

    expect(screen.getByText('bash_command')).toBeInTheDocument();
  });

  it('renders column headers', () => {
    mockEvents = [makeEvent()];
    render(<EventStream />);

    const headers = screen.getAllByRole('columnheader');
    const headerTexts = headers.map((h) => h.textContent?.toLowerCase() ?? '');
    expect(headerTexts.some((t) => t.includes('time'))).toBe(true);
    expect(headerTexts.some((t) => t.includes('agent'))).toBe(true);
    expect(headerTexts.some((t) => t.includes('type'))).toBe(true);
    expect(headerTexts.some((t) => t.includes('tool'))).toBe(true);
    expect(headerTexts.some((t) => t.includes('details'))).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Error event styling
  // -------------------------------------------------------------------------

  it('error events have bg-red-50 class on the row', () => {
    mockEvents = [makeEvent({ id: 'err-1', type: 'agent_error' })];
    const { container } = render(<EventStream />);

    // Find all tr elements with bg-red-50
    const redRows = container.querySelectorAll('tr.bg-red-50');
    expect(redRows.length).toBeGreaterThan(0);
  });

  it('non-error events do not have bg-red-50 class', () => {
    mockEvents = [makeEvent({ id: 'ok-1', type: 'tool_call' })];
    const { container } = render(<EventStream />);

    const redRows = container.querySelectorAll('tr.bg-red-50');
    expect(redRows.length).toBe(0);
  });

  it('renders mixed error and normal events with correct styling', () => {
    mockEvents = [
      makeEvent({ id: 'ok-1', type: 'agent_start' }),
      makeEvent({ id: 'err-1', type: 'agent_error' }),
      makeEvent({ id: 'ok-2', type: 'tool_call' }),
    ];
    const { container } = render(<EventStream />);

    const redRows = container.querySelectorAll('tr.bg-red-50');
    expect(redRows.length).toBe(1);
  });

  // -------------------------------------------------------------------------
  // Tool/details extraction from data
  // -------------------------------------------------------------------------

  it('renders tool name from event data.toolName', () => {
    mockEvents = [makeEvent({ data: { toolName: 'ReadFile' } })];
    render(<EventStream />);

    expect(screen.getByText('ReadFile')).toBeInTheDocument();
  });

  it('renders dash when no tool name is available', () => {
    mockEvents = [makeEvent({ data: {} })];
    render(<EventStream />);

    // Multiple dashes expected (tool and details columns both show '-')
    const cells = screen.getAllByRole('cell');
    const dashCells = cells.filter((c) => c.textContent === '-');
    expect(dashCells.length).toBeGreaterThanOrEqual(1);
  });
});
