import { create } from 'zustand';

export interface SystemEvent {
  id: string;
  type: string;
  epicId?: string;
  agentType?: string;
  runId?: string;
  timestamp: Date;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface EventFilter {
  types?: string[];
  epicIds?: string[];
  agentTypes?: string[];
}

interface EventState {
  // Connection state
  connected: boolean;
  reconnecting: boolean;
  connectionError: string | null;

  // Events
  events: SystemEvent[];
  maxEvents: number;

  // Filter
  filter: EventFilter | null;

  // Auto-scroll state
  autoScroll: boolean;

  // Actions
  connect: () => void;
  disconnect: () => void;
  setConnected: (connected: boolean) => void;
  setReconnecting: (reconnecting: boolean) => void;
  setConnectionError: (error: string | null) => void;

  addEvent: (event: Omit<SystemEvent, 'id' | 'timestamp'>) => void;
  clearEvents: () => void;

  setFilter: (filter: EventFilter | null) => void;
  getFilteredEvents: () => SystemEvent[];

  setAutoScroll: (enabled: boolean) => void;

  setMaxEvents: (max: number) => void;
}

const DEFAULT_STATE = {
  connected: false,
  reconnecting: false,
  connectionError: null,
  events: [],
  maxEvents: 100,
  filter: null,
  autoScroll: true,
};

export const useEventStore = create<EventState>((set, get) => ({
  ...DEFAULT_STATE,

  connect: () => {
    set({ connected: false, reconnecting: true, connectionError: null });
    // Actual connection logic will be in WebSocket utility
  },

  disconnect: () => {
    set({ connected: false, reconnecting: false, connectionError: null });
    // Actual disconnection logic will be in WebSocket utility
  },

  setConnected: (connected) =>
    set({ connected, reconnecting: false, connectionError: null }),

  setReconnecting: (reconnecting) => set({ reconnecting }),

  setConnectionError: (error) =>
    set({ connectionError: error, connected: false, reconnecting: false }),

  addEvent: (eventData) => {
    const newEvent: SystemEvent = {
      ...eventData,
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    set((state) => {
      const events = [...state.events, newEvent];

      // Prune old events if exceeding max
      if (events.length > state.maxEvents) {
        return {
          events: events.slice(events.length - state.maxEvents),
        };
      }

      return { events };
    });
  },

  clearEvents: () => set({ events: [] }),

  setFilter: (filter) => set({ filter }),

  getFilteredEvents: () => {
    const { events, filter } = get();

    if (!filter) {
      return events;
    }

    return events.filter((event) => {
      if (filter.types && !filter.types.includes(event.type)) {
        return false;
      }

      if (filter.epicIds && event.epicId && !filter.epicIds.includes(event.epicId)) {
        return false;
      }

      if (filter.agentTypes && event.agentType && !filter.agentTypes.includes(event.agentType)) {
        return false;
      }

      return true;
    });
  },

  setAutoScroll: (enabled) => set({ autoScroll: enabled }),

  setMaxEvents: (max) => set({ maxEvents: max }),
}));
