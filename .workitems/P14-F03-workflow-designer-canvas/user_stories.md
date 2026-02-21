# P14-F03: Workflow Designer Canvas - User Stories

**Version:** 1.0
**Date:** 2026-02-21
**Status:** COMPLETE

---

## US-02: Workflow Designer Canvas

**As a** workflow designer
**I want** a visual canvas where I can drag agent nodes, connect them with edges, and configure properties
**So that** I can design custom agent workflows without writing code

### Acceptance Criteria

1. Node palette lists all agent types and control flow nodes (HITL Gate, Conditional Branch, Parallel Fork, Join)
2. Drag a node from palette onto canvas to create it
3. Draw edges between output and input ports by clicking and dragging
4. Selecting a node opens a properties panel with editable configuration
5. Selecting an edge shows condition configuration
6. Canvas has minimap, zoom controls, and grid background
7. Select and delete nodes and edges
8. Undo and redo canvas operations (50+ levels)

---

## US-03: Save and Load Workflows

**As a** workflow designer
**I want** to save my workflow designs to disk and load them later
**So that** I can iterate on designs across sessions and share them with others

### Acceptance Criteria

1. Save serializes current workflow to JSON via file save dialog
2. Load opens file dialog to select and load workflow JSON
3. JSON includes all nodes, edges, gates, positions, and configuration
4. JSON validated against Zod schema on load; invalid files show error
5. Recent Workflows section in sidebar shows last 10 loaded/saved workflows
6. Workflow file includes version field for forward compatibility
7. Auto-save to temp location every 60 seconds

---

## US-04: HITL Gate Configuration

**As a** workflow designer
**I want** to place HITL gate nodes before or after agent nodes
**So that** I can define where human approval is required during execution

### Acceptance Criteria

1. Drag HITL Gate node from palette and connect between agent nodes
2. Gate properties panel: gate type (mandatory/advisory), prompt template, timeout, response options
3. Each gate option has label, value, and action (proceed, abort, retry, skip)
4. Gate is visually distinct from agent nodes (different color/shape)
5. Validation warns if gate has no incoming or outgoing edges
6. Prompt template supports `{{variable_name}}` syntax

---

## US-09: Workflow Validation

**As a** workflow designer
**I want** the designer to validate my workflow and highlight errors
**So that** I do not try to execute an invalid workflow

### Acceptance Criteria

1. Clicking Validate runs all validation rules and shows results
2. Errors shown as red highlights on affected nodes/edges
3. Validation summary panel lists all errors with descriptions
4. Clicking an error pans/zooms to the affected element
5. Rules: connectivity, no orphans, gate attachment, required ports, cycle detection, start/end nodes
6. Start Execution button disabled if validation fails
