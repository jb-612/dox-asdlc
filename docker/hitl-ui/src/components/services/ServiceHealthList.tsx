/**
 * ServiceHealthList - Compact collapsible list for service health
 *
 * Replaces the large topology map with a space-efficient design:
 * - Collapsed: Single row summary "5 services: 4 healthy, 1 degraded"
 * - Expanded: Compact list with status, CPU, memory per service
 */

import { useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import type { ServiceHealthInfo, ServiceHealthStatus } from '../../api/types/services';

// ============================================================================
// Types
// ============================================================================

export interface ServiceHealthListProps {
  /** Array of service health information */
  services: ServiceHealthInfo[];
  /** Loading state */
  isLoading?: boolean;
  /** Initially expanded */
  defaultExpanded?: boolean;
  /** Custom class name */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_CONFIG: Record<ServiceHealthStatus, { color: string; bg: string; label: string }> = {
  healthy: { color: 'text-status-success', bg: 'bg-status-success', label: 'Healthy' },
  degraded: { color: 'text-status-warning', bg: 'bg-status-warning', label: 'Degraded' },
  unhealthy: { color: 'text-status-error', bg: 'bg-status-error', label: 'Unhealthy' },
};

// ============================================================================
// Helper Components
// ============================================================================

function StatusDot({ status }: { status: ServiceHealthStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={clsx('inline-block w-2 h-2 rounded-full', config.bg)}
      title={config.label}
    />
  );
}

function MiniBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-12 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
      <div
        className={clsx('h-full rounded-full', color)}
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  );
}

function ServiceRow({ service }: { service: ServiceHealthInfo }) {
  const statusConfig = STATUS_CONFIG[service.status];
  const cpuColor = service.cpuPercent > 80 ? 'bg-status-error' : service.cpuPercent > 60 ? 'bg-status-warning' : 'bg-status-success';
  const memColor = service.memoryPercent > 80 ? 'bg-status-error' : service.memoryPercent > 60 ? 'bg-status-warning' : 'bg-status-success';

  return (
    <div
      className="flex items-center gap-3 py-1.5 px-2 hover:bg-bg-tertiary/50 rounded transition-colors"
      data-testid={`service-row-${service.name}`}
    >
      {/* Status dot */}
      <StatusDot status={service.status} />

      {/* Service name */}
      <span className="text-sm font-medium text-text-primary w-28 truncate">
        {service.name}
      </span>

      {/* Status label */}
      <span className={clsx('text-xs w-16', statusConfig.color)}>
        {statusConfig.label}
      </span>

      {/* CPU */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-text-muted w-8">CPU</span>
        <MiniBar value={service.cpuPercent} color={cpuColor} />
        <span className="text-xs text-text-secondary w-8">{service.cpuPercent}%</span>
      </div>

      {/* Memory */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-text-muted w-8">Mem</span>
        <MiniBar value={service.memoryPercent} color={memColor} />
        <span className="text-xs text-text-secondary w-8">{service.memoryPercent}%</span>
      </div>

      {/* Pod count */}
      <span className="text-xs text-text-muted">
        {service.podCount} pod{service.podCount !== 1 ? 's' : ''}
      </span>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function ServiceHealthList({
  services,
  isLoading = false,
  defaultExpanded = false,
  className,
}: ServiceHealthListProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  // Calculate summary stats
  const healthyCount = services.filter(s => s.status === 'healthy').length;
  const degradedCount = services.filter(s => s.status === 'degraded').length;
  const unhealthyCount = services.filter(s => s.status === 'unhealthy').length;
  const totalCount = services.length;

  // Loading state
  if (isLoading) {
    return (
      <div
        className={clsx('bg-bg-secondary rounded-lg p-3', className)}
        data-testid="service-health-list-loading"
      >
        <div className="h-6 w-48 bg-bg-tertiary rounded animate-pulse" />
      </div>
    );
  }

  // Empty state
  if (services.length === 0) {
    return (
      <div
        className={clsx('bg-bg-secondary rounded-lg p-3', className)}
        data-testid="service-health-list-empty"
      >
        <span className="text-sm text-text-muted">No services available</span>
      </div>
    );
  }

  return (
    <div
      className={clsx('bg-bg-secondary rounded-lg', className)}
      data-testid="service-health-list"
    >
      {/* Header / Summary Row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 p-3 hover:bg-bg-tertiary/50 rounded-lg transition-colors"
        aria-expanded={expanded}
        data-testid="service-health-list-toggle"
      >
        {expanded ? (
          <ChevronDownIcon className="h-4 w-4 text-text-muted" />
        ) : (
          <ChevronRightIcon className="h-4 w-4 text-text-muted" />
        )}

        <span className="text-sm font-medium text-text-primary">
          {totalCount} service{totalCount !== 1 ? 's' : ''}
        </span>

        <span className="text-sm text-text-muted">·</span>

        {/* Status summary pills */}
        <div className="flex items-center gap-2">
          {healthyCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs">
              <StatusDot status="healthy" />
              <span className="text-status-success">{healthyCount} healthy</span>
            </span>
          )}
          {degradedCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs">
              <StatusDot status="degraded" />
              <span className="text-status-warning">{degradedCount} degraded</span>
            </span>
          )}
          {unhealthyCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs">
              <StatusDot status="unhealthy" />
              <span className="text-status-error">{unhealthyCount} unhealthy</span>
            </span>
          )}
        </div>
      </button>

      {/* Expanded service list */}
      {expanded && (
        <div className="px-2 pb-2 space-y-0.5" data-testid="service-health-list-expanded">
          {services.map((service) => (
            <ServiceRow key={service.name} service={service} />
          ))}
        </div>
      )}
    </div>
  );
}
