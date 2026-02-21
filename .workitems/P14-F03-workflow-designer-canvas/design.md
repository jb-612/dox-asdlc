# P14-F03: Workflow Designer Canvas

**Version:** 1.0
**Date:** 2026-02-21
**Status:** COMPLETE

## Overview

The core visual workflow editor built on React Flow. Provides a drag-and-drop canvas for designing agent workflows with custom node components (agent nodes, gate nodes), conditional edges, a node palette, properties panel, Zustand-based workflow store with undo/redo, save/load via IPC, designer toolbar, and validation overlay with error highlighting.

## Architecture

```
src/renderer/
  components/designer/
    ReactFlowCanvas.tsx        -- React Flow provider, dark theme, minimap, controls
    AgentNodeComponent.tsx     -- Custom node: colored header, icon, handles
    GateNodeComponent.tsx      -- Custom node: diamond/hexagon, gate type badge
    AgentNodePalette.tsx       -- Draggable node list with categories
    TransitionEdge.tsx         -- Custom edge with condition labels, line styles
    PropertiesPanel.tsx        -- Context-dependent form (node/edge/gate/workflow)
    NodePropertiesForm.tsx     -- Model, tools, system prompt, ports
    EdgePropertiesForm.tsx     -- Condition type, expression
    GatePropertiesForm.tsx     -- Gate type, prompt template, options
    WorkflowPropertiesForm.tsx -- Name, description, tags, variables
    Toolbar.tsx                -- Save, load, undo/redo, zoom, validate
    ValidationOverlay.tsx      -- Error highlighting, summary panel
  stores/
    workflowStore.ts           -- Zustand store with undo/redo
  hooks/
    useWorkflowFile.ts         -- Save/load via IPC
    useUndoRedo.ts             -- Undo/redo for canvas
  utils/
    constants.ts               -- Node type colors and icons

src/main/services/
  workflow-file-service.ts     -- Filesystem CRUD for workflow JSON
```

## Key Interfaces

### workflowStore
Zustand store managing: current WorkflowDefinition, selected node/edge IDs, undo/redo history (50+ levels). Actions: addNode, removeNode, updateNode, addEdge, removeEdge, updateEdge, selectElement, undo, redo, setWorkflow, clearWorkflow.

### workflow-file-service
Main process service: save (Zod validate + write JSON), load (read + validate + migrate), list (scan directory), delete. Default path: ~/.asdlc/workflows/. Auto-save every 60s to temp file.

### Validation Rules
8 rules: connectivity, no orphans, gate attachment, required ports, no cycles without exit, type compatibility, at least one start node, at least one end node.

## Dependencies

- **P14-F01** (types, schemas, graph utilities, validation rules)
- **P14-F02** (AppShell, IPC bridge, stub handlers, common components)

## Status

**COMPLETE** -- All 10 tasks (T12-T21) implemented in earlier phases.
