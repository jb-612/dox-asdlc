---
name: feature-completion
description: Validates and completes a feature after all tasks are done. Use when tasks.md shows 100% complete, before committing a feature.
disable-model-invocation: true
---

Complete and validate feature $ARGUMENTS:

## Step 1: Verify Tasks Complete

Open `.workitems/$ARGUMENTS/tasks.md` and confirm:
- Tasks Complete: X/X (must match)
- Percentage: 100%
- Status: COMPLETE

If incomplete, use `/tdd-execution` to finish remaining tasks.

## Step 2: Run Tests

```bash
# Unit tests
pytest tests/unit/path/to/feature/ -v --cov=src/path/to/feature

# Integration tests
pytest tests/integration/ -v -k "feature_name"

# E2E tests
./tools/e2e.sh
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

## Step 5: Update Documentation

- [ ] Docstrings complete for all public functions
- [ ] Type hints present and accurate
- [ ] README updated if public interface changed

## Step 6: Final Progress Update

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
```

## Step 7: Commit

```bash
git add -A
git commit -m "feat($ARGUMENTS): {description}

- {summary of implementation}
- Tests: {count} unit, {count} integration, {count} e2e

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```
