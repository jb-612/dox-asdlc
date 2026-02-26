import { EventEmitter } from 'node:events';
import type {
  TelemetryEvent,
  TelemetryEventType,
  TelemetryStats,
  AgentSession,
  AgentSessionStatus,
} from '../../shared/types/monitoring.js';

const MAX_EVENTS = 10_000;

export interface EventFilter {
  sessionId?: string;
  type?: TelemetryEventType;
  since?: string;
  limit?: number;
}

export class MonitoringStore extends EventEmitter {
  private events: TelemetryEvent[] = [];
  private sessions: Map<string, AgentSession> = new Map();

  append(event: TelemetryEvent): void {
    if (this.events.length >= MAX_EVENTS) {
      this.events.shift();
    }
    this.events.push(event);

    if (event.sessionId) {
      this._updateSession(event);
    }

    this.emit('event', event);
  }

  private _updateSession(event: TelemetryEvent): void {
    const sid = event.sessionId!;
    const existing = this.sessions.get(sid);

    if (!existing) {
      const session: AgentSession = {
        sessionId: sid,
        agentId: event.agentId,
        startedAt: event.timestamp,
        status: 'running',
        eventCount: 0,
        containerId: event.containerId,
        totalCostUsd: 0,
        errorCount: 0,
      };
      this.sessions.set(sid, session);
    }

    const session = this.sessions.get(sid)!;
    session.eventCount += 1;

    if (event.tokenUsage?.estimatedCostUsd != null) {
      session.totalCostUsd = (session.totalCostUsd ?? 0) + event.tokenUsage.estimatedCostUsd;
    }

    const data = event.data as Record<string, unknown> | null;
    const lifecycleStage =
      typeof data === 'object' && data !== null && 'lifecycleStage' in data
        ? (data.lifecycleStage as string)
        : undefined;

    if (lifecycleStage === 'start') {
      session.startedAt = event.timestamp;
      session.status = 'running' as AgentSessionStatus;
    } else if (lifecycleStage === 'finalized') {
      session.completedAt = event.timestamp;
      session.status = 'completed' as AgentSessionStatus;
    } else if (lifecycleStage === 'error') {
      session.completedAt = event.timestamp;
      session.status = 'failed' as AgentSessionStatus;
      session.errorCount = (session.errorCount ?? 0) + 1;
    }

    if (event.type === 'agent_error') {
      session.errorCount = (session.errorCount ?? 0) + 1;
    }
  }

  getEvents(filter?: EventFilter): TelemetryEvent[] {
    let result = this.events;

    if (filter?.sessionId !== undefined) {
      result = result.filter((e) => e.sessionId === filter.sessionId);
    }
    if (filter?.type !== undefined) {
      result = result.filter((e) => e.type === filter.type);
    }
    if (filter?.since !== undefined) {
      const since = filter.since;
      result = result.filter((e) => e.timestamp >= since);
    }
    if (filter?.limit !== undefined) {
      result = result.slice(-filter.limit);
    }

    return result;
  }

  getSessions(): AgentSession[] {
    const all = Array.from(this.sessions.values());
    return all.sort((a, b) => {
      const aActive = a.status === 'running' ? 0 : 1;
      const bActive = b.status === 'running' ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return b.startedAt.localeCompare(a.startedAt);
    });
  }

  getStats(): TelemetryStats {
    const byType = {} as Record<TelemetryEventType, number>;
    let totalCostUsd = 0;
    let errorCount = 0;

    for (const e of this.events) {
      byType[e.type] = (byType[e.type] ?? 0) + 1;
      if (e.tokenUsage?.estimatedCostUsd != null) {
        totalCostUsd += e.tokenUsage.estimatedCostUsd;
      }
      if (e.type === 'agent_error') errorCount += 1;
    }

    const total = this.events.length;
    const errorRate = total > 0 ? errorCount / total : 0;

    const activeSessions = Array.from(this.sessions.values()).filter(
      (s) => s.status === 'running',
    ).length;

    let eventsPerMinute = 0;
    if (total > 0) {
      const oldest = this.events[0].timestamp;
      const newest = this.events[total - 1].timestamp;
      const spanMs = new Date(newest).getTime() - new Date(oldest).getTime();
      if (spanMs > 0) {
        eventsPerMinute = (total / spanMs) * 60_000;
      }
    }

    return {
      totalEvents: total,
      errorRate,
      eventsPerMinute,
      activeSessions,
      byType,
      totalCostUsd,
    };
  }

  clear(): void {
    this.events = [];
    this.sessions = new Map();
  }
}
