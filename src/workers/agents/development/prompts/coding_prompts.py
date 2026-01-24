"""Prompts for Coding agent.

Provides prompts for implementation generation, retry handling, and style compliance
following TDD principles where implementation is written to pass existing tests.
"""

from __future__ import annotations


IMPLEMENTATION_PROMPT = """You are an expert software engineer implementing code to pass tests.

Your task is to write the minimal, simple implementation that makes all tests pass.
The tests have been written first (TDD) - your code must satisfy them.

## Guidelines

1. **Test-First**: The tests define the expected behavior - implement exactly what they require
2. **Minimal Code**: Write the simplest code that passes all tests - no over-engineering
3. **Clean Code**: Follow SOLID principles and maintain readability
4. **Type Hints**: Include type hints for all function signatures
5. **Docstrings**: Add Google-style docstrings for public functions and classes

## Implementation Pattern

```python
from __future__ import annotations
from typing import Any

def function_name(param: ParamType) -> ReturnType:
    \"\"\"Brief description.

    Args:
        param: Description of parameter.

    Returns:
        Description of return value.

    Raises:
        ExceptionType: When this happens.
    \"\"\"
    # Implementation
    pass
```

## Output Format

Provide complete, runnable Python code that:
1. Passes all provided tests
2. Includes necessary imports
3. Follows the project's coding standards
"""


RETRY_IMPLEMENTATION_PROMPT = """You are an expert software engineer fixing failing tests.

Previous implementation attempts have failed. Analyze the errors and fix the implementation.
Focus on understanding WHY the tests failed and addressing the root cause.

## Guidelines

1. **Analyze Failures**: Understand the error messages and stack traces
2. **Root Cause**: Identify the fundamental issue, not just symptoms
3. **Targeted Fix**: Make minimal changes to fix the specific failures
4. **Avoid Regressions**: Ensure fixes don't break other tests
5. **Learn from Errors**: Each retry should make meaningful progress

## Debugging Approach

1. Read the error messages carefully
2. Identify which test(s) failed and why
3. Trace the failure back to the implementation
4. Determine the minimal fix needed
5. Verify the fix addresses the failure

## Output Format

Provide the corrected implementation with:
1. Clear comments explaining what was fixed
2. The complete updated code
3. Brief explanation of the root cause
"""


STYLE_COMPLIANCE_PROMPT = """You are an expert code reviewer ensuring style compliance.

Review the provided code against style guidelines and suggest improvements.
Focus on consistency, readability, and maintainability.

## Style Guidelines

1. **PEP 8**: Follow Python style guide
2. **Naming**: Use clear, descriptive names (snake_case for functions/variables)
3. **Documentation**: Docstrings for public APIs
4. **Type Hints**: All function signatures should be typed
5. **Imports**: Organize imports (standard library, third-party, local)
6. **Line Length**: Keep lines under 100 characters
7. **Formatting**: Consistent indentation and spacing

## Review Format

1. **Issues Found**: List style violations
2. **Suggested Fixes**: Provide corrected code snippets
3. **Overall Assessment**: Style compliance rating

## Output Format

Provide the style-corrected code with:
1. All formatting issues fixed
2. Type hints added where missing
3. Documentation improved
"""


def format_implementation_prompt(
    task_description: str,
    test_code: str,
    context_pack: str | None = None,
    dependencies: list[str] | None = None,
) -> str:
    """Format the implementation prompt with task-specific details.

    Args:
        task_description: Description of what to implement.
        test_code: The test code that must pass.
        context_pack: Optional existing code context.
        dependencies: Optional list of available dependencies.

    Returns:
        str: Formatted prompt for implementation generation.
    """
    prompt_parts = [
        IMPLEMENTATION_PROMPT,
        "",
        "## Task Description",
        "",
        task_description,
        "",
        "## Test Suite to Pass",
        "",
        "```python",
        test_code,
        "```",
    ]

    if context_pack:
        prompt_parts.extend([
            "",
            "## Existing Code Context",
            "",
            "```python",
            context_pack,
            "```",
        ])

    if dependencies:
        deps_text = ", ".join(dependencies)
        prompt_parts.extend([
            "",
            "## Available Dependencies",
            "",
            f"You can use these packages: {deps_text}",
        ])

    prompt_parts.extend([
        "",
        "## Instructions",
        "",
        "Write implementation code that:",
        "1. Makes all tests pass",
        "2. Uses minimal, clean code",
        "3. Includes type hints and docstrings",
        "4. Handles edge cases appropriately",
        "",
        "Provide the complete implementation file content.",
    ])

    return "\n".join(prompt_parts)


def format_retry_implementation_prompt(
    task_description: str,
    test_code: str,
    previous_implementation: str,
    test_errors: list[str],
    fail_count: int = 1,
    debug_hints: list[str] | None = None,
) -> str:
    """Format the retry implementation prompt with failure context.

    Args:
        task_description: Description of what to implement.
        test_code: The test code that must pass.
        previous_implementation: The implementation that failed.
        test_errors: List of error messages from failed tests.
        fail_count: Number of failed attempts (for context).
        debug_hints: Optional hints from debugger analysis.

    Returns:
        str: Formatted prompt for retry implementation.
    """
    errors_text = "\n".join(f"- {error}" for error in test_errors)

    prompt_parts = [
        RETRY_IMPLEMENTATION_PROMPT,
        "",
        f"## Retry Attempt {fail_count}",
        "",
        "## Task Description",
        "",
        task_description,
        "",
        "## Test Suite to Pass",
        "",
        "```python",
        test_code,
        "```",
        "",
        "## Previous Implementation (FAILED)",
        "",
        "```python",
        previous_implementation,
        "```",
        "",
        "## Test Failures",
        "",
        errors_text,
    ]

    if debug_hints:
        hints_text = "\n".join(f"- {hint}" for hint in debug_hints)
        prompt_parts.extend([
            "",
            "## Debug Hints",
            "",
            hints_text,
        ])

    prompt_parts.extend([
        "",
        "## Instructions",
        "",
        "Fix the implementation to:",
        "1. Address the specific test failures listed above",
        "2. Maintain compatibility with passing tests",
        "3. Not introduce new issues",
        "",
        "Explain what was wrong and provide the corrected implementation.",
    ])

    return "\n".join(prompt_parts)


def format_style_compliance_prompt(
    code: str,
    style_guidelines: list[str] | None = None,
) -> str:
    """Format the style compliance prompt.

    Args:
        code: The code to review for style compliance.
        style_guidelines: Optional specific style guidelines to enforce.

    Returns:
        str: Formatted prompt for style compliance check.
    """
    prompt_parts = [
        STYLE_COMPLIANCE_PROMPT,
        "",
        "## Code to Review",
        "",
        "```python",
        code,
        "```",
    ]

    if style_guidelines:
        guidelines_text = "\n".join(f"- {guideline}" for guideline in style_guidelines)
        prompt_parts.extend([
            "",
            "## Additional Style Guidelines",
            "",
            guidelines_text,
        ])

    prompt_parts.extend([
        "",
        "## Instructions",
        "",
        "Review the code for style compliance:",
        "1. Identify any style violations",
        "2. Provide the corrected code",
        "3. Explain any changes made",
        "",
        "Ensure the corrected code maintains the same functionality.",
    ])

    return "\n".join(prompt_parts)
