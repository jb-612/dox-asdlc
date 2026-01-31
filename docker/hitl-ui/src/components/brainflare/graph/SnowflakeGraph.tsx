/**
 * SnowflakeGraph - Force-directed graph visualization for ideas and correlations (P08-F06)
 *
 * Uses react-force-graph-2d for canvas-based rendering with D3-force layout.
 * Nodes are colored by classification, edges by correlation type.
 * Supports selection, hover highlighting, search filtering.
 */

import { useRef, useCallback, useEffect, useMemo } from 'react';
import ForceGraph2D, { ForceGraphMethods, NodeObject, LinkObject } from 'react-force-graph-2d';
import { useGraphViewStore } from '../../../stores/graphViewStore';
import { useBrainflareStore } from '../../../stores/brainflareStore';
import type { GraphNode, GraphEdge } from '../../../types/graph';
import { fetchGraph } from '../../../api/correlations';

export interface SnowflakeGraphProps {
  className?: string;
}

// Type aliases for react-force-graph-2d compatibility
type ForceGraphNode = NodeObject<GraphNode>;
type ForceGraphLink = LinkObject<GraphNode, GraphEdge>;

const CLASSIFICATION_COLORS: Record<string, string> = {
  functional: '#3b82f6', // blue
  non_functional: '#8b5cf6', // purple
  undetermined: '#6b7280', // gray
};

const EDGE_COLORS: Record<string, string> = {
  similar: '#22c55e', // green
  related: '#6b7280', // gray
  contradicts: '#ef4444', // red
};

/**
 * Extract ID from edge source or target (can be string, number, or GraphNode)
 */
function getNodeId(ref: string | number | GraphNode): string {
  if (typeof ref === 'string') return ref;
  if (typeof ref === 'number') return String(ref);
  return ref.id;
}

/**
 * SnowflakeGraph component
 */
export function SnowflakeGraph({ className }: SnowflakeGraphProps) {
  const graphRef = useRef<ForceGraphMethods<ForceGraphNode, ForceGraphLink>>();

  const {
    nodes,
    edges,
    selectedNodeId,
    hoveredNodeId,
    highlightedNeighbors,
    filters,
    isLoading,
    error,
    setGraphData,
    selectNode,
    setHoveredNode,
    setLoading,
    setError,
  } = useGraphViewStore();

  const { selectIdea } = useBrainflareStore();

  // Load graph data
  useEffect(() => {
    const loadGraph = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchGraph();
        setGraphData(data.nodes, data.edges);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };
    loadGraph();
  }, [setGraphData, setLoading, setError]);

  // Filter nodes by search
  const filteredNodes = useMemo(() => {
    if (!filters.searchQuery) return nodes;
    const q = filters.searchQuery.toLowerCase();
    const matchingIds = new Set(
      nodes.filter((n) => n.label.toLowerCase().includes(q)).map((n) => n.id)
    );
    // Include neighbors of matches
    edges.forEach((e) => {
      const sourceId = getNodeId(e.source);
      const targetId = getNodeId(e.target);
      if (matchingIds.has(sourceId)) matchingIds.add(targetId);
      if (matchingIds.has(targetId)) matchingIds.add(sourceId);
    });
    return nodes.filter((n) => matchingIds.has(n.id));
  }, [nodes, edges, filters.searchQuery]);

  // Filter edges
  const filteredEdges = useMemo(() => {
    const nodeIds = new Set(filteredNodes.map((n) => n.id));
    return edges.filter((e) => {
      const sourceId = getNodeId(e.source);
      const targetId = getNodeId(e.target);
      return (
        nodeIds.has(sourceId) &&
        nodeIds.has(targetId) &&
        filters.correlationTypes.includes(e.correlationType)
      );
    });
  }, [edges, filteredNodes, filters.correlationTypes]);

  // Node rendering
  const nodeCanvasObject = useCallback(
    (node: ForceGraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const graphNode = node as GraphNode;
      const size = 4 + Math.min(graphNode.degree * 2, 8);
      const color = CLASSIFICATION_COLORS[graphNode.classification || 'undetermined'];

      const isSelected = graphNode.id === selectedNodeId;
      const isHovered = graphNode.id === hoveredNodeId;
      const isNeighbor = highlightedNeighbors.has(graphNode.id);
      const isFaded =
        (selectedNodeId || hoveredNodeId) && !isSelected && !isHovered && !isNeighbor;

      ctx.beginPath();
      ctx.arc(node.x!, node.y!, size, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.globalAlpha = isFaded ? 0.2 : 1;
      ctx.fill();

      // Selection ring
      if (isSelected || isHovered) {
        ctx.strokeStyle = isSelected ? '#1d4ed8' : '#60a5fa';
        ctx.lineWidth = 2 / globalScale;
        ctx.stroke();
      }

      // Label at zoom
      if (globalScale > 1.2 || isSelected || isHovered) {
        const fontSize = Math.max(10 / globalScale, 3);
        ctx.font = `${fontSize}px Inter, sans-serif`;
        ctx.fillStyle = isFaded ? 'rgba(0,0,0,0.2)' : '#1f2937';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const label =
          graphNode.label.length > 25 ? graphNode.label.slice(0, 22) + '...' : graphNode.label;
        ctx.fillText(label, node.x!, node.y! + size + 2);
      }

      ctx.globalAlpha = 1;
    },
    [selectedNodeId, hoveredNodeId, highlightedNeighbors]
  );

  // Edge rendering
  const linkCanvasObject = useCallback(
    (link: ForceGraphLink, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const graphLink = link as unknown as GraphEdge;
      const source = graphLink.source as GraphNode;
      const target = graphLink.target as GraphNode;
      if (!source.x || !target.x) return;

      const sourceId = source.id;
      const targetId = target.id;
      const isHighlighted =
        sourceId === selectedNodeId ||
        targetId === selectedNodeId ||
        sourceId === hoveredNodeId ||
        targetId === hoveredNodeId;
      const isFaded = (selectedNodeId || hoveredNodeId) && !isHighlighted;

      ctx.beginPath();
      ctx.moveTo(source.x, source.y!);
      ctx.lineTo(target.x, target.y!);
      ctx.strokeStyle = EDGE_COLORS[graphLink.correlationType];
      ctx.globalAlpha = isFaded ? 0.1 : 0.6;
      ctx.lineWidth = isHighlighted ? 2 / globalScale : 1 / globalScale;
      ctx.stroke();
      ctx.globalAlpha = 1;
    },
    [selectedNodeId, hoveredNodeId]
  );

  const handleNodeClick = useCallback(
    (node: ForceGraphNode) => {
      const graphNode = node as GraphNode;
      selectNode(graphNode.id === selectedNodeId ? null : graphNode.id);
      selectIdea(graphNode.id);
    },
    [selectedNodeId, selectNode, selectIdea]
  );

  const handleNodeHover = useCallback(
    (node: ForceGraphNode | null) => {
      const graphNode = node as GraphNode | null;
      setHoveredNode(graphNode?.id || null);
    },
    [setHoveredNode]
  );

  const handleBackgroundClick = useCallback(() => {
    selectNode(null);
    selectIdea(null);
  }, [selectNode, selectIdea]);

  if (isLoading) {
    return (
      <div
        className={`flex items-center justify-center h-full ${className}`}
        data-testid="snowflake-graph-loading"
      >
        <div className="text-text-muted">Loading graph...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`flex items-center justify-center h-full ${className}`}
        data-testid="snowflake-graph-error"
      >
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  if (filteredNodes.length === 0) {
    return (
      <div
        className={`flex items-center justify-center h-full ${className}`}
        data-testid="snowflake-graph-empty"
      >
        <div className="text-text-muted">
          {nodes.length === 0 ? 'No ideas with correlations yet' : 'No matching ideas'}
        </div>
      </div>
    );
  }

  // Prepare graph data for the force graph component
  const graphData = useMemo(
    () => ({
      nodes: filteredNodes as ForceGraphNode[],
      links: filteredEdges as unknown as ForceGraphLink[],
    }),
    [filteredNodes, filteredEdges]
  );

  return (
    <div className={className} data-testid="snowflake-graph">
      <ForceGraph2D
        ref={graphRef}
        graphData={graphData}
        nodeId="id"
        nodeCanvasObject={nodeCanvasObject}
        linkCanvasObject={linkCanvasObject}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        onBackgroundClick={handleBackgroundClick}
        linkSource="source"
        linkTarget="target"
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        warmupTicks={50}
        cooldownTicks={100}
        enableNodeDrag={true}
        enableZoomInteraction={true}
        enablePanInteraction={true}
      />
    </div>
  );
}
