/**
 * ContextPackTab - Displays context pack used when artifact was created
 */

import { useState, useCallback, useMemo } from 'react';
import {
  DocumentIcon,
  DocumentTextIcon,
  CodeBracketIcon,
  Cog6ToothIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

/** File type */
export type FileType = 'code' | 'markdown' | 'config' | 'other';

/** Context pack file */
export interface ContextPackFile {
  /** File path */
  path: string;
  /** Token count */
  tokens: number;
  /** Relevance score (0-1) */
  relevance: number;
  /** File type */
  type: FileType;
}

/** Token breakdown by file type */
export interface TokenBreakdown {
  code: number;
  markdown: number;
  config: number;
  other: number;
}

/** Context pack data */
export interface ContextPackData {
  /** When the context was snapshotted */
  createdAt: string;
  /** Total tokens in pack */
  totalTokens: number;
  /** Cost per token */
  costPerToken: number;
  /** Files in the context pack */
  files: ContextPackFile[];
  /** Token breakdown by type */
  breakdown: TokenBreakdown;
}

export interface ContextPackTabProps {
  /** Context pack data */
  contextPack: ContextPackData | null;
  /** Loading state */
  isLoading?: boolean;
  /** Regenerating state */
  isRegenerating?: boolean;
  /** Custom class name */
  className?: string;
  /** Callback when regenerate is clicked */
  onRegenerate?: () => void;
}

/** Sort option */
type SortBy = 'relevance' | 'tokens' | 'path';

// File type icons
const fileTypeIcons: Record<FileType, typeof DocumentIcon> = {
  code: CodeBracketIcon,
  markdown: DocumentTextIcon,
  config: Cog6ToothIcon,
  other: DocumentIcon,
};

// Format number with commas
function formatNumber(num: number): string {
  return num.toLocaleString();
}

// Format cost
function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

// Format percentage
function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
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

export default function ContextPackTab({
  contextPack,
  isLoading = false,
  isRegenerating = false,
  className,
  onRegenerate,
}: ContextPackTabProps) {
  const [sortBy, setSortBy] = useState<SortBy>('relevance');
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [filesExpanded, setFilesExpanded] = useState(true);

  // Sort files
  const sortedFiles = useMemo(() => {
    if (!contextPack) return [];
    const sorted = [...contextPack.files];
    switch (sortBy) {
      case 'relevance':
        sorted.sort((a, b) => b.relevance - a.relevance);
        break;
      case 'tokens':
        sorted.sort((a, b) => b.tokens - a.tokens);
        break;
      case 'path':
        sorted.sort((a, b) => a.path.localeCompare(b.path));
        break;
    }
    return sorted;
  }, [contextPack, sortBy]);

  // Calculate estimated cost
  const estimatedCost = useMemo(() => {
    if (!contextPack) return 0;
    return contextPack.totalTokens * contextPack.costPerToken;
  }, [contextPack]);

  // Handle sort change
  const handleSortChange = useCallback((sort: SortBy) => {
    setSortBy(sort);
    setSortDropdownOpen(false);
  }, []);

  // Handle sort dropdown keyboard
  const handleSortKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setSortDropdownOpen((prev) => !prev);
      }
    },
    []
  );

  // Handle regenerate keyboard
  const handleRegenerateKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onRegenerate?.();
      }
    },
    [onRegenerate]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className={clsx('p-4', className)} data-testid="context-pack-loading">
        <div className="space-y-4">
          <div className="h-6 w-40 bg-bg-tertiary rounded animate-pulse" />
          <div className="h-24 bg-bg-tertiary rounded animate-pulse" data-testid="skeleton-item" />
          <div className="h-32 bg-bg-tertiary rounded animate-pulse" data-testid="skeleton-item" />
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-10 bg-bg-tertiary rounded animate-pulse"
                data-testid="skeleton-item"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Empty state - no context pack
  if (!contextPack) {
    return (
      <div className={clsx('p-4', className)} data-testid="context-pack-tab">
        <div className="flex items-center justify-center h-64 text-text-muted">
          No context pack data available
        </div>
      </div>
    );
  }

  // Empty files state
  if (contextPack.files.length === 0) {
    return (
      <div className={clsx('p-4', className)} data-testid="context-pack-tab">
        <div className="flex items-center justify-center h-64 text-text-muted">
          No files in context pack
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('flex flex-col h-full', className)} data-testid="context-pack-tab">
      {/* Header */}
      <div className="p-4 border-b border-border-primary">
        <h3 className="text-lg font-semibold text-text-primary">Context Pack</h3>
        <p className="text-sm text-text-muted mt-1">
          Files included in the context when this artifact was created
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Snapshot info */}
        <section className="bg-bg-tertiary rounded-lg p-4">
          <div className="text-sm text-text-muted mb-1">Context Snapshot</div>
          <div className="text-text-primary" data-testid="snapshot-time">
            {formatTimestamp(contextPack.createdAt)}
          </div>
        </section>

        {/* Token summary */}
        <section className="bg-bg-tertiary rounded-lg p-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-text-muted mb-1">Files</div>
              <div className="text-xl font-semibold text-text-primary" data-testid="file-count">
                {contextPack.files.length}
              </div>
            </div>
            <div>
              <div className="text-sm text-text-muted mb-1">Total Tokens</div>
              <div className="text-xl font-semibold text-text-primary" data-testid="total-tokens">
                {formatNumber(contextPack.totalTokens)}
              </div>
            </div>
            <div>
              <div className="text-sm text-text-muted mb-1">Estimated Cost</div>
              <div className="text-xl font-semibold text-text-primary" data-testid="estimated-cost">
                {formatCost(estimatedCost)}
              </div>
            </div>
          </div>
        </section>

        {/* Token breakdown */}
        <section data-testid="token-breakdown">
          <h4 className="text-sm font-medium text-text-primary mb-3">Token Breakdown</h4>
          <div className="space-y-2">
            {(Object.keys(contextPack.breakdown) as FileType[]).map((type) => {
              const tokens = contextPack.breakdown[type];
              const percent = contextPack.totalTokens > 0 ? tokens / contextPack.totalTokens : 0;
              const Icon = fileTypeIcons[type];

              return (
                <div key={type} className="flex items-center gap-3">
                  <Icon className="h-4 w-4 text-text-muted flex-shrink-0" />
                  <span className="w-20 text-sm text-text-secondary capitalize">{type}</span>
                  <div className="flex-1 h-2 bg-bg-tertiary rounded overflow-hidden">
                    <div
                      className="h-full bg-accent-blue rounded"
                      style={{ width: `${percent * 100}%` }}
                    />
                  </div>
                  <span
                    className="w-16 text-right text-sm text-text-secondary"
                    data-testid={`breakdown-${type}`}
                  >
                    {formatNumber(tokens)}
                  </span>
                  <span
                    className="w-12 text-right text-xs text-text-muted"
                    data-testid={`percent-${type}`}
                  >
                    {formatPercent(percent)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* File list */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setFilesExpanded((prev) => !prev)}
              className="flex items-center gap-2 text-sm font-medium text-text-primary hover:text-accent-blue"
              data-testid="toggle-files"
            >
              {filesExpanded ? (
                <ChevronUpIcon className="h-4 w-4" />
              ) : (
                <ChevronDownIcon className="h-4 w-4" />
              )}
              Files ({contextPack.files.length})
            </button>

            {/* Sort dropdown */}
            {filesExpanded && (
              <div className="relative">
                <button
                  onClick={() => setSortDropdownOpen((prev) => !prev)}
                  onKeyDown={handleSortKeyDown}
                  className="flex items-center gap-1 text-sm text-text-muted hover:text-text-primary"
                  data-testid="sort-dropdown"
                >
                  Sort: <span className="capitalize">{sortBy}</span>
                  <ChevronDownIcon className="h-3 w-3" />
                </button>

                {sortDropdownOpen && (
                  <div className="absolute right-0 z-10 mt-1 py-1 rounded-lg border border-border-primary bg-bg-secondary shadow-lg">
                    {(['relevance', 'tokens', 'path'] as SortBy[]).map((sort) => (
                      <button
                        key={sort}
                        onClick={() => handleSortChange(sort)}
                        className={clsx(
                          'block w-full px-3 py-1 text-left text-sm capitalize',
                          'hover:bg-bg-tertiary transition-colors',
                          sort === sortBy && 'text-accent-blue'
                        )}
                        data-testid={`sort-${sort}`}
                      >
                        {sort}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* File list content */}
          {filesExpanded && (
            <div className="space-y-1" data-testid="file-list">
              {sortedFiles.map((file) => {
                const FileIcon = fileTypeIcons[file.type];

                return (
                  <div
                    key={file.path}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-bg-tertiary transition-colors"
                    data-testid={`file-${file.path}`}
                  >
                    <FileIcon
                      className="h-4 w-4 text-text-muted flex-shrink-0"
                      data-testid="file-icon"
                    />
                    <span className="text-sm font-mono text-text-primary truncate flex-1">
                      {file.path}
                    </span>
                    <span className="text-xs text-text-muted" data-testid="file-tokens">
                      {formatNumber(file.tokens)}
                    </span>
                    <span
                      className={clsx(
                        'text-xs px-1.5 py-0.5 rounded',
                        file.relevance >= 0.8
                          ? 'bg-status-success/20 text-status-success'
                          : file.relevance >= 0.6
                          ? 'bg-status-warning/20 text-status-warning'
                          : 'bg-bg-tertiary text-text-muted'
                      )}
                      data-testid="file-relevance"
                    >
                      {formatPercent(file.relevance)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Regenerate action */}
      <div className="p-4 border-t border-border-primary">
        <button
          onClick={onRegenerate}
          onKeyDown={handleRegenerateKeyDown}
          disabled={isRegenerating}
          className={clsx(
            'w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm',
            isRegenerating
              ? 'bg-bg-tertiary text-text-muted cursor-not-allowed'
              : 'bg-accent-blue text-white hover:bg-accent-blue/90'
          )}
          data-testid="regenerate-btn"
        >
          <ArrowPathIcon className={clsx('h-4 w-4', isRegenerating && 'animate-spin')} />
          {isRegenerating ? 'Regenerating...' : 'Regenerate with current context'}
        </button>
      </div>
    </div>
  );
}
