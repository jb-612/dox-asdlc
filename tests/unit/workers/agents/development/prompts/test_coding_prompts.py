"""Unit tests for Coding agent prompts."""

from __future__ import annotations

import pytest

from src.workers.agents.development.prompts.coding_prompts import (
    IMPLEMENTATION_PROMPT,
    RETRY_IMPLEMENTATION_PROMPT,
    STYLE_COMPLIANCE_PROMPT,
    format_implementation_prompt,
    format_retry_implementation_prompt,
    format_style_compliance_prompt,
)


class TestImplementationPrompt:
    """Tests for implementation generation prompt."""

    def test_prompt_exists(self) -> None:
        """Test that implementation prompt is defined."""
        assert IMPLEMENTATION_PROMPT is not None
        assert len(IMPLEMENTATION_PROMPT) > 100

    def test_prompt_references_tests(self) -> None:
        """Test that prompt mentions passing tests."""
        assert "test" in IMPLEMENTATION_PROMPT.lower()

    def test_prompt_mentions_minimal_code(self) -> None:
        """Test that prompt encourages minimal implementation."""
        assert "minimal" in IMPLEMENTATION_PROMPT.lower() or "simple" in IMPLEMENTATION_PROMPT.lower()


class TestRetryImplementationPrompt:
    """Tests for retry implementation prompt."""

    def test_prompt_exists(self) -> None:
        """Test that retry prompt is defined."""
        assert RETRY_IMPLEMENTATION_PROMPT is not None
        assert len(RETRY_IMPLEMENTATION_PROMPT) > 100

    def test_prompt_mentions_failures(self) -> None:
        """Test that prompt addresses previous failures."""
        assert "fail" in RETRY_IMPLEMENTATION_PROMPT.lower() or "error" in RETRY_IMPLEMENTATION_PROMPT.lower()


class TestStyleCompliancePrompt:
    """Tests for style compliance prompt."""

    def test_prompt_exists(self) -> None:
        """Test that style prompt is defined."""
        assert STYLE_COMPLIANCE_PROMPT is not None
        assert len(STYLE_COMPLIANCE_PROMPT) > 100

    def test_prompt_mentions_style(self) -> None:
        """Test that prompt mentions style guidelines."""
        assert "style" in STYLE_COMPLIANCE_PROMPT.lower()


class TestFormatImplementationPrompt:
    """Tests for format_implementation_prompt function."""

    def test_formats_with_task_and_tests(self) -> None:
        """Test that function formats prompt with task and test suite."""
        task_description = "Implement user authentication"
        test_code = "def test_login(): assert login('user', 'pass')"

        result = format_implementation_prompt(task_description, test_code)

        assert task_description in result
        assert "test_login" in result

    def test_includes_context_pack(self) -> None:
        """Test that function includes optional context pack."""
        result = format_implementation_prompt(
            "Test task",
            "def test_x(): pass",
            context_pack="class ExistingClass: pass",
        )

        assert "ExistingClass" in result

    def test_includes_dependencies(self) -> None:
        """Test that function includes dependencies list."""
        result = format_implementation_prompt(
            "Test task",
            "def test_x(): pass",
            dependencies=["requests", "pydantic"],
        )

        assert "requests" in result
        assert "pydantic" in result

    def test_output_targets_test_suite(self) -> None:
        """Test that output emphasizes passing tests."""
        result = format_implementation_prompt(
            "Test task",
            "def test_example(): assert example() == True",
        )

        assert "pass" in result.lower() or "test" in result.lower()


class TestFormatRetryImplementationPrompt:
    """Tests for format_retry_implementation_prompt function."""

    def test_formats_with_previous_impl_and_errors(self) -> None:
        """Test that function formats prompt with previous implementation and errors."""
        previous_impl = "def example(): return None"
        test_errors = ["AssertionError: expected True, got None"]

        result = format_retry_implementation_prompt(
            "Test task",
            "def test_x(): pass",
            previous_impl,
            test_errors,
        )

        assert "def example" in result or previous_impl in result
        assert "AssertionError" in result

    def test_includes_fail_count(self) -> None:
        """Test that function includes retry count."""
        result = format_retry_implementation_prompt(
            "Test task",
            "def test_x(): pass",
            "def x(): pass",
            ["Error"],
            fail_count=3,
        )

        assert "3" in result or "retry" in result.lower()

    def test_includes_debug_hints(self) -> None:
        """Test that function includes optional debug hints."""
        result = format_retry_implementation_prompt(
            "Test task",
            "def test_x(): pass",
            "def x(): pass",
            ["Error"],
            debug_hints=["Check the return type"],
        )

        assert "return type" in result

    def test_output_addresses_failures(self) -> None:
        """Test that output emphasizes fixing failures."""
        result = format_retry_implementation_prompt(
            "Test task",
            "def test_x(): pass",
            "def x(): pass",
            ["Test failed"],
        )

        assert "fix" in result.lower() or "fail" in result.lower()


class TestFormatStyleCompliancePrompt:
    """Tests for format_style_compliance_prompt function."""

    def test_formats_with_code(self) -> None:
        """Test that function formats prompt with code to review."""
        code = "def example():return True"

        result = format_style_compliance_prompt(code)

        assert "def example" in result

    def test_includes_style_guidelines(self) -> None:
        """Test that function includes optional style guidelines."""
        result = format_style_compliance_prompt(
            "def x(): pass",
            style_guidelines=["Use type hints", "Add docstrings"],
        )

        assert "type hints" in result
        assert "docstrings" in result

    def test_output_mentions_style_rules(self) -> None:
        """Test that output references style checking."""
        result = format_style_compliance_prompt("def x(): pass")

        assert "style" in result.lower() or "format" in result.lower()
