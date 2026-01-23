# P01-F05: A2A Push Notifications - User Stories

## US-01: Notification Display at Session Start

**As a** CLI instance operator  
**I want** to see pending notifications when I start a session  
**So that** I'm immediately aware of messages sent while I was offline

### Acceptance Criteria

1. When running `source scripts/cli-identity.sh <instance>`:
   - System checks for queued notifications
   - Displays count of pending notifications
   - Shows brief summary of each notification (type, from, message_id)
   - Provides hint to check full message details

2. Display format:
   ```
   === NOTIFICATIONS (N pending) ===
     [TYPE] from -> to: msg-id
   ```

3. If no notifications, no extra output is shown

### Test Scenarios

- [ ] Start session with 0 notifications - no notification section shown
- [ ] Start session with 1 notification - shows single notification
- [ ] Start session with 5 notifications - shows all 5 notifications
- [ ] Start session when Redis unavailable - graceful degradation with warning

---

## US-02: Automatic Offline Queuing

**As a** CLI instance sending messages  
**I want** notifications to be queued when the target is offline  
**So that** messages are never missed even when recipients aren't running

### Acceptance Criteria

1. When `publish_message()` is called:
   - System checks if target instance is online (via presence)
   - If offline, queues NotificationEvent to target's queue
   - Queuing is best-effort (failures don't break publish)

2. Queue characteristics:
   - Uses Redis LIST at `coord:notifications:{instance_id}`
   - TTL of 30 days (matches message TTL)
   - FIFO order (newest first when displayed)

3. Broadcast messages (`to_instance="all"`) skip offline queuing

### Test Scenarios

- [ ] Publish to offline instance - notification queued
- [ ] Publish to online instance - no queuing (real-time pub/sub only)
- [ ] Publish broadcast - no queuing regardless of presence
- [ ] Queue failure - publish still succeeds with warning log

---

## US-03: MCP Tool for Notifications

**As a** Claude Code instance  
**I want** an MCP tool to retrieve my notifications  
**So that** I can programmatically check for pending messages

### Acceptance Criteria

1. Tool `coord_get_notifications`:
   - Input: `limit` (optional, default 100)
   - Output: `{ success, count, notifications[] }`
   - Retrieves AND clears the queue (atomic)

2. Each notification includes:
   - `event`: "message_published"
   - `message_id`: ID of the published message
   - `type`: Message type (READY_FOR_REVIEW, etc.)
   - `from`: Sender instance
   - `to`: Target instance
   - `requires_ack`: Whether acknowledgment needed
   - `timestamp`: When message was published

### Test Scenarios

- [ ] Call with empty queue - returns empty list
- [ ] Call with notifications - returns all and clears queue
- [ ] Call twice - second call returns empty (queue was cleared)
- [ ] Call with limit=2 when 5 exist - returns 2, clears those 2

---

## US-04: Real-time Notification Watching (Optional)

**As a** CLI operator running a long session  
**I want** to optionally watch for real-time notifications  
**So that** I can be alerted immediately when messages arrive

### Acceptance Criteria

1. Script `watch-notifications.sh`:
   - Subscribes to instance's pub/sub channel
   - Displays notifications as they arrive
   - Can be interrupted with Ctrl+C

2. Display format:
   ```
   === NEW NOTIFICATION ===
     Type: READY_FOR_REVIEW
     From: backend
     Message ID: msg-xyz789
   ```

### Test Scenarios

- [ ] Start watching, send message from another instance - notification displayed
- [ ] Ctrl+C - script exits cleanly
- [ ] Redis disconnection - reconnect or exit with error

---

## US-05: Coordination MCP Server Registration

**As a** project maintainer  
**I want** the coordination MCP server registered in .mcp.json  
**So that** Claude Code can use coordination tools natively

### Acceptance Criteria

1. `.mcp.json` includes coordination server:
   ```json
   "coordination": {
     "command": "python",
     "args": ["-m", "src.infrastructure.coordination.mcp_server"],
     "env": { "PYTHONPATH": "." }
   }
   ```

2. Server exposes tools:
   - coord_publish_message
   - coord_check_messages
   - coord_ack_message
   - coord_get_presence
   - coord_get_notifications (NEW)

### Test Scenarios

- [ ] MCP server starts without errors
- [ ] All tools are listed in tools/list response
- [ ] coord_get_notifications tool works correctly

---

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Unit tests pass (80%+ coverage for new code)
- [ ] Integration tests pass with real Redis
- [ ] Documentation updated (Rule 12 in parallel-coordination.md)
- [ ] No linter errors
- [ ] Code reviewed
