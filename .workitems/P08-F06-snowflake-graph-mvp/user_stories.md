# P08-F06: Snowflake Graph View (MVP) - User Stories

## Epic Summary

**Epic:** Snowflake Graph View MVP for Mindflare Hub

**Goal:** Enable users to visually explore their ideas and correlations through an interactive force-directed graph, discovering clusters and relationships that are not apparent in the list view.

**Success Criteria:**
- Users can view all ideas as an interactive graph
- Users can filter the graph by tags and edge types
- Users can navigate from graph nodes to idea details
- Graph renders performantly with up to 500 nodes
- View is desktop-only (mobile deferred)

---

## User Stories

### US-01: View Ideas as Graph

**As a** product manager exploring my idea landscape,
**I want to** see all my ideas displayed as a force-directed graph,
**So that** I can visually understand the overall structure and density of my idea space.

**Acceptance Criteria:**

1. **Given** I am on the Mindflare Hub, **When** I navigate to the Graph View, **Then** I see a full-page graph visualization with ideas as nodes.

2. **Given** the graph is loaded, **When** I observe the layout, **Then** nodes are spread out using a force-directed algorithm with minimal overlap.

3. **Given** ideas have correlations, **When** the graph renders, **Then** correlations appear as edges connecting the related idea nodes.

4. **Given** the graph background, **When** I view it, **Then** the background is near-white (#fafafa or similar) for clarity.

5. **Given** the page loads, **When** the initial layout stabilizes, **Then** the time to first meaningful paint is under 2 seconds for up to 500 nodes.

**Tasks:** T01, T02, T03

---

### US-02: Node Visual Differentiation

**As a** user viewing the graph,
**I want to** distinguish between different types of nodes,
**So that** I can quickly identify ideas versus tags.

**Acceptance Criteria:**

1. **Given** an idea node, **When** rendered, **Then** it appears as a dark blue (#1e40af) circle.

2. **Given** a tag node, **When** rendered, **Then** it appears as a green (#22c55e) circle, smaller than idea nodes.

3. **Given** a node with many connections (high degree), **When** rendered, **Then** it appears larger than nodes with few connections, up to a maximum size cap.

4. **Given** a node with few or no connections, **When** rendered, **Then** it has a minimum visible size (not too small to click).

5. **Given** I zoom in past a threshold (globalScale > 1.5), **When** viewing nodes, **Then** truncated labels appear below each node.

**Tasks:** T04, T05

---

### US-03: Edge Visual Differentiation

**As a** user analyzing correlations,
**I want to** distinguish between explicit and inferred correlations,
**So that** I know which relationships are confirmed versus suggested.

**Acceptance Criteria:**

1. **Given** an explicit (accepted) correlation, **When** rendered, **Then** it appears as a solid line with moderate opacity.

2. **Given** an inferred (suggested) correlation, **When** rendered, **Then** it appears as a dashed line with lower opacity.

3. **Given** a tag-to-idea edge, **When** I am zoomed out (globalScale < 1.0), **Then** tag edges are hidden to reduce visual clutter.

4. **Given** a correlation with a higher similarity score, **When** rendered, **Then** the edge appears slightly thicker than lower-score edges.

**Tasks:** T05

---

### US-04: Zoom and Pan Interaction

**As a** user exploring a large graph,
**I want to** zoom in/out and pan around the canvas,
**So that** I can focus on specific areas or see the full picture.

**Acceptance Criteria:**

1. **Given** I use the scroll wheel, **When** scrolling up/down on the graph, **Then** the view zooms in/out centered on the cursor position.

2. **Given** I click and drag on empty space, **When** dragging, **Then** the view pans in the drag direction.

3. **Given** the zoom level changes, **When** labels are configured to show, **Then** labels appear/disappear based on the zoom threshold.

4. **Given** I interact with zoom/pan, **When** the view updates, **Then** the framerate remains smooth (60fps target).

**Tasks:** T06

---

### US-05: Node Selection and Highlighting

**As a** user investigating specific ideas,
**I want to** click on a node to select it,
**So that** I can see its details and understand its relationships.

**Acceptance Criteria:**

1. **Given** I click on a node, **When** the click registers, **Then** the node becomes selected and visually highlighted.

2. **Given** a node is selected, **When** I view the sidebar, **Then** the node's details appear in the detail panel.

3. **Given** a node is selected, **When** I click it again, **Then** it becomes deselected.

4. **Given** a node is selected, **When** I click a different node, **Then** the new node becomes selected and the previous one is deselected.

5. **Given** an idea node is selected, **When** I view the detail panel, **Then** I see a "View Details" button and a "Bake in Studio" action.

**Tasks:** T07, T08

---

### US-06: Hover Highlighting

**As a** user scanning the graph,
**I want to** hover over a node to highlight it and its neighbors,
**So that** I can quickly see what a node is connected to without clicking.

**Acceptance Criteria:**

1. **Given** I hover over a node, **When** the hover is detected, **Then** the hovered node is visually emphasized.

2. **Given** I hover over a node, **When** viewing the graph, **Then** directly connected neighbor nodes remain fully visible.

3. **Given** I hover over a node, **When** viewing non-connected nodes, **Then** they fade to 20% opacity.

4. **Given** I move the cursor off all nodes, **When** hover ends, **Then** all nodes return to normal visibility.

**Tasks:** T07

---

### US-07: Double-Click to Focus

**As a** user wanting to examine a specific node closely,
**I want to** double-click on a node to center and zoom to it,
**So that** I can quickly focus on a particular idea.

**Acceptance Criteria:**

1. **Given** I double-click on a node, **When** the action triggers, **Then** the view animates to center on that node.

2. **Given** I double-click on a node, **When** centering completes, **Then** the zoom level increases to show detail (e.g., zoom level 2.0).

3. **Given** the animation, **When** it plays, **Then** it is smooth (approximately 500ms duration).

**Tasks:** T07

---

### US-08: Search Filter

**As a** user looking for specific ideas,
**I want to** filter the graph by a search query,
**So that** I can find and focus on ideas matching my interest.

**Acceptance Criteria:**

1. **Given** the controls panel, **When** I view it, **Then** I see a search input field with a typeahead/filter behavior.

2. **Given** I type a query, **When** the query matches node labels, **Then** the graph filters to show only matching nodes and their direct connections.

3. **Given** I clear the search query, **When** the field is empty, **Then** the full graph is displayed again.

4. **Given** my query matches no nodes, **When** viewing the result, **Then** I see an empty graph with a "No results" message.

**Tasks:** T09, T10

---

### US-09: Toggle Tags Visibility

**As a** user wanting a cleaner view,
**I want to** toggle tag nodes on or off,
**So that** I can focus on idea-to-idea correlations without tag clutter.

**Acceptance Criteria:**

1. **Given** the controls panel, **When** I view it, **Then** I see a "Show Tags" toggle checkbox.

2. **Given** tags are shown, **When** I uncheck the toggle, **Then** tag nodes and tag edges are removed from the view.

3. **Given** tags are hidden, **When** I check the toggle, **Then** tag nodes and their edges reappear.

4. **Given** I toggle tags, **When** the graph updates, **Then** the layout re-adjusts smoothly.

**Tasks:** T09, T10

---

### US-10: Toggle Inferred Edges

**As a** user wanting to see only confirmed relationships,
**I want to** toggle inferred (suggested) edges on or off,
**So that** I can view only the correlations I have reviewed.

**Acceptance Criteria:**

1. **Given** the controls panel, **When** I view it, **Then** I see a "Show Inferred Edges" toggle checkbox.

2. **Given** inferred edges are shown, **When** I uncheck the toggle, **Then** dashed inferred edges are hidden.

3. **Given** inferred edges are hidden, **When** I check the toggle, **Then** inferred edges reappear.

**Tasks:** T09, T10

---

### US-11: Reset View Button

**As a** user who has zoomed/panned extensively,
**I want to** reset the view to the default state,
**So that** I can see the full graph again without manual adjustment.

**Acceptance Criteria:**

1. **Given** the controls panel, **When** I view it, **Then** I see a "Reset View" button.

2. **Given** I click "Reset View", **When** the action completes, **Then** the zoom resets to fit all nodes and the pan centers on the graph.

3. **Given** the reset animation, **When** it plays, **Then** it is smooth and quick.

**Tasks:** T09

---

### US-12: Re-run Layout Button

**As a** user whose graph looks tangled,
**I want to** re-run the force layout simulation,
**So that** I can try to get a cleaner arrangement.

**Acceptance Criteria:**

1. **Given** the controls panel, **When** I view it, **Then** I see a "Re-run Layout" button.

2. **Given** I click "Re-run Layout", **When** the action triggers, **Then** the force simulation restarts and nodes re-arrange.

3. **Given** the layout is running, **When** I observe, **Then** the button shows a loading indicator.

**Tasks:** T09

---

### US-13: Sidebar Integration

**As a** user selecting nodes,
**I want to** see selected idea details in a sidebar panel,
**So that** I can access full information and take actions without leaving the graph.

**Acceptance Criteria:**

1. **Given** I select an idea node, **When** the detail panel loads, **Then** I see the idea content, classification, labels, and correlation count.

2. **Given** the detail panel is open, **When** I click "View Details", **Then** I navigate to the full idea detail page.

3. **Given** the detail panel is open, **When** I click "Bake in Studio", **Then** the bake action is triggered (same as from list view).

4. **Given** no node is selected, **When** viewing the sidebar, **Then** I see a placeholder message like "Select a node to view details".

**Tasks:** T11

---

### US-14: Graph Page Navigation

**As a** user of the Mindflare Hub,
**I want to** access the graph view from the hub navigation,
**So that** I can switch between list and graph views easily.

**Acceptance Criteria:**

1. **Given** I am on the Mindflare Hub list view, **When** I click a "Graph View" button/link, **Then** I navigate to /mindflare/graph.

2. **Given** I am on the graph view, **When** I click a "List View" button/link, **Then** I navigate back to /mindflare.

3. **Given** the sidebar navigation, **When** I view it, **Then** there is a link to the Mindflare Graph page.

**Tasks:** T12

---

### US-15: Loading and Error States

**As a** user loading the graph,
**I want to** see appropriate loading and error feedback,
**So that** I know the system is working or understand what went wrong.

**Acceptance Criteria:**

1. **Given** graph data is loading, **When** I view the page, **Then** I see a loading spinner or skeleton.

2. **Given** graph loading fails, **When** an error occurs, **Then** I see an error message with a retry button.

3. **Given** there are no ideas, **When** viewing the graph, **Then** I see an empty state message encouraging me to create ideas.

4. **Given** the graph has too many nodes (>2000), **When** loading, **Then** I see a warning suggesting I filter to reduce nodes.

**Tasks:** T13

---

## Out of Scope (Deferred to P08-F07)

The following user needs are acknowledged but deferred:

1. **Advanced Controls**: Sliders for forces, node sizes, text thresholds
2. **Cluster Visualization**: Hull overlays, community detection coloring
3. **Edge Bundling**: Bundled edges for cleaner dense graphs
4. **3D View**: Three-dimensional graph option
5. **Mobile Support**: Touch gestures, mobile-optimized layout
6. **Edit Mode**: Create/remove correlations via graph interaction
7. **Mini-map**: Overview navigation for large graphs
8. **Evidence Inspector**: "Why connected?" explanation panel

---

## Story Map

```
+----------------+------------------+------------------+------------------+
| Foundation     | Node Rendering   | Controls         | Integration      |
+----------------+------------------+------------------+------------------+
| US-01          | US-02            | US-08            | US-13            |
| View as Graph  | Node Types       | Search Filter    | Sidebar          |
+----------------+------------------+------------------+------------------+
| US-03          | US-04            | US-09            | US-14            |
| Edge Types     | Zoom/Pan         | Tag Toggle       | Navigation       |
+----------------+------------------+------------------+------------------+
| US-15          | US-05            | US-10            |                  |
| Loading/Error  | Node Selection   | Inferred Toggle  |                  |
+----------------+------------------+------------------+------------------+
|                | US-06            | US-11            |                  |
|                | Hover Highlight  | Reset View       |                  |
+----------------+------------------+------------------+------------------+
|                | US-07            | US-12            |                  |
|                | Double-Click     | Re-run Layout    |                  |
+----------------+------------------+------------------+------------------+
```
