/**
 * Unit tests for agentsStore (Zustand) - P05-F12
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useAgentsStore, DEFAULT_REFRESH_INTERVAL, DEFAULT_TIME_RANGE } from './agentsStore';
import type { AgentStatus, AgentLog } from '../types/agents';

describe('agentsStore', () => {
  // Reset store state before each test
  beforeEach(() => {
    useAgentsStore.getState().reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('has empty agents array by default', () => {
      const state = useAgentsStore.getState();
      expect(state.agents).toEqual([]);
    });

    it('has null selectedAgentId by default', () => {
      const state = useAgentsStore.getState();
      expect(state.selectedAgentId).toBeNull();
    });

    it('has empty logs array by default', () => {
      const state = useAgentsStore.getState();
      expect(state.logs).toEqual([]);
    });

    it('has default time range of 1h', () => {
      const state = useAgentsStore.getState();
      expect(state.timeRange).toBe(DEFAULT_TIME_RANGE);
      expect(state.timeRange).toBe('1h');
    });

    it('has auto-refresh enabled by default', () => {
      const state = useAgentsStore.getState();
      expect(state.autoRefresh).toBe(true);
    });

    it('has default refresh interval of 10 seconds', () => {
      const state = useAgentsStore.getState();
      expect(state.refreshInterval).toBe(DEFAULT_REFRESH_INTERVAL);
      expect(state.refreshInterval).toBe(10000);
    });

    it('has null logLevelFilter by default', () => {
      const state = useAgentsStore.getState();
      expect(state.logLevelFilter).toBeNull();
    });

    it('has empty logSearchTerm by default', () => {
      const state = useAgentsStore.getState();
      expect(state.logSearchTerm).toBe('');
    });
  });

  describe('setAgents', () => {
    it('sets agents array', () => {
      const mockAgents: AgentStatus[] = [
        {
          agent_id: 'agent-1',
          agent_type: 'backend',
          status: 'running',
          currentTask: 'Test task',
          progress: 50,
          sessionId: 'session-1',
          startedAt: '2026-01-29T10:00:00Z',
          lastHeartbeat: '2026-01-29T10:05:00Z',
        },
      ];

      useAgentsStore.getState().setAgents(mockAgents);

      expect(useAgentsStore.getState().agents).toEqual(mockAgents);
    });

    it('replaces existing agents', () => {
      const agents1: AgentStatus[] = [
        {
          agent_id: 'agent-1',
          agent_type: 'backend',
          status: 'running',
          currentTask: null,
          progress: 0,
          sessionId: null,
          startedAt: null,
          lastHeartbeat: '2026-01-29T10:00:00Z',
        },
      ];
      const agents2: AgentStatus[] = [
        {
          agent_id: 'agent-2',
          agent_type: 'frontend',
          status: 'idle',
          currentTask: null,
          progress: 0,
          sessionId: null,
          startedAt: null,
          lastHeartbeat: '2026-01-29T10:00:00Z',
        },
      ];

      useAgentsStore.getState().setAgents(agents1);
      useAgentsStore.getState().setAgents(agents2);

      expect(useAgentsStore.getState().agents).toEqual(agents2);
    });
  });

  describe('selectAgent', () => {
    it('sets selectedAgentId', () => {
      useAgentsStore.getState().selectAgent('agent-1');

      expect(useAgentsStore.getState().selectedAgentId).toBe('agent-1');
    });

    it('can set to null to deselect', () => {
      useAgentsStore.getState().selectAgent('agent-1');
      useAgentsStore.getState().selectAgent(null);

      expect(useAgentsStore.getState().selectedAgentId).toBeNull();
    });

    it('clears logs when selecting different agent', () => {
      const mockLogs: AgentLog[] = [
        {
          id: 'log-1',
          agentId: 'agent-1',
          level: 'info',
          message: 'Test log',
          timestamp: '2026-01-29T10:00:00Z',
        },
      ];
      useAgentsStore.getState().setLogs(mockLogs);
      useAgentsStore.getState().selectAgent('agent-2');

      expect(useAgentsStore.getState().logs).toEqual([]);
    });
  });

  describe('setLogs', () => {
    it('sets logs array', () => {
      const mockLogs: AgentLog[] = [
        {
          id: 'log-1',
          agentId: 'agent-1',
          level: 'info',
          message: 'Test log',
          timestamp: '2026-01-29T10:00:00Z',
        },
      ];

      useAgentsStore.getState().setLogs(mockLogs);

      expect(useAgentsStore.getState().logs).toEqual(mockLogs);
    });
  });

  describe('addLog', () => {
    it('adds log to beginning of array', () => {
      const log1: AgentLog = {
        id: 'log-1',
        agentId: 'agent-1',
        level: 'info',
        message: 'First log',
        timestamp: '2026-01-29T10:00:00Z',
      };
      const log2: AgentLog = {
        id: 'log-2',
        agentId: 'agent-1',
        level: 'warn',
        message: 'Second log',
        timestamp: '2026-01-29T10:01:00Z',
      };

      useAgentsStore.getState().addLog(log1);
      useAgentsStore.getState().addLog(log2);

      const logs = useAgentsStore.getState().logs;
      expect(logs).toHaveLength(2);
      expect(logs[0].id).toBe('log-2');
      expect(logs[1].id).toBe('log-1');
    });
  });

  describe('setTimeRange', () => {
    it('sets time range to 6h', () => {
      useAgentsStore.getState().setTimeRange('6h');

      expect(useAgentsStore.getState().timeRange).toBe('6h');
    });

    it('sets time range to 24h', () => {
      useAgentsStore.getState().setTimeRange('24h');

      expect(useAgentsStore.getState().timeRange).toBe('24h');
    });

    it('sets time range to 7d', () => {
      useAgentsStore.getState().setTimeRange('7d');

      expect(useAgentsStore.getState().timeRange).toBe('7d');
    });
  });

  describe('updateAgentStatus', () => {
    it('updates status of existing agent', () => {
      const mockAgents: AgentStatus[] = [
        {
          agent_id: 'agent-1',
          agent_type: 'backend',
          status: 'running',
          currentTask: 'Task 1',
          progress: 50,
          sessionId: 'session-1',
          startedAt: '2026-01-29T10:00:00Z',
          lastHeartbeat: '2026-01-29T10:05:00Z',
        },
      ];
      useAgentsStore.getState().setAgents(mockAgents);

      useAgentsStore.getState().updateAgentStatus('agent-1', {
        status: 'idle',
        currentTask: null,
        progress: 0,
      });

      const agent = useAgentsStore.getState().agents.find((a) => a.agent_id === 'agent-1');
      expect(agent?.status).toBe('idle');
      expect(agent?.currentTask).toBeNull();
      expect(agent?.progress).toBe(0);
    });

    it('does nothing if agent not found', () => {
      const mockAgents: AgentStatus[] = [
        {
          agent_id: 'agent-1',
          agent_type: 'backend',
          status: 'running',
          currentTask: 'Task 1',
          progress: 50,
          sessionId: null,
          startedAt: null,
          lastHeartbeat: '2026-01-29T10:00:00Z',
        },
      ];
      useAgentsStore.getState().setAgents(mockAgents);

      useAgentsStore.getState().updateAgentStatus('agent-unknown', {
        status: 'error',
      });

      expect(useAgentsStore.getState().agents).toHaveLength(1);
      expect(useAgentsStore.getState().agents[0].status).toBe('running');
    });
  });

  describe('toggleAutoRefresh', () => {
    it('toggles auto-refresh from true to false', () => {
      expect(useAgentsStore.getState().autoRefresh).toBe(true);
      useAgentsStore.getState().toggleAutoRefresh();
      expect(useAgentsStore.getState().autoRefresh).toBe(false);
    });

    it('toggles auto-refresh from false to true', () => {
      useAgentsStore.getState().setAutoRefresh(false);
      useAgentsStore.getState().toggleAutoRefresh();
      expect(useAgentsStore.getState().autoRefresh).toBe(true);
    });
  });

  describe('setAutoRefresh', () => {
    it('sets auto-refresh to false', () => {
      useAgentsStore.getState().setAutoRefresh(false);
      expect(useAgentsStore.getState().autoRefresh).toBe(false);
    });

    it('sets auto-refresh to true', () => {
      useAgentsStore.getState().setAutoRefresh(false);
      useAgentsStore.getState().setAutoRefresh(true);
      expect(useAgentsStore.getState().autoRefresh).toBe(true);
    });
  });

  describe('setLogLevelFilter', () => {
    it('sets log level filter', () => {
      useAgentsStore.getState().setLogLevelFilter('error');
      expect(useAgentsStore.getState().logLevelFilter).toBe('error');
    });

    it('can set to null to clear filter', () => {
      useAgentsStore.getState().setLogLevelFilter('error');
      useAgentsStore.getState().setLogLevelFilter(null);
      expect(useAgentsStore.getState().logLevelFilter).toBeNull();
    });
  });

  describe('setLogSearchTerm', () => {
    it('sets log search term', () => {
      useAgentsStore.getState().setLogSearchTerm('error');
      expect(useAgentsStore.getState().logSearchTerm).toBe('error');
    });

    it('can clear search term', () => {
      useAgentsStore.getState().setLogSearchTerm('error');
      useAgentsStore.getState().setLogSearchTerm('');
      expect(useAgentsStore.getState().logSearchTerm).toBe('');
    });
  });

  describe('reset', () => {
    it('resets all state to initial values', () => {
      // Modify all state values
      useAgentsStore.getState().setAgents([
        {
          agent_id: 'agent-1',
          agent_type: 'backend',
          status: 'running',
          currentTask: null,
          progress: 0,
          sessionId: null,
          startedAt: null,
          lastHeartbeat: '2026-01-29T10:00:00Z',
        },
      ]);
      useAgentsStore.getState().selectAgent('agent-1');
      useAgentsStore.getState().setLogs([
        {
          id: 'log-1',
          agentId: 'agent-1',
          level: 'info',
          message: 'Test',
          timestamp: '2026-01-29T10:00:00Z',
        },
      ]);
      useAgentsStore.getState().setTimeRange('24h');
      useAgentsStore.getState().setAutoRefresh(false);
      useAgentsStore.getState().setLogLevelFilter('error');
      useAgentsStore.getState().setLogSearchTerm('test');

      // Reset
      useAgentsStore.getState().reset();

      // Verify all values are back to initial
      const state = useAgentsStore.getState();
      expect(state.agents).toEqual([]);
      expect(state.selectedAgentId).toBeNull();
      expect(state.logs).toEqual([]);
      expect(state.timeRange).toBe(DEFAULT_TIME_RANGE);
      expect(state.autoRefresh).toBe(true);
      expect(state.refreshInterval).toBe(DEFAULT_REFRESH_INTERVAL);
      expect(state.logLevelFilter).toBeNull();
      expect(state.logSearchTerm).toBe('');
    });
  });

  describe('getSelectedAgent selector', () => {
    it('returns selected agent when found', () => {
      const mockAgents: AgentStatus[] = [
        {
          agent_id: 'agent-1',
          agent_type: 'backend',
          status: 'running',
          currentTask: 'Task',
          progress: 50,
          sessionId: null,
          startedAt: null,
          lastHeartbeat: '2026-01-29T10:00:00Z',
        },
        {
          agent_id: 'agent-2',
          agent_type: 'frontend',
          status: 'idle',
          currentTask: null,
          progress: 0,
          sessionId: null,
          startedAt: null,
          lastHeartbeat: '2026-01-29T10:00:00Z',
        },
      ];
      useAgentsStore.getState().setAgents(mockAgents);
      useAgentsStore.getState().selectAgent('agent-2');

      const selectedAgent = useAgentsStore.getState().getSelectedAgent();
      expect(selectedAgent?.agent_id).toBe('agent-2');
    });

    it('returns undefined when no agent selected', () => {
      const mockAgents: AgentStatus[] = [
        {
          agent_id: 'agent-1',
          agent_type: 'backend',
          status: 'running',
          currentTask: null,
          progress: 0,
          sessionId: null,
          startedAt: null,
          lastHeartbeat: '2026-01-29T10:00:00Z',
        },
      ];
      useAgentsStore.getState().setAgents(mockAgents);

      const selectedAgent = useAgentsStore.getState().getSelectedAgent();
      expect(selectedAgent).toBeUndefined();
    });
  });

  describe('getEffectiveRefreshInterval selector', () => {
    it('returns refresh interval when auto-refresh is enabled', () => {
      const interval = useAgentsStore.getState().getEffectiveRefreshInterval();
      expect(interval).toBe(DEFAULT_REFRESH_INTERVAL);
    });

    it('returns undefined when auto-refresh is disabled', () => {
      useAgentsStore.getState().setAutoRefresh(false);
      const interval = useAgentsStore.getState().getEffectiveRefreshInterval();
      expect(interval).toBeUndefined();
    });
  });
});
