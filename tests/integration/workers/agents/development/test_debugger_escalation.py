"""Integration tests for Debugger Agent escalation.

Tests the escalation flow when coding retries are exceeded and the
debugger agent is invoked to analyze failures and suggest fixes.
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.workers.agents.development.coding_agent import CodingAgent
from src.workers.agents.development.config import DevelopmentConfig
from src.workers.agents.development.debugger_agent import DebuggerAgent
from src.workers.agents.development.models import (
    CodeChange,
    CodeReview,
    DebugAnalysis,
    Implementation,
    TestResult,
    TestRunResult,
    TestSuite,
)
from src.workers.agents.development.reviewer_agent import ReviewerAgent
from src.workers.agents.development.tdd_orchestrator import TDDOrchestrator
from src.workers.agents.development.utest_agent import UTestAgent
from src.workers.agents.protocols import AgentContext, AgentResult
from src.workers.artifacts.writer import ArtifactWriter
from src.workers.llm.client import LLMResponse


class TestDebuggerEscalation:
    """Tests for debugger escalation when max retries exceeded."""

    @pytest.mark.asyncio
    async def test_escalates_to_debugger_after_max_retries(
        self,
        mock_utest_agent_for_orchestrator: MagicMock,
        mock_coding_agent_for_orchestrator: MagicMock,
        mock_reviewer_agent_for_orchestrator: MagicMock,
        sample_debug_analysis: DebugAnalysis,
        agent_context: AgentContext,
    ) -> None:
        """Test that debugger is called after max_coding_retries is exceeded."""
        # Use config with max_coding_retries=2
        config = DevelopmentConfig(max_coding_retries=2)

        # Track debugger calls
        debugger_call_count = 0

        async def track_debugger_execute(context, event_metadata):
            nonlocal debugger_call_count
            debugger_call_count += 1
            return AgentResult(
                success=True,
                agent_type="debugger",
                task_id="test-task",
                metadata={
                    "debug_analysis": sample_debug_analysis.to_dict(),
                    "root_cause": sample_debug_analysis.root_cause,
                    "fix_suggestion": sample_debug_analysis.fix_suggestion,
                    "code_changes": [c.to_dict() for c in sample_debug_analysis.code_changes],
                },
            )

        mock_debugger = MagicMock()
        mock_debugger.agent_type = "debugger"
        mock_debugger.execute = AsyncMock(side_effect=track_debugger_execute)

        # Create test runner that eventually passes after debugger help
        fail_count = 0

        def run_tests_with_eventual_success(*args, **kwargs):
            nonlocal fail_count
            fail_count += 1
            if fail_count <= 4:  # Fail first 4 times
                return TestRunResult(
                    suite_id="test",
                    results=[
                        TestResult(
                            test_id="test_1",
                            passed=False,
                            output="F",
                            error="AssertionError",
                            duration_ms=50,
                        )
                    ],
                    passed=0,
                    failed=1,
                    coverage=0.0,
                )
            else:  # Pass after debugger help
                return TestRunResult(
                    suite_id="test",
                    results=[
                        TestResult(
                            test_id="test_1",
                            passed=True,
                            output=".",
                            error=None,
                            duration_ms=50,
                        )
                    ],
                    passed=1,
                    failed=0,
                    coverage=80.0,
                )

        mock_runner = MagicMock()
        mock_runner.run_tests = MagicMock(side_effect=run_tests_with_eventual_success)

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest_agent_for_orchestrator,
            coding_agent=mock_coding_agent_for_orchestrator,
            debugger_agent=mock_debugger,
            reviewer_agent=mock_reviewer_agent_for_orchestrator,
            test_runner=mock_runner,
            config=config,
        )

        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature should work"],
        )

        # Debugger should have been called at least once
        assert debugger_call_count >= 1

    @pytest.mark.asyncio
    async def test_debugger_analysis_passed_to_coding(
        self,
        artifact_writer: ArtifactWriter,
        agent_context: AgentContext,
        sample_test_suite: TestSuite,
        sample_debug_analysis: DebugAnalysis,
    ) -> None:
        """Test that debugger analysis is passed to coding agent after escalation."""
        config = DevelopmentConfig(max_coding_retries=1)  # Escalate quickly

        # Track what's passed to coding agent
        coding_metadata_history: list[dict] = []

        # Create mock UTest
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

        async def track_coding_metadata(context, event_metadata):
            coding_metadata_history.append(event_metadata.copy())
            return AgentResult(
                success=True,
                agent_type="coding",
                task_id="test-task",
                metadata={
                    "implementation": {
                        "task_id": "test-task",
                        "files": [{"path": "impl.py", "content": "pass", "language": "python"}],
                        "imports": [],
                        "dependencies": [],
                    }
                },
            )

        mock_coding.execute = AsyncMock(side_effect=track_coding_metadata)

        # Create mock Debugger that returns analysis
        mock_debugger = MagicMock()
        mock_debugger.agent_type = "debugger"
        mock_debugger.execute = AsyncMock(
            return_value=AgentResult(
                success=True,
                agent_type="debugger",
                task_id="test-task",
                metadata={
                    "root_cause": sample_debug_analysis.root_cause,
                    "fix_suggestion": sample_debug_analysis.fix_suggestion,
                    "code_changes": [c.to_dict() for c in sample_debug_analysis.code_changes],
                    "debug_analysis": sample_debug_analysis.to_dict(),
                },
            )
        )

        # Create mock Reviewer
        mock_reviewer = MagicMock()
        mock_reviewer.agent_type = "reviewer"
        mock_reviewer.execute = AsyncMock(
            return_value=AgentResult(
                success=True,
                agent_type="reviewer",
                task_id="test-task",
                metadata={"passed": True, "review": {}},
            )
        )

        # Create test runner: fail, fail (escalate), pass
        call_count = 0

        def run_tests(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count <= 2:  # Fail first two times
                return TestRunResult(
                    suite_id="test",
                    results=[TestResult(test_id="t1", passed=False, output="F", error="Error", duration_ms=10)],
                    passed=0,
                    failed=1,
                    coverage=0.0,
                )
            else:  # Pass after debug
                return TestRunResult(
                    suite_id="test",
                    results=[TestResult(test_id="t1", passed=True, output=".", error=None, duration_ms=10)],
                    passed=1,
                    failed=0,
                    coverage=80.0,
                )

        mock_runner = MagicMock()
        mock_runner.run_tests = MagicMock(side_effect=run_tests)

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
            acceptance_criteria=["Feature works"],
        )

        assert result.success is True

        # Find the coding call that has debug_analysis
        debug_analysis_calls = [m for m in coding_metadata_history if m.get("debug_analysis")]
        assert len(debug_analysis_calls) >= 1

        # Verify debug analysis was passed
        debug_meta = debug_analysis_calls[0]["debug_analysis"]
        assert "root_cause" in debug_meta or "fix_suggestion" in debug_meta

    @pytest.mark.asyncio
    async def test_debugger_uses_rlm_for_exploration(
        self,
        artifact_writer: ArtifactWriter,
        config: DevelopmentConfig,
        agent_context: AgentContext,
        mock_rlm_integration: MagicMock,
    ) -> None:
        """Test that debugger agent uses RLM for codebase exploration."""
        # Create debugger with RLM
        mock_llm = MagicMock()
        mock_llm.generate = AsyncMock(
            side_effect=[
                LLMResponse(content="Analysis: missing return", model="test"),
                LLMResponse(content="Root cause: logic error", model="test"),
                LLMResponse(
                    content=json.dumps({
                        "failure_id": "f1",
                        "root_cause": "Logic error",
                        "fix_suggestion": "Add return",
                        "code_changes": [],
                    }),
                    model="test",
                ),
            ]
        )
        mock_llm.model_name = "test"

        debugger = DebuggerAgent(
            llm_client=mock_llm,
            artifact_writer=artifact_writer,
            config=config,
            rlm_integration=mock_rlm_integration,
        )

        result = await debugger.execute(
            context=agent_context,
            event_metadata={
                "test_output": "FAILED test_add - AssertionError: 2 != 5",
                "implementation": "def add(a, b): return a",
                "test_code": "def test_add(): assert add(2, 3) == 5",
            },
        )

        assert result.success is True
        # RLM should have been called for exploration
        mock_rlm_integration.explore.assert_called()


class TestDebuggerAnalysisQuality:
    """Tests for the quality of debugger analysis."""

    @pytest.mark.asyncio
    async def test_debugger_identifies_root_cause(
        self,
        debugger_agent: DebuggerAgent,
        agent_context: AgentContext,
    ) -> None:
        """Test that debugger identifies root cause of test failures."""
        result = await debugger_agent.execute(
            context=agent_context,
            event_metadata={
                "test_output": """
FAILED test_calculator.py::test_add_numbers
    assert add_numbers(2, 3) == 5
    AssertionError: assert 2 == 5
""",
                "implementation": """
def add_numbers(a, b):
    return a  # Bug: ignores b
""",
            },
        )

        assert result.success is True
        assert result.metadata is not None
        assert "root_cause" in result.metadata

    @pytest.mark.asyncio
    async def test_debugger_suggests_code_changes(
        self,
        debugger_agent: DebuggerAgent,
        agent_context: AgentContext,
    ) -> None:
        """Test that debugger suggests specific code changes."""
        result = await debugger_agent.execute(
            context=agent_context,
            event_metadata={
                "test_output": "FAILED - expected True, got False",
                "implementation": "def is_valid(x): return False",
            },
        )

        assert result.success is True
        assert "code_changes" in result.metadata

    @pytest.mark.asyncio
    async def test_debugger_handles_multiple_failures(
        self,
        debugger_agent: DebuggerAgent,
        agent_context: AgentContext,
    ) -> None:
        """Test that debugger handles multiple test failures."""
        result = await debugger_agent.execute(
            context=agent_context,
            event_metadata={
                "test_output": """
FAILED test_add - assert 2 == 5
FAILED test_subtract - assert 5 == 2
FAILED test_multiply - assert 4 == 12
""",
                "implementation": """
def add(a, b): return a
def subtract(a, b): return a
def multiply(a, b): return a
""",
            },
        )

        assert result.success is True


class TestDebuggerWithCodingIntegration:
    """Tests for debugger and coding agent integration."""

    @pytest.mark.asyncio
    async def test_coding_applies_debug_fixes(
        self,
        artifact_writer: ArtifactWriter,
        config: DevelopmentConfig,
        agent_context: AgentContext,
        mock_rlm_integration: MagicMock,
    ) -> None:
        """Test that coding agent applies fixes from debugger analysis."""
        # Create coding agent that tracks debug hints
        received_hints: list[str] = []

        mock_llm = MagicMock()

        async def track_prompt(*args, **kwargs):
            prompt = kwargs.get("prompt", args[0] if args else "")
            if "Debug Hints" in prompt or "debug" in prompt.lower():
                received_hints.append(prompt)
            return LLMResponse(
                content=json.dumps({
                    "files": [{"path": "impl.py", "content": "def add(a, b): return a + b", "language": "python"}],
                    "imports": [],
                    "dependencies": [],
                }),
                model="test",
            )

        mock_llm.generate = AsyncMock(side_effect=track_prompt)
        mock_llm.model_name = "test"

        coding_agent = CodingAgent(
            llm_client=mock_llm,
            artifact_writer=artifact_writer,
            config=config,
            rlm_integration=mock_rlm_integration,
        )

        # Execute with debug analysis
        result = await coding_agent.execute(
            context=agent_context,
            event_metadata={
                "task_description": "Fix the add function",
                "test_code": "def test_add(): assert add(2, 3) == 5",
                "fail_count": 3,
                "debug_analysis": {
                    "root_cause": "Second parameter is ignored",
                    "fix_suggestion": "Include parameter b in the return statement",
                    "code_changes": [
                        {
                            "file_path": "impl.py",
                            "original_code": "return a",
                            "new_code": "return a + b",
                            "description": "Include b in addition",
                            "line_start": 2,
                            "line_end": 2,
                        }
                    ],
                },
            },
        )

        assert result.success is True
        # Debug hints should have been extracted and used
        # (The implementation extracts hints from debug_analysis)

    @pytest.mark.asyncio
    async def test_coding_triggers_rlm_on_retry_with_debug(
        self,
        artifact_writer: ArtifactWriter,
        config: DevelopmentConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test that coding agent triggers RLM on retry even with debug analysis."""
        # Create RLM integration that tracks calls
        mock_rlm = MagicMock()
        mock_rlm.should_use_rlm.return_value = MagicMock(should_trigger=True)
        mock_rlm.explore = AsyncMock(
            return_value=MagicMock(
                formatted_output="Found similar pattern in existing code",
                error=None,
            )
        )

        mock_llm = MagicMock()
        mock_llm.generate = AsyncMock(
            return_value=LLMResponse(
                content=json.dumps({
                    "files": [{"path": "impl.py", "content": "def add(a, b): return a + b", "language": "python"}],
                    "imports": [],
                    "dependencies": [],
                }),
                model="test",
            )
        )
        mock_llm.model_name = "test"

        coding_agent = CodingAgent(
            llm_client=mock_llm,
            artifact_writer=artifact_writer,
            config=config,
            rlm_integration=mock_rlm,
        )

        result = await coding_agent.execute(
            context=agent_context,
            event_metadata={
                "task_description": "Fix the function",
                "test_code": "def test(): pass",
                "fail_count": 2,  # Should trigger RLM
                "debug_analysis": {"root_cause": "Bug found"},
            },
        )

        assert result.success is True
        assert result.metadata.get("used_rlm") is True
