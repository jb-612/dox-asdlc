---
name: tdd-execution
description: Guides test-driven development using Red-Green-Refactor cycle. Use when implementing tasks from tasks.md, writing tests before code, or debugging failing tests.
---

Execute TDD for the specified task using Red-Green-Refactor:

## Phase 1: RED - Write Failing Test

1. Read the task description from `tasks.md`
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

1. Write minimal code to pass the test
2. Don't add functionality beyond what the test requires
3. Run and verify it passes: `pytest tests/unit/path/test_file.py -v`

## Phase 3: REFACTOR - Improve While Green

1. Remove duplication
2. Improve naming
3. Add type hints if missing
4. Run tests after each change

## Task Completion

After tests pass:
1. Mark task as `[x]` in tasks.md
2. Update progress percentage
3. Proceed to next task

## Anti-Patterns

- Never write code before tests
- Never skip to next task while tests fail
- Never refactor while tests are red
