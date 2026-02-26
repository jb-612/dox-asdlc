# PM CLI Delegation

## Task Visibility (Mandatory)

PM CLI MUST use TaskCreate/TaskUpdate tools to provide real-time progress visibility. See `.claude/rules/task-visibility.md` for full specification.

**Before starting implementation:**
1. Read tasks.md to understand phases
2. Create one task per phase with TaskCreate
3. Set dependencies with TaskUpdate (addBlockedBy)
4. Update status as work progresses

**Example pattern:**
```
TaskCreate: "Phase 1: Backend API (T01-T05)"
TaskCreate: "Phase 2: Frontend components (T06-T10)"
TaskUpdate: #2 addBlockedBy: [#1]

TaskUpdate: #1 status: in_progress
[delegate to backend agent]
TaskUpdate: #1 status: completed
TaskUpdate: #2 status: in_progress
[delegate to frontend agent]
```

This ensures users always see what's running, what's blocked, and overall progress.

## Delegation Rules

| Task Type | Delegate To |
|-----------|-------------|
| Planning artifacts (design.md, tasks.md) | planner |
| Backend implementation (workers, infra) | backend |
| Frontend implementation (HITL UI, SPA) | frontend |
| Code review (read-only inspection) | reviewer |
| Meta files, docs, commits | orchestrator |
| Infrastructure, deploys | devops (HITL required) |

## Session Renewal Protocol

PM CLI delegates ONE atomic task at a time per sequential delegation. Use native teams (TeamCreate) when parallel work is needed — teammates execute concurrently.

After each atomic task delegation:
1. Wait for agent to complete the single task
2. Record completion status (success/failure/blocked)
3. Pause for session renewal before next delegation
4. Resume with fresh context, referencing previous outcomes

This pattern ensures:
- Agents have focused, minimal context
- Progress is tracked incrementally
- Failures are isolated and recoverable
- User can intervene between tasks

## Environment Awareness

Before invoking DevOps, PM CLI should determine the target environment tier.
Prefer Docker Compose over K8s for rapid development.

See `CLAUDE.md` Environment Tiers table and `@deploy` skill for details.

## What PM CLI Does NOT Do

PM CLI strictly avoids:

1. **Writing implementation code** - Delegates to backend/frontend agents
2. **Creating test files** - Part of TDD execution by implementing agents
3. **Modifying source files directly** - Only agents with domain access do this
4. **Making commits** - Orchestrator handles all commits to main
5. **Running devops without HITL** - Always requires user confirmation
6. **Designing feature architecture** - Planner creates design.md
7. **Debugging test failures** - Implementing agents handle their own debugging
8. **Direct file edits outside .workitems** - Uses delegation for all code changes
