# P05-F14: Electron Workflow Studio - Technical Design

**Version:** 1.0
**Date:** 2026-02-21
**Status:** Draft

## 1. Overview

Build an Electron desktop application that provides a visual workflow builder for agentic SDLC workflows. Users can design custom agent workflows by dragging and dropping agent nodes onto a canvas, connecting them with conditional transitions, defining HITL gates, and then executing those workflows against real work items (PRDs, issues, ideas). The Electron app can spawn and manage Claude Code CLI sessions from its main process.

### 1.1 Goals

1. Provide a drag-and-drop visual workflow designer using React Flow
2. Support saving and loading workflow definitions as JSON files to the local filesystem
3. Enable step-by-step execution walkthrough with real-time canvas visualization
4. Integrate with work items (PRDs, GitHub issues, ideas) as execution inputs
5. Spawn and manage Claude Code CLI sessions from the Electron main process
6. Share React component library with existing web HITL UI where practical

### 1.2 Non-Goals

- Replacing the existing web HITL UI for monitoring and gate approvals
- Building a web-based version of the workflow designer (Electron-only)
- Implementing a custom agent runtime (uses existing aSDLC orchestrator)
- Supporting collaborative multi-user editing (single-user desktop tool)
- Auto-updating or app store distribution (manual install only for now)

### 1.3 Relationship to Existing UI

| Concern | Web HITL UI (P05-F01/F06) | Electron Workflow Studio (P05-F14) |
|---------|---------------------------|-------------------------------------|
| Gate approvals | Primary | Can link to web UI |
| Agent monitoring | Primary | Execution progress only |
| Workflow design | Not supported | Primary |
| CLI spawning | Not supported | Primary |
| File system access | Not available | Full access |
| Deployment | Docker/K8s | Desktop install |

## 2. Dependencies

### 2.1 Internal Dependencies

| Dependency | Status | Description |
|------------|--------|-------------|
| P05-F01-hitl-ui | Complete | Shared React component patterns, design system, TypeScript types |
| P02-F01-redis-streams | Complete | Event stream for execution monitoring |
| P01-F04-cli-coordination-redis | Complete | Redis coordination for CLI session management |
| contracts/v1.0.0/events.json | Stable | Event schema for workflow execution tracking |
| contracts/v1.0.0/hitl_api.json | Stable | Gate and session types |

### 2.2 External Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| electron | ^30.0 | Desktop shell |
| electron-builder | ^24.0 | Packaging and distribution |
| @electron/remote | ^2.1 | Controlled renderer-to-main communication |
| reactflow | ^11.10 | Node-based canvas editor |
| react | ^18.2 | UI framework (shared with web HITL UI) |
| react-dom | ^18.2 | React rendering |
| zustand | ^4.4 | State management (shared pattern) |
| @tanstack/react-query | ^5.8 | Server state (shared pattern) |
| tailwindcss | ^3.3 | Styling (shared design system) |
| @headlessui/react | ^1.7 | Accessible UI primitives |
| @heroicons/react | ^2.0 | Icons |
| node-pty | ^1.0 | Terminal emulation for CLI spawning |
| zod | ^3.22 | Schema validation for workflow JSON |
| uuid | ^9.0 | Unique ID generation |
| chokidar | ^3.5 | File system watching |

### 2.3 Shared Code Strategy

Rather than creating a separate npm package, the Electron app will import shared types and potentially some components from the web HITL UI via relative path aliases or a build-time copy step.

**Shared from `docker/hitl-ui/src/`:**
- `api/types.ts` -- TypeScript type definitions (GateRequest, AgentRun, etc.)
- Design system tokens (colors, spacing) via Tailwind config
- Common component patterns (Badge, Card, Button, Spinner, EmptyState)

**Not shared (Electron-specific):**
- Electron main process code
- IPC bridge layer
- Node.js filesystem and process APIs
- React Flow canvas components
- CLI spawner and terminal emulation

## 3. Architecture

### 3.1 Electron Process Model

```
+---------------------------------------------------------------+
|  Electron Main Process (Node.js)                               |
|                                                                |
|  +------------------+  +------------------+  +---------------+ |
|  | WorkflowFileIO   |  | CLISpawner       |  | RedisClient   | |
|  | - save/load JSON |  | - spawn claude   |  | - subscribe   | |
|  | - watch dir      |  | - manage pty     |  | - events      | |
|  | - recent files   |  | - kill sessions  |  | - presence    | |
|  +------------------+  +------------------+  +---------------+ |
|                                                                |
|  +------------------+  +------------------+                    |
|  | WorkItemLoader   |  | IPCHandlers      |                   |
|  | - parse .work    |  | - register all   |                   |
|  |   items/         |  |   IPC channels   |                   |
|  | - parse GitHub   |  | - validate args  |                   |
|  | - parse markdown |  | - error handling |                   |
|  +------------------+  +------------------+                    |
|                                                                |
+--------------------------+------------------------------------+
                           | IPC (contextBridge)
+--------------------------+------------------------------------+
|  Electron Renderer Process (Chromium)                          |
|                                                                |
|  +----------------------------------------------------------+ |
|  | React Application                                         | |
|  |                                                           | |
|  |  App                                                      | |
|  |  +-- WorkflowDesigner (React Flow canvas)                | |
|  |  |   +-- AgentNodePalette                                | |
|  |  |   +-- CanvasArea (nodes, edges, minimap)              | |
|  |  |   +-- PropertiesPanel (selected node config)          | |
|  |  |   +-- GateConfigPanel                                 | |
|  |  |                                                       | |
|  |  +-- ExecutionWalkthrough                                | |
|  |  |   +-- ExecutionCanvas (read-only canvas + progress)   | |
|  |  |   +-- ExecutionControls (play, pause, step)           | |
|  |  |   +-- NodeStatePanel (current node details)           | |
|  |  |   +-- ExecutionLog                                    | |
|  |  |                                                       | |
|  |  +-- WorkItemPicker                                      | |
|  |  |   +-- PRDList                                         | |
|  |  |   +-- IssueList                                       | |
|  |  |   +-- IdeaList                                        | |
|  |  |                                                       | |
|  |  +-- TemplateManager                                     | |
|  |  |   +-- TemplateList                                    | |
|  |  |   +-- TemplatePreview                                 | |
|  |  |                                                       | |
|  |  +-- CLIManager                                          | |
|  |      +-- SessionList                                     | |
|  |      +-- TerminalPanel (embedded terminal)               | |
|  +----------------------------------------------------------+ |
+--------------------------+------------------------------------+
```

### 3.2 IPC Bridge Design

All communication between main and renderer processes goes through a typed IPC bridge exposed via `contextBridge`.

```typescript
// src/shared/ipc-channels.ts
export const IPC_CHANNELS = {
  // Workflow file operations
  WORKFLOW_SAVE: 'workflow:save',
  WORKFLOW_LOAD: 'workflow:load',
  WORKFLOW_LIST: 'workflow:list',
  WORKFLOW_DELETE: 'workflow:delete',
  WORKFLOW_EXPORT: 'workflow:export',
  WORKFLOW_IMPORT: 'workflow:import',

  // Work item operations
  WORKITEM_LIST: 'workitem:list',
  WORKITEM_GET: 'workitem:get',
  WORKITEM_PARSE_PRD: 'workitem:parse-prd',

  // CLI spawner operations
  CLI_SPAWN: 'cli:spawn',
  CLI_KILL: 'cli:kill',
  CLI_LIST: 'cli:list',
  CLI_WRITE: 'cli:write',
  CLI_ON_DATA: 'cli:on-data',
  CLI_ON_EXIT: 'cli:on-exit',

  // Execution operations
  EXECUTION_START: 'execution:start',
  EXECUTION_PAUSE: 'execution:pause',
  EXECUTION_RESUME: 'execution:resume',
  EXECUTION_ABORT: 'execution:abort',
  EXECUTION_STATUS: 'execution:status',
  EXECUTION_ON_EVENT: 'execution:on-event',

  // Redis event subscription
  EVENTS_SUBSCRIBE: 'events:subscribe',
  EVENTS_UNSUBSCRIBE: 'events:unsubscribe',
  EVENTS_ON_MESSAGE: 'events:on-message',

  // System
  APP_GET_PATH: 'app:get-path',
  DIALOG_OPEN_FILE: 'dialog:open-file',
  DIALOG_SAVE_FILE: 'dialog:save-file',
} as const;
```

```typescript
// src/preload/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Workflow
  workflow: {
    save: (workflow: WorkflowDefinition) =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKFLOW_SAVE, workflow),
    load: (filePath: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKFLOW_LOAD, filePath),
    list: () =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKFLOW_LIST),
    delete: (filePath: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKFLOW_DELETE, filePath),
  },

  // Work items
  workItems: {
    list: (type?: WorkItemType) =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKITEM_LIST, type),
    get: (id: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKITEM_GET, id),
  },

  // CLI
  cli: {
    spawn: (config: CLISpawnConfig) =>
      ipcRenderer.invoke(IPC_CHANNELS.CLI_SPAWN, config),
    kill: (sessionId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.CLI_KILL, sessionId),
    list: () =>
      ipcRenderer.invoke(IPC_CHANNELS.CLI_LIST),
    write: (sessionId: string, data: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.CLI_WRITE, sessionId, data),
    onData: (callback: (sessionId: string, data: string) => void) =>
      ipcRenderer.on(IPC_CHANNELS.CLI_ON_DATA, (_e, sid, data) => callback(sid, data)),
    onExit: (callback: (sessionId: string, code: number) => void) =>
      ipcRenderer.on(IPC_CHANNELS.CLI_ON_EXIT, (_e, sid, code) => callback(sid, code)),
  },

  // Execution
  execution: {
    start: (config: ExecutionConfig) =>
      ipcRenderer.invoke(IPC_CHANNELS.EXECUTION_START, config),
    pause: (executionId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.EXECUTION_PAUSE, executionId),
    resume: (executionId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.EXECUTION_RESUME, executionId),
    abort: (executionId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.EXECUTION_ABORT, executionId),
    onEvent: (callback: (event: ExecutionEvent) => void) =>
      ipcRenderer.on(IPC_CHANNELS.EXECUTION_ON_EVENT, (_e, event) => callback(event)),
  },

  // System
  system: {
    getPath: (name: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.APP_GET_PATH, name),
    openFileDialog: (options: Electron.OpenDialogOptions) =>
      ipcRenderer.invoke(IPC_CHANNELS.DIALOG_OPEN_FILE, options),
    saveFileDialog: (options: Electron.SaveDialogOptions) =>
      ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SAVE_FILE, options),
  },
});
```

### 3.3 Security Model

- **contextIsolation: true** -- Renderer cannot access Node.js directly
- **nodeIntegration: false** -- No require() in renderer
- **Typed IPC only** -- All main process access through validated IPC channels
- **Input validation** -- All IPC arguments validated with Zod schemas before processing
- **No remote module** -- No @electron/remote used; all communication through invoke/handle pattern

## 4. Data Model

### 4.1 Workflow Definition (persisted as JSON)

```typescript
// src/shared/types/workflow.ts

export interface WorkflowDefinition {
  id: string;                    // UUID
  version: string;               // Semver for schema compat
  name: string;
  description: string;
  created_by: string;
  created_at: string;            // ISO 8601
  updated_at: string;
  tags: string[];
  nodes: AgentNode[];
  edges: Transition[];
  gates: HITLGateDefinition[];
  variables: WorkflowVariable[]; // User-defined variables
}

export interface AgentNode {
  id: string;                    // UUID
  type: AgentNodeType;
  label: string;                 // User-facing name
  position: { x: number; y: number }; // Canvas position
  config: AgentNodeConfig;
  inputs: PortSchema[];          // Expected input ports
  outputs: PortSchema[];         // Output ports
}

export type AgentNodeType =
  | 'planner'
  | 'backend'
  | 'frontend'
  | 'reviewer'
  | 'tester'
  | 'orchestrator'
  | 'devops'
  | 'discovery'
  | 'designer'
  | 'custom';

export interface AgentNodeConfig {
  model?: 'sonnet' | 'opus' | 'haiku';
  max_turns?: number;
  tools?: string[];              // Allowed tools list
  system_prompt?: string;        // Custom system prompt override
  timeout_seconds?: number;
  retry_count?: number;
  environment_vars?: Record<string, string>;
}

export interface PortSchema {
  id: string;
  name: string;
  type: 'artifact' | 'approval' | 'data' | 'signal';
  required: boolean;
  schema?: Record<string, unknown>; // JSON Schema for validation
}

export interface Transition {
  id: string;
  source: string;               // Node ID
  target: string;               // Node ID
  sourceHandle?: string;        // Output port ID
  targetHandle?: string;        // Input port ID
  condition?: TransitionCondition;
  label?: string;
}

export interface TransitionCondition {
  type: 'always' | 'on_success' | 'on_failure' | 'expression';
  expression?: string;          // e.g., "output.test_passed === true"
}

export interface HITLGateDefinition {
  id: string;
  node_id: string;              // Which node this gate is attached to
  position: 'before' | 'after'; // Before or after node execution
  gate_type: 'mandatory' | 'advisory';
  prompt_template: string;      // What to ask the human
  timeout_minutes?: number;
  options: GateOption[];
}

export interface GateOption {
  label: string;
  value: string;
  action: 'proceed' | 'abort' | 'retry' | 'skip';
}

export interface WorkflowVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'json';
  default_value?: unknown;
  description: string;
  required: boolean;
}
```

### 4.2 Execution State (runtime, in-memory + Redis)

```typescript
// src/shared/types/execution.ts

export interface Execution {
  id: string;                    // UUID
  workflow_id: string;
  workflow_name: string;
  work_item: WorkItemReference;
  status: ExecutionStatus;
  current_node_id: string | null;
  node_states: Map<string, NodeExecutionState>;
  history: ExecutionEvent[];
  variables: Record<string, unknown>; // Runtime variable values
  started_at: string;
  completed_at: string | null;
  error?: string;
}

export type ExecutionStatus =
  | 'pending'
  | 'running'
  | 'paused_gate'          // Waiting for HITL approval
  | 'paused_user'          // User pressed pause
  | 'completed'
  | 'failed'
  | 'aborted';

export interface NodeExecutionState {
  node_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'waiting_gate';
  started_at?: string;
  completed_at?: string;
  cli_session_id?: string;     // If a CLI session was spawned
  outputs?: Record<string, unknown>;
  error?: string;
  gate_decision?: 'proceed' | 'abort' | 'retry' | 'skip';
}

export interface ExecutionEvent {
  id: string;
  timestamp: string;
  node_id?: string;
  event_type: ExecutionEventType;
  message: string;
  metadata?: Record<string, unknown>;
}

export type ExecutionEventType =
  | 'execution_started'
  | 'node_started'
  | 'node_completed'
  | 'node_failed'
  | 'gate_requested'
  | 'gate_decided'
  | 'cli_spawned'
  | 'cli_output'
  | 'cli_exited'
  | 'execution_paused'
  | 'execution_resumed'
  | 'execution_completed'
  | 'execution_failed'
  | 'execution_aborted';
```

### 4.3 Work Item Reference

```typescript
// src/shared/types/workitem.ts

export type WorkItemType = 'prd' | 'issue' | 'idea' | 'task';

export interface WorkItemReference {
  type: WorkItemType;
  id: string;
  title: string;
  source: WorkItemSource;
}

export type WorkItemSource =
  | { type: 'filesystem'; path: string }      // .workitems/ folder
  | { type: 'github'; repo: string; number: number }
  | { type: 'manual'; content: string };

export interface WorkItem extends WorkItemReference {
  description: string;
  content: string;              // Full markdown/text content
  metadata: Record<string, unknown>;
  created_at: string;
}
```

### 4.4 CLI Session Model

```typescript
// src/shared/types/cli.ts

export interface CLISpawnConfig {
  context_id: string;           // CLAUDE_INSTANCE_ID value
  working_directory: string;
  environment_vars?: Record<string, string>;
  agent_role?: string;          // planner, backend, frontend, etc.
}

export interface CLISession {
  id: string;                   // UUID
  context_id: string;
  pid: number;
  status: 'running' | 'exited';
  spawned_at: string;
  exited_at?: string;
  exit_code?: number;
}
```

## 5. API Contracts (IPC)

### 5.1 Workflow File Operations

```typescript
// Main process handlers

// Save workflow to disk
handle(WORKFLOW_SAVE, async (workflow: WorkflowDefinition): Promise<{ path: string }> => {
  // Validates with Zod schema
  // Writes to ~/.asdlc/workflows/{id}.json or user-chosen path
  // Returns saved file path
});

// Load workflow from disk
handle(WORKFLOW_LOAD, async (filePath: string): Promise<WorkflowDefinition> => {
  // Reads JSON file
  // Validates with Zod schema
  // Migrates old schema versions if needed
  // Returns parsed workflow
});

// List all saved workflows
handle(WORKFLOW_LIST, async (): Promise<WorkflowSummary[]> => {
  // Scans ~/.asdlc/workflows/ directory
  // Returns summaries with name, date, node count
});
```

### 5.2 Execution Control

```typescript
// Start workflow execution
handle(EXECUTION_START, async (config: ExecutionConfig): Promise<Execution> => {
  // config: { workflow_id, work_item, variable_overrides }
  // Creates Execution record
  // Begins traversing workflow graph
  // Spawns CLI sessions as needed
  // Emits events via IPC to renderer
});

// Pause execution
handle(EXECUTION_PAUSE, async (executionId: string): Promise<void> => {
  // Pauses after current node completes
  // Does not kill running CLI sessions
});

// Resume execution
handle(EXECUTION_RESUME, async (executionId: string): Promise<void> => {
  // Continues from paused state
});

// Abort execution
handle(EXECUTION_ABORT, async (executionId: string): Promise<void> => {
  // Kills all spawned CLI sessions
  // Marks execution as aborted
});
```

### 5.3 CLI Spawner

```typescript
// Spawn a Claude CLI session
handle(CLI_SPAWN, async (config: CLISpawnConfig): Promise<CLISession> => {
  // Uses node-pty to create pseudo-terminal
  // Sets CLAUDE_INSTANCE_ID from config.context_id
  // Pipes stdout/stderr to renderer via IPC events
  // Returns session handle
});

// Send input to CLI session
handle(CLI_WRITE, async (sessionId: string, data: string): Promise<void> => {
  // Writes data to pty stdin
});

// Kill CLI session
handle(CLI_KILL, async (sessionId: string): Promise<void> => {
  // Sends SIGTERM, then SIGKILL after timeout
});
```

## 6. Component Hierarchy (Renderer)

### 6.1 Top-Level Layout

```
App
+-- AppShell
    +-- TitleBar (custom, frameless window controls)
    +-- Sidebar
    |   +-- NavItem: "Designer"
    |   +-- NavItem: "Templates"
    |   +-- NavItem: "Execute"
    |   +-- NavItem: "CLI Sessions"
    |   +-- Divider
    |   +-- RecentWorkflows
    +-- MainContent (<Outlet />)
        +-- Route /designer       -> WorkflowDesignerPage
        +-- Route /templates      -> TemplateManagerPage
        +-- Route /execute        -> ExecutionPage
        +-- Route /execute/:id    -> ExecutionWalkthroughPage
        +-- Route /cli            -> CLIManagerPage
        +-- Route /settings       -> SettingsPage
```

### 6.2 Workflow Designer

```
WorkflowDesignerPage
+-- Toolbar
|   +-- WorkflowNameInput
|   +-- SaveButton
|   +-- LoadButton
|   +-- UndoButton / RedoButton
|   +-- ZoomControls
|   +-- ValidateButton
+-- SplitPane (horizontal)
    +-- Left: AgentNodePalette
    |   +-- PaletteSection: "Agent Nodes"
    |   |   +-- DraggableNode: Planner
    |   |   +-- DraggableNode: Backend
    |   |   +-- DraggableNode: Frontend
    |   |   +-- DraggableNode: Reviewer
    |   |   +-- DraggableNode: Tester
    |   |   +-- DraggableNode: Orchestrator
    |   |   +-- DraggableNode: DevOps
    |   |   +-- DraggableNode: Custom
    |   +-- PaletteSection: "Control Flow"
    |       +-- DraggableNode: HITL Gate
    |       +-- DraggableNode: Conditional Branch
    |       +-- DraggableNode: Parallel Fork
    |       +-- DraggableNode: Join
    +-- Center: ReactFlowCanvas
    |   +-- AgentNodeComponent (custom node renderer)
    |   +-- GateNodeComponent (custom node renderer)
    |   +-- TransitionEdge (custom edge renderer)
    |   +-- MiniMap
    |   +-- Controls
    |   +-- Background
    +-- Right: PropertiesPanel (context-dependent)
        +-- NodePropertiesForm (when node selected)
        |   +-- AgentTypeSelector
        |   +-- ModelSelector
        |   +-- MaxTurnsInput
        |   +-- ToolsSelector
        |   +-- SystemPromptEditor
        |   +-- InputPortsEditor
        |   +-- OutputPortsEditor
        +-- EdgePropertiesForm (when edge selected)
        |   +-- ConditionTypeSelector
        |   +-- ExpressionEditor
        +-- GatePropertiesForm (when gate selected)
        |   +-- GateTypeSelector
        |   +-- PromptTemplateEditor
        |   +-- OptionsEditor
        |   +-- TimeoutInput
        +-- WorkflowPropertiesForm (when nothing selected)
            +-- NameInput
            +-- DescriptionInput
            +-- TagsInput
            +-- VariablesEditor
```

### 6.3 Execution Walkthrough

```
ExecutionWalkthroughPage
+-- ExecutionHeader
|   +-- WorkflowName
|   +-- WorkItemBadge
|   +-- StatusIndicator
|   +-- ExecutionControls
|       +-- PlayButton / PauseButton
|       +-- StepButton (advance one node)
|       +-- AbortButton
+-- SplitPane (horizontal)
    +-- Left: ExecutionCanvas (React Flow, read-only)
    |   +-- AgentNodeComponent (with status overlay)
    |   |   +-- StatusIcon (pending/running/done/failed)
    |   |   +-- ProgressBar (if running)
    |   +-- AnimatedEdge (shows data flow)
    |   +-- CurrentNodeHighlight
    +-- Right: ExecutionDetailsPanel
        +-- Tabs
            +-- Tab: "Current Node"
            |   +-- NodeInfo
            |   +-- NodeInputs
            |   +-- NodeOutputs (streaming)
            |   +-- CLIOutput (if CLI spawned)
            +-- Tab: "Event Log"
            |   +-- ExecutionEventList
            |   +-- EventDetail
            +-- Tab: "Variables"
            |   +-- VariableTable
            +-- Tab: "Gate Decision" (if paused at gate)
                +-- GatePrompt
                +-- GateOptions
                +-- DecisionForm
```

### 6.4 Work Item Picker

```
WorkItemPickerDialog (modal)
+-- Tabs
    +-- Tab: "PRDs" (from .workitems/)
    |   +-- SearchInput
    |   +-- PRDList
    |       +-- PRDCard (name, status, date)
    +-- Tab: "GitHub Issues"
    |   +-- SearchInput
    |   +-- IssueList
    |       +-- IssueCard (number, title, labels)
    +-- Tab: "Ideas" (from .workitems/ or ideation)
    |   +-- SearchInput
    |   +-- IdeaList
    |       +-- IdeaCard (title, description)
    +-- Tab: "Manual Input"
        +-- TitleInput
        +-- DescriptionTextarea
        +-- MarkdownPreview
```

## 7. File Structure

```
electron-workflow-studio/
+-- package.json
+-- electron-builder.yml             # Build configuration
+-- tsconfig.json                    # Shared TypeScript config
+-- tsconfig.main.json               # Main process config
+-- tsconfig.renderer.json           # Renderer process config
+-- tailwind.config.js               # Shared with web HITL UI tokens
+-- postcss.config.js
+-- vite.config.main.ts              # Vite config for main process
+-- vite.config.renderer.ts          # Vite config for renderer
+-- vite.config.preload.ts           # Vite config for preload
+--
+-- src/
|   +-- main/                        # Electron main process
|   |   +-- index.ts                 # App entry, window creation
|   |   +-- ipc/
|   |   |   +-- index.ts             # Register all IPC handlers
|   |   |   +-- workflow-handlers.ts # Workflow CRUD handlers
|   |   |   +-- workitem-handlers.ts # Work item loading handlers
|   |   |   +-- cli-handlers.ts      # CLI spawner handlers
|   |   |   +-- execution-handlers.ts# Execution control handlers
|   |   |   +-- system-handlers.ts   # Dialog, path handlers
|   |   +-- services/
|   |   |   +-- workflow-file-service.ts  # Filesystem CRUD for workflows
|   |   |   +-- workitem-service.ts       # Parse .workitems/, GitHub
|   |   |   +-- cli-spawner.ts            # node-pty CLI management
|   |   |   +-- execution-engine.ts       # Workflow graph traversal
|   |   |   +-- redis-client.ts           # Redis event subscription
|   |   +-- schemas/
|   |       +-- workflow-schema.ts   # Zod schema for validation
|   |       +-- execution-schema.ts  # Zod schema for execution config
|   |
|   +-- preload/
|   |   +-- preload.ts               # contextBridge API exposure
|   |
|   +-- renderer/                    # React application
|   |   +-- index.html
|   |   +-- main.tsx                 # React entry point
|   |   +-- App.tsx                  # Root with routing
|   |   +-- index.css                # Tailwind + custom vars
|   |   +-- api/
|   |   |   +-- electron-bridge.ts   # Typed wrapper around window.electronAPI
|   |   |   +-- types.ts             # Re-export shared types
|   |   +-- components/
|   |   |   +-- layout/
|   |   |   |   +-- AppShell.tsx
|   |   |   |   +-- TitleBar.tsx
|   |   |   |   +-- Sidebar.tsx
|   |   |   +-- common/              # Shared primitives
|   |   |   |   +-- Badge.tsx
|   |   |   |   +-- Button.tsx
|   |   |   |   +-- Card.tsx
|   |   |   |   +-- EmptyState.tsx
|   |   |   |   +-- Spinner.tsx
|   |   |   |   +-- SplitPane.tsx
|   |   |   |   +-- SearchInput.tsx
|   |   |   +-- designer/
|   |   |   |   +-- AgentNodePalette.tsx
|   |   |   |   +-- ReactFlowCanvas.tsx
|   |   |   |   +-- AgentNodeComponent.tsx   # Custom React Flow node
|   |   |   |   +-- GateNodeComponent.tsx    # Custom React Flow node
|   |   |   |   +-- TransitionEdge.tsx       # Custom React Flow edge
|   |   |   |   +-- PropertiesPanel.tsx
|   |   |   |   +-- NodePropertiesForm.tsx
|   |   |   |   +-- EdgePropertiesForm.tsx
|   |   |   |   +-- GatePropertiesForm.tsx
|   |   |   |   +-- WorkflowPropertiesForm.tsx
|   |   |   |   +-- Toolbar.tsx
|   |   |   |   +-- ValidationOverlay.tsx
|   |   |   +-- execution/
|   |   |   |   +-- ExecutionCanvas.tsx
|   |   |   |   +-- ExecutionControls.tsx
|   |   |   |   +-- ExecutionHeader.tsx
|   |   |   |   +-- ExecutionDetailsPanel.tsx
|   |   |   |   +-- ExecutionEventList.tsx
|   |   |   |   +-- GateDecisionForm.tsx
|   |   |   |   +-- NodeStatusOverlay.tsx
|   |   |   |   +-- AnimatedEdge.tsx
|   |   |   +-- workitems/
|   |   |   |   +-- WorkItemPickerDialog.tsx
|   |   |   |   +-- PRDList.tsx
|   |   |   |   +-- IssueList.tsx
|   |   |   |   +-- IdeaList.tsx
|   |   |   |   +-- WorkItemCard.tsx
|   |   |   +-- templates/
|   |   |   |   +-- TemplateList.tsx
|   |   |   |   +-- TemplatePreview.tsx
|   |   |   |   +-- TemplateCard.tsx
|   |   |   +-- cli/
|   |   |       +-- CLISessionList.tsx
|   |   |       +-- TerminalPanel.tsx
|   |   |       +-- SpawnDialog.tsx
|   |   +-- pages/
|   |   |   +-- WorkflowDesignerPage.tsx
|   |   |   +-- TemplateManagerPage.tsx
|   |   |   +-- ExecutionPage.tsx
|   |   |   +-- ExecutionWalkthroughPage.tsx
|   |   |   +-- CLIManagerPage.tsx
|   |   |   +-- SettingsPage.tsx
|   |   +-- stores/
|   |   |   +-- workflowStore.ts     # Current workflow being edited
|   |   |   +-- executionStore.ts    # Active execution state
|   |   |   +-- cliStore.ts          # CLI sessions
|   |   |   +-- uiStore.ts           # Panel states, selection
|   |   +-- hooks/
|   |   |   +-- useElectronAPI.ts    # Hook to access bridge safely
|   |   |   +-- useWorkflowFile.ts   # Save/load workflow
|   |   |   +-- useExecution.ts      # Execution control
|   |   |   +-- useCLISession.ts     # CLI session management
|   |   |   +-- useUndoRedo.ts       # Undo/redo for canvas
|   |   +-- utils/
|   |       +-- graph-utils.ts       # Workflow graph traversal
|   |       +-- validation.ts        # Workflow validation rules
|   |       +-- formatters.ts        # Date, status formatting
|   |       +-- constants.ts         # Node types, colors
|   |
|   +-- shared/                      # Shared between main and renderer
|       +-- types/
|       |   +-- workflow.ts          # WorkflowDefinition, AgentNode, etc.
|       |   +-- execution.ts         # Execution, NodeExecutionState, etc.
|       |   +-- workitem.ts          # WorkItem, WorkItemReference
|       |   +-- cli.ts               # CLISession, CLISpawnConfig
|       +-- ipc-channels.ts          # IPC channel constants
|       +-- constants.ts             # Shared constants
|
+-- resources/                       # Electron build resources
|   +-- icon.png
|   +-- icon.icns
|   +-- icon.ico
|
+-- templates/                       # Built-in workflow templates
|   +-- 11-step-default.json         # The standard 11-step aSDLC workflow
|   +-- quick-fix.json               # Minimal: plan -> code -> test -> commit
|   +-- design-review.json           # Plan -> design -> review loop
|   +-- tdd-cycle.json               # Test -> code -> refactor cycle
|
+-- test/
    +-- main/
    |   +-- workflow-file-service.test.ts
    |   +-- cli-spawner.test.ts
    |   +-- execution-engine.test.ts
    |   +-- workitem-service.test.ts
    +-- renderer/
    |   +-- components/
    |   |   +-- designer/
    |   |   |   +-- AgentNodePalette.test.tsx
    |   |   |   +-- ReactFlowCanvas.test.tsx
    |   |   |   +-- PropertiesPanel.test.tsx
    |   |   +-- execution/
    |   |   |   +-- ExecutionCanvas.test.tsx
    |   |   |   +-- ExecutionControls.test.tsx
    |   |   +-- workitems/
    |   |       +-- WorkItemPickerDialog.test.tsx
    |   +-- stores/
    |   |   +-- workflowStore.test.ts
    |   |   +-- executionStore.test.ts
    |   +-- hooks/
    |       +-- useWorkflowFile.test.ts
    |       +-- useExecution.test.ts
    +-- shared/
        +-- workflow-schema.test.ts
        +-- graph-utils.test.ts
```

## 8. Mock-First Implementation Strategy

The build follows a strict mock-first approach. Each phase adds functionality with stubs, then later phases wire to real backends.

### Phase 1: Contract Design and Shared Types
- Define all TypeScript interfaces (workflow, execution, work item, CLI)
- Define Zod validation schemas
- Define IPC channel constants
- No runtime code yet

### Phase 2: Electron Shell
- Minimal Electron window with React renderer
- IPC bridge with stub handlers (return mock data)
- Basic navigation (sidebar, routing)
- Title bar with frameless window controls

### Phase 3: Canvas UI (Designer)
- React Flow canvas with custom agent nodes
- Drag-and-drop from palette
- Node property editing panel
- Edge creation with condition config
- HITL gate node configuration
- Save/Load workflow JSON (filesystem via IPC)
- Undo/redo support

### Phase 4: Walkthrough UI (Execution)
- Read-only execution canvas with status overlays
- Mock execution engine (steps through nodes with delays)
- HITL gate pause and decision UI
- Event log panel
- Work item picker dialog
- Template manager

### Phase 5: Backend Wiring
- Real CLI spawner via node-pty
- Redis event subscription for live execution tracking
- Work item loading from .workitems/ filesystem
- GitHub issue integration (via gh CLI or API)
- Real execution engine coordinating CLI sessions

## 9. Built-in Workflow Templates

### 9.1 Default 11-Step aSDLC Workflow

```
[Workplan] -> [Planning] -> [Diagrams] -> [Design Review] -> [Re-plan]
                                                                  |
      +-----------------------------------------------------------+
      v
[Parallel Build] -> [Testing] -> [Review] -> [Orchestration] -> [DevOps] -> [Closure]
```

With HITL gates at: Design Review, Test Failures, Protected Path Commit, DevOps Invocation.

### 9.2 Quick Fix Workflow

```
[Planner] -> [Backend] -> [Tester] -> [Orchestrator]
```

Minimal workflow for small bug fixes.

### 9.3 Design Review Loop

```
[Discovery] -> [Planner] -> [Reviewer] --[concerns]--> [Planner]
                                        --[approved]--> [Done]
```

Iterative design refinement.

## 10. Workflow Validation Rules

The designer validates workflows before execution:

1. **Connectivity** -- All nodes must be reachable from a start node
2. **No orphan nodes** -- Every node must have at least one incoming or outgoing edge
3. **Gate attachment** -- Every HITL gate must be attached to exactly one node
4. **Required ports** -- All required input ports must have incoming edges
5. **No cycles without exit** -- Cycles must have a condition that can break out
6. **Type compatibility** -- Edge source output type must match target input type
7. **At least one start node** -- Workflow must have a node with no incoming edges
8. **At least one end node** -- Workflow must have a node with no outgoing edges

## 11. Testing Strategy

### 11.1 Unit Tests (Vitest)
- Zod schema validation for all data types
- Graph utility functions (traversal, validation, topological sort)
- Workflow file service (save, load, list, delete)
- Execution engine state machine
- React Flow canvas interactions
- Store actions and selectors

### 11.2 Integration Tests
- IPC round-trip (main -> preload -> renderer -> main)
- Workflow save and reload cycle
- Execution start to completion with mock engine
- CLI spawn and termination lifecycle

### 11.3 E2E Tests (Playwright + Electron)
- Full designer workflow: create nodes, connect, save
- Load template, modify, save as new
- Execute workflow with mock backend, step through gates
- CLI spawner launch and terminal output

### 11.4 Coverage Targets
- Shared types/schemas: 95%+
- Main process services: 90%+
- Renderer components: 80%+
- Store logic: 90%+

## 12. Performance Considerations

- **Large workflows**: React Flow handles 100+ nodes; virtualization built-in
- **Terminal output**: Ring buffer for CLI output (last 10,000 lines)
- **Event log**: Virtual scrolling for execution events
- **File watching**: Debounced chokidar events for workflow directory
- **IPC serialization**: Keep IPC payloads under 1MB; stream large outputs

## 13. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| node-pty build issues on different platforms | Medium | High | Provide prebuilt binaries; fallback to child_process |
| React Flow performance with large workflows | Low | Medium | Limit node count; use React Flow virtualization |
| Electron security vulnerabilities | Medium | High | Strict CSP; no nodeIntegration; validate all IPC |
| Schema evolution breaking saved workflows | Medium | Medium | Version field in schema; migration functions |
| CLI session leaks (orphaned processes) | Medium | High | Process group kill on app exit; periodic cleanup |
| Shared component drift from web HITL UI | Low | Low | Document shared components; periodic sync |

## 14. Open Questions

1. **Cross-platform packaging**: Should we support macOS, Linux, and Windows from day one, or start with a single platform?
   - Recommendation: Start with the host platform (Linux for dev), add others later
2. **Workflow sharing**: Should workflows be shareable via Git (stored in repo) or local-only?
   - Recommendation: Local ~/.asdlc/workflows/ by default, with export/import for sharing
3. **Real-time collaboration**: Should we plan for WebRTC/CRDT multi-user editing in the future?
   - Recommendation: No, keep it single-user desktop tool
4. **Authentication**: Should the Electron app authenticate against any backend?
   - Recommendation: No auth for local-only tool; rely on filesystem and Git permissions
