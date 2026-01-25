/**
 * MetricsPage - Metrics Dashboard for aSDLC services
 *
 * Main page component for the metrics dashboard. Composes all panels
 * and handles data fetching via TanStack Query.
 *
 * Features:
 * - Service and time range filtering
 * - Auto-refresh toggle with manual refresh button
 * - Resource metrics (CPU, Memory)
 * - Request metrics (Rate, Latency percentiles)
 * - Active tasks gauge
 */

import { useCallback } from 'react';
import { ArrowPathIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCPUMetrics,
  useMemoryMetrics,
  useRequestRateMetrics,
  useLatencyMetrics,
  useActiveTasks,
} from '../api/metrics';
import { useMetricsStore } from '../stores/metricsStore';
import {
  ServiceSelector,
  TimeRangeSelector,
  CPUChart,
  MemoryChart,
  RequestRateChart,
  LatencyChart,
  ActiveTasksGauge,
} from '../components/metrics';

export interface MetricsPageProps {
  /** Custom class name */
  className?: string;
}

export default function MetricsPage({ className }: MetricsPageProps) {
  const queryClient = useQueryClient();

  // Store state
  const { selectedService, timeRange, autoRefresh, refreshInterval, toggleAutoRefresh } =
    useMetricsStore();

  // Calculate effective refresh interval
  const effectiveRefreshInterval = autoRefresh ? refreshInterval : undefined;

  // Data fetching
  const {
    data: cpuData,
    isLoading: cpuLoading,
    error: cpuError,
  } = useCPUMetrics(selectedService, timeRange, effectiveRefreshInterval);

  const {
    data: memoryData,
    isLoading: memoryLoading,
    error: memoryError,
  } = useMemoryMetrics(selectedService, timeRange, effectiveRefreshInterval);

  const {
    data: requestRateData,
    isLoading: requestRateLoading,
    error: requestRateError,
  } = useRequestRateMetrics(selectedService, timeRange, effectiveRefreshInterval);

  const {
    data: latencyData,
    isLoading: latencyLoading,
    error: latencyError,
  } = useLatencyMetrics(selectedService, timeRange, effectiveRefreshInterval);

  const {
    data: activeTasksData,
    isLoading: activeTasksLoading,
    error: activeTasksError,
  } = useActiveTasks(effectiveRefreshInterval);

  // Manual refresh handler
  const handleRefresh = useCallback(() => {
    // Invalidate all metrics queries to trigger refetch
    queryClient.invalidateQueries({ queryKey: ['metrics'] });
  }, [queryClient]);

  // Aggregate loading and error states
  const isInitialLoading =
    cpuLoading && memoryLoading && requestRateLoading && latencyLoading && activeTasksLoading;
  const hasGlobalError =
    cpuError && memoryError && requestRateError && latencyError && activeTasksError;

  // Initial loading state (no data yet)
  if (isInitialLoading && !cpuData && !memoryData && !requestRateData && !latencyData) {
    return (
      <div className={clsx('h-full flex flex-col bg-bg-primary', className)} data-testid="metrics-page">
        <div className="flex-1 flex items-center justify-center" data-testid="metrics-loading">
          <div className="space-y-4 w-full max-w-6xl px-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-48 rounded-lg bg-bg-secondary animate-pulse"
                data-testid="panel-skeleton"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Global error state
  if (hasGlobalError && !cpuData) {
    const errorMessage =
      (cpuError as Error)?.message ||
      (memoryError as Error)?.message ||
      'Failed to load metrics data';
    return (
      <div className={clsx('h-full flex flex-col bg-bg-primary', className)} data-testid="metrics-page">
        <div className="flex-1 flex items-center justify-center" data-testid="metrics-error">
          <div className="text-center">
            <p className="text-status-error mb-4">{errorMessage}</p>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-accent-blue text-white rounded-lg hover:bg-accent-blue/90"
              data-testid="retry-button"
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
      className={clsx('h-full flex flex-col bg-bg-primary', className)}
      data-testid="metrics-page"
      role="main"
    >
      {/* Header */}
      <header className="bg-bg-secondary border-b border-border-primary px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent-blue/10">
              <ChartBarIcon className="h-6 w-6 text-accent-blue" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">Metrics Dashboard</h1>
              <p className="text-sm text-text-secondary mt-1">
                Monitor system health and performance
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            <ServiceSelector />
            <TimeRangeSelector />

            <button
              onClick={toggleAutoRefresh}
              className={clsx(
                'px-3 py-1.5 rounded text-xs font-medium transition-colors',
                autoRefresh
                  ? 'bg-accent-blue text-white'
                  : 'bg-bg-tertiary text-text-secondary hover:bg-bg-tertiary/80'
              )}
              aria-pressed={autoRefresh}
              data-testid="auto-refresh-toggle"
            >
              Auto-refresh
            </button>

            <button
              onClick={handleRefresh}
              className="p-2 rounded-lg border border-border-primary bg-bg-primary text-text-primary hover:bg-bg-tertiary transition-colors"
              aria-label="Refresh data"
              data-testid="page-refresh"
            >
              <ArrowPathIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 gap-6" data-testid="metrics-grid">
          {/* Resource Metrics Section */}
          <section data-testid="resource-metrics-section">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Resource Utilization</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* CPU Chart */}
              <div className="bg-bg-secondary rounded-lg border border-border-primary p-4">
                <h3 className="text-sm font-medium text-text-muted mb-3">CPU Usage</h3>
                <CPUChart
                  data={cpuData}
                  isLoading={cpuLoading}
                  height={200}
                />
                {cpuError && !cpuData && (
                  <p className="text-xs text-status-error mt-2">Failed to load CPU metrics</p>
                )}
              </div>

              {/* Memory Chart */}
              <div className="bg-bg-secondary rounded-lg border border-border-primary p-4">
                <h3 className="text-sm font-medium text-text-muted mb-3">Memory Usage</h3>
                <MemoryChart
                  data={memoryData}
                  isLoading={memoryLoading}
                  height={200}
                />
                {memoryError && !memoryData && (
                  <p className="text-xs text-status-error mt-2">Failed to load memory metrics</p>
                )}
              </div>
            </div>
          </section>

          {/* Request Metrics Section */}
          <section data-testid="request-metrics-section">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Request Metrics</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Request Rate Chart */}
              <div className="bg-bg-secondary rounded-lg border border-border-primary p-4">
                <h3 className="text-sm font-medium text-text-muted mb-3">Request Rate</h3>
                <RequestRateChart
                  data={requestRateData}
                  isLoading={requestRateLoading}
                  height={200}
                />
                {requestRateError && !requestRateData && (
                  <p className="text-xs text-status-error mt-2">Failed to load request rate metrics</p>
                )}
              </div>

              {/* Latency Chart */}
              <div className="bg-bg-secondary rounded-lg border border-border-primary p-4">
                <h3 className="text-sm font-medium text-text-muted mb-3">Response Latency</h3>
                <LatencyChart
                  data={latencyData}
                  isLoading={latencyLoading}
                  height={200}
                />
                {latencyError && !latencyData && (
                  <p className="text-xs text-status-error mt-2">Failed to load latency metrics</p>
                )}
              </div>
            </div>
          </section>

          {/* Tasks Section */}
          <section data-testid="tasks-metrics-section">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Task Activity</h2>
            <div className="max-w-md">
              <ActiveTasksGauge
                data={activeTasksData}
                isLoading={activeTasksLoading}
              />
              {activeTasksError && !activeTasksData && (
                <p className="text-xs text-status-error mt-2">Failed to load task metrics</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
