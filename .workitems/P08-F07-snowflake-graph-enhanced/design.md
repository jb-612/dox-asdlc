# P08-F07: Snowflake Graph View Enhanced - Future Features

**Status:** FUTURE - Not for immediate implementation
**Prerequisite:** P08-F06 (Snowflake Graph MVP) must be complete
**Purpose:** Documents deferred features from P08-F06 for future planning

---

## Overview

This document captures the full vision for the Snowflake Graph View, based on the Obsidian-style specification. These features were intentionally deferred from the MVP (P08-F06) to maintain focus and deliver value incrementally.

When P08-F07 is prioritized for implementation, this document should be expanded into a full design.md with technical approach, and user_stories.md and tasks.md should be created.

---

## 1. Full Control Panel (Obsidian-style)

The MVP includes basic controls (search, tag toggle, inferred toggle, reset). The enhanced version adds a comprehensive control panel matching the Obsidian graph view.

### 1.1 Filters Section

| Control | Type | Description |
|---------|------|-------------|
| Search files | Typeahead input | Filter nodes by text with autocomplete |
| Tags | Toggle | Show/hide tag nodes |
| Attachments | Toggle | Show/hide attachment nodes |
| Existing files only | Toggle | Hide orphan/unlinked ideas |
| Orphans | Toggle | Show only orphan nodes |
| Time range | Dual slider | Filter by created/modified date |
| Source | Multi-select | Filter by source (manual, slack, import) |
| Confidence threshold | Slider | Min similarity score for inferred edges |

### 1.2 Groups Section

| Control | Type | Description |
|---------|------|-------------|
| Group by | Select | Community detection algorithm selection |
| - None | Option | No grouping |
| - Louvain | Option | Louvain community detection |
| - Leiden | Option | Leiden community detection |
| - Tag clusters | Option | Group by shared tags |
| - Source type | Option | Group by idea source |
| Hull overlays | Toggle | Draw convex hull around communities |
| Collapse communities | Toggle | Replace community with supernode at far zoom |

### 1.3 Display Section

| Control | Type | Range | Description |
|---------|------|-------|-------------|
| Arrows | Toggle | - | Show edge direction arrows |
| Text fade threshold | Slider | -3 to +3 | Zoom level where labels appear/fade |
| Node size | Slider | 0.1 to 5 | Base node size multiplier |
| Link thickness | Slider | 0.1 to 5 | Edge thickness multiplier |
| Animate | Button | - | Re-run force simulation animation |
| Edge bundling | Toggle | - | Bundle edges for cleaner visualization |
| Max labels | Input | 0-500 | Hard cap on visible labels |
| Show inferred | Toggle | - | Display suggested correlations |

### 1.4 Forces Section

| Control | Type | Range | Default | Description |
|---------|------|-------|---------|-------------|
| Center force | Slider | 0 to 1 | 0.05 | Pull nodes toward center |
| Repel force | Slider | 0 to 20 | 5 | Node repulsion strength |
| Link force | Slider | 0 to 1 | 0.3 | Edge attraction strength |
| Link distance | Slider | 30 to 500 | 80 | Target edge length |
| Collision radius | Slider | 0 to 50 | 15 | Minimum node separation |
| Alpha decay | Slider | 0 to 0.1 | 0.02 | Simulation cooling rate |
| Pause | Button | - | - | Freeze simulation |
| Reset | Button | - | - | Reset to default forces |
| Pin all | Button | - | - | Fix all node positions |

---

## 2. LOD Engine (Level of Detail)

Progressive rendering based on zoom level for performance and readability.

### 2.1 Label Management

```
Zoom Level    Label Behavior
-----------   --------------
Far (< 0.5)   No labels visible
Medium (0.5-1.5)   Hub nodes only (degree > threshold)
Close (1.5-3.0)   Most labels, collision avoidance active
Very close (> 3.0)   All labels visible
```

### 2.2 Label Collision Avoidance

- Use d3-labeler or similar algorithm
- Push overlapping labels apart
- Prioritize high-degree nodes
- Hard cap on visible labels (configurable)

### 2.3 Edge Visibility Policy

```
Zoom Level    Edge Behavior
-----------   --------------
Far (< 0.5)   Hub-to-hub edges only
Medium (0.5-1.5)   Intra-community edges
Close (> 1.5)   All edges
```

---

## 3. Inspector Panel ("Why Connected?")

When user selects an edge or two nodes, show evidence for the connection.

### 3.1 Evidence Types

| Type | Description |
|------|-------------|
| Backlinks | Direct references between ideas |
| Shared tags | Tags present on both ideas |
| Shared entities | Named entities (people, products, etc.) |
| Similarity score | Embedding cosine similarity |
| Common sources | Same Slack channel, import batch |

### 3.2 Inspector Panel Layout

```
+----------------------------------+
| Connection: Idea A <-> Idea B    |
+----------------------------------+
| Correlation Type: similar        |
| Confidence: 0.87                 |
| Status: accepted                 |
+----------------------------------+
| Evidence:                        |
|  - Shared tags: #api, #design    |
|  - Similarity: 0.87              |
|  - Both from: #product-ideas     |
+----------------------------------+
| Computed: 2024-01-15 14:32       |
| Model: text-embedding-3-small    |
| Threshold: 0.75                  |
+----------------------------------+
| [View Full Evidence] [Edit]      |
+----------------------------------+
```

### 3.3 Computation Metadata

- Model version used for embeddings
- Timestamp of correlation computation
- Threshold used for suggestion
- Link to audit log

---

## 4. 3D View Option

Optional WebGL 3D visualization using Three.js or react-force-graph-3d.

### 4.1 3D Features

| Feature | Description |
|---------|-------------|
| 3D force layout | Same simulation in 3D space |
| Orbit controls | Rotate, zoom with mouse |
| Layer separation | Spread communities on Z-axis |
| Depth fading | Distant nodes fade |
| Performance mode | Reduce quality for large graphs |

### 4.2 Toggle Behavior

- Button to switch between 2D and 3D
- Preserve node positions (project Z to 0 for 2D)
- Maintain selection state across toggle
- Warning for mobile devices (3D disabled)

### 4.3 Performance Considerations

| Node Count | Recommendation |
|------------|----------------|
| < 500 | 3D supported |
| 500-1000 | 3D with performance mode |
| > 1000 | 2D only recommended |

---

## 5. Mobile Touch Interactions

Responsive touch support for tablet and phone.

### 5.1 Touch Gestures

| Gesture | Action |
|---------|--------|
| Pinch | Zoom in/out |
| Two-finger drag | Pan canvas |
| Single tap | Select node |
| Long press | Context menu |
| Double tap | Zoom to node |
| Swipe (on panel) | Dismiss panel |

### 5.2 Mobile Control Panel

- Collapsible drawer from bottom
- Large touch targets (44px minimum)
- Simplified controls (hide Forces section)
- Full-screen graph option

### 5.3 Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| >= 1024px | Desktop: side panel |
| 768-1023px | Tablet: collapsible panel |
| < 768px | Mobile: bottom drawer |

---

## 6. Edit Mode

Allow users to create and modify correlations directly in the graph.

### 6.1 Edit Mode Activation

- Toggle button in toolbar
- Visual indicator (Edit Mode badge)
- Different cursor (crosshair)
- Visible handles on nodes/edges

### 6.2 Create Correlation

1. Enable Edit Mode
2. Drag from source node
3. Drop on target node
4. Select correlation type from popup
5. Confirm creation
6. POST to /api/correlations

### 6.3 Remove Correlation

1. Enable Edit Mode
2. Click edge to select
3. Press Delete or click Remove button
4. Confirm deletion
5. DELETE to /api/correlations/{id}

### 6.4 Tag Assignment

1. Enable Edit Mode
2. Drag tag node to idea node
3. Confirm tag assignment
4. PATCH to /api/ideas/{id}/tags

### 6.5 Confirmation Pattern

All edit operations require confirmation:
```
Create correlation?
  Type: similar
  From: "API design thoughts..."
  To: "REST vs GraphQL comparison..."

  [Cancel] [Create]
```

---

## 7. Advanced Features

### 7.1 Mini-map

- Small overview in corner
- Shows entire graph at small scale
- Viewport rectangle shows current view
- Click mini-map to navigate

### 7.2 Shortest Path Highlighting

- Select two nodes
- "Show path" button
- Highlight shortest path edges
- Dim non-path elements
- Path length indicator

### 7.3 k-hop Neighborhood Isolation

- Select node
- Choose hop count (1, 2, 3)
- Show only nodes within k hops
- Fade or hide distant nodes
- "Clear isolation" button

### 7.4 Export Options

| Format | Use Case |
|--------|----------|
| PNG | Quick screenshot |
| SVG | Vector graphics, editing |
| JSON | Graph data for external tools |
| CSV | Node/edge lists for analysis |

### 7.5 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| / | Focus search |
| Escape | Clear selection |
| Arrow keys | Navigate between nodes |
| Space | Toggle simulation pause |
| E | Toggle Edit Mode |
| F | Fit graph to view |
| + / - | Zoom in/out |
| Ctrl+Click | Add to selection |

### 7.6 Lasso Selection

- Click and drag to draw selection box
- All nodes in box are selected
- Shift+drag to add to selection
- Apply bulk actions to selection

---

## Dependencies

### From MVP (P08-F06)

| Component | Status | Notes |
|-----------|--------|-------|
| SnowflakeGraph.tsx | Required | Base graph component |
| GraphControls.tsx | Required | Will be extended |
| useGraphData.ts | Required | Data fetching hook |
| graphViewStore.ts | Required | State management |
| graph.ts types | Required | Type definitions |

### New Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| react-force-graph-3d | ^1.22.0 | 3D visualization |
| three | ^0.160.0 | WebGL rendering |
| d3-labeler | ^1.0.0 | Label collision avoidance |
| hammer.js | ^2.0.8 | Touch gestures |

### Backend Dependencies

| Feature | API Change Required |
|---------|---------------------|
| Edit Mode | POST/DELETE /api/correlations |
| Inspector | GET /api/correlations/{id}/evidence |
| Community detection | GET /api/ideas/graph?group_by=louvain |
| Time filter | GET /api/ideas/graph?created_after=... |

---

## Estimated Effort

| Feature Group | Estimate | Priority |
|---------------|----------|----------|
| Full Control Panel | 3-4 days | High |
| LOD Engine | 2-3 days | High |
| Inspector Panel | 2 days | Medium |
| 3D View | 3-4 days | Low |
| Mobile Touch | 2-3 days | Medium |
| Edit Mode | 4-5 days | Medium |
| Advanced Features | 5-6 days | Low |

**Total estimate:** 21-27 days (when prioritized)

---

## Implementation Phases (Proposed)

When P08-F07 is prioritized, consider phasing:

### Phase 1: Enhanced Controls

- Full control panel (Display, Forces)
- LOD engine for labels
- Edge visibility policy

### Phase 2: Inspection

- Inspector panel
- Evidence display
- Computation metadata

### Phase 3: Interaction

- Edit Mode
- Mobile touch
- Keyboard shortcuts

### Phase 4: Advanced

- 3D view
- Mini-map
- Export options
- Advanced selection

---

## References

- P08-F06: Snowflake Graph MVP (prerequisite)
- P08-F04: Correlation Engine (data source)
- P08-F05: Mindflare Hub UI (integration)
- Obsidian Graph View: https://help.obsidian.md/Plugins/Graph+view

---

## Revision History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-01-31 | 0.1 | Planner | Initial future feature documentation |
