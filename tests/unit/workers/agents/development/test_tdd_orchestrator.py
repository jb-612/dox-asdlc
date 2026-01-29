"""Unit tests for TDDOrchestrator."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.workers.agents.protocols import AgentContext, AgentResult
from src.workers.agents.development.config import DevelopmentConfig
from src.workers.agents.development.models import (
    CodeFile,
    CodeReview,
    DebugAnalysis,
    Implementation,
    TestCase,
    TestResult,
    TestRunResult,
    TestSuite,
    TestType,
)


@pytest.fixture
def mock_utest_agent():
    """Create a mock UTest agent."""
    agent = MagicMock()
    agent.agent_type = "utest"
    agent.execute = AsyncMock()
    return agent


@pytest.fixture
def mock_coding_agent():
    """Create a mock Coding agent."""
    agent = MagicMock()
    agent.agent_type = "coding"
    agent.execute = AsyncMock()
    return agent


@pytest.fixture
def mock_debugger_agent():
    """Create a mock Debugger agent."""
    agent = MagicMock()
    agent.agent_type = "debugger"
    agent.execute = AsyncMock()
    return agent


@pytest.fixture
def mock_reviewer_agent():
    """Create a mock Reviewer agent."""
    agent = MagicMock()
    agent.agent_type = "reviewer"
    agent.execute = AsyncMock()
    return agent


@pytest.fixture
def mock_test_runner():
    """Create a mock TestRunner."""
    runner = MagicMock()
    runner.run_tests = MagicMock()
    return runner


@pytest.fixture
def agent_context():
    """Create a test agent context."""
    return AgentContext(
        session_id="test-session",
        task_id="test-task",
        tenant_id="default",
        workspace_path="/tmp/workspace",
    )


@pytest.fixture
def config():
    """Create test configuration."""
    return DevelopmentConfig(max_coding_retries=4)


@pytest.fixture
def sample_test_suite():
    """Create a sample test suite."""
    return TestSuite(
        task_id="test-task",
        test_cases=[
            TestCase(
                id="TC-001",
                name="test_feature_works",
                description="Test that feature works correctly",
                test_type=TestType.UNIT,
                code="def test_feature_works(): assert True",
                requirement_ref="AC-001",
            )
        ],
        setup_code="import pytest",
        teardown_code="",
        fixtures=["mock_db"],
    )


@pytest.fixture
def sample_implementation():
    """Create a sample implementation."""
    return Implementation(
        task_id="test-task",
        files=[
            CodeFile(
                path="src/feature.py",
                content="def feature(): return True",
                language="python",
            )
        ],
        imports=["typing"],
        dependencies=[],
    )


@pytest.fixture
def passing_test_result():
    """Create a passing test result."""
    return TestRunResult(
        suite_id="test-suite",
        results=[
            TestResult(
                test_id="test_feature_works",
                passed=True,
                output=".",
                error=None,
                duration_ms=100,
            )
        ],
        passed=1,
        failed=0,
        coverage=80.0,
    )


@pytest.fixture
def failing_test_result():
    """Create a failing test result."""
    return TestRunResult(
        suite_id="test-suite",
        results=[
            TestResult(
                test_id="test_feature_works",
                passed=False,
                output="F",
                error="AssertionError: expected True",
                duration_ms=100,
            )
        ],
        passed=0,
        failed=1,
        coverage=0.0,
    )


@pytest.fixture
def passing_review():
    """Create a passing code review."""
    return CodeReview(
        implementation_id="test-task",
        passed=True,
        issues=[],
        suggestions=["Consider adding docstrings"],
        security_concerns=[],
    )


@pytest.fixture
def failing_review():
    """Create a failing code review."""
    from src.workers.agents.development.models import ReviewIssue, IssueSeverity

    return CodeReview(
        implementation_id="test-task",
        passed=False,
        issues=[
            ReviewIssue(
                id="ISSUE-001",
                description="Missing error handling",
                severity=IssueSeverity.HIGH,
                file_path="src/feature.py",
                line_number=5,
                suggestion="Add try-except block",
            )
        ],
        suggestions=[],
        security_concerns=[],
    )


class TestTDDOrchestratorCreation:
    """Tests for TDDOrchestrator creation."""

    def test_creates_orchestrator_with_all_agents(
        self,
        mock_utest_agent,
        mock_coding_agent,
        mock_debugger_agent,
        mock_reviewer_agent,
        mock_test_runner,
        config,
    ) -> None:
        """Test that TDDOrchestrator can be created with all agents."""
        from src.workers.agents.development.tdd_orchestrator import TDDOrchestrator

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent,
            coding_agent=mock_coding_agent,
            debugger_agent=mock_debugger_agent,
            reviewer_agent=mock_reviewer_agent,
            test_runner=mock_test_runner,
            config=config,
        )

        assert orchestrator is not None
        assert orchestrator._config.max_coding_retries == 4

    def test_creates_orchestrator_with_default_config(
        self,
        mock_utest_agent,
        mock_coding_agent,
        mock_debugger_agent,
        mock_reviewer_agent,
        mock_test_runner,
    ) -> None:
        """Test that TDDOrchestrator uses default config when not provided."""
        from src.workers.agents.development.tdd_orchestrator import TDDOrchestrator

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent,
            coding_agent=mock_coding_agent,
            debugger_agent=mock_debugger_agent,
            reviewer_agent=mock_reviewer_agent,
            test_runner=mock_test_runner,
        )

        assert orchestrator._config is not None


class TestTDDOrchestratorBasicLoop:
    """Tests for TDDOrchestrator basic TDD loop."""

    @pytest.mark.asyncio
    async def test_run_tdd_loop_calls_utest_first(
        self,
        mock_utest_agent,
        mock_coding_agent,
        mock_debugger_agent,
        mock_reviewer_agent,
        mock_test_runner,
        agent_context,
        config,
        sample_test_suite,
        sample_implementation,
        passing_test_result,
        passing_review,
    ) -> None:
        """Test that run_tdd_loop calls UTest agent first."""
        from src.workers.agents.development.tdd_orchestrator import TDDOrchestrator

        # Configure mock responses
        mock_utest_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="utest",
            task_id="test-task",
            metadata={"test_suite": sample_test_suite.to_dict()},
        )
        mock_coding_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="coding",
            task_id="test-task",
            metadata={"implementation": sample_implementation.to_dict()},
        )
        mock_test_runner.run_tests.return_value = passing_test_result
        mock_reviewer_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="reviewer",
            task_id="test-task",
            metadata={"passed": True, "review": passing_review.to_dict()},
        )

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent,
            coding_agent=mock_coding_agent,
            debugger_agent=mock_debugger_agent,
            reviewer_agent=mock_reviewer_agent,
            test_runner=mock_test_runner,
            config=config,
        )

        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature should work"],
        )

        mock_utest_agent.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_run_tdd_loop_calls_coding_after_utest(
        self,
        mock_utest_agent,
        mock_coding_agent,
        mock_debugger_agent,
        mock_reviewer_agent,
        mock_test_runner,
        agent_context,
        config,
        sample_test_suite,
        sample_implementation,
        passing_test_result,
        passing_review,
    ) -> None:
        """Test that run_tdd_loop calls Coding agent after UTest."""
        from src.workers.agents.development.tdd_orchestrator import TDDOrchestrator

        mock_utest_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="utest",
            task_id="test-task",
            metadata={"test_suite": sample_test_suite.to_dict()},
        )
        mock_coding_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="coding",
            task_id="test-task",
            metadata={"implementation": sample_implementation.to_dict()},
        )
        mock_test_runner.run_tests.return_value = passing_test_result
        mock_reviewer_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="reviewer",
            task_id="test-task",
            metadata={"passed": True, "review": passing_review.to_dict()},
        )

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent,
            coding_agent=mock_coding_agent,
            debugger_agent=mock_debugger_agent,
            reviewer_agent=mock_reviewer_agent,
            test_runner=mock_test_runner,
            config=config,
        )

        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature should work"],
        )

        mock_coding_agent.execute.assert_called()

    @pytest.mark.asyncio
    async def test_run_tdd_loop_runs_tests_after_coding(
        self,
        mock_utest_agent,
        mock_coding_agent,
        mock_debugger_agent,
        mock_reviewer_agent,
        mock_test_runner,
        agent_context,
        config,
        sample_test_suite,
        sample_implementation,
        passing_test_result,
        passing_review,
    ) -> None:
        """Test that run_tdd_loop runs tests after Coding agent."""
        from src.workers.agents.development.tdd_orchestrator import TDDOrchestrator

        mock_utest_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="utest",
            task_id="test-task",
            metadata={"test_suite": sample_test_suite.to_dict()},
        )
        mock_coding_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="coding",
            task_id="test-task",
            metadata={"implementation": sample_implementation.to_dict()},
        )
        mock_test_runner.run_tests.return_value = passing_test_result
        mock_reviewer_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="reviewer",
            task_id="test-task",
            metadata={"passed": True, "review": passing_review.to_dict()},
        )

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent,
            coding_agent=mock_coding_agent,
            debugger_agent=mock_debugger_agent,
            reviewer_agent=mock_reviewer_agent,
            test_runner=mock_test_runner,
            config=config,
        )

        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature should work"],
        )

        mock_test_runner.run_tests.assert_called()

    @pytest.mark.asyncio
    async def test_run_tdd_loop_calls_reviewer_when_tests_pass(
        self,
        mock_utest_agent,
        mock_coding_agent,
        mock_debugger_agent,
        mock_reviewer_agent,
        mock_test_runner,
        agent_context,
        config,
        sample_test_suite,
        sample_implementation,
        passing_test_result,
        passing_review,
    ) -> None:
        """Test that run_tdd_loop calls Reviewer when tests pass."""
        from src.workers.agents.development.tdd_orchestrator import TDDOrchestrator

        mock_utest_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="utest",
            task_id="test-task",
            metadata={"test_suite": sample_test_suite.to_dict()},
        )
        mock_coding_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="coding",
            task_id="test-task",
            metadata={"implementation": sample_implementation.to_dict()},
        )
        mock_test_runner.run_tests.return_value = passing_test_result
        mock_reviewer_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="reviewer",
            task_id="test-task",
            metadata={"passed": True, "review": passing_review.to_dict()},
        )

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent,
            coding_agent=mock_coding_agent,
            debugger_agent=mock_debugger_agent,
            reviewer_agent=mock_reviewer_agent,
            test_runner=mock_test_runner,
            config=config,
        )

        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature should work"],
        )

        mock_reviewer_agent.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_run_tdd_loop_returns_success_on_happy_path(
        self,
        mock_utest_agent,
        mock_coding_agent,
        mock_debugger_agent,
        mock_reviewer_agent,
        mock_test_runner,
        agent_context,
        config,
        sample_test_suite,
        sample_implementation,
        passing_test_result,
        passing_review,
    ) -> None:
        """Test that run_tdd_loop returns success on happy path."""
        from src.workers.agents.development.tdd_orchestrator import TDDOrchestrator

        mock_utest_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="utest",
            task_id="test-task",
            metadata={"test_suite": sample_test_suite.to_dict()},
        )
        mock_coding_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="coding",
            task_id="test-task",
            metadata={"implementation": sample_implementation.to_dict()},
        )
        mock_test_runner.run_tests.return_value = passing_test_result
        mock_reviewer_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="reviewer",
            task_id="test-task",
            metadata={"passed": True, "review": passing_review.to_dict()},
        )

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent,
            coding_agent=mock_coding_agent,
            debugger_agent=mock_debugger_agent,
            reviewer_agent=mock_reviewer_agent,
            test_runner=mock_test_runner,
            config=config,
        )

        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature should work"],
        )

        assert result.success is True


class TestTDDOrchestratorRetryLogic:
    """Tests for TDDOrchestrator retry logic."""

    @pytest.mark.asyncio
    async def test_retries_coding_when_tests_fail(
        self,
        mock_utest_agent,
        mock_coding_agent,
        mock_debugger_agent,
        mock_reviewer_agent,
        mock_test_runner,
        agent_context,
        config,
        sample_test_suite,
        sample_implementation,
        failing_test_result,
        passing_test_result,
        passing_review,
    ) -> None:
        """Test that coding is retried when tests fail."""
        from src.workers.agents.development.tdd_orchestrator import TDDOrchestrator

        mock_utest_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="utest",
            task_id="test-task",
            metadata={"test_suite": sample_test_suite.to_dict()},
        )
        mock_coding_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="coding",
            task_id="test-task",
            metadata={"implementation": sample_implementation.to_dict()},
        )
        # First call fails, second call passes
        mock_test_runner.run_tests.side_effect = [
            failing_test_result,
            passing_test_result,
        ]
        mock_reviewer_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="reviewer",
            task_id="test-task",
            metadata={"passed": True, "review": passing_review.to_dict()},
        )

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent,
            coding_agent=mock_coding_agent,
            debugger_agent=mock_debugger_agent,
            reviewer_agent=mock_reviewer_agent,
            test_runner=mock_test_runner,
            config=config,
        )

        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature should work"],
        )

        # Coding should be called twice (initial + retry)
        assert mock_coding_agent.execute.call_count == 2
        assert result.success is True

    @pytest.mark.asyncio
    async def test_increments_fail_count_on_each_retry(
        self,
        mock_utest_agent,
        mock_coding_agent,
        mock_debugger_agent,
        mock_reviewer_agent,
        mock_test_runner,
        agent_context,
        config,
        sample_test_suite,
        sample_implementation,
        failing_test_result,
        passing_test_result,
        passing_review,
    ) -> None:
        """Test that fail_count is incremented on each retry."""
        from src.workers.agents.development.tdd_orchestrator import TDDOrchestrator

        mock_utest_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="utest",
            task_id="test-task",
            metadata={"test_suite": sample_test_suite.to_dict()},
        )
        mock_coding_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="coding",
            task_id="test-task",
            metadata={"implementation": sample_implementation.to_dict()},
        )
        # Fail twice then pass
        mock_test_runner.run_tests.side_effect = [
            failing_test_result,
            failing_test_result,
            passing_test_result,
        ]
        mock_reviewer_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="reviewer",
            task_id="test-task",
            metadata={"passed": True, "review": passing_review.to_dict()},
        )

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent,
            coding_agent=mock_coding_agent,
            debugger_agent=mock_debugger_agent,
            reviewer_agent=mock_reviewer_agent,
            test_runner=mock_test_runner,
            config=config,
        )

        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature should work"],
        )

        # Check that fail_count was passed correctly to coding agent
        calls = mock_coding_agent.execute.call_args_list
        assert len(calls) == 3
        # First call: fail_count=0
        assert calls[0][1]["event_metadata"].get("fail_count", 0) == 0
        # Second call: fail_count=1
        assert calls[1][1]["event_metadata"].get("fail_count", 0) == 1
        # Third call: fail_count=2
        assert calls[2][1]["event_metadata"].get("fail_count", 0) == 2

    @pytest.mark.asyncio
    async def test_passes_test_errors_to_coding_on_retry(
        self,
        mock_utest_agent,
        mock_coding_agent,
        mock_debugger_agent,
        mock_reviewer_agent,
        mock_test_runner,
        agent_context,
        config,
        sample_test_suite,
        sample_implementation,
        failing_test_result,
        passing_test_result,
        passing_review,
    ) -> None:
        """Test that test errors are passed to coding on retry."""
        from src.workers.agents.development.tdd_orchestrator import TDDOrchestrator

        mock_utest_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="utest",
            task_id="test-task",
            metadata={"test_suite": sample_test_suite.to_dict()},
        )
        mock_coding_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="coding",
            task_id="test-task",
            metadata={"implementation": sample_implementation.to_dict()},
        )
        mock_test_runner.run_tests.side_effect = [
            failing_test_result,
            passing_test_result,
        ]
        mock_reviewer_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="reviewer",
            task_id="test-task",
            metadata={"passed": True, "review": passing_review.to_dict()},
        )

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent,
            coding_agent=mock_coding_agent,
            debugger_agent=mock_debugger_agent,
            reviewer_agent=mock_reviewer_agent,
            test_runner=mock_test_runner,
            config=config,
        )

        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature should work"],
        )

        # Check that test_errors was passed on retry
        calls = mock_coding_agent.execute.call_args_list
        retry_call = calls[1]
        test_errors = retry_call[1]["event_metadata"].get("test_errors", [])
        assert len(test_errors) > 0
        assert "AssertionError" in test_errors[0]


class TestTDDOrchestratorDebuggerEscalation:
    """Tests for TDDOrchestrator debugger escalation."""

    @pytest.mark.asyncio
    async def test_escalates_to_debugger_after_max_retries(
        self,
        mock_utest_agent,
        mock_coding_agent,
        mock_debugger_agent,
        mock_reviewer_agent,
        mock_test_runner,
        agent_context,
        sample_test_suite,
        sample_implementation,
        failing_test_result,
        passing_test_result,
        passing_review,
    ) -> None:
        """Test that debugger is called after max retries exceeded."""
        from src.workers.agents.development.tdd_orchestrator import TDDOrchestrator
        from src.workers.agents.development.models import CodeChange

        # Configure with max_coding_retries=2
        config = DevelopmentConfig(max_coding_retries=2)

        mock_utest_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="utest",
            task_id="test-task",
            metadata={"test_suite": sample_test_suite.to_dict()},
        )
        mock_coding_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="coding",
            task_id="test-task",
            metadata={"implementation": sample_implementation.to_dict()},
        )
        # Fail 3 times to exceed max_coding_retries=2, then pass after debug
        mock_test_runner.run_tests.side_effect = [
            failing_test_result,
            failing_test_result,
            failing_test_result,
            passing_test_result,
        ]

        debug_analysis = DebugAnalysis(
            failure_id="test-failure",
            root_cause="Missing return statement",
            fix_suggestion="Add return statement",
            code_changes=[
                CodeChange(
                    file_path="src/feature.py",
                    original_code="def feature(): pass",
                    new_code="def feature(): return True",
                    description="Add return",
                    line_start=1,
                    line_end=1,
                )
            ],
        )
        mock_debugger_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="debugger",
            task_id="test-task",
            metadata={"debug_analysis": debug_analysis.to_dict()},
        )
        mock_reviewer_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="reviewer",
            task_id="test-task",
            metadata={"passed": True, "review": passing_review.to_dict()},
        )

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent,
            coding_agent=mock_coding_agent,
            debugger_agent=mock_debugger_agent,
            reviewer_agent=mock_reviewer_agent,
            test_runner=mock_test_runner,
            config=config,
        )

        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature should work"],
        )

        mock_debugger_agent.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_passes_debug_analysis_to_coding_after_debugger(
        self,
        mock_utest_agent,
        mock_coding_agent,
        mock_debugger_agent,
        mock_reviewer_agent,
        mock_test_runner,
        agent_context,
        sample_test_suite,
        sample_implementation,
        failing_test_result,
        passing_test_result,
        passing_review,
    ) -> None:
        """Test that debug analysis is passed to coding after debugger runs."""
        from src.workers.agents.development.tdd_orchestrator import TDDOrchestrator
        from src.workers.agents.development.models import CodeChange

        config = DevelopmentConfig(max_coding_retries=1)

        mock_utest_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="utest",
            task_id="test-task",
            metadata={"test_suite": sample_test_suite.to_dict()},
        )
        mock_coding_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="coding",
            task_id="test-task",
            metadata={"implementation": sample_implementation.to_dict()},
        )
        mock_test_runner.run_tests.side_effect = [
            failing_test_result,
            failing_test_result,
            passing_test_result,
        ]

        debug_analysis = DebugAnalysis(
            failure_id="test-failure",
            root_cause="Missing return statement",
            fix_suggestion="Add return statement",
            code_changes=[
                CodeChange(
                    file_path="src/feature.py",
                    original_code="def feature(): pass",
                    new_code="def feature(): return True",
                    description="Add return",
                    line_start=1,
                    line_end=1,
                )
            ],
        )
        mock_debugger_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="debugger",
            task_id="test-task",
            metadata={"debug_analysis": debug_analysis.to_dict()},
        )
        mock_reviewer_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="reviewer",
            task_id="test-task",
            metadata={"passed": True, "review": passing_review.to_dict()},
        )

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent,
            coding_agent=mock_coding_agent,
            debugger_agent=mock_debugger_agent,
            reviewer_agent=mock_reviewer_agent,
            test_runner=mock_test_runner,
            config=config,
        )

        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature should work"],
        )

        # Find the coding call after debugger was invoked
        calls = mock_coding_agent.execute.call_args_list
        # The call after debugger should have debug_analysis
        post_debug_call = calls[-1]
        debug_analysis_passed = post_debug_call[1]["event_metadata"].get("debug_analysis")
        assert debug_analysis_passed is not None
        assert "Missing return" in debug_analysis_passed.get("root_cause", "")


class TestTDDOrchestratorReviewRetry:
    """Tests for TDDOrchestrator review retry logic."""

    @pytest.mark.asyncio
    async def test_retries_coding_when_review_fails(
        self,
        mock_utest_agent,
        mock_coding_agent,
        mock_debugger_agent,
        mock_reviewer_agent,
        mock_test_runner,
        agent_context,
        config,
        sample_test_suite,
        sample_implementation,
        passing_test_result,
        failing_review,
        passing_review,
    ) -> None:
        """Test that coding is retried when review fails."""
        from src.workers.agents.development.tdd_orchestrator import TDDOrchestrator

        mock_utest_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="utest",
            task_id="test-task",
            metadata={"test_suite": sample_test_suite.to_dict()},
        )
        mock_coding_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="coding",
            task_id="test-task",
            metadata={"implementation": sample_implementation.to_dict()},
        )
        mock_test_runner.run_tests.return_value = passing_test_result
        # First review fails, second passes
        mock_reviewer_agent.execute.side_effect = [
            AgentResult(
                success=True,
                agent_type="reviewer",
                task_id="test-task",
                metadata={"passed": False, "review": failing_review.to_dict()},
            ),
            AgentResult(
                success=True,
                agent_type="reviewer",
                task_id="test-task",
                metadata={"passed": True, "review": passing_review.to_dict()},
            ),
        ]

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent,
            coding_agent=mock_coding_agent,
            debugger_agent=mock_debugger_agent,
            reviewer_agent=mock_reviewer_agent,
            test_runner=mock_test_runner,
            config=config,
        )

        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature should work"],
        )

        # Coding should be called twice
        assert mock_coding_agent.execute.call_count == 2
        assert result.success is True


class TestTDDOrchestratorErrorHandling:
    """Tests for TDDOrchestrator error handling."""

    @pytest.mark.asyncio
    async def test_returns_failure_when_utest_fails(
        self,
        mock_utest_agent,
        mock_coding_agent,
        mock_debugger_agent,
        mock_reviewer_agent,
        mock_test_runner,
        agent_context,
        config,
    ) -> None:
        """Test that failure is returned when UTest agent fails."""
        from src.workers.agents.development.tdd_orchestrator import TDDOrchestrator

        mock_utest_agent.execute.return_value = AgentResult(
            success=False,
            agent_type="utest",
            task_id="test-task",
            error_message="Failed to generate tests",
        )

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent,
            coding_agent=mock_coding_agent,
            debugger_agent=mock_debugger_agent,
            reviewer_agent=mock_reviewer_agent,
            test_runner=mock_test_runner,
            config=config,
        )

        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature should work"],
        )

        assert result.success is False
        assert "Failed to generate tests" in result.error_message

    @pytest.mark.asyncio
    async def test_returns_failure_when_coding_fails(
        self,
        mock_utest_agent,
        mock_coding_agent,
        mock_debugger_agent,
        mock_reviewer_agent,
        mock_test_runner,
        agent_context,
        config,
        sample_test_suite,
    ) -> None:
        """Test that failure is returned when Coding agent fails."""
        from src.workers.agents.development.tdd_orchestrator import TDDOrchestrator

        mock_utest_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="utest",
            task_id="test-task",
            metadata={"test_suite": sample_test_suite.to_dict()},
        )
        mock_coding_agent.execute.return_value = AgentResult(
            success=False,
            agent_type="coding",
            task_id="test-task",
            error_message="Failed to generate implementation",
        )

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent,
            coding_agent=mock_coding_agent,
            debugger_agent=mock_debugger_agent,
            reviewer_agent=mock_reviewer_agent,
            test_runner=mock_test_runner,
            config=config,
        )

        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature should work"],
        )

        assert result.success is False
        assert "Failed to generate implementation" in result.error_message

    @pytest.mark.asyncio
    async def test_handles_test_runner_exception(
        self,
        mock_utest_agent,
        mock_coding_agent,
        mock_debugger_agent,
        mock_reviewer_agent,
        mock_test_runner,
        agent_context,
        config,
        sample_test_suite,
        sample_implementation,
    ) -> None:
        """Test that test runner exceptions are handled."""
        from src.workers.agents.development.tdd_orchestrator import TDDOrchestrator
        from src.workers.agents.development.test_runner import TestTimeoutError

        mock_utest_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="utest",
            task_id="test-task",
            metadata={"test_suite": sample_test_suite.to_dict()},
        )
        mock_coding_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="coding",
            task_id="test-task",
            metadata={"implementation": sample_implementation.to_dict()},
        )
        mock_test_runner.run_tests.side_effect = TestTimeoutError("Test timed out")

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent,
            coding_agent=mock_coding_agent,
            debugger_agent=mock_debugger_agent,
            reviewer_agent=mock_reviewer_agent,
            test_runner=mock_test_runner,
            config=config,
        )

        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature should work"],
        )

        assert result.success is False
        assert "timed out" in result.error_message.lower() or "timeout" in result.error_message.lower()


class TestTDDOrchestratorResult:
    """Tests for TDDOrchestrator result."""

    @pytest.mark.asyncio
    async def test_result_includes_implementation(
        self,
        mock_utest_agent,
        mock_coding_agent,
        mock_debugger_agent,
        mock_reviewer_agent,
        mock_test_runner,
        agent_context,
        config,
        sample_test_suite,
        sample_implementation,
        passing_test_result,
        passing_review,
    ) -> None:
        """Test that result includes implementation."""
        from src.workers.agents.development.tdd_orchestrator import TDDOrchestrator

        mock_utest_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="utest",
            task_id="test-task",
            metadata={"test_suite": sample_test_suite.to_dict()},
        )
        mock_coding_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="coding",
            task_id="test-task",
            metadata={"implementation": sample_implementation.to_dict()},
        )
        mock_test_runner.run_tests.return_value = passing_test_result
        mock_reviewer_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="reviewer",
            task_id="test-task",
            metadata={"passed": True, "review": passing_review.to_dict()},
        )

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent,
            coding_agent=mock_coding_agent,
            debugger_agent=mock_debugger_agent,
            reviewer_agent=mock_reviewer_agent,
            test_runner=mock_test_runner,
            config=config,
        )

        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature should work"],
        )

        assert result.implementation is not None
        assert len(result.implementation.files) > 0

    @pytest.mark.asyncio
    async def test_result_includes_test_suite(
        self,
        mock_utest_agent,
        mock_coding_agent,
        mock_debugger_agent,
        mock_reviewer_agent,
        mock_test_runner,
        agent_context,
        config,
        sample_test_suite,
        sample_implementation,
        passing_test_result,
        passing_review,
    ) -> None:
        """Test that result includes test suite."""
        from src.workers.agents.development.tdd_orchestrator import TDDOrchestrator

        mock_utest_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="utest",
            task_id="test-task",
            metadata={"test_suite": sample_test_suite.to_dict()},
        )
        mock_coding_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="coding",
            task_id="test-task",
            metadata={"implementation": sample_implementation.to_dict()},
        )
        mock_test_runner.run_tests.return_value = passing_test_result
        mock_reviewer_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="reviewer",
            task_id="test-task",
            metadata={"passed": True, "review": passing_review.to_dict()},
        )

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent,
            coding_agent=mock_coding_agent,
            debugger_agent=mock_debugger_agent,
            reviewer_agent=mock_reviewer_agent,
            test_runner=mock_test_runner,
            config=config,
        )

        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature should work"],
        )

        assert result.test_suite is not None
        assert len(result.test_suite.test_cases) > 0

    @pytest.mark.asyncio
    async def test_result_includes_test_result(
        self,
        mock_utest_agent,
        mock_coding_agent,
        mock_debugger_agent,
        mock_reviewer_agent,
        mock_test_runner,
        agent_context,
        config,
        sample_test_suite,
        sample_implementation,
        passing_test_result,
        passing_review,
    ) -> None:
        """Test that result includes test result."""
        from src.workers.agents.development.tdd_orchestrator import TDDOrchestrator

        mock_utest_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="utest",
            task_id="test-task",
            metadata={"test_suite": sample_test_suite.to_dict()},
        )
        mock_coding_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="coding",
            task_id="test-task",
            metadata={"implementation": sample_implementation.to_dict()},
        )
        mock_test_runner.run_tests.return_value = passing_test_result
        mock_reviewer_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="reviewer",
            task_id="test-task",
            metadata={"passed": True, "review": passing_review.to_dict()},
        )

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent,
            coding_agent=mock_coding_agent,
            debugger_agent=mock_debugger_agent,
            reviewer_agent=mock_reviewer_agent,
            test_runner=mock_test_runner,
            config=config,
        )

        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature should work"],
        )

        assert result.test_result is not None
        assert result.test_result.all_passed() is True

    @pytest.mark.asyncio
    async def test_result_includes_review(
        self,
        mock_utest_agent,
        mock_coding_agent,
        mock_debugger_agent,
        mock_reviewer_agent,
        mock_test_runner,
        agent_context,
        config,
        sample_test_suite,
        sample_implementation,
        passing_test_result,
        passing_review,
    ) -> None:
        """Test that result includes review."""
        from src.workers.agents.development.tdd_orchestrator import TDDOrchestrator

        mock_utest_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="utest",
            task_id="test-task",
            metadata={"test_suite": sample_test_suite.to_dict()},
        )
        mock_coding_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="coding",
            task_id="test-task",
            metadata={"implementation": sample_implementation.to_dict()},
        )
        mock_test_runner.run_tests.return_value = passing_test_result
        mock_reviewer_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="reviewer",
            task_id="test-task",
            metadata={"passed": True, "review": passing_review.to_dict()},
        )

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent,
            coding_agent=mock_coding_agent,
            debugger_agent=mock_debugger_agent,
            reviewer_agent=mock_reviewer_agent,
            test_runner=mock_test_runner,
            config=config,
        )

        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature should work"],
        )

        assert result.review is not None
        assert result.review.passed is True

    @pytest.mark.asyncio
    async def test_result_includes_retry_count(
        self,
        mock_utest_agent,
        mock_coding_agent,
        mock_debugger_agent,
        mock_reviewer_agent,
        mock_test_runner,
        agent_context,
        config,
        sample_test_suite,
        sample_implementation,
        failing_test_result,
        passing_test_result,
        passing_review,
    ) -> None:
        """Test that result includes retry count."""
        from src.workers.agents.development.tdd_orchestrator import TDDOrchestrator

        mock_utest_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="utest",
            task_id="test-task",
            metadata={"test_suite": sample_test_suite.to_dict()},
        )
        mock_coding_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="coding",
            task_id="test-task",
            metadata={"implementation": sample_implementation.to_dict()},
        )
        mock_test_runner.run_tests.side_effect = [
            failing_test_result,
            failing_test_result,
            passing_test_result,
        ]
        mock_reviewer_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="reviewer",
            task_id="test-task",
            metadata={"passed": True, "review": passing_review.to_dict()},
        )

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent,
            coding_agent=mock_coding_agent,
            debugger_agent=mock_debugger_agent,
            reviewer_agent=mock_reviewer_agent,
            test_runner=mock_test_runner,
            config=config,
        )

        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature should work"],
        )

        assert result.retry_count == 2  # Failed twice before passing


class TestHITL4EvidenceBundle:
    """Tests for HITL-4 evidence bundle creation and submission."""

    @pytest.fixture
    def mock_hitl_dispatcher(self):
        """Create a mock HITLDispatcher."""
        dispatcher = MagicMock()
        dispatcher.request_gate = AsyncMock()
        return dispatcher

    @pytest.mark.asyncio
    async def test_builds_evidence_bundle_from_development_result(
        self,
        mock_utest_agent,
        mock_coding_agent,
        mock_debugger_agent,
        mock_reviewer_agent,
        mock_test_runner,
        mock_hitl_dispatcher,
        agent_context,
        config,
        sample_test_suite,
        sample_implementation,
        passing_test_result,
        passing_review,
    ) -> None:
        """Test that evidence bundle is built from DevelopmentResult."""
        from src.workers.agents.development.tdd_orchestrator import TDDOrchestrator
        from src.orchestrator.evidence_bundle import EvidenceBundle, GateType

        mock_utest_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="utest",
            task_id="test-task",
            metadata={"test_suite": sample_test_suite.to_dict()},
        )
        mock_coding_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="coding",
            task_id="test-task",
            metadata={"implementation": sample_implementation.to_dict()},
        )
        mock_test_runner.run_tests.return_value = passing_test_result
        mock_reviewer_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="reviewer",
            task_id="test-task",
            metadata={"passed": True, "review": passing_review.to_dict()},
        )

        # Mock gate request response
        from src.orchestrator.hitl_dispatcher import GateRequest, GateStatus
        from datetime import datetime, timezone

        mock_gate_request = GateRequest(
            request_id="test-request-id",
            task_id="test-task",
            session_id="test-session",
            gate_type=GateType.HITL_4_CODE,
            status=GateStatus.PENDING,
            evidence_bundle=MagicMock(),
            requested_by="tdd_orchestrator",
            requested_at=datetime.now(timezone.utc),
        )
        mock_hitl_dispatcher.request_gate.return_value = mock_gate_request

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent,
            coding_agent=mock_coding_agent,
            debugger_agent=mock_debugger_agent,
            reviewer_agent=mock_reviewer_agent,
            test_runner=mock_test_runner,
            config=config,
            hitl_dispatcher=mock_hitl_dispatcher,
        )

        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature should work"],
        )

        # Verify HITL dispatcher was called
        mock_hitl_dispatcher.request_gate.assert_called_once()

        # Verify evidence bundle structure
        call_kwargs = mock_hitl_dispatcher.request_gate.call_args[1]
        evidence_bundle = call_kwargs["evidence_bundle"]

        assert evidence_bundle.gate_type == GateType.HITL_4_CODE
        assert evidence_bundle.task_id == "test-task"

        # Verify evidence items include required types
        item_types = {item.item_type for item in evidence_bundle.items}
        assert "artifact" in item_types  # Implementation
        assert "test_result" in item_types  # Test results

    @pytest.mark.asyncio
    async def test_evidence_bundle_includes_implementation(
        self,
        mock_utest_agent,
        mock_coding_agent,
        mock_debugger_agent,
        mock_reviewer_agent,
        mock_test_runner,
        mock_hitl_dispatcher,
        agent_context,
        config,
        sample_test_suite,
        sample_implementation,
        passing_test_result,
        passing_review,
    ) -> None:
        """Test that evidence bundle includes implementation code."""
        from src.workers.agents.development.tdd_orchestrator import TDDOrchestrator
        from src.orchestrator.evidence_bundle import GateType
        from src.orchestrator.hitl_dispatcher import GateRequest, GateStatus
        from datetime import datetime, timezone

        mock_utest_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="utest",
            task_id="test-task",
            metadata={"test_suite": sample_test_suite.to_dict()},
        )
        mock_coding_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="coding",
            task_id="test-task",
            metadata={"implementation": sample_implementation.to_dict()},
        )
        mock_test_runner.run_tests.return_value = passing_test_result
        mock_reviewer_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="reviewer",
            task_id="test-task",
            metadata={"passed": True, "review": passing_review.to_dict()},
        )

        mock_gate_request = GateRequest(
            request_id="test-request-id",
            task_id="test-task",
            session_id="test-session",
            gate_type=GateType.HITL_4_CODE,
            status=GateStatus.PENDING,
            evidence_bundle=MagicMock(),
            requested_by="tdd_orchestrator",
            requested_at=datetime.now(timezone.utc),
        )
        mock_hitl_dispatcher.request_gate.return_value = mock_gate_request

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent,
            coding_agent=mock_coding_agent,
            debugger_agent=mock_debugger_agent,
            reviewer_agent=mock_reviewer_agent,
            test_runner=mock_test_runner,
            config=config,
            hitl_dispatcher=mock_hitl_dispatcher,
        )

        await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature should work"],
        )

        call_kwargs = mock_hitl_dispatcher.request_gate.call_args[1]
        evidence_bundle = call_kwargs["evidence_bundle"]

        # Find artifact item and verify it contains implementation details
        artifact_items = [i for i in evidence_bundle.items if i.item_type == "artifact"]
        assert len(artifact_items) > 0
        assert "src/feature.py" in artifact_items[0].metadata.get("files", [])

    @pytest.mark.asyncio
    async def test_evidence_bundle_includes_test_suite(
        self,
        mock_utest_agent,
        mock_coding_agent,
        mock_debugger_agent,
        mock_reviewer_agent,
        mock_test_runner,
        mock_hitl_dispatcher,
        agent_context,
        config,
        sample_test_suite,
        sample_implementation,
        passing_test_result,
        passing_review,
    ) -> None:
        """Test that evidence bundle includes test suite."""
        from src.workers.agents.development.tdd_orchestrator import TDDOrchestrator
        from src.orchestrator.evidence_bundle import GateType
        from src.orchestrator.hitl_dispatcher import GateRequest, GateStatus
        from datetime import datetime, timezone

        mock_utest_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="utest",
            task_id="test-task",
            metadata={"test_suite": sample_test_suite.to_dict()},
        )
        mock_coding_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="coding",
            task_id="test-task",
            metadata={"implementation": sample_implementation.to_dict()},
        )
        mock_test_runner.run_tests.return_value = passing_test_result
        mock_reviewer_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="reviewer",
            task_id="test-task",
            metadata={"passed": True, "review": passing_review.to_dict()},
        )

        mock_gate_request = GateRequest(
            request_id="test-request-id",
            task_id="test-task",
            session_id="test-session",
            gate_type=GateType.HITL_4_CODE,
            status=GateStatus.PENDING,
            evidence_bundle=MagicMock(),
            requested_by="tdd_orchestrator",
            requested_at=datetime.now(timezone.utc),
        )
        mock_hitl_dispatcher.request_gate.return_value = mock_gate_request

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent,
            coding_agent=mock_coding_agent,
            debugger_agent=mock_debugger_agent,
            reviewer_agent=mock_reviewer_agent,
            test_runner=mock_test_runner,
            config=config,
            hitl_dispatcher=mock_hitl_dispatcher,
        )

        await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature should work"],
        )

        call_kwargs = mock_hitl_dispatcher.request_gate.call_args[1]
        evidence_bundle = call_kwargs["evidence_bundle"]

        # Find test_suite item
        test_suite_items = [i for i in evidence_bundle.items if i.item_type == "test_suite"]
        assert len(test_suite_items) > 0
        assert test_suite_items[0].metadata.get("test_count") == 1

    @pytest.mark.asyncio
    async def test_evidence_bundle_includes_test_results(
        self,
        mock_utest_agent,
        mock_coding_agent,
        mock_debugger_agent,
        mock_reviewer_agent,
        mock_test_runner,
        mock_hitl_dispatcher,
        agent_context,
        config,
        sample_test_suite,
        sample_implementation,
        passing_test_result,
        passing_review,
    ) -> None:
        """Test that evidence bundle includes test results."""
        from src.workers.agents.development.tdd_orchestrator import TDDOrchestrator
        from src.orchestrator.evidence_bundle import GateType
        from src.orchestrator.hitl_dispatcher import GateRequest, GateStatus
        from datetime import datetime, timezone

        mock_utest_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="utest",
            task_id="test-task",
            metadata={"test_suite": sample_test_suite.to_dict()},
        )
        mock_coding_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="coding",
            task_id="test-task",
            metadata={"implementation": sample_implementation.to_dict()},
        )
        mock_test_runner.run_tests.return_value = passing_test_result
        mock_reviewer_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="reviewer",
            task_id="test-task",
            metadata={"passed": True, "review": passing_review.to_dict()},
        )

        mock_gate_request = GateRequest(
            request_id="test-request-id",
            task_id="test-task",
            session_id="test-session",
            gate_type=GateType.HITL_4_CODE,
            status=GateStatus.PENDING,
            evidence_bundle=MagicMock(),
            requested_by="tdd_orchestrator",
            requested_at=datetime.now(timezone.utc),
        )
        mock_hitl_dispatcher.request_gate.return_value = mock_gate_request

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent,
            coding_agent=mock_coding_agent,
            debugger_agent=mock_debugger_agent,
            reviewer_agent=mock_reviewer_agent,
            test_runner=mock_test_runner,
            config=config,
            hitl_dispatcher=mock_hitl_dispatcher,
        )

        await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature should work"],
        )

        call_kwargs = mock_hitl_dispatcher.request_gate.call_args[1]
        evidence_bundle = call_kwargs["evidence_bundle"]

        # Find test_result item
        test_result_items = [i for i in evidence_bundle.items if i.item_type == "test_result"]
        assert len(test_result_items) > 0
        assert test_result_items[0].metadata.get("passed") == 1
        assert test_result_items[0].metadata.get("failed") == 0

    @pytest.mark.asyncio
    async def test_evidence_bundle_includes_review_summary(
        self,
        mock_utest_agent,
        mock_coding_agent,
        mock_debugger_agent,
        mock_reviewer_agent,
        mock_test_runner,
        mock_hitl_dispatcher,
        agent_context,
        config,
        sample_test_suite,
        sample_implementation,
        passing_test_result,
        passing_review,
    ) -> None:
        """Test that evidence bundle includes review summary."""
        from src.workers.agents.development.tdd_orchestrator import TDDOrchestrator
        from src.orchestrator.evidence_bundle import GateType
        from src.orchestrator.hitl_dispatcher import GateRequest, GateStatus
        from datetime import datetime, timezone

        mock_utest_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="utest",
            task_id="test-task",
            metadata={"test_suite": sample_test_suite.to_dict()},
        )
        mock_coding_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="coding",
            task_id="test-task",
            metadata={"implementation": sample_implementation.to_dict()},
        )
        mock_test_runner.run_tests.return_value = passing_test_result
        mock_reviewer_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="reviewer",
            task_id="test-task",
            metadata={"passed": True, "review": passing_review.to_dict()},
        )

        mock_gate_request = GateRequest(
            request_id="test-request-id",
            task_id="test-task",
            session_id="test-session",
            gate_type=GateType.HITL_4_CODE,
            status=GateStatus.PENDING,
            evidence_bundle=MagicMock(),
            requested_by="tdd_orchestrator",
            requested_at=datetime.now(timezone.utc),
        )
        mock_hitl_dispatcher.request_gate.return_value = mock_gate_request

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent,
            coding_agent=mock_coding_agent,
            debugger_agent=mock_debugger_agent,
            reviewer_agent=mock_reviewer_agent,
            test_runner=mock_test_runner,
            config=config,
            hitl_dispatcher=mock_hitl_dispatcher,
        )

        await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature should work"],
        )

        call_kwargs = mock_hitl_dispatcher.request_gate.call_args[1]
        evidence_bundle = call_kwargs["evidence_bundle"]

        # Find review item
        review_items = [i for i in evidence_bundle.items if i.item_type == "review"]
        assert len(review_items) > 0
        assert review_items[0].metadata.get("passed") is True

    @pytest.mark.asyncio
    async def test_evidence_bundle_includes_coverage_report(
        self,
        mock_utest_agent,
        mock_coding_agent,
        mock_debugger_agent,
        mock_reviewer_agent,
        mock_test_runner,
        mock_hitl_dispatcher,
        agent_context,
        config,
        sample_test_suite,
        sample_implementation,
        passing_test_result,
        passing_review,
    ) -> None:
        """Test that evidence bundle includes coverage report."""
        from src.workers.agents.development.tdd_orchestrator import TDDOrchestrator
        from src.orchestrator.evidence_bundle import GateType
        from src.orchestrator.hitl_dispatcher import GateRequest, GateStatus
        from datetime import datetime, timezone

        mock_utest_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="utest",
            task_id="test-task",
            metadata={"test_suite": sample_test_suite.to_dict()},
        )
        mock_coding_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="coding",
            task_id="test-task",
            metadata={"implementation": sample_implementation.to_dict()},
        )
        mock_test_runner.run_tests.return_value = passing_test_result
        mock_reviewer_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="reviewer",
            task_id="test-task",
            metadata={"passed": True, "review": passing_review.to_dict()},
        )

        mock_gate_request = GateRequest(
            request_id="test-request-id",
            task_id="test-task",
            session_id="test-session",
            gate_type=GateType.HITL_4_CODE,
            status=GateStatus.PENDING,
            evidence_bundle=MagicMock(),
            requested_by="tdd_orchestrator",
            requested_at=datetime.now(timezone.utc),
        )
        mock_hitl_dispatcher.request_gate.return_value = mock_gate_request

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent,
            coding_agent=mock_coding_agent,
            debugger_agent=mock_debugger_agent,
            reviewer_agent=mock_reviewer_agent,
            test_runner=mock_test_runner,
            config=config,
            hitl_dispatcher=mock_hitl_dispatcher,
        )

        await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature should work"],
        )

        call_kwargs = mock_hitl_dispatcher.request_gate.call_args[1]
        evidence_bundle = call_kwargs["evidence_bundle"]

        # Coverage is included in test_result item
        test_result_items = [i for i in evidence_bundle.items if i.item_type == "test_result"]
        assert len(test_result_items) > 0
        assert test_result_items[0].metadata.get("coverage") == 80.0

    @pytest.mark.asyncio
    async def test_result_includes_hitl4_request_id(
        self,
        mock_utest_agent,
        mock_coding_agent,
        mock_debugger_agent,
        mock_reviewer_agent,
        mock_test_runner,
        mock_hitl_dispatcher,
        agent_context,
        config,
        sample_test_suite,
        sample_implementation,
        passing_test_result,
        passing_review,
    ) -> None:
        """Test that result includes HITL-4 request ID."""
        from src.workers.agents.development.tdd_orchestrator import TDDOrchestrator
        from src.orchestrator.evidence_bundle import GateType
        from src.orchestrator.hitl_dispatcher import GateRequest, GateStatus
        from datetime import datetime, timezone

        mock_utest_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="utest",
            task_id="test-task",
            metadata={"test_suite": sample_test_suite.to_dict()},
        )
        mock_coding_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="coding",
            task_id="test-task",
            metadata={"implementation": sample_implementation.to_dict()},
        )
        mock_test_runner.run_tests.return_value = passing_test_result
        mock_reviewer_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="reviewer",
            task_id="test-task",
            metadata={"passed": True, "review": passing_review.to_dict()},
        )

        mock_gate_request = GateRequest(
            request_id="hitl4-request-12345",
            task_id="test-task",
            session_id="test-session",
            gate_type=GateType.HITL_4_CODE,
            status=GateStatus.PENDING,
            evidence_bundle=MagicMock(),
            requested_by="tdd_orchestrator",
            requested_at=datetime.now(timezone.utc),
        )
        mock_hitl_dispatcher.request_gate.return_value = mock_gate_request

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent,
            coding_agent=mock_coding_agent,
            debugger_agent=mock_debugger_agent,
            reviewer_agent=mock_reviewer_agent,
            test_runner=mock_test_runner,
            config=config,
            hitl_dispatcher=mock_hitl_dispatcher,
        )

        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature should work"],
        )

        assert result.hitl4_request_id == "hitl4-request-12345"

    @pytest.mark.asyncio
    async def test_works_without_hitl_dispatcher(
        self,
        mock_utest_agent,
        mock_coding_agent,
        mock_debugger_agent,
        mock_reviewer_agent,
        mock_test_runner,
        agent_context,
        config,
        sample_test_suite,
        sample_implementation,
        passing_test_result,
        passing_review,
    ) -> None:
        """Test that orchestrator works without HITL dispatcher (backward compatible)."""
        from src.workers.agents.development.tdd_orchestrator import TDDOrchestrator

        mock_utest_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="utest",
            task_id="test-task",
            metadata={"test_suite": sample_test_suite.to_dict()},
        )
        mock_coding_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="coding",
            task_id="test-task",
            metadata={"implementation": sample_implementation.to_dict()},
        )
        mock_test_runner.run_tests.return_value = passing_test_result
        mock_reviewer_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="reviewer",
            task_id="test-task",
            metadata={"passed": True, "review": passing_review.to_dict()},
        )

        # Create without hitl_dispatcher
        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent,
            coding_agent=mock_coding_agent,
            debugger_agent=mock_debugger_agent,
            reviewer_agent=mock_reviewer_agent,
            test_runner=mock_test_runner,
            config=config,
        )

        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature should work"],
        )

        # Should still succeed without HITL dispatcher
        assert result.success is True
        assert result.hitl4_request_id is None


class TestHITL4RejectionHandling:
    """Tests for HITL-4 rejection handling."""

    @pytest.fixture
    def mock_hitl_dispatcher(self):
        """Create a mock HITLDispatcher."""
        dispatcher = MagicMock()
        dispatcher.request_gate = AsyncMock()
        dispatcher.get_request_by_id = AsyncMock()
        return dispatcher

    @pytest.mark.asyncio
    async def test_handles_hitl4_rejection_with_feedback(
        self,
        mock_utest_agent,
        mock_coding_agent,
        mock_debugger_agent,
        mock_reviewer_agent,
        mock_test_runner,
        mock_hitl_dispatcher,
        agent_context,
        config,
        sample_test_suite,
        sample_implementation,
        passing_test_result,
        passing_review,
    ) -> None:
        """Test that HITL-4 rejection returns result with rejection info."""
        from src.workers.agents.development.tdd_orchestrator import TDDOrchestrator
        from src.orchestrator.evidence_bundle import GateType
        from src.orchestrator.hitl_dispatcher import GateRequest, GateStatus, GateDecision
        from datetime import datetime, timezone

        mock_utest_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="utest",
            task_id="test-task",
            metadata={"test_suite": sample_test_suite.to_dict()},
        )
        mock_coding_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="coding",
            task_id="test-task",
            metadata={"implementation": sample_implementation.to_dict()},
        )
        mock_test_runner.run_tests.return_value = passing_test_result
        mock_reviewer_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="reviewer",
            task_id="test-task",
            metadata={"passed": True, "review": passing_review.to_dict()},
        )

        # Create rejected gate request
        mock_gate_request = GateRequest(
            request_id="hitl4-rejected-request",
            task_id="test-task",
            session_id="test-session",
            gate_type=GateType.HITL_4_CODE,
            status=GateStatus.REJECTED,
            evidence_bundle=MagicMock(),
            requested_by="tdd_orchestrator",
            requested_at=datetime.now(timezone.utc),
            decision=GateDecision(
                decision_id="decision-1",
                request_id="hitl4-rejected-request",
                approved=False,
                reviewer="human-reviewer",
                reason="Missing error handling in edge case",
                decided_at=datetime.now(timezone.utc),
            ),
        )
        mock_hitl_dispatcher.request_gate.return_value = mock_gate_request

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent,
            coding_agent=mock_coding_agent,
            debugger_agent=mock_debugger_agent,
            reviewer_agent=mock_reviewer_agent,
            test_runner=mock_test_runner,
            config=config,
            hitl_dispatcher=mock_hitl_dispatcher,
        )

        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature should work"],
        )

        # Result should indicate rejection
        assert result.success is False
        assert result.hitl4_request_id == "hitl4-rejected-request"
        assert result.metadata.get("hitl4_status") == "rejected"
        assert "Missing error handling" in result.metadata.get("hitl4_reason", "")

    @pytest.mark.asyncio
    async def test_evidence_bundle_summary_format(
        self,
        mock_utest_agent,
        mock_coding_agent,
        mock_debugger_agent,
        mock_reviewer_agent,
        mock_test_runner,
        mock_hitl_dispatcher,
        agent_context,
        config,
        sample_test_suite,
        sample_implementation,
        passing_test_result,
        passing_review,
    ) -> None:
        """Test that evidence bundle has proper summary format."""
        from src.workers.agents.development.tdd_orchestrator import TDDOrchestrator
        from src.orchestrator.evidence_bundle import GateType
        from src.orchestrator.hitl_dispatcher import GateRequest, GateStatus
        from datetime import datetime, timezone

        mock_utest_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="utest",
            task_id="test-task",
            metadata={"test_suite": sample_test_suite.to_dict()},
        )
        mock_coding_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="coding",
            task_id="test-task",
            metadata={"implementation": sample_implementation.to_dict()},
        )
        mock_test_runner.run_tests.return_value = passing_test_result
        mock_reviewer_agent.execute.return_value = AgentResult(
            success=True,
            agent_type="reviewer",
            task_id="test-task",
            metadata={"passed": True, "review": passing_review.to_dict()},
        )

        mock_gate_request = GateRequest(
            request_id="test-request-id",
            task_id="test-task",
            session_id="test-session",
            gate_type=GateType.HITL_4_CODE,
            status=GateStatus.PENDING,
            evidence_bundle=MagicMock(),
            requested_by="tdd_orchestrator",
            requested_at=datetime.now(timezone.utc),
        )
        mock_hitl_dispatcher.request_gate.return_value = mock_gate_request

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent,
            coding_agent=mock_coding_agent,
            debugger_agent=mock_debugger_agent,
            reviewer_agent=mock_reviewer_agent,
            test_runner=mock_test_runner,
            config=config,
            hitl_dispatcher=mock_hitl_dispatcher,
        )

        await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature X",
            acceptance_criteria=["Feature should work"],
        )

        call_kwargs = mock_hitl_dispatcher.request_gate.call_args[1]
        evidence_bundle = call_kwargs["evidence_bundle"]

        # Summary should be descriptive
        assert "Implement feature X" in evidence_bundle.summary
        assert "1 test" in evidence_bundle.summary.lower() or "tests" in evidence_bundle.summary.lower()
        assert "80" in evidence_bundle.summary  # Coverage percentage
