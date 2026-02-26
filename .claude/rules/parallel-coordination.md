---
description: Coordination rules for parallel CLI instances
---

# Parallel CLI Coordination

Multiple CLI sessions work in parallel with domain boundaries.

## Native Teams (In-Session Parallel Work)

```
PM CLI (main session)
    |
    |-> TeamCreate("feature-context")
    |
    |-> Task(backend, name="backend-dev", team_name="feature-context")
    |-> Task(frontend, name="frontend-dev", team_name="feature-context")
    |
    |   [Teammates work in parallel]
    |   [Messages delivered automatically]
    |   [Tasks tracked via TaskList]
    |
    |-> SendMessage(type="shutdown_request", recipient="backend-dev")
    |-> SendMessage(type="shutdown_request", recipient="frontend-dev")
    |-> TeamDelete
```

## When to Use Separate CLI (Worktrees)

- Long-running infrastructure operations
- Operations requiring different environment permissions
- When user wants to continue other work while devops runs
- See `pm-cli/03-multi-cli.md` for worktree delegation flow

## Enforcement

1. `PreToolUse` hook — **BLOCKS** forbidden file edits (see `permissions.md`)
2. `pre-commit` hook — **BLOCKS** if tests fail

## CLAUDE_INSTANCE_ID

Required for worktree sessions. Identifies the bounded context (e.g., `p11-guardrails`). Defaults to `pm` in main repo. MCP server fails fast if identity is invalid. See CLAUDE.md Multi-Session section for quick start.

## Message Types

See `coordination-protocol.md` for MCP tool reference and message handling. See `native-teams.md` for SendMessage content prefixes (`STATUS:`, `BLOCKED:`, etc.).
