"""Prompts for Reviewer agent.

Provides prompts for quality review, security review, and style compliance
using the Opus model for high-quality code review.
"""

from __future__ import annotations


QUALITY_REVIEW_PROMPT = """You are an expert code reviewer evaluating code quality.

Review the implementation for correctness, maintainability, and readability.
Provide constructive feedback with specific, actionable suggestions.

## Quality Criteria

1. **Correctness**: Does the code do what it should?
2. **Completeness**: Are all requirements implemented?
3. **Maintainability**: Is the code easy to understand and modify?
4. **Readability**: Is the code clear and well-documented?
5. **Efficiency**: Are there performance concerns?
6. **Error Handling**: Are errors handled appropriately?
7. **Testing**: Is the code adequately tested?

## Review Guidelines

- Focus on significant issues over style nitpicks
- Provide specific examples for each issue
- Suggest concrete improvements
- Acknowledge good practices

## Issue Categories

- **Critical**: Must fix before merge
- **Major**: Should fix, significant impact
- **Minor**: Nice to fix, low impact
- **Suggestion**: Optional improvement

## Output Format

Provide a structured review with:
1. Summary verdict (approve/request changes)
2. List of issues by category
3. Specific suggestions with code examples
"""


SECURITY_REVIEW_PROMPT = """You are an expert security reviewer analyzing code for vulnerabilities.

Review the implementation for security issues including hardcoded secrets,
injection vulnerabilities, and insecure patterns.

## Security Checklist

1. **Secrets**: No hardcoded passwords, API keys, tokens, or credentials
2. **Injection**: SQL, command, LDAP, XPath injection prevention
3. **Input Validation**: All user input validated and sanitized
4. **Authentication**: Secure authentication patterns
5. **Authorization**: Proper access control checks
6. **Cryptography**: Secure algorithms and key management
7. **Data Exposure**: Sensitive data not logged or exposed
8. **Dependencies**: Known vulnerabilities in dependencies

## Common Vulnerabilities

- Hardcoded secrets (passwords, API keys)
- SQL injection from string concatenation
- Command injection from shell execution
- Path traversal from user input in file paths
- XSS from unescaped user content
- Insecure deserialization

## Output Format

Provide a security assessment with:
1. Overall security verdict (secure/concerns)
2. List of security issues found
3. Severity rating for each issue
4. Specific remediation steps
"""


STYLE_REVIEW_PROMPT = """You are an expert code reviewer checking style compliance.

Review the implementation against Python style guidelines and project standards.
Focus on consistency, readability, and convention adherence.

## Style Guidelines

1. **PEP 8**: Python style guide compliance
2. **Naming**: Clear, descriptive names following conventions
3. **Documentation**: Docstrings for public APIs
4. **Type Hints**: Type annotations on function signatures
5. **Imports**: Properly organized imports
6. **Formatting**: Consistent indentation and spacing
7. **Line Length**: Lines under 100 characters

## Style Elements to Check

- Function and variable naming (snake_case)
- Class naming (PascalCase)
- Constant naming (UPPER_CASE)
- Import organization (stdlib, third-party, local)
- Docstring format (Google style)
- Type hint coverage
- Blank line usage
- Comment quality

## Output Format

Provide a style review with:
1. Overall style compliance rating
2. List of style violations
3. Corrected code snippets
4. General style recommendations
"""


def format_quality_review_prompt(
    implementation: str,
    test_suite: str | None = None,
    test_results: str | None = None,
) -> str:
    """Format the quality review prompt.

    Args:
        implementation: The implementation code to review.
        test_suite: Optional test suite code.
        test_results: Optional test execution results.

    Returns:
        str: Formatted prompt for quality review.
    """
    prompt_parts = [
        QUALITY_REVIEW_PROMPT,
        "",
        "## Implementation to Review",
        "",
        "```python",
        implementation,
        "```",
    ]

    if test_suite:
        prompt_parts.extend([
            "",
            "## Test Suite",
            "",
            "```python",
            test_suite,
            "```",
        ])

    if test_results:
        prompt_parts.extend([
            "",
            "## Test Results",
            "",
            test_results,
        ])

    prompt_parts.extend([
        "",
        "## Instructions",
        "",
        "Review the code for quality and provide:",
        "1. Overall verdict with rationale",
        "2. Issues categorized by severity",
        "3. Specific suggestions with examples",
        "",
        "Focus on significant issues that impact correctness or maintainability.",
    ])

    return "\n".join(prompt_parts)


def format_security_review_prompt(
    code: str,
    dependencies: list[str] | None = None,
    file_paths: list[str] | None = None,
) -> str:
    """Format the security review prompt.

    Args:
        code: The code to review for security.
        dependencies: Optional list of dependencies with versions.
        file_paths: Optional list of file paths being reviewed.

    Returns:
        str: Formatted prompt for security review.
    """
    prompt_parts = [
        SECURITY_REVIEW_PROMPT,
        "",
        "## Code to Review",
        "",
        "```python",
        code,
        "```",
    ]

    if dependencies:
        deps_text = "\n".join(f"- {dep}" for dep in dependencies)
        prompt_parts.extend([
            "",
            "## Dependencies",
            "",
            deps_text,
        ])

    if file_paths:
        paths_text = "\n".join(f"- {path}" for path in file_paths)
        prompt_parts.extend([
            "",
            "## File Paths",
            "",
            paths_text,
        ])

    prompt_parts.extend([
        "",
        "## Instructions",
        "",
        "Check for security issues including:",
        "1. Hardcoded secrets or credentials",
        "2. Injection vulnerabilities",
        "3. Input validation issues",
        "4. Insecure patterns",
        "",
        "Provide specific findings with remediation steps.",
    ])

    return "\n".join(prompt_parts)


def format_style_review_prompt(
    code: str,
    project_guidelines: list[str] | None = None,
    linter_output: str | None = None,
) -> str:
    """Format the style review prompt.

    Args:
        code: The code to review for style.
        project_guidelines: Optional project-specific guidelines.
        linter_output: Optional output from linter tools.

    Returns:
        str: Formatted prompt for style review.
    """
    prompt_parts = [
        STYLE_REVIEW_PROMPT,
        "",
        "## Code to Review",
        "",
        "```python",
        code,
        "```",
    ]

    if project_guidelines:
        guidelines_text = "\n".join(f"- {guideline}" for guideline in project_guidelines)
        prompt_parts.extend([
            "",
            "## Project Guidelines",
            "",
            guidelines_text,
        ])

    if linter_output:
        prompt_parts.extend([
            "",
            "## Linter Output",
            "",
            "```",
            linter_output,
            "```",
        ])

    prompt_parts.extend([
        "",
        "## Instructions",
        "",
        "Review the code for style compliance:",
        "1. Check against PEP 8 and project guidelines",
        "2. Identify style violations",
        "3. Provide corrected code snippets",
        "",
        "Focus on consistency and readability.",
    ])

    return "\n".join(prompt_parts)
