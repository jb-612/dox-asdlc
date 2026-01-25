---
description: Coordination rules for parallel CLI instances
---

# Parallel CLI Coordination

Multiple CLI roles work in parallel with domain boundaries.

## Roles

| Role | Domain | Git Email |
|------|--------|-----------|
| backend | Workers, infra (P01-P03, P06) | `claude-backend@asdlc.local` |
| frontend | HITL UI (P05) | `claude-frontend@asdlc.local` |
| orchestrator | Meta files, coordination | `claude-orchestrator@asdlc.local` |
| devops | Docker, K8s, cloud, GitHub Actions | `claude-devops@asdlc.local` |

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

**DevOps** can modify:
- `docker/`, `helm/`, `.github/workflows/`
- `scripts/k8s/`, `scripts/deploy/`
- Infrastructure configuration files

## Multi-CLI Coordination

Some operations benefit from running in a separate CLI window, particularly DevOps operations that may take time or require different permissions.

### DevOps CLI Pattern

```
PM CLI (main session)
    |
    |-> Option A: Run devops locally
    |   (user confirms, waits for completion)
    |
    +-> Option B: Send to DevOps CLI ---> DevOps CLI (separate window)
        via Redis MCP                      - Receives notification
                                           - Executes operations
                                           - Acknowledges completion
```

### When to Use Separate CLI

- Long-running infrastructure operations
- Operations requiring different environment permissions
- When user wants to continue other work while devops runs

### DevOps Message Flow

1. PM CLI needs infrastructure operation
2. PM CLI asks user: run locally or send to DevOps CLI?
3. If separate CLI:
   a. PM CLI publishes `DEVOPS_REQUEST` with operation details
   b. DevOps CLI receives notification
   c. DevOps CLI publishes `DEVOPS_STARTED`
   d. DevOps CLI executes operation
   e. DevOps CLI publishes `DEVOPS_COMPLETE` or `DEVOPS_FAILED`
   f. PM CLI receives acknowledgment and continues

## Enforcement

1. `PreToolUse` hook - **BLOCKS** forbidden file edits
2. `pre-commit` hook - **BLOCKS** if tests fail

## Message Types

### Existing Types

| Type | Purpose |
|------|---------|
| `BUILD_BROKEN` / `BUILD_FIXED` | Main branch status |
| `CONTRACT_CHANGE_PROPOSED` | Propose contract change |
| `CONTRACT_APPROVED` / `CONTRACT_REJECTED` | Contract decision |
| `META_CHANGE_REQUEST` | Request meta file change |
| `BLOCKING_ISSUE` | Work blocked |
| `STATUS_UPDATE` | Progress update |

### DevOps Coordination Types

| Type | Direction | Purpose |
|------|-----------|---------|
| `DEVOPS_REQUEST` | PM CLI -> DevOps CLI | Request devops operation |
| `DEVOPS_STARTED` | DevOps CLI -> PM CLI | Operation in progress |
| `DEVOPS_COMPLETE` | DevOps CLI -> PM CLI | Operation finished (success) |
| `DEVOPS_FAILED` | DevOps CLI -> PM CLI | Operation failed (with error) |
| `PERMISSION_FORWARD` | Subagent -> PM CLI | Permission request for user |

## Check Messages

```bash
./scripts/coordination/check-messages.sh --pending
./scripts/coordination/ack-message.sh <message-id>
```
