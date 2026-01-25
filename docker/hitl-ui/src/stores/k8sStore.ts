/**
 * Kubernetes Dashboard Zustand Store
 * Manages UI state for the K8s visibility dashboard
 */

import { create } from 'zustand';
import type { K8sPod, K8sNode, MetricsInterval } from '../api/types/kubernetes';

// ============================================================================
// Types
// ============================================================================

export interface CommandHistoryEntry {
  id: string;
  command: string;
  output: string;
  success: boolean;
  timestamp: string;
  duration: number;
}

export interface K8sState {
  // Selected resources
  selectedNamespace: string | null;
  selectedPod: K8sPod | null;
  selectedNode: K8sNode | null;

  // UI state
  drawerOpen: boolean;
  metricsInterval: MetricsInterval;

  // Terminal state
  terminalHistory: CommandHistoryEntry[];
  terminalInput: string;

  // Actions
  setSelectedNamespace: (namespace: string | null) => void;
  setSelectedPod: (pod: K8sPod | null) => void;
  setSelectedNode: (node: K8sNode | null) => void;
  setDrawerOpen: (open: boolean) => void;
  setMetricsInterval: (interval: MetricsInterval) => void;
  addTerminalCommand: (
    command: string,
    output: string,
    success: boolean,
    duration: number
  ) => void;
  setTerminalInput: (input: string) => void;
  clearTerminal: () => void;
  getCommandHistory: () => string[];
  reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const MAX_TERMINAL_HISTORY = 100;

const initialState = {
  selectedNamespace: null,
  selectedPod: null,
  selectedNode: null,
  drawerOpen: false,
  metricsInterval: '5m' as MetricsInterval,
  terminalHistory: [] as CommandHistoryEntry[],
  terminalInput: '',
};

// ============================================================================
// Store
// ============================================================================

export const useK8sStore = create<K8sState>((set, get) => ({
  ...initialState,

  // Selection actions
  setSelectedNamespace: (namespace) =>
    set({ selectedNamespace: namespace }),

  setSelectedPod: (pod) =>
    set({
      selectedPod: pod,
      drawerOpen: pod !== null,
    }),

  setSelectedNode: (node) =>
    set({ selectedNode: node }),

  // UI actions
  setDrawerOpen: (open) =>
    set({
      drawerOpen: open,
      // Clear selected pod when drawer closes
      ...(open ? {} : { selectedPod: null }),
    }),

  setMetricsInterval: (interval) =>
    set({ metricsInterval: interval }),

  // Terminal actions
  addTerminalCommand: (command, output, success, duration) =>
    set((state) => {
      const entry: CommandHistoryEntry = {
        id: `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        command,
        output,
        success,
        timestamp: new Date().toISOString(),
        duration,
      };

      // Keep only the last MAX_TERMINAL_HISTORY entries
      const newHistory = [...state.terminalHistory, entry].slice(-MAX_TERMINAL_HISTORY);

      return {
        terminalHistory: newHistory,
        terminalInput: '', // Clear input after command
      };
    }),

  setTerminalInput: (input) =>
    set({ terminalInput: input }),

  clearTerminal: () =>
    set({ terminalHistory: [], terminalInput: '' }),

  getCommandHistory: () => {
    const state = get();
    return state.terminalHistory.map((entry) => entry.command);
  },

  // Reset all state
  reset: () => set(initialState),
}));

// ============================================================================
// Selectors (for optimization)
// ============================================================================

export const selectSelectedNamespace = (state: K8sState) => state.selectedNamespace;
export const selectSelectedPod = (state: K8sState) => state.selectedPod;
export const selectSelectedNode = (state: K8sState) => state.selectedNode;
export const selectDrawerOpen = (state: K8sState) => state.drawerOpen;
export const selectMetricsInterval = (state: K8sState) => state.metricsInterval;
export const selectTerminalHistory = (state: K8sState) => state.terminalHistory;
export const selectTerminalInput = (state: K8sState) => state.terminalInput;
