/**
 * SpecIndexBrowser - Tree view for browsing the specification index
 */

import { useState, useCallback, useMemo } from 'react';
import {
  FolderIcon,
  FolderOpenIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  CheckCircleIcon,
  ClockIcon,
  MinusCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

/** Entry status */
export type EntryStatus = 'complete' | 'in_progress' | 'pending' | 'failed';

/** Spec entry */
export interface SpecEntry {
  /** Entry ID */
  id: string;
  /** Entry name */
  name: string;
  /** Status */
  status: EntryStatus;
  /** Artifact ID (if created) */
  artifactId?: string;
}

/** Spec index structure */
export interface SpecIndex {
  discovery: SpecEntry[];
  design: SpecEntry[];
  development: SpecEntry[];
  validation: SpecEntry[];
}

export interface SpecIndexBrowserProps {
  /** Spec index data (optional, will show empty state if not provided) */
  specIndex?: SpecIndex;
  /** Loading state */
  isLoading?: boolean;
  /** Custom class name */
  className?: string;
  /** Callback when entry is clicked */
  onEntryClick?: (artifactId: string, entryId: string) => void;
}

/** Folder key */
type FolderKey = keyof SpecIndex;

// Folder labels
const folderLabels: Record<FolderKey, string> = {
  discovery: 'Discovery',
  design: 'Design',
  development: 'Development',
  validation: 'Validation',
};

// Status icons
const statusIcons: Record<EntryStatus, typeof CheckCircleIcon> = {
  complete: CheckCircleIcon,
  in_progress: ClockIcon,
  pending: MinusCircleIcon,
  failed: XCircleIcon,
};

// Status colors
const statusColors: Record<EntryStatus, string> = {
  complete: 'text-status-success',
  in_progress: 'text-status-warning',
  pending: 'text-text-muted',
  failed: 'text-status-error',
};

// Default empty spec index
const emptySpecIndex: SpecIndex = {
  discovery: [],
  design: [],
  development: [],
  validation: [],
};

export default function SpecIndexBrowser({
  specIndex = emptySpecIndex,
  isLoading = false,
  className,
  onEntryClick,
}: SpecIndexBrowserProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<FolderKey>>(
    new Set(['discovery', 'design', 'development', 'validation'])
  );

  // Safely access spec index with fallback
  const safeSpecIndex = specIndex || emptySpecIndex;

  // Get all entries
  const allEntries = useMemo(() => {
    return [
      ...(safeSpecIndex.discovery || []),
      ...(safeSpecIndex.design || []),
      ...(safeSpecIndex.development || []),
      ...(safeSpecIndex.validation || []),
    ];
  }, [safeSpecIndex]);

  // Calculate progress stats
  const progressStats = useMemo(() => {
    const complete = allEntries.filter((e) => e.status === 'complete').length;
    const inProgress = allEntries.filter((e) => e.status === 'in_progress').length;
    const pending = allEntries.filter((e) => e.status === 'pending').length;
    const failed = allEntries.filter((e) => e.status === 'failed').length;
    const total = allEntries.length;
    const percentage = total > 0 ? Math.round((complete / total) * 100) : 0;

    return { complete, inProgress, pending, failed, total, percentage };
  }, [allEntries]);

  // Calculate folder progress
  const getFolderProgress = useCallback((entries: SpecEntry[]) => {
    const complete = entries.filter((e) => e.status === 'complete').length;
    return { complete, total: entries.length };
  }, []);

  // Toggle folder expansion
  const toggleFolder = useCallback((folder: FolderKey) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folder)) {
        next.delete(folder);
      } else {
        next.add(folder);
      }
      return next;
    });
  }, []);

  // Handle folder key down
  const handleFolderKeyDown = useCallback(
    (e: React.KeyboardEvent, folder: FolderKey) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleFolder(folder);
      }
    },
    [toggleFolder]
  );

  // Handle entry click
  const handleEntryClick = useCallback(
    (entry: SpecEntry) => {
      if (entry.artifactId && onEntryClick) {
        onEntryClick(entry.artifactId, entry.id);
      }
    },
    [onEntryClick]
  );

  // Handle entry key down
  const handleEntryKeyDown = useCallback(
    (e: React.KeyboardEvent, entry: SpecEntry) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleEntryClick(entry);
      }
    },
    [handleEntryClick]
  );

  // Render folder
  const renderFolder = (folder: FolderKey) => {
    const entries = safeSpecIndex[folder] || [];
    const isExpanded = expandedFolders.has(folder);
    const progress = getFolderProgress(entries);
    const isComplete = progress.complete === progress.total && progress.total > 0;

    return (
      <div key={folder} className="mb-2" role="treeitem">
        <div
          onClick={() => toggleFolder(folder)}
          onKeyDown={(e) => handleFolderKeyDown(e, folder)}
          tabIndex={0}
          className="flex items-center gap-2 p-2 rounded-lg hover:bg-bg-tertiary cursor-pointer transition-colors"
          data-testid={`folder-${folder}`}
        >
          {isExpanded ? (
            <>
              <ChevronDownIcon
                className="h-4 w-4 text-text-muted"
                data-testid={`collapse-icon-${folder}`}
              />
              <FolderOpenIcon className="h-4 w-4 text-accent-blue" />
            </>
          ) : (
            <>
              <ChevronRightIcon
                className="h-4 w-4 text-text-muted"
                data-testid={`expand-icon-${folder}`}
              />
              <FolderIcon className="h-4 w-4 text-accent-blue" />
            </>
          )}
          <span className="font-medium text-text-primary flex-1">{folderLabels[folder]}</span>
          <span
            className={clsx(
              'text-xs px-1.5 py-0.5 rounded',
              isComplete ? 'bg-status-success/10 text-status-success' : 'bg-bg-tertiary text-text-muted'
            )}
            data-testid="folder-progress"
          >
            {progress.complete}/{progress.total}
          </span>
          {isComplete && (
            <CheckCircleIcon
              className="h-4 w-4 text-status-success"
              data-testid="folder-complete"
            />
          )}
        </div>

        {isExpanded && entries.length > 0 && (
          <div className="ml-6 mt-1 space-y-1">
            {entries.map((entry) => {
              const StatusIcon = statusIcons[entry.status];
              const hasArtifact = !!entry.artifactId;

              return (
                <div
                  key={entry.id}
                  onClick={() => handleEntryClick(entry)}
                  onKeyDown={(e) => handleEntryKeyDown(e, entry)}
                  tabIndex={hasArtifact ? 0 : -1}
                  className={clsx(
                    'flex items-center gap-2 p-2 rounded-lg transition-colors',
                    hasArtifact
                      ? 'hover:bg-bg-tertiary cursor-pointer'
                      : 'opacity-50 cursor-default'
                  )}
                  data-testid={`entry-${entry.id}`}
                >
                  <StatusIcon
                    className={clsx('h-4 w-4', statusColors[entry.status])}
                    data-testid={`status-${entry.status}`}
                  />
                  <span className="text-sm text-text-secondary">{entry.name}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={clsx('p-4', className)} data-testid="spec-index-loading">
        <div className="h-6 w-32 bg-bg-tertiary rounded animate-pulse mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-8 bg-bg-tertiary rounded animate-pulse"
              data-testid="skeleton-item"
            />
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (allEntries.length === 0) {
    return (
      <div className={clsx('p-4', className)} data-testid="spec-index-browser">
        <h3 className="text-lg font-semibold text-text-primary mb-4">Spec Index</h3>
        <div className="text-center py-8 text-text-muted">
          No specifications defined yet
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('flex flex-col h-full', className)} data-testid="spec-index-browser">
      {/* Header */}
      <div className="p-4 border-b border-border-primary">
        <h3 className="text-lg font-semibold text-text-primary mb-3">Spec Index</h3>

        {/* Progress summary */}
        <div className="space-y-2" data-testid="progress-summary">
          {/* Progress bar */}
          <div
            className="h-2 bg-bg-tertiary rounded-full overflow-hidden"
            data-testid="progress-bar"
          >
            <div
              className="h-full bg-status-success transition-all"
              style={{ width: `${progressStats.percentage}%` }}
            />
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between text-xs">
            <span
              className="text-text-primary font-medium"
              data-testid="progress-percentage"
            >
              {progressStats.percentage}%
            </span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <CheckCircleIcon className="h-3 w-3 text-status-success" />
                <span className="text-text-muted" data-testid="complete-count">
                  {progressStats.complete}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <ClockIcon className="h-3 w-3 text-status-warning" />
                <span className="text-text-muted" data-testid="in-progress-count">
                  {progressStats.inProgress}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <MinusCircleIcon className="h-3 w-3 text-text-muted" />
                <span className="text-text-muted" data-testid="pending-count">
                  {progressStats.pending}
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto p-4" role="tree">
        {renderFolder('discovery')}
        {renderFolder('design')}
        {renderFolder('development')}
        {renderFolder('validation')}
      </div>
    </div>
  );
}
