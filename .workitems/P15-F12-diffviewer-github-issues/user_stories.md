---
id: P15-F12
parent_id: P15
type: user_stories
version: 1
status: draft
created_by: planner
created_at: "2026-02-26T00:00:00Z"
updated_at: "2026-02-26T00:00:00Z"
---

# User Stories: DiffViewer & GitHub Issues (P15-F12)

## US-01: View Code Diffs from Block Execution

**As a** workflow operator,
**I want to** see side-by-side or unified diffs of files changed by a code block,
**So that** I can review what the agent produced before continuing the workflow.

### Acceptance Criteria

- [ ] Code block deliverables show DiffViewer with syntax highlighting
- [ ] Toggle between side-by-side and unified diff modes
- [ ] Each file shown as collapsible section with file path header
- [ ] "Open in VSCode" button per file opens the file in the editor
- [ ] Falls back to text diffSummary when structured diff data unavailable

## US-02: Browse Live GitHub Issues as Work Items

**As a** workflow author,
**I want to** select a GitHub Issue as the work item for a workflow execution,
**So that** the agent has real issue context instead of mock data.

### Acceptance Criteria

- [ ] Issues tab in WorkItemPickerDialog shows live GitHub issues via `gh` CLI
- [ ] Issues display: number, title, labels
- [ ] Search/filter works on live issues
- [ ] Selected issue passed to execution as WorkItemReference with source='github'
- [ ] If `gh` CLI not available, shows "Install GitHub CLI" message
- [ ] If not authenticated, shows "Run `gh auth login`" message

## US-03: Capture Git Diffs During Execution

**As a** workflow operator,
**I want** file diffs to be automatically captured when a code block completes,
**So that** I can review changes without manually running git diff.

### Acceptance Criteria

- [ ] Git diff captured after each successful code block execution
- [ ] Diff stored as structured FileDiff[] in block deliverables
- [ ] Per-file path, oldContent, newContent, and hunks captured
- [ ] Works for both new files and modifications
- [ ] No diff captured if block produces no file changes

## US-04: GitHub CLI Status Awareness

**As a** user without GitHub CLI configured,
**I want to** see clear messaging about what's needed,
**So that** I understand how to enable GitHub Issues integration.

### Acceptance Criteria

- [ ] WorkItemPickerDialog checks `gh` CLI availability on Issues tab open
- [ ] Three states displayed: not installed, not authenticated, ready
- [ ] Each state shows actionable guidance
- [ ] PRD and filesystem work item tabs unaffected by `gh` CLI status
