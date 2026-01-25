/**
 * K8sPage - Kubernetes Visibility Dashboard
 *
 * Main page component for the K8s dashboard. Composes all panels
 * and handles data fetching via TanStack Query.
 */

import { useState, useCallback } from 'react';
import { ArrowPathIcon, ServerIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useClusterHealth, useNodes, usePods, useMetricsHistory } from '../api/kubernetes';
import { useK8sStore } from '../stores/k8sStore';
import ClusterOverview from '../components/k8s/ClusterOverview';
import NodesPanel from '../components/k8s/NodesPanel';
import PodsTable from '../components/k8s/PodsTable';
import CommandTerminal from '../components/k8s/CommandTerminal';
import HealthCheckPanel from '../components/k8s/HealthCheckPanel';
import MetricsChart from '../components/k8s/MetricsChart';

export interface K8sPageProps {
  /** Custom class name */
  className?: string;
}

export default function K8sPage({ className }: K8sPageProps) {
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Store state
  const { selectedNamespace, metricsInterval, setSelectedPod, setSelectedNode } = useK8sStore();

  // Data fetching
  const {
    data: clusterHealth,
    isLoading: healthLoading,
    error: healthError,
    refetch: refetchHealth,
  } = useClusterHealth(autoRefresh ? 10000 : undefined);

  const {
    data: nodes,
    isLoading: nodesLoading,
    error: nodesError,
    refetch: refetchNodes,
  } = useNodes(autoRefresh ? 15000 : undefined);

  const {
    data: pods,
    isLoading: podsLoading,
    error: podsError,
    refetch: refetchPods,
  } = usePods(
    selectedNamespace ? { namespace: selectedNamespace } : undefined,
    autoRefresh ? 15000 : undefined
  );

  const {
    data: metrics,
    isLoading: metricsLoading,
    refetch: refetchMetrics,
  } = useMetricsHistory(metricsInterval, autoRefresh ? 30000 : undefined);

  // Handlers
  const handleRefresh = useCallback(() => {
    refetchHealth();
    refetchNodes();
    refetchPods();
    refetchMetrics();
  }, [refetchHealth, refetchNodes, refetchPods, refetchMetrics]);

  const handleAutoRefreshToggle = useCallback(() => {
    setAutoRefresh((prev) => !prev);
  }, []);

  const isLoading = healthLoading || nodesLoading || podsLoading;
  const hasError = healthError || nodesError || podsError;

  // Loading state
  if (isLoading && !clusterHealth && !nodes && !pods) {
    return (
      <div className={clsx('h-full flex flex-col bg-bg-primary', className)} data-testid="k8s-page">
        <div className="flex-1 flex items-center justify-center" data-testid="k8s-loading">
          <div className="space-y-4 w-full max-w-6xl px-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-32 rounded-lg bg-bg-secondary animate-pulse"
                data-testid="panel-skeleton"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (hasError && !clusterHealth) {
    const errorMessage = healthError?.message || nodesError?.message || podsError?.message;
    return (
      <div className={clsx('h-full flex flex-col bg-bg-primary', className)} data-testid="k8s-page">
        <div className="flex-1 flex items-center justify-center" data-testid="k8s-error">
          <div className="text-center">
            <p className="text-status-error mb-4">{errorMessage || 'Failed to load K8s data'}</p>
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
    <div className={clsx('h-full flex flex-col bg-bg-primary', className)} data-testid="k8s-page" role="main">
      {/* Header */}
      <header className="bg-bg-secondary border-b border-border-primary px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent-teal/10">
              <ServerIcon className="h-6 w-6 text-accent-teal" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">Kubernetes Dashboard</h1>
              <p className="text-sm text-text-secondary mt-1">Monitor cluster health and resources</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleAutoRefreshToggle}
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
        <div className="grid grid-cols-1 gap-6" data-testid="k8s-grid">
          {/* Cluster Overview */}
          <section className="col-span-full" data-testid="cluster-overview-section">
            <ClusterOverview
              health={clusterHealth}
              isLoading={healthLoading}
              onRefresh={refetchHealth}
            />
          </section>

          {/* Metrics Chart + Health Checks */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Metrics Chart */}
            <div className="bg-bg-secondary rounded-lg border border-border-primary p-4">
              <h2 className="text-lg font-semibold text-text-primary mb-4">Resource Metrics</h2>
              <MetricsChart
                data={metrics}
                isLoading={metricsLoading}
                type="both"
                height={200}
              />
            </div>

            {/* Health Checks */}
            <div className="bg-bg-secondary rounded-lg border border-border-primary p-4">
              <h2 className="text-lg font-semibold text-text-primary mb-4">Health Checks</h2>
              <HealthCheckPanel />
            </div>
          </div>

          {/* Nodes Panel */}
          <section data-testid="nodes-section">
            <div className="bg-bg-secondary rounded-lg border border-border-primary">
              <div className="p-4 border-b border-border-primary">
                <h2 className="text-lg font-semibold text-text-primary">Nodes</h2>
              </div>
              <div className="p-4">
                <NodesPanel
                  nodes={nodes || []}
                  isLoading={nodesLoading}
                  onNodeClick={setSelectedNode}
                />
              </div>
            </div>
          </section>

          {/* Pods Table */}
          <section data-testid="pods-section">
            <div className="bg-bg-secondary rounded-lg border border-border-primary">
              <div className="p-4 border-b border-border-primary">
                <h2 className="text-lg font-semibold text-text-primary">Pods</h2>
              </div>
              <PodsTable
                pods={pods || []}
                isLoading={podsLoading}
                onPodClick={setSelectedPod}
                showFilters
              />
            </div>
          </section>

          {/* Command Terminal */}
          <section data-testid="terminal-section">
            <div className="bg-bg-secondary rounded-lg border border-border-primary">
              <div className="p-4 border-b border-border-primary">
                <h2 className="text-lg font-semibold text-text-primary">Command Terminal</h2>
                <p className="text-xs text-text-muted mt-1">
                  Execute read-only kubectl and docker commands
                </p>
              </div>
              <div className="p-4">
                <CommandTerminal />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
