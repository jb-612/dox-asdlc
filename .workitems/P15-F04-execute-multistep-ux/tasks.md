---
id: P15-F04
parent_id: P15
type: tasks
version: 1
status: in_progress
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
---

# Tasks: Execute — Multi-Step Workflow UX (P15-F04)

## Progress

- Started: 2026-02-22
- Tasks Complete: 15/17 (2 partial)
- Percentage: 88%
- Status: IN_PROGRESS

---

### T01: Extend execution types — new events and node state fields

- [x] Estimate: 30min
- [x] Tests: TypeScript compiles; no existing tests broken
- [x] Dependencies: None
- [x] Notes: `shared/types/execution.ts` — add `ExecutionEventType` values: `'tool_call'`,
       `'bash_command'`, `'agent_started'`, `'agent_completed'`, `'block_gate_open'`,
       `'block_revised'`. Add optional fields to `NodeExecutionState`: `revisionCount?: number`,
       `gateMode?: 'auto_continue' | 'gate'`. Add `EXECUTION_REVISE` to `ipc-channels.ts`.
- [x] Status: DONE

---

### T02: Add gateMode to AgentNodeConfig

- [x] Estimate: 15min
- [x] Tests: TypeScript compiles; existing workflow serialization tests pass
- [x] Dependencies: T01
- [x] Notes: `shared/types/workflow.ts` — add `gateMode?: 'auto_continue' | 'gate'` to
       `AgentNodeConfig`. Default must be `'auto_continue'` (backward-compatible). Update
       `DEFAULT_SETTINGS` if needed.
- [x] Status: DONE

---

### T03: Add eventFormatter utility

- [x] Estimate: 1hr
- [x] Tests: Unit tests in `test/renderer/utils/eventFormatter.test.ts` — one test per event type; pure function, no mocks needed
- [x] Dependencies: T01
- [x] Notes: `renderer/utils/eventFormatter.ts` — export `formatEvent(event: ExecutionEvent, nodeLabel?: string): FormattedEvent`.
       `FormattedEvent` shape: `{ timestamp: string, icon: string, text: string, nodeId?: string }`.
       Handles all `ExecutionEventType` values; unknown types fall back to `text = event.message`.
- [x] Status: DONE

---

### T04: Implement EventLogPanel component

- [x] Estimate: 1hr
- [x] Tests: Render test — given 3 events, shows 3 formatted entries; auto-scroll behavior tested with mock scroll
- [x] Dependencies: T03
- [x] Notes: `renderer/components/execution/EventLogPanel.tsx` — renders a scrollable list of
       `FormattedEvent` entries from `useExecutionStore(s => s.events)`. Uses a `useEffect` to
       auto-scroll a `ref` to bottom when events length changes. Filters by `nodeId` if a
       `filterNodeId` prop is provided.
- [x] Status: DONE

---

### T05: Implement ScrutinyLevelSelector component

- [x] Estimate: 30min
- [x] Tests: Render test — four segments rendered; clicking each calls `onChange` with correct level
- [x] Dependencies: None
- [x] Notes: `renderer/components/execution/ScrutinyLevelSelector.tsx` — segmented control with
       four options: `Summary`, `File List`, `Full Content`, `Full Detail`. Accepts `value` and
       `onChange` props. Maps to `ScrutinyLevel` type: `'summary' | 'file_list' | 'full_content' | 'full_detail'`.
       Tailwind styling consistent with existing UI (gray-800 background, blue-500 active).
- [x] Status: DONE

---

### T06: Implement DeliverablesViewer component

- [x] Estimate: 1.5hr
- [x] Tests: Render tests for each scrutiny level x plan block type; snapshot tests for markdown rendering
- [x] Dependencies: T05
- [x] Notes: `renderer/components/execution/DeliverablesViewer.tsx` — accepts `deliverables: BlockDeliverables | null`,
       `scrutinyLevel: ScrutinyLevel`, `blockType: string`. Renders:
       - Summary: `<p>{deliverables.summary ?? "No summary available"}</p>`
       - File List: `<ul>` of `FileEntry` with path + size/line count
       - Full Detail (plan): collapsible sections per doc (design.md, tasks.md, user_stories.md)
         rendered via a lightweight markdown renderer (use `react-markdown` — already likely in deps, or add it).
       Falls back gracefully when `deliverables` is null.
- [x] Status: DONE

---

### T07: Add EXECUTION_REVISE IPC handler and engine method

- [x] Estimate: 1.5hr
- [x] Tests: Integration test — mock engine receives revise call; `revisionCount` increments; `block_revised` event emitted
- [x] Dependencies: T01, T02
- [x] Notes: `main/ipc/execution-handlers.ts` — add handler for `EXECUTION_REVISE` channel.
       `main/services/execution-engine.ts` — add `reviseBlock(nodeId: string, feedback: string): void`
       that: checks node status is `waiting_gate`, appends feedback to the node's prompt, increments
       `revisionCount`, emits `block_revised` event, re-queues node for execution. Rejects if engine
       not in `waiting_gate` status.
- [x] Status: DONE

---

### T08: Emit tool_call and bash_command events from execution engine

- [~] Estimate: 1hr
- [ ] Tests: Unit test — mock agent output containing a tool use produces a `tool_call` event in the engine
- [~] Dependencies: T01
- [~] Notes: `main/services/execution-engine.ts` — parse `cli_output` event data for structured
       tool call patterns (JSON lines from Claude CLI `--output-format json`). When a tool use is
       detected in the stream, emit a `tool_call` event with `{tool, target}` extracted from the
       tool use JSON. Similarly emit `bash_command` for `Bash` tool calls.
- [~] Status: PARTIAL — Event emission framework exists but not fully wired to CLI output parsing

---

### T09: Implement ContinueReviseBar component

- [x] Estimate: 1hr
- [x] Tests: Render test — Continue triggers onContinue; Revise shows textarea; Submit disabled below 10 chars; Cancel hides textarea
- [x] Dependencies: None
- [x] Notes: `renderer/components/execution/ContinueReviseBar.tsx` — accepts `onContinue`, `onRevise(feedback: string)`,
       `revisionCount`. Renders: Continue button (always visible), Revise button (always visible),
       conditional textarea (appears when Revise clicked, hidden on Cancel or post-Submit).
       Submit disabled when `feedback.trim().length < 10`.
- [x] Status: DONE

---

### T10: Implement StepGatePanel component

- [x] Estimate: 1.5hr
- [x] Tests: Integration render test — given waiting_gate node with plan deliverables, all three scrutiny levels render correctly
- [x] Dependencies: T05, T06, T09
- [x] Notes: `renderer/components/execution/StepGatePanel.tsx` — composes `ScrutinyLevelSelector`,
       `DeliverablesViewer`, and `ContinueReviseBar`. Local state: `scrutinyLevel` (default Summary),
       `showReviseInput` (boolean). Accepts props: `node: NodeExecutionState`, `deliverables: BlockDeliverables | null`,
       `onContinue`, `onRevise`. Shows header with node label + revision badge.
- [x] Status: DONE

---

### T11: Add store actions: setScrutinyLevel and reviseBlock

- [x] Estimate: 30min
- [x] Tests: Store unit test — `reviseBlock` calls IPC and updates `lastError` on failure
- [x] Dependencies: T01, T07
- [x] Notes: `renderer/stores/executionStore.ts` — add `scrutinyLevel: ScrutinyLevel` (default
       `'summary'`), `setScrutinyLevel`, `reviseBlock(nodeId, feedback)` (calls
       `window.electronAPI.execution.revise(...)`, sets `lastError` on failure).
- [x] Status: DONE

---

### T12: Wire StepGatePanel into ExecutionDetailsPanel

- [x] Estimate: 1hr
- [x] Tests: E2E-style render test — when execution status is `waiting_gate`, Step Gate tab is active; clicking Continue calls store
- [x] Dependencies: T10, T11
- [x] Notes: `renderer/components/execution/ExecutionDetailsPanel.tsx` — add "Step Gate" tab.
       Tab is only shown when `execution.status === 'waiting_gate'`. When status becomes
       `waiting_gate`, auto-switch to this tab. Wire `onContinue` to `submitGateDecision` with
       `selectedOption: 'continue'`. Wire `onRevise` to `store.reviseBlock`. Pass node deliverables
       from `execution.nodeStates[currentNodeId].output` as `deliverables`.
- [x] Status: DONE — Known bugs tracked in GitHub issues #279 and #280

---

### T13: Enhance ExecutionCanvas — status colors, pulse, parallel layout

- [~] Estimate: 1.5hr
- [ ] Tests: Render test — active node has pulse class; completed node has green color; two parallel nodes rendered side by side
- [~] Dependencies: None
- [~] Notes: `renderer/components/execution/ExecutionCanvas.tsx` — add CSS keyframe for pulse
       animation (Tailwind `animate-pulse` or custom). Map `NodeExecutionStatus` to border/fill
       colors. Detect parallel branches from workflow edges (nodes with same target sharing a fork
       source) and apply dagre layout columns. Add `centerOnActiveNode` effect via React Flow
       `fitView` with `nodes` filter.
- [~] Status: PARTIAL — Canvas exists with status colors and pulse, but parallel layout (dagre columns) is incomplete

---

### T14: Implement DiffViewer stub component

- [x] Estimate: 30min
- [x] Tests: Render test — empty diffs array shows placeholder text; `onOpenInVSCode` prop accepted without error
- [x] Dependencies: None
- [x] Notes: `renderer/components/execution/DiffViewer.tsx` — renders placeholder when
       `diffs.length === 0`: "No changes to display. Code diff viewer coming soon." Accepts
       `diffs: FileDiff[]`, `mode: 'side_by_side' | 'unified'`, `onOpenInVSCode?: (path: string) => void`.
       Export from component barrel index. Comment with TODO noting react-diff-viewer-continued as
       the recommended library for the full implementation.
- [x] Status: DONE

---

---

### T15: Add `'full_detail'` to ScrutinyLevel type

- [x] Estimate: 15min
- [x] Tests: TypeScript compiles; no existing tests broken
- [x] Dependencies: T01
- [x] Notes: In `shared/types/execution.ts`, update `ScrutinyLevel` from
       `'summary' | 'file_list' | 'full_content'` to
       `'summary' | 'file_list' | 'full_content' | 'full_detail'`. The `full_content` level
       shows raw file contents; `full_detail` adds structured annotations, expanded sections,
       and full diff context. Update `DeliverablesViewer` (T06) to handle both levels.
- [x] Status: DONE

---

### T16: Add keyboard shortcuts for Continue/Revise actions

- [x] Estimate: 30min
- [x] Tests: Key event test — Ctrl+Enter triggers Continue; Ctrl+Shift+R toggles Revise textarea
- [x] Dependencies: T09
- [x] Notes: In `ContinueReviseBar.tsx`, add `useEffect` with `keydown` listener:
       - `Ctrl+Enter` (or `Cmd+Enter` on macOS): triggers `onContinue` when gate is active
       - `Ctrl+Shift+R` (or `Cmd+Shift+R`): toggles Revise textarea visibility
       Shortcuts only active when `StepGatePanel` is visible (gate status is `waiting_gate`).
- [x] Status: DONE

---

### T17: Add revision count cap and workflow-level default scrutiny

- [x] Estimate: 30min
- [x] Tests: Unit test — revision blocked after cap reached; default scrutiny read from workflow definition
- [x] Dependencies: T07, T02
- [x] Notes: Two small additions:
       1. **Revision cap:** In `reviseBlock()`, reject with error if `revisionCount >= 10`.
          Show user message: "Maximum revisions (10) reached. Please Continue or Abort."
       2. **Default scrutiny:** Add optional `defaultScrutinyLevel?: ScrutinyLevel` to
          `WorkflowDefinition`. If present, `executionStore` initializes `scrutinyLevel` from
          this value instead of `'summary'`. This allows template authors to set a default
          scrutiny preference per workflow.
- [x] Status: DONE

---

## Dependency Graph

```
T01 (types)
 ├── T02 (gateMode)
 │    └── T07 (revise IPC + engine)
 │         ├── T11 (store reviseBlock)
 │         │    └── T12 (wire gate into panel)
 │         └── T17 (revision cap + default scrutiny, also needs T02)
 ├── T03 (formatter)
 │    └── T04 (EventLogPanel)
 │         └── T12
 ├── T08 (tool_call events)
 └── T15 (add 'full_detail' to ScrutinyLevel)

T05 (scrutiny selector)
 └── T06 (deliverables viewer)
      └── T10 (StepGatePanel)
           └── T12 (wire gate into panel)

T09 (ContinueReviseBar)
 ├── T10
 └── T16 (keyboard shortcuts)

T13 (canvas) — independent
T14 (DiffViewer stub) — independent
```

## Suggested Implementation Order

**Phase 1 — Foundation (parallel):**
- T01, T05, T09, T13, T14

**Phase 2 — Event log and formatter:**
- T03 (after T01)
- T04 (after T03)
- T15 (after T01 — add 'full_detail' to ScrutinyLevel)

**Phase 3 — Gate flow:**
- T02 (after T01), T07 (after T02), T08 (after T01)
- T06 (after T05)
- T10 (after T05, T06, T09)
- T11 (after T01, T07)
- T16 (after T09 — keyboard shortcuts)

**Phase 4 — Wire up and polish:**
- T12 (after T04, T10, T11)
- T17 (after T07, T02 — revision cap + default scrutiny)
