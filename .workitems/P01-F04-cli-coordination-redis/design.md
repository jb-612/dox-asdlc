# Feature Design: P01-F04 CLI Coordination Migration to Redis

## Overview

This feature migrates the CLI coordination system from filesystem-based JSON files to Redis pub/sub with MCP wrapper, eliminating race conditions, enabling real-time notifications, and maintaining 100% backward compatibility with existing bash scripts.

## Current State Analysis

### Existing Redis Infrastructure (Ready)
- **Deployed**: Redis 7.2 Alpine in Docker/Kubernetes
- **Client Ready**: `src/core/redis_client.py` with async support, connection pooling
- **Streams Active**: `src/infrastructure/redis_streams.py` for ASDLCEvent coordination
- **Configuration**: `docker/infrastructure/redis.conf` (RDB snapshots, 256MB memory)

### Current Coordination System Pain Points
- **Filesystem-based**: JSON files in `.claude/coordination/messages/`, `pending-acks/`
- **Race conditions**: No atomic operations, concurrent writes unsafe
- **Poor performance**: O(n) linear scans, no indexing
- **Data inconsistency**: Duplicate truth in `messages/` and `pending-acks/`
- **No pub/sub**: CLIs must poll for new messages
- **Identity loss**: Several messages show `"from": "unknown"`

### Message Schema (16 types)
```json
{
  "id": "msg-{uuid8}",
  "type": "READY_FOR_REVIEW|REVIEW_COMPLETE|CONTRACT_CHANGE_PROPOSED|...",
  "from": "instance_id",
  "to": "target_instance",
  "timestamp": "ISO-8601Z",
  "requires_ack": true|false,
  "acknowledged": false,
  "payload": {"subject": "...", "description": "..."},
  "ack_by": "acknowledger",
  "ack_timestamp": "ISO-8601Z"
}
```

## Dependencies

### Internal Dependencies

- **P01-F01**: Infrastructure setup - COMPLETE
  - Docker Compose configuration
  - Python core modules (`src/core/config.py`, `src/core/exceptions.py`)
  - Redis container already deployed

- **P01-F02**: Bash tool abstraction layer - COMPLETE
  - Testing infrastructure
  - Bash scripting patterns

- **P01-F03**: KnowledgeStore interface - COMPLETE
  - Established patterns for async Python infrastructure
  - Factory pattern for dependency injection

### External Dependencies

- Redis 7.2+ (already deployed)
- Python 3.11+
- MCP SDK for server implementation

## Technical Approach

### Design Decision: Redis Hashes + Pub/Sub (Hybrid)

**Why not Streams?** Streams are already used for ASDLCEvent coordination (worker tasks). For CLI coordination, we need:
- Fast queries by instance/type/ack status
- Simple acknowledgment tracking
- Real-time notifications without consumer group complexity

**Hybrid Approach**:
- **Redis Hashes**: Persistent storage (1 hash per message)
- **Sorted Sets/Sets**: Indexes for fast queries
- **Pub/Sub**: Real-time notifications (ephemeral)

**Note: RedisJSON Module Not Required**

This design intentionally uses standard Redis Hashes (`HSET`/`HGETALL`) instead of the RedisJSON module (`JSON.SET`/`JSON.GET`). Benefits:
- Compatible with standard Redis deployments without optional modules
- Field-level access without JSON parsing overhead
- Native Redis pipeline/transaction support
- Simpler deployment (no module compilation required)

Verified 2026-01-23: Production Redis (8.4.0) does not have RedisJSON loaded; this design works correctly.

### Redis Schema Design

#### Core Data Structures

**Message Storage** (Hash per message)
```
Key: coord:msg:{uuid}
Fields: id, type, from, to, timestamp, requires_ack, acknowledged, subject, description, ack_by, ack_timestamp, ack_comment
TTL: 30 days
```

**Timeline Index** (Sorted Set)
```
Key: coord:timeline
Score: Unix timestamp
Member: msg-{uuid}
Purpose: Chronological queries, auto-trim to last 1000
```

**Instance Inbox** (Set per instance)
```
Key: coord:inbox:{instance_id}
Members: msg-{uuid} where to={instance_id} OR to=all
Purpose: "messages for me" lookup
```

**Pending Acknowledgments** (Set)
```
Key: coord:pending
Members: msg-{uuid} where requires_ack=true AND acknowledged=false
Purpose: Fast unacked message queries
```

**Instance Presence** (Hash)
```
Key: coord:presence
Fields: {instance_id}.active, {instance_id}.last_heartbeat, {instance_id}.session_id
Purpose: Heartbeat tracking
```

#### Pub/Sub Channels

```
coord:notify:backend       # Per-instance channels
coord:notify:frontend
coord:notify:orchestrator
coord:notify:all           # Broadcast channel
```

**Notification Payload**:
```json
{
  "event": "message_published",
  "message_id": "msg-abc123",
  "type": "READY_FOR_REVIEW",
  "from": "backend",
  "to": "orchestrator",
  "requires_ack": true,
  "timestamp": "2026-01-23T12:00:00Z"
}
```

#### Atomic Publish Operation (Pipeline)

```python
async with redis.pipeline(transaction=True) as pipe:
    await pipe.hset(f"coord:msg:{msg_id}", mapping=msg_hash)
    await pipe.zadd("coord:timeline", {msg_id: timestamp})
    await pipe.sadd(f"coord:inbox:{to_instance}", msg_id)
    await pipe.sadd("coord:pending", msg_id)
    await pipe.publish(f"coord:notify:{to_instance}", notification_json)
    await pipe.publish("coord:notify:all", notification_json)
    await pipe.execute()  # All-or-nothing
```

## Interfaces

### Provided Interfaces

**CoordinationClient API**

```python
class CoordinationClient:
    """Redis-backed coordination message system."""

    async def publish_message(
        self,
        msg_type: str,
        subject: str,
        description: str,
        from_instance: str,
        to_instance: str,
        requires_ack: bool = True,
    ) -> CoordinationMessage:
        """Atomically publish a coordination message."""
        ...

    async def get_messages(
        self,
        query: MessageQuery,
    ) -> list[CoordinationMessage]:
        """Query messages with filters."""
        ...

    async def get_message(
        self,
        message_id: str,
    ) -> CoordinationMessage | None:
        """Get a single message by ID."""
        ...

    async def acknowledge_message(
        self,
        message_id: str,
        ack_by: str,
        comment: str | None = None,
    ) -> bool:
        """Acknowledge a message."""
        ...

    async def subscribe_notifications(
        self,
        instance_id: str,
        callback: Callable[[NotificationEvent], Awaitable[None]],
    ) -> None:
        """Subscribe to real-time notifications."""
        ...

    async def register_instance(
        self,
        instance_id: str,
        session_id: str,
    ) -> None:
        """Register CLI instance presence."""
        ...

    async def heartbeat(
        self,
        instance_id: str,
    ) -> None:
        """Send heartbeat for presence tracking."""
        ...

    async def get_presence(self) -> dict[str, PresenceInfo]:
        """Get all instance presence info."""
        ...

    async def get_stats(self) -> CoordinationStats:
        """Get coordination system statistics."""
        ...
```

**Data Models**

```python
@dataclass(frozen=True)
class CoordinationMessage:
    id: str
    type: str
    from_instance: str
    to_instance: str
    timestamp: datetime
    requires_ack: bool
    acknowledged: bool
    subject: str
    description: str
    ack_by: str | None = None
    ack_timestamp: datetime | None = None
    ack_comment: str | None = None

@dataclass
class MessageQuery:
    to_instance: str | None = None
    from_instance: str | None = None
    msg_type: str | None = None
    pending_only: bool = False
    since: datetime | None = None
    limit: int = 100

@dataclass(frozen=True)
class NotificationEvent:
    event: str
    message_id: str
    msg_type: str
    from_instance: str
    to_instance: str
    requires_ack: bool
    timestamp: datetime
```

### MCP Server Tools

The MCP server exposes these tools matching the bash script interface:

1. `coord_publish_message` - Publish coordination message
2. `coord_check_messages` - Query messages with filters
3. `coord_ack_message` - Acknowledge message
4. `coord_get_presence` - Get instance status

### Required Interfaces

- `src/core/redis_client.py` - Redis connection (existing)
- `src/core/exceptions.py` - Exception hierarchy (existing)
- `src/core/config.py` - Configuration patterns (existing)

## File Structure

```
src/
├── core/
│   └── exceptions.py          # Add coordination exceptions
└── infrastructure/
    └── coordination/
        ├── __init__.py
        ├── types.py           # Pydantic models (100 LOC)
        ├── client.py          # CoordinationClient (500+ LOC)
        ├── config.py          # CoordinationConfig
        └── mcp_server.py      # MCP server wrapper (300+ LOC)

scripts/
└── coordination/
    ├── lib/
    │   └── common.sh          # Shared helper functions
    ├── publish-message.sh     # Updated with Redis backend
    ├── check-messages.sh      # Updated with Redis backend
    ├── ack-message.sh         # Updated with Redis backend
    ├── mcp-server.sh          # MCP server launcher
    └── migrate-to-redis.sh    # Migration script

tests/
├── unit/
│   └── infrastructure/
│       └── test_coordination.py    # Unit tests (200+ LOC)
└── integration/
    └── infrastructure/
        ├── test_coordination_redis.py  # Integration tests (200+ LOC)
        └── test_mcp_coordination.py    # MCP contract tests (100 LOC)

docker/
└── infrastructure/
    └── redis.conf             # Enable AOF, tune snapshots
```

## Bash Script Adapters (Hybrid Mode)

The bash scripts detect backend availability and fallback to filesystem:

```bash
check_coordination_backend() {
    if redis-cli ping &>/dev/null && \
       python3 -c "from src.infrastructure.coordination import CoordinationClient" 2>/dev/null && \
       [[ -n "${CLAUDE_INSTANCE_ID:-}" ]]; then
        echo "redis"
    else
        echo "filesystem"
    fi
}

# In each script:
if [[ $(check_coordination_backend) == "redis" ]]; then
    # Call Python coordination library
else
    # Existing filesystem implementation
fi
```

## Phased Rollout

### Phase 1: Deploy Redis Coordination (Parallel Mode)
- Add Python coordination library
- Add MCP server
- Deploy hybrid bash scripts (Redis + filesystem fallback)
- Update redis.conf (enable AOF)
- Run migration script (import existing messages)
- **Validation**: Both systems receive same messages
- **Rollback**: Remove Python files, revert bash scripts

### Phase 2: Dual-Write Mode (Observation)
- Write to both Redis and filesystem
- Read from filesystem (existing behavior)
- Validate parity with `validate-parity.sh` script
- **Purpose**: Ensure no data loss in Redis backend

### Phase 3: Switch Read to Redis (Observation)
- Read from Redis first, fallback to filesystem
- Monitor query performance (target < 10ms)
- **Purpose**: Validate performance gains

### Phase 4: Redis-Only Mode (Cutover)
- Remove filesystem write code
- Archive `.claude/coordination/messages/` to `archive/`
- Remove `pending-acks/` directory
- **Rollback**: Restore filesystem writes if issues

## Performance Expectations

| Operation | Current (Filesystem) | New (Redis) | Improvement |
|-----------|---------------------|-------------|-------------|
| Publish message | 10-50ms | 2-5ms | 5-10x faster |
| Query inbox (100 msgs) | 50-200ms | 5-10ms | 10-20x faster |
| Acknowledge | 10-50ms | 2-5ms | 5-10x faster |
| Real-time notification | N/A (polling) | < 1ms | Instant |
| Concurrent writes | Race conditions | Atomic | Reliable |

**Scalability**:
- Current: ~100 messages before degradation
- New: 10,000+ messages, sub-10ms queries

## Error Handling

### Exception Hierarchy

```python
# Add to src/core/exceptions.py

class CoordinationError(ASDLCError):
    """Base error for coordination operations."""

class MessageNotFoundError(CoordinationError):
    """Raised when a message cannot be found."""

class PublishError(CoordinationError):
    """Raised when message publishing fails."""

class AcknowledgeError(CoordinationError):
    """Raised when acknowledgment fails."""

class PresenceError(CoordinationError):
    """Raised when presence operations fail."""
```

### Failure Modes & Fallbacks

| Failure | Impact | Fallback |
|---------|--------|----------|
| Redis unavailable | No coordination | Bash scripts use filesystem mode |
| Redis data loss | Messages lost | AOF + RDB (max 1s loss), check filesystem archive |
| Python import error | Scripts fail | Fallback to filesystem |
| MCP server crash | No real-time notifications | Auto-restart on CLI activation, polling mode |

## Security Considerations

1. **Input Validation**: Sanitize message content before storage
2. **Instance ID Validation**: Only allow known instance IDs
3. **Access Control**: Redis not exposed to host network
4. **No Secrets**: Messages should not contain credentials

## Redis Configuration Updates

**File**: `docker/infrastructure/redis.conf`

```conf
# Enable AOF for durability (currently disabled)
appendonly yes
appendfsync everysec

# Increase RDB snapshot frequency
save 60 1
save 300 10
save 3600 100
```

**Trade-off**: Up to 1 second data loss on crash (acceptable for coordination messages)

## Migration Strategy

**Script**: `scripts/coordination/migrate-to-redis.sh`

1. Parse each JSON file in `.claude/coordination/messages/`
2. Publish to Redis with original timestamp/ID/ack status
3. Preserve all fields including acknowledgments
4. Dry-run mode for validation

## Rollback Plan

**If Redis coordination fails**:
1. **Immediate** (< 5 min): `export DISABLE_REDIS_COORDINATION=true` -> automatic fallback
2. **Short-term** (< 1 day): Revert bash scripts to pure filesystem
3. **Long-term** (1 week): Investigate root cause, fix bugs, re-deploy

## Success Criteria

1. **Zero breaking changes**: Existing bash scripts work identically
2. **Performance gain**: Query latency < 10ms (vs 50-200ms filesystem)
3. **Real-time notifications**: < 1s delivery via pub/sub
4. **Atomicity**: No race conditions on concurrent publishes
5. **Durability**: Max 1s data loss on Redis crash (AOF)
6. **Scalability**: Handles 1000+ messages with < 10ms queries
7. **Reliability**: Automatic fallback to filesystem if Redis unavailable
8. **All tests passing**: Unit, integration, bash, MCP contract tests

## Risks

1. **Redis Dependency**: System relies on Redis availability. Mitigation: Filesystem fallback.
2. **Migration Data Loss**: Old messages might not import correctly. Mitigation: Dry-run mode, validation.
3. **MCP Complexity**: MCP server adds operational overhead. Mitigation: Simple stdio server, auto-restart.

## Open Questions

1. Should message TTL be configurable per message type?
2. Should we add message priority for urgent reviews?
3. Should presence tracking be optional?
