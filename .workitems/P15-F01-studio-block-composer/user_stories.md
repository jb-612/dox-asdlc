---
id: P15-F01
parent_id: P15
type: user_stories
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
---

# User Stories: Studio Block Composer (P15-F01)

---

## US-01: Drag a Plan block onto the canvas

**As a** workflow author
**I want** to drag a "Plan" block from the palette onto the Studio canvas
**So that** I can start composing a planning workflow without knowing the underlying agent type

### Acceptance Criteria

- The Studio page shows a BlockPalette with at least the "Plan" block card.
- Dragging the Plan card and dropping it on the canvas creates an `AgentNode` with `type: 'planner'`.
- The new node is visible on the canvas with the label "Plan".
- The node is pre-populated with the Plan block default prompt harness.

### Test Scenarios

**Given** the Studio canvas is open
**When** I drag the "Plan" block from the palette and drop it on the canvas
**Then** a node labeled "Plan" of type `planner` appears at the drop position

**Given** the Plan block is on the canvas
**When** I select it
**Then** the BlockConfigPanel shows the default system prompt prefix and output checklist

---

## US-02: Configure the prompt harness for a block

**As a** workflow author
**I want** to set a system prompt prefix and output checklist for each block
**So that** I can control how the agent is instructed and what outputs it must produce

### Acceptance Criteria

- The BlockConfigPanel shows two editable sections: "System Prompt Prefix" and "Output Checklist".
- Changes to either field are reflected in `AgentNodeConfig.systemPromptPrefix` and `AgentNodeConfig.outputChecklist`.
- The checklist supports adding and removing items (list editor with add/remove buttons).
- At execution time, the execution engine injects the prefix before the task instruction and the checklist after.

### Test Scenarios

**Given** a Plan block is selected
**When** I enter "You are a senior planner. Ask at least 3 clarifying questions." in the System Prompt Prefix field
**Then** `node.config.systemPromptPrefix` equals that text

**Given** a Plan block has a 3-item output checklist
**When** the execution engine builds the system prompt
**Then** the prompt ends with a numbered list of the 3 checklist items

**Given** a block has no prompt harness configured
**When** the engine executes it
**Then** no prefix or checklist is injected (existing behavior unchanged)

---

## US-03: Select an agent backend per block

**As a** workflow author
**I want** to choose whether each block runs on Claude Code (Docker) or Cursor CLI (Docker)
**So that** I can pick the agent backend best suited for each step

### Acceptance Criteria

- The BlockConfigPanel shows an "Agent Backend" selector with two options:
  - "Claude Code (Docker)" → `backend: 'claude'`
  - "Cursor CLI (Docker)" → `backend: 'cursor'`
- Default selection is "Claude Code (Docker)".
- The model name from Settings is displayed below the selector as informational text (read-only).
- The selected backend is persisted in `AgentNodeConfig.backend`.

### Test Scenarios

**Given** a Plan block is selected
**When** I choose "Cursor CLI (Docker)" in the Agent Backend selector
**Then** `node.config.backend` equals `'cursor'`

**Given** a Plan block is selected and the backend is "Cursor CLI (Docker)"
**When** the workflow is executed
**Then** that node is dispatched via `executeNodeRemote()` to the Cursor agent endpoint

**Given** I have not changed the agent backend
**When** the Plan block is created
**Then** `node.config.backend` defaults to `'claude'`

---

## US-04: Add workflow-level rules

**As a** workflow author
**I want** to define rules (e.g., "Write clean, well-documented code") that apply to every block
**So that** I don't have to repeat common instructions in every block's prompt harness

### Acceptance Criteria

- The Studio page shows a rules bar above the canvas.
- I can add plain-text rules as tags / list items.
- I can remove any rule.
- Rules are stored in `WorkflowDefinition.rules[]`.
- At execution time, the rules are prepended to the system prompt for every block.

### Test Scenarios

**Given** two rules are set: "Use Python" and "Write unit tests"
**When** the execution engine builds the system prompt for a block
**Then** the prompt begins with "Rules:\n- Use Python\n- Write unit tests"

**Given** no rules are set
**When** the engine builds the system prompt
**Then** no "Rules:" section is added (backward compatible)

---

## US-05: Arrange blocks in a parallel track

**As a** workflow author
**I want** to group blocks into a parallel lane so they execute simultaneously
**So that** I can model workflows where multiple agents work at the same time

### Acceptance Criteria

- I can select two or more blocks on the canvas and choose "Group as parallel" from the context menu.
- Grouped blocks are visually contained in a colored parallel lane background.
- The grouping is stored in `WorkflowDefinition.parallelGroups`.
- At execution time, blocks in the same parallel group are dispatched simultaneously via `Promise.all`.
- Blocks not in any group are executed sequentially as before.

### Test Scenarios

**Given** two Plan blocks are on the canvas
**When** I select both and choose "Group as parallel"
**Then** both nodes appear inside a parallel lane visual grouping

**Given** a parallel group of two blocks exists in the workflow
**When** the execution engine reaches those blocks
**Then** both blocks' execution starts at the same time (before either completes)

---

## US-06: Save workflow as a named template

**As a** workflow author
**I want** to save my Studio workflow as a named template
**So that** I can reuse it for future projects and share it with my team via the Template Manager

### Acceptance Criteria

- A "Save as Template" button is visible on the Studio page.
- Clicking it opens a dialog asking for a template name.
- On confirm, the workflow is saved via the existing `WORKFLOW_SAVE` IPC channel.
- The saved workflow includes the tag `"studio-block-composer"`.
- The template appears in the TemplateManagerPage after saving.

### Test Scenarios

**Given** I have a workflow with one Plan block and two rules
**When** I click "Save as Template" and enter the name "My Planning Template"
**Then** the workflow is persisted with `metadata.name = "My Planning Template"` and `tags` including `"studio-block-composer"`

**Given** the template is saved
**When** I open TemplateManagerPage
**Then** "My Planning Template" appears in the list

---

## US-07: Edit an existing Studio template

**As a** workflow author
**I want** to open an existing Studio template from the Template Manager and edit it
**So that** I can refine and update my workflows over time

### Acceptance Criteria

- The TemplateManagerPage has an "Edit in Studio" action for templates tagged `"studio-block-composer"`.
- Clicking it navigates to the Studio page with the template loaded.
- All block configurations (prompt harness, backend, rules, parallel groups) are restored correctly.
- Saving overwrites the existing template (not creates a duplicate).

### Test Scenarios

**Given** a Studio template named "Planning Template" exists
**When** I click "Edit in Studio" on it
**Then** the Studio page opens with the template's blocks, harness, rules, and parallel groups loaded

**Given** I edit the prompt prefix of a block and save
**When** I re-open the template in Studio
**Then** the updated prefix is shown
