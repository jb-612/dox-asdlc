---
id: P15-F06
parent_id: P15
type: design
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
  - xterm
  - electron
---

# Design: CLI Session Enhancement (P15-F06)

## Overview

The Workflow Studio already has a CLIManagerPage with a working local PTY-based session spawner
(node-pty + xterm.js, wired in P14-F05). However, it only spawns processes directly on the host
machine. This feature enhances the CLI Session tab to provide a Docker-container-backed
"CLI-like" experience for testing stateless agents on specific issues or workflows.

### Goals

1. **Docker-backed sessions** — Spawn claude CLI inside a Docker container rather than bare-metal
2. **Session context** — Allow users to optionally provide repo path, GitHub issue, or workflow
   template before starting a session
3. **Session management** — Start, stop, clear, and browse history of past sessions
4. **Dual-mode spawning** — Support both local (existing) and Docker container modes

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| P14-F05 (CLI Backend Wiring) | Internal | CLISpawner, IPC channels, cliStore, TerminalPanel exist |
| node-pty | External | Already integrated; used for local-mode spawning |
| xterm.js + FitAddon | External | Already integrated in TerminalPanel |
| Docker Engine | External | Required on host for container-mode sessions |
| Zustand (cliStore) | External | Already manages CLI state |

## Architecture

```
Renderer Process                          Main Process                      Docker
┌─────────────────────┐                  ┌──────────────────────┐         ┌──────────────┐
│  CLIManagerPage      │                  │  CLISpawner          │         │  Container   │
│  ┌───────────────┐  │                  │  ┌────────────────┐  │         │              │
│  │SpawnDialog v2 │  │   IPC            │  │ spawnLocal()   │──┼──pty──▶│ N/A (host)   │
│  │ +mode toggle  │──┼─cli:spawn──────▶│  │ spawnDocker()  │──┼─pty──▶│ claude CLI   │
│  │ +context form │  │                  │  │                │  │  │      │ /workspace   │
│  └───────────────┘  │                  │  └────────────────┘  │  │      └──────────────┘
│                      │                  │                      │  │
│  ┌───────────────┐  │   IPC            │  ┌────────────────┐  │  │
│  │TerminalPanel  │◀─┼─cli:output─────│  │ PTY data pipe  │◀─┘
│  │ (xterm.js)    │  │                  │  └────────────────┘  │
│  └───────────────┘  │                  │                      │
│                      │                  │  ┌────────────────┐  │
│  ┌───────────────┐  │   IPC            │  │ SessionStore   │  │
│  │SessionHistory │◀─┼─cli:history────│  │ (JSON file)    │  │
│  └───────────────┘  │                  │  └────────────────┘  │
└─────────────────────┘                  └──────────────────────┘
```

### Docker Container Spawning

For Docker-mode sessions, `CLISpawner.spawnDocker()` uses node-pty to run
`docker exec -it <container-id> claude ...` (or `docker run -it ...` for ephemeral containers).
This keeps the same PTY → IPC → xterm.js pipeline intact — the only difference is *what* command
is spawned inside the PTY.

**Two Docker strategies:**

| Strategy | Command | Use Case |
|----------|---------|----------|
| `docker run` | `docker run -it --rm -v <repo>:/workspace <image> claude ...` | Ephemeral, clean-room |
| `docker exec` | `docker exec -it <container> claude ...` | Reuse running container |

The default is `docker run` with ephemeral containers. The image is configurable in Settings
(default: `ghcr.io/anthropics/claude-code:latest` or a project-specific image).

### Why PTY-wrapped Docker instead of Docker API?

Using `docker run -it` via node-pty has significant advantages:

1. **Zero new dependencies** — No Docker SDK or REST API client needed
2. **Same pipeline** — PTY data events flow through the identical IPC → xterm.js path
3. **Full TTY** — Colors, cursor control, interactive prompts work natively
4. **Stdin passthrough** — User input goes through PTY write, same as local mode
5. **Simple abort** — Kill the PTY process to stop the container (`--rm` cleans up)

## Interfaces

### Updated CLISpawnConfig

```typescript
export type CLISpawnMode = 'local' | 'docker';

export interface CLISessionContext {
  repoPath?: string;          // Path to mount as /workspace
  githubIssue?: string;       // e.g. "owner/repo#123" or URL
  workflowTemplate?: string;  // Template ID from workflow store
  systemPrompt?: string;      // Additional system prompt text
}

export interface CLISpawnConfig {
  command: string;
  args: string[];
  cwd: string;
  env?: Record<string, string>;
  instanceId?: string;

  // New fields
  mode: CLISpawnMode;                // 'local' (default) or 'docker'
  context?: CLISessionContext;       // Optional session context
  dockerImage?: string;              // Override image for docker mode
  dockerContainerId?: string;        // For exec into existing container
}
```

### Updated CLISession

```typescript
export interface CLISession {
  id: string;
  config: CLISpawnConfig;
  status: CLISessionStatus;
  pid?: number;
  startedAt: string;
  exitedAt?: string;
  exitCode?: number;

  // New fields
  mode: CLISpawnMode;
  context?: CLISessionContext;
  containerId?: string;           // Docker container ID (if docker mode)
}
```

### IPC Channels (Committed Names)

The following channels are already committed in `ipc-channels.ts`. Use these exact names:

```typescript
// Already committed in ipc-channels.ts:
CLI_LIST_IMAGES: 'cli:list-images',        // List available Docker images
CLI_SESSION_SAVE: 'cli:session-save',       // Persist session to history ring buffer
CLI_SESSION_HISTORY: 'cli:session-history', // Load last-N sessions from history
CLI_PRESETS_LOAD: 'cli:presets-load',       // Load quick-launch presets
CLI_PRESETS_SAVE: 'cli:presets-save',       // Save quick-launch presets

// NEW — needs to be added to ipc-channels.ts:
CLI_DOCKER_STATUS: 'cli:docker-status',     // Check Docker availability
```

**Note:** The originally planned `CLI_HISTORY_LIST` and `CLI_HISTORY_CLEAR` channel names were
superseded by the committed `CLI_SESSION_SAVE` and `CLI_SESSION_HISTORY` channels, which use a
save-on-exit + load-history pattern instead of a list + clear pattern.

### Session History Store

```typescript
// Persisted to {app.getPath('userData')}/cli-sessions.json
// On macOS: ~/Library/Application Support/workflow-studio/cli-sessions.json
// On Linux: ~/.config/workflow-studio/cli-sessions.json
// On Windows: %APPDATA%/workflow-studio/cli-sessions.json
interface SessionHistoryEntry {
  id: string;
  config: CLISpawnConfig;
  startedAt: string;
  exitedAt?: string;
  exitCode?: number;
  mode: CLISpawnMode;
  context?: CLISessionContext;
  /** Session output summary — populated on session exit */
  sessionSummary?: {
    toolCallCount: number;
    filesModified: string[];
    exitStatus: 'success' | 'error' | 'killed';
    durationSeconds: number;
  };
}
```

**Path note:** Use `app.getPath('userData')` consistently (not `~/.workflow-studio/`). This
resolves to the platform-appropriate location for application data.

### CLISpawner Extensions

```typescript
export class CLISpawner {
  // Existing
  spawn(config: CLISpawnConfig): CLISession;
  kill(sessionId: string): boolean;
  write(sessionId: string, data: string): boolean;
  list(): CLISession[];
  killAll(): void;

  // New
  spawnDocker(config: CLISpawnConfig): CLISession;
  getDockerStatus(): Promise<{ available: boolean; version?: string }>;
  getSessionHistory(limit?: number): SessionHistoryEntry[];
  clearSessionHistory(): void;
}
```

## Technical Approach

### Docker Spawn Flow

```
1. User fills SpawnDialog with mode=docker, context (repo, issue, template)
2. Renderer calls cli:spawn via IPC
3. CLISpawner.spawn() dispatches to spawnDocker()
4. spawnDocker() builds docker command:
   a. Base: docker run -it --rm
   b. Mount: -v <repoPath>:/workspace (if provided)
   c. Env: -e GITHUB_ISSUE=<issue> (if provided)
   d. Image: <configured image>
   e. Command: claude <args>
   f. If systemPrompt from template: --system-prompt "<text>"
5. node-pty.spawn("docker", [dockerArgs...])
6. PTY data events flow through existing pipeline
7. On exit: container auto-removed (--rm), session marked exited
```

### Context Injection

When context is provided, it is injected into the agent session:

| Context | Injection Method |
|---------|-----------------|
| `repoPath` | `-v <path>:/workspace` + `--cwd /workspace` |
| `githubIssue` | `-e GITHUB_ISSUE=<issue>` + prepended to prompt |
| `workflowTemplate` | Template's system prompt passed via `--system-prompt` or appended to args |
| `systemPrompt` | `--system-prompt "<text>"` flag on claude CLI |

### Session History

Session history is persisted to a JSON file (`~/.workflow-studio/cli-sessions.json`) managed by
a `SessionHistoryService` in the main process. This stores the last N sessions (default: 50)
with their config, timing, and exit status. The history is read-only from the renderer and
displayed in a collapsible panel below the session list.

### SpawnDialog v2 Enhancement

The existing SpawnDialog is extended with:

1. **Mode toggle** — Switch between "Local" and "Docker" (radio buttons)
2. **Context section** (collapsible):
   - Repository path (with folder picker via `dialog:open-directory`)
   - GitHub issue (text input, validates `owner/repo#N` format)
   - Workflow template (dropdown populated from workflow store)
3. **Docker status indicator** — Shows whether Docker is available
4. **Quick-start presets** — Buttons for common configs (raw session, issue focus, template run)

## File Structure

```
apps/workflow-studio/src/
├── shared/types/
│   └── cli.ts                          # +CLISpawnMode, +CLISessionContext, updated interfaces
├── shared/ipc-channels.ts              # Uses committed: CLI_SESSION_SAVE, CLI_SESSION_HISTORY, CLI_PRESETS_*, CLI_LIST_IMAGES; adds: CLI_DOCKER_STATUS
├── main/
│   ├── services/
│   │   ├── cli-spawner.ts              # +spawnDocker(), +getDockerStatus(), dispatch by mode
│   │   └── session-history-service.ts  # NEW: persist/load session history to JSON file
│   └── ipc/
│       └── cli-handlers.ts            # +history list/clear handlers, +docker status handler
├── renderer/
│   ├── pages/
│   │   └── CLIManagerPage.tsx          # +session history panel, layout adjustments
│   ├── components/cli/
│   │   ├── SpawnDialog.tsx             # +mode toggle, +context fields, +docker indicator
│   │   ├── TerminalPanel.tsx           # +clear terminal action
│   │   ├── CLISessionList.tsx          # +clear button, minor UI tweaks
│   │   └── SessionHistoryPanel.tsx     # NEW: collapsible history list
│   └── stores/
│       └── cliStore.ts                 # +history state, +clearTerminal, +loadHistory actions
```

## PTY Back-Pressure Mechanism

When Docker containers produce high-volume output (e.g., streaming build logs, verbose test runs),
the PTY → IPC pipeline can buffer unboundedly, leading to memory exhaustion.

### Solution: Bounded Ring Buffer

Insert a bounded ring buffer between PTY data events and IPC sends:

```typescript
class OutputBuffer {
  private buffer: Uint8Array;
  private maxSize = 1024 * 1024; // 1MB
  private writePos = 0;
  private truncated = false;

  append(data: Buffer): void {
    if (this.writePos + data.length > this.maxSize) {
      // Drop oldest data, keep newest
      this.truncated = true;
      // ... ring buffer rotation ...
    }
    data.copy(this.buffer, this.writePos);
    this.writePos += data.length;
  }
}
```

When the buffer truncates, emit a `cli:output-truncated` IPC event to the renderer so the
terminal can display a "[output truncated]" indicator.

## Docker Command Specification

### Container ID Capture

Consider using `docker run -d` + `docker exec -it` instead of `docker run -it` for better
container lifecycle management:

```bash
# Start container in detached mode
CONTAINER_ID=$(docker run -d --rm \
  -v <repoPath>:/workspace \
  --add-host=host.docker.internal:host-gateway \
  -e GITHUB_ISSUE=<issue> \
  -e TELEMETRY_URL=http://host.docker.internal:9292/telemetry \
  <image> sleep infinity)

# Exec interactive session
docker exec -it $CONTAINER_ID claude <args>

# On exit: stop container (--rm handles removal)
docker stop $CONTAINER_ID
```

This pattern gives explicit container ID capture for monitoring integration (F07) and allows
multiple exec sessions into the same container.

### Linux Host Networking

Add `--add-host=host.docker.internal:host-gateway` to all `docker run` commands. This is
required on Linux where `host.docker.internal` is not natively available. On macOS and Windows
Docker Desktop, this flag is harmless (the DNS name already resolves).

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Docker not installed on user's machine | Medium | Graceful fallback to local mode; Docker status indicator |
| Docker image pull slow on first use | Medium | Show progress indicator; allow pre-pull in settings |
| Container stdio buffering breaks xterm | Low | `docker run -it` allocates PTY, same as local |
| Volume mount permissions on Linux | Medium | Document required permissions; use `--user` flag |
| Session history file grows unbounded | Low | Ring buffer with configurable max (default 50) |
