/**
 * HealthCheckPanel - Health check buttons and results for K8s Dashboard
 *
 * Features:
 * - Grid of health check buttons
 * - Status indicator per check (pass/fail/warning/pending)
 * - "Run All" button
 * - Last run timestamp and duration
 * - Expandable result details
 */

import { useState, useCallback } from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  PlayIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useRunHealthCheck } from '../../api/kubernetes';
import type { HealthCheckType, HealthCheckResult, HealthCheckStatus } from '../../api/types/kubernetes';
import { healthCheckTypeLabels } from '../../api/types/kubernetes';

export interface HealthCheckPanelProps {
  /** Initial results (if any) */
  initialResults?: Record<HealthCheckType, HealthCheckResult>;
  /** Custom class name */
  className?: string;
}

// All health check types
const healthCheckTypes: HealthCheckType[] = [
  'dns',
  'connectivity',
  'storage',
  'api-server',
  'etcd',
  'scheduler',
  'controller',
];

// Status configurations
const statusConfig: Record<HealthCheckStatus, { color: string; bg: string; icon: typeof CheckCircleIcon }> = {
  pass: {
    color: 'text-status-success',
    bg: 'bg-status-success/10 border-status-success/30',
    icon: CheckCircleIcon,
  },
  fail: {
    color: 'text-status-error',
    bg: 'bg-status-error/10 border-status-error/30',
    icon: XCircleIcon,
  },
  warning: {
    color: 'text-status-warning',
    bg: 'bg-status-warning/10 border-status-warning/30',
    icon: ExclamationTriangleIcon,
  },
  pending: {
    color: 'text-text-muted',
    bg: 'bg-bg-tertiary border-border-primary',
    icon: ClockIcon,
  },
};

interface HealthCheckButtonProps {
  type: HealthCheckType;
  result?: HealthCheckResult;
  isRunning: boolean;
  onRun: () => void;
}

function HealthCheckButton({ type, result, isRunning, onRun }: HealthCheckButtonProps) {
  const [expanded, setExpanded] = useState(false);

  const status = result?.status || 'pending';
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <div
      className={clsx(
        'rounded-lg border transition-all',
        config.bg
      )}
      data-testid={`health-check-${type}`}
    >
      {/* Button Header */}
      <button
        onClick={onRun}
        disabled={isRunning}
        className="w-full p-3 flex items-center justify-between text-left"
        data-testid={`run-check-${type}`}
      >
        <div className="flex items-center gap-2">
          {isRunning ? (
            <div className="h-5 w-5 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
          ) : (
            <StatusIcon className={clsx('h-5 w-5', config.color)} data-testid="status-icon" />
          )}
          <span className="font-medium text-text-primary text-sm">
            {healthCheckTypeLabels[type]}
          </span>
        </div>
        {!isRunning && (
          <PlayIcon className="h-4 w-4 text-text-muted hover:text-accent-blue transition-colors" />
        )}
      </button>

      {/* Result info */}
      {result && (
        <div className="px-3 pb-3 border-t border-border-primary/50">
          <div className="flex items-center justify-between mt-2 text-xs text-text-muted">
            <span>{result.message}</span>
            <span>{result.duration}ms</span>
          </div>

          {/* Expandable details */}
          {result.details && Object.keys(result.details).length > 0 && (
            <>
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 mt-2 text-xs text-accent-blue hover:text-accent-blue/80"
                data-testid={`expand-${type}`}
              >
                {expanded ? (
                  <ChevronUpIcon className="h-3 w-3" />
                ) : (
                  <ChevronDownIcon className="h-3 w-3" />
                )}
                {expanded ? 'Hide details' : 'Show details'}
              </button>

              {expanded && (
                <pre
                  className="mt-2 p-2 text-xs bg-bg-tertiary rounded overflow-x-auto"
                  data-testid={`details-${type}`}
                >
                  {JSON.stringify(result.details, null, 2)}
                </pre>
              )}
            </>
          )}

          {/* Timestamp */}
          <div className="mt-2 text-xs text-text-muted">
            Last run: {new Date(result.timestamp).toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
}

export default function HealthCheckPanel({
  initialResults,
  className,
}: HealthCheckPanelProps) {
  const [results, setResults] = useState<Record<string, HealthCheckResult>>(
    initialResults || {}
  );
  const [runningChecks, setRunningChecks] = useState<Set<HealthCheckType>>(new Set());

  const { mutate: runHealthCheck } = useRunHealthCheck();

  // Run a single health check
  const handleRunCheck = useCallback((type: HealthCheckType) => {
    setRunningChecks((prev) => new Set(prev).add(type));

    runHealthCheck(type, {
      onSuccess: (result) => {
        setResults((prev) => ({ ...prev, [type]: result }));
        setRunningChecks((prev) => {
          const next = new Set(prev);
          next.delete(type);
          return next;
        });
      },
      onError: () => {
        setRunningChecks((prev) => {
          const next = new Set(prev);
          next.delete(type);
          return next;
        });
        // Create a failure result
        setResults((prev) => ({
          ...prev,
          [type]: {
            type,
            status: 'fail' as const,
            message: 'Health check failed to execute',
            duration: 0,
            timestamp: new Date().toISOString(),
          },
        }));
      },
    });
  }, [runHealthCheck]);

  // Run all health checks
  const handleRunAll = useCallback(() => {
    healthCheckTypes.forEach((type) => {
      handleRunCheck(type);
    });
  }, [handleRunCheck]);

  // Count results by status
  const statusCounts = {
    pass: Object.values(results).filter((r) => r.status === 'pass').length,
    fail: Object.values(results).filter((r) => r.status === 'fail').length,
    warning: Object.values(results).filter((r) => r.status === 'warning').length,
    pending: healthCheckTypes.length - Object.keys(results).length,
  };

  const isAnyRunning = runningChecks.size > 0;

  return (
    <div className={className} data-testid="health-check-panel">
      {/* Header with Run All button */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4 text-xs text-text-muted">
          {statusCounts.pass > 0 && (
            <span className="flex items-center gap-1">
              <CheckCircleIcon className="h-4 w-4 text-status-success" />
              {statusCounts.pass} passed
            </span>
          )}
          {statusCounts.warning > 0 && (
            <span className="flex items-center gap-1">
              <ExclamationTriangleIcon className="h-4 w-4 text-status-warning" />
              {statusCounts.warning} warnings
            </span>
          )}
          {statusCounts.fail > 0 && (
            <span className="flex items-center gap-1">
              <XCircleIcon className="h-4 w-4 text-status-error" />
              {statusCounts.fail} failed
            </span>
          )}
        </div>

        <button
          onClick={handleRunAll}
          disabled={isAnyRunning}
          className={clsx(
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            'bg-accent-blue text-white hover:bg-accent-blue/90',
            'disabled:bg-bg-tertiary disabled:text-text-muted disabled:cursor-not-allowed'
          )}
          data-testid="run-all-button"
        >
          {isAnyRunning ? (
            <span className="flex items-center gap-2">
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Running...
            </span>
          ) : (
            'Run All Checks'
          )}
        </button>
      </div>

      {/* Health check grid */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
        data-testid="health-check-grid"
      >
        {healthCheckTypes.map((type) => (
          <HealthCheckButton
            key={type}
            type={type}
            result={results[type]}
            isRunning={runningChecks.has(type)}
            onRun={() => handleRunCheck(type)}
          />
        ))}
      </div>
    </div>
  );
}
