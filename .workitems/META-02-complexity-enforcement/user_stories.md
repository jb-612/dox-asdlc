---
id: META-02
parent_id: META
type: user_stories
version: 1
status: approved
dependencies: []
tags: [tooling, quality, python]
created_by: planner
created_at: "2026-02-28T00:00:00Z"
updated_at: "2026-02-28T00:00:00Z"
---

# User Stories: Cyclomatic Complexity Enforcement

## US-01: Analyze function complexity

**As a** developer
**I want** to run a complexity analyzer on Python files
**So that** I can identify functions exceeding the CC <= 5 threshold

### Acceptance Criteria

- [ ] `python3 tools/lib/cc_analyzer.py src/` reports all functions with CC > threshold
- [ ] Default threshold is 5
- [ ] `--threshold N` overrides default
- [ ] `--json` outputs machine-readable JSON
- [ ] Handles nested functions, async functions, class methods

### Test Scenarios

**Given** a Python file with functions of varying complexity
**When** running `cc_analyzer.py --threshold 5`
**Then** only functions exceeding CC=5 are reported as violations

---

## US-02: Verify docstring CC annotations

**As a** developer
**I want** to verify that `CC = N` docstring annotations match actual complexity
**So that** annotations stay accurate as code evolves

### Acceptance Criteria

- [ ] `--verify-comments` flag detects mismatches between annotated and actual CC
- [ ] Reports both missing annotations and wrong values
- [ ] Output includes expected vs actual values

### Test Scenarios

**Given** a Python file with `CC = 3` in a docstring but actual CC = 5
**When** running `cc_analyzer.py --verify-comments`
**Then** a mismatch warning is reported showing expected=3 actual=5

---

## US-03: Bash integration

**As a** workflow agent
**I want** `./tools/complexity.sh` to produce standard aSDLC JSON output
**So that** complexity checks integrate with existing quality gates

### Acceptance Criteria

- [ ] `./tools/complexity.sh src/` outputs `{"success": true, "results": [...], "errors": []}`
- [ ] Non-zero exit on errors, zero exit on success (even with violations)
- [ ] `--json`, `--threshold`, `--verify-comments` flags pass through

### Test Scenarios

**Given** a codebase with some functions exceeding CC=5
**When** running `./tools/complexity.sh --json src/`
**Then** output is valid JSON with results array containing violation objects

---

## US-04: Skill integration

**As a** PM CLI agent
**I want** complexity checks wired into TDD, review, and completion workflows
**So that** CC enforcement happens automatically during development

### Acceptance Criteria

- [ ] `@tdd-build` checks complexity after REFACTOR phase
- [ ] `@code-review` Agent 2 runs complexity check
- [ ] `@feature-completion` includes complexity gate before interface verification
- [ ] `@task-breakdown` notes complexity budget
- [ ] `@testing` lists complexity.sh in Available Scripts
