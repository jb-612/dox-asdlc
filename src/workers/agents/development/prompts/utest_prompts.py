"""Prompts for UTest agent.

Provides prompts for test generation, fixture creation, and coverage analysis
following TDD principles and pytest best practices.
"""

from __future__ import annotations


TEST_GENERATION_PROMPT = """You are an expert test engineer following Test-Driven Development (TDD) principles.

Your task is to write pytest test cases that will initially fail because the implementation does not yet exist.
These tests define the expected behavior based on the acceptance criteria.

## Guidelines

1. **TDD Red Phase**: Write tests that will fail - the implementation does not exist yet
2. **pytest Syntax**: Use pytest conventions and fixtures
3. **Clear Names**: Test names should describe the expected behavior (test_should_do_x_when_y)
4. **One Assertion per Test**: Each test should verify one specific behavior
5. **Coverage**: Ensure all acceptance criteria have at least one test
6. **Edge Cases**: Include tests for boundary conditions and error cases

## Test Structure

```python
import pytest

class TestFeatureName:
    \"\"\"Tests for [feature description].\"\"\"

    def test_should_do_expected_when_condition(self):
        \"\"\"Test that [expected behavior] when [condition].\"\"\"
        # Arrange
        # Act
        # Assert
```

## Output Format

Provide complete, runnable pytest code that can be saved directly to a test file.
Include docstrings for all tests explaining what they verify.
Map each test to the relevant requirement/acceptance criterion using comments.
"""


FIXTURE_CREATION_PROMPT = """You are an expert test engineer creating pytest fixtures.

Create reusable fixtures that provide test dependencies in a clean, isolated manner.

## Guidelines

1. **Scope**: Use appropriate fixture scope (function, class, module, session)
2. **Cleanup**: Include teardown/cleanup using yield or finalizers when needed
3. **Composition**: Fixtures can depend on other fixtures
4. **Parameterization**: Use @pytest.fixture(params=[...]) for multiple test cases
5. **Naming**: Use clear, descriptive fixture names

## Fixture Structure

```python
import pytest

@pytest.fixture
def fixture_name():
    \"\"\"Provide [description of what fixture provides].\"\"\"
    # Setup
    resource = create_resource()
    yield resource
    # Teardown (optional)
    resource.cleanup()

@pytest.fixture(scope="module")
def shared_fixture():
    \"\"\"Shared fixture for module-level setup.\"\"\"
    return SharedResource()
```

## Output Format

Provide complete fixture definitions that can be added to conftest.py or the test file.
Include docstrings explaining what each fixture provides.
"""


COVERAGE_ANALYSIS_PROMPT = """You are an expert test analyst evaluating test coverage.

Analyze the provided tests against the implementation and acceptance criteria
to identify coverage gaps and suggest additional tests.

## Analysis Guidelines

1. **Line Coverage**: Check which code paths are tested
2. **Branch Coverage**: Verify all conditional branches are tested
3. **Acceptance Coverage**: Map tests to acceptance criteria
4. **Edge Cases**: Identify untested boundary conditions
5. **Error Paths**: Check error handling coverage

## Coverage Report Format

1. **Coverage Summary**
   - Estimated line coverage percentage
   - Branches covered vs total

2. **Acceptance Criteria Coverage**
   - Each criterion with test mapping
   - Gaps identified

3. **Missing Tests**
   - Specific scenarios not covered
   - Suggested test cases

4. **Quality Assessment**
   - Test isolation
   - Assertion quality
   - Maintainability

## Output Format

Provide a structured coverage analysis with specific recommendations
for improving test coverage.
"""


def format_test_generation_prompt(
    task_description: str,
    acceptance_criteria: list[str],
    context: str | None = None,
) -> str:
    """Format the test generation prompt with task-specific details.

    Args:
        task_description: Description of the implementation task.
        acceptance_criteria: List of acceptance criteria to cover.
        context: Optional existing code context.

    Returns:
        str: Formatted prompt for test generation.
    """
    criteria_text = "\n".join(f"- {criterion}" for criterion in acceptance_criteria)

    prompt_parts = [
        TEST_GENERATION_PROMPT,
        "",
        "## Task Description",
        "",
        task_description,
        "",
        "## Acceptance Criteria",
        "",
        criteria_text,
    ]

    if context:
        prompt_parts.extend([
            "",
            "## Existing Code Context",
            "",
            context,
        ])

    prompt_parts.extend([
        "",
        "## Instructions",
        "",
        "Generate pytest test cases that:",
        "1. Cover all acceptance criteria listed above",
        "2. Follow TDD principles (tests should fail initially)",
        "3. Use pytest fixtures where appropriate",
        "4. Include clear docstrings and comments mapping to requirements",
        "",
        "Provide the complete test file content.",
    ])

    return "\n".join(prompt_parts)


def format_fixture_creation_prompt(
    test_requirements: list[str],
    existing_fixtures: list[str] | None = None,
) -> str:
    """Format the fixture creation prompt with requirements.

    Args:
        test_requirements: List of test requirements needing fixtures.
        existing_fixtures: List of existing fixture names to consider.

    Returns:
        str: Formatted prompt for fixture creation.
    """
    requirements_text = "\n".join(f"- {req}" for req in test_requirements)

    prompt_parts = [
        FIXTURE_CREATION_PROMPT,
        "",
        "## Test Requirements",
        "",
        requirements_text,
    ]

    if existing_fixtures:
        fixtures_text = ", ".join(existing_fixtures)
        prompt_parts.extend([
            "",
            "## Existing Fixtures",
            "",
            f"The following fixtures already exist: {fixtures_text}",
            "Consider composing with or extending these fixtures.",
        ])

    prompt_parts.extend([
        "",
        "## Instructions",
        "",
        "Create @pytest.fixture definitions that:",
        "1. Provide the resources needed for the test requirements",
        "2. Use appropriate scope (function, class, module, session)",
        "3. Include proper setup and teardown",
        "4. Follow pytest best practices",
        "",
        "Provide the complete fixture code.",
    ])

    return "\n".join(prompt_parts)


def format_coverage_analysis_prompt(
    test_code: str,
    implementation: str,
    acceptance_criteria: list[str] | None = None,
) -> str:
    """Format the coverage analysis prompt.

    Args:
        test_code: The test code to analyze.
        implementation: The implementation code being tested.
        acceptance_criteria: Optional list of acceptance criteria.

    Returns:
        str: Formatted prompt for coverage analysis.
    """
    prompt_parts = [
        COVERAGE_ANALYSIS_PROMPT,
        "",
        "## Test Code",
        "",
        "```python",
        test_code,
        "```",
        "",
        "## Implementation Code",
        "",
        "```python",
        implementation,
        "```",
    ]

    if acceptance_criteria:
        criteria_text = "\n".join(f"- {criterion}" for criterion in acceptance_criteria)
        prompt_parts.extend([
            "",
            "## Acceptance Criteria",
            "",
            criteria_text,
        ])

    prompt_parts.extend([
        "",
        "## Instructions",
        "",
        "Analyze the test coverage and provide:",
        "1. Coverage summary with estimated percentages",
        "2. Mapping of tests to acceptance criteria",
        "3. Identified coverage gaps",
        "4. Specific recommendations for additional tests",
        "",
        "Be specific about which lines, branches, or scenarios lack coverage.",
    ])

    return "\n".join(prompt_parts)
