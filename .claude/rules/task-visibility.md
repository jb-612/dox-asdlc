---
description: Mandatory task tracking for progress visibility
paths:
  - "**/*"
---

# Task Visibility

PM CLI MUST use TaskCreate/TaskUpdate tools to provide real-time progress visibility to the user. This is mandatory for all multi-step work.

## When to Create Tasks

**ALWAYS create tasks when:**
- Starting implementation of a feature (from tasks.md phases)
- Running parallel agents
- Any work with 3+ steps
- Work that will take more than a few minutes

**Task creation pattern:**
```
1. Read tasks.md to understand phases and dependencies
2. Create one task per phase using TaskCreate
3. Set up dependencies using TaskUpdate with addBlockedBy
4. Update status to in_progress when starting each phase
5. Update status to completed when phase finishes
```

## Required Task Fields

When creating tasks, ALWAYS include:

| Field | Purpose | Example |
|-------|---------|---------|
| `subject` | Brief phase name with task IDs | "Phase 1: Redis MCP sidecar (T01-T04)" |
| `description` | What will be done | "Implement Helm chart changes for Redis MCP sidecar" |
| `activeForm` | Present tense for spinner | "Implementing Redis MCP sidecar Helm charts" |

## Dependency Tracking

For phases with dependencies, use TaskUpdate to set blockedBy:

```
TaskCreate: Phase 1 (no dependencies)
TaskCreate: Phase 2 (no dependencies)
TaskCreate: Phase 3 (no dependencies)
TaskCreate: Phase 4 (depends on 1, 2, 3)
TaskUpdate: task #4, addBlockedBy: [#1, #2, #3]
```

This shows the user which tasks are blocked and why.

## Parallel Agent Execution

When running agents in parallel:

1. Create all phase tasks BEFORE launching agents
2. Set dependencies to show blocking relationships
3. Update each task to `in_progress` as agents start
4. Update to `completed` when agents finish

**Example for 3 parallel phases:**
```
# Create tasks with dependencies
TaskCreate: "Phase 1: Redis sidecar (T01-T04)"
TaskCreate: "Phase 2: ES sidecar (T05-T08)"
TaskCreate: "Phase 3: Prometheus (T09-T11)"
TaskCreate: "Phase 4: Parent chart (T12-T14)"
TaskUpdate: #4 addBlockedBy: [#1, #2, #3]

# Launch parallel agents
TaskUpdate: #1 status: in_progress
TaskUpdate: #2 status: in_progress
TaskUpdate: #3 status: in_progress
Task(devops, Phase 1...)  # parallel
Task(devops, Phase 2...)  # parallel
Task(devops, Phase 3...)  # parallel

# After completion
TaskUpdate: #1 status: completed
TaskUpdate: #2 status: completed
TaskUpdate: #3 status: completed
TaskUpdate: #4 status: in_progress
```

## Status Updates

Update task status at these points:

| Event | Action |
|-------|--------|
| Starting work on a phase | `TaskUpdate status: in_progress` |
| Phase completed successfully | `TaskUpdate status: completed` |
| Phase blocked by issue | Keep `in_progress`, note blocker |
| Parallel agents launched | All parallel tasks to `in_progress` |
| Agent returns | Update corresponding task to `completed` |

## Visual Result

Following this pattern produces output like:

```
Task #1 created: Phase 1: Redis MCP sidecar (T01-T04)
Task #2 created: Phase 2: ES MCP sidecar (T05-T08)
Task #3 created: Phase 3: Prometheus annotations (T09-T11)
Task #4 created: Phase 4: Parent chart (T12-T14) blocked by #1, #2, #3

Task #1 updated: status -> in_progress
Task #2 updated: status -> in_progress
Task #3 updated: status -> in_progress

3 devops agents running in parallel:
- Phase 1 (Redis MCP sidecar) - Running
- Phase 2 (ES MCP sidecar) - Running
- Phase 3 (Prometheus) - Running

6 tasks (0 done, 3 in progress, 3 open)
```

## Integration with Workflow

This task visibility integrates with the 11-step workflow:

| Step | Task Pattern |
|------|--------------|
| 6. Parallel Build | Create tasks per phase, run backend/frontend in parallel |
| 7. Testing | Update tasks as tests complete |
| 10. DevOps | Create tasks for each devops operation |

## Non-Negotiable

**PM CLI MUST NOT:**
- Start multi-step work without creating visible tasks
- Run parallel agents without task tracking
- Complete work without updating task status

This ensures the user always has visibility into what's happening and what's blocked.
