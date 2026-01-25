/**
 * K8sDashboard - Main dashboard component for K8s visibility
 *
 * Composes all K8s panels in a responsive grid layout:
 * - Top row: ClusterOverview (full width)
 * - Second row: MetricsChart (2/3) + HealthCheckPanel (1/3)
 * - Third row: NodesPanel (1/2) + ResourceHierarchy (1/2)
 * - Fourth row: PodsTable (full width)
 * - Fifth row: NetworkingPanel (1/2) + CommandTerminal (1/2)
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

import ClusterOverview from './ClusterOverview';
import MetricsChart from './MetricsChart';
import HealthCheckPanel from './HealthCheckPanel';
import NodesPanel from './NodesPanel';
import ResourceHierarchy from './ResourceHierarchy';
import PodsTable from './PodsTable';
import PodDetailDrawer from './PodDetailDrawer';
import NetworkingPanel from './NetworkingPanel';
import CommandTerminal from './CommandTerminal';

import {
  useClusterHealth,
  useNodes,
  usePods,
  useMetricsHistory,
  useServices,
  useIngresses,
  usePodLogs,
} from '../../api/kubernetes';
import { useK8sStore } from '../../stores/k8sStore';
import type { K8sPod, K8sNode } from '../../api/types/kubernetes';
import type { PodEvent } from './PodDetailDrawer';

export interface K8sDashboardProps {
  autoRefresh?: boolean;
  refreshInterval?: number;
  className?: string;
}

const HEALTH_REFRESH_INTERVAL = 10000;
const PODS_REFRESH_INTERVAL = 15000;
const NODES_REFRESH_INTERVAL = 15000;
const METRICS_REFRESH_INTERVAL = 30000;

export default function K8sDashboard({
  autoRefresh: initialAutoRefresh = true,
  className,
}: K8sDashboardProps) {
  const [autoRefresh, setAutoRefresh] = useState(initialAutoRefresh);
  const [isVisible, setIsVisible] = useState(true);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    selectedNamespace,
    selectedPod,
    metricsInterval,
    drawerOpen,
    setSelectedPod,
    setSelectedNode,
    setDrawerOpen,
  } = useK8sStore();

  const effectiveHealthInterval = autoRefresh && isVisible ? HEALTH_REFRESH_INTERVAL : undefined;
  const effectivePodsInterval = autoRefresh && isVisible ? PODS_REFRESH_INTERVAL : undefined;
  const effectiveNodesInterval = autoRefresh && isVisible ? NODES_REFRESH_INTERVAL : undefined;
  const effectiveMetricsInterval = autoRefresh && isVisible ? METRICS_REFRESH_INTERVAL : undefined;

  const {
    data: clusterHealth,
    isLoading: healthLoading,
    error: healthError,
    refetch: refetchHealth,
  } = useClusterHealth(effectiveHealthInterval);

  const {
    data: nodes,
    isLoading: nodesLoading,
    error: nodesError,
    refetch: refetchNodes,
  } = useNodes(effectiveNodesInterval);

  const {
    data: pods,
    isLoading: podsLoading,
    error: podsError,
    refetch: refetchPods,
  } = usePods(
    selectedNamespace ? { namespace: selectedNamespace } : undefined,
    effectivePodsInterval
  );

  const {
    data: metrics,
    isLoading: metricsLoading,
    refetch: refetchMetrics,
  } = useMetricsHistory(metricsInterval, effectiveMetricsInterval);

  const { data: services, isLoading: servicesLoading } = useServices(selectedNamespace || undefined);
  const { data: ingresses, isLoading: ingressesLoading } = useIngresses(selectedNamespace || undefined);

  const { data: podLogs, isLoading: logsLoading } = usePodLogs(
    selectedPod?.namespace || '',
    selectedPod?.name || '',
    undefined,
    100
  );

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  const handleRefreshAll = useCallback(() => {
    refetchHealth();
    refetchNodes();
    refetchPods();
    refetchMetrics();
  }, [refetchHealth, refetchNodes, refetchPods, refetchMetrics]);

  const handleAutoRefreshToggle = useCallback(() => {
    setAutoRefresh(prev => !prev);
  }, []);

  const handlePodClick = useCallback((pod: K8sPod) => {
    setSelectedPod(pod);
  }, [setSelectedPod]);

  const handleNodeClick = useCallback((node: K8sNode) => {
    setSelectedNode(node);
  }, [setSelectedNode]);

  const handleHierarchyNodeClick = useCallback((type: string, name: string, namespace?: string) => {
    if (type === 'pod' && namespace) {
      const pod = pods?.find(p => p.name === name && p.namespace === namespace);
      if (pod) setSelectedPod(pod);
    } else if (type === 'node') {
      const node = nodes?.find(n => n.name === name);
      if (node) setSelectedNode(node);
    }
  }, [pods, nodes, setSelectedPod, setSelectedNode]);

  const handleCloseDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, [setDrawerOpen]);

  const podEvents: PodEvent[] = selectedPod
    ? [
        { type: 'Normal', reason: 'Scheduled', message: 'Successfully assigned pod to node', timestamp: selectedPod.createdAt },
        { type: 'Normal', reason: 'Pulled', message: 'Container image pulled successfully', timestamp: selectedPod.createdAt },
        { type: 'Normal', reason: 'Started', message: 'Started container', timestamp: selectedPod.createdAt },
      ]
    : [];

  const isLoading = healthLoading || nodesLoading || podsLoading;
  const hasError = healthError || nodesError || podsError;
  const errorMessage = healthError?.message || nodesError?.message || podsError?.message;

  if (isLoading && !clusterHealth && !nodes && !pods) {
    return (
      <div className={clsx('space-y-6', className)} data-testid="k8s-dashboard-loading">
        <div className="h-32 rounded-lg bg-bg-secondary animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-64 rounded-lg bg-bg-secondary animate-pulse" />
          <div className="h-64 rounded-lg bg-bg-secondary animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-48 rounded-lg bg-bg-secondary animate-pulse" />
          <div className="h-48 rounded-lg bg-bg-secondary animate-pulse" />
        </div>
      </div>
    );
  }

  if (hasError && !clusterHealth) {
    return (
      <div className={clsx('flex flex-col items-center justify-center h-64 bg-bg-secondary rounded-lg', className)} data-testid="k8s-dashboard-error">
        <p className="text-status-error mb-4">{errorMessage || 'Failed to load K8s data'}</p>
        <button onClick={handleRefreshAll} className="px-4 py-2 bg-accent-blue text-white rounded-lg hover:bg-accent-blue/90" data-testid="retry-button">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={clsx('space-y-6', className)} data-testid="k8s-dashboard">
      <div className="flex items-center justify-end gap-3" data-testid="dashboard-controls">
        <button
          onClick={handleAutoRefreshToggle}
          className={clsx(
            'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
            autoRefresh ? 'bg-accent-blue text-white' : 'bg-bg-tertiary text-text-secondary hover:bg-bg-tertiary/80'
          )}
          aria-pressed={autoRefresh}
          data-testid="auto-refresh-toggle"
        >
          Auto-refresh {autoRefresh ? 'On' : 'Off'}
        </button>
        <button
          onClick={handleRefreshAll}
          className="p-2 rounded-lg bg-bg-tertiary text-text-secondary hover:bg-bg-tertiary/80 transition-colors"
          aria-label="Refresh all data"
          data-testid="refresh-all"
        >
          <ArrowPathIcon className="h-4 w-4" />
        </button>
      </div>

      <section data-testid="section-overview">
        <ClusterOverview health={clusterHealth} isLoading={healthLoading} onRefresh={refetchHealth} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6" data-testid="section-metrics-health">
        <div className="lg:col-span-2 bg-bg-secondary rounded-lg border border-border-primary p-4">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Resource Metrics</h2>
          <MetricsChart data={metrics} isLoading={metricsLoading} type="both" height={250} />
        </div>
        <div className="bg-bg-secondary rounded-lg border border-border-primary p-4">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Health Checks</h2>
          <HealthCheckPanel />
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-testid="section-nodes-hierarchy">
        <div className="bg-bg-secondary rounded-lg border border-border-primary p-4">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Nodes</h2>
          <NodesPanel nodes={nodes || []} isLoading={nodesLoading} onNodeClick={handleNodeClick} />
        </div>
        <div className="bg-bg-secondary rounded-lg border border-border-primary p-4">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Resource Hierarchy</h2>
          <ResourceHierarchy pods={pods || []} isLoading={podsLoading} onNodeClick={handleHierarchyNodeClick} />
        </div>
      </section>

      <section data-testid="section-pods">
        <div className="bg-bg-secondary rounded-lg border border-border-primary">
          <div className="p-4 border-b border-border-primary">
            <h2 className="text-lg font-semibold text-text-primary">Pods</h2>
          </div>
          <PodsTable pods={pods || []} isLoading={podsLoading} onPodClick={handlePodClick} showFilters />
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-testid="section-networking-terminal">
        <div className="bg-bg-secondary rounded-lg border border-border-primary p-4">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Networking</h2>
          <NetworkingPanel services={services || []} ingresses={ingresses || []} isLoading={servicesLoading || ingressesLoading} />
        </div>
        <div className="bg-bg-secondary rounded-lg border border-border-primary p-4">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Command Terminal</h2>
          <p className="text-xs text-text-muted mb-3">Execute read-only kubectl and docker commands</p>
          <CommandTerminal maxHeight={350} />
        </div>
      </section>

      <PodDetailDrawer pod={selectedPod} isOpen={drawerOpen} onClose={handleCloseDrawer} events={podEvents} logs={podLogs || ''} isLogsLoading={logsLoading} />
    </div>
  );
}
