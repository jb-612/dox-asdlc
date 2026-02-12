/**
 * Unit tests for costsStore (Zustand) - P13-F01
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useCostsStore } from './costsStore';

describe('costsStore', () => {
  beforeEach(() => {
    useCostsStore.getState().reset();
  });

  describe('Initial State', () => {
    it('has default selectedTimeRange of 24h', () => {
      const state = useCostsStore.getState();
      expect(state.selectedTimeRange).toBe('24h');
    });

    it('has default selectedGroupBy of agent', () => {
      const state = useCostsStore.getState();
      expect(state.selectedGroupBy).toBe('agent');
    });

    it('has null selectedSessionId by default', () => {
      const state = useCostsStore.getState();
      expect(state.selectedSessionId).toBeNull();
    });

    it('has autoRefresh enabled by default', () => {
      const state = useCostsStore.getState();
      expect(state.autoRefresh).toBe(true);
    });
  });

  describe('setTimeRange', () => {
    it('sets time range to 1h', () => {
      useCostsStore.getState().setTimeRange('1h');
      expect(useCostsStore.getState().selectedTimeRange).toBe('1h');
    });

    it('sets time range to 7d', () => {
      useCostsStore.getState().setTimeRange('7d');
      expect(useCostsStore.getState().selectedTimeRange).toBe('7d');
    });

    it('sets time range to 30d', () => {
      useCostsStore.getState().setTimeRange('30d');
      expect(useCostsStore.getState().selectedTimeRange).toBe('30d');
    });

    it('sets time range to all', () => {
      useCostsStore.getState().setTimeRange('all');
      expect(useCostsStore.getState().selectedTimeRange).toBe('all');
    });
  });

  describe('setGroupBy', () => {
    it('sets groupBy to model', () => {
      useCostsStore.getState().setGroupBy('model');
      expect(useCostsStore.getState().selectedGroupBy).toBe('model');
    });

    it('sets groupBy to agent', () => {
      useCostsStore.getState().setGroupBy('agent');
      expect(useCostsStore.getState().selectedGroupBy).toBe('agent');
    });

    it('sets groupBy to day', () => {
      useCostsStore.getState().setGroupBy('day');
      expect(useCostsStore.getState().selectedGroupBy).toBe('day');
    });
  });

  describe('setSelectedSession', () => {
    it('sets a session ID', () => {
      useCostsStore.getState().setSelectedSession('sess-abc123');
      expect(useCostsStore.getState().selectedSessionId).toBe('sess-abc123');
    });

    it('can clear session by setting null', () => {
      useCostsStore.getState().setSelectedSession('sess-abc123');
      useCostsStore.getState().setSelectedSession(null);
      expect(useCostsStore.getState().selectedSessionId).toBeNull();
    });
  });

  describe('toggleAutoRefresh', () => {
    it('toggles from true to false', () => {
      expect(useCostsStore.getState().autoRefresh).toBe(true);
      useCostsStore.getState().toggleAutoRefresh();
      expect(useCostsStore.getState().autoRefresh).toBe(false);
    });

    it('toggles from false to true', () => {
      useCostsStore.getState().toggleAutoRefresh(); // true -> false
      useCostsStore.getState().toggleAutoRefresh(); // false -> true
      expect(useCostsStore.getState().autoRefresh).toBe(true);
    });
  });

  describe('reset', () => {
    it('resets all state to initial values', () => {
      useCostsStore.getState().setTimeRange('7d');
      useCostsStore.getState().setGroupBy('model');
      useCostsStore.getState().setSelectedSession('sess-123');
      useCostsStore.getState().toggleAutoRefresh();

      useCostsStore.getState().reset();

      const state = useCostsStore.getState();
      expect(state.selectedTimeRange).toBe('24h');
      expect(state.selectedGroupBy).toBe('agent');
      expect(state.selectedSessionId).toBeNull();
      expect(state.autoRefresh).toBe(true);
    });
  });
});
