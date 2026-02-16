/**
 * AgentsDashboardPage - Main page for Agent Activity Dashboard (P05-F12 T10)
 *
 * Features:
 * - Header with WebSocket status indicator
 * - 3-column layout (agents grid, logs panel, metrics/timeline)
 * - Auto-refresh toggle and manual refresh
 * - Agent selection for log viewing
 */

import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowPathIcon,
  CpuChipIcon,
  SignalIcon,
  SignalSlashIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

import {
  AgentStatusGrid,
  AgentLogsPanel,
  AgentMetricsChart,
  AgentTimelineView,
} from '../components/agents';
import {
  useAgents,
  useAgentLogs,
  useAgentMetrics,
  useAgentTimeline,
  agentsQueryKeys,
} from '../api/agents';
import { useAgentsStore } from '../stores/agentsStore';
import { useEventStore } from '../stores/eventStore';
import type { MetricsTimeRange, LogLevel } from '../types/agents';

export interface AgentsDashboardPageProps {
  /** Custom class name */
  className?: string;
}

export default function AgentsDashboardPage({ className }: AgentsDashboardPageProps) {
  const queryClient = useQueryClient();

  // Store state
  const {
    selectedAgentId,
    selectAgent,
    timeRange,
    setTimeRange,
    autoRefresh,
    toggleAutoRefresh,
    logLevelFilter,
    setLogLevelFilter,
    logSearchTerm,
    setLogSearchTerm,
    getEffectiveRefreshInterval,
  } = useAgentsStore();

  // WebSocket connection state from event store (wired to actual WebSocket lifecycle)
  const wsConnected = useEventStore((state) => state.connected);

  // Get effective refresh interval
  const refreshInterval = getEffectiveRefreshInterval();

  // Local state for collapsible sections
  const [timelineExpanded, setTimelineExpanded] = useState(true);

  // Data fetching
  const {
    data: agents,
    isLoading: agentsLoading,
    error: agentsError,
    refetch: refetchAgents,
  } = useAgents(refreshInterval);

  const {
    data: logs,
    isLoading: logsLoading,
  } = useAgentLogs(selectedAgentId, {
    level: logLevelFilter || undefined,
    search: logSearchTerm || undefined,
  });

  const {
    data: metrics,
    isLoading: metricsLoading,
  } = useAgentMetrics(timeRange, refreshInterval);

  const {
    data: timeline,
    isLoading: timelineLoading,
  } = useAgentTimeline(timeRange, refreshInterval);

  // Handlers
  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: agentsQueryKeys.all });
  }, [queryClient]);

  const handleAgentSelect = useCallback(
    (agentId: string) => {
      selectAgent(selectedAgentId === agentId ? null : agentId);
    },
    [selectAgent, selectedAgentId]
  );

  const handleTimeRangeChange = useCallback(
    (range: MetricsTimeRange) => {
      setTimeRange(range);
    },
    [setTimeRange]
  );

  const handleLevelFilterChange = useCallback(
    (level: LogLevel | null) => {
      setLogLevelFilter(level);
    },
    [setLogLevelFilter]
  );

  const handleSearchChange = useCallback(
    (term: string) => {
      setLogSearchTerm(term);
    },
    [setLogSearchTerm]
  );

  const handleRetry = useCallback(() => {
    refetchAgents();
  }, [refetchAgents]);

  // Error state
  if (agentsError && !agents) {
    return (
      <div
        data-testid="agents-dashboard-page"
        role="main"
        className={clsx('h-full flex flex-col bg-bg-primary', className)}
      >
        <div className="flex-1 flex items-center justify-center">
          <div
            data-testid="error-message"
            className="text-center"
          >
            <p className="text-status-error mb-4">
              Failed to load agents data
            </p>
            <button
              data-testid="retry-button"
              onClick={handleRetry}
              className="px-4 py-2 bg-accent-blue text-white rounded-lg hover:bg-accent-blue/90"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="agents-dashboard-page"
      role="main"
      className={clsx('h-full flex flex-col bg-bg-primary', className)}
    >
      {/* Header */}
      <header className="bg-bg-secondary border-b border-border-primary px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent-blue/10">
              <CpuChipIcon className="h-6 w-6 text-accent-blue" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">
                Agent Activity
              </h1>
              <p className="text-sm text-text-secondary mt-1">
                Monitor agent status, logs, and execution metrics
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            {/* WebSocket Status */}
            <div
              data-testid="ws-status"
              className={clsx(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium',
                wsConnected
                  ? 'bg-status-success/10 text-status-success'
                  : 'bg-bg-tertiary text-text-muted'
              )}
            >
              {wsConnected ? (
                <>
                  <SignalIcon className="h-4 w-4" />
                  <span>Connected</span>
                </>
              ) : (
                <>
                  <SignalSlashIcon className="h-4 w-4" />
                  <span>Disconnected</span>
                </>
              )}
            </div>

            {/* Auto-refresh Toggle */}
            <button
              data-testid="auto-refresh-toggle"
              onClick={toggleAutoRefresh}
              className={clsx(
                'px-3 py-1.5 rounded text-xs font-medium transition-colors',
                autoRefresh
                  ? 'bg-accent-blue text-white'
                  : 'bg-bg-tertiary text-text-secondary hover:bg-bg-tertiary/80'
              )}
              aria-pressed={autoRefresh}
            >
              Auto-refresh
            </button>

            {/* Refresh Button */}
            <button
              data-testid="page-refresh"
              onClick={handleRefresh}
              className="p-2 rounded-lg border border-border-primary bg-bg-primary text-text-primary hover:bg-bg-tertiary transition-colors"
              aria-label="Refresh data"
            >
              <ArrowPathIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
          {/* Agent Status Grid */}
          <section data-testid="agent-grid-section">
            <h2 className="text-lg font-semibold text-text-primary mb-4">
              Agents ({agents?.length || 0})
            </h2>
            <AgentStatusGrid
              agents={agents || []}
              selectedAgentId={selectedAgentId}
              onSelect={handleAgentSelect}
              isLoading={agentsLoading}
            />
          </section>

          {/* Two Column Layout for Logs and Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Logs Panel (shown when agent selected) */}
            {selectedAgentId && (
              <section
                data-testid="logs-section"
                className="lg:col-span-1"
              >
                <h2 className="text-lg font-semibold text-text-primary mb-4">
                  Logs
                </h2>
                <AgentLogsPanel
                  logs={logs || []}
                  levelFilter={logLevelFilter}
                  searchTerm={logSearchTerm}
                  isLoading={logsLoading}
                  onLevelChange={handleLevelFilterChange}
                  onSearchChange={handleSearchChange}
                />
              </section>
            )}

            {/* Metrics Section */}
            <section
              data-testid="metrics-section"
              className={selectedAgentId ? 'lg:col-span-2' : 'lg:col-span-3'}
            >
              <AgentMetricsChart
                data={metrics}
                timeRange={timeRange}
                isLoading={metricsLoading}
                onTimeRangeChange={handleTimeRangeChange}
              />
            </section>
          </div>

          {/* Timeline Section */}
          <section data-testid="timeline-section">
            <AgentTimelineView
              data={timeline}
              timeRange={timeRange}
              isLoading={timelineLoading}
              onTimeRangeChange={handleTimeRangeChange}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
