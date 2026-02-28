---
name: feature-completion
description: Validates and completes a feature after all tasks are done. Use when tasks.md shows 100% complete, before invoking @commit.
disable-model-invocation: true
---

Complete and validate feature $ARGUMENTS:

## Available Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `check-completion.sh` | Validate feature completion | `./scripts/check-completion.sh P01-F02-name` |

## Step 1: Verify Tasks Complete

Open `.workitems/$ARGUMENTS/tasks.md` and confirm:
- Tasks Complete: X/X (must match)
- Percentage: 100%
- Status: COMPLETE

If incomplete, use `@tdd-build` to finish remaining tasks.

## Step 2: Run Tests

Run unit and integration tests locally:
```bash
pytest tests/unit/path/to/feature/ -v --cov=src/path/to/feature
pytest tests/integration/ -v -k "feature_name"
```

All tests must pass. If any fail, debug and fix before proceeding.

## Step 3: Run Linter

```bash
./tools/lint.sh src/path/to/feature/
```

Fix all errors before proceeding.

## Step 4: Verify Interfaces

Compare implementation against `design.md`:
- Function signatures match specification
- Return types match specification
- Error handling matches specification

## Step 5: Run E2E Validation

**Executor: Orchestrator agent only**

```bash
./tools/e2e.sh
```

If E2E fails, identify failing test, debug or delegate fix, re-run.

## Step 6: Validate Issues Resolved

Check that all critical issues from code review are resolved:

```bash
gh issue list --label "security" --state open
gh issue list --label "bug" --state open
```

- Critical issues (security, bug) must be closed before commit
- Enhancement issues may remain open

## Step 7: Update Documentation

- [ ] Docstrings complete for all public functions
- [ ] Type hints present and accurate
- [ ] README updated if public interface changed

## Step 8: Update Progress

Update tasks.md:
```markdown
## Progress
- Completed: {today's date}
- Tasks Complete: X/X
- Percentage: 100%
- Status: COMPLETE

## Completion Verification
- [x] All unit tests pass
- [x] Integration tests pass
- [x] E2E tests pass
- [x] Linter passes
- [x] Documentation updated
- [x] Orchestrator validated
```

## Step 9: Hand Off to @commit

After all validation passes, invoke `@commit` for conventional commit to main.

## Cross-References

- `@tdd-build` — Finish remaining tasks if incomplete
- `@code-review` — Review before completion
- `@testing` — Run quality gates (test, lint, SAST, SCA, E2E)
- `@commit` — Conventional commit after validation
