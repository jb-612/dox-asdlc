/**
 * ClusterOverview - Cluster health summary panel for K8s Dashboard
 *
 * Displays cluster health status indicator and 4 KPI cards:
 * - Nodes Ready
 * - Pods Running
 * - CPU Usage %
 * - Memory Usage %
 */

import { useCallback } from 'react';
import {
  ArrowPathIcon,
  ServerIcon,
  CubeIcon,
  CpuChipIcon,
  CircleStackIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import type { ClusterHealth, ClusterHealthStatus } from '../../api/types/kubernetes';

export interface ClusterOverviewProps {
  /** Cluster health data */
  health?: ClusterHealth;
  /** Loading state */
  isLoading?: boolean;
  /** Refresh callback */
  onRefresh?: () => void;
  /** Custom class name */
  className?: string;
}

// Status colors and icons
const statusConfig: Record<ClusterHealthStatus, { color: string; bg: string; icon: typeof CheckCircleIcon; label: string }> = {
  healthy: {
    color: 'text-status-success',
    bg: 'bg-status-success/10',
    icon: CheckCircleIcon,
    label: 'Healthy',
  },
  degraded: {
    color: 'text-status-warning',
    bg: 'bg-status-warning/10',
    icon: ExclamationTriangleIcon,
    label: 'Degraded',
  },
  critical: {
    color: 'text-status-error',
    bg: 'bg-status-error/10',
    icon: XCircleIcon,
    label: 'Critical',
  },
};

// KPI thresholds for color coding
function getKPIStatus(value: number, warningThreshold: number, criticalThreshold: number, inverse = false): 'success' | 'warning' | 'error' {
  if (inverse) {
    // For success rate style: lower is worse
    if (value <= criticalThreshold) return 'error';
    if (value <= warningThreshold) return 'warning';
    return 'success';
  } else {
    // For usage style: higher is worse
    if (value >= criticalThreshold) return 'error';
    if (value >= warningThreshold) return 'warning';
    return 'success';
  }
}

const kpiStatusColors = {
  success: 'border-status-success text-status-success',
  warning: 'border-status-warning text-status-warning',
  error: 'border-status-error text-status-error',
};

interface KPICardProps {
  icon: typeof ServerIcon;
  label: string;
  value: string | number;
  unit?: string;
  status: 'success' | 'warning' | 'error';
  subtitle?: string;
}

function KPICard({ icon: Icon, label, value, unit, status, subtitle }: KPICardProps) {
  return (
    <div
      className={clsx(
        'flex flex-col p-4 rounded-lg border-2 bg-bg-tertiary/30',
        kpiStatusColors[status]
      )}
      data-testid={`kpi-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-5 w-5 text-text-muted" />
        <span className="text-xs text-text-muted uppercase tracking-wide">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold">{value}</span>
        {unit && <span className="text-sm text-text-muted">{unit}</span>}
      </div>
      {subtitle && <span className="text-xs text-text-muted mt-1">{subtitle}</span>}
    </div>
  );
}

export default function ClusterOverview({
  health,
  isLoading = false,
  onRefresh,
  className,
}: ClusterOverviewProps) {
  const handleRefresh = useCallback(() => {
    onRefresh?.();
  }, [onRefresh]);

  // Loading state
  if (isLoading && !health) {
    return (
      <div className={clsx('space-y-4', className)} data-testid="cluster-overview-loading">
        <div className="h-16 rounded-lg bg-bg-secondary animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-24 rounded-lg bg-bg-secondary animate-pulse"
              data-testid="kpi-skeleton"
            />
          ))}
        </div>
      </div>
    );
  }

  // Empty/no data state
  if (!health) {
    return (
      <div
        className={clsx('p-6 text-center text-text-muted bg-bg-secondary rounded-lg', className)}
        data-testid="cluster-overview"
      >
        <ServerIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>No cluster health data available</p>
        {onRefresh && (
          <button
            onClick={handleRefresh}
            className="mt-3 px-4 py-2 bg-accent-blue text-white rounded-lg hover:bg-accent-blue/90 text-sm"
            data-testid="refresh-button"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  const statusInfo = statusConfig[health.status];
  const StatusIcon = statusInfo.icon;

  // Calculate node readiness percentage for display
  const nodeReadyPercent = health.nodesTotal > 0
    ? Math.round((health.nodesReady / health.nodesTotal) * 100)
    : 0;

  // Calculate pod running percentage
  const podRunningPercent = health.podsTotal > 0
    ? Math.round((health.podsRunning / health.podsTotal) * 100)
    : 0;

  return (
    <div className={clsx('space-y-4', className)} data-testid="cluster-overview">
      {/* Status Header */}
      <div className={clsx('flex items-center justify-between p-4 rounded-lg', statusInfo.bg)}>
        <div className="flex items-center gap-3">
          <StatusIcon className={clsx('h-8 w-8', statusInfo.color)} data-testid="status-icon" />
          <div>
            <h3 className={clsx('text-lg font-semibold', statusInfo.color)} data-testid="status-label">
              Cluster {statusInfo.label}
            </h3>
            <p className="text-sm text-text-muted">
              Last updated: {new Date(health.lastUpdated).toLocaleTimeString()}
            </p>
          </div>
        </div>
        {onRefresh && (
          <button
            onClick={handleRefresh}
            className="p-2 rounded-lg hover:bg-bg-tertiary transition-colors"
            aria-label="Refresh cluster health"
            data-testid="refresh-button"
          >
            <ArrowPathIcon className="h-5 w-5 text-text-secondary" />
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="kpi-grid">
        <KPICard
          icon={ServerIcon}
          label="Nodes Ready"
          value={`${health.nodesReady}/${health.nodesTotal}`}
          status={getKPIStatus(nodeReadyPercent, 80, 50, true)}
          subtitle={`${nodeReadyPercent}% available`}
        />
        <KPICard
          icon={CubeIcon}
          label="Pods Running"
          value={`${health.podsRunning}/${health.podsTotal}`}
          status={getKPIStatus(podRunningPercent, 80, 50, true)}
          subtitle={`${health.podsPending} pending, ${health.podsFailed} failed`}
        />
        <KPICard
          icon={CpuChipIcon}
          label="CPU Usage"
          value={health.cpuUsagePercent}
          unit="%"
          status={getKPIStatus(health.cpuUsagePercent, 70, 90)}
        />
        <KPICard
          icon={CircleStackIcon}
          label="Memory Usage"
          value={health.memoryUsagePercent}
          unit="%"
          status={getKPIStatus(health.memoryUsagePercent, 70, 90)}
        />
      </div>
    </div>
  );
}
