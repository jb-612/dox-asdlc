"""Unit tests for Monitor agent prompts.

Tests for monitoring configuration prompts including metrics, alerts,
and dashboard configuration.
"""

from __future__ import annotations

import pytest

from src.workers.agents.deployment.prompts.monitor_prompts import (
    MONITORING_CONFIG_PROMPT,
    ALERT_RULES_PROMPT,
    DASHBOARD_CONFIG_PROMPT,
    format_monitoring_config_prompt,
)


class TestMonitoringConfigPrompt:
    """Tests for monitoring configuration prompt."""

    def test_prompt_exists(self) -> None:
        """Test that monitoring config prompt is defined."""
        assert MONITORING_CONFIG_PROMPT is not None
        assert len(MONITORING_CONFIG_PROMPT) > 100

    def test_prompt_mentions_monitoring(self) -> None:
        """Test that prompt mentions monitoring."""
        prompt_lower = MONITORING_CONFIG_PROMPT.lower()
        assert "monitor" in prompt_lower

    def test_prompt_mentions_metrics(self) -> None:
        """Test that prompt mentions metrics."""
        prompt_lower = MONITORING_CONFIG_PROMPT.lower()
        assert "metric" in prompt_lower

    def test_prompt_mentions_metric_types(self) -> None:
        """Test that prompt mentions metric types."""
        prompt_lower = MONITORING_CONFIG_PROMPT.lower()
        # Should mention common metric types
        assert (
            "counter" in prompt_lower
            or "gauge" in prompt_lower
            or "histogram" in prompt_lower
        )

    def test_prompt_has_structured_output(self) -> None:
        """Test that prompt includes structured output format."""
        assert "json" in MONITORING_CONFIG_PROMPT.lower()


class TestAlertRulesPrompt:
    """Tests for alert rules prompt."""

    def test_prompt_exists(self) -> None:
        """Test that alert rules prompt is defined."""
        assert ALERT_RULES_PROMPT is not None
        assert len(ALERT_RULES_PROMPT) > 100

    def test_prompt_mentions_alert(self) -> None:
        """Test that prompt mentions alerts."""
        prompt_lower = ALERT_RULES_PROMPT.lower()
        assert "alert" in prompt_lower

    def test_prompt_mentions_severity(self) -> None:
        """Test that prompt mentions severity levels."""
        prompt_lower = ALERT_RULES_PROMPT.lower()
        assert (
            "severity" in prompt_lower
            or "critical" in prompt_lower
            or "warning" in prompt_lower
        )

    def test_prompt_mentions_conditions(self) -> None:
        """Test that prompt mentions alert conditions."""
        prompt_lower = ALERT_RULES_PROMPT.lower()
        assert (
            "condition" in prompt_lower
            or "threshold" in prompt_lower
            or "trigger" in prompt_lower
        )


class TestDashboardConfigPrompt:
    """Tests for dashboard configuration prompt."""

    def test_prompt_exists(self) -> None:
        """Test that dashboard config prompt is defined."""
        assert DASHBOARD_CONFIG_PROMPT is not None
        assert len(DASHBOARD_CONFIG_PROMPT) > 100

    def test_prompt_mentions_dashboard(self) -> None:
        """Test that prompt mentions dashboard."""
        prompt_lower = DASHBOARD_CONFIG_PROMPT.lower()
        assert "dashboard" in prompt_lower

    def test_prompt_mentions_visualization(self) -> None:
        """Test that prompt mentions visualization or panels."""
        prompt_lower = DASHBOARD_CONFIG_PROMPT.lower()
        assert (
            "visual" in prompt_lower
            or "panel" in prompt_lower
            or "chart" in prompt_lower
            or "graph" in prompt_lower
        )


class TestFormatMonitoringConfigPrompt:
    """Tests for format_monitoring_config_prompt function."""

    def test_formats_with_deployment_info(self) -> None:
        """Test that function formats prompt with deployment information."""
        result = format_monitoring_config_prompt(
            deployment_id="deploy-123",
            service_name="api-server",
        )

        assert "deploy-123" in result or "api-server" in result

    def test_includes_service_endpoints(self) -> None:
        """Test that function includes service endpoints."""
        result = format_monitoring_config_prompt(
            deployment_id="deploy-123",
            service_name="api",
            endpoints=["/health", "/api/v1/users"],
        )

        assert "/health" in result or "/api/v1" in result

    def test_includes_optional_slos(self) -> None:
        """Test that function includes optional SLO definitions."""
        result = format_monitoring_config_prompt(
            deployment_id="deploy-123",
            service_name="api",
            slos={
                "latency_p99": "200ms",
                "availability": "99.9%",
            },
        )

        assert "200ms" in result or "99.9" in result

    def test_includes_optional_resource_limits(self) -> None:
        """Test that function includes optional resource limits."""
        result = format_monitoring_config_prompt(
            deployment_id="deploy-123",
            service_name="api",
            resource_limits={
                "cpu": "1000m",
                "memory": "512Mi",
            },
        )

        assert "1000m" in result or "512Mi" in result

    def test_includes_optional_dependencies(self) -> None:
        """Test that function includes optional service dependencies."""
        result = format_monitoring_config_prompt(
            deployment_id="deploy-123",
            service_name="api",
            dependencies=["database", "cache", "message-queue"],
        )

        assert "database" in result or "cache" in result

    def test_output_has_structured_format(self) -> None:
        """Test that output includes structured output format."""
        result = format_monitoring_config_prompt(
            deployment_id="deploy-123",
            service_name="api",
        )

        assert "json" in result.lower() or "structured" in result.lower()

    def test_output_mentions_alerts(self) -> None:
        """Test that output mentions alert configuration."""
        result = format_monitoring_config_prompt(
            deployment_id="deploy-123",
            service_name="api",
        )

        assert "alert" in result.lower()

    def test_output_mentions_metrics(self) -> None:
        """Test that output mentions metrics configuration."""
        result = format_monitoring_config_prompt(
            deployment_id="deploy-123",
            service_name="api",
        )

        assert "metric" in result.lower()
