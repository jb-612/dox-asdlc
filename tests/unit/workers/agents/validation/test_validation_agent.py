"""Tests for ValidationAgent.

Tests the backend-based validation agent that runs E2E tests,
checks integration points, and generates validation reports.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from src.workers.agents.backends.base import BackendResult
from src.workers.agents.protocols import AgentContext, AgentResult
from src.workers.agents.validation.config import ValidationConfig
from src.workers.agents.validation.models import (
    CheckCategory,
    ValidationCheck,
    ValidationReport,
)
from src.workers.agents.development.models import TestResult, TestRunResult


# Import the module under test
from src.workers.agents.validation.validation_agent import (
    ValidationAgent,
    ValidationAgentError,
)


@pytest.fixture
def mock_backend():
    """Create a mock agent backend."""
    backend = AsyncMock()
    backend.backend_name = "mock"
    backend.execute = AsyncMock(return_value=BackendResult(
        success=True,
        output='{"checks": [], "recommendations": []}',
        structured_output={"checks": [], "recommendations": []},
    ))
    backend.health_check = AsyncMock(return_value=True)
    return backend


@pytest.fixture
def mock_artifact_writer():
    """Create a mock artifact writer."""
    writer = AsyncMock()
    writer.write_artifact = AsyncMock(return_value="/artifacts/test.json")
    return writer


@pytest.fixture
def mock_test_runner():
    """Create a mock test runner."""
    runner = MagicMock()
    return runner


@pytest.fixture
def validation_config():
    """Create a validation configuration."""
    return ValidationConfig(
        e2e_test_timeout=300,
        security_scan_level="standard",
    )


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
                {"path": "src/module.py", "content": "# module code"},
            ],
            "interfaces": ["SomeInterface"],
        },
    )


@pytest.fixture
def passing_test_run_result():
    """Create a passing test run result."""
    return TestRunResult(
        suite_id="e2e-suite",
        results=[
            TestResult(
                test_id="test_feature_works",
                passed=True,
                output="Test passed",
                error=None,
                duration_ms=100,
            ),
            TestResult(
                test_id="test_integration_ok",
                passed=True,
                output="Test passed",
                error=None,
                duration_ms=150,
            ),
        ],
        passed=2,
        failed=0,
        coverage=85.0,
    )


@pytest.fixture
def failing_test_run_result():
    """Create a failing test run result."""
    return TestRunResult(
        suite_id="e2e-suite",
        results=[
            TestResult(
                test_id="test_feature_works",
                passed=True,
                output="Test passed",
                error=None,
                duration_ms=100,
            ),
            TestResult(
                test_id="test_integration_fails",
                passed=False,
                output="Test failed",
                error="AssertionError: Expected 200, got 500",
                duration_ms=50,
            ),
        ],
        passed=1,
        failed=1,
        coverage=75.0,
    )


@pytest.fixture
def intermittent_test_run_result():
    """Create a test run result with intermittent failures (flaky tests)."""
    return TestRunResult(
        suite_id="e2e-suite",
        results=[
            TestResult(
                test_id="test_flaky",
                passed=False,
                output="Test failed (timeout)",
                error="TimeoutError: Connection timeout",
                duration_ms=5000,
            ),
        ],
        passed=0,
        failed=1,
        coverage=50.0,
        metadata={"run_count": 3, "pass_count": 1},  # Intermittent
    )


class TestValidationAgentInit:
    """Tests for ValidationAgent initialization."""

    def test_creates_with_required_args(
        self,
        mock_backend,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
    ):
        """Test that agent can be created with required arguments."""
        agent = ValidationAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            config=validation_config,
        )

        assert agent is not None
        assert agent.agent_type == "validation_agent"

    def test_agent_type_is_validation_agent(
        self,
        mock_backend,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
    ):
        """Test that agent_type property returns correct value."""
        agent = ValidationAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            config=validation_config,
        )

        assert agent.agent_type == "validation_agent"


class TestValidationAgentExecute:
    """Tests for ValidationAgent.execute method."""

    @pytest.mark.asyncio
    async def test_returns_failure_when_no_implementation(
        self,
        mock_backend,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
        agent_context,
    ):
        """Test that execute returns failure when no implementation provided."""
        agent = ValidationAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            config=validation_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={},  # No implementation
        )

        assert result.success is False
        assert "implementation" in result.error_message.lower()
        assert result.should_retry is False

    @pytest.mark.asyncio
    async def test_returns_failure_when_no_acceptance_criteria(
        self,
        mock_backend,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
        agent_context,
    ):
        """Test that execute returns failure when no acceptance criteria provided."""
        agent = ValidationAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            config=validation_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "implementation": {"files": [{"path": "test.py", "content": "pass"}]},
                # No acceptance_criteria
            },
        )

        assert result.success is False
        assert "acceptance" in result.error_message.lower()
        assert result.should_retry is False

    @pytest.mark.asyncio
    async def test_runs_e2e_tests_successfully(
        self,
        mock_backend,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
        agent_context,
        passing_test_run_result,
    ):
        """Test that agent runs E2E tests and succeeds with passing tests."""
        mock_test_runner.run_tests.return_value = passing_test_run_result

        # Mock backend response for validation analysis
        mock_backend.execute.return_value = BackendResult(
            success=True,
            output='{}',
            structured_output={
                "checks": [
                    {
                        "name": "E2E Tests",
                        "category": "functional",
                        "passed": True,
                        "details": "All E2E tests passed",
                        "evidence": "test_output.log",
                    }
                ],
                "recommendations": [],
            },
        )

        agent = ValidationAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            config=validation_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "implementation": {"files": [{"path": "test.py", "content": "pass"}]},
                "acceptance_criteria": ["Feature works correctly"],
                "test_path": "/workspace/tests/e2e",
            },
        )

        assert result.success is True
        assert result.agent_type == "validation_agent"
        assert "validation_report" in result.metadata
        assert result.metadata.get("next_agent") == "security_agent"

    @pytest.mark.asyncio
    async def test_fails_when_e2e_tests_fail(
        self,
        mock_backend,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
        agent_context,
        failing_test_run_result,
    ):
        """Test that agent fails when E2E tests fail."""
        mock_test_runner.run_tests.return_value = failing_test_run_result

        # Mock backend response for validation analysis
        mock_backend.execute.return_value = BackendResult(
            success=True,
            output='{}',
            structured_output={
                "checks": [
                    {
                        "name": "E2E Tests",
                        "category": "functional",
                        "passed": False,
                        "details": "Integration test failed",
                        "evidence": "test_output.log",
                    }
                ],
                "recommendations": ["Fix integration issues"],
            },
        )

        agent = ValidationAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            config=validation_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "implementation": {"files": [{"path": "test.py", "content": "pass"}]},
                "acceptance_criteria": ["Feature works correctly"],
                "test_path": "/workspace/tests/e2e",
            },
        )

        assert result.success is False
        assert "validation_report" in result.metadata
        assert result.metadata.get("next_agent") is None

    @pytest.mark.asyncio
    async def test_generates_validation_report(
        self,
        mock_backend,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
        agent_context,
        passing_test_run_result,
    ):
        """Test that agent generates a proper validation report."""
        mock_test_runner.run_tests.return_value = passing_test_run_result

        mock_backend.execute.return_value = BackendResult(
            success=True,
            output='{}',
            structured_output={
                "checks": [
                    {
                        "name": "E2E Tests",
                        "category": "functional",
                        "passed": True,
                        "details": "All tests passed",
                        "evidence": None,
                    },
                    {
                        "name": "Integration Check",
                        "category": "compatibility",
                        "passed": True,
                        "details": "All integrations verified",
                        "evidence": None,
                    },
                ],
                "recommendations": ["Consider adding more edge case tests"],
            },
        )

        agent = ValidationAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            config=validation_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "implementation": {"files": [{"path": "test.py", "content": "pass"}]},
                "acceptance_criteria": ["Feature works correctly"],
                "test_path": "/workspace/tests/e2e",
                "feature_id": "P04-F04",
            },
        )

        assert result.success is True
        assert "validation_report" in result.metadata

        report = result.metadata["validation_report"]
        assert report["feature_id"] == "P04-F04"
        assert report["passed"] is True
        assert len(report["checks"]) == 2
        assert report["e2e_results"]["passed"] == 2

    @pytest.mark.asyncio
    async def test_writes_artifacts(
        self,
        mock_backend,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
        agent_context,
        passing_test_run_result,
    ):
        """Test that agent writes artifacts correctly."""
        mock_test_runner.run_tests.return_value = passing_test_run_result

        mock_backend.execute.return_value = BackendResult(
            success=True,
            output='{}',
            structured_output={
                "checks": [],
                "recommendations": [],
            },
        )

        agent = ValidationAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            config=validation_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "implementation": {"files": [{"path": "test.py", "content": "pass"}]},
                "acceptance_criteria": ["Feature works"],
                "test_path": "/workspace/tests/e2e",
            },
        )

        # Verify artifact writer was called
        assert mock_artifact_writer.write_artifact.called
        assert len(result.artifact_paths) > 0


class TestValidationAgentValidateContext:
    """Tests for context validation."""

    def test_validates_complete_context(
        self,
        mock_backend,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
        agent_context,
    ):
        """Test that complete context passes validation."""
        agent = ValidationAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            config=validation_config,
        )

        assert agent.validate_context(agent_context) is True

    def test_rejects_incomplete_context(
        self,
        mock_backend,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
    ):
        """Test that incomplete context fails validation."""
        agent = ValidationAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            config=validation_config,
        )

        incomplete_context = AgentContext(
            session_id="",
            task_id="",
            tenant_id="",
            workspace_path="",
        )

        assert agent.validate_context(incomplete_context) is False


class TestValidationAgentErrorHandling:
    """Tests for error handling."""

    @pytest.mark.asyncio
    async def test_handles_test_runner_error(
        self,
        mock_backend,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
        agent_context,
    ):
        """Test that agent handles test runner errors gracefully."""
        mock_test_runner.run_tests.side_effect = Exception("Test runner crashed")

        agent = ValidationAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            config=validation_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "implementation": {"files": [{"path": "test.py", "content": "pass"}]},
                "acceptance_criteria": ["Feature works"],
                "test_path": "/workspace/tests/e2e",
            },
        )

        assert result.success is False
        assert "Test runner crashed" in result.error_message
        assert result.should_retry is True

    @pytest.mark.asyncio
    async def test_handles_backend_error(
        self,
        mock_backend,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
        agent_context,
        passing_test_run_result,
    ):
        """Test that agent handles backend errors gracefully."""
        mock_test_runner.run_tests.return_value = passing_test_run_result
        mock_backend.execute.side_effect = Exception("Backend service unavailable")

        agent = ValidationAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            config=validation_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "implementation": {"files": [{"path": "test.py", "content": "pass"}]},
                "acceptance_criteria": ["Feature works"],
                "test_path": "/workspace/tests/e2e",
            },
        )

        assert result.success is False
        assert "Backend service unavailable" in result.error_message
        assert result.should_retry is True

    @pytest.mark.asyncio
    async def test_handles_test_timeout(
        self,
        mock_backend,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
        agent_context,
    ):
        """Test that agent handles test timeout errors."""
        from src.workers.agents.development.test_runner import TestTimeoutError

        mock_test_runner.run_tests.side_effect = TestTimeoutError(
            "Tests timed out after 300s"
        )

        agent = ValidationAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            config=validation_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "implementation": {"files": [{"path": "test.py", "content": "pass"}]},
                "acceptance_criteria": ["Feature works"],
                "test_path": "/workspace/tests/e2e",
            },
        )

        assert result.success is False
        assert "timed out" in result.error_message.lower()
