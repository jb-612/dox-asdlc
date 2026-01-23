# CLI Coordination

Inter-instance coordination for parallel Claude CLI agents using Redis.

## Backend: Redis (Required)

All coordination requires a running Redis instance. The filesystem-based coordination has been removed.

## Using Coordination

### MCP Tools (Preferred)

Use these tools directly in Claude Code conversations:

| Tool | Description |
|------|-------------|
| `coord_publish_message` | Publish a message to another instance |
| `coord_check_messages` | Query messages with filters |
| `coord_ack_message` | Acknowledge a message |
| `coord_get_presence` | Check instance presence |
| `coord_get_notifications` | Get pending notifications |

### Bash Scripts

```bash
# Publish a message
./scripts/coordination/publish-message.sh <type> <subject> <description> [--to <instance>]

# Check messages
./scripts/coordination/check-messages.sh [--pending] [--all] [--from <instance>]

# Acknowledge a message
./scripts/coordination/ack-message.sh <message-id> [--comment <comment>]
```

**Note:** Scripts require Redis to be running. They will fail fast if Redis is unavailable.

## Redis Keys

Coordination data uses the `coord:` prefix (configurable via `COORD_KEY_PREFIX`):

| Key Pattern | Description |
|-------------|-------------|
| `coord:msg:{id}` | Individual message data |
| `coord:timeline` | Sorted set of all messages by timestamp |
| `coord:inbox:{instance}` | Messages addressed to an instance |
| `coord:pending` | Set of unacknowledged message IDs |
| `coord:presence` | Hash of instance presence info |
| `coord:notifications:{instance}` | Notification queue for offline instances |

## Message Types

| Type | Direction | Purpose |
|------|-----------|---------|
| `READY_FOR_REVIEW` | Feature → Orchestrator | Request branch review |
| `REVIEW_COMPLETE` | Orchestrator → Feature | Review passed, merged |
| `REVIEW_FAILED` | Orchestrator → Feature | Review failed |
| `CONTRACT_CHANGE_PROPOSED` | Feature → Orchestrator | Propose API change |
| `CONTRACT_APPROVED` | Orchestrator → All | Contract change approved |
| `META_CHANGE_REQUEST` | Feature → Orchestrator | Request rule/doc change |
| `GENERAL` | Any → Any | General coordination |
| `NOTIFICATION` | Any → Any | Push notification |

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | `localhost` | Redis server hostname |
| `REDIS_PORT` | `6379` | Redis server port |
| `REDIS_DB` | `0` | Redis database number |
| `COORD_KEY_PREFIX` | `coord` | Prefix for all coordination keys |
| `CLAUDE_INSTANCE_ID` | (required) | Instance identifier |

## Python Module

```python
from src.infrastructure.coordination import get_coordination_client

async def example():
    client = await get_coordination_client(instance_id="backend")
    await client.publish_message(
        msg_type=MessageType.READY_FOR_REVIEW,
        subject="feature-branch",
        description="Ready for review",
        to_instance="orchestrator",
    )
```
