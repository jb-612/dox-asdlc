# Message Types and MCP Tool Reference

## Message Types for Multi-Session

### SESSION_START

Published when a CLI session begins. This message is published by the startup hook (`.claude/hooks/startup.sh`) after identity validation and presence registration.

| Field | Type | Description |
|-------|------|-------------|
| type | string | `SESSION_START` |
| from | string | Session context identifier |
| to | string | Always `all` (broadcast) |
| timestamp | string | ISO-8601 timestamp |
| requires_ack | boolean | Always `false` |
| payload.subject | string | `Session started: <context>` |
| payload.description | string | Includes CWD, session_id |

**Published by:** `.claude/hooks/startup.sh`

**Example:**
```json
{
  "id": "msg-1738756800-12345",
  "type": "SESSION_START",
  "from": "p11-guardrails",
  "to": "all",
  "timestamp": "2026-02-05T10:00:00Z",
  "requires_ack": false,
  "payload": {
    "subject": "Session started: p11-guardrails",
    "description": "Session started. CWD: /path/to/.worktrees/p11-guardrails, Session ID: session-1738756800-12345"
  }
}
```

### SESSION_END

Published when a CLI session ends gracefully. This message is published by the teardown script (`scripts/worktree/teardown-worktree.sh`) before removing the worktree.

| Field | Type | Description |
|-------|------|-------------|
| type | string | `SESSION_END` |
| from | string | Session context identifier |
| to | string | Always `all` (broadcast) |
| timestamp | string | ISO-8601 timestamp |
| requires_ack | boolean | Always `false` |
| payload.subject | string | `Session ended: <context>` |
| payload.description | string | Includes reason for termination |

**Published by:** `scripts/worktree/teardown-worktree.sh`

**Reason values:**
- `user_exit` - User requested teardown (--abandon or interactive cancel)
- `task_complete` - Changes merged successfully (--merge)
- `error` - Session ended due to an error

**Example:**
```json
{
  "id": "msg-1738760400-67890",
  "type": "SESSION_END",
  "from": "p11-guardrails",
  "to": "all",
  "timestamp": "2026-02-05T11:00:00Z",
  "requires_ack": false,
  "payload": {
    "subject": "Session ended: p11-guardrails",
    "description": "Session ended. Reason: task_complete"
  }
}
```

### HEARTBEAT

Note: Heartbeats update presence records directly; they are not coordination messages. This is documented here for completeness.

| Field | Type | Description |
|-------|------|-------------|
| agent_id | string | Agent identifier |
| timestamp | string | ISO-8601 timestamp |
| status | string | Always `active` |
| session_id | string | Unique session identifier |

## MCP Tool Reference

### coord_check_messages

Check for pending coordination messages.

**Parameters:** None

**Returns:**
```json
{
  "pending": [
    {
      "id": "msg-123",
      "type": "BLOCKING_ISSUE",
      "from": "frontend",
      "timestamp": "2025-01-21T10:30:00Z",
      "subject": "API endpoint missing",
      "body": "..."
    }
  ],
  "count": 1
}
```

### coord_ack_message

Acknowledge a processed message.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| message_id | string | Yes | ID of message to acknowledge |

**Returns:**
```json
{
  "success": true,
  "acknowledged": "msg-123"
}
```

### coord_publish_message

Publish a coordination message.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| type | string | Yes | Message type |
| to | array | Yes | Target agent IDs |
| subject | string | Yes | Brief subject line |
| body | string | No | Detailed message body |

**Returns:**
```json
{
  "success": true,
  "message_id": "msg-456"
}
```

### coord_get_presence

Get presence status of all agents.

**Parameters:** None

**Returns:**
```json
{
  "instances": [
    {
      "instance_id": "p11-guardrails",
      "status": "active",
      "last_heartbeat": "2025-01-21T10:30:00Z"
    }
  ]
}
```

### coord_send_heartbeat

Send a heartbeat to update presence. Called automatically by the MCP server.

**Parameters:** None

**Returns:**
```json
{
  "success": true,
  "timestamp": "2025-01-21T10:31:00Z"
}
```
