/**
 * ServiceCard - Card component displaying service health and metrics
 *
 * T13: Service health card with sparklines for CPU/memory and key metrics
 */

import { useMemo, useCallback } from 'react';
import clsx from 'clsx';
import {
  CpuChipIcon,
  CircleStackIcon,
  ClockIcon,
  ArrowPathIcon,
  CubeIcon,
} from '@heroicons/react/24/outline';
import SparklineChart from './SparklineChart';
import type { ServiceHealthInfo, ServiceHealthStatus, SparklineDataPoint } from '../../api/types/services';

// ============================================================================
// Types
// ============================================================================

export interface ServiceCardProps {
  /** Service health information */
  service: ServiceHealthInfo;
  /** CPU usage sparkline data */
  cpuSparkline: SparklineDataPoint[];
  /** Memory usage sparkline data */
  memorySparkline: SparklineDataPoint[];
  /** Click handler - receives service name */
  onClick?: (serviceName: string) => void;
  /** Loading state for the whole card */
  isLoading?: boolean;
  /** Loading state for sparklines only */
  sparklineLoading?: boolean;
  /** Custom class name */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_STYLES: Record<ServiceHealthStatus, { border: string; badge: string; text: string }> = {
  healthy: {
    border: 'border-status-success',
    badge: 'bg-status-success',
    text: 'text-status-success',
  },
  degraded: {
    border: 'border-status-warning',
    badge: 'bg-status-warning',
    text: 'text-status-warning',
  },
  unhealthy: {
    border: 'border-status-error',
    badge: 'bg-status-error',
    text: 'text-status-error',
  },
};

const SPARKLINE_THRESHOLDS = {
  cpu: { warning: 60, critical: 80 },
  memory: { warning: 70, critical: 85 },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format request rate for display
 */
function formatRequestRate(rate: number): string {
  if (rate < 1) {
    return `${(rate * 60).toFixed(1)} req/min`;
  }
  if (rate >= 1000) {
    return `${(rate / 1000).toFixed(1)}k req/s`;
  }
  return `${rate.toFixed(1)} req/s`;
}

/**
 * Format latency for display
 */
function formatLatency(ms: number): string {
  if (ms < 1) {
    return `${(ms * 1000).toFixed(0)} us`;
  }
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)} s`;
  }
  return `${ms.toFixed(0)} ms`;
}

/**
 * Check if restart time is within 24 hours
 */
function isRecentRestart(lastRestart: string | undefined): boolean {
  if (!lastRestart) return false;

  const restartTime = new Date(lastRestart).getTime();
  const now = Date.now();
  const twentyFourHours = 24 * 60 * 60 * 1000;

  return now - restartTime < twentyFourHours;
}

/**
 * Format relative time for last restart
 */
function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMs / (1000 * 60 * 60));

  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return date.toLocaleDateString();
}

// ============================================================================
// Component
// ============================================================================

export default function ServiceCard({
  service,
  cpuSparkline,
  memorySparkline,
  onClick,
  isLoading = false,
  sparklineLoading = false,
  className,
}: ServiceCardProps) {
  const statusStyles = STATUS_STYLES[service.status];
  const isClickable = !!onClick;

  const handleClick = useCallback(() => {
    onClick?.(service.name);
  }, [onClick, service.name]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (onClick && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        onClick(service.name);
      }
    },
    [onClick, service.name]
  );

  // Memoize recent restart check
  const showLastRestart = useMemo(
    () => isRecentRestart(service.lastRestart),
    [service.lastRestart]
  );

  // Loading skeleton
  if (isLoading) {
    return (
      <div
        className={clsx(
          'p-4 rounded-lg border-2 bg-bg-secondary animate-pulse',
          'border-border-secondary',
          className
        )}
        data-testid="service-card-loading"
      >
        <div className="h-6 bg-bg-tertiary rounded mb-4 w-1/2" />
        <div className="space-y-3">
          <div className="h-4 bg-bg-tertiary rounded w-3/4" />
          <div className="h-4 bg-bg-tertiary rounded w-2/3" />
          <div className="h-8 bg-bg-tertiary rounded w-full" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'p-4 rounded-lg border-2 bg-bg-secondary',
        'transition-all duration-200',
        statusStyles.border,
        isClickable && 'cursor-pointer hover:shadow-lg hover:bg-bg-tertiary',
        className
      )}
      onClick={isClickable ? handleClick : undefined}
      onKeyDown={isClickable ? handleKeyDown : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      data-testid="service-card"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3
          className="text-lg font-semibold text-text-primary capitalize"
          data-testid="service-name"
        >
          {service.name}
        </h3>
        <span
          className={clsx(
            'px-2 py-0.5 text-xs font-medium rounded-full text-white',
            statusStyles.badge
          )}
          data-testid="health-badge"
        >
          {service.status}
        </span>
      </div>

      {/* Sparklines */}
      <div className="grid grid-cols-2 gap-4 mb-3">
        {/* CPU Sparkline */}
        <div className="space-y-1" data-testid="cpu-sparkline">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span className="flex items-center gap-1">
              <CpuChipIcon className="h-3 w-3" />
              CPU
            </span>
            <span data-testid="cpu-value">{service.cpuPercent}%</span>
          </div>
          <SparklineChart
            data={cpuSparkline}
            thresholds={SPARKLINE_THRESHOLDS.cpu}
            isLoading={sparklineLoading}
            ariaLabel={`CPU usage for ${service.name}`}
          />
        </div>

        {/* Memory Sparkline */}
        <div className="space-y-1" data-testid="memory-sparkline">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span className="flex items-center gap-1">
              <CircleStackIcon className="h-3 w-3" />
              Memory
            </span>
            <span data-testid="memory-value">{service.memoryPercent}%</span>
          </div>
          <SparklineChart
            data={memorySparkline}
            thresholds={SPARKLINE_THRESHOLDS.memory}
            isLoading={sparklineLoading}
            ariaLabel={`Memory usage for ${service.name}`}
          />
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-text-secondary">
        {/* Pod Count */}
        <div className="flex items-center gap-1" data-testid="pod-count">
          <CubeIcon className="h-3 w-3" />
          <span>{service.podCount} pod{service.podCount !== 1 ? 's' : ''}</span>
        </div>

        {/* Request Rate (optional) */}
        {service.requestRate !== undefined && (
          <div className="flex items-center gap-1" data-testid="request-rate">
            <ArrowPathIcon className="h-3 w-3" />
            <span>{formatRequestRate(service.requestRate)}</span>
          </div>
        )}

        {/* Latency P50 (optional) */}
        {service.latencyP50 !== undefined && (
          <div className="flex items-center gap-1" data-testid="latency-p50">
            <ClockIcon className="h-3 w-3" />
            <span>{formatLatency(service.latencyP50)}</span>
          </div>
        )}

        {/* Last Restart (shown if within 24 hours) */}
        {showLastRestart && service.lastRestart && (
          <div
            className={clsx('flex items-center gap-1', statusStyles.text)}
            data-testid="last-restart"
          >
            <ArrowPathIcon className="h-3 w-3" />
            <span>Restarted {formatRelativeTime(service.lastRestart)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
