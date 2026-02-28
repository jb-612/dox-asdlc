---
id: META-02
parent_id: META
type: tasks
version: 1
status: in_progress
estimated_hours: 10
dependencies: []
tags: [tooling, quality, python]
created_by: planner
created_at: "2026-02-28T00:00:00Z"
updated_at: "2026-02-28T00:00:00Z"
---

# Tasks: Cyclomatic Complexity Enforcement

## Progress

- Started: 2026-02-28
- Tasks Complete: 0/8
- Percentage: 0%
- Status: IN_PROGRESS

## Dependency Graph

```
T01 (analyzer) ──┬──> T04 (tests) ──> T05 (verify-comments)
T03 (fixtures) ──┘         │                │
T01 ──> T02 (bash wrapper) │                │
T01 ──> T07 (CLAUDE.md)    │                │
T01+T02 ──> T06 (skills) <─┘────────────────┘
                │
                v
           T08 (verification)
```

## Tasks

### T01: Create Python CC analyzer
- [ ] Estimate: 2hr
- [ ] Tests: tests/unit/tools/test_cc_analyzer.py
- [ ] Dependencies: None
- [ ] Notes: tools/lib/cc_analyzer.py — stdlib ast, compute_complexity, analyze_file, analyze_path, main CLI

### T02: Create bash wrappers
- [ ] Estimate: 1hr
- [ ] Tests: manual
- [ ] Dependencies: T01
- [ ] Notes: tools/complexity.sh (3-line forwarder), .claude/skills/testing/scripts/complexity.sh

### T03: Create test fixtures
- [ ] Estimate: 0.5hr
- [ ] Tests: N/A
- [ ] Dependencies: None
- [ ] Notes: 5 cc_*.py files in tests/unit/tools/fixtures/

### T04: Write unit tests
- [ ] Estimate: 2hr
- [ ] Tests: tests/unit/tools/test_cc_analyzer.py
- [ ] Dependencies: T01, T03
- [ ] Notes: Table-driven, all AST nodes, docstring parsing, violations, error handling

### T05: Add verify-comments mode
- [ ] Estimate: 1hr
- [ ] Tests: tests/unit/tools/test_cc_analyzer.py (extend)
- [ ] Dependencies: T01, T04
- [ ] Notes: --verify-comments flag, detect CC annotation drift

### T06: Update 5 skills
- [ ] Estimate: 1.5hr
- [ ] Tests: grep verification
- [ ] Dependencies: T01, T02
- [ ] Notes: tdd-build, code-review, feature-completion, task-breakdown, testing

### T07: Update CLAUDE.md
- [ ] Estimate: 0.5hr
- [ ] Tests: grep verification
- [ ] Dependencies: T01
- [ ] Notes: Add CC rules to Coding Standards > Python

### T08: Verification + baseline
- [ ] Estimate: 1.5hr
- [ ] Tests: full suite
- [ ] Dependencies: T01-T07
- [ ] Notes: Run against full codebase, verify all integrations

## Summary

| Phase | Tasks | Est. Hours |
|-------|-------|------------|
| Core | T01, T03 | 2.5h |
| Wrappers & Tests | T02, T04 | 3h |
| Extensions | T05, T06, T07 | 3h |
| Verification | T08 | 1.5h |
| **Total** | **8 tasks** | **10h** |
