/**
 * Metrics Dashboard Zustand Store (P05-F10)
 *
 * Manages UI state for the metrics dashboard including
 * service selection, time range, auto-refresh settings,
 * and backend mode selection.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { TimeRange } from '../api/types/metrics';

// ============================================================================
// Types
// ============================================================================

/** Backend mode for metrics data source */
export type MetricsBackendMode = 'mock' | 'victoriametrics';

export interface MetricsState {
  // Filter state
  /** Currently selected service (null = all services) */
  selectedService: string | null;
  /** Current time range for queries */
  timeRange: TimeRange;

  // Backend state
  /** Selected backend mode (persisted) */
  selectedBackend: MetricsBackendMode;

  // UI state
  /** Whether auto-refresh is enabled */
  autoRefresh: boolean;
  /** Auto-refresh interval in milliseconds */
  refreshInterval: number;

  // Actions
  setSelectedService: (service: string | null) => void;
  setTimeRange: (range: TimeRange) => void;
  setBackend: (mode: MetricsBackendMode) => void;
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

/** Default backend mode */
export const DEFAULT_BACKEND: MetricsBackendMode = 'mock';

/** Storage key for persistence */
const STORAGE_KEY = 'asdlc:metrics-dashboard-store';

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
  selectedService: null as string | null,
  timeRange: DEFAULT_TIME_RANGE,
  selectedBackend: DEFAULT_BACKEND,
  autoRefresh: true,
  refreshInterval: DEFAULT_REFRESH_INTERVAL,
};

// ============================================================================
// Store
// ============================================================================

export const useMetricsStore = create<MetricsState>()(
  persist(
    (set) => ({
      ...initialState,

      setSelectedService: (service) => set({ selectedService: service }),

      setTimeRange: (range) => set({ timeRange: range }),

      setBackend: (mode) => set({ selectedBackend: mode }),

      toggleAutoRefresh: () =>
        set((state) => ({ autoRefresh: !state.autoRefresh })),

      setAutoRefresh: (enabled) => set({ autoRefresh: enabled }),

      reset: () => set(initialState),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Only persist backend preference
      partialize: (state) => ({
        selectedBackend: state.selectedBackend,
      }),
    }
  )
);

// ============================================================================
// Selectors (for optimized component subscriptions)
// ============================================================================

export const selectSelectedService = (state: MetricsState) =>
  state.selectedService;
export const selectTimeRange = (state: MetricsState) => state.timeRange;
export const selectBackend = (state: MetricsState) => state.selectedBackend;
export const selectAutoRefresh = (state: MetricsState) => state.autoRefresh;
export const selectRefreshInterval = (state: MetricsState) =>
  state.refreshInterval;

/**
 * Get the effective refresh interval (returns undefined if auto-refresh is disabled)
 */
export const selectEffectiveRefreshInterval = (state: MetricsState) =>
  state.autoRefresh ? state.refreshInterval : undefined;

/**
 * Check if using real backend (not mock)
 */
export const selectIsRealBackend = (state: MetricsState) =>
  state.selectedBackend !== 'mock';
