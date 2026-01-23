---
description: Role-based subagents for CLI identity
---

# Role Subagents

This project uses role-specific subagents in `.claude/agents/` instead of interactive identity selection.

## Available Subagents

| Subagent | Domain | Use For |
|----------|--------|---------|
| `backend` | Workers, infra | P01-P03, P06 implementation |
| `frontend` | HITL UI | P05 implementation |
| `orchestrator` | Meta files | Docs, contracts, coordination |

## Invoking Subagents

```
"Use the backend subagent to implement the worker pool"
"Use the frontend subagent to add the approval dialog"
"Use the orchestrator subagent to update the contract"
```

## Git Identity

Each subagent sets appropriate git identity:

| Subagent | Git Email |
|----------|-----------|
| backend | `claude-backend@asdlc.local` |
| frontend | `claude-frontend@asdlc.local` |
| orchestrator | `claude-orchestrator@asdlc.local` |

## Built-in Coordination

Each subagent:
- Checks pending messages on start
- Publishes status updates on completion
- Can publish `BLOCKING_ISSUE` when stuck

See `.claude/agents/` for full definitions.
