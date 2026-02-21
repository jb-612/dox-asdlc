---
description: Multi-session coordination protocol for agent presence and messaging
globs:
  - src/infrastructure/mcp/**
  - scripts/coordination/**
  - .claude/hooks/**
---

# Coordination Protocol

This document defines the coordination protocol for multi-session agent communication, including heartbeats, presence tracking, and message handling.

The coordination system enables multiple CLI sessions to work together on a project. Each session represents a **bounded context** (feature/epic like `p11-guardrails`, `p04-review-swarm`) and communicates via Redis-backed coordination messages.

**Key Concepts:**
- **Session Context**: Identified by CLAUDE_INSTANCE_ID (e.g., `p11-guardrails`)
- **PM CLI**: Main session uses identity `pm`, runs in main repository
- **Feature Sessions**: Run in worktrees with feature-specific identities

## Chapters

1. [Overview and Session Lifecycle](./01-overview.md) -- Session start/end, Redis key structure
2. [Heartbeat and Presence](./02-heartbeat.md) -- Heartbeat protocol, presence tracking, stale detection
3. [Message Types and MCP Tools](./03-messages.md) -- SESSION_START, SESSION_END, HEARTBEAT message specs, MCP tool reference
4. [Error Handling and Troubleshooting](./04-troubleshooting.md) -- Redis errors, troubleshooting, workflow integration, security
