---
name: feature-completion
description: Validates and completes a feature after all tasks are done. Use when tasks.md shows 100% complete, before committing a feature.
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

If incomplete, use `/tdd-execution` to finish remaining tasks.

## Step 2: Run Tests

Run unit and integration tests locally:
```bash
# Unit tests
pytest tests/unit/path/to/feature/ -v --cov=src/path/to/feature

# Integration tests
pytest tests/integration/ -v -k "feature_name"
```

All tests must pass. If any fail, debug and fix before proceeding.

**Note:** E2E tests are run by the orchestrator in Step 7.

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

## Step 6: Request Orchestrator Validation

If you are not the orchestrator agent, hand off to orchestrator for final validation:

```
Delegate to orchestrator:
- Feature: $ARGUMENTS
- Tasks: 100% complete
- Unit tests: Passing
- Ready for E2E validation and commit
```

The orchestrator will complete Steps 7-9.

## Step 7: Orchestrator E2E Validation

**Executor: Orchestrator agent only**

Run end-to-end tests:
```bash
./tools/e2e.sh
```

If E2E fails:
1. Identify failing test
2. Debug or delegate fix to appropriate agent
3. Re-run after fix
4. Do not proceed until E2E passes

## Step 8: Validate Issues Resolved

Check that all critical issues from code review are resolved:

```bash
gh issue list --label "security" --state open
gh issue list --label "bug" --state open
```

- Critical issues (security, bug) must be closed before commit
- Enhancement issues may remain open
- Document any deferred issues in commit message

## Step 9: Orchestrator Commits

**Executor: Orchestrator agent only**

HITL gate if committing to protected paths (contracts/, .claude/):
```
Committing to protected path: [path]
This affects project configuration.

Confirm? (Y/N)
```

Commit format:
```bash
git add -A
git commit -m "feat($ARGUMENTS): {description}

- {summary of implementation}
- Tests: {count} unit, {count} integration, {count} e2e

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

## Step 10: Final Progress Update

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
- [x] Committed to main
```

## Cross-References

- `@testing` — Run quality gates (test, lint, SAST, SCA, E2E)
- `@tdd-execution` — Finish remaining tasks if incomplete
- `@code-review` — Review before completion
