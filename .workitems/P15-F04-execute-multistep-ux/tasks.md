---
id: P15-F04
parent_id: P15
type: tasks
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
---

# Tasks: Execute — Multi-Step Workflow UX (P15-F04)

## Progress

- Started: —
- Tasks Complete: 0/17
- Percentage: 0%
- Status: PENDING

---

### T01: Extend execution types — new events and node state fields

- [ ] Estimate: 30min
- [ ] Tests: TypeScript compiles; no existing tests broken
- [ ] Dependencies: None
- [ ] Notes: `shared/types/execution.ts` — add `ExecutionEventType` values: `'tool_call'`,
       `'bash_command'`, `'agent_started'`, `'agent_completed'`, `'block_gate_open'`,
       `'block_revised'`. Add optional fields to `NodeExecutionState`: `revisionCount?: number`,
       `gateMode?: 'auto_continue' | 'gate'`. Add `EXECUTION_REVISE` to `ipc-channels.ts`.

---

### T02: Add gateMode to AgentNodeConfig

- [ ] Estimate: 15min
- [ ] Tests: TypeScript compiles; existing workflow serialization tests pass
- [ ] Dependencies: T01
- [ ] Notes: `shared/types/workflow.ts` — add `gateMode?: 'auto_continue' | 'gate'` to
       `AgentNodeConfig`. Default must be `'auto_continue'` (backward-compatible). Update
       `DEFAULT_SETTINGS` if needed.

---

### T03: Add eventFormatter utility

- [ ] Estimate: 1hr
- [ ] Tests: Unit tests in `test/renderer/utils/eventFormatter.test.ts` — one test per event type; pure function, no mocks needed
- [ ] Dependencies: T01
- [ ] Notes: `renderer/utils/eventFormatter.ts` — export `formatEvent(event: ExecutionEvent, nodeLabel?: string): FormattedEvent`.
       `FormattedEvent` shape: `{ timestamp: string, icon: string, text: string, nodeId?: string }`.
       Handles all `ExecutionEventType` values; unknown types fall back to `text = event.message`.

---

### T04: Implement EventLogPanel component

- [ ] Estimate: 1hr
- [ ] Tests: Render test — given 3 events, shows 3 formatted entries; auto-scroll behavior tested with mock scroll
- [ ] Dependencies: T03
- [ ] Notes: `renderer/components/execution/EventLogPanel.tsx` — renders a scrollable list of
       `FormattedEvent` entries from `useExecutionStore(s => s.events)`. Uses a `useEffect` to
       auto-scroll a `ref` to bottom when events length changes. Filters by `nodeId` if a
       `filterNodeId` prop is provided.

---

### T05: Implement ScrutinyLevelSelector component

- [ ] Estimate: 30min
- [ ] Tests: Render test — four segments rendered; clicking each calls `onChange` with correct level
- [ ] Dependencies: None
- [ ] Notes: `renderer/components/execution/ScrutinyLevelSelector.tsx` — segmented control with
       four options: `Summary`, `File List`, `Full Content`, `Full Detail`. Accepts `value` and
       `onChange` props. Maps to `ScrutinyLevel` type: `'summary' | 'file_list' | 'full_content' | 'full_detail'`.
       Tailwind styling consistent with existing UI (gray-800 background, blue-500 active).

---

### T06: Implement DeliverablesViewer component

- [ ] Estimate: 1.5hr
- [ ] Tests: Render tests for each scrutiny level × plan block type; snapshot tests for markdown rendering
- [ ] Dependencies: T05
- [ ] Notes: `renderer/components/execution/DeliverablesViewer.tsx` — accepts `deliverables: BlockDeliverables | null`,
       `scrutinyLevel: ScrutinyLevel`, `blockType: string`. Renders:
       - Summary: `<p>{deliverables.summary ?? "No summary available"}</p>`
       - File List: `<ul>` of `FileEntry` with path + size/line count
       - Full Detail (plan): collapsible sections per doc (design.md, tasks.md, user_stories.md)
         rendered via a lightweight markdown renderer (use `react-markdown` — already likely in deps, or add it).
       Falls back gracefully when `deliverables` is null.

---

### T07: Add EXECUTION_REVISE IPC handler and engine method

- [ ] Estimate: 1.5hr
- [ ] Tests: Integration test — mock engine receives revise call; `revisionCount` increments; `block_revised` event emitted
- [ ] Dependencies: T01, T02
- [ ] Notes: `main/ipc/execution-handlers.ts` — add handler for `EXECUTION_REVISE` channel.
       `main/services/execution-engine.ts` — add `reviseBlock(nodeId: string, feedback: string): void`
       that: checks node status is `waiting_gate`, appends feedback to the node's prompt, increments
       `revisionCount`, emits `block_revised` event, re-queues node for execution. Rejects if engine
       not in `waiting_gate` status.

---

### T08: Emit tool_call and bash_command events from execution engine

- [ ] Estimate: 1hr
- [ ] Tests: Unit test — mock agent output containing a tool use produces a `tool_call` event in the engine
- [ ] Dependencies: T01
- [ ] Notes: `main/services/execution-engine.ts` — parse `cli_output` event data for structured
       tool call patterns (JSON lines from Claude CLI `--output-format json`). When a tool use is
       detected in the stream, emit a `tool_call` event with `{tool, target}` extracted from the
       tool use JSON. Similarly emit `bash_command` for `Bash` tool calls.

---

### T09: Implement ContinueReviseBar component

- [ ] Estimate: 1hr
- [ ] Tests: Render test — Continue triggers onContinue; Revise shows textarea; Submit disabled below 10 chars; Cancel hides textarea
- [ ] Dependencies: None
- [ ] Notes: `renderer/components/execution/ContinueReviseBar.tsx` — accepts `onContinue`, `onRevise(feedback: string)`,
       `revisionCount`. Renders: Continue button (always visible), Revise button (always visible),
       conditional textarea (appears when Revise clicked, hidden on Cancel or post-Submit).
       Submit disabled when `feedback.trim().length < 10`.

---

### T10: Implement StepGatePanel component

- [ ] Estimate: 1.5hr
- [ ] Tests: Integration render test — given waiting_gate node with plan deliverables, all three scrutiny levels render correctly
- [ ] Dependencies: T05, T06, T09
- [ ] Notes: `renderer/components/execution/StepGatePanel.tsx` — composes `ScrutinyLevelSelector`,
       `DeliverablesViewer`, and `ContinueReviseBar`. Local state: `scrutinyLevel` (default Summary),
       `showReviseInput` (boolean). Accepts props: `node: NodeExecutionState`, `deliverables: BlockDeliverables | null`,
       `onContinue`, `onRevise`. Shows header with node label + revision badge.

---

### T11: Add store actions: setScrutinyLevel and reviseBlock

- [ ] Estimate: 30min
- [ ] Tests: Store unit test — `reviseBlock` calls IPC and updates `lastError` on failure
- [ ] Dependencies: T01, T07
- [ ] Notes: `renderer/stores/executionStore.ts` — add `scrutinyLevel: ScrutinyLevel` (default
       `'summary'`), `setScrutinyLevel`, `reviseBlock(nodeId, feedback)` (calls
       `window.electronAPI.execution.revise(...)`, sets `lastError` on failure).

---

### T12: Wire StepGatePanel into ExecutionDetailsPanel

- [ ] Estimate: 1hr
- [ ] Tests: E2E-style render test — when execution status is `waiting_gate`, Step Gate tab is active; clicking Continue calls store
- [ ] Dependencies: T10, T11
- [ ] Notes: `renderer/components/execution/ExecutionDetailsPanel.tsx` — add "Step Gate" tab.
       Tab is only shown when `execution.status === 'waiting_gate'`. When status becomes
       `waiting_gate`, auto-switch to this tab. Wire `onContinue` to `submitGateDecision` with
       `selectedOption: 'continue'`. Wire `onRevise` to `store.reviseBlock`. Pass node deliverables
       from `execution.nodeStates[currentNodeId].output` as `deliverables`.

---

### T13: Enhance ExecutionCanvas — status colors, pulse, parallel layout

- [ ] Estimate: 1.5hr
- [ ] Tests: Render test — active node has pulse class; completed node has green color; two parallel nodes rendered side by side
- [ ] Dependencies: None
- [ ] Notes: `renderer/components/execution/ExecutionCanvas.tsx` — add CSS keyframe for pulse
       animation (Tailwind `animate-pulse` or custom). Map `NodeExecutionStatus` to border/fill
       colors. Detect parallel branches from workflow edges (nodes with same target sharing a fork
       source) and apply dagre layout columns. Add `centerOnActiveNode` effect via React Flow
       `fitView` with `nodes` filter.

---

### T14: Implement DiffViewer stub component

- [ ] Estimate: 30min
- [ ] Tests: Render test — empty diffs array shows placeholder text; `onOpenInVSCode` prop accepted without error
- [ ] Dependencies: None
- [ ] Notes: `renderer/components/execution/DiffViewer.tsx` — renders placeholder when
       `diffs.length === 0`: "No changes to display. Code diff viewer coming soon." Accepts
       `diffs: FileDiff[]`, `mode: 'side_by_side' | 'unified'`, `onOpenInVSCode?: (path: string) => void`.
       Export from component barrel index. Comment with TODO noting react-diff-viewer-continued as
       the recommended library for the full implementation.

---

---

### T15: Add `'full_detail'` to ScrutinyLevel type

- [ ] Estimate: 15min
- [ ] Tests: TypeScript compiles; no existing tests broken
- [ ] Dependencies: T01
- [ ] Notes: In `shared/types/execution.ts`, update `ScrutinyLevel` from
       `'summary' | 'file_list' | 'full_content'` to
       `'summary' | 'file_list' | 'full_content' | 'full_detail'`. The `full_content` level
       shows raw file contents; `full_detail` adds structured annotations, expanded sections,
       and full diff context. Update `DeliverablesViewer` (T06) to handle both levels.

---

### T16: Add keyboard shortcuts for Continue/Revise actions

- [ ] Estimate: 30min
- [ ] Tests: Key event test — Ctrl+Enter triggers Continue; Ctrl+Shift+R toggles Revise textarea
- [ ] Dependencies: T09
- [ ] Notes: In `ContinueReviseBar.tsx`, add `useEffect` with `keydown` listener:
       - `Ctrl+Enter` (or `Cmd+Enter` on macOS): triggers `onContinue` when gate is active
       - `Ctrl+Shift+R` (or `Cmd+Shift+R`): toggles Revise textarea visibility
       Shortcuts only active when `StepGatePanel` is visible (gate status is `waiting_gate`).

---

### T17: Add revision count cap and workflow-level default scrutiny

- [ ] Estimate: 30min
- [ ] Tests: Unit test — revision blocked after cap reached; default scrutiny read from workflow definition
- [ ] Dependencies: T07, T02
- [ ] Notes: Two small additions:
       1. **Revision cap:** In `reviseBlock()`, reject with error if `revisionCount >= 10`.
          Show user message: "Maximum revisions (10) reached. Please Continue or Abort."
       2. **Default scrutiny:** Add optional `defaultScrutinyLevel?: ScrutinyLevel` to
          `WorkflowDefinition`. If present, `executionStore` initializes `scrutinyLevel` from
          this value instead of `'summary'`. This allows template authors to set a default
          scrutiny preference per workflow.

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
