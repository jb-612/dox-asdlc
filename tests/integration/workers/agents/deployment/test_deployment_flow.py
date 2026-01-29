"""Integration tests for Release -> Deployment -> Monitor flow.

Tests that Release agent output flows correctly to Deployment agent,
which then flows to Monitor agent, producing the expected deployment
artifacts and configurations.
"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock

import pytest

from src.workers.agents.deployment.config import DeploymentConfig, DeploymentStrategy
from src.workers.agents.deployment.deployment_agent import DeploymentAgent
from src.workers.agents.deployment.models import (
    DeploymentPlan,
    MonitoringConfig,
    ReleaseManifest,
)
from src.workers.agents.deployment.monitor_agent import MonitorAgent
from src.workers.agents.deployment.release_agent import ReleaseAgent
from src.workers.agents.protocols import AgentContext
from src.workers.agents.validation.models import SecurityReport, ValidationReport


class TestReleaseDeploymentMonitorFlow:
    """Integration tests for Release -> Deployment -> Monitor flow."""

    @pytest.mark.asyncio
    async def test_release_passes_to_deployment(
        self,
        release_agent: ReleaseAgent,
        deployment_agent: DeploymentAgent,
        agent_context: AgentContext,
        sample_validation_report: ValidationReport,
        sample_security_report: SecurityReport,
    ) -> None:
        """Test that release manifest flows correctly to deployment agent."""
        # Step 1: Run Release Agent
        release_result = await release_agent.execute(
            context=agent_context,
            event_metadata={
                "validation_report": sample_validation_report.to_dict(),
                "security_report": sample_security_report.to_dict(),
            },
        )

        assert release_result.success is True
        assert "release_manifest" in release_result.metadata
        assert release_result.metadata.get("next_agent") == "deployment_agent"

        # Step 2: Run Deployment Agent with release manifest
        release_manifest = release_result.metadata["release_manifest"]

        deployment_result = await deployment_agent.execute(
            context=agent_context,
            event_metadata={
                "release_manifest": release_manifest,
                "target_environment": "staging",
            },
        )

        assert deployment_result.success is True
        assert "deployment_plan" in deployment_result.metadata
        assert deployment_result.metadata.get("hitl_gate") == "HITL-6"

    @pytest.mark.asyncio
    async def test_deployment_passes_to_monitor(
        self,
        deployment_agent: DeploymentAgent,
        monitor_agent: MonitorAgent,
        agent_context: AgentContext,
        sample_release_manifest: ReleaseManifest,
    ) -> None:
        """Test that deployment plan flows correctly to monitor agent."""
        # Step 1: Run Deployment Agent
        deployment_result = await deployment_agent.execute(
            context=agent_context,
            event_metadata={
                "release_manifest": sample_release_manifest.to_dict(),
                "target_environment": "staging",
            },
        )

        assert deployment_result.success is True
        assert "deployment_plan" in deployment_result.metadata

        # Step 2: Run Monitor Agent with deployment plan
        deployment_plan = deployment_result.metadata["deployment_plan"]

        monitor_result = await monitor_agent.execute(
            context=agent_context,
            event_metadata={
                "deployment_plan": deployment_plan,
            },
        )

        assert monitor_result.success is True
        assert "monitoring_config" in monitor_result.metadata

    @pytest.mark.asyncio
    async def test_full_flow_release_to_monitor(
        self,
        release_agent: ReleaseAgent,
        deployment_agent: DeploymentAgent,
        monitor_agent: MonitorAgent,
        agent_context: AgentContext,
        sample_validation_report: ValidationReport,
        sample_security_report: SecurityReport,
    ) -> None:
        """Test the complete Release -> Deployment -> Monitor flow."""
        # Step 1: Release
        release_result = await release_agent.execute(
            context=agent_context,
            event_metadata={
                "validation_report": sample_validation_report.to_dict(),
                "security_report": sample_security_report.to_dict(),
                "commits": [
                    {"sha": "abc123", "message": "feat: add validation"},
                    {"sha": "def456", "message": "fix: security issue"},
                ],
            },
        )

        assert release_result.success is True
        release_manifest = release_result.metadata["release_manifest"]

        # Step 2: Deployment
        deployment_result = await deployment_agent.execute(
            context=agent_context,
            event_metadata={
                "release_manifest": release_manifest,
                "target_environment": "staging",
            },
        )

        assert deployment_result.success is True
        deployment_plan = deployment_result.metadata["deployment_plan"]

        # Step 3: Monitor
        monitor_result = await monitor_agent.execute(
            context=agent_context,
            event_metadata={
                "deployment_plan": deployment_plan,
            },
        )

        assert monitor_result.success is True

        # Verify final monitoring config is complete
        monitoring_config = monitor_result.metadata["monitoring_config"]
        assert "metrics" in monitoring_config
        assert "alerts" in monitoring_config
        assert "dashboards" in monitoring_config

    @pytest.mark.asyncio
    async def test_artifacts_are_written_for_all_agents(
        self,
        release_agent: ReleaseAgent,
        deployment_agent: DeploymentAgent,
        monitor_agent: MonitorAgent,
        agent_context: AgentContext,
        sample_validation_report: ValidationReport,
        sample_security_report: SecurityReport,
        workspace_path: Path,
    ) -> None:
        """Test that all agents write artifacts to workspace."""
        # Run release
        release_result = await release_agent.execute(
            context=agent_context,
            event_metadata={
                "validation_report": sample_validation_report.to_dict(),
                "security_report": sample_security_report.to_dict(),
            },
        )

        assert release_result.success is True
        assert len(release_result.artifact_paths) > 0

        for path in release_result.artifact_paths:
            assert Path(path).exists(), f"Release artifact not found: {path}"

        # Run deployment
        deployment_result = await deployment_agent.execute(
            context=agent_context,
            event_metadata={
                "release_manifest": release_result.metadata["release_manifest"],
                "target_environment": "staging",
            },
        )

        assert deployment_result.success is True
        assert len(deployment_result.artifact_paths) > 0

        for path in deployment_result.artifact_paths:
            assert Path(path).exists(), f"Deployment artifact not found: {path}"

        # Run monitor
        monitor_result = await monitor_agent.execute(
            context=agent_context,
            event_metadata={
                "deployment_plan": deployment_result.metadata["deployment_plan"],
            },
        )

        assert monitor_result.success is True
        assert len(monitor_result.artifact_paths) > 0

        for path in monitor_result.artifact_paths:
            assert Path(path).exists(), f"Monitor artifact not found: {path}"


class TestDeploymentStrategies:
    """Tests for different deployment strategies in the flow."""

    @pytest.mark.asyncio
    async def test_rolling_deployment_strategy(
        self,
        deployment_agent: DeploymentAgent,
        agent_context: AgentContext,
        sample_release_manifest: ReleaseManifest,
    ) -> None:
        """Test deployment plan generation with rolling strategy."""
        result = await deployment_agent.execute(
            context=agent_context,
            event_metadata={
                "release_manifest": sample_release_manifest.to_dict(),
                "target_environment": "staging",
                "deployment_strategy": "rolling",
            },
        )

        assert result.success is True
        plan = result.metadata["deployment_plan"]
        assert plan["strategy"] == "rolling"

    @pytest.mark.asyncio
    async def test_canary_deployment_strategy(
        self,
        mock_llm_client_for_deployment: MagicMock,
        artifact_writer,
        agent_context: AgentContext,
        sample_release_manifest: ReleaseManifest,
    ) -> None:
        """Test deployment plan generation with canary strategy."""
        from src.workers.agents.deployment.deployment_agent import DeploymentAgent
        from src.workers.llm.client import LLMResponse
        import json
        from unittest.mock import AsyncMock

        # Override LLM response for canary
        mock_llm_client_for_deployment.generate = AsyncMock(
            return_value=LLMResponse(
                content=json.dumps({
                    "release_version": "1.2.0",
                    "target_environment": "staging",
                    "strategy": "canary",
                    "steps": [
                        {"order": 1, "name": "Deploy Canary", "step_type": "deploy",
                         "command": "helm upgrade --set canary.enabled=true", "timeout_seconds": 300, "rollback_command": "helm rollback"},
                        {"order": 2, "name": "Monitor Canary", "step_type": "verify",
                         "command": "kubectl get pods", "timeout_seconds": 60, "rollback_command": None},
                    ],
                    "rollback_triggers": ["Canary error rate > 5%"],
                    "health_checks": [
                        {"name": "Canary Health", "check_type": "http", "target": "/health",
                         "interval_seconds": 10, "timeout_seconds": 5, "success_threshold": 1, "failure_threshold": 3}
                    ],
                }),
                model="test-model",
            )
        )

        config = DeploymentConfig(
            deployment_strategy=DeploymentStrategy.CANARY,
            canary_percentage=10,
        )

        agent = DeploymentAgent(
            llm_client=mock_llm_client_for_deployment,
            artifact_writer=artifact_writer,
            config=config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "release_manifest": sample_release_manifest.to_dict(),
                "target_environment": "staging",
                "deployment_strategy": "canary",
            },
        )

        assert result.success is True
        plan = result.metadata["deployment_plan"]
        assert plan["strategy"] == "canary"


class TestDeploymentFlowEdgeCases:
    """Edge case tests for deployment flow."""

    @pytest.mark.asyncio
    async def test_missing_validation_report_fails_release(
        self,
        release_agent: ReleaseAgent,
        agent_context: AgentContext,
        sample_security_report: SecurityReport,
    ) -> None:
        """Test that missing validation report fails release."""
        result = await release_agent.execute(
            context=agent_context,
            event_metadata={
                # Missing validation_report
                "security_report": sample_security_report.to_dict(),
            },
        )

        assert result.success is False
        assert "validation_report" in result.error_message.lower()

    @pytest.mark.asyncio
    async def test_missing_security_report_fails_release(
        self,
        release_agent: ReleaseAgent,
        agent_context: AgentContext,
        sample_validation_report: ValidationReport,
    ) -> None:
        """Test that missing security report fails release."""
        result = await release_agent.execute(
            context=agent_context,
            event_metadata={
                "validation_report": sample_validation_report.to_dict(),
                # Missing security_report
            },
        )

        assert result.success is False
        assert "security_report" in result.error_message.lower()

    @pytest.mark.asyncio
    async def test_missing_release_manifest_fails_deployment(
        self,
        deployment_agent: DeploymentAgent,
        agent_context: AgentContext,
    ) -> None:
        """Test that missing release manifest fails deployment."""
        result = await deployment_agent.execute(
            context=agent_context,
            event_metadata={
                # Missing release_manifest
                "target_environment": "staging",
            },
        )

        assert result.success is False
        assert "release_manifest" in result.error_message.lower()

    @pytest.mark.asyncio
    async def test_missing_deployment_plan_fails_monitor(
        self,
        monitor_agent: MonitorAgent,
        agent_context: AgentContext,
    ) -> None:
        """Test that missing deployment plan fails monitor."""
        result = await monitor_agent.execute(
            context=agent_context,
            event_metadata={
                # Missing deployment_plan
            },
        )

        assert result.success is False
        assert "deployment_plan" in result.error_message.lower()


class TestDeploymentReportSerialization:
    """Tests for report serialization in the deployment flow."""

    @pytest.mark.asyncio
    async def test_release_manifest_can_be_deserialized(
        self,
        release_agent: ReleaseAgent,
        agent_context: AgentContext,
        sample_validation_report: ValidationReport,
        sample_security_report: SecurityReport,
    ) -> None:
        """Test that release manifest can be round-tripped."""
        result = await release_agent.execute(
            context=agent_context,
            event_metadata={
                "validation_report": sample_validation_report.to_dict(),
                "security_report": sample_security_report.to_dict(),
                "version": "2.0.0",
            },
        )

        assert result.success is True

        manifest = ReleaseManifest.from_dict(result.metadata["release_manifest"])
        assert manifest.version is not None
        assert isinstance(manifest.features, list)
        assert isinstance(manifest.artifacts, list)

    @pytest.mark.asyncio
    async def test_deployment_plan_can_be_deserialized(
        self,
        deployment_agent: DeploymentAgent,
        agent_context: AgentContext,
        sample_release_manifest: ReleaseManifest,
    ) -> None:
        """Test that deployment plan can be round-tripped."""
        result = await deployment_agent.execute(
            context=agent_context,
            event_metadata={
                "release_manifest": sample_release_manifest.to_dict(),
                "target_environment": "production",
            },
        )

        assert result.success is True

        plan = DeploymentPlan.from_dict(result.metadata["deployment_plan"])
        assert plan.release_version is not None
        assert plan.target_environment == "staging"  # LLM mock returns staging
        assert isinstance(plan.steps, list)
        assert isinstance(plan.health_checks, list)

    @pytest.mark.asyncio
    async def test_monitoring_config_can_be_deserialized(
        self,
        monitor_agent: MonitorAgent,
        agent_context: AgentContext,
        sample_deployment_plan: DeploymentPlan,
    ) -> None:
        """Test that monitoring config can be round-tripped."""
        result = await monitor_agent.execute(
            context=agent_context,
            event_metadata={
                "deployment_plan": sample_deployment_plan.to_dict(),
            },
        )

        assert result.success is True

        config = MonitoringConfig.from_dict(result.metadata["monitoring_config"])
        assert config.deployment_id is not None
        assert isinstance(config.metrics, list)
        assert isinstance(config.alerts, list)
        assert isinstance(config.dashboards, list)


class TestDeploymentFlowWithMocks:
    """Tests using mock agents for coordinator-level integration."""

    @pytest.mark.asyncio
    async def test_mock_release_agent_returns_expected_format(
        self,
        mock_release_agent_for_coordinator: MagicMock,
        agent_context: AgentContext,
        sample_validation_report: ValidationReport,
        sample_security_report: SecurityReport,
    ) -> None:
        """Test that mock release agent returns expected format."""
        result = await mock_release_agent_for_coordinator.execute(
            context=agent_context,
            event_metadata={
                "validation_report": sample_validation_report.to_dict(),
                "security_report": sample_security_report.to_dict(),
            },
        )

        assert result.success is True
        assert "release_manifest" in result.metadata
        assert result.metadata.get("next_agent") == "deployment_agent"

    @pytest.mark.asyncio
    async def test_mock_deployment_agent_returns_expected_format(
        self,
        mock_deployment_agent_for_coordinator: MagicMock,
        agent_context: AgentContext,
        sample_release_manifest: ReleaseManifest,
    ) -> None:
        """Test that mock deployment agent returns expected format."""
        result = await mock_deployment_agent_for_coordinator.execute(
            context=agent_context,
            event_metadata={
                "release_manifest": sample_release_manifest.to_dict(),
            },
        )

        assert result.success is True
        assert "deployment_plan" in result.metadata
        assert result.metadata.get("hitl_gate") == "HITL-6"

    @pytest.mark.asyncio
    async def test_mock_monitor_agent_returns_expected_format(
        self,
        mock_monitor_agent_for_coordinator: MagicMock,
        agent_context: AgentContext,
        sample_deployment_plan: DeploymentPlan,
    ) -> None:
        """Test that mock monitor agent returns expected format."""
        result = await mock_monitor_agent_for_coordinator.execute(
            context=agent_context,
            event_metadata={
                "deployment_plan": sample_deployment_plan.to_dict(),
            },
        )

        assert result.success is True
        assert "monitoring_config" in result.metadata
