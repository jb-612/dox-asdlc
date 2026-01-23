/**
 * HistoryTab - Displays artifact version history with diff comparison
 */

import { useState, useCallback, useMemo } from 'react';
import {
  ClockIcon,
  ArrowsRightLeftIcon,
  XMarkIcon,
  EyeIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import CodeDiff from '../common/CodeDiff';

/** Artifact version */
export interface ArtifactVersion {
  /** Version ID */
  id: string;
  /** Version number */
  version: number;
  /** Git SHA */
  sha: string;
  /** Created timestamp */
  createdAt: string;
  /** Author (agent or user) */
  author: string;
  /** Commit message */
  message: string;
  /** Version content */
  content: string;
}

export interface HistoryTabProps {
  /** Version history */
  versions: ArtifactVersion[];
  /** Current version number */
  currentVersion: number;
  /** Loading state */
  isLoading?: boolean;
  /** Custom class name */
  className?: string;
  /** Callback when version is viewed */
  onViewVersion?: (versionId: string) => void;
}

// Format timestamp
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function HistoryTab({
  versions,
  currentVersion,
  isLoading = false,
  className,
  onViewVersion,
}: HistoryTabProps) {
  const [compareMode, setCompareMode] = useState(false);
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);

  // Get selected versions for comparison
  const compareVersions = useMemo(() => {
    if (selectedVersions.length !== 2) return null;

    const [oldId, newId] = selectedVersions;
    const oldVersion = versions.find((v) => v.id === oldId);
    const newVersion = versions.find((v) => v.id === newId);

    if (!oldVersion || !newVersion) return null;

    // Ensure older version is first
    if (oldVersion.version > newVersion.version) {
      return { old: newVersion, new: oldVersion };
    }
    return { old: oldVersion, new: newVersion };
  }, [selectedVersions, versions]);

  // Toggle compare mode
  const handleToggleCompare = useCallback(() => {
    setCompareMode((prev) => !prev);
    setSelectedVersions([]);
  }, []);

  // Handle version click
  const handleVersionClick = useCallback(
    (versionId: string) => {
      if (compareMode) {
        setSelectedVersions((prev) => {
          if (prev.includes(versionId)) {
            return prev.filter((id) => id !== versionId);
          }
          if (prev.length >= 2) {
            return [prev[1], versionId];
          }
          return [...prev, versionId];
        });
      } else {
        onViewVersion?.(versionId);
      }
    },
    [compareMode, onViewVersion]
  );

  // Handle version key down
  const handleVersionKeyDown = useCallback(
    (e: React.KeyboardEvent, versionId: string) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleVersionClick(versionId);
      }
    },
    [handleVersionClick]
  );

  // Clear selection
  const handleClearSelection = useCallback(() => {
    setSelectedVersions([]);
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className={clsx('p-4', className)} data-testid="history-loading">
        <div className="h-8 w-32 bg-bg-tertiary rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-20 bg-bg-tertiary rounded animate-pulse"
              data-testid="skeleton-version"
            />
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (versions.length === 0) {
    return (
      <div className={clsx('p-4', className)} data-testid="history-tab">
        <div className="flex items-center justify-center h-64 text-text-muted">
          No history available
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('flex flex-col h-full', className)} data-testid="history-tab">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border-primary">
        <div className="flex items-center gap-2">
          <ClockIcon className="h-5 w-5 text-text-muted" />
          <span className="font-medium text-text-primary">Version History</span>
          <span className="text-sm text-text-muted">
            (<span data-testid="version-count">{versions.length}</span> versions)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {compareMode && selectedVersions.length > 0 && (
            <button
              onClick={handleClearSelection}
              className="flex items-center gap-1 px-2 py-1 rounded text-sm text-text-muted hover:bg-bg-tertiary"
              data-testid="clear-selection"
            >
              <XMarkIcon className="h-4 w-4" />
              Clear
            </button>
          )}
          <button
            onClick={handleToggleCompare}
            className={clsx(
              'flex items-center gap-1 px-3 py-1 rounded text-sm transition-colors',
              compareMode
                ? 'bg-accent-blue text-white'
                : 'bg-bg-tertiary text-text-muted hover:text-text-primary'
            )}
            aria-label="Toggle compare mode"
            data-testid="compare-toggle"
          >
            <ArrowsRightLeftIcon className="h-4 w-4" />
            Compare
          </button>
        </div>
      </div>

      {/* Compare instructions */}
      {compareMode && (
        <div
          className="p-3 bg-accent-blue/10 text-accent-blue text-sm border-b border-border-primary"
          data-testid="compare-instructions"
        >
          Select two versions to compare. Selected: {selectedVersions.length}/2
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Timeline */}
        <div className="w-1/2 border-r border-border-primary overflow-y-auto p-4">
          <div className="space-y-2">
            {versions.map((version) => {
              const isSelected = selectedVersions.includes(version.id);
              const isCurrent = version.version === currentVersion;

              return (
                <div
                  key={version.id}
                  onClick={() => handleVersionClick(version.id)}
                  onKeyDown={(e) => handleVersionKeyDown(e, version.id)}
                  tabIndex={0}
                  className={clsx(
                    'p-3 rounded-lg border transition-colors cursor-pointer',
                    isCurrent
                      ? 'border-accent-blue bg-accent-blue/5'
                      : isSelected
                      ? 'border-accent-blue bg-accent-blue/10'
                      : 'border-border-primary hover:border-accent-blue/50 hover:bg-bg-tertiary'
                  )}
                  data-testid={`version-${version.id}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-text-primary">v{version.version}</span>
                      {isCurrent && (
                        <span className="px-1.5 py-0.5 text-xs rounded bg-accent-blue/20 text-accent-blue">
                          Current
                        </span>
                      )}
                      {isSelected && compareMode && (
                        <span
                          className="flex items-center justify-center w-4 h-4 rounded-full bg-accent-blue"
                          data-testid={`selected-indicator-${version.id}`}
                        >
                          <CheckIcon className="w-3 h-3 text-white" />
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-text-muted font-mono">{version.sha}</span>
                  </div>

                  <p className="text-sm text-text-secondary mb-2 line-clamp-2">{version.message}</p>

                  <div className="flex items-center justify-between text-xs text-text-muted">
                    <span>{version.author}</span>
                    <span data-testid="version-time">{formatTimestamp(version.createdAt)}</span>
                  </div>

                  {!compareMode && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewVersion?.(version.id);
                      }}
                      className="mt-2 flex items-center gap-1 px-2 py-1 rounded text-xs text-accent-blue hover:bg-accent-blue/10"
                      data-testid={`view-btn-${version.id}`}
                    >
                      <EyeIcon className="h-3 w-3" />
                      View
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Diff view */}
        <div className="w-1/2 overflow-y-auto">
          {compareVersions ? (
            <div className="p-4">
              <div className="mb-4 text-sm text-text-muted">
                Comparing v{compareVersions.old.version} → v{compareVersions.new.version}
              </div>
              <CodeDiff
                oldContent={compareVersions.old.content}
                newContent={compareVersions.new.content}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-text-muted">
              {compareMode
                ? 'Select two versions to see diff'
                : 'Enable compare mode to see differences'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
