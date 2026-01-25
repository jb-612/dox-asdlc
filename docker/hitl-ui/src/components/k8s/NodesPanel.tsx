/**
 * NodesPanel - Node cards display for K8s Dashboard
 *
 * Displays node cards in a grid layout showing:
 * - Node name, status, roles, version
 * - Capacity and utilization progress bars
 * - Color-coded by status
 */

import { useState, useCallback } from 'react';
import {
  ServerIcon,
  CheckCircleIcon,
  XCircleIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import type { K8sNode, NodeStatus } from '../../api/types/kubernetes';

export interface NodesPanelProps {
  /** Nodes to display */
  nodes: K8sNode[];
  /** Loading state */
  isLoading?: boolean;
  /** Node click callback */
  onNodeClick?: (node: K8sNode) => void;
  /** Custom class name */
  className?: string;
}

// Status configurations
const statusConfig: Record<NodeStatus, { color: string; bg: string; icon: typeof CheckCircleIcon; label: string }> = {
  Ready: {
    color: 'text-status-success',
    bg: 'bg-status-success/10 border-status-success/30',
    icon: CheckCircleIcon,
    label: 'Ready',
  },
  NotReady: {
    color: 'text-status-error',
    bg: 'bg-status-error/10 border-status-error/30',
    icon: XCircleIcon,
    label: 'Not Ready',
  },
  Unknown: {
    color: 'text-text-muted',
    bg: 'bg-bg-tertiary border-border-primary',
    icon: QuestionMarkCircleIcon,
    label: 'Unknown',
  },
};

// Progress bar colors based on percentage
function getProgressColor(percent: number): string {
  if (percent >= 90) return 'bg-status-error';
  if (percent >= 70) return 'bg-status-warning';
  return 'bg-status-success';
}

interface ProgressBarProps {
  label: string;
  value: number;
  max: number;
  percent: number;
  unit?: string;
}

function ProgressBar({ label, value, max, percent, unit = '' }: ProgressBarProps) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-text-muted">{label}</span>
        <span className="text-text-secondary">
          {value}{unit} / {max}{unit} ({Math.round(percent)}%)
        </span>
      </div>
      <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all', getProgressColor(percent))}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  );
}

interface NodeCardProps {
  node: K8sNode;
  onClick?: () => void;
}

function NodeCard({ node, onClick }: NodeCardProps) {
  const statusInfo = statusConfig[node.status];
  const StatusIcon = statusInfo.icon;

  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full p-4 rounded-lg border text-left transition-all',
        statusInfo.bg,
        onClick && 'hover:shadow-md hover:scale-[1.01] cursor-pointer'
      )}
      data-testid={`node-card-${node.name}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <ServerIcon className="h-5 w-5 text-text-muted" />
          <div>
            <h3 className="font-semibold text-text-primary" data-testid="node-name">
              {node.name}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              {node.roles.map((role) => (
                <span
                  key={role}
                  className="text-xs px-1.5 py-0.5 rounded bg-bg-tertiary text-text-muted"
                  data-testid="node-role"
                >
                  {role}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5" data-testid="node-status">
          <StatusIcon className={clsx('h-5 w-5', statusInfo.color)} />
          <span className={clsx('text-sm font-medium', statusInfo.color)}>
            {statusInfo.label}
          </span>
        </div>
      </div>

      {/* Meta info */}
      <div className="grid grid-cols-2 gap-2 mb-4 text-xs text-text-muted">
        <div>
          <span className="text-text-secondary">Version:</span> {node.version}
        </div>
        <div>
          <span className="text-text-secondary">Runtime:</span> {node.containerRuntime.split('://')[0]}
        </div>
        <div>
          <span className="text-text-secondary">OS:</span> {node.os}
        </div>
        <div>
          <span className="text-text-secondary">Pods:</span> {node.usage.podsCount}/{node.capacity.pods}
        </div>
      </div>

      {/* Resource utilization */}
      <div className="space-y-2">
        <ProgressBar
          label="CPU"
          value={Math.round(parseFloat(node.allocatable.cpu.replace('m', '')) * node.usage.cpuPercent / 100)}
          max={Math.round(parseFloat(node.allocatable.cpu.replace('m', '')))}
          percent={node.usage.cpuPercent}
          unit="m"
        />
        <ProgressBar
          label="Memory"
          value={Math.round(parseFloat(node.allocatable.memory.replace('Gi', '')) * node.usage.memoryPercent / 100)}
          max={Math.round(parseFloat(node.allocatable.memory.replace('Gi', '')))}
          percent={node.usage.memoryPercent}
          unit="Gi"
        />
      </div>
    </button>
  );
}

export default function NodesPanel({
  nodes,
  isLoading = false,
  onNodeClick,
  className,
}: NodesPanelProps) {
  const [statusFilter, setStatusFilter] = useState<NodeStatus | 'all'>('all');

  const handleNodeClick = useCallback(
    (node: K8sNode) => {
      onNodeClick?.(node);
    },
    [onNodeClick]
  );

  // Filter nodes by status
  const filteredNodes = statusFilter === 'all'
    ? nodes
    : nodes.filter((node) => node.status === statusFilter);

  // Count nodes by status for filter buttons
  const statusCounts = {
    all: nodes.length,
    Ready: nodes.filter((n) => n.status === 'Ready').length,
    NotReady: nodes.filter((n) => n.status === 'NotReady').length,
    Unknown: nodes.filter((n) => n.status === 'Unknown').length,
  };

  // Loading state
  if (isLoading && nodes.length === 0) {
    return (
      <div className={clsx('space-y-4', className)} data-testid="nodes-panel-loading">
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 w-20 rounded bg-bg-secondary animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-48 rounded-lg bg-bg-secondary animate-pulse"
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
      <div
        className={clsx('p-6 text-center text-text-muted bg-bg-tertiary/30 rounded-lg', className)}
        data-testid="nodes-panel-empty"
      >
        <ServerIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>No nodes available</p>
      </div>
    );
  }

  return (
    <div className={className} data-testid="nodes-panel">
      {/* Status filter buttons */}
      <div className="flex gap-2 mb-4" data-testid="status-filters">
        {(['all', 'Ready', 'NotReady', 'Unknown'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              statusFilter === status
                ? 'bg-accent-blue text-white'
                : 'bg-bg-tertiary text-text-secondary hover:bg-bg-tertiary/80'
            )}
            data-testid={`filter-${status.toLowerCase()}`}
          >
            {status === 'all' ? 'All' : status === 'NotReady' ? 'Not Ready' : status}
            <span className="ml-1.5 text-xs opacity-75">({statusCounts[status]})</span>
          </button>
        ))}
      </div>

      {/* Nodes grid */}
      {filteredNodes.length === 0 ? (
        <div className="p-6 text-center text-text-muted bg-bg-tertiary/30 rounded-lg">
          <p>No nodes match the selected filter</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="nodes-grid">
          {filteredNodes.map((node) => (
            <NodeCard
              key={node.name}
              node={node}
              onClick={onNodeClick ? () => handleNodeClick(node) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
