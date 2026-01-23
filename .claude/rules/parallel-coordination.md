---
description: Coordination rules for parallel CLI instances
---

# Parallel CLI Coordination

Three CLI roles work in parallel with domain boundaries.

## Roles

| Role | Domain | Git Email |
|------|--------|-----------|
| backend | Workers, infra (P01-P03, P06) | `claude-backend@asdlc.local` |
| frontend | HITL UI (P05) | `claude-frontend@asdlc.local` |
| orchestrator | Meta files, coordination | `claude-orchestrator@asdlc.local` |

## Path Restrictions

**Backend** can modify:
- `src/workers/`, `src/orchestrator/`, `src/infrastructure/`, `src/core/`
- `docker/workers/`, `docker/orchestrator/`
- `.workitems/P01-*`, `P02-*`, `P03-*`, `P06-*`

**Frontend** can modify:
- `src/hitl_ui/`, `docker/hitl-ui/`
- `.workitems/P05-*`

**Orchestrator** owns exclusively:
- `CLAUDE.md`, `README.md`, `docs/**`, `contracts/**`, `.claude/rules/**`, `.claude/skills/**`

## Enforcement

1. `PreToolUse` hook - **BLOCKS** forbidden file edits
2. `pre-commit` hook - **BLOCKS** if tests fail

## Message Types

| Type | Purpose |
|------|---------|
| `BUILD_BROKEN` / `BUILD_FIXED` | Main branch status |
| `CONTRACT_CHANGE_PROPOSED` | Propose contract change |
| `CONTRACT_APPROVED` / `CONTRACT_REJECTED` | Contract decision |
| `META_CHANGE_REQUEST` | Request meta file change |
| `BLOCKING_ISSUE` | Work blocked |

## Check Messages

```bash
./scripts/coordination/check-messages.sh --pending
./scripts/coordination/ack-message.sh <message-id>
```
