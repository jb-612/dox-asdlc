# GitHub Issue: BUG: Slack /idea-new command does not persist ideas to Brainflare Hub

**Status:** CLOSED (fixed in commit e14809a)
**Label:** bug
**Created:** 2026-02-06

## Summary

The `/idea-new` Slack slash command accepts ideas but they never appear in the Brainflare Hub page. The web-to-Slack direction works, but Slack-to-web does not.

## Root Cause

The `RedisIdeasService` in `src/infrastructure/slack_bridge/bridge.py` writes ideas to a Redis Stream (`ideas_stream`), but there is **no consumer** that reads from that stream and persists the ideas to Elasticsearch (the `brainflare_ideas` index).

The Brainflare Hub UI and API (`/api/brainflare/ideas`) read from Elasticsearch via `IdeasService`, so Slack-created ideas are effectively lost in the Redis stream.

**Broken flow:**
```
Slack /idea-new → IdeaHandler → RedisIdeasService → Redis Stream "ideas_stream" → ??? (no consumer)
```

**Working flow (web UI):**
```
Brainflare UI → POST /api/brainflare/ideas → IdeasService → Elasticsearch
```

## Proposed Fix

Replace `RedisIdeasService` with an HTTP-based adapter (`HttpIdeasService`) that calls the orchestrator's REST API (`POST /api/brainflare/ideas`). This ensures Slack-created ideas follow the same data path as web-created ideas.

**Fixed flow:**
```
Slack /idea-new → IdeaHandler → HttpIdeasService → POST /api/brainflare/ideas → IdeasService → Elasticsearch
```

## Files Affected

- `src/infrastructure/slack_bridge/bridge.py` - Replace `RedisIdeasService` with `HttpIdeasService`
- `src/infrastructure/slack_bridge/idea_handler.py` - Update service dependency (may be minimal)
- `tests/unit/infrastructure/slack_bridge/test_bridge.py` - Update tests
- `tests/unit/infrastructure/slack_bridge/test_idea_handler.py` - Update tests

## Acceptance Criteria

- [ ] `/idea-new <text>` in Slack creates an idea visible in Brainflare Hub
- [ ] Ideas created via Slack have proper `source_ref:slack:command:*` labels
- [ ] Word count validation (144 words) is enforced
- [ ] Existing web UI idea creation still works
- [ ] All unit tests pass
