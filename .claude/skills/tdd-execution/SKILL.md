# TDD Execution Skill

## Description

This skill guides test-driven development execution for individual tasks within a feature. Use this skill when implementing tasks from a `tasks.md` file following the Red-Green-Refactor cycle.

## When to Use

Use this skill when:
- Implementing a task from the task breakdown
- Writing tests before implementation code
- Verifying task completion criteria
- Debugging failing tests

## TDD Cycle

### Phase 1: Red (Write Failing Test)

Before writing any implementation code, create a test that defines the expected behavior.

**Steps:**

1. Read the task description from `tasks.md`
2. Identify the function/method/class to be tested
3. Write a test that calls the target with expected inputs
4. Assert the expected outputs or side effects
5. Run the test and verify it fails for the right reason

**Test Template:**

```python
import pytest
from src.module import target_function

class TestTargetFunction:
    """Tests for target_function."""
    
    def test_basic_case(self):
        """Test that target_function handles basic input correctly."""
        # Arrange
        input_data = {"key": "value"}
        expected = {"result": "expected"}
        
        # Act
        result = target_function(input_data)
        
        # Assert
        assert result == expected
    
    def test_edge_case(self):
        """Test that target_function handles edge case correctly."""
        # Arrange
        input_data = {}
        
        # Act & Assert
        with pytest.raises(ValueError, match="Input cannot be empty"):
            target_function(input_data)
```

**Verification:**

```bash
# Run the specific test
pytest tests/unit/test_module.py::TestTargetFunction -v

# Expected output: FAILED (test should fail because code doesn't exist yet)
```

### Phase 2: Green (Make Test Pass)

Write the minimal implementation code to make the test pass.

**Guidelines:**

1. Implement only what the test requires
2. Do not add functionality beyond the test's scope
3. Hardcode values if the test allows (refactor later)
4. Focus on making the test green, not on perfect code

**Implementation Template:**

```python
def target_function(input_data: dict) -> dict:
    """Process input data and return result.
    
    Args:
        input_data: Input dictionary with required keys.
        
    Returns:
        Processed result dictionary.
        
    Raises:
        ValueError: If input_data is empty.
    """
    if not input_data:
        raise ValueError("Input cannot be empty")
    
    # Minimal implementation to pass test
    return {"result": "expected"}
```

**Verification:**

```bash
# Run the specific test
pytest tests/unit/test_module.py::TestTargetFunction -v

# Expected output: PASSED
```

### Phase 3: Refactor (Improve Code Quality)

With tests passing, improve the code while keeping tests green.

**Refactoring Checklist:**

1. Remove duplication
2. Improve naming (variables, functions, classes)
3. Extract helper functions if needed
4. Add type hints if missing
5. Ensure code follows project standards
6. Run tests after each change

**Verification:**

```bash
# Run tests after refactoring
pytest tests/unit/test_module.py -v

# Run linter
./tools/lint.sh src/module.py

# Both should pass
```

## Task Completion Protocol

After completing a task:

1. **Verify all tests pass:**
   ```bash
   pytest tests/unit/test_module.py -v
   ```

2. **Update tasks.md:**
   ```markdown
   ### T03: Implement target_function
   - [x] Estimate: 1hr
   - [x] Tests: tests/unit/test_module.py::TestTargetFunction
   - [x] Dependencies: None
   - [x] Notes: Implemented with edge case handling
   ```

3. **Update progress:**
   ```markdown
   ## Progress
   - Tasks Complete: 3/12
   - Percentage: 25%
   - Status: IN_PROGRESS
   ```

4. **Proceed to next task** (return to Phase 1)

## Debugging Failing Tests

If a test fails unexpectedly:

1. **Read the failure message carefully:**
   ```bash
   pytest tests/unit/test_module.py -v --tb=long
   ```

2. **Check the assertion:**
   - Is the expected value correct?
   - Is the actual value what you expected?

3. **Add debug output:**
   ```python
   def test_with_debug(self):
       result = target_function(input_data)
       print(f"DEBUG: result = {result}")  # Will show on failure
       assert result == expected
   ```

4. **Isolate the issue:**
   ```bash
   # Run single test with verbose output
   pytest tests/unit/test_module.py::TestTargetFunction::test_basic_case -v -s
   ```

5. **Fix and re-run** until green.

## Anti-Patterns to Avoid

1. **Writing code before tests** — Always write the test first.

2. **Testing multiple behaviors in one test** — One assertion focus per test.

3. **Ignoring failing tests** — Never skip or comment out failing tests.

4. **Refactoring while red** — Only refactor when tests are green.

5. **Gold-plating** — Don't add features beyond what tests require.

## Integration with Feature Workflow

This skill operates within a single task. For the full feature workflow:

1. Use **Feature Planning Skill** to create the task breakdown
2. Use **TDD Execution Skill** (this skill) for each task
3. Use **Feature Completion Skill** when all tasks are done
