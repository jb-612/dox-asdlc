# P14-F05: CLI Session Management & Backend Wiring - User Stories

**Version:** 1.0
**Date:** 2026-02-21
**Status:** COMPLETE

---

## US-08: CLI Session Spawner

**As a** developer
**I want** the Electron app to spawn and manage Claude Code CLI sessions
**So that** workflow nodes can delegate to real agent sessions

### Acceptance Criteria

1. CLI Manager page lists all active and recently exited sessions
2. Manually spawn a new session with context ID and working directory
3. Each session shows embedded terminal panel with live output
4. Send text input to a running session's terminal
5. Kill a running session (SIGTERM then SIGKILL after 5s)
6. Session status updates in real-time
7. On Electron app exit, all spawned sessions terminated
8. Execution engine spawns CLI sessions automatically for workflow nodes

---

## US-06 (partial): Work Item Integration - Real Backends

**As a** developer
**I want** work items loaded from the real filesystem and GitHub
**So that** I can bind actual PRDs and issues to workflow executions

### Acceptance Criteria

1. PRDs tab loads from .workitems/ directories on disk
2. GitHub Issues tab calls `gh issue list` and parses results
3. Results replace the stub/mock data from P14-F04

---

## US-10: Settings and Preferences

**As a** developer
**I want** to configure the app's default settings
**So that** I can customize paths, defaults, and behavior

### Acceptance Criteria

1. Settings page: workflow directory, template directory, auto-save interval, CLI working directory, Redis URL
2. Persisted to local configuration file
3. Default values work out of the box
4. Changes take effect immediately without restart
