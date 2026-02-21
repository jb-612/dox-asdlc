# P05-F14: Electron Workflow Studio - Task Breakdown

> **SUPERSEDED**: This feature has been extracted into its own epic P14 (Electron Workflow Studio).
> See `.workitems/P14-F01-*` through `.workitems/P14-F06-*` for the restructured breakdown.
> This file is retained for historical reference only.

## Progress

- Started: 2026-02-21
- Tasks Complete: 0/42
- Percentage: 0%
- Status: SUPERSEDED
- Blockers: None

---

## Phase 1: Contract Design and Shared Types (T01-T05)

Establishes all type definitions, validation schemas, and IPC channel constants before any runtime code is written. No UI, no Electron -- pure type safety foundation.

### T01: Define Workflow Data Model Types
- [ ] Estimate: 1hr
- [ ] Tests: `test/shared/workflow-types.test.ts`
- [ ] Dependencies: None
- [ ] Notes: Create `src/shared/types/workflow.ts` with WorkflowDefinition, AgentNode, AgentNodeType, AgentNodeConfig, PortSchema, Transition, TransitionCondition, HITLGateDefinition, GateOption, WorkflowVariable. All interfaces as specified in design.md Section 4.1.

### T02: Define Execution and Work Item Types
- [ ] Estimate: 1hr
- [ ] Tests: `test/shared/execution-types.test.ts`
- [ ] Dependencies: T01
- [ ] Notes: Create `src/shared/types/execution.ts` (Execution, ExecutionStatus, NodeExecutionState, ExecutionEvent, ExecutionEventType) and `src/shared/types/workitem.ts` (WorkItemType, WorkItemReference, WorkItemSource, WorkItem) and `src/shared/types/cli.ts` (CLISpawnConfig, CLISession). These depend on types from T01.

### T03: Create Zod Validation Schemas
- [ ] Estimate: 1.5hr
- [ ] Tests: `test/shared/workflow-schema.test.ts`
- [ ] Dependencies: T01, T02
- [ ] Notes: Create `src/main/schemas/workflow-schema.ts` and `src/main/schemas/execution-schema.ts`. Each Zod schema mirrors the TypeScript interfaces. Tests should cover valid workflows, invalid workflows (missing required fields, wrong types, unknown node types), and edge cases (empty nodes array, self-referencing edges, duplicate IDs).

### T04: Define IPC Channel Constants and Bridge Types
- [ ] Estimate: 1hr
- [ ] Tests: `test/shared/ipc-channels.test.ts`
- [ ] Dependencies: T01, T02
- [ ] Notes: Create `src/shared/ipc-channels.ts` with all channel constants and `src/shared/constants.ts` with node type metadata (colors, labels, icons). Test that all channel names are unique strings.

### T05: Create Shared Utility Functions
- [ ] Estimate: 1.5hr
- [ ] Tests: `test/shared/graph-utils.test.ts`, `test/renderer/utils/validation.test.ts`
- [ ] Dependencies: T01
- [ ] Notes: Create `src/renderer/utils/graph-utils.ts` (topological sort, reachability check, cycle detection, find start/end nodes) and `src/renderer/utils/validation.ts` (all 8 validation rules from design.md Section 10). Heavy test coverage -- these are pure functions critical for correctness.

---

## Phase 2: Electron Shell (T06-T11)

Minimal working Electron app with window management, IPC bridge, and navigation. All IPC handlers return mock data.

### T06: Initialize Electron Project with Vite
- [ ] Estimate: 2hr
- [ ] Tests: Manual launch verification
- [ ] Dependencies: None (can parallel with Phase 1)
- [ ] Notes: Create `package.json`, `electron-builder.yml`, `tsconfig.json` (3 variants), `vite.config.main.ts`, `vite.config.renderer.ts`, `vite.config.preload.ts`. Install all dependencies from design.md Section 2.2. Verify `npm run dev` launches Electron with a blank window. Use electron-vite or manual Vite setup for the three entry points.

### T07: Implement Main Process Entry and Window Management
- [ ] Estimate: 1.5hr
- [ ] Tests: `test/main/window-management.test.ts`
- [ ] Dependencies: T06
- [ ] Notes: Create `src/main/index.ts` with BrowserWindow creation, frameless window config, window state persistence (position, size) via electron-store or JSON file. Handle app lifecycle events (ready, window-all-closed, activate). Configure webPreferences: contextIsolation true, nodeIntegration false, preload script path.

### T08: Implement Preload Script and IPC Bridge
- [ ] Estimate: 1.5hr
- [ ] Tests: `test/main/ipc-bridge.test.ts`
- [ ] Dependencies: T04, T07
- [ ] Notes: Create `src/preload/preload.ts` exposing `window.electronAPI` via contextBridge as specified in design.md Section 3.2. Create `src/renderer/api/electron-bridge.ts` as a typed wrapper with runtime checks for when running outside Electron (dev mode fallback to mocks).

### T09: Implement Stub IPC Handlers (Mock Data)
- [ ] Estimate: 1.5hr
- [ ] Tests: `test/main/ipc-handlers-stub.test.ts`
- [ ] Dependencies: T03, T08
- [ ] Notes: Create `src/main/ipc/index.ts` registering all handlers. Create stub implementations in each handler file that return mock data (e.g., workflow:list returns 3 sample workflows, workitem:list returns sample PRDs). This enables renderer development before real backends exist.

### T10: Configure Renderer with React, Tailwind, and Routing
- [ ] Estimate: 1.5hr
- [ ] Tests: Manual render verification
- [ ] Dependencies: T06
- [ ] Notes: Create `src/renderer/index.html`, `src/renderer/main.tsx`, `src/renderer/App.tsx`, `src/renderer/index.css`. Configure Tailwind with the same design tokens as the web HITL UI (copy tailwind.config.js color palette). Set up React Router with routes for Designer, Templates, Execute, CLI, Settings. Each route renders a placeholder page.

### T11: Build AppShell Layout (TitleBar + Sidebar + Content)
- [ ] Estimate: 1.5hr
- [ ] Tests: `test/renderer/components/layout/AppShell.test.tsx`
- [ ] Dependencies: T10
- [ ] Notes: Create `src/renderer/components/layout/AppShell.tsx`, `TitleBar.tsx` (frameless window controls using -webkit-app-region: drag), `Sidebar.tsx` (navigation items with active state, recent workflows section). Create `src/renderer/components/common/` with Badge, Button, Card, EmptyState, Spinner, SplitPane, SearchInput. Follow existing P05-F01 component patterns.

---

## Phase 3: Canvas UI - Workflow Designer (T12-T21)

The core visual workflow editor using React Flow. This is the largest phase.

### T12: Set Up React Flow Canvas with Custom Theme
- [ ] Estimate: 1.5hr
- [ ] Tests: `test/renderer/components/designer/ReactFlowCanvas.test.tsx`
- [ ] Dependencies: T11
- [ ] Notes: Create `src/renderer/components/designer/ReactFlowCanvas.tsx` with ReactFlow provider, dark theme background, MiniMap, Controls, and grid. Configure node and edge defaults. Wire up onNodesChange, onEdgesChange, onConnect callbacks to the workflow store.

### T13: Create Custom Agent Node Component
- [ ] Estimate: 1.5hr
- [ ] Tests: `test/renderer/components/designer/AgentNodeComponent.test.tsx`
- [ ] Dependencies: T12
- [ ] Notes: Create `src/renderer/components/designer/AgentNodeComponent.tsx` as a custom React Flow node. Visual design: colored header bar by agent type, icon, label, connection handles (input top, output bottom). Show config summary (model, max_turns). Create `src/renderer/utils/constants.ts` with node type colors and icons.

### T14: Create Custom Gate Node and Control Flow Nodes
- [ ] Estimate: 1.5hr
- [ ] Tests: `test/renderer/components/designer/GateNodeComponent.test.tsx`
- [ ] Dependencies: T12
- [ ] Notes: Create `src/renderer/components/designer/GateNodeComponent.tsx` with diamond/hexagon shape, gate type badge, visual distinction from agent nodes (e.g., dashed border, warning color). Create nodes for Conditional Branch (diamond with multiple outputs), Parallel Fork/Join.

### T15: Build Agent Node Palette with Drag-and-Drop
- [ ] Estimate: 1.5hr
- [ ] Tests: `test/renderer/components/designer/AgentNodePalette.test.tsx`
- [ ] Dependencies: T13, T14
- [ ] Notes: Create `src/renderer/components/designer/AgentNodePalette.tsx` with categorized sections (Agent Nodes, Control Flow). Each draggable item uses React DnD or React Flow's built-in drag. On drop, create a new node at the canvas position with default config. Include search/filter on the palette.

### T16: Create Custom Edge Component with Conditions
- [ ] Estimate: 1hr
- [ ] Tests: `test/renderer/components/designer/TransitionEdge.test.tsx`
- [ ] Dependencies: T12
- [ ] Notes: Create `src/renderer/components/designer/TransitionEdge.tsx` as a custom React Flow edge. Show condition label on the edge. Use different line styles for condition types (solid=always, dashed=conditional). Animate edge on hover to show direction.

### T17: Implement Workflow Store (Zustand)
- [ ] Estimate: 1.5hr
- [ ] Tests: `test/renderer/stores/workflowStore.test.ts`
- [ ] Dependencies: T01, T10
- [ ] Notes: Create `src/renderer/stores/workflowStore.ts` managing: current WorkflowDefinition, selected node/edge IDs, undo/redo history (use Zustand temporal middleware or manual implementation). Actions: addNode, removeNode, updateNode, addEdge, removeEdge, updateEdge, selectElement, undo, redo, setWorkflow, clearWorkflow.

### T18: Build Properties Panel (Node, Edge, Gate, Workflow)
- [ ] Estimate: 2hr
- [ ] Tests: `test/renderer/components/designer/PropertiesPanel.test.tsx`
- [ ] Dependencies: T13, T14, T17
- [ ] Notes: Create `src/renderer/components/designer/PropertiesPanel.tsx` that renders the appropriate form based on selection. Create NodePropertiesForm.tsx (model selector, max turns, tools checkboxes, system prompt textarea, port editors), EdgePropertiesForm.tsx (condition type dropdown, expression input), GatePropertiesForm.tsx (gate type, prompt template, options list with add/remove), WorkflowPropertiesForm.tsx (name, description, tags, variables). All forms dispatch to workflowStore.

### T19: Implement Workflow Save/Load via IPC
- [ ] Estimate: 1.5hr
- [ ] Tests: `test/main/workflow-file-service.test.ts`, `test/renderer/hooks/useWorkflowFile.test.ts`
- [ ] Dependencies: T03, T09, T17
- [ ] Notes: Create `src/main/services/workflow-file-service.ts` with save (Zod validate, write JSON), load (read, Zod validate, return), list (scan directory), delete operations. Create `src/renderer/hooks/useWorkflowFile.ts` hook wrapping IPC calls. Replace stub handlers with real filesystem handlers. Implement auto-save (every 60s to temp file).

### T20: Build Designer Toolbar
- [ ] Estimate: 1hr
- [ ] Tests: `test/renderer/components/designer/Toolbar.test.tsx`
- [ ] Dependencies: T17, T19
- [ ] Notes: Create `src/renderer/components/designer/Toolbar.tsx` with: workflow name input (inline edit), Save button, Load button (opens file dialog via IPC), Undo/Redo buttons (connected to workflowStore), zoom controls, Validate button. Wire keyboard shortcuts: Ctrl+S (save), Ctrl+Z (undo), Ctrl+Shift+Z (redo), Ctrl+O (open).

### T21: Implement Validation Overlay
- [ ] Estimate: 1.5hr
- [ ] Tests: `test/renderer/components/designer/ValidationOverlay.test.tsx`
- [ ] Dependencies: T05, T12, T17
- [ ] Notes: Create `src/renderer/components/designer/ValidationOverlay.tsx` that, when triggered, runs all validation rules from T05 against the current workflow. Highlights invalid nodes/edges with red borders. Shows a validation summary panel with clickable errors that pan/zoom to the affected element. Disable "Start Execution" button if errors exist.

---

## Phase 4: Walkthrough UI - Execution (T22-T31)

Visual step-by-step execution with mock execution engine, HITL gate pauses, and event logging.

### T22: Implement Mock Execution Engine
- [ ] Estimate: 2hr
- [ ] Tests: `test/main/execution-engine.test.ts`
- [ ] Dependencies: T02, T05
- [ ] Notes: Create `src/main/services/execution-engine.ts` that traverses the workflow graph. Uses topological sort from T05. For each node: emit "node_started", wait 1-3 seconds (simulating work), emit "node_completed". Pause at HITL gates and wait for decision via IPC. Handle parallel forks (run branches concurrently). Track full ExecutionState. This is the mock engine -- real CLI spawning comes in Phase 5.

### T23: Build Execution Store (Zustand)
- [ ] Estimate: 1hr
- [ ] Tests: `test/renderer/stores/executionStore.test.ts`
- [ ] Dependencies: T02, T10
- [ ] Notes: Create `src/renderer/stores/executionStore.ts` managing: active Execution state, node states map, event log, execution controls. Actions: startExecution, pauseExecution, resumeExecution, abortExecution, updateNodeState, addEvent, setGateDecision. Subscribe to IPC events from main process.

### T24: Build Execution Canvas (Read-Only React Flow)
- [ ] Estimate: 1.5hr
- [ ] Tests: `test/renderer/components/execution/ExecutionCanvas.test.tsx`
- [ ] Dependencies: T12, T13, T14, T23
- [ ] Notes: Create `src/renderer/components/execution/ExecutionCanvas.tsx` extending the designer canvas in read-only mode. Add `NodeStatusOverlay.tsx` that renders status icons (spinner for running, checkmark for complete, X for failed, hourglass for gate) on each node. Create `AnimatedEdge.tsx` that shows flow direction animation. Highlight current node with pulsing border.

### T25: Build Execution Controls
- [ ] Estimate: 1hr
- [ ] Tests: `test/renderer/components/execution/ExecutionControls.test.tsx`
- [ ] Dependencies: T23
- [ ] Notes: Create `src/renderer/components/execution/ExecutionControls.tsx` with Play/Pause toggle, Step button, Abort button. Create `src/renderer/components/execution/ExecutionHeader.tsx` showing workflow name, work item badge, status indicator, elapsed time. All controls dispatch to executionStore and send IPC commands.

### T26: Build Execution Event Log Panel
- [ ] Estimate: 1hr
- [ ] Tests: `test/renderer/components/execution/ExecutionEventList.test.tsx`
- [ ] Dependencies: T23
- [ ] Notes: Create `src/renderer/components/execution/ExecutionEventList.tsx` showing timestamped events with type icons. Support filtering by event type. Auto-scroll to latest event with pause-on-hover. Virtual scrolling for large event lists.

### T27: Build Gate Decision Form
- [ ] Estimate: 1.5hr
- [ ] Tests: `test/renderer/components/execution/GateDecisionForm.test.tsx`
- [ ] Dependencies: T23, T24
- [ ] Notes: Create `src/renderer/components/execution/GateDecisionForm.tsx`. When execution pauses at a HITL gate, show the gate prompt, context, and option buttons. Submitting sends decision via IPC to the execution engine. Show countdown timer if gate has a timeout. Visually prominent -- this is the primary human interaction point during execution.

### T28: Build Execution Details Panel with Tabs
- [ ] Estimate: 1.5hr
- [ ] Tests: `test/renderer/components/execution/ExecutionDetailsPanel.test.tsx`
- [ ] Dependencies: T24, T25, T26, T27
- [ ] Notes: Create `src/renderer/components/execution/ExecutionDetailsPanel.tsx` with tabs: "Current Node" (inputs, outputs, status), "Event Log" (from T26), "Variables" (runtime variable table), "Gate Decision" (from T27, visible only when paused at gate). The Current Node tab shows streaming output when a CLI session is active.

### T29: Build Work Item Picker Dialog
- [ ] Estimate: 1.5hr
- [ ] Tests: `test/renderer/components/workitems/WorkItemPickerDialog.test.tsx`
- [ ] Dependencies: T09, T11
- [ ] Notes: Create `src/renderer/components/workitems/WorkItemPickerDialog.tsx` as a modal with tabs: PRDs (from .workitems/ via IPC), GitHub Issues (via IPC calling `gh issue list`), Ideas, Manual Input. Each tab has search and list. Create WorkItemCard.tsx for consistent display. Selected work item returned to caller.

### T30: Build Template Manager Page
- [ ] Estimate: 1.5hr
- [ ] Tests: `test/renderer/components/templates/TemplateList.test.tsx`
- [ ] Dependencies: T19
- [ ] Notes: Create `src/renderer/pages/TemplateManagerPage.tsx` with `TemplateList.tsx` (grid of template cards), `TemplatePreview.tsx` (read-only React Flow canvas), `TemplateCard.tsx` (name, description, node count, miniature graph). Built-in templates loaded from `templates/` directory. "Use Template" loads into designer. "Save as Template" from designer saves current workflow.

### T31: Build Execution Page (Workflow + Work Item Selection)
- [ ] Estimate: 1hr
- [ ] Tests: `test/renderer/pages/ExecutionPage.test.tsx`
- [ ] Dependencies: T19, T21, T29
- [ ] Notes: Create `src/renderer/pages/ExecutionPage.tsx` as the launch page for executions. Shows: workflow selector (dropdown of recent/saved workflows), work item selector (opens picker dialog from T29), variable overrides form (if workflow defines variables), "Start Execution" button (disabled if validation fails). On start, navigates to ExecutionWalkthroughPage.

---

## Phase 5: Backend Wiring (T32-T38)

Replace mock implementations with real backends: CLI spawner, Redis events, filesystem work items.

### T32: Implement CLI Spawner with node-pty
- [ ] Estimate: 2hr
- [ ] Tests: `test/main/cli-spawner.test.ts`
- [ ] Dependencies: T09
- [ ] Notes: Create `src/main/services/cli-spawner.ts` using node-pty to spawn Claude CLI sessions. Manage session lifecycle: spawn (with CLAUDE_INSTANCE_ID env), pipe stdout/stderr to renderer via IPC events, write stdin from IPC, kill (SIGTERM then SIGKILL after 5s). Track sessions in Map. On app exit, kill all sessions. Handle platform-specific pty behavior.

### T33: Build CLI Manager Page with Terminal Panel
- [ ] Estimate: 2hr
- [ ] Tests: `test/renderer/components/cli/CLISessionList.test.tsx`, `test/renderer/components/cli/TerminalPanel.test.tsx`
- [ ] Dependencies: T32
- [ ] Notes: Create `src/renderer/pages/CLIManagerPage.tsx` with session list and embedded terminal. Create `CLISessionList.tsx` showing active/exited sessions with status badges. Create `TerminalPanel.tsx` that renders terminal output (use xterm.js or simple pre-formatted text with ANSI color parsing). Create `SpawnDialog.tsx` for manual session creation. Create `src/renderer/stores/cliStore.ts`.

### T34: Build CLI Store (Zustand)
- [ ] Estimate: 1hr
- [ ] Tests: `test/renderer/stores/cliStore.test.ts`
- [ ] Dependencies: T02
- [ ] Notes: Create `src/renderer/stores/cliStore.ts` managing: active sessions map, terminal output buffers (ring buffer, last 10000 lines per session), selected session ID. Actions: addSession, removeSession, updateStatus, appendOutput, selectSession. Subscribe to IPC events for CLI data and exit.

### T35: Implement Work Item Service (Filesystem + GitHub)
- [ ] Estimate: 1.5hr
- [ ] Tests: `test/main/workitem-service.test.ts`
- [ ] Dependencies: T02, T09
- [ ] Notes: Create `src/main/services/workitem-service.ts`. For PRDs: scan .workitems/ directories, parse design.md files for title and description. For GitHub issues: shell out to `gh issue list --json number,title,body,labels` and parse. For ideas: scan ideation files if present. Replace stub IPC handlers with real implementations.

### T36: Implement Redis Event Subscription
- [ ] Estimate: 1.5hr
- [ ] Tests: `test/main/redis-client.test.ts`
- [ ] Dependencies: T09
- [ ] Notes: Create `src/main/services/redis-client.ts` using ioredis. Subscribe to aSDLC event streams (matching contracts/v1.0.0/events.json schema). Forward events to renderer via IPC. Handle connection, reconnection, and graceful disconnection. Make Redis URL configurable via settings.

### T37: Wire Execution Engine to Real CLI Spawner
- [ ] Estimate: 2hr
- [ ] Tests: `test/main/execution-engine-integration.test.ts`
- [ ] Dependencies: T22, T32, T36
- [ ] Notes: Extend the execution engine from T22 to spawn real CLI sessions for agent nodes. For each agent node: determine context_id and agent_role from node config, spawn CLI via T32, pass work item context as initial prompt, monitor for completion via Redis events from T36. Handle node failure (CLI exit with non-zero code), timeouts, and cleanup on abort.

### T38: Build Settings Page
- [ ] Estimate: 1hr
- [ ] Tests: `test/renderer/pages/SettingsPage.test.tsx`
- [ ] Dependencies: T11
- [ ] Notes: Create `src/renderer/pages/SettingsPage.tsx` with form fields for: workflow directory path, template directory path, auto-save interval (seconds), CLI default working directory, Redis connection URL. Persist to `~/.asdlc/electron-config.json`. Create settings service in main process. Settings take effect immediately.

---

## Phase 6: Built-in Templates and Polish (T39-T42)

Final deliverables: built-in templates, testing, and packaging.

### T39: Create Built-in Workflow Templates
- [ ] Estimate: 1.5hr
- [ ] Tests: `test/shared/templates.test.ts`
- [ ] Dependencies: T03
- [ ] Notes: Create JSON files in `templates/` directory: `11-step-default.json` (full aSDLC workflow with all 11 steps and HITL gates), `quick-fix.json` (4-node minimal workflow), `design-review.json` (iterative design loop), `tdd-cycle.json` (test-code-refactor cycle). Each must validate against the Zod schema. Include reasonable node positions for visual clarity.

### T40: Implement UI Store and Keyboard Shortcuts
- [ ] Estimate: 1hr
- [ ] Tests: `test/renderer/stores/uiStore.test.ts`
- [ ] Dependencies: T11
- [ ] Notes: Create `src/renderer/stores/uiStore.ts` managing: sidebar collapsed state, active panel, selected tab, dialog visibility states. Implement global keyboard shortcut handler: Ctrl+S (save), Ctrl+Z (undo), Ctrl+Shift+Z (redo), Ctrl+O (open), Ctrl+N (new workflow), Delete (remove selected), Escape (deselect).

### T41: Integration Testing and Bug Fixes
- [ ] Estimate: 2hr
- [ ] Tests: End-to-end test scripts
- [ ] Dependencies: T31, T33, T38, T39
- [ ] Notes: Run through all user story scenarios manually and with Playwright Electron tests. Fix integration issues: IPC serialization edge cases, React Flow render timing, store synchronization between panels, file dialog behavior across platforms. Verify all mock-mode flows work without Redis/CLI.

### T42: Electron Build Configuration and Packaging
- [ ] Estimate: 1.5hr
- [ ] Tests: Manual build verification
- [ ] Dependencies: T41
- [ ] Notes: Configure `electron-builder.yml` for the host platform (Linux AppImage/deb initially). Set up app icons in `resources/`. Configure `package.json` build scripts. Verify `npm run build` produces a working distributable. Document installation steps. Ensure node-pty native module is properly rebuilt for the Electron version.

---

## Task Dependency Graph

```
Phase 1 (Types):
  T01 ─────────────────────────────────────────┐
  T01 -> T02                                    │
  T01, T02 -> T03                               │
  T01, T02 -> T04                               │
  T01 -> T05                                    │
                                                │
Phase 2 (Shell):                                │
  T06 (parallel with Phase 1) ──┐               │
  T06 -> T07                    │               │
  T04, T07 -> T08               │               │
  T03, T08 -> T09               │               │
  T06 -> T10                    │               │
  T10 -> T11                    │               │
                                │               │
Phase 3 (Canvas):               │               │
  T11 -> T12                    │               │
  T12 -> T13                    │               │
  T12 -> T14                    │               │
  T13, T14 -> T15               │               │
  T12 -> T16                    │               │
  T01, T10 -> T17               │               │
  T13, T14, T17 -> T18          │               │
  T03, T09, T17 -> T19          │               │
  T17, T19 -> T20               │               │
  T05, T12, T17 -> T21          │               │
                                │               │
Phase 4 (Execution):            │               │
  T02, T05 -> T22               │               │
  T02, T10 -> T23               │               │
  T12, T13, T14, T23 -> T24     │               │
  T23 -> T25                    │               │
  T23 -> T26                    │               │
  T23, T24 -> T27               │               │
  T24, T25, T26, T27 -> T28     │               │
  T09, T11 -> T29               │               │
  T19 -> T30                    │               │
  T19, T21, T29 -> T31          │               │
                                │               │
Phase 5 (Wiring):               │               │
  T09 -> T32                    │               │
  T32 -> T33                    │               │
  T02 -> T34                    │               │
  T02, T09 -> T35               │               │
  T09 -> T36                    │               │
  T22, T32, T36 -> T37          │               │
  T11 -> T38                    │               │
                                │               │
Phase 6 (Polish):               │               │
  T03 -> T39                    │               │
  T11 -> T40                    │               │
  T31, T33, T38, T39 -> T41     │               │
  T41 -> T42                    │               │
```

## Estimates Summary

| Phase | Tasks | Total Estimate |
|-------|-------|----------------|
| Phase 1: Contract Design | T01-T05 | 6 hours |
| Phase 2: Electron Shell | T06-T11 | 9.5 hours |
| Phase 3: Canvas UI | T12-T21 | 14.5 hours |
| Phase 4: Walkthrough UI | T22-T31 | 13.5 hours |
| Phase 5: Backend Wiring | T32-T38 | 11 hours |
| Phase 6: Polish | T39-T42 | 6 hours |
| **Total** | **42 tasks** | **60.5 hours** |

## Task-to-Story Mapping

| User Story | Tasks |
|------------|-------|
| US-01: Electron Shell and Navigation | T06, T07, T08, T09, T10, T11 |
| US-02: Workflow Designer Canvas | T12, T13, T14, T15, T16, T17, T18 |
| US-03: Save and Load Workflows | T19, T20 |
| US-04: HITL Gate Configuration | T14, T18 (gate properties) |
| US-05: Workflow Templates | T30, T39 |
| US-06: Work Item Integration | T29, T35 |
| US-07: Execution Walkthrough | T22, T23, T24, T25, T26, T27, T28, T31 |
| US-08: CLI Session Spawner | T32, T33, T34 |
| US-09: Workflow Validation | T05, T21 |
| US-10: Settings and Preferences | T38, T40 |

## Verification Checklist

After all tasks complete:

- [ ] Electron app launches with frameless window and sidebar navigation
- [ ] Workflow designer canvas supports drag-and-drop node creation
- [ ] Agent nodes display with correct colors, icons, and connection handles
- [ ] HITL gate nodes are visually distinct and configurable
- [ ] Edges can be created between nodes with condition configuration
- [ ] Properties panel updates when selecting nodes, edges, gates, or nothing
- [ ] Workflows save to and load from JSON files on disk
- [ ] Workflow validation runs all 8 rules and highlights errors
- [ ] Built-in templates load and display correctly
- [ ] Work Item Picker browses .workitems/ and GitHub issues
- [ ] Execution walkthrough shows progress with status overlays
- [ ] HITL gate pauses execution and shows decision form
- [ ] Event log shows timestamped execution events
- [ ] CLI sessions spawn, display output, accept input, and can be killed
- [ ] Settings page persists configuration
- [ ] All IPC calls work through the typed bridge
- [ ] Undo/redo works on canvas operations
- [ ] App cleans up CLI sessions on exit
- [ ] Mock mode works without Redis or real CLI
