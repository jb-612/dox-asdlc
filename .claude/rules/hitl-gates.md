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

The Steer option is available at gates where iterative refinement is appropriate (Gate 0, Gate 5).

## Mandatory Gates

Mandatory gates block all progress until the user provides a valid response. These protect against irreversible or high-impact operations.

### Gate 0: Intent and Requirements Approval

**Trigger:** After planning artifacts (design.md, user_stories.md, tasks.md) are created in Step 2

**Question Format:**
```
Planning complete for [feature name]:
 - Design: [summary]
 - Stories: [count] user stories
 - Tasks: [count] atomic tasks

Options:
 A) Approve and proceed to implementation
 B) Steer: modify scope or approach (provide feedback)
 C) Reject and return to workplan
```

**Behavior:**
- Option A: Proceed to design review (Step 4)
- Option B: User provides feedback; planner revises artifacts. This is the "steer" mechanism -- the user can redirect without full rejection.
- Option C: Abort planning; return to Step 1 for re-scoping

### Gate 1: DevOps Invocation

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

### Gate 2: Protected Path Commit

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

### Gate 3: Contract Change

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

### Gate 4: Destructive Workstation Operation

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

## Advisory Gates

Advisory gates pause for user input but allow the user to proceed with acknowledgment. These provide oversight without blocking workflow.

### Gate 5: Design Review Concerns

**Trigger:** Reviewer agent found concerns during design review

**Question Format:**
```
Design review found [N] concerns:
 - [concern 1]
 - [concern 2]
 - ...

Options:
 A) Address concerns before proceeding
 B) Proceed anyway (acknowledge concerns)
 C) Abort this task
```

**Behavior:**
- Option A: Return to design phase to address concerns
- Option B: Continue with user acknowledgment logged
- Option C: Abort current task

### Gate 6: Test Failures Greater Than 3

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

### Gate 7: Complex Operation

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

Gate 4 (Destructive Workstation Operation) is conditional based on environment detection.

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

| Environment | Detected By | Gate 4 Behavior |
|-------------|-------------|-----------------|
| Container | `/.dockerenv` exists | **Skip gate** - environment is isolated |
| Kubernetes | `KUBERNETES_SERVICE_HOST` set | **Skip gate** - environment is isolated |
| Workstation | Neither present | **Enforce gate** - require confirmation |

### Rationale

In isolated environments (containers, Kubernetes pods), destructive operations are contained and recoverable. On a developer workstation, destructive operations can affect the host system and may be irreversible.

## Summary Table

| Gate | Trigger | Type | Question Summary |
|------|---------|------|------------------|
| Intent Approval | Planning complete | Mandatory | Approve / Steer / Reject |
| DevOps Invocation | Any devops operation | Mandatory | Run here / Send to CLI / Instructions |
| Protected Path Commit | `contracts/`, `.claude/` | Mandatory | Confirm Y/N |
| Contract Change | API contract modification | Mandatory | Consumers notified Y/N |
| Destructive Workstation | rm, delete, prune | Mandatory | Confirm Y/N |
| Design Review Concerns | Reviewer found concerns | Advisory | Address / Proceed / Abort |
| Test Failures > 3 | Repeated test failures | Advisory | Debug / Skip / Abort |
| Complex Operation | >10 files, cross-domain | Advisory | Continue / New CLI / Instructions |

## Integration with PM CLI

The PM CLI is responsible for enforcing all HITL gates. When delegating to agents:

1. Check if delegation triggers any gates
2. Present gate question to user before proceeding
3. Record user decision
4. Pass decision context to delegated agent if relevant

Agents themselves do not enforce HITL gates - they operate under the assumption that the PM CLI has already obtained necessary approvals.
