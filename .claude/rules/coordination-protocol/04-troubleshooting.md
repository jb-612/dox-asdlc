# Error Handling, Troubleshooting, and Integration

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
