/**
 * Agents Dashboard Zustand Store (P05-F12)
 *
 * Manages UI state for the agents dashboard including
 * agent selection, logs, filters, and auto-refresh settings.
 *
 * Note: WebSocket connection state lives in eventStore, not here.
 * The eventStore.connected field is wired to actual WebSocket lifecycle
 * events in the WebSocketClient utility (see utils/websocket.ts).
 */

import { create } from 'zustand';
import type { AgentStatus, AgentLog, MetricsTimeRange, LogLevel } from '../types/agents';

// ============================================================================
// Types
// ============================================================================

export interface AgentsState {
  // Data state
  /** List of all agents */
  agents: AgentStatus[];
  /** Currently selected agent ID */
  selectedAgentId: string | null;
  /** Logs for selected agent */
  logs: AgentLog[];

  // Filter state
  /** Current time range for metrics/timeline */
  timeRange: MetricsTimeRange;
  /** Log level filter */
  logLevelFilter: LogLevel | null;
  /** Log search term */
  logSearchTerm: string;

  // UI state
  /** Whether auto-refresh is enabled */
  autoRefresh: boolean;
  /** Auto-refresh interval in milliseconds */
  refreshInterval: number;

  // Actions
  setAgents: (agents: AgentStatus[]) => void;
  selectAgent: (agentId: string | null) => void;
  setLogs: (logs: AgentLog[]) => void;
  addLog: (log: AgentLog) => void;
  setTimeRange: (range: MetricsTimeRange) => void;
  updateAgentStatus: (agentId: string, update: Partial<AgentStatus>) => void;
  toggleAutoRefresh: () => void;
  setAutoRefresh: (enabled: boolean) => void;
  setLogLevelFilter: (level: LogLevel | null) => void;
  setLogSearchTerm: (term: string) => void;
  reset: () => void;

  // Selectors (computed values)
  getSelectedAgent: () => AgentStatus | undefined;
  getEffectiveRefreshInterval: () => number | undefined;
}

// ============================================================================
// Constants
// ============================================================================

/** Default refresh interval (10 seconds for agent activity) */
export const DEFAULT_REFRESH_INTERVAL = 10000;

/** Default time range */
export const DEFAULT_TIME_RANGE: MetricsTimeRange = '1h';

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
  agents: [] as AgentStatus[],
  selectedAgentId: null as string | null,
  logs: [] as AgentLog[],
  timeRange: DEFAULT_TIME_RANGE,
  logLevelFilter: null as LogLevel | null,
  logSearchTerm: '',
  autoRefresh: true,
  refreshInterval: DEFAULT_REFRESH_INTERVAL,
};

// ============================================================================
// Store
// ============================================================================

export const useAgentsStore = create<AgentsState>((set, get) => ({
  ...initialState,

  setAgents: (agents) => set({ agents }),

  selectAgent: (agentId) => {
    const currentId = get().selectedAgentId;
    // Clear logs when selecting a different agent
    if (agentId !== currentId) {
      set({ selectedAgentId: agentId, logs: [] });
    } else {
      set({ selectedAgentId: agentId });
    }
  },

  setLogs: (logs) => set({ logs }),

  addLog: (log) =>
    set((state) => ({
      logs: [log, ...state.logs],
    })),

  setTimeRange: (range) => set({ timeRange: range }),

  updateAgentStatus: (agentId, update) =>
    set((state) => ({
      agents: state.agents.map((agent) =>
        agent.agent_id === agentId ? { ...agent, ...update } : agent
      ),
    })),

  toggleAutoRefresh: () =>
    set((state) => ({ autoRefresh: !state.autoRefresh })),

  setAutoRefresh: (enabled) => set({ autoRefresh: enabled }),

  setLogLevelFilter: (level) => set({ logLevelFilter: level }),

  setLogSearchTerm: (term) => set({ logSearchTerm: term }),

  reset: () => set(initialState),

  // Selectors
  getSelectedAgent: () => {
    const state = get();
    if (!state.selectedAgentId) return undefined;
    return state.agents.find((a) => a.agent_id === state.selectedAgentId);
  },

  getEffectiveRefreshInterval: () => {
    const state = get();
    return state.autoRefresh ? state.refreshInterval : undefined;
  },
}));

// ============================================================================
// Standalone Selectors (for optimized component subscriptions)
// ============================================================================

export const selectAgents = (state: AgentsState) => state.agents;
export const selectSelectedAgentId = (state: AgentsState) => state.selectedAgentId;
export const selectLogs = (state: AgentsState) => state.logs;
export const selectTimeRange = (state: AgentsState) => state.timeRange;
export const selectAutoRefresh = (state: AgentsState) => state.autoRefresh;
export const selectLogLevelFilter = (state: AgentsState) => state.logLevelFilter;
export const selectLogSearchTerm = (state: AgentsState) => state.logSearchTerm;

/**
 * Get agents by status
 */
export const selectAgentsByStatus = (status: AgentStatus['status']) => (state: AgentsState) =>
  state.agents.filter((a) => a.status === status);

/**
 * Get count of running agents
 */
export const selectRunningAgentsCount = (state: AgentsState) =>
  state.agents.filter((a) => a.status === 'running').length;

/**
 * Get count of error agents
 */
export const selectErrorAgentsCount = (state: AgentsState) =>
  state.agents.filter((a) => a.status === 'error').length;

/**
 * Get filtered logs based on level and search term
 */
export const selectFilteredLogs = (state: AgentsState) => {
  let logs = state.logs;

  if (state.logLevelFilter) {
    logs = logs.filter((log) => log.level === state.logLevelFilter);
  }

  if (state.logSearchTerm) {
    const searchLower = state.logSearchTerm.toLowerCase();
    logs = logs.filter((log) =>
      log.message.toLowerCase().includes(searchLower)
    );
  }

  return logs;
};
