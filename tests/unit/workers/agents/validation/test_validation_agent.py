"""Tests for ValidationAgent.

Tests the RLM-enabled validation agent that runs E2E tests,
checks integration points, and generates validation reports.
"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from src.workers.agents.protocols import AgentContext, AgentResult
from src.workers.agents.validation.config import ValidationConfig
from src.workers.agents.validation.models import (
    CheckCategory,
    ValidationCheck,
    ValidationReport,
)
from src.workers.agents.development.models import TestResult, TestRunResult


# Import the module under test (will be created)
# These imports will fail until implementation exists
from src.workers.agents.validation.validation_agent import (
    ValidationAgent,
    ValidationAgentError,
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
    writer.write_artifact = AsyncMock(return_value="/artifacts/test.json")
    return writer


@pytest.fixture
def mock_test_runner():
    """Create a mock test runner."""
    runner = MagicMock()
    return runner


@pytest.fixture
def mock_rlm_integration():
    """Create a mock RLM integration."""
    rlm = MagicMock()
    rlm.should_use_rlm = MagicMock()
    rlm.explore = AsyncMock()
    return rlm


@pytest.fixture
def validation_config():
    """Create a validation configuration."""
    return ValidationConfig(
        enable_rlm=True,
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
        mock_llm_client,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
    ):
        """Test that agent can be created with required arguments."""
        agent = ValidationAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            config=validation_config,
        )

        assert agent is not None
        assert agent.agent_type == "validation_agent"

    def test_creates_with_rlm_integration(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
        mock_rlm_integration,
    ):
        """Test that agent can be created with RLM integration."""
        agent = ValidationAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            config=validation_config,
            rlm_integration=mock_rlm_integration,
        )

        assert agent is not None
        assert agent._rlm_integration is mock_rlm_integration

    def test_agent_type_is_validation_agent(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
    ):
        """Test that agent_type property returns correct value."""
        agent = ValidationAgent(
            llm_client=mock_llm_client,
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
        mock_llm_client,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
        agent_context,
    ):
        """Test that execute returns failure when no implementation provided."""
        agent = ValidationAgent(
            llm_client=mock_llm_client,
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
        mock_llm_client,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
        agent_context,
    ):
        """Test that execute returns failure when no acceptance criteria provided."""
        agent = ValidationAgent(
            llm_client=mock_llm_client,
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
        mock_llm_client,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
        agent_context,
        passing_test_run_result,
    ):
        """Test that agent runs E2E tests and succeeds with passing tests."""
        mock_test_runner.run_tests.return_value = passing_test_run_result

        # Mock LLM response for validation analysis
        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "checks": [
                    {
                        "name": "E2E Tests",
                        "category": "functional",
                        "passed": true,
                        "details": "All E2E tests passed",
                        "evidence": "test_output.log"
                    }
                ],
                "recommendations": []
            }"""
        )

        agent = ValidationAgent(
            llm_client=mock_llm_client,
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
        mock_llm_client,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
        agent_context,
        failing_test_run_result,
    ):
        """Test that agent fails when E2E tests fail."""
        mock_test_runner.run_tests.return_value = failing_test_run_result

        # Mock LLM response for validation analysis
        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "checks": [
                    {
                        "name": "E2E Tests",
                        "category": "functional",
                        "passed": false,
                        "details": "Integration test failed",
                        "evidence": "test_output.log"
                    }
                ],
                "recommendations": ["Fix integration issues"]
            }"""
        )

        agent = ValidationAgent(
            llm_client=mock_llm_client,
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
        mock_llm_client,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
        agent_context,
        passing_test_run_result,
    ):
        """Test that agent generates a proper validation report."""
        mock_test_runner.run_tests.return_value = passing_test_run_result

        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "checks": [
                    {
                        "name": "E2E Tests",
                        "category": "functional",
                        "passed": true,
                        "details": "All tests passed",
                        "evidence": null
                    },
                    {
                        "name": "Integration Check",
                        "category": "compatibility",
                        "passed": true,
                        "details": "All integrations verified",
                        "evidence": null
                    }
                ],
                "recommendations": ["Consider adding more edge case tests"]
            }"""
        )

        agent = ValidationAgent(
            llm_client=mock_llm_client,
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
        mock_llm_client,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
        agent_context,
        passing_test_run_result,
    ):
        """Test that agent writes artifacts correctly."""
        mock_test_runner.run_tests.return_value = passing_test_run_result

        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "checks": [],
                "recommendations": []
            }"""
        )

        agent = ValidationAgent(
            llm_client=mock_llm_client,
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


class TestValidationAgentRLMIntegration:
    """Tests for ValidationAgent RLM integration."""

    @pytest.mark.asyncio
    async def test_uses_rlm_for_intermittent_failures(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
        agent_context,
        intermittent_test_run_result,
        mock_rlm_integration,
    ):
        """Test that agent uses RLM when tests have intermittent failures."""
        mock_test_runner.run_tests.return_value = intermittent_test_run_result

        # Configure RLM to trigger for intermittent failures
        mock_rlm_integration.should_use_rlm.return_value = MagicMock(
            should_trigger=True,
            reasons=["Intermittent test failures detected"],
        )
        mock_rlm_integration.explore.return_value = MagicMock(
            formatted_output="RLM found: Test depends on external service timing",
            error=None,
        )

        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "checks": [
                    {
                        "name": "E2E Tests",
                        "category": "functional",
                        "passed": false,
                        "details": "Intermittent failure analyzed via RLM",
                        "evidence": "rlm_analysis.md"
                    }
                ],
                "recommendations": ["Add retry logic for flaky tests"]
            }"""
        )

        agent = ValidationAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            config=validation_config,
            rlm_integration=mock_rlm_integration,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "implementation": {"files": [{"path": "test.py", "content": "pass"}]},
                "acceptance_criteria": ["Feature works"],
                "test_path": "/workspace/tests/e2e",
            },
        )

        # Verify RLM was used
        assert mock_rlm_integration.explore.called
        assert result.metadata.get("used_rlm") is True

    @pytest.mark.asyncio
    async def test_uses_rlm_for_performance_regression(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
        agent_context,
        mock_rlm_integration,
    ):
        """Test that agent uses RLM when performance regression detected."""
        # Create a test result with performance issues
        perf_test_result = TestRunResult(
            suite_id="e2e-suite",
            results=[
                TestResult(
                    test_id="test_performance",
                    passed=False,
                    output="Test failed: response time exceeded threshold",
                    error="PerformanceError: 5000ms > 1000ms threshold",
                    duration_ms=5000,
                ),
            ],
            passed=0,
            failed=1,
            coverage=80.0,
            metadata={"performance_regression": True},
        )
        mock_test_runner.run_tests.return_value = perf_test_result

        mock_rlm_integration.should_use_rlm.return_value = MagicMock(
            should_trigger=True,
            reasons=["Performance regression detected"],
        )
        mock_rlm_integration.explore.return_value = MagicMock(
            formatted_output="RLM found: N+1 query issue in new code",
            error=None,
        )

        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "checks": [
                    {
                        "name": "Performance Check",
                        "category": "performance",
                        "passed": false,
                        "details": "Performance regression found via RLM",
                        "evidence": "rlm_perf_analysis.md"
                    }
                ],
                "recommendations": ["Fix N+1 query issue"]
            }"""
        )

        agent = ValidationAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            config=validation_config,
            rlm_integration=mock_rlm_integration,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "implementation": {"files": [{"path": "test.py", "content": "pass"}]},
                "acceptance_criteria": ["Feature is performant"],
                "test_path": "/workspace/tests/e2e",
            },
        )

        assert mock_rlm_integration.explore.called
        assert result.metadata.get("used_rlm") is True

    @pytest.mark.asyncio
    async def test_uses_rlm_for_integration_issues(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
        agent_context,
        mock_rlm_integration,
    ):
        """Test that agent uses RLM when integration issues detected."""
        # Create a test result with integration issues
        integration_test_result = TestRunResult(
            suite_id="e2e-suite",
            results=[
                TestResult(
                    test_id="test_external_api",
                    passed=False,
                    output="Test failed: external API integration error",
                    error="IntegrationError: API contract mismatch",
                    duration_ms=200,
                ),
            ],
            passed=0,
            failed=1,
            coverage=70.0,
            metadata={"integration_failure": True},
        )
        mock_test_runner.run_tests.return_value = integration_test_result

        mock_rlm_integration.should_use_rlm.return_value = MagicMock(
            should_trigger=True,
            reasons=["Integration issues with external systems"],
        )
        mock_rlm_integration.explore.return_value = MagicMock(
            formatted_output="RLM found: API version mismatch",
            error=None,
        )

        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "checks": [
                    {
                        "name": "Integration Check",
                        "category": "compatibility",
                        "passed": false,
                        "details": "API contract mismatch found via RLM",
                        "evidence": "rlm_integration_analysis.md"
                    }
                ],
                "recommendations": ["Update API client to match new contract"]
            }"""
        )

        agent = ValidationAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            config=validation_config,
            rlm_integration=mock_rlm_integration,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "implementation": {"files": [{"path": "test.py", "content": "pass"}]},
                "acceptance_criteria": ["Integration works"],
                "test_path": "/workspace/tests/e2e",
            },
        )

        assert mock_rlm_integration.explore.called
        assert result.metadata.get("used_rlm") is True

    @pytest.mark.asyncio
    async def test_skips_rlm_when_disabled(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_test_runner,
        agent_context,
        passing_test_run_result,
        mock_rlm_integration,
    ):
        """Test that agent skips RLM when disabled in config."""
        config = ValidationConfig(enable_rlm=False)
        mock_test_runner.run_tests.return_value = passing_test_run_result

        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "checks": [],
                "recommendations": []
            }"""
        )

        agent = ValidationAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            config=config,
            rlm_integration=mock_rlm_integration,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "implementation": {"files": [{"path": "test.py", "content": "pass"}]},
                "acceptance_criteria": ["Feature works"],
                "test_path": "/workspace/tests/e2e",
            },
        )

        # RLM should not be called when disabled
        assert not mock_rlm_integration.explore.called
        assert result.metadata.get("used_rlm") is False

    @pytest.mark.asyncio
    async def test_handles_rlm_failure_gracefully(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
        agent_context,
        intermittent_test_run_result,
        mock_rlm_integration,
    ):
        """Test that agent handles RLM failures gracefully."""
        # Use intermittent test result to trigger RLM
        mock_test_runner.run_tests.return_value = intermittent_test_run_result

        mock_rlm_integration.should_use_rlm.return_value = MagicMock(
            should_trigger=True,
            reasons=["Test failure"],
        )
        mock_rlm_integration.explore.return_value = MagicMock(
            formatted_output="",
            error="RLM exploration failed: timeout",
        )

        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "checks": [
                    {
                        "name": "E2E Tests",
                        "category": "functional",
                        "passed": false,
                        "details": "Tests failed",
                        "evidence": null
                    }
                ],
                "recommendations": []
            }"""
        )

        agent = ValidationAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            config=validation_config,
            rlm_integration=mock_rlm_integration,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "implementation": {"files": [{"path": "test.py", "content": "pass"}]},
                "acceptance_criteria": ["Feature works"],
                "test_path": "/workspace/tests/e2e",
            },
        )

        # Should still produce a result even with RLM failure
        assert result.agent_type == "validation_agent"
        assert result.metadata.get("rlm_error") is not None


class TestValidationAgentNeedsRLM:
    """Tests for the _needs_rlm_validation internal method."""

    def test_returns_true_for_intermittent_failures(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
        intermittent_test_run_result,
    ):
        """Test that _needs_rlm_validation returns True for intermittent failures."""
        agent = ValidationAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            config=validation_config,
        )

        # Intermittent failures should trigger RLM
        result = agent._needs_rlm_validation(intermittent_test_run_result)
        assert result is True

    def test_returns_true_for_performance_issues(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
    ):
        """Test that _needs_rlm_validation returns True for performance issues."""
        perf_result = TestRunResult(
            suite_id="suite",
            results=[],
            passed=0,
            failed=1,
            coverage=0,
            metadata={"performance_regression": True},
        )

        agent = ValidationAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            config=validation_config,
        )

        result = agent._needs_rlm_validation(perf_result)
        assert result is True

    def test_returns_true_for_integration_failures(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
    ):
        """Test that _needs_rlm_validation returns True for integration failures."""
        integration_result = TestRunResult(
            suite_id="suite",
            results=[
                TestResult(
                    test_id="test",
                    passed=False,
                    output="",
                    error="IntegrationError: connection failed",
                    duration_ms=0,
                ),
            ],
            passed=0,
            failed=1,
            coverage=0,
            metadata={"integration_failure": True},
        )

        agent = ValidationAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            config=validation_config,
        )

        result = agent._needs_rlm_validation(integration_result)
        assert result is True

    def test_returns_false_for_simple_failures(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
        failing_test_run_result,
    ):
        """Test that _needs_rlm_validation returns False for simple failures."""
        agent = ValidationAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            config=validation_config,
        )

        # Simple assertion failures should not trigger RLM
        result = agent._needs_rlm_validation(failing_test_run_result)
        assert result is False


class TestValidationAgentValidateContext:
    """Tests for context validation."""

    def test_validates_complete_context(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
        agent_context,
    ):
        """Test that complete context passes validation."""
        agent = ValidationAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            test_runner=mock_test_runner,
            config=validation_config,
        )

        assert agent.validate_context(agent_context) is True

    def test_rejects_incomplete_context(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
    ):
        """Test that incomplete context fails validation."""
        agent = ValidationAgent(
            llm_client=mock_llm_client,
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
        mock_llm_client,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
        agent_context,
    ):
        """Test that agent handles test runner errors gracefully."""
        mock_test_runner.run_tests.side_effect = Exception("Test runner crashed")

        agent = ValidationAgent(
            llm_client=mock_llm_client,
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
    async def test_handles_llm_error(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_test_runner,
        validation_config,
        agent_context,
        passing_test_run_result,
    ):
        """Test that agent handles LLM errors gracefully."""
        mock_test_runner.run_tests.return_value = passing_test_run_result
        mock_llm_client.generate.side_effect = Exception("LLM service unavailable")

        agent = ValidationAgent(
            llm_client=mock_llm_client,
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
        assert "LLM service unavailable" in result.error_message
        assert result.should_retry is True

    @pytest.mark.asyncio
    async def test_handles_test_timeout(
        self,
        mock_llm_client,
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
            llm_client=mock_llm_client,
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
