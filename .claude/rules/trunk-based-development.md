# Trunk-Based Development Rules

This project follows **Trunk-Based Development (TBD)** where all CLI instances commit directly to `main`.

---

## Core Principles

1. **Commit to main** — All work goes directly to the main branch
2. **Small commits** — Keep changes focused and atomic
3. **Tests must pass** — Pre-commit hook enforces test verification
4. **Path restrictions** — Domain boundaries are still enforced
5. **Feature flags** — Use flags for incomplete features (when needed)

---

## Pre-Commit Requirements

**Before committing to main, the pre-commit hook verifies:**

```bash
./tools/test.sh --quick
```

**If tests fail:**
- The commit is blocked
- Fix the failing tests
- Or commit to a feature branch instead

**This applies to ALL CLI roles** (Backend, Frontend, Orchestrator).

---

## Short-Lived Branches (Optional)

**Branches are optional but recommended for:**
- Multi-day work that can't be broken into smaller commits
- Experimental changes that might be reverted
- Collaborative work between CLIs

**Branch rules:**
- Maximum lifetime: 24 hours
- Merge frequently from main to avoid conflicts
- Delete branch after merging

**Example:**
```bash
# Create short-lived branch
git checkout -b experiment/new-feature

# Work, commit locally
# ...

# Merge to main when ready (tests must pass)
git checkout main
git merge experiment/new-feature
git branch -d experiment/new-feature
```

---

## Role Comparison: Old vs New

| Aspect | Old (Gated) | New (TBD) |
|--------|-------------|-----------|
| **Who merges to main** | Orchestrator only | All CLIs |
| **Review required** | Yes (READY_FOR_REVIEW) | No (self-verified) |
| **Test verification** | Orchestrator runs E2E | Pre-commit hook |
| **Iteration speed** | Blocked by review queue | Immediate |
| **Accountability** | Orchestrator | Individual CLI |

---

## Role Responsibilities Under TBD

### Backend-CLI
- Commits directly to main for backend work
- Runs tests before each commit
- Path restrictions: Cannot modify frontend files
- Notifies team on breaking changes

### Frontend-CLI
- Commits directly to main for frontend work
- Runs tests before each commit
- Path restrictions: Cannot modify backend files
- Notifies team on breaking changes

### Orchestrator-CLI (Coordinator Role)
- Still owns meta files exclusively (CLAUDE.md, docs/, contracts/, .claude/rules/)
- Monitors build status on main
- Has revert authority when main is broken
- Coordinates contract changes between CLIs
- Resolves disputes between CLIs

---

## Revert Authority

**When main is broken (tests fail):**

1. **Any CLI can fix** their own breaking commit
2. **Orchestrator has authority** to revert any commit if:
   - The breaking commit author is unavailable
   - The fix is taking too long (blocking others)
   - Multiple commits need reverting

**Revert protocol:**
```bash
# Orchestrator reverts a breaking commit
git revert <commit-hash>
git commit -m "revert: <original-message> (tests broken)"

# Notify the team
./scripts/coordination/publish-message.sh BUILD_FIXED "main" "Reverted <hash>" --to all
```

---

## Build Status Communication

**When you break main:**
```bash
./scripts/coordination/publish-message.sh BUILD_BROKEN "main" "Tests failing after <commit>" --to all
```

**When main is fixed:**
```bash
./scripts/coordination/publish-message.sh BUILD_FIXED "main" "Tests passing after <commit>" --to all
```

---

## What Remains Unchanged

- **Path restrictions** — CLIs cannot modify files outside their domain
- **Meta file ownership** — Orchestrator exclusively owns CLAUDE.md, docs/, contracts/, .claude/rules/
- **Planning artifacts** — `.workitems/` still required before implementation
- **Contract workflow** — Contract changes still require orchestrator mediation
- **Commit message format** — Still follows `feat(Pnn-Fnn): description` pattern

---

## Quick Reference

```bash
# Normal TBD workflow (any CLI)
./tools/test.sh                    # Verify tests pass locally
git add <files>
git commit -m "feat(P01-F06): ..." # Pre-commit hook runs tests
git push                           # Push to main

# If pre-commit fails
./tools/test.sh                    # See what failed
# Fix the issue
git add <files>
git commit -m "..."                # Try again

# Short-lived branch (optional)
git checkout -b feature/thing
# ... work ...
git checkout main
git pull
git merge feature/thing            # Tests must pass
git push
git branch -d feature/thing
```
