---
description: Native Agent Teams coordination mode for in-session parallel work
---

# Native Agent Teams

Use TeamCreate/SendMessage/TaskCreate for in-session parallel coordination. Redis stays for event bus, session persistence, swarm state, and graph store.

## When to Use

| Scenario | Mode |
|----------|------|
| Parallel agents within one PM CLI session | **Native Teams** |
| Separate git branch isolation | **Worktrees + Redis** |
| Single-agent delegation (no parallelism) | **Same-session subagent** |
| Cross-machine coordination | **Redis** |

## Message Type Mapping

Prefix SendMessage content with the type: `STATUS:`, `BLOCKED:`, `CONTRACT_CHANGE:`, `DEVOPS_STARTED:`, `DEVOPS_COMPLETE:`, `DEVOPS_FAILED:`, `BUILD_BROKEN:` (broadcast), `BUILD_FIXED:` (broadcast).

## Key Constraints

- Teammates inherit PM CLI permissions and guardrails hooks
- All HITL gates remain in effect for teammates
- Keep teams small (2-4 teammates) — context window is shared
- If PM CLI exits, team is lost — use worktrees for durable work
- One team per session, no nested teams, no cross-session teams
- Config flag `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is already set in settings.json
