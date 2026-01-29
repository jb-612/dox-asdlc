"""Shared fixtures for Validation agents integration tests.

Provides mocks and fixtures for testing the interaction between:
- Validation Agent
- Security Agent
- HITL Dispatcher
- Test Runner
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.workers.agents.development.models import TestResult, TestRunResult
from src.workers.agents.protocols import AgentContext, AgentResult
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
def validation_config() -> ValidationConfig:
    """Create test validation configuration."""
    return ValidationConfig(
        e2e_test_timeout=30,
        enable_rlm=False,  # Disable RLM for integration tests
        security_scan_level="standard",
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
    )


# --- Sample Data Models ---


@pytest.fixture
def sample_implementation() -> dict:
    """Create a sample implementation for validation testing."""
    return {
        "feature_id": "P04-F04",
        "files": [
            {
                "path": "src/calculator.py",
                "content": """def add(a: int, b: int) -> int:
    return a + b


def subtract(a: int, b: int) -> int:
    return a - b


def multiply(a: int, b: int) -> int:
    return a * b
""",
                "language": "python",
            }
        ],
        "imports": ["typing"],
        "dependencies": [],
    }


@pytest.fixture
def insecure_implementation() -> dict:
    """Create an implementation with security vulnerabilities."""
    return {
        "feature_id": "P04-F04-insecure",
        "files": [
            {
                "path": "src/insecure.py",
                "content": """import os
import pickle

API_KEY = "sk-1234567890abcdef"
DB_PASSWORD = "supersecretpassword"

def execute_query(user_input):
    # SQL injection vulnerability
    query = f"SELECT * FROM users WHERE name = '{user_input}'"
    return query

def run_command(cmd):
    # Command injection
    os.system(f"echo {cmd}")

def load_data(data):
    # Insecure deserialization
    return pickle.loads(data)
""",
                "language": "python",
            }
        ],
        "imports": ["os", "pickle"],
        "dependencies": [],
    }


@pytest.fixture
def sample_acceptance_criteria() -> list[str]:
    """Create sample acceptance criteria."""
    return [
        "add(2, 3) should return 5",
        "subtract(5, 3) should return 2",
        "multiply(4, 3) should return 12",
    ]


@pytest.fixture
def passing_e2e_result() -> TestRunResult:
    """Create passing E2E test results."""
    return TestRunResult(
        suite_id="integration-test-task-e2e",
        results=[
            TestResult(
                test_id="test_add_numbers",
                passed=True,
                output=".",
                error=None,
                duration_ms=50,
            ),
            TestResult(
                test_id="test_subtract_numbers",
                passed=True,
                output=".",
                error=None,
                duration_ms=45,
            ),
            TestResult(
                test_id="test_multiply_numbers",
                passed=True,
                output=".",
                error=None,
                duration_ms=40,
            ),
        ],
        passed=3,
        failed=0,
        coverage=90.0,
    )


@pytest.fixture
def failing_e2e_result() -> TestRunResult:
    """Create failing E2E test results."""
    return TestRunResult(
        suite_id="integration-test-task-e2e",
        results=[
            TestResult(
                test_id="test_add_numbers",
                passed=True,
                output=".",
                error=None,
                duration_ms=50,
            ),
            TestResult(
                test_id="test_integration_failure",
                passed=False,
                output="F",
                error="Connection timeout: external service unavailable",
                duration_ms=5000,
            ),
        ],
        passed=1,
        failed=1,
        coverage=50.0,
    )


@pytest.fixture
def sample_validation_report(passing_e2e_result: TestRunResult) -> ValidationReport:
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
            ValidationCheck(
                name="Integration Points",
                category=CheckCategory.FUNCTIONAL,
                passed=True,
                details="All integration points verified",
                evidence=None,
            ),
        ],
        e2e_results=passing_e2e_result,
        passed=True,
        recommendations=["Consider adding more edge case tests"],
    )


@pytest.fixture
def sample_security_report() -> SecurityReport:
    """Create a sample passing security report."""
    return SecurityReport(
        feature_id="P04-F04",
        findings=[],  # No findings = passed
        passed=True,
        scan_coverage=95.0,
        compliance_status={"OWASP_TOP_10": True},
    )


@pytest.fixture
def failing_security_report() -> SecurityReport:
    """Create a failing security report with findings."""
    return SecurityReport(
        feature_id="P04-F04-insecure",
        findings=[
            SecurityFinding(
                id="SEC-001",
                severity=Severity.CRITICAL,
                category=SecurityCategory.SECRETS,
                location="line 5",
                description="Hardcoded API key detected",
                remediation="Use environment variables",
            ),
            SecurityFinding(
                id="SEC-002",
                severity=Severity.CRITICAL,
                category=SecurityCategory.INJECTION,
                location="line 9",
                description="Potential SQL injection",
                remediation="Use parameterized queries",
            ),
        ],
        passed=False,
        scan_coverage=95.0,
        compliance_status={"OWASP_TOP_10": False},
    )


# --- Mock LLM Client ---


@pytest.fixture
def mock_llm_client() -> MagicMock:
    """Create a generic mock LLM client."""
    client = MagicMock()
    client.generate = AsyncMock()
    client.model_name = "test-model"
    return client


def create_validation_analysis_response(passed: bool = True) -> str:
    """Create a mock LLM response for validation analysis."""
    return json.dumps({
        "checks": [
            {
                "name": "E2E Test Coverage",
                "category": "functional",
                "passed": passed,
                "details": "All acceptance criteria covered" if passed else "Some criteria not covered",
                "evidence": "test_results.json",
            },
            {
                "name": "Integration Verification",
                "category": "functional",
                "passed": passed,
                "details": "Integration points verified" if passed else "Integration failures detected",
                "evidence": None,
            },
        ],
        "recommendations": ["Consider adding performance tests"],
    })


def create_security_analysis_response(passed: bool = True) -> str:
    """Create a mock LLM response for security analysis."""
    findings = []
    if not passed:
        findings.append({
            "id": "LLM-001",
            "severity": "high",
            "category": "auth",
            "location": "auth_handler.py:42",
            "description": "Missing authentication check",
            "remediation": "Add authentication decorator",
        })

    return json.dumps({
        "findings": findings,
        "compliance_status": {"OWASP_TOP_10": passed},
        "scan_coverage": 95.0,
    })


@pytest.fixture
def mock_llm_client_for_validation() -> MagicMock:
    """Create mock LLM client configured for Validation agent."""
    client = MagicMock()
    client.generate = AsyncMock(
        return_value=LLMResponse(
            content=create_validation_analysis_response(passed=True),
            model="test-model",
        )
    )
    client.model_name = "test-model"
    return client


@pytest.fixture
def mock_llm_client_for_security() -> MagicMock:
    """Create mock LLM client configured for Security agent."""
    client = MagicMock()
    client.generate = AsyncMock(
        return_value=LLMResponse(
            content=create_security_analysis_response(passed=True),
            model="test-model",
        )
    )
    client.model_name = "test-model"
    return client


@pytest.fixture
def mock_llm_client_for_security_failing() -> MagicMock:
    """Create mock LLM client that returns security findings."""
    client = MagicMock()
    client.generate = AsyncMock(
        return_value=LLMResponse(
            content=create_security_analysis_response(passed=False),
            model="test-model",
        )
    )
    client.model_name = "test-model"
    return client


# --- Mock Test Runner ---


@pytest.fixture
def mock_test_runner(passing_e2e_result: TestRunResult) -> MagicMock:
    """Create a mock test runner that returns passing results."""
    runner = MagicMock()
    runner.run_tests = MagicMock(return_value=passing_e2e_result)
    runner.timeout_seconds = 300
    return runner


@pytest.fixture
def mock_test_runner_failing(failing_e2e_result: TestRunResult) -> MagicMock:
    """Create a mock test runner that returns failing results."""
    runner = MagicMock()
    runner.run_tests = MagicMock(return_value=failing_e2e_result)
    runner.timeout_seconds = 300
    return runner


# --- Mock RLM Integration ---


@pytest.fixture
def mock_rlm_integration() -> MagicMock:
    """Create a mock RLM integration."""
    rlm = MagicMock()
    rlm.should_use_rlm.return_value = MagicMock(should_trigger=False)
    rlm.explore = AsyncMock(
        return_value=MagicMock(
            formatted_output="RLM exploration found similar patterns",
            error=None,
        )
    )
    return rlm


# --- Mock HITL Dispatcher ---


@pytest.fixture
def mock_hitl_dispatcher() -> MagicMock:
    """Create a mock HITL dispatcher for HITL-5 gate."""
    from src.orchestrator.evidence_bundle import GateType
    from src.orchestrator.hitl_dispatcher import GateRequest, GateStatus

    dispatcher = MagicMock()

    mock_gate_request = GateRequest(
        request_id="integration-test-hitl5-request",
        task_id="integration-test-task",
        session_id="integration-test-session",
        gate_type=GateType.HITL_5_VALIDATION,
        status=GateStatus.PENDING,
        evidence_bundle=MagicMock(),
        requested_by="validation_security_flow",
        requested_at=datetime.now(timezone.utc),
    )
    dispatcher.request_gate = AsyncMock(return_value=mock_gate_request)
    dispatcher.get_request_by_id = AsyncMock(return_value=mock_gate_request)

    return dispatcher


@pytest.fixture
def mock_hitl_dispatcher_rejected() -> MagicMock:
    """Create a mock HITL dispatcher that returns a rejected gate."""
    from src.orchestrator.evidence_bundle import GateType
    from src.orchestrator.hitl_dispatcher import GateDecision, GateRequest, GateStatus

    dispatcher = MagicMock()

    mock_gate_request = GateRequest(
        request_id="integration-test-hitl5-rejected",
        task_id="integration-test-task",
        session_id="integration-test-session",
        gate_type=GateType.HITL_5_VALIDATION,
        status=GateStatus.REJECTED,
        evidence_bundle=MagicMock(),
        requested_by="validation_security_flow",
        requested_at=datetime.now(timezone.utc),
        decision=GateDecision(
            decision_id="decision-rejected",
            request_id="integration-test-hitl5-rejected",
            approved=False,
            reviewer="human-reviewer",
            reason="Security findings need to be addressed",
            decided_at=datetime.now(timezone.utc),
        ),
    )
    dispatcher.request_gate = AsyncMock(return_value=mock_gate_request)

    return dispatcher


# --- Agent Instances ---


@pytest.fixture
def validation_agent(
    mock_llm_client_for_validation: MagicMock,
    artifact_writer: ArtifactWriter,
    mock_test_runner: MagicMock,
    validation_config: ValidationConfig,
    mock_rlm_integration: MagicMock,
):
    """Create a Validation agent instance for integration testing."""
    from src.workers.agents.validation.validation_agent import ValidationAgent

    return ValidationAgent(
        llm_client=mock_llm_client_for_validation,
        artifact_writer=artifact_writer,
        test_runner=mock_test_runner,
        config=validation_config,
        rlm_integration=mock_rlm_integration,
    )


@pytest.fixture
def security_agent(
    mock_llm_client_for_security: MagicMock,
    artifact_writer: ArtifactWriter,
    validation_config: ValidationConfig,
):
    """Create a Security agent instance for integration testing."""
    from src.workers.agents.validation.security_agent import SecurityAgent

    return SecurityAgent(
        llm_client=mock_llm_client_for_security,
        artifact_writer=artifact_writer,
        config=validation_config,
    )


@pytest.fixture
def security_agent_strict(
    mock_llm_client_for_security_failing: MagicMock,
    artifact_writer: ArtifactWriter,
    validation_config: ValidationConfig,
):
    """Create a Security agent that finds vulnerabilities."""
    from src.workers.agents.validation.security_agent import SecurityAgent

    return SecurityAgent(
        llm_client=mock_llm_client_for_security_failing,
        artifact_writer=artifact_writer,
        config=validation_config,
    )


# --- Mock Agents for Coordinator ---


@pytest.fixture
def mock_validation_agent_for_coordinator(
    sample_validation_report: ValidationReport,
) -> MagicMock:
    """Create a mock Validation agent that returns validation_report in metadata."""
    agent = MagicMock()
    agent.agent_type = "validation_agent"
    agent.execute = AsyncMock(
        return_value=AgentResult(
            success=True,
            agent_type="validation_agent",
            task_id="integration-test-task",
            artifact_paths=["artifacts/validation_report.json"],
            metadata={
                "validation_report": sample_validation_report.to_dict(),
                "used_rlm": False,
                "next_agent": "security_agent",
            },
        )
    )
    return agent


@pytest.fixture
def mock_security_agent_for_coordinator(
    sample_security_report: SecurityReport,
) -> MagicMock:
    """Create a mock Security agent that returns security_report in metadata."""
    agent = MagicMock()
    agent.agent_type = "security_agent"
    agent.execute = AsyncMock(
        return_value=AgentResult(
            success=True,
            agent_type="security_agent",
            task_id="integration-test-task",
            artifact_paths=["artifacts/security_report.json"],
            metadata={
                "security_report": sample_security_report.to_dict(),
                "hitl_gate": "HITL-5",
            },
        )
    )
    return agent
