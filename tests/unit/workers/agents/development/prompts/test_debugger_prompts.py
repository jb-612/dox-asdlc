"""Unit tests for Debugger agent prompts."""

from __future__ import annotations

import pytest

from src.workers.agents.development.prompts.debugger_prompts import (
    FAILURE_ANALYSIS_PROMPT,
    ROOT_CAUSE_PROMPT,
    FIX_SUGGESTION_PROMPT,
    format_failure_analysis_prompt,
    format_root_cause_prompt,
    format_fix_suggestion_prompt,
)


class TestFailureAnalysisPrompt:
    """Tests for failure analysis prompt."""

    def test_prompt_exists(self) -> None:
        """Test that failure analysis prompt is defined."""
        assert FAILURE_ANALYSIS_PROMPT is not None
        assert len(FAILURE_ANALYSIS_PROMPT) > 100

    def test_prompt_mentions_failure(self) -> None:
        """Test that prompt mentions analyzing failures."""
        assert "fail" in FAILURE_ANALYSIS_PROMPT.lower()

    def test_prompt_mentions_error(self) -> None:
        """Test that prompt mentions errors."""
        assert "error" in FAILURE_ANALYSIS_PROMPT.lower()


class TestRootCausePrompt:
    """Tests for root cause identification prompt."""

    def test_prompt_exists(self) -> None:
        """Test that root cause prompt is defined."""
        assert ROOT_CAUSE_PROMPT is not None
        assert len(ROOT_CAUSE_PROMPT) > 100

    def test_prompt_mentions_root_cause(self) -> None:
        """Test that prompt mentions root cause."""
        assert "root" in ROOT_CAUSE_PROMPT.lower() or "cause" in ROOT_CAUSE_PROMPT.lower()


class TestFixSuggestionPrompt:
    """Tests for fix suggestion prompt."""

    def test_prompt_exists(self) -> None:
        """Test that fix suggestion prompt is defined."""
        assert FIX_SUGGESTION_PROMPT is not None
        assert len(FIX_SUGGESTION_PROMPT) > 100

    def test_prompt_mentions_fix(self) -> None:
        """Test that prompt mentions fixing."""
        assert "fix" in FIX_SUGGESTION_PROMPT.lower()


class TestFormatFailureAnalysisPrompt:
    """Tests for format_failure_analysis_prompt function."""

    def test_formats_with_test_results_and_impl(self) -> None:
        """Test that function formats prompt with test results and implementation."""
        test_output = "FAILED test_example - AssertionError: expected 1, got 0"
        implementation = "def example(): return 0"

        result = format_failure_analysis_prompt(test_output, implementation)

        assert "AssertionError" in result
        assert "def example" in result

    def test_includes_stack_trace(self) -> None:
        """Test that function includes optional stack trace."""
        result = format_failure_analysis_prompt(
            "FAILED",
            "def x(): pass",
            stack_trace="File 'test.py', line 10\n    assert x() == 1",
        )

        assert "line 10" in result

    def test_output_requests_structured_analysis(self) -> None:
        """Test that output requests structured analysis."""
        result = format_failure_analysis_prompt("FAILED", "def x(): pass")

        assert "analy" in result.lower()


class TestFormatRootCausePrompt:
    """Tests for format_root_cause_prompt function."""

    def test_formats_with_failure_analysis(self) -> None:
        """Test that function formats prompt with failure analysis."""
        analysis = "The function returns None instead of the expected integer"

        result = format_root_cause_prompt(analysis)

        assert "returns None" in result

    def test_includes_code_context(self) -> None:
        """Test that function includes optional code context."""
        result = format_root_cause_prompt(
            "Analysis",
            code_context="class MyClass:\n    def method(self): pass",
        )

        assert "MyClass" in result

    def test_includes_test_context(self) -> None:
        """Test that function includes optional test context."""
        result = format_root_cause_prompt(
            "Analysis",
            test_context="def test_method(): assert obj.method() == expected",
        )

        assert "test_method" in result

    def test_output_requests_root_cause(self) -> None:
        """Test that output requests root cause identification."""
        result = format_root_cause_prompt("Analysis")

        assert "root" in result.lower() or "cause" in result.lower()


class TestFormatFixSuggestionPrompt:
    """Tests for format_fix_suggestion_prompt function."""

    def test_formats_with_root_cause_and_code(self) -> None:
        """Test that function formats prompt with root cause and code."""
        root_cause = "Variable not initialized before use"
        code = "def example(): return x"

        result = format_fix_suggestion_prompt(root_cause, code)

        assert "not initialized" in result
        assert "def example" in result

    def test_includes_test_expectations(self) -> None:
        """Test that function includes optional test expectations."""
        result = format_fix_suggestion_prompt(
            "Root cause",
            "def x(): pass",
            test_expectations=["Should return 1 for input 'a'"],
        )

        assert "return 1" in result or "input 'a'" in result

    def test_output_provides_actionable_fixes(self) -> None:
        """Test that output emphasizes actionable fixes."""
        result = format_fix_suggestion_prompt("Root cause", "def x(): pass")

        assert "fix" in result.lower() or "change" in result.lower()
