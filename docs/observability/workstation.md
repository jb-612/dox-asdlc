# Workstation Observability Guide

This guide covers the observability stack for local development on a developer workstation. The stack uses SQLite for storage and a zero-dependency Python HTTP server for the dashboard.

## Overview

```
Claude Code hooks
    |
    v
hook-wrapper.py  -->  /tmp/hook-telemetry.jsonl  (backward compat)
    |
    v
sqlite_store.py  -->  ~/.asdlc/telemetry.db  (primary store)
    |
    v
dashboard_server.py  -->  http://localhost:9191  (web UI + SSE)
```

All hook executions (SessionStart, PreToolUse, UserPromptSubmit, SubagentStart, PostToolUse, Stop, Notification) are captured by `hook-wrapper.py`, which writes to both the JSONL file and the SQLite database.

## SQLite Schema

The telemetry database lives at `~/.asdlc/telemetry.db` and uses WAL mode for concurrent read/write access.

### hook_events table

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Auto-incrementing primary key |
| timestamp | REAL | Unix timestamp of the event |
| session_id | TEXT | Claude session identifier |
| source_app | TEXT | Always `claude-code` |
| hook_event_type | TEXT | Hook type (SessionStart, PreToolUse, etc.) |
| hook_name | TEXT | Specific hook name (e.g., guardrails-enforce-edit) |
| exit_code | INTEGER | Hook exit code (0=allow, 2=block) |
| duration_seconds | REAL | Execution time in seconds |
| tool_name | TEXT | Tool being invoked (for PreToolUse/PostToolUse) |
| agent_id | TEXT | CLAUDE_INSTANCE_ID or agent name |
| blocked | INTEGER | 1 if the hook blocked the operation |
| error | TEXT | Error message if exit_code != 0 |
| payload_json | TEXT | Optional JSON payload |

Indexed on: `timestamp`, `session_id`, `hook_event_type`.

### sessions table

| Column | Type | Description |
|--------|------|-------------|
| session_id | TEXT | Primary key, Claude session ID |
| started_at | REAL | Unix timestamp of session start |
| ended_at | REAL | Unix timestamp of session end (null if active) |
| agent_type | TEXT | Agent type (pm, backend, frontend, etc.) |
| instance_id | TEXT | CLAUDE_INSTANCE_ID value |
| model | TEXT | Model name used in the session |

## Dashboard

### Starting the Dashboard

```bash
# Start in background (opens browser on macOS)
./scripts/telemetry/start-dashboard.sh

# Start on a custom port
./scripts/telemetry/start-dashboard.sh --port 8080

# Stop the dashboard
./scripts/telemetry/start-dashboard.sh --stop
```

The dashboard PID is stored at `~/.asdlc/dashboard.pid` for lifecycle management.

### Dashboard Features

The dashboard is a single-page HTML application served by `dashboard_server.py` with no external dependencies.

- **Summary cards**: Total events, error rate, blocked operations, events/minute, active sessions
- **Event stream**: Live-updating table of hook events via Server-Sent Events (SSE)
- **Session list**: Active and recent sessions with start/end times
- **Aggregate stats**: Breakdown by hook event type

### API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | Dashboard HTML page |
| `GET /api/events` | Paginated hook events (params: `since`, `session`, `type`, `limit`) |
| `GET /api/sessions` | Active and recent sessions |
| `GET /api/stats` | Aggregate statistics |
| `GET /stream` | SSE endpoint, polls SQLite every 2 seconds |

## Hook Pipeline

Every hook in `.claude/settings.json` is routed through `scripts/hooks/hook-wrapper.py`:

```
settings.json hook entry
    |
    v
hook-wrapper.py <hook-name> <actual-command>
    |
    +-- Reads stdin (hook payload)
    +-- Runs <actual-command> with stdin passthrough
    +-- Captures exit code, duration, stderr
    +-- Writes JSONL record to /tmp/hook-telemetry.jsonl
    +-- Writes SQLite record to ~/.asdlc/telemetry.db
    +-- Passes through stdout/stderr from wrapped command
    +-- Returns exit code from wrapped command
```

### Hook Name to Event Type Mapping

| Hook name pattern | Event type |
|-------------------|------------|
| `session-start` | SessionStart |
| `guardrails-enforce` | PreToolUse |
| `guardrails-inject` | UserPromptSubmit |
| `guardrails-subagent` | SubagentStart |
| `post-tool` | PostToolUse |
| `stop` | Stop |
| `notification` | Notification |

## tmux Integration

When using the tmux launcher (`scripts/sessions/tmux-launcher.sh`), the dashboard runs in its own tmux window:

```
tmux session "asdlc":
  Window 0: pm         -- PM CLI in main repo
  Window 1: context-1  -- Feature worktree
  Window N: context-N  -- Feature worktree
  Final:    dashboard  -- Dashboard server
```

All sessions within the tmux environment write to the same `~/.asdlc/telemetry.db`, so the dashboard shows events from all active contexts.

### Viewing Sessions Across Sources

Use `list-sessions.sh` to see sessions from all available sources:

```bash
./scripts/sessions/list-sessions.sh
```

This checks:
1. **tmux** -- Windows in the `asdlc` tmux session
2. **SQLite** -- Session records in the telemetry database
3. **Worktrees** -- Git worktrees under the project root

## Troubleshooting

### Dashboard shows no events

1. Verify the telemetry database exists:
   ```bash
   ls -la ~/.asdlc/telemetry.db
   ```
2. Check that hooks are firing by looking at the JSONL file:
   ```bash
   tail -5 /tmp/hook-telemetry.jsonl
   ```
3. Verify hook-wrapper.py can import sqlite_store:
   ```bash
   python3 -c "import sys; sys.path.insert(0, 'scripts/telemetry'); import sqlite_store; print('OK')"
   ```

### Dashboard won't start

1. Check if port 9191 is already in use:
   ```bash
   lsof -i :9191
   ```
2. Check for stale PID file:
   ```bash
   cat ~/.asdlc/dashboard.pid
   ```
3. Remove stale PID and retry:
   ```bash
   rm ~/.asdlc/dashboard.pid
   ./scripts/telemetry/start-dashboard.sh
   ```

### Events not appearing in real-time

The SSE endpoint polls SQLite every 2 seconds. If events are delayed:
1. Check browser console for SSE connection errors
2. Verify the dashboard server process is running:
   ```bash
   kill -0 $(cat ~/.asdlc/dashboard.pid)
   ```

### hook-wrapper.py errors

Hook wrapper failures are logged to stderr and never break the hook pipeline (fail-open). To debug:
1. Check stderr output in the Claude Code terminal
2. Look for errors in `/tmp/hook-telemetry.jsonl` (the `error` field)
3. Verify Python 3 is available: `which python3`
