/**
 * IntegrationCredentialsTable Component (P05-F13 Extension)
 *
 * Table displaying integration credentials with masked values, status, and actions.
 */

import { useCallback, useState } from 'react';
import clsx from 'clsx';
import {
  LinkIcon,
  TrashIcon,
  PlayIcon,
  CheckCircleIcon,
  XCircleIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';
import type {
  IntegrationCredential,
  IntegrationType,
  IntegrationCredentialStatus,
} from '../../types/llmConfig';
import {
  INTEGRATION_NAMES,
  INTEGRATION_STATUS_LABELS,
} from '../../types/llmConfig';
import { formatRelativeTime } from '../../api/llmConfig';
import Spinner from '../common/Spinner';

export interface IntegrationCredentialsTableProps {
  /** List of credentials to display */
  credentials: IntegrationCredential[];
  /** Whether credentials are loading */
  isLoading?: boolean;
  /** Callback when test button clicked */
  onTest?: (credentialId: string) => void;
  /** Callback when delete button clicked */
  onDelete?: (credentialId: string) => void;
  /** ID of credential currently being tested */
  testingCredentialId?: string | null;
  /** ID of credential currently being deleted */
  deletingCredentialId?: string | null;
  /** Custom class name */
  className?: string;
}

interface StatusBadgeProps {
  status: IntegrationCredentialStatus;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const Icon = status === 'valid'
    ? CheckCircleIcon
    : status === 'invalid'
    ? XCircleIcon
    : QuestionMarkCircleIcon;

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        status === 'valid' && 'bg-status-success/10 text-status-success',
        status === 'invalid' && 'bg-status-error/10 text-status-error',
        status === 'untested' && 'bg-status-warning/10 text-status-warning'
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {INTEGRATION_STATUS_LABELS[status]}
    </span>
  );
}

interface IntegrationBadgeProps {
  integrationType: IntegrationType;
}

function IntegrationBadge({ integrationType }: IntegrationBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
        integrationType === 'slack' && 'bg-purple-500/10 text-purple-400',
        integrationType === 'teams' && 'bg-blue-500/10 text-blue-400',
        integrationType === 'github' && 'bg-gray-500/10 text-gray-300'
      )}
    >
      {INTEGRATION_NAMES[integrationType]}
    </span>
  );
}

export default function IntegrationCredentialsTable({
  credentials,
  isLoading = false,
  onTest,
  onDelete,
  testingCredentialId,
  deletingCredentialId,
  className,
}: IntegrationCredentialsTableProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDeleteClick = useCallback((credentialId: string) => {
    if (confirmDeleteId === credentialId) {
      onDelete?.(credentialId);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(credentialId);
    }
  }, [confirmDeleteId, onDelete]);

  const handleCancelDelete = useCallback(() => {
    setConfirmDeleteId(null);
  }, []);

  if (isLoading) {
    return (
      <div
        data-testid="integration-credentials-table-loading"
        className={clsx('flex items-center justify-center py-8', className)}
      >
        <Spinner className="h-6 w-6" />
        <span className="ml-2 text-text-secondary">Loading credentials...</span>
      </div>
    );
  }

  if (credentials.length === 0) {
    return (
      <div
        data-testid="integration-credentials-table-empty"
        className={clsx(
          'flex flex-col items-center justify-center py-8 text-center',
          className
        )}
      >
        <LinkIcon className="h-12 w-12 text-text-muted mb-3" />
        <p className="text-text-secondary">No integration credentials configured</p>
        <p className="text-sm text-text-muted mt-1">
          Add credentials to connect to Slack, Teams, or GitHub
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="integration-credentials-table"
      className={clsx('overflow-x-auto', className)}
    >
      <table className="w-full">
        <thead>
          <tr className="border-b border-border-primary">
            <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-text-muted">
              Name
            </th>
            <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-text-muted">
              Integration
            </th>
            <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-text-muted">
              Type
            </th>
            <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-text-muted">
              Key
            </th>
            <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-text-muted">
              Status
            </th>
            <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-text-muted">
              Last Used
            </th>
            <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wider text-text-muted">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {credentials.map((cred) => (
            <tr
              key={cred.id}
              data-testid={'integration-credential-row-' + cred.id}
              className="border-b border-border-subtle hover:bg-bg-tertiary/50 transition-colors"
            >
              <td className="py-3 px-4">
                <span className="font-medium text-text-primary">{cred.name}</span>
              </td>
              <td className="py-3 px-4">
                <IntegrationBadge integrationType={cred.integrationType} />
              </td>
              <td className="py-3 px-4">
                <span className="text-sm text-text-secondary">{cred.credentialType}</span>
              </td>
              <td className="py-3 px-4">
                <code className="text-sm text-text-secondary font-mono bg-bg-tertiary px-2 py-0.5 rounded">
                  {cred.keyMasked}
                </code>
              </td>
              <td className="py-3 px-4">
                <StatusBadge status={cred.status} />
              </td>
              <td className="py-3 px-4 text-sm text-text-secondary">
                {formatRelativeTime(cred.lastUsed)}
              </td>
              <td className="py-3 px-4">
                <div className="flex items-center justify-end gap-2">
                  <button
                    data-testid={'test-credential-' + cred.id}
                    onClick={() => onTest?.(cred.id)}
                    disabled={testingCredentialId === cred.id}
                    className={clsx(
                      'p-1.5 rounded text-text-secondary hover:text-accent-blue hover:bg-accent-blue/10',
                      'transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                    title="Test credential"
                  >
                    {testingCredentialId === cred.id ? (
                      <Spinner className="h-4 w-4" />
                    ) : (
                      <PlayIcon className="h-4 w-4" />
                    )}
                  </button>
                  {confirmDeleteId === cred.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        data-testid={'confirm-delete-' + cred.id}
                        onClick={() => handleDeleteClick(cred.id)}
                        disabled={deletingCredentialId === cred.id}
                        className={clsx(
                          'px-2 py-1 rounded text-xs font-medium',
                          'bg-status-error text-white hover:bg-status-error/90',
                          'transition-colors disabled:opacity-50'
                        )}
                      >
                        {deletingCredentialId === cred.id ? 'Deleting...' : 'Confirm'}
                      </button>
                      <button
                        data-testid={'cancel-delete-' + cred.id}
                        onClick={handleCancelDelete}
                        className="px-2 py-1 rounded text-xs font-medium text-text-secondary hover:text-text-primary"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      data-testid={'delete-credential-' + cred.id}
                      onClick={() => handleDeleteClick(cred.id)}
                      disabled={deletingCredentialId === cred.id}
                      className={clsx(
                        'p-1.5 rounded text-text-secondary hover:text-status-error hover:bg-status-error/10',
                        'transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                      )}
                      title="Delete credential"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
