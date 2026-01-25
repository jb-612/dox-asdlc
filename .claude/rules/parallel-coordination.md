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

## Sender Identity

The coordination MCP server automatically identifies the sender based on git configuration. This ensures all messages have proper attribution for routing and audit purposes.

### Git Email to Instance ID Mapping

| Git Email | Instance ID |
|-----------|-------------|
| `claude-backend@asdlc.local` | `backend` |
| `claude-frontend@asdlc.local` | `frontend` |
| `claude-orchestrator@asdlc.local` | `orchestrator` |
| `claude-devops@asdlc.local` | `devops` |

The MCP server reads `git config user.email` at startup and maps it to the corresponding instance ID.

### CLAUDE_INSTANCE_ID Override

The `CLAUDE_INSTANCE_ID` environment variable takes precedence over git config:

1. If `CLAUDE_INSTANCE_ID` is set and not empty or "unknown", use it
2. Otherwise, derive from `git config user.email`
3. If neither is available, fail with error

```bash
# Example: Override identity via environment
CLAUDE_INSTANCE_ID=backend python -m src.infrastructure.coordination.mcp_server
```

**Note:** Empty string or "unknown" values for `CLAUDE_INSTANCE_ID` are ignored and fall back to git config detection.

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
  "hint": "Set CLAUDE_INSTANCE_ID or configure git user.email"
}
```

### Troubleshooting

#### Server Fails to Start

If the MCP server fails to start with identity error:

1. **Check git identity:**
   ```bash
   git config user.email
   ```

2. **Verify email is recognized:**
   Must be one of:
   - `claude-backend@asdlc.local`
   - `claude-frontend@asdlc.local`
   - `claude-orchestrator@asdlc.local`
   - `claude-devops@asdlc.local`

3. **Set git identity if needed:**
   ```bash
   git config user.email "claude-backend@asdlc.local"
   ```

4. **Or use environment override:**
   ```bash
   export CLAUDE_INSTANCE_ID=backend
   ```

#### Verify Current Identity

To check the current identity that would be used:

```bash
# Check git email
git config user.email

# Check environment override
echo $CLAUDE_INSTANCE_ID
```

#### Common Error Messages

| Error Message | Cause | Solution |
|---------------|-------|----------|
| `RuntimeError: Cannot determine instance identity` | No valid git email or env var | Set git email or CLAUDE_INSTANCE_ID |
| `Invalid sender identity. Cannot publish messages with unknown sender.` | Identity resolved to "unknown" | Verify git email is in the mapping table |

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
