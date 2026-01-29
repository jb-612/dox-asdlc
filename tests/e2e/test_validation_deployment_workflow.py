"""End-to-end tests for the Validation & Deployment Workflow.

Tests the complete validation-deployment workflow from approved code (HITL-4)
through validation, security scanning, HITL-5, release, deployment planning,
HITL-6, and monitoring setup.

These tests require Docker containers to be running:
    docker compose -f docker/docker-compose.yml up -d

Test coverage:
- T16: E2E Validation for P04-F04 Validation & Deployment Agents
"""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
import redis.asyncio as redis

from src.core.events import ASDLCEvent, EventType
from src.orchestrator.evidence_bundle import EvidenceBundle, EvidenceItem, GateType
from src.orchestrator.hitl_dispatcher import (
    DecisionLogger,
    GateDecision,
    GateRequest,
    GateStatus,
    HITLDispatcher,
)
from src.workers.agents.deployment.config import DeploymentConfig, DeploymentStrategy
from src.workers.agents.deployment.coordinator import (
    DeploymentResult,
    RejectionResult,
    ValidationDeploymentCoordinator,
    ValidationResult,
)
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
from src.workers.agents.development.models import TestResult, TestRunResult
from src.workers.agents.protocols import AgentContext
from src.workers.agents.validation.config import ValidationConfig
from src.workers.agents.validation.models import (
    CheckCategory,
    SecurityReport,
    ValidationCheck,
    ValidationReport,
)
from src.workers.artifacts.writer import ArtifactWriter
from src.workers.llm.client import LLMResponse


# Test configuration
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))


def get_redis_url() -> str:
    """Get Redis URL for tests."""
    return f"redis://{REDIS_HOST}:{REDIS_PORT}/3"


# --- Fixtures ---


@pytest.fixture
def unique_session_id() -> str:
    """Generate unique session ID for test isolation."""
    return f"e2e-valdep-session-{uuid.uuid4().hex[:8]}"


@pytest.fixture
def unique_task_id() -> str:
    """Generate unique task ID for test isolation."""
    return f"e2e-valdep-task-{uuid.uuid4().hex[:8]}"


@pytest.fixture
def workspace_path(tmp_path: Path) -> Path:
    """Create isolated workspace for E2E tests."""
    workspace = tmp_path / "e2e_valdep_workspace"
    workspace.mkdir()
    return workspace


@pytest.fixture
def artifact_writer(workspace_path: Path) -> ArtifactWriter:
    """Create artifact writer for test workspace."""
    return ArtifactWriter(str(workspace_path))


@pytest.fixture
def validation_config() -> ValidationConfig:
    """Create test validation configuration."""
    return ValidationConfig(
        e2e_test_timeout=30,
        enable_rlm=False,
        security_scan_level="standard",
    )


@pytest.fixture
def deployment_config() -> DeploymentConfig:
    """Create test deployment configuration."""
    return DeploymentConfig(
        rollback_enabled=True,
        canary_percentage=10,
        health_check_interval=30,
        deployment_strategy=DeploymentStrategy.ROLLING,
    )


@pytest.fixture
def agent_context(
    workspace_path: Path,
    unique_session_id: str,
    unique_task_id: str,
) -> AgentContext:
    """Create agent context for E2E tests."""
    return AgentContext(
        session_id=unique_session_id,
        task_id=unique_task_id,
        tenant_id="default",
        workspace_path=str(workspace_path),
        metadata={"git_sha": "e2e-valdep-test-sha"},
    )


@pytest.fixture
def sample_implementation(unique_task_id: str) -> dict[str, Any]:
    """Create a sample implementation representing approved HITL-4 code."""
    return {
        "feature_id": unique_task_id,
        "files": [
            {
                "path": "src/calculator.py",
                "content": """\"\"\"Calculator module.\"\"\"

def add(a: int, b: int) -> int:
    \"\"\"Add two numbers.\"\"\"
    return a + b


def subtract(a: int, b: int) -> int:
    \"\"\"Subtract two numbers.\"\"\"
    return a - b


def multiply(a: int, b: int) -> int:
    \"\"\"Multiply two numbers.\"\"\"
    return a * b
""",
                "language": "python",
            },
            {
                "path": "src/api.py",
                "content": """\"\"\"API module.\"\"\"

from typing import Any
from calculator import add, subtract, multiply


def calculate(operation: str, a: int, b: int) -> int:
    \"\"\"Perform calculation.\"\"\"
    ops = {"add": add, "subtract": subtract, "multiply": multiply}
    return ops[operation](a, b)
""",
                "language": "python",
            },
        ],
        "imports": ["typing"],
        "dependencies": [],
    }


@pytest.fixture
def sample_acceptance_criteria() -> list[str]:
    """Create sample acceptance criteria."""
    return [
        "add(2, 3) should return 5",
        "subtract(5, 3) should return 2",
        "multiply(4, 3) should return 12",
        "API should correctly route operations",
    ]


@pytest.fixture
def passing_e2e_result(unique_task_id: str) -> TestRunResult:
    """Create passing E2E test results."""
    return TestRunResult(
        suite_id=f"{unique_task_id}-e2e",
        results=[
            TestResult(
                test_id="test_add_integration",
                passed=True,
                output=".",
                error=None,
                duration_ms=100,
            ),
            TestResult(
                test_id="test_subtract_integration",
                passed=True,
                output=".",
                error=None,
                duration_ms=95,
            ),
            TestResult(
                test_id="test_multiply_integration",
                passed=True,
                output=".",
                error=None,
                duration_ms=90,
            ),
            TestResult(
                test_id="test_api_routing",
                passed=True,
                output=".",
                error=None,
                duration_ms=150,
            ),
        ],
        passed=4,
        failed=0,
        coverage=92.0,
    )


@pytest.fixture
def sample_validation_report(
    unique_task_id: str,
    passing_e2e_result: TestRunResult,
) -> ValidationReport:
    """Create a sample validation report."""
    return ValidationReport(
        feature_id=unique_task_id,
        checks=[
            ValidationCheck(
                name="E2E Test Coverage",
                category=CheckCategory.FUNCTIONAL,
                passed=True,
                details="All E2E tests passed with 92% coverage",
                evidence="e2e_test_results.json",
            ),
            ValidationCheck(
                name="Integration Verification",
                category=CheckCategory.FUNCTIONAL,
                passed=True,
                details="All integration points verified",
                evidence="integration_report.json",
            ),
            ValidationCheck(
                name="Performance Baseline",
                category=CheckCategory.PERFORMANCE,
                passed=True,
                details="All endpoints respond within SLA",
                evidence=None,
            ),
        ],
        e2e_results=passing_e2e_result,
        passed=True,
        recommendations=["Consider adding load tests for production readiness"],
    )


@pytest.fixture
def sample_security_report(unique_task_id: str) -> SecurityReport:
    """Create a sample passing security report."""
    return SecurityReport(
        feature_id=unique_task_id,
        findings=[],
        passed=True,
        scan_coverage=95.0,
        compliance_status={"OWASP_TOP_10": True, "CWE_TOP_25": True},
    )


@pytest.fixture
def sample_release_manifest(unique_task_id: str) -> ReleaseManifest:
    """Create a sample release manifest."""
    return ReleaseManifest(
        version="1.0.0",
        features=[unique_task_id],
        changelog="## 1.0.0\n\n- Initial release of calculator service\n- API endpoints for add, subtract, multiply",
        artifacts=[
            ArtifactReference(
                name="calculator-service",
                artifact_type=ArtifactType.DOCKER_IMAGE,
                location="gcr.io/asdlc/calculator:1.0.0",
                checksum="sha256:abc123def456",
            ),
            ArtifactReference(
                name="calculator-chart",
                artifact_type=ArtifactType.HELM_CHART,
                location="helm/calculator:1.0.0",
                checksum="sha256:def789ghi012",
            ),
        ],
        rollback_plan="1. Run `helm rollback calculator`\n2. Verify service health\n3. Notify stakeholders",
    )


@pytest.fixture
def sample_deployment_plan(unique_task_id: str) -> DeploymentPlan:
    """Create a sample deployment plan."""
    return DeploymentPlan(
        release_version="1.0.0",
        target_environment="staging",
        strategy=DeploymentStrategy.ROLLING,
        steps=[
            DeploymentStep(
                order=1,
                name="Prepare namespace",
                step_type=StepType.PREPARE,
                command="kubectl create namespace staging || true",
                timeout_seconds=60,
                rollback_command=None,
            ),
            DeploymentStep(
                order=2,
                name="Deploy application",
                step_type=StepType.DEPLOY,
                command="helm upgrade --install calculator ./helm/calculator --set image.tag=1.0.0",
                timeout_seconds=300,
                rollback_command="helm rollback calculator",
            ),
            DeploymentStep(
                order=3,
                name="Verify deployment",
                step_type=StepType.VERIFY,
                command="kubectl rollout status deployment/calculator",
                timeout_seconds=180,
                rollback_command=None,
            ),
        ],
        rollback_triggers=[
            "Error rate > 5%",
            "P99 latency > 500ms",
            "Health check failures > 3",
        ],
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
            HealthCheck(
                name="TCP Ready",
                check_type=HealthCheckType.TCP,
                target=":8080",
                interval_seconds=10,
                timeout_seconds=3,
                success_threshold=1,
                failure_threshold=3,
            ),
        ],
    )


@pytest.fixture
def mock_test_runner(passing_e2e_result: TestRunResult) -> MagicMock:
    """Create a mock test runner that returns passing results."""
    runner = MagicMock()
    runner.run_tests = MagicMock(return_value=passing_e2e_result)
    runner.timeout_seconds = 300
    return runner


@pytest.fixture
def mock_event_publisher() -> AsyncMock:
    """Create mock event publisher that captures events."""
    events: list[ASDLCEvent] = []

    async def capture_event(event: ASDLCEvent) -> str:
        events.append(event)
        return event.event_id

    publisher = AsyncMock(side_effect=capture_event)
    publisher.events = events
    return publisher


@pytest.fixture
async def redis_client():
    """Create Redis client for E2E tests.

    Skip tests if Redis is not available.
    """
    try:
        client = redis.Redis.from_url(get_redis_url(), decode_responses=True)
        await client.ping()
        yield client
        await client.aclose()
    except (redis.ConnectionError, OSError):
        pytest.skip("Redis not available for E2E tests")


@pytest.fixture
async def hitl_dispatcher(redis_client, mock_event_publisher) -> HITLDispatcher:
    """Create HITL dispatcher with real Redis backend."""
    decision_logger = DecisionLogger(redis_client)
    return HITLDispatcher(
        redis_client=redis_client,
        event_publisher=mock_event_publisher,
        decision_logger=decision_logger,
    )


def create_mock_llm_responses() -> dict[str, str]:
    """Create comprehensive LLM mock responses for full workflow."""
    # Validation analysis response
    validation_response = json.dumps({
        "checks": [
            {
                "name": "E2E Test Coverage",
                "category": "functional",
                "passed": True,
                "details": "All acceptance criteria covered with 92% code coverage",
                "evidence": "test_results.json",
            },
            {
                "name": "Integration Verification",
                "category": "functional",
                "passed": True,
                "details": "All integration points verified",
                "evidence": None,
            },
        ],
        "recommendations": ["Consider adding performance benchmarks"],
    })

    # Security analysis response
    security_response = json.dumps({
        "findings": [],
        "compliance_status": {"OWASP_TOP_10": True, "CWE_TOP_25": True},
        "scan_coverage": 95.0,
    })

    # Release manifest response
    release_response = json.dumps({
        "version": "1.0.0",
        "features": ["calculator-feature"],
        "changelog": "## 1.0.0\n\n- Initial release\n- Calculator operations",
        "artifacts": [
            {
                "name": "calculator",
                "artifact_type": "docker_image",
                "location": "gcr.io/app:1.0.0",
                "checksum": "sha256:abc123",
            },
        ],
        "rollback_plan": "1. Run helm rollback\n2. Verify health",
    })

    # Deployment plan response
    deployment_response = json.dumps({
        "release_version": "1.0.0",
        "target_environment": "staging",
        "strategy": "rolling",
        "steps": [
            {
                "order": 1,
                "name": "Deploy",
                "step_type": "deploy",
                "command": "helm upgrade --install app ./chart",
                "timeout_seconds": 300,
                "rollback_command": "helm rollback app",
            },
        ],
        "rollback_triggers": ["Error rate > 5%"],
        "health_checks": [
            {
                "name": "HTTP",
                "check_type": "http",
                "target": "/health",
                "interval_seconds": 30,
                "timeout_seconds": 5,
                "success_threshold": 1,
                "failure_threshold": 3,
            },
        ],
    })

    # Monitoring config response
    monitoring_response = json.dumps({
        "deployment_id": "test",
        "metrics": [
            {
                "name": "http_requests_total",
                "metric_type": "counter",
                "description": "Total HTTP requests",
                "labels": ["method", "status"],
            },
        ],
        "alerts": [
            {
                "name": "HighErrorRate",
                "condition": "rate(errors) > 0.05",
                "severity": "critical",
                "description": "Error rate exceeds 5%",
                "runbook_url": None,
            },
        ],
        "dashboards": [
            {
                "name": "overview",
                "title": "Service Overview",
                "panels": ["requests", "errors"],
                "refresh_interval_seconds": 30,
            },
        ],
    })

    return {
        "validation": validation_response,
        "security": security_response,
        "release": release_response,
        "deployment": deployment_response,
        "monitoring": monitoring_response,
    }


def create_mock_llm_client_for_full_workflow() -> MagicMock:
    """Create mock LLM client for the full validation-deployment workflow."""
    client = MagicMock()
    responses = create_mock_llm_responses()

    client.generate = AsyncMock(
        side_effect=[
            LLMResponse(content=responses["validation"], model="test"),
            LLMResponse(content=responses["security"], model="test"),
            LLMResponse(content=responses["release"], model="test"),
            LLMResponse(content=responses["deployment"], model="test"),
            LLMResponse(content=responses["monitoring"], model="test"),
        ]
    )
    client.model_name = "test-model"
    return client


def create_mock_hitl_dispatcher(
    unique_task_id: str,
    unique_session_id: str,
    gate_type: GateType = GateType.HITL_5_VALIDATION,
    status: GateStatus = GateStatus.PENDING,
) -> MagicMock:
    """Create a mock HITL dispatcher."""
    dispatcher = MagicMock()

    mock_gate_request = GateRequest(
        request_id=f"e2e-{gate_type.value}-{uuid.uuid4().hex[:8]}",
        task_id=unique_task_id,
        session_id=unique_session_id,
        gate_type=gate_type,
        status=status,
        evidence_bundle=MagicMock(),
        requested_by="validation_deployment_coordinator",
        requested_at=datetime.now(timezone.utc),
    )

    def request_gate_side_effect(**kwargs):
        req_gate_type = kwargs.get("gate_type", GateType.HITL_5_VALIDATION)
        return GateRequest(
            request_id=f"e2e-{req_gate_type.value}-{uuid.uuid4().hex[:8]}",
            task_id=kwargs.get("task_id", unique_task_id),
            session_id=kwargs.get("session_id", unique_session_id),
            gate_type=req_gate_type,
            status=GateStatus.PENDING,
            evidence_bundle=kwargs.get("evidence_bundle", MagicMock()),
            requested_by=kwargs.get("requested_by", "coordinator"),
            requested_at=datetime.now(timezone.utc),
        )

    dispatcher.request_gate = AsyncMock(side_effect=request_gate_side_effect)
    dispatcher.get_request_by_id = AsyncMock(return_value=mock_gate_request)

    return dispatcher


# --- E2E Test Classes ---


class TestFullValidationDeploymentWorkflowE2E:
    """End-to-end tests for the complete validation-deployment workflow.

    These tests validate:
    - T16: E2E Validation for P04-F04
    - Full workflow from HITL-4 approved code to monitoring setup
    - All artifacts are created and validated
    """

    @pytest.mark.asyncio
    async def test_full_validation_deployment_workflow(
        self,
        artifact_writer: ArtifactWriter,
        mock_test_runner: MagicMock,
        validation_config: ValidationConfig,
        deployment_config: DeploymentConfig,
        agent_context: AgentContext,
        sample_implementation: dict[str, Any],
        sample_acceptance_criteria: list[str],
        unique_task_id: str,
        unique_session_id: str,
    ) -> None:
        """Test complete flow from HITL-4 approved code to monitoring.

        This test validates:
        1. Validation agent runs E2E tests on approved code
        2. Security agent scans for vulnerabilities
        3. HITL-5 gate submission (mocked)
        4. Release agent generates manifest
        5. Deployment agent creates deployment plan
        6. HITL-6 gate submission (mocked)
        7. Monitor agent sets up monitoring
        8. All artifacts are correctly produced
        """
        # Arrange
        mock_llm_client = create_mock_llm_client_for_full_workflow()
        mock_hitl = create_mock_hitl_dispatcher(unique_task_id, unique_session_id)

        coordinator = ValidationDeploymentCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=artifact_writer,
            test_runner=mock_test_runner,
            validation_config=validation_config,
            deployment_config=deployment_config,
            hitl_dispatcher=mock_hitl,
        )

        # Act - Phase 1: Validation
        validation_result = await coordinator.run_validation(
            context=agent_context,
            implementation=sample_implementation,
            acceptance_criteria=sample_acceptance_criteria,
            skip_hitl=False,
        )

        # Assert - Validation phase succeeded and HITL-5 submitted
        assert validation_result.success is True
        assert validation_result.validation_report is not None
        assert validation_result.security_report is not None
        assert validation_result.pending_hitl5 is True
        assert validation_result.hitl5_request_id is not None

        # Act - Phase 2: Deployment (after HITL-5 approval)
        deployment_result = await coordinator.run_deployment(
            context=agent_context,
            hitl5_approval={"approved": True, "reviewer": "e2e-test"},
            validation_report=validation_result.validation_report,
            security_report=validation_result.security_report,
            target_environment="staging",
            skip_hitl=False,
        )

        # Assert - Deployment phase succeeded and HITL-6 submitted
        assert deployment_result.success is True
        assert deployment_result.release_manifest is not None
        assert deployment_result.deployment_plan is not None
        assert deployment_result.pending_hitl6 is True
        assert deployment_result.hitl6_request_id is not None

        # Act - Phase 3: Continue after HITL-6 approval
        final_result = await coordinator.continue_from_hitl6_approval(
            context=agent_context,
            hitl6_approval={"approved": True, "reviewer": "e2e-test"},
            release_manifest=deployment_result.release_manifest,
            deployment_plan=deployment_result.deployment_plan,
        )

        # Assert - Final result with monitoring
        assert final_result.success is True
        assert final_result.release_manifest is not None
        assert final_result.deployment_plan is not None
        assert final_result.monitoring_config is not None

    @pytest.mark.asyncio
    async def test_all_artifacts_verified(
        self,
        artifact_writer: ArtifactWriter,
        mock_test_runner: MagicMock,
        validation_config: ValidationConfig,
        deployment_config: DeploymentConfig,
        agent_context: AgentContext,
        sample_implementation: dict[str, Any],
        sample_acceptance_criteria: list[str],
    ) -> None:
        """Test that all artifacts from the workflow are properly structured.

        Verifies artifact content and structure for evidence bundles.
        """
        # Arrange
        mock_llm_client = create_mock_llm_client_for_full_workflow()

        coordinator = ValidationDeploymentCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=artifact_writer,
            test_runner=mock_test_runner,
            validation_config=validation_config,
            deployment_config=deployment_config,
            hitl_dispatcher=None,  # Skip HITL for artifact focus
        )

        # Act - Run complete workflow without HITL
        validation_result = await coordinator.run_validation(
            context=agent_context,
            implementation=sample_implementation,
            acceptance_criteria=sample_acceptance_criteria,
            skip_hitl=True,
        )

        deployment_result = await coordinator.run_deployment(
            context=agent_context,
            hitl5_approval={"approved": True},
            validation_report=validation_result.validation_report,
            security_report=validation_result.security_report,
            target_environment="staging",
            skip_hitl=True,
        )

        # Assert - Validation Report structure
        val_report = validation_result.validation_report
        assert val_report.feature_id is not None
        assert len(val_report.checks) > 0
        for check in val_report.checks:
            assert check.name is not None
            assert check.category in CheckCategory
            assert isinstance(check.passed, bool)
        assert val_report.e2e_results is not None
        assert val_report.e2e_results.passed >= 0

        # Assert - Security Report structure
        sec_report = validation_result.security_report
        assert sec_report.feature_id is not None
        assert isinstance(sec_report.findings, list)
        assert isinstance(sec_report.passed, bool)
        assert sec_report.scan_coverage > 0
        assert sec_report.compliance_status is not None

        # Assert - Release Manifest structure
        manifest = deployment_result.release_manifest
        assert manifest.version is not None
        assert len(manifest.features) > 0
        assert manifest.changelog is not None
        assert manifest.rollback_plan is not None

        # Assert - Deployment Plan structure
        plan = deployment_result.deployment_plan
        assert plan.release_version is not None
        assert plan.target_environment is not None
        assert plan.strategy in DeploymentStrategy
        assert len(plan.steps) > 0
        for step in plan.steps:
            assert step.order >= 1
            assert step.name is not None
            assert step.step_type in StepType
        assert len(plan.health_checks) > 0

        # Assert - Monitoring Config structure
        monitoring = deployment_result.monitoring_config
        assert monitoring.deployment_id is not None
        assert len(monitoring.metrics) > 0
        assert len(monitoring.alerts) > 0
        assert len(monitoring.dashboards) > 0

    @pytest.mark.asyncio
    async def test_workflow_idempotent_and_repeatable(
        self,
        workspace_path: Path,
        passing_e2e_result: TestRunResult,
        validation_config: ValidationConfig,
        deployment_config: DeploymentConfig,
    ) -> None:
        """Test that the workflow produces consistent results on repeated runs."""

        async def run_workflow() -> tuple[ValidationResult, DeploymentResult]:
            """Run a single workflow iteration with fresh IDs."""
            session_id = f"e2e-idempotent-{uuid.uuid4().hex[:8]}"
            task_id = f"e2e-idempotent-task-{uuid.uuid4().hex[:8]}"

            context = AgentContext(
                session_id=session_id,
                task_id=task_id,
                tenant_id="default",
                workspace_path=str(workspace_path),
            )

            implementation = {
                "feature_id": task_id,
                "files": [
                    {"path": "app.py", "content": "def main(): pass", "language": "python"}
                ],
            }

            mock_runner = MagicMock()
            mock_runner.run_tests = MagicMock(return_value=passing_e2e_result)

            mock_llm = create_mock_llm_client_for_full_workflow()
            writer = ArtifactWriter(str(workspace_path))

            coordinator = ValidationDeploymentCoordinator(
                llm_client=mock_llm,
                artifact_writer=writer,
                test_runner=mock_runner,
                validation_config=validation_config,
                deployment_config=deployment_config,
            )

            val_result = await coordinator.run_validation(
                context=context,
                implementation=implementation,
                acceptance_criteria=["Feature works"],
                skip_hitl=True,
            )

            dep_result = await coordinator.run_deployment(
                context=context,
                hitl5_approval={"approved": True},
                validation_report=val_result.validation_report,
                security_report=val_result.security_report,
                target_environment="staging",
                skip_hitl=True,
            )

            return val_result, dep_result

        # Run twice
        val1, dep1 = await run_workflow()
        val2, dep2 = await run_workflow()

        # Assert - Both runs succeeded
        assert val1.success is True
        assert val2.success is True
        assert dep1.success is True
        assert dep2.success is True

        # Assert - Structurally equivalent results
        assert len(val1.validation_report.checks) == len(val2.validation_report.checks)
        assert val1.validation_report.passed == val2.validation_report.passed
        assert val1.security_report.passed == val2.security_report.passed
        assert dep1.release_manifest.version == dep2.release_manifest.version
        assert len(dep1.deployment_plan.steps) == len(dep2.deployment_plan.steps)


class TestHITL5GateFlowE2E:
    """E2E tests for HITL-5 gate validation and approval flow."""

    @pytest.mark.asyncio
    async def test_hitl5_gate_submission(
        self,
        artifact_writer: ArtifactWriter,
        mock_test_runner: MagicMock,
        validation_config: ValidationConfig,
        deployment_config: DeploymentConfig,
        agent_context: AgentContext,
        sample_implementation: dict[str, Any],
        sample_acceptance_criteria: list[str],
        unique_task_id: str,
        unique_session_id: str,
    ) -> None:
        """Test that HITL-5 gate is correctly submitted with evidence."""
        # Arrange
        mock_llm_client = create_mock_llm_client_for_full_workflow()
        mock_hitl = create_mock_hitl_dispatcher(unique_task_id, unique_session_id)

        coordinator = ValidationDeploymentCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=artifact_writer,
            test_runner=mock_test_runner,
            validation_config=validation_config,
            deployment_config=deployment_config,
            hitl_dispatcher=mock_hitl,
        )

        # Act
        result = await coordinator.run_validation(
            context=agent_context,
            implementation=sample_implementation,
            acceptance_criteria=sample_acceptance_criteria,
            skip_hitl=False,
        )

        # Assert
        assert result.success is True
        assert result.pending_hitl5 is True
        assert result.hitl5_request_id is not None
        mock_hitl.request_gate.assert_called()

        # Verify HITL-5 was called with correct gate type
        call_kwargs = mock_hitl.request_gate.call_args[1]
        assert call_kwargs["gate_type"] == GateType.HITL_5_VALIDATION


class TestHITL6GateFlowE2E:
    """E2E tests for HITL-6 gate release and deployment approval flow."""

    @pytest.mark.asyncio
    async def test_hitl6_gate_submission(
        self,
        artifact_writer: ArtifactWriter,
        mock_test_runner: MagicMock,
        validation_config: ValidationConfig,
        deployment_config: DeploymentConfig,
        agent_context: AgentContext,
        sample_validation_report: ValidationReport,
        sample_security_report: SecurityReport,
        unique_task_id: str,
        unique_session_id: str,
    ) -> None:
        """Test that HITL-6 gate is correctly submitted with evidence."""
        # Arrange
        mock_llm_client = create_mock_llm_client_for_full_workflow()
        # Consume validation and security responses
        await mock_llm_client.generate()
        await mock_llm_client.generate()

        mock_hitl = create_mock_hitl_dispatcher(
            unique_task_id, unique_session_id, GateType.HITL_6_RELEASE
        )

        coordinator = ValidationDeploymentCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=artifact_writer,
            test_runner=mock_test_runner,
            validation_config=validation_config,
            deployment_config=deployment_config,
            hitl_dispatcher=mock_hitl,
        )

        # Act
        result = await coordinator.run_deployment(
            context=agent_context,
            hitl5_approval={"approved": True, "reviewer": "test"},
            validation_report=sample_validation_report,
            security_report=sample_security_report,
            target_environment="staging",
            skip_hitl=False,
        )

        # Assert
        assert result.success is True
        assert result.pending_hitl6 is True
        assert result.hitl6_request_id is not None
        mock_hitl.request_gate.assert_called()


class TestRejectionHandlingE2E:
    """E2E tests for HITL rejection handling."""

    @pytest.mark.asyncio
    async def test_hitl5_rejection_handling(
        self,
        artifact_writer: ArtifactWriter,
        mock_test_runner: MagicMock,
        validation_config: ValidationConfig,
        deployment_config: DeploymentConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test handling of HITL-5 rejection with feedback."""
        # Arrange
        mock_llm_client = create_mock_llm_client_for_full_workflow()

        coordinator = ValidationDeploymentCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=artifact_writer,
            test_runner=mock_test_runner,
            validation_config=validation_config,
            deployment_config=deployment_config,
        )

        # Act
        result = await coordinator.handle_rejection(
            context=agent_context,
            gate_type="hitl-5",
            feedback="Security findings need to be addressed before deployment",
        )

        # Assert
        assert result.success is False
        assert isinstance(result, RejectionResult)
        assert "hitl-5" in result.rejection_reason.lower()
        assert "security" in result.feedback.lower()

    @pytest.mark.asyncio
    async def test_hitl6_rejection_handling(
        self,
        artifact_writer: ArtifactWriter,
        mock_test_runner: MagicMock,
        validation_config: ValidationConfig,
        deployment_config: DeploymentConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test handling of HITL-6 rejection with feedback."""
        # Arrange
        mock_llm_client = create_mock_llm_client_for_full_workflow()

        coordinator = ValidationDeploymentCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=artifact_writer,
            test_runner=mock_test_runner,
            validation_config=validation_config,
            deployment_config=deployment_config,
        )

        # Act
        result = await coordinator.handle_rejection(
            context=agent_context,
            gate_type="hitl-6",
            feedback="Deployment plan requires additional health checks",
        )

        # Assert
        assert result.success is False
        assert isinstance(result, RejectionResult)
        assert "hitl-6" in result.rejection_reason.lower()
        assert "health" in result.feedback.lower()


class TestValidationDeploymentWorkflowWithRealRedis:
    """E2E tests that require real Redis instance."""

    @pytest.mark.asyncio
    async def test_hitl5_gate_lifecycle_with_approval(
        self,
        artifact_writer: ArtifactWriter,
        mock_test_runner: MagicMock,
        validation_config: ValidationConfig,
        deployment_config: DeploymentConfig,
        agent_context: AgentContext,
        sample_implementation: dict[str, Any],
        sample_acceptance_criteria: list[str],
        hitl_dispatcher: HITLDispatcher,
        mock_event_publisher: AsyncMock,
    ) -> None:
        """Test complete HITL-5 gate lifecycle: request -> pending -> approved.

        Requires Redis to be running.
        """
        # Arrange
        mock_llm_client = create_mock_llm_client_for_full_workflow()

        coordinator = ValidationDeploymentCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=artifact_writer,
            test_runner=mock_test_runner,
            validation_config=validation_config,
            deployment_config=deployment_config,
            hitl_dispatcher=hitl_dispatcher,
        )

        # Act - Submit validation
        result = await coordinator.run_validation(
            context=agent_context,
            implementation=sample_implementation,
            acceptance_criteria=sample_acceptance_criteria,
            skip_hitl=False,
        )

        # Assert - Request created
        assert result.success is True
        assert result.hitl5_request_id is not None

        # Act - Simulate human approval
        decision = await hitl_dispatcher.record_decision(
            request_id=result.hitl5_request_id,
            approved=True,
            reviewer="e2e-test-reviewer",
            reason="Validation and security checks passed",
        )

        # Assert - Decision recorded
        assert decision.approved is True
        assert decision.reviewer == "e2e-test-reviewer"

        # Assert - Request status updated
        updated_request = await hitl_dispatcher.get_request_by_id(result.hitl5_request_id)
        assert updated_request.status == GateStatus.APPROVED

        # Assert - Events published
        approval_events = [
            e for e in mock_event_publisher.events
            if e.event_type == EventType.GATE_APPROVED
        ]
        assert len(approval_events) >= 1

    @pytest.mark.asyncio
    async def test_hitl5_rejection_and_feedback(
        self,
        artifact_writer: ArtifactWriter,
        mock_test_runner: MagicMock,
        validation_config: ValidationConfig,
        deployment_config: DeploymentConfig,
        agent_context: AgentContext,
        sample_implementation: dict[str, Any],
        sample_acceptance_criteria: list[str],
        hitl_dispatcher: HITLDispatcher,
        mock_event_publisher: AsyncMock,
    ) -> None:
        """Test HITL-5 rejection scenario with feedback."""
        # Arrange
        mock_llm_client = create_mock_llm_client_for_full_workflow()

        coordinator = ValidationDeploymentCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=artifact_writer,
            test_runner=mock_test_runner,
            validation_config=validation_config,
            deployment_config=deployment_config,
            hitl_dispatcher=hitl_dispatcher,
        )

        # Act - Submit validation
        result = await coordinator.run_validation(
            context=agent_context,
            implementation=sample_implementation,
            acceptance_criteria=sample_acceptance_criteria,
            skip_hitl=False,
        )

        # Act - Simulate rejection
        decision = await hitl_dispatcher.record_decision(
            request_id=result.hitl5_request_id,
            approved=False,
            reviewer="e2e-test-reviewer",
            reason="Security scan coverage is below threshold",
        )

        # Assert - Decision recorded
        assert decision.approved is False

        # Assert - Request status updated
        updated_request = await hitl_dispatcher.get_request_by_id(result.hitl5_request_id)
        assert updated_request.status == GateStatus.REJECTED

        # Assert - Rejection event published
        rejection_events = [
            e for e in mock_event_publisher.events
            if e.event_type == EventType.GATE_REJECTED
        ]
        assert len(rejection_events) >= 1


class TestValidationDeploymentErrorHandling:
    """E2E tests for error handling in validation-deployment workflow."""

    @pytest.mark.asyncio
    async def test_handles_validation_failure_gracefully(
        self,
        artifact_writer: ArtifactWriter,
        validation_config: ValidationConfig,
        deployment_config: DeploymentConfig,
        agent_context: AgentContext,
        sample_implementation: dict[str, Any],
    ) -> None:
        """Test that workflow handles validation failure gracefully."""
        # Arrange - LLM returns validation that indicates failure
        failing_response = json.dumps({
            "checks": [
                {
                    "name": "E2E Tests",
                    "category": "functional",
                    "passed": False,
                    "details": "3 tests failed",
                    "evidence": None,
                },
            ],
            "recommendations": ["Fix failing tests"],
        })

        mock_llm = MagicMock()
        mock_llm.generate = AsyncMock(
            return_value=LLMResponse(content=failing_response, model="test")
        )
        mock_llm.model_name = "test-model"

        # Mock test runner that returns failing results
        failing_results = TestRunResult(
            suite_id="test",
            results=[
                TestResult(test_id="test1", passed=False, output="F", error="Failed", duration_ms=100)
            ],
            passed=0,
            failed=1,
            coverage=50.0,
        )
        mock_runner = MagicMock()
        mock_runner.run_tests = MagicMock(return_value=failing_results)

        coordinator = ValidationDeploymentCoordinator(
            llm_client=mock_llm,
            artifact_writer=artifact_writer,
            test_runner=mock_runner,
            validation_config=validation_config,
            deployment_config=deployment_config,
        )

        # Act
        result = await coordinator.run_validation(
            context=agent_context,
            implementation=sample_implementation,
            acceptance_criteria=["Feature works"],
            skip_hitl=True,
        )

        # Assert - Failure captured
        assert result.success is False
        assert result.failed_at == "validation"

    @pytest.mark.asyncio
    async def test_handles_security_failure_gracefully(
        self,
        artifact_writer: ArtifactWriter,
        validation_config: ValidationConfig,
        deployment_config: DeploymentConfig,
        agent_context: AgentContext,
        sample_implementation: dict[str, Any],
        passing_e2e_result: TestRunResult,
    ) -> None:
        """Test that workflow handles security scan failure gracefully."""
        # Arrange
        validation_response = json.dumps({
            "checks": [
                {"name": "E2E", "category": "functional", "passed": True, "details": "OK", "evidence": None}
            ],
            "recommendations": [],
        })

        # Security scan finds critical vulnerabilities
        security_response = json.dumps({
            "findings": [
                {
                    "id": "SEC-001",
                    "severity": "critical",
                    "category": "secrets",
                    "location": "config.py:5",
                    "description": "Hardcoded API key",
                    "remediation": "Use environment variables",
                },
            ],
            "compliance_status": {"OWASP_TOP_10": False},
            "scan_coverage": 90.0,
        })

        mock_llm = MagicMock()
        mock_llm.generate = AsyncMock(
            side_effect=[
                LLMResponse(content=validation_response, model="test"),
                LLMResponse(content=security_response, model="test"),
            ]
        )
        mock_llm.model_name = "test-model"

        mock_runner = MagicMock()
        mock_runner.run_tests = MagicMock(return_value=passing_e2e_result)

        coordinator = ValidationDeploymentCoordinator(
            llm_client=mock_llm,
            artifact_writer=artifact_writer,
            test_runner=mock_runner,
            validation_config=validation_config,
            deployment_config=deployment_config,
        )

        # Act
        result = await coordinator.run_validation(
            context=agent_context,
            implementation=sample_implementation,
            acceptance_criteria=["Feature works"],
            skip_hitl=True,
        )

        # Assert - Security failure captured
        assert result.success is False
        assert result.failed_at == "security"


# Cleanup fixture
@pytest.fixture(autouse=True)
async def cleanup_redis_keys(redis_client, unique_session_id, unique_task_id):
    """Clean up Redis keys after each test."""
    yield

    if redis_client:
        patterns = [
            "asdlc:gate_request:*",
            "asdlc:evidence_bundle:*",
            f"asdlc:decision_log:{unique_task_id}",
            "asdlc:pending_gates:*",
        ]

        for pattern in patterns:
            try:
                keys = await redis_client.keys(pattern)
                if keys:
                    await redis_client.delete(*keys)
            except Exception:
                pass  # Ignore cleanup errors
