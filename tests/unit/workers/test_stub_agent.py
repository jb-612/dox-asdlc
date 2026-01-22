"""Unit tests for stub agent.

Tests the StubAgent used for framework validation and testing.
"""

from __future__ import annotations

import pytest
from datetime import datetime, timezone
from typing import Any

from src.workers.agents.protocols import AgentResult, AgentContext, BaseAgent
from src.workers.agents.stub_agent import StubAgent


class TestStubAgent:
    """Tests for StubAgent class."""

    @pytest.fixture
    def context(self):
        """Create a test context."""
        return AgentContext(
            session_id="session-123",
            task_id="task-456",
            tenant_id="default",
            workspace_path="/app/workspace",
        )

    def test_stub_agent_type(self):
        """StubAgent has correct agent type."""
        agent = StubAgent()
        assert agent.agent_type == "stub"

    def test_stub_agent_implements_protocol(self):
        """StubAgent implements BaseAgent protocol."""
        agent = StubAgent()
        assert isinstance(agent, BaseAgent)

    async def test_execute_returns_success_by_default(self, context):
        """StubAgent returns success by default."""
        agent = StubAgent()

        result = await agent.execute(context, {})

        assert result.success is True
        assert result.agent_type == "stub"
        assert result.task_id == "task-456"

    async def test_execute_configurable_success(self, context):
        """StubAgent success can be configured."""
        agent = StubAgent(success=False)

        result = await agent.execute(context, {})

        assert result.success is False

    async def test_execute_configurable_error_message(self, context):
        """StubAgent error message can be configured."""
        agent = StubAgent(success=False, error_message="Custom error")

        result = await agent.execute(context, {})

        assert result.error_message == "Custom error"

    async def test_execute_configurable_retry(self, context):
        """StubAgent retry can be configured."""
        agent = StubAgent(success=False, should_retry=True)

        result = await agent.execute(context, {})

        assert result.should_retry is True

    async def test_execute_configurable_delay(self, context):
        """StubAgent can simulate execution delay."""
        import time

        agent = StubAgent(delay_seconds=0.1)
        start = time.time()

        await agent.execute(context, {})

        elapsed = time.time() - start
        assert elapsed >= 0.1

    async def test_execute_generates_artifacts(self, context):
        """StubAgent can generate mock artifacts."""
        agent = StubAgent(artifact_count=2)

        result = await agent.execute(context, {})

        assert len(result.artifact_paths) == 2
        assert all("/artifacts/" in path for path in result.artifact_paths)

    async def test_execute_with_callback(self, context):
        """StubAgent calls custom callback if provided."""
        callback_called = False

        async def custom_callback(ctx: AgentContext) -> None:
            nonlocal callback_called
            callback_called = True

        agent = StubAgent(on_execute=custom_callback)

        await agent.execute(context, {})

        assert callback_called is True

    async def test_execute_with_exception(self, context):
        """StubAgent can be configured to raise exceptions."""
        agent = StubAgent(raise_exception=ValueError("Test exception"))

        with pytest.raises(ValueError, match="Test exception"):
            await agent.execute(context, {})

    async def test_execute_records_metadata(self, context):
        """StubAgent records execution in result metadata."""
        agent = StubAgent()

        result = await agent.execute(context, {"key": "value"})

        assert "execution_time_ms" in result.metadata

    async def test_execute_with_context_pack(self):
        """StubAgent works with context pack."""
        context = AgentContext(
            session_id="session-123",
            task_id="task-456",
            tenant_id="default",
            workspace_path="/app/workspace",
            context_pack={"files": ["main.py", "utils.py"]},
        )
        agent = StubAgent()

        result = await agent.execute(context, {})

        assert result.success is True
        assert "context_pack_files" in result.metadata

    def test_create_failing_stub(self):
        """Convenience factory for failing stub."""
        agent = StubAgent.create_failing("Always fails")

        assert agent._success is False
        assert agent._error_message == "Always fails"

    def test_create_slow_stub(self):
        """Convenience factory for slow stub."""
        agent = StubAgent.create_slow(delay=1.0)

        assert agent._delay_seconds == 1.0


class TestStubAgentValidation:
    """Tests for StubAgent with validation."""

    @pytest.fixture
    def context(self):
        """Create a test context."""
        return AgentContext(
            session_id="session-123",
            task_id="task-456",
            tenant_id="default",
            workspace_path="/app/workspace",
        )

    async def test_validate_context_returns_true_by_default(self, context):
        """StubAgent validation returns True by default."""
        agent = StubAgent()

        result = await agent.validate_context(context)

        assert result is True

    async def test_validate_context_configurable(self, context):
        """StubAgent validation can be configured to fail."""
        agent = StubAgent(validation_fails=True)

        result = await agent.validate_context(context)

        assert result is False


class TestStubAgentCleanup:
    """Tests for StubAgent cleanup."""

    @pytest.fixture
    def context(self):
        """Create a test context."""
        return AgentContext(
            session_id="session-123",
            task_id="task-456",
            tenant_id="default",
            workspace_path="/app/workspace",
        )

    async def test_cleanup_called(self, context):
        """StubAgent cleanup can be called."""
        agent = StubAgent()

        # Should not raise
        await agent.cleanup(context)

    async def test_cleanup_with_callback(self, context):
        """StubAgent cleanup calls callback if provided."""
        cleanup_called = False

        async def cleanup_callback(ctx: AgentContext) -> None:
            nonlocal cleanup_called
            cleanup_called = True

        agent = StubAgent(on_cleanup=cleanup_callback)

        await agent.cleanup(context)

        assert cleanup_called is True
