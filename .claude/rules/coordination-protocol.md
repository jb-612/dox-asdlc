---
description: Multi-session coordination, native teams, and parallel CLI rules
globs:
  - src/infrastructure/mcp/**
  - scripts/coordination/**
  - .claude/hooks/**
---

# Coordination Protocol

Multi-session coordination via Redis-backed messages. Each session = a bounded context (e.g., `p11-guardrails`) identified by `CLAUDE_INSTANCE_ID`.

## Session Lifecycle

- **Start**: Publish `SESSION_START`, begin heartbeat (60s interval), check pending messages
- **End**: Publish `SESSION_END` with reason (`user_exit` | `task_complete` | `error`), presence expires via TTL

## Presence States

| State | Condition | Action |
|-------|-----------|--------|
| **Active** | last_heartbeat < 5 min | Proceed with delegation |
| **Stale** | 5-15 min | Warn user, offer options |
| **Offline** | > 15 min or no record | Treat as unavailable |

Heartbeats update Redis presence keys directly (not coordination messages). TTL: 300s.

## MCP Tool Reference

| Tool | Purpose | Key Params |
|------|---------|------------|
| `coord_check_messages` | Get pending messages | None |
| `coord_ack_message` | Acknowledge a message | `message_id` |
| `coord_publish_message` | Publish a message | `type`, `to`, `subject`, `body` |
| `coord_get_presence` | Get all agent presence | None |
| `coord_register_presence` | Register session as active | `role` |
| `coord_heartbeat` | Update heartbeat timestamp | `role` |

## Native Teams (In-Session Parallel Work)

Use TeamCreate/SendMessage/TaskCreate for in-session parallel coordination. Redis stays for event bus, session persistence, swarm state, and graph store.

```
PM CLI (main session)
    |-> TeamCreate("feature-context")
    |-> Task(backend, name="backend-dev", team_name="feature-context")
    |-> Task(frontend, name="frontend-dev", team_name="feature-context")
    |   [Teammates work in parallel, messages automatic]
    |-> SendMessage(type="shutdown_request", recipient="backend-dev")
    |-> TeamDelete
```

### When to Use Each Mode

| Scenario | Mode |
|----------|------|
| Parallel agents within one PM CLI session | **Native Teams** |
| Separate git branch isolation | **Worktrees + Redis** |
| Single-agent delegation (no parallelism) | **Same-session subagent** |
| Cross-machine coordination | **Redis** |

### Message Type Prefixes

Prefix SendMessage content with: `STATUS:`, `BLOCKED:`, `CONTRACT_CHANGE:`, `DEVOPS_STARTED:`, `DEVOPS_COMPLETE:`, `DEVOPS_FAILED:`, `BUILD_BROKEN:` (broadcast), `BUILD_FIXED:` (broadcast).

### Native Team Constraints

- Teammates inherit PM CLI permissions and guardrails hooks
- All HITL gates remain in effect for teammates
- Keep teams small (2-4 teammates) -- context window is shared
- If PM CLI exits, team is lost -- use worktrees for durable work
- One team per session, no nested teams, no cross-session teams
- Config flag `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is already set in settings.json

## When to Use Separate CLI (Worktrees)

- Long-running infrastructure operations
- Operations requiring different environment permissions
- When user wants to continue other work while devops runs

## Enforcement

1. `PreToolUse` hook -- **BLOCKS** forbidden file edits
2. `pre-commit` hook -- **BLOCKS** if tests fail

## CLAUDE_INSTANCE_ID

Required for worktree sessions. Identifies the bounded context (e.g., `p11-guardrails`). Defaults to `pm` in main repo. MCP server fails fast if identity is invalid.

## Troubleshooting

**Agent appears stale but is running**: Check Redis (`redis-cli ping`), verify heartbeat in MCP logs, manually call `coord_heartbeat`.

**Messages not received**: Verify agent IDs match (case-sensitive), check Redis connectivity, check if already acknowledged.

**Redis connection lost**: System continues in degraded mode, retries every 30s. Messages are stored plaintext -- do not include secrets.
