# P02-F06: Coordination Sender Identity

## Technical Design

### Overview

This feature fixes a critical bug in the coordination MCP server where messages are sent with `from: "unknown"` instead of proper instance identifiers. This breaks message routing, query filtering, and audit traceability.

**Goals:**
- Derive instance identity automatically from git user.email at MCP server startup
- Reject messages with invalid sender identity ("unknown", empty, or null)
- Enforce explicit `requires_ack` setting to prevent accidental defaults
- Update documentation to reflect sender identity requirements

**GitHub Issue:** #49

### Root Cause Analysis

The current implementation has four failure points:

1. **Missing identity file**: `.claude/instance-identity.json` doesn't exist
2. **No CLAUDE_INSTANCE_ID in MCP config**: `.mcp.json` doesn't set the env var
3. **MCP server falls back to "unknown"**: `mcp_server.py:40` defaults to "unknown"
4. **Session start hook doesn't establish identity**: Only displays git email, doesn't set coordination identity

### Architecture Reference

From `.claude/rules/parallel-coordination.md`:

| Role | Domain | Git Email |
|------|--------|-----------|
| backend | Workers, infra (P01-P03, P06) | `claude-backend@asdlc.local` |
| frontend | HITL UI (P05) | `claude-frontend@asdlc.local` |
| orchestrator | Meta files, coordination | `claude-orchestrator@asdlc.local` |
| devops | Docker, K8s, cloud, GitHub Actions | `claude-devops@asdlc.local` |

### Dependencies

**Internal:**
- P01-F04: CLI Coordination MCP (COMPLETE)
  - `src/infrastructure/coordination/mcp_server.py`
  - `src/infrastructure/coordination/types.py`
  - `src/infrastructure/coordination/client.py`

**External:**
- None (uses existing git CLI)

### Technical Approach

#### 1. Identity Derivation at MCP Startup

The simplest and most reliable approach is to derive instance identity from `git config user.email` when the MCP server starts. This leverages the existing git identity system that subagents already configure.

**Derivation mapping:**

| Git Email Pattern | Instance ID |
|-------------------|-------------|
| `claude-backend@asdlc.local` | `backend` |
| `claude-frontend@asdlc.local` | `frontend` |
| `claude-orchestrator@asdlc.local` | `orchestrator` |
| `claude-devops@asdlc.local` | `devops` |
| Other/Unknown | Reject startup with error |

**Priority order for identity resolution:**
1. `CLAUDE_INSTANCE_ID` environment variable (highest priority)
2. Derive from `git config user.email` (automatic)
3. Reject with clear error message (fail-fast)

```python
def _resolve_instance_id(self) -> str:
    """Resolve instance identity from environment or git config.

    Priority:
    1. CLAUDE_INSTANCE_ID environment variable
    2. Derive from git user.email
    3. Raise error if neither available

    Returns:
        Instance ID string (e.g., "backend", "frontend")

    Raises:
        RuntimeError: If instance identity cannot be determined
    """
    # Check environment variable first
    env_id = os.environ.get("CLAUDE_INSTANCE_ID")
    if env_id and env_id != "unknown":
        return env_id

    # Try to derive from git user.email
    try:
        result = subprocess.run(
            ["git", "config", "user.email"],
            capture_output=True,
            text=True,
            timeout=5,
            cwd=os.getcwd(),
        )
        email = result.stdout.strip()

        # Map email to instance ID
        email_to_instance = {
            "claude-backend@asdlc.local": "backend",
            "claude-frontend@asdlc.local": "frontend",
            "claude-orchestrator@asdlc.local": "orchestrator",
            "claude-devops@asdlc.local": "devops",
        }

        if email in email_to_instance:
            return email_to_instance[email]

    except Exception as e:
        logger.warning(f"Failed to read git config: {e}")

    # Cannot determine identity
    raise RuntimeError(
        "Cannot determine instance identity. Set CLAUDE_INSTANCE_ID "
        "environment variable or configure git user.email to a known "
        "role (e.g., claude-backend@asdlc.local)"
    )
```

#### 2. Message Validation

Add validation in `coord_publish_message` to reject invalid messages:

```python
async def coord_publish_message(
    self,
    msg_type: str,
    subject: str,
    description: str,
    to_instance: str = "orchestrator",
    requires_ack: bool = True,
) -> dict[str, Any]:
    """Publish a coordination message.

    Validates sender identity before publishing. Messages with
    invalid sender identity are rejected.
    """
    # Validate sender identity
    if self._instance_id in (None, "", "unknown"):
        return {
            "success": False,
            "error": "Invalid sender identity. Cannot publish messages with unknown sender.",
            "hint": "Set CLAUDE_INSTANCE_ID or configure git user.email",
        }

    # Continue with existing logic...
```

#### 3. Startup Validation

Move identity resolution to `__init__` with fail-fast behavior:

```python
def __init__(self) -> None:
    """Initialize the MCP server.

    Raises:
        RuntimeError: If instance identity cannot be determined
    """
    self._client: CoordinationClient | None = None
    self._config = CoordinationConfig.from_env()

    # Resolve identity at startup (fail-fast)
    self._instance_id = self._resolve_instance_id()
    logger.info(f"Coordination MCP server initialized with identity: {self._instance_id}")
```

### Files to Modify

| File | Change |
|------|--------|
| `src/infrastructure/coordination/mcp_server.py` | Add identity resolution, message validation |
| `.claude/rules/parallel-coordination.md` | Document sender identity requirements |
| `tests/unit/infrastructure/test_coordination_mcp_server.py` | Add tests for identity resolution and validation |

### Files NOT Modified

| File | Reason |
|------|--------|
| `.mcp.json` | No changes needed; identity derived from git |
| `scripts/hooks/session-start.py` | Optional; subagents already set git identity |
| `.claude/instance-identity.json` | Not created; using git identity instead |

### Error Handling

**Startup failure (cannot resolve identity):**
```
RuntimeError: Cannot determine instance identity. Set CLAUDE_INSTANCE_ID
environment variable or configure git user.email to a known role
(e.g., claude-backend@asdlc.local)
```

**Message rejection (invalid sender):**
```json
{
  "success": false,
  "error": "Invalid sender identity. Cannot publish messages with unknown sender.",
  "hint": "Set CLAUDE_INSTANCE_ID or configure git user.email"
}
```

### Testing Strategy

1. **Unit tests**: Mock subprocess for git config, test identity resolution
2. **Unit tests**: Test message rejection with invalid sender
3. **Unit tests**: Test successful message publishing with valid sender
4. **Integration tests**: Verify MCP server startup with valid git identity

### Security Considerations

1. **No credential exposure**: Identity derived from local git config only
2. **Fail-fast**: Server refuses to start without valid identity
3. **Audit trail**: All messages include verified sender identity

### Backward Compatibility

- Existing messages with `from: "unknown"` remain in Redis (not deleted)
- New messages will have proper sender identity
- Queries filtering by `from_instance` will work correctly for new messages

### Success Criteria

1. MCP server derives identity from git user.email automatically
2. Messages with `from: "unknown"` are rejected
3. Message queries by `from_instance` return expected results
4. Pending message queries work correctly
5. Notification routing works for targeted instances
