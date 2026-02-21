# P14-F05: CLI Session Management & Backend Wiring

**Version:** 1.0
**Date:** 2026-02-21
**Status:** COMPLETE

## Overview

Replaces mock implementations with real backends: CLI spawner using node-pty for terminal emulation, CLI manager page with xterm.js embedded terminal, work item service reading filesystem PRDs and GitHub Issues via `gh` CLI, Redis event subscription via ioredis for live execution tracking, execution engine wired to real CLI sessions (with mockMode preserved), and a settings page for configuring paths and connections.

## Architecture

```
src/main/services/
  cli-spawner.ts               -- node-pty spawn, session lifecycle, SIGTERM/SIGKILL
  workitem-service.ts          -- Scan .workitems/, parse gh issue list --json
  redis-client.ts              -- ioredis XREAD streaming, reconnection handling
  execution-engine.ts          -- Extended: real CLI spawn per agent node, mockMode flag

src/renderer/
  components/cli/
    CLISessionList.tsx          -- Active/exited sessions with status badges
    TerminalPanel.tsx           -- xterm.js terminal with ANSI color rendering
    SpawnDialog.tsx             -- Manual session creation form
  pages/
    CLIManagerPage.tsx          -- Session list + embedded terminal
    SettingsPage.tsx            -- Workflow dir, template dir, Redis URL, etc.
  stores/
    cliStore.ts                 -- Sessions map, output ring buffers (10k lines)
```

## Key Interfaces

### CLI Spawner
Uses node-pty to create pseudo-terminals. Sets CLAUDE_INSTANCE_ID from config. Pipes stdout/stderr to renderer via IPC events. Kill: SIGTERM then SIGKILL after 5s. All sessions tracked in Map. On app exit, kill all.

### Work Item Service
PRDs: scan .workitems/ directories, parse design.md for title/description. GitHub Issues: shell out to `gh issue list --json number,title,body,labels`. Replaces stub handlers.

### Redis Client
ioredis subscription to aSDLC event streams (matching contracts/v1.0.0/events.json). Forward events to renderer via IPC. Configurable URL. Connection/reconnection/graceful disconnect.

### Settings
Persisted to ~/.asdlc/electron-config.json. Fields: workflow directory, template directory, auto-save interval, CLI working directory, Redis URL. Changes take effect immediately.

## Dependencies

- **P14-F01** (types)
- **P14-F02** (AppShell, IPC bridge, common components)
- **P14-F03** (workflow store, save/load)
- **P14-F04** (mock execution engine to extend, execution store)

## Status

**COMPLETE** -- All 7 tasks (T32-T38) implemented and committed.
