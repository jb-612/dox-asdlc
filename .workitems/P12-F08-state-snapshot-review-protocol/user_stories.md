# User Stories: P12-F08 State-Level Snapshotting & Review Protocol Enhancement

## Epic Reference

This feature addresses four governance and quality gaps: H8 (no state-level snapshotting), M3 (review not against original spec), M6 (no Git-forensic PR descriptions), and M7 (no per-task review). It implements Engineering Principle EP6 (State-Level Snapshotting), Guardrail G3 (Independent Review Protocol), and Guardrail G9 (Forensic Traceability).

## Epic Summary

As a project maintainer, I want before/after state snapshots per execution phase with spec-based review and forensic traceability, so that broken states are cleanly rolled back, reviews are grounded in specifications, and every PR carries a complete audit trail.

## User Stories

### US-F08-01: Create State Snapshot Before Agent Execution

**As a** PM CLI operator
**I want** to create a lightweight Git snapshot before delegating a task to an agent
**So that** I can restore the codebase to its pre-execution state if the agent produces broken output

**Acceptance Criteria:**
- [ ] `tools/snapshot.sh create <task-id>` creates a lightweight Git tag `_snap/<task-id>/before` at current HEAD
- [ ] Uncommitted working tree changes are captured via `git stash create` and the stash ref stored in metadata
- [ ] Snapshot metadata written to `.snapshots/<task-id>.json` with before_ref, before_sha, timestamp, agent, and feature
- [ ] Command completes in under 2 seconds for a typical repository
- [ ] Command is idempotent: calling create twice for the same task-id overwrites the previous snapshot
- [ ] Output follows standardized JSON format (via `tools/lib/common.sh emit_result`)
- [ ] Unit tests verify snapshot creation and metadata persistence

**Priority:** High

---

### US-F08-02: Capture State Snapshot After Agent Execution

**As a** PM CLI operator
**I want** to capture the post-execution state after an agent completes a task
**So that** I have a precise record of what changed and can generate diffs for review

**Acceptance Criteria:**
- [ ] `tools/snapshot.sh capture <task-id>` creates a lightweight Git tag `_snap/<task-id>/after`
- [ ] If there are uncommitted changes (agent did not commit), the after ref captures the working tree state
- [ ] Snapshot metadata updated with after_ref, after_sha, timestamp_after, files_actual
- [ ] `files_actual` is computed from `git diff` between before and after refs
- [ ] Command completes in under 2 seconds
- [ ] Unit tests verify capture and metadata update

**Priority:** High

---

### US-F08-03: Generate Diff Between Snapshots

**As a** reviewer or PM CLI operator
**I want** to view the diff between the before and after snapshots of a task
**So that** I can see exactly what the agent changed

**Acceptance Criteria:**
- [ ] `tools/snapshot.sh diff <task-id>` outputs the Git diff between before and after tags
- [ ] Supports `--format text` (default), `--format json`, and `--format stat` (summary only)
- [ ] JSON format includes file paths, line counts, and change types (add/modify/delete)
- [ ] Returns error if snapshot does not exist or is incomplete (missing before or after)
- [ ] Unit tests verify diff generation for all three formats

**Priority:** High

---

### US-F08-04: Rollback to Pre-Execution Snapshot

**As a** PM CLI operator
**I want** to rollback the working tree to the pre-execution snapshot when a review fails
**So that** the agent can retry from a clean slate without patching fundamentally broken code

**Acceptance Criteria:**
- [ ] `tools/snapshot.sh rollback <task-id>` restores the working tree to the before-snapshot state
- [ ] Test files are preserved by default during rollback (files matching `tests/**`)
- [ ] Additional files can be preserved via `--preserve <list>` flag
- [ ] Review artifacts in `.snapshots/` are preserved
- [ ] Rollback increments `rollback_count` in snapshot metadata
- [ ] Rollback logs the event with timestamp and reason in `retry_history`
- [ ] Returns error if no before-snapshot exists for the task
- [ ] Unit tests verify rollback restores correct state and preserves specified files

**Priority:** High

---

### US-F08-05: Cleanup Snapshot Data

**As a** developer
**I want** snapshot tags and metadata to be cleaned up after task completion
**So that** Git does not accumulate stale tags and the `.snapshots/` directory stays manageable

**Acceptance Criteria:**
- [ ] `tools/snapshot.sh cleanup <task-id>` removes `_snap/<task-id>/*` tags and optionally archives metadata
- [ ] `--archive` flag moves metadata to `.snapshots/archive/` instead of deleting
- [ ] `tools/snapshot.sh cleanup-all` removes all `_snap/` tags and metadata
- [ ] `--older-than <hours>` flag limits cleanup to snapshots older than N hours (default: 24)
- [ ] `.snapshots/` directory is listed in `.gitignore`
- [ ] Unit tests verify cleanup removes tags and handles archive correctly

**Priority:** Medium

---

### US-F08-06: Spec-Based Reviewer Checklist

**As a** code reviewer (reviewer agent)
**I want** to review agent output against the original design specification before judging code quality
**So that** review findings are grounded in what was actually requested, not just general best practices

**Acceptance Criteria:**
- [ ] Reviewer agent reads `design.md`, `tasks.md`, and `user_stories.md` before reviewing code
- [ ] Reviewer performs file scope adherence check: verifies agent only modified files listed in the task spec
- [ ] Reviewer performs logic fidelity check: verifies code changes match the task description
- [ ] Reviewer performs constraint compliance check: verifies diff does not violate path restrictions
- [ ] Reviewer performs test alignment check: verifies code changes are covered by passing tests
- [ ] Reviewer assigns a spec alignment score (0-100)
- [ ] Reviewer produces a structured spec alignment report in addition to standard review
- [ ] Updated `.claude/agents/reviewer.md` includes spec-based checklist items
- [ ] Reviewer remains READ-ONLY (no code modifications)

**Priority:** High

---

### US-F08-07: Per-Task Lightweight Review Script

**As a** PM CLI operator
**I want** a fast automated review script that runs after each atomic task
**So that** obvious issues (scope violations, test failures, lint errors) are caught immediately, not deferred to Step 8

**Acceptance Criteria:**
- [ ] `tools/task-review.sh <task-id>` runs all automated checks and produces a JSON report
- [ ] Checks include: file scope adherence, test coverage existence, test pass, lint, style compliance, diff size
- [ ] Total execution time is under 30 seconds for typical tasks
- [ ] Exit code 0 = all checks passed, exit code 1 = one or more failed, exit code 2 = script error
- [ ] Report written to `.snapshots/<task-id>-review.json` with per-check pass/fail and details
- [ ] `--skip <checks>` flag allows bypassing specific checks
- [ ] `--timeout <seconds>` flag enforces maximum execution time (default: 30)
- [ ] Unit tests verify each check individually and the overall script behavior

**Priority:** High

---

### US-F08-08: Git-Forensic PR Description Generator

**As an** orchestrator agent
**I want** to automatically generate PR descriptions that include forensic traceability information
**So that** every PR carries a complete audit trail with Task ID, spec alignment, review status, and test results

**Acceptance Criteria:**
- [ ] `scripts/generate-pr-description.sh <feature-dir>` generates a Markdown PR description
- [ ] Description includes: Task ID, feature reference, design spec path
- [ ] Description includes: files changed table with line counts and purpose
- [ ] Description includes: spec alignment section (intended vs actual, alignment score)
- [ ] Description includes: review status table with per-check results
- [ ] Description includes: test results summary
- [ ] Description includes: reasoning log reference (placeholder for P12-F03 integration)
- [ ] Description includes: retry count and debugging trace (if any)
- [ ] `--task <task-id>` flag generates description for a specific task (default: full feature)
- [ ] `--format abbreviated` produces a shorter version suitable for commit messages
- [ ] Output is compatible with `gh pr create --body-file`
- [ ] Unit tests verify template generation for various scenarios

**Priority:** Medium

---

### US-F08-09: Git-Forensic PR Template

**As a** developer
**I want** a standard PR template in the repository that prompts for forensic information
**So that** PRs created manually or via automation follow the same traceability format

**Acceptance Criteria:**
- [ ] `.github/PULL_REQUEST_TEMPLATE/forensic.md` created with forensic template sections
- [ ] Template includes placeholder sections for: Task Reference, Changes Summary, Spec Alignment, Review Status, Test Results, Reasoning Log, Debugging Trace
- [ ] Template is usable both as a manual fill-in and as a target for automated generation
- [ ] Template does not break existing GitHub PR creation workflows

**Priority:** Low

---

### US-F08-10: Rollback-on-Failure Workflow with Retry Escalation

**As a** PM CLI operator
**I want** an automated rollback-and-retry workflow when per-task review fails
**So that** agents retry from a clean state with review feedback, escalating to HITL after 3 failures

**Acceptance Criteria:**
- [ ] When per-task review fails and retry_count < 3: PM CLI rolls back, re-delegates with review feedback
- [ ] Each retry includes: original task spec, cumulative review feedback, current retry count, diff from last attempt
- [ ] retry_count is tracked in snapshot metadata
- [ ] retry_history records each attempt with result, reason, and timestamp
- [ ] When retry_count reaches 3: HITL Gate 6 (extended) is triggered
- [ ] Gate 6 extended options: A) debugger, B) guided retry, C) skip+issue, D) abort
- [ ] Rollback preserves test files and review artifacts
- [ ] Workflow documented in `.claude/rules/workflow.md` (Steps 6, 8)

**Priority:** High

---

### US-F08-11: Extended HITL Gate 6

**As a** human operator
**I want** the HITL Gate 6 to include rollback-retry context when maximum retries are exhausted
**So that** I can make an informed decision about how to proceed with a persistently failing task

**Acceptance Criteria:**
- [ ] Gate 6 extended format shows: task ID, retry count, feedback summary from each attempt
- [ ] Options include: debugger invocation (A), guided retry with user input (B), skip with issue creation (C), abort (D)
- [ ] Option A integrates with P12-F01 debugger agent if available; otherwise not shown
- [ ] Option B prompts user for specific guidance, then rolls back and retries
- [ ] Option C creates a GitHub issue with the failure context and moves to next task
- [ ] `.claude/rules/hitl-gates.md` updated with extended Gate 6 specification
- [ ] Gate decision is logged for audit trail

**Priority:** High

---

### US-F08-12: Update Workflow Rules Documentation

**As a** project maintainer
**I want** the 11-step workflow documentation to reflect the new snapshot, review, and PR protocols
**So that** all agents and operators follow the updated process

**Acceptance Criteria:**
- [ ] `.claude/rules/workflow.md` Step 6 updated with snapshot create/capture/review/rollback cycle
- [ ] `.claude/rules/workflow.md` Step 8 updated with spec-based review protocol
- [ ] `.claude/rules/workflow.md` Step 9 updated with forensic PR description generation
- [ ] `.claude/skills/tdd-execution/SKILL.md` updated with snapshot integration
- [ ] `.claude/skills/feature-completion/SKILL.md` updated with forensic PR step
- [ ] All documentation changes are internally consistent

**Priority:** Medium

---

### US-F08-13: Guardrails Guidelines for Snapshot and Review Protocol

**As a** guardrails administrator
**I want** guidelines that enforce snapshot creation and spec-based review
**So that** the protocols are dynamically enforced via the guardrails system

**Acceptance Criteria:**
- [ ] `snapshot-protocol` guideline created in bootstrap script with category `audit_telemetry`, priority 850
- [ ] `spec-based-review` guideline created in bootstrap script with category `context_constraint`, priority 800
- [ ] Guidelines are idempotent (bootstrap can be run repeatedly)
- [ ] Guidelines condition-match correctly for implementation and review actions
- [ ] Unit tests verify guideline evaluation matches expected contexts

**Priority:** Medium

---

### US-F08-14: Snapshot Status Reporting

**As a** PM CLI operator
**I want** to check the current snapshot status for a task
**So that** I can understand the state of the snapshot lifecycle at any point

**Acceptance Criteria:**
- [ ] `tools/snapshot.sh status <task-id>` outputs the current snapshot metadata as JSON
- [ ] Status includes: before/after refs, rollback count, retry history, review status
- [ ] Returns informative error if no snapshot exists for the task
- [ ] Unit tests verify status output for various lifecycle stages

**Priority:** Low

---

## Non-Functional Requirements

### Performance

- Snapshot create and capture complete in < 2 seconds each
- Per-task review completes in < 30 seconds
- Snapshot diff generation completes in < 5 seconds
- Rollback completes in < 5 seconds
- PR description generation completes in < 10 seconds

### Reliability

- Snapshot tool is idempotent for create/cleanup operations
- Rollback preserves test files and review artifacts
- Cleanup handles missing or corrupt metadata gracefully
- Per-task review handles missing dependencies (pytest, lint) with clear error messages

### Maintainability

- All tools follow existing `tools/lib/common.sh` patterns for JSON output
- All scripts have usage documentation (`--help`)
- Unit tests cover success, failure, and edge cases for each tool
- Snapshot metadata format is documented in design.md

### Security

- `.snapshots/` directory is gitignored to prevent metadata leakage
- PR descriptions do not include raw file contents
- Snapshot tags use `_snap/` prefix to avoid collision with user tags
- Rollback does not affect files outside the repository

## Story Dependencies

```
US-F08-01 (Snapshot Create)
    |
    +---> US-F08-02 (Snapshot Capture)
    |         |
    |         +---> US-F08-03 (Snapshot Diff)
    |         |
    |         +---> US-F08-04 (Rollback)
    |                   |
    |                   +---> US-F08-10 (Rollback Workflow)
    |                   |         |
    |                   |         +---> US-F08-11 (Extended Gate 6)
    |                   |
    |                   +---> US-F08-07 (Per-Task Review)
    |
    +---> US-F08-05 (Cleanup)
    |
    +---> US-F08-14 (Status)

US-F08-06 (Spec-Based Review)
    |
    +---> US-F08-12 (Workflow Documentation)

US-F08-08 (PR Description Generator)
    |
    +---> US-F08-09 (PR Template)

US-F08-13 (Guardrails Guidelines)
    depends on US-F08-01 and US-F08-06

US-F08-12 (Workflow Documentation)
    depends on US-F08-01, US-F08-06, US-F08-07, US-F08-08, US-F08-10
```

## Priority Summary

| Priority | Stories |
|----------|---------|
| High | US-F08-01, 02, 03, 04, 06, 07, 10, 11 |
| Medium | US-F08-05, 08, 12, 13 |
| Low | US-F08-09, 14 |
