# P02-F06: Tasks

## Task Breakdown

### T01: Add Identity Resolution Method
**File:** `src/infrastructure/coordination/mcp_server.py`

- [x] Add `_resolve_instance_id(self) -> str` method
- [x] Read `git config user.email` via subprocess
- [x] Map known emails to instance IDs (backend, frontend, orchestrator, devops)
- [x] Check CLAUDE_INSTANCE_ID environment variable first (priority)
- [x] Ignore empty string CLAUDE_INSTANCE_ID (treat as unset)
- [x] Raise RuntimeError if identity cannot be determined
- [x] Include actionable guidance in error message
- [x] Handle `subprocess.TimeoutExpired` explicitly (reviewer concern)
- [x] Call `_resolve_instance_id()` in `__init__`
- [x] Replace `os.environ.get("CLAUDE_INSTANCE_ID", "unknown")` with resolution call
- [x] Add info log for resolved identity
- [x] Update docstring to document RuntimeError

**Estimate:** 1h
**Dependencies:** None
**User Story:** US-01, US-02

---

### T02: Write Identity Resolution Tests (RED then GREEN)
**File:** `tests/unit/infrastructure/test_coordination_mcp_server.py`

- [x] Write test for identity from backend git email
- [x] Write test for identity from frontend git email
- [x] Write test for identity from orchestrator git email
- [x] Write test for identity from devops git email
- [x] Write test for CLAUDE_INSTANCE_ID env var precedence
- [x] Write test for empty env var ignored
- [x] Write test for "unknown" env var value ignored
- [x] Write test for unknown email raises RuntimeError
- [x] Write test for git config failure raises RuntimeError
- [x] Write test for git config timeout raises RuntimeError
- [x] Verify tests pass (GREEN phase)

**Estimate:** 1h
**Dependencies:** T01
**User Story:** US-01, US-02

---

### T03: Integrate Identity Resolution into __init__
**File:** `src/infrastructure/coordination/mcp_server.py`

- [x] Call `_resolve_instance_id()` in `__init__`
- [x] Replace `os.environ.get("CLAUDE_INSTANCE_ID", "unknown")` with resolution call
- [x] Add info log for resolved identity
- [x] Update docstring to document RuntimeError

**Estimate:** 0.5h
**Dependencies:** T01
**User Story:** US-01, US-02
**Note:** Completed as part of T01

---

### T04: Make Identity Resolution Tests Pass (GREEN)
**File:** `tests/unit/infrastructure/test_coordination_mcp_server.py`

- [x] Create mock helper for git config subprocess
- [x] Create mock helper for git config failure
- [x] Run tests and verify all pass
- [x] Refactor if needed while keeping tests green

**Estimate:** 0.5h
**Dependencies:** T02, T03
**User Story:** US-01, US-02
**Note:** Completed as part of T02

---

### T05: Add Message Validation
**File:** `src/infrastructure/coordination/mcp_server.py`

- [x] Add validation in `coord_publish_message` before publishing
- [x] Check `self._instance_id` is not in (None, "", "unknown")
- [x] Return error dict if validation fails
- [x] Include "error" and "hint" fields in response
- [x] Document validation in method docstring

**Estimate:** 0.5h
**Dependencies:** T03
**User Story:** US-03

---

### T06: Write Message Validation Tests (RED then GREEN)
**File:** `tests/unit/infrastructure/test_coordination_mcp_server.py`

- [x] Write test for rejection of "unknown" sender
- [x] Write test for rejection of empty sender
- [x] Write test for rejection of None sender
- [x] Write test for acceptance of valid sender
- [x] Write test that error response includes hint
- [x] Verify tests pass (GREEN phase)

**Estimate:** 0.5h
**Dependencies:** T05
**User Story:** US-03

---

### T07: Verify Message Attribution
**File:** `tests/unit/infrastructure/test_coordination_mcp_server.py`

- [x] Write test that published message includes correct "from" field
- [x] Write test that query by from_instance works correctly
- [x] Verify existing tests still pass
- [x] Add docstrings explaining test purpose

**Estimate:** 0.5h
**Dependencies:** T04, T06
**User Story:** US-04
**Completed:** 2026-01-25

---

### T08: Update Coordination Documentation
**File:** `.claude/rules/parallel-coordination.md`

- [x] Add "Sender Identity" section
- [x] Document git email to instance ID mapping
- [x] Document CLAUDE_INSTANCE_ID override
- [x] Document fail-fast behavior
- [x] Add troubleshooting subsection

**Estimate:** 0.5h
**Dependencies:** None (can be done in parallel)
**User Story:** US-05
**Completed:** 2026-01-25

---

### T09: Run Full Test Suite
**Files:** All test files

- [x] Run `./tools/test.sh src/infrastructure/coordination/`
- [x] Verify all coordination tests pass (38 passed)
- [x] Run `./tools/lint.sh src/infrastructure/coordination/`
- [x] Fix any lint errors (mcp_server.py clean)
- [x] Verify no regressions in other tests

**Estimate:** 0.5h
**Dependencies:** T07
**User Story:** All
**Completed:** 2026-01-25

---

### T10: Integration Verification
**Files:** Manual verification

- [x] Start Redis (if not running) - PONG confirmed
- [x] Verify git user.email is recognized (`claude-orchestrator@asdlc.local`)
- [x] Test identity resolution logic - correctly resolves to "orchestrator"
- [x] Note: Running MCP server has old code (started before changes)
- [x] Code verified in place: `_resolve_instance_id` at line 60
- [x] Full integration test requires session restart to reload MCP

**Estimate:** 0.5h
**Dependencies:** T09
**User Story:** US-01, US-04
**Completed:** 2026-01-25
**Note:** MCP server process needs restart to load new code

---

### T11: Code Review Preparation
**Files:** All modified files

- [x] Review all changes for code quality
- [x] Ensure error messages are clear and actionable
- [x] Verify docstrings are complete
- [x] Prepare summary of changes for reviewer
- [x] Note any deferred work for issues

**Estimate:** 0.5h
**Dependencies:** T09, T10
**User Story:** All
**Completed:** 2026-01-25

---

## Progress

- Started: 2026-01-25
- Tasks Complete: 11/11
- Percentage: 100%
- Status: COMPLETE
- Blockers: None
- GitHub Issue: #49

### Completed Tasks

| Task | Description | Date |
|------|-------------|------|
| T01 | Add identity resolution method | 2026-01-25 |
| T02 | Write identity resolution tests (RED then GREEN) | 2026-01-25 |
| T03 | Integrate into __init__ (completed with T01) | 2026-01-25 |
| T04 | Make tests pass (completed with T02) | 2026-01-25 |
| T05 | Add message validation | 2026-01-25 |
| T06 | Write message validation tests (RED then GREEN) | 2026-01-25 |
| T07 | Verify message attribution tests | 2026-01-25 |
| T08 | Update coordination documentation | 2026-01-25 |
| T09 | Run full test suite (38 passed) | 2026-01-25 |
| T10 | Integration verification | 2026-01-25 |
| T11 | Code review preparation | 2026-01-25 |

## Dependency Graph

```
T01 (identity resolution method)
  |
  +---> T02 (identity tests - RED)
  |       |
  |       +---> T04 (make tests pass - GREEN)
  |               |
  |               +---> T07 (attribution tests)
  |                       |
  |                       +---> T09 (full test suite)
  |                               |
  |                               +---> T10 (integration)
  |                                       |
  |                                       +---> T11 (review prep)
  |
  +---> T03 (integrate into __init__)
          |
          +---> T05 (message validation)
                  |
                  +---> T06 (validation tests)

T08 (documentation) - Can run in parallel with T01-T07
```

## Parallel Tracks

**Track A: Core Implementation (T01-T07, T09-T11)**
- Identity resolution logic
- Message validation
- Test suite
- Integration verification

**Track B: Documentation (T08)**
- Can be done in parallel with Track A
- No code dependencies

## Estimates Summary

| Task | Estimate | Cumulative |
|------|----------|------------|
| T01 | 1.0h | 1.0h |
| T02 | 1.0h | 2.0h |
| T03 | 0.5h | 2.5h |
| T04 | 0.5h | 3.0h |
| T05 | 0.5h | 3.5h |
| T06 | 0.5h | 4.0h |
| T07 | 0.5h | 4.5h |
| T08 | 0.5h | 5.0h |
| T09 | 0.5h | 5.5h |
| T10 | 0.5h | 6.0h |
| T11 | 0.5h | 6.5h |

**Total Estimated Effort:** 6.5 hours (1 day)

## Completion Criteria

Feature is complete when:
1. All tasks marked `[x]`
2. All unit tests pass: `./tools/test.sh src/infrastructure/coordination/`
3. All lint checks pass: `./tools/lint.sh src/infrastructure/coordination/`
4. Integration verification completed (T10)
5. Documentation updated (T08)
6. Ready for GitHub issue #49 closure

## Notes

- T10 requires Redis to be running locally
- All tasks follow TDD: write tests (RED), implement (GREEN), refactor
- Documentation can be written in parallel to reduce total time
- Identity resolution uses subprocess for git command (already imported in session-start.py)
