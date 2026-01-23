/**
 * WorkflowGraphView - Visual representation of workflow stages
 *
 * Displays workflow as connected nodes representing clusters, agents, and gates.
 * Supports simplified (clusters only) and detailed (all nodes) views.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  EyeIcon,
  EyeSlashIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

/** Node type */
export type NodeType = 'cluster' | 'agent' | 'gate';

/** Node status */
export type NodeStatus = 'active' | 'idle' | 'running' | 'pending' | 'error';

/** Workflow node definition */
export interface WorkflowNode {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Node type */
  type: NodeType;
  /** Current status */
  status: NodeStatus;
  /** Number of runs through this node */
  runsCount: number;
  /** Parent cluster ID (for agents/gates) */
  parentId?: string;
}

/** Workflow edge definition */
export interface WorkflowEdge {
  /** Unique identifier */
  id: string;
  /** Source node ID */
  source: string;
  /** Target node ID */
  target: string;
  /** Number of flows through this edge */
  flowCount: number;
}

export interface WorkflowGraphViewProps {
  /** Nodes in the workflow */
  nodes: WorkflowNode[];
  /** Edges connecting nodes */
  edges: WorkflowEdge[];
  /** Loading state */
  isLoading?: boolean;
  /** Show detailed view (agents/gates) */
  showDetailedView?: boolean;
  /** Show legend */
  showLegend?: boolean;
  /** Layout direction */
  layout?: 'horizontal' | 'vertical';
  /** Custom class name */
  className?: string;
  /** Callback when node is clicked */
  onNodeClick?: (nodeId: string, nodeType: NodeType) => void;
  /** Callback when edge is clicked */
  onEdgeClick?: (sourceId: string, targetId: string) => void;
}

// Status colors
const statusColors: Record<NodeStatus, string> = {
  active: 'border-status-success bg-status-success/10',
  running: 'border-accent-teal bg-accent-teal/10',
  pending: 'border-status-warning bg-status-warning/10',
  idle: 'border-text-muted bg-bg-tertiary',
  error: 'border-status-error bg-status-error/10',
};

const statusDotColors: Record<NodeStatus, string> = {
  active: 'bg-status-success',
  running: 'bg-accent-teal',
  pending: 'bg-status-warning',
  idle: 'bg-text-muted',
  error: 'bg-status-error',
};

// Node type styling
const nodeTypeStyles: Record<NodeType, string> = {
  cluster: 'rounded-xl border-2',
  agent: 'rounded-lg border',
  gate: 'rounded-lg border border-dashed',
};

export default function WorkflowGraphView({
  nodes,
  edges,
  isLoading = false,
  showDetailedView: initialShowDetailed = false,
  showLegend = false,
  layout = 'horizontal',
  className,
  onNodeClick,
  onEdgeClick,
}: WorkflowGraphViewProps) {
  const [showDetailed, setShowDetailed] = useState(initialShowDetailed);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Filter nodes based on view mode
  const visibleNodes = useMemo(() => {
    if (showDetailed) return nodes;
    return nodes.filter((n) => n.type === 'cluster');
  }, [nodes, showDetailed]);

  // Filter edges based on visible nodes
  const visibleEdges = useMemo(() => {
    const nodeIds = new Set(visibleNodes.map((n) => n.id));
    return edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
  }, [edges, visibleNodes]);

  // Get cluster nodes (top-level)
  const clusterNodes = useMemo(() => {
    return nodes.filter((n) => n.type === 'cluster');
  }, [nodes]);

  // Get children of a cluster
  const getClusterChildren = useCallback(
    (clusterId: string) => {
      return nodes.filter((n) => n.parentId === clusterId);
    },
    [nodes]
  );

  // Handle node click
  const handleNodeClick = useCallback(
    (node: WorkflowNode) => {
      onNodeClick?.(node.id, node.type);
    },
    [onNodeClick]
  );

  // Handle edge click
  const handleEdgeClick = useCallback(
    (edge: WorkflowEdge) => {
      onEdgeClick?.(edge.source, edge.target);
    },
    [onEdgeClick]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className={clsx('rounded-lg border border-border-primary bg-bg-secondary p-4', className)} data-testid="workflow-graph-loading">
        <h3 className="text-lg font-semibold text-text-primary mb-4">Workflow Graph</h3>
        <div className="flex gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-24 w-32 rounded-xl bg-bg-tertiary animate-pulse"
              data-testid="node-skeleton"
            />
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (nodes.length === 0) {
    return (
      <div className={clsx('rounded-lg border border-border-primary bg-bg-secondary p-4', className)} data-testid="workflow-graph">
        <h3 className="text-lg font-semibold text-text-primary mb-4">Workflow Graph</h3>
        <p className="text-text-muted text-center py-8">No workflow data available</p>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'rounded-lg border border-border-primary bg-bg-secondary p-4',
        layout === 'horizontal' ? 'layout-horizontal' : 'layout-vertical',
        className
      )}
      data-testid="workflow-graph"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-text-primary">Workflow Graph</h3>
        <button
          onClick={() => setShowDetailed(!showDetailed)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-text-secondary hover:bg-bg-tertiary transition-colors"
          data-testid="toggle-view"
        >
          {showDetailed ? (
            <>
              <EyeSlashIcon className="h-4 w-4" />
              Simplified View
            </>
          ) : (
            <>
              <EyeIcon className="h-4 w-4" />
              Detailed View
            </>
          )}
        </button>
      </div>

      {/* Graph container */}
      <div
        className={clsx(
          'relative overflow-x-auto',
          layout === 'horizontal' ? 'flex items-start gap-8' : 'flex flex-col items-center gap-8'
        )}
        role="img"
        aria-label="Workflow visualization"
        data-testid="workflow-graph-container"
      >
        {/* Render clusters with optional children */}
        {clusterNodes.map((cluster, index) => {
          const children = showDetailed ? getClusterChildren(cluster.id) : [];
          const isHovered = hoveredNode === cluster.id;

          return (
            <div key={cluster.id} className="flex items-center gap-4">
              {/* Cluster node */}
              <div
                className={clsx(
                  'relative p-4 min-w-[140px] transition-all',
                  nodeTypeStyles[cluster.type],
                  statusColors[cluster.status],
                  `status-${cluster.status}`,
                  'node-cluster',
                  onNodeClick && 'cursor-pointer hover:scale-105'
                )}
                onClick={() => handleNodeClick(cluster)}
                onMouseEnter={() => setHoveredNode(cluster.id)}
                onMouseLeave={() => setHoveredNode(null)}
                tabIndex={onNodeClick ? 0 : undefined}
                data-testid={`node-${cluster.id}`}
              >
                {/* Status dot */}
                <div
                  className={clsx(
                    'absolute top-2 right-2 w-2 h-2 rounded-full',
                    statusDotColors[cluster.status]
                  )}
                />

                {/* Label */}
                <div className="font-medium text-text-primary">{cluster.label}</div>

                {/* Runs count */}
                <div className="text-xs text-text-muted mt-1">{cluster.runsCount} runs</div>

                {/* Children (agents/gates) when detailed view */}
                {showDetailed && children.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border-secondary space-y-2">
                    {children.map((child) => (
                      <div
                        key={child.id}
                        className={clsx(
                          'p-2 text-sm transition-all',
                          nodeTypeStyles[child.type],
                          statusColors[child.status],
                          `status-${child.status}`,
                          `node-${child.type}`,
                          onNodeClick && 'cursor-pointer hover:bg-bg-tertiary'
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNodeClick(child);
                        }}
                        onMouseEnter={() => setHoveredNode(child.id)}
                        onMouseLeave={() => setHoveredNode(null)}
                        tabIndex={onNodeClick ? 0 : undefined}
                        data-testid={`node-${child.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-text-secondary">{child.label}</span>
                          <span className="text-xs text-text-muted">{child.runsCount}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tooltip */}
                {isHovered && (
                  <div
                    className="absolute -top-16 left-1/2 -translate-x-1/2 px-3 py-2 rounded-lg bg-bg-primary border border-border-primary shadow-lg z-10 whitespace-nowrap"
                    data-testid="node-tooltip"
                  >
                    <div className="font-medium text-text-primary">{cluster.label}</div>
                    <div className="text-xs text-text-muted">{cluster.runsCount} runs</div>
                    <div className="text-xs text-text-muted capitalize">{cluster.status}</div>
                  </div>
                )}
              </div>

              {/* Edge/Arrow to next cluster */}
              {index < clusterNodes.length - 1 && (
                <div className="relative">
                  {visibleEdges
                    .filter(
                      (e) =>
                        e.source === cluster.id &&
                        e.target === clusterNodes[index + 1]?.id
                    )
                    .map((edge) => (
                      <div
                        key={edge.id}
                        className={clsx(
                          'flex items-center gap-1 px-2 py-1 rounded text-xs text-text-muted',
                          onEdgeClick && 'cursor-pointer hover:bg-bg-tertiary'
                        )}
                        onClick={() => handleEdgeClick(edge)}
                        data-testid={`edge-${edge.id}`}
                      >
                        <ArrowRightIcon className="h-4 w-4" />
                        <span>{edge.flowCount}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="mt-4 pt-4 border-t border-border-secondary" data-testid="workflow-legend">
          <div className="flex flex-wrap gap-6 text-xs">
            {/* Node types */}
            <div className="flex items-center gap-4">
              <span className="text-text-muted">Types:</span>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded-xl border-2 border-border-primary" />
                <span>Cluster</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded-lg border border-border-primary" />
                <span>Agent</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded-lg border border-dashed border-border-primary" />
                <span>Gate</span>
              </div>
            </div>

            {/* Status colors */}
            <div className="flex items-center gap-4">
              <span className="text-text-muted">Status:</span>
              <div className="flex items-center gap-1" data-testid="legend-status-active">
                <div className="w-3 h-3 rounded-full bg-status-success" />
                <span>Active</span>
              </div>
              <div className="flex items-center gap-1" data-testid="legend-status-running">
                <div className="w-3 h-3 rounded-full bg-accent-teal" />
                <span>Running</span>
              </div>
              <div className="flex items-center gap-1" data-testid="legend-status-pending">
                <div className="w-3 h-3 rounded-full bg-status-warning" />
                <span>Pending</span>
              </div>
              <div className="flex items-center gap-1" data-testid="legend-status-idle">
                <div className="w-3 h-3 rounded-full bg-text-muted" />
                <span>Idle</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
