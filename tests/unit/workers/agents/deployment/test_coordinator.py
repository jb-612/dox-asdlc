"""Tests for ValidationDeploymentCoordinator.

Tests the workflow coordination for validation and deployment phases:
- Validation -> Security -> HITL-5
- Release -> Deployment -> HITL-6 -> Monitor
- HITL gate submission and rejection handling
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from src.workers.agents.protocols import AgentContext, AgentResult
from src.workers.agents.deployment.config import DeploymentConfig
from src.workers.agents.deployment.models import (
    ArtifactReference,
    ArtifactType,
    DeploymentPlan,
    DeploymentStep,
    HealthCheck,
    HealthCheckType,
    MonitoringConfig,
    ReleaseManifest,
    StepType,
)
from src.workers.agents.validation.config import ValidationConfig
from src.workers.agents.validation.models import (
    CheckCategory,
    SecurityCategory,
    SecurityFinding,
    SecurityReport,
    Severity,
    ValidationCheck,
    ValidationReport,
)
from src.workers.agents.development.models import TestResult, TestRunResult

# Import the module under test
from src.workers.agents.deployment.coordinator import (
    ValidationDeploymentCoordinator,
    ValidationDeploymentCoordinatorError,
    ValidationResult,
    DeploymentResult,
    EvidenceBundle,
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
    writer.write_artifact = AsyncMock(return_value="/artifacts/output.json")
    return writer


@pytest.fixture
def mock_test_runner():
    """Create a mock test runner."""
    runner = MagicMock()
    runner.run_tests = MagicMock(
        return_value=TestRunResult(
            suite_id="e2e-suite",
            results=[
                TestResult(
                    test_id="test_feature",
                    passed=True,
                    output="Test passed",
                    error=None,
                    duration_ms=100,
                ),
            ],
            passed=1,
            failed=0,
            coverage=85.0,
        )
    )
    return runner


@pytest.fixture
def mock_hitl_dispatcher():
    """Create a mock HITL dispatcher."""
    dispatcher = AsyncMock()
    dispatcher.request_gate = AsyncMock(return_value=MagicMock(request_id="hitl-req-123"))
    dispatcher.get_request_by_id = AsyncMock(return_value=None)
    return dispatcher


@pytest.fixture
def validation_config():
    """Create a validation configuration."""
    return ValidationConfig()


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
def implementation():
    """Create a sample implementation for testing."""
    return {
        "files": [
            {"path": "src/feature.py", "content": "def feature(): pass"},
            {"path": "src/utils.py", "content": "def helper(): pass"},
        ],
        "feature_id": "P04-F04",
    }


@pytest.fixture
def acceptance_criteria():
    """Create sample acceptance criteria."""
    return [
        "Feature must pass all E2E tests",
        "Feature must have no security vulnerabilities",
        "Feature must have >80% test coverage",
    ]


@pytest.fixture
def passing_validation_report():
    """Create a passing validation report."""
    return ValidationReport(
        feature_id="P04-F04",
        checks=[
            ValidationCheck(
                name="E2E Tests",
                category=CheckCategory.FUNCTIONAL,
                passed=True,
                details="All E2E tests passed",
                evidence="test_output.log",
            ),
        ],
        e2e_results=TestRunResult(
            suite_id="e2e-suite",
            results=[
                TestResult(
                    test_id="test_feature",
                    passed=True,
                    output="Test passed",
                    error=None,
                    duration_ms=100,
                ),
            ],
            passed=1,
            failed=0,
            coverage=85.0,
        ),
        passed=True,
        recommendations=[],
    )


@pytest.fixture
def failing_validation_report():
    """Create a failing validation report."""
    return ValidationReport(
        feature_id="P04-F04",
        checks=[
            ValidationCheck(
                name="E2E Tests",
                category=CheckCategory.FUNCTIONAL,
                passed=False,
                details="E2E test failed",
                evidence="test_output.log",
            ),
        ],
        e2e_results=TestRunResult(
            suite_id="e2e-suite",
            results=[
                TestResult(
                    test_id="test_feature",
                    passed=False,
                    output="",
                    error="Test failed: assertion error",
                    duration_ms=100,
                ),
            ],
            passed=0,
            failed=1,
            coverage=50.0,
        ),
        passed=False,
        recommendations=["Fix failing test"],
    )


@pytest.fixture
def passing_security_report():
    """Create a passing security report (no blocking findings)."""
    return SecurityReport(
        feature_id="P04-F04",
        findings=[
            SecurityFinding(
                id="SEC-001",
                severity=Severity.LOW,
                category=SecurityCategory.CONFIGURATION,
                location="config.py:10",
                description="Minor configuration issue",
                remediation="Consider using environment variable",
            ),
        ],
        passed=True,
        scan_coverage=95.0,
        compliance_status={"OWASP": True},
    )


@pytest.fixture
def failing_security_report():
    """Create a failing security report (has blocking findings)."""
    return SecurityReport(
        feature_id="P04-F04",
        findings=[
            SecurityFinding(
                id="SEC-001",
                severity=Severity.CRITICAL,
                category=SecurityCategory.SECRETS,
                location="config.py:10",
                description="Hardcoded API key detected",
                remediation="Use environment variable",
            ),
        ],
        passed=False,
        scan_coverage=95.0,
        compliance_status={"OWASP": False},
    )


@pytest.fixture
def release_manifest():
    """Create a sample release manifest."""
    return ReleaseManifest(
        version="1.0.0",
        features=["P04-F04"],
        changelog="## Version 1.0.0\n\n- Added feature",
        artifacts=[
            ArtifactReference(
                name="dox-asdlc",
                artifact_type=ArtifactType.DOCKER_IMAGE,
                location="registry.io/dox-asdlc:1.0.0",
                checksum="sha256:abc123",
            ),
        ],
        rollback_plan="kubectl rollout undo deployment/dox-asdlc",
    )


@pytest.fixture
def deployment_plan():
    """Create a sample deployment plan."""
    return DeploymentPlan(
        release_version="1.0.0",
        target_environment="staging",
        strategy=DeploymentConfig().deployment_strategy,
        steps=[
            DeploymentStep(
                order=1,
                name="Deploy",
                step_type=StepType.DEPLOY,
                command="kubectl apply -f deployment.yaml",
                timeout_seconds=300,
                rollback_command="kubectl rollout undo",
            ),
        ],
        rollback_triggers=["error_rate > 5%"],
        health_checks=[
            HealthCheck(
                name="HTTP Health",
                check_type=HealthCheckType.HTTP,
                target="/health",
                interval_seconds=30,
                timeout_seconds=5,
                success_threshold=1,
                failure_threshold=3,
            ),
        ],
    )


@pytest.fixture
def hitl5_approval():
    """Create a HITL-5 approval object."""
    return {
        "request_id": "hitl5-req-123",
        "approved": True,
        "reviewer": "human-reviewer",
        "reason": "All validation passed",
        "decided_at": datetime.now(timezone.utc).isoformat(),
    }


class TestValidationDeploymentCoordinatorInit:
    """Tests for ValidationDeploymentCoordinator initialization."""

    def test_creates_with_required_args(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
        deployment_config,
    ):
        """Test that coordinator can be created with required arguments."""
        coordinator = ValidationDeploymentCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            validation_config=validation_config,
            deployment_config=deployment_config,
        )

        assert coordinator is not None

    def test_creates_with_hitl_dispatcher(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_test_runner,
        mock_hitl_dispatcher,
        validation_config,
        deployment_config,
    ):
        """Test that coordinator can be created with HITL dispatcher."""
        coordinator = ValidationDeploymentCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            validation_config=validation_config,
            deployment_config=deployment_config,
            hitl_dispatcher=mock_hitl_dispatcher,
        )

        assert coordinator is not None
        assert coordinator.hitl_dispatcher is not None


class TestRunValidation:
    """Tests for ValidationDeploymentCoordinator.run_validation method."""

    @pytest.mark.asyncio
    async def test_runs_validation_agent_first(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
        deployment_config,
        agent_context,
        implementation,
        acceptance_criteria,
    ):
        """Test that validation agent runs first in the workflow."""
        # Mock LLM response for validation
        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "checks": [
                    {"name": "E2E Tests", "category": "functional", "passed": true, "details": "All passed", "evidence": null}
                ],
                "recommendations": []
            }"""
        )

        coordinator = ValidationDeploymentCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            validation_config=validation_config,
            deployment_config=deployment_config,
        )

        result = await coordinator.run_validation(
            context=agent_context,
            implementation=implementation,
            acceptance_criteria=acceptance_criteria,
        )

        # Validation should run (test runner called)
        assert mock_test_runner.run_tests.called

    @pytest.mark.asyncio
    async def test_runs_security_agent_after_validation(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
        deployment_config,
        agent_context,
        implementation,
        acceptance_criteria,
    ):
        """Test that security agent runs after validation passes."""
        # Mock LLM responses for validation and security
        mock_llm_client.generate.side_effect = [
            # Validation response
            MagicMock(
                content="""{
                    "checks": [{"name": "E2E Tests", "category": "functional", "passed": true, "details": "Passed", "evidence": null}],
                    "recommendations": []
                }"""
            ),
            # Security response
            MagicMock(
                content="""{
                    "findings": [],
                    "compliance_status": {"OWASP": true},
                    "scan_coverage": 95.0
                }"""
            ),
        ]

        coordinator = ValidationDeploymentCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            validation_config=validation_config,
            deployment_config=deployment_config,
        )

        result = await coordinator.run_validation(
            context=agent_context,
            implementation=implementation,
            acceptance_criteria=acceptance_criteria,
        )

        # Both agents should have been called
        assert mock_llm_client.generate.call_count >= 2

    @pytest.mark.asyncio
    async def test_returns_failed_when_validation_fails(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
        deployment_config,
        agent_context,
        implementation,
        acceptance_criteria,
    ):
        """Test that workflow stops and returns failed when validation fails."""
        # Mock failing validation
        mock_test_runner.run_tests.return_value = TestRunResult(
            suite_id="e2e-suite",
            results=[
                TestResult(
                    test_id="test_feature",
                    passed=False,
                    output="",
                    error="Test failed",
                    duration_ms=100,
                ),
            ],
            passed=0,
            failed=1,
            coverage=50.0,
        )

        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "checks": [{"name": "E2E Tests", "category": "functional", "passed": false, "details": "Failed", "evidence": null}],
                "recommendations": ["Fix failing tests"]
            }"""
        )

        coordinator = ValidationDeploymentCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            validation_config=validation_config,
            deployment_config=deployment_config,
        )

        result = await coordinator.run_validation(
            context=agent_context,
            implementation=implementation,
            acceptance_criteria=acceptance_criteria,
        )

        assert result.success is False
        assert result.failed_at == "validation"

    @pytest.mark.asyncio
    async def test_returns_failed_when_security_fails(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
        deployment_config,
        agent_context,
        implementation,
        acceptance_criteria,
    ):
        """Test that workflow stops and returns failed when security fails."""
        # Mock passing validation, failing security
        mock_llm_client.generate.side_effect = [
            MagicMock(
                content="""{
                    "checks": [{"name": "E2E Tests", "category": "functional", "passed": true, "details": "Passed", "evidence": null}],
                    "recommendations": []
                }"""
            ),
            MagicMock(
                content="""{
                    "findings": [
                        {"id": "SEC-001", "severity": "critical", "category": "secrets", "location": "line 10", "description": "Hardcoded secret", "remediation": "Use env var"}
                    ],
                    "compliance_status": {"OWASP": false},
                    "scan_coverage": 95.0
                }"""
            ),
        ]

        coordinator = ValidationDeploymentCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            validation_config=validation_config,
            deployment_config=deployment_config,
        )

        result = await coordinator.run_validation(
            context=agent_context,
            implementation=implementation,
            acceptance_criteria=acceptance_criteria,
        )

        assert result.success is False
        assert result.failed_at == "security"

    @pytest.mark.asyncio
    async def test_submits_to_hitl5_on_success(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_test_runner,
        mock_hitl_dispatcher,
        validation_config,
        deployment_config,
        agent_context,
        implementation,
        acceptance_criteria,
    ):
        """Test that HITL-5 is submitted when validation and security pass."""
        mock_llm_client.generate.side_effect = [
            MagicMock(
                content="""{
                    "checks": [{"name": "E2E Tests", "category": "functional", "passed": true, "details": "Passed", "evidence": null}],
                    "recommendations": []
                }"""
            ),
            MagicMock(
                content="""{
                    "findings": [],
                    "compliance_status": {"OWASP": true},
                    "scan_coverage": 95.0
                }"""
            ),
        ]

        coordinator = ValidationDeploymentCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            validation_config=validation_config,
            deployment_config=deployment_config,
            hitl_dispatcher=mock_hitl_dispatcher,
        )

        result = await coordinator.run_validation(
            context=agent_context,
            implementation=implementation,
            acceptance_criteria=acceptance_criteria,
        )

        # HITL-5 should be submitted
        assert mock_hitl_dispatcher.request_gate.called
        assert result.pending_hitl5 is True
        assert result.hitl5_request_id is not None

    @pytest.mark.asyncio
    async def test_returns_pending_approval_status(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_test_runner,
        mock_hitl_dispatcher,
        validation_config,
        deployment_config,
        agent_context,
        implementation,
        acceptance_criteria,
    ):
        """Test that result indicates pending approval when HITL-5 submitted."""
        mock_llm_client.generate.side_effect = [
            MagicMock(content='{"checks": [{"name": "test", "category": "functional", "passed": true, "details": "ok", "evidence": null}], "recommendations": []}'),
            MagicMock(content='{"findings": [], "compliance_status": {"OWASP": true}, "scan_coverage": 95.0}'),
        ]

        coordinator = ValidationDeploymentCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            validation_config=validation_config,
            deployment_config=deployment_config,
            hitl_dispatcher=mock_hitl_dispatcher,
        )

        result = await coordinator.run_validation(
            context=agent_context,
            implementation=implementation,
            acceptance_criteria=acceptance_criteria,
        )

        assert result.pending_hitl5 is True


class TestRunDeployment:
    """Tests for ValidationDeploymentCoordinator.run_deployment method."""

    @pytest.mark.asyncio
    async def test_runs_release_agent_first(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
        deployment_config,
        agent_context,
        hitl5_approval,
        passing_validation_report,
        passing_security_report,
    ):
        """Test that release agent runs first in deployment workflow."""
        mock_llm_client.generate.side_effect = [
            # Release response
            MagicMock(content='{"version": "1.0.0", "features": [], "changelog": "", "artifacts": [], "rollback_plan": ""}'),
            # Deployment response
            MagicMock(content='{"release_version": "1.0.0", "target_environment": "staging", "strategy": "rolling", "steps": [], "rollback_triggers": [], "health_checks": []}'),
            # Monitor response
            MagicMock(content='{"deployment_id": "test", "metrics": [], "alerts": [], "dashboards": []}'),
        ]

        coordinator = ValidationDeploymentCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            validation_config=validation_config,
            deployment_config=deployment_config,
        )

        result = await coordinator.run_deployment(
            context=agent_context,
            hitl5_approval=hitl5_approval,
            validation_report=passing_validation_report,
            security_report=passing_security_report,
            target_environment="staging",
        )

        # LLM should be called for release
        assert mock_llm_client.generate.called

    @pytest.mark.asyncio
    async def test_runs_deployment_agent_after_release(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
        deployment_config,
        agent_context,
        hitl5_approval,
        passing_validation_report,
        passing_security_report,
    ):
        """Test that deployment agent runs after release agent."""
        mock_llm_client.generate.side_effect = [
            MagicMock(content='{"version": "1.0.0", "features": [], "changelog": "", "artifacts": [], "rollback_plan": ""}'),
            MagicMock(content='{"release_version": "1.0.0", "target_environment": "staging", "strategy": "rolling", "steps": [], "rollback_triggers": [], "health_checks": []}'),
            MagicMock(content='{"deployment_id": "test", "metrics": [], "alerts": [], "dashboards": []}'),
        ]

        coordinator = ValidationDeploymentCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            validation_config=validation_config,
            deployment_config=deployment_config,
        )

        result = await coordinator.run_deployment(
            context=agent_context,
            hitl5_approval=hitl5_approval,
            validation_report=passing_validation_report,
            security_report=passing_security_report,
            target_environment="staging",
        )

        # Both release and deployment should be called
        assert mock_llm_client.generate.call_count >= 2

    @pytest.mark.asyncio
    async def test_submits_to_hitl6(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_test_runner,
        mock_hitl_dispatcher,
        validation_config,
        deployment_config,
        agent_context,
        hitl5_approval,
        passing_validation_report,
        passing_security_report,
    ):
        """Test that HITL-6 is submitted after deployment agent."""
        mock_llm_client.generate.side_effect = [
            MagicMock(content='{"version": "1.0.0", "features": [], "changelog": "", "artifacts": [], "rollback_plan": ""}'),
            MagicMock(content='{"release_version": "1.0.0", "target_environment": "staging", "strategy": "rolling", "steps": [], "rollback_triggers": [], "health_checks": []}'),
            MagicMock(content='{"deployment_id": "test", "metrics": [], "alerts": [], "dashboards": []}'),
        ]

        coordinator = ValidationDeploymentCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            validation_config=validation_config,
            deployment_config=deployment_config,
            hitl_dispatcher=mock_hitl_dispatcher,
        )

        result = await coordinator.run_deployment(
            context=agent_context,
            hitl5_approval=hitl5_approval,
            validation_report=passing_validation_report,
            security_report=passing_security_report,
            target_environment="staging",
        )

        # HITL-6 should be submitted
        assert mock_hitl_dispatcher.request_gate.called
        assert result.pending_hitl6 is True

    @pytest.mark.asyncio
    async def test_runs_monitor_after_hitl6_approval(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
        deployment_config,
        agent_context,
        hitl5_approval,
        passing_validation_report,
        passing_security_report,
        deployment_plan,
    ):
        """Test that monitor agent runs after HITL-6 approval."""
        mock_llm_client.generate.side_effect = [
            MagicMock(content='{"version": "1.0.0", "features": [], "changelog": "", "artifacts": [], "rollback_plan": ""}'),
            MagicMock(content='{"release_version": "1.0.0", "target_environment": "staging", "strategy": "rolling", "steps": [], "rollback_triggers": [], "health_checks": []}'),
            MagicMock(content='{"deployment_id": "test", "metrics": [{"name": "cpu", "metric_type": "gauge", "description": "CPU", "labels": []}], "alerts": [], "dashboards": []}'),
        ]

        coordinator = ValidationDeploymentCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            validation_config=validation_config,
            deployment_config=deployment_config,
        )

        # Run deployment with skip_hitl to go directly to monitor
        result = await coordinator.run_deployment(
            context=agent_context,
            hitl5_approval=hitl5_approval,
            validation_report=passing_validation_report,
            security_report=passing_security_report,
            target_environment="staging",
            skip_hitl=True,
        )

        # All three agents (release, deployment, monitor) should be called
        assert mock_llm_client.generate.call_count >= 3
        assert result.monitoring_config is not None


class TestContinueFromHITL6:
    """Tests for continuing workflow after HITL-6 approval."""

    @pytest.mark.asyncio
    async def test_runs_monitor_agent_after_hitl6_approval(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
        deployment_config,
        agent_context,
        release_manifest,
        deployment_plan,
    ):
        """Test that monitor agent runs after HITL-6 approval."""
        mock_llm_client.generate.return_value = MagicMock(
            content='{"deployment_id": "test", "metrics": [], "alerts": [], "dashboards": []}'
        )

        coordinator = ValidationDeploymentCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            validation_config=validation_config,
            deployment_config=deployment_config,
        )

        hitl6_approval = {
            "request_id": "hitl6-req-123",
            "approved": True,
            "reviewer": "human-reviewer",
            "reason": "Deployment approved",
        }

        result = await coordinator.continue_from_hitl6_approval(
            context=agent_context,
            hitl6_approval=hitl6_approval,
            release_manifest=release_manifest,
            deployment_plan=deployment_plan,
        )

        assert result.success is True
        assert result.monitoring_config is not None


class TestRejectionHandling:
    """Tests for HITL rejection handling."""

    @pytest.mark.asyncio
    async def test_handles_hitl5_rejection(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
        deployment_config,
        agent_context,
    ):
        """Test that HITL-5 rejection is handled correctly."""
        coordinator = ValidationDeploymentCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            validation_config=validation_config,
            deployment_config=deployment_config,
        )

        result = await coordinator.handle_rejection(
            context=agent_context,
            gate_type="hitl-5",
            feedback="Validation report incomplete",
        )

        assert result.success is False
        assert "hitl-5" in result.rejection_reason.lower()
        assert "Validation report incomplete" in result.feedback

    @pytest.mark.asyncio
    async def test_handles_hitl6_rejection(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
        deployment_config,
        agent_context,
    ):
        """Test that HITL-6 rejection is handled correctly."""
        coordinator = ValidationDeploymentCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            validation_config=validation_config,
            deployment_config=deployment_config,
        )

        result = await coordinator.handle_rejection(
            context=agent_context,
            gate_type="hitl-6",
            feedback="Deployment plan needs more rollback details",
        )

        assert result.success is False
        assert "hitl-6" in result.rejection_reason.lower()


class TestEvidenceBundle:
    """Tests for evidence bundle creation."""

    @pytest.mark.asyncio
    async def test_creates_hitl5_evidence_bundle(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_test_runner,
        mock_hitl_dispatcher,
        validation_config,
        deployment_config,
        agent_context,
        implementation,
        acceptance_criteria,
    ):
        """Test that HITL-5 evidence bundle is created correctly."""
        mock_llm_client.generate.side_effect = [
            MagicMock(content='{"checks": [{"name": "test", "category": "functional", "passed": true, "details": "ok", "evidence": null}], "recommendations": []}'),
            MagicMock(content='{"findings": [], "compliance_status": {"OWASP": true}, "scan_coverage": 95.0}'),
        ]

        coordinator = ValidationDeploymentCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            validation_config=validation_config,
            deployment_config=deployment_config,
            hitl_dispatcher=mock_hitl_dispatcher,
        )

        await coordinator.run_validation(
            context=agent_context,
            implementation=implementation,
            acceptance_criteria=acceptance_criteria,
        )

        # Verify request_gate was called with correct gate type
        call_args = mock_hitl_dispatcher.request_gate.call_args
        assert call_args is not None
        # Check that the gate_type parameter is HITL_5_VALIDATION
        kwargs = call_args.kwargs if call_args.kwargs else {}
        args = call_args.args if call_args.args else ()
        # The gate_type should be hitl_5_validation
        assert "hitl_5" in str(kwargs.get("gate_type", "")).lower() or "hitl_5" in str(args).lower()

    @pytest.mark.asyncio
    async def test_creates_hitl6_evidence_bundle(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_test_runner,
        mock_hitl_dispatcher,
        validation_config,
        deployment_config,
        agent_context,
        hitl5_approval,
        passing_validation_report,
        passing_security_report,
    ):
        """Test that HITL-6 evidence bundle is created correctly."""
        mock_llm_client.generate.side_effect = [
            MagicMock(content='{"version": "1.0.0", "features": [], "changelog": "", "artifacts": [], "rollback_plan": ""}'),
            MagicMock(content='{"release_version": "1.0.0", "target_environment": "staging", "strategy": "rolling", "steps": [], "rollback_triggers": [], "health_checks": []}'),
            MagicMock(content='{"deployment_id": "test", "metrics": [], "alerts": [], "dashboards": []}'),
        ]

        coordinator = ValidationDeploymentCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            validation_config=validation_config,
            deployment_config=deployment_config,
            hitl_dispatcher=mock_hitl_dispatcher,
        )

        await coordinator.run_deployment(
            context=agent_context,
            hitl5_approval=hitl5_approval,
            validation_report=passing_validation_report,
            security_report=passing_security_report,
            target_environment="staging",
        )

        # Verify request_gate was called
        assert mock_hitl_dispatcher.request_gate.called
        call_args = mock_hitl_dispatcher.request_gate.call_args
        kwargs = call_args.kwargs if call_args.kwargs else {}
        # The gate_type should be hitl_6_release
        assert "hitl_6" in str(kwargs.get("gate_type", "")).lower() or "release" in str(kwargs).lower()


class TestWorkflowCoordination:
    """Tests for complete workflow coordination."""

    @pytest.mark.asyncio
    async def test_full_validation_to_deployment_flow(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
        deployment_config,
        agent_context,
        implementation,
        acceptance_criteria,
    ):
        """Test complete flow from validation through deployment."""
        mock_llm_client.generate.side_effect = [
            # Validation
            MagicMock(content='{"checks": [{"name": "test", "category": "functional", "passed": true, "details": "ok", "evidence": null}], "recommendations": []}'),
            # Security
            MagicMock(content='{"findings": [], "compliance_status": {"OWASP": true}, "scan_coverage": 95.0}'),
            # Release
            MagicMock(content='{"version": "1.0.0", "features": [], "changelog": "", "artifacts": [], "rollback_plan": ""}'),
            # Deployment
            MagicMock(content='{"release_version": "1.0.0", "target_environment": "staging", "strategy": "rolling", "steps": [], "rollback_triggers": [], "health_checks": []}'),
            # Monitor
            MagicMock(content='{"deployment_id": "test", "metrics": [], "alerts": [], "dashboards": []}'),
        ]

        coordinator = ValidationDeploymentCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            validation_config=validation_config,
            deployment_config=deployment_config,
        )

        # Run validation (skip HITL for testing)
        val_result = await coordinator.run_validation(
            context=agent_context,
            implementation=implementation,
            acceptance_criteria=acceptance_criteria,
            skip_hitl=True,
        )

        assert val_result.success is True

        # Run deployment (skip HITL for testing)
        hitl5_approval = {"request_id": "test", "approved": True, "reviewer": "test", "reason": "ok"}
        deploy_result = await coordinator.run_deployment(
            context=agent_context,
            hitl5_approval=hitl5_approval,
            validation_report=val_result.validation_report,
            security_report=val_result.security_report,
            target_environment="staging",
            skip_hitl=True,
        )

        assert deploy_result.success is True
        assert deploy_result.monitoring_config is not None

    @pytest.mark.asyncio
    async def test_skips_hitl_when_no_dispatcher(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
        deployment_config,
        agent_context,
        implementation,
        acceptance_criteria,
    ):
        """Test that HITL is skipped when no dispatcher is configured."""
        mock_llm_client.generate.side_effect = [
            MagicMock(content='{"checks": [{"name": "test", "category": "functional", "passed": true, "details": "ok", "evidence": null}], "recommendations": []}'),
            MagicMock(content='{"findings": [], "compliance_status": {"OWASP": true}, "scan_coverage": 95.0}'),
        ]

        coordinator = ValidationDeploymentCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            validation_config=validation_config,
            deployment_config=deployment_config,
            # No hitl_dispatcher
        )

        result = await coordinator.run_validation(
            context=agent_context,
            implementation=implementation,
            acceptance_criteria=acceptance_criteria,
        )

        # Should complete without HITL submission
        assert result.success is True
        assert result.pending_hitl5 is False


class TestErrorHandling:
    """Tests for error handling."""

    @pytest.mark.asyncio
    async def test_handles_validation_agent_error(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
        deployment_config,
        agent_context,
        implementation,
        acceptance_criteria,
    ):
        """Test that validation agent errors are handled gracefully."""
        mock_test_runner.run_tests.side_effect = Exception("Test runner failed")

        coordinator = ValidationDeploymentCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            validation_config=validation_config,
            deployment_config=deployment_config,
        )

        result = await coordinator.run_validation(
            context=agent_context,
            implementation=implementation,
            acceptance_criteria=acceptance_criteria,
        )

        assert result.success is False
        assert result.error is not None

    @pytest.mark.asyncio
    async def test_handles_release_agent_error(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
        deployment_config,
        agent_context,
        hitl5_approval,
        passing_validation_report,
        passing_security_report,
    ):
        """Test that release agent errors are handled gracefully."""
        mock_llm_client.generate.side_effect = Exception("LLM service unavailable")

        coordinator = ValidationDeploymentCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            validation_config=validation_config,
            deployment_config=deployment_config,
        )

        result = await coordinator.run_deployment(
            context=agent_context,
            hitl5_approval=hitl5_approval,
            validation_report=passing_validation_report,
            security_report=passing_security_report,
            target_environment="staging",
        )

        assert result.success is False
        assert result.error is not None
