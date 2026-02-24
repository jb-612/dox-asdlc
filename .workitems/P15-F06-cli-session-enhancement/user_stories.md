---
id: P15-F06
parent_id: P15
type: user_stories
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

# User Stories: CLI Session Enhancement (P15-F06)

---

## US-01: Spawn a Docker-backed CLI session

**As a** developer testing agent behavior
**I want** to spawn a claude CLI session inside a Docker container from the Workflow Studio
**So that** the agent runs in an isolated, reproducible environment

### Acceptance Criteria

- SpawnDialog shows a mode toggle: "Local" (default) and "Docker"
- Selecting Docker mode and clicking Spawn runs `docker run -it --rm <image> claude <args>`
- Terminal output streams to xterm.js with full ANSI color support
- The container is automatically removed when the session exits (`--rm`)
- If Docker is not available, Docker mode is disabled with a tooltip explaining why

### Test Scenarios

**Given** Docker is installed and running
**When** I select Docker mode, enter args, and click Spawn
**Then** a Docker container starts and claude CLI output appears in the terminal

**Given** Docker is not installed
**When** I open the SpawnDialog
**Then** the Docker mode toggle is disabled with message "Docker not available"

---

## US-02: Provide session context before starting

**As a** developer debugging a specific issue
**I want** to provide context (repo path, GitHub issue, workflow template) before starting a session
**So that** the agent has the right context without me manually configuring it

### Acceptance Criteria

- SpawnDialog has a collapsible "Session Context" section with:
  - Repository path (text input + folder picker button)
  - GitHub issue (text input, validates `owner/repo#N` or URL format)
  - Workflow template (dropdown from available templates)
- When repo path is provided in Docker mode, it is mounted as `-v <path>:/workspace`
- When GitHub issue is provided, it is passed as `-e GITHUB_ISSUE=<issue>`
- When workflow template is selected, the template's prompt is prepended to session args
- Context fields are optional; a session can start with no context (raw CLI)

### Test Scenarios

**Given** I'm spawning a Docker session with repo path `/home/user/my-project`
**When** the container starts
**Then** the repo is mounted at `/workspace` inside the container

**Given** I'm spawning a session with GitHub issue `myorg/myrepo#42`
**When** the container starts
**Then** environment variable `GITHUB_ISSUE=myorg/myrepo#42` is set

**Given** I provide no context
**When** I click Spawn
**Then** a plain claude CLI session starts without any context injection

---

## US-03: Check Docker availability before spawning

**As a** developer
**I want** to see whether Docker is available before trying to spawn a Docker session
**So that** I don't waste time with a mode that will fail

### Acceptance Criteria

- When SpawnDialog opens, a Docker status check runs (`docker info` or `docker version`)
- A status indicator shows: green checkmark (available) or red X (unavailable)
- If Docker is unavailable, the Docker mode toggle is disabled
- The check completes within 2 seconds; if Docker is slow, show a spinner
- Docker status is cached for the lifetime of the dialog (no repeated checks)

### Test Scenarios

**Given** Docker daemon is running
**When** I open SpawnDialog
**Then** a green indicator appears next to "Docker" mode within 2 seconds

**Given** Docker daemon is not running
**When** I open SpawnDialog
**Then** a red indicator appears and Docker mode is grayed out

---

## US-04: Browse and re-run past sessions

**As a** developer iterating on agent behavior
**I want** to see a history of past CLI sessions with their configuration
**So that** I can re-run a previous session with the same settings

### Acceptance Criteria

- A collapsible "History" panel appears below the active session list
- History shows the last 50 sessions with: mode, command, context summary, started/exited time,
  exit code
- Clicking a history entry opens a pre-filled SpawnDialog with that session's config
- History persists across app restarts (stored in `~/.workflow-studio/cli-sessions.json`)
- A "Clear History" button removes all history entries

### Test Scenarios

**Given** I have completed 3 CLI sessions
**When** I expand the History panel
**Then** all 3 sessions appear with their config and timing

**Given** a history entry for a Docker session with repo context
**When** I click "Re-run" on that entry
**Then** SpawnDialog opens pre-filled with mode=docker and the same repo path

**Given** I click "Clear History"
**When** I expand the History panel
**Then** the list is empty

---

## US-05: Clear terminal output

**As a** developer with a long-running session
**I want** to clear the terminal output
**So that** I can start fresh without noise from earlier output

### Acceptance Criteria

- A "Clear" button appears in the terminal toolbar (or session list header)
- Clicking Clear resets the xterm.js terminal buffer for the selected session
- The output buffer in cliStore is also cleared
- Clearing does not affect the running process (session continues)
- Keyboard shortcut `Cmd+K` (macOS) or `Ctrl+K` (Linux/Windows) also clears

### Test Scenarios

**Given** a running session with 500 lines of output
**When** I click the Clear button
**Then** the terminal shows an empty screen and new output appears from the current point

**Given** a running session
**When** I press Cmd+K
**Then** the terminal is cleared (same as clicking Clear button)

---

## US-06: Kill a Docker-backed session

**As a** developer
**I want** to stop a running Docker CLI session
**So that** the container is terminated and resources are freed

### Acceptance Criteria

- Clicking Kill on a Docker-mode session sends SIGTERM to the PTY process
- The Docker container stops and is removed (due to `--rm` flag)
- Session status changes to "exited" in the session list
- If the process doesn't exit within 5 seconds, a force kill is attempted
- The session's exit code is displayed

### Test Scenarios

**Given** a running Docker session
**When** I click Kill
**Then** the container stops, session shows "exited" status

**Given** a Docker session that ignores SIGTERM
**When** I click Kill and wait 5 seconds
**Then** the process is force-killed and session shows "exited"

---

## US-07: Use quick-start presets

**As a** new user or developer wanting a fast start
**I want** one-click buttons for common session configurations
**So that** I don't have to manually fill out the spawn form every time

### Acceptance Criteria

- SpawnDialog shows 3 preset buttons above the form:
  - "Raw Session" — Local mode, `claude` command, no context
  - "Issue Focus" — Docker mode, prompts for repo + issue only
  - "Template Run" — Docker mode, prompts for template selection only
- Clicking a preset pre-fills the form fields; user can still modify before spawning
- Presets are visually distinct (icon + label, horizontal row)

### Test Scenarios

**Given** I open SpawnDialog
**When** I click "Raw Session" preset
**Then** form is filled with: mode=local, command=claude, no context

**Given** I click "Issue Focus" preset
**When** the form updates
**Then** mode=docker is selected, and repo + issue fields are highlighted/focused
