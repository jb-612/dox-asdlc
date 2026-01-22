# User Stories: P01-F04 CLI Coordination Migration to Redis

## Epic Reference

This feature implements infrastructure improvements for the multi-CLI coordination system, migrating from filesystem-based JSON to Redis pub/sub with MCP wrapper.

## User Stories

### US-F04-01: Define Coordination Data Models

**As a** developer
**I want** structured data models for coordination messages
**So that** I have type-safe access to message data across Python and bash

**Acceptance Criteria:**
- [ ] `CoordinationMessage` Pydantic model with all message fields
- [ ] `MessageQuery` model for query parameters
- [ ] `NotificationEvent` model for pub/sub events
- [ ] `PresenceInfo` model for instance tracking
- [ ] Models support JSON serialization for bash interop
- [ ] All 16 message types are enumerated

**Priority:** High

---

### US-F04-02: Add Coordination Exceptions

**As a** developer
**I want** specific exceptions for coordination errors
**So that** I can handle different failure modes appropriately

**Acceptance Criteria:**
- [ ] `CoordinationError` base exception exists
- [ ] `MessageNotFoundError` for missing messages
- [ ] `PublishError` for publishing failures
- [ ] `AcknowledgeError` for acknowledgment failures
- [ ] `PresenceError` for presence operation failures
- [ ] All exceptions include helpful error messages
- [ ] Exceptions inherit from `ASDLCError`

**Priority:** Medium

---

### US-F04-03: Implement Atomic Message Publishing

**As a** CLI user
**I want** messages to be published atomically
**So that** concurrent writes never cause race conditions

**Acceptance Criteria:**
- [ ] `publish_message()` uses Redis pipeline with transaction
- [ ] Message hash, timeline, inbox, and pending set updated atomically
- [ ] Pub/sub notification sent within same transaction
- [ ] Failed transactions roll back completely
- [ ] Duplicate message IDs are rejected
- [ ] Message timestamps use UTC

**Priority:** High

---

### US-F04-04: Implement Message Queries

**As a** CLI user
**I want** to query messages with filters
**So that** I can find relevant messages quickly

**Acceptance Criteria:**
- [ ] `get_messages()` supports filtering by `to_instance`
- [ ] Supports filtering by `from_instance`
- [ ] Supports filtering by message `type`
- [ ] Supports `pending_only` to show unacked messages
- [ ] Supports `since` timestamp filter
- [ ] Supports `limit` parameter
- [ ] Query latency < 10ms for 100 messages

**Priority:** High

---

### US-F04-05: Implement Message Acknowledgment

**As a** CLI user
**I want** to acknowledge messages
**So that** senders know their messages were received

**Acceptance Criteria:**
- [ ] `acknowledge_message()` updates message hash
- [ ] Sets `acknowledged=true`, `ack_by`, `ack_timestamp`
- [ ] Removes message from pending set
- [ ] Optional `comment` field supported
- [ ] Acknowledging already-acked message is idempotent
- [ ] Returns false if message not found

**Priority:** High

---

### US-F04-06: Implement Real-Time Notifications

**As a** CLI user
**I want** real-time notifications when messages arrive
**So that** I don't have to poll for new messages

**Acceptance Criteria:**
- [ ] `subscribe_notifications()` subscribes to instance channel
- [ ] Notifications include message ID and type
- [ ] Callback invoked within 1 second of publish
- [ ] Supports both instance-specific and broadcast channels
- [ ] Graceful handling of disconnection/reconnection

**Priority:** Medium

---

### US-F04-07: Implement Instance Presence Tracking

**As an** orchestrator
**I want** to know which CLI instances are active
**So that** I can route messages to available instances

**Acceptance Criteria:**
- [ ] `register_instance()` records instance in presence hash
- [ ] `heartbeat()` updates last activity timestamp
- [ ] `get_presence()` returns all instance statuses
- [ ] `unregister_instance()` removes from presence
- [ ] Stale instances (no heartbeat in 5 min) marked inactive

**Priority:** Low

---

### US-F04-08: Create MCP Server Wrapper

**As a** Claude Code user
**I want** an MCP server for coordination
**So that** Claude can directly interact with the coordination system

**Acceptance Criteria:**
- [ ] MCP server exposes `coord_publish_message` tool
- [ ] Exposes `coord_check_messages` tool
- [ ] Exposes `coord_ack_message` tool
- [ ] Exposes `coord_get_presence` tool
- [ ] Server runs via stdio transport
- [ ] Tool inputs/outputs match bash script interface

**Priority:** Medium

---

### US-F04-09: Update Bash Scripts for Hybrid Mode

**As a** CLI user
**I want** bash scripts to use Redis when available
**So that** I get performance benefits without breaking existing workflow

**Acceptance Criteria:**
- [ ] `publish-message.sh` detects Redis availability
- [ ] Falls back to filesystem if Redis unavailable
- [ ] `check-messages.sh` uses Redis queries
- [ ] Falls back to filesystem scan if Redis unavailable
- [ ] `ack-message.sh` uses Redis acknowledgment
- [ ] Falls back to filesystem if Redis unavailable
- [ ] Output format unchanged (backward compatible)

**Priority:** High

---

### US-F04-10: Enable Redis AOF Persistence

**As a** system operator
**I want** Redis to persist coordination messages
**So that** messages survive container restarts

**Acceptance Criteria:**
- [ ] `appendonly yes` enabled in redis.conf
- [ ] `appendfsync everysec` for balance of durability/performance
- [ ] RDB snapshots increased frequency
- [ ] Max 1 second data loss on crash
- [ ] Persistence verified after container restart

**Priority:** High

---

### US-F04-11: Create Migration Script

**As a** system operator
**I want** to migrate existing filesystem messages to Redis
**So that** historical messages are available in the new system

**Acceptance Criteria:**
- [ ] Script reads all JSON files from `.claude/coordination/messages/`
- [ ] Preserves original message IDs and timestamps
- [ ] Preserves acknowledgment status
- [ ] Supports dry-run mode for validation
- [ ] Reports success/failure counts
- [ ] Handles malformed JSON gracefully

**Priority:** Medium

---

### US-F04-12: Create Parity Validation Script

**As a** system operator
**I want** to validate Redis and filesystem are in sync
**So that** I can trust the migration was successful

**Acceptance Criteria:**
- [ ] Script compares message counts
- [ ] Compares message content
- [ ] Reports discrepancies
- [ ] Runs automatically after dual-write period
- [ ] Returns exit code 0 only if parity achieved

**Priority:** Low

---

## Non-Functional Requirements

### Performance

- Publish operations complete in < 5ms
- Query operations complete in < 10ms for 100 messages
- Real-time notifications delivered in < 1 second
- System handles 10,000+ messages without degradation

### Reliability

- Redis unavailability triggers automatic filesystem fallback
- No message loss during normal operations
- Max 1 second data loss on Redis crash (AOF)
- Graceful degradation when MCP server unavailable

### Compatibility

- Bash script interface unchanged
- Output format backward compatible
- Existing workflows continue to work
- No changes required to CLI identity system

### Maintainability

- Comprehensive test coverage (>80%)
- Clear separation between Redis and filesystem code
- Factory pattern for dependency injection
- Detailed logging for debugging

## Dependencies

| Story | Depends On |
|-------|-----------|
| US-F04-03 | US-F04-01 |
| US-F04-04 | US-F04-01 |
| US-F04-05 | US-F04-01 |
| US-F04-06 | US-F04-01 |
| US-F04-07 | US-F04-01 |
| US-F04-08 | US-F04-03, US-F04-04, US-F04-05 |
| US-F04-09 | US-F04-03, US-F04-04, US-F04-05 |
| US-F04-11 | US-F04-03 |
| US-F04-12 | US-F04-09 |
