"""Shared fixtures for Development agents integration tests.

Provides mocks and fixtures for testing the interaction between:
- UTest Agent
- Coding Agent
- Debugger Agent
- Reviewer Agent
- TDD Orchestrator
- Test Runner
- HITL Dispatcher
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.workers.agents.development.config import DevelopmentConfig
from src.workers.agents.development.models import (
    CodeChange,
    CodeFile,
    CodeReview,
    DebugAnalysis,
    Implementation,
    IssueSeverity,
    ReviewIssue,
    TestCase,
    TestResult,
    TestRunResult,
    TestSuite,
    TestType,
)
from src.workers.agents.protocols import AgentContext, AgentResult
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
def config() -> DevelopmentConfig:
    """Create test configuration with fast retry settings."""
    return DevelopmentConfig(
        max_coding_retries=3,
        test_timeout_seconds=30,
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
def sample_test_suite() -> TestSuite:
    """Create a sample test suite for testing."""
    return TestSuite(
        task_id="integration-test-task",
        test_cases=[
            TestCase(
                id="TC-001",
                name="test_add_numbers",
                description="Test that add_numbers returns correct sum",
                test_type=TestType.UNIT,
                code="""def test_add_numbers():
    from calculator import add_numbers
    assert add_numbers(2, 3) == 5
    assert add_numbers(-1, 1) == 0
""",
                requirement_ref="AC-001",
            ),
            TestCase(
                id="TC-002",
                name="test_subtract_numbers",
                description="Test that subtract_numbers returns correct difference",
                test_type=TestType.UNIT,
                code="""def test_subtract_numbers():
    from calculator import subtract_numbers
    assert subtract_numbers(5, 3) == 2
    assert subtract_numbers(3, 5) == -2
""",
                requirement_ref="AC-002",
            ),
        ],
        setup_code="import pytest",
        teardown_code="",
        fixtures=["mock_db"],
    )


@pytest.fixture
def sample_implementation() -> Implementation:
    """Create a sample implementation."""
    return Implementation(
        task_id="integration-test-task",
        files=[
            CodeFile(
                path="calculator.py",
                content="""def add_numbers(a: int, b: int) -> int:
    return a + b


def subtract_numbers(a: int, b: int) -> int:
    return a - b
""",
                language="python",
            )
        ],
        imports=["typing"],
        dependencies=[],
    )


@pytest.fixture
def failing_implementation() -> Implementation:
    """Create an implementation that will fail tests."""
    return Implementation(
        task_id="integration-test-task",
        files=[
            CodeFile(
                path="calculator.py",
                content="""def add_numbers(a: int, b: int) -> int:
    return a  # Bug: ignores b


def subtract_numbers(a: int, b: int) -> int:
    return a  # Bug: ignores b
""",
                language="python",
            )
        ],
        imports=["typing"],
        dependencies=[],
    )


@pytest.fixture
def passing_test_result() -> TestRunResult:
    """Create a passing test result."""
    return TestRunResult(
        suite_id="integration-test-task",
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
        ],
        passed=2,
        failed=0,
        coverage=85.0,
    )


@pytest.fixture
def failing_test_result() -> TestRunResult:
    """Create a failing test result."""
    return TestRunResult(
        suite_id="integration-test-task",
        results=[
            TestResult(
                test_id="test_add_numbers",
                passed=False,
                output="F",
                error="AssertionError: assert 2 == 5",
                duration_ms=50,
            ),
            TestResult(
                test_id="test_subtract_numbers",
                passed=False,
                output="F",
                error="AssertionError: assert 5 == 2",
                duration_ms=45,
            ),
        ],
        passed=0,
        failed=2,
        coverage=0.0,
    )


@pytest.fixture
def passing_review() -> CodeReview:
    """Create a passing code review."""
    return CodeReview(
        implementation_id="integration-test-task",
        passed=True,
        issues=[],
        suggestions=["Consider adding type hints to improve documentation"],
        security_concerns=[],
    )


@pytest.fixture
def failing_review() -> CodeReview:
    """Create a failing code review."""
    return CodeReview(
        implementation_id="integration-test-task",
        passed=False,
        issues=[
            ReviewIssue(
                id="ISSUE-001",
                description="Missing input validation",
                severity=IssueSeverity.HIGH,
                file_path="calculator.py",
                line_number=1,
                suggestion="Add type checking for inputs",
            )
        ],
        suggestions=[],
        security_concerns=[],
    )


@pytest.fixture
def sample_debug_analysis() -> DebugAnalysis:
    """Create a sample debug analysis."""
    return DebugAnalysis(
        failure_id="debug-001",
        root_cause="Implementation ignores the second parameter in arithmetic operations",
        fix_suggestion="Include parameter b in the return calculation",
        code_changes=[
            CodeChange(
                file_path="calculator.py",
                original_code="return a  # Bug: ignores b",
                new_code="return a + b",
                description="Fix add_numbers to include second parameter",
                line_start=2,
                line_end=2,
            ),
            CodeChange(
                file_path="calculator.py",
                original_code="return a  # Bug: ignores b",
                new_code="return a - b",
                description="Fix subtract_numbers to include second parameter",
                line_start=6,
                line_end=6,
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


def create_test_generation_response() -> str:
    """Create a mock LLM response for test generation."""
    return json.dumps({
        "test_cases": [
            {
                "id": "TC-001",
                "name": "test_add_numbers",
                "description": "Test addition functionality",
                "test_type": "unit",
                "code": """def test_add_numbers():
    from calculator import add_numbers
    assert add_numbers(2, 3) == 5
""",
                "requirement_ref": "AC-001",
            },
        ],
        "setup_code": "import pytest",
        "teardown_code": "",
        "fixtures": [],
    })


def create_implementation_response() -> str:
    """Create a mock LLM response for implementation generation."""
    return json.dumps({
        "files": [
            {
                "path": "calculator.py",
                "content": """def add_numbers(a: int, b: int) -> int:
    return a + b
""",
                "language": "python",
            }
        ],
        "imports": ["typing"],
        "dependencies": [],
    })


def create_review_response(passed: bool = True) -> str:
    """Create a mock LLM response for code review."""
    return json.dumps({
        "passed": passed,
        "issues": [] if passed else [
            {
                "id": "ISSUE-001",
                "description": "Missing input validation",
                "severity": "high",
                "file_path": "calculator.py",
                "line_number": 1,
                "suggestion": "Add input validation",
            }
        ],
        "suggestions": ["Consider adding type hints"],
        "security_concerns": [],
    })


def create_debug_response() -> str:
    """Create a mock LLM response for debug analysis."""
    return json.dumps({
        "failure_id": "debug-001",
        "root_cause": "Implementation ignores second parameter",
        "fix_suggestion": "Include parameter b in calculation",
        "code_changes": [
            {
                "file_path": "calculator.py",
                "original_code": "return a",
                "new_code": "return a + b",
                "description": "Fix to include both parameters",
                "line_start": 2,
                "line_end": 2,
            }
        ],
    })


@pytest.fixture
def mock_llm_client_for_utest() -> MagicMock:
    """Create mock LLM client configured for UTest agent."""
    client = MagicMock()
    client.generate = AsyncMock(
        return_value=LLMResponse(
            content=create_test_generation_response(),
            model="test-model",
        )
    )
    client.model_name = "test-model"
    return client


@pytest.fixture
def mock_llm_client_for_coding() -> MagicMock:
    """Create mock LLM client configured for Coding agent."""
    client = MagicMock()
    client.generate = AsyncMock(
        return_value=LLMResponse(
            content=create_implementation_response(),
            model="test-model",
        )
    )
    client.model_name = "test-model"
    return client


@pytest.fixture
def mock_llm_client_for_reviewer() -> MagicMock:
    """Create mock LLM client configured for Reviewer agent."""
    client = MagicMock()
    client.generate = AsyncMock(
        return_value=LLMResponse(
            content=create_review_response(passed=True),
            model="opus-model",
        )
    )
    client.model_name = "opus-model"
    return client


@pytest.fixture
def mock_llm_client_for_debugger() -> MagicMock:
    """Create mock LLM client configured for Debugger agent."""
    client = MagicMock()
    # Debugger makes multiple LLM calls (failure analysis, root cause, fix suggestion)
    client.generate = AsyncMock(
        side_effect=[
            LLMResponse(content="Failure analysis: tests expect addition but got single value", model="test-model"),
            LLMResponse(content="Root cause: second parameter ignored", model="test-model"),
            LLMResponse(content=create_debug_response(), model="test-model"),
        ]
    )
    client.model_name = "test-model"
    return client


# --- Mock RLM Integration ---


@pytest.fixture
def mock_rlm_integration() -> MagicMock:
    """Create a mock RLM integration."""
    rlm = MagicMock()
    rlm.should_use_rlm.return_value = MagicMock(should_trigger=False)
    rlm.explore = AsyncMock(
        return_value=MagicMock(
            formatted_output="RLM exploration found similar patterns in codebase",
            error=None,
        )
    )
    return rlm


# --- Mock Test Runner ---


@pytest.fixture
def mock_test_runner(
    passing_test_result: TestRunResult,
) -> MagicMock:
    """Create a mock test runner that returns passing results."""
    runner = MagicMock()
    runner.run_tests = MagicMock(return_value=passing_test_result)
    return runner


@pytest.fixture
def mock_test_runner_failing(
    failing_test_result: TestRunResult,
    passing_test_result: TestRunResult,
) -> MagicMock:
    """Create a mock test runner that fails then passes."""
    runner = MagicMock()
    # First call fails, second call passes
    runner.run_tests = MagicMock(
        side_effect=[failing_test_result, passing_test_result]
    )
    return runner


@pytest.fixture
def mock_test_runner_persistent_failure(
    failing_test_result: TestRunResult,
) -> MagicMock:
    """Create a mock test runner that always fails."""
    runner = MagicMock()
    runner.run_tests = MagicMock(return_value=failing_test_result)
    return runner


# --- Mock HITL Dispatcher ---


@pytest.fixture
def mock_hitl_dispatcher() -> MagicMock:
    """Create a mock HITL dispatcher."""
    from src.orchestrator.evidence_bundle import GateType
    from src.orchestrator.hitl_dispatcher import GateRequest, GateStatus

    dispatcher = MagicMock()

    mock_gate_request = GateRequest(
        request_id="integration-test-hitl4-request",
        task_id="integration-test-task",
        session_id="integration-test-session",
        gate_type=GateType.HITL_4_CODE,
        status=GateStatus.PENDING,
        evidence_bundle=MagicMock(),
        requested_by="tdd_orchestrator",
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
        request_id="integration-test-hitl4-rejected",
        task_id="integration-test-task",
        session_id="integration-test-session",
        gate_type=GateType.HITL_4_CODE,
        status=GateStatus.REJECTED,
        evidence_bundle=MagicMock(),
        requested_by="tdd_orchestrator",
        requested_at=datetime.now(timezone.utc),
        decision=GateDecision(
            decision_id="decision-rejected",
            request_id="integration-test-hitl4-rejected",
            approved=False,
            reviewer="human-reviewer",
            reason="Code does not meet quality standards",
            decided_at=datetime.now(timezone.utc),
        ),
    )
    dispatcher.request_gate = AsyncMock(return_value=mock_gate_request)

    return dispatcher


# --- Agent Instances ---

# Note: For direct agent testing (UTest -> Coding flow), we use real agents.
# For TDD orchestrator testing, we use mock agents that return data in the
# expected metadata format.


@pytest.fixture
def utest_agent(
    mock_llm_client_for_utest: MagicMock,
    artifact_writer: ArtifactWriter,
    config: DevelopmentConfig,
):
    """Create a UTest agent instance for direct agent testing."""
    from src.workers.agents.backends.llm_backend import LLMAgentBackend
    from src.workers.agents.development.utest_agent import UTestAgent

    backend = LLMAgentBackend(llm_client=mock_llm_client_for_utest)
    return UTestAgent(
        backend=backend,
        artifact_writer=artifact_writer,
        config=config,
    )


@pytest.fixture
def coding_agent(
    mock_llm_client_for_coding: MagicMock,
    artifact_writer: ArtifactWriter,
    config: DevelopmentConfig,
):
    """Create a Coding agent instance for direct agent testing."""
    from src.workers.agents.backends.llm_backend import LLMAgentBackend
    from src.workers.agents.development.coding_agent import CodingAgent

    backend = LLMAgentBackend(llm_client=mock_llm_client_for_coding)

    return CodingAgent(
        backend=backend,
        artifact_writer=artifact_writer,
        config=config,
    )


@pytest.fixture
def debugger_agent(
    mock_llm_client_for_debugger: MagicMock,
    artifact_writer: ArtifactWriter,
    config: DevelopmentConfig,
    mock_rlm_integration: MagicMock,
):
    """Create a Debugger agent instance for direct agent testing."""
    from src.workers.agents.development.debugger_agent import DebuggerAgent

    return DebuggerAgent(
        llm_client=mock_llm_client_for_debugger,
        artifact_writer=artifact_writer,
        config=config,
        rlm_integration=mock_rlm_integration,
    )


@pytest.fixture
def reviewer_agent(
    mock_llm_client_for_reviewer: MagicMock,
    artifact_writer: ArtifactWriter,
    config: DevelopmentConfig,
):
    """Create a Reviewer agent instance for direct agent testing."""
    from src.workers.agents.backends.llm_backend import LLMAgentBackend
    from src.workers.agents.development.reviewer_agent import ReviewerAgent

    backend = LLMAgentBackend(llm_client=mock_llm_client_for_reviewer)
    return ReviewerAgent(
        backend=backend,
        artifact_writer=artifact_writer,
        config=config,
    )


# --- Mock Agents for TDD Orchestrator ---
# These return data in the format expected by TDDOrchestrator._extract_* methods


@pytest.fixture
def mock_utest_agent_for_orchestrator(
    sample_test_suite: TestSuite,
) -> MagicMock:
    """Create a mock UTest agent that returns test_suite in metadata."""
    agent = MagicMock()
    agent.agent_type = "utest"
    agent.execute = AsyncMock(
        return_value=AgentResult(
            success=True,
            agent_type="utest",
            task_id="integration-test-task",
            metadata={"test_suite": sample_test_suite.to_dict()},
        )
    )
    return agent


@pytest.fixture
def mock_coding_agent_for_orchestrator(
    sample_implementation: Implementation,
) -> MagicMock:
    """Create a mock Coding agent that returns implementation in metadata."""
    agent = MagicMock()
    agent.agent_type = "coding"
    agent.execute = AsyncMock(
        return_value=AgentResult(
            success=True,
            agent_type="coding",
            task_id="integration-test-task",
            metadata={"implementation": sample_implementation.to_dict()},
        )
    )
    return agent


@pytest.fixture
def mock_debugger_agent_for_orchestrator(
    sample_debug_analysis: DebugAnalysis,
) -> MagicMock:
    """Create a mock Debugger agent that returns debug_analysis in metadata."""
    agent = MagicMock()
    agent.agent_type = "debugger"
    agent.execute = AsyncMock(
        return_value=AgentResult(
            success=True,
            agent_type="debugger",
            task_id="integration-test-task",
            metadata={
                "debug_analysis": sample_debug_analysis.to_dict(),
                "root_cause": sample_debug_analysis.root_cause,
                "fix_suggestion": sample_debug_analysis.fix_suggestion,
                "code_changes": [c.to_dict() for c in sample_debug_analysis.code_changes],
            },
        )
    )
    return agent


@pytest.fixture
def mock_reviewer_agent_for_orchestrator(
    passing_review: CodeReview,
) -> MagicMock:
    """Create a mock Reviewer agent that returns review in metadata."""
    agent = MagicMock()
    agent.agent_type = "reviewer"
    agent.execute = AsyncMock(
        return_value=AgentResult(
            success=True,
            agent_type="reviewer",
            task_id="integration-test-task",
            metadata={
                "passed": True,
                "review": passing_review.to_dict(),
            },
        )
    )
    return agent
