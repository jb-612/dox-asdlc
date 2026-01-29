"""Integration tests for ValidationDeploymentCoordinator workflow.

Tests the full coordinator workflow:
- Validation Phase: Validation -> Security -> HITL-5
- Deployment Phase: Release -> Deployment -> HITL-6 -> Monitor
- HITL interaction handling
- Rejection handling
"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.workers.agents.deployment.config import DeploymentConfig
from src.workers.agents.deployment.coordinator import (
    DeploymentResult,
    ValidationDeploymentCoordinator,
    ValidationResult,
)
from src.workers.agents.deployment.models import DeploymentPlan, ReleaseManifest
from src.workers.agents.protocols import AgentContext
from src.workers.agents.validation.config import ValidationConfig
from src.workers.agents.validation.models import SecurityReport, ValidationReport
from src.workers.artifacts.writer import ArtifactWriter


class TestValidationPhaseWorkflow:
    """Tests for the validation phase of the coordinator."""

    @pytest.mark.asyncio
    async def test_validation_phase_success_without_hitl(
        self,
        mock_llm_client_for_deployment: MagicMock,
        artifact_writer: ArtifactWriter,
        mock_test_runner: MagicMock,
        validation_config: ValidationConfig,
        deployment_config: DeploymentConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test successful validation phase without HITL submission."""
        from src.workers.llm.client import LLMResponse
        import json

        # Configure LLM responses for validation and security
        validation_response = json.dumps({
            "checks": [
                {"name": "E2E Coverage", "category": "functional", "passed": True,
                 "details": "All tests passed", "evidence": None}
            ],
            "recommendations": [],
        })

        security_response = json.dumps({
            "findings": [],
            "compliance_status": {"OWASP_TOP_10": True},
            "scan_coverage": 95.0,
        })

        mock_llm_client_for_deployment.generate = AsyncMock(
            side_effect=[
                LLMResponse(content=validation_response, model="test"),
                LLMResponse(content=security_response, model="test"),
            ]
        )

        coordinator = ValidationDeploymentCoordinator(
            llm_client=mock_llm_client_for_deployment,
            artifact_writer=artifact_writer,
            test_runner=mock_test_runner,
            validation_config=validation_config,
            deployment_config=deployment_config,
            hitl_dispatcher=None,  # No HITL
        )

        implementation = {
            "feature_id": "test-feature",
            "files": [{"path": "app.py", "content": "def main(): pass", "language": "python"}],
        }

        result = await coordinator.run_validation(
            context=agent_context,
            implementation=implementation,
            acceptance_criteria=["Feature works correctly"],
            skip_hitl=True,
        )

        assert result.success is True
        assert result.validation_report is not None
        assert result.security_report is not None
        assert result.pending_hitl5 is False

    @pytest.mark.asyncio
    async def test_validation_phase_with_hitl_submission(
        self,
        mock_llm_client_for_deployment: MagicMock,
        artifact_writer: ArtifactWriter,
        mock_test_runner: MagicMock,
        validation_config: ValidationConfig,
        deployment_config: DeploymentConfig,
        mock_hitl_dispatcher: MagicMock,
        agent_context: AgentContext,
    ) -> None:
        """Test validation phase with HITL-5 submission."""
        from src.workers.llm.client import LLMResponse
        import json

        validation_response = json.dumps({
            "checks": [
                {"name": "E2E Coverage", "category": "functional", "passed": True,
                 "details": "All tests passed", "evidence": None}
            ],
            "recommendations": [],
        })

        security_response = json.dumps({
            "findings": [],
            "compliance_status": {"OWASP_TOP_10": True},
            "scan_coverage": 95.0,
        })

        mock_llm_client_for_deployment.generate = AsyncMock(
            side_effect=[
                LLMResponse(content=validation_response, model="test"),
                LLMResponse(content=security_response, model="test"),
            ]
        )

        coordinator = ValidationDeploymentCoordinator(
            llm_client=mock_llm_client_for_deployment,
            artifact_writer=artifact_writer,
            test_runner=mock_test_runner,
            validation_config=validation_config,
            deployment_config=deployment_config,
            hitl_dispatcher=mock_hitl_dispatcher,
        )

        implementation = {
            "feature_id": "test-feature",
            "files": [{"path": "app.py", "content": "def main(): pass", "language": "python"}],
        }

        result = await coordinator.run_validation(
            context=agent_context,
            implementation=implementation,
            acceptance_criteria=["Feature works correctly"],
            skip_hitl=False,
        )

        assert result.success is True
        assert result.pending_hitl5 is True
        assert result.hitl5_request_id is not None
        mock_hitl_dispatcher.request_gate.assert_called_once()

    @pytest.mark.asyncio
    async def test_validation_phase_fails_on_validation_failure(
        self,
        mock_llm_client_for_deployment: MagicMock,
        artifact_writer: ArtifactWriter,
        mock_test_runner_failing: MagicMock,
        validation_config: ValidationConfig,
        deployment_config: DeploymentConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test that validation phase fails when validation agent fails."""
        from src.workers.llm.client import LLMResponse
        import json

        # Return validation that indicates failure
        validation_response = json.dumps({
            "checks": [
                {"name": "E2E Coverage", "category": "functional", "passed": False,
                 "details": "Tests failed", "evidence": None}
            ],
            "recommendations": ["Fix failing tests"],
        })

        mock_llm_client_for_deployment.generate = AsyncMock(
            return_value=LLMResponse(content=validation_response, model="test")
        )

        coordinator = ValidationDeploymentCoordinator(
            llm_client=mock_llm_client_for_deployment,
            artifact_writer=artifact_writer,
            test_runner=mock_test_runner_failing,  # E2E tests fail
            validation_config=validation_config,
            deployment_config=deployment_config,
        )

        implementation = {
            "feature_id": "test-feature",
            "files": [{"path": "app.py", "content": "def main(): pass", "language": "python"}],
        }

        result = await coordinator.run_validation(
            context=agent_context,
            implementation=implementation,
            acceptance_criteria=["Feature works"],
            skip_hitl=True,
        )

        assert result.success is False
        assert result.failed_at == "validation"


class TestDeploymentPhaseWorkflow:
    """Tests for the deployment phase of the coordinator."""

    @pytest.mark.asyncio
    async def test_deployment_phase_success_without_hitl(
        self,
        mock_llm_client_for_deployment: MagicMock,
        artifact_writer: ArtifactWriter,
        mock_test_runner: MagicMock,
        validation_config: ValidationConfig,
        deployment_config: DeploymentConfig,
        agent_context: AgentContext,
        sample_validation_report: ValidationReport,
        sample_security_report: SecurityReport,
    ) -> None:
        """Test successful deployment phase without HITL submission."""
        from src.workers.llm.client import LLMResponse
        import json

        release_response = json.dumps({
            "version": "1.0.0",
            "features": ["test-feature"],
            "changelog": "Initial release",
            "artifacts": [
                {"name": "app", "artifact_type": "docker_image",
                 "location": "gcr.io/app:1.0.0", "checksum": None}
            ],
            "rollback_plan": "helm rollback",
        })

        deployment_response = json.dumps({
            "release_version": "1.0.0",
            "target_environment": "staging",
            "strategy": "rolling",
            "steps": [
                {"order": 1, "name": "Deploy", "step_type": "deploy",
                 "command": "helm upgrade", "timeout_seconds": 300, "rollback_command": "helm rollback"}
            ],
            "rollback_triggers": ["error rate > 5%"],
            "health_checks": [
                {"name": "HTTP", "check_type": "http", "target": "/health",
                 "interval_seconds": 30, "timeout_seconds": 5, "success_threshold": 1, "failure_threshold": 3}
            ],
        })

        monitoring_response = json.dumps({
            "deployment_id": "test",
            "metrics": [
                {"name": "http_requests_total", "metric_type": "counter",
                 "description": "Total requests", "labels": ["method"]}
            ],
            "alerts": [
                {"name": "HighErrors", "condition": "rate(errors) > 0.05",
                 "severity": "critical", "description": "High error rate", "runbook_url": None}
            ],
            "dashboards": [
                {"name": "overview", "title": "Overview", "panels": ["requests"], "refresh_interval_seconds": 30}
            ],
        })

        mock_llm_client_for_deployment.generate = AsyncMock(
            side_effect=[
                LLMResponse(content=release_response, model="test"),
                LLMResponse(content=deployment_response, model="test"),
                LLMResponse(content=monitoring_response, model="test"),
            ]
        )

        coordinator = ValidationDeploymentCoordinator(
            llm_client=mock_llm_client_for_deployment,
            artifact_writer=artifact_writer,
            test_runner=mock_test_runner,
            validation_config=validation_config,
            deployment_config=deployment_config,
            hitl_dispatcher=None,
        )

        result = await coordinator.run_deployment(
            context=agent_context,
            hitl5_approval={"approved": True},
            validation_report=sample_validation_report,
            security_report=sample_security_report,
            target_environment="staging",
            skip_hitl=True,
        )

        assert result.success is True
        assert result.release_manifest is not None
        assert result.deployment_plan is not None
        assert result.monitoring_config is not None
        assert result.pending_hitl6 is False

    @pytest.mark.asyncio
    async def test_deployment_phase_with_hitl_submission(
        self,
        mock_llm_client_for_deployment: MagicMock,
        artifact_writer: ArtifactWriter,
        mock_test_runner: MagicMock,
        validation_config: ValidationConfig,
        deployment_config: DeploymentConfig,
        mock_hitl_dispatcher: MagicMock,
        agent_context: AgentContext,
        sample_validation_report: ValidationReport,
        sample_security_report: SecurityReport,
    ) -> None:
        """Test deployment phase with HITL-6 submission."""
        from src.workers.llm.client import LLMResponse
        import json

        release_response = json.dumps({
            "version": "1.0.0",
            "features": ["test-feature"],
            "changelog": "Initial release",
            "artifacts": [],
            "rollback_plan": "helm rollback",
        })

        deployment_response = json.dumps({
            "release_version": "1.0.0",
            "target_environment": "staging",
            "strategy": "rolling",
            "steps": [],
            "rollback_triggers": [],
            "health_checks": [],
        })

        mock_llm_client_for_deployment.generate = AsyncMock(
            side_effect=[
                LLMResponse(content=release_response, model="test"),
                LLMResponse(content=deployment_response, model="test"),
            ]
        )

        coordinator = ValidationDeploymentCoordinator(
            llm_client=mock_llm_client_for_deployment,
            artifact_writer=artifact_writer,
            test_runner=mock_test_runner,
            validation_config=validation_config,
            deployment_config=deployment_config,
            hitl_dispatcher=mock_hitl_dispatcher,
        )

        result = await coordinator.run_deployment(
            context=agent_context,
            hitl5_approval={"approved": True},
            validation_report=sample_validation_report,
            security_report=sample_security_report,
            target_environment="staging",
            skip_hitl=False,
        )

        assert result.success is True
        assert result.pending_hitl6 is True
        assert result.hitl6_request_id is not None


class TestCoordinatorHITLInteraction:
    """Tests for HITL interaction handling in the coordinator."""

    @pytest.mark.asyncio
    async def test_handle_rejection_returns_result(
        self,
        mock_llm_client_for_deployment: MagicMock,
        artifact_writer: ArtifactWriter,
        mock_test_runner: MagicMock,
        validation_config: ValidationConfig,
        deployment_config: DeploymentConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test that rejection handling returns appropriate result."""
        coordinator = ValidationDeploymentCoordinator(
            llm_client=mock_llm_client_for_deployment,
            artifact_writer=artifact_writer,
            test_runner=mock_test_runner,
            validation_config=validation_config,
            deployment_config=deployment_config,
        )

        result = await coordinator.handle_rejection(
            context=agent_context,
            gate_type="hitl-5",
            feedback="Security findings need to be addressed",
        )

        assert result.success is False
        assert "hitl-5" in result.rejection_reason.lower()
        assert "security" in result.feedback.lower()

    @pytest.mark.asyncio
    async def test_continue_from_hitl6_approval(
        self,
        mock_llm_client_for_deployment: MagicMock,
        artifact_writer: ArtifactWriter,
        mock_test_runner: MagicMock,
        validation_config: ValidationConfig,
        deployment_config: DeploymentConfig,
        agent_context: AgentContext,
        sample_release_manifest: ReleaseManifest,
        sample_deployment_plan: DeploymentPlan,
    ) -> None:
        """Test continuing workflow after HITL-6 approval."""
        from src.workers.llm.client import LLMResponse
        import json

        monitoring_response = json.dumps({
            "deployment_id": "test",
            "metrics": [
                {"name": "requests", "metric_type": "counter", "description": "Requests", "labels": []}
            ],
            "alerts": [],
            "dashboards": [],
        })

        mock_llm_client_for_deployment.generate = AsyncMock(
            return_value=LLMResponse(content=monitoring_response, model="test")
        )

        coordinator = ValidationDeploymentCoordinator(
            llm_client=mock_llm_client_for_deployment,
            artifact_writer=artifact_writer,
            test_runner=mock_test_runner,
            validation_config=validation_config,
            deployment_config=deployment_config,
        )

        result = await coordinator.continue_from_hitl6_approval(
            context=agent_context,
            hitl6_approval={"approved": True, "reviewer": "human"},
            release_manifest=sample_release_manifest,
            deployment_plan=sample_deployment_plan,
        )

        assert result.success is True
        assert result.release_manifest is not None
        assert result.deployment_plan is not None
        assert result.monitoring_config is not None


class TestCoordinatorAgentStatuses:
    """Tests for coordinator agent status reporting."""

    def test_get_agent_statuses(
        self,
        mock_llm_client_for_deployment: MagicMock,
        artifact_writer: ArtifactWriter,
        mock_test_runner: MagicMock,
        validation_config: ValidationConfig,
        deployment_config: DeploymentConfig,
    ) -> None:
        """Test that agent statuses are reported correctly."""
        coordinator = ValidationDeploymentCoordinator(
            llm_client=mock_llm_client_for_deployment,
            artifact_writer=artifact_writer,
            test_runner=mock_test_runner,
            validation_config=validation_config,
            deployment_config=deployment_config,
        )

        statuses = coordinator.get_agent_statuses()

        assert "validation_agent" in statuses
        assert "security_agent" in statuses
        assert "release_agent" in statuses
        assert "deployment_agent" in statuses
        assert "monitor_agent" in statuses

        for status in statuses.values():
            assert status == "ready"


class TestFullCoordinatorWorkflow:
    """End-to-end tests for the full coordinator workflow."""

    @pytest.mark.asyncio
    async def test_full_workflow_validation_to_deployment(
        self,
        mock_llm_client_for_deployment: MagicMock,
        artifact_writer: ArtifactWriter,
        mock_test_runner: MagicMock,
        validation_config: ValidationConfig,
        deployment_config: DeploymentConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test the complete workflow from validation to deployment."""
        from src.workers.llm.client import LLMResponse
        import json

        # Prepare all LLM responses
        validation_response = json.dumps({
            "checks": [
                {"name": "E2E", "category": "functional", "passed": True, "details": "OK", "evidence": None}
            ],
            "recommendations": [],
        })

        security_response = json.dumps({
            "findings": [],
            "compliance_status": {"OWASP_TOP_10": True},
            "scan_coverage": 95.0,
        })

        release_response = json.dumps({
            "version": "1.0.0",
            "features": ["feature"],
            "changelog": "Release",
            "artifacts": [],
            "rollback_plan": "rollback",
        })

        deployment_response = json.dumps({
            "release_version": "1.0.0",
            "target_environment": "staging",
            "strategy": "rolling",
            "steps": [],
            "rollback_triggers": [],
            "health_checks": [],
        })

        monitoring_response = json.dumps({
            "deployment_id": "test",
            "metrics": [],
            "alerts": [],
            "dashboards": [],
        })

        # Set up side effects for all calls
        mock_llm_client_for_deployment.generate = AsyncMock(
            side_effect=[
                LLMResponse(content=validation_response, model="test"),
                LLMResponse(content=security_response, model="test"),
                LLMResponse(content=release_response, model="test"),
                LLMResponse(content=deployment_response, model="test"),
                LLMResponse(content=monitoring_response, model="test"),
            ]
        )

        coordinator = ValidationDeploymentCoordinator(
            llm_client=mock_llm_client_for_deployment,
            artifact_writer=artifact_writer,
            test_runner=mock_test_runner,
            validation_config=validation_config,
            deployment_config=deployment_config,
        )

        # Phase 1: Validation
        implementation = {
            "feature_id": "test-feature",
            "files": [{"path": "app.py", "content": "def main(): pass", "language": "python"}],
        }

        validation_result = await coordinator.run_validation(
            context=agent_context,
            implementation=implementation,
            acceptance_criteria=["Works"],
            skip_hitl=True,
        )

        assert validation_result.success is True
        assert validation_result.validation_report is not None
        assert validation_result.security_report is not None

        # Phase 2: Deployment
        deployment_result = await coordinator.run_deployment(
            context=agent_context,
            hitl5_approval={"approved": True},
            validation_report=validation_result.validation_report,
            security_report=validation_result.security_report,
            target_environment="staging",
            skip_hitl=True,
        )

        assert deployment_result.success is True
        assert deployment_result.release_manifest is not None
        assert deployment_result.deployment_plan is not None
        assert deployment_result.monitoring_config is not None
