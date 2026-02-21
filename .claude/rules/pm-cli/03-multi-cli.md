# PM CLI Multi-CLI Coordination

PM CLI is the default role when starting `claude` normally. It coordinates work and can spin off isolated agent sessions when needed.

## Worktree-Based Delegation

Worktrees are organized by **bounded context** (feature/epic), not by agent role. When delegating implementation work, PM CLI offers three options:

```
[Task]: P04 Review Swarm implementation (T01-T04)

Options:
 A) Run subagent here (same session, I'll wait)
 B) Create worktree for feature context (parallel work)
 C) Show instructions only (I'll handle manually)
```

**Option A: Same Session**
- Run subagent in current session
- Blocks PM CLI until complete
- Good for quick, focused tasks

**Option B: Create Worktree (Recommended for parallel work)**
- PM CLI runs: `./scripts/start-session.sh <context>`
- Creates `.worktrees/<context>/` with branch `feature/<context>`
- User opens new terminal:
  ```
  cd .worktrees/<context>
  export CLAUDE_INSTANCE_ID=<context>
  claude
  ```
- Work happens in isolation, no branch conflicts
- PM CLI can continue other work
- Multiple subagents (backend, frontend) work in same worktree

**Option C: Manual Instructions**
- PM CLI outputs context and task description
- User handles execution manually

## Worktree Delegation Flow

```
User: "Implement P04 review swarm feature"

PM CLI:
1. Creates tasks from tasks.md
2. Identifies work context: p04-review-swarm
3. Asks user:

   "P04 Review Swarm implementation needed.

   Options:
    A) Run subagent here
    B) Create worktree for p04-review-swarm (parallel work)
    C) Show instructions only

   Recommendation: B (allows you to continue other work)"

User: "B"

PM CLI:
1. Runs: ./scripts/start-session.sh p04-review-swarm
2. Reports:

   "Created worktree at .worktrees/p04-review-swarm/
   Branch: feature/p04-review-swarm
   Identity: p04-review-swarm

   To start the session:
   cd .worktrees/p04-review-swarm
   export CLAUDE_INSTANCE_ID=p04-review-swarm
   claude

   I'll continue here. The session will see its tasks
   via coord_get_notifications when it starts."

3. Publishes task details via coord_publish_message
```

## Bounded Context vs Agent Role

| Concept | Purpose | Example |
|---------|---------|---------|
| **Context** (worktree) | Physical isolation for a feature | `p04-review-swarm` |
| **Role** (subagent) | Path restrictions within a session | `backend`, `frontend` |

A single worktree can have multiple subagents working on it because they're all contributing to the same feature context.

## Managing Active Worktrees

PM CLI can check and manage worktrees:

```bash
# List active worktrees
./scripts/worktree/list-worktrees.sh

# Merge completed work back to main (via PR)
./scripts/worktree/merge-worktree.sh p04-review-swarm

# Cleanup after work is done
./scripts/worktree/teardown-worktree.sh p04-review-swarm --merge
```

## When to Recommend Worktrees

PM CLI should recommend Option B (worktree) when:
- Task will take significant time
- User wants to continue other work in parallel
- Complex implementation requiring focused context
- Multiple features being worked on simultaneously

PM CLI should recommend Option A (same session) when:
- Quick, single-file changes
- User wants to watch progress
- Simple task that won't block long

## DevOps Operations

DevOps always requires HITL confirmation:

```
DevOps operation needed: [description]

Options:
 A) Run devops agent here (I'll wait)
 B) Create devops worktree for separate CLI
 C) Show me instructions (I'll run manually)
```

### DevOps Message Types

| Type | Direction | Purpose |
|------|-----------|---------|
| `DEVOPS_REQUEST` | PM CLI -> DevOps CLI | Request devops operation |
| `DEVOPS_STARTED` | DevOps CLI -> PM CLI | Operation in progress |
| `DEVOPS_COMPLETE` | DevOps CLI -> PM CLI | Operation finished (success) |
| `DEVOPS_FAILED` | DevOps CLI -> PM CLI | Operation failed (with error) |

## Chrome Extension Advisory Pattern

For complex operations, PM CLI advises the user to consider using Claude Chrome extension in a separate window.

### Triggers

1. **Multi-file refactoring** - Changes spanning more than 10 files
2. **Cross-domain changes** - Both backend and frontend modifications required
3. **Infrastructure + code changes** - DevOps operations combined with source changes
4. **Visual review required** - UI changes that need visual inspection

### Advisory Message Template

When any trigger is detected, output:

```
This operation is complex. Consider:
 - Opening a new CLI window with Claude Chrome extension
 - Running the [backend/frontend/devops] portion there
 - Report back when complete

Instructions to paste:
---
[Context summary]
[Specific task description]
[Expected outcome]
---
```

## Workflow Integration

PM CLI follows the 11-step workflow defined in `.claude/rules/workflow/`.
See `CLAUDE.md` for the step overview.
