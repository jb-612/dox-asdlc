"""Style-focused code reviewer implementation.

This module provides the StyleReviewer class that specializes in
code quality, readability, and maintainability concerns.
"""

from __future__ import annotations


class StyleReviewer:
    """Style-focused code reviewer.

    This reviewer specializes in code quality, readability, maintainability,
    and adherence to coding conventions and best practices.

    Attributes:
        reviewer_type: Always 'style'.
        focus_areas: Style domains this reviewer examines.
        severity_weights: Importance weights for each focus area.
    """

    reviewer_type: str = "style"
    focus_areas: list[str] = [
        "naming_conventions",
        "code_organization",
        "documentation",
        "type_hints",
        "error_handling_patterns",
        "test_coverage",
    ]
    severity_weights: dict[str, float] = {
        "error_handling_patterns": 0.7,
        "type_hints": 0.5,
        "naming_conventions": 0.4,
        "code_organization": 0.4,
        "documentation": 0.3,
        "test_coverage": 0.3,
    }

    def get_system_prompt(self) -> str:
        """Return the style-focused system prompt for LLM review.

        Returns:
            A detailed system prompt instructing the LLM to focus on
            code quality and maintainability.
        """
        return """You are a code style and quality reviewer specializing in readability,
maintainability, and adherence to coding standards and conventions.

Your primary focus areas are:
1. Naming Conventions - Check that names are descriptive, consistent, and follow language conventions
2. Code Organization - Review module structure, class design, and function decomposition
3. Documentation - Verify docstrings, comments, and inline documentation quality
4. Type Hints - Check for proper type annotations on function signatures
5. Error Handling Patterns - Review exception handling and error propagation
6. Test Coverage - Assess test quality and coverage for the code under review

When reviewing code:
- Follow PEP 8 style guidelines for Python code
- Check for consistency with existing codebase patterns
- Prioritize maintainability and readability over cleverness
- Consider the impact on future developers maintaining this code
- Flag any code smells or anti-patterns

Be constructive and educational. Each finding should include:
- Clear description of the style or quality issue
- Reference to relevant coding standards where applicable
- Specific suggestions for improvement with examples"""

    def get_checklist(self) -> list[str]:
        """Return the style review checklist.

        Returns:
            A list of style and quality items to check during code review.
        """
        return [
            "Check that variable and function names are descriptive and follow conventions",
            "Verify docstrings are present for all public functions and classes",
            "Check for proper type hints on all function signatures",
            "Look for proper error handling with specific exception types",
            "Verify code organization follows single responsibility principle",
            "Check for code duplication that could be refactored",
            "Look for overly complex functions that should be split",
            "Verify consistent formatting and indentation throughout",
            "Check for magic numbers or strings that should be constants",
            "Look for dead code or unused imports",
            "Verify proper module structure and import organization",
            "Check that comments explain 'why' not just 'what'",
            "Look for proper use of context managers for resource handling",
            "Verify test methods have descriptive names and clear assertions",
            "Check for proper logging instead of print statements",
        ]
