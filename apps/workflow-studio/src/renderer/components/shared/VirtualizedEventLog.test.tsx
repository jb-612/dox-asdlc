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

// ---------------------------------------------------------------------------
// F10-T05: VirtualizedEventLog enhancements
// ---------------------------------------------------------------------------

describe('VirtualizedEventLog enhancements (F10-T05)', () => {
  it('showAutoScrollToggle renders toggle button', () => {
    render(
      <VirtualizedEventLog
        events={[{ id: 1, msg: 'test' }]}
        formatter={mockFormatter}
        showAutoScrollToggle={true}
      />,
    );
    expect(screen.getByRole('button', { name: /auto-scroll/i })).toBeInTheDocument();
  });

  it('toggle button pauses and resumes auto-scroll', () => {
    render(
      <VirtualizedEventLog
        events={[{ id: 1, msg: 'test' }]}
        formatter={mockFormatter}
        showAutoScrollToggle={true}
      />,
    );

    const toggleBtn = screen.getByRole('button', { name: /auto-scroll/i });
    // Initially ON
    expect(toggleBtn.textContent).toContain('ON');

    fireEvent.click(toggleBtn);
    expect(toggleBtn.textContent).toContain('OFF');

    fireEvent.click(toggleBtn);
    expect(toggleBtn.textContent).toContain('ON');
  });

  it('filterPredicate hides non-matching events', () => {
    const events: MockEvent[] = [
      { id: 1, msg: 'keep this' },
      { id: 2, msg: 'hide this' },
      { id: 3, msg: 'keep also' },
    ];
    render(
      <VirtualizedEventLog
        events={events}
        formatter={mockFormatter}
        filterPredicate={(e) => e.msg.startsWith('keep')}
      />,
    );
    expect(screen.getByText('keep this')).toBeInTheDocument();
    expect(screen.getByText('keep also')).toBeInTheDocument();
    expect(screen.queryByText('hide this')).not.toBeInTheDocument();
  });

  it('searchText highlights matching text', () => {
    const events: MockEvent[] = [{ id: 1, msg: 'hello world' }];
    const { container } = render(
      <VirtualizedEventLog
        events={events}
        formatter={mockFormatter}
        searchText="world"
      />,
    );
    const mark = container.querySelector('mark');
    expect(mark).not.toBeNull();
    expect(mark?.textContent).toBe('world');
  });
});
