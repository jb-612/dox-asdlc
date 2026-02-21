# Heartbeat and Presence Tracking

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
