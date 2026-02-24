---
id: P15-F01
parent_id: P15
type: prd
version: 1
status: draft
constraints_hash: null
created_by: planner
created_at: "2026-02-22T00:00:00Z"
updated_at: "2026-02-22T00:00:00Z"
dependencies: []
tags:
  - studio
  - block-composer
  - prd
---

# PRD: Studio Block Composer (P15-F01)

## Problem Statement

The existing Workflow Designer (DesignerPage) exposes the full power of the workflow engine —
raw agent node types, transition conditions, Zod-validated schemas — but requires users to
understand the aSDLC agent taxonomy and DAG mental model. New users and non-technical
stakeholders find it intimidating.

There is no easy way for a user to say "I want a planning step, then a code step, running
some rules in the background" without understanding what `planner`, `coding`, and `variables`
mean internally.

## Goal

Provide a high-level, block-based composition experience that maps common workflow patterns to
pre-configured, named building blocks. Users should be able to build a useful workflow in
under 5 minutes without reading documentation.

## Phase 1 Scope

Phase 1 delivers the minimum viable Studio experience:

| In Scope | Out of Scope (Phase 2+) |
|----------|------------------------|
| Plan block (planner agent) | Dev, Test, Review, DevOps blocks |
| Prompt harness (prefix + checklist) | Block versioning |
| Agent backend selection per block | Block marketplace / sharing |
| Workflow-level rules | Advanced condition expressions between blocks |
| Sequential + parallel track layout | Branch/merge constructs |
| Save as template | Multi-user template collaboration |
| Load/edit existing Studio templates | Diff/merge of templates |

## Target Users

| Persona | Need |
|---------|------|
| **New aSDLC user** | Get a workflow running in minutes without learning agent types |
| **Project lead** | Define planning conventions (rules, output expectations) without writing prompts from scratch |
| **Template curator** | Build reusable workflow blueprints for the team |

## Success Criteria

1. A new user can drag a Plan block onto the canvas, configure a prompt harness, and save a
   template in under 5 minutes (measured via user testing or self-reported usability).

2. A saved Studio template executes correctly through the existing execution engine with prompt
   harness fields correctly injected into the agent's system prompt.

3. Parallel tracks produce simultaneous agent dispatch (verified via execution timeline).

4. All existing workflows (created via DesignerPage) continue to load and execute without
   modification (backward compatibility — new fields are optional).

## Non-Goals

- Studio does NOT replace the DesignerPage. Power users keep their existing workflow.
- Studio does NOT introduce a new persistence format. Templates are `WorkflowDefinition` objects.
- Studio does NOT implement its own execution engine. It reuses the existing engine.
- Studio does NOT surface model selection (model comes from the global Settings page).

## Functional Requirements

### FR-01: Block Palette

- The Studio page displays a palette of block type cards.
- Phase 1: Only the "Plan" block card is available.
- Each card shows: block name, icon, short description, and drag affordance.
- Dragging a card onto the canvas creates a pre-configured `AgentNode`.

### FR-02: Prompt Harness

- Every block has a two-part prompt harness editable in the BlockConfigPanel:
  - **System Prompt Prefix** (textarea): Free text injected before the agent's task instruction.
  - **Output Checklist** (list editor): Required outputs; rendered as a numbered list at the end of the system prompt.
- The Plan block ships with default values for both parts.
- Empty harness fields are valid (harness is optional).

### FR-03: Agent Backend Selection

- Every block has an agent backend selector:
  - **Claude Code (Docker)** — uses `backend: 'claude'`
  - **Cursor CLI (Docker)** — uses `backend: 'cursor'`
- Default: Claude Code (Docker).
- Model is informational only (read from Settings, displayed read-only).

### FR-04: Workflow-Level Rules

- The Studio page has a rules bar (above the canvas).
- Users add plain-text rules (e.g., "Follow Python best practices").
- Rules are stored in `WorkflowDefinition.rules[]`.
- At execution time, rules are prepended to the system prompt of every block.

### FR-05: Sequential and Parallel Tracks

- By default, blocks placed on the canvas connect sequentially (top-to-bottom).
- Users can group selected blocks into a parallel lane via a context menu action
  ("Group as parallel").
- Parallel lanes are visualized as a colored lane background grouping the blocks.
- Blocks in the same parallel lane execute simultaneously at runtime.

### FR-06: Save as Template

- A "Save as Template" button opens a name-entry dialog.
- The workflow is saved via the existing `WORKFLOW_SAVE` IPC channel.
- Saved templates appear in the TemplateManagerPage.
- The `"studio-block-composer"` tag is added automatically.

### FR-07: Edit Existing Template

- Navigating from TemplateManagerPage to Studio with a template ID loads the workflow.
- All block configurations (harness, backend, rules, parallel groups) are restored.

## Non-Functional Requirements

- **Performance**: Canvas must render 20 blocks without visible lag (< 16ms frame time).
- **Backward compatibility**: All new WorkflowDefinition fields are optional. Existing
  workflows without these fields load and run without errors.
- **Accessibility**: Block cards and config form fields must have ARIA labels.
- **TypeScript**: All new code is strictly typed (no `any`). `tsc --noEmit` passes clean.

## Metrics (observability, not gating)

- Track `studio_template_saved` event (block count, rule count) via console telemetry.
- Track `studio_block_added` event (block type, backend selection).
