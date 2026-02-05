---
description: Coordination rules for parallel CLI instances
---

# Parallel CLI Coordination

Multiple CLI sessions work in parallel with domain boundaries. Sessions are identified by **bounded context** (feature/epic), while subagent roles determine path restrictions.

## Concepts

| Concept | Purpose | Example |
|---------|---------|---------|
| **Session Context** (CLAUDE_INSTANCE_ID) | Which feature worktree | `p11-guardrails`, `p04-review-swarm` |
| **Subagent Role** | Path restrictions within a session | `backend`, `frontend`, `orchestrator`, `devops` |

## Subagent Roles (Path Restrictions)

| Role | Domain |
|------|--------|
| backend | Workers, infra (P01-P03, P06) |
| frontend | HITL UI (P05) |
| orchestrator | Meta files, coordination |
| devops | Docker, K8s, cloud, GitHub Actions |

## Sender Identity

The coordination MCP server identifies the sender based on `CLAUDE_INSTANCE_ID` environment variable.

### CLAUDE_INSTANCE_ID (Required for Worktrees)

The `CLAUDE_INSTANCE_ID` environment variable identifies the session context:

1. If `CLAUDE_INSTANCE_ID` is set and not empty or "unknown", use it
2. Otherwise, default to `pm` in main repository
3. In a worktree without CLAUDE_INSTANCE_ID, session startup will warn

```bash
# Example: Set identity for a feature context
export CLAUDE_INSTANCE_ID=p11-guardrails
claude
```

**Note:** Any non-empty string is valid as CLAUDE_INSTANCE_ID. Use work item naming format (e.g., `p11-guardrails`, `p04-review-swarm`).

### Fail-Fast Behavior

The MCP server requires a valid identity to start. If identity cannot be determined:

- Server raises `RuntimeError` during initialization
- Server will not start without valid identity
- This prevents messages from being published with `from: "unknown"`

### Message Validation

Messages with invalid sender identity are rejected:

- Messages with `from: "unknown"`, empty, or null are rejected
- Error response includes hint for resolution:

```json
{
  "success": false,
  "error": "Invalid sender identity. Cannot publish messages with unknown sender.",
  "hint": "Set CLAUDE_INSTANCE_ID environment variable"
}
```

### Troubleshooting

#### Server Fails to Start

If the MCP server fails to start with identity error:

1. **Check environment variable:**
   ```bash
   echo $CLAUDE_INSTANCE_ID
   ```

2. **Set identity for your context:**
   ```bash
   export CLAUDE_INSTANCE_ID=p11-guardrails
   ```

3. **Or use PM identity in main repo:**
   ```bash
   export CLAUDE_INSTANCE_ID=pm
   ```

#### Verify Current Identity

To check the current identity that would be used:

```bash
# Check environment variable
echo $CLAUDE_INSTANCE_ID
```

#### Common Error Messages

| Error Message | Cause | Solution |
|---------------|-------|----------|
| `RuntimeError: Cannot determine instance identity` | CLAUDE_INSTANCE_ID not set | Set CLAUDE_INSTANCE_ID |
| `Invalid sender identity. Cannot publish messages with unknown sender.` | Identity is empty or "unknown" | Set valid CLAUDE_INSTANCE_ID |

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
