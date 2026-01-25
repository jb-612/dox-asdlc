---
description: 11-step development workflow with HITL gates
paths:
  - "**/*"
---

# Development Workflow

The PM CLI orchestrates work through 11 sequential steps. Each step has clear entry/exit criteria and HITL gates at specific points. This workflow ensures quality, traceability, and human oversight.

**IMPORTANT: YOU MUST follow this workflow for all feature work.**

## Overview

```
 1. Workplan         -> PM CLI drafts plan
 2. Planning         -> Planner creates work items
                        |-> diagram-builder (auto) for architecture
 3. Diagrams         -> Explicit diagram requests if needed
 4. Design Review    -> Reviewer validates
                        |-> HITL if concerns found
 5. Re-plan          -> PM CLI assigns scopes, considers multi-CLI
                        |-> Advisory: Chrome extension for complex ops
 6. Parallel Build   -> Backend/Frontend (atomic tasks)
                        |-> Permission forwarding if blocked
 7. Testing          -> Unit/integration tests
                        |-> HITL if failures > 3
 8. Review           -> Reviewer inspects, issues created
 9. Orchestration    -> Orchestrator runs E2E
                        |-> HITL for protected path commits
10. DevOps           -> PM CLI coordinates (HITL required)
                        |-> Local / Separate CLI / Instructions
11. Closure          -> PM CLI summarizes, closes issues
```

## Step Details

### Step 1: Workplan

**Purpose:** PM CLI interprets user intent and drafts an overall plan for the work.

| Aspect | Details |
|--------|---------|
| Executor | PM CLI |
| Inputs | User request, project context |
| Outputs | High-level work plan with scope and dependencies |
| HITL Gates | None |

PM CLI identifies:
- What needs to be built or changed
- Which agents will be needed
- Rough sequencing and dependencies
- Potential blockers or risks

### Step 2: Planning

**Purpose:** Create formal work item artifacts that define the feature.

| Aspect | Details |
|--------|---------|
| Executor | Planner agent |
| Inputs | Work plan from Step 1 |
| Outputs | `.workitems/Pnn-Fnn-description/` with design.md, user_stories.md, tasks.md |
| HITL Gates | None |
| Skill | feature-planning |

The planner creates:
- `design.md` - Technical approach, interfaces, architecture decisions
- `user_stories.md` - User-facing requirements with acceptance criteria
- `tasks.md` - Atomic tasks scoped to less than 2 hours each

**Auto-trigger:** diagram-builder skill is invoked automatically to create architecture diagrams when design.md is created.

### Step 3: Diagrams

**Purpose:** Create additional diagrams not auto-generated in Step 2.

| Aspect | Details |
|--------|---------|
| Executor | Planner or Orchestrator agent |
| Inputs | Design.md, explicit diagram requests |
| Outputs | Mermaid diagrams in `docs/diagrams/` |
| HITL Gates | None |
| Skill | diagram-builder |

Explicit diagram requests may include:
- Sequence diagrams for API flows
- State diagrams for complex workflows
- Data flow diagrams

### Step 4: Design Review

**Purpose:** Validate the design before implementation begins.

| Aspect | Details |
|--------|---------|
| Executor | Reviewer agent |
| Inputs | All planning artifacts from Steps 2-3 |
| Outputs | Review report with concerns or approval |
| HITL Gates | **Design Review Concerns** (advisory) |

If concerns are found, HITL gate presents:
```
Design review found [N] concerns:
 - [concern 1]
 - [concern 2]

Options:
 A) Address concerns before proceeding
 B) Proceed anyway (acknowledge concerns)
 C) Abort this task
```

### Step 5: Re-plan

**Purpose:** PM CLI assigns work to specific agents and plans execution strategy.

| Aspect | Details |
|--------|---------|
| Executor | PM CLI |
| Inputs | Approved design, tasks.md |
| Outputs | Agent assignments, multi-CLI strategy if needed |
| HITL Gates | **Complex Operation** (advisory) |

PM CLI determines:
- Which tasks go to backend vs frontend agents
- Whether multi-CLI coordination is needed
- If Chrome extension advisory should be triggered

**Advisory trigger:** If operation spans more than 10 files or crosses domains, PM CLI advises:
```
This operation is complex. Consider:
 - Opening a new CLI window with Claude Chrome extension
 - Running the [backend/frontend] portion there
 - Report back when complete
```

### Step 6: Parallel Build

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

### Step 7: Testing

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

### Step 8: Review

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

All findings become GitHub issues with appropriate labels:
- `security` - Security vulnerabilities
- `bug` - Defects that need fixing
- `enhancement` - Improvements and optimizations

### Step 9: Orchestration

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

### Step 10: DevOps

**Purpose:** Deploy or configure infrastructure if needed.

| Aspect | Details |
|--------|---------|
| Executor | PM CLI coordinates, DevOps agent executes |
| Inputs | Committed code, deployment requirements |
| Outputs | Deployed infrastructure, CI/CD configuration |
| HITL Gates | **DevOps Invocation** (mandatory) |

**HITL Gate:** Before any devops operation:
```
DevOps operation needed: [description]

Options:
 A) Run devops agent here (I'll wait)
 B) Send notification to separate DevOps CLI
 C) Show me instructions (I'll run manually)
```

This gate is mandatory and cannot be skipped.

### Step 11: Closure

**Purpose:** Summarize work and close tracking items.

| Aspect | Details |
|--------|---------|
| Executor | PM CLI |
| Inputs | Completed feature, open issues |
| Outputs | Summary report, closed issues |
| HITL Gates | None |

PM CLI:
- Summarizes what was implemented
- Closes related GitHub issues with commit references
- Updates progress tracking
- Notes any deferred work

## HITL Gates Summary

Gates are defined in `.claude/rules/hitl-gates.md`. Here is which gates apply to which steps:

| Step | Gate | Type |
|------|------|------|
| 4 | Design Review Concerns | Advisory |
| 5 | Complex Operation | Advisory |
| 6 | Permission Forwarding | Per-request |
| 7 | Test Failures > 3 | Advisory |
| 9 | Protected Path Commit | Mandatory |
| 10 | DevOps Invocation | Mandatory |

**Mandatory gates** block progress until user responds.
**Advisory gates** allow proceeding with acknowledgment.

## Skills Integration

Skills provide reusable procedures for specific tasks. Here is which skills are used at which steps:

| Step | Skill | Purpose |
|------|-------|---------|
| 2 | feature-planning | Create work item artifacts |
| 3 | diagram-builder | Generate Mermaid diagrams |
| 6 | tdd-execution | Red-Green-Refactor cycle |
| 9 | feature-completion | Validate and complete feature |

Skills are located in `.claude/skills/` and are invoked by agents as needed.

## Non-Negotiable Rules

These core rules apply throughout the workflow and cannot be overridden:

### 1. Plan Before Code

BEFORE writing any implementation code:
- Work item folder must exist: `.workitems/Pnn-Fnn-description/`
- All three files must be complete: `design.md`, `user_stories.md`, `tasks.md`
- Each task must be scoped to less than 2 hours

**If planning is incomplete, STOP and complete it first.**

### 2. TDD Required

For each task:
1. **RED**: Write failing test
2. **GREEN**: Minimal code to pass
3. **REFACTOR**: Clean up while green
4. Mark `[x]` in tasks.md only after tests pass

**Never proceed to next task with failing tests.**

### 3. Commit Only Complete Features

A feature is complete when:
- All tasks marked `[x]` in tasks.md
- `./tools/test.sh` passes
- `./tools/lint.sh` passes
- Progress shows 100%

Only the orchestrator agent commits to main branch.

### 4. Review Findings Become GitHub Issues

After code review, create GitHub issues for all findings:

**Security/Critical Issues:**
```bash
gh issue create --title "SEC: <title>" --body "<description>" --label "security,bug"
```

**Code Quality Issues:**
```bash
gh issue create --title "CODE: <title>" --body "<description>" --label "bug"
```

**Deferred Work:**
```bash
gh issue create --title "DEFERRED: <Pnn-Fnn> <remaining task>" --body "<description>" --label "enhancement"
```

## Commit Protocol

Commits follow this format:
```
feat(Pnn-Fnn): description

- Implements {summary}
- Tests: {count} unit, {count} integration

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

**Never leave completed features uncommitted.**
