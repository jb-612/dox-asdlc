/**
 * GateStatusBanner - Show HITL gate status in studio (P05-F11 T16)
 *
 * Features:
 * - Status badge (pending/approved/rejected) - reuses GateStatusBadge styling
 * - Link to gate detail page (/gates/{gateId})
 * - Auto-refresh status (poll every 30s or use callback)
 * - Hidden when no gate exists
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowPathIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import type { GateStatus } from '../../../api/types';

export interface GateStatusBannerProps {
  /** Gate ID to display status for, or null/undefined when no gate exists */
  gateId: string | null | undefined;
  /** Current status */
  status: GateStatus;
  /** Custom class name */
  className?: string;
  /** Callback to refresh status (should return new status) */
  onRefresh?: () => Promise<GateStatus>;
  /** Callback when status changes */
  onStatusChange?: (newStatus: GateStatus) => void;
  /** Refresh interval in ms (default: 30000ms = 30s) */
  refreshInterval?: number;
}

const statusConfig: Record<GateStatus, {
  label: string;
  message: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeClass: string;
  borderClass: string;
  bgClass: string;
}> = {
  pending: {
    label: 'Pending',
    message: 'Waiting for review',
    icon: ClockIcon,
    badgeClass: 'bg-status-warning text-white',
    borderClass: 'border-status-warning',
    bgClass: 'bg-status-warning/10',
  },
  approved: {
    label: 'Approved',
    message: 'Your PRD has been approved',
    icon: CheckCircleIcon,
    badgeClass: 'bg-status-success text-white',
    borderClass: 'border-status-success',
    bgClass: 'bg-status-success/10',
  },
  rejected: {
    label: 'Rejected',
    message: 'Your PRD was rejected. Please review feedback.',
    icon: XCircleIcon,
    badgeClass: 'bg-status-error text-white',
    borderClass: 'border-status-error',
    bgClass: 'bg-status-error/10',
  },
  expired: {
    label: 'Expired',
    message: 'Gate has expired. Please resubmit.',
    icon: ClockIcon,
    badgeClass: 'bg-bg-tertiary text-text-muted',
    borderClass: 'border-border-secondary',
    bgClass: 'bg-bg-secondary',
  },
};

export default function GateStatusBanner({
  gateId,
  status,
  className,
  onRefresh,
  onStatusChange,
  refreshInterval = 30000,
}: GateStatusBannerProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(status);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRefreshingRef = useRef(isRefreshing);

  // Keep ref in sync with state
  useEffect(() => {
    isRefreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  // Update current status when prop changes
  useEffect(() => {
    setCurrentStatus(status);
  }, [status]);

  const doRefresh = useCallback(async () => {
    if (!onRefresh || isRefreshingRef.current) return;

    setIsRefreshing(true);
    try {
      const newStatus = await onRefresh();
      if (newStatus !== currentStatus) {
        setCurrentStatus(newStatus);
        onStatusChange?.(newStatus);
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh, currentStatus, onStatusChange]);

  // Use ref to hold the callback to avoid recreating the interval on every render
  const doRefreshRef = useRef(doRefresh);
  useEffect(() => {
    doRefreshRef.current = doRefresh;
  }, [doRefresh]);

  // Set up auto-refresh interval for pending status only
  useEffect(() => {
    // Only auto-refresh if status is pending and we have a refresh callback
    if (currentStatus !== 'pending' || !onRefresh) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      doRefreshRef.current();
    }, refreshInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [currentStatus, onRefresh, refreshInterval]); // Removed doRefresh from deps

  // Don't render if no gate
  if (!gateId) {
    return null;
  }

  const config = statusConfig[currentStatus];
  const Icon = config.icon;

  return (
    <div
      data-testid="gate-status-banner"
      role="status"
      aria-live="polite"
      className={clsx(
        'rounded-lg border-l-4 p-4',
        config.borderClass,
        config.bgClass,
        className
      )}
    >
      <div className="flex items-center justify-between gap-4">
        {/* Left side: Status info */}
        <div className="flex items-center gap-3">
          <Icon className="h-6 w-6 text-current" />
          <div>
            <div className="flex items-center gap-2">
              <span
                data-testid="status-badge"
                className={clsx(
                  'px-2 py-0.5 rounded-full text-xs font-medium',
                  config.badgeClass
                )}
              >
                {config.label}
              </span>
              <span
                data-testid="gate-id"
                className="text-xs font-mono text-text-muted"
              >
                {gateId}
              </span>
            </div>
            <p
              data-testid="status-message"
              className="text-sm text-text-secondary mt-1"
            >
              {config.message}
            </p>
          </div>
        </div>

        {/* Right side: Actions */}
        <div className="flex items-center gap-2">
          {/* Refresh indicator */}
          {isRefreshing && (
            <div data-testid="refresh-indicator" className="flex items-center gap-1 text-text-muted text-sm">
              <ArrowPathIcon className="h-4 w-4 animate-spin" />
              <span className="sr-only">Refreshing</span>
            </div>
          )}

          {/* Manual refresh button */}
          {onRefresh && (
            <button
              data-testid="manual-refresh"
              onClick={doRefresh}
              disabled={isRefreshing}
              aria-label="Refresh gate status"
              className={clsx(
                'p-2 rounded-lg transition-colors',
                isRefreshing
                  ? 'text-text-muted cursor-not-allowed'
                  : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
              )}
            >
              <ArrowPathIcon className={clsx('h-4 w-4', isRefreshing && 'animate-spin')} />
            </button>
          )}

          {/* Link to gate detail */}
          <Link
            data-testid="gate-link"
            to={`/gates/${gateId}`}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-bg-tertiary text-text-secondary hover:bg-bg-primary hover:text-text-primary transition-colors text-sm"
          >
            <span>View Details</span>
            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
