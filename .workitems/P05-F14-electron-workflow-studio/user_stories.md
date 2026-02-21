# P05-F14: Electron Workflow Studio - User Stories

> **SUPERSEDED**: This feature has been extracted into its own epic P14 (Electron Workflow Studio).
> See `.workitems/P14-F01-*` through `.workitems/P14-F06-*` for the restructured breakdown.
> This file is retained for historical reference only.

**Version:** 1.0
**Date:** 2026-02-21
**Status:** SUPERSEDED

## Epic Summary

As a developer using the aSDLC platform, I want a desktop application that lets me visually design, save, and execute agent workflows so that I can customize the development lifecycle for different types of work items without editing configuration files by hand.

---

## US-01: Electron Shell and Navigation

**As a** developer
**I want** a desktop application with a sidebar navigation and frameless title bar
**So that** I have a native-feeling workspace for designing and running workflows

### Acceptance Criteria

1. The Electron app launches with a frameless window showing custom title bar controls (minimize, maximize, close)
2. A sidebar provides navigation between Designer, Templates, Execute, CLI Sessions, and Settings pages
3. The active page is highlighted in the sidebar
4. The window dimensions and position persist across restarts
5. The renderer process has no direct access to Node.js APIs (contextIsolation enforced)
6. IPC bridge is available in the renderer via `window.electronAPI`

### Test Scenarios

**Scenario: App launch**
- Given the Electron app is installed
- When I launch the application
- Then a window appears with a custom title bar and sidebar navigation

**Scenario: Navigation**
- Given the app is running
- When I click "Designer" in the sidebar
- Then the main content area shows the workflow designer page

**Scenario: Window persistence**
- Given I resize the window to 1200x800 and move it to position (100, 50)
- When I close and reopen the app
- Then the window opens at 1200x800 at position (100, 50)

**Scenario: Security isolation**
- Given the renderer process is running
- When I attempt to access `require('fs')` from the renderer console
- Then the access is blocked (require is not defined)

---

## US-02: Workflow Designer Canvas

**As a** workflow designer
**I want** a visual canvas where I can drag agent nodes, connect them with edges, and configure their properties
**So that** I can design custom agent workflows without writing code

### Acceptance Criteria

1. A node palette on the left lists all available agent types (Planner, Backend, Frontend, Reviewer, Tester, Orchestrator, DevOps, Custom) and control flow nodes (HITL Gate, Conditional Branch, Parallel Fork, Join)
2. I can drag a node from the palette onto the canvas to create it
3. I can draw edges between node output ports and input ports by clicking and dragging
4. Selecting a node opens a properties panel on the right showing editable configuration
5. Selecting an edge shows condition configuration
6. The canvas has a minimap, zoom controls, and grid background
7. I can select and delete nodes and edges
8. I can undo and redo canvas operations (at least 50 levels)

### Test Scenarios

**Scenario: Add node via drag**
- Given the designer page is open
- When I drag a "Backend" node from the palette onto the canvas
- Then a Backend agent node appears at the drop position with default configuration

**Scenario: Connect nodes**
- Given I have a "Planner" node and a "Backend" node on the canvas
- When I drag from the Planner's output port to the Backend's input port
- Then an edge is created connecting the two nodes

**Scenario: Edit node properties**
- Given I have a "Backend" node on the canvas
- When I click on the node
- Then the properties panel shows: model selector, max turns, tools list, system prompt editor

**Scenario: Undo/redo**
- Given I have placed a node on the canvas
- When I press Ctrl+Z
- Then the node is removed
- When I press Ctrl+Shift+Z
- Then the node is restored

**Scenario: Delete node**
- Given I have a node selected on the canvas
- When I press the Delete key
- Then the node and all its connected edges are removed

---

## US-03: Save and Load Workflows

**As a** workflow designer
**I want** to save my workflow designs to disk and load them later
**So that** I can iterate on designs across sessions and share them with others

### Acceptance Criteria

1. Clicking "Save" serializes the current workflow to a JSON file via the file save dialog
2. Clicking "Load" opens a file dialog to select and load a workflow JSON file
3. The workflow JSON includes all nodes, edges, gates, positions, and configuration
4. The JSON file is validated against a Zod schema on load; invalid files show an error message
5. A "Recent Workflows" section in the sidebar shows the last 10 loaded/saved workflows
6. The workflow file includes a version field for forward compatibility
7. Auto-save to a temporary location every 60 seconds to prevent data loss

### Test Scenarios

**Scenario: Save workflow**
- Given I have designed a workflow with 3 nodes and 2 edges
- When I click Save and choose a file location
- Then a JSON file is written containing all nodes, edges, and configuration
- And the file is valid according to the Zod schema

**Scenario: Load workflow**
- Given I have a saved workflow JSON file
- When I click Load and select the file
- Then the canvas populates with the saved nodes, edges, and configuration

**Scenario: Load invalid file**
- Given I have a JSON file that does not match the workflow schema
- When I attempt to load it
- Then an error notification explains what validation failed

**Scenario: Recent workflows**
- Given I have saved or loaded 3 workflows
- When I look at the sidebar
- Then the "Recent Workflows" section shows all 3 with names and dates

**Scenario: Auto-save recovery**
- Given I have been editing a workflow for 2 minutes without saving
- When the app crashes and restarts
- Then I am prompted to recover the auto-saved draft

---

## US-04: HITL Gate Configuration

**As a** workflow designer
**I want** to place HITL gate nodes before or after agent nodes on my workflow
**So that** I can define where human approval is required during execution

### Acceptance Criteria

1. I can drag a "HITL Gate" node from the palette and connect it between agent nodes
2. The gate properties panel lets me configure: gate type (mandatory/advisory), prompt template, timeout, and response options
3. Each gate option has a label, value, and action (proceed, abort, retry, skip)
4. The gate is visually distinct from agent nodes (different color/shape)
5. Validation warns if a gate has no incoming or outgoing edges
6. I can configure a prompt template that references workflow variables using `{{variable_name}}` syntax

### Test Scenarios

**Scenario: Add gate between nodes**
- Given I have a Planner node connected to a Backend node
- When I drag a HITL Gate onto the edge between them
- Then the gate is inserted with edges: Planner -> Gate -> Backend

**Scenario: Configure gate options**
- Given I have selected a HITL Gate node
- When I set gate type to "mandatory" and add two options: "Approve" (proceed) and "Reject" (abort)
- Then the gate configuration is saved with those options

**Scenario: Gate validation**
- Given I have a HITL Gate node with no outgoing edges
- When I click "Validate"
- Then a validation warning indicates the gate has no outgoing connection

---

## US-05: Workflow Templates

**As a** developer
**I want** to start from pre-built workflow templates instead of building from scratch
**So that** I can quickly create common workflow patterns

### Acceptance Criteria

1. A Templates page lists all available workflow templates with name, description, and node count
2. Built-in templates include: "11-Step Default aSDLC", "Quick Fix", "Design Review Loop", "TDD Cycle"
3. Clicking a template opens a preview showing the workflow canvas read-only
4. Clicking "Use Template" loads the template into the designer as a new workflow
5. I can save my own workflows as templates (stored in a templates directory)
6. Templates show a thumbnail/miniature of the workflow graph

### Test Scenarios

**Scenario: List templates**
- Given I open the Templates page
- When the page loads
- Then I see at least 4 built-in templates with names and descriptions

**Scenario: Preview template**
- Given I am on the Templates page
- When I click on "11-Step Default aSDLC"
- Then a preview shows the workflow graph with all 11 steps and HITL gates

**Scenario: Use template**
- Given I am previewing the "Quick Fix" template
- When I click "Use Template"
- Then I am taken to the Designer page with the template loaded as a new unsaved workflow

**Scenario: Save as template**
- Given I have a custom workflow in the designer
- When I choose "Save as Template" from the menu
- Then the workflow is saved to the templates directory and appears in the Templates page

---

## US-06: Work Item Integration

**As a** developer
**I want** to pick a work item (PRD, GitHub issue, or idea) to bind to a workflow execution
**So that** the agents know what they are working on

### Acceptance Criteria

1. A "Work Item Picker" dialog lets me browse and search work items by type
2. The "PRDs" tab scans `.workitems/` directories and lists available PRDs
3. The "GitHub Issues" tab lists issues from the current repository via `gh` CLI
4. The "Ideas" tab lists items from the ideation store or .workitems/
5. A "Manual Input" tab lets me type a title and description directly
6. The selected work item is displayed in the execution header
7. The work item content is passed to agent nodes as input context

### Test Scenarios

**Scenario: Browse PRDs**
- Given the project has `.workitems/P05-F14-electron-workflow-studio/` directory
- When I open the Work Item Picker and click the PRDs tab
- Then I see "P05-F14-electron-workflow-studio" listed with its design.md summary

**Scenario: Select GitHub issue**
- Given the repository has open GitHub issues
- When I open the Work Item Picker and click the GitHub Issues tab
- Then I see issues listed with number, title, and labels

**Scenario: Manual input**
- Given I open the Work Item Picker
- When I click Manual Input and type "Fix login bug" with a description
- Then I can select this as my work item for execution

**Scenario: Work item in execution**
- Given I have selected a work item and started execution
- When I view the execution header
- Then I see the work item title and type badge

---

## US-07: Execution Walkthrough

**As a** developer
**I want** to execute a workflow step-by-step with visual progress on the canvas
**So that** I can watch agents work through the pipeline and intervene at HITL gates

### Acceptance Criteria

1. From the Execute page, I can select a workflow and a work item, then click "Start"
2. The execution canvas shows the workflow with node status overlays (pending/running/completed/failed)
3. The currently executing node is highlighted with an animated border
4. Edges animate to show data flow direction
5. When a HITL gate is reached, execution pauses and shows the gate decision form
6. I can respond to the gate (approve, reject, skip) and execution continues
7. An event log panel shows timestamped execution events
8. I can pause, resume, and abort the execution at any time
9. A "Step" button advances execution one node at a time (for debugging)

### Test Scenarios

**Scenario: Start execution**
- Given I have selected the "Quick Fix" workflow and a PRD work item
- When I click "Start"
- Then the execution canvas shows all nodes in "pending" state and the first node transitions to "running"

**Scenario: Node completion**
- Given a node is in "running" state
- When the node completes successfully
- Then it transitions to "completed" (green), and the next node transitions to "running"

**Scenario: HITL gate pause**
- Given execution reaches a mandatory HITL gate
- When the gate is activated
- Then execution pauses, the gate node shows "waiting", and the Gate Decision tab appears with the prompt and options

**Scenario: Gate decision**
- Given execution is paused at a HITL gate showing "Approve code review?"
- When I click "Approve"
- Then execution resumes with the next node

**Scenario: Abort execution**
- Given execution is in progress
- When I click "Abort"
- Then all running nodes are stopped, spawned CLI sessions are killed, and status becomes "aborted"

**Scenario: Step-through mode**
- Given execution is paused
- When I click "Step"
- Then exactly one node executes and execution pauses again

---

## US-08: CLI Session Spawner

**As a** developer
**I want** the Electron app to spawn and manage Claude Code CLI sessions
**So that** workflow nodes can delegate to real agent sessions

### Acceptance Criteria

1. The CLI Manager page lists all active and recently exited CLI sessions
2. I can manually spawn a new CLI session with a context ID and working directory
3. Each session shows an embedded terminal panel with live output
4. I can send text input to a running session's terminal
5. I can kill a running session, which sends SIGTERM (then SIGKILL after 5s)
6. Session status updates in real-time (running, exited with code)
7. When the Electron app exits, all spawned CLI sessions are terminated
8. The execution engine can spawn CLI sessions automatically for workflow nodes

### Test Scenarios

**Scenario: Manual spawn**
- Given I am on the CLI Manager page
- When I click "New Session" and enter context_id "p05-test" and working directory "/home/user/dox-asdlc"
- Then a new CLI session appears in the list with status "running"
- And the terminal panel shows Claude CLI startup output

**Scenario: Terminal interaction**
- Given I have a running CLI session
- When I type a command in the terminal panel
- Then the input is sent to the CLI session and output appears in the terminal

**Scenario: Kill session**
- Given I have a running CLI session
- When I click "Kill" on the session
- Then the session receives SIGTERM and transitions to "exited"

**Scenario: App exit cleanup**
- Given I have 3 running CLI sessions
- When I close the Electron app
- Then all 3 sessions are terminated before the app exits

**Scenario: Automatic spawn during execution**
- Given a workflow is executing and reaches a "Backend" node
- When the execution engine processes the node
- Then a CLI session is spawned with the appropriate context_id and agent_role

---

## US-09: Workflow Validation

**As a** workflow designer
**I want** the designer to validate my workflow and highlight errors
**So that** I do not try to execute an invalid workflow

### Acceptance Criteria

1. Clicking "Validate" in the toolbar runs all validation rules and shows results
2. Validation errors are shown as red highlights on affected nodes/edges
3. A validation summary panel lists all errors and warnings with descriptions
4. Clicking an error in the summary panel selects and scrolls to the affected element
5. Validation rules include: connectivity, no orphans, gate attachment, required ports, cycle detection, start/end nodes
6. The "Start Execution" button is disabled if validation fails

### Test Scenarios

**Scenario: Valid workflow**
- Given a workflow with all nodes connected and valid
- When I click "Validate"
- Then a success message appears and no elements are highlighted red

**Scenario: Orphan node**
- Given a workflow with a disconnected node
- When I click "Validate"
- Then the orphan node is highlighted red and the summary says "Node X has no connections"

**Scenario: Missing start node**
- Given all nodes have incoming edges (no entry point)
- When I click "Validate"
- Then the summary shows "Workflow has no start node (a node with no incoming edges)"

**Scenario: Click error to navigate**
- Given validation found an error on a node off-screen
- When I click the error in the validation summary
- Then the canvas pans and zooms to show the affected node selected

---

## US-10: Settings and Preferences

**As a** developer
**I want** to configure the app's default settings
**So that** I can customize paths, defaults, and behavior

### Acceptance Criteria

1. A Settings page allows configuring: default workflow directory, default template directory, auto-save interval, CLI default working directory, Redis connection URL
2. Settings are persisted to a local configuration file
3. Default values work out of the box (no mandatory configuration)
4. Changes take effect immediately without restarting the app

### Test Scenarios

**Scenario: Change workflow directory**
- Given I am on the Settings page
- When I change the workflow directory to "/home/user/my-workflows"
- Then new saves default to that directory and the recent list scans it

**Scenario: Defaults work**
- Given a fresh install with no settings file
- When I launch the app
- Then all features work with sensible defaults (e.g., ~/.asdlc/workflows/)
