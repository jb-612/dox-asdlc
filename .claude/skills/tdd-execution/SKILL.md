---
name: tdd-execution
description: Guides test-driven development using the 3-agent TDD flow (test-writer -> coder -> debugger) and Red-Green-Refactor cycle. Use when implementing tasks from tasks.md, writing tests before code, or debugging failing tests.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
---

## Agent Flow

TDD execution is distributed across three specialized agents, orchestrated by the PM CLI:

```
PM CLI
  |
  |-> 1. test-writer agent (Phase 1: RED)
  |       Reads specs, writes failing tests
  |
  |-> 2. coder agent - backend or frontend (Phase 2: GREEN + Phase 3: REFACTOR)
  |       Writes minimal implementation, refactors while green
  |
  |-> 3. debugger agent (on-demand, after 3+ consecutive failures)
          Produces diagnostic report, does NOT write code
```

| Agent | Phase | Responsibility |
|-------|-------|----------------|
| **test-writer** | RED | Reads task specs from `tasks.md` and `design.md`. Writes failing tests that define expected behavior. Does not write implementation code. |
| **coder** (backend or frontend) | GREEN + REFACTOR | Receives failing tests. Writes minimal code to make tests pass. Refactors while keeping tests green. |
| **debugger** | Escalation | Invoked when tests fail 3 or more times consecutively. Analyzes failures and produces a diagnostic report. Does not modify source code or tests. |

The PM CLI hands off between agents atomically: one agent completes before the next begins. This preserves cognitive isolation and prevents context contamination between test authoring and implementation.

---

Execute TDD for the specified task using Red-Green-Refactor:

## Phase 1: RED - Write Failing Test

**Agent:** test-writer

The test-writer agent owns this phase. It reads the task specification and writes tests that define expected behavior before any implementation exists. The test-writer does not write production code.

1. Read the task description from `tasks.md` and interface contracts from `design.md`
2. Write a test that defines expected behavior:

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

3. Run and verify it fails: `pytest tests/unit/path/test_file.py -v`

## Phase 2: GREEN - Make Test Pass

**Agent:** coder (backend or frontend, depending on domain)

The coder agent receives the failing tests written by the test-writer and implements the minimal code needed to make them pass.

1. Write minimal code to pass the test
2. Don't add functionality beyond what the test requires
3. Run and verify it passes: `pytest tests/unit/path/test_file.py -v`

## Phase 3: REFACTOR - Improve While Green

**Agent:** coder (same agent as Phase 2, continues in the same session)

The coder agent refactors the implementation while keeping all tests green. This phase happens immediately after GREEN, within the same agent session.

1. Remove duplication
2. Improve naming
3. Add type hints if missing
4. Run tests after each change

## Task Completion

After tests pass:
1. Mark task as `[x]` in tasks.md
2. Update progress percentage
3. Proceed to next task

## Failure Escalation

**Agent:** debugger (invoked on-demand by PM CLI)

When tests fail 3 or more times consecutively during the GREEN phase, the coder agent stops and reports the failure to the PM CLI. At this point, Gate 6 (Test Failures > 3) is triggered with an extended set of options:

```
Tests failing repeatedly ([N] times): [test name]

Options:
 A) Continue debugging (coder agent retries)
 B) Skip test and proceed (mark as known issue, create GitHub issue)
 C) Abort task
 D) Invoke debugger agent for diagnostic report
```

### Option D: Debugger Agent

When the user selects option D, the PM CLI invokes the debugger agent. The debugger:

1. **Reads** the failing test(s) and relevant source code
2. **Analyzes** the failure pattern across all consecutive attempts
3. **Produces a diagnostic report** containing:
   - Root cause hypothesis
   - Stack traces and error analysis
   - Suggested fix approach (without writing code)
   - Identification of missing dependencies or incorrect assumptions
4. **Returns the report** to the PM CLI without modifying any files

The debugger agent is strictly read-only. It does not write code, modify tests, or make commits.

### After Diagnostic Report

The PM CLI reviews the debugger report and decides the next step:

| Decision | Action |
|----------|--------|
| Fix approach is clear | Re-invoke coder agent with diagnostic context |
| Design issue identified | Escalate to reviewer agent for design reassessment |
| Task is blocked | Abort task, create GitHub issue with diagnostic report |

The diagnostic report is passed as context to whichever agent continues the work, preventing repeated investigation of the same failure.

## Anti-Patterns

- Never write code before tests
- Never skip to next task while tests fail
- Never refactor while tests are red

## Cross-References

- `@testing` — Run full quality gates after TDD cycle
- `@feature-completion` — Validate when all tasks complete
