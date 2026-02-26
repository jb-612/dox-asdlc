import { create } from 'zustand';
import type {
  TelemetryEvent,
  AgentSession,
  TelemetryStats,
} from '../../shared/types/monitoring';

const MAX_EVENTS = 1000;

// ---------------------------------------------------------------------------
// IPC channel constant — must match the preload registration
// ---------------------------------------------------------------------------
const MONITORING_EVENT_CHANNEL = 'monitoring:event';

export interface MonitoringState {
  events: TelemetryEvent[];
  sessions: Map<string, AgentSession>;
  stats: TelemetryStats | null;
  receiverActive: boolean;
  selectedAgentId: string | null;
  selectedSessionId: string | null;

  pushEvent: (event: TelemetryEvent) => void;
  pushEvents: (events: TelemetryEvent[]) => void;
  upsertSession: (session: AgentSession) => void;
  setStats: (stats: TelemetryStats) => void;
  setReceiverActive: (active: boolean) => void;
  selectAgent: (agentId: string | null) => void;
  selectSession: (sessionId: string | null) => void;
  clearAll: () => void;
}

export const useMonitoringStore = create<MonitoringState>((set, get) => ({
  events: [],
  sessions: new Map(),
  stats: null,
  receiverActive: false,
  selectedAgentId: null,
  selectedSessionId: null,

  pushEvent: (event) => {
    set((state) => {
      const next = [...state.events, event];
      if (next.length > MAX_EVENTS) {
        next.splice(0, next.length - MAX_EVENTS);
      }
      return { events: next };
    });
  },

  pushEvents: (newEvents) => {
    set((state) => {
      const next = [...state.events, ...newEvents];
      if (next.length > MAX_EVENTS) {
        next.splice(0, next.length - MAX_EVENTS);
      }
      return { events: next };
    });
  },

  upsertSession: (session) => {
    set((state) => {
      const next = new Map(state.sessions);
      next.set(session.sessionId, session);
      return { sessions: next };
    });
  },

  setStats: (stats) => set({ stats }),

  setReceiverActive: (active) => set({ receiverActive: active }),

  selectAgent: (agentId) => set({ selectedAgentId: agentId }),

  selectSession: (sessionId) => set({ selectedSessionId: sessionId }),

  clearAll: () =>
    set({
      events: [],
      sessions: new Map(),
      stats: null,
      receiverActive: false,
      selectedAgentId: null,
      selectedSessionId: null,
    }),
}));

// ---------------------------------------------------------------------------
// IPC listener setup
// ---------------------------------------------------------------------------

/**
 * Subscribe to live telemetry push events from the main process.
 * Returns a cleanup function that removes the listener when called.
 *
 * Usage:
 *   const cleanup = initMonitoringListeners();
 *   // on unmount:
 *   cleanup();
 */
export function initMonitoringListeners(): () => void {
  window.electronAPI.monitoring.onEvent((event: unknown) => {
    useMonitoringStore.getState().pushEvent(event as TelemetryEvent);
  });

  return () => {
    window.electronAPI.removeListener(MONITORING_EVENT_CHANNEL);
  };
}

// ---------------------------------------------------------------------------
// Store hydration
// ---------------------------------------------------------------------------

/**
 * Fetch the initial snapshot of events, sessions, and stats from the main
 * process and populate the store.  Call once after the renderer mounts.
 */
export async function hydrateMonitoringStore(): Promise<void> {
  const store = useMonitoringStore.getState();

  const [events, sessionsArray, stats] = await Promise.all([
    window.electronAPI.monitoring.getEvents() as Promise<TelemetryEvent[]>,
    window.electronAPI.monitoring.getSessions() as Promise<AgentSession[]>,
    window.electronAPI.monitoring.getStats() as Promise<TelemetryStats>,
  ]);

  if (Array.isArray(events)) {
    store.pushEvents(events);
  }

  if (Array.isArray(sessionsArray)) {
    for (const session of sessionsArray) {
      store.upsertSession(session);
    }
  }

  if (stats != null) {
    store.setStats(stats);
  }
}

// ---------------------------------------------------------------------------
// Derived selectors
// ---------------------------------------------------------------------------

/**
 * Returns the filtered events list.
 * When selectedAgentId is set, only events for that agent are returned.
 * When selectedAgentId is null, all events are returned.
 *
 * Usage with React:
 *   const events = useMonitoringStore(selectFilteredEvents);
 */
export function selectFilteredEvents(state: MonitoringState): TelemetryEvent[] {
  if (state.selectedAgentId === null) {
    return state.events;
  }
  return state.events.filter((e) => e.agentId === state.selectedAgentId);
}
