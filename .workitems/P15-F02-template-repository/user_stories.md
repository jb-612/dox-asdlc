---
id: P15-F02
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
  - templates
  - electron
---

# User Stories: Template Repository (P15-F02)

---

## US-01: Browse and search saved templates

**As a** workflow author
**I want** to see all my saved templates on the Templates tab with name, description, tags, block count, and last-modified date
**So that** I can quickly identify the right starting point for a new workflow

### Acceptance Criteria

- Templates tab displays a card grid (or list) of all templates from `templateDirectory`
- Each card shows: name, description (truncated), tags, node count, last-modified date, and status badge (Active / Paused)
- Search input filters cards by name (case-insensitive substring match)
- Tag filter chips narrow results to templates that include the selected tag
- Status filter (All / Active / Paused) controls which cards are shown
- Empty state message shown when no templates match the current filter

### Test Scenarios

**Given** 3 saved templates with names "TDD", "Full Pipeline", "Code Review"
**When** the user types "tdd" in the search box
**Then** only the "TDD" card is visible

**Given** templates with tags `["tdd"]`, `["review"]`, `["tdd", "ci"]`
**When** the user selects the "tdd" tag chip
**Then** only the 2 templates tagged "tdd" appear

---

## US-02: Create a new template from a blank canvas

**As a** workflow author
**I want** to click "New Template" on the Templates tab and get taken to the designer with a blank canvas
**So that** I can build a new template from scratch and save it to the template library

### Acceptance Criteria

- "New Template" button is always visible in the Templates tab header
- Clicking it clears the workflowStore and sets `activeSaveTarget = 'template'`
- Navigation moves to the Studio (designer) tab
- Pressing Save in the designer calls `template:save` (not `workflow:save`)
- After saving, the template appears in the Templates tab list on next visit

### Test Scenarios

**Given** the user clicks "New Template" from the Templates tab
**When** they build nodes and click Save in the designer
**Then** the template is persisted to `templateDirectory` and visible in the Templates tab

---

## US-03: Edit an existing template

**As a** workflow author
**I want** to click "Edit" on a template card and be taken to the designer with that template pre-loaded
**So that** I can refine the template and save changes back to the same template record

### Acceptance Criteria

- Clicking "Edit" loads the template via `template:load`, sets it in workflowStore, sets `activeSaveTarget = 'template'`, and navigates to the designer
- The designer's Save button calls `template:save` with the existing template ID
- The template's `updatedAt` is refreshed on every save
- Navigating away without saving leaves the template unchanged

### Test Scenarios

**Given** a saved template named "Code Review" with 3 nodes
**When** the user clicks "Edit", adds a 4th node, and saves
**Then** `template:load("code-review-id")` returns a 4-node template

---

## US-04: Delete a template

**As a** workflow author
**I want** to delete a template I no longer need, with a confirmation step
**So that** I don't accidentally remove templates I use in regular workflows

### Acceptance Criteria

- Each template card has a "Delete" action (button or context menu)
- Clicking Delete opens a confirmation dialog naming the template
- Clicking "Cancel" closes the dialog without changes
- Clicking "Confirm" calls `template:delete(id)` and removes the card from the list
- The deleted template's `.json` file is removed from `templateDirectory`

### Test Scenarios

**Given** a template "TDD Cycle" exists on disk
**When** the user confirms deletion
**Then** `template:list()` no longer includes "TDD Cycle"

**Given** the confirmation dialog is open
**When** the user clicks "Cancel"
**Then** the template card is still visible

---

## US-05: Pause and unpause a template

**As a** workflow author
**I want** to pause a template so it doesn't appear in the Execute tab's picker without permanently deleting it
**So that** I can keep work-in-progress templates hidden from execution while still being able to edit them

### Acceptance Criteria

- Active templates show a green "Active" badge; Paused templates show a gray "Paused" badge
- Clicking the badge (or a Toggle button) calls `template:toggle-status(id)` and updates the badge immediately (optimistic UI)
- The status change persists across app restarts
- Paused templates are hidden from the Execute tab's template picker
- Paused templates remain visible on the Templates tab (with filter = All or Paused)

### Test Scenarios

**Given** template "Draft Pipeline" is Active
**When** the user toggles its status to Paused
**Then** the badge changes to "Paused" immediately, and the template does not appear in Execute → template picker

**Given** template "Draft Pipeline" is Paused
**When** the user toggles to Active
**Then** the template reappears in the Execute tab picker after next load

---

## US-06: Duplicate a template

**As a** workflow author
**I want** to duplicate a template as a starting point for a similar workflow
**So that** I can iterate without modifying the original

### Acceptance Criteria

- Each template card has a "Duplicate" action
- Clicking it calls `template:duplicate(id)` and a new template appears in the list immediately
- The duplicate has a new unique ID and the name `{original name} (Copy)`
- The duplicate is `status: 'active'` regardless of the original's status
- The duplicate is independently editable without affecting the original

### Test Scenarios

**Given** a template "Full Pipeline" (Active)
**When** the user clicks "Duplicate"
**Then** a new card "Full Pipeline (Copy)" appears in the list with all the same nodes

**Given** a Paused template "Draft Pipeline"
**When** the user clicks "Duplicate"
**Then** the duplicate is Active (not Paused)

---

## US-07: Execute tab shows only Active templates

**As a** workflow executor
**I want** the Execute tab to show only Active templates in its picker
**So that** I only see templates that are ready for execution, not drafts or paused ones

### Acceptance Criteria

- Execute tab loads from `window.electronAPI.template.list()` (not `workflow.list()`)
- Only templates with `status: 'active'` (or no status field) appear in the picker
- The picker label reads "Select Template" (not "Select Workflow")
- Selecting a template and clicking "Start Execution" works as before
- If no templates are Active, the picker shows an empty state with guidance to visit the Templates tab

### Test Scenarios

**Given** 3 templates: "TDD" (Active), "Draft" (Paused), "Review" (Active)
**When** the user opens the Execute tab
**Then** only "TDD" and "Review" appear in the template picker

**Given** all templates are Paused
**When** the user opens the Execute tab
**Then** an empty state message appears: "No active templates. Go to Templates to enable one."
