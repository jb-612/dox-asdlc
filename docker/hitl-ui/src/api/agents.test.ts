/**
 * Unit tests for agents API (P05-F12)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchAgents,
  fetchAgentLogs,
  fetchAgentMetrics,
  fetchAgentTimeline,
  agentsQueryKeys,
} from './agents';
import { apiClient } from './client';
import type { AgentsStatusResponse, AgentLogsResponse, AgentMetricsResponse } from '../types/agents';

// Mock the API client
vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

// Mock areMocksEnabled
vi.mock('./mocks/index', () => ({
  areMocksEnabled: vi.fn(() => false),
  getMockAgents: vi.fn(),
  getMockAgentLogs: vi.fn(),
  getMockAgentMetrics: vi.fn(),
  getMockAgentTimeline: vi.fn(),
  simulateAgentDelay: vi.fn().mockResolvedValue(undefined),
}));

describe('agents API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('fetchAgents', () => {
    it('fetches agents from API', async () => {
      const mockResponse: AgentsStatusResponse = {
        agents: [
          {
            agent_id: 'agent-1',
            agent_type: 'backend',
            status: 'running',
            currentTask: 'Implementing feature',
            progress: 50,
            sessionId: 'session-1',
            startedAt: '2026-01-29T10:00:00Z',
            lastHeartbeat: '2026-01-29T10:05:00Z',
          },
        ],
        total: 1,
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });

      const result = await fetchAgents();

      expect(apiClient.get).toHaveBeenCalledWith('/agents/status');
      expect(result).toEqual(mockResponse.agents);
    });

    it('throws on error', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Network error'));

      await expect(fetchAgents()).rejects.toThrow('Network error');
    });
  });

  describe('fetchAgentLogs', () => {
    it('fetches logs for an agent', async () => {
      const mockResponse: AgentLogsResponse = {
        logs: [
          {
            id: 'log-1',
            agentId: 'agent-1',
            level: 'info',
            message: 'Task started',
            timestamp: '2026-01-29T10:00:00Z',
          },
        ],
        total: 1,
        hasMore: false,
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });

      const result = await fetchAgentLogs('agent-1');

      expect(apiClient.get).toHaveBeenCalledWith('/agents/agent-1/logs', {
        params: {},
      });
      expect(result).toEqual(mockResponse.logs);
    });

    it('passes query parameters', async () => {
      const mockResponse: AgentLogsResponse = {
        logs: [],
        total: 0,
        hasMore: false,
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });

      await fetchAgentLogs('agent-1', {
        level: 'error',
        search: 'failed',
        limit: 50,
      });

      expect(apiClient.get).toHaveBeenCalledWith('/agents/agent-1/logs', {
        params: {
          level: 'error',
          search: 'failed',
          limit: 50,
        },
      });
    });

    it('throws on error', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Network error'));

      await expect(fetchAgentLogs('agent-1')).rejects.toThrow('Network error');
    });
  });

  describe('fetchAgentMetrics', () => {
    it('fetches metrics with default time range', async () => {
      const mockResponse: AgentMetricsResponse = {
        summary: {
          totalExecutions: 100,
          overallSuccessRate: 95,
          avgDurationMs: 5000,
          totalTokens: 50000,
          byAgentType: {
            backend: { executionCount: 30, successRate: 96, avgDurationMs: 4500 },
            frontend: { executionCount: 25, successRate: 94, avgDurationMs: 4000 },
            planner: { executionCount: 0, successRate: 0, avgDurationMs: 0 },
            reviewer: { executionCount: 0, successRate: 0, avgDurationMs: 0 },
            orchestrator: { executionCount: 0, successRate: 0, avgDurationMs: 0 },
            devops: { executionCount: 0, successRate: 0, avgDurationMs: 0 },
            discovery: { executionCount: 0, successRate: 0, avgDurationMs: 0 },
            coding: { executionCount: 0, successRate: 0, avgDurationMs: 0 },
            test: { executionCount: 0, successRate: 0, avgDurationMs: 0 },
            design: { executionCount: 0, successRate: 0, avgDurationMs: 0 },
          },
        },
        agents: [],
        timeRange: '1h',
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });

      const result = await fetchAgentMetrics();

      expect(apiClient.get).toHaveBeenCalledWith('/agents/metrics', {
        params: { timeRange: '1h' },
      });
      expect(result).toEqual(mockResponse);
    });

    it('respects custom time range', async () => {
      const mockResponse: AgentMetricsResponse = {
        summary: {
          totalExecutions: 0,
          overallSuccessRate: 0,
          avgDurationMs: 0,
          totalTokens: 0,
          byAgentType: {} as AgentMetricsResponse['summary']['byAgentType'],
        },
        agents: [],
        timeRange: '24h',
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });

      await fetchAgentMetrics({ timeRange: '24h' });

      expect(apiClient.get).toHaveBeenCalledWith('/agents/metrics', {
        params: { timeRange: '24h' },
      });
    });

    it('throws on error', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Network error'));

      await expect(fetchAgentMetrics()).rejects.toThrow('Network error');
    });
  });

  describe('fetchAgentTimeline', () => {
    it('fetches timeline data', async () => {
      const mockResponse = {
        timeline: {
          agents: [
            {
              agentId: 'agent-1',
              agentType: 'backend',
              executions: [],
            },
          ],
          startTime: '2026-01-29T09:00:00Z',
          endTime: '2026-01-29T10:00:00Z',
        },
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });

      const result = await fetchAgentTimeline('1h');

      expect(apiClient.get).toHaveBeenCalledWith('/agents/timeline', {
        params: { timeRange: '1h' },
      });
      expect(result).toEqual(mockResponse.timeline);
    });

    it('throws on error', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Network error'));

      await expect(fetchAgentTimeline('1h')).rejects.toThrow('Network error');
    });
  });

  describe('agentsQueryKeys', () => {
    it('generates correct query keys', () => {
      expect(agentsQueryKeys.all).toEqual(['agents']);
      expect(agentsQueryKeys.list()).toEqual(['agents', 'list']);
      expect(agentsQueryKeys.logs('agent-1')).toEqual(['agents', 'logs', 'agent-1', undefined]);
      expect(agentsQueryKeys.logs('agent-1', { level: 'error' })).toEqual([
        'agents',
        'logs',
        'agent-1',
        { level: 'error' },
      ]);
      expect(agentsQueryKeys.metrics('24h')).toEqual(['agents', 'metrics', '24h']);
      expect(agentsQueryKeys.timeline('1h')).toEqual(['agents', 'timeline', '1h']);
    });
  });
});
