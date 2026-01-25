/**
 * Metrics Dashboard Zustand Store (P05-F10)
 *
 * Manages UI state for the metrics dashboard including
 * service selection, time range, and auto-refresh settings.
 */

import { create } from 'zustand';
import type { TimeRange } from '../api/types/metrics';

// ============================================================================
// Types
// ============================================================================

export interface MetricsState {
  // Filter state
  /** Currently selected service (null = all services) */
  selectedService: string | null;
  /** Current time range for queries */
  timeRange: TimeRange;

  // UI state
  /** Whether auto-refresh is enabled */
  autoRefresh: boolean;
  /** Auto-refresh interval in milliseconds */
  refreshInterval: number;

  // Actions
  setSelectedService: (service: string | null) => void;
  setTimeRange: (range: TimeRange) => void;
  toggleAutoRefresh: () => void;
  setAutoRefresh: (enabled: boolean) => void;
  reset: () => void;
}

// ============================================================================
// Constants
// ============================================================================

/** Default refresh interval (30 seconds) */
export const DEFAULT_REFRESH_INTERVAL = 30000;

/** Default time range */
export const DEFAULT_TIME_RANGE: TimeRange = '1h';

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
  selectedService: null as string | null,
  timeRange: DEFAULT_TIME_RANGE,
  autoRefresh: true,
  refreshInterval: DEFAULT_REFRESH_INTERVAL,
};

// ============================================================================
// Store
// ============================================================================

export const useMetricsStore = create<MetricsState>((set) => ({
  ...initialState,

  setSelectedService: (service) => set({ selectedService: service }),

  setTimeRange: (range) => set({ timeRange: range }),

  toggleAutoRefresh: () =>
    set((state) => ({ autoRefresh: !state.autoRefresh })),

  setAutoRefresh: (enabled) => set({ autoRefresh: enabled }),

  reset: () => set(initialState),
}));

// ============================================================================
// Selectors (for optimized component subscriptions)
// ============================================================================

export const selectSelectedService = (state: MetricsState) =>
  state.selectedService;
export const selectTimeRange = (state: MetricsState) => state.timeRange;
export const selectAutoRefresh = (state: MetricsState) => state.autoRefresh;
export const selectRefreshInterval = (state: MetricsState) =>
  state.refreshInterval;

/**
 * Get the effective refresh interval (returns undefined if auto-refresh is disabled)
 */
export const selectEffectiveRefreshInterval = (state: MetricsState) =>
  state.autoRefresh ? state.refreshInterval : undefined;
