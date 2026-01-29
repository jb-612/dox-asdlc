"""Unit tests for Validation agent prompts.

Tests for test result interpretation, integration verification, and performance
analysis prompts with structured output format and issue categorization.
"""

from __future__ import annotations

import pytest

from src.workers.agents.validation.prompts.validation_prompts import (
    TEST_RESULT_INTERPRETATION_PROMPT,
    INTEGRATION_VERIFICATION_PROMPT,
    PERFORMANCE_ANALYSIS_PROMPT,
    format_validation_prompt,
    format_integration_check_prompt,
    format_performance_analysis_prompt,
)


class TestTestResultInterpretationPrompt:
    """Tests for test result interpretation prompt."""

    def test_prompt_exists(self) -> None:
        """Test that test result interpretation prompt is defined."""
        assert TEST_RESULT_INTERPRETATION_PROMPT is not None
        assert len(TEST_RESULT_INTERPRETATION_PROMPT) > 100

    def test_prompt_mentions_test_results(self) -> None:
        """Test that prompt mentions test results."""
        prompt_lower = TEST_RESULT_INTERPRETATION_PROMPT.lower()
        assert "test" in prompt_lower

    def test_prompt_has_issue_categorization(self) -> None:
        """Test that prompt includes issue categorization guidance."""
        prompt_lower = TEST_RESULT_INTERPRETATION_PROMPT.lower()
        assert (
            "categor" in prompt_lower
            or "classification" in prompt_lower
            or "severity" in prompt_lower
        )


class TestIntegrationVerificationPrompt:
    """Tests for integration verification prompt."""

    def test_prompt_exists(self) -> None:
        """Test that integration verification prompt is defined."""
        assert INTEGRATION_VERIFICATION_PROMPT is not None
        assert len(INTEGRATION_VERIFICATION_PROMPT) > 100

    def test_prompt_mentions_integration(self) -> None:
        """Test that prompt mentions integration."""
        assert "integration" in INTEGRATION_VERIFICATION_PROMPT.lower()

    def test_prompt_mentions_verification(self) -> None:
        """Test that prompt mentions verification or checks."""
        prompt_lower = INTEGRATION_VERIFICATION_PROMPT.lower()
        assert "verif" in prompt_lower or "check" in prompt_lower


class TestPerformanceAnalysisPrompt:
    """Tests for performance analysis prompt."""

    def test_prompt_exists(self) -> None:
        """Test that performance analysis prompt is defined."""
        assert PERFORMANCE_ANALYSIS_PROMPT is not None
        assert len(PERFORMANCE_ANALYSIS_PROMPT) > 100

    def test_prompt_mentions_performance(self) -> None:
        """Test that prompt mentions performance."""
        assert "performance" in PERFORMANCE_ANALYSIS_PROMPT.lower()

    def test_prompt_mentions_metrics(self) -> None:
        """Test that prompt mentions metrics or measurements."""
        prompt_lower = PERFORMANCE_ANALYSIS_PROMPT.lower()
        assert "metric" in prompt_lower or "latency" in prompt_lower or "throughput" in prompt_lower


class TestFormatValidationPrompt:
    """Tests for format_validation_prompt function."""

    def test_formats_with_implementation_and_criteria(self) -> None:
        """Test that function formats prompt with implementation and acceptance criteria."""
        implementation = "def process_order(order): return order.total"
        acceptance_criteria = "Orders are processed correctly"
        e2e_results = "10 passed, 2 failed"

        result = format_validation_prompt(implementation, acceptance_criteria, e2e_results)

        assert "process_order" in result
        assert acceptance_criteria in result
        assert "10 passed" in result or "2 failed" in result

    def test_includes_context_pack(self) -> None:
        """Test that function includes optional context pack."""
        result = format_validation_prompt(
            "def example(): pass",
            "Criteria",
            "All passed",
            context_pack="class ExistingService: pass",
        )

        assert "ExistingService" in result

    def test_output_has_structured_format(self) -> None:
        """Test that output includes structured output format."""
        result = format_validation_prompt(
            "def x(): pass",
            "Test criteria",
            "Results here",
        )

        # Should mention structured output or JSON format
        assert "json" in result.lower() or "structured" in result.lower() or "format" in result.lower()

    def test_output_includes_issue_categorization(self) -> None:
        """Test that output includes issue categorization guidance."""
        result = format_validation_prompt(
            "def x(): pass",
            "Test criteria",
            "Results here",
        )

        # Should mention categories or severity
        prompt_lower = result.lower()
        assert (
            "categor" in prompt_lower
            or "critical" in prompt_lower
            or "severity" in prompt_lower
        )


class TestFormatIntegrationCheckPrompt:
    """Tests for format_integration_check_prompt function."""

    def test_formats_with_components(self) -> None:
        """Test that function formats prompt with integration components."""
        components = ["API Gateway", "Database", "Cache"]
        test_results = "Integration tests passed"

        result = format_integration_check_prompt(
            components=components,
            test_results=test_results,
        )

        assert "API Gateway" in result
        assert "Database" in result
        assert "integration" in result.lower()

    def test_includes_contracts(self) -> None:
        """Test that function includes optional contract definitions."""
        result = format_integration_check_prompt(
            components=["Service A"],
            test_results="Passed",
            contracts={"ServiceA": "POST /api/orders -> 201"},
        )

        assert "ServiceA" in result or "POST /api/orders" in result

    def test_includes_dependencies(self) -> None:
        """Test that function includes optional external dependencies."""
        result = format_integration_check_prompt(
            components=["Service"],
            test_results="Passed",
            external_dependencies=["Redis", "PostgreSQL"],
        )

        assert "Redis" in result
        assert "PostgreSQL" in result

    def test_output_mentions_verification(self) -> None:
        """Test that output mentions verification."""
        result = format_integration_check_prompt(
            components=["Service"],
            test_results="Passed",
        )

        prompt_lower = result.lower()
        assert "verif" in prompt_lower or "check" in prompt_lower


class TestFormatPerformanceAnalysisPrompt:
    """Tests for format_performance_analysis_prompt function."""

    def test_formats_with_metrics(self) -> None:
        """Test that function formats prompt with performance metrics."""
        metrics = {
            "avg_latency_ms": 45.2,
            "p99_latency_ms": 120.5,
            "throughput_rps": 1500,
        }

        result = format_performance_analysis_prompt(metrics=metrics)

        assert "45.2" in result or "latency" in result.lower()
        assert "throughput" in result.lower() or "1500" in result

    def test_includes_baselines(self) -> None:
        """Test that function includes optional baseline comparison."""
        result = format_performance_analysis_prompt(
            metrics={"latency_ms": 50},
            baselines={"latency_ms": 40},
        )

        assert "40" in result or "baseline" in result.lower()

    def test_includes_test_context(self) -> None:
        """Test that function includes optional test context."""
        result = format_performance_analysis_prompt(
            metrics={"latency_ms": 50},
            test_context="Load test with 1000 concurrent users",
        )

        assert "1000 concurrent users" in result or "Load test" in result

    def test_includes_resource_utilization(self) -> None:
        """Test that function includes optional resource utilization data."""
        result = format_performance_analysis_prompt(
            metrics={"latency_ms": 50},
            resource_utilization={"cpu_percent": 75.5, "memory_mb": 512},
        )

        assert "75.5" in result or "cpu" in result.lower()
        assert "512" in result or "memory" in result.lower()

    def test_output_has_structured_format(self) -> None:
        """Test that output includes structured output format."""
        result = format_performance_analysis_prompt(metrics={"latency_ms": 50})

        # Should mention structured output or JSON format
        assert "json" in result.lower() or "structured" in result.lower() or "format" in result.lower()

    def test_output_includes_recommendations(self) -> None:
        """Test that output asks for recommendations."""
        result = format_performance_analysis_prompt(metrics={"latency_ms": 50})

        prompt_lower = result.lower()
        assert "recommend" in prompt_lower or "suggest" in prompt_lower or "improv" in prompt_lower
