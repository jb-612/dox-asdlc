# Steps 6-9: Parallel Build through Orchestration

## Step 6: Parallel Build

**Purpose:** Implement the feature through atomic task delegation.

| Aspect | Details |
|--------|---------|
| Executor | Backend and/or Frontend agents |
| Inputs | Assigned tasks from Step 5 |
| Outputs | Implementation code, test files |
| HITL Gates | Permission forwarding if blocked |
| Skill | tdd-execution |

**Session Renewal Rule:** PM CLI delegates ONE atomic task at a time. After each task:
1. Wait for agent to complete the single task
2. Record completion status (success/failure/blocked)
3. Pause for session renewal before next delegation
4. Resume with fresh context, referencing previous outcomes

This prevents context drift and ensures focused agent execution.

**TDD Protocol:** Each task follows Red-Green-Refactor:
1. **RED**: Write failing test
2. **GREEN**: Minimal code to pass
3. **REFACTOR**: Clean up while green

**Permission Forwarding:** If an agent is blocked by permissions, it returns a `PERMISSION_FORWARD` message. PM CLI presents the request to the user and re-invokes with approved permissions if granted.

## Step 7: Testing

**Purpose:** Verify all tests pass before review.

| Aspect | Details |
|--------|---------|
| Executor | Implementing agents (backend/frontend) |
| Inputs | Implementation from Step 6 |
| Outputs | Passing test suite |
| HITL Gates | **Test Failures > 3** (advisory) |

If the same test fails more than 3 times, HITL gate presents:
```
Tests failing repeatedly ([N] times): [test name]

Options:
 A) Continue debugging
 B) Skip test and proceed (mark as known issue)
 C) Abort task
```

**Never proceed to Step 8 with failing tests.**

## Step 8: Review

**Purpose:** Independent code review of the implementation.

| Aspect | Details |
|--------|---------|
| Executor | Reviewer agent |
| Inputs | Implementation code, test files |
| Outputs | Review report, GitHub issues for findings |
| HITL Gates | None |

Reviewer inspects:
- Code quality and style
- Test coverage
- Security concerns
- Performance implications

**Context gathering:** Use `ks_search` to find similar code patterns for comparison and verify consistency with established conventions.

All findings become GitHub issues with appropriate labels:
- `security` - Security vulnerabilities
- `bug` - Defects that need fixing
- `enhancement` - Improvements and optimizations

## Step 9: Orchestration

**Purpose:** Run E2E tests and commit to main branch.

| Aspect | Details |
|--------|---------|
| Executor | Orchestrator agent |
| Inputs | Reviewed implementation |
| Outputs | E2E test results, commit to main |
| HITL Gates | **Protected Path Commit** (mandatory) |
| Skill | feature-completion |

Orchestrator:
1. Runs `./tools/e2e.sh` for end-to-end tests
2. Runs `./tools/lint.sh` for final lint check
3. Commits to main branch

**HITL Gate:** If commit includes files in `contracts/` or `.claude/`:
```
Committing to protected path: [path]
This affects project configuration.

Confirm? (Y/N)
```
