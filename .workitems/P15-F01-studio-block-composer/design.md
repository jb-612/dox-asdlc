---
id: P15-F01
parent_id: P15
type: design
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
  - canvas
  - workflow
---

# Design: Studio Block Composer (P15-F01)

## Overview

The Studio Block Composer gives users a higher-level, opinionated composition experience
on top of the existing workflow engine. Instead of raw agent nodes, users drag **blocks**
(curated node presets) onto a visual canvas, configure each block's **prompt harness** and
**agent backend**, arrange blocks in **sequential or parallel tracks**, attach **workflow-level
rules**, and save the result as a named template.

Phase 1 ships the **Plan block** only. Future blocks (Dev, Test, Review, DevOps) are designed
here but their tasks are deferred.

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| P14-F03 (Workflow Designer Canvas) | Internal | ReactFlow canvas, workflowStore, DesignerPage layout |
| P14-F07 (Cursor CLI Backend) | Internal | `backend: 'cursor'` field on AgentNodeConfig |
| `apps/workflow-studio/src/shared/types/workflow.ts` | Source | Existing type system to extend |
| `apps/workflow-studio/src/renderer/pages/DesignerPage.tsx` | Source | Existing canvas page to adapt |
| ReactFlow 11 | External | Already bundled |

## Architecture

```
Renderer Process                           Main Process / IPC
┌─────────────────────────────────────┐   ┌────────────────────────────────┐
│  StudioPage (new)                   │   │  workflow-handlers.ts           │
│  ┌─────────────────────────────┐   │   │  (existing save/load — no       │
│  │  BlockPalette               │   │   │   change needed for Phase 1)    │
│  │  Plan | Dev* | Test* | ...  │   │   └────────────────────────────────┘
│  └────────────┬────────────────┘   │
│               │ drag                │   Shared Types
│  ┌────────────▼────────────────┐   │   ┌────────────────────────────────┐
│  │  StudioCanvas               │   │   │  workflow.ts                   │
│  │  (ReactFlow canvas)         │   │   │  + systemPromptPrefix          │
│  │  Sequential flow (top-down) │   │   │  + outputChecklist             │
│  │  Parallel lanes (side lanes)│   │   │  + rules (WorkflowDefinition)  │
│  └────────────┬────────────────┘   │   │  + parallelGroups              │
│               │ select              │   └────────────────────────────────┘
│  ┌────────────▼────────────────┐   │
│  │  BlockConfigPanel           │   │   *Future blocks (deferred tasks)
│  │  PromptHarness editor       │   │
│  │  AgentBackendSelector       │   │
│  │  Model info (read-only)     │   │
│  └─────────────────────────────┘   │
│                                     │
│  WorkflowRulesBar (top bar)         │
│  SaveAsTemplateButton               │
└─────────────────────────────────────┘
```

## Data Model Extensions

### `AgentNodeConfig` (extended)

```typescript
interface AgentNodeConfig {
  // --- Existing fields (unchanged) ---
  model?: string;
  maxTurns?: number;
  maxBudgetUsd?: number;
  allowedTools?: string[];
  systemPrompt?: string;
  timeoutSeconds?: number;
  extraFlags?: string[];
  backend?: 'claude' | 'cursor' | 'codex';

  // --- NEW: Prompt Harness ---
  systemPromptPrefix?: string;   // Part 1: injected before agent task instruction
  outputChecklist?: string[];    // Part 2: required outputs agent must produce
}
```

`systemPromptPrefix` is prepended to the agent's full system prompt at execution time.
`outputChecklist` is appended as a structured requirements list (e.g., "You must produce: 1) …").

### `WorkflowDefinition` (extended)

```typescript
interface WorkflowDefinition {
  // --- Existing fields (unchanged) ---
  id: string;
  metadata: WorkflowMetadata;
  nodes: AgentNode[];
  transitions: Transition[];
  gates: HITLGateDefinition[];
  variables: WorkflowVariable[];

  // --- NEW ---
  rules?: string[];              // Workflow-level rules injected into all agent contexts
  parallelGroups?: ParallelGroup[]; // Groups of node IDs that execute simultaneously
}
```

### `ParallelGroup` (new)

```typescript
interface ParallelGroup {
  id: string;
  label: string;
  laneNodeIds: string[];  // All nodes in this group dispatch simultaneously
}
```

Nodes not listed in any `ParallelGroup` are sequential (ordered by transition DAG).

> **Note:** F01 defines the `ParallelGroup` data model and Studio UI only. Parallel dispatch
> logic (execution engine changes) is implemented in **P15-F05**.

### `BlockType` (new discriminant)

```typescript
type BlockType = 'plan' | 'dev' | 'test' | 'review' | 'devops';
```

Maps to `AgentNodeType` via a static lookup table in `constants.ts`:

| BlockType | AgentNodeType | Default label | Phase |
|-----------|--------------|---------------|-------|
| `plan`    | `planner`    | "Plan"        | 1 ✅  |
| `dev`     | `coding`     | "Dev"         | 2 (future) |
| `test`    | `utest`      | "Test"        | 2 (future) |
| `review`  | `reviewer`   | "Review"      | 2 (future) |
| `devops`  | `deployment` | "DevOps"      | 2 (future) |

### Agent Backend Selection (UI)

The `AgentBackendSelector` component displays the three backend options from the committed
`AgentNodeConfig.backend` type: `'claude' | 'cursor' | 'codex'`. There is no separate
`AgentBackendType` — the selector writes directly to `AgentNodeConfig.backend`.

The selector reads provider availability from F08's `settingsStore.getConfiguredProviders()`
to show which backends have valid API keys configured vs unconfigured. Unconfigured backends
are shown grayed out with a "not configured" badge linking to the Settings page.

## Routing

`StudioPage` lives at `/studio`. `DesignerPage` remains at `/`. Both coexist as separate
navigation entries in the sidebar.

**Route behavior:**
- `/studio` — renders `StudioPage` (block-level composition)
- `/` — renders `DesignerPage` (low-level node editing)
- When F02 "Edit" is clicked on a template, route to `/studio` if the template has the
  `studio-block-composer` tag, otherwise route to `/` (designer).

**Phase 1 scope enforcement:** The `BlockPalette` shows only the Plan block in Phase 1.
Other block types (Dev, Test, Review, DevOps) are not rendered in the palette. This is
enforced via palette filtering against `BLOCK_TYPE_METADATA` entries that have
`phase: 1` (or a similar flag).

## Prompt Assembly Order

When the execution engine builds the system prompt for a node, the assembly order is:

```
1. Workflow-level rules (from WorkflowDefinition.rules)
2. Block systemPromptPrefix (from AgentNodeConfig.systemPromptPrefix)
3. Agent task instruction (the node's primary task text)
4. Output checklist (from AgentNodeConfig.outputChecklist, rendered as numbered list)
```

Rules are prepended first to ensure workflow-wide constraints take precedence over
block-level prompt customization.

## Component Architecture

### New Components

| Component | File | Purpose |
|-----------|------|---------|
| `StudioPage` | `renderer/pages/StudioPage.tsx` | Main page at `/studio` route (supplements DesignerPage, does not replace it) |
| `BlockPalette` | `renderer/components/studio/BlockPalette.tsx` | Draggable block type cards |
| `StudioCanvas` | `renderer/components/studio/StudioCanvas.tsx` | ReactFlow canvas with parallel lane overlay |
| `BlockConfigPanel` | `renderer/components/studio/BlockConfigPanel.tsx` | Right panel: prompt harness + backend selector |
| `PromptHarnessEditor` | `renderer/components/studio/PromptHarnessEditor.tsx` | Two-part form: system prompt prefix + output checklist |
| `AgentBackendSelector` | `renderer/components/studio/AgentBackendSelector.tsx` | Radio/select: claude / cursor / codex (reads provider availability from F08 settingsStore) |
| `WorkflowRulesBar` | `renderer/components/studio/WorkflowRulesBar.tsx` | Top bar for editing workflow-level rules (tag-input style) |
| `ParallelLaneOverlay` | `renderer/components/studio/ParallelLaneOverlay.tsx` | Visual lane grouping overlay on canvas |

### Existing Components (reused or adapted)

| Component | Role in Studio |
|-----------|---------------|
| `ReactFlowCanvas` | Base canvas — StudioCanvas wraps or composes with it |
| `useWorkflowStore` | State — extended with `rules` and `parallelGroups` actions |
| `workflow-handlers.ts` | IPC — no changes needed; existing save/load handles new fields |

## State Management Extensions (`workflowStore`)

New actions added to the Zustand store:

```typescript
interface WorkflowStoreActions {
  // --- Existing ---
  addNode, removeNode, moveNode, addEdge, removeEdge, selectNode, ...

  // --- NEW ---
  setNodeSystemPromptPrefix(nodeId: string, prefix: string): void;
  setNodeOutputChecklist(nodeId: string, checklist: string[]): void;
  setNodeBackend(nodeId: string, backend: 'claude' | 'cursor'): void;
  addWorkflowRule(rule: string): void;
  removeWorkflowRule(index: number): void;
  addParallelGroup(laneNodeIds: string[]): void;
  removeParallelGroup(groupId: string): void;
  addNodeToParallelGroup(groupId: string, nodeId: string): void;
  removeNodeFromParallelGroup(groupId: string, nodeId: string): void;
}
```

## Parallel Track Execution

> **Note:** Parallel dispatch execution logic is owned by **P15-F05** (Parallel Execution
> Engine). F01 defines the data model (`ParallelGroup` with `laneNodeIds`) and the Studio UI
> for grouping nodes visually. The execution engine changes (dispatching grouped nodes via
> `Promise.all`, abort handling) are implemented in F05.

At a high level, the engine will:

1. Before dispatching a node, check if it belongs to a `ParallelGroup`
2. If yes, dispatch all nodes in the group simultaneously (`Promise.all`)
3. Wait for all group nodes to complete before advancing to the next sequential step

This is additive — nodes not in any group follow the existing sequential path.

## Prompt Harness Injection (at Execution Time)

At execution time, the engine constructs the full system prompt for each node:

```
[systemPromptPrefix]\n\n[agent task instruction]\n\n[outputChecklist rendered as numbered list]
```

If `systemPromptPrefix` is absent, the task instruction is used as-is (backward compatible).
If `outputChecklist` is empty or absent, no checklist is appended.

For workflow-level `rules`, they are prepended to the system prompt for every node:

```
Rules:\n- [rule1]\n- [rule2]\n\n[systemPromptPrefix]\n\n[agent task instruction]
```

## Plan Block — Default Prompt Harness

Phase 1 pre-populates the Plan block with this default harness:

**Default System Prompt Prefix:**
```
You are a senior technical planner. Interview the user to gather requirements and context.
Ask clarifying questions before producing any output. Focus on understanding goals,
constraints, and success criteria.
```

**Default Output Checklist:**
```
[ ] Requirements document with user stories
[ ] Acceptance criteria for each story
[ ] Task breakdown with estimates
[ ] Dependency map
```

These are editable by the user.

## Template Save/Load

Saving a Studio workflow as a template uses the existing `WORKFLOW_SAVE` IPC channel.
The `WorkflowDefinition` already has `metadata.tags` — Studio adds `"studio-block-composer"`
tag automatically on save.

Template listing uses the existing `WORKFLOW_LIST` channel filtered by tag.

No new IPC channels are required for Phase 1.

## File Structure

```
apps/workflow-studio/src/
├── shared/
│   ├── types/
│   │   └── workflow.ts                    # +systemPromptPrefix, +outputChecklist,
│   │                                      #  +rules, +parallelGroups, +ParallelGroup
│   └── constants.ts                       # +BLOCK_TYPE_METADATA mapping
├── renderer/
│   ├── pages/
│   │   └── StudioPage.tsx                 # NEW: main Studio tab page
│   ├── components/
│   │   └── studio/
│   │       ├── BlockPalette.tsx           # NEW
│   │       ├── StudioCanvas.tsx           # NEW (wraps ReactFlowCanvas)
│   │       ├── BlockConfigPanel.tsx       # NEW (right panel)
│   │       ├── PromptHarnessEditor.tsx    # NEW
│   │       ├── AgentBackendSelector.tsx   # NEW
│   │       ├── WorkflowRulesBar.tsx       # NEW
│   │       └── ParallelLaneOverlay.tsx    # NEW
│   └── stores/
│       └── workflowStore.ts              # +rules/parallelGroups actions
└── main/
    ├── schemas/
    │   └── workflow-schema.ts            # +new fields to Zod schema
    └── services/
        └── execution-engine.ts           # +parallel group dispatch, +prompt harness
```

## Open Questions

1. **StudioPage vs DesignerPage**: **RESOLVED.** StudioPage lives at `/studio` as a separate
   route. DesignerPage remains at `/`. Both are sidebar entries. Template edit routing
   uses the `studio-block-composer` tag to decide which editor to open.

2. **Parallel lane UI**: Drop-to-lane or right-click-to-group? Recommendation: right-click
   context menu on canvas to group selected nodes into a parallel lane (simpler MVP).

3. **Model info display**: Model is configured in Settings, but should the block config
   panel show the currently selected model (read-only)? Recommendation: yes, read from
   settings store and display as informational text.

4. **Cursor Docker vs Cursor local**: The `backend: 'cursor'` currently points to the
   Docker cursor-agent at `http://localhost:8090`. Is "Cursor CLI Docker" the only cursor
   option, or should there be a "Cursor CLI local" option? Recommendation: Docker only
   for Phase 1 (consistent with P14-F07 design).

5. **Template routing**: When user navigates from TemplateManagerPage to Studio to edit
   a template, does Studio load the full `WorkflowDefinition` and filter to block-level
   fields, or does it require a Studio-specific template format? Recommendation: load
   full WorkflowDefinition; Studio renders only block-relevant fields.

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Parallel group execution complexity in engine | Medium | Start with `Promise.all` on group; abort on first failure |
| ReactFlow parallel lane overlay visual conflicts | Medium | Use semi-transparent lane background; z-index below nodes |
| Schema migration for existing workflows without new fields | Low | All new fields are optional; Zod schema uses `.optional()` |
| User confusion: Studio vs Designer page | Medium | Clear tab labels + tooltip explaining difference |
