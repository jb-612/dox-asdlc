import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { VirtualizedEventLog } from './VirtualizedEventLog';
import type { FormattedEvent } from './eventFormatter';

interface MockEvent {
  id: number;
  msg: string;
}

const mockFormatter = (e: MockEvent): FormattedEvent => ({
  icon: '>',
  label: `Event ${e.id}`,
  detail: e.msg,
  timestamp: '2026-01-01T00:00:00Z',
  severity: 'info',
});

describe('VirtualizedEventLog', () => {
  it('shows "No events yet" when events is empty', () => {
    render(
      <VirtualizedEventLog events={[]} formatter={mockFormatter} />,
    );
    expect(screen.getByText('No events yet')).toBeInTheDocument();
  });

  it('renders visible events', () => {
    const events: MockEvent[] = [
      { id: 1, msg: 'first' },
      { id: 2, msg: 'second' },
    ];
    render(
      <VirtualizedEventLog events={events} formatter={mockFormatter} />,
    );
    expect(screen.getByText('Event 1')).toBeInTheDocument();
    expect(screen.getByText('Event 2')).toBeInTheDocument();
    expect(screen.getByText('first')).toBeInTheDocument();
  });

  it('calls onEventClick when a row is clicked', () => {
    const onClick = vi.fn();
    const events: MockEvent[] = [{ id: 1, msg: 'click me' }];
    render(
      <VirtualizedEventLog
        events={events}
        formatter={mockFormatter}
        onEventClick={onClick}
      />,
    );
    fireEvent.click(screen.getByText('click me'));
    expect(onClick).toHaveBeenCalledWith({ id: 1, msg: 'click me' });
  });

  it('has role="log" for accessibility', () => {
    render(
      <VirtualizedEventLog events={[]} formatter={mockFormatter} />,
    );
    expect(screen.getByRole('log')).toBeInTheDocument();
  });
});
