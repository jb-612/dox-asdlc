# P02-F06: User Stories

## Epic Summary

Fix coordination message sender identification so that all messages have proper instance identity, enabling reliable message routing, query filtering, and audit traceability.

**GitHub Issue:** #49

---

## US-01: Automatic Identity Resolution

**As a** subagent (backend, frontend, devops)
**I want** the coordination MCP server to automatically determine my identity from git config
**So that** I don't need to manually configure CLAUDE_INSTANCE_ID

### Acceptance Criteria

- [ ] MCP server reads `git config user.email` at startup
- [ ] Email `claude-backend@asdlc.local` maps to instance ID `backend`
- [ ] Email `claude-frontend@asdlc.local` maps to instance ID `frontend`
- [ ] Email `claude-orchestrator@asdlc.local` maps to instance ID `orchestrator`
- [ ] Email `claude-devops@asdlc.local` maps to instance ID `devops`
- [ ] CLAUDE_INSTANCE_ID environment variable takes precedence over git config

### Acceptance Tests

```python
def test_identity_from_backend_email():
    """Git email claude-backend@asdlc.local resolves to 'backend'."""
    with mock_git_config("claude-backend@asdlc.local"):
        server = CoordinationMCPServer()
        assert server._instance_id == "backend"

def test_identity_from_frontend_email():
    """Git email claude-frontend@asdlc.local resolves to 'frontend'."""
    with mock_git_config("claude-frontend@asdlc.local"):
        server = CoordinationMCPServer()
        assert server._instance_id == "frontend"

def test_env_var_takes_precedence():
    """CLAUDE_INSTANCE_ID env var overrides git config."""
    with patch.dict("os.environ", {"CLAUDE_INSTANCE_ID": "custom"}):
        with mock_git_config("claude-backend@asdlc.local"):
            server = CoordinationMCPServer()
            assert server._instance_id == "custom"
```

---

## US-02: Fail-Fast on Unknown Identity

**As a** system operator
**I want** the MCP server to fail startup if identity cannot be determined
**So that** I am immediately aware of configuration issues

### Acceptance Criteria

- [ ] MCP server raises RuntimeError if identity cannot be resolved
- [ ] Error message includes actionable guidance
- [ ] Unknown git emails cause startup failure
- [ ] Empty CLAUDE_INSTANCE_ID is treated as unset

### Acceptance Tests

```python
def test_startup_fails_unknown_email():
    """MCP server fails startup with unknown git email."""
    with mock_git_config("unknown@example.com"):
        with pytest.raises(RuntimeError) as exc:
            CoordinationMCPServer()
        assert "Cannot determine instance identity" in str(exc.value)
        assert "CLAUDE_INSTANCE_ID" in str(exc.value)

def test_startup_fails_no_git_config():
    """MCP server fails startup if git config unavailable."""
    with mock_git_config_failure():
        with pytest.raises(RuntimeError) as exc:
            CoordinationMCPServer()
        assert "Cannot determine instance identity" in str(exc.value)

def test_empty_env_var_ignored():
    """Empty CLAUDE_INSTANCE_ID is treated as unset."""
    with patch.dict("os.environ", {"CLAUDE_INSTANCE_ID": ""}):
        with mock_git_config("claude-backend@asdlc.local"):
            server = CoordinationMCPServer()
            assert server._instance_id == "backend"
```

---

## US-03: Message Rejection for Invalid Sender

**As a** coordination system
**I want** to reject messages with invalid sender identity
**So that** all stored messages have proper attribution

### Acceptance Criteria

- [ ] Messages with `from: "unknown"` are rejected
- [ ] Messages with empty `from` are rejected
- [ ] Messages with null `from` are rejected
- [ ] Rejection response includes error and hint
- [ ] Valid sender identity allows message publishing

### Acceptance Tests

```python
@pytest.mark.asyncio
async def test_reject_unknown_sender():
    """Messages from 'unknown' sender are rejected."""
    server = create_server_with_identity("unknown")
    result = await server.coord_publish_message(
        msg_type="GENERAL",
        subject="Test",
        description="Test message",
    )
    assert result["success"] is False
    assert "Invalid sender identity" in result["error"]

@pytest.mark.asyncio
async def test_accept_valid_sender():
    """Messages from valid sender are accepted."""
    server = create_server_with_identity("backend")
    # Mock the client
    server._client = mock_client
    result = await server.coord_publish_message(
        msg_type="GENERAL",
        subject="Test",
        description="Test message",
    )
    assert result["success"] is True
    assert result["from"] == "backend"
```

---

## US-04: Proper Message Attribution

**As a** PM CLI
**I want** to query messages by sender instance
**So that** I can see which agent sent each message

### Acceptance Criteria

- [ ] Published messages include correct `from` field
- [ ] Query by `from_instance` returns matching messages
- [ ] Pending message queries filter by sender correctly
- [ ] Message responses include sender identity

### Acceptance Tests

```python
@pytest.mark.asyncio
async def test_message_includes_sender():
    """Published message response includes sender identity."""
    server = create_server_with_identity("backend")
    server._client = mock_client_returning_message()

    result = await server.coord_publish_message(
        msg_type="READY_FOR_REVIEW",
        subject="Feature ready",
        description="P02-F06 ready for review",
    )

    assert result["success"] is True
    assert result["from"] == "backend"

@pytest.mark.asyncio
async def test_query_by_sender():
    """Can query messages filtered by sender."""
    server = create_server_with_identity("orchestrator")
    server._client = mock_client_returning_messages()

    result = await server.coord_check_messages(from_instance="backend")

    assert result["success"] is True
    # Verify query was built with from_instance filter
    call_args = server._client.get_messages.call_args
    query = call_args[0][0]
    assert query.from_instance == "backend"
```

---

## US-05: Documentation Update

**As a** developer
**I want** clear documentation on sender identity requirements
**So that** I understand how to configure coordination properly

### Acceptance Criteria

- [ ] `.claude/rules/parallel-coordination.md` documents sender identity
- [ ] Documentation explains git email to instance ID mapping
- [ ] Documentation explains CLAUDE_INSTANCE_ID override
- [ ] Documentation explains failure behavior

### Acceptance Tests

Manual verification:
- [ ] Documentation includes "Sender Identity" section
- [ ] Git email mapping table is present
- [ ] Configuration priority is explained
- [ ] Troubleshooting guidance is provided

---

## Story Map

```
Epic: Fix Coordination Sender Identity
|
+-- US-01: Automatic Identity Resolution
|     |
|     +-- Identity derived from git user.email
|     +-- Known email patterns mapped to instance IDs
|     +-- Environment variable override supported
|
+-- US-02: Fail-Fast on Unknown Identity
|     |
|     +-- Startup fails with clear error
|     +-- Actionable guidance in error message
|
+-- US-03: Message Rejection for Invalid Sender
|     |
|     +-- "unknown" sender rejected
|     +-- Empty/null sender rejected
|     +-- Error response with hint
|
+-- US-04: Proper Message Attribution
|     |
|     +-- Messages include correct sender
|     +-- Queries by sender work correctly
|
+-- US-05: Documentation Update
      |
      +-- Configuration documented
      +-- Troubleshooting guidance
```

## Priority

| Story | Priority | Reason |
|-------|----------|--------|
| US-01 | P0 | Core fix - enables sender identification |
| US-02 | P0 | Core fix - prevents silent failures |
| US-03 | P1 | Validation - ensures data quality |
| US-04 | P1 | Verification - confirms fix works |
| US-05 | P2 | Documentation - aids troubleshooting |
