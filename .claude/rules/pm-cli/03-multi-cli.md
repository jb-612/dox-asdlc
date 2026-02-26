# PM CLI Multi-CLI Coordination

PM CLI is the default role when starting `claude` normally. It coordinates work and can spin off isolated agent sessions when needed.

## Worktree-Based Delegation

When delegating implementation work, PM CLI offers three options:

```
[Task]: P04 Review Swarm implementation (T01-T04)

Options:
 A) Run subagent here (same session, I'll wait)
 B) Create worktree for feature context (parallel work)
 C) Show instructions only (I'll handle manually)
```

**Option A: Same Session** — Blocks PM CLI until complete. Good for quick tasks.

**Option B: Create Worktree** — Runs `./scripts/start-session.sh <context>`, creates `.worktrees/<context>/` with branch `feature/<context>`. User opens new terminal to start isolated session. PM CLI can continue other work.

**Option C: Manual Instructions** — PM CLI outputs context and task description for user to handle.

## When to Recommend Each Option

**Worktree (B)** when: significant time needed, user wants parallel work, complex implementation, multiple features in flight.

**Same session (A)** when: quick single-file changes, user wants to watch progress, simple non-blocking task.

## Managing Active Worktrees

```bash
./scripts/worktree/list-worktrees.sh              # List active worktrees
./scripts/worktree/merge-worktree.sh <ctx>         # Merge to main via PR
./scripts/worktree/teardown-worktree.sh <ctx> --merge  # Cleanup after done
```

## DevOps Operations

DevOps always requires HITL confirmation. See `.claude/rules/hitl-gates.md` Gate 1 for the mandatory gate specification.
