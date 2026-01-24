"""Unit tests for UTest agent prompts."""

from __future__ import annotations

import pytest

from src.workers.agents.development.prompts.utest_prompts import (
    TEST_GENERATION_PROMPT,
    FIXTURE_CREATION_PROMPT,
    COVERAGE_ANALYSIS_PROMPT,
    format_test_generation_prompt,
    format_fixture_creation_prompt,
    format_coverage_analysis_prompt,
)


class TestTestGenerationPrompt:
    """Tests for test generation prompt."""

    def test_prompt_exists(self) -> None:
        """Test that test generation prompt is defined."""
        assert TEST_GENERATION_PROMPT is not None
        assert len(TEST_GENERATION_PROMPT) > 100

    def test_prompt_contains_pytest_reference(self) -> None:
        """Test that prompt mentions pytest."""
        assert "pytest" in TEST_GENERATION_PROMPT.lower()

    def test_prompt_mentions_tdd(self) -> None:
        """Test that prompt mentions TDD principles."""
        assert "tdd" in TEST_GENERATION_PROMPT.lower() or "test-driven" in TEST_GENERATION_PROMPT.lower()


class TestFixtureCreationPrompt:
    """Tests for fixture creation prompt."""

    def test_prompt_exists(self) -> None:
        """Test that fixture creation prompt is defined."""
        assert FIXTURE_CREATION_PROMPT is not None
        assert len(FIXTURE_CREATION_PROMPT) > 100

    def test_prompt_contains_fixture_reference(self) -> None:
        """Test that prompt mentions fixtures."""
        assert "fixture" in FIXTURE_CREATION_PROMPT.lower()


class TestCoverageAnalysisPrompt:
    """Tests for coverage analysis prompt."""

    def test_prompt_exists(self) -> None:
        """Test that coverage analysis prompt is defined."""
        assert COVERAGE_ANALYSIS_PROMPT is not None
        assert len(COVERAGE_ANALYSIS_PROMPT) > 100

    def test_prompt_contains_coverage_reference(self) -> None:
        """Test that prompt mentions coverage."""
        assert "coverage" in COVERAGE_ANALYSIS_PROMPT.lower()


class TestFormatTestGenerationPrompt:
    """Tests for format_test_generation_prompt function."""

    def test_formats_with_task_and_criteria(self) -> None:
        """Test that function formats prompt with task and criteria."""
        task_description = "Implement user login functionality"
        acceptance_criteria = [
            "User can login with valid credentials",
            "User sees error with invalid credentials",
        ]

        result = format_test_generation_prompt(task_description, acceptance_criteria)

        assert task_description in result
        assert "valid credentials" in result
        assert "invalid credentials" in result

    def test_formats_with_context(self) -> None:
        """Test that function includes optional context."""
        result = format_test_generation_prompt(
            "Test task",
            ["Criterion 1"],
            context="This is existing code context.",
        )

        assert "existing code context" in result

    def test_includes_requirement_refs(self) -> None:
        """Test that function includes requirement references."""
        acceptance_criteria = ["REQ-001: User can login"]

        result = format_test_generation_prompt(
            "Test task",
            acceptance_criteria,
        )

        assert "REQ-001" in result

    def test_output_contains_pytest_markers(self) -> None:
        """Test that output mentions pytest syntax elements."""
        result = format_test_generation_prompt(
            "Test task",
            ["Criterion 1"],
        )

        # The formatted prompt should reference pytest syntax
        assert "pytest" in result.lower() or "def test_" in result.lower()


class TestFormatFixtureCreationPrompt:
    """Tests for format_fixture_creation_prompt function."""

    def test_formats_with_requirements(self) -> None:
        """Test that function formats prompt with test requirements."""
        test_requirements = [
            "Database connection needed",
            "Mock user session required",
        ]

        result = format_fixture_creation_prompt(test_requirements)

        assert "Database connection" in result
        assert "Mock user session" in result

    def test_includes_existing_fixtures(self) -> None:
        """Test that function includes existing fixtures context."""
        result = format_fixture_creation_prompt(
            ["Need database"],
            existing_fixtures=["db_connection", "test_client"],
        )

        assert "db_connection" in result or "existing" in result.lower()

    def test_output_contains_fixture_syntax(self) -> None:
        """Test that output mentions pytest fixture syntax."""
        result = format_fixture_creation_prompt(["Need fixture"])

        assert "@pytest.fixture" in result or "fixture" in result.lower()


class TestFormatCoverageAnalysisPrompt:
    """Tests for format_coverage_analysis_prompt function."""

    def test_formats_with_test_code_and_impl(self) -> None:
        """Test that function formats prompt with test code and implementation."""
        test_code = "def test_example(): assert True"
        implementation = "def example(): return True"

        result = format_coverage_analysis_prompt(test_code, implementation)

        assert "test_example" in result or test_code in result
        assert "def example" in result or implementation in result

    def test_includes_acceptance_criteria(self) -> None:
        """Test that function includes acceptance criteria."""
        result = format_coverage_analysis_prompt(
            "def test_x(): pass",
            "def x(): pass",
            acceptance_criteria=["Must handle edge cases"],
        )

        assert "edge cases" in result

    def test_output_mentions_coverage_metrics(self) -> None:
        """Test that output mentions coverage concepts."""
        result = format_coverage_analysis_prompt(
            "def test_x(): pass",
            "def x(): pass",
        )

        assert "coverage" in result.lower() or "cover" in result.lower()
