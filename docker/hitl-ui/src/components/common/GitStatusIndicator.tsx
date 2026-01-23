/**
 * GitStatusIndicator - Displays git branch, SHA, and pending commits status
 */

import { useMemo } from 'react';
import clsx from 'clsx';
import {
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';

export interface GitState {
  branch: string;
  sha: string;
  pendingCommits: number;
  isDirty: boolean;
  lastSync?: string;
  remoteBranch?: string;
  ahead?: number;
  behind?: number;
}

export interface GitStatusIndicatorProps {
  /** Git state data */
  state: GitState;
  /** Show full SHA or truncated */
  showFullSha?: boolean;
  /** Show drift warning when behind remote */
  showDriftWarning?: boolean;
  /** Git provider URL base (e.g., https://github.com/org/repo) */
  gitUrl?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Custom class name */
  className?: string;
  /** Callback when "View in Git" is clicked */
  onViewInGit?: () => void;
  /** Callback when sync is requested */
  onSync?: () => void;
}

// Size variants
const sizeClasses = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

const iconSizes = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

export default function GitStatusIndicator({
  state,
  showFullSha = false,
  showDriftWarning = true,
  gitUrl,
  size = 'md',
  className,
  onViewInGit,
  onSync,
}: GitStatusIndicatorProps) {
  // Format SHA
  const displaySha = useMemo(() => {
    return showFullSha ? state.sha : state.sha.slice(0, 7);
  }, [state.sha, showFullSha]);

  // Check if there's drift (behind remote)
  const hasDrift = useMemo(() => {
    return showDriftWarning && state.behind && state.behind > 0;
  }, [showDriftWarning, state.behind]);

  // Get overall status
  const status = useMemo(() => {
    if (state.isDirty) return 'dirty';
    if (hasDrift) return 'drift';
    if (state.pendingCommits > 0) return 'pending';
    return 'clean';
  }, [state.isDirty, hasDrift, state.pendingCommits]);

  // Status colors
  const statusColors = {
    clean: 'text-status-success',
    pending: 'text-status-warning',
    drift: 'text-status-error',
    dirty: 'text-status-warning',
  };

  // Build git URL for commit
  const commitUrl = useMemo(() => {
    if (!gitUrl) return null;
    return `${gitUrl}/commit/${state.sha}`;
  }, [gitUrl, state.sha]);

  // Build git URL for branch
  const branchUrl = useMemo(() => {
    if (!gitUrl) return null;
    return `${gitUrl}/tree/${state.branch}`;
  }, [gitUrl, state.branch]);

  return (
    <div
      className={clsx(
        'git-status-indicator flex items-center gap-3',
        sizeClasses[size],
        className
      )}
      data-testid="git-status"
    >
      {/* Branch */}
      <div className="flex items-center gap-1.5">
        <span className="text-text-muted">Branch:</span>
        {branchUrl ? (
          <a
            href={branchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-accent-teal hover:underline"
            data-testid="branch-link"
          >
            {state.branch}
          </a>
        ) : (
          <span className="font-mono text-text-primary" data-testid="branch-name">
            {state.branch}
          </span>
        )}
      </div>

      {/* SHA */}
      <div className="flex items-center gap-1.5">
        <span className="text-text-muted">SHA:</span>
        {commitUrl ? (
          <a
            href={commitUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-accent-teal hover:underline"
            data-testid="sha-link"
          >
            {displaySha}
          </a>
        ) : (
          <span className="font-mono text-text-primary" data-testid="sha-value">
            {displaySha}
          </span>
        )}
      </div>

      {/* Status indicator */}
      <div className="flex items-center gap-1.5" data-testid="status-indicator">
        {status === 'clean' && (
          <CheckCircleIcon
            className={clsx(iconSizes[size], statusColors.clean)}
            data-testid="status-clean"
          />
        )}
        {status === 'pending' && (
          <>
            <ArrowPathIcon
              className={clsx(iconSizes[size], statusColors.pending)}
              data-testid="status-pending"
            />
            <span className={statusColors.pending}>
              {state.pendingCommits} pending
            </span>
          </>
        )}
        {status === 'drift' && (
          <>
            <ExclamationTriangleIcon
              className={clsx(iconSizes[size], statusColors.drift)}
              data-testid="status-drift"
            />
            <span className={statusColors.drift}>
              {state.behind} behind
            </span>
          </>
        )}
        {status === 'dirty' && (
          <>
            <ExclamationTriangleIcon
              className={clsx(iconSizes[size], statusColors.dirty)}
              data-testid="status-dirty"
            />
            <span className={statusColors.dirty}>Uncommitted changes</span>
          </>
        )}
      </div>

      {/* Ahead/Behind counts */}
      {state.ahead !== undefined && state.ahead > 0 && (
        <span className="text-text-muted" data-testid="ahead-count">
          ↑{state.ahead}
        </span>
      )}
      {state.behind !== undefined && state.behind > 0 && !hasDrift && (
        <span className="text-text-muted" data-testid="behind-count">
          ↓{state.behind}
        </span>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 ml-2">
        {onViewInGit && (
          <button
            onClick={onViewInGit}
            className="flex items-center gap-1 text-text-muted hover:text-accent-teal transition-colors"
            aria-label="View in Git"
            data-testid="view-in-git-button"
          >
            <ArrowTopRightOnSquareIcon className={iconSizes[size]} />
            <span className="hidden sm:inline">View in Git</span>
          </button>
        )}
        {onSync && hasDrift && (
          <button
            onClick={onSync}
            className="flex items-center gap-1 px-2 py-1 rounded bg-status-warning/20 text-status-warning hover:bg-status-warning/30 transition-colors"
            aria-label="Sync with remote"
            data-testid="sync-button"
          >
            <ArrowPathIcon className={iconSizes[size]} />
            <span>Sync</span>
          </button>
        )}
      </div>

      {/* Last sync time */}
      {state.lastSync && (
        <span className="text-text-muted text-xs" data-testid="last-sync">
          Last sync: {new Date(state.lastSync).toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}
