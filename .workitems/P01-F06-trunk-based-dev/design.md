# P01-F06: Trunk-Based Development Migration

## Overview

This feature migrates the project from an orchestrator-gated merge workflow to Trunk-Based Development (TBD), where all 3 CLI instances commit directly to `main`.

## Current State

```
┌─────────────────┐     ┌─────────────────┐
│  Backend-CLI    │     │  Frontend-CLI   │
│  can_merge:     │     │  can_merge:     │
│  False          │     │  False          │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │  READY_FOR_REVIEW     │
         └───────────┬───────────┘
                     ▼
         ┌─────────────────────┐
         │  Orchestrator-CLI   │
         │  can_merge: True    │
         │  Reviews + Merges   │
         └─────────────────────┘
```

**Bottleneck:** All merges to main require orchestrator review.

## Target State (TBD)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Backend-CLI    │     │  Frontend-CLI   │     │  Orchestrator   │
│  can_merge:     │     │  can_merge:     │     │  can_merge:     │
│  True           │     │  True           │     │  True           │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │    All commit directly to main                │
         └───────────────────────┴───────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   pre-commit hook       │
                    │   - Author mismatch     │
                    │   - Tests must pass     │
                    └─────────────────────────┘
```

**Benefits:**
- Faster iteration (no review bottleneck)
- Individual accountability
- Smaller, more frequent commits

## Technical Changes

### 1. Hook Enforcement (`scripts/hooks/tool-validator.py`)

**Before:**
```python
"backend": { "can_merge": False }
"frontend": { "can_merge": False }
```

**After:**
```python
"backend": { "can_merge": True }
"frontend": { "can_merge": True }
```

Remove merge/push blocking logic (lines 240-258).

### 2. Session Display (`scripts/hooks/session-start.py`)

Update `IDENTITY_INFO` to reflect TBD workflow:
- Show `Can commit to main: Yes (tests must pass)` for all roles

### 3. Pre-Commit Test Enforcement (`.git/hooks/pre-commit`)

Add test verification before commits to main:
```bash
if [[ "$CURRENT_BRANCH" == "main" ]]; then
    ./tools/test.sh --quick || exit 1
fi
```

### 4. New Rules File (`.claude/rules/trunk-based-development.md`)

Document TBD principles, pre-commit requirements, and revert authority.

### 5. Updated Documentation

- `parallel-coordination.md` - Remove review workflow
- `orchestrator.md` - Shift from gatekeeper to coordinator
- `workflow.md` - Direct commit protocol
- `CLAUDE.md` - Updated CLI coordination section

### 6. Deprecated Scripts

Rename to `.deprecated`:
- `scripts/orchestrator/review-branch.sh`
- `scripts/orchestrator/merge-branch.sh`

### 7. New Message Types

Add:
- `BUILD_BROKEN` - main branch tests failing
- `BUILD_FIXED` - main branch restored

## Migration Path

1. Update hooks (tasks 1-4)
2. Create TBD rules (task 5)
3. Update documentation (tasks 6-9)
4. Deprecate old scripts (task 10)
5. Update message types (task 11)

## Rollback Plan

If TBD causes issues:
1. Revert `tool-validator.py` to restore `can_merge: False`
2. Revert `session-start.py` to old display
3. Remove test enforcement from pre-commit
4. Add "TBD on hold" note to documentation

## Dependencies

- None (infrastructure feature)

## Testing

1. Verify backend/frontend can commit to main
2. Verify pre-commit test enforcement works
3. Verify path restrictions still work
4. Run full test suite
