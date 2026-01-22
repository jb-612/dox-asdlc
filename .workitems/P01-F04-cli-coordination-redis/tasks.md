# P01-F04: CLI Coordination Migration to Redis - Tasks

## Overview

This task breakdown covers migrating the CLI coordination system from filesystem-based JSON files to Redis pub/sub with MCP wrapper, while maintaining 100% backward compatibility.

## Dependencies

- **P01-F01**: Infrastructure setup - COMPLETE (Redis already deployed)
- **P01-F02**: Bash tool abstraction layer - COMPLETE
- **P01-F03**: KnowledgeStore interface - COMPLETE (patterns established)

## Task List

### T01: Add coordination exceptions to exception hierarchy

**Model**: haiku
**Description**: Extend the existing exception hierarchy with coordination-specific exceptions.

**Subtasks**:
- [ ] Add `CoordinationError` base exception
- [ ] Add `MessageNotFoundError` exception
- [ ] Add `PublishError` exception
- [ ] Add `AcknowledgeError` exception
- [ ] Add `PresenceError` exception
- [ ] Write unit tests for exception hierarchy

**Acceptance Criteria**:
- [ ] All exceptions inherit from `ASDLCError`
- [ ] Exceptions include `message` and `details` fields
- [ ] Exceptions support JSON serialization via `to_dict()`
- [ ] Unit tests verify inheritance chain

**Test Cases**:
- [ ] Test exception instantiation with message
- [ ] Test exception instantiation with details
- [ ] Test to_dict() serialization
- [ ] Test inheritance from ASDLCError

**Estimate**: 30min

---

### T02: Define coordination data models (Pydantic)

**Model**: haiku
**Description**: Create Pydantic models for coordination messages, queries, and events.

**Subtasks**:
- [ ] Create `src/infrastructure/coordination/` directory
- [ ] Create `types.py` with `CoordinationMessage` model
- [ ] Create `MessageQuery` model for query parameters
- [ ] Create `NotificationEvent` model for pub/sub
- [ ] Create `PresenceInfo` model
- [ ] Create `MessageType` enum with all 16 types
- [ ] Add JSON serialization methods
- [ ] Write unit tests for models

**Acceptance Criteria**:
- [ ] `CoordinationMessage` has all required fields from schema
- [ ] `MessageQuery` supports all filter parameters
- [ ] Models validate field types
- [ ] JSON serialization is compatible with bash scripts
- [ ] Unit tests verify field types and serialization

**Test Cases**:
- [ ] Test CoordinationMessage creation with all fields
- [ ] Test CoordinationMessage creation with minimal fields
- [ ] Test MessageQuery with various filter combinations
- [ ] Test JSON serialization round-trip
- [ ] Test MessageType enum values

**Estimate**: 1hr

---

### T03: Create coordination configuration

**Model**: haiku
**Description**: Add configuration dataclass for coordination settings.

**Subtasks**:
- [ ] Create `src/infrastructure/coordination/config.py`
- [ ] Define `CoordinationConfig` dataclass
- [ ] Implement `from_env()` class method
- [ ] Add Redis key prefix constants
- [ ] Add TTL constants (30 days default)
- [ ] Write unit tests for configuration

**Acceptance Criteria**:
- [ ] Config includes: `redis_host`, `redis_port`, `key_prefix`, `message_ttl`
- [ ] Config loads from environment variables with defaults
- [ ] Constants for all Redis key patterns defined
- [ ] Unit tests verify default values and env loading

**Test Cases**:
- [ ] Test default configuration values
- [ ] Test configuration from environment variables
- [ ] Test key prefix generation
- [ ] Test TTL configuration

**Estimate**: 30min

---

### T04: Implement CoordinationClient base structure

**Model**: sonnet
**Description**: Create the CoordinationClient class with connection management.

**Subtasks**:
- [ ] Create `src/infrastructure/coordination/client.py`
- [ ] Implement `__init__` with Redis client injection
- [ ] Implement `__aenter__` and `__aexit__` for context manager
- [ ] Add Redis connection health check
- [ ] Add logging infrastructure
- [ ] Write unit tests (mocked Redis)

**Acceptance Criteria**:
- [ ] Client accepts Redis client instance
- [ ] Context manager properly cleans up resources
- [ ] Health check verifies Redis connectivity
- [ ] Logging includes correlation IDs
- [ ] Unit tests cover initialization and cleanup

**Test Cases**:
- [ ] Test client initialization with Redis client
- [ ] Test context manager entry/exit
- [ ] Test health check with healthy Redis
- [ ] Test health check with unavailable Redis

**Estimate**: 1hr

---

### T05: Implement atomic message publishing

**Model**: sonnet
**Description**: Implement the `publish_message` method with Redis pipeline.

**Subtasks**:
- [ ] Implement `publish_message()` method
- [ ] Use Redis pipeline with transaction for atomicity
- [ ] Store message hash at `coord:msg:{id}`
- [ ] Add to timeline sorted set `coord:timeline`
- [ ] Add to inbox set `coord:inbox:{to_instance}`
- [ ] Add to pending set `coord:pending` if requires_ack
- [ ] Publish notification to `coord:notify:{to_instance}`
- [ ] Publish notification to `coord:notify:all`
- [ ] Handle duplicate message IDs
- [ ] Write comprehensive unit tests

**Acceptance Criteria**:
- [ ] All Redis operations in single atomic transaction
- [ ] Message stored with all fields
- [ ] Timeline index updated with timestamp score
- [ ] Inbox index updated for target instance
- [ ] Pending set updated if acknowledgment required
- [ ] Notifications sent to both channels
- [ ] Unit tests cover success and error cases

**Test Cases**:
- [ ] Test successful publish with all fields
- [ ] Test publish with requires_ack=false
- [ ] Test publish to broadcast (to=all)
- [ ] Test duplicate message ID rejection
- [ ] Test Redis connection failure handling
- [ ] Test transaction rollback on partial failure

**Estimate**: 2hr

---

### T06: Implement message queries

**Model**: sonnet
**Description**: Implement the `get_messages` and `get_message` methods.

**Subtasks**:
- [ ] Implement `get_messages()` with MessageQuery
- [ ] Query by `to_instance` using inbox set
- [ ] Filter by `from_instance`
- [ ] Filter by message `type`
- [ ] Filter by `pending_only` using pending set
- [ ] Filter by `since` timestamp
- [ ] Implement pagination with `limit`
- [ ] Implement `get_message()` for single message
- [ ] Write comprehensive unit tests

**Acceptance Criteria**:
- [ ] Queries use Redis sets for O(1) lookups
- [ ] Filters combine correctly
- [ ] Results sorted by timestamp (newest first)
- [ ] Pagination respects limit
- [ ] Single message lookup is efficient
- [ ] Unit tests cover all filter combinations

**Test Cases**:
- [ ] Test query by to_instance
- [ ] Test query by from_instance
- [ ] Test query by type
- [ ] Test query pending_only
- [ ] Test query with since timestamp
- [ ] Test query with limit
- [ ] Test combined filters
- [ ] Test get_message found
- [ ] Test get_message not found

**Estimate**: 1.5hr

---

### T07: Implement message acknowledgment

**Model**: haiku
**Description**: Implement the `acknowledge_message` method.

**Subtasks**:
- [ ] Implement `acknowledge_message()` method
- [ ] Update message hash with ack fields
- [ ] Remove from pending set
- [ ] Handle already-acknowledged messages (idempotent)
- [ ] Support optional comment field
- [ ] Write unit tests

**Acceptance Criteria**:
- [ ] Acknowledgment updates `acknowledged`, `ack_by`, `ack_timestamp`
- [ ] Message removed from `coord:pending` set
- [ ] Re-acknowledgment is idempotent (no error)
- [ ] Returns false if message not found
- [ ] Comment stored if provided
- [ ] Unit tests cover all cases

**Test Cases**:
- [ ] Test acknowledge existing message
- [ ] Test acknowledge with comment
- [ ] Test acknowledge already-acked message
- [ ] Test acknowledge non-existent message
- [ ] Test pending set removal

**Estimate**: 45min

---

### T08: Implement real-time notifications

**Model**: sonnet
**Description**: Implement pub/sub subscription for notifications.

**Subtasks**:
- [ ] Implement `subscribe_notifications()` method
- [ ] Subscribe to instance-specific channel
- [ ] Subscribe to broadcast channel
- [ ] Parse notification events
- [ ] Invoke callback on message receipt
- [ ] Handle disconnection/reconnection
- [ ] Write unit tests with pubsub mock

**Acceptance Criteria**:
- [ ] Subscribes to both instance and broadcast channels
- [ ] Notifications parsed into `NotificationEvent`
- [ ] Callback invoked asynchronously
- [ ] Reconnection handled gracefully
- [ ] Unit tests verify subscription behavior

**Test Cases**:
- [ ] Test subscribe to instance channel
- [ ] Test receive notification
- [ ] Test callback invocation
- [ ] Test disconnection handling
- [ ] Test reconnection

**Estimate**: 1.5hr

---

### T09: Implement instance presence tracking

**Model**: haiku
**Description**: Implement presence registration and heartbeat.

**Subtasks**:
- [ ] Implement `register_instance()` method
- [ ] Implement `heartbeat()` method
- [ ] Implement `unregister_instance()` method
- [ ] Implement `get_presence()` method
- [ ] Store in `coord:presence` hash
- [ ] Mark stale instances (5 min no heartbeat)
- [ ] Write unit tests

**Acceptance Criteria**:
- [ ] Registration stores instance info in hash
- [ ] Heartbeat updates timestamp
- [ ] Unregister removes from hash
- [ ] Get presence returns all instances with status
- [ ] Stale detection works correctly
- [ ] Unit tests cover all cases

**Test Cases**:
- [ ] Test register instance
- [ ] Test heartbeat updates timestamp
- [ ] Test unregister instance
- [ ] Test get_presence with active instances
- [ ] Test stale instance detection

**Estimate**: 45min

---

### T10: Implement coordination statistics

**Model**: haiku
**Description**: Implement the `get_stats` method for monitoring.

**Subtasks**:
- [ ] Implement `get_stats()` method
- [ ] Count total messages
- [ ] Count pending messages
- [ ] Count messages by type
- [ ] Count active instances
- [ ] Write unit tests

**Acceptance Criteria**:
- [ ] Stats include total message count
- [ ] Stats include pending count
- [ ] Stats include breakdown by type
- [ ] Stats include active instance count
- [ ] Unit tests verify stat calculation

**Test Cases**:
- [ ] Test stats with empty system
- [ ] Test stats with messages
- [ ] Test stats message type breakdown
- [ ] Test stats instance count

**Estimate**: 30min

---

### T11: Create coordination factory function

**Model**: haiku
**Description**: Implement factory function for obtaining configured client.

**Subtasks**:
- [ ] Create `src/infrastructure/coordination/factory.py`
- [ ] Implement `get_coordination_client()` async function
- [ ] Support singleton pattern for connection reuse
- [ ] Read config from environment
- [ ] Handle configuration errors
- [ ] Write unit tests

**Acceptance Criteria**:
- [ ] Factory returns `CoordinationClient` instance
- [ ] Factory reads config from environment
- [ ] Multiple calls return same instance (singleton)
- [ ] Factory handles configuration errors
- [ ] Unit tests verify factory behavior

**Test Cases**:
- [ ] Test factory returns client instance
- [ ] Test singleton behavior
- [ ] Test configuration from environment
- [ ] Test error handling for missing config

**Estimate**: 30min

---

### T12: Create MCP server implementation

**Model**: sonnet
**Description**: Create MCP server wrapper exposing coordination tools.

**Subtasks**:
- [ ] Create `src/infrastructure/coordination/mcp_server.py`
- [ ] Implement `coord_publish_message` tool
- [ ] Implement `coord_check_messages` tool
- [ ] Implement `coord_ack_message` tool
- [ ] Implement `coord_get_presence` tool
- [ ] Configure stdio transport
- [ ] Add tool schema definitions
- [ ] Write unit tests

**Acceptance Criteria**:
- [ ] MCP server exposes 4 tools
- [ ] Tool inputs/outputs match bash script interface
- [ ] Server runs via stdio transport
- [ ] Proper error handling and responses
- [ ] Unit tests verify tool behavior

**Test Cases**:
- [ ] Test coord_publish_message tool
- [ ] Test coord_check_messages tool
- [ ] Test coord_ack_message tool
- [ ] Test coord_get_presence tool
- [ ] Test tool schema validation

**Estimate**: 2hr

---

### T13: Create MCP server launcher script

**Model**: haiku
**Description**: Create bash script to launch MCP server.

**Subtasks**:
- [ ] Create `scripts/coordination/mcp-server.sh`
- [ ] Parse environment variables
- [ ] Launch Python MCP server
- [ ] Handle graceful shutdown
- [ ] Add logging

**Acceptance Criteria**:
- [ ] Script launches MCP server
- [ ] Reads REDIS_HOST, REDIS_PORT, CLAUDE_INSTANCE_ID
- [ ] Graceful shutdown on SIGTERM
- [ ] Logs startup and shutdown

**Test Cases**:
- [ ] Test server launches successfully
- [ ] Test shutdown signal handling

**Estimate**: 30min

---

### T14: Create shared bash helper functions

**Model**: haiku
**Description**: Create common.sh with shared helper functions.

**Subtasks**:
- [ ] Create `scripts/coordination/lib/common.sh`
- [ ] Implement `check_coordination_backend()` function
- [ ] Implement `call_python_coordination()` function
- [ ] Implement `emit_json()` helper
- [ ] Implement logging helpers

**Acceptance Criteria**:
- [ ] Backend detection works correctly
- [ ] Python coordination callable from bash
- [ ] JSON output helpers available
- [ ] Logging consistent with existing scripts

**Test Cases**:
- [ ] Test backend detection with Redis available
- [ ] Test backend detection with Redis unavailable
- [ ] Test Python coordination call

**Estimate**: 45min

---

### T15: Update publish-message.sh for hybrid mode

**Model**: sonnet
**Description**: Update publish script to use Redis with filesystem fallback.

**Subtasks**:
- [ ] Source common.sh helpers
- [ ] Detect coordination backend
- [ ] Implement Redis backend path (call Python)
- [ ] Keep existing filesystem path as fallback
- [ ] Ensure output format unchanged
- [ ] Write integration tests

**Acceptance Criteria**:
- [ ] Script detects and uses Redis when available
- [ ] Falls back to filesystem when Redis unavailable
- [ ] Output format identical to current
- [ ] Exit codes unchanged
- [ ] Integration tests verify both paths

**Test Cases**:
- [ ] Test publish with Redis backend
- [ ] Test publish with filesystem fallback
- [ ] Test output format compatibility
- [ ] Test error handling

**Estimate**: 1hr

---

### T16: Update check-messages.sh for hybrid mode

**Model**: sonnet
**Description**: Update check script to use Redis with filesystem fallback.

**Subtasks**:
- [ ] Source common.sh helpers
- [ ] Detect coordination backend
- [ ] Implement Redis backend path (call Python)
- [ ] Keep existing filesystem path as fallback
- [ ] Ensure output format unchanged
- [ ] Write integration tests

**Acceptance Criteria**:
- [ ] Script detects and uses Redis when available
- [ ] Falls back to filesystem when Redis unavailable
- [ ] All filter flags work with both backends
- [ ] Output format identical to current
- [ ] Integration tests verify both paths

**Test Cases**:
- [ ] Test check with Redis backend
- [ ] Test check with filesystem fallback
- [ ] Test filter flags
- [ ] Test output format compatibility

**Estimate**: 1hr

---

### T17: Update ack-message.sh for hybrid mode

**Model**: haiku
**Description**: Update ack script to use Redis with filesystem fallback.

**Subtasks**:
- [ ] Source common.sh helpers
- [ ] Detect coordination backend
- [ ] Implement Redis backend path (call Python)
- [ ] Keep existing filesystem path as fallback
- [ ] Ensure output format unchanged
- [ ] Write integration tests

**Acceptance Criteria**:
- [ ] Script detects and uses Redis when available
- [ ] Falls back to filesystem when Redis unavailable
- [ ] Output format identical to current
- [ ] Exit codes unchanged
- [ ] Integration tests verify both paths

**Test Cases**:
- [ ] Test ack with Redis backend
- [ ] Test ack with filesystem fallback
- [ ] Test already-acked message
- [ ] Test non-existent message

**Estimate**: 45min

---

### T18: Update redis.conf for AOF persistence

**Model**: haiku
**Description**: Enable AOF and tune RDB snapshots for durability.

**Subtasks**:
- [ ] Enable `appendonly yes`
- [ ] Set `appendfsync everysec`
- [ ] Increase RDB snapshot frequency
- [ ] Document trade-offs in comments

**Acceptance Criteria**:
- [ ] AOF enabled with everysec fsync
- [ ] RDB snapshots every 60s with 1 change
- [ ] Max 1 second data loss on crash
- [ ] Configuration documented

**Test Cases**:
- [ ] Verify AOF enabled after container restart
- [ ] Verify data persists after restart

**Estimate**: 30min

---

### T19: Create migration script

**Model**: sonnet
**Description**: Create script to migrate filesystem messages to Redis.

**Subtasks**:
- [ ] Create `scripts/coordination/migrate-to-redis.sh`
- [ ] Read JSON files from `.claude/coordination/messages/`
- [ ] Parse and validate each message
- [ ] Publish to Redis preserving IDs and timestamps
- [ ] Preserve acknowledgment status
- [ ] Implement dry-run mode
- [ ] Report success/failure counts
- [ ] Handle malformed JSON

**Acceptance Criteria**:
- [ ] Migrates all existing messages
- [ ] Preserves original IDs and timestamps
- [ ] Preserves acknowledgment status
- [ ] Dry-run shows what would be migrated
- [ ] Reports counts at end
- [ ] Gracefully handles bad JSON

**Test Cases**:
- [ ] Test migration of valid messages
- [ ] Test dry-run mode
- [ ] Test handling of malformed JSON
- [ ] Test preservation of ack status

**Estimate**: 1.5hr

---

### T20: Write integration tests with real Redis

**Model**: sonnet
**Description**: Create integration tests running against actual Redis.

**Subtasks**:
- [ ] Create `tests/integration/infrastructure/test_coordination_redis.py`
- [ ] Test full publish -> query -> acknowledge cycle
- [ ] Test pub/sub notification delivery
- [ ] Test instance presence tracking
- [ ] Test concurrent operations
- [ ] Add pytest fixtures for test data

**Acceptance Criteria**:
- [ ] Tests run against Docker Redis
- [ ] Tests clean up after themselves
- [ ] Tests verify atomic operations
- [ ] Tests pass in CI/CD environment
- [ ] Test coverage > 80%

**Test Cases**:
- [ ] Test publish and immediate query
- [ ] Test multiple message publishing
- [ ] Test acknowledgment flow
- [ ] Test notification delivery timing
- [ ] Test presence registration/heartbeat
- [ ] Test concurrent publish from multiple clients

**Estimate**: 2hr

---

### T21: Write MCP contract tests

**Model**: haiku
**Description**: Create tests verifying MCP tool contracts.

**Subtasks**:
- [ ] Create `tests/integration/infrastructure/test_mcp_coordination.py`
- [ ] Test tool schema validation
- [ ] Test input/output format matches bash scripts
- [ ] Test error handling
- [ ] Verify tool responses

**Acceptance Criteria**:
- [ ] Tool schemas are valid
- [ ] Inputs/outputs match bash interface
- [ ] Errors return proper format
- [ ] All 4 tools tested

**Test Cases**:
- [ ] Test publish tool input/output
- [ ] Test check tool input/output
- [ ] Test ack tool input/output
- [ ] Test presence tool input/output
- [ ] Test error responses

**Estimate**: 1hr

---

### T22: Write bash script integration tests

**Model**: haiku
**Description**: Create integration tests for hybrid bash scripts.

**Subtasks**:
- [ ] Create `tests/integration/scripts/test_coordination_scripts.sh`
- [ ] Test hybrid mode detection
- [ ] Test fallback to filesystem
- [ ] Validate output format matches existing
- [ ] Test all three scripts

**Acceptance Criteria**:
- [ ] Scripts work with Redis available
- [ ] Scripts work with Redis unavailable (fallback)
- [ ] Output format backward compatible
- [ ] Exit codes correct

**Test Cases**:
- [ ] Test publish with Redis
- [ ] Test publish fallback
- [ ] Test check with Redis
- [ ] Test check fallback
- [ ] Test ack with Redis
- [ ] Test ack fallback

**Estimate**: 1hr

---

### T23: Create module exports and documentation

**Model**: haiku
**Description**: Set up clean module exports and add documentation.

**Subtasks**:
- [ ] Create `src/infrastructure/coordination/__init__.py` with exports
- [ ] Add docstrings to all public functions
- [ ] Create usage examples in docstrings
- [ ] Update design.md with final implementation notes

**Acceptance Criteria**:
- [ ] `from src.infrastructure.coordination import CoordinationClient, get_coordination_client` works
- [ ] All public APIs have docstrings
- [ ] Examples are accurate and runnable
- [ ] Documentation matches implementation

**Test Cases**:
- [ ] Test module imports
- [ ] Test exported symbols match documentation

**Estimate**: 30min

---

## Progress

- **Started**: 2026-01-23
- **Tasks Complete**: 23/23
- **Percentage**: 100%
- **Status**: COMPLETE
- **Blockers**: None
- **Last Commit**: c165569 (T20-T22)

## Task Summary

| Task | Description | Model | Estimate | Status |
|------|-------------|-------|----------|--------|
| T01 | Add coordination exceptions | haiku | 30 min | [x] |
| T02 | Define coordination data models | haiku | 1 hr | [x] |
| T03 | Create coordination configuration | haiku | 30 min | [x] |
| T04 | Implement CoordinationClient base | sonnet | 1 hr | [x] |
| T05 | Implement atomic message publishing | sonnet | 2 hr | [x] |
| T06 | Implement message queries | sonnet | 1.5 hr | [x] |
| T07 | Implement message acknowledgment | haiku | 45 min | [x] |
| T08 | Implement real-time notifications | sonnet | 1.5 hr | [x] |
| T09 | Implement instance presence tracking | haiku | 45 min | [x] |
| T10 | Implement coordination statistics | haiku | 30 min | [x] |
| T11 | Create coordination factory function | haiku | 30 min | [x] |
| T12 | Create MCP server implementation | sonnet | 2 hr | [x] |
| T13 | Create MCP server launcher script | haiku | 30 min | [x] |
| T14 | Create shared bash helper functions | haiku | 45 min | [x] |
| T15 | Update publish-message.sh | sonnet | 1 hr | [x] |
| T16 | Update check-messages.sh | sonnet | 1 hr | [x] |
| T17 | Update ack-message.sh | haiku | 45 min | [x] |
| T18 | Update redis.conf for AOF | haiku | 30 min | [x] |
| T19 | Create migration script | sonnet | 1.5 hr | [x] |
| T20 | Write integration tests (Redis) | sonnet | 2 hr | [x] |
| T21 | Write MCP contract tests | haiku | 1 hr | [x] |
| T22 | Write bash script tests | haiku | 1 hr | [x] |
| T23 | Create module exports and docs | haiku | 30 min | [x] |

**Total Estimated Time**: ~21 hours

## Completion Checklist

- [ ] All tasks in Task List are marked complete
- [ ] All unit tests pass: `pytest tests/unit/infrastructure/test_coordination.py`
- [ ] All integration tests pass: `pytest tests/integration/infrastructure/`
- [ ] Bash script tests pass: `./tests/integration/scripts/test_coordination_scripts.sh`
- [ ] E2E tests pass: `./tools/e2e.sh`
- [ ] Linter passes: `./tools/lint.sh src/`
- [ ] No type errors: `mypy src/`
- [ ] Documentation updated
- [ ] Interface contracts verified against design.md
- [ ] Progress marked as 100% in tasks.md

## Notes

### Task Dependencies

```
T01 ────┐
        ├──► T04 ──► T05 ──► T06 ──► T07
T02 ────┤           │
        │           ├──► T08
T03 ────┘           │
                    ├──► T09 ──► T10
                    │
                    └──► T11 ──► T12 ──► T13

T14 ──► T15
    ──► T16
    ──► T17

T18 (independent)

T05 ──► T19

T05, T06, T07, T08 ──► T20

T12 ──► T21

T15, T16, T17 ──► T22

All ──► T23
```

### Implementation Order

1. Foundation: T01, T02, T03 (parallel)
2. Client Base: T04
3. Core Operations: T05, T06, T07 (sequential)
4. Advanced Features: T08, T09, T10 (parallel after T07)
5. Factory: T11
6. MCP Server: T12, T13 (sequential)
7. Bash Scripts: T14, T15, T16, T17 (T14 first, then parallel)
8. Redis Config: T18 (independent)
9. Migration: T19 (after T05)
10. Testing: T20, T21, T22 (parallel after dependencies)
11. Documentation: T23 (last)

### Testing Strategy

- Unit tests mock Redis client for fast execution
- Integration tests use real Redis in Docker
- Bash tests verify hybrid mode and fallback
- MCP tests verify tool contracts match bash interface

### Rollout Phases

Phase 1 corresponds to tasks T01-T23 (deploy parallel mode)
Phase 2-4 are operational procedures after code is complete
