# Feature Completion Skill

## Description

This skill guides the completion and validation of a feature after all tasks are implemented. Use this skill when all tasks in a `tasks.md` are marked complete and you need to perform final validation, documentation updates, and commit.

## When to Use

Use this skill when:
- All tasks in a feature are marked as complete
- Running final E2E tests for a feature
- Updating documentation after implementation
- Preparing the feature commit
- Validating interfaces against dependent features

## Completion Checklist

Execute each step in order. Do not skip steps.

### Step 1: Verify All Tasks Complete

Open the feature's `tasks.md` and confirm:

```markdown
## Progress
- Tasks Complete: 12/12  ← Must match
- Percentage: 100%       ← Must be 100%
- Status: COMPLETE       ← Must be COMPLETE
```

If any tasks are incomplete, return to TDD Execution Skill.

### Step 2: Run Unit Tests

Execute the full unit test suite for the feature:

```bash
# Run all unit tests for the feature
pytest tests/unit/path/to/feature/ -v --cov=src/path/to/feature

# Expected: All tests pass, coverage >= 80%
```

**If tests fail:** Stop completion process. Debug and fix using TDD Execution Skill.

### Step 3: Run Integration Tests

Execute integration tests that involve this feature:

```bash
# Run integration tests
pytest tests/integration/ -v -k "feature_name"

# Expected: All relevant integration tests pass
```

**If tests fail:** Identify the integration issue. Check interface contracts against `design.md`.

### Step 4: Run E2E Tests

Execute end-to-end tests for workflows involving this feature:

```bash
# Run E2E tests
./tools/e2e.sh

# Expected: All E2E tests pass
```

**If tests fail:** Check the full workflow path. Verify all dependencies are working.

### Step 5: Run Linter

Execute the linter on all modified files:

```bash
# Run linter
./tools/lint.sh src/path/to/feature/

# Expected: No errors, no warnings (or warnings documented as accepted)
```

**If linter fails:** Fix all errors. Warnings should be addressed or documented.

### Step 6: Verify Interfaces

Check that implemented interfaces match the design:

1. Open `design.md` and locate the Interfaces section
2. For each Provided Interface, verify:
   - Function signatures match specification
   - Return types match specification
   - Error handling matches specification
3. For each Required Interface, verify:
   - Usage matches the expected contract
   - Error handling covers expected failure modes

**If interfaces don't match:** Update implementation or update `design.md` with rationale.

### Step 7: Check Dependencies

Verify no broken dependencies:

```bash
# If the feature provides interfaces used by other features
# Check those features still work

pytest tests/integration/ -v

# Check for import errors
python -c "from src.path.to.feature import main_interface"
```

### Step 8: Update Documentation

Update relevant documentation:

1. **README.md** (if applicable): Update usage examples
2. **API docs** (if applicable): Regenerate or update
3. **Architecture docs**: Update if design changed during implementation
4. **CHANGELOG.md**: Add entry for the feature

Documentation update checklist:
```markdown
- [ ] README updated (if public interface changed)
- [ ] Docstrings complete for all public functions
- [ ] Type hints present and accurate
- [ ] Examples updated (if applicable)
```

### Step 9: Final Progress Update

Update `tasks.md` with final status:

```markdown
## Progress

- Started: 2026-01-21
- Completed: 2026-01-22
- Tasks Complete: 12/12
- Percentage: 100%
- Status: COMPLETE
- Blockers: None

## Completion Verification

- [x] All tasks marked complete
- [x] All unit tests pass (coverage: 85%)
- [x] Integration tests pass
- [x] E2E tests pass
- [x] Linter passes
- [x] Documentation updated
- [x] Interfaces verified
- [x] Progress: 100%
```

### Step 10: Commit

Create the feature commit:

```bash
# Stage all changes
git add -A

# Create commit with standard message format
git commit -m "feat(P01-F02): bash-tools implementation

- Implements bash tool abstraction layer with JSON contract
- Adds lint.sh, test.sh, sast.sh, sca.sh wrappers
- Tests: 15 unit, 3 integration, 2 e2e
- Docs: Updated tools/README.md

Implements Main_Features.md Feature 17"
```

## Rollback Procedure

If completion validation fails and cannot be fixed:

1. Document the failure in `tasks.md` under Blockers
2. Revert to last known good state:
   ```bash
   git stash  # Save current changes
   ```
3. Update Status to `BLOCKED`
4. Create an issue describing the blocker
5. Move to another feature if possible

## Post-Completion

After successful commit:

1. Update project progress tracking (if maintained separately)
2. Check if this feature unblocks other features
3. Notify dependent feature owners (if working in parallel)
4. Archive or mark the work item as complete

## Common Issues and Resolutions

**Issue: E2E tests fail but unit tests pass**
Resolution: Check integration boundaries. Often caused by mocked dependencies in unit tests that behave differently in E2E.

**Issue: Linter errors in generated code**
Resolution: Add linter ignore comments with justification, or fix the generator.

**Issue: Interface changed during implementation**
Resolution: Update `design.md`, notify dependent features, update integration tests.

**Issue: Coverage below threshold**
Resolution: Add tests for uncovered paths. Focus on error handling paths often missed.
