---
description: HITL gate definitions - mandatory and advisory checkpoints requiring user input
paths:
  - "**/*"
---

# HITL Gates

Human-In-The-Loop (HITL) gates are checkpoints where the PM CLI must pause and ask the user for input before proceeding. These gates ensure human oversight for critical operations.

## Gate Types

| Type | Description | User Action |
|------|-------------|-------------|
| **Mandatory** | Cannot proceed without valid response | Must respond to continue |
| **Advisory** | Can skip with acknowledgment | May choose to proceed anyway |

### Response Options

All gates support the standard response options (Approve/Reject or Y/N). Additionally, some gates support a **Steer** option:

| Option | Description |
|--------|-------------|
| **Approve** | Proceed as planned |
| **Reject** | Abort the operation |
| **Steer** | Redirect: provide feedback to modify the approach without full rejection |

The Steer option is available at gates where iterative refinement is appropriate (Design Review R2, User Gate).

## Mandatory Gates

Mandatory gates block all progress until the user provides a valid response. These protect against irreversible or high-impact operations.

### Design Review R2 Hard Block

**Trigger:** Design pipeline Stage 7 — reviewer re-validates after R1 revisions. Fires if Critical concerns remain.

**Question Format:**
```
Design Review Round 2 for [feature]:
 - Critical concerns remaining: [N]
 - [concern details]

Options:
 A) Address remaining concerns (return to revision)
 B) Override and proceed (requires justification, logged for audit)
 C) Abort design
```

**Behavior:**
- Option A: Return to pipeline Stage 6 for revisions
- Option B: User provides justification; logged for audit trail. Proceed with acknowledgment.
- Option C: Abort design pipeline

### User Gate

**Trigger:** Design pipeline Stage 10 — all planning artifacts complete, reviewed, and tasks broken down.

**Question Format:**
```
Design pipeline complete for [feature]:
 - Design: [summary]
 - Stories: [count] user stories
 - Tasks: [count] atomic tasks ([total estimate] hours)
 - Reviews: R1 + R2 passed

Options:
 A) Approve and proceed to TDD Build
 B) Steer: modify scope or approach (provide feedback)
 C) Reject and return to workplan
```

**Behavior:**
- Option A: Proceed to TDD Build (Step 3)
- Option B: User provides feedback; return to pipeline Stage 2 for revision
- Option C: Abort pipeline; return to Step 1 for re-scoping

### DevOps Invocation

**Trigger:** Before any devops operation (docker deploy, kubernetes, cloud infrastructure, GitHub Actions)

**Question Format:**
```
DevOps operation needed: [description]

Options:
 A) Run devops agent here (I'll wait)
 B) Send notification to separate DevOps CLI
 C) Show me instructions (I'll run manually)
```

**Behavior:**
- Cannot proceed without A, B, or C selection
- Option A: Invoke devops agent in current session
- Option B: Publish DEVOPS_REQUEST via Redis MCP to separate CLI
- Option C: Output step-by-step instructions for manual execution

### Protected Path Commit

**Trigger:** Commit includes files in `contracts/` or `.claude/`

**Question Format:**
```
Committing to protected path: [path]
This affects project configuration.

Confirm? (Y/N)
```

**Behavior:**
- Cannot proceed without explicit Y response
- N response aborts the commit operation
- Any other response prompts for valid input

### Contract Change

**Trigger:** Any modification to `contracts/current/` or `contracts/versions/`

**Question Format:**
```
This changes a public API contract: [contract name]
Contract changes affect all consumers.

Have all consumers been notified? (Y/N)
```

**Behavior:**
- Cannot proceed without explicit Y response
- N response blocks the change
- User should notify consumers before confirming

### Destructive Workstation Operation

**Trigger:** rm -rf, kubectl delete, helm uninstall, docker system prune executed on workstation (not in container or Kubernetes)

**Question Format:**
```
Destructive operation on workstation: [command]
This cannot be undone.

Confirm? (Y/N)
```

**Behavior:**
- Cannot proceed without explicit Y response
- N response aborts the operation
- Gate is conditional on environment (see Environment Detection)

### Phase Gate

**Trigger:** All features in a phase are complete. Fires when `@phase-gate` skill runs validation.

**Question Format:**
```
Phase [N] validation complete:
 - Features: [N/N] complete
 - E2E: [pass/fail]
 - Open defects: [N] critical, [N] high

Options:
 A) Approve phase completion
 B) Address remaining issues
 C) Defer to next phase
```

**Behavior:**
- Cannot proceed without user response
- Option A: Mark phase complete in PLAN.md
- Option B: Return to fix issues
- Option C: Move issues to next phase backlog

## Advisory Gates

Advisory gates pause for user input but allow the user to proceed with acknowledgment. These provide oversight without blocking workflow.

### Refactor Approval

**Trigger:** After each TDD task's refactor phase completes (tdd-build Phase 3).

**Question Format:**
```
Refactor complete for [task]:
 - Changes: [summary]
 - Tests: all passing

Options:
 A) Approve refactor
 B) Request changes
 C) Revert refactor (keep pre-refactor code)
```

**Behavior:**
- Option A: Accept refactored code, proceed to next task
- Option B: Return to refactorer with feedback
- Option C: Revert to pre-refactor state, proceed to next task

### Test Failures Greater Than 3

**Trigger:** Same test has failed more than 3 consecutive times

**Question Format:**
```
Tests failing repeatedly ([N] times): [test name]

Options:
 A) Continue debugging
 B) Skip test and proceed (mark as known issue)
 C) Abort task
 D) Invoke debugger for analysis
```

**Behavior:**
- Option A: Continue TDD debugging loop
- Option B: Skip test, create GitHub issue for follow-up
- Option C: Abort current task
- Option D: Invoke the debugger agent (read-only) to produce a diagnostic report. After report, PM CLI re-presents options A-C with diagnostic context.

### Complex Operation

**Trigger:** Operation spans more than 10 files OR crosses backend and frontend domains OR mixes infrastructure with code changes

**Question Format:**
```
This operation is complex: [reason]

Options:
 A) Continue here (may take longer)
 B) Open new CLI with Chrome extension for [portion]
 C) Show instructions to paste in separate window
```

**Behavior:**
- Option A: Proceed in current session
- Option B: Split work, user opens separate CLI
- Option C: Output context and instructions for manual execution

## Gate Implementation Pattern

When implementing HITL gates, follow this pattern:

```
When [trigger detected]:
1. Pause current operation
2. Present question with options using AskUserQuestion tool
3. Wait for user response
4. Validate response format
   - If mandatory gate and no valid response: re-prompt, do not proceed
   - If advisory gate and user chooses to proceed: log acknowledgment
5. Log decision for audit trail
6. Continue or abort based on response
```

### Audit Logging

All HITL gate decisions are logged with:
- Timestamp
- Gate type (mandatory/advisory)
- Trigger condition
- User response
- Outcome (proceed/abort/modified)

## Environment Detection

Destructive Workstation Operation gate is conditional based on environment detection.

### Detection Logic

```bash
# Check if running in container
if [ -f "/.dockerenv" ]; then
    ISOLATED=true
fi

# Check if running in Kubernetes
if [ -n "$KUBERNETES_SERVICE_HOST" ]; then
    ISOLATED=true
fi
```

### Gate Behavior

| Environment | Detected By | Gate Behavior |
|-------------|-------------|---------------|
| Container | `/.dockerenv` exists | **Skip gate** - environment is isolated |
| Kubernetes | `KUBERNETES_SERVICE_HOST` set | **Skip gate** - environment is isolated |
| Workstation | Neither present | **Enforce gate** - require confirmation |

## Summary Table

| Gate | Step | Trigger | Type |
|------|------|---------|------|
| Design Review R2 | 2 | R2 critical concerns remain | Mandatory |
| User Gate | 2 | Planning artifacts complete | Mandatory |
| DevOps Invocation | 7 | Any devops operation | Mandatory |
| Protected Path Commit | 6 | `contracts/`, `.claude/` | Mandatory |
| Contract Change | 6 | API contract modification | Mandatory |
| Destructive Workstation | Any | rm, delete, prune | Mandatory |
| Phase Gate | Post-phase | All features complete | Mandatory |
| Refactor Approval | 3 | TDD refactor phase done | Advisory |
| Test Failures > 3 | 3 | Repeated test failures | Advisory |
| Complex Operation | Any | >10 files, cross-domain | Advisory |

## Integration with PM CLI

The PM CLI is responsible for enforcing all HITL gates. When delegating to agents:

1. Check if delegation triggers any gates
2. Present gate question to user before proceeding
3. Record user decision
4. Pass decision context to delegated agent if relevant

Agents themselves do not enforce HITL gates - they operate under the assumption that the PM CLI has already obtained necessary approvals.
