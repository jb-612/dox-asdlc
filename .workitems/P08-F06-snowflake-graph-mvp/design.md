# P08-F06: Snowflake Graph View (MVP) - Technical Design

## Overview

Implement an MVP graph visualization for the Mindflare Hub that displays ideas and their correlations as an interactive force-directed graph. Users can explore idea relationships, filter by tags and edge types, and navigate to idea details.

### Problem Statement

While P08-F05 provides a list view and P08-F04 provides correlation data, users lack a visual way to:
- See the overall landscape of their ideas at a glance
- Discover clusters and relationships that emerge from correlations
- Navigate between related ideas visually
- Understand which ideas are most connected (central)

### Solution (MVP Scope)

A focused graph visualization that:
1. Renders ideas as nodes and correlations as edges using force-directed layout
2. Sizes nodes by degree centrality (more connections = larger)
3. Provides basic filtering (tags, inferred edges)
4. Supports zoom, pan, and node selection
5. Integrates with existing IdeaDetailPanel for selected node details
6. Works on desktop (mobile deferred)

### What This MVP Does NOT Include

The following features are deferred to P08-F07 (Snowflake Graph Advanced):
- Full control panel (Display sliders, Forces sliders, Groups section)
- Text fade threshold control
- Node size/link thickness sliders
- Force parameter tuning (center, repel, link force, link distance)
- Clustering/community detection visualization
- Hull overlays for groups
- Edge bundling
- "Why connected?" evidence inspector
- 3D view option
- Mobile touch interactions
- Edit mode (create/remove correlations by drag)
- Advanced filters (time range, confidence threshold, source filter)
- Mini-map for large graphs

## Dependencies

### Internal Dependencies

| Feature | Purpose | Status |
|---------|---------|--------|
| P08-F01 | Ideas Repository Core (data model) | Required |
| P08-F04 | Correlation Engine (graph data API) | Required |
| P08-F05 | Mindflare Hub UI (page shell, detail panel) | Required |
| P05-F01 | HITL UI Foundation | Complete |

### External Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| react-force-graph-2d | ^1.43.0 | Force-directed graph rendering (Canvas/WebGL) |
| d3-force | ^3.0.0 | Force simulation (transitive via react-force-graph) |
| React | ^18.2.0 | UI framework |
| Zustand | ^4.4.0 | State management |
| Tailwind CSS | ^3.4.0 | Styling |
| @heroicons/react | ^2.0.0 | Icons |

## Interfaces

### Provided Interfaces

#### Graph Types

```typescript
// docker/hitl-ui/src/types/graph.ts

/**
 * Node in the graph visualization
 */
export interface GraphNode {
  id: string;                     // idea_id or tag_id
  nodeType: 'idea' | 'tag';
  label: string;                  // Truncated idea content or tag name

  // Idea-specific (nodeType === 'idea')
  ideaId?: string;
  classification?: string;        // 'functional' | 'non_functional' | 'undetermined'
  labels?: string[];

  // Tag-specific (nodeType === 'tag')
  tagName?: string;

  // Computed
  degree: number;                 // Number of connections (for sizing)

  // Layout (set by force simulation)
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;             // Fixed x position (when dragging)
  fy?: number | null;             // Fixed y position (when dragging)
}

/**
 * Edge in the graph visualization
 */
export interface GraphEdge {
  id: string;                     // correlation_id
  source: string;                 // node id
  target: string;                 // node id
  edgeType: 'explicit' | 'inferred' | 'tag';
  correlationType?: CorrelationType; // For explicit/inferred edges
  weight: number;                 // 0-1 (similarity score)
  status?: CorrelationStatus;     // For explicit/inferred edges
}

/**
 * Graph data bundle
 */
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * Correlation type from P08-F04
 */
export type CorrelationType = 'similar' | 'duplicate' | 'complementary' | 'contradicts' | 'related';

/**
 * Correlation status from P08-F04
 */
export type CorrelationStatus = 'suggested' | 'accepted' | 'rejected' | 'refined';
```

#### Graph View State Store

```typescript
// docker/hitl-ui/src/stores/graphViewStore.ts

export interface GraphViewState {
  // Filters
  searchQuery: string;
  showTags: boolean;
  showInferredEdges: boolean;

  // Selection
  selectedNodeId: string | null;
  hoveredNodeId: string | null;

  // View
  zoom: number;
  centerX: number;
  centerY: number;

  // Layout
  isLayoutRunning: boolean;

  // Actions
  setSearchQuery: (query: string) => void;
  setShowTags: (show: boolean) => void;
  setShowInferredEdges: (show: boolean) => void;
  selectNode: (nodeId: string | null) => void;
  setHoveredNode: (nodeId: string | null) => void;
  setZoom: (zoom: number) => void;
  setCenter: (x: number, y: number) => void;
  setLayoutRunning: (running: boolean) => void;
  resetView: () => void;
}
```

#### Component Interfaces

```typescript
// SnowflakeGraph.tsx - Main graph component
interface SnowflakeGraphProps {
  className?: string;
  onNodeSelect?: (nodeId: string) => void;
  onNodeDoubleClick?: (nodeId: string) => void;
}

// GraphControls.tsx - Simple control panel
interface GraphControlsProps {
  className?: string;
}

// useGraphData.ts - Data fetching hook
interface UseGraphDataOptions {
  includeInferred?: boolean;
  includeTags?: boolean;
}

interface UseGraphDataReturn {
  data: GraphData | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}
```

### Required Interfaces

#### Graph API (from P08-F04)

```typescript
// GET /api/ideas/graph - Already defined in P08-F04
interface GetGraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// Query parameters:
// - include_tags: boolean (include tag nodes)
// - include_inferred: boolean (include suggested correlations)
// - filter_labels: string[] (filter to ideas with these labels)
```

## Technical Approach

### Architecture

```
+------------------------------------------------------------------+
|                     Snowflake Graph View                          |
+------------------------------------------------------------------+
|                                                                   |
|  Page Layer                                                       |
|  +------------------------------------------------------------+  |
|  | MindflareGraphPage.tsx                                      |  |
|  | - Full-page graph view                                      |  |
|  | - Integrates controls and detail panel                      |  |
|  +------------------------------------------------------------+  |
|                              |                                    |
|  Component Layer                                                  |
|  +------------------------------------------------------------+  |
|  | SnowflakeGraph.tsx        | GraphControls.tsx               |  |
|  | - react-force-graph-2d    | - Search filter                 |  |
|  | - Node/edge rendering     | - Tag toggle                    |  |
|  | - Zoom/pan handlers       | - Inferred toggle               |  |
|  | - Selection highlighting  | - Reset button                  |  |
|  |                           | - Re-layout button              |  |
|  +------------------------------------------------------------+  |
|                              |                                    |
|  Data Layer                                                       |
|  +------------------------------------------------------------+  |
|  | useGraphData.ts           | graphViewStore.ts               |  |
|  | - Fetch graph from API    | - Filter state                  |  |
|  | - Transform to graph      | - Selection state               |  |
|  | - Filter by search        | - View state                    |  |
|  +------------------------------------------------------------+  |
|                              |                                    |
|  API Layer (existing from P08-F04)                                |
|  +------------------------------------------------------------+  |
|  | api/correlations.ts -> GET /api/ideas/graph                 |  |
|  +------------------------------------------------------------+  |
|                                                                   |
+------------------------------------------------------------------+
```

### Rendering Library: react-force-graph-2d

We chose `react-force-graph-2d` for the MVP because:
- Simple React integration with hooks
- Canvas/WebGL rendering handles 500-2k nodes well
- Built-in D3-force simulation
- Good default interactions (zoom, pan, drag)
- Easy to customize node/edge rendering

### Node Rendering

```typescript
// Node rendering configuration
const nodeCanvasObject = (
  node: GraphNode,
  ctx: CanvasRenderingContext2D,
  globalScale: number
) => {
  // Size based on degree (clamped)
  const baseSize = node.nodeType === 'tag' ? 4 : 6;
  const sizeBoost = Math.min(node.degree * 0.5, 8);
  const size = baseSize + sizeBoost;

  // Color based on type
  const color = node.nodeType === 'tag'
    ? '#22c55e' // green for tags
    : '#1e40af'; // dark blue for ideas

  // Highlight if selected or hovered
  const isHighlighted = node.id === selectedNodeId || node.id === hoveredNodeId;
  const isNeighbor = highlightedNeighbors.has(node.id);
  const opacity = isHighlighted || isNeighbor ? 1.0 : (hoveredNodeId ? 0.2 : 1.0);

  // Draw circle
  ctx.beginPath();
  ctx.arc(node.x!, node.y!, size, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.globalAlpha = opacity;
  ctx.fill();

  // Draw label at sufficient zoom
  if (globalScale > 1.5) {
    ctx.font = `${12 / globalScale}px Sans-Serif`;
    ctx.fillStyle = '#1f2937';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(node.label.slice(0, 20), node.x!, node.y! + size + 2);
  }

  ctx.globalAlpha = 1.0;
};
```

### Edge Rendering

```typescript
// Edge rendering configuration
const linkCanvasObject = (
  link: GraphEdge,
  ctx: CanvasRenderingContext2D,
  globalScale: number
) => {
  const source = link.source as GraphNode;
  const target = link.target as GraphNode;

  // Style based on type
  const isInferred = link.edgeType === 'inferred';
  const isTag = link.edgeType === 'tag';

  ctx.beginPath();
  ctx.moveTo(source.x!, source.y!);
  ctx.lineTo(target.x!, target.y!);

  // Dashed for inferred
  if (isInferred) {
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(156, 163, 175, 0.4)'; // gray, low opacity
  } else if (isTag) {
    // Hide tag edges at far zoom
    if (globalScale < 1.0) {
      ctx.setLineDash([]);
      return;
    }
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.3)'; // green, low opacity
  } else {
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(30, 64, 175, 0.6)'; // blue
  }

  ctx.lineWidth = link.weight * 2 + 0.5;
  ctx.stroke();
  ctx.setLineDash([]);
};
```

### Force Layout Configuration

```typescript
// Force simulation configuration (balanced preset)
const graphConfig = {
  // d3-force parameters
  d3AlphaDecay: 0.02,
  d3VelocityDecay: 0.3,

  // Forces
  dagMode: null, // not a DAG
  dagLevelDistance: undefined,

  // Link force
  linkDistance: (link: GraphEdge) => link.edgeType === 'tag' ? 60 : 80,
  linkStrength: (link: GraphEdge) => link.weight * 0.3,

  // Charge force (repulsion)
  d3Force: (engine: any) => {
    engine.force('charge')?.strength(-150);
    engine.force('center')?.strength(0.05);
    engine.force('collide', d3.forceCollide(15));
  },

  // Warm start for quick layout
  warmupTicks: 100,
  cooldownTicks: 0, // Let it run until stable
};
```

### Interaction Handlers

```typescript
// Node click: select and highlight neighbors
const handleNodeClick = (node: GraphNode) => {
  if (selectedNodeId === node.id) {
    selectNode(null);
  } else {
    selectNode(node.id);
    onNodeSelect?.(node.id);
  }
};

// Node double-click: center and zoom
const handleNodeDoubleClick = (node: GraphNode) => {
  graphRef.current?.centerAt(node.x, node.y, 500);
  graphRef.current?.zoom(2.0, 500);
  onNodeDoubleClick?.(node.id);
};

// Node hover: highlight neighbors, fade others
const handleNodeHover = (node: GraphNode | null) => {
  setHoveredNode(node?.id || null);

  if (node) {
    // Find neighbor IDs
    const neighbors = new Set<string>();
    edges.forEach(edge => {
      const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id;
      const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id;
      if (sourceId === node.id) neighbors.add(targetId);
      if (targetId === node.id) neighbors.add(sourceId);
    });
    setHighlightedNeighbors(neighbors);
  } else {
    setHighlightedNeighbors(new Set());
  }
};
```

### Search Filtering

```typescript
// Filter nodes by search query (in useGraphData hook)
const filterBySearch = (data: GraphData, query: string): GraphData => {
  if (!query.trim()) return data;

  const lowerQuery = query.toLowerCase();

  // Find matching nodes
  const matchingNodeIds = new Set<string>();
  data.nodes.forEach(node => {
    if (node.label.toLowerCase().includes(lowerQuery)) {
      matchingNodeIds.add(node.id);
    }
  });

  // Include nodes connected to matches
  data.edges.forEach(edge => {
    const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id;
    const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id;
    if (matchingNodeIds.has(sourceId)) matchingNodeIds.add(targetId);
    if (matchingNodeIds.has(targetId)) matchingNodeIds.add(sourceId);
  });

  // Filter
  const filteredNodes = data.nodes.filter(n => matchingNodeIds.has(n.id));
  const filteredEdges = data.edges.filter(e => {
    const sourceId = typeof e.source === 'string' ? e.source : (e.source as GraphNode).id;
    const targetId = typeof e.target === 'string' ? e.target : (e.target as GraphNode).id;
    return matchingNodeIds.has(sourceId) && matchingNodeIds.has(targetId);
  });

  return { nodes: filteredNodes, edges: filteredEdges };
};
```

### Page Layout

```
Desktop Layout (full screen):
+------------------------------------------------------------------+
| Header: Mindflare Graph                    [Controls Panel]       |
+------------------------------------------------------------------+
|                                             |                     |
|                                             | Search: [______]    |
|                                             | [x] Show Tags       |
|                                             | [x] Show Inferred   |
|     Graph Canvas (full area)                | [Reset View]        |
|                                             | [Re-run Layout]     |
|                                             |---------------------|
|                                             | Selected: Idea #123 |
|                                             | "This is the idea..." |
|                                             | [View Details]      |
|                                             | [Bake in Studio]    |
+------------------------------------------------------------------+
```

### Performance Considerations

1. **Large Graphs (500+ nodes)**: react-force-graph-2d handles this well with WebGL fallback
2. **Initial Layout**: Use `warmupTicks` to pre-compute layout before render
3. **Filtering**: Apply filters in useGraphData before passing to graph component
4. **Memoization**: Memoize node/edge render functions and filtered data

### Error Handling

| Error Type | UI Handling |
|------------|-------------|
| Graph API error | Show error banner with retry button |
| No data | Show empty state with helpful message |
| Too many nodes (>2000) | Show warning, suggest filtering |
| Layout timeout | Allow manual re-trigger |

## File Structure

```
docker/hitl-ui/src/
+-- pages/
|   +-- MindflareGraphPage.tsx         # Full-page graph view
|   +-- MindflareGraphPage.test.tsx
+-- components/
|   +-- mindflare/
|       +-- graph/
|           +-- SnowflakeGraph.tsx     # Main graph component
|           +-- SnowflakeGraph.test.tsx
|           +-- GraphControls.tsx      # Simple control panel
|           +-- GraphControls.test.tsx
|           +-- useGraphData.ts        # Data fetching/transform hook
|           +-- useGraphData.test.ts
+-- stores/
|   +-- graphViewStore.ts              # Graph view state
|   +-- graphViewStore.test.ts
+-- types/
|   +-- graph.ts                       # Graph-specific types
+-- api/
    +-- mocks/
        +-- graph.ts                   # Mock graph data for testing
```

## Future Enhancements (P08-F07)

The following features are documented here for future reference:

### Advanced Controls
- **Display Section**: Node size slider, link thickness slider, text fade threshold
- **Forces Section**: Center force, repel strength, link force, link distance
- **Groups Section**: Color by cluster, hull overlays, group toggle

### Advanced Features
- **3D View**: Option to switch to react-force-graph-3d
- **Mini-map**: Overview navigation for large graphs
- **Edge Bundling**: Bundle edges for cleaner visualization
- **Why Connected**: Evidence inspector showing correlation reasoning

### Mobile Support
- Touch gestures (pinch zoom, two-finger pan)
- Simplified controls overlay
- Tap-to-select with popup details

### Edit Mode
- Drag to create correlation
- Right-click to remove correlation
- Inline type selection

## Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Performance with large graphs | Medium | Medium | Limit initial load, progressive expansion |
| react-force-graph-2d learning curve | Low | Low | Well-documented, similar to D3 |
| Layout instability | Low | Medium | Use warmupTicks, cooldown controls |
| Mobile usability issues | Medium | Deferred | Excluded from MVP scope |

## Success Metrics

1. **Render Performance**: Initial render < 2s for 500 nodes
2. **Interaction Response**: Zoom/pan at 60fps
3. **Layout Quality**: Nodes well-separated, minimal edge crossing
4. **User Adoption**: 30%+ of Mindflare Hub users try graph view
