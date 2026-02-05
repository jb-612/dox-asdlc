---
description: Multi-session coordination protocol for agent presence and messaging
---

# Coordination Protocol

This document defines the coordination protocol for multi-session agent communication, including heartbeats, presence tracking, and message handling.

## Overview

The coordination system enables multiple CLI sessions to work together on a project. Each session represents a **bounded context** (feature/epic like `p11-guardrails`, `p04-review-swarm`) and communicates via Redis-backed coordination messages.

**Key Concepts:**
- **Session Context**: Identified by CLAUDE_INSTANCE_ID (e.g., `p11-guardrails`)
- **PM CLI**: Main session uses identity `pm`, runs in main repository
- **Feature Sessions**: Run in worktrees with feature-specific identities

## Session Lifecycle

### Session Start

When a CLI session starts:

1. **Publish SESSION_START message:**
   ```json
   {
     "type": "SESSION_START",
     "from": "<agent-id>",
     "timestamp": "<ISO-8601>",
     "metadata": {
       "git_email": "<configured-email>",
       "cwd": "<working-directory>"
     }
   }
   ```

2. **Begin heartbeat loop** - Start sending heartbeats every 60 seconds

3. **Check pending messages** - Process any messages sent while offline

### Session End

When a CLI session ends gracefully:

1. **Publish SESSION_END message:**
   ```json
   {
     "type": "SESSION_END",
     "from": "<agent-id>",
     "timestamp": "<ISO-8601>",
     "reason": "user_exit | task_complete | error"
   }
   ```

2. **Stop heartbeat loop** - No more heartbeats will be sent

3. **Presence record expires** - TTL will cause automatic cleanup

## Heartbeat Protocol

### Frequency and TTL

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Heartbeat frequency | 60 seconds | Balances freshness with overhead |
| Presence TTL | 5 minutes (300s) | Allows for brief network issues |
| Stale threshold | 5 minutes | Matches TTL for consistency |

### Heartbeat Message

Heartbeats are NOT coordination messages. They update presence records directly:

```
Redis Key: asdlc:presence:<agent-id>
Value: {
  "agent_id": "<agent-id>",
  "last_heartbeat": "<ISO-8601>",
  "status": "active",
  "session_id": "<unique-session-id>"
}
TTL: 300 seconds (auto-expires)
```

### Heartbeat Behavior

1. **On each heartbeat:**
   - Update presence record with current timestamp
   - Reset TTL to 300 seconds
   - Record includes session_id for disambiguation

2. **If heartbeat fails:**
   - Log warning but continue operation
   - Retry on next interval
   - After 3 consecutive failures, consider network issues

3. **If session crashes:**
   - No SESSION_END message sent
   - Presence record expires after TTL
   - Other agents detect via stale presence

## Presence Tracking

### Presence States

| State | Condition | Meaning |
|-------|-----------|---------|
| **Active** | last_heartbeat < 5 minutes ago | Agent is responsive |
| **Stale** | last_heartbeat 5-15 minutes ago | Agent may be unresponsive |
| **Offline** | last_heartbeat > 15 minutes OR no record | Agent is not running |

### Querying Presence

Use `coord_get_presence` to get all session presence records:

```json
{
  "agents": [
    {
      "agent_id": "p11-guardrails",
      "status": "active",
      "last_heartbeat": "2025-01-21T10:30:00Z",
      "session_id": "abc123"
    },
    {
      "agent_id": "p04-review-swarm",
      "status": "stale",
      "last_heartbeat": "2025-01-21T10:20:00Z",
      "session_id": "def456"
    }
  ]
}
```

### Stale Detection

A session is considered stale when:
- Last heartbeat is more than 5 minutes old
- The session may have crashed without sending SESSION_END
- Messages sent to this session may not be processed promptly

**PM CLI handling of stale sessions:**

```
Session p11-guardrails is stale (last seen 8 minutes ago).

Options:
 A) Send task anyway (session may pick it up later)
 B) Wait for session to come online
 C) Run the work in this session
```

## Redis Key Structure

### Presence Keys

```
asdlc:presence:pm              -> Presence record for PM CLI (main repo)
asdlc:presence:p11-guardrails  -> Presence record for P11 feature session
asdlc:presence:p04-review-swarm -> Presence record for P04 feature session
```

### Message Keys

```
asdlc:messages:inbox:<agent-id>    -> List of pending messages
asdlc:messages:sent:<message-id>   -> Individual message details
asdlc:messages:acked:<agent-id>    -> Set of acknowledged message IDs
```

### Session Keys

```
asdlc:session:<session-id>         -> Session metadata
asdlc:session:history:<agent-id>   -> Recent session history
```

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
  "agents": [
    {
      "agent_id": "backend",
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

## Error Handling

### Redis Connection Lost

If Redis connection is lost:
1. Log error but do not crash
2. Continue operating in degraded mode
3. Retry connection every 30 seconds
4. Warn user that coordination is unavailable

### Message Delivery Failure

If message cannot be delivered:
1. Return error to caller
2. Do not retry automatically (caller decides)
3. Include error details in response

### Presence Update Failure

If presence cannot be updated:
1. Log warning
2. Continue operating
3. Other agents may see this agent as stale
4. Retry on next heartbeat interval

## Troubleshooting

### Agent appears stale but is running

**Symptoms:** Agent is active but shows as stale to others

**Possible causes:**
1. Heartbeat loop not running
2. Redis connection issues
3. Clock skew between machines

**Resolution:**
1. Check Redis connectivity: `redis-cli ping`
2. Verify heartbeat is being sent: Check MCP server logs
3. Manually send heartbeat: `coord_send_heartbeat`

### Messages not being received

**Symptoms:** Published messages don't appear in target inbox

**Possible causes:**
1. Wrong agent ID in `to` field
2. Redis connection issues
3. Message already acknowledged

**Resolution:**
1. Verify agent IDs match exactly (case-sensitive)
2. Check Redis connectivity
3. Check acked message set for the message ID

### SESSION_START not received

**Symptoms:** Other agents don't see session start

**Possible causes:**
1. MCP server didn't publish on startup
2. Message routing issue
3. Target agents not checking messages

**Resolution:**
1. Check MCP server startup logs
2. Manually check Redis for the message
3. Ensure target agents call `coord_check_messages`

### Duplicate sessions for same context

**Symptoms:** Multiple presence records or conflicting session IDs

**Possible causes:**
1. Previous session didn't end cleanly
2. Multiple CLI windows for same context
3. TTL not expiring old records

**Resolution:**
1. Check for multiple CLI windows
2. Wait for TTL to expire old sessions
3. Manually clean up: `redis-cli DEL asdlc:presence:<context>`

## Integration with Workflow

### At Workflow Start

1. PM CLI checks presence of all sessions
2. Reports which feature contexts are active
3. Advises user if expected sessions are missing

### During Delegation

1. PM CLI checks target session presence
2. Warns if session is stale
3. Offers alternatives if session is offline

### After Task Completion

1. Session publishes STATUS_UPDATE
2. PM CLI receives update on next message check
3. Workflow continues based on outcome

## Security Considerations

### Message Authentication

Messages include `from` field derived from git config or environment variable. This is not cryptographically verified but provides accountability.

### Message Confidentiality

Messages are stored in Redis in plaintext. Do not include secrets or sensitive data in message bodies.

### Access Control

All agents can read all messages addressed to them. There is no fine-grained access control at the message level.
