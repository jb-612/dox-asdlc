# P15-F03: Execute — Workflow Launcher — User Stories

**Feature ID:** P15-F03
**Epic:** P15 — Electron Workflow Studio Phase 2
**Date:** 2026-02-22

---

## Epic Summary

As a workflow author, I want the Execute tab to guide me through selecting a template,
providing context (work item), and mounting a code repository before launching a workflow run,
so that agent nodes have the right codebase and context without requiring manual setup.

---

## US-01: Template Status Filtering

**As a** workflow author,
**I want** the Execute page to only show Active templates,
**So that** I don't accidentally start a Paused template and get a confusing failure.

### Acceptance Criteria

- `WorkflowDefinition.metadata.status === 'paused'` → card does NOT appear in Execute list
- `status === 'active'` OR `status` is undefined → card appears
- Header badge shows "N paused hidden" when any are filtered out
- Existing workflows without `status` field behave as Active (backwards compatible)

### Technical Notes
- `WorkflowMetadata` gains optional `status?: 'active' | 'paused'` field
- Filter runs client-side after `workflow.list()` IPC response
- No schema migration required (existing JSON files remain valid)

---

## US-02: Template Search

**As a** workflow author,
**I want** to search templates by name or tag,
**So that** I can quickly find the right template when I have many saved workflows.

### Acceptance Criteria

- Search input appears above the template card list on the Execute page
- Typing filters cards in real-time (< 50ms, client-side)
- Search matches template name (case-insensitive) OR any tag
- Empty search shows all Active templates
- "No templates match your search" shown when filter returns 0 results
- Search input has placeholder "Search templates…"

---

## US-03: Last Used Timestamp on Templates

**As a** workflow author,
**I want** to see when I last ran each template,
**So that** I can identify my most recently used workflows at a glance.

### Acceptance Criteria

- `WorkflowMetadata.lastUsedAt` (ISO-8601 string) written after each successful launch
- Template card shows "Last used: X days ago" (human-relative time)
- Templates never run show "Last used: never"
- `WORKFLOW_TOUCH` IPC called after `startExecution` completes without error
- If `WORKFLOW_TOUCH` fails, execution is NOT blocked (fire-and-forget)

---

## US-04: Mount a Local Repository

**As a** workflow author,
**I want** to select a directory on my local machine as the repository for a workflow run,
**So that** agent nodes execute with access to my actual codebase.

### Acceptance Criteria

- "3. Repository" section appears on the Execute page once a template is selected
- A "Local Directory" tab contains a path display field and a "Browse…" button
- Clicking "Browse…" opens the OS native directory picker (Electron `showOpenDialog`)
- Selected path is set in the input field immediately
- `REPO_VALIDATE` runs automatically and shows:
  - Green "Valid git repo" if `.git/` directory found
  - Yellow "No .git found — OK to proceed" if directory exists but no git
  - Red error if path does not exist or is not a directory
- The repo mount is saved in component state as `RepoMount { type: 'local', localPath }`

---

## US-05: Clone a GitHub Repository

**As a** workflow author,
**I want** to provide a GitHub repository URL and have the app clone it for me,
**So that** I can run workflows on remote projects without manually cloning them first.

### Acceptance Criteria

- A "GitHub Repo" tab in the Repository section contains a URL input and "Clone" button
- Button is disabled while URL is empty
- Clicking "Clone" triggers `REPO_CLONE_GITHUB` IPC:
  - Shows spinner "Cloning…" while in progress
  - On success: displays local path, sets mount state
  - On failure: displays red error message (auth required, invalid URL, network error)
- `https://` URLs accepted; `file://`, `ssh://`, `git://` rejected with error "Only HTTPS URLs supported"
- Clone uses `git clone --depth=1 <url> <tempDir>` (shallow clone for speed)
- Clone target: `{os.tmpdir()}/wf-repo-{hash}-{timestamp}`

---

## US-06: Specify File Restrictions

**As a** workflow author,
**I want** to specify which files and directories the agents are allowed to modify,
**So that** agents don't accidentally change files outside my intended scope.

### Acceptance Criteria

- "File Restrictions (optional)" section appears once a repo is mounted
- User can type a glob pattern (e.g., `src/**/*.ts`) and press Enter or click "+" to add
- Each pattern appears as a chip with an × remove button
- No minimum number of patterns required (zero patterns = no restriction)
- Patterns are stored in `repoMount.fileRestrictions: string[]`
- When `fileRestrictions.length > 0`, the restriction is appended to every agent node's
  effective system prompt: `"Only modify files matching: src/**/*.ts, docker/**"`

---

## US-07: Start Workflow Validation

**As a** workflow author,
**I want** the "Start Workflow" button to remain disabled until I've completed the required
setup steps,
**So that** I don't accidentally launch an incomplete run.

### Acceptance Criteria

- "Start Workflow" button is **disabled** when:
  - No template selected, OR
  - Selected template has `status === 'paused'`
  - No repo is mounted (localPath is empty string)
- "Start Workflow" button is **enabled** when:
  - An Active template is selected, AND
  - A repo is mounted (local or GitHub clone completed)
  - (Work item is optional — button enabled without it)
- Disabled button shows `cursor-not-allowed` and muted color

---

## US-08: Repository Context Flows to Execution Engine

**As a** developer,
**I want** the `repoMount.localPath` to be passed through to the `ExecutionEngine`
and used as the working directory for all agent CLI processes,
**So that** agents run inside the target repository.

### Acceptance Criteria

- `EXECUTION_START` IPC payload includes `repoMount?: RepoMount`
- `ExecutionEngine` constructor accepts `workingDirectory?: string` option
- `CLISpawner` spawns agent processes with `cwd: workingDirectory` when set
- File restriction patterns from `repoMount.fileRestrictions` are joined and appended
  to the effective system prompt for each agent node in the execution run
- Unit test: `ExecutionEngine` with `workingDirectory` set passes it to `CLISpawner`

---

## US-09: PRDs Tab Shows Real Work Items

**As a** workflow author,
**I want** the "PRDs" tab in the work item picker to show real work items from my
`.workitems/` directory,
**So that** I don't have to manually type context that already exists in my project.

### Acceptance Criteria

- `WorkItemPickerDialog` PRDs tab loads from `WORKITEM_LIST_FS` IPC on dialog open
- Returns `WorkItemReference[]` for all subdirectories in configured work item directory
- Each entry shows: title (from directory name), type badge "prd", path
- If `workflowDirectory` is not configured, shows "No work items directory configured"
  with a link/hint to configure it in Settings
- Loading spinner shown while IPC resolves
- Falls back to empty list (no crash) if directory not found

---

## US-10: Preload and Type Safety

**As a** developer,
**I want** all new IPC channels exposed via `preload.ts` and typed in `electron-api.d.ts`,
**So that** the renderer can call repo and workitem APIs without unsafe casts.

### Acceptance Criteria

- `window.electronAPI.repo.browse()` → `Promise<{ path: string } | { error: string }>`
- `window.electronAPI.repo.clone(url)` → `Promise<{ localPath: string } | { error: string }>`
- `window.electronAPI.repo.validate(path)` → `Promise<{ valid: boolean; hasGit: boolean }>`
- `window.electronAPI.workflow.touch(id)` → `Promise<{ success: boolean }>`
- `window.electronAPI.workitem.listFs()` → `Promise<WorkItemReference[]>`
- `tsc --noEmit` passes with 0 errors after adding declarations
