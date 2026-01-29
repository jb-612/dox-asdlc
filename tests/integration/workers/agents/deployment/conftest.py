"""Shared fixtures for Deployment agents integration tests.

Provides mocks and fixtures for testing the interaction between:
- Release Agent
- Deployment Agent
- Monitor Agent
- Validation-Deployment Coordinator
- HITL Dispatcher
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.workers.agents.deployment.config import DeploymentConfig, DeploymentStrategy
from src.workers.agents.deployment.models import (
    AlertRule,
    AlertSeverity,
    ArtifactReference,
    ArtifactType,
    DashboardConfig,
    DeploymentPlan,
    DeploymentStep,
    HealthCheck,
    HealthCheckType,
    MetricDefinition,
    MetricType,
    MonitoringConfig,
    ReleaseManifest,
    StepType,
)
from src.workers.agents.development.models import TestResult, TestRunResult
from src.workers.agents.protocols import AgentContext, AgentResult
from src.workers.agents.validation.config import ValidationConfig
from src.workers.agents.validation.models import (
    CheckCategory,
    SecurityReport,
    ValidationCheck,
    ValidationReport,
)
from src.workers.artifacts.writer import ArtifactWriter
from src.workers.llm.client import LLMResponse


# --- Workspace and Paths ---


@pytest.fixture
def workspace_path(tmp_path: Path) -> Path:
    """Create a temporary workspace directory."""
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    return workspace


@pytest.fixture
def artifact_writer(workspace_path: Path) -> ArtifactWriter:
    """Create a real artifact writer for integration tests."""
    return ArtifactWriter(str(workspace_path))


# --- Configuration ---


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
def validation_config() -> ValidationConfig:
    """Create test validation configuration."""
    return ValidationConfig(
        e2e_test_timeout=30,
        enable_rlm=False,
    )


# --- Agent Context ---


@pytest.fixture
def agent_context(workspace_path: Path) -> AgentContext:
    """Create test agent context."""
    return AgentContext(
        session_id="integration-test-session",
        task_id="integration-test-task",
        tenant_id="default",
        workspace_path=str(workspace_path),
        metadata={"git_sha": "abc123def"},
    )


# --- Sample Validation/Security Data ---


@pytest.fixture
def sample_e2e_results() -> TestRunResult:
    """Create sample E2E test results."""
    return TestRunResult(
        suite_id="integration-test-task-e2e",
        results=[
            TestResult(
                test_id="test_feature",
                passed=True,
                output=".",
                error=None,
                duration_ms=100,
            ),
        ],
        passed=1,
        failed=0,
        coverage=90.0,
    )


@pytest.fixture
def sample_validation_report(sample_e2e_results: TestRunResult) -> ValidationReport:
    """Create a sample validation report."""
    return ValidationReport(
        feature_id="P04-F04",
        checks=[
            ValidationCheck(
                name="E2E Test Coverage",
                category=CheckCategory.FUNCTIONAL,
                passed=True,
                details="All E2E tests passed",
                evidence="test_results.json",
            ),
        ],
        e2e_results=sample_e2e_results,
        passed=True,
        recommendations=[],
    )


@pytest.fixture
def sample_security_report() -> SecurityReport:
    """Create a sample security report."""
    return SecurityReport(
        feature_id="P04-F04",
        findings=[],
        passed=True,
        scan_coverage=95.0,
        compliance_status={"OWASP_TOP_10": True},
    )


# --- Sample Deployment Data Models ---


@pytest.fixture
def sample_release_manifest() -> ReleaseManifest:
    """Create a sample release manifest."""
    return ReleaseManifest(
        version="1.2.0",
        features=["P04-F04"],
        changelog="## 1.2.0\n\n- Added validation and deployment agents\n- Security scanning improvements",
        artifacts=[
            ArtifactReference(
                name="asdlc-worker",
                artifact_type=ArtifactType.DOCKER_IMAGE,
                location="gcr.io/asdlc/worker:1.2.0",
                checksum="sha256:abc123",
            ),
            ArtifactReference(
                name="asdlc-chart",
                artifact_type=ArtifactType.HELM_CHART,
                location="helm/asdlc:1.2.0",
                checksum="sha256:def456",
            ),
        ],
        rollback_plan="1. Revert to previous helm release\n2. Verify service health\n3. Notify stakeholders",
    )


@pytest.fixture
def sample_deployment_plan() -> DeploymentPlan:
    """Create a sample deployment plan."""
    return DeploymentPlan(
        release_version="1.2.0",
        target_environment="staging",
        strategy=DeploymentStrategy.ROLLING,
        steps=[
            DeploymentStep(
                order=1,
                name="Prepare deployment",
                step_type=StepType.PREPARE,
                command="kubectl create namespace staging || true",
                timeout_seconds=60,
                rollback_command=None,
            ),
            DeploymentStep(
                order=2,
                name="Deploy application",
                step_type=StepType.DEPLOY,
                command="helm upgrade --install asdlc ./helm/asdlc --set image.tag=1.2.0",
                timeout_seconds=300,
                rollback_command="helm rollback asdlc",
            ),
            DeploymentStep(
                order=3,
                name="Verify deployment",
                step_type=StepType.VERIFY,
                command="kubectl rollout status deployment/asdlc-worker",
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
        ],
    )


@pytest.fixture
def sample_monitoring_config() -> MonitoringConfig:
    """Create a sample monitoring configuration."""
    return MonitoringConfig(
        deployment_id="integration-test-task",
        metrics=[
            MetricDefinition(
                name="http_requests_total",
                metric_type=MetricType.COUNTER,
                description="Total HTTP requests",
                labels=["method", "path", "status"],
            ),
            MetricDefinition(
                name="http_request_duration_seconds",
                metric_type=MetricType.HISTOGRAM,
                description="HTTP request duration",
                labels=["method", "path"],
            ),
        ],
        alerts=[
            AlertRule(
                name="HighErrorRate",
                condition="rate(http_requests_total{status=~\"5..\"}[5m]) / rate(http_requests_total[5m]) > 0.05",
                severity=AlertSeverity.CRITICAL,
                description="Error rate exceeds 5%",
                runbook_url="https://runbooks.example.com/high-error-rate",
            ),
        ],
        dashboards=[
            DashboardConfig(
                name="service-overview",
                title="Service Overview",
                panels=["request_rate", "error_rate", "latency_p99"],
                refresh_interval_seconds=30,
            ),
        ],
    )


# --- Mock LLM Client ---


@pytest.fixture
def mock_llm_client() -> MagicMock:
    """Create a generic mock LLM client."""
    client = MagicMock()
    client.generate = AsyncMock()
    client.model_name = "test-model"
    return client


def create_release_manifest_response() -> str:
    """Create a mock LLM response for release manifest generation."""
    return json.dumps({
        "version": "1.2.0",
        "features": ["P04-F04"],
        "changelog": "## 1.2.0\n\n- New feature added\n- Bug fixes",
        "artifacts": [
            {
                "name": "asdlc-worker",
                "artifact_type": "docker_image",
                "location": "gcr.io/asdlc/worker:1.2.0",
                "checksum": "sha256:abc123",
            },
        ],
        "rollback_plan": "1. Run helm rollback\n2. Verify health",
    })


def create_deployment_plan_response(strategy: str = "rolling") -> str:
    """Create a mock LLM response for deployment plan generation."""
    return json.dumps({
        "release_version": "1.2.0",
        "target_environment": "staging",
        "strategy": strategy,
        "steps": [
            {
                "order": 1,
                "name": "Prepare",
                "step_type": "prepare",
                "command": "kubectl apply -f namespace.yaml",
                "timeout_seconds": 60,
                "rollback_command": None,
            },
            {
                "order": 2,
                "name": "Deploy",
                "step_type": "deploy",
                "command": "helm upgrade --install app ./chart",
                "timeout_seconds": 300,
                "rollback_command": "helm rollback app",
            },
        ],
        "rollback_triggers": ["Error rate > 5%", "Health check failures > 3"],
        "health_checks": [
            {
                "name": "HTTP Health",
                "check_type": "http",
                "target": "/health",
                "interval_seconds": 30,
                "timeout_seconds": 5,
                "success_threshold": 1,
                "failure_threshold": 3,
            },
        ],
    })


def create_monitoring_config_response() -> str:
    """Create a mock LLM response for monitoring configuration."""
    return json.dumps({
        "deployment_id": "integration-test-task",
        "metrics": [
            {
                "name": "http_requests_total",
                "metric_type": "counter",
                "description": "Total HTTP requests",
                "labels": ["method", "status"],
            },
            {
                "name": "http_request_duration_seconds",
                "metric_type": "histogram",
                "description": "Request latency",
                "labels": ["method"],
            },
        ],
        "alerts": [
            {
                "name": "HighErrorRate",
                "condition": "rate(http_requests_total{status=~\"5..\"}[5m]) > 0.05",
                "severity": "critical",
                "description": "Error rate exceeds 5%",
                "runbook_url": None,
            },
        ],
        "dashboards": [
            {
                "name": "overview",
                "title": "Service Dashboard",
                "panels": ["requests", "errors", "latency"],
                "refresh_interval_seconds": 30,
            },
        ],
    })


@pytest.fixture
def mock_llm_client_for_release() -> MagicMock:
    """Create mock LLM client configured for Release agent."""
    client = MagicMock()
    client.generate = AsyncMock(
        return_value=LLMResponse(
            content=create_release_manifest_response(),
            model="test-model",
        )
    )
    client.model_name = "test-model"
    return client


@pytest.fixture
def mock_llm_client_for_deployment() -> MagicMock:
    """Create mock LLM client configured for Deployment agent."""
    client = MagicMock()
    client.generate = AsyncMock(
        return_value=LLMResponse(
            content=create_deployment_plan_response(),
            model="test-model",
        )
    )
    client.model_name = "test-model"
    return client


@pytest.fixture
def mock_llm_client_for_monitor() -> MagicMock:
    """Create mock LLM client configured for Monitor agent."""
    client = MagicMock()
    client.generate = AsyncMock(
        return_value=LLMResponse(
            content=create_monitoring_config_response(),
            model="test-model",
        )
    )
    client.model_name = "test-model"
    return client


# --- Mock Test Runner ---


@pytest.fixture
def mock_test_runner(sample_e2e_results: TestRunResult) -> MagicMock:
    """Create a mock test runner."""
    runner = MagicMock()
    runner.run_tests = MagicMock(return_value=sample_e2e_results)
    runner.timeout_seconds = 300
    return runner


@pytest.fixture
def failing_e2e_results() -> TestRunResult:
    """Create failing E2E test results."""
    return TestRunResult(
        suite_id="integration-test-task-e2e",
        results=[
            TestResult(
                test_id="test_feature",
                passed=False,
                output="F",
                error="AssertionError: Expected True but got False",
                duration_ms=100,
            ),
        ],
        passed=0,
        failed=1,
        coverage=50.0,
    )


@pytest.fixture
def mock_test_runner_failing(failing_e2e_results: TestRunResult) -> MagicMock:
    """Create a mock test runner that returns failing results."""
    runner = MagicMock()
    runner.run_tests = MagicMock(return_value=failing_e2e_results)
    runner.timeout_seconds = 300
    return runner


# --- Mock HITL Dispatcher ---


@pytest.fixture
def mock_hitl_dispatcher() -> MagicMock:
    """Create a mock HITL dispatcher for HITL-5 and HITL-6 gates."""
    from src.orchestrator.evidence_bundle import GateType
    from src.orchestrator.hitl_dispatcher import GateRequest, GateStatus

    dispatcher = MagicMock()

    # Default to HITL-5 gate
    mock_hitl5_request = GateRequest(
        request_id="integration-test-hitl5-request",
        task_id="integration-test-task",
        session_id="integration-test-session",
        gate_type=GateType.HITL_5_VALIDATION,
        status=GateStatus.PENDING,
        evidence_bundle=MagicMock(),
        requested_by="coordinator",
        requested_at=datetime.now(timezone.utc),
    )

    mock_hitl6_request = GateRequest(
        request_id="integration-test-hitl6-request",
        task_id="integration-test-task",
        session_id="integration-test-session",
        gate_type=GateType.HITL_6_RELEASE,
        status=GateStatus.PENDING,
        evidence_bundle=MagicMock(),
        requested_by="coordinator",
        requested_at=datetime.now(timezone.utc),
    )

    # Return appropriate gate based on gate_type argument
    def request_gate_side_effect(**kwargs):
        if kwargs.get("gate_type") == GateType.HITL_6_RELEASE:
            return mock_hitl6_request
        return mock_hitl5_request

    dispatcher.request_gate = AsyncMock(side_effect=request_gate_side_effect)

    return dispatcher


@pytest.fixture
def mock_hitl_dispatcher_rejected() -> MagicMock:
    """Create a mock HITL dispatcher that returns rejected gates."""
    from src.orchestrator.evidence_bundle import GateType
    from src.orchestrator.hitl_dispatcher import GateDecision, GateRequest, GateStatus

    dispatcher = MagicMock()

    mock_gate_request = GateRequest(
        request_id="integration-test-hitl6-rejected",
        task_id="integration-test-task",
        session_id="integration-test-session",
        gate_type=GateType.HITL_6_RELEASE,
        status=GateStatus.REJECTED,
        evidence_bundle=MagicMock(),
        requested_by="coordinator",
        requested_at=datetime.now(timezone.utc),
        decision=GateDecision(
            decision_id="decision-rejected",
            request_id="integration-test-hitl6-rejected",
            approved=False,
            reviewer="human-reviewer",
            reason="Deployment plan needs revision",
            decided_at=datetime.now(timezone.utc),
        ),
    )
    dispatcher.request_gate = AsyncMock(return_value=mock_gate_request)

    return dispatcher


# --- Agent Instances ---


@pytest.fixture
def release_agent(
    mock_llm_client_for_release: MagicMock,
    artifact_writer: ArtifactWriter,
    deployment_config: DeploymentConfig,
):
    """Create a Release agent instance for integration testing."""
    from src.workers.agents.deployment.release_agent import ReleaseAgent

    return ReleaseAgent(
        llm_client=mock_llm_client_for_release,
        artifact_writer=artifact_writer,
        config=deployment_config,
    )


@pytest.fixture
def deployment_agent(
    mock_llm_client_for_deployment: MagicMock,
    artifact_writer: ArtifactWriter,
    deployment_config: DeploymentConfig,
):
    """Create a Deployment agent instance for integration testing."""
    from src.workers.agents.deployment.deployment_agent import DeploymentAgent

    return DeploymentAgent(
        llm_client=mock_llm_client_for_deployment,
        artifact_writer=artifact_writer,
        config=deployment_config,
    )


@pytest.fixture
def monitor_agent(
    mock_llm_client_for_monitor: MagicMock,
    artifact_writer: ArtifactWriter,
    deployment_config: DeploymentConfig,
):
    """Create a Monitor agent instance for integration testing."""
    from src.workers.agents.deployment.monitor_agent import MonitorAgent

    return MonitorAgent(
        llm_client=mock_llm_client_for_monitor,
        artifact_writer=artifact_writer,
        config=deployment_config,
    )


# --- Mock Agents for Coordinator ---


@pytest.fixture
def mock_release_agent_for_coordinator(
    sample_release_manifest: ReleaseManifest,
) -> MagicMock:
    """Create a mock Release agent that returns release_manifest in metadata."""
    agent = MagicMock()
    agent.agent_type = "release_agent"
    agent.execute = AsyncMock(
        return_value=AgentResult(
            success=True,
            agent_type="release_agent",
            task_id="integration-test-task",
            artifact_paths=["artifacts/release_manifest.json"],
            metadata={
                "release_manifest": sample_release_manifest.to_dict(),
                "next_agent": "deployment_agent",
            },
        )
    )
    return agent


@pytest.fixture
def mock_deployment_agent_for_coordinator(
    sample_deployment_plan: DeploymentPlan,
) -> MagicMock:
    """Create a mock Deployment agent that returns deployment_plan in metadata."""
    agent = MagicMock()
    agent.agent_type = "deployment_agent"
    agent.execute = AsyncMock(
        return_value=AgentResult(
            success=True,
            agent_type="deployment_agent",
            task_id="integration-test-task",
            artifact_paths=["artifacts/deployment_plan.json"],
            metadata={
                "deployment_plan": sample_deployment_plan.to_dict(),
                "hitl_gate": "HITL-6",
            },
        )
    )
    return agent


@pytest.fixture
def mock_monitor_agent_for_coordinator(
    sample_monitoring_config: MonitoringConfig,
) -> MagicMock:
    """Create a mock Monitor agent that returns monitoring_config in metadata."""
    agent = MagicMock()
    agent.agent_type = "monitor_agent"
    agent.execute = AsyncMock(
        return_value=AgentResult(
            success=True,
            agent_type="monitor_agent",
            task_id="integration-test-task",
            artifact_paths=["artifacts/monitoring_config.json"],
            metadata={
                "monitoring_config": sample_monitoring_config.to_dict(),
            },
        )
    )
    return agent
