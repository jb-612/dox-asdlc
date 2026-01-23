/**
 * KPIHeader - Key Performance Indicator display for Agent Cockpit
 *
 * Shows 5 KPIs with color-coded thresholds, trend indicators,
 * and click handlers for filtering.
 */

import { useCallback } from 'react';
import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

/** Threshold configuration */
export interface KPIThreshold {
  /** Warning threshold */
  warning: number;
  /** Critical threshold */
  critical: number;
  /** If true, lower values are worse (e.g., success rate) */
  inverse?: boolean;
}

/** KPI definition */
export interface KPI {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Current value */
  value: number;
  /** Optional unit (e.g., '%', 's') */
  unit?: string;
  /** Trend direction */
  trend?: 'up' | 'down' | 'stable';
  /** Trend value (e.g., '+5', '-2%') */
  trendValue?: string;
  /** Color thresholds */
  threshold?: KPIThreshold;
}

export interface KPIHeaderProps {
  /** KPIs to display */
  kpis: KPI[];
  /** Loading state */
  isLoading?: boolean;
  /** Last updated timestamp */
  lastUpdated?: string;
  /** Custom class name */
  className?: string;
  /** Callback when KPI is clicked */
  onKPIClick?: (kpiId: string) => void;
  /** Callback to refresh data */
  onRefresh?: () => void;
}

// Determine status color based on threshold
function getStatusColor(value: number, threshold?: KPIThreshold): 'success' | 'warning' | 'error' {
  if (!threshold) return 'success';

  const { warning, critical, inverse } = threshold;

  if (inverse) {
    // Lower values are worse (e.g., success rate)
    if (value <= critical) return 'error';
    if (value <= warning) return 'warning';
    return 'success';
  } else {
    // Higher values are worse (e.g., pending count)
    if (value >= critical) return 'error';
    if (value >= warning) return 'warning';
    return 'success';
  }
}

// Status color classes
const statusClasses = {
  success: 'border-status-success bg-status-success/5',
  warning: 'border-status-warning bg-status-warning/5',
  error: 'border-status-error bg-status-error/5',
};

const statusTextClasses = {
  success: 'text-status-success',
  warning: 'text-status-warning',
  error: 'text-status-error',
};

export default function KPIHeader({
  kpis,
  isLoading = false,
  lastUpdated,
  className,
  onKPIClick,
  onRefresh,
}: KPIHeaderProps) {
  // Handle KPI click
  const handleClick = useCallback(
    (kpiId: string) => {
      onKPIClick?.(kpiId);
    },
    [onKPIClick]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className={clsx('space-y-2', className)} data-testid="kpi-loading">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4" data-testid="kpi-header">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-24 rounded-lg border border-border-primary bg-bg-secondary animate-pulse"
              data-testid="kpi-skeleton"
            />
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (kpis.length === 0) {
    return (
      <div className={clsx('p-4 text-center text-text-muted', className)} data-testid="kpi-header">
        <p>No metrics available</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Refresh row */}
      {(onRefresh || lastUpdated) && (
        <div className="flex items-center justify-end gap-2 text-xs text-text-muted">
          {lastUpdated && <span>Updated {lastUpdated}</span>}
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-1 rounded hover:bg-bg-tertiary transition-colors"
              aria-label="Refresh metrics"
              data-testid="refresh-button"
            >
              <ArrowPathIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* KPI grid */}
      <div
        className={clsx('grid grid-cols-2 md:grid-cols-5 gap-4', className)}
        data-testid="kpi-header"
      >
        {kpis.map((kpi) => {
          const status = getStatusColor(kpi.value, kpi.threshold);
          const formattedValue = `${kpi.value}${kpi.unit || ''}`;

          const Component = onKPIClick ? 'button' : 'div';
          const clickProps = onKPIClick
            ? {
                onClick: () => handleClick(kpi.id),
                tabIndex: 0,
              }
            : {};

          return (
            <Component
              key={kpi.id}
              className={clsx(
                'flex flex-col justify-between p-4 rounded-lg border-2 transition-colors',
                statusClasses[status],
                onKPIClick && 'cursor-pointer hover:opacity-80'
              )}
              aria-label={`${kpi.label}: ${formattedValue}`}
              data-testid={`kpi-${kpi.id}`}
              {...clickProps}
            >
              {/* Label */}
              <span className="text-xs text-text-muted uppercase tracking-wide">
                {kpi.label}
              </span>

              {/* Value and trend */}
              <div className="flex items-end justify-between mt-2">
                <span className={clsx('text-2xl font-bold', statusTextClasses[status])}>
                  {formattedValue}
                </span>

                {/* Trend indicator */}
                {kpi.trend && (
                  <div className="flex items-center gap-1">
                    {kpi.trend === 'up' && (
                      <ArrowTrendingUpIcon
                        className="h-4 w-4 text-status-success"
                        aria-hidden="true"
                        data-testid="trend-up"
                      />
                    )}
                    {kpi.trend === 'down' && (
                      <ArrowTrendingDownIcon
                        className="h-4 w-4 text-status-error"
                        aria-hidden="true"
                        data-testid="trend-down"
                      />
                    )}
                    {kpi.trend === 'stable' && (
                      <MinusIcon
                        className="h-4 w-4 text-text-muted"
                        aria-hidden="true"
                        data-testid="trend-stable"
                      />
                    )}
                    {kpi.trendValue && (
                      <span className="text-xs text-text-muted">{kpi.trendValue}</span>
                    )}
                  </div>
                )}
              </div>
            </Component>
          );
        })}
      </div>
    </div>
  );
}
