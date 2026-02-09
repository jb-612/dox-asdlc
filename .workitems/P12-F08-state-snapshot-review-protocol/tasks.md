# P12-F08: State-Level Snapshotting & Review Protocol Enhancement - Tasks

## Overview

This task breakdown covers implementing state-level snapshotting, spec-based review protocol, per-task lightweight review, Git-forensic PR descriptions, and rollback-on-failure workflows. Tasks are organized into 5 phases.

## Dependencies

### External Dependencies

- P01-F06: Trunk-based development - COMPLETE
- P04-F05: Parallel review swarm - COMPLETE
- P11-F01: Guardrails configuration system - COMPLETE (95%)
- Git command-line tools - Available on workstation

### Phase Dependencies

```
Phase 1 (Snapshot Tool) ───────────┐
                                    ├──> Phase 3 (Rollback Workflow)
Phase 2 (Per-Task Review + Spec) ──┘         |
                                              v
                                    Phase 4 (PR Forensics)
                                              |
                                              v
                                    Phase 5 (Integration & Docs)
```

---

## Phase 1: State Snapshot Manager Tool (Backend)

### T01: Create Snapshot Tool Skeleton and Common Library Integration

**Estimate**: 1hr
**Stories**: US-F08-01
**Agent**: backend

**Description**: Create the `tools/snapshot.sh` script skeleton with argument parsing, help text, and integration with the existing `tools/lib/common.sh` pattern for JSON output.

**Subtasks**:
- [ ] Create `tools/snapshot.sh` with `#!/bin/bash` and `set -euo pipefail`
- [ ] Source `tools/lib/common.sh` for `log_info`, `emit_result`, `emit_error`
- [ ] Implement argument parsing for commands: create, capture, diff, rollback, cleanup, cleanup-all, status
- [ ] Implement `--help` flag with usage documentation
- [ ] Create `.snapshots/` directory initialization logic
- [ ] Create `.snapshots/.gitignore` with `*` to exclude all contents
- [ ] Add `.snapshots/` to the root `.gitignore`
- [ ] Write unit tests for argument parsing and help output

**Acceptance Criteria**:
- [ ] Script is executable and sources common.sh correctly
- [ ] Unknown commands produce error with usage hint
- [ ] `--help` prints full usage documentation
- [ ] `.snapshots/` directory is auto-created when needed
- [ ] Tests verify argument parsing for all commands

**Test Cases**:
- [ ] Test `snapshot.sh --help` outputs usage
- [ ] Test `snapshot.sh unknown-cmd` exits with error
- [ ] Test `snapshot.sh create` without task-id exits with error
- [ ] Test `.snapshots/` directory creation on first run

---

### T02: Implement Snapshot Create Command

**Estimate**: 1.5hr
**Stories**: US-F08-01
**Agent**: backend

**Description**: Implement the `create` command that tags the current HEAD and captures uncommitted changes.

**Subtasks**:
- [ ] Implement `cmd_create()` function
- [ ] Create lightweight Git tag `_snap/<task-id>/before` at current HEAD
- [ ] Capture uncommitted changes via `git stash create` (produces stash-like commit without modifying stash reflog)
- [ ] Write snapshot metadata to `.snapshots/<task-id>.json` with: task_id, feature, agent, before_ref, before_sha, stash_ref, timestamp_before, files_expected, status
- [ ] Support `--feature`, `--agent`, `--expected-files` options
- [ ] Handle idempotent behavior: if tag already exists, delete and recreate
- [ ] Output JSON result via emit_result
- [ ] Write unit tests in `tests/unit/tools/test_snapshot.sh`

**Acceptance Criteria**:
- [ ] Tag `_snap/<task-id>/before` exists after create
- [ ] Metadata file `.snapshots/<task-id>.json` is correctly written
- [ ] Stash ref is captured when there are uncommitted changes
- [ ] Stash ref is null when working tree is clean
- [ ] Calling create twice overwrites cleanly (idempotent)
- [ ] Command completes in under 2 seconds

**Test Cases**:
- [ ] Test create with clean working tree
- [ ] Test create with uncommitted changes (stash ref populated)
- [ ] Test create is idempotent (run twice, second succeeds)
- [ ] Test metadata file structure is valid JSON
- [ ] Test `--expected-files` option populates files_expected
- [ ] Test tag name matches `_snap/<task-id>/before` pattern

---

### T03: Implement Snapshot Capture Command

**Estimate**: 1hr
**Stories**: US-F08-02
**Agent**: backend

**Description**: Implement the `capture` command that records the post-execution state and updates metadata.

**Subtasks**:
- [ ] Implement `cmd_capture()` function
- [ ] Create lightweight Git tag `_snap/<task-id>/after` at current HEAD (or tree object if uncommitted changes)
- [ ] Compute `files_actual` by running `git diff --name-only _snap/<task-id>/before HEAD` plus any uncommitted files
- [ ] Update metadata with: after_ref, after_sha, timestamp_after, files_actual, status="captured"
- [ ] Handle case where before-snapshot does not exist (error with helpful message)
- [ ] Output JSON result via emit_result
- [ ] Write unit tests

**Acceptance Criteria**:
- [ ] Tag `_snap/<task-id>/after` exists after capture
- [ ] Metadata updated with after_ref, after_sha, files_actual
- [ ] `files_actual` accurately reflects all changed files
- [ ] Error when no before-snapshot exists
- [ ] Command completes in under 2 seconds

**Test Cases**:
- [ ] Test capture after create (normal flow)
- [ ] Test capture without prior create (error)
- [ ] Test files_actual includes added, modified, and deleted files
- [ ] Test metadata status changes to "captured"

---

### T04: Implement Snapshot Diff Command

**Estimate**: 1hr
**Stories**: US-F08-03
**Agent**: backend

**Description**: Implement the `diff` command that shows changes between before and after snapshots.

**Subtasks**:
- [ ] Implement `cmd_diff()` function
- [ ] Support `--format text` (default): raw git diff output
- [ ] Support `--format stat`: git diff --stat output
- [ ] Support `--format json`: structured JSON with file paths, line counts, change types
- [ ] Handle missing or incomplete snapshots (error with message)
- [ ] Output via emit_result (JSON formats) or stdout (text format)
- [ ] Write unit tests

**Acceptance Criteria**:
- [ ] Text format outputs readable git diff
- [ ] Stat format shows file summary with +/- counts
- [ ] JSON format includes structured file-level information
- [ ] Error on missing snapshot with informative message

**Test Cases**:
- [ ] Test diff with text format
- [ ] Test diff with stat format
- [ ] Test diff with JSON format (validate structure)
- [ ] Test diff with missing before snapshot (error)
- [ ] Test diff with no changes (empty diff)

---

### T05: Implement Snapshot Rollback Command

**Estimate**: 1.5hr
**Stories**: US-F08-04
**Agent**: backend

**Description**: Implement the `rollback` command that restores the working tree to the before-snapshot state.

**Subtasks**:
- [ ] Implement `cmd_rollback()` function
- [ ] Restore working tree to before-snapshot state via `git checkout` and `git clean`
- [ ] Implement `--preserve` flag: save listed files before rollback, restore after
- [ ] By default, preserve files matching `tests/**` pattern
- [ ] Preserve `.snapshots/` contents always (never rolled back)
- [ ] Increment `rollback_count` in metadata
- [ ] Append to `retry_history` array with: attempt, review_result, reason, timestamp
- [ ] Update metadata status to "rolled_back"
- [ ] Remove `_snap/<task-id>/after` tag (since we are back to before state)
- [ ] Handle stash restoration if stash_ref exists in metadata
- [ ] Handle missing before-snapshot (error)
- [ ] Write unit tests

**Acceptance Criteria**:
- [ ] Working tree matches before-snapshot state after rollback
- [ ] Test files are preserved during rollback
- [ ] Custom `--preserve` files are retained
- [ ] rollback_count incremented in metadata
- [ ] retry_history entry added
- [ ] After tag removed (after state is invalidated)
- [ ] Error on missing before-snapshot

**Test Cases**:
- [ ] Test rollback restores to before state
- [ ] Test rollback preserves test files by default
- [ ] Test rollback with `--preserve` flag for custom files
- [ ] Test rollback_count increments correctly
- [ ] Test retry_history records attempt details
- [ ] Test rollback without before snapshot (error)
- [ ] Test rollback with stash_ref restoration

---

### T06: Implement Snapshot Cleanup and Status Commands

**Estimate**: 1hr
**Stories**: US-F08-05, US-F08-14
**Agent**: backend

**Description**: Implement cleanup (single and bulk) and status commands.

**Subtasks**:
- [ ] Implement `cmd_cleanup()` function: remove `_snap/<task-id>/*` tags, optionally archive metadata
- [ ] Implement `--archive` flag: move metadata to `.snapshots/archive/` instead of deleting
- [ ] Implement `cmd_cleanup_all()` function: remove all `_snap/` tags, remove/archive all metadata
- [ ] Implement `--older-than <hours>` flag for cleanup-all (default: 24)
- [ ] Implement `cmd_status()` function: read and output metadata JSON for a task
- [ ] Handle graceful behavior when snapshot/metadata does not exist
- [ ] Write unit tests

**Acceptance Criteria**:
- [ ] Cleanup removes tags and metadata for specified task
- [ ] Archive flag preserves metadata in archive directory
- [ ] Cleanup-all removes all snapshot tags
- [ ] Older-than filter works correctly
- [ ] Status outputs metadata JSON
- [ ] No errors when cleaning non-existent snapshots

**Test Cases**:
- [ ] Test cleanup removes tags
- [ ] Test cleanup with --archive moves metadata
- [ ] Test cleanup-all removes all _snap/ tags
- [ ] Test cleanup-all with --older-than filter
- [ ] Test status output matches metadata format
- [ ] Test status for non-existent task (informative error)
- [ ] Test cleanup for non-existent task (no error, no-op)

---

## Phase 2: Per-Task Review and Spec-Based Review (Backend + Orchestrator)

### T07: Create Per-Task Review Script

**Estimate**: 2hr
**Stories**: US-F08-07
**Agent**: backend

**Description**: Create `tools/task-review.sh` that runs fast automated checks after each atomic task completion.

**Subtasks**:
- [ ] Create `tools/task-review.sh` with argument parsing and help
- [ ] Source `tools/lib/common.sh` for JSON output
- [ ] Implement file scope check: compare snapshot files_actual vs expected files from task spec
- [ ] Implement test coverage check: verify test files exist for each changed source file via `pytest --co -q`
- [ ] Implement test pass check: run relevant tests via `pytest <tests> --tb=short -q`
- [ ] Implement lint check: run `./tools/lint.sh` on changed files
- [ ] Implement style check: grep for type hints and docstrings on new public functions
- [ ] Implement diff size check: count lines added/removed, warn if > 300
- [ ] Implement `--skip <checks>` flag to bypass specific checks
- [ ] Implement `--timeout <seconds>` flag (default: 30) with `timeout` command wrapper
- [ ] Write report to `.snapshots/<task-id>-review.json`
- [ ] Return exit code: 0 = pass, 1 = fail, 2 = script error
- [ ] Write unit tests in `tests/unit/tools/test_task_review.sh`

**Acceptance Criteria**:
- [ ] All six checks execute and produce individual pass/fail results
- [ ] Total execution time under 30 seconds for typical tasks
- [ ] Report JSON includes per-check details
- [ ] --skip flag correctly bypasses specified checks
- [ ] --timeout flag enforces time limit
- [ ] Exit codes match specification

**Test Cases**:
- [ ] Test with all checks passing (exit 0)
- [ ] Test with file scope violation (exit 1)
- [ ] Test with test failure (exit 1)
- [ ] Test with lint error (exit 1)
- [ ] Test --skip flag bypasses checks correctly
- [ ] Test --timeout flag kills long-running checks
- [ ] Test report JSON structure is valid
- [ ] Test with missing snapshot metadata (exit 2)

---

### T08: Update Reviewer Agent with Spec-Based Review Checklist

**Estimate**: 1hr
**Stories**: US-F08-06
**Agent**: orchestrator

**Description**: Update the reviewer agent definition to include spec-based review protocol as a mandatory first step.

**Subtasks**:
- [ ] Read current `.claude/agents/reviewer.md`
- [ ] Add "Spec Alignment" section to review checklist (before existing checks)
- [ ] Add instructions to read design.md, tasks.md, user_stories.md before reviewing code
- [ ] Add file scope adherence check instructions
- [ ] Add logic fidelity check instructions
- [ ] Add constraint compliance check instructions
- [ ] Add test alignment check instructions
- [ ] Add spec alignment score assignment (0-100) instructions
- [ ] Add structured spec alignment report output format
- [ ] Add "Reviewer Mandate" reminder: strictly forbidden from fixing code
- [ ] Verify reviewer remains READ-ONLY (no new tools added)

**Acceptance Criteria**:
- [ ] Reviewer agent definition includes spec-based checklist
- [ ] Spec alignment checks are listed before standard code quality checks
- [ ] Reviewer agent still has `disallowedTools: Write, Edit`
- [ ] Spec alignment report format is documented
- [ ] Changes are internally consistent with existing reviewer behavior

**Test Cases**:
- [ ] Manual review: verify updated agent definition reads correctly
- [ ] Verify no Write or Edit tools are added to reviewer

---

### T09: Create Snapshot Output Parser

**Estimate**: 30min
**Stories**: US-F08-01, US-F08-02, US-F08-03
**Agent**: backend

**Description**: Create the output parser for snapshot tool (following existing parsers like `tools/lib/parsers/pytest.sh`).

**Subtasks**:
- [ ] Create `tools/lib/parsers/snapshot.sh`
- [ ] Parse snapshot create output into standardized JSON
- [ ] Parse snapshot capture output into standardized JSON
- [ ] Parse snapshot diff output into standardized JSON
- [ ] Follow existing parser patterns from `tools/lib/parsers/`
- [ ] Write unit tests

**Acceptance Criteria**:
- [ ] Parser produces valid JSON for all snapshot commands
- [ ] Output follows the same structure as other tool parsers

**Test Cases**:
- [ ] Test parsing create output
- [ ] Test parsing capture output
- [ ] Test parsing diff output (all formats)

---

## Phase 3: Rollback-on-Failure Workflow (Orchestrator)

### T10: Implement Rollback-Retry Workflow in TDD Execution Skill

**Estimate**: 1.5hr
**Stories**: US-F08-10
**Agent**: orchestrator

**Description**: Update the TDD execution skill to integrate snapshot create/capture, per-task review, and rollback-retry logic.

**Subtasks**:
- [ ] Read current `.claude/skills/tdd-execution/SKILL.md`
- [ ] Add Phase 0 (pre-task): snapshot create before RED phase
- [ ] Add Phase 4 (post-task): snapshot capture after GREEN/REFACTOR
- [ ] Add Phase 5 (review): per-task review via `tools/task-review.sh`
- [ ] Add Phase 6 (retry): rollback and re-delegate if review fails and retry_count < 3
- [ ] Document retry context injection: original spec + cumulative feedback + retry count + failed diff
- [ ] Document HITL Gate 6 escalation when retry_count >= 3
- [ ] Ensure backward compatibility: skill still works without snapshots if tools are unavailable

**Acceptance Criteria**:
- [ ] Skill describes snapshot lifecycle around task execution
- [ ] Retry loop with maximum 3 attempts is documented
- [ ] Context injection for retries is specified
- [ ] HITL Gate 6 escalation is referenced
- [ ] Skill gracefully handles missing snapshot tools

**Test Cases**:
- [ ] Manual review: verify skill flow reads correctly end-to-end
- [ ] Verify backward compatibility clause is present

---

### T11: Extend HITL Gate 6 with Rollback-Retry Options

**Estimate**: 1hr
**Stories**: US-F08-11
**Agent**: orchestrator

**Description**: Update the HITL gates specification to extend Gate 6 with rollback-retry context and options.

**Subtasks**:
- [ ] Read current `.claude/rules/hitl-gates.md`
- [ ] Extend Gate 6 trigger: add "per-task review failed after 3 rollback retries" alongside existing "test failures > 3"
- [ ] Add retry context display: task ID, retry count, feedback summary per attempt
- [ ] Update options: A) Invoke debugger (P12-F01, if available), B) Guided retry with user input, C) Skip+issue, D) Abort
- [ ] Specify behavior for option B: prompt user for guidance, rollback, re-delegate with user guidance
- [ ] Specify behavior for option C: create GitHub issue with failure context
- [ ] Add audit logging for gate decision (reference guardrails audit)

**Acceptance Criteria**:
- [ ] Gate 6 handles both test failure escalation and review failure escalation
- [ ] Retry context is displayed clearly to user
- [ ] All four options have documented behavior
- [ ] Option A conditional on P12-F01 availability
- [ ] Gate decision audit trail specified

**Test Cases**:
- [ ] Manual review: verify gate format reads correctly
- [ ] Verify option A conditional language is present

---

### T12: Implement Rollback Retry Logic in Workflow Rules

**Estimate**: 1hr
**Stories**: US-F08-10, US-F08-12
**Agent**: orchestrator

**Description**: Update the 11-step workflow documentation to incorporate snapshot/review/rollback at Steps 6, 8, and 9.

**Subtasks**:
- [ ] Read current `.claude/rules/workflow.md`
- [ ] Update Step 6 (Parallel Build): add snapshot create/capture/review/rollback cycle per task
- [ ] Update Step 8 (Review): add spec-based review protocol as first step for reviewer
- [ ] Update Step 9 (Orchestration): add forensic PR description generation before commit
- [ ] Update HITL Gates Summary table: extend Gate 6 entry
- [ ] Ensure changes are consistent with hitl-gates.md and tdd-execution skill updates

**Acceptance Criteria**:
- [ ] Step 6 describes the full snapshot-review-rollback cycle
- [ ] Step 8 describes spec-based review as first reviewer action
- [ ] Step 9 describes forensic PR generation
- [ ] All cross-references to other rules files are accurate
- [ ] Changes are backward-compatible (existing workflow still makes sense)

**Test Cases**:
- [ ] Manual review: verify step descriptions are internally consistent
- [ ] Verify cross-references to hitl-gates.md are accurate

---

## Phase 4: Git-Forensic PR Description (Backend + Orchestrator)

### T13: Create PR Description Generator Script

**Estimate**: 1.5hr
**Stories**: US-F08-08
**Agent**: backend

**Description**: Create `scripts/generate-pr-description.sh` that assembles forensic PR descriptions from snapshot metadata and task information.

**Subtasks**:
- [ ] Create `scripts/generate-pr-description.sh` with argument parsing
- [ ] Read feature work item directory to get design.md, tasks.md metadata
- [ ] Read snapshot metadata from `.snapshots/` for each task (or specific task via `--task`)
- [ ] Read per-task review results from `.snapshots/<task-id>-review.json`
- [ ] Generate "Task Reference" section: Task ID, feature name, design spec path
- [ ] Generate "Changes Summary" table: file, lines added, lines removed, purpose
- [ ] Generate "Spec Alignment" section: intended vs actual, alignment score
- [ ] Generate "Review Status" table: per-check results from task review
- [ ] Generate "Test Results" section: aggregate test pass/fail counts
- [ ] Generate "Reasoning Log" placeholder (for P12-F03 integration)
- [ ] Generate "Debugging Trace" section: retry count, rollback history
- [ ] Support `--format abbreviated` for commit message bodies
- [ ] Support `--output <file>` for writing to file
- [ ] Write unit tests in `tests/unit/scripts/test_generate_pr_description.sh`

**Acceptance Criteria**:
- [ ] Full PR description includes all specified sections
- [ ] Abbreviated format suitable for commit messages
- [ ] Script handles missing snapshot data gracefully (sections show "N/A")
- [ ] Output is valid Markdown compatible with GitHub rendering
- [ ] Script is compatible with `gh pr create --body-file`

**Test Cases**:
- [ ] Test full feature PR description with multiple tasks
- [ ] Test single task PR description via --task flag
- [ ] Test abbreviated format for commit messages
- [ ] Test with missing snapshot data (graceful degradation)
- [ ] Test output to file via --output flag
- [ ] Test Markdown validity (headers, tables, code blocks)

---

### T14: Create GitHub PR Template

**Estimate**: 30min
**Stories**: US-F08-09
**Agent**: orchestrator

**Description**: Create the forensic PR template in `.github/PULL_REQUEST_TEMPLATE/`.

**Subtasks**:
- [ ] Create `.github/PULL_REQUEST_TEMPLATE/` directory
- [ ] Create `forensic.md` template with placeholder sections
- [ ] Include sections: Task Reference, Changes Summary, Spec Alignment, Review Status, Test Results, Reasoning Log, Debugging Trace
- [ ] Add instructions in HTML comments for manual fill-in guidance
- [ ] Verify template renders correctly in GitHub PR creation

**Acceptance Criteria**:
- [ ] Template file exists at correct path
- [ ] All forensic sections present with instructional comments
- [ ] Template is usable both manually and as automation target
- [ ] Does not break default PR creation workflow

**Test Cases**:
- [ ] Verify file exists and is valid Markdown
- [ ] Verify all required sections are present

---

### T15: Update Feature Completion Skill with Forensic PR Step

**Estimate**: 30min
**Stories**: US-F08-08, US-F08-12
**Agent**: orchestrator

**Description**: Update the feature-completion skill to include forensic PR description generation.

**Subtasks**:
- [ ] Read current `.claude/skills/feature-completion/SKILL.md`
- [ ] Add step between "Verify Interfaces" and "Update Documentation": generate forensic PR description
- [ ] Reference `scripts/generate-pr-description.sh` with correct arguments
- [ ] Update Step 9 (Orchestrator Commits) to use forensic description in commit body

**Acceptance Criteria**:
- [ ] Skill includes forensic PR generation step
- [ ] Correct script path and arguments documented
- [ ] Commit format includes abbreviated forensic description

**Test Cases**:
- [ ] Manual review: verify skill flow reads correctly

---

## Phase 5: Integration, Guidelines, and Testing (Backend + Orchestrator)

### T16: Add Guardrails Guidelines for Snapshot and Review Protocols

**Estimate**: 1hr
**Stories**: US-F08-13
**Agent**: backend

**Description**: Add two new guardrails guidelines to the bootstrap script for snapshot protocol enforcement and spec-based review.

**Subtasks**:
- [ ] Read current `scripts/bootstrap_guardrails.py`
- [ ] Add `snapshot-protocol` guideline: category=audit_telemetry, priority=850, condition matches implementation actions
- [ ] Add `spec-based-review` guideline: category=context_constraint, priority=800, condition matches reviewer+review actions
- [ ] Guidelines follow the existing pattern of built-in guidelines
- [ ] Guidelines are idempotent (skip if ID already exists)
- [ ] Write unit tests verifying guideline definitions and condition matching

**Acceptance Criteria**:
- [ ] Two new guidelines added to bootstrap script
- [ ] Guidelines follow existing schema exactly
- [ ] Bootstrap remains idempotent
- [ ] Condition matching works for expected contexts

**Test Cases**:
- [ ] Test snapshot-protocol guideline matches `action=implement`
- [ ] Test snapshot-protocol guideline does NOT match `action=review`
- [ ] Test spec-based-review guideline matches `agent=reviewer, action=review`
- [ ] Test spec-based-review guideline does NOT match `agent=backend, action=implement`
- [ ] Test bootstrap idempotency (run twice, no duplicates)

---

### T17: Write Integration Tests for Snapshot Lifecycle

**Estimate**: 1.5hr
**Stories**: US-F08-01, US-F08-02, US-F08-03, US-F08-04, US-F08-05
**Agent**: backend

**Description**: Create integration tests that exercise the full snapshot lifecycle: create -> capture -> diff -> rollback -> cleanup.

**Subtasks**:
- [ ] Create test fixture: temporary Git repository with sample files
- [ ] Test full lifecycle: create -> modify files -> capture -> diff -> verify
- [ ] Test rollback lifecycle: create -> modify -> capture -> rollback -> verify restored state
- [ ] Test rollback with --preserve: verify preserved files survive rollback
- [ ] Test retry loop: create -> modify -> capture -> rollback -> modify differently -> capture
- [ ] Test cleanup: verify tags removed, metadata archived
- [ ] Test cleanup-all: verify all _snap/ tags removed
- [ ] Test error cases: capture without create, rollback without create, diff with incomplete snapshot

**Acceptance Criteria**:
- [ ] All lifecycle flows tested end-to-end in a real Git repository
- [ ] Tests clean up after themselves (no stale tags or temp directories)
- [ ] Tests run in under 30 seconds total

**Test Cases**:
- [ ] Test create -> capture -> diff (happy path)
- [ ] Test create -> modify -> capture -> rollback (restores original)
- [ ] Test rollback preserves test files
- [ ] Test retry: create -> capture -> rollback -> capture (two attempts)
- [ ] Test cleanup removes all artifacts
- [ ] Test cleanup-all with age filter
- [ ] Test error on capture without create
- [ ] Test error on rollback without create

---

### T18: Write Integration Tests for Per-Task Review

**Estimate**: 1hr
**Stories**: US-F08-07
**Agent**: backend

**Description**: Create integration tests for the per-task review script exercising all checks in a real Git repository.

**Subtasks**:
- [ ] Create test fixture: temporary Git repository with snapshot metadata, source files, and test files
- [ ] Test all-pass scenario: source file in scope, tests exist, tests pass, lint clean
- [ ] Test file scope violation: source file outside expected scope
- [ ] Test missing test coverage: changed source file with no corresponding test
- [ ] Test failing test: test file exists but fails
- [ ] Test lint error: source file with lint violation
- [ ] Test diff size warning: change exceeding 300 lines
- [ ] Test --skip flag: verify skipped checks are not run
- [ ] Test --timeout flag: verify timeout kills long-running tests

**Acceptance Criteria**:
- [ ] All check scenarios tested individually
- [ ] Integration tests use real Git operations and pytest/lint
- [ ] Tests clean up after themselves

**Test Cases**:
- [ ] Test all-pass scenario (exit 0, report shows all PASS)
- [ ] Test file scope violation (exit 1, file_scope check shows FAIL)
- [ ] Test missing test coverage (exit 1, test_coverage shows FAIL)
- [ ] Test failing tests (exit 1, test_pass shows FAIL)
- [ ] Test --skip bypasses checks correctly
- [ ] Test timeout enforcement

---

### T19: Write Integration Tests for PR Description Generator

**Estimate**: 1hr
**Stories**: US-F08-08
**Agent**: backend

**Description**: Create integration tests for the PR description generator script.

**Subtasks**:
- [ ] Create test fixture: mock work item directory with design.md, tasks.md, and snapshot metadata
- [ ] Test full feature description generation (all tasks)
- [ ] Test single task description via --task flag
- [ ] Test abbreviated format output
- [ ] Test with missing snapshot data (graceful degradation)
- [ ] Test output to file via --output flag
- [ ] Validate generated Markdown structure (headers, tables present)

**Acceptance Criteria**:
- [ ] Generator produces valid Markdown for all scenarios
- [ ] Missing data handled gracefully with N/A values
- [ ] File output works correctly

**Test Cases**:
- [ ] Test full feature PR description
- [ ] Test single task PR description
- [ ] Test abbreviated format
- [ ] Test missing snapshots (graceful degradation)
- [ ] Test file output
- [ ] Validate Markdown structure

---

### T20: End-to-End Snapshot-Review-Rollback Workflow Test

**Estimate**: 1.5hr
**Stories**: US-F08-10
**Agent**: backend

**Description**: Create an end-to-end test that simulates the complete workflow: snapshot create, agent execution (simulated), snapshot capture, per-task review, rollback on failure, retry, and eventual success.

**Subtasks**:
- [ ] Create test fixture: realistic work item directory with design.md, tasks.md, test files
- [ ] Simulate agent execution: modify files (some with intentional scope violation)
- [ ] Run per-task review: verify failure due to scope violation
- [ ] Rollback: verify restore to before state
- [ ] Simulate corrected agent execution: modify only in-scope files
- [ ] Run per-task review: verify success
- [ ] Cleanup: verify all artifacts removed
- [ ] Verify snapshot metadata tracks retry history correctly

**Acceptance Criteria**:
- [ ] Full workflow executes end-to-end
- [ ] Rollback correctly restores state
- [ ] Retry with corrected changes passes review
- [ ] Metadata tracks complete retry history
- [ ] All artifacts cleaned up at end

**Test Cases**:
- [ ] Test full workflow: create -> fail -> rollback -> retry -> pass -> cleanup
- [ ] Test retry history has correct entries
- [ ] Test metadata status transitions: created -> captured -> rolled_back -> captured -> completed

---

## Progress

- **Started**: Not started
- **Tasks Complete**: 0/20
- **Percentage**: 0%
- **Status**: PENDING
- **Blockers**: None

## Task Summary

| Phase | Tasks | Estimate | Status |
|-------|-------|----------|--------|
| Phase 1: Snapshot Tool | T01-T06 | 7hr | [ ] |
| Phase 2: Per-Task Review + Spec Review | T07-T09 | 3.5hr | [ ] |
| Phase 3: Rollback Workflow | T10-T12 | 3.5hr | [ ] |
| Phase 4: PR Forensics | T13-T15 | 2.5hr | [ ] |
| Phase 5: Integration & Testing | T16-T20 | 6hr | [ ] |

**Total Estimated Time**: ~22.5 hours

## Task Dependencies

```
T01 ──> T02 ──> T03 ──> T04
                  |
                  └──> T05 ──> T06
                         |
         T09 ◄──────────┘

T02 + T03 + T05 ──> T07 ──> T08 (parallel)
                      |
                      └──> T17 ──> T18

T07 + T08 ──> T10 ──> T11 ──> T12

T03 + T07 ──> T13 ──> T14 ──> T15

T10 + T13 ──> T16

T17 + T18 ──> T19 ──> T20
```

## Implementation Order (Recommended Build Sequence)

**Week 1: Snapshot Foundation**
1. T01 (Snapshot skeleton)
2. T02 (Snapshot create)
3. T03 (Snapshot capture)
4. T04, T05 (Diff and rollback -- can run in parallel)
5. T06 (Cleanup and status)
6. T09 (Snapshot output parser)

**Week 2: Review and Workflow**
7. T07 (Per-task review script)
8. T08 (Update reviewer agent -- orchestrator, can run in parallel with T07)
9. T10 (Update TDD execution skill)
10. T11 (Extend HITL Gate 6)
11. T12 (Update workflow rules)

**Week 3: PR Forensics and Integration**
12. T13 (PR description generator)
13. T14 (PR template -- orchestrator, can run in parallel with T13)
14. T15 (Update feature completion skill)
15. T16 (Guardrails guidelines)
16. T17-T20 (Integration and E2E tests)

## Testing Strategy

- **Unit tests** for each bash tool (T01-T06, T07, T09, T13) use a temporary Git repository fixture
- **Integration tests** (T17-T20) exercise full lifecycle flows against real Git operations
- **Manual review** for documentation updates (T08, T10-T12, T14-T15) to verify internal consistency
- **Guardrails tests** (T16) use the existing evaluator test patterns from P11-F01
- Tests follow existing patterns in `tests/unit/tools/` and `tests/integration/`
- All test fixtures are self-contained and clean up after themselves

## Completion Checklist

- [ ] All tasks in Task List are marked complete
- [ ] All unit tests pass: `./tools/test.sh tests/unit/tools/`
- [ ] All integration tests pass: `./tools/test.sh tests/integration/`
- [ ] Linter passes: `./tools/lint.sh tools/ scripts/`
- [ ] Documentation internally consistent
- [ ] Interface contracts verified against design.md
- [ ] Progress marked as 100% in tasks.md

## Notes

### Risk Mitigation

1. **Git plumbing reliability**: All Git commands used are stable plumbing commands. No porcelain-only features relied upon.
2. **Backward compatibility**: All workflow changes include fallback clauses for when snapshot tools are unavailable.
3. **Per-task review false positives**: `--skip` flag allows bypassing specific checks during early adoption.
4. **Reviewer agent changes**: Spec-based checklist is additive; existing review behavior is preserved.
5. **Documentation volume**: Phased approach ensures each doc change is reviewed before building on it.
