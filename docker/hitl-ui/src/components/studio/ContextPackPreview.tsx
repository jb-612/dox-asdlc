/**
 * ContextPackPreview - Displays context pack files with relevance scores and cost estimate
 */

import { useState, useCallback, useMemo } from 'react';
import {
  DocumentIcon,
  DocumentTextIcon,
  CodeBracketIcon,
  Cog6ToothIcon,
  ChevronDownIcon,
  PlusIcon,
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

export interface ContextPackPreviewProps {
  /** Files in context pack */
  files: ContextPackFile[];
  /** Cost per token */
  costPerToken: number;
  /** Show breakdown by type */
  showBreakdown?: boolean;
  /** Allow file selection */
  selectable?: boolean;
  /** Loading state */
  isLoading?: boolean;
  /** Custom class name */
  className?: string;
  /** Callback when Add to session is clicked */
  onAddToSession?: () => void;
  /** Callback when selection changes */
  onSelectionChange?: (selectedPaths: string[]) => void;
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

// Format number
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

export default function ContextPackPreview({
  files,
  costPerToken,
  showBreakdown = false,
  selectable = false,
  isLoading = false,
  className,
  onAddToSession,
  onSelectionChange,
}: ContextPackPreviewProps) {
  const [sortBy, setSortBy] = useState<SortBy>('relevance');
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(
    new Set(files.map((f) => f.path))
  );

  // Get selected files
  const selectedFiles = useMemo(() => {
    if (!selectable) return files;
    return files.filter((f) => selectedPaths.has(f.path));
  }, [files, selectedPaths, selectable]);

  // Sort files
  const sortedFiles = useMemo(() => {
    const sorted = [...files];
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
  }, [files, sortBy]);

  // Calculate totals
  const totalTokens = useMemo(() => {
    return selectedFiles.reduce((sum, f) => sum + f.tokens, 0);
  }, [selectedFiles]);

  const estimatedCost = useMemo(() => {
    return totalTokens * costPerToken;
  }, [totalTokens, costPerToken]);

  // Calculate tokens by type
  const tokensByType = useMemo(() => {
    const result: Record<FileType, number> = {
      code: 0,
      markdown: 0,
      config: 0,
      other: 0,
    };
    for (const file of selectedFiles) {
      result[file.type] += file.tokens;
    }
    return result;
  }, [selectedFiles]);

  // Handle sort change
  const handleSortChange = useCallback((sort: SortBy) => {
    setSortBy(sort);
    setSortDropdownOpen(false);
  }, []);

  // Handle file selection toggle
  const handleToggleFile = useCallback(
    (path: string) => {
      setSelectedPaths((prev) => {
        const next = new Set(prev);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
        }
        onSelectionChange?.(Array.from(next));
        return next;
      });
    },
    [onSelectionChange]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className={clsx('p-4', className)} data-testid="context-pack-loading">
        <div className="h-6 w-40 bg-bg-tertiary rounded animate-pulse mb-4" />
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-10 bg-bg-tertiary rounded animate-pulse"
              data-testid="file-skeleton"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx('p-4 flex flex-col h-full', className)}
      data-testid="context-pack-preview"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-text-primary">Context Pack</h3>
        <span className="text-sm text-text-muted">
          <span data-testid="file-count">{files.length}</span> files
        </span>
      </div>

      {/* Token summary */}
      <div className="bg-bg-tertiary rounded-lg p-3 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-text-muted">Total tokens:</span>
          <span className="font-medium text-text-primary" data-testid="total-tokens">
            {formatNumber(totalTokens)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-muted">Estimated cost:</span>
          <span className="font-medium text-text-primary" data-testid="cost-estimate">
            {formatCost(estimatedCost)}
          </span>
        </div>

        {/* Breakdown by type */}
        {showBreakdown && (
          <div className="mt-3 pt-3 border-t border-border-secondary space-y-1">
            {(Object.keys(tokensByType) as FileType[]).map((type) => (
              <div key={type} className="flex items-center justify-between text-xs">
                <span className="text-text-muted capitalize">{type}:</span>
                <span className="text-text-secondary" data-testid={`tokens-${type}`}>
                  {formatNumber(tokensByType[type])}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sort dropdown */}
      <div className="relative mb-2">
        <button
          onClick={() => setSortDropdownOpen((prev) => !prev)}
          className="flex items-center gap-1 text-sm text-text-muted hover:text-text-primary"
          data-testid="sort-dropdown"
        >
          Sort by: <span className="capitalize">{sortBy}</span>
          <ChevronDownIcon className="h-3 w-3" />
        </button>

        {sortDropdownOpen && (
          <div className="absolute z-10 mt-1 py-1 rounded-lg border border-border-primary bg-bg-secondary shadow-lg">
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

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        {files.length === 0 ? (
          <div className="text-center py-8 text-text-muted">
            No files in context pack
          </div>
        ) : (
          <div className="space-y-1">
            {sortedFiles.map((file) => {
              const FileIcon = fileTypeIcons[file.type];
              const isSelected = selectedPaths.has(file.path);

              return (
                <div
                  key={file.path}
                  className={clsx(
                    'flex items-center gap-2 p-2 rounded-lg',
                    'hover:bg-bg-tertiary transition-colors',
                    selectable && !isSelected && 'opacity-50'
                  )}
                  data-testid={`file-${file.path}`}
                >
                  {selectable && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleFile(file.path)}
                      aria-label={`Select ${file.path}`}
                      className="rounded border-border-primary"
                      data-testid={`select-${file.path}`}
                    />
                  )}
                  <FileIcon
                    className="h-4 w-4 text-text-muted flex-shrink-0"
                    data-testid={`file-icon-${file.type}`}
                  />
                  <span className="text-sm font-mono text-text-primary truncate flex-1">
                    {file.path}
                  </span>
                  <span className="text-xs text-text-muted">{formatNumber(file.tokens)} tokens</span>
                  <span
                    className={clsx(
                      'text-xs px-1.5 py-0.5 rounded',
                      file.relevance >= 0.8
                        ? 'bg-status-success/20 text-status-success'
                        : file.relevance >= 0.6
                        ? 'bg-status-warning/20 text-status-warning'
                        : 'bg-bg-tertiary text-text-muted'
                    )}
                  >
                    {formatPercent(file.relevance)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add to session button */}
      <div className="mt-4 pt-4 border-t border-border-primary">
        <button
          onClick={onAddToSession}
          disabled={selectedFiles.length === 0}
          className={clsx(
            'w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm',
            selectedFiles.length > 0
              ? 'bg-accent-blue text-white hover:bg-accent-blue/90'
              : 'bg-bg-tertiary text-text-muted cursor-not-allowed'
          )}
        >
          <PlusIcon className="h-4 w-4" />
          Add to session
        </button>
      </div>
    </div>
  );
}
