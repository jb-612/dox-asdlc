---
description: Multi-session coordination protocol for agent presence and messaging
globs:
  - src/infrastructure/mcp/**
  - scripts/coordination/**
  - .claude/hooks/**
---

# Coordination Protocol

Multi-session coordination via Redis-backed messages. Each session = a bounded context (e.g., `p11-guardrails`) identified by `CLAUDE_INSTANCE_ID`.

## Session Lifecycle

- **Start**: Publish `SESSION_START`, begin heartbeat (60s interval), check pending messages
- **End**: Publish `SESSION_END` with reason (`user_exit` | `task_complete` | `error`), presence expires via TTL

## Presence States

| State | Condition | Action |
|-------|-----------|--------|
| **Active** | last_heartbeat < 5 min | Proceed with delegation |
| **Stale** | 5-15 min | Warn user, offer options |
| **Offline** | > 15 min or no record | Treat as unavailable |

Heartbeats update Redis presence keys directly (not coordination messages). TTL: 300s.

## MCP Tool Reference

| Tool | Purpose | Key Params |
|------|---------|------------|
| `coord_check_messages` | Get pending messages | None |
| `coord_ack_message` | Acknowledge a message | `message_id` |
| `coord_publish_message` | Publish a message | `type`, `to`, `subject`, `body` |
| `coord_get_presence` | Get all agent presence | None |
| `coord_register_presence` | Register session as active | `role` |
| `coord_heartbeat` | Update heartbeat timestamp | `role` |

## Troubleshooting

**Agent appears stale but is running**: Check Redis (`redis-cli ping`), verify heartbeat in MCP logs, manually call `coord_heartbeat`.

**Messages not received**: Verify agent IDs match (case-sensitive), check Redis connectivity, check if already acknowledged.

**Redis connection lost**: System continues in degraded mode, retries every 30s. Messages are stored plaintext — do not include secrets.
