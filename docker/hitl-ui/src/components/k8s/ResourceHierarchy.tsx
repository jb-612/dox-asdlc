/**
 * ResourceHierarchy - D3 tree visualization of K8s resource relationships
 *
 * Displays hierarchical tree: Namespace -> Deployment/StatefulSet -> ReplicaSet -> Pods
 * Features:
 * - Color-coded nodes by status (green=healthy, red=unhealthy, yellow=warning)
 * - Expand/collapse branches
 * - Click handler for node selection
 * - Zoom and pan controls
 * - Fit-to-screen button
 * - Namespace filter
 */

import { useState, useMemo, useCallback, useRef } from 'react';
import Tree, { RawNodeDatum } from 'react-d3-tree';
import {
  MagnifyingGlassPlusIcon,
  MagnifyingGlassMinusIcon,
  ArrowsPointingOutIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import type { K8sPod, PodStatus } from '../../api/types/kubernetes';

export interface ResourceHierarchyProps {
  /** Pods to display in hierarchy */
  pods: K8sPod[];
  /** Namespace filter */
  namespace?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Callback when a node is clicked */
  onNodeClick?: (type: string, name: string, namespace?: string) => void;
  /** Custom class name */
  className?: string;
}

// Node types for the hierarchy
type NodeType = 'namespace' | 'deployment' | 'replicaset' | 'pod' | 'statefulset' | 'daemonset' | 'job';

// Extended node datum with our custom attributes
interface K8sNodeDatum extends RawNodeDatum {
  attributes?: {
    type: NodeType;
    status?: 'healthy' | 'warning' | 'unhealthy';
    namespace?: string;
    podCount?: number;
    readyCount?: number;
  };
}

// Status colors for tree nodes
const statusColors = {
  healthy: '#22c55e', // green
  warning: '#eab308', // yellow
  unhealthy: '#ef4444', // red
  default: '#6b7280', // gray
};

// Get status for a pod
function getPodHealthStatus(status: PodStatus): 'healthy' | 'warning' | 'unhealthy' {
  switch (status) {
    case 'Running':
    case 'Succeeded':
      return 'healthy';
    case 'Pending':
      return 'warning';
    case 'Failed':
    case 'Unknown':
      return 'unhealthy';
    default:
      return 'unhealthy';
  }
}

// Get aggregated status for a group of pods
function getAggregatedStatus(pods: K8sPod[]): 'healthy' | 'warning' | 'unhealthy' {
  if (pods.length === 0) return 'unhealthy';

  const hasUnhealthy = pods.some(p => ['Failed', 'Unknown'].includes(p.status));
  const hasPending = pods.some(p => p.status === 'Pending');
  const allHealthy = pods.every(p => ['Running', 'Succeeded'].includes(p.status));

  if (hasUnhealthy) return 'unhealthy';
  if (hasPending) return 'warning';
  if (allHealthy) return 'healthy';
  return 'warning';
}

// Build tree data from pods
function buildTreeData(pods: K8sPod[], namespaceFilter?: string): K8sNodeDatum | null {
  // Filter pods by namespace if specified
  const filteredPods = namespaceFilter
    ? pods.filter(p => p.namespace === namespaceFilter)
    : pods;

  if (filteredPods.length === 0) return null;

  // Group pods by namespace -> owner -> pod
  const namespaces = new Map<string, Map<string, K8sPod[]>>();

  filteredPods.forEach(pod => {
    if (!namespaces.has(pod.namespace)) {
      namespaces.set(pod.namespace, new Map());
    }
    const nsMap = namespaces.get(pod.namespace)!;
    const ownerKey = `${pod.ownerKind}:${pod.ownerName}`;
    if (!nsMap.has(ownerKey)) {
      nsMap.set(ownerKey, []);
    }
    nsMap.get(ownerKey)!.push(pod);
  });

  // Build tree structure
  const root: K8sNodeDatum = {
    name: 'Cluster',
    attributes: { type: 'namespace' as NodeType, status: 'healthy' },
    children: [],
  };

  namespaces.forEach((owners, namespace) => {
    const nsPods = filteredPods.filter(p => p.namespace === namespace);
    const nsNode: K8sNodeDatum = {
      name: namespace,
      attributes: {
        type: 'namespace' as NodeType,
        status: getAggregatedStatus(nsPods),
        podCount: nsPods.length,
        readyCount: nsPods.filter(p => p.status === 'Running').length,
      },
      children: [],
    };

    owners.forEach((ownerPods, ownerKey) => {
      const [ownerKind, ownerName] = ownerKey.split(':');
      const ownerType = ownerKind.toLowerCase() as NodeType;

      const ownerNode: K8sNodeDatum = {
        name: ownerName,
        attributes: {
          type: ownerType,
          status: getAggregatedStatus(ownerPods),
          namespace,
          podCount: ownerPods.length,
          readyCount: ownerPods.filter(p => p.status === 'Running').length,
        },
        children: ownerPods.map(pod => ({
          name: pod.name.length > 30 ? pod.name.substring(0, 27) + '...' : pod.name,
          attributes: {
            type: 'pod' as NodeType,
            status: getPodHealthStatus(pod.status),
            namespace: pod.namespace,
          },
        })),
      };

      nsNode.children!.push(ownerNode);
    });

    root.children!.push(nsNode);
  });

  // If only one namespace, skip the root "Cluster" node
  if (root.children!.length === 1) {
    return root.children![0] as K8sNodeDatum;
  }

  root.attributes!.status = getAggregatedStatus(filteredPods);
  return root;
}

// Custom node rendering
interface CustomNodeProps {
  nodeDatum: K8sNodeDatum;
  onNodeClick?: (type: string, name: string, namespace?: string) => void;
}

function CustomNode({ nodeDatum, onNodeClick }: CustomNodeProps) {
  const type = nodeDatum.attributes?.type || 'namespace';
  const status = nodeDatum.attributes?.status || 'default';
  const color = statusColors[status];

  // Node sizes by type
  const sizes = {
    namespace: 20,
    deployment: 15,
    replicaset: 12,
    statefulset: 15,
    daemonset: 15,
    job: 12,
    pod: 10,
  };

  const size = sizes[type] || 12;

  const handleClick = () => {
    onNodeClick?.(type, nodeDatum.name, nodeDatum.attributes?.namespace);
  };

  return (
    <g onClick={handleClick} style={{ cursor: 'pointer' }}>
      {/* Node circle */}
      <circle
        r={size}
        fill={color}
        stroke="#1f2937"
        strokeWidth={2}
      />

      {/* Type indicator (icon-like) */}
      {type === 'namespace' && (
        <text
          textAnchor="middle"
          dy="0.35em"
          fontSize={size * 0.8}
          fill="white"
          fontWeight="bold"
        >
          N
        </text>
      )}
      {(type === 'deployment' || type === 'statefulset' || type === 'daemonset') && (
        <text
          textAnchor="middle"
          dy="0.35em"
          fontSize={size * 0.8}
          fill="white"
          fontWeight="bold"
        >
          D
        </text>
      )}
      {type === 'job' && (
        <text
          textAnchor="middle"
          dy="0.35em"
          fontSize={size * 0.8}
          fill="white"
          fontWeight="bold"
        >
          J
        </text>
      )}
      {type === 'pod' && (
        <text
          textAnchor="middle"
          dy="0.35em"
          fontSize={size * 0.8}
          fill="white"
          fontWeight="bold"
        >
          P
        </text>
      )}

      {/* Label */}
      <text
        x={size + 8}
        dy="0.35em"
        fontSize={11}
        fill="#c9d1d9"
        className="select-none"
      >
        {nodeDatum.name}
        {nodeDatum.attributes?.podCount !== undefined && type !== 'pod' && (
          <tspan fill="#8b949e" fontSize={9}>
            {` (${nodeDatum.attributes.readyCount}/${nodeDatum.attributes.podCount})`}
          </tspan>
        )}
      </text>
    </g>
  );
}

export default function ResourceHierarchy({
  pods,
  namespace,
  isLoading = false,
  onNodeClick,
  className,
}: ResourceHierarchyProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [translate, setTranslate] = useState({ x: 200, y: 200 });
  const [zoom, setZoom] = useState(0.8);
  const [selectedNamespace, setSelectedNamespace] = useState<string>(namespace || 'all');

  // Get unique namespaces
  const namespaces = useMemo(() => {
    const unique = [...new Set(pods.map(p => p.namespace))];
    return unique.sort();
  }, [pods]);

  // Build tree data
  const treeData = useMemo(() => {
    return buildTreeData(pods, selectedNamespace === 'all' ? undefined : selectedNamespace);
  }, [pods, selectedNamespace]);

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + 0.2, 2));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev - 0.2, 0.3));
  }, []);

  const handleFitToScreen = useCallback(() => {
    setZoom(0.8);
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      setTranslate({ x: width / 4, y: height / 2 });
    }
  }, []);

  // Handle node click
  const handleNodeClick = useCallback((datum: K8sNodeDatum) => {
    onNodeClick?.(
      datum.attributes?.type || 'unknown',
      datum.name,
      datum.attributes?.namespace
    );
  }, [onNodeClick]);

  // Loading state
  if (isLoading && pods.length === 0) {
    return (
      <div
        className={clsx('h-80 flex items-center justify-center bg-bg-tertiary/30 rounded-lg', className)}
        data-testid="resource-hierarchy-loading"
      >
        <div className="animate-pulse text-text-muted">Loading hierarchy...</div>
      </div>
    );
  }

  // Empty state
  if (!treeData || pods.length === 0) {
    return (
      <div
        className={clsx('h-80 flex items-center justify-center bg-bg-tertiary/30 rounded-lg', className)}
        data-testid="resource-hierarchy-empty"
      >
        <p className="text-text-muted">No resources to display</p>
      </div>
    );
  }

  return (
    <div className={clsx('relative', className)} data-testid="resource-hierarchy">
      {/* Controls */}
      <div className="absolute top-2 left-2 z-10 flex items-center gap-2 bg-bg-secondary/90 rounded-lg p-2 backdrop-blur-sm">
        {/* Namespace filter */}
        <div className="flex items-center gap-1">
          <FunnelIcon className="h-4 w-4 text-text-muted" />
          <select
            value={selectedNamespace}
            onChange={(e) => setSelectedNamespace(e.target.value)}
            className="bg-bg-tertiary rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-blue"
            data-testid="namespace-filter"
          >
            <option value="all">All Namespaces</option>
            {namespaces.map((ns) => (
              <option key={ns} value={ns}>
                {ns}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 bg-bg-secondary/90 rounded-lg p-1 backdrop-blur-sm">
        <button
          onClick={handleZoomIn}
          className="p-1.5 rounded hover:bg-bg-tertiary text-text-muted hover:text-text-primary transition-colors"
          title="Zoom in"
          data-testid="zoom-in"
        >
          <MagnifyingGlassPlusIcon className="h-4 w-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-1.5 rounded hover:bg-bg-tertiary text-text-muted hover:text-text-primary transition-colors"
          title="Zoom out"
          data-testid="zoom-out"
        >
          <MagnifyingGlassMinusIcon className="h-4 w-4" />
        </button>
        <button
          onClick={handleFitToScreen}
          className="p-1.5 rounded hover:bg-bg-tertiary text-text-muted hover:text-text-primary transition-colors"
          title="Fit to screen"
          data-testid="fit-to-screen"
        >
          <ArrowsPointingOutIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-2 left-2 z-10 flex items-center gap-3 bg-bg-secondary/90 rounded-lg px-3 py-2 backdrop-blur-sm text-xs">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: statusColors.healthy }} />
          <span className="text-text-muted">Healthy</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: statusColors.warning }} />
          <span className="text-text-muted">Warning</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: statusColors.unhealthy }} />
          <span className="text-text-muted">Unhealthy</span>
        </div>
      </div>

      {/* Tree visualization */}
      <div
        ref={containerRef}
        className="h-80 bg-bg-tertiary/30 rounded-lg overflow-hidden"
        data-testid="tree-container"
      >
        <Tree
          data={treeData}
          translate={translate}
          zoom={zoom}
          orientation="horizontal"
          pathFunc="step"
          collapsible={true}
          enableLegacyTransitions={true}
          transitionDuration={300}
          nodeSize={{ x: 200, y: 60 }}
          separation={{ siblings: 1.2, nonSiblings: 1.5 }}
          scaleExtent={{ min: 0.3, max: 2 }}
          onNodeClick={(node) => handleNodeClick(node.data as K8sNodeDatum)}
          renderCustomNodeElement={(props) => (
            <CustomNode
              nodeDatum={props.nodeDatum as K8sNodeDatum}
              onNodeClick={onNodeClick}
            />
          )}
          pathClassFunc={() => 'tree-link'}
        />
      </div>

      {/* Tree link styles */}
      <style>{`
        .tree-link {
          stroke: #4b5563;
          stroke-width: 1.5px;
          fill: none;
        }
      `}</style>
    </div>
  );
}
