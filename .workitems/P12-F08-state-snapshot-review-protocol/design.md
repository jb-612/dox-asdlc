# P12-F08: State-Level Snapshotting & Review Protocol Enhancement

## Technical Design

**Version:** 1.0
**Date:** 2026-02-09
**Status:** Draft

## 1. Overview

Implement state-level snapshotting, spec-based review protocol, Git-forensic PR descriptions, per-task lightweight review, and rollback-on-failure workflows. This addresses four gaps in the Guardrails Constitution: H8 (no state-level snapshotting), M3 (review not against original spec), M6 (no Git-forensic PR descriptions), and M7 (no per-task review).

### 1.1 Goals

1. Create a **State Snapshot Manager** using lightweight Git plumbing for before/after snapshots per execution phase
2. Implement a **rollback-to-snapshot** mechanism triggered on reviewer rejection, with retry escalation and HITL fallback
3. Update the **reviewer agent** to perform spec-based review against design.md and tasks.md (not just code diff)
4. Add **Logic-Reality Alignment** checks: file scope adherence, logic fidelity, constraint compliance, test alignment
5. Create a **Git-Forensic PR template** with Task ID, reasoning log reference, diff summary, and review status
6. Implement **per-task lightweight review** as an automated script (`./tools/task-review.sh`) that runs fast (<30 seconds) checks after each atomic task
7. Add a **rollback-on-failure workflow** with maximum 3 retries before HITL escalation (Gate 6 extended)

### 1.2 Non-Goals

- Replacing the existing reviewer agent (it is enhanced, not replaced)
- Full reviewer agent invocation per micro-task (too expensive in token cost)
- Creating permanent Git branches for snapshots (must be lightweight)
- Modifying the multi-review skill (Step 8 feature-level review is unchanged)
- In-memory diffing or non-Git snapshot mechanisms (Git plumbing is the source of truth)
- Changes to the deployment pipeline or CI/CD system

## 2. Dependencies

### 2.1 Internal Dependencies

| Dependency | Status | Description |
|------------|--------|-------------|
| P01-F06 | Complete | Trunk-based development with revert authority |
| P04-F05 | Complete | Parallel review swarm (multi-review skill) |
| P11-F01 | Complete (95%) | Guardrails configuration system |
| P12-F01 | Draft | TDD separation (test-writer/debugger agents) |
| `.claude/agents/reviewer.md` | Exists | Current reviewer agent definition |
| `.claude/skills/tdd-execution/SKILL.md` | Exists | Current TDD workflow |
| `.claude/skills/feature-completion/SKILL.md` | Exists | Feature completion validation |
| `tools/test.sh` | Exists | Test runner |
| `tools/lint.sh` | Exists | Linter |

### 2.2 External Dependencies

- `git` (already available on workstation) -- uses plumbing commands (`git stash create`, `git tag`, `git diff`, `git stash apply`)
- No new Python packages required
- No new npm packages required

### 2.3 Relationship to P12-F01

P12-F01 introduces the test-writer and debugger agents. P12-F08 operates orthogonally:

- Snapshots are taken before/after ANY agent execution, including test-writer and debugger
- Rollback-on-failure integrates with P12-F01's debugger escalation at Gate 6 (if P12-F01 is implemented, the debugger is option A at Gate 6; rollback-and-retry becomes an additional option)
- Spec-based review applies to all agents' output, including test-writer's tests

P12-F08 can be implemented independently of P12-F01. If P12-F01 is complete first, the snapshot manager will wrap the three-agent TDD flow. If P12-F08 is complete first, P12-F01 will integrate with the snapshot infrastructure.

## 3. Architecture

### 3.1 Component Overview

```
                   PM CLI (Orchestration)
                          |
              +-----------+-----------+
              |                       |
     Snapshot Manager          Task Review Script
     (Git plumbing)           (./tools/task-review.sh)
              |                       |
              |     +-----------------+
              |     |
              v     v
        +------------------+
        |  Spec-Based      |
        |  Review Protocol |
        |  (Enhanced       |
        |   Reviewer)      |
        +------------------+
              |
              v
        +------------------+
        | Rollback-on-     |
        | Failure Workflow  |
        +------------------+
              |
              v
        +------------------+
        | Git-Forensic PR  |
        | Template         |
        +------------------+
```

### 3.2 State Snapshot Manager

The Snapshot Manager is a bash tool (`tools/snapshot.sh`) that uses Git plumbing to create lightweight snapshots before and after agent execution. It does NOT create branches.

**Mechanism:** Git tags prefixed with `_snap/` and ephemeral `git stash create` refs.

```
Snapshot Lifecycle:

  1. Before agent execution:
     $ tools/snapshot.sh create <task-id>
     -> Creates: _snap/<task-id>/before
        (lightweight tag at current HEAD)
     -> Stages+stashes uncommitted changes:
        _snap/<task-id>/stash (stash ref)

  2. After agent execution:
     $ tools/snapshot.sh capture <task-id>
     -> Creates: _snap/<task-id>/after
        (lightweight tag at current HEAD
         or tree-ref if uncommitted changes)
     -> Generates diff: before..after
     -> Records metadata to .snapshots/

  3. On review failure (rollback):
     $ tools/snapshot.sh rollback <task-id>
     -> Restores working tree to 'before' state
     -> Preserves test files and review artifacts
     -> Logs rollback event to snapshot metadata

  4. On task completion (cleanup):
     $ tools/snapshot.sh cleanup <task-id>
     -> Removes _snap/<task-id>/* tags
     -> Removes stash refs
     -> Archives metadata to .snapshots/archive

  5. Bulk cleanup:
     $ tools/snapshot.sh cleanup-all
     -> Removes ALL _snap/ tags
     -> Cleans stale entries older than 24hr
```

**Snapshot Metadata (`.snapshots/<task-id>.json`):**

```json
{
  "task_id": "T01",
  "feature": "P12-F08-state-snapshot-review-protocol",
  "agent": "backend",
  "before_ref": "_snap/T01/before",
  "after_ref": "_snap/T01/after",
  "stash_ref": "stash@{0}",
  "before_sha": "abc1234",
  "after_sha": "def5678",
  "timestamp_before": "2026-02-09T10:00:00Z",
  "timestamp_after": "2026-02-09T10:15:00Z",
  "files_expected": ["src/core/snapshot.py", "tests/unit/test_snapshot.py"],
  "files_actual": ["src/core/snapshot.py", "tests/unit/test_snapshot.py"],
  "status": "captured",
  "rollback_count": 0,
  "review_status": null
}
```

**Rollback Behavior:**

Rollback restores the working tree to the 'before' state but **preserves**:
- Test files created by the test-writer (if P12-F01 is active)
- Review artifacts in `.snapshots/`
- Any files explicitly listed in `--preserve` flag

This ensures that on retry, the agent has the original spec context plus the review feedback, without carrying forward fundamentally broken code.

**Cleanup Policy:**

- Tags and stash refs are cleaned on task completion
- Metadata is archived (moved to `.snapshots/archive/`) for audit trail
- `cleanup-all` removes everything older than 24 hours
- `.snapshots/` is added to `.gitignore` to prevent committing metadata

### 3.3 Spec-Based Review Protocol

The enhanced reviewer workflow requires the reviewer to compare agent output against the original specification before judging code quality.

**Updated Reviewer Workflow:**

```
  1. Read Specification:
     - .workitems/<feature>/design.md (architecture, interfaces)
     - .workitems/<feature>/tasks.md (specific task being reviewed)
     - .workitems/<feature>/user_stories.md (acceptance criteria)

  2. Read Snapshot Diff:
     - tools/snapshot.sh diff <task-id>
     - Get list of files changed and their diffs

  3. Logic-Reality Alignment Checks:
     a) File Scope Adherence:
        - Compare files_actual (from snapshot) vs files_expected (from task spec)
        - Flag any files modified outside the task's listed scope
     b) Logic Fidelity:
        - Cross-check code changes against the task description
        - Verify the implementation matches the stated approach
     c) Constraint Compliance:
        - Verify diff does not violate path restrictions (from guardrails)
        - Verify no changes to Red Zone files (protected paths)
     d) Test Alignment:
        - Verify code changes are covered by passing tests
        - Run: tools/test.sh <relevant-test-path>

  4. Standard Review Checklist (existing):
     - Code quality, security, project standards, architecture

  5. Generate Structured Review Report:
     - Spec alignment score (0-100)
     - Logic-Reality alignment results per check
     - Standard review findings (Critical/Warning/Suggestion)
     - Overall pass/fail recommendation
```

**Review Report Format (appended to snapshot metadata):**

```json
{
  "review_result": {
    "passed": false,
    "spec_alignment_score": 72,
    "checks": {
      "file_scope_adherence": {
        "passed": true,
        "expected_files": ["src/core/snapshot.py"],
        "actual_files": ["src/core/snapshot.py"],
        "extra_files": [],
        "missing_files": []
      },
      "logic_fidelity": {
        "passed": false,
        "reason": "Task spec says to implement snapshot create, but the create method is missing error handling for existing tags."
      },
      "constraint_compliance": {
        "passed": true,
        "violations": []
      },
      "test_alignment": {
        "passed": true,
        "tests_run": 8,
        "tests_passed": 8,
        "coverage_files": ["src/core/snapshot.py"]
      }
    },
    "findings": [
      {
        "severity": "critical",
        "category": "logic_fidelity",
        "title": "Missing error handling in snapshot create",
        "description": "...",
        "file": "src/core/snapshot.py",
        "line": 42,
        "recommendation": "..."
      }
    ],
    "recommendation": "REJECT - Address logic fidelity issue before proceeding"
  }
}
```

### 3.4 Per-Task Lightweight Review

A fast automated review script that runs after each atomic task completion. This is NOT a full reviewer agent invocation. It performs deterministic checks only.

**Script: `tools/task-review.sh <task-id> [--feature <feature-dir>]`**

**Checks (must complete in <30 seconds):**

| Check | Method | Pass Criteria |
|-------|--------|---------------|
| File Scope Adherence | Compare snapshot files_actual vs task expected files | No extra files outside scope |
| Test Coverage | Run `pytest --co -q` to verify test files exist | At least 1 test per source file changed |
| Test Pass | Run `pytest <relevant-tests> --tb=short -q` | All tests pass |
| Lint | Run `./tools/lint.sh <changed-files>` | No lint errors |
| Style Compliance | Check type hints and docstrings on new functions | All public functions have type hints |
| Diff Size | Count lines changed | Warn if > 300 lines changed |

**Output: JSON report written to `.snapshots/<task-id>-review.json`**

```json
{
  "task_id": "T01",
  "timestamp": "2026-02-09T10:16:00Z",
  "duration_seconds": 12.5,
  "passed": true,
  "checks": {
    "file_scope": {"passed": true, "details": "2 files modified, all in scope"},
    "test_coverage": {"passed": true, "details": "2 test files found for 1 source file"},
    "test_pass": {"passed": true, "details": "8/8 tests passed"},
    "lint": {"passed": true, "details": "No lint errors"},
    "style": {"passed": true, "details": "All public functions have type hints"},
    "diff_size": {"passed": true, "details": "47 lines added, 3 lines removed"}
  },
  "warnings": []
}
```

**Integration with Workflow:**

- Step 6 (Parallel Build): After each atomic task, PM CLI runs `tools/task-review.sh <task-id>` before marking the task as complete
- If task-review fails: PM CLI can immediately trigger rollback + retry without waiting for Step 8
- Step 8 (Review): Full reviewer agent invocation at feature level remains unchanged
- This creates a two-tier review system: fast automated checks per task, thorough agent review per feature

### 3.5 Git-Forensic PR Template

A PR description template that includes forensic traceability information. Generated by the orchestrator during Step 9 (Orchestration) when preparing commits.

**Template: `.github/PULL_REQUEST_TEMPLATE/forensic.md`**

The template is also available as a script for programmatic generation:

**Script: `scripts/generate-pr-description.sh <feature-dir> [--task <task-id>]`**

**Generated PR Description Structure:**

```markdown
## Feature: P12-F08 State-Level Snapshotting & Review Protocol

### Task Reference
- **Task ID:** T01 - Create Snapshot Manager Tool
- **Feature:** P12-F08-state-snapshot-review-protocol
- **Design Spec:** `.workitems/P12-F08-state-snapshot-review-protocol/design.md`

### Changes Summary
| File | Lines Added | Lines Removed | Purpose |
|------|-------------|---------------|---------|
| tools/snapshot.sh | +180 | -0 | New snapshot manager tool |
| tests/unit/tools/test_snapshot.sh | +95 | -0 | Unit tests for snapshot manager |

### Spec Alignment
- **Intended:** Create git-based snapshot tool with create/capture/rollback/cleanup commands
- **Actual:** Implemented all 4 commands with metadata persistence
- **Spec Alignment Score:** 95/100

### Review Status
| Check | Result |
|-------|--------|
| File Scope Adherence | PASS - 2 files modified, all in task scope |
| Logic Fidelity | PASS - Implementation matches task description |
| Constraint Compliance | PASS - No path violations |
| Test Alignment | PASS - 8/8 tests pass |
| Per-Task Review | PASS - All automated checks passed |

### Test Results
- Unit Tests: 8 passed, 0 failed
- Integration Tests: 3 passed, 0 failed
- Lint: Clean

### Reasoning Log
- CoT Reference: `.snapshots/T01-reasoning.md` (if P12-F03 is active)
- Retry Count: 0

### Debugging Trace
- No debugging was required for this task.
```

**Integration with `gh pr create`:**

The orchestrator generates this description via the script and passes it to `gh pr create --body-file`:

```bash
# Generate PR description
./scripts/generate-pr-description.sh .workitems/P12-F08-state-snapshot-review-protocol --task T01 > /tmp/pr-body.md

# Create PR (if using feature branches via worktree)
gh pr create --title "feat(P12-F08): State snapshot manager" --body-file /tmp/pr-body.md
```

For trunk-based commits (no PR), the description is included in the commit message body (abbreviated form).

### 3.6 Rollback-on-Failure Workflow

When the reviewer (or per-task review) rejects the output, the system rolls back to the pre-execution snapshot and retries with additional context.

```
  Agent produces output
         |
         v
  Per-task review (tools/task-review.sh)
         |
    +----+----+
    |         |
  PASS      FAIL
    |         |
    v         v
  Continue  retry_count < 3?
              |         |
            YES        NO
              |         |
              v         v
         Rollback    HITL Gate 6 (Extended)
              |
              v       Options:
         Re-delegate    A) Invoke debugger (P12-F01)
         task with:     B) Rollback and retry with human guidance
           - Review     C) Skip task, create issue
             feedback   D) Abort feature
           - Original
             spec
           - Retry
             count
```

**Extended Gate 6 (when rollback retry count exhausted):**

```
Task [task-id] has failed review [3] times after rollback.

Review feedback summary:
  - [feedback from each attempt]

Options:
 A) Invoke debugger agent for root-cause analysis
 B) Rollback and retry with your guidance
 C) Skip task and proceed (create GitHub issue)
 D) Abort feature
```

**Retry Context Injection:**

On each retry, the agent receives:
1. Original task spec (from tasks.md)
2. Cumulative review feedback from all previous attempts
3. Current retry count
4. Diff from the last failed attempt (for reference)

This ensures the agent does not repeat the same mistakes.

**Metadata Tracking:**

The snapshot metadata tracks retry state:

```json
{
  "task_id": "T01",
  "status": "retry",
  "rollback_count": 2,
  "retry_history": [
    {
      "attempt": 1,
      "review_result": "REJECT",
      "reason": "File scope violation: modified src/unrelated.py",
      "timestamp": "2026-02-09T10:16:00Z"
    },
    {
      "attempt": 2,
      "review_result": "REJECT",
      "reason": "Test alignment failure: 2 tests failing",
      "timestamp": "2026-02-09T10:30:00Z"
    }
  ]
}
```

## 4. Updated Agent Definitions

### 4.1 Reviewer Agent Enhancement

**File to modify:** `.claude/agents/reviewer.md`

The reviewer agent's prompt is updated to include spec-based review:

**Additions to review checklist:**

```markdown
**Spec Alignment (NEW - check FIRST):**
- [ ] Read design.md and tasks.md before reviewing code
- [ ] File scope adherence: agent only modified files listed in task
- [ ] Logic fidelity: code changes match task description and design approach
- [ ] Constraint compliance: diff does not violate path restrictions or Red Zones
- [ ] Test alignment: code changes covered by passing tests
- [ ] Spec alignment score assigned (0-100)
```

**Additions to review output:**

```markdown
## Spec Alignment Report
- Spec Alignment Score: [0-100]
- File Scope: [PASS/FAIL] - [details]
- Logic Fidelity: [PASS/FAIL] - [details]
- Constraint Compliance: [PASS/FAIL] - [details]
- Test Alignment: [PASS/FAIL] - [details]
```

The reviewer remains READ-ONLY. The new checks are observational, not modification-based.

### 4.2 Guardrails Guidelines

Two new guardrails guidelines will be added to the bootstrap script:

#### snapshot-protocol

```json
{
  "id": "snapshot-protocol",
  "name": "State Snapshot Protocol",
  "description": "Requires state snapshots before and after each agent execution phase.",
  "enabled": true,
  "category": "audit_telemetry",
  "priority": 850,
  "condition": {
    "actions": ["implement", "code", "fix", "refactor", "test"]
  },
  "action": {
    "type": "constraint",
    "instruction": "Before executing any implementation task, the PM CLI must create a snapshot via tools/snapshot.sh create <task-id>. After execution, capture via tools/snapshot.sh capture <task-id>. On review failure, rollback via tools/snapshot.sh rollback <task-id>. Maximum 3 retries before HITL escalation."
  }
}
```

#### spec-based-review

```json
{
  "id": "spec-based-review",
  "name": "Spec-Based Review Protocol",
  "description": "Requires reviewer to compare output against original design specification.",
  "enabled": true,
  "category": "context_constraint",
  "priority": 800,
  "condition": {
    "agents": ["reviewer"],
    "actions": ["review"]
  },
  "action": {
    "type": "constraint",
    "instruction": "Before reviewing code, read the relevant design.md, tasks.md, and user_stories.md. Compare the actual diff against the task specification. Perform Logic-Reality Alignment checks: file scope adherence, logic fidelity, constraint compliance, test alignment. Assign a spec alignment score (0-100). The reviewer is strictly forbidden from fixing code; only identify failures.",
    "require_review": true
  }
}
```

## 5. Workflow Integration

### 5.1 Updated Step 6 (Parallel Build)

```
Step 6: Parallel Build (Updated with Snapshots)
  For each atomic task:
    1. PM CLI creates snapshot: tools/snapshot.sh create <task-id>
    2. PM CLI delegates task to agent
    3. Agent completes task
    4. PM CLI captures snapshot: tools/snapshot.sh capture <task-id>
    5. PM CLI runs per-task review: tools/task-review.sh <task-id>
    6. If per-task review PASSES: mark task complete, cleanup snapshot
    7. If per-task review FAILS and retry_count < 3:
       a. Rollback: tools/snapshot.sh rollback <task-id>
       b. Re-delegate task with review feedback
       c. Increment retry_count
       d. Go to step 2
    8. If per-task review FAILS and retry_count >= 3:
       a. Trigger HITL Gate 6 (extended)
       b. User selects option (debugger/guidance/skip/abort)
```

### 5.2 Updated Step 8 (Review)

```
Step 8: Review (Updated with Spec-Based Review)
  1. Reviewer reads design.md, tasks.md, user_stories.md
  2. Reviewer reads feature-level diff (all tasks combined)
  3. Reviewer performs Logic-Reality Alignment checks
  4. Reviewer performs standard code review checklist
  5. Reviewer assigns spec alignment score
  6. Reviewer generates structured review report
  7. All findings become GitHub issues (unchanged)
  8. If reviewer REJECTS the feature:
     a. PM CLI identifies specific failing tasks
     b. Rollback to relevant snapshots
     c. Re-delegate failed tasks with reviewer feedback
     d. Return to Step 7 (Testing) after fixes
```

### 5.3 Updated Step 9 (Orchestration)

```
Step 9: Orchestration (Updated with Forensic PR)
  1. Orchestrator generates PR description: scripts/generate-pr-description.sh
  2. Description includes: Task IDs, spec alignment, review status, test results
  3. For trunk-based commits: abbreviated forensic info in commit message body
  4. For worktree branches: full forensic PR description with gh pr create
  5. Snapshot cleanup: tools/snapshot.sh cleanup-all
```

### 5.4 Updated HITL Gate 6

Gate 6 is extended to include rollback-and-retry context:

```
Task [task-id] has failed review after [N] rollback+retry attempts.

Previous attempt feedback:
  Attempt 1: [summary of review feedback]
  Attempt 2: [summary of review feedback]
  Attempt 3: [summary of review feedback]

Options:
 A) Invoke debugger agent for root-cause analysis
 B) Rollback and retry with your guidance (describe what to do differently)
 C) Skip task and proceed (mark as known issue, create GitHub issue)
 D) Abort feature
```

## 6. File Structure

### 6.1 Files to Create

| File | Owner | Purpose |
|------|-------|---------|
| `tools/snapshot.sh` | backend | State Snapshot Manager (Git plumbing tool) |
| `tools/lib/parsers/snapshot.sh` | backend | Snapshot output parser |
| `tools/task-review.sh` | backend | Per-task lightweight review script |
| `scripts/generate-pr-description.sh` | orchestrator | Git-Forensic PR description generator |
| `.github/PULL_REQUEST_TEMPLATE/forensic.md` | orchestrator | PR template for forensic traceability |
| `.snapshots/.gitignore` | orchestrator | Ensure .snapshots contents are not committed |
| `tests/unit/tools/test_snapshot.sh` | backend | Unit tests for snapshot.sh |
| `tests/unit/tools/test_task_review.sh` | backend | Unit tests for task-review.sh |
| `tests/unit/scripts/test_generate_pr_description.sh` | backend | Unit tests for PR generator |

### 6.2 Files to Modify

| File | Owner | Purpose |
|------|-------|---------|
| `.claude/agents/reviewer.md` | orchestrator | Add spec-based review checklist |
| `.claude/skills/tdd-execution/SKILL.md` | orchestrator | Add snapshot create/capture around task execution |
| `.claude/skills/feature-completion/SKILL.md` | orchestrator | Add forensic PR generation step |
| `.claude/rules/workflow.md` | orchestrator | Update Steps 6, 8, 9 with snapshot/review changes |
| `.claude/rules/hitl-gates.md` | orchestrator | Extend Gate 6 with rollback-retry options |
| `scripts/bootstrap_guardrails.py` | backend | Add 2 new guideline definitions |
| `.gitignore` | orchestrator | Add `.snapshots/` exclusion |

### 6.3 Directory Structure

```
tools/
  snapshot.sh                    # State Snapshot Manager
  task-review.sh                 # Per-task lightweight review
  lib/
    parsers/
      snapshot.sh                # Snapshot output parser

scripts/
  generate-pr-description.sh     # Git-Forensic PR generator

.github/
  PULL_REQUEST_TEMPLATE/
    forensic.md                  # Forensic PR template

.snapshots/                      # Runtime snapshot metadata (gitignored)
  .gitignore                     # Ensure contents stay local
  T01.json                       # Snapshot metadata per task
  T01-review.json                # Per-task review results
  archive/                       # Archived completed snapshots

tests/
  unit/
    tools/
      test_snapshot.sh           # Snapshot tool tests
      test_task_review.sh        # Task review tests
    scripts/
      test_generate_pr_description.sh  # PR generator tests
```

## 7. Interface Contracts

### 7.1 Snapshot Manager CLI

```
tools/snapshot.sh <command> <task-id> [options]

Commands:
  create <task-id>          Create a before-snapshot for a task
    --feature <dir>         Feature work item directory
    --agent <name>          Agent performing the task
    --expected-files <list> Comma-separated list of expected files

  capture <task-id>         Create an after-snapshot for a task

  diff <task-id>            Show diff between before and after snapshots
    --format <fmt>          Output format: text (default), json, stat

  rollback <task-id>        Rollback working tree to before-snapshot state
    --preserve <list>       Comma-separated files to preserve during rollback

  cleanup <task-id>         Remove snapshot tags and metadata for a task
    --archive               Move metadata to archive instead of deleting

  cleanup-all               Remove all snapshot data
    --older-than <hours>    Only remove snapshots older than N hours (default: 24)

  status <task-id>          Show current snapshot status and metadata

Output: JSON (standardized via tools/lib/common.sh emit_result pattern)
```

### 7.2 Task Review CLI

```
tools/task-review.sh <task-id> [options]

Options:
  --feature <dir>           Feature work item directory
  --snapshot-dir <dir>      Directory for snapshot metadata (default: .snapshots/)
  --timeout <seconds>       Maximum execution time (default: 30)
  --skip <checks>           Comma-separated checks to skip

Output: JSON report to .snapshots/<task-id>-review.json
Exit codes:
  0 = All checks passed
  1 = One or more checks failed
  2 = Script error (timeout, missing deps)
```

### 7.3 PR Description Generator CLI

```
scripts/generate-pr-description.sh <feature-dir> [options]

Options:
  --task <task-id>          Generate for a specific task (default: all tasks)
  --format <fmt>            Output format: markdown (default), abbreviated
  --output <file>           Write to file (default: stdout)

Output: Markdown PR description to stdout or file
```

### 7.4 PM CLI Orchestration Contract

The PM CLI follows this sequence for each task with snapshot support:

```
1. Create snapshot:
   tools/snapshot.sh create <task-id> --feature <dir> --agent <agent>

2. Delegate task:
   Task(agent: backend, task: "<task-description>")

3. Capture snapshot:
   tools/snapshot.sh capture <task-id>

4. Run per-task review:
   tools/task-review.sh <task-id> --feature <dir>

5. If review passes (exit 0):
   tools/snapshot.sh cleanup <task-id> --archive
   Mark task [x] in tasks.md

6. If review fails (exit 1) and retry_count < 3:
   tools/snapshot.sh rollback <task-id> --preserve tests/
   Re-delegate with review feedback
   retry_count++

7. If review fails (exit 1) and retry_count >= 3:
   HITL Gate 6 (extended)
   User selects option
```

## 8. Security Considerations

1. **Snapshot tag namespace**: All snapshot tags use `_snap/` prefix to avoid collision with user tags. Tags are lightweight (no tag objects), minimizing Git overhead.

2. **Rollback safety**: Rollback preserves test files and review artifacts by default. The `--preserve` flag is explicit. No data loss occurs beyond the intended reversal of agent changes.

3. **Stash handling**: `git stash create` produces a stash-like commit but does NOT modify the stash reflog. This avoids interfering with the user's own stash entries. The ref is stored in snapshot metadata only.

4. **Snapshot metadata privacy**: `.snapshots/` is gitignored. Metadata stays local and is not committed. This prevents leaking task-level execution details into the repository history.

5. **PR description sanitization**: The PR description generator does not include raw file contents or credentials. It references file paths and line counts only.

## 9. Performance Considerations

1. **Snapshot creation**: `git tag` and `git stash create` are constant-time O(1) operations. No performance concern.

2. **Snapshot diff**: `git diff <tag>..<tag>` is proportional to the size of changes, not the repository. Typically <100ms.

3. **Per-task review**: Target <30 seconds total. Individual checks:
   - File scope check: <1 second (JSON comparison)
   - Test discovery: <2 seconds (`pytest --co -q`)
   - Test execution: <20 seconds (scoped to task-relevant tests)
   - Lint: <5 seconds (scoped to changed files)
   - Style check: <2 seconds (grep for type hints)

4. **Rollback**: `git checkout` + `git clean` is fast. `git stash apply` is proportional to stash size.

5. **Cleanup**: Tag deletion is O(N) where N is number of tags. With typical <50 tasks per feature, this is negligible.

## 10. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Snapshot tags accumulate if cleanup fails | Low | `cleanup-all` with age threshold; CI/CD can run periodic cleanup |
| Rollback loses uncommitted work beyond task scope | Medium | `--preserve` flag for explicit file retention; snapshot metadata records all changes |
| Per-task review false positives block valid work | Medium | `--skip` flag to bypass specific checks; findings are advisory during early adoption |
| Spec-based review adds latency to Step 8 | Low | Reviewer reads specs in parallel with diff loading; no additional API calls |
| PR description generation fails silently | Low | Script exits with clear error; commit can proceed without forensic description |
| Stash conflicts on rollback (dirty working tree) | Medium | Snapshot create stages all changes first; rollback does `git checkout --force` to clean state |
| Agent modifies snapshot metadata directly | Low | `.snapshots/` is outside agent write paths; guardrails enforce path restrictions |

## 11. Open Questions

1. Should snapshot metadata be indexed in Elasticsearch for search/analytics? (Currently file-based only.)
2. Should the per-task review script produce guardrails audit entries? (Currently standalone JSON only.)
3. Should the forensic PR template integrate with P12-F03 Chain-of-Thought persistence for reasoning log links?
4. Should there be a maximum number of total retries across all tasks in a feature (not just per-task)?
5. Should the spec alignment score threshold be configurable via guardrails (e.g., minimum 70 to pass)?
