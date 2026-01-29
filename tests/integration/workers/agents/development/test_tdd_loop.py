"""Integration tests for Full TDD Loop.

Tests the complete TDD workflow orchestrated by TDDOrchestrator with
mocked test runner and LLM responses.
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.workers.agents.development.coding_agent import CodingAgent
from src.workers.agents.development.config import DevelopmentConfig
from src.workers.agents.development.debugger_agent import DebuggerAgent
from src.workers.agents.development.models import (
    CodeFile,
    CodeReview,
    Implementation,
    TestCase,
    TestResult,
    TestRunResult,
    TestSuite,
    TestType,
)
from src.workers.agents.development.reviewer_agent import ReviewerAgent
from src.workers.agents.development.tdd_orchestrator import TDDOrchestrator
from src.workers.agents.development.utest_agent import UTestAgent
from src.workers.agents.protocols import AgentContext, AgentResult
from src.workers.artifacts.writer import ArtifactWriter
from src.workers.llm.client import LLMResponse


class TestFullTDDLoop:
    """Integration tests for the full TDD loop."""

    @pytest.fixture
    def tdd_orchestrator(
        self,
        mock_utest_agent_for_orchestrator: MagicMock,
        mock_coding_agent_for_orchestrator: MagicMock,
        mock_debugger_agent_for_orchestrator: MagicMock,
        mock_reviewer_agent_for_orchestrator: MagicMock,
        mock_test_runner: MagicMock,
        config: DevelopmentConfig,
    ) -> TDDOrchestrator:
        """Create TDD orchestrator with mock agents that return correct metadata format."""
        return TDDOrchestrator(
            utest_agent=mock_utest_agent_for_orchestrator,
            coding_agent=mock_coding_agent_for_orchestrator,
            debugger_agent=mock_debugger_agent_for_orchestrator,
            reviewer_agent=mock_reviewer_agent_for_orchestrator,
            test_runner=mock_test_runner,
            config=config,
        )

    @pytest.mark.asyncio
    async def test_happy_path_tdd_loop(
        self,
        tdd_orchestrator: TDDOrchestrator,
        agent_context: AgentContext,
    ) -> None:
        """Test successful TDD loop: UTest -> Coding -> Pass -> Review -> Success."""
        result = await tdd_orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement a simple calculator",
            acceptance_criteria=[
                "add_numbers(2, 3) returns 5",
                "subtract_numbers(5, 3) returns 2",
            ],
        )

        assert result.success is True
        assert result.implementation is not None
        assert result.test_suite is not None
        assert result.test_result is not None
        assert result.review is not None
        assert result.retry_count == 0

    @pytest.mark.asyncio
    async def test_tdd_loop_with_retry(
        self,
        mock_utest_agent_for_orchestrator: MagicMock,
        mock_coding_agent_for_orchestrator: MagicMock,
        mock_debugger_agent_for_orchestrator: MagicMock,
        mock_reviewer_agent_for_orchestrator: MagicMock,
        mock_test_runner_failing: MagicMock,
        config: DevelopmentConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test TDD loop with one retry: UTest -> Coding -> Fail -> Retry -> Pass."""
        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent_for_orchestrator,
            coding_agent=mock_coding_agent_for_orchestrator,
            debugger_agent=mock_debugger_agent_for_orchestrator,
            reviewer_agent=mock_reviewer_agent_for_orchestrator,
            test_runner=mock_test_runner_failing,
            config=config,
        )

        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement string utilities",
            acceptance_criteria=["reverse_string('hello') returns 'olleh'"],
        )

        assert result.success is True
        assert result.retry_count == 1
        assert mock_test_runner_failing.run_tests.call_count == 2

    @pytest.mark.asyncio
    async def test_tdd_loop_passes_test_errors_on_retry(
        self,
        artifact_writer: ArtifactWriter,
        config: DevelopmentConfig,
        mock_rlm_integration: MagicMock,
        agent_context: AgentContext,
        sample_test_suite: TestSuite,
        failing_test_result: TestRunResult,
        passing_test_result: TestRunResult,
        passing_review: CodeReview,
    ) -> None:
        """Test that test errors are passed to Coding agent on retry."""
        # Track what metadata was passed to coding agent
        coding_calls_metadata: list[dict] = []

        # Create mock UTest that returns test suite
        mock_utest = MagicMock()
        mock_utest.agent_type = "utest"
        mock_utest.execute = AsyncMock(
            return_value=AgentResult(
                success=True,
                agent_type="utest",
                task_id="test-task",
                metadata={"test_suite": sample_test_suite.to_dict()},
            )
        )

        # Create mock Coding that tracks metadata
        mock_coding = MagicMock()
        mock_coding.agent_type = "coding"

        async def coding_execute(context, event_metadata):
            coding_calls_metadata.append(event_metadata.copy())
            return AgentResult(
                success=True,
                agent_type="coding",
                task_id="test-task",
                metadata={
                    "implementation": {
                        "task_id": "test-task",
                        "files": [{"path": "calc.py", "content": "def add(a, b): return a + b", "language": "python"}],
                        "imports": [],
                        "dependencies": [],
                    }
                },
            )

        mock_coding.execute = AsyncMock(side_effect=coding_execute)

        # Create mock Debugger
        mock_debugger = MagicMock()
        mock_debugger.agent_type = "debugger"
        mock_debugger.execute = AsyncMock()

        # Create mock Reviewer
        mock_reviewer = MagicMock()
        mock_reviewer.agent_type = "reviewer"
        mock_reviewer.execute = AsyncMock(
            return_value=AgentResult(
                success=True,
                agent_type="reviewer",
                task_id="test-task",
                metadata={"passed": True, "review": passing_review.to_dict()},
            )
        )

        # Create mock test runner: fail once, then pass
        mock_runner = MagicMock()
        mock_runner.run_tests = MagicMock(
            side_effect=[failing_test_result, passing_test_result]
        )

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest,
            coding_agent=mock_coding,
            debugger_agent=mock_debugger,
            reviewer_agent=mock_reviewer,
            test_runner=mock_runner,
            config=config,
        )

        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement calculator",
            acceptance_criteria=["add works"],
        )

        assert result.success is True
        assert len(coding_calls_metadata) == 2

        # First call should have fail_count=0
        assert coding_calls_metadata[0].get("fail_count") == 0

        # Second call should have fail_count=1 and test_errors
        assert coding_calls_metadata[1].get("fail_count") == 1
        assert "test_errors" in coding_calls_metadata[1]
        assert len(coding_calls_metadata[1]["test_errors"]) > 0

    @pytest.mark.asyncio
    async def test_tdd_loop_result_includes_all_artifacts(
        self,
        tdd_orchestrator: TDDOrchestrator,
        agent_context: AgentContext,
    ) -> None:
        """Test that TDD loop result includes all artifacts from the workflow."""
        result = await tdd_orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement data processor",
            acceptance_criteria=["Should process data correctly"],
        )

        assert result.success is True

        # Verify all components are present
        assert result.implementation is not None
        assert len(result.implementation.files) > 0

        assert result.test_suite is not None
        assert len(result.test_suite.test_cases) > 0

        assert result.test_result is not None
        assert result.test_result.all_passed() is True

        assert result.review is not None


class TestTDDLoopReviewFailure:
    """Tests for TDD loop behavior when review fails."""

    @pytest.mark.asyncio
    async def test_retries_when_review_fails(
        self,
        mock_utest_agent_for_orchestrator: MagicMock,
        mock_coding_agent_for_orchestrator: MagicMock,
        mock_debugger_agent_for_orchestrator: MagicMock,
        config: DevelopmentConfig,
        mock_test_runner: MagicMock,
        agent_context: AgentContext,
        passing_review: CodeReview,
    ) -> None:
        """Test that TDD loop retries when review fails."""
        # Create mock reviewer that fails first, then passes
        mock_reviewer = MagicMock()
        mock_reviewer.agent_type = "reviewer"

        call_count = 0

        async def reviewer_execute(context, event_metadata):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                # First review: fails
                return AgentResult(
                    success=True,
                    agent_type="reviewer",
                    task_id="test-task",
                    metadata={
                        "passed": False,
                        "review": {
                            "implementation_id": "test-task",
                            "passed": False,
                            "issues": [
                                {
                                    "id": "ISSUE-001",
                                    "description": "Missing error handling",
                                    "severity": "high",
                                    "file_path": "calc.py",
                                    "line_number": 1,
                                    "suggestion": "Add try-except",
                                }
                            ],
                            "suggestions": [],
                            "security_concerns": [],
                        },
                    },
                )
            else:
                # Second review: passes
                return AgentResult(
                    success=True,
                    agent_type="reviewer",
                    task_id="test-task",
                    metadata={
                        "passed": True,
                        "review": passing_review.to_dict(),
                    },
                )

        mock_reviewer.execute = AsyncMock(side_effect=reviewer_execute)

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent_for_orchestrator,
            coding_agent=mock_coding_agent_for_orchestrator,
            debugger_agent=mock_debugger_agent_for_orchestrator,
            reviewer_agent=mock_reviewer,
            test_runner=mock_test_runner,
            config=config,
        )

        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement robust calculator",
            acceptance_criteria=["Handle edge cases"],
        )

        assert result.success is True
        # Should have retried due to review failure
        assert result.retry_count >= 1


class TestTDDLoopConfiguration:
    """Tests for TDD loop configuration options."""

    @pytest.mark.asyncio
    async def test_uses_custom_config_values(
        self,
        mock_utest_agent_for_orchestrator: MagicMock,
        mock_coding_agent_for_orchestrator: MagicMock,
        mock_debugger_agent_for_orchestrator: MagicMock,
        mock_reviewer_agent_for_orchestrator: MagicMock,
        mock_test_runner: MagicMock,
        agent_context: AgentContext,
    ) -> None:
        """Test that TDD loop respects custom configuration values."""
        custom_config = DevelopmentConfig(
            max_coding_retries=2,  # Low retry count
            test_timeout_seconds=10,
        )

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent_for_orchestrator,
            coding_agent=mock_coding_agent_for_orchestrator,
            debugger_agent=mock_debugger_agent_for_orchestrator,
            reviewer_agent=mock_reviewer_agent_for_orchestrator,
            test_runner=mock_test_runner,
            config=custom_config,
        )

        assert orchestrator._config.max_coding_retries == 2
        assert orchestrator._config.test_timeout_seconds == 10

    @pytest.mark.asyncio
    async def test_default_config_when_none_provided(
        self,
        mock_utest_agent_for_orchestrator: MagicMock,
        mock_coding_agent_for_orchestrator: MagicMock,
        mock_debugger_agent_for_orchestrator: MagicMock,
        mock_reviewer_agent_for_orchestrator: MagicMock,
        mock_test_runner: MagicMock,
    ) -> None:
        """Test that default config is used when none provided."""
        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent_for_orchestrator,
            coding_agent=mock_coding_agent_for_orchestrator,
            debugger_agent=mock_debugger_agent_for_orchestrator,
            reviewer_agent=mock_reviewer_agent_for_orchestrator,
            test_runner=mock_test_runner,
            # No config provided
        )

        assert orchestrator._config is not None
        assert orchestrator._config.max_coding_retries == 4  # Default value


class TestTDDLoopErrorHandling:
    """Tests for TDD loop error handling."""

    @pytest.mark.asyncio
    async def test_returns_failure_when_utest_fails(
        self,
        artifact_writer: ArtifactWriter,
        config: DevelopmentConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test that TDD loop returns failure when UTest agent fails."""
        # Create failing UTest agent
        mock_utest = MagicMock()
        mock_utest.agent_type = "utest"
        mock_utest.execute = AsyncMock(
            return_value=AgentResult(
                success=False,
                agent_type="utest",
                task_id="test-task",
                error_message="Failed to parse acceptance criteria",
            )
        )

        mock_coding = MagicMock()
        mock_debugger = MagicMock()
        mock_reviewer = MagicMock()
        mock_runner = MagicMock()

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest,
            coding_agent=mock_coding,
            debugger_agent=mock_debugger,
            reviewer_agent=mock_reviewer,
            test_runner=mock_runner,
            config=config,
        )

        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature should work"],
        )

        assert result.success is False
        assert "Failed" in result.error_message

    @pytest.mark.asyncio
    async def test_returns_failure_when_coding_fails(
        self,
        config: DevelopmentConfig,
        agent_context: AgentContext,
        sample_test_suite: TestSuite,
    ) -> None:
        """Test that TDD loop returns failure when Coding agent fails."""
        # Create successful UTest
        mock_utest = MagicMock()
        mock_utest.agent_type = "utest"
        mock_utest.execute = AsyncMock(
            return_value=AgentResult(
                success=True,
                agent_type="utest",
                task_id="test-task",
                metadata={"test_suite": sample_test_suite.to_dict()},
            )
        )

        # Create failing Coding agent
        mock_coding = MagicMock()
        mock_coding.agent_type = "coding"
        mock_coding.execute = AsyncMock(
            return_value=AgentResult(
                success=False,
                agent_type="coding",
                task_id="test-task",
                error_message="Failed to generate implementation",
            )
        )

        mock_debugger = MagicMock()
        mock_reviewer = MagicMock()
        mock_runner = MagicMock()

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest,
            coding_agent=mock_coding,
            debugger_agent=mock_debugger,
            reviewer_agent=mock_reviewer,
            test_runner=mock_runner,
            config=config,
        )

        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature should work"],
        )

        assert result.success is False
        assert "implementation" in result.error_message.lower()

    @pytest.mark.asyncio
    async def test_handles_test_runner_exception(
        self,
        config: DevelopmentConfig,
        agent_context: AgentContext,
        sample_test_suite: TestSuite,
        sample_implementation: Implementation,
    ) -> None:
        """Test that TDD loop handles test runner exceptions."""
        from src.workers.agents.development.test_runner import TestTimeoutError

        # Create successful UTest
        mock_utest = MagicMock()
        mock_utest.agent_type = "utest"
        mock_utest.execute = AsyncMock(
            return_value=AgentResult(
                success=True,
                agent_type="utest",
                task_id="test-task",
                metadata={"test_suite": sample_test_suite.to_dict()},
            )
        )

        # Create successful Coding agent
        mock_coding = MagicMock()
        mock_coding.agent_type = "coding"
        mock_coding.execute = AsyncMock(
            return_value=AgentResult(
                success=True,
                agent_type="coding",
                task_id="test-task",
                metadata={"implementation": sample_implementation.to_dict()},
            )
        )

        mock_debugger = MagicMock()
        mock_reviewer = MagicMock()

        # Create test runner that throws timeout
        mock_runner = MagicMock()
        mock_runner.run_tests = MagicMock(
            side_effect=TestTimeoutError("Tests timed out after 30 seconds")
        )

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest,
            coding_agent=mock_coding,
            debugger_agent=mock_debugger,
            reviewer_agent=mock_reviewer,
            test_runner=mock_runner,
            config=config,
        )

        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature should work"],
        )

        assert result.success is False
        assert "timeout" in result.error_message.lower() or "timed out" in result.error_message.lower()
