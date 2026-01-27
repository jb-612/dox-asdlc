/**
 * ServiceHealthDashboard - Main dashboard for service health monitoring
 *
 * T25: Composes ServiceTopologyMap and ServiceCards into a unified dashboard
 *
 * Features:
 * - ServiceTopologyMap at top showing service connections
 * - Grid of ServiceCards below (responsive: 1 col mobile, 2-3 cols desktop)
 * - Data fetching with hooks
 * - Loading state with skeletons
 * - Error state with retry
 * - Auto-refresh indicator
 * - Manual refresh button
 */

import { useCallback, useMemo, useState, useEffect } from 'react';
import { ArrowPathIcon, ServerStackIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import ServiceHealthList from './ServiceHealthList';
import ServiceCard from './ServiceCard';
import { useServicesHealth, useServiceSparkline } from '../../api/services';
import type { ServiceHealthInfo, SparklineDataPoint } from '../../api/types/services';

// ============================================================================
// Types
// ============================================================================

export interface ServiceHealthDashboardProps {
  /** Callback when a service is clicked */
  onServiceClick?: (serviceName: string) => void;
  /** Use mock data (for development) */
  useMock?: boolean;
  /** Custom class name */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const AUTO_REFRESH_INTERVAL = 30000; // 30 seconds

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Custom hook to fetch sparkline data for a service
 */
function useServiceSparklines(
  serviceName: string | null,
  useMock?: boolean
): { cpu: SparklineDataPoint[]; memory: SparklineDataPoint[]; isLoading: boolean } {
  const { data: cpuData, isLoading: cpuLoading } = useServiceSparkline(
    serviceName,
    'cpu',
    { useMock }
  );
  const { data: memoryData, isLoading: memoryLoading } = useServiceSparkline(
    serviceName,
    'memory',
    { useMock }
  );

  return useMemo(
    () => ({
      cpu: cpuData?.dataPoints || [],
      memory: memoryData?.dataPoints || [],
      isLoading: cpuLoading || memoryLoading,
    }),
    [cpuData, memoryData, cpuLoading, memoryLoading]
  );
}

/**
 * Service card with sparkline data
 */
function ServiceCardWithSparklines({
  service,
  useMock,
  onClick,
}: {
  service: ServiceHealthInfo;
  useMock?: boolean;
  onClick?: (serviceName: string) => void;
}) {
  const { cpu, memory, isLoading } = useServiceSparklines(service.name, useMock);

  return (
    <ServiceCard
      service={service}
      cpuSparkline={cpu}
      memorySparkline={memory}
      sparklineLoading={isLoading}
      onClick={onClick}
    />
  );
}

/**
 * Loading skeleton for the dashboard
 */
function DashboardSkeleton() {
  return (
    <div
      className="space-y-6"
      data-testid="service-health-dashboard-loading"
    >
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-bg-secondary rounded-lg animate-pulse" />
          <div>
            <div className="h-6 w-32 bg-bg-secondary rounded animate-pulse" />
            <div className="h-4 w-48 bg-bg-secondary rounded animate-pulse mt-1" />
          </div>
        </div>
        <div className="h-9 w-24 bg-bg-secondary rounded animate-pulse" />
      </div>

      {/* Topology skeleton */}
      <div className="h-64 bg-bg-secondary rounded-lg animate-pulse" />

      {/* Cards grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-48 bg-bg-secondary rounded-lg animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function ServiceHealthDashboard({
  onServiceClick,
  useMock,
  className,
}: ServiceHealthDashboardProps) {
  // Fetch services health data
  const { data: healthData, isLoading, error, refetch } = useServicesHealth({ useMock });

  // Track next refresh time for indicator
  const [nextRefreshIn, setNextRefreshIn] = useState(AUTO_REFRESH_INTERVAL / 1000);

  // Update countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setNextRefreshIn((prev) => {
        if (prev <= 1) {
          return AUTO_REFRESH_INTERVAL / 1000;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Reset timer on manual refresh
  const handleRefresh = useCallback(() => {
    refetch();
    setNextRefreshIn(AUTO_REFRESH_INTERVAL / 1000);
  }, [refetch]);

  // Handle service click from topology map or cards
  const handleServiceClick = useCallback(
    (serviceName: string) => {
      onServiceClick?.(serviceName);
    },
    [onServiceClick]
  );

  // Loading state
  if (isLoading && !healthData) {
    return <DashboardSkeleton />;
  }

  // Error state
  if (error && !healthData) {
    return (
      <div
        className={clsx('flex flex-col items-center justify-center py-12', className)}
        data-testid="service-health-dashboard-error"
      >
        <div className="text-center">
          <ServerStackIcon className="h-12 w-12 mx-auto mb-4 text-status-error opacity-50" />
          <p className="text-text-primary font-medium mb-2">Failed to load service health</p>
          <p className="text-text-muted text-sm mb-4">
            {error instanceof Error ? error.message : 'An error occurred'}
          </p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-accent-blue text-white rounded-lg hover:bg-accent-blue/90"
            data-testid="retry-button"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const services = healthData?.services || [];
  const connections = healthData?.connections || [];

  return (
    <div
      className={clsx('space-y-6', className)}
      data-testid="service-health-dashboard"
    >
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-accent-blue/10">
            <ServerStackIcon className="h-6 w-6 text-accent-blue" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-primary">Service Health</h2>
            <p className="text-sm text-text-secondary">
              Monitor aSDLC services and connections
            </p>
          </div>
        </div>

        {/* Refresh Controls */}
        <div className="flex items-center gap-3">
          {/* Auto-refresh indicator */}
          <span
            className="text-xs text-text-muted"
            data-testid="auto-refresh-indicator"
          >
            Refresh in {nextRefreshIn}s
          </span>

          {/* Manual refresh button */}
          <button
            onClick={handleRefresh}
            className="p-2 rounded-lg border border-border-primary bg-bg-primary text-text-primary hover:bg-bg-tertiary transition-colors"
            aria-label="Refresh service health"
            data-testid="refresh-button"
          >
            <ArrowPathIcon className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Service Health List */}
      <section>
        <ServiceHealthList
          services={services}
          isLoading={isLoading}
          defaultExpanded
        />
      </section>

      {/* Service Cards Grid */}
      <section>
        <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide mb-4">
          Service Details
        </h3>
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          data-testid="service-cards-grid"
        >
          {services.map((service) => (
            <ServiceCardWithSparklines
              key={service.name}
              service={service}
              useMock={useMock}
              onClick={onServiceClick ? handleServiceClick : undefined}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
