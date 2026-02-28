---
name: tdd-build
description: Three Laws TDD micro-cycle engine with 3-agent separation. Enforces Uncle Bob's Three Laws — production code only to pass a failing test, minimum test code to fail, minimum production code to pass. Replaces tdd-execution.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
---

Execute TDD build for task $ARGUMENTS:

## Three Laws of TDD

1. You shall not write production code unless it is to make a failing test pass
2. You shall not write more of a test than is sufficient to fail (compilation failures count)
3. You shall not write more production code than is sufficient to pass the currently failing test

## 3-Agent Separation

Each role is strictly scoped. The `enforce-tdd-separation.sh` hook enforces these boundaries via markers at `/tmp/asdlc-tdd-markers/{repo_hash}`.

| Agent | Role | Allowed Files | Phase |
|-------|------|---------------|-------|
| `test-writer` | Write ONE failing test | `tests/` only | RED |
| `code-writer` | Write minimal passing code | `src/` only | GREEN |
| `refactorer` | Clean up while green | Both `tests/` + `src/` | REFACTOR |

### Marker Protocol

Before each agent runs, PM CLI sets the active role:
```bash
echo "test-writer" > /tmp/asdlc-tdd-markers/{repo_hash}/active_role
```

The `enforce-tdd-separation.sh` hook reads this marker and blocks writes to forbidden paths.

## Micro-Cycle: RED-GREEN-REFACTOR

### Phase 1: RED (test-writer agent)

1. Read task spec from `tasks.md` and interfaces from `design.md`
2. Write ONE test that defines the next expected behavior
3. Run test — verify it FAILS
4. Stop. Hand off to code-writer.

```python
def test_function_does_expected_thing():
    # Arrange
    input_data = {"key": "value"}
    expected = {"result": "expected"}
    # Act
    result = target_function(input_data)
    # Assert
    assert result == expected
```

### Phase 2: GREEN (code-writer agent)

1. Read the failing test
2. Write MINIMUM code to make it pass — nothing more
3. Run test — verify it PASSES
4. If test still fails, iterate on implementation (not the test)
5. Hand off to test-writer for next test OR to refactorer after batch

### Repeat RED-GREEN

Continue RED-GREEN cycles until all behaviors for the task are covered. Each cycle adds ONE test and its minimal implementation.

### Phase 3: REFACTOR (refactorer agent)

After all tests for a task pass:
1. Identify duplication, unclear naming, missing types
2. Refactor in small steps — run tests after EACH change
3. Never refactor while any test is red
4. All tests must remain green throughout
5. Run `./tools/complexity.sh --threshold 5 <modified_files>` — if any function exceeds CC=5, refactor to reduce complexity before proceeding

**HITL Gate: Refactor Approval (advisory)** — user reviews refactor result per task.

```
Refactor complete for [task]:
 - Changes: [summary]
 - Tests: all passing

Options:
 A) Approve refactor
 B) Request changes
 C) Revert refactor (keep pre-refactor code)
```

## Task Completion

After refactor approved:
1. Mark task as `[x]` in tasks.md
2. Update progress percentage
3. Proceed to next task's RED phase

## Failure Escalation

**HITL Gate: Test Failures > 3 (advisory)** — same test fails 3+ consecutive times during GREEN phase.

```
Tests failing repeatedly ([N] times): [test name]

Options:
 A) Continue debugging (code-writer retries)
 B) Skip test and proceed (create GitHub issue)
 C) Abort task
 D) Invoke debugger agent for diagnostic report
```

Option D: Debugger agent (read-only) produces root cause hypothesis, stack traces, and suggested fix. Report is passed as context to whichever agent resumes.

## Anti-Patterns

- **Batch test writing** — writing multiple tests before any GREEN. Write ONE test at a time.
- **Code before test** — writing production code without a failing test. Always RED first.
- **Refactor while red** — changing code structure while tests fail. Get GREEN first.
- **Skipping refactor** — moving to next task without cleanup. Always REFACTOR.
- **Gold-plating in GREEN** — adding functionality beyond what the test requires. Minimum code only.

## Cross-References

- `@testing` — Run full quality gates after TDD cycle
- `@feature-completion` — Validate when all tasks complete
- `@design-pipeline` — Source of task specs and design docs
