---
id: P15-F06
parent_id: P15
type: prd
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
---

# PRD: CLI Session Enhancement (P15-F06)

## Business Intent

The Workflow Studio has a CLI Manager tab (built in P14-F05) that can spawn local claude CLI
sessions via node-pty. However, users need a way to run agent sessions inside Docker containers
for isolation, reproducibility, and to test workflows against specific repos or issues. This
feature enhances the CLI Session tab to support Docker-backed sessions, optional context
injection (repo, issue, template), and session history for a complete "CLI-like" debugging and
testing experience.

## Success Metrics

| Metric | Target |
|--------|--------|
| Docker-mode session spawns and streams output to xterm.js | Works end-to-end |
| Local-mode sessions continue working unchanged | No regression |
| Docker availability detected and displayed in spawn dialog | Within 2 seconds |
| Session context (repo, issue) injected into container | Verified via env/mount |
| Session history persists across app restarts | Last 50 sessions stored |
| Terminal output clear action works | Clears xterm buffer immediately |

## User Impact

| User | Impact |
|------|--------|
| Developer testing agents | Can run isolated agent sessions in Docker with specific repo context |
| Workflow author | Can test individual workflow steps interactively before full execution |
| QA / reviewer | Can reproduce agent behavior by re-running sessions with same context |
| New user | Can start a raw claude CLI session with one click (quick-start preset) |

## Scope

### In Scope

- **Docker-mode spawning** via `docker run -it --rm` through node-pty
- **Mode toggle** in SpawnDialog (Local vs Docker)
- **Session context fields**: repo path, GitHub issue, workflow template
- **Docker status check** in spawn dialog (is Docker available?)
- **Session history service**: persist last 50 sessions to JSON file
- **Session history panel**: collapsible UI showing past sessions with re-run capability
- **Terminal clear action**: clear xterm.js buffer for current session
- **Quick-start presets**: one-click buttons for common session configurations
- **Updated CLISpawnConfig / CLISession types** with mode and context fields

### Out of Scope

- Kubernetes-based session spawning (future feature)
- Multi-container orchestration (e.g., agent + sidecar)
- Session recording/playback (GIF or video)
- Remote Docker hosts (always local Docker daemon)
- Custom Dockerfile builder in UI
- Session sharing between users
- Docker image management UI (pull, list, delete)

## Constraints

- Must preserve existing local-mode behavior with zero regression
- Docker is optional; UI must gracefully handle Docker not being installed
- Container sessions use `--rm` flag for automatic cleanup
- Session history file must not grow unbounded (max 50 entries, ring buffer)
- All terminal I/O flows through the existing PTY → IPC → xterm.js pipeline

## Acceptance Criteria

1. **Local mode unchanged**: Spawning a session without selecting Docker mode works exactly as
   before (node-pty spawns local process)
2. **Docker mode spawn**: Selecting Docker mode spawns `docker run -it --rm <image> claude ...`
   and streams output to xterm.js with full ANSI color support
3. **Docker status**: Spawn dialog shows Docker availability (green checkmark or red X)
4. **Context injection**: When repo path is provided, it is mounted as `/workspace` in the
   container; when GitHub issue is provided, it is passed as environment variable
5. **Session history**: Past sessions appear in a collapsible panel below the session list;
   clicking a past session shows its config; sessions persist across app restarts
6. **Terminal clear**: A "Clear" button or keyboard shortcut clears the terminal output for the
   current session
7. **Kill container**: Killing a Docker-mode session terminates the container
8. **Stdin passthrough**: User can type input that reaches the claude CLI inside the container
