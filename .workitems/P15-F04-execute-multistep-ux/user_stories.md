---
id: P15-F04
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
  - execution
  - ux
  - step-gate
  - deliverables
---

# User Stories: Execute — Multi-Step Workflow UX (P15-F04)

---

## US-01: Real-time event log

**As a** workflow author
**I want** to see a human-readable activity log as each block runs
**So that** I understand what the agent is doing without reading raw CLI output

### Acceptance Criteria

- The Event Log panel shows one entry per significant event with a timestamp and icon
- `node_started` → `▶ {node.label} started`
- `node_completed` → `✅ {node.label} completed ({duration})`
- `tool_call` → `🔧 Called {tool} → {target}`
- `bash_command` → `$ {command}`
- `cli_error` → `⚠ {message}`
- New events auto-scroll to the bottom of the log as they arrive
- Events are not re-ordered or deduplicated except by the existing store dedup (matching id)

### Test Scenarios

**Given** a workflow execution is running
**When** the engine emits a `tool_call` event with `{tool: "Read", target: "src/foo.ts"}`
**Then** the event log shows `🔧 Called Read → src/foo.ts` within one render cycle

**Given** 50 events have accumulated
**When** a new event arrives
**Then** the log scrolls to the bottom to show the latest entry

---

## US-02: Active node visualization

**As a** workflow author
**I want** the currently executing block to be visually highlighted in the workflow canvas
**So that** I can immediately see where the execution is at a glance

### Acceptance Criteria

- The active node has a distinct animated ring (CSS pulse keyframe)
- Completed nodes are colored green; failed nodes red; pending nodes gray
- The canvas auto-centers on the active node when it changes (smooth scroll/pan)
- Parallel branches render as side-by-side columns, not a linear list

### Test Scenarios

**Given** node "Plan" is the current active node
**When** the execution state update arrives with `currentNodeId: "plan-1"`
**Then** the "plan-1" node renders with the pulse animation and highlighted border

**Given** a workflow has two parallel branches after a fork
**When** the execution canvas renders
**Then** the two branch nodes appear in adjacent columns with a shared fork point above them

---

## US-03: Step gate fires at block completion

**As a** workflow author
**I want** configurable blocks to pause and show their deliverables before proceeding
**So that** I can review the output of each step before the workflow moves on

### Acceptance Criteria

- A node with `config.gateMode === 'gate'` causes the execution to reach `status: 'waiting_gate'` when it completes
- The Step Gate panel opens automatically and the right panel switches to the "Step Gate" tab
- The Step Gate panel shows the block name, duration, and revision count
- A node with `config.gateMode === 'auto_continue'` (default) never triggers the gate panel

### Test Scenarios

**Given** a plan block with `gateMode: "gate"` just completed
**When** the execution state updates to `waiting_gate`
**Then** the right panel automatically switches to the Step Gate tab

**Given** a plan block with `gateMode: "auto_continue"` (default) just completed
**When** the next block starts
**Then** the Step Gate panel is never shown and execution continues uninterrupted

---

## US-04: Scrutiny level selector

**As a** workflow author
**I want** to choose how much detail I see in the deliverables panel
**So that** I can do a quick sanity check or a deep review depending on my current need

### Acceptance Criteria

- The Step Gate panel shows a segmented control: `Summary | File List | Full Detail`
- Default selection is `Summary`
- Switching levels re-renders the deliverables content immediately (no IPC call)
- The selection resets to `Summary` when a new gate opens

### Test Scenarios

**Given** a step gate is open for a plan block
**When** I switch from Summary to Full Detail
**Then** the complete design.md / tasks.md content appears in the panel

**Given** I am viewing Full Detail
**When** I click Summary
**Then** the AI-generated paragraph appears and the full doc collapses

---

## US-05: Plan block deliverables display

**As a** workflow author
**I want** to see the planning artifacts produced by a Plan block in the gate panel
**So that** I can evaluate whether the planner's output meets my expectations

### Acceptance Criteria

**Summary level:**
- Shows an AI-generated paragraph summarizing what the planner produced
- If no summary is available, shows a placeholder: "No summary available"

**File List level:**
- Shows the list of artifact files created (e.g., `design.md`, `tasks.md`, `user_stories.md`)
- Each entry shows the file path and a line count or approximate size

**Full Detail level:**
- Shows the complete content of each planning document in a collapsible markdown renderer
- Documents are rendered, not shown as raw text (headings, code blocks, tables formatted)

### Test Scenarios

**Given** a plan block completed and produced `design.md`, `tasks.md`, `user_stories.md`
**When** the gate panel is open at File List scrutiny
**Then** three entries appear, each with path and approximate size

**Given** the gate panel is at Full Detail scrutiny
**When** I expand `design.md`
**Then** the design document renders with formatted markdown (tables, headings, code blocks)

---

## US-06: Continue decision

**As a** workflow author
**I want** to click Continue in the gate panel to approve the deliverables and advance the workflow
**So that** execution resumes with my explicit sign-off

### Acceptance Criteria

- The Continue button is always visible and enabled in the Step Gate panel
- Clicking Continue sends a gate decision with `selectedOption: 'continue'`
- The Step Gate panel closes and the right panel returns to the Event Log tab
- The execution status changes from `waiting_gate` to `running`

### Test Scenarios

**Given** a step gate is open
**When** I click Continue
**Then** the execution status badge changes from "Waiting for Gate" to "Running" within one render cycle

---

## US-07: Revise decision with feedback

**As a** workflow author
**I want** to send revision feedback to a block and have it re-run with my notes injected
**So that** I can iterate on the agent's output without restarting the whole workflow

### Acceptance Criteria

- The Revise button opens a textarea for feedback input
- The textarea has a placeholder: "Describe what needs to change…"
- The Submit button is disabled until at least 10 characters are entered
- Clicking Submit sends the feedback via `EXECUTION_REVISE` IPC channel
- The block re-starts (status → `running`), with `revisionCount` incremented in the gate panel header
- The event log shows `🔁 Re-running with feedback (revision {n})`
- Cancelling the Revise flow (Escape or Cancel button) closes the textarea without submitting

### Test Scenarios

**Given** a step gate is open
**When** I click Revise, type "Add a code diff viewer section", and click Submit
**Then** the block restarts and the event log shows `🔁 Re-running with feedback (revision 1)`

**Given** I clicked Revise but typed fewer than 10 characters
**When** I look at the Submit button
**Then** it is disabled and shows a tooltip "Enter at least 10 characters"

---

## US-08: Revision count tracking

**As a** workflow author
**I want** to see how many times a block has been revised in the gate panel
**So that** I have a visible record of how much iteration occurred at each step

### Acceptance Criteria

- The Step Gate panel header shows `Revision {n}` badge when `revisionCount >= 1`
- The badge is not shown for the first run (revision count 0)
- The count updates in real time as block_revised events arrive
- The revision count persists in the execution state (not reset on gate re-open)

### Test Scenarios

**Given** a block has been revised twice
**When** the gate opens again after the second revision completes
**Then** the panel header shows `Revision 2`

---

## US-09: Code diff viewer stub (future-ready)

**As a** workflow author
**I want** the execution panel to have a placeholder for code diff display
**So that** when Dev blocks are implemented, the UX slot is already available

### Acceptance Criteria

- `DiffViewer` component exists and renders a placeholder message when no diffs are provided
- The component accepts a `diffs: FileDiff[]` prop and renders "No changes to display" when empty
- The component has an `onOpenInVSCode` callback prop wired to `shell.openExternal` for future use
- The component is exported from the execution components barrel file

### Test Scenarios

**Given** the `DiffViewer` is rendered with an empty diffs array
**When** the component mounts
**Then** it shows "No changes to display" without errors
