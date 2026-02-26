// @vitest-environment node
// ---------------------------------------------------------------------------
// MonitoringStore unit tests (P15)
// ---------------------------------------------------------------------------
import { describe, it, expect, beforeEach } from 'vitest';
import { MonitoringStore } from '../../src/main/services/monitoring-store';
import type { TelemetryEvent } from '../../src/shared/types/monitoring';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _idCounter = 0;

function makeEvent(overrides: Partial<TelemetryEvent> = {}): TelemetryEvent {
  return {
    id: `evt-${++_idCounter}`,
    sessionId: 'sess-default',
    type: 'agent_start',
    agentId: 'agent-1',
    timestamp: new Date().toISOString(),
    data: null,
    ...overrides,
  };
}

/** Create an event with a lifecycle stage in data */
function makeLifecycleEvent(
  sessionId: string,
  lifecycleStage: string,
  timestamp?: string,
): TelemetryEvent {
  return makeEvent({
    sessionId,
    type: 'lifecycle',
    data: { lifecycleStage },
    timestamp: timestamp ?? new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// MonitoringStore tests
// ---------------------------------------------------------------------------

describe('MonitoringStore', () => {
  let store: MonitoringStore;

  beforeEach(() => {
    _idCounter = 0;
    store = new MonitoringStore();
  });

  // -------------------------------------------------------------------------
  // append() basic behaviour
  // -------------------------------------------------------------------------

  describe('append()', () => {
    it('adds an event to the store', () => {
      const event = makeEvent();
      store.append(event);

      const events = store.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(event);
    });

    it('emits "event" with the appended event', () => {
      const received: TelemetryEvent[] = [];
      store.on('event', (e) => received.push(e));

      const event = makeEvent();
      store.append(event);

      expect(received).toHaveLength(1);
      expect(received[0]).toEqual(event);
    });

    it('emits "event" for every appended event', () => {
      const received: TelemetryEvent[] = [];
      store.on('event', (e) => received.push(e));

      store.append(makeEvent());
      store.append(makeEvent());
      store.append(makeEvent());

      expect(received).toHaveLength(3);
    });
  });

  // -------------------------------------------------------------------------
  // Ring buffer: MAX_EVENTS = 10,000
  // -------------------------------------------------------------------------

  describe('ring buffer (MAX_EVENTS = 10,000)', () => {
    it('evicts the oldest event when the buffer exceeds 10,000 events', () => {
      const first = makeEvent({ sessionId: 'first-session' });
      store.append(first);

      // Fill buffer to exactly 10,000 (first event + 9,999 more)
      for (let i = 0; i < 9_999; i++) {
        store.append(makeEvent());
      }
      expect(store.getEvents()).toHaveLength(10_000);

      // Appending one more should evict the oldest
      store.append(makeEvent());

      const events = store.getEvents();
      expect(events).toHaveLength(10_000);
      expect(events.find((e) => e.id === first.id)).toBeUndefined();
    });

    it('keeps the most recent events after eviction', () => {
      const last = makeEvent({ id: 'evt-last' });

      for (let i = 0; i < 10_000; i++) {
        store.append(makeEvent());
      }
      store.append(last);

      const events = store.getEvents();
      expect(events[events.length - 1].id).toBe('evt-last');
    });
  });

  // -------------------------------------------------------------------------
  // Session tracking — creation
  // -------------------------------------------------------------------------

  describe('session tracking — creation', () => {
    it('creates a new session on first event for a sessionId', () => {
      store.append(makeEvent({ sessionId: 'sess-new' }));

      const sessions = store.getSessions();
      const session = sessions.find((s) => s.sessionId === 'sess-new');
      expect(session).toBeDefined();
      expect(session?.status).toBe('running');
    });

    it('does not create a duplicate session for repeated events', () => {
      store.append(makeEvent({ sessionId: 'sess-dup' }));
      store.append(makeEvent({ sessionId: 'sess-dup' }));
      store.append(makeEvent({ sessionId: 'sess-dup' }));

      const sessions = store.getSessions().filter((s) => s.sessionId === 'sess-dup');
      expect(sessions).toHaveLength(1);
    });

    it('increments eventCount for each appended event in a session', () => {
      store.append(makeEvent({ sessionId: 'sess-count' }));
      store.append(makeEvent({ sessionId: 'sess-count' }));

      const session = store.getSessions().find((s) => s.sessionId === 'sess-count')!;
      expect(session.eventCount).toBe(2);
    });

    it('initialises session with agentId and containerId from first event', () => {
      store.append(makeEvent({
        sessionId: 'sess-meta',
        agentId: 'agent-x',
        containerId: 'container-y',
      }));

      const session = store.getSessions().find((s) => s.sessionId === 'sess-meta')!;
      expect(session.agentId).toBe('agent-x');
      expect(session.containerId).toBe('container-y');
    });

    it('does not create a session for events with no sessionId', () => {
      const event: TelemetryEvent = {
        id: 'no-sid',
        type: 'metric',
        agentId: 'agent-1',
        timestamp: new Date().toISOString(),
        data: null,
      };
      store.append(event);

      expect(store.getSessions()).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Session tracking — lifecycle stages
  // -------------------------------------------------------------------------

  describe('session tracking — lifecycle stages', () => {
    it('sets completedAt and status="completed" on lifecycleStage "finalized"', () => {
      const ts = '2026-01-01T12:00:00.000Z';
      store.append(makeEvent({ sessionId: 'sess-final' }));
      store.append(makeLifecycleEvent('sess-final', 'finalized', ts));

      const session = store.getSessions().find((s) => s.sessionId === 'sess-final')!;
      expect(session.status).toBe('completed');
      expect(session.completedAt).toBe(ts);
    });

    it('sets status="failed" and completedAt on lifecycleStage "error"', () => {
      const ts = '2026-01-01T13:00:00.000Z';
      store.append(makeEvent({ sessionId: 'sess-err' }));
      store.append(makeLifecycleEvent('sess-err', 'error', ts));

      const session = store.getSessions().find((s) => s.sessionId === 'sess-err')!;
      expect(session.status).toBe('failed');
      expect(session.completedAt).toBe(ts);
    });

    it('increments errorCount on lifecycleStage "error"', () => {
      store.append(makeEvent({ sessionId: 'sess-errcnt' }));
      store.append(makeLifecycleEvent('sess-errcnt', 'error'));

      const session = store.getSessions().find((s) => s.sessionId === 'sess-errcnt')!;
      expect(session.errorCount).toBeGreaterThanOrEqual(1);
    });

    it('sets status="running" on lifecycleStage "start"', () => {
      store.append(makeLifecycleEvent('sess-start', 'start'));

      const session = store.getSessions().find((s) => s.sessionId === 'sess-start')!;
      expect(session.status).toBe('running');
    });
  });

  // -------------------------------------------------------------------------
  // getStats()
  // -------------------------------------------------------------------------

  describe('getStats()', () => {
    it('returns zero values when store is empty', () => {
      const stats = store.getStats();

      expect(stats.totalEvents).toBe(0);
      expect(stats.errorRate).toBe(0);
      expect(stats.activeSessions).toBe(0);
      expect(stats.totalCostUsd).toBe(0);
    });

    it('computes correct activeSessions count', () => {
      store.append(makeEvent({ sessionId: 'sess-active-1' }));
      store.append(makeEvent({ sessionId: 'sess-active-2' }));
      store.append(makeLifecycleEvent('sess-active-1', 'finalized'));

      const stats = store.getStats();
      expect(stats.activeSessions).toBe(1); // only sess-active-2 is still running
    });

    it('computes correct errorRate', () => {
      store.append(makeEvent({ type: 'agent_start' }));
      store.append(makeEvent({ type: 'agent_error' }));
      store.append(makeEvent({ type: 'agent_error' }));
      // 2 errors out of 3 total events
      const stats = store.getStats();
      expect(stats.errorRate).toBeCloseTo(2 / 3);
    });

    it('errorRate is 0 when there are no agent_error events', () => {
      store.append(makeEvent({ type: 'agent_start' }));
      store.append(makeEvent({ type: 'agent_complete' }));

      const stats = store.getStats();
      expect(stats.errorRate).toBe(0);
    });

    it('computes totalCostUsd by summing token usage across all events', () => {
      store.append(makeEvent({ tokenUsage: { inputTokens: 10, outputTokens: 5, estimatedCostUsd: 0.01 } }));
      store.append(makeEvent({ tokenUsage: { inputTokens: 20, outputTokens: 10, estimatedCostUsd: 0.02 } }));
      store.append(makeEvent()); // no cost

      const stats = store.getStats();
      expect(stats.totalCostUsd).toBeCloseTo(0.03);
    });

    it('totalCostUsd is 0 when no events have token usage', () => {
      store.append(makeEvent());
      store.append(makeEvent());

      const stats = store.getStats();
      expect(stats.totalCostUsd).toBe(0);
    });

    it('totalEvents reflects number of stored events', () => {
      store.append(makeEvent());
      store.append(makeEvent());
      store.append(makeEvent());

      const stats = store.getStats();
      expect(stats.totalEvents).toBe(3);
    });
  });

  // -------------------------------------------------------------------------
  // getEvents() filters
  // -------------------------------------------------------------------------

  describe('getEvents() filters', () => {
    beforeEach(() => {
      store.append(makeEvent({ sessionId: 'sess-a', type: 'agent_start' }));
      store.append(makeEvent({ sessionId: 'sess-a', type: 'agent_complete' }));
      store.append(makeEvent({ sessionId: 'sess-b', type: 'agent_error' }));
      store.append(makeEvent({ sessionId: 'sess-b', type: 'agent_start' }));
    });

    it('returns all events when no filter is provided', () => {
      const events = store.getEvents();
      expect(events).toHaveLength(4);
    });

    it('filters by sessionId', () => {
      const events = store.getEvents({ sessionId: 'sess-a' });
      expect(events).toHaveLength(2);
      events.forEach((e) => expect(e.sessionId).toBe('sess-a'));
    });

    it('filters by type', () => {
      const events = store.getEvents({ type: 'agent_error' });
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('agent_error');
    });

    it('can filter by both sessionId and type', () => {
      const events = store.getEvents({ sessionId: 'sess-b', type: 'agent_start' });
      expect(events).toHaveLength(1);
      expect(events[0].sessionId).toBe('sess-b');
      expect(events[0].type).toBe('agent_start');
    });

    it('respects limit (returns last N events)', () => {
      const events = store.getEvents({ limit: 2 });
      expect(events).toHaveLength(2);
    });

    it('limit combined with sessionId filter', () => {
      const events = store.getEvents({ sessionId: 'sess-a', limit: 1 });
      expect(events).toHaveLength(1);
      // Should be the last matching event
      expect(events[0].type).toBe('agent_complete');
    });

    it('returns empty array when no events match filter', () => {
      const events = store.getEvents({ sessionId: 'sess-nonexistent' });
      expect(events).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // clear()
  // -------------------------------------------------------------------------

  describe('clear()', () => {
    it('removes all events', () => {
      store.append(makeEvent());
      store.append(makeEvent());

      store.clear();

      expect(store.getEvents()).toHaveLength(0);
    });

    it('removes all sessions', () => {
      store.append(makeEvent({ sessionId: 'sess-clear' }));

      store.clear();

      expect(store.getSessions()).toHaveLength(0);
    });

    it('resets stats to zero', () => {
      store.append(makeEvent({ type: 'agent_error' }));

      store.clear();

      const stats = store.getStats();
      expect(stats.totalEvents).toBe(0);
      expect(stats.errorRate).toBe(0);
      expect(stats.activeSessions).toBe(0);
    });

    it('store can be used normally after clear()', () => {
      store.append(makeEvent());
      store.clear();
      store.append(makeEvent({ sessionId: 'sess-after-clear' }));

      expect(store.getEvents()).toHaveLength(1);
      expect(store.getSessions()).toHaveLength(1);
    });
  });
});
