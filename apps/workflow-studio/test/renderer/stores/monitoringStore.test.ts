import { describe, it, expect, beforeEach } from 'vitest';
import { useMonitoringStore, selectFilteredEvents } from '../../../src/renderer/stores/monitoringStore';
import type { TelemetryEvent, AgentSession } from '../../../src/shared/types/monitoring';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<TelemetryEvent> = {}): TelemetryEvent {
  return {
    id: `event-${Math.random().toString(36).slice(2)}`,
    type: 'tool_call',
    agentId: 'agent-1',
    timestamp: new Date().toISOString(),
    data: {},
    ...overrides,
  };
}

function makeSession(overrides: Partial<AgentSession> = {}): AgentSession {
  return {
    sessionId: `session-${Math.random().toString(36).slice(2)}`,
    agentId: 'agent-1',
    startedAt: new Date().toISOString(),
    status: 'running',
    eventCount: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('T15: monitoringStore', () => {
  beforeEach(() => {
    useMonitoringStore.getState().clearAll();
  });

  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------

  it('has empty events array in initial state', () => {
    const state = useMonitoringStore.getState();
    expect(state.events).toEqual([]);
  });

  it('has empty sessions Map in initial state', () => {
    const state = useMonitoringStore.getState();
    expect(state.sessions.size).toBe(0);
  });

  it('has null selectedAgentId in initial state', () => {
    const state = useMonitoringStore.getState();
    expect(state.selectedAgentId).toBeNull();
  });

  it('has null stats in initial state', () => {
    const state = useMonitoringStore.getState();
    expect(state.stats).toBeNull();
  });

  it('has false receiverActive in initial state', () => {
    const state = useMonitoringStore.getState();
    expect(state.receiverActive).toBe(false);
  });

  // -------------------------------------------------------------------------
  // pushEvent
  // -------------------------------------------------------------------------

  it('pushEvent appends to events array', () => {
    const event = makeEvent({ id: 'e-1' });
    useMonitoringStore.getState().pushEvent(event);

    const events = useMonitoringStore.getState().events;
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe('e-1');
  });

  it('pushEvent appends multiple events in order', () => {
    const e1 = makeEvent({ id: 'e-1' });
    const e2 = makeEvent({ id: 'e-2' });
    useMonitoringStore.getState().pushEvent(e1);
    useMonitoringStore.getState().pushEvent(e2);

    const events = useMonitoringStore.getState().events;
    expect(events).toHaveLength(2);
    expect(events[0].id).toBe('e-1');
    expect(events[1].id).toBe('e-2');
  });

  // -------------------------------------------------------------------------
  // selectAgent
  // -------------------------------------------------------------------------

  it('selectAgent sets selectedAgentId', () => {
    useMonitoringStore.getState().selectAgent('agent-42');
    expect(useMonitoringStore.getState().selectedAgentId).toBe('agent-42');
  });

  it('selectAgent can set selectedAgentId back to null', () => {
    useMonitoringStore.getState().selectAgent('agent-42');
    useMonitoringStore.getState().selectAgent(null);
    expect(useMonitoringStore.getState().selectedAgentId).toBeNull();
  });

  // -------------------------------------------------------------------------
  // selectFilteredEvents
  // -------------------------------------------------------------------------

  it('selectFilteredEvents returns all events when selectedAgentId is null', () => {
    const e1 = makeEvent({ agentId: 'agent-1' });
    const e2 = makeEvent({ agentId: 'agent-2' });
    useMonitoringStore.getState().pushEvent(e1);
    useMonitoringStore.getState().pushEvent(e2);

    const filtered = selectFilteredEvents(useMonitoringStore.getState());
    expect(filtered).toHaveLength(2);
  });

  it('selectFilteredEvents filters by agentId when selectedAgentId is set', () => {
    const e1 = makeEvent({ id: 'e-1', agentId: 'agent-1' });
    const e2 = makeEvent({ id: 'e-2', agentId: 'agent-2' });
    const e3 = makeEvent({ id: 'e-3', agentId: 'agent-1' });

    useMonitoringStore.getState().pushEvent(e1);
    useMonitoringStore.getState().pushEvent(e2);
    useMonitoringStore.getState().pushEvent(e3);
    useMonitoringStore.getState().selectAgent('agent-1');

    const filtered = selectFilteredEvents(useMonitoringStore.getState());
    expect(filtered).toHaveLength(2);
    expect(filtered[0].id).toBe('e-1');
    expect(filtered[1].id).toBe('e-3');
  });

  it('selectFilteredEvents returns empty array when no events match the selected agent', () => {
    const e1 = makeEvent({ agentId: 'agent-1' });
    useMonitoringStore.getState().pushEvent(e1);
    useMonitoringStore.getState().selectAgent('agent-999');

    const filtered = selectFilteredEvents(useMonitoringStore.getState());
    expect(filtered).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // clearAll
  // -------------------------------------------------------------------------

  it('clearAll resets events to empty array', () => {
    useMonitoringStore.getState().pushEvent(makeEvent());
    useMonitoringStore.getState().clearAll();
    expect(useMonitoringStore.getState().events).toEqual([]);
  });

  it('clearAll resets sessions to empty Map', () => {
    useMonitoringStore.getState().upsertSession(makeSession());
    useMonitoringStore.getState().clearAll();
    expect(useMonitoringStore.getState().sessions.size).toBe(0);
  });

  it('clearAll resets selectedAgentId to null', () => {
    useMonitoringStore.getState().selectAgent('agent-1');
    useMonitoringStore.getState().clearAll();
    expect(useMonitoringStore.getState().selectedAgentId).toBeNull();
  });

  it('clearAll resets stats to null', () => {
    useMonitoringStore.getState().setStats({
      totalEvents: 10,
      errorRate: 0.05,
      eventsPerMinute: 2,
      activeSessions: 1,
      byType: {} as never,
    });
    useMonitoringStore.getState().clearAll();
    expect(useMonitoringStore.getState().stats).toBeNull();
  });

  it('clearAll resets receiverActive to false', () => {
    useMonitoringStore.getState().setReceiverActive(true);
    useMonitoringStore.getState().clearAll();
    expect(useMonitoringStore.getState().receiverActive).toBe(false);
  });

  // -------------------------------------------------------------------------
  // upsertSession
  // -------------------------------------------------------------------------

  it('upsertSession adds a new session by sessionId', () => {
    const session = makeSession({ sessionId: 'sess-1' });
    useMonitoringStore.getState().upsertSession(session);

    const sessions = useMonitoringStore.getState().sessions;
    expect(sessions.size).toBe(1);
    expect(sessions.get('sess-1')).toEqual(session);
  });

  it('upsertSession updates existing session', () => {
    const session = makeSession({ sessionId: 'sess-1', status: 'running' });
    useMonitoringStore.getState().upsertSession(session);

    const updated = { ...session, status: 'completed' as const };
    useMonitoringStore.getState().upsertSession(updated);

    expect(useMonitoringStore.getState().sessions.get('sess-1')?.status).toBe('completed');
  });
});
