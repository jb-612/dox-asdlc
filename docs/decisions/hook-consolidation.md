# ADR: Hook Consolidation

**Status:** Accepted
**Date:** 2026-02-10
**Decision Makers:** Orchestrator

## Context

The project originally used two hook scripts for agent identity enforcement:

- `scripts/hooks/tool-validator.py` -- A PreToolUse hook that enforced path restrictions based on git user.email identity. It mapped emails like `claude-backend@asdlc.local` to agent roles and blocked file operations on forbidden paths.

- `scripts/hooks/prompt-validator.py` -- A UserPromptSubmit hook that was a no-op (always exited 0). It was intended for identity enforcement but deferred all logic to interactive Claude prompting.

These hooks were part of an identity model that relied on git user.email for agent identification. This model was superseded by the CLAUDE_INSTANCE_ID environment variable approach, where identity maps to a bounded context (feature/epic) rather than an agent role.

Meanwhile, the guardrails system (P11-F01) introduced a more capable enforcement mechanism:

- `guardrails-enforce.py` -- Evaluates path restrictions dynamically based on Elasticsearch-stored guidelines, supports tool allow/deny lists, HITL gates, and caches evaluations across hooks.
- `guardrails-inject.py` -- Injects active guardrails into prompt context on every user submission.
- `guardrails-subagent.py` -- Sets up guardrails context when subagents are spawned.

## Decision

1. **Replace** `tool-validator.py` with `guardrails-enforce.py` in the PreToolUse hook entries for Edit and Write matchers.
2. **Delete** `tool-validator.py` as it is fully superseded.
3. **Delete** `prompt-validator.py` as it was a no-op with no enforcement logic.
4. **Wire all hook types** through `hook-wrapper.py` for unified telemetry capture.

## Identity Model Shift

| Aspect | Old Model (git email) | New Model (CLAUDE_INSTANCE_ID) |
|--------|----------------------|-------------------------------|
| Identity source | `git config user.email` | `CLAUDE_INSTANCE_ID` env var |
| Identity meaning | Agent role (backend, frontend) | Bounded context (p11-guardrails) |
| Path enforcement | Hardcoded in tool-validator.py | Dynamic via guardrails guidelines in Elasticsearch |
| Configuration | Python dict in hook script | Elasticsearch documents, editable via HITL UI |
| Caching | None | TTL-based cache with cross-hook state sharing |

## Consequences

### Positive
- Single enforcement mechanism (guardrails) instead of two parallel systems
- Path restrictions are configurable at runtime via the HITL UI
- Guardrails support more enforcement types: tool restrictions, HITL gates, constraints
- All hooks feed into unified telemetry via hook-wrapper.py
- Identity model aligns with bounded context (worktree) architecture

### Negative
- Guardrails system depends on Elasticsearch for full functionality (falls back to permissive mode when unavailable)
- More complex than the original static Python dict approach

## Files Changed

| File | Action |
|------|--------|
| `.claude/settings.json` | Updated PreToolUse commands, added 5 new hook sections |
| `scripts/hooks/tool-validator.py` | Deleted |
| `scripts/hooks/prompt-validator.py` | Deleted |
| `src/infrastructure/hook_telemetry/prometheus_exporter.py` | Added deprecation notice |
