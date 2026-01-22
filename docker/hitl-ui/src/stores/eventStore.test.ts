import { describe, it, expect, beforeEach } from 'vitest';
import { useEventStore } from './eventStore';

describe('eventStore', () => {
  beforeEach(() => {
    useEventStore.setState({
      connected: false,
      reconnecting: false,
      connectionError: null,
      events: [],
      maxEvents: 100,
      filter: null,
      autoScroll: true,
    });
  });

  it('manages connection state', () => {
    useEventStore.getState().setConnected(true);
    expect(useEventStore.getState().connected).toBe(true);

    useEventStore.getState().setConnectionError('Failed');
    const state = useEventStore.getState();
    expect(state.connectionError).toBe('Failed');
    expect(state.connected).toBe(false);
  });

  it('adds events with id and timestamp', () => {
    useEventStore.getState().addEvent({
      type: 'run_started',
      description: 'Test event',
      epicId: 'EPIC-001',
    });

    const { events } = useEventStore.getState();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('run_started');
    expect(events[0].id).toMatch(/^event-/);
    expect(events[0].timestamp).toBeInstanceOf(Date);
  });

  it('prunes events when max exceeded', () => {
    useEventStore.getState().setMaxEvents(2);

    useEventStore.getState().addEvent({ type: 'e1', description: 'Event 1' });
    useEventStore.getState().addEvent({ type: 'e2', description: 'Event 2' });
    useEventStore.getState().addEvent({ type: 'e3', description: 'Event 3' });

    const { events } = useEventStore.getState();
    expect(events).toHaveLength(2);
    expect(events[0].description).toBe('Event 2');
  });

  it('filters events by type', () => {
    useEventStore.getState().addEvent({ type: 'run_started', description: 'E1' });
    useEventStore.getState().addEvent({ type: 'run_completed', description: 'E2' });
    useEventStore.getState().addEvent({ type: 'run_started', description: 'E3' });

    useEventStore.getState().setFilter({ types: ['run_started'] });

    const filtered = useEventStore.getState().getFilteredEvents();
    expect(filtered).toHaveLength(2);
    expect(filtered.every((e) => e.type === 'run_started')).toBe(true);
  });
});
