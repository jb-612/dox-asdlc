---
description: Trunk-based development workflow - orchestrator is primary commit agent
---

# Trunk-Based Development

All work targets `main` branch directly. The orchestrator agent is the primary commit authority.

## Commit Authority

The **orchestrator agent** is the primary commit agent. Other agents prepare changes but do not commit directly.

| Agent | Can Commit? | Notes |
|-------|-------------|-------|
| orchestrator | Yes | Primary commit authority |
| devops | Yes | Infrastructure changes only |
| backend | No | Prepares changes, orchestrator commits |
| frontend | No | Prepares changes, orchestrator commits |
| planner | No | Creates artifacts only |
| reviewer | No | Read-only |

## Protected Paths

Commits to these paths require HITL confirmation:

| Path | Reason |
|------|--------|
| `contracts/` | API contract changes affect consumers |
| `.claude/` | Project configuration and rules |

Before committing to protected paths, orchestrator must confirm:
```
Committing to protected path: [path]
This affects project configuration.

Confirm? (Y/N)
```

See `.claude/rules/hitl-gates.md` for full HITL gate specification.

## Core Rules

1. **Commit to main** - No feature branches required
2. **Tests must pass** - Pre-commit hook enforces `./tools/test.sh --quick`
3. **Path restrictions apply** - CLIs can only modify their domain
4. **Small commits** - One feature per commit

## Pre-Commit Hook

Before each commit:
```bash
./tools/test.sh --quick
```

If tests fail, the commit is blocked. Fix tests first.

## Build Communication

When you break main:
```bash
./scripts/coordination/publish-message.sh BUILD_BROKEN "main" "Description" --to all
```

When main is fixed:
```bash
./scripts/coordination/publish-message.sh BUILD_FIXED "main" "Description" --to all
```

## Revert Authority

Orchestrator can revert any commit when:
- Tests on main are failing
- Author is unavailable
- Fix is blocking other work

```bash
git revert <commit-hash>
git commit -m "revert: <message> (tests broken)"
```

## Issue Tracking for Build Health

When build breaks, create tracking issue:
```bash
gh issue create --title "BUILD: Main branch failing - <description>" \
  --body "Commit: <sha>\nTest: <failing test>\nError: <message>" \
  --label "bug"
```

When reverting, reference the issue:
```bash
git commit -m "revert: <message> (fixes #<issue-number>)"
```
