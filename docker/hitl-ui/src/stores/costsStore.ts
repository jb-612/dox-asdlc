/**
 * Cost Dashboard Zustand Store (P13-F01)
 *
 * Manages UI state for the cost dashboard including
 * time range, group-by dimension, session selection, and auto-refresh.
 */

import { create } from 'zustand';
import type { CostTimeRange, CostGroupBy } from '../types/costs';

// ============================================================================
// Types
// ============================================================================

export interface CostsState {
  // Filter state
  selectedTimeRange: CostTimeRange;
  selectedGroupBy: CostGroupBy;
  selectedSessionId: string | null;

  // UI state
  autoRefresh: boolean;

  // Actions
  setTimeRange: (range: CostTimeRange) => void;
  setGroupBy: (groupBy: CostGroupBy) => void;
  setSelectedSession: (sessionId: string | null) => void;
  toggleAutoRefresh: () => void;
  reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
  selectedTimeRange: '24h' as CostTimeRange,
  selectedGroupBy: 'agent' as CostGroupBy,
  selectedSessionId: null as string | null,
  autoRefresh: true,
};

// ============================================================================
// Store
// ============================================================================

export const useCostsStore = create<CostsState>((set) => ({
  ...initialState,

  setTimeRange: (range) => set({ selectedTimeRange: range }),

  setGroupBy: (groupBy) => set({ selectedGroupBy: groupBy }),

  setSelectedSession: (sessionId) => set({ selectedSessionId: sessionId }),

  toggleAutoRefresh: () =>
    set((state) => ({ autoRefresh: !state.autoRefresh })),

  reset: () => set(initialState),
}));
