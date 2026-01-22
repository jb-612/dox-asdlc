# P02-F01: Redis Event Streams and Consumer Groups

## Technical Design

### Overview

This feature implements the complete event streaming infrastructure for the aSDLC system. It extends the existing foundation in `src/infrastructure/redis_streams.py` with event consumption, idempotent processing, tenant awareness, and crash recovery.

### Architecture Reference

From `docs/System_Design.md` Section 6:
- Stream: `asdlc:events` (or `tenant:{tenant_id}:asdlc:events` for multi-tenant)
- Consumer groups per handler class (discovery, design, development, validation, deployment, hitl)
- Events include: `session_id`, `epic_id`, `task_id`, `event_type`, `git_sha`, `artifact_paths`, `mode`
- Idempotent: never apply same patch twice, never advance gate twice for same SHA

### Dependencies

**Internal:**
- P01-F01: Infrastructure (Docker, Redis) ✅
- P06-F05: Multi-tenancy (TenantContext) ✅

**External:**
- `redis.asyncio` (async Redis client)
- `pydantic` (event validation)

### Components

#### 1. Event Models (`src/core/events.py`)

```python
class EventType(str, Enum):
    # Session events
    SESSION_STARTED = "session_started"
    SESSION_COMPLETED = "session_completed"

    # Task lifecycle
    TASK_CREATED = "task_created"
    TASK_DISPATCHED = "task_dispatched"
    TASK_COMPLETED = "task_completed"
    TASK_FAILED = "task_failed"

    # Gate events
    GATE_REQUESTED = "gate_requested"
    GATE_APPROVED = "gate_approved"
    GATE_REJECTED = "gate_rejected"

    # Agent events
    AGENT_STARTED = "agent_started"
    AGENT_COMPLETED = "agent_completed"
    AGENT_ERROR = "agent_error"

    # Patch events
    PATCH_CREATED = "patch_created"
    PATCH_APPLIED = "patch_applied"
    PATCH_REJECTED = "patch_rejected"

class ASDLCEvent(BaseModel):
    """Base event model with validation."""
    event_id: str | None = None  # Assigned by Redis
    event_type: EventType
    session_id: str
    epic_id: str | None = None
    task_id: str | None = None
    git_sha: str | None = None
    artifact_paths: list[str] = []
    mode: str = "normal"  # "normal" or "rlm"
    tenant_id: str | None = None
    timestamp: datetime
    idempotency_key: str | None = None  # For deduplication
    metadata: dict[str, Any] = {}
```

#### 2. Stream Publisher (`src/infrastructure/redis_streams.py`)

Extend existing `publish_event()` to:
- Accept `ASDLCEvent` model
- Include tenant context automatically
- Generate idempotency key if not provided
- Validate event before publishing

```python
async def publish_event(
    event: ASDLCEvent,
    client: redis.Redis | None = None,
) -> str:
    """Publish validated event with tenant context."""
```

#### 3. Event Consumer (`src/infrastructure/consumer_group.py`)

```python
class EventConsumer:
    """Consumer for processing events from a consumer group."""

    def __init__(
        self,
        group_name: str,
        consumer_name: str,
        handler: EventHandler,
        client: redis.Redis | None = None,
    ):
        ...

    async def start(self) -> None:
        """Start consuming events in a loop."""

    async def stop(self) -> None:
        """Gracefully stop the consumer."""

    async def process_pending(self) -> int:
        """Process pending events (recovery on restart)."""

    async def claim_stale_messages(
        self,
        min_idle_time_ms: int = 60000,
    ) -> list[ASDLCEvent]:
        """Claim messages from dead consumers."""
```

#### 4. Idempotent Processing

```python
class IdempotencyTracker:
    """Track processed events to prevent duplicate processing."""

    PROCESSED_KEY = "asdlc:processed:{idempotency_key}"
    TTL_SECONDS = 86400 * 7  # 7 days

    async def is_processed(self, idempotency_key: str) -> bool:
        """Check if event was already processed."""

    async def mark_processed(
        self,
        idempotency_key: str,
        event_id: str,
    ) -> None:
        """Mark event as processed."""
```

#### 5. Handler Protocol

```python
class EventHandler(Protocol):
    """Protocol for event handlers."""

    async def handle(self, event: ASDLCEvent) -> HandlerResult:
        """Process the event. Returns result for ack/nack decision."""

    def can_handle(self, event_type: EventType) -> bool:
        """Check if this handler processes the given event type."""
```

### Stream Key Strategy

**Single-tenant mode:**
```
asdlc:events
asdlc:processed:{idempotency_key}
```

**Multi-tenant mode:**
```
tenant:{tenant_id}:asdlc:events
tenant:{tenant_id}:asdlc:processed:{idempotency_key}
```

### Consumer Group Configuration

From `src/core/config.py`:
```python
consumer_groups: tuple[str, ...] = (
    "discovery-handlers",
    "design-handlers",
    "development-handlers",
    "validation-handlers",
    "deployment-handlers",
    "hitl-handlers",
)
```

### Recovery Protocol

On orchestrator restart (from System_Design.md Section 8.1):

1. Inspect pending events via `XPENDING`
2. For each pending event:
   - Check if idempotency key already processed
   - If yes: acknowledge and skip
   - If no: re-dispatch to appropriate handler
3. Claim stale messages from dead consumers via `XCLAIM`
4. Resume normal consumption

### Error Handling

- **Retryable errors**: Nack message, it will be redelivered
- **Permanent failures**: Ack message, log to dead letter set
- **Handler crashes**: Message remains pending, claimed on recovery

### Interface Contracts

**EventConsumer.process_pending() returns:**
```python
@dataclass
class RecoveryResult:
    processed: int
    skipped: int  # Already processed (idempotent)
    failed: int
    claimed: int  # From dead consumers
```

**HandlerResult:**
```python
@dataclass
class HandlerResult:
    success: bool
    should_retry: bool = False
    error_message: str | None = None
    artifact_paths: list[str] = field(default_factory=list)
```

### Testing Strategy

1. **Unit tests**: Event models, serialization, idempotency tracker
2. **Integration tests**: Full consumer flow with real Redis
3. **Recovery tests**: Simulate crash, verify pending events processed

### Files to Create/Modify

| File | Action |
|------|--------|
| `src/core/events.py` | Create |
| `src/infrastructure/redis_streams.py` | Extend |
| `src/infrastructure/consumer_group.py` | Create |
| `tests/unit/test_events.py` | Create |
| `tests/unit/test_redis_streams.py` | Extend |
| `tests/unit/test_consumer_group.py` | Create |
| `tests/integration/test_stream_processing.py` | Create |
