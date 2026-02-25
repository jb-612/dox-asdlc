---
id: P15-F01
parent_id: P15
type: tasks
version: 1
status: complete
constraints_hash: null
created_by: planner
created_at: "2026-02-22T00:00:00Z"
updated_at: "2026-02-22T00:00:00Z"
dependencies:
  - P14-F03
  - P14-F07
tags:
  - studio
  - block-composer
---

# Tasks: Studio Block Composer (P15-F01)

## Progress

- Started: 2026-02-22
- Tasks Complete: 13/14 (T06 moved to P15-F05)
- Percentage: 100% (of applicable tasks)
- Status: COMPLETE

---

## Phase 1: Type System Extensions (T01–T04)

### T01: Extend `AgentNodeConfig` with prompt harness fields

- [x] Estimate: 30min
- [x] Tests: TypeScript compiles clean; existing tests unaffected
- [x] Dependencies: None
- [x] Agent: backend
- [x] Files: `apps/workflow-studio/src/shared/types/workflow.ts`
- [x] Notes: Add optional fields `systemPromptPrefix?: string` and `outputChecklist?: string[]`
       to `AgentNodeConfig`. All new fields must be optional (backward compatibility). No
       runtime logic change here — types only.

---

### T02: Extend `WorkflowDefinition` with `rules` and `parallelGroups`

- [x] Estimate: 30min
- [x] Tests: TypeScript compiles clean; existing tests unaffected
- [x] Dependencies: None
- [x] Agent: backend
- [x] Files: `apps/workflow-studio/src/shared/types/workflow.ts`
- [x] Notes: Add `rules?: string[]` and `parallelGroups?: ParallelGroup[]` to
       `WorkflowDefinition`. Define the `ParallelGroup` interface: `{ id: string; label: string; laneNodeIds: string[] }`.
       Export `BlockType` discriminant union: `'plan' | 'dev' | 'test' | 'review' | 'devops'`.

---

### T03: Add `BLOCK_TYPE_METADATA` to `constants.ts`

- [x] Estimate: 30min
- [x] Tests: TypeScript compiles clean
- [x] Dependencies: T01, T02
- [x] Agent: backend
- [x] Files: `apps/workflow-studio/src/shared/constants.ts`
- [x] Notes: Add a `BLOCK_TYPE_METADATA` record mapping `BlockType` to
       `{ agentNodeType: AgentNodeType; label: string; description: string; icon: string; defaultSystemPromptPrefix: string; defaultOutputChecklist: string[] }`.
       Phase 1 populates `plan` fully; stubs for `dev`, `test`, `review`, `devops`
       (no default harness values needed yet).

---

### T04: Update Zod schema for new workflow fields

- [x] Estimate: 45min
- [x] Tests: Existing schema tests still pass; new optional fields accepted; old workflows parse without error
- [x] Dependencies: T01, T02
- [x] Agent: backend
- [x] Files: `apps/workflow-studio/src/main/schemas/workflow-schema.ts`
- [x] Notes: Add `.optional()` Zod entries for `systemPromptPrefix`, `outputChecklist`,
       `rules`, and `parallelGroups` in the appropriate sub-schemas. Ensure
       `WorkflowDefinitionSchema.safeParse()` accepts both old (missing fields) and new
       (fields present) payloads.

---

## Phase 2: Execution Engine Extensions (T05–T06)

### T05: Inject prompt harness in execution engine

- [x] Estimate: 1.5hr
- [x] Tests: Unit tests: 4 new cases -- prefix only, checklist only, both, neither
- [x] Dependencies: T01, T02
- [x] Agent: backend
- [x] Files: `apps/workflow-studio/src/main/services/execution-engine.ts`
- [x] Notes: Add private `buildSystemPrompt(node: AgentNode, workflowRules: string[]): string`
       method that composes:
       `[Rules section]\n\n[systemPromptPrefix]\n\n[task instruction]\n\n[outputChecklist numbered list]`
       Call this method in both `executeNodeReal()` and `executeNodeRemote()` to pass the
       composed prompt. Backward compatible: if no harness fields, output equals the
       existing task instruction string.

---

### T06: ~~Parallel group dispatch in execution engine~~ -- MOVED TO P15-F05

- [x] Estimate: N/A (moved)
- [x] Tests: N/A
- [x] Dependencies: N/A
- [x] Agent: N/A
- [x] Files: N/A
- [x] Notes: **MOVED TO P15-F05 (Parallel Execution Engine).** F01 only defines the
       `ParallelGroup` data model and Studio UI. Parallel dispatch logic belongs in F05.
       See P15-F05 tasks for the implementation task.

---

## Phase 3: State Store Extensions (T07)

### T07: Add Studio actions to `workflowStore`

- [x] Estimate: 1hr
- [x] Tests: Zustand store unit tests for each new action
- [x] Dependencies: T01, T02
- [x] Agent: frontend
- [x] Files: `apps/workflow-studio/src/renderer/stores/workflowStore.ts`
- [x] Notes: Add actions:
       - `setNodeSystemPromptPrefix(nodeId, prefix)`
       - `setNodeOutputChecklist(nodeId, checklist)`
       - `setNodeBackend(nodeId, backend)`
       - `addWorkflowRule(rule)` / `removeWorkflowRule(index)`
       - `addParallelGroup(nodeIds)` / `removeParallelGroup(groupId)`
       - `addNodeToParallelGroup(groupId, nodeId)` / `removeNodeFromParallelGroup(groupId, nodeId)`
       All actions are immutable updates (replace, not mutate).

---

## Phase 4: Studio UI Components (T08–T10)

### T08: Create `BlockPalette` and `BlockConfigPanel` components

- [x] Estimate: 2hr
- [x] Tests: Render tests -- palette shows Plan block card; config panel renders harness fields
- [x] Dependencies: T03, T07
- [x] Agent: frontend
- [x] Files:
       - `apps/workflow-studio/src/renderer/components/studio/BlockPalette.tsx`
       - `apps/workflow-studio/src/renderer/components/studio/BlockConfigPanel.tsx`
       - `apps/workflow-studio/src/renderer/components/studio/PromptHarnessEditor.tsx`
       - `apps/workflow-studio/src/renderer/components/studio/AgentBackendSelector.tsx`
- [x] Notes: `BlockPalette` renders a draggable card per `BlockType` (Phase 1: Plan only).
       On drag start, sets drag data to `{ blockType: 'plan' }`. `BlockConfigPanel` renders
       when a node is selected: two-part harness editor (textarea + list editor) and backend
       radio selector. `AgentBackendSelector` shows "Claude Code (Docker)" and "Cursor CLI
       (Docker)" options. Model name sourced from settings store (read-only display).

---

### T09: Create `StudioCanvas` with parallel lane overlay and `WorkflowRulesBar`

- [x] Estimate: 2hr
- [x] Tests: Render tests -- canvas mounts; rules bar add/remove; parallel lane visible
- [x] Dependencies: T07, T08
- [x] Agent: frontend
- [x] Files:
       - `apps/workflow-studio/src/renderer/components/studio/StudioCanvas.tsx`
       - `apps/workflow-studio/src/renderer/components/studio/WorkflowRulesBar.tsx`
       - `apps/workflow-studio/src/renderer/components/studio/ParallelLaneOverlay.tsx`
- [x] Notes: `StudioCanvas` wraps the existing `ReactFlowCanvas`. On drop from palette,
       creates a new node via `workflowStore.addNode()` with defaults from `BLOCK_TYPE_METADATA`.
       Right-click on selected nodes shows context menu with "Group as parallel" option.
       `ParallelLaneOverlay` renders a semi-transparent colored rectangle behind nodes in
       each `parallelGroup` (use ReactFlow's `Background` layer or absolute positioning).
       `WorkflowRulesBar` renders above the canvas: tag-style input to add rules, × buttons
       to remove. Reads/writes via store actions from T07.

---

### T10: Create `StudioPage` and wire navigation

- [x] Estimate: 1.5hr
- [x] Tests: Render test -- page mounts; Save as Template dialog opens and submits
- [x] Dependencies: T08, T09
- [x] Agent: frontend
- [x] Files:
       - `apps/workflow-studio/src/renderer/pages/StudioPage.tsx`
       - (update) `apps/workflow-studio/src/renderer/App.tsx` or nav config for new route
- [x] Notes: `StudioPage` composes: `WorkflowRulesBar` (top) + `BlockPalette` (left) +
       `StudioCanvas` (center) + `BlockConfigPanel` (right). "Save as Template" button in
       top-right opens a name-input dialog; on confirm calls `window.electron.workflowSave()`
       with `tags: ['studio-block-composer']`. Add a "Studio" tab to the existing navigation
       sidebar/tab bar. If a `templateId` query param is present, load that workflow on mount.

---

## Phase 5: Template Integration and Tests (T11–T12)

### T11: Add "Edit in Studio" action to `TemplateManagerPage`

- [x] Estimate: 1hr
- [x] Tests: Render test -- "Edit in Studio" button appears only for Studio-tagged templates
- [x] Dependencies: T10
- [x] Agent: frontend
- [x] Files: `apps/workflow-studio/src/renderer/pages/TemplateManagerPage.tsx`
- [x] Notes: For templates with tag `"studio-block-composer"`, show an "Edit in Studio"
       button alongside the existing "Edit" (DesignerPage) button. Navigates to
       `/studio?templateId=<id>`. If the template lacks the studio tag, only the existing
       Designer edit button is shown (no change to existing templates).

---

### T12: Integration test -- Studio workflow round-trip

- [x] Estimate: 1.5hr
- [x] Tests: Integration test covering: create Plan block, configure harness, set rules, save, reload, execute
- [x] Dependencies: T05, T10, T11 (T06 moved to F05)
- [x] Agent: backend
- [x] Files: `apps/workflow-studio/test/integration/studio-round-trip.test.ts`
- [x] Notes: Verify end-to-end: (1) a WorkflowDefinition with `systemPromptPrefix`,
       `outputChecklist`, `rules`, and a `parallelGroup` serializes correctly, (2) the
       Zod schema validates it, (3) the execution engine builds the correct system prompt,
       (4) parallel nodes dispatch simultaneously (mock engine). Does not require a live
       agent connection.

---

## Phase 1 Addition: Routing (T13)

### T13: Add `/studio` route to App.tsx with sidebar entry

- [x] Estimate: 30min
- [x] Tests: Route renders StudioPage; sidebar shows "Studio" entry
- [x] Dependencies: T10
- [x] Agent: frontend
- [x] Files: `apps/workflow-studio/src/renderer/App.tsx`
- [x] Notes: Add `/studio` route that renders `StudioPage`. StudioPage coexists with
       DesignerPage — DesignerPage stays at `/`, StudioPage lives at `/studio`. Add "Studio"
       entry to the navigation sidebar. When F02 "Edit" is clicked, route to `/studio` if
       template has `studio-block-composer` tag, else route to `/` (designer).

---

## Phase 3 Addition: Provider Availability (T14)

### T14: Add F08-to-F01 provider availability interface

- [x] Estimate: 1hr
- [x] Tests: AgentBackendSelector shows configured vs unconfigured providers; unconfigured providers show "not configured" badge
- [x] Dependencies: T08, P15-F08 (settings store)
- [x] Agent: frontend
- [x] Files: `apps/workflow-studio/src/renderer/components/studio/AgentBackendSelector.tsx`
- [x] Notes: `AgentBackendSelector` reads `settingsStore.getConfiguredProviders()` from
       F08's settings store to determine which backends (claude, cursor, codex) have valid
       API keys configured. Show configured providers as selectable, unconfigured providers
       as grayed out with a "not configured" badge linking to Settings. This task depends
       on F08 settings store being available.

---

## Dependency Graph

```
T01 ──┐
T02 ──┼── T03 ── T08 ──┬── T09 ── T10 ── T11
      │                 │                  │
      ├── T04 ── T05   │                  └── T13 (route)
                        │
T06 — MOVED TO F05      │
                        │
T07 (depends T01, T02) → T08, T09

T12 (depends T05, T10, T11)
T14 (depends T08, P15-F08)
```

## Parallel Execution Plan

| Parallel batch | Tasks | Agent |
|----------------|-------|-------|
| Batch 1 | T01, T02 | backend |
| Batch 2 | T03, T04, T07 | backend (T03, T04), frontend (T07) |
| Batch 3 | T05 | backend |
| Batch 4 | T08, T09 | frontend (both) |
| Batch 5 | T10, T11 | frontend (both) |
| Batch 6 | T13 | frontend |
| Batch 7 | T12 | backend |
| Batch 8 | T14 (after F08) | frontend |
