"""Tests for MonitorAgent.

Tests the monitoring configuration agent that defines metrics to collect,
configures alerts, generates dashboard configurations, and outputs
MonitoringConfig artifacts.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
import pytest

from src.workers.agents.protocols import AgentContext, AgentResult
from src.workers.agents.deployment.config import DeploymentConfig, DeploymentStrategy
from src.workers.agents.deployment.models import (
    AlertRule,
    AlertSeverity,
    DashboardConfig,
    DeploymentPlan,
    DeploymentStep,
    HealthCheck,
    HealthCheckType,
    MetricDefinition,
    MetricType,
    MonitoringConfig,
    StepType,
)

# Import the module under test (will be created)
from src.workers.agents.deployment.monitor_agent import (
    MonitorAgent,
    MonitorAgentError,
)


@pytest.fixture
def mock_llm_client():
    """Create a mock LLM client."""
    client = AsyncMock()
    client.generate = AsyncMock()
    return client


@pytest.fixture
def mock_artifact_writer():
    """Create a mock artifact writer."""
    writer = AsyncMock()
    writer.write_artifact = AsyncMock(return_value="/artifacts/monitoring_config.json")
    return writer


@pytest.fixture
def deployment_config():
    """Create a deployment configuration."""
    return DeploymentConfig()


@pytest.fixture
def agent_context():
    """Create an agent context for testing."""
    return AgentContext(
        session_id="session-123",
        task_id="task-456",
        tenant_id="tenant-789",
        workspace_path="/workspace",
        context_pack={
            "files": [
                {"path": "src/feature.py", "content": "# feature code"},
            ],
        },
    )


@pytest.fixture
def deployment_plan():
    """Create a sample deployment plan."""
    return DeploymentPlan(
        release_version="1.0.0",
        target_environment="staging",
        strategy=DeploymentStrategy.ROLLING,
        steps=[
            DeploymentStep(
                order=1,
                name="Deploy Helm chart",
                step_type=StepType.DEPLOY,
                command="helm upgrade --install dox-asdlc ./charts/dox-asdlc",
                timeout_seconds=600,
                rollback_command="helm rollback dox-asdlc",
            ),
            DeploymentStep(
                order=2,
                name="Verify deployment",
                step_type=StepType.VERIFY,
                command="kubectl rollout status deployment/orchestrator",
                timeout_seconds=300,
                rollback_command=None,
            ),
        ],
        rollback_triggers=[
            "Error rate > 5%",
            "P99 latency > 500ms",
        ],
        health_checks=[
            HealthCheck(
                name="orchestrator-health",
                check_type=HealthCheckType.HTTP,
                target="/health",
                interval_seconds=30,
                timeout_seconds=5,
                success_threshold=1,
                failure_threshold=3,
            ),
        ],
    )


class TestMonitorAgentInit:
    """Tests for MonitorAgent initialization."""

    def test_creates_with_required_args(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
    ):
        """Test that agent can be created with required arguments."""
        agent = MonitorAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        assert agent is not None
        assert agent.agent_type == "monitor_agent"

    def test_agent_type_is_monitor_agent(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
    ):
        """Test that agent_type property returns correct value."""
        agent = MonitorAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        assert agent.agent_type == "monitor_agent"


class TestMonitorAgentExecute:
    """Tests for MonitorAgent.execute method."""

    @pytest.mark.asyncio
    async def test_returns_failure_when_no_deployment_plan(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
        agent_context,
    ):
        """Test that execute returns failure when no deployment plan provided."""
        agent = MonitorAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={},  # No deployment_plan
        )

        assert result.success is False
        assert "deployment" in result.error_message.lower()
        assert result.should_retry is False

    @pytest.mark.asyncio
    async def test_generates_monitoring_config_successfully(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        deployment_plan,
    ):
        """Test that agent generates a monitoring config successfully."""
        # Mock LLM response for monitoring config generation
        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "deployment_id": "task-456",
                "metrics": [
                    {
                        "name": "http_requests_total",
                        "metric_type": "counter",
                        "description": "Total HTTP requests",
                        "labels": ["method", "path", "status"]
                    },
                    {
                        "name": "http_request_duration_seconds",
                        "metric_type": "histogram",
                        "description": "HTTP request duration in seconds",
                        "labels": ["method", "path"]
                    },
                    {
                        "name": "process_cpu_seconds_total",
                        "metric_type": "counter",
                        "description": "Total user and system CPU time",
                        "labels": ["service"]
                    },
                    {
                        "name": "process_resident_memory_bytes",
                        "metric_type": "gauge",
                        "description": "Resident memory size in bytes",
                        "labels": ["service"]
                    }
                ],
                "alerts": [
                    {
                        "name": "HighErrorRate",
                        "condition": "rate(http_requests_total{status=~'5..'}[5m]) / rate(http_requests_total[5m]) > 0.05",
                        "severity": "critical",
                        "description": "Error rate exceeds 5%",
                        "runbook_url": "https://runbooks.example.com/high-error-rate"
                    },
                    {
                        "name": "HighLatency",
                        "condition": "histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])) > 0.5",
                        "severity": "warning",
                        "description": "P99 latency exceeds 500ms",
                        "runbook_url": null
                    }
                ],
                "dashboards": [
                    {
                        "name": "service-overview",
                        "title": "Service Overview",
                        "panels": ["requests_per_second", "error_rate", "latency_p99", "cpu_usage", "memory_usage"],
                        "refresh_interval_seconds": 30
                    }
                ]
            }"""
        )

        agent = MonitorAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "deployment_plan": deployment_plan.to_dict(),
            },
        )

        assert result.success is True
        assert result.agent_type == "monitor_agent"
        assert "monitoring_config" in result.metadata

    @pytest.mark.asyncio
    async def test_returns_monitoring_config_in_metadata(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        deployment_plan,
    ):
        """Test that monitoring config is returned in metadata."""
        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "deployment_id": "task-456",
                "metrics": [],
                "alerts": [],
                "dashboards": []
            }"""
        )

        agent = MonitorAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "deployment_plan": deployment_plan.to_dict(),
            },
        )

        assert result.success is True
        assert "monitoring_config" in result.metadata
        config = result.metadata["monitoring_config"]
        assert "deployment_id" in config


class TestMetricDefinitions:
    """Tests for metric definition generation."""

    @pytest.mark.asyncio
    async def test_defines_cpu_metric(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        deployment_plan,
    ):
        """Test that CPU metric is defined."""
        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "deployment_id": "task-456",
                "metrics": [
                    {
                        "name": "process_cpu_seconds_total",
                        "metric_type": "counter",
                        "description": "Total user and system CPU time spent in seconds",
                        "labels": ["service"]
                    }
                ],
                "alerts": [],
                "dashboards": []
            }"""
        )

        agent = MonitorAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "deployment_plan": deployment_plan.to_dict(),
            },
        )

        assert result.success is True
        config = result.metadata["monitoring_config"]
        metric_names = [m["name"] for m in config["metrics"]]
        assert any("cpu" in name.lower() for name in metric_names)

    @pytest.mark.asyncio
    async def test_defines_memory_metric(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        deployment_plan,
    ):
        """Test that memory metric is defined."""
        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "deployment_id": "task-456",
                "metrics": [
                    {
                        "name": "process_resident_memory_bytes",
                        "metric_type": "gauge",
                        "description": "Resident memory size in bytes",
                        "labels": ["service"]
                    }
                ],
                "alerts": [],
                "dashboards": []
            }"""
        )

        agent = MonitorAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "deployment_plan": deployment_plan.to_dict(),
            },
        )

        assert result.success is True
        config = result.metadata["monitoring_config"]
        metric_names = [m["name"] for m in config["metrics"]]
        assert any("memory" in name.lower() for name in metric_names)

    @pytest.mark.asyncio
    async def test_defines_request_rate_metric(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        deployment_plan,
    ):
        """Test that request rate metric is defined."""
        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "deployment_id": "task-456",
                "metrics": [
                    {
                        "name": "http_requests_total",
                        "metric_type": "counter",
                        "description": "Total number of HTTP requests",
                        "labels": ["method", "path", "status"]
                    }
                ],
                "alerts": [],
                "dashboards": []
            }"""
        )

        agent = MonitorAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "deployment_plan": deployment_plan.to_dict(),
            },
        )

        assert result.success is True
        config = result.metadata["monitoring_config"]
        metric_names = [m["name"] for m in config["metrics"]]
        assert any("request" in name.lower() for name in metric_names)

    @pytest.mark.asyncio
    async def test_defines_latency_metric(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        deployment_plan,
    ):
        """Test that latency metric is defined."""
        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "deployment_id": "task-456",
                "metrics": [
                    {
                        "name": "http_request_duration_seconds",
                        "metric_type": "histogram",
                        "description": "HTTP request latency in seconds",
                        "labels": ["method", "path"]
                    }
                ],
                "alerts": [],
                "dashboards": []
            }"""
        )

        agent = MonitorAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "deployment_plan": deployment_plan.to_dict(),
            },
        )

        assert result.success is True
        config = result.metadata["monitoring_config"]
        metric_names = [m["name"] for m in config["metrics"]]
        assert any("duration" in name.lower() or "latency" in name.lower() for name in metric_names)

    @pytest.mark.asyncio
    async def test_defines_error_metric(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        deployment_plan,
    ):
        """Test that error metrics are defined."""
        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "deployment_id": "task-456",
                "metrics": [
                    {
                        "name": "http_requests_total",
                        "metric_type": "counter",
                        "description": "Total HTTP requests with status label for error tracking",
                        "labels": ["method", "path", "status"]
                    }
                ],
                "alerts": [],
                "dashboards": []
            }"""
        )

        agent = MonitorAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "deployment_plan": deployment_plan.to_dict(),
            },
        )

        assert result.success is True
        config = result.metadata["monitoring_config"]
        # Error tracking is done via status label on requests
        metrics = config["metrics"]
        assert any("status" in m.get("labels", []) for m in metrics)


class TestAlertRules:
    """Tests for alert rule configuration."""

    @pytest.mark.asyncio
    async def test_defines_error_rate_alert(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        deployment_plan,
    ):
        """Test that error rate alert is defined."""
        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "deployment_id": "task-456",
                "metrics": [],
                "alerts": [
                    {
                        "name": "HighErrorRate",
                        "condition": "rate(http_requests_total{status=~'5..'}[5m]) / rate(http_requests_total[5m]) > 0.05",
                        "severity": "critical",
                        "description": "Error rate exceeds 5%",
                        "runbook_url": "https://runbooks.example.com/high-error-rate"
                    }
                ],
                "dashboards": []
            }"""
        )

        agent = MonitorAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "deployment_plan": deployment_plan.to_dict(),
            },
        )

        assert result.success is True
        config = result.metadata["monitoring_config"]
        alert_names = [a["name"].lower() for a in config["alerts"]]
        assert any("error" in name for name in alert_names)

    @pytest.mark.asyncio
    async def test_defines_latency_threshold_alert(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        deployment_plan,
    ):
        """Test that latency threshold alert is defined."""
        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "deployment_id": "task-456",
                "metrics": [],
                "alerts": [
                    {
                        "name": "HighLatency",
                        "condition": "histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])) > 0.5",
                        "severity": "warning",
                        "description": "P99 latency exceeds 500ms",
                        "runbook_url": null
                    }
                ],
                "dashboards": []
            }"""
        )

        agent = MonitorAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "deployment_plan": deployment_plan.to_dict(),
            },
        )

        assert result.success is True
        config = result.metadata["monitoring_config"]
        alert_names = [a["name"].lower() for a in config["alerts"]]
        assert any("latency" in name for name in alert_names)

    @pytest.mark.asyncio
    async def test_alert_has_severity(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        deployment_plan,
    ):
        """Test that alerts have severity levels."""
        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "deployment_id": "task-456",
                "metrics": [],
                "alerts": [
                    {
                        "name": "HighErrorRate",
                        "condition": "error_rate > 0.05",
                        "severity": "critical",
                        "description": "Error rate exceeds 5%",
                        "runbook_url": null
                    }
                ],
                "dashboards": []
            }"""
        )

        agent = MonitorAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "deployment_plan": deployment_plan.to_dict(),
            },
        )

        assert result.success is True
        config = result.metadata["monitoring_config"]
        for alert in config["alerts"]:
            assert "severity" in alert
            assert alert["severity"] in ["critical", "warning", "info"]

    @pytest.mark.asyncio
    async def test_alert_has_condition(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        deployment_plan,
    ):
        """Test that alerts have PromQL conditions."""
        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "deployment_id": "task-456",
                "metrics": [],
                "alerts": [
                    {
                        "name": "HighErrorRate",
                        "condition": "rate(http_requests_total{status=~'5..'}[5m]) > 0.05",
                        "severity": "critical",
                        "description": "Error rate exceeds 5%",
                        "runbook_url": null
                    }
                ],
                "dashboards": []
            }"""
        )

        agent = MonitorAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "deployment_plan": deployment_plan.to_dict(),
            },
        )

        assert result.success is True
        config = result.metadata["monitoring_config"]
        for alert in config["alerts"]:
            assert "condition" in alert
            assert len(alert["condition"]) > 0


class TestDashboardConfiguration:
    """Tests for dashboard configuration generation."""

    @pytest.mark.asyncio
    async def test_generates_dashboard_config(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        deployment_plan,
    ):
        """Test that dashboard configuration is generated."""
        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "deployment_id": "task-456",
                "metrics": [],
                "alerts": [],
                "dashboards": [
                    {
                        "name": "service-overview",
                        "title": "Service Overview Dashboard",
                        "panels": ["requests", "errors", "latency"],
                        "refresh_interval_seconds": 30
                    }
                ]
            }"""
        )

        agent = MonitorAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "deployment_plan": deployment_plan.to_dict(),
            },
        )

        assert result.success is True
        config = result.metadata["monitoring_config"]
        assert len(config["dashboards"]) > 0

    @pytest.mark.asyncio
    async def test_dashboard_has_panels(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        deployment_plan,
    ):
        """Test that dashboard configuration includes panels."""
        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "deployment_id": "task-456",
                "metrics": [],
                "alerts": [],
                "dashboards": [
                    {
                        "name": "service-overview",
                        "title": "Service Overview",
                        "panels": ["cpu_usage", "memory_usage", "request_rate", "error_rate", "latency_p99"],
                        "refresh_interval_seconds": 30
                    }
                ]
            }"""
        )

        agent = MonitorAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "deployment_plan": deployment_plan.to_dict(),
            },
        )

        assert result.success is True
        config = result.metadata["monitoring_config"]
        dashboard = config["dashboards"][0]
        assert "panels" in dashboard
        assert len(dashboard["panels"]) > 0

    @pytest.mark.asyncio
    async def test_dashboard_has_refresh_interval(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        deployment_plan,
    ):
        """Test that dashboard has refresh interval configured."""
        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "deployment_id": "task-456",
                "metrics": [],
                "alerts": [],
                "dashboards": [
                    {
                        "name": "service-overview",
                        "title": "Service Overview",
                        "panels": ["requests"],
                        "refresh_interval_seconds": 30
                    }
                ]
            }"""
        )

        agent = MonitorAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "deployment_plan": deployment_plan.to_dict(),
            },
        )

        assert result.success is True
        config = result.metadata["monitoring_config"]
        dashboard = config["dashboards"][0]
        assert "refresh_interval_seconds" in dashboard
        assert dashboard["refresh_interval_seconds"] > 0


class TestDeploymentPlanIntegration:
    """Tests for integration with deployment plan."""

    @pytest.mark.asyncio
    async def test_uses_deployment_id_from_context(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        deployment_plan,
    ):
        """Test that deployment ID is derived from context task_id."""
        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "deployment_id": "task-456",
                "metrics": [],
                "alerts": [],
                "dashboards": []
            }"""
        )

        agent = MonitorAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "deployment_plan": deployment_plan.to_dict(),
            },
        )

        assert result.success is True
        config = result.metadata["monitoring_config"]
        assert config["deployment_id"] == "task-456"

    @pytest.mark.asyncio
    async def test_incorporates_health_checks_from_deployment_plan(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        deployment_plan,
    ):
        """Test that health checks from deployment plan inform monitoring."""
        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "deployment_id": "task-456",
                "metrics": [
                    {
                        "name": "health_check_success",
                        "metric_type": "gauge",
                        "description": "Health check success status",
                        "labels": ["check_name"]
                    }
                ],
                "alerts": [],
                "dashboards": []
            }"""
        )

        agent = MonitorAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "deployment_plan": deployment_plan.to_dict(),
            },
        )

        assert result.success is True
        # Verify prompt includes health check info
        call_args = mock_llm_client.generate.call_args
        prompt = call_args.kwargs.get("prompt", call_args.args[0] if call_args.args else "")
        assert "health" in prompt.lower()


class TestArtifactWriting:
    """Tests for artifact writing."""

    @pytest.mark.asyncio
    async def test_writes_json_artifact(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        deployment_plan,
    ):
        """Test that agent writes JSON artifact."""
        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "deployment_id": "task-456",
                "metrics": [],
                "alerts": [],
                "dashboards": []
            }"""
        )

        agent = MonitorAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "deployment_plan": deployment_plan.to_dict(),
            },
        )

        assert result.success is True
        assert mock_artifact_writer.write_artifact.called
        assert len(result.artifact_paths) > 0

    @pytest.mark.asyncio
    async def test_writes_markdown_artifact(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        deployment_plan,
    ):
        """Test that agent writes Markdown artifact."""
        call_count = [0]

        async def track_calls(*args, **kwargs):
            call_count[0] += 1
            filename = kwargs.get("filename", "")
            if ".md" in filename:
                return "/artifacts/monitoring_config.md"
            return "/artifacts/monitoring_config.json"

        mock_artifact_writer.write_artifact.side_effect = track_calls

        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "deployment_id": "task-456",
                "metrics": [],
                "alerts": [],
                "dashboards": []
            }"""
        )

        agent = MonitorAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "deployment_plan": deployment_plan.to_dict(),
            },
        )

        assert result.success is True
        # Should write at least JSON and Markdown
        assert call_count[0] >= 2


class TestErrorHandling:
    """Tests for error handling."""

    @pytest.mark.asyncio
    async def test_handles_llm_error_gracefully(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        deployment_plan,
    ):
        """Test that agent handles LLM errors gracefully."""
        mock_llm_client.generate.side_effect = Exception("LLM service unavailable")

        agent = MonitorAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "deployment_plan": deployment_plan.to_dict(),
            },
        )

        assert result.success is False
        assert "LLM service unavailable" in result.error_message
        assert result.should_retry is True

    @pytest.mark.asyncio
    async def test_handles_invalid_llm_response(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        deployment_plan,
    ):
        """Test that agent handles invalid LLM response."""
        mock_llm_client.generate.return_value = MagicMock(
            content="This is not valid JSON"
        )

        agent = MonitorAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "deployment_plan": deployment_plan.to_dict(),
            },
        )

        assert result.success is False
        assert result.should_retry is True

    @pytest.mark.asyncio
    async def test_handles_artifact_writer_error(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        deployment_plan,
    ):
        """Test that agent handles artifact writer errors."""
        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "deployment_id": "task-456",
                "metrics": [],
                "alerts": [],
                "dashboards": []
            }"""
        )
        mock_artifact_writer.write_artifact.side_effect = Exception("Write failed")

        agent = MonitorAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "deployment_plan": deployment_plan.to_dict(),
            },
        )

        assert result.success is False
        assert "Write failed" in result.error_message
        assert result.should_retry is True


class TestValidateContext:
    """Tests for context validation."""

    def test_validates_complete_context(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
        agent_context,
    ):
        """Test that complete context passes validation."""
        agent = MonitorAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        assert agent.validate_context(agent_context) is True

    def test_rejects_incomplete_context(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
    ):
        """Test that incomplete context fails validation."""
        agent = MonitorAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        incomplete_context = AgentContext(
            session_id="",
            task_id="",
            tenant_id="",
            workspace_path="",
        )

        assert agent.validate_context(incomplete_context) is False
