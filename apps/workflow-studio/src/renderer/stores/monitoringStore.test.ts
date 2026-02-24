import { describe, it, expect, beforeEach } from 'vitest';
import { useMonitoringStore } from './monitoringStore';
import type { TelemetryEvent, AgentSession } from '../../shared/types/monitoring';

function makeEvent(id: string): TelemetryEvent {
  return {
    id,
    type: 'agent_start',
    agentId: 'backend',
    timestamp: '2026-01-01T00:00:00Z',
    data: null,
  };
}

function makeSession(sessionId: string): AgentSession {
  return {
    sessionId,
    agentId: 'backend',
    startedAt: '2026-01-01T00:00:00Z',
    status: 'running',
    eventCount: 0,
  };
}

describe('monitoringStore', () => {
  beforeEach(() => {
    useMonitoringStore.getState().clearAll();
  });

  it('pushEvent adds an event', () => {
    useMonitoringStore.getState().pushEvent(makeEvent('1'));
    expect(useMonitoringStore.getState().events).toHaveLength(1);
  });

  it('pushEvents adds multiple events', () => {
    useMonitoringStore
      .getState()
      .pushEvents([makeEvent('1'), makeEvent('2'), makeEvent('3')]);
    expect(useMonitoringStore.getState().events).toHaveLength(3);
  });

  it('enforces max 1000 events ring buffer', () => {
    const events = Array.from({ length: 1005 }, (_, i) => makeEvent(String(i)));
    useMonitoringStore.getState().pushEvents(events);
    expect(useMonitoringStore.getState().events).toHaveLength(1000);
    // Oldest events should have been trimmed
    expect(useMonitoringStore.getState().events[0].id).toBe('5');
  });

  it('upsertSession adds or updates a session', () => {
    useMonitoringStore.getState().upsertSession(makeSession('s1'));
    expect(useMonitoringStore.getState().sessions.size).toBe(1);

    useMonitoringStore
      .getState()
      .upsertSession({ ...makeSession('s1'), eventCount: 10 });
    expect(useMonitoringStore.getState().sessions.get('s1')!.eventCount).toBe(10);
  });

  it('setStats stores stats', () => {
    const stats = {
      totalEvents: 100,
      errorRate: 0.05,
      eventsPerMinute: 10,
      activeSessions: 2,
      byType: {} as Record<string, number>,
    };
    useMonitoringStore.getState().setStats(stats);
    expect(useMonitoringStore.getState().stats?.totalEvents).toBe(100);
  });

  it('selectAgent and selectSession set filters', () => {
    useMonitoringStore.getState().selectAgent('backend');
    expect(useMonitoringStore.getState().selectedAgentId).toBe('backend');

    useMonitoringStore.getState().selectSession('s1');
    expect(useMonitoringStore.getState().selectedSessionId).toBe('s1');
  });

  it('clearAll resets everything', () => {
    useMonitoringStore.getState().pushEvent(makeEvent('1'));
    useMonitoringStore.getState().upsertSession(makeSession('s1'));
    useMonitoringStore.getState().setReceiverActive(true);

    useMonitoringStore.getState().clearAll();

    const state = useMonitoringStore.getState();
    expect(state.events).toHaveLength(0);
    expect(state.sessions.size).toBe(0);
    expect(state.receiverActive).toBe(false);
  });
});
