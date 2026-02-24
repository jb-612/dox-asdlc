---
id: P15-F01
parent_id: P15
type: tasks
version: 1
status: draft
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

- Started: —
- Tasks Complete: 0/14
- Percentage: 0%
- Status: PLANNING

---

## Phase 1: Type System Extensions (T01–T04)

### T01: Extend `AgentNodeConfig` with prompt harness fields

- [ ] Estimate: 30min
- [ ] Tests: TypeScript compiles clean; existing tests unaffected
- [ ] Dependencies: None
- [ ] Agent: backend
- [ ] Files: `apps/workflow-studio/src/shared/types/workflow.ts`
- [ ] Notes: Add optional fields `systemPromptPrefix?: string` and `outputChecklist?: string[]`
       to `AgentNodeConfig`. All new fields must be optional (backward compatibility). No
       runtime logic change here — types only.

---

### T02: Extend `WorkflowDefinition` with `rules` and `parallelGroups`

- [ ] Estimate: 30min
- [ ] Tests: TypeScript compiles clean; existing tests unaffected
- [ ] Dependencies: None
- [ ] Agent: backend
- [ ] Files: `apps/workflow-studio/src/shared/types/workflow.ts`
- [ ] Notes: Add `rules?: string[]` and `parallelGroups?: ParallelGroup[]` to
       `WorkflowDefinition`. Define the `ParallelGroup` interface: `{ id: string; label: string; laneNodeIds: string[] }`.
       Export `BlockType` discriminant union: `'plan' | 'dev' | 'test' | 'review' | 'devops'`.

---

### T03: Add `BLOCK_TYPE_METADATA` to `constants.ts`

- [ ] Estimate: 30min
- [ ] Tests: TypeScript compiles clean
- [ ] Dependencies: T01, T02
- [ ] Agent: backend
- [ ] Files: `apps/workflow-studio/src/shared/constants.ts`
- [ ] Notes: Add a `BLOCK_TYPE_METADATA` record mapping `BlockType` to
       `{ agentNodeType: AgentNodeType; label: string; description: string; icon: string; defaultSystemPromptPrefix: string; defaultOutputChecklist: string[] }`.
       Phase 1 populates `plan` fully; stubs for `dev`, `test`, `review`, `devops`
       (no default harness values needed yet).

---

### T04: Update Zod schema for new workflow fields

- [ ] Estimate: 45min
- [ ] Tests: Existing schema tests still pass; new optional fields accepted; old workflows parse without error
- [ ] Dependencies: T01, T02
- [ ] Agent: backend
- [ ] Files: `apps/workflow-studio/src/main/schemas/workflow-schema.ts`
- [ ] Notes: Add `.optional()` Zod entries for `systemPromptPrefix`, `outputChecklist`,
       `rules`, and `parallelGroups` in the appropriate sub-schemas. Ensure
       `WorkflowDefinitionSchema.safeParse()` accepts both old (missing fields) and new
       (fields present) payloads.

---

## Phase 2: Execution Engine Extensions (T05–T06)

### T05: Inject prompt harness in execution engine

- [ ] Estimate: 1.5hr
- [ ] Tests: Unit tests: 4 new cases — prefix only, checklist only, both, neither
- [ ] Dependencies: T01, T02
- [ ] Agent: backend
- [ ] Files: `apps/workflow-studio/src/main/services/execution-engine.ts`
- [ ] Notes: Add private `buildSystemPrompt(node: AgentNode, workflowRules: string[]): string`
       method that composes:
       `[Rules section]\n\n[systemPromptPrefix]\n\n[task instruction]\n\n[outputChecklist numbered list]`
       Call this method in both `executeNodeReal()` and `executeNodeRemote()` to pass the
       composed prompt. Backward compatible: if no harness fields, output equals the
       existing task instruction string.

---

### T06: ~~Parallel group dispatch in execution engine~~ — MOVED TO P15-F05

- [x] Estimate: N/A (moved)
- [ ] Tests: N/A
- [ ] Dependencies: N/A
- [ ] Agent: N/A
- [ ] Files: N/A
- [ ] Notes: **MOVED TO P15-F05 (Parallel Execution Engine).** F01 only defines the
       `ParallelGroup` data model and Studio UI. Parallel dispatch logic belongs in F05.
       See P15-F05 tasks for the implementation task.

---

## Phase 3: State Store Extensions (T07)

### T07: Add Studio actions to `workflowStore`

- [ ] Estimate: 1hr
- [ ] Tests: Zustand store unit tests for each new action
- [ ] Dependencies: T01, T02
- [ ] Agent: frontend
- [ ] Files: `apps/workflow-studio/src/renderer/stores/workflowStore.ts`
- [ ] Notes: Add actions:
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

- [ ] Estimate: 2hr
- [ ] Tests: Render tests — palette shows Plan block card; config panel renders harness fields
- [ ] Dependencies: T03, T07
- [ ] Agent: frontend
- [ ] Files:
       - `apps/workflow-studio/src/renderer/components/studio/BlockPalette.tsx`
       - `apps/workflow-studio/src/renderer/components/studio/BlockConfigPanel.tsx`
       - `apps/workflow-studio/src/renderer/components/studio/PromptHarnessEditor.tsx`
       - `apps/workflow-studio/src/renderer/components/studio/AgentBackendSelector.tsx`
- [ ] Notes: `BlockPalette` renders a draggable card per `BlockType` (Phase 1: Plan only).
       On drag start, sets drag data to `{ blockType: 'plan' }`. `BlockConfigPanel` renders
       when a node is selected: two-part harness editor (textarea + list editor) and backend
       radio selector. `AgentBackendSelector` shows "Claude Code (Docker)" and "Cursor CLI
       (Docker)" options. Model name sourced from settings store (read-only display).

---

### T09: Create `StudioCanvas` with parallel lane overlay and `WorkflowRulesBar`

- [ ] Estimate: 2hr
- [ ] Tests: Render tests — canvas mounts; rules bar add/remove; parallel lane visible
- [ ] Dependencies: T07, T08
- [ ] Agent: frontend
- [ ] Files:
       - `apps/workflow-studio/src/renderer/components/studio/StudioCanvas.tsx`
       - `apps/workflow-studio/src/renderer/components/studio/WorkflowRulesBar.tsx`
       - `apps/workflow-studio/src/renderer/components/studio/ParallelLaneOverlay.tsx`
- [ ] Notes: `StudioCanvas` wraps the existing `ReactFlowCanvas`. On drop from palette,
       creates a new node via `workflowStore.addNode()` with defaults from `BLOCK_TYPE_METADATA`.
       Right-click on selected nodes shows context menu with "Group as parallel" option.
       `ParallelLaneOverlay` renders a semi-transparent colored rectangle behind nodes in
       each `parallelGroup` (use ReactFlow's `Background` layer or absolute positioning).
       `WorkflowRulesBar` renders above the canvas: tag-style input to add rules, × buttons
       to remove. Reads/writes via store actions from T07.

---

### T10: Create `StudioPage` and wire navigation

- [ ] Estimate: 1.5hr
- [ ] Tests: Render test — page mounts; Save as Template dialog opens and submits
- [ ] Dependencies: T08, T09
- [ ] Agent: frontend
- [ ] Files:
       - `apps/workflow-studio/src/renderer/pages/StudioPage.tsx`
       - (update) `apps/workflow-studio/src/renderer/App.tsx` or nav config for new route
- [ ] Notes: `StudioPage` composes: `WorkflowRulesBar` (top) + `BlockPalette` (left) +
       `StudioCanvas` (center) + `BlockConfigPanel` (right). "Save as Template" button in
       top-right opens a name-input dialog; on confirm calls `window.electron.workflowSave()`
       with `tags: ['studio-block-composer']`. Add a "Studio" tab to the existing navigation
       sidebar/tab bar. If a `templateId` query param is present, load that workflow on mount.

---

## Phase 5: Template Integration and Tests (T11–T12)

### T11: Add "Edit in Studio" action to `TemplateManagerPage`

- [ ] Estimate: 1hr
- [ ] Tests: Render test — "Edit in Studio" button appears only for Studio-tagged templates
- [ ] Dependencies: T10
- [ ] Agent: frontend
- [ ] Files: `apps/workflow-studio/src/renderer/pages/TemplateManagerPage.tsx`
- [ ] Notes: For templates with tag `"studio-block-composer"`, show an "Edit in Studio"
       button alongside the existing "Edit" (DesignerPage) button. Navigates to
       `/studio?templateId=<id>`. If the template lacks the studio tag, only the existing
       Designer edit button is shown (no change to existing templates).

---

### T12: Integration test — Studio workflow round-trip

- [ ] Estimate: 1.5hr
- [ ] Tests: Integration test covering: create Plan block → configure harness → set rules → save → reload → execute
- [ ] Dependencies: T05, T06, T10, T11
- [ ] Agent: backend
- [ ] Files: `apps/workflow-studio/test/integration/studio-round-trip.test.ts`
- [ ] Notes: Verify end-to-end: (1) a WorkflowDefinition with `systemPromptPrefix`,
       `outputChecklist`, `rules`, and a `parallelGroup` serializes correctly, (2) the
       Zod schema validates it, (3) the execution engine builds the correct system prompt,
       (4) parallel nodes dispatch simultaneously (mock engine). Does not require a live
       agent connection.

---

## Phase 1 Addition: Routing (T13)

### T13: Add `/studio` route to App.tsx with sidebar entry

- [ ] Estimate: 30min
- [ ] Tests: Route renders StudioPage; sidebar shows "Studio" entry
- [ ] Dependencies: T10
- [ ] Agent: frontend
- [ ] Files: `apps/workflow-studio/src/renderer/App.tsx`
- [ ] Notes: Add `/studio` route that renders `StudioPage`. StudioPage coexists with
       DesignerPage — DesignerPage stays at `/`, StudioPage lives at `/studio`. Add "Studio"
       entry to the navigation sidebar. When F02 "Edit" is clicked, route to `/studio` if
       template has `studio-block-composer` tag, else route to `/` (designer).

---

## Phase 3 Addition: Provider Availability (T14)

### T14: Add F08-to-F01 provider availability interface

- [ ] Estimate: 1hr
- [ ] Tests: AgentBackendSelector shows configured vs unconfigured providers; unconfigured providers show "not configured" badge
- [ ] Dependencies: T08, P15-F08 (settings store)
- [ ] Agent: frontend
- [ ] Files: `apps/workflow-studio/src/renderer/components/studio/AgentBackendSelector.tsx`
- [ ] Notes: `AgentBackendSelector` reads `settingsStore.getConfiguredProviders()` from
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
