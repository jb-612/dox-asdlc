"""Prompts for Debugger agent.

Provides prompts for failure analysis, root cause identification, and fix suggestions
using RLM exploration for deep debugging of persistent test failures.
"""

from __future__ import annotations


FAILURE_ANALYSIS_PROMPT = """You are an expert debugger analyzing test failures.

Examine the test output and implementation to understand why tests are failing.
Your goal is to identify the specific issues causing test failures.

## Analysis Guidelines

1. **Read Error Messages**: Parse error messages and stack traces carefully
2. **Identify Failure Points**: Locate exactly where tests fail
3. **Compare Expected vs Actual**: Note the difference between expected and actual values
4. **Check Edge Cases**: Look for boundary conditions and special cases
5. **Trace Data Flow**: Follow data through the implementation

## Analysis Structure

1. **Test Identification**: Which tests are failing
2. **Error Type**: What kind of errors (assertion, exception, timeout)
3. **Failure Location**: Where in the code the failure occurs
4. **Observed Behavior**: What the code actually does
5. **Expected Behavior**: What the test expects

## Output Format

Provide a structured analysis with:
- List of failing tests with their error messages
- Specific lines of code involved
- Initial hypothesis for each failure
"""


ROOT_CAUSE_PROMPT = """You are an expert debugger identifying root causes of test failures.

Based on the failure analysis, determine the fundamental root cause of the issues.
Look beyond symptoms to find the underlying problem.

## Root Cause Analysis Guidelines

1. **Five Whys**: Ask "why" repeatedly to dig deeper
2. **Pattern Recognition**: Look for common patterns across failures
3. **Code Review**: Examine the implementation logic
4. **State Analysis**: Check for state management issues
5. **Dependency Check**: Verify dependencies are correct

## Common Root Causes

- Logic errors (wrong algorithm, off-by-one)
- Type mismatches
- Missing initialization
- Incorrect assumptions
- Race conditions
- Resource leaks

## Output Format

Provide:
1. Clear statement of the root cause
2. Evidence supporting the conclusion
3. How this root cause leads to the observed failures
"""


FIX_SUGGESTION_PROMPT = """You are an expert debugger providing actionable fix suggestions.

Based on the root cause analysis, propose specific code changes to fix the issues.
Provide concrete, implementable fixes that address the root cause.

## Fix Guidelines

1. **Minimal Change**: Fix only what's needed
2. **No Side Effects**: Ensure fixes don't break other functionality
3. **Testable**: Fixes should make tests pass
4. **Maintainable**: Follow code quality standards
5. **Document**: Explain why each change is needed

## Fix Format

For each fix, provide:
1. File path and line numbers
2. Original code to replace
3. New code to insert
4. Explanation of the change

## Output Format

Provide structured fixes with:
- Clear before/after code snippets
- Rationale for each change
- Expected outcome after applying fixes
"""


def format_failure_analysis_prompt(
    test_output: str,
    implementation: str,
    stack_trace: str | None = None,
) -> str:
    """Format the failure analysis prompt.

    Args:
        test_output: Output from running tests (including failures).
        implementation: The implementation code being tested.
        stack_trace: Optional detailed stack trace.

    Returns:
        str: Formatted prompt for failure analysis.
    """
    prompt_parts = [
        FAILURE_ANALYSIS_PROMPT,
        "",
        "## Test Output",
        "",
        "```",
        test_output,
        "```",
        "",
        "## Implementation Code",
        "",
        "```python",
        implementation,
        "```",
    ]

    if stack_trace:
        prompt_parts.extend([
            "",
            "## Stack Trace",
            "",
            "```",
            stack_trace,
            "```",
        ])

    prompt_parts.extend([
        "",
        "## Instructions",
        "",
        "Analyze the test failures and provide:",
        "1. List of each failing test with its error",
        "2. Location in the implementation causing the failure",
        "3. Initial hypothesis for each failure",
        "",
        "Be specific about which code is problematic.",
    ])

    return "\n".join(prompt_parts)


def format_root_cause_prompt(
    failure_analysis: str,
    code_context: str | None = None,
    test_context: str | None = None,
) -> str:
    """Format the root cause identification prompt.

    Args:
        failure_analysis: Results from failure analysis.
        code_context: Optional additional code context.
        test_context: Optional test code context.

    Returns:
        str: Formatted prompt for root cause identification.
    """
    prompt_parts = [
        ROOT_CAUSE_PROMPT,
        "",
        "## Failure Analysis",
        "",
        failure_analysis,
    ]

    if code_context:
        prompt_parts.extend([
            "",
            "## Additional Code Context",
            "",
            "```python",
            code_context,
            "```",
        ])

    if test_context:
        prompt_parts.extend([
            "",
            "## Test Context",
            "",
            "```python",
            test_context,
            "```",
        ])

    prompt_parts.extend([
        "",
        "## Instructions",
        "",
        "Identify the root cause by:",
        "1. Looking beyond the immediate symptoms",
        "2. Finding the fundamental issue",
        "3. Explaining how it causes all the failures",
        "",
        "Provide a clear, concise root cause statement.",
    ])

    return "\n".join(prompt_parts)


def format_fix_suggestion_prompt(
    root_cause: str,
    code: str,
    test_expectations: list[str] | None = None,
) -> str:
    """Format the fix suggestion prompt.

    Args:
        root_cause: The identified root cause.
        code: The code needing fixes.
        test_expectations: Optional list of test expectations.

    Returns:
        str: Formatted prompt for fix suggestions.
    """
    prompt_parts = [
        FIX_SUGGESTION_PROMPT,
        "",
        "## Root Cause",
        "",
        root_cause,
        "",
        "## Code to Fix",
        "",
        "```python",
        code,
        "```",
    ]

    if test_expectations:
        expectations_text = "\n".join(f"- {exp}" for exp in test_expectations)
        prompt_parts.extend([
            "",
            "## Test Expectations",
            "",
            expectations_text,
        ])

    prompt_parts.extend([
        "",
        "## Instructions",
        "",
        "Provide specific fixes that:",
        "1. Address the root cause directly",
        "2. Make all tests pass",
        "3. Use minimal code changes",
        "",
        "Format each fix with file path, original code, and new code.",
    ])

    return "\n".join(prompt_parts)
