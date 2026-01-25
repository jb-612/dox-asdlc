/**
 * Unit tests for metricsStore (Zustand)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useMetricsStore, DEFAULT_REFRESH_INTERVAL, DEFAULT_TIME_RANGE } from './metricsStore';

describe('metricsStore', () => {
  // Reset store state before each test
  beforeEach(() => {
    useMetricsStore.getState().reset();
  });

  describe('Initial State', () => {
    it('has null selectedService by default', () => {
      const state = useMetricsStore.getState();
      expect(state.selectedService).toBeNull();
    });

    it('has default time range of 1h', () => {
      const state = useMetricsStore.getState();
      expect(state.timeRange).toBe(DEFAULT_TIME_RANGE);
      expect(state.timeRange).toBe('1h');
    });

    it('has auto-refresh enabled by default', () => {
      const state = useMetricsStore.getState();
      expect(state.autoRefresh).toBe(true);
    });

    it('has default refresh interval of 30 seconds', () => {
      const state = useMetricsStore.getState();
      expect(state.refreshInterval).toBe(DEFAULT_REFRESH_INTERVAL);
      expect(state.refreshInterval).toBe(30000);
    });
  });

  describe('setSelectedService', () => {
    it('sets selected service', () => {
      useMetricsStore.getState().setSelectedService('orchestrator');
      expect(useMetricsStore.getState().selectedService).toBe('orchestrator');
    });

    it('can set service to null', () => {
      useMetricsStore.getState().setSelectedService('orchestrator');
      useMetricsStore.getState().setSelectedService(null);
      expect(useMetricsStore.getState().selectedService).toBeNull();
    });
  });

  describe('setTimeRange', () => {
    it('sets time range to 15m', () => {
      useMetricsStore.getState().setTimeRange('15m');
      expect(useMetricsStore.getState().timeRange).toBe('15m');
    });

    it('sets time range to 6h', () => {
      useMetricsStore.getState().setTimeRange('6h');
      expect(useMetricsStore.getState().timeRange).toBe('6h');
    });

    it('sets time range to 24h', () => {
      useMetricsStore.getState().setTimeRange('24h');
      expect(useMetricsStore.getState().timeRange).toBe('24h');
    });

    it('sets time range to 7d', () => {
      useMetricsStore.getState().setTimeRange('7d');
      expect(useMetricsStore.getState().timeRange).toBe('7d');
    });
  });

  describe('toggleAutoRefresh', () => {
    it('toggles auto-refresh from true to false', () => {
      expect(useMetricsStore.getState().autoRefresh).toBe(true);
      useMetricsStore.getState().toggleAutoRefresh();
      expect(useMetricsStore.getState().autoRefresh).toBe(false);
    });

    it('toggles auto-refresh from false to true', () => {
      useMetricsStore.getState().setAutoRefresh(false);
      useMetricsStore.getState().toggleAutoRefresh();
      expect(useMetricsStore.getState().autoRefresh).toBe(true);
    });
  });

  describe('setAutoRefresh', () => {
    it('sets auto-refresh to false', () => {
      useMetricsStore.getState().setAutoRefresh(false);
      expect(useMetricsStore.getState().autoRefresh).toBe(false);
    });

    it('sets auto-refresh to true', () => {
      useMetricsStore.getState().setAutoRefresh(false);
      useMetricsStore.getState().setAutoRefresh(true);
      expect(useMetricsStore.getState().autoRefresh).toBe(true);
    });
  });

  describe('reset', () => {
    it('resets all state to initial values', () => {
      // Modify all state values
      useMetricsStore.getState().setSelectedService('worker-pool');
      useMetricsStore.getState().setTimeRange('7d');
      useMetricsStore.getState().setAutoRefresh(false);

      // Reset
      useMetricsStore.getState().reset();

      // Verify all values are back to initial
      const state = useMetricsStore.getState();
      expect(state.selectedService).toBeNull();
      expect(state.timeRange).toBe(DEFAULT_TIME_RANGE);
      expect(state.autoRefresh).toBe(true);
      expect(state.refreshInterval).toBe(DEFAULT_REFRESH_INTERVAL);
    });
  });
});
