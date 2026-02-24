# P15-F03: Execute — Workflow Launcher — Design

**Feature ID:** P15-F03
**Status:** Planning
**Phase:** 2 (design and implement)
**Date:** 2026-02-22
**Dependencies:** P14-F04 (ExecutionEngine), P14-F07 (Cursor CLI backend)

---

## Overview and Goals

P15-F03 extends the existing `ExecutionPage.tsx` from a basic workflow selector into a
**four-step wizard launcher** that gates execution on a proper setup sequence:

1. **Template Selection** — pick an Active workflow template (searchable, Paused hidden)
2. **Work Item Input** — attach context via PRD, GitHub issue, idea, or free text (reuse existing `WorkItemPickerDialog`)
3. **Repository Mounting** — mount the code repo the agents will operate on (local path or GitHub clone)
4. **Launch** — validate all three steps, then `startExecution()` and navigate to `/execute/run`

The current `ExecutionPage.tsx` already implements steps 1 and 2 (partially) and the Launch button.
P15-F03 adds:
- Template status filtering (`active` / `paused`) and search
- Template `lastUsedAt` tracking
- Repository mounting: local directory picker + GitHub clone
- File restriction patterns (glob-based agent guardrails)
- Updated validation: template Active + repo mounted are required; work item is optional
- Real work item data wiring (replaces mock data in `WorkItemPickerDialog`)
- `repoMount` propagation into `ExecutionEngine` so CLI spawner uses the correct working directory

---

## Technical Approach

### Minimal Disruption to Existing Code

The existing `ExecutionPage.tsx` is kept as the entry point. Rather than rewriting to a
multi-page stepper, the page becomes a **vertical stepped form** — sections become visible as
the user completes earlier steps (progressive disclosure). This avoids React Router changes
and keeps the existing Zustand store wiring intact.

```
ExecutionPage
├── StepHeader ("1 · Template")
│   └── WorkflowListPanel (search input + card list, Active only)
├── StepHeader ("2 · Work Item") [visible once template selected]
│   └── WorkItemPickerDialog trigger (existing, unchanged)
├── StepHeader ("3 · Repository") [visible once template selected]
│   └── RepoMountSection (new component)
│       ├── LocalRepoTab: directory path + Browse button
│       └── GitHubRepoTab: URL input + Clone button
│       └── FileRestrictionsEditor: glob pattern chips
└── Footer
    └── "Start Workflow" button (requires: template Active + repo mounted)
```

### Template Status Field

`WorkflowMetadata` in `shared/types/workflow.ts` gains one optional field:

```typescript
export interface WorkflowMetadata {
  // ... existing fields ...
  status?: 'active' | 'paused';   // undefined treated as 'active' for backwards compat
  lastUsedAt?: string;             // ISO-8601, updated each time a workflow is launched
}
```

`ExecutionPage` filters the workflow list to only show where
`status === 'active' || status === undefined`.

`lastUsedAt` is written back via a new `workflow.touch(id)` IPC channel after a successful
`startExecution` call.

### Repository Mount Types

New shared type in `shared/types/execution.ts` (or a new `shared/types/repo.ts`):

```typescript
export type RepoSource = 'local' | 'github';

export interface RepoMount {
  source: RepoSource;              // discriminant: 'local' or 'github'
  localPath?: string;              // absolute path on disk (optional — set after clone resolves)
  githubUrl?: string;              // GitHub HTTPS URL (only for source === 'github')
  branch?: string;                 // branch or tag to check out (default: default branch)
  cloneDepth?: number;             // shallow clone depth (default: 1)
  fileRestrictions?: string[];     // glob patterns, e.g. ["src/**/*.ts", "docker/**"]
  readOnly?: boolean;              // if true, mount with :ro flag (review-only workflows)
}
```

> **Field name alignment:** The committed `repo.ts` uses `source` (not `type`), `localPath?`
> (optional, not required), and `githubUrl?` (not `remoteUrl?`). All design references must
> use these committed field names.

`ExecutionPage` state gains `repoMount: RepoMount | null`.

### IPC Channels (new)

Added to `shared/ipc-channels.ts`:

```typescript
// Dialog (already committed)
DIALOG_OPEN_DIRECTORY = 'dialog:open-directory',  // replaces REPO_BROWSE_LOCAL

// Repository mount (committed)
REPO_CLONE            = 'repo:clone',              // replaces REPO_CLONE_GITHUB
REPO_CLONE_CANCEL     = 'repo:clone-cancel',       // cancel in-progress clone
REPO_VALIDATE_PATH    = 'repo:validate-path',      // replaces REPO_VALIDATE
REPO_CLONE_PROGRESS   = 'repo:clone-progress',     // main → renderer progress events

// Workflow touch (lastUsedAt update — needs to be added)
WORKFLOW_TOUCH        = 'workflow:touch',

// Work item listing (committed)
WORKITEM_LIST_FS      = 'workitem:list-fs',
```

> **IPC channel alignment:** The committed `ipc-channels.ts` uses `DIALOG_OPEN_DIRECTORY`
> (not `REPO_BROWSE_LOCAL`), `REPO_CLONE` (not `REPO_CLONE_GITHUB`), and `REPO_VALIDATE_PATH`
> (not `REPO_VALIDATE`). All handler implementations must use these committed channel names.

### Main Process: Repo Handlers

New file: `src/main/ipc/repo-handlers.ts`

```typescript
// DIALOG_OPEN_DIRECTORY
// Uses dialog.showOpenDialog({ properties: ['openDirectory'] })
// Returns: { path: string } | { canceled: true }

// REPO_CLONE
// Validates URL scheme (https:// only; rejects file://, ssh://, git://)
// Derives clone target: os.tmpdir() + '/wf-repo-' + hash(url) + '-' + timestamp
// CRITICAL: Runs with --config core.hooksPath=/dev/null to prevent malicious git hooks
// Runs: execa('git', ['clone', '--depth=1', '--config', 'core.hooksPath=/dev/null', url, targetDir])
// Returns: { localPath: string } | { error: string }

// REPO_CLONE_CANCEL
// Aborts in-progress clone via AbortController + child process kill
// Cleans up partial clone directory
// Returns: { success: boolean }

// REPO_VALIDATE_PATH
// Checks: path exists + is directory + .git/ present (or skip if non-git codebase)
// Returns: { valid: boolean; hasGit: boolean }

// WORKFLOW_TOUCH
// Loads workflow JSON, sets metadata.lastUsedAt = new Date().toISOString(), saves back
// Returns: { success: boolean }
```

Security controls:
- `REPO_CLONE`: Only `https://` scheme accepted; blocks `file://`, `ssh://`, `git://`
- `REPO_CLONE`: Uses `--config core.hooksPath=/dev/null` to prevent malicious git hooks from executing
- `DIALOG_OPEN_DIRECTORY`: Uses native OS dialog; no path traversal risk
- Cloned repos land in OS temp directory, isolated from project files
- Temp directories cleaned on `app.on('before-quit')`

### Main Process: startExecution Integration

`ExecutionHandlerDeps` gains `repoMount?: RepoMount`.

The `EXECUTION_START` IPC handler reads `repoMount` from the payload and passes
`repoMount.localPath` (when set) to `ExecutionEngine` as `workingDirectory`.
Note: `localPath` is optional on `RepoMount` — for `source: 'github'`, it is populated
after the clone completes:

```typescript
// execution-handlers.ts (updated)
interface StartPayload {
  workflowId: string;
  workflow: WorkflowDefinition;
  workItem?: WorkItemReference;
  variables?: Record<string, unknown>;
  mockMode?: boolean;
  repoMount?: RepoMount;           // NEW
}
```

`ExecutionEngine` constructor gains `workingDirectory?: string` option. When set, the
`CLISpawner` uses it as the `cwd` for spawned processes. File restriction patterns are
passed as an additional system prompt fragment: "Only modify files matching: [patterns]".

### Work Item Backend Wiring

`workitem-service.ts` already exists but `WorkItemPickerDialog` uses mock data.

New IPC handlers in `workitem-handlers.ts`:

- `WORKITEM_LIST_FS`: reads `settings.workflowDirectory/../.workitems/` (or a configurable
  `workItemDirectory` setting) and returns `WorkItemReference[]` for the PRDs tab.
- `WORKITEM_LOAD_FS`: loads full `WorkItem` content from `.workitems/<id>/prd.md` or
  `user_stories.md`.

GitHub Issues tab wiring is **deferred to P15-F05** (GitHub Integration). The Issues tab
retains its current mock data in this feature.

### UI: RepoMountSection Component

New file: `renderer/components/execution/RepoMountSection.tsx`

```
RepoMountSection
├── Tab bar: [Local Directory] [GitHub Repo]
├── LocalDirectoryTab:
│   ├── Text input (path display, read-only or typed)
│   ├── "Browse…" button → triggers REPO_BROWSE_LOCAL IPC
│   └── Validation: shows green checkmark + "Valid git repo" or warning "No .git found"
├── GitHubRepoTab:
│   ├── Text input (GitHub URL)
│   ├── "Clone" button → triggers REPO_CLONE_GITHUB IPC (with spinner)
│   └── Error display if clone fails
└── FileRestrictionsEditor (shared, shown once repo mounted):
    ├── Label: "File Restrictions (optional)"
    ├── Chip list of current patterns
    ├── Add input: text field + Enter/+ to add
    └── Remove: × on each chip
```

Props:
```typescript
interface RepoMountSectionProps {
  value: RepoMount | null;
  onChange: (mount: RepoMount | null) => void;
}
```

---

## Interfaces and Dependencies

### Upstream (consumes)
- `ExecutionEngine` — `workingDirectory` option (main/services/execution-engine.ts)
- `CLISpawner` — `cwd` option (main/services/cli-spawner.ts)
- `WorkItemPickerDialog` — existing component (unchanged)
- `workitem-service.ts` — existing service, adds new IPC handlers
- `dialog` from Electron — `showOpenDialog` for local browse

### Downstream (produces)
- `ExecutionEngine` receives `workingDirectory` → all agent node executions use this cwd
- `workflow.touch()` updates `lastUsedAt` for display in future executions

### New files
```
apps/workflow-studio/src/
├── main/ipc/
│   └── repo-handlers.ts                  # REPO_BROWSE_LOCAL, REPO_CLONE_GITHUB, REPO_VALIDATE
├── renderer/components/execution/
│   └── RepoMountSection.tsx              # New: local + github tabs + restrictions editor
└── shared/types/
    └── repo.ts                           # RepoMount interface
```

### Modified files
```
apps/workflow-studio/src/
├── main/ipc/
│   ├── index.ts                          # Register repo-handlers
│   ├── execution-handlers.ts             # Accept repoMount in StartPayload
│   └── workitem-handlers.ts              # Add WORKITEM_LIST_FS, WORKITEM_LOAD_FS
├── renderer/pages/
│   └── ExecutionPage.tsx                 # Add search, status filter, RepoMountSection
├── renderer/components/workitems/
│   └── WorkItemPickerDialog.tsx          # Wire PRDs tab to IPC (replace mock)
├── preload/
│   ├── preload.ts                        # Expose repo.browse, repo.clone, repo.validate
│   └── electron-api.d.ts                # Type declarations for new IPC
└── shared/
    ├── types/workflow.ts                 # +status, +lastUsedAt on WorkflowMetadata
    ├── types/execution.ts               # OR new repo.ts — RepoMount type
    └── ipc-channels.ts                  # +REPO_*, +WORKFLOW_TOUCH, +WORKITEM_LIST_FS
```

---

## Architecture Decisions

### ADR-1: Vertical Stepped Form vs Full Stepper Wizard

**Decision:** Vertical stepped form (progressive disclosure, all steps on one scroll page).

**Rationale:**
- Avoids adding new routes or router state
- Existing Zustand store and IPC wiring unchanged
- Simpler to implement, lower risk of breaking existing execution flow
- Consistent with current page layout style

**Alternative rejected:** Multi-step wizard with separate routes per step. Would require
significant refactor of router config and store, with no end-user benefit for a 4-step form.

### ADR-2: Clone Target Location

**Decision:** GitHub repos clone to OS temp dir, not inside the project.

**Rationale:**
- Keeps project directory clean
- Temp dir is cleared by OS on reboot
- Clone path is stable within a session (hash of URL + timestamp)

**Trade-off:** Cloned repos are not persisted. If the app restarts, the user must re-clone.
Acceptable for Phase 2; persistent caching deferred to future work.

### ADR-3: Work Item Backend Wiring Scope

**Decision:** Wire PRDs tab to real filesystem in this feature; defer GitHub Issues API to P15-F05.

**Rationale:**
- PRDs tab is straightforward: read `.workitems/` directory via existing `workitem-service.ts`
- GitHub Issues requires OAuth tokens, rate limiting, pagination — belongs in a dedicated feature
- Keeps P15-F03 scope manageable

### ADR-4: File Restrictions — Three-Layer Enforcement

**Decision:** File restrictions use a layered enforcement model:

1. **Layer 1 — System prompt text (soft):** File restriction patterns are appended to the
   system prompt: `"Only modify files matching: [patterns]"`. This is the minimum viable
   enforcement compatible with all three backends (Claude, Cursor, Codex).

2. **Layer 2 — Container-side PreToolUse hook (hard):** A `file-restriction-hook.py` runs
   inside the container. It reads the `FILE_RESTRICTIONS` env var (JSON array of glob patterns)
   and blocks Write/Edit tool calls targeting paths outside the allowed patterns. Modeled on
   the existing `guardrails-enforce.py` hook. Exit code 2 = block.

3. **Layer 3 — Docker bind mount subdirectories (future):** Instead of mounting the entire
   repo, mount only the relevant subdirectories. This provides OS-level enforcement but
   requires more complex Docker configuration. Deferred to future work.

**Rationale:** Layer 1 alone is a soft restriction (the agent could ignore the instruction).
Layer 2 provides hard enforcement inside the container. Together they provide defense in depth.

**Security note on git clone hooks:** Cloned repos may contain `.git/hooks/` with malicious
scripts. The `--config core.hooksPath=/dev/null` flag on `git clone` prevents hook execution.
This is a **critical security fix** (MT-4) that must be present in all clone operations.

---

## File Structure

```
.workitems/P15-F03-execute-launcher/
├── design.md          ← this file
├── prd.md
├── user_stories.md
└── tasks.md
```
