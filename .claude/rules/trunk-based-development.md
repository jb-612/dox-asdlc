---
description: Trunk-based development workflow - all CLIs commit directly to main
---

# Trunk-Based Development

All CLI roles commit directly to `main` branch.

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
