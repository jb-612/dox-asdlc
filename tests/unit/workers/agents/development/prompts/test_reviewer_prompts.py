"""Unit tests for Reviewer agent prompts."""

from __future__ import annotations

import pytest

from src.workers.agents.development.prompts.reviewer_prompts import (
    QUALITY_REVIEW_PROMPT,
    SECURITY_REVIEW_PROMPT,
    STYLE_REVIEW_PROMPT,
    format_quality_review_prompt,
    format_security_review_prompt,
    format_style_review_prompt,
)


class TestQualityReviewPrompt:
    """Tests for quality review prompt."""

    def test_prompt_exists(self) -> None:
        """Test that quality review prompt is defined."""
        assert QUALITY_REVIEW_PROMPT is not None
        assert len(QUALITY_REVIEW_PROMPT) > 100

    def test_prompt_mentions_quality(self) -> None:
        """Test that prompt mentions code quality."""
        assert "quality" in QUALITY_REVIEW_PROMPT.lower()

    def test_prompt_comprehensive_criteria(self) -> None:
        """Test that prompt has comprehensive review criteria."""
        prompt_lower = QUALITY_REVIEW_PROMPT.lower()
        # Should mention several quality aspects
        assert ("correct" in prompt_lower or
                "maintainab" in prompt_lower or
                "readab" in prompt_lower)


class TestSecurityReviewPrompt:
    """Tests for security review prompt."""

    def test_prompt_exists(self) -> None:
        """Test that security review prompt is defined."""
        assert SECURITY_REVIEW_PROMPT is not None
        assert len(SECURITY_REVIEW_PROMPT) > 100

    def test_prompt_mentions_security(self) -> None:
        """Test that prompt mentions security."""
        assert "security" in SECURITY_REVIEW_PROMPT.lower()

    def test_prompt_mentions_vulnerabilities(self) -> None:
        """Test that prompt mentions vulnerabilities."""
        prompt_lower = SECURITY_REVIEW_PROMPT.lower()
        assert "vulnerab" in prompt_lower or "secret" in prompt_lower or "injection" in prompt_lower


class TestStyleReviewPrompt:
    """Tests for style review prompt."""

    def test_prompt_exists(self) -> None:
        """Test that style review prompt is defined."""
        assert STYLE_REVIEW_PROMPT is not None
        assert len(STYLE_REVIEW_PROMPT) > 100

    def test_prompt_mentions_style(self) -> None:
        """Test that prompt mentions style."""
        assert "style" in STYLE_REVIEW_PROMPT.lower()


class TestFormatQualityReviewPrompt:
    """Tests for format_quality_review_prompt function."""

    def test_formats_with_implementation(self) -> None:
        """Test that function formats prompt with implementation code."""
        implementation = "class UserService:\n    def get_user(self, id): pass"

        result = format_quality_review_prompt(implementation)

        assert "UserService" in result
        assert "get_user" in result

    def test_includes_test_suite(self) -> None:
        """Test that function includes optional test suite."""
        result = format_quality_review_prompt(
            "def example(): pass",
            test_suite="def test_example(): assert example() is None",
        )

        assert "test_example" in result

    def test_includes_test_results(self) -> None:
        """Test that function includes optional test results."""
        result = format_quality_review_prompt(
            "def example(): pass",
            test_results="5 passed, 0 failed, 95% coverage",
        )

        assert "95% coverage" in result or "5 passed" in result

    def test_output_categorizes_issues(self) -> None:
        """Test that output requests issue categorization."""
        result = format_quality_review_prompt("def x(): pass")

        assert "issue" in result.lower() or "review" in result.lower()


class TestFormatSecurityReviewPrompt:
    """Tests for format_security_review_prompt function."""

    def test_formats_with_code(self) -> None:
        """Test that function formats prompt with code to review."""
        code = "password = 'secret123'\ndb.execute(query)"

        result = format_security_review_prompt(code)

        assert "password" in result
        assert "execute" in result

    def test_includes_dependencies(self) -> None:
        """Test that function includes optional dependencies list."""
        result = format_security_review_prompt(
            "import requests",
            dependencies=["requests==2.28.0", "pyyaml==6.0"],
        )

        assert "requests" in result
        assert "pyyaml" in result or "yaml" in result

    def test_includes_file_paths(self) -> None:
        """Test that function includes optional file paths."""
        result = format_security_review_prompt(
            "def x(): pass",
            file_paths=["src/auth/login.py", "src/db/queries.py"],
        )

        assert "login.py" in result or "auth" in result

    def test_output_checks_for_secrets(self) -> None:
        """Test that output checks for hardcoded secrets."""
        result = format_security_review_prompt("API_KEY = 'abc123'")

        assert "secret" in result.lower() or "credential" in result.lower()


class TestFormatStyleReviewPrompt:
    """Tests for format_style_review_prompt function."""

    def test_formats_with_code(self) -> None:
        """Test that function formats prompt with code to review."""
        code = "def badlyNamedFunction():return True"

        result = format_style_review_prompt(code)

        assert "badlyNamedFunction" in result

    def test_includes_project_guidelines(self) -> None:
        """Test that function includes optional project guidelines."""
        result = format_style_review_prompt(
            "def x(): pass",
            project_guidelines=["Use snake_case", "Max line length 100"],
        )

        assert "snake_case" in result
        assert "line length" in result

    def test_includes_linter_output(self) -> None:
        """Test that function includes optional linter output."""
        result = format_style_review_prompt(
            "def x(): pass",
            linter_output="E501: line too long (120 > 100 characters)",
        )

        assert "E501" in result or "line too long" in result

    def test_output_requests_style_fixes(self) -> None:
        """Test that output requests style compliance fixes."""
        result = format_style_review_prompt("def x(): pass")

        assert "style" in result.lower() or "format" in result.lower()
