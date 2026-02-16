/**
 * Agents API client functions for Agent Activity Dashboard (P05-F12)
 *
 * Handles agent status, logs, and metrics API calls.
 * Supports mock mode for development.
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';
import {
  areMocksEnabled,
  getMockAgents,
  getMockAgentLogs,
  getMockAgentMetrics,
  getMockAgentTimeline,
  simulateAgentDelay,
} from './mocks/index';
import type {
  AgentStatus,
  AgentLog,
  AgentMetricsResponse,
  AgentLogsQueryParams,
  AgentMetricsQueryParams,
  MetricsTimeRange,
  TimelineData,
  AgentsStatusResponse,
  AgentLogsResponse,
  AgentTimelineResponse,
} from '../types/agents';

// ============================================================================
// Query Keys
// ============================================================================

export const agentsQueryKeys = {
  all: ['agents'] as const,
  list: () => [...agentsQueryKeys.all, 'list'] as const,
  detail: (id: string) => [...agentsQueryKeys.all, 'detail', id] as const,
  logs: (id: string, params?: AgentLogsQueryParams) =>
    [...agentsQueryKeys.all, 'logs', id, params] as const,
  metrics: (timeRange: MetricsTimeRange) =>
    [...agentsQueryKeys.all, 'metrics', timeRange] as const,
  timeline: (timeRange: MetricsTimeRange) =>
    [...agentsQueryKeys.all, 'timeline', timeRange] as const,
};

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch all agents status
 */
export async function fetchAgents(): Promise<AgentStatus[]> {
  if (areMocksEnabled()) {
    await simulateAgentDelay(50, 150);
    return getMockAgents();
  }

  try {
    const response = await apiClient.get<AgentsStatusResponse>('/agents/status');
    return response.data.agents;
  } catch (error) {
    console.error('Failed to fetch agents:', error);
    throw error;
  }
}

/**
 * Fetch logs for a specific agent
 */
export async function fetchAgentLogs(
  agentId: string,
  params?: AgentLogsQueryParams
): Promise<AgentLog[]> {
  if (areMocksEnabled()) {
    await simulateAgentDelay(50, 150);
    return getMockAgentLogs(agentId, params);
  }

  try {
    const response = await apiClient.get<AgentLogsResponse>(`/agents/${agentId}/logs`, {
      params: params || {},
    });
    return response.data.logs;
  } catch (error) {
    console.error('Failed to fetch agent logs:', error);
    throw error;
  }
}

/**
 * Fetch agent metrics
 */
export async function fetchAgentMetrics(
  params?: AgentMetricsQueryParams
): Promise<AgentMetricsResponse | null> {
  const timeRange = params?.timeRange || '1h';

  if (areMocksEnabled()) {
    await simulateAgentDelay(100, 250);
    return getMockAgentMetrics({ timeRange, agentType: params?.agentType });
  }

  try {
    const response = await apiClient.get<AgentMetricsResponse>('/agents/metrics', {
      params: { timeRange },
    });
    return response.data;
  } catch (error) {
    console.error('Failed to fetch agent metrics:', error);
    throw error;
  }
}

/**
 * Fetch agent execution timeline
 */
export async function fetchAgentTimeline(
  timeRange: MetricsTimeRange
): Promise<TimelineData | null> {
  if (areMocksEnabled()) {
    await simulateAgentDelay(100, 200);
    return getMockAgentTimeline(timeRange);
  }

  try {
    const response = await apiClient.get<AgentTimelineResponse>('/agents/timeline', {
      params: { timeRange },
    });
    return response.data.timeline;
  } catch (error) {
    console.error('Failed to fetch agent timeline:', error);
    throw error;
  }
}

// ============================================================================
// React Query Hooks
// ============================================================================

/**
 * Hook to fetch all agents with auto-refresh
 */
export function useAgents(refetchInterval?: number) {
  return useQuery({
    queryKey: agentsQueryKeys.list(),
    queryFn: fetchAgents,
    refetchInterval,
    staleTime: 10000,
  });
}

/**
 * Hook to fetch agent logs
 */
export function useAgentLogs(
  agentId: string | null,
  params?: AgentLogsQueryParams,
  refetchInterval?: number
) {
  return useQuery({
    queryKey: agentsQueryKeys.logs(agentId || '', params),
    queryFn: () => (agentId ? fetchAgentLogs(agentId, params) : Promise.resolve([])),
    enabled: !!agentId,
    refetchInterval,
    staleTime: 5000,
  });
}

/**
 * Hook to fetch agent metrics
 */
export function useAgentMetrics(
  timeRange: MetricsTimeRange = '1h',
  refetchInterval?: number
) {
  return useQuery({
    queryKey: agentsQueryKeys.metrics(timeRange),
    queryFn: () => fetchAgentMetrics({ timeRange }),
    refetchInterval,
    staleTime: 30000,
  });
}

/**
 * Hook to fetch agent timeline
 */
export function useAgentTimeline(
  timeRange: MetricsTimeRange = '1h',
  refetchInterval?: number
) {
  return useQuery({
    queryKey: agentsQueryKeys.timeline(timeRange),
    queryFn: () => fetchAgentTimeline(timeRange),
    refetchInterval,
    staleTime: 30000,
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format duration in milliseconds to human-readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  if (ms < 3600000) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
}

/**
 * Format token count to human-readable string
 */
export function formatTokens(tokens: number): string {
  if (tokens < 1000) {
    return tokens.toString();
  }
  if (tokens < 1000000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return `${(tokens / 1000000).toFixed(2)}M`;
}

/**
 * Calculate percentage for progress bars
 */
export function calculateProgress(current: number, total: number): number {
  if (total === 0) return 0;
  return Math.min(100, Math.round((current / total) * 100));
}
