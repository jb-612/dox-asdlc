import { create } from 'zustand';
import type {
  TelemetryEvent,
  AgentSession,
  TelemetryStats,
} from '../../shared/types/monitoring';

const MAX_EVENTS = 1000;

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
