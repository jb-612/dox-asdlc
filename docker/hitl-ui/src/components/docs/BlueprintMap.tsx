/**
 * BlueprintMap - Visual cluster diagram for aSDLC methodology
 *
 * Displays the four main clusters (Discovery, Design, Development, Validation)
 * with expandable sections showing agents, artifacts, and gates.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  UserCircleIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

/** Item type in a cluster */
export type ClusterItemType = 'agent' | 'artifact' | 'gate';

/** Individual item in a cluster */
export interface ClusterItem {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Type of item */
  type: ClusterItemType;
  /** Optional description */
  description?: string;
}

/** Cluster definition */
export interface Cluster {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description of the cluster */
  description: string;
  /** Color theme */
  color: 'teal' | 'purple' | 'blue' | 'green' | 'gray';
  /** Items in this cluster */
  items: ClusterItem[];
}

export interface BlueprintMapProps {
  /** Clusters to display */
  clusters: Cluster[];
  /** Show flow arrows between clusters */
  showFlow?: boolean;
  /** Custom class name */
  className?: string;
  /** Callback when cluster is clicked */
  onClusterClick?: (clusterId: string) => void;
  /** Callback when item is clicked */
  onItemClick?: (itemId: string, type: ClusterItemType) => void;
}

// Color mappings for cluster themes
const colorClasses = {
  teal: {
    border: 'border-accent-teal',
    bg: 'bg-accent-teal/10',
    text: 'text-accent-teal',
    hoverBg: 'hover:bg-accent-teal/20',
  },
  purple: {
    border: 'border-accent-purple',
    bg: 'bg-accent-purple/10',
    text: 'text-accent-purple',
    hoverBg: 'hover:bg-accent-purple/20',
  },
  blue: {
    border: 'border-accent-blue',
    bg: 'bg-accent-blue/10',
    text: 'text-accent-blue',
    hoverBg: 'hover:bg-accent-blue/20',
  },
  green: {
    border: 'border-status-success',
    bg: 'bg-status-success/10',
    text: 'text-status-success',
    hoverBg: 'hover:bg-status-success/20',
  },
  gray: {
    border: 'border-border-primary',
    bg: 'bg-bg-secondary',
    text: 'text-text-secondary',
    hoverBg: 'hover:bg-bg-tertiary',
  },
};

// Icon components for item types
const ItemIcon = ({ type }: { type: ClusterItemType }) => {
  switch (type) {
    case 'agent':
      return <UserCircleIcon className="h-4 w-4" data-testid="agent-icon" />;
    case 'artifact':
      return <DocumentTextIcon className="h-4 w-4" data-testid="artifact-icon" />;
    case 'gate':
      return <ShieldCheckIcon className="h-4 w-4" data-testid="gate-icon" />;
  }
};

export default function BlueprintMap({
  clusters,
  showFlow = false,
  className,
  onClusterClick,
  onItemClick,
}: BlueprintMapProps) {
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set());

  // Toggle cluster expansion
  const toggleCluster = useCallback(
    (clusterId: string) => {
      setExpandedClusters((prev) => {
        const next = new Set(prev);
        if (next.has(clusterId)) {
          next.delete(clusterId);
        } else {
          next.add(clusterId);
        }
        return next;
      });
      onClusterClick?.(clusterId);
    },
    [onClusterClick]
  );

  // Handle keyboard navigation for clusters
  const handleClusterKeyDown = useCallback(
    (e: React.KeyboardEvent, clusterId: string) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleCluster(clusterId);
      }
    },
    [toggleCluster]
  );

  // Handle item click
  const handleItemClick = useCallback(
    (item: ClusterItem) => {
      onItemClick?.(item.id, item.type);
    },
    [onItemClick]
  );

  // Handle keyboard navigation for items
  const handleItemKeyDown = useCallback(
    (e: React.KeyboardEvent, item: ClusterItem) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleItemClick(item);
      }
    },
    [handleItemClick]
  );

  // Group items by type
  const groupItemsByType = useCallback((items: ClusterItem[]) => {
    const agents = items.filter((i) => i.type === 'agent');
    const artifacts = items.filter((i) => i.type === 'artifact');
    const gates = items.filter((i) => i.type === 'gate');
    return { agents, artifacts, gates };
  }, []);

  // Get item counts for a cluster
  const getItemCounts = useCallback((items: ClusterItem[]) => {
    const { agents, artifacts, gates } = groupItemsByType(items);
    return {
      total: items.length,
      agents: agents.length,
      artifacts: artifacts.length,
      gates: gates.length,
    };
  }, [groupItemsByType]);

  // Empty state
  if (clusters.length === 0) {
    return (
      <div className={clsx('flex items-center justify-center p-8 text-text-muted', className)} data-testid="blueprint-map">
        <p>No clusters available</p>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4',
        className
      )}
      data-testid="blueprint-map"
    >
      {clusters.map((cluster, index) => {
        const isExpanded = expandedClusters.has(cluster.id);
        const colors = colorClasses[cluster.color];
        const counts = getItemCounts(cluster.items);
        const { agents, artifacts, gates } = groupItemsByType(cluster.items);

        return (
          <div key={cluster.id} className="relative">
            {/* Flow arrow between clusters */}
            {showFlow && index < clusters.length - 1 && (
              <div
                className="hidden lg:flex absolute -right-4 top-1/2 -translate-y-1/2 z-10"
                data-testid="flow-arrow"
              >
                <ArrowRightIcon className="h-6 w-6 text-text-muted" />
              </div>
            )}

            {/* Cluster card */}
            <div
              className={clsx(
                'rounded-lg border-2 transition-colors cursor-pointer',
                colors.border,
                colors.bg,
                colors.hoverBg
              )}
              onClick={() => toggleCluster(cluster.id)}
              onKeyDown={(e) => handleClusterKeyDown(e, cluster.id)}
              tabIndex={0}
              role="button"
              aria-expanded={isExpanded}
              aria-label={`${cluster.name} cluster`}
              data-testid={`cluster-${cluster.id}`}
            >
              {/* Cluster header */}
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <h3 className={clsx('text-lg font-semibold', colors.text)}>
                    {cluster.name}
                  </h3>
                  {isExpanded ? (
                    <ChevronUpIcon className={clsx('h-5 w-5', colors.text)} data-testid="collapse-icon" />
                  ) : (
                    <ChevronDownIcon className={clsx('h-5 w-5', colors.text)} data-testid="expand-icon" />
                  )}
                </div>
                <p className="text-sm text-text-secondary mt-1">{cluster.description}</p>

                {/* Item counts */}
                <div className="flex flex-wrap gap-2 mt-3 text-xs text-text-muted">
                  <span>{counts.total} items</span>
                  {counts.agents > 0 && (
                    <span className="flex items-center gap-1">
                      <UserCircleIcon className="h-3 w-3" />
                      {counts.agents} {counts.agents === 1 ? 'agent' : 'agents'}
                    </span>
                  )}
                  {counts.artifacts > 0 && (
                    <span className="flex items-center gap-1">
                      <DocumentTextIcon className="h-3 w-3" />
                      {counts.artifacts} {counts.artifacts === 1 ? 'artifact' : 'artifacts'}
                    </span>
                  )}
                  {counts.gates > 0 && (
                    <span className="flex items-center gap-1">
                      <ShieldCheckIcon className="h-3 w-3" />
                      {counts.gates} {counts.gates === 1 ? 'gate' : 'gates'}
                    </span>
                  )}
                </div>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div
                  className="border-t border-border-primary px-4 py-3 bg-bg-primary/50"
                  data-testid={`cluster-items-${cluster.id}`}
                  role="list"
                >
                  {/* Agents group */}
                  {agents.length > 0 && (
                    <div className="mb-3" data-testid="group-agents">
                      <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
                        Agents
                      </h4>
                      <div className="space-y-1">
                        {agents.map((item) => (
                          <button
                            key={item.id}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-text-primary hover:bg-bg-tertiary transition-colors text-left"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleItemClick(item);
                            }}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              handleItemKeyDown(e, item);
                            }}
                            tabIndex={0}
                            role="listitem"
                            data-testid={`item-${item.id}`}
                          >
                            <ItemIcon type={item.type} />
                            {item.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Artifacts group */}
                  {artifacts.length > 0 && (
                    <div className="mb-3" data-testid="group-artifacts">
                      <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
                        Artifacts
                      </h4>
                      <div className="space-y-1">
                        {artifacts.map((item) => (
                          <button
                            key={item.id}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-text-primary hover:bg-bg-tertiary transition-colors text-left"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleItemClick(item);
                            }}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              handleItemKeyDown(e, item);
                            }}
                            tabIndex={0}
                            role="listitem"
                            data-testid={`item-${item.id}`}
                          >
                            <ItemIcon type={item.type} />
                            {item.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Gates group */}
                  {gates.length > 0 && (
                    <div data-testid="group-gates">
                      <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
                        Gates
                      </h4>
                      <div className="space-y-1">
                        {gates.map((item) => (
                          <button
                            key={item.id}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-text-primary hover:bg-bg-tertiary transition-colors text-left"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleItemClick(item);
                            }}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              handleItemKeyDown(e, item);
                            }}
                            tabIndex={0}
                            role="listitem"
                            data-testid={`item-${item.id}`}
                          >
                            <ItemIcon type={item.type} />
                            {item.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty items */}
                  {cluster.items.length === 0 && (
                    <p className="text-sm text-text-muted italic">No items in this cluster</p>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
