# CLI Coordination

This directory previously contained filesystem-based coordination messages for parallel Claude CLI instances.

## Current Backend: Redis

As of January 2026, coordination has been migrated to Redis. The filesystem directories are kept for backward compatibility but are no longer the primary storage.

### Using Coordination

**MCP Tools (Preferred)**:
- `coord_publish_message` - Publish a message
- `coord_check_messages` - Query messages
- `coord_ack_message` - Acknowledge a message
- `coord_get_presence` - Check instance presence

**Bash Scripts (Auto-detect backend)**:
```bash
# These scripts automatically use Redis when available
./scripts/coordination/publish-message.sh <type> <subject> <description>
./scripts/coordination/check-messages.sh
./scripts/coordination/ack-message.sh <message-id>
```

### Redis Keys

Coordination data is stored under the `asdlc:coord:` prefix:
- `asdlc:coord:messages` - Message stream
- `asdlc:coord:pending:<instance>` - Pending acks per instance
- `asdlc:coord:presence:<instance>` - Instance presence
- `asdlc:coord:notifications:<instance>` - Push notifications

### Legacy Directories

- `messages/` - Previously stored message JSON files
- `pending-acks/` - Previously stored pending acknowledgments

These directories are preserved for fallback when Redis is unavailable.
