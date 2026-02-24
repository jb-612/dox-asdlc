---
id: P15-F04
parent_id: P15
type: design
version: 1
status: draft
constraints_hash: null
created_by: planner
created_at: "2026-02-22T00:00:00Z"
updated_at: "2026-02-22T00:00:00Z"
dependencies:
  - P14-F04
  - P14-F05
tags:
  - execution
  - ux
  - step-gate
  - deliverables
  - event-log
  - diff-viewer
---

# Design: Execute — Multi-Step Workflow UX (P15-F04)

## Overview

When a workflow is running, the user needs a rich UX to:
1. Monitor progress across all blocks in real time
2. See a human-readable event log of what each agent is doing
3. Gate execution at configurable block boundaries — pause, review deliverables, then Continue or Revise
4. Pick a scrutiny level to control how much detail to inspect
5. (Future) Diff code changes from a Dev block inline

This feature enhances the existing `ExecutionWalkthroughPage` (`/execute/run`) with all of the above. It does **not** add a new route — it replaces stub components with full implementations and adds new ones.

## Current State

The following already exists and must be preserved/enhanced:

| File | Status | Notes |
|------|--------|-------|
| `ExecutionWalkthroughPage.tsx` | Exists | Layout shell — left canvas, right details panel, header controls |
| `ExecutionCanvas.tsx` | Exists | React Flow visualization of nodes; already highlights current node |
| `ExecutionDetailsPanel.tsx` | Exists | Tabbed panel: Current Node, Event Log, Variables, Gate Decision |
| `executionStore.ts` | Exists | Zustand store: execution, events, nodeStates, gate decision IPC |
| `execution-handlers.ts` | Exists | IPC: start, pause, resume, abort, gateDecision |
| Execution types | Exists | `ExecutionEvent`, `NodeExecutionState`, `ExecutionStatus`, etc. |

## Architecture

```
ExecutionWalkthroughPage (/execute/run)
├── Header (status badge, elapsed time, Pause/Resume/Abort buttons)
├── WorkflowTrack (Left 60% — replaces ExecutionCanvas)
│   ├── Horizontal or vertical node rail
│   ├── Each node: icon, label, status badge, duration
│   ├── Active node: highlighted/animated
│   └── Parallel branches: side-by-side columns
└── RightPanel (Right 40%)
    ├── Tab: Event Log
    │   └── EventLogPanel (real-time stream, human-readable entries)
    ├── Tab: Step Gate (only visible when gate fires)
    │   ├── DeliverablesViewer
    │   │   ├── ScrutinyLevelSelector (Summary / File List / Full Detail)
    │   │   └── DeliverableContent (markdown, file tree, or full doc)
    │   ├── RevisionCount badge
    │   └── ContinueReviseBar
    │       ├── Continue button
    │       └── Revise button → RevisionFeedbackInput
    ├── Tab: Variables
    └── Tab: Current Node (node detail)
```

## Deliverables Schema

Each block type declares what deliverables it produces. Deliverables are stored in `NodeExecutionState.output` and interpreted based on block type.

```typescript
// Extends NodeExecutionState.output
interface BlockDeliverables {
  blockType: 'plan' | 'dev' | 'test' | 'review';
  summary?: string;              // AI-generated 1-paragraph summary
  fileList?: FileEntry[];        // Files created/modified
  fullContent?: PlanDeliverable | CodeDeliverable | TestDeliverable | ReviewDeliverable;
}

interface FileEntry {
  path: string;
  status: 'created' | 'modified' | 'deleted';
  linesAdded?: number;
  linesRemoved?: number;
}

// Plan block deliverable (full detail view)
interface PlanDeliverable {
  designMd?: string;       // markdown content
  userStoriesMd?: string;
  tasksMd?: string;
}

// Dev block deliverable (full detail view — future)
interface CodeDeliverable {
  diffs: FileDiff[];
}

interface FileDiff {
  path: string;
  oldContent: string;
  newContent: string;
  language: string;   // for syntax highlighting
}

// Test block deliverable (future)
interface TestDeliverable {
  passed: number;
  failed: number;
  coverage?: number;
  failureSummary?: string;
}

// Review block deliverable (future)
interface ReviewDeliverable {
  findings: ReviewFinding[];
  summary: string;
}

interface ReviewFinding {
  severity: 'critical' | 'warning' | 'suggestion';
  message: string;
  path?: string;
  line?: number;
}
```

## Scrutiny Level Design

```
ScrutinyLevel = 'summary' | 'file_list' | 'full_content' | 'full_detail'
```

> **Note:** The committed `execution.ts` has 3 values: `'summary' | 'file_list' | 'full_content'`.
> A 4th value `'full_detail'` must be added (task T15) to support structured annotations.

| Level | Plan Block Shows | Dev Block Shows |
|-------|-----------------|-----------------|
| Summary | AI-generated paragraph | AI-generated paragraph |
| File List | Doc structure (headings) | List of changed files with +/- stats |
| Full Content | Raw file contents (design.md, tasks.md) | Raw diffs per file |
| Full Detail | Structured annotations, expanded sections, full context | Annotated diffs with context, review comments |

The user picks scrutiny level **at runtime** via a segmented control. The selection persists per-session (in local state, not persisted to disk).

## Step Gate State Machine

```
Block Running
    │
    ▼
Block Completed
    │
    ├─ gate_mode === 'auto_continue' ──▶ Next Block Starts
    │
    └─ gate_mode === 'gate' ──────────▶ Status: waiting_gate
                                            │
                                        Gate Panel opens
                                            │
                            ┌───────────────┴───────────────┐
                            │                               │
                        Continue                         Revise
                            │                               │
                     Next Block Starts           User types feedback
                                                            │
                                                Block re-runs with
                                                feedback injected
                                                            │
                                                  revisionCount++
```

The `gate_mode` property is per-block and is configured in the workflow template (Studio block settings). The execution engine reads it from `node.config.gateMode`.

## IPC / Store Changes

### New IPC channel: `EXECUTION_REVISE`

```typescript
// Renderer → Main
window.electronAPI.execution.revise({
  executionId: string,
  nodeId: string,
  feedback: string,
})

// Main → ExecutionEngine: re-queues the block with feedback appended to prompt
```

### Store additions

```typescript
// In executionStore.ts
interface ExecutionState {
  // New:
  scrutinyLevel: 'summary' | 'file_list' | 'full_content' | 'full_detail';
  setScrutinyLevel: (level: ScrutinyLevel) => void;

  reviseBlock: (nodeId: string, feedback: string) => Promise<void>;
}
```

> **Default scrutiny level:** If `WorkflowDefinition.defaultScrutinyLevel` is set, the store
> initializes `scrutinyLevel` from this value. Otherwise defaults to `'summary'`. This allows
> template authors to set a per-workflow preference.

### ContinueReviseBar Positioning

`ContinueReviseBar` uses **sticky positioning** (`position: sticky; bottom: 0`) at the
bottom of the `StepGatePanel`. This ensures the Continue/Revise controls remain visible
even when the deliverables content scrolls. The bar has a semi-transparent background with
backdrop blur for visual separation from scrolling content.

### Revision Count Cap

The `reviseBlock()` method rejects with an error if `revisionCount >= 10`. The UI shows:
"Maximum revisions (10) reached. Please Continue or Abort." This prevents infinite revision
loops.

### Keyboard Shortcuts

When the `StepGatePanel` is visible (`waiting_gate` status):
- `Ctrl+Enter` / `Cmd+Enter`: triggers Continue
- `Ctrl+Shift+R` / `Cmd+Shift+R`: toggles Revise textarea visibility

### Execution type additions

```typescript
// In execution.ts
interface NodeExecutionState {
  // New:
  revisionCount?: number;     // how many times this node was revised
  gateMode?: 'auto_continue' | 'gate';  // from node config at runtime
}

// New event types:
type ExecutionEventType =
  | ... existing ...
  | 'tool_call'         // agent called a tool (e.g. "Read src/foo.ts")
  | 'bash_command'      // agent ran a bash command
  | 'agent_started'     // agent process started
  | 'agent_completed'   // agent process completed cleanly
  | 'block_gate_open'   // gate fired, waiting for decision
  | 'block_revision'    // user submitted revision feedback (committed as 'block_revision')
```

## Event Log Design

Events are already streamed via IPC (`EXECUTION_EVENT` channel) and stored in `executionStore.events`. The existing `cli_output` and `cli_error` event types carry raw CLI text.

The new `EventLogPanel` transforms raw events into human-readable entries:

```
[10:32:01] ▶ Planner block started
[10:32:02] 🔧 Called Read tool → src/core/guardrails/models.py
[10:32:05] 🔧 Called Write tool → .workitems/P15-F04-execute-multistep-ux/design.md
[10:32:08] ✅ Planner block completed (6s)
[10:32:09] ⏸  Step gate — review deliverables
[10:33:12] ▶ User revised: "Add code diff viewer section"
[10:33:13] 🔁 Planner block re-started (revision 1)
```

The transformation logic lives in a pure `formatEvent` function in `src/renderer/utils/eventFormatter.ts`.

### eventFormatter Interface

```typescript
interface FormattedEvent {
  icon: string;          // emoji or icon name for the event type
  label: string;         // human-readable action label (e.g., "Called Read tool")
  detail: string;        // additional context (e.g., "→ src/core/models.py")
  timestamp: string;     // formatted time string (e.g., "10:32:01")
  nodeId?: string;       // optional node association for filtering
}

function formatEvent(
  event: ExecutionEvent,
  nodeLabel?: string      // optional human-readable node name for display
): FormattedEvent;
```

The function is pure (no side effects) and handles all `ExecutionEventType` values.
Unknown types fall back to `{ icon: '•', label: event.type, detail: event.message }`.

Event display rules:

| Raw event type | Display format |
|---------------|----------------|
| `node_started` | `▶ {node.label} started` |
| `node_completed` | `✅ {node.label} completed ({duration})` |
| `node_failed` | `❌ {node.label} failed: {error}` |
| `tool_call` | `🔧 Called {tool} → {target}` |
| `bash_command` | `$ {command}` |
| `gate_waiting` | `⏸  Step gate — review deliverables` |
| `gate_decided` | `▶ Continuing to next block` |
| `block_revision` | `🔁 Re-running with feedback (revision {n})` |
| `cli_error` | `⚠ {message}` |

## Code Diff Viewer (Future — Design Now)

A `DiffViewer` component will render side-by-side or unified diffs for Dev block deliverables.

```typescript
interface DiffViewerProps {
  diffs: FileDiff[];
  mode: 'side_by_side' | 'unified';
  onOpenInVSCode?: (path: string) => void;  // vscode://file/{path}
}
```

Implementation options:
- Option A: Use `react-diff-viewer-continued` npm package (MIT, actively maintained)
- Option B: Use Monaco Editor's `diffEditor` (heavier, but already in the Electron context)
- **Recommended: Option A** — lighter weight, no Monaco dependency needed for pure diff display

VS Code integration: `vscode://file/{absolutePath}:{line}` URI scheme. Electron calls `shell.openExternal(uri)`.

## Parallel Track Visualization

When two blocks run in parallel (DAG fork), the workflow track shows:

```
  ┌──────────────┐
  │  Fork         │
  └──┬──────┬────┘
     │      │
  ┌──▼──┐ ┌─▼───┐
  │ B1  │ │ B2  │   ← rendered as two columns
  └──┬──┘ └─┬───┘
     │      │
  ┌──▼──────▼────┐
  │  Join         │
  └──────────────┘
```

The existing `ExecutionCanvas` uses React Flow and already has node/edge data from the workflow definition. The enhancement adds:
- Status-aware node coloring (pending/running/completed/failed/waiting_gate)
- Active node pulse animation (CSS keyframes)
- Parallel branch layout (React Flow auto-layout with dagre or elk)

## File Structure

```
apps/workflow-studio/src/
├── renderer/
│   ├── pages/
│   │   └── ExecutionWalkthroughPage.tsx          # Enhanced layout (existing, expand)
│   ├── components/execution/
│   │   ├── ExecutionCanvas.tsx                   # Enhanced: status colors, pulse (existing)
│   │   ├── ExecutionDetailsPanel.tsx             # Enhanced: Step Gate tab (existing)
│   │   ├── EventLogPanel.tsx                     # New: human-readable event stream
│   │   ├── StepGatePanel.tsx                     # New: deliverables + scrutiny + Continue/Revise
│   │   ├── DeliverablesViewer.tsx                # New: renders deliverables at scrutiny level
│   │   ├── ScrutinyLevelSelector.tsx             # New: segmented control (Summary/FileList/Full)
│   │   ├── ContinueReviseBar.tsx                 # New: Continue button + Revise input
│   │   └── DiffViewer.tsx                        # New (stub for now, full impl later)
│   ├── stores/
│   │   └── executionStore.ts                     # +scrutinyLevel, +reviseBlock (existing)
│   └── utils/
│       └── eventFormatter.ts                     # New: pure event → FormattedEvent transform
├── shared/
│   ├── types/
│   │   └── execution.ts                          # +tool_call, +bash_command, +block_gate_open,
│   │                                             #  +block_revised; +revisionCount, +gateMode
│   └── ipc-channels.ts                           # +EXECUTION_REVISE channel
└── main/
    └── ipc/
        └── execution-handlers.ts                 # +revise handler → engine.reviseBlock()

apps/workflow-studio/src/main/services/
└── execution-engine.ts                           # +reviseBlock(nodeId, feedback) method
```

## Architecture Decisions

### ADR-1: Keep ExecutionWalkthroughPage as the single run view

The existing page at `/execute/run` will be enhanced in place. No new routes are added. The page already has the correct layout shell and store subscription.

### ADR-2: Event enrichment happens in renderer, not engine

The execution engine emits raw typed events. Formatting (icons, human text, duration calculation) happens in `eventFormatter.ts` in the renderer. This keeps the engine clean and makes the formatter independently testable.

### ADR-3: Deliverables stored in NodeExecutionState.output

Rather than a separate IPC channel for deliverables, the engine writes deliverables into `NodeExecutionState.output` when a block completes. The renderer reads them from the store snapshot. This reuses the existing state-update IPC path.

### ADR-4: Revise = re-queue with appended feedback

When the user submits revision feedback, the execution engine does not create a new execution. Instead, it re-queues the same node with the original prompt + appended feedback string, increments `revisionCount`, and re-emits `node_started`.

### ADR-5: Gate mode is per-node, set in workflow definition

`node.config.gateMode: 'auto_continue' | 'gate'` is set in the workflow template (Studio designer). Default is `'auto_continue'` for all existing workflows (backward-compatible). The execution engine checks this at node completion.

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Plan block output schema not yet emitted by engine | High | Mock deliverables in StepGatePanel during development; add real emission in T08 |
| `tool_call` / `bash_command` events not yet emitted | High | Add emission to execution engine (T07); UI can degrade gracefully without them |
| React Flow parallel layout complexity | Medium | Use dagre layout library (already supported by React Flow); fallback to linear if fork detection fails |
| Revision feedback injection into existing prompt harness | Medium | Append as a trailing user message in the CLI invocation; test in mock mode first |
