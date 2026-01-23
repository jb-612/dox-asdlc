# P01-F05: A2A Push Notifications for CLI Coordination

## Overview

Implement Agent-to-Agent (A2A) push notifications between Claude CLI instances using Redis notification queues. This enables real-time awareness of incoming coordination messages without requiring always-on daemon processes.

## Problem Statement

Current CLI coordination is polling-based:
- CLI instances must manually run `check-messages.sh` to see new messages
- No real-time awareness of incoming coordination messages
- Easy to miss time-sensitive review requests or contract changes

## Claude SDK Research Findings

**Question**: Does Claude SDK support A2A, push notifications, or pub/sub natively?

**Answer**: No. Claude Agent SDK provides:
- **Subagents**: Hierarchical agent orchestration (parent spawns children)
- **Hooks**: Event-driven automation triggers
- **Sessions**: Multi-turn conversation coordination
- **MCP**: Tool and capability sharing between agents

**What it does NOT provide**:
- Native A2A messaging between peer agents
- Built-in pub/sub or push notification system
- Cross-instance coordination primitives

**Conclusion**: Our Redis-based coordination system already exceeds native SDK capabilities. The existing `subscribe_notifications()` infrastructure is the right foundation. This plan extends it with offline queuing for ephemeral CLI instances.

## Solution: Hybrid Notification Queue

Since CLI instances are ephemeral (start, work, end), we use a **notification queue** approach:

1. **When publishing**: Queue notifications for offline instances
2. **At session start**: Automatically check and display pending notifications
3. **Optional real-time**: Provide watch script for long sessions

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Redis                                        │
├─────────────────────────────────────────────────────────────────┤
│  coord:notifications:{instance_id}  [LIST - offline queue]      │
│  coord:notify:{instance_id}         [PUBSUB - real-time]        │
│  coord:presence                     [HASH - online status]       │
└─────────────────────────────────────────────────────────────────┘
           │                    │                    │
           ▼                    ▼                    ▼
   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
   │ Backend CLI  │    │ Frontend CLI │    │ Orchestrator │
   │              │    │              │    │     CLI      │
   │ At startup:  │    │ At startup:  │    │ At startup:  │
   │ pop_notifs() │    │ pop_notifs() │    │ pop_notifs() │
   └──────────────┘    └──────────────┘    └──────────────┘
```

## Data Model

### Notification Queue (NEW)

```
Key: coord:notifications:{instance_id}
Type: LIST
Operations: LPUSH (add), LRANGE+DELETE (pop all)
TTL: 30 days (matches message TTL)
Content: JSON NotificationEvent
```

### NotificationEvent Structure

```json
{
  "event": "message_published",
  "message_id": "msg-abc12345",
  "type": "READY_FOR_REVIEW",
  "from": "backend",
  "to": "orchestrator",
  "requires_ack": true,
  "timestamp": "2026-01-23T12:00:00Z"
}
```

## Component Changes

### 1. types.py

Add `from_json()` class method to `NotificationEvent`:

```python
@classmethod
def from_json(cls, json_str: str) -> NotificationEvent:
    """Deserialize from JSON string stored in Redis queue."""
```

### 2. config.py

Add notification queue key pattern:

```python
KEY_NOTIFICATION_QUEUE: ClassVar[str] = "{prefix}:notifications:{instance}"

def notification_queue_key(self, instance_id: str) -> str:
    """Get Redis key for instance notification queue."""
```

### 3. client.py

Add three methods:

```python
async def queue_notification(
    self, instance_id: str, notification: NotificationEvent
) -> bool:
    """Queue notification for offline instance using LPUSH."""

async def pop_notifications(
    self, instance_id: str, limit: int = 100
) -> list[NotificationEvent]:
    """Pop and return queued notifications using LRANGE+DELETE."""

async def _queue_if_offline(
    self, instance_id: str, notification: NotificationEvent
) -> None:
    """Check presence and queue if instance is offline."""
```

Modify `publish_message()`:
- After pipeline execution, call `_queue_if_offline()` for non-broadcast messages

### 4. mcp_server.py

Add new MCP tool:

```python
async def coord_get_notifications(self, limit: int = 100) -> dict[str, Any]:
    """Get and clear pending notifications for current instance."""
```

### 5. .mcp.json

Register coordination MCP server:

```json
{
  "coordination": {
    "command": "python",
    "args": ["-m", "src.infrastructure.coordination.mcp_server"],
    "env": { "PYTHONPATH": "." }
  }
}
```

### 6. scripts/coordination/lib/common.sh

Add Python wrapper:

```bash
call_python_pop_notifications() {
    # Python wrapper for pop_notifications()
}
```

### 7. scripts/cli-identity.sh

Add to instance activation:

```bash
# After setting identity, check notifications
check_pending_notifications
```

### 8. scripts/coordination/watch-notifications.sh (NEW)

Optional real-time watching script using Redis SUBSCRIBE.

## User Experience

### At Session Start

```
$ source scripts/cli-identity.sh orchestrator
Git identity: (using Claude default)
Instance ID: orchestrator (master agent)
...

=== NOTIFICATIONS (2 pending) ===
  [READY_FOR_REVIEW] backend -> orchestrator: msg-abc123
  [CONTRACT_CHANGE_PROPOSED] frontend -> orchestrator: msg-def456

Run './scripts/coordination/check-messages.sh --pending' for details.
```

### Optional Real-time Watching

```
$ ./scripts/coordination/watch-notifications.sh
Watching for notifications on coord:notify:orchestrator...

=== NEW NOTIFICATION ===
  Type: READY_FOR_REVIEW
  From: backend
  Message ID: msg-xyz789
```

## Dependencies

- P01-F04: CLI Coordination Redis (COMPLETED) - provides base coordination infrastructure
- Redis running and accessible

## Testing Strategy

1. **Unit tests**: Mock Redis, test serialization/deserialization
2. **Integration tests**: Real Redis, test queue/pop cycle
3. **E2E test**: Multi-terminal test with offline queuing

## Rollback Strategy

All changes are additive. To rollback:
1. Remove coordination entry from `.mcp.json`
2. Revert `publish_message()` offline queuing
3. Remove notification check from `cli-identity.sh`

## Security Considerations

- Notifications only contain message metadata, not full content
- TTL ensures queues don't grow unbounded
- Presence check prevents unnecessary queuing for online instances
