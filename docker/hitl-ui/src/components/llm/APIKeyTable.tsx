/**
 * APIKeyTable Component (P05-F13 T05)
 *
 * Table displaying API keys with masked values, status, and actions.
 */

import { useCallback, useState } from 'react';
import clsx from 'clsx';
import {
  KeyIcon,
  TrashIcon,
  PlayIcon,
  CheckCircleIcon,
  XCircleIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';
import type { APIKey, LLMProvider } from '../../types/llmConfig';
import {
  KEY_STATUS_COLORS,
  KEY_STATUS_LABELS,
  PROVIDER_NAMES,
} from '../../types/llmConfig';
import { formatRelativeTime } from '../../api/llmConfig';
import Spinner from '../common/Spinner';

export interface APIKeyTableProps {
  /** List of API keys to display */
  keys: APIKey[];
  /** Whether keys are loading */
  isLoading?: boolean;
  /** Callback when test button clicked */
  onTest?: (keyId: string) => void;
  /** Callback when delete button clicked */
  onDelete?: (keyId: string) => void;
  /** ID of key currently being tested */
  testingKeyId?: string | null;
  /** ID of key currently being deleted */
  deletingKeyId?: string | null;
  /** Custom class name */
  className?: string;
}

interface StatusBadgeProps {
  status: APIKey['status'];
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
      {KEY_STATUS_LABELS[status]}
    </span>
  );
}

interface ProviderBadgeProps {
  provider: LLMProvider;
}

function ProviderBadge({ provider }: ProviderBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
        provider === 'anthropic' && 'bg-orange-500/10 text-orange-400',
        provider === 'openai' && 'bg-green-500/10 text-green-400',
        provider === 'google' && 'bg-blue-500/10 text-blue-400'
      )}
    >
      {PROVIDER_NAMES[provider]}
    </span>
  );
}

export default function APIKeyTable({
  keys,
  isLoading = false,
  onTest,
  onDelete,
  testingKeyId,
  deletingKeyId,
  className,
}: APIKeyTableProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDeleteClick = useCallback((keyId: string) => {
    if (confirmDeleteId === keyId) {
      // Second click - confirm delete
      onDelete?.(keyId);
      setConfirmDeleteId(null);
    } else {
      // First click - ask for confirmation
      setConfirmDeleteId(keyId);
    }
  }, [confirmDeleteId, onDelete]);

  const handleCancelDelete = useCallback(() => {
    setConfirmDeleteId(null);
  }, []);

  if (isLoading) {
    return (
      <div
        data-testid="api-key-table-loading"
        className={clsx('flex items-center justify-center py-8', className)}
      >
        <Spinner className="h-6 w-6" />
        <span className="ml-2 text-text-secondary">Loading API keys...</span>
      </div>
    );
  }

  if (keys.length === 0) {
    return (
      <div
        data-testid="api-key-table-empty"
        className={clsx(
          'flex flex-col items-center justify-center py-8 text-center',
          className
        )}
      >
        <KeyIcon className="h-12 w-12 text-text-muted mb-3" />
        <p className="text-text-secondary">No API keys configured</p>
        <p className="text-sm text-text-muted mt-1">
          Add an API key to get started
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="api-key-table"
      className={clsx('overflow-x-auto', className)}
    >
      <table className="w-full">
        <thead>
          <tr className="border-b border-border-primary">
            <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-text-muted">
              Name
            </th>
            <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-text-muted">
              Provider
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
          {keys.map((key) => (
            <tr
              key={key.id}
              data-testid={'api-key-row-' + key.id}
              className="border-b border-border-subtle hover:bg-bg-tertiary/50 transition-colors"
            >
              <td className="py-3 px-4">
                <span className="font-medium text-text-primary">{key.name}</span>
              </td>
              <td className="py-3 px-4">
                <ProviderBadge provider={key.provider} />
              </td>
              <td className="py-3 px-4">
                <code className="text-sm text-text-secondary font-mono bg-bg-tertiary px-2 py-0.5 rounded">
                  {key.keyMasked}
                </code>
              </td>
              <td className="py-3 px-4">
                <StatusBadge status={key.status} />
              </td>
              <td className="py-3 px-4 text-sm text-text-secondary">
                {formatRelativeTime(key.lastUsed)}
              </td>
              <td className="py-3 px-4">
                <div className="flex items-center justify-end gap-2">
                  <button
                    data-testid={'test-key-' + key.id}
                    onClick={() => onTest?.(key.id)}
                    disabled={testingKeyId === key.id}
                    className={clsx(
                      'p-1.5 rounded text-text-secondary hover:text-accent-blue hover:bg-accent-blue/10',
                      'transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                    title="Test key"
                  >
                    {testingKeyId === key.id ? (
                      <Spinner className="h-4 w-4" />
                    ) : (
                      <PlayIcon className="h-4 w-4" />
                    )}
                  </button>
                  {confirmDeleteId === key.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        data-testid={'confirm-delete-' + key.id}
                        onClick={() => handleDeleteClick(key.id)}
                        disabled={deletingKeyId === key.id}
                        className={clsx(
                          'px-2 py-1 rounded text-xs font-medium',
                          'bg-status-error text-white hover:bg-status-error/90',
                          'transition-colors disabled:opacity-50'
                        )}
                      >
                        {deletingKeyId === key.id ? 'Deleting...' : 'Confirm'}
                      </button>
                      <button
                        data-testid={'cancel-delete-' + key.id}
                        onClick={handleCancelDelete}
                        className="px-2 py-1 rounded text-xs font-medium text-text-secondary hover:text-text-primary"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      data-testid={'delete-key-' + key.id}
                      onClick={() => handleDeleteClick(key.id)}
                      disabled={deletingKeyId === key.id}
                      className={clsx(
                        'p-1.5 rounded text-text-secondary hover:text-status-error hover:bg-status-error/10',
                        'transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                      )}
                      title="Delete key"
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
