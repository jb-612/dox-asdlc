---
description: Native Agent Teams coordination mode for in-session parallel work
---

# Native Agent Teams

Native Claude Agent Teams provide in-session parallel coordination as an alternative to Redis-backed messaging for CLI-to-CLI coordination. This mode uses TeamCreate, SendMessage, TaskCreate, and TaskUpdate instead of coord_check_messages, coord_publish_message, and coord_ack_message.

## What This Replaces (and What It Doesn't)

Native Agent Teams replaces **only the coordination messaging layer**:

| Replaced | Tool | Native Equivalent |
|----------|------|-------------------|
| Message publishing | `coord_publish_message` | `SendMessage` |
| Message polling | `coord_check_messages` | Automatic delivery |
| Message acknowledgment | `coord_ack_message` | Not needed (inline processing) |
| Presence tracking | `coord_get_presence` | Team config file + idle notifications |
| Heartbeats | `coord_heartbeat` | Automatic lifecycle management |

**NOT replaced** (Redis stays for these):

| System | Redis Component | Why It Stays |
|--------|----------------|--------------|
| Event Bus | Redis Streams (6 consumer groups) | Event-driven task routing, durable delivery |
| Session persistence | `src/orchestrator/repositories/redis/` | Long-lived session state across restarts |
| Swarm state | `src/workers/swarm/redis_store.py` | Multi-agent review coordination |
| Graph store | `src/infrastructure/graph_store/redis_store.py` | Dependency graph persistence |
| Gate locking | Redis distributed locks | Concurrent gate decision safety |

## Message Type Mapping

Existing `MessageType` enum values map to SendMessage content conventions:

| Redis MessageType | SendMessage Convention |
|-------------------|-----------------------|
| `SESSION_START` | Implicit when teammate joins team |
| `SESSION_END` | Teammate receives shutdown_request and approves |
| `STATUS_UPDATE` | `SendMessage(content: "STATUS: {details}")` |
| `BLOCKING_ISSUE` | `SendMessage(content: "BLOCKED: {description}")` |
| `CONTRACT_CHANGE_PROPOSED` | `SendMessage(content: "CONTRACT_CHANGE: {details}")` |
| `CONTRACT_APPROVED` | `SendMessage(content: "CONTRACT_APPROVED: {contract}")` |
| `CONTRACT_REJECTED` | `SendMessage(content: "CONTRACT_REJECTED: {reason}")` |
| `META_CHANGE_REQUEST` | `SendMessage(content: "META_CHANGE: {details}")` |
| `DEVOPS_STARTED` | `SendMessage(content: "DEVOPS_STARTED: {operation}")` |
| `DEVOPS_STEP_UPDATE` | `SendMessage(content: "DEVOPS_STEP: {step} {status}")` |
| `DEVOPS_COMPLETE` | `SendMessage(content: "DEVOPS_COMPLETE: {summary}")` |
| `DEVOPS_FAILED` | `SendMessage(content: "DEVOPS_FAILED: {error}")` |
| `BUILD_BROKEN` | `SendMessage(type: "broadcast", content: "BUILD_BROKEN: {details}")` |
| `BUILD_FIXED` | `SendMessage(type: "broadcast", content: "BUILD_FIXED: {details}")` |

## Team Lifecycle

```
1. Create    -> TeamCreate(team_name: "<bounded-context>")
               Creates team file at ~/.claude/teams/<name>/config.json
               Creates task list at ~/.claude/tasks/<name>/

2. Plan      -> TaskCreate for each work item from tasks.md
               TaskUpdate to set dependencies (addBlockedBy)

3. Spawn     -> Task(subagent_type: "backend", name: "backend-dev", team_name: "<name>")
               Task(subagent_type: "frontend", name: "frontend-dev", team_name: "<name>")
               Teammates receive CLAUDE.md context and agent instructions

4. Assign    -> TaskUpdate(owner: "backend-dev") for backend tasks
               TaskUpdate(owner: "frontend-dev") for frontend tasks

5. Work      -> Teammates execute assigned tasks
               Messages flow automatically between turns
               Teammates use TaskUpdate to mark tasks completed
               Teammates use SendMessage for status updates and blockers

6. Monitor   -> PM CLI processes delivered messages by priority
               TaskList shows real-time progress
               Idle notifications are normal (teammate waiting for input)

7. Shutdown  -> SendMessage(type: "shutdown_request", recipient: "backend-dev")
               SendMessage(type: "shutdown_request", recipient: "frontend-dev")
               Teammates approve shutdown via shutdown_response

8. Cleanup   -> TeamDelete removes team and task directories
```

## When to Use Each Coordination Mode

| Scenario | Mode | Why |
|----------|------|-----|
| Multiple agents working in parallel within one PM CLI session | **Native Teams** | Automatic messaging, built-in task tracking |
| Work requiring separate git branch isolation | **Worktrees + Redis** | Git worktrees need separate processes |
| Quick single-agent delegation (no parallelism) | **Same-session subagent** | Simplest, no team overhead |
| Cross-machine coordination | **Redis** | Native teams are single-machine only |
| Both in-session and cross-session agents | **Dual mode** | Native teams for local, Redis for remote |

## Permission Inheritance

Teammates inherit the PM CLI's permission settings:
- `.claude/settings.json` allow/deny lists apply to all teammates
- Guardrails hooks (PreToolUse, SubagentStart) fire for all teammates
- Path restrictions are enforced by the guardrails system, not by team membership
- HITL gates still apply - teammates cannot bypass gates that PM CLI enforces

## Known Limitations

| Limitation | Workaround |
|------------|------------|
| No session resumption | If PM CLI exits, the team is lost. Use worktrees for durable work. |
| One team per session | Create a single team with multiple teammates for the session. |
| No nested teams | A teammate cannot create its own sub-team. Use same-session subagents within a teammate. |
| No cross-session teams | Teams exist within one PM CLI process. Use Redis for cross-session. |
| Context window shared | All teammates share the PM CLI's context window budget. Keep teams small (2-4 teammates). |
| No persistent task history | Task list is cleaned up with TeamDelete. Use git commits for durable records. |

## Configuration

Native Agent Teams requires the experimental flag in `.claude/settings.json`:

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

This is already set in the project settings.

## Coordination Backend Selection

The `COORDINATION_BACKEND` environment variable controls which coordination mode is active:

| Value | Behavior |
|-------|----------|
| `redis` (default) | Use Redis MCP for all coordination |
| `native_teams` | Use native Agent Teams; Redis MCP tools show deprecation notices |
| `dual` | Both modes active; native teams for in-session, Redis for cross-session |

When `COORDINATION_BACKEND=native_teams`:
- Redis MCP coordination tools (`coord_check_messages`, etc.) still work but include deprecation notices
- Shell scripts (`scripts/coordination/*.sh`) print deprecation warnings
- Native team tools (TeamCreate, SendMessage, etc.) are the primary coordination mechanism

## Integration with Existing Systems

### Guardrails

Guardrails hooks fire for all teammates:
- `UserPromptSubmit` hook injects active guardrails into teammate context
- `PreToolUse` hook enforces tool restrictions per agent role
- `SubagentStart` hook sets up guardrails for newly spawned teammates

### HITL Gates

All 7 HITL gates remain in effect:
- Gate 0 (Intent Approval) - PM CLI presents to user before spawning team
- Gate 1 (DevOps Invocation) - PM CLI confirms before spawning devops teammate
- Gate 2-3 (Protected Paths, Contracts) - Orchestrator teammate requests confirmation via SendMessage
- Gate 4 (Destructive Ops) - Guardrails hooks block at PreToolUse level
- Gate 5-7 (Advisory) - Teammates send findings via SendMessage for PM CLI to present

### Task Visibility

Task tracking is mandatory (see `.claude/rules/task-visibility.md`):
- PM CLI creates tasks from tasks.md phases before spawning teammates
- Teammates claim and update tasks via TaskUpdate
- TaskList provides real-time progress to the user
- Dependencies tracked via addBlockedBy

### 11-Step Workflow

Native teams slot into the existing workflow at Steps 6-7 (Parallel Build and Testing):

| Step | With Native Teams |
|------|-------------------|
| 1-5 | No change (PM CLI + planner + reviewer) |
| 6 | TeamCreate, spawn backend + frontend teammates, assign tasks |
| 7 | Teammates run their own tests, report via SendMessage |
| 8 | Spawn reviewer teammate or use same-session subagent |
| 9-11 | No change (orchestrator commits, devops deploys, PM CLI closes) |
