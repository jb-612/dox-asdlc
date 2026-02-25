---
id: P15-F06
parent_id: P15
type: tasks
version: 1
status: draft
constraints_hash: null
created_by: planner
created_at: "2026-02-22T00:00:00Z"
updated_at: "2026-02-22T00:00:00Z"
dependencies:
  - P14-F05
tags:
  - cli-session
  - terminal
  - docker
---

# Tasks: CLI Session Enhancement (P15-F06)

## Progress

- Started: 2026-02-22
- Tasks Complete: 15/15
- Percentage: 100%
- Status: COMPLETE

---

### T01: Extend shared types with mode and context

- [x] Estimate: 30min
- [x] Tests: TypeScript compiles; existing CLI tests unaffected
- [x] Dependencies: None
- [ ] Notes: Update `cli.ts` — add `CLISpawnMode` type (`'local' | 'docker'`), add
      `CLISessionContext` interface (repoPath, githubIssue, workflowTemplate, systemPrompt),
      extend `CLISpawnConfig` with `mode`, `context`, `dockerImage`, `dockerContainerId` fields,
      extend `CLISession` with `mode`, `context`, `containerId` fields. Defaults: mode='local'.

---

### T02: Reconcile IPC channel references with committed code

- [x] Estimate: 30min
- [x] Tests: TypeScript compiles
- [x] Dependencies: T01
- [ ] Notes: The committed `ipc-channels.ts` already defines F06 channels with these names:
      `CLI_SESSION_SAVE` (`cli:session-save`), `CLI_SESSION_HISTORY` (`cli:session-history`),
      `CLI_PRESETS_LOAD` (`cli:presets-load`), `CLI_PRESETS_SAVE` (`cli:presets-save`),
      `CLI_LIST_IMAGES` (`cli:list-images`). Use these committed channel names throughout
      the F06 implementation. Wire preload bridge for new channels. **Do NOT use the
      originally planned `CLI_HISTORY_LIST`, `CLI_HISTORY_CLEAR` names.**

---

### T03: Implement Docker status check in CLISpawner

- [x] Estimate: 1hr
- [x] Tests: Unit test: mock `execFile('docker', ['version'])` success/failure paths
- [x] Dependencies: T01
- [ ] Notes: Add `getDockerStatus()` method to `CLISpawner`. Runs `docker version --format json`
      via `child_process.execFile` with 2s timeout. Returns `{ available: boolean; version?: string }`.
      Cache result for 30 seconds to avoid repeated checks.

---

### T04: Implement Docker-mode spawning in CLISpawner

- [x] Estimate: 2hr
- [x] Tests: Unit test with mocked node-pty; integration test if Docker available
- [x] Dependencies: T01, T03
- [ ] Notes: Add `spawnDocker()` private method. Builds docker command:
      `docker run -it --rm [-v repoPath:/workspace] [-e GITHUB_ISSUE=...] <image> claude <args>`.
      Update `spawn()` to dispatch: if `config.mode === 'docker'` call `spawnDocker()`, else
      existing `spawnLocal()` path (rename current spawn logic). Store container ID from docker
      output parsing. Use same PTY → IPC pipeline as local mode.

---

### T05: Implement SessionHistoryService

- [x] Estimate: 1hr
- [x] Tests: Unit tests: add entry, list, clear, ring buffer at max=50, persistence
- [x] Dependencies: T01
- [ ] Notes: New file `session-history-service.ts` in `main/services/`. Reads/writes
      `~/.workflow-studio/cli-sessions.json`. Ring buffer capped at 50 entries. Methods:
      `addEntry(session)`, `list(limit?)`, `clear()`. Called by CLISpawner on session exit.
      Uses `app.getPath('userData')` for cross-platform path.

---

### T06: Register history and Docker status IPC handlers

- [x] Estimate: 30min
- [x] Tests: TypeScript compiles; manual IPC test
- [x] Dependencies: T02, T03, T05
- [ ] Notes: Update `cli-handlers.ts` to add handlers for `CLI_SESSION_HISTORY` (returns history
      entries), `CLI_SESSION_SAVE` (saves session on exit), `CLI_LIST_IMAGES` (returns
      available Docker images), `CLI_PRESETS_LOAD` / `CLI_PRESETS_SAVE` (preset management),
      and `CLI_DOCKER_STATUS` (new channel — see T14). Wire `SessionHistoryService` instance
      into handler registration.

---

### T07: Enhance SpawnDialog with mode toggle and context fields

- [x] Estimate: 2hr
- [x] Tests: Component renders; mode toggle switches fields; context fields validated
- [x] Dependencies: T01, T02
- [ ] Notes: Modify `SpawnDialog.tsx`: add Local/Docker radio toggle at top; add collapsible
      "Session Context" section with repo path (+ folder picker via `dialog:open-directory`),
      GitHub issue (text input with pattern validation), workflow template (dropdown, populated
      from workflow store if available). Add Docker status indicator (green/red dot) that calls
      `CLI_DOCKER_STATUS` on dialog open. Docker mode disabled when not available.

---

### T08: Add quick-start presets to SpawnDialog — DONE

- [x] Estimate: 1hr
- [x] Tests: Clicking preset fills form correctly — 20 component tests verify preset buttons
- [x] Dependencies: T07
- [ ] Notes: Add a row of 3 preset buttons above the form: "Raw Session" (local, claude, no
      context), "Issue Focus" (docker, highlights repo+issue), "Template Run" (docker, highlights
      template dropdown). Presets pre-fill form fields; user can modify before spawning.

---

### T09: Add terminal clear functionality

- [x] Estimate: 30min
- [x] Tests: Clear button resets xterm buffer; cliStore output buffer emptied
- [x] Dependencies: None
- [ ] Notes: Add "Clear" button to `TerminalPanel` toolbar or `CLISessionList` header. On click:
      call `terminal.clear()` on xterm.js instance and reset `outputBuffers` for selected session
      in cliStore. Add keyboard shortcut `Cmd+K` / `Ctrl+K`. Add `clearOutput(sessionId)` action
      to cliStore.

---

### T10: Add SessionHistoryPanel component

- [x] Estimate: 1.5hr
- [x] Tests: Panel renders history entries; re-run opens pre-filled SpawnDialog; clear works
- [x] Dependencies: T05, T06
- [ ] Notes: New `SessionHistoryPanel.tsx` in `renderer/components/cli/`. Collapsible panel below
      session list. Shows entries: mode icon, command, context summary (repo/issue), timestamps,
      exit code badge. "Re-run" button per entry opens SpawnDialog with config pre-filled.
      "Clear All" button resets local history state (clear is a local action since `CLI_SESSION_HISTORY`
      returns the ring buffer). Add `history` state and `loadHistory` action
      to cliStore. Integrate into `CLIManagerPage.tsx` layout.

---

---

## Phase 4: Design Review Findings

### T12: PTY back-pressure / bounded buffer for high-output Docker containers

- [x] Estimate: 1hr
- [x] Tests: Unit test -- buffer caps at configured max (e.g., 1MB); excess output is dropped with warning; no OOM on long-running container output
- [x] Dependencies: T04
- [ ] Notes: When a Docker container produces high-volume output (e.g., streaming build logs), the PTY → IPC pipeline can buffer unboundedly. Add a bounded buffer (e.g., 1MB ring buffer) between the PTY data event and the IPC send. When the buffer is full, drop the oldest data and emit a `cli:output-truncated` warning to the renderer. This prevents memory exhaustion for long-running container sessions.

### T13: Reconcile IPC channel name references across all task descriptions

- [x] Estimate: 30min
- [x] Tests: Grep all task files for old channel names; none found
- [x] Dependencies: None
- [ ] Notes: Audit all F06 documentation and task descriptions to ensure they reference the committed IPC channel names: `CLI_SESSION_SAVE`, `CLI_SESSION_HISTORY`, `CLI_PRESETS_LOAD`, `CLI_PRESETS_SAVE`, `CLI_LIST_IMAGES`. Remove any references to the originally planned `CLI_HISTORY_LIST`, `CLI_HISTORY_CLEAR` names.

### T14: Add `CLI_DOCKER_STATUS` IPC channel

- [x] Estimate: 30min
- [x] Tests: TypeScript compiles; handler returns `{ available: boolean, version?: string }`
- [x] Dependencies: T02, T03
- [ ] Notes: Add `CLI_DOCKER_STATUS: 'cli:docker-status'` to `ipc-channels.ts` as a new channel (not yet in committed code). Wire to `CLISpawner.getDockerStatus()` in the IPC handler. This channel is needed by the SpawnDialog to show Docker availability.

### T15: Session output capture — add `sessionSummary` to `SessionHistoryEntry`

- [x] Estimate: 1hr
- [x] Tests: Unit test -- session summary includes tool call count, files modified list, exit status; summary persisted in history JSON
- [x] Dependencies: T05
- [ ] Notes: Extend `SessionHistoryEntry` with a `sessionSummary` field containing: `toolCallCount: number`, `filesModified: string[]`, `exitStatus: 'success' | 'error' | 'killed'`, `durationSeconds: number`. Populated by `CLISpawner` on session exit by parsing the output buffer for tool-call patterns. Displayed in `SessionHistoryPanel`.

---

### T11: Integration testing and Docker smoke test

- [x] Estimate: 1.5hr
- [x] Tests: Full spawn->output->kill->history cycle for both modes; Docker smoke test if available
- [x] Dependencies: T04, T06, T07, T09, T10
- [ ] Notes: Write integration tests covering: (1) local-mode spawn still works (regression),
      (2) Docker-mode spawn with mocked docker command, (3) session history persists and loads,
      (4) terminal clear resets buffer, (5) Docker status check returns correct value.
      If Docker is available in CI, add a smoke test that spawns a real container.
