/**
 * GitIntegrationPanel - Displays git state per environment
 *
 * Shows branch, SHA, pending commits, recent commits, and sync status
 * for each configured environment. Supports force sync with confirmation.
 */

import { useState, useCallback } from 'react';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

/** Commit info */
export interface GitCommit {
  /** Commit SHA */
  sha: string;
  /** Commit message */
  message: string;
  /** Author name */
  author: string;
  /** Commit date */
  date: string;
}

/** Environment sync status */
export type GitSyncStatus = 'synced' | 'pending' | 'drift';

/** Environment git state */
export interface EnvironmentGitState {
  /** Environment ID */
  id: string;
  /** Environment name */
  name: string;
  /** Current branch */
  branch: string;
  /** Current SHA (full) */
  sha: string;
  /** Number of pending commits */
  pendingCommits: number;
  /** Recent commits */
  recentCommits: GitCommit[];
  /** Sync status */
  status: GitSyncStatus;
  /** Last sync timestamp */
  lastSyncAt: string;
}

export interface GitIntegrationPanelProps {
  /** Environment git states */
  environments: EnvironmentGitState[];
  /** Loading state */
  isLoading?: boolean;
  /** Repository URL for "View in Git" links */
  repoUrl?: string;
  /** Whether panel is collapsible */
  collapsible?: boolean;
  /** Custom class name */
  className?: string;
  /** Callback when environment is clicked */
  onEnvironmentClick?: (envId: string) => void;
  /** Callback when force sync is requested */
  onForceSync?: (envId: string) => void;
  /** Callback when refresh is requested */
  onRefresh?: () => void;
}

// Status display config
const statusConfig: Record<GitSyncStatus, { icon: typeof CheckCircleIcon; label: string; className: string }> = {
  synced: {
    icon: CheckCircleIcon,
    label: 'Synced',
    className: 'text-status-success',
  },
  pending: {
    icon: ClockIcon,
    label: 'Pending',
    className: 'text-status-warning',
  },
  drift: {
    icon: ExclamationTriangleIcon,
    label: 'Drift detected',
    className: 'text-status-warning',
  },
};

export default function GitIntegrationPanel({
  environments,
  isLoading = false,
  repoUrl,
  collapsible = false,
  className,
  onEnvironmentClick,
  onForceSync,
  onRefresh,
}: GitIntegrationPanelProps) {
  const [expandedEnvs, setExpandedEnvs] = useState<Set<string>>(new Set());
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [confirmingSync, setConfirmingSync] = useState<string | null>(null);

  // Toggle environment expansion
  const toggleExpand = useCallback((envId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedEnvs((prev) => {
      const next = new Set(prev);
      if (next.has(envId)) {
        next.delete(envId);
      } else {
        next.add(envId);
      }
      return next;
    });
  }, []);

  // Handle environment click
  const handleEnvClick = useCallback(
    (envId: string) => {
      onEnvironmentClick?.(envId);
    },
    [onEnvironmentClick]
  );

  // Handle force sync click
  const handleForceSyncClick = useCallback((envId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmingSync(envId);
  }, []);

  // Confirm force sync
  const confirmForceSync = useCallback(() => {
    if (confirmingSync && onForceSync) {
      onForceSync(confirmingSync);
    }
    setConfirmingSync(null);
  }, [confirmingSync, onForceSync]);

  // Cancel force sync
  const cancelForceSync = useCallback(() => {
    setConfirmingSync(null);
  }, []);

  // Format short SHA
  const shortSha = (sha: string) => sha.slice(0, 7);

  // Format relative time
  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  // Build git URL for a commit
  const buildGitUrl = (sha: string) => {
    if (!repoUrl) return '';
    return `${repoUrl}/commit/${sha}`;
  };

  // Loading state
  if (isLoading) {
    return (
      <div
        className={clsx('rounded-lg border border-border-primary bg-bg-secondary p-4', className)}
        data-testid="git-panel-loading"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text-primary">Git Integration</h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 rounded-lg bg-bg-tertiary animate-pulse"
              data-testid="env-skeleton"
            />
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (environments.length === 0) {
    return (
      <div
        className={clsx('rounded-lg border border-border-primary bg-bg-secondary p-4', className)}
        data-testid="git-integration-panel"
        role="region"
        aria-label="Git Integration"
      >
        <h3 className="text-lg font-semibold text-text-primary mb-4">Git Integration</h3>
        <p className="text-center text-text-muted py-8">No environments configured</p>
      </div>
    );
  }

  return (
    <div
      className={clsx('rounded-lg border border-border-primary bg-bg-secondary p-4', className)}
      data-testid="git-integration-panel"
      role="region"
      aria-label="Git Integration"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {collapsible && (
            <button
              onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
              className="p-1 rounded hover:bg-bg-tertiary transition-colors"
              data-testid="collapse-panel"
              aria-expanded={!isPanelCollapsed}
            >
              {isPanelCollapsed ? (
                <ChevronRightIcon className="h-5 w-5 text-text-muted" />
              ) : (
                <ChevronDownIcon className="h-5 w-5 text-text-muted" />
              )}
            </button>
          )}
          <h3 className="text-lg font-semibold text-text-primary">Git Integration</h3>
        </div>

        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-2 rounded-lg text-text-muted hover:bg-bg-tertiary hover:text-text-primary transition-colors"
            data-testid="refresh-button"
            title="Refresh git state"
          >
            <ArrowPathIcon className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Environment list */}
      {!isPanelCollapsed && (
        <div className="space-y-3">
          {environments.map((env) => {
            const isExpanded = expandedEnvs.has(env.id);
            const statusInfo = statusConfig[env.status];
            const StatusIcon = statusInfo.icon;

            return (
              <div
                key={env.id}
                className={clsx(
                  'rounded-lg border border-border-secondary bg-bg-tertiary overflow-hidden transition-colors',
                  onEnvironmentClick && 'cursor-pointer hover:border-border-primary'
                )}
                data-testid={`env-${env.id}`}
                onClick={() => onEnvironmentClick && handleEnvClick(env.id)}
              >
                {/* Environment header */}
                <div className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {/* Name and status */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-text-primary">{env.name}</span>
                        <span
                          className={clsx('flex items-center gap-1 text-xs', statusInfo.className)}
                          data-testid={`status-${env.status}`}
                          aria-label={statusInfo.label}
                        >
                          <StatusIcon className="h-3.5 w-3.5" />
                          <span>{statusInfo.label}</span>
                        </span>
                      </div>

                      {/* Branch and SHA */}
                      <div className="flex items-center gap-2 text-sm">
                        <span className="px-1.5 py-0.5 rounded bg-bg-primary text-text-secondary font-mono text-xs">
                          {env.branch}
                        </span>
                        <span className="font-mono text-xs text-text-muted">
                          {shortSha(env.sha)}
                        </span>
                        {env.pendingCommits > 0 && (
                          <span className="text-xs text-status-warning">
                            {env.pendingCommits} pending
                          </span>
                        )}
                      </div>

                      {/* Last sync */}
                      <div className="text-xs text-text-muted mt-1">
                        Last sync: {formatRelativeTime(env.lastSyncAt)}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      {repoUrl && (
                        <a
                          href={buildGitUrl(env.sha)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-bg-primary transition-colors"
                          data-testid="view-in-git"
                          onClick={(e) => e.stopPropagation()}
                          title="View in Git"
                        >
                          <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                        </a>
                      )}

                      {onForceSync && (
                        <button
                          onClick={(e) => handleForceSyncClick(env.id, e)}
                          className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-bg-primary transition-colors"
                          data-testid="force-sync"
                          title="Force sync"
                        >
                          <ArrowPathIcon className="h-4 w-4" />
                        </button>
                      )}

                      <button
                        onClick={(e) => toggleExpand(env.id, e)}
                        className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-bg-primary transition-colors"
                        data-testid={`expand-${env.id}`}
                        aria-expanded={isExpanded}
                        title={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        {isExpanded ? (
                          <ChevronDownIcon className="h-4 w-4" />
                        ) : (
                          <ChevronRightIcon className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Recent commits (expanded) */}
                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-border-secondary">
                    <div className="pt-2">
                      <div className="text-xs font-medium text-text-muted mb-2">Recent Commits</div>
                      {env.recentCommits.length === 0 ? (
                        <p className="text-xs text-text-muted italic">No recent commits</p>
                      ) : (
                        <div className="space-y-2">
                          {env.recentCommits.map((commit) => (
                            <div
                              key={commit.sha}
                              className="flex items-start gap-2 text-xs"
                            >
                              <span className="font-mono text-text-muted shrink-0">
                                {shortSha(commit.sha)}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-text-secondary truncate">{commit.message}</p>
                                <p className="text-text-muted">
                                  {commit.author} · {formatRelativeTime(commit.date)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation dialog */}
      {confirmingSync && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          data-testid="confirm-dialog"
        >
          <div className="bg-bg-secondary border border-border-primary rounded-lg p-6 max-w-sm mx-4 shadow-xl">
            <h4 className="text-lg font-semibold text-text-primary mb-2">Force Sync?</h4>
            <p className="text-text-secondary text-sm mb-4">
              This will force synchronize the environment. Any pending changes may be overwritten.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={cancelForceSync}
                className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:bg-bg-tertiary transition-colors"
                data-testid="cancel-action"
              >
                Cancel
              </button>
              <button
                onClick={confirmForceSync}
                className="px-4 py-2 rounded-lg text-sm bg-status-warning text-white hover:bg-status-warning/90 transition-colors"
                data-testid="confirm-action"
              >
                Force Sync
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
