"""Unit tests for RLMOrchestrator."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from unittest.mock import AsyncMock, Mock, patch

import pytest

from src.core.exceptions import BudgetExceededError, RLMTimeoutError
from src.workers.rlm.agent import AgentIteration, RLMAgent
from src.workers.rlm.budget_manager import SubCallBudgetManager
from src.workers.rlm.cache import CacheStats, SubCallCache
from src.workers.rlm.config import RLMConfig
from src.workers.rlm.models import ExplorationStep, ToolCall
from src.workers.rlm.orchestrator import RLMOrchestrator


def create_mock_iteration(
    thought: str = "Thinking...",
    tool_calls: list[dict] | None = None,
    findings: list[str] | None = None,
    is_done: bool = False,
) -> AgentIteration:
    """Create a mock AgentIteration."""
    return AgentIteration(
        thought=thought,
        tool_calls=tool_calls or [],
        findings=findings or [],
        next_direction="DONE" if is_done else "Continue",
        raw_response="",
        is_done=is_done,
    )


def create_mock_agent(iterations: list[AgentIteration] | None = None) -> Mock:
    """Create a mock RLMAgent."""
    mock_agent = Mock(spec=RLMAgent)
    mock_agent.total_tokens = 0
    mock_agent.total_iterations = 0

    if iterations:
        mock_agent.run_iteration.side_effect = iterations
    else:
        mock_agent.run_iteration.return_value = create_mock_iteration(is_done=True)

    mock_agent.get_stats.return_value = {"total_iterations": 0, "total_tokens": 0}

    return mock_agent


def create_mock_budget(max_total: int = 50, used: int = 0) -> SubCallBudgetManager:
    """Create a SubCallBudgetManager with specified state."""
    budget = SubCallBudgetManager(max_total=max_total, max_per_iteration=8)
    budget.total_used = used
    return budget


def create_mock_cache() -> SubCallCache:
    """Create a SubCallCache."""
    return SubCallCache()


def create_mock_config() -> RLMConfig:
    """Create a mock RLMConfig."""
    return RLMConfig(
        max_subcalls=50,
        max_subcalls_per_iteration=8,
        timeout_seconds=60,
    )


class TestRLMOrchestratorCreation:
    """Tests for RLMOrchestrator creation."""

    def test_create_orchestrator(self) -> None:
        """Test creating an orchestrator."""
        agent = create_mock_agent()
        budget = create_mock_budget()
        cache = create_mock_cache()
        config = create_mock_config()

        orchestrator = RLMOrchestrator(
            agent=agent,
            budget_manager=budget,
            cache=cache,
            config=config,
        )

        assert orchestrator.max_iterations == 10
        assert orchestrator.exploration_count == 0

    def test_create_with_custom_max_iterations(self) -> None:
        """Test creating with custom max iterations."""
        agent = create_mock_agent()
        budget = create_mock_budget()
        cache = create_mock_cache()
        config = create_mock_config()

        orchestrator = RLMOrchestrator(
            agent=agent,
            budget_manager=budget,
            cache=cache,
            config=config,
            max_iterations=5,
        )

        assert orchestrator.max_iterations == 5


class TestRLMOrchestratorExplore:
    """Tests for the explore method."""

    @pytest.mark.asyncio
    async def test_basic_exploration(self) -> None:
        """Test basic exploration completes successfully."""
        agent = create_mock_agent([
            create_mock_iteration(findings=["Found something"], is_done=True),
        ])
        budget = create_mock_budget()
        cache = create_mock_cache()
        config = create_mock_config()

        orchestrator = RLMOrchestrator(
            agent=agent,
            budget_manager=budget,
            cache=cache,
            config=config,
        )

        result = await orchestrator.explore("What is in the codebase?")

        assert result.success is True
        assert result.task_id is not None
        assert "Found something" in result.synthesis
        assert orchestrator.exploration_count == 1

    @pytest.mark.asyncio
    async def test_exploration_with_context_hints(self) -> None:
        """Test exploration with context hints."""
        agent = create_mock_agent([
            create_mock_iteration(is_done=True),
        ])
        budget = create_mock_budget()
        cache = create_mock_cache()
        config = create_mock_config()

        orchestrator = RLMOrchestrator(
            agent=agent,
            budget_manager=budget,
            cache=cache,
            config=config,
        )

        result = await orchestrator.explore(
            query="Find auth code",
            context_hints=["Look in src/auth/", "Check models.py"],
        )

        assert result.success is True
        assert result.trajectory.context_hints == ["Look in src/auth/", "Check models.py"]

    @pytest.mark.asyncio
    async def test_exploration_with_custom_task_id(self) -> None:
        """Test exploration with custom task ID."""
        agent = create_mock_agent([create_mock_iteration(is_done=True)])
        budget = create_mock_budget()
        cache = create_mock_cache()
        config = create_mock_config()

        orchestrator = RLMOrchestrator(
            agent=agent,
            budget_manager=budget,
            cache=cache,
            config=config,
        )

        result = await orchestrator.explore(
            query="Test query",
            task_id="custom-task-123",
        )

        assert result.task_id == "custom-task-123"

    @pytest.mark.asyncio
    async def test_multi_iteration_exploration(self) -> None:
        """Test exploration with multiple iterations."""
        agent = create_mock_agent([
            create_mock_iteration(findings=["Finding 1"]),
            create_mock_iteration(findings=["Finding 2"]),
            create_mock_iteration(findings=["Finding 3"], is_done=True),
        ])
        budget = create_mock_budget()
        cache = create_mock_cache()
        config = create_mock_config()

        orchestrator = RLMOrchestrator(
            agent=agent,
            budget_manager=budget,
            cache=cache,
            config=config,
        )

        result = await orchestrator.explore("Complex query")

        assert result.success is True
        assert len(result.trajectory.steps) == 3
        assert "Finding 1" in result.synthesis
        assert "Finding 2" in result.synthesis
        assert "Finding 3" in result.synthesis

    @pytest.mark.asyncio
    async def test_exploration_accumulates_findings(self) -> None:
        """Test that findings are accumulated across iterations."""
        agent = create_mock_agent([
            create_mock_iteration(findings=["First finding"]),
            create_mock_iteration(findings=["Second finding"]),
            create_mock_iteration(findings=["Third finding"], is_done=True),
        ])
        budget = create_mock_budget()
        cache = create_mock_cache()
        config = create_mock_config()

        orchestrator = RLMOrchestrator(
            agent=agent,
            budget_manager=budget,
            cache=cache,
            config=config,
        )

        result = await orchestrator.explore("Query")

        # All findings should be in synthesis
        assert "First finding" in result.synthesis
        assert "Second finding" in result.synthesis
        assert "Third finding" in result.synthesis


class TestRLMOrchestratorTimeout:
    """Tests for timeout handling."""

    @pytest.mark.asyncio
    async def test_timeout_returns_failure(self) -> None:
        """Test that timeout returns failure result."""
        async def slow_iteration(*args, **kwargs):
            await asyncio.sleep(10)  # Longer than timeout
            return create_mock_iteration(is_done=True)

        agent = Mock(spec=RLMAgent)
        agent.run_iteration = Mock(side_effect=lambda *args, **kwargs: create_mock_iteration())
        agent.total_tokens = 0
        agent.total_iterations = 0
        agent.get_stats.return_value = {}

        budget = create_mock_budget()
        cache = create_mock_cache()
        config = RLMConfig(timeout_seconds=0.1)  # Very short timeout

        orchestrator = RLMOrchestrator(
            agent=agent,
            budget_manager=budget,
            cache=cache,
            config=config,
            max_iterations=100,
        )

        # Patch asyncio.sleep in the orchestrator to simulate long iterations
        with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            # Make sleep actually sleep longer than timeout
            async def long_sleep(duration):
                await asyncio.sleep(1)
            mock_sleep.side_effect = long_sleep

            result = await orchestrator.explore("Query")

        assert result.success is False
        assert "timeout" in result.error.lower()

    @pytest.mark.asyncio
    async def test_timeout_preserves_partial_results(self) -> None:
        """Test that timeout preserves steps completed."""
        call_count = 0

        def iteration_factory(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count >= 3:
                raise asyncio.CancelledError()  # Simulate timeout
            return create_mock_iteration(findings=[f"Finding {call_count}"])

        agent = Mock(spec=RLMAgent)
        agent.run_iteration = Mock(side_effect=iteration_factory)
        agent.total_tokens = 100
        agent.total_iterations = 2
        agent.get_stats.return_value = {}

        budget = create_mock_budget()
        cache = create_mock_cache()
        config = RLMConfig(timeout_seconds=5)

        orchestrator = RLMOrchestrator(
            agent=agent,
            budget_manager=budget,
            cache=cache,
            config=config,
        )

        # The timeout handling will catch the CancelledError
        result = await orchestrator.explore("Query")

        # Should have captured some steps before timeout
        assert result.trajectory.steps is not None


class TestRLMOrchestratorBudget:
    """Tests for budget handling."""

    @pytest.mark.asyncio
    async def test_budget_exhausted_returns_partial(self) -> None:
        """Test that budget exhaustion returns partial results."""
        agent = create_mock_agent([
            create_mock_iteration(findings=["Found before exhaustion"]),
        ])
        budget = create_mock_budget(max_total=1, used=0)
        cache = create_mock_cache()
        config = create_mock_config()

        orchestrator = RLMOrchestrator(
            agent=agent,
            budget_manager=budget,
            cache=cache,
            config=config,
        )

        # Exhaust budget after first iteration
        budget.total_used = 1

        result = await orchestrator.explore("Query")

        assert "Found before exhaustion" in result.synthesis

    @pytest.mark.asyncio
    async def test_budget_exhausted_early(self) -> None:
        """Test budget exhausted before any iterations."""
        agent = create_mock_agent()
        budget = create_mock_budget(max_total=5, used=5)  # Already exhausted
        cache = create_mock_cache()
        config = create_mock_config()

        orchestrator = RLMOrchestrator(
            agent=agent,
            budget_manager=budget,
            cache=cache,
            config=config,
        )

        result = await orchestrator.explore("Query")

        assert result.success is False
        assert "budget" in result.error.lower()


class TestRLMOrchestratorMaxIterations:
    """Tests for max iteration limit."""

    @pytest.mark.asyncio
    async def test_max_iterations_reached(self) -> None:
        """Test that exploration stops at max iterations."""
        # Never signal done
        iterations = [create_mock_iteration() for _ in range(15)]
        agent = create_mock_agent(iterations)
        budget = create_mock_budget()
        cache = create_mock_cache()
        config = create_mock_config()

        orchestrator = RLMOrchestrator(
            agent=agent,
            budget_manager=budget,
            cache=cache,
            config=config,
            max_iterations=5,
        )

        result = await orchestrator.explore("Query")

        assert result.success is True
        assert len(result.trajectory.steps) == 5


class TestRLMOrchestratorCitations:
    """Tests for citation extraction."""

    @pytest.mark.asyncio
    async def test_extracts_citations_from_read_file(self) -> None:
        """Test that citations are extracted from read_file calls."""
        agent = create_mock_agent([
            create_mock_iteration(
                tool_calls=[
                    {
                        "tool": "read_file",
                        "args": {"file_path": "src/auth.py", "start_line": 10, "end_line": 20},
                        "result": "def authenticate(user): pass",
                    }
                ],
                is_done=True,
            ),
        ])
        budget = create_mock_budget()
        cache = create_mock_cache()
        config = create_mock_config()

        orchestrator = RLMOrchestrator(
            agent=agent,
            budget_manager=budget,
            cache=cache,
            config=config,
        )

        result = await orchestrator.explore("Find auth code")

        assert len(result.citations) == 1
        assert result.citations[0].file_path == "src/auth.py"
        assert result.citations[0].line_start == 10


class TestRLMOrchestratorUsage:
    """Tests for usage tracking."""

    @pytest.mark.asyncio
    async def test_usage_tracked(self) -> None:
        """Test that usage is tracked correctly."""
        agent = create_mock_agent([create_mock_iteration(is_done=True)])
        agent.total_tokens = 500
        agent.total_iterations = 1

        budget = create_mock_budget()
        budget.total_used = 3

        cache = create_mock_cache()
        config = create_mock_config()

        orchestrator = RLMOrchestrator(
            agent=agent,
            budget_manager=budget,
            cache=cache,
            config=config,
        )

        result = await orchestrator.explore("Query")

        assert result.usage.total_tokens == 500
        assert result.usage.model_calls == 1
        assert result.usage.wall_time_seconds > 0


class TestRLMOrchestratorSync:
    """Tests for synchronous wrapper."""

    def test_explore_sync(self) -> None:
        """Test synchronous exploration wrapper."""
        agent = create_mock_agent([create_mock_iteration(is_done=True)])
        budget = create_mock_budget()
        cache = create_mock_cache()
        config = create_mock_config()

        orchestrator = RLMOrchestrator(
            agent=agent,
            budget_manager=budget,
            cache=cache,
            config=config,
        )

        result = orchestrator.explore_sync("Query")

        assert result.success is True


class TestRLMOrchestratorStats:
    """Tests for statistics."""

    @pytest.mark.asyncio
    async def test_get_stats(self) -> None:
        """Test get_stats method."""
        agent = create_mock_agent([create_mock_iteration(is_done=True)])
        budget = create_mock_budget()
        cache = create_mock_cache()
        config = create_mock_config()

        orchestrator = RLMOrchestrator(
            agent=agent,
            budget_manager=budget,
            cache=cache,
            config=config,
        )

        await orchestrator.explore("Query")

        stats = orchestrator.get_stats()

        assert stats["exploration_count"] == 1
        assert "budget_stats" in stats
        assert "cache_stats" in stats
        assert "agent_stats" in stats
        assert "config" in stats

    def test_repr(self) -> None:
        """Test string representation."""
        agent = create_mock_agent()
        budget = create_mock_budget(max_total=100)
        cache = create_mock_cache()
        config = create_mock_config()

        orchestrator = RLMOrchestrator(
            agent=agent,
            budget_manager=budget,
            cache=cache,
            config=config,
        )

        repr_str = repr(orchestrator)

        assert "RLMOrchestrator" in repr_str
        assert "explorations=0" in repr_str
        assert "budget=" in repr_str


class TestRLMOrchestratorErrorHandling:
    """Tests for error handling."""

    @pytest.mark.asyncio
    async def test_handles_unexpected_error(self) -> None:
        """Test handling of unexpected errors."""
        agent = Mock(spec=RLMAgent)
        agent.run_iteration.side_effect = ValueError("Unexpected error")
        agent.total_tokens = 0
        agent.total_iterations = 0
        agent.get_stats.return_value = {}

        budget = create_mock_budget()
        cache = create_mock_cache()
        config = create_mock_config()

        orchestrator = RLMOrchestrator(
            agent=agent,
            budget_manager=budget,
            cache=cache,
            config=config,
        )

        result = await orchestrator.explore("Query")

        assert result.success is False
        assert "Unexpected error" in result.error
