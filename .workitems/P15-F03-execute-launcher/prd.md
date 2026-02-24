# P15-F03: Execute — Workflow Launcher — PRD

**Feature ID:** P15-F03
**Status:** Planning
**Phase:** 2
**Date:** 2026-02-22
**Owner:** PM CLI

---

## Business Intent

The Execute tab is the primary entry point for running agent workflows in Workflow Studio.
Today it allows users to pick a workflow and an optional work item, then start execution.
However, it is missing two critical capabilities:

1. **No repository context** — agents have no codebase to operate on. Without a mounted
   repo, agent nodes run in a default working directory with no project-specific files.

2. **No template status awareness** — Paused templates appear alongside Active ones,
   leading to confusing failures when users select a template that is not meant to run.

P15-F03 completes the launcher by adding these two capabilities, plus quality-of-life
improvements (template search, last-used tracking) and real work item data wiring.

---

## Scope

### In Scope (P1 — this feature)
- Template status field (`active` / `paused`) on `WorkflowMetadata`
- Execute page filters to Active templates only; shows badge count
- Search/filter for template list by name or tag
- `lastUsedAt` tracking on templates
- `RepoMountSection` component (local directory + GitHub clone + file restrictions)
- `REPO_BROWSE_LOCAL` IPC handler (Electron dialog)
- `REPO_CLONE_GITHUB` IPC handler (git clone to temp dir)
- `REPO_VALIDATE` IPC handler (check path + .git presence)
- `repoMount` plumbed through `EXECUTION_START` → `ExecutionEngine` → `CLISpawner`
- File restriction patterns surfaced as agent system prompt appended instruction
- PRDs tab in `WorkItemPickerDialog` wired to real `.workitems/` filesystem data
- `WORKITEM_LIST_FS` and `WORKITEM_LOAD_FS` IPC handlers
- Start button requires: template selected (Active) + repo mounted

### Out of Scope (deferred)
- GitHub Issues API integration (→ P15-F05 GitHub Integration)
- Persistent clone cache across restarts (→ future P15 work)
- Hard filesystem-level file restriction enforcement (→ P15-F08 Advanced Settings)
- Template status management UI (enabling/disabling templates) (→ P14-F03 Template Manager)
- Work item editor / ideation studio integration (→ P15 Ideation features)

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Paused templates hidden from Execute page | 100% filtered |
| Template search latency (client-side filter) | < 50ms |
| REPO_BROWSE_LOCAL: OS dialog opens | p99 < 500ms |
| REPO_CLONE_GITHUB: git clone succeeds for public repo | ≥ 95% success |
| REPO_CLONE_GITHUB: invalid URL scheme rejected | 100% rejected |
| REPO_CLONE_GITHUB: private/auth-required repo returns clear error | 100% |
| `repoMount.localPath` set as cwd in CLISpawner | 100% of executions with mount |
| PRDs tab shows real .workitems/ files | ≥ 1 file loaded when directory configured |
| All new code paths covered by tests | ≥ 1 test per handler |
| TypeScript: `tsc --noEmit` clean | 0 errors |

---

## User Impact

| User | Impact |
|------|--------|
| Workflow author | Can target a specific codebase for every workflow run without manual cwd setup |
| Workflow author | Searches templates by name instead of scrolling a long list |
| Workflow author | File restriction patterns prevent agents from touching unrelated files |
| Operator | Pausing a template immediately hides it from the Execute page |
| Developer | Work item PRDs loaded from real .workitems/ directory, not hard-coded mocks |

---

## Acceptance Criteria

### AC-1: Template Filtering
- Given `WorkflowMetadata.status === 'paused'`, the template does NOT appear in the Execute page list
- Given `WorkflowMetadata.status === 'active'` OR `status` is undefined, the template appears
- A "N paused" badge is shown when at least one template is paused

### AC-2: Template Search
- A search input above the template list filters cards in real-time (by name and tags)
- Empty search shows all Active templates

### AC-3: Repository Mounting — Local
- "Browse…" button opens an OS directory picker (Electron `showOpenDialog`)
- Selected path is displayed in the input field
- `REPO_VALIDATE` runs automatically; shows "Valid repo" or "No .git found (OK to continue)"
- `canStart` requires a valid mounted path

### AC-4: Repository Mounting — GitHub Clone
- User pastes a GitHub URL and clicks "Clone"
- Clone spinner shown while `git clone --depth=1` runs
- On success, local path displayed and validated
- On failure (auth required, invalid URL), error message shown
- `file://`, `ssh://`, `git://` schemes rejected client- and server-side

### AC-5: File Restrictions
- User can add glob patterns (e.g., `src/**/*.ts`)
- Each pattern appears as a chip with an × to remove
- Patterns stored in `repoMount.fileRestrictions`
- Patterns appended to agent system prompt: `"Only modify files matching: <patterns>"`

### AC-6: Start Workflow Validation
- "Start Workflow" button is disabled if:
  - No template selected, OR
  - Template status is `'paused'`, OR
  - No `repoMount` set (localPath is empty)
- Work item is optional (button enabled without it)

### AC-7: Execution receives repoMount
- `ExecutionEngine` `workingDirectory` is set to `repoMount.localPath`
- `CLISpawner` spawns agent processes with this as cwd
- File restriction prompt appended when `fileRestrictions.length > 0`

### AC-8: PRDs Tab — Real Data
- `WorkItemPickerDialog` PRDs tab loads from `WORKITEM_LIST_FS` IPC
- Returns `.workitems/` files relative to configured `workflowDirectory`
- Falls back to empty list (no error) if directory not configured

### AC-9: lastUsedAt
- After a successful `startExecution`, `WORKFLOW_TOUCH` is called with the workflow ID
- The template card shows "Last used: X days ago" (or "Never")

---

## Risks and Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| git clone fails for private repos | High | Return clear error; doc that public repos required for auto-clone |
| Clone takes too long (large repo) | Medium | `--depth=1` limits clone; show spinner; allow cancellation |
| .workitems/ directory not configured | Medium | Fallback: show empty list with helpful message to set workflowDirectory |
| Temp dir fills with old clones | Low | Clones created with timestamp suffix; OS temp cleanup handles rest |
| Existing tests break after WorkflowMetadata change | Low | `status` is optional, defaults to `active`; backwards compat |
