/**
 * RLMTrajectoryViewer - Displays RLM (Recursive Language Model) trajectory with hierarchical subcalls
 */

import { useState, useCallback, useMemo } from 'react';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  XCircleIcon,
  WrenchScrewdriverIcon,
  ClockIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

/** Tool call within a subcall */
export interface ToolCall {
  /** Tool call ID */
  id: string;
  /** Tool name */
  name: string;
  /** Status */
  status: 'success' | 'failure' | 'running';
  /** Duration in ms */
  duration: number;
}

/** Token counts */
export interface TokenCounts {
  /** Input tokens */
  input: number;
  /** Output tokens */
  output: number;
}

/** Subcall in the RLM trajectory */
export interface Subcall {
  /** Subcall ID */
  id: string;
  /** Depth level */
  depth: number;
  /** Subcall name/description */
  name: string;
  /** Status */
  status: 'success' | 'failure' | 'running';
  /** Start timestamp */
  startedAt: string;
  /** Completion timestamp */
  completedAt?: string;
  /** Duration in ms */
  duration: number;
  /** Token counts */
  tokens: TokenCounts;
  /** Cost in USD */
  cost: number;
  /** Tool calls made during this subcall */
  toolCalls: ToolCall[];
  /** Nested subcalls */
  children: Subcall[];
  /** Error message if failed */
  error?: string;
}

/** RLM Trajectory data */
export interface RLMTrajectory {
  /** Run ID */
  runId: string;
  /** Total number of subcalls */
  totalSubcalls: number;
  /** Maximum depth reached */
  maxDepth: number;
  /** Total tokens used */
  totalTokens: TokenCounts;
  /** Total cost */
  totalCost: number;
  /** Total duration in ms */
  totalDuration: number;
  /** Root level subcalls */
  subcalls: Subcall[];
}

export interface RLMTrajectoryViewerProps {
  /** Trajectory data */
  trajectory: RLMTrajectory;
  /** Loading state */
  isLoading?: boolean;
  /** Maximum depth to display before pagination */
  maxDisplayDepth?: number;
  /** Custom class name */
  className?: string;
  /** Callback when subcall is clicked */
  onSubcallClick?: (subcallId: string) => void;
  /** Callback when tool call is clicked */
  onToolCallClick?: (toolCallId: string) => void;
}

// Format duration
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const secs = Math.floor(ms / 1000);
  const mins = Math.floor(secs / 60);
  const remainingSecs = secs % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${remainingSecs}s`;
}

// Format number with commas
function formatNumber(num: number): string {
  return num.toLocaleString();
}

// Format cost
function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

// Get all subcall IDs recursively
function getAllSubcallIds(subcalls: Subcall[], maxDepth: number): string[] {
  const ids: string[] = [];
  const traverse = (items: Subcall[], currentDepth: number) => {
    for (const item of items) {
      if (item.children.length > 0 && currentDepth < maxDepth) {
        ids.push(item.id);
        traverse(item.children, currentDepth + 1);
      }
    }
  };
  traverse(subcalls, 0);
  return ids;
}

/** Subcall tree item component */
interface SubcallItemProps {
  subcall: Subcall;
  expanded: Set<string>;
  toolsExpanded: Set<string>;
  maxDisplayDepth: number;
  onToggleExpand: (id: string) => void;
  onToggleTools: (id: string) => void;
  onSubcallClick?: (id: string) => void;
  onToolCallClick?: (id: string) => void;
}

function SubcallItem({
  subcall,
  expanded,
  toolsExpanded,
  maxDisplayDepth,
  onToggleExpand,
  onToggleTools,
  onSubcallClick,
  onToolCallClick,
}: SubcallItemProps) {
  const isExpanded = expanded.has(subcall.id);
  const isToolsExpanded = toolsExpanded.has(subcall.id);
  const hasChildren = subcall.children.length > 0;
  const totalTokens = subcall.tokens.input + subcall.tokens.output;
  const depthLimitReached = subcall.depth >= maxDisplayDepth - 1 && hasChildren;

  return (
    <div
      role="treeitem"
      aria-expanded={hasChildren ? isExpanded : undefined}
      style={{ marginLeft: `${subcall.depth * 24}px` }}
      data-testid={`subcall-${subcall.id}`}
      onClick={(e) => {
        e.stopPropagation();
        onSubcallClick?.(subcall.id);
      }}
    >
      {/* Subcall header */}
      <div
        className={clsx(
          'flex items-center gap-2 p-2 rounded-lg',
          'hover:bg-bg-tertiary transition-colors cursor-pointer',
          subcall.status === 'failure' && 'bg-status-error/10'
        )}
      >
        {/* Expand/collapse button */}
        {hasChildren && !depthLimitReached ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(subcall.id);
            }}
            className="p-0.5 hover:bg-bg-primary rounded"
            data-testid={`expand-${subcall.id}`}
            aria-expanded={isExpanded}
          >
            {isExpanded ? (
              <ChevronDownIcon className="h-4 w-4 text-text-muted" />
            ) : (
              <ChevronRightIcon className="h-4 w-4 text-text-muted" />
            )}
          </button>
        ) : (
          <div className="w-5" /> // Spacer for alignment
        )}

        {/* Status icon */}
        {subcall.status === 'success' ? (
          <CheckCircleIcon
            className="h-4 w-4 text-status-success"
            data-testid="status-success"
          />
        ) : (
          <XCircleIcon
            className="h-4 w-4 text-status-error"
            data-testid="status-failure"
          />
        )}

        {/* Name */}
        <span className="text-sm font-medium text-text-primary flex-1">
          {subcall.name}
        </span>

        {/* Metrics */}
        <span className="text-xs text-text-muted flex items-center gap-1">
          <DocumentTextIcon className="h-3 w-3" />
          {formatNumber(totalTokens)}
        </span>
        <span className="text-xs text-text-muted flex items-center gap-1">
          <CurrencyDollarIcon className="h-3 w-3" />
          {formatCost(subcall.cost)}
        </span>
        <span className="text-xs text-text-muted flex items-center gap-1">
          <ClockIcon className="h-3 w-3" />
          {formatDuration(subcall.duration)}
        </span>

        {/* Tool calls toggle */}
        {subcall.toolCalls.length > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleTools(subcall.id);
            }}
            className={clsx(
              'text-xs px-2 py-0.5 rounded flex items-center gap-1',
              'hover:bg-bg-primary transition-colors',
              isToolsExpanded ? 'bg-bg-primary' : 'bg-bg-tertiary'
            )}
            data-testid={`toggle-tools-${subcall.id}`}
          >
            <WrenchScrewdriverIcon className="h-3 w-3" />
            {subcall.toolCalls.length} tools
          </button>
        )}
      </div>

      {/* Error message */}
      {subcall.error && (
        <div className="ml-9 text-xs text-status-error mt-1">
          {subcall.error}
        </div>
      )}

      {/* Tool calls */}
      {isToolsExpanded && subcall.toolCalls.length > 0 && (
        <div className="ml-9 mt-1 space-y-1">
          {subcall.toolCalls.map((tool) => (
            <div
              key={tool.id}
              className={clsx(
                'flex items-center gap-2 p-1.5 rounded text-xs',
                'bg-bg-tertiary hover:bg-bg-primary transition-colors cursor-pointer'
              )}
              data-testid={`tool-${tool.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onToolCallClick?.(tool.id);
              }}
            >
              <WrenchScrewdriverIcon className="h-3 w-3 text-text-muted" />
              <span className="font-mono text-text-primary">{tool.name}</span>
              <span
                className={clsx(
                  'text-xs capitalize',
                  tool.status === 'success' ? 'text-status-success' : 'text-status-error'
                )}
              >
                {tool.status}
              </span>
              <span className="text-text-muted ml-auto">{tool.duration}ms</span>
            </div>
          ))}
        </div>
      )}

      {/* Depth limit message */}
      {depthLimitReached && isExpanded && (
        <div
          className="ml-9 mt-2 text-xs text-text-muted italic"
          data-testid="depth-limit-reached"
        >
          {subcall.children.length} more nested subcall(s)...
          <button
            type="button"
            className="ml-2 text-accent-blue hover:underline"
          >
            Load deeper levels
          </button>
        </div>
      )}

      {/* Children */}
      {isExpanded && !depthLimitReached && subcall.children.length > 0 && (
        <div className="mt-1">
          {subcall.children.map((child) => (
            <SubcallItem
              key={child.id}
              subcall={child}
              expanded={expanded}
              toolsExpanded={toolsExpanded}
              maxDisplayDepth={maxDisplayDepth}
              onToggleExpand={onToggleExpand}
              onToggleTools={onToggleTools}
              onSubcallClick={onSubcallClick}
              onToolCallClick={onToolCallClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function RLMTrajectoryViewer({
  trajectory,
  isLoading = false,
  maxDisplayDepth = 10,
  className,
  onSubcallClick,
  onToolCallClick,
}: RLMTrajectoryViewerProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [toolsExpanded, setToolsExpanded] = useState<Set<string>>(new Set());

  // Toggle subcall expansion
  const handleToggleExpand = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Toggle tool calls expansion
  const handleToggleTools = useCallback((id: string) => {
    setToolsExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Expand all
  const handleExpandAll = useCallback(() => {
    const allIds = getAllSubcallIds(trajectory.subcalls, maxDisplayDepth);
    setExpanded(new Set(allIds));
  }, [trajectory.subcalls, maxDisplayDepth]);

  // Collapse all
  const handleCollapseAll = useCallback(() => {
    setExpanded(new Set());
  }, []);

  // Total tokens
  const totalTokens = useMemo(
    () => trajectory.totalTokens.input + trajectory.totalTokens.output,
    [trajectory.totalTokens]
  );

  // Loading state
  if (isLoading) {
    return (
      <div
        className={clsx('space-y-4', className)}
        data-testid="trajectory-loading"
      >
        <div className="h-6 w-48 bg-bg-tertiary rounded animate-pulse" />
        <div className="grid grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-bg-tertiary rounded animate-pulse" />
          ))}
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-10 bg-bg-tertiary rounded animate-pulse"
              data-testid="subcall-skeleton"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('space-y-4', className)} data-testid="rlm-trajectory-viewer">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text-primary">RLM Trajectory</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleExpandAll}
            className="px-3 py-1 text-xs rounded bg-bg-tertiary hover:bg-bg-primary transition-colors"
          >
            Expand All
          </button>
          <button
            type="button"
            onClick={handleCollapseAll}
            className="px-3 py-1 text-xs rounded bg-bg-tertiary hover:bg-bg-primary transition-colors"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-5 gap-4">
        <div className="p-3 rounded-lg bg-bg-secondary text-center">
          <div className="text-xl font-bold text-text-primary" data-testid="total-subcalls">
            {trajectory.totalSubcalls}
          </div>
          <div className="text-xs text-text-muted">Subcalls</div>
        </div>
        <div className="p-3 rounded-lg bg-bg-secondary text-center">
          <div className="text-xl font-bold text-text-primary" data-testid="max-depth">
            {trajectory.maxDepth}
          </div>
          <div className="text-xs text-text-muted">Max Depth</div>
        </div>
        <div className="p-3 rounded-lg bg-bg-secondary text-center">
          <div className="text-xl font-bold text-text-primary" data-testid="total-tokens">
            {formatNumber(totalTokens)}
          </div>
          <div className="text-xs text-text-muted">Tokens</div>
        </div>
        <div className="p-3 rounded-lg bg-bg-secondary text-center">
          <div className="text-xl font-bold text-text-primary" data-testid="total-cost">
            {formatCost(trajectory.totalCost)}
          </div>
          <div className="text-xs text-text-muted">Cost</div>
        </div>
        <div className="p-3 rounded-lg bg-bg-secondary text-center">
          <div className="text-xl font-bold text-text-primary" data-testid="total-duration">
            {formatDuration(trajectory.totalDuration)}
          </div>
          <div className="text-xs text-text-muted">Duration</div>
        </div>
      </div>

      {/* Tree View */}
      {trajectory.subcalls.length === 0 ? (
        <div className="text-center py-8 text-text-muted">
          No subcalls in this trajectory
        </div>
      ) : (
        <div
          role="tree"
          className="rounded-lg border border-border-primary bg-bg-secondary p-2 max-h-[600px] overflow-y-auto"
        >
          {trajectory.subcalls.map((subcall) => (
            <SubcallItem
              key={subcall.id}
              subcall={subcall}
              expanded={expanded}
              toolsExpanded={toolsExpanded}
              maxDisplayDepth={maxDisplayDepth}
              onToggleExpand={handleToggleExpand}
              onToggleTools={handleToggleTools}
              onSubcallClick={onSubcallClick}
              onToolCallClick={onToolCallClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}
