"""Unit tests for Deployment agent prompts.

Tests for deployment plan creation prompts with strategy-specific guidance.
"""

from __future__ import annotations

import pytest

from src.workers.agents.deployment.prompts.deployment_prompts import (
    DEPLOYMENT_PLAN_PROMPT,
    ROLLING_STRATEGY_GUIDANCE,
    BLUE_GREEN_STRATEGY_GUIDANCE,
    CANARY_STRATEGY_GUIDANCE,
    format_deployment_plan_prompt,
)


class TestDeploymentPlanPrompt:
    """Tests for deployment plan prompt."""

    def test_prompt_exists(self) -> None:
        """Test that deployment plan prompt is defined."""
        assert DEPLOYMENT_PLAN_PROMPT is not None
        assert len(DEPLOYMENT_PLAN_PROMPT) > 100

    def test_prompt_mentions_deployment(self) -> None:
        """Test that prompt mentions deployment."""
        prompt_lower = DEPLOYMENT_PLAN_PROMPT.lower()
        assert "deploy" in prompt_lower

    def test_prompt_mentions_plan(self) -> None:
        """Test that prompt mentions plan or steps."""
        prompt_lower = DEPLOYMENT_PLAN_PROMPT.lower()
        assert "plan" in prompt_lower or "step" in prompt_lower

    def test_prompt_mentions_health_checks(self) -> None:
        """Test that prompt mentions health checks."""
        prompt_lower = DEPLOYMENT_PLAN_PROMPT.lower()
        assert "health" in prompt_lower or "check" in prompt_lower

    def test_prompt_mentions_rollback(self) -> None:
        """Test that prompt mentions rollback."""
        prompt_lower = DEPLOYMENT_PLAN_PROMPT.lower()
        assert "rollback" in prompt_lower

    def test_prompt_has_structured_output(self) -> None:
        """Test that prompt includes structured output format."""
        assert "json" in DEPLOYMENT_PLAN_PROMPT.lower()


class TestRollingStrategyGuidance:
    """Tests for rolling strategy guidance."""

    def test_guidance_exists(self) -> None:
        """Test that rolling strategy guidance is defined."""
        assert ROLLING_STRATEGY_GUIDANCE is not None
        assert len(ROLLING_STRATEGY_GUIDANCE) > 50

    def test_guidance_mentions_rolling(self) -> None:
        """Test that guidance mentions rolling update."""
        guidance_lower = ROLLING_STRATEGY_GUIDANCE.lower()
        assert "rolling" in guidance_lower

    def test_guidance_mentions_instances(self) -> None:
        """Test that guidance mentions instance replacement."""
        guidance_lower = ROLLING_STRATEGY_GUIDANCE.lower()
        assert (
            "instance" in guidance_lower
            or "replica" in guidance_lower
            or "pod" in guidance_lower
        )


class TestBlueGreenStrategyGuidance:
    """Tests for blue-green strategy guidance."""

    def test_guidance_exists(self) -> None:
        """Test that blue-green strategy guidance is defined."""
        assert BLUE_GREEN_STRATEGY_GUIDANCE is not None
        assert len(BLUE_GREEN_STRATEGY_GUIDANCE) > 50

    def test_guidance_mentions_blue_green(self) -> None:
        """Test that guidance mentions blue-green."""
        guidance_lower = BLUE_GREEN_STRATEGY_GUIDANCE.lower()
        assert "blue" in guidance_lower and "green" in guidance_lower

    def test_guidance_mentions_traffic(self) -> None:
        """Test that guidance mentions traffic switching."""
        guidance_lower = BLUE_GREEN_STRATEGY_GUIDANCE.lower()
        assert "traffic" in guidance_lower or "switch" in guidance_lower


class TestCanaryStrategyGuidance:
    """Tests for canary strategy guidance."""

    def test_guidance_exists(self) -> None:
        """Test that canary strategy guidance is defined."""
        assert CANARY_STRATEGY_GUIDANCE is not None
        assert len(CANARY_STRATEGY_GUIDANCE) > 50

    def test_guidance_mentions_canary(self) -> None:
        """Test that guidance mentions canary."""
        guidance_lower = CANARY_STRATEGY_GUIDANCE.lower()
        assert "canary" in guidance_lower

    def test_guidance_mentions_percentage(self) -> None:
        """Test that guidance mentions gradual traffic shift."""
        guidance_lower = CANARY_STRATEGY_GUIDANCE.lower()
        assert (
            "percent" in guidance_lower
            or "gradual" in guidance_lower
            or "traffic" in guidance_lower
        )


class TestFormatDeploymentPlanPrompt:
    """Tests for format_deployment_plan_prompt function."""

    def test_formats_with_release_and_environment(self) -> None:
        """Test that function formats prompt with release and environment."""
        result = format_deployment_plan_prompt(
            release_version="1.0.0",
            target_environment="production",
            strategy="rolling",
        )

        assert "1.0.0" in result
        assert "production" in result

    def test_includes_rolling_strategy_guidance(self) -> None:
        """Test that function includes rolling strategy guidance."""
        result = format_deployment_plan_prompt(
            release_version="1.0.0",
            target_environment="staging",
            strategy="rolling",
        )

        result_lower = result.lower()
        assert "rolling" in result_lower

    def test_includes_blue_green_strategy_guidance(self) -> None:
        """Test that function includes blue-green strategy guidance."""
        result = format_deployment_plan_prompt(
            release_version="1.0.0",
            target_environment="production",
            strategy="blue-green",
        )

        result_lower = result.lower()
        assert "blue" in result_lower and "green" in result_lower

    def test_includes_canary_strategy_guidance(self) -> None:
        """Test that function includes canary strategy guidance."""
        result = format_deployment_plan_prompt(
            release_version="1.0.0",
            target_environment="production",
            strategy="canary",
            canary_percentage=10,
        )

        result_lower = result.lower()
        assert "canary" in result_lower

    def test_includes_optional_artifacts(self) -> None:
        """Test that function includes optional artifact information."""
        result = format_deployment_plan_prompt(
            release_version="1.0.0",
            target_environment="staging",
            strategy="rolling",
            artifacts=[
                {"name": "api", "location": "registry/api:1.0.0"}
            ],
        )

        assert "api" in result or "registry" in result

    def test_includes_optional_current_state(self) -> None:
        """Test that function includes optional current deployment state."""
        result = format_deployment_plan_prompt(
            release_version="2.0.0",
            target_environment="production",
            strategy="rolling",
            current_version="1.9.0",
        )

        assert "1.9.0" in result

    def test_includes_optional_health_check_config(self) -> None:
        """Test that function includes optional health check configuration."""
        result = format_deployment_plan_prompt(
            release_version="1.0.0",
            target_environment="staging",
            strategy="rolling",
            health_check_interval=30,
        )

        assert "30" in result or "health" in result.lower()

    def test_output_has_structured_format(self) -> None:
        """Test that output includes structured output format."""
        result = format_deployment_plan_prompt(
            release_version="1.0.0",
            target_environment="staging",
            strategy="rolling",
        )

        assert "json" in result.lower() or "structured" in result.lower()

    def test_output_mentions_rollback(self) -> None:
        """Test that output mentions rollback triggers."""
        result = format_deployment_plan_prompt(
            release_version="1.0.0",
            target_environment="staging",
            strategy="rolling",
        )

        assert "rollback" in result.lower()
