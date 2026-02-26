# P15-F03: Execute — Workflow Launcher — Tasks

**Feature ID:** P15-F03
**Status:** Complete
**Date:** 2026-02-22
**Total Tasks:** 24
**Estimated Total:** ~22.75 hours

---

## Task Breakdown

### Phase 1: Types & IPC Contracts (no UI, no main-process logic)

> Goal: Lock the shared types and IPC channel names before any implementation begins.
> All downstream phases depend on these.

#### T01 — Add `status` and `lastUsedAt` to `WorkflowMetadata` — DONE
- **File:** `apps/workflow-studio/src/shared/types/workflow.ts`
- **Change:** Add `status?: 'active' | 'paused'` and `lastUsedAt?: string`
- **Constraint:** Both fields optional; existing JSON files remain valid
- **Stories:** US-01, US-03
- **Estimate:** 30min
- **Dependencies:** None
- **Status:** [x]

#### T02 — Add `RepoMount` type — DONE
- **File:** `apps/workflow-studio/src/shared/types/repo.ts` (new file)
- **Change:** Export `RepoMount { source: RepoSource, localPath?, githubUrl?, fileRestrictions? }` where `RepoSource = 'local' | 'github'`. Note: `localPath` is optional (not required) per committed type.
- **Stories:** US-04, US-05, US-06, US-08
- **Estimate:** 20min
- **Dependencies:** None
- **Status:** [x]

#### T03 — Add new IPC channel constants — DONE
- **File:** `apps/workflow-studio/src/shared/ipc-channels.ts`
- **Changes:**
  - `DIALOG_OPEN_DIRECTORY` (already committed), `REPO_CLONE`, `REPO_VALIDATE_PATH`, `REPO_CLONE_CANCEL`, `REPO_CLONE_PROGRESS`
  - `WORKFLOW_TOUCH`
  - `WORKITEM_LIST_FS`
- **Note:** Committed code already has `DIALOG_OPEN_DIRECTORY`, `REPO_CLONE`, `REPO_CLONE_CANCEL`, `REPO_VALIDATE_PATH`, `REPO_CLONE_PROGRESS`, and `WORKITEM_LIST_FS`. This task verifies completeness.
- **Stories:** US-04, US-05, US-03, US-09
- **Estimate:** 20min
- **Dependencies:** None
- **Status:** [x]

---

### Phase 2: Main Process — Repo Handlers

> Goal: Implement the Electron main process handlers for repo browsing and cloning.
> These are pure Node.js / Electron logic with no UI.

#### T04 — Implement `DIALOG_OPEN_DIRECTORY` handler — DONE
- **File:** `apps/workflow-studio/src/main/ipc/repo-handlers.ts` (new file)
- **Logic:** `dialog.showOpenDialog({ properties: ['openDirectory'] })` → return `{ path }` or `{ canceled: true }`
- **Register in:** `main/ipc/index.ts`
- **Tests:** `test/main/repo-handlers.test.ts` — mock Electron dialog, assert path returned
- **Stories:** US-04
- **Estimate:** 1hr
- **Dependencies:** T03
- **Status:** [x]

#### T05 — Implement `REPO_CLONE` handler — DONE
- **File:** `apps/workflow-studio/src/main/ipc/repo-handlers.ts`
- **Logic:**
  - Validate `https://` scheme only; reject `file://`, `ssh://`, `git://` → 400-style error
  - Target dir: `path.join(os.tmpdir(), 'wf-repo-' + hash(url).slice(0,8) + '-' + Date.now())`
  - **CRITICAL SECURITY:** Run: `execa('git', ['clone', '--depth=1', '--config', 'core.hooksPath=/dev/null', url, targetDir])` — the `--config core.hooksPath=/dev/null` flag prevents malicious git hooks in cloned repos from executing arbitrary code on the user's machine.
  - Return `{ localPath: targetDir }` on success, `{ error: stderr }` on failure
- **Tests:**
  - Valid HTTPS URL → mock execFile success → returns `{ localPath }`
  - `file://` URL → returns `{ error: "Only HTTPS URLs supported" }` (no exec called)
  - execFile failure (non-zero exit) → returns `{ error: stderr snippet }`
  - Verify `--config core.hooksPath=/dev/null` is present in the git clone args
- **Stories:** US-05
- **Estimate:** 1.5hr
- **Dependencies:** T03
- **Status:** [x]

#### T06 — Implement `REPO_VALIDATE_PATH` handler — DONE
- **File:** `apps/workflow-studio/src/main/ipc/repo-handlers.ts`
- **Logic:**
  - `fs.stat(path)` → if not directory, return `{ valid: false }`
  - `fs.stat(path + '/.git')` → if exists, `{ valid: true, hasGit: true }`, else `{ valid: true, hasGit: false }`
- **Tests:** valid dir with .git, valid dir without .git, non-existent path
- **Stories:** US-04
- **Estimate:** 45min
- **Dependencies:** T03
- **Status:** [x]

#### T07 — Implement `WORKFLOW_TOUCH` handler — DONE
- **File:** `apps/workflow-studio/src/main/ipc/workflow-handlers.ts` (existing, add new case)
- **Logic:** Load workflow JSON → set `metadata.lastUsedAt = new Date().toISOString()` → save → return `{ success: true }`
- **Tests:** 4 tests in `test/main/workflow-touch.test.ts`
- **Stories:** US-03
- **Estimate:** 45min
- **Dependencies:** T01, T03
- **Status:** [x]

---

### Phase 3: Main Process — Work Item FS Handlers

> Goal: Replace mock data in WorkItemPickerDialog with real filesystem reads.

#### T08 — Implement `WORKITEM_LIST_FS` and `WORKITEM_LOAD_FS` handlers — DONE
- **File:** `apps/workflow-studio/src/main/ipc/workitem-handlers.ts` (existing, add new handlers)
- **Logic for LIST_FS:**
  - Read `settings.workflowDirectory` (or a to-be-added `workItemDirectory` setting)
  - List subdirectories in that path
  - For each dir: derive `WorkItemReference` (id=dirname, title=dirname, type='prd', source='filesystem', path=fullPath)
  - Return `WorkItemReference[]`
- **Logic for LOAD_FS:**
  - Given a path, read `prd.md` or `user_stories.md` file content
  - Return `WorkItem { content, ...reference }`
- **Tests:** Real-fs tests: 4 tests for LIST_FS + 6 tests for LOAD_FS (all passing)
- **Stories:** US-09
- **Estimate:** 1hr
- **Dependencies:** T03
- **Status:** [x]

---

### Phase 4: Main Process — Execution Integration

> Goal: Plumb repoMount through to ExecutionEngine and CLISpawner.

#### T09 — Update `EXECUTION_START` handler to accept `repoMount` — DONE
- **File:** `apps/workflow-studio/src/main/ipc/execution-handlers.ts`
- **Change:** Add `repoMount?: RepoMount` to `StartPayload`; pass `repoMount.localPath` as
  `workingDirectory` to `ExecutionEngine` constructor; pass `repoMount.fileRestrictions` as
  `fileRestrictions` option
- **Stories:** US-08
- **Estimate:** 30min
- **Dependencies:** T02, T03
- **Status:** [x]

#### T10 — Update `ExecutionEngine` to accept `workingDirectory` and `fileRestrictions` — DONE
- **File:** `apps/workflow-studio/src/main/services/execution-engine.ts`
- **Changes:**
  - Add `workingDirectory?: string` and `fileRestrictions?: string[]` to `ExecutionEngineOptions`
  - When spawning real node: pass `cwd: this.workingDirectory` to `CLISpawner.spawn()`
  - When `fileRestrictions` is non-empty: append `"\n\nOnly modify files matching: {patterns}"` to effective system prompt
- **Tests:** Update `execution-engine-integration.test.ts` — assert cwd set when workingDirectory provided
- **Stories:** US-08
- **Estimate:** 1hr
- **Dependencies:** T09
- **Status:** [x]

---

### Phase 5: Preload & Type Declarations

> Goal: Expose new IPC calls to the renderer with full TypeScript types.

#### T11 — Update preload.ts and electron-api.d.ts for repo + workitem APIs — DONE
- **Files:**
  - `apps/workflow-studio/src/preload/preload.ts`
  - `apps/workflow-studio/src/preload/electron-api.d.ts`
- **Additions:**
  - `window.electronAPI.repo.browse()`, `.clone(url)`, `.validate(path)`
  - `window.electronAPI.workflow.touch(id)`
  - `window.electronAPI.workitem.listFs()`
- **Stories:** US-10
- **Estimate:** 30min
- **Dependencies:** T03, T04, T05, T06, T07, T08
- **Status:** [x]

---

### Phase 6: UI — Template List Enhancements

> Goal: Add status filtering, search, and lastUsedAt display to the Execute page.

#### T12 — Add template status filter to ExecutionPage — DONE
- **File:** `apps/workflow-studio/src/renderer/pages/ExecutionPage.tsx`
- **Changes:**
  - Filter `workflows` to only those where `status === 'active' || !status`
  - Compute `pausedCount = workflows.filter(w => w.metadata.status === 'paused').length`
  - Show badge "N paused hidden" in section header when `pausedCount > 0`
- **Tests:** Verified by ExecutionPage tests (status filter, paused count badge)
- **Stories:** US-01
- **Estimate:** 30min
- **Dependencies:** T01, T11
- **Status:** [x]

#### T13 — Add template search input to ExecutionPage — DONE
- **File:** `apps/workflow-studio/src/renderer/pages/ExecutionPage.tsx`
- **Changes:**
  - Add `templateSearch: string` state
  - Add search `<input>` above card list
  - Filter cards by `name.toLowerCase().includes(query)` OR any tag includes query
  - Show "No templates match" when 0 results
- **Tests:** Verified by ExecutionPage tests (search input, name/tag filtering)
- **Stories:** US-02
- **Estimate:** 30min
- **Dependencies:** T12
- **Status:** [x]

#### T14 — Add lastUsedAt display to WorkflowSummaryCard + touch after launch — DONE
- **File:** `apps/workflow-studio/src/renderer/pages/ExecutionPage.tsx`
- **Changes:**
  - `WorkflowSummaryCard`: show `"Last used: N days ago"` or `"Never"` below node dots
  - After `startExecution` success: call `window.electronAPI.workflow.touch(selectedWorkflow.id)`
- **Tests:** Verified by ExecutionPage tests (lastUsedAt display, touch after launch)
- **Stories:** US-03
- **Estimate:** 30min
- **Dependencies:** T07, T11, T13
- **Status:** [x]

---

### Phase 7: UI — RepoMountSection Component

> Goal: Build the new repository mounting UI as a self-contained component.

#### T15 — Build `RepoMountSection` component skeleton (tabs) — DONE
- **File:** `apps/workflow-studio/src/renderer/components/execution/RepoMountSection.tsx` (new)
- **Structure:**
  - Tab bar: [Local Directory] [GitHub Repo]
  - Props: `{ value: RepoMount | null; onChange: (m: RepoMount | null) => void }`
  - Local tab: path input (readonly) + "Browse…" button → calls `window.electronAPI.repo.browse()`
  - GitHub tab: URL text input + "Clone" button → calls `window.electronAPI.repo.clone(url)`
  - Loading state for clone (spinner + "Cloning…" text)
  - Error display for clone failures
- **Stories:** US-04, US-05
- **Estimate:** 1.5hr
- **Dependencies:** T02, T11
- **Status:** [x]

#### T16 — Add `REPO_VALIDATE` feedback to RepoMountSection (LocalDirectoryTab) — DONE
- **File:** `apps/workflow-studio/src/renderer/components/execution/RepoMountSection.tsx`
- **Changes:**
  - After path selected, call `window.electronAPI.repo.validate(path)`
  - Show status chip: green "Valid git repo" / yellow "No .git found" / red "Invalid path"
- **Stories:** US-04
- **Estimate:** 30min
- **Dependencies:** T15
- **Status:** [x]

#### T17 — Add `FileRestrictionsEditor` to RepoMountSection — DONE
- **File:** `apps/workflow-studio/src/renderer/components/execution/RepoMountSection.tsx`
- **Changes:**
  - Shown below tab panel once a path/clone is set
  - Text input + "+" button to add a glob pattern
  - Enter key also adds
  - Each pattern shown as a chip with × to remove
  - Updates `value.fileRestrictions` array on each change via `onChange`
- **Stories:** US-06
- **Estimate:** 45min
- **Dependencies:** T15
- **Status:** [x]

---

### Phase 8: UI — Execute Page Integration & Validation

> Goal: Wire RepoMountSection into ExecutionPage and update validation + IPC call.

#### T18 — Integrate RepoMountSection into ExecutionPage — DONE
- **File:** `apps/workflow-studio/src/renderer/pages/ExecutionPage.tsx`
- **Changes:**
  - Add `repoMount: RepoMount | null` state
  - Add "3. Mount Repository" section (visible once template selected)
  - Render `<RepoMountSection value={repoMount} onChange={setRepoMount} />`
  - Update `canStart`: require `repoMount !== null && repoMount.localPath !== ''`
  - Include `repoMount` in `startExecution` IPC call payload
- **Stories:** US-07, US-08
- **Estimate:** 45min
- **Dependencies:** T15, T16, T17, T12, T13, T14
- **Status:** [x]

#### T19 — Wire PRDs tab to real IPC in WorkItemPickerDialog — DONE
- **File:** `apps/workflow-studio/src/renderer/components/workitems/WorkItemPickerDialog.tsx`
- **Changes:**
  - On dialog open (useEffect on `isOpen`), call `window.electronAPI.workitem.listFs()`
  - Show loading spinner while fetching
  - Replace `MOCK_PRDS` with fetched data
  - On error or empty response, show "No work items found" with settings hint
  - Keep MOCK_ISSUES and MOCK_IDEAS unchanged (GitHub Issues deferred)
- **Tests:** 6 tests in `test/renderer/components/workitems/WorkItemPickerDialog.test.tsx`
- **Stories:** US-09
- **Estimate:** 1hr
- **Dependencies:** T08, T11
- **Status:** [x]

---

---

### Phase 9: Security & Robustness (T20–T24)

> Goal: Address security findings and operational robustness gaps.

#### T20 — Implement file-restriction PreToolUse hook for containers — DONE
- **File:** `apps/workflow-studio/resources/hooks/file-restriction-hook.py` (new file)
- **Logic:**
  - Container-side `file-restriction-hook.py` reads `FILE_RESTRICTIONS` env var (JSON array of glob patterns)
  - On PreToolUse for Write/Edit tools, check if the target `file_path` matches any allowed pattern via `fnmatch`
  - If no match: exit 2 (BLOCK) with reason on stderr
  - If match: exit 0 (allow)
  - Modeled on existing `guardrails-enforce.py`
- **Tests:** 12 Python tests in `resources/hooks/test_file_restriction_hook.py`
- **Stories:** US-06, US-08
- **Estimate:** 2hr
- **Dependencies:** T10
- **Status:** [x]

#### T21 — Implement clone cancellation backend — DONE
- **File:** `apps/workflow-studio/src/main/ipc/repo-handlers.ts`
- **Logic:**
  - `REPO_CLONE_CANCEL` IPC channel is already declared in `ipc-channels.ts`
  - Implement handler: store `AbortController` / child process reference during `REPO_CLONE`
  - On cancel: call `controller.abort()` + `childProcess.kill('SIGTERM')` → clean up partial clone dir
  - Return `{ success: true }` on cancel, `{ success: false, error }` if no active clone
- **Tests:** Start clone → cancel → verify child process killed and temp dir cleaned
- **Stories:** US-05
- **Estimate:** 1hr
- **Dependencies:** T05
- **Status:** [x]

#### T22 — Temp directory cleanup on app quit — DONE
- **File:** `apps/workflow-studio/src/main/temp-cleanup.ts` (new module) + `src/main/index.ts` (wired on before-quit)
- **Logic:**
  - On `app.on('before-quit')`, scan `os.tmpdir()` for dirs matching `wf-repo-*` pattern
  - Delete each matching directory via `fs.rm(dir, { recursive: true, force: true })`
  - Log cleanup count to console
- **Tests:** 7 tests in `test/main/temp-cleanup.test.ts`
- **Estimate:** 30min
- **Dependencies:** T05
- **Status:** [x]

#### T23 — Read-only mounts (`:ro` flag) for review-only workflows — DONE
- **File:** `apps/workflow-studio/src/shared/types/cli.ts` (readOnly on CLISessionContext), `src/main/services/cli-spawner.ts` (:ro bind mount + system prompt)
- **Logic:**
  - Add `readOnly?: boolean` field to `CLISessionContext`
  - When `readOnly === true` and Docker mode is used, append `:ro` to the bind mount flag
  - System prompt gets additional instruction: "This repository is mounted read-only. Do not attempt to write files."
- **Tests:** 5 tests in `test/main/cli-spawner-readonly.test.ts`
- **Estimate:** 30min
- **Dependencies:** T02, T10
- **Status:** [x]

#### T24 — Add `WORKFLOW_TOUCH` IPC channel to committed ipc-channels.ts — DONE
- **File:** `apps/workflow-studio/src/shared/ipc-channels.ts`
- **Logic:**
  - Add `WORKFLOW_TOUCH: 'workflow:touch'` to the IPC_CHANNELS object
  - This channel is referenced in T07 but not yet in committed code
- **Estimate:** 15min
- **Dependencies:** None
- **Status:** [x]

---

## Progress Tracking

| Phase | Tasks | Done | Status |
|-------|-------|------|--------|
| 1: Types & Contracts | T01–T03 | 3/3 | DONE |
| 2: Repo Handlers | T04–T07 | 4/4 | DONE |
| 3: WorkItem FS Handlers | T08 | 1/1 | DONE |
| 4: Execution Integration | T09–T10 | 2/2 | DONE |
| 5: Preload & Types | T11 | 1/1 | DONE |
| 6: Template Enhancements | T12–T14 | 3/3 | DONE |
| 7: RepoMountSection | T15–T17 | 3/3 | DONE |
| 8: Page Integration | T18–T19 | 2/2 | DONE |
| 9: Security & Robustness | T20–T24 | 5/5 | DONE |
| **Total** | **24** | **24/24 done** | **Complete** |

---

## Dependency Graph

```
T01, T02, T03, T24 (no deps)
    │
    ├── T04, T05, T06, T07 (Phase 2 — need T03; T07 needs T01)
    │       │
    │       ├── T21 (clone cancel — needs T05)
    │       ├── T22 (temp cleanup — needs T05)
    │       └── T08 (Phase 3 — needs T03)
    │               │
    │               └── T09, T10 (Phase 4 — need T02, T03)
    │                       │
    │                       ├── T20 (file-restriction hook — needs T10)
    │                       ├── T23 (read-only mounts — needs T02, T10)
    │                       └── T11 (Phase 5 — needs T03-T10)
    │                               │
    │             ┌─────────────────┘
    │             │
    ├── T12 (needs T01, T11)
    │   └── T13 (needs T12)
    │       └── T14 (needs T07, T11, T13)
    │
    ├── T15 (needs T02, T11)
    │   ├── T16 (needs T15)
    │   └── T17 (needs T15)
    │
    ├── T18 (needs T15, T16, T17, T12, T13, T14)
    └── T19 (needs T08, T11)
```

---

## Open Questions

1. **`workItemDirectory` setting:** Should the work item directory be a separate setting from
   `workflowDirectory`? Or should it always be `workflowDirectory + '/../.workitems'`?
   → Decision needed before T08 implementation.

2. **Clone cancellation:** **RESOLVED.** Yes — implemented as T21. `REPO_CLONE_CANCEL` IPC
   is already declared. T21 implements AbortController + child process kill in repo-handlers.ts.

3. **File restrictions UX:** Are glob patterns the right abstraction for non-technical users?
   An alternative is a directory checkbox tree. Stick with glob strings for Phase 2;
   revisit if user testing shows confusion.

4. **`execa` vs `child_process`:** The project uses `node-pty` for CLISpawner. For the one-shot
   `git clone`, `child_process.execFile` is sufficient. Confirm no `execa` dependency needed.
