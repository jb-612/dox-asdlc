/**
 * Unit tests for AgentsDashboardPage (P05-F12 T10)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AgentsDashboardPage from './AgentsDashboardPage';
import * as agentsApi from '../api/agents';
import { useEventStore } from '../stores/eventStore';
import type { AgentStatus, AgentMetricsResponse, TimelineData } from '../types/agents';

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock the agents API
vi.mock('../api/agents', () => ({
  useAgents: vi.fn(),
  useAgentLogs: vi.fn(),
  useAgentMetrics: vi.fn(),
  useAgentTimeline: vi.fn(),
  formatDuration: vi.fn((ms: number) => `${Math.round(ms / 1000)}s`),
  formatTokens: vi.fn((tokens: number) => `${tokens}`),
}));

describe('AgentsDashboardPage', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const mockAgents: AgentStatus[] = [
    {
      agent_id: 'agent-backend-001',
      agent_type: 'backend',
      status: 'running',
      currentTask: 'Implementing feature',
      progress: 50,
      sessionId: 'session-1',
      startedAt: '2026-01-29T10:00:00Z',
      lastHeartbeat: '2026-01-29T10:15:00Z',
    },
    {
      agent_id: 'agent-frontend-001',
      agent_type: 'frontend',
      status: 'idle',
      currentTask: null,
      progress: 0,
      sessionId: null,
      startedAt: null,
      lastHeartbeat: '2026-01-29T10:10:00Z',
    },
  ];

  const mockMetrics: AgentMetricsResponse = {
    summary: {
      totalExecutions: 100,
      overallSuccessRate: 92,
      avgDurationMs: 15000,
      totalTokens: 50000,
      byAgentType: {
        backend: { executionCount: 45, successRate: 91, avgDurationMs: 12500 },
        frontend: { executionCount: 38, successRate: 95, avgDurationMs: 8200 },
        planner: { executionCount: 0, successRate: 0, avgDurationMs: 0 },
        reviewer: { executionCount: 0, successRate: 0, avgDurationMs: 0 },
        orchestrator: { executionCount: 0, successRate: 0, avgDurationMs: 0 },
        devops: { executionCount: 0, successRate: 0, avgDurationMs: 0 },
        discovery: { executionCount: 0, successRate: 0, avgDurationMs: 0 },
        coding: { executionCount: 0, successRate: 0, avgDurationMs: 0 },
        test: { executionCount: 17, successRate: 78, avgDurationMs: 35000 },
        design: { executionCount: 0, successRate: 0, avgDurationMs: 0 },
      },
    },
    agents: [],
    timeRange: '1h',
  };

  const mockTimeline: TimelineData = {
    agents: [
      {
        agentId: 'agent-backend-001',
        agentType: 'backend',
        executions: [],
      },
    ],
    startTime: '2026-01-29T09:00:00Z',
    endTime: '2026-01-29T10:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset event store to disconnected state
    useEventStore.setState({ connected: false });

    // Default mock implementations
    vi.mocked(agentsApi.useAgents).mockReturnValue({
      data: mockAgents,
      isLoading: false,
      error: null,
    } as ReturnType<typeof agentsApi.useAgents>);

    vi.mocked(agentsApi.useAgentLogs).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as ReturnType<typeof agentsApi.useAgentLogs>);

    vi.mocked(agentsApi.useAgentMetrics).mockReturnValue({
      data: mockMetrics,
      isLoading: false,
      error: null,
    } as ReturnType<typeof agentsApi.useAgentMetrics>);

    vi.mocked(agentsApi.useAgentTimeline).mockReturnValue({
      data: mockTimeline,
      isLoading: false,
      error: null,
    } as ReturnType<typeof agentsApi.useAgentTimeline>);
  });

  const renderPage = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <AgentsDashboardPage />
      </QueryClientProvider>
    );
  };

  describe('Rendering', () => {
    it('renders page container', () => {
      renderPage();
      expect(screen.getByTestId('agents-dashboard-page')).toBeInTheDocument();
    });

    it('renders page header', () => {
      renderPage();
      expect(screen.getByText('Agent Activity')).toBeInTheDocument();
    });

    it('renders agent grid section', () => {
      renderPage();
      expect(screen.getByTestId('agent-grid-section')).toBeInTheDocument();
    });

    it('renders metrics section', () => {
      renderPage();
      expect(screen.getByTestId('metrics-section')).toBeInTheDocument();
    });

    it('renders timeline section', () => {
      renderPage();
      expect(screen.getByTestId('timeline-section')).toBeInTheDocument();
    });
  });

  describe('WebSocket Status', () => {
    it('shows disconnected status indicator by default', () => {
      renderPage();
      const wsStatus = screen.getByTestId('ws-status');
      expect(wsStatus).toBeInTheDocument();
      expect(wsStatus).toHaveTextContent('Disconnected');
    });

    it('shows connected status when event store reports connected', () => {
      useEventStore.setState({ connected: true });
      renderPage();
      const wsStatus = screen.getByTestId('ws-status');
      expect(wsStatus).toHaveTextContent('Connected');
    });
  });

  describe('Auto-refresh Controls', () => {
    it('renders auto-refresh toggle', () => {
      renderPage();
      expect(screen.getByTestId('auto-refresh-toggle')).toBeInTheDocument();
    });

    it('renders refresh button', () => {
      renderPage();
      expect(screen.getByTestId('page-refresh')).toBeInTheDocument();
    });
  });

  describe('Agent Selection', () => {
    it('shows logs panel when agent is selected', async () => {
      renderPage();

      // Click on first agent card
      const cards = screen.getAllByTestId('agent-card');
      fireEvent.click(cards[0]);

      await waitFor(() => {
        expect(screen.getByTestId('logs-section')).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('shows loading state when agents are loading', () => {
      vi.mocked(agentsApi.useAgents).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      } as ReturnType<typeof agentsApi.useAgents>);

      renderPage();
      expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('shows error message on API failure', () => {
      vi.mocked(agentsApi.useAgents).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Network error'),
      } as unknown as ReturnType<typeof agentsApi.useAgents>);

      renderPage();
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
    });

    it('shows retry button on error', () => {
      vi.mocked(agentsApi.useAgents).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Network error'),
      } as unknown as ReturnType<typeof agentsApi.useAgents>);

      renderPage();
      expect(screen.getByTestId('retry-button')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has main role', () => {
      renderPage();
      const page = screen.getByTestId('agents-dashboard-page');
      expect(page).toHaveAttribute('role', 'main');
    });
  });
});
