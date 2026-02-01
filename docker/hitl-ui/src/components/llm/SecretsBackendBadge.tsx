/**
 * SecretsBackendBadge Component (P09-F01 T08)
 *
 * Displays the current secrets backend type and health status.
 * Shows env/infisical/gcp with appropriate styling.
 */

import clsx from 'clsx';
import {
  CloudIcon,
  ServerStackIcon,
  CommandLineIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import Spinner from '../common/Spinner';
import type {
  SecretsBackend,
  SecretsHealthStatus,
  SecretsHealthResponse,
} from '../../types/llmConfig';
import { SECRETS_BACKEND_NAMES } from '../../types/llmConfig';

export interface SecretsBackendBadgeProps {
  /** Health response from the API */
  health?: SecretsHealthResponse | null;
  /** Whether health data is loading */
  isLoading?: boolean;
  /** Error message if health check failed */
  error?: string;
  /** Custom class name */
  className?: string;
}

function getBackendIcon(backend: SecretsBackend) {
  switch (backend) {
    case 'infisical':
      return ServerStackIcon;
    case 'gcp':
      return CloudIcon;
    case 'env':
    default:
      return CommandLineIcon;
  }
}

function getStatusIcon(status: SecretsHealthStatus) {
  switch (status) {
    case 'healthy':
      return CheckCircleIcon;
    case 'degraded':
      return ExclamationTriangleIcon;
    case 'unhealthy':
      return XCircleIcon;
  }
}

function getStatusColor(status: SecretsHealthStatus) {
  switch (status) {
    case 'healthy':
      return 'text-status-success';
    case 'degraded':
      return 'text-status-warning';
    case 'unhealthy':
      return 'text-status-error';
  }
}

function getBackendColor(backend: SecretsBackend) {
  switch (backend) {
    case 'infisical':
      return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    case 'gcp':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    case 'env':
    default:
      return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  }
}

export default function SecretsBackendBadge({
  health,
  isLoading = false,
  error,
  className,
}: SecretsBackendBadgeProps) {
  if (isLoading) {
    return (
      <div
        data-testid="secrets-backend-badge-loading"
        className={clsx(
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border',
          'bg-bg-tertiary border-border-primary',
          className
        )}
      >
        <Spinner className="h-4 w-4" />
        <span className="text-sm text-text-secondary">Loading secrets backend...</span>
      </div>
    );
  }

  if (error || !health) {
    return (
      <div
        data-testid="secrets-backend-badge-error"
        className={clsx(
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border',
          'bg-status-error/10 border-status-error/20',
          className
        )}
      >
        <XCircleIcon className="h-4 w-4 text-status-error" />
        <span className="text-sm text-status-error">
          {error || 'Failed to check secrets backend'}
        </span>
      </div>
    );
  }

  const BackendIcon = getBackendIcon(health.backend);
  const StatusIcon = getStatusIcon(health.status);
  const statusColor = getStatusColor(health.status);
  const backendColor = getBackendColor(health.backend);

  return (
    <div
      data-testid="secrets-backend-badge"
      className={clsx(
        'inline-flex items-center gap-3 px-3 py-1.5 rounded-lg border',
        backendColor,
        className
      )}
      title={`Secrets backend: ${SECRETS_BACKEND_NAMES[health.backend]} (${health.status})`}
    >
      <div className="flex items-center gap-1.5">
        <BackendIcon className="h-4 w-4" />
        <span className="text-sm font-medium">
          {SECRETS_BACKEND_NAMES[health.backend]}
        </span>
      </div>
      <div className={clsx('flex items-center gap-1', statusColor)}>
        <StatusIcon className="h-3.5 w-3.5" />
        <span className="text-xs capitalize">{health.status}</span>
      </div>
    </div>
  );
}
