# Development Workflow Rules

## Rule 1: Planning Gate

**BEFORE any code is written for a feature:**

1. Verify the work item folder exists: `.workitems/Pnn-Fnn-{description}/`
2. Confirm all three planning files are complete:
   - `design.md` — Technical approach, interfaces, dependencies
   - `user_stories.md` — Success criteria and acceptance tests
   - `tasks.md` — Atomic task breakdown with estimates
3. Check that tasks are properly scoped (each task < 2 hours of work)
4. Validate dependencies are documented and available

**If planning is incomplete, STOP and complete planning first.**

## Rule 2: TDD Execution

For each task in `tasks.md`:

1. **Red**: Write a failing test that defines the expected behavior
2. **Green**: Write minimal code to make the test pass
3. **Refactor**: Clean up while keeping tests green
4. Mark task as `[x]` in `tasks.md` only after tests pass

Do not proceed to the next task until the current task's tests pass.

## Rule 3: Feature Completion Checklist

A feature is complete only when ALL of the following pass:

```
[ ] All tasks in tasks.md are marked complete
[ ] All unit tests pass: ./tools/test.sh
[ ] E2E tests pass: ./tools/e2e.sh  
[ ] Linter passes: ./tools/lint.sh
[ ] No type errors (if applicable)
[ ] Documentation updated
[ ] Interface contracts verified against dependents
[ ] Progress marked as 100% in tasks.md
```

## Rule 4: Commit Protocol

**Commit IMMEDIATELY when a feature reaches 100% completion.**

Do not:
- Batch multiple completed features into one commit
- End a session with uncommitted complete work
- Wait for user to request a commit

Commit message format:
```
feat(Pnn-Fnn): {description}

- Implements {brief summary}
- Tests: {test count} unit, {count} integration, {count} e2e
- Docs: {files updated}

Closes #{issue} if applicable
```

## Rule 5: Dependency Management

Before starting a feature:

1. Check `design.md` for dependencies on other features
2. Verify dependent features are complete or interfaces are stubbed
3. If blocked, document in `tasks.md` and switch to unblocked work
4. When unblocked, re-validate interfaces before proceeding

## Rule 6: Context Boundaries

When working on a feature:

1. Load only the relevant work item folder
2. Reference solution docs (`docs/`) for architectural decisions
3. Do not modify files outside the current feature scope
4. Use subagents for parallel independent tasks

## Rule 7: Progress Tracking

Update `tasks.md` progress section after each task:

```markdown
## Progress

- Started: 2026-01-21
- Tasks Complete: 5/12
- Percentage: 42%
- Status: IN_PROGRESS | BLOCKED | COMPLETE
- Blockers: {list any blockers}
```

## Rule 8: Error Recovery

If tests fail after a code change:

1. Do not proceed to next task
2. Diagnose failure using test output
3. Fix the issue
4. Re-run all tests for the feature
5. Only continue when all tests pass

If stuck for more than 3 attempts, escalate by documenting the issue and seeking review.

## Rule 9: Session Hygiene

Before ending any session or switching to a different task:

1. Run `git status` to check for uncommitted changes
2. For each uncommitted change:
   - If feature complete → commit immediately
   - If feature incomplete → document status in tasks.md
3. Never leave completed features uncommitted
4. Infrastructure changes (docker-compose, requirements.txt) should be committed with their associated feature, not batched separately
