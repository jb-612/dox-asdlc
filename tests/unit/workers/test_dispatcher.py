"""Unit tests for agent dispatcher.

Tests the AgentDispatcher that routes events to appropriate agents.
"""

from __future__ import annotations

import pytest
from datetime import datetime, timezone
from typing import Any
from unittest.mock import AsyncMock, MagicMock

from src.core.events import ASDLCEvent, EventType
from src.workers.agents.protocols import AgentResult, AgentContext, BaseAgent
from src.workers.agents.dispatcher import AgentDispatcher, AgentNotFoundError


class MockAgent:
    """Mock agent for testing."""

    def __init__(self, agent_type: str, success: bool = True):
        self._agent_type = agent_type
        self._success = success
        self.execute_called = False
        self.last_context = None
        self.last_metadata = None

    @property
    def agent_type(self) -> str:
        return self._agent_type

    async def execute(
        self, context: AgentContext, event_metadata: dict[str, Any]
    ) -> AgentResult:
        self.execute_called = True
        self.last_context = context
        self.last_metadata = event_metadata

        return AgentResult(
            success=self._success,
            agent_type=self.agent_type,
            task_id=context.task_id,
            error_message=None if self._success else "Mock failure",
        )


class TestAgentDispatcher:
    """Tests for AgentDispatcher class."""

    @pytest.fixture
    def dispatcher(self):
        """Create an AgentDispatcher."""
        return AgentDispatcher()

    def _create_event(
        self,
        agent_type: str = "stub",
        task_id: str = "task-123",
    ) -> ASDLCEvent:
        """Create a test event."""
        return ASDLCEvent(
            event_id="evt-001",
            event_type=EventType.AGENT_STARTED,
            session_id="session-123",
            task_id=task_id,
            timestamp=datetime.now(timezone.utc),
            metadata={"agent_type": agent_type},
        )

    def test_register_agent(self, dispatcher):
        """Dispatcher registers agents by type."""
        agent = MockAgent("test-agent")

        dispatcher.register(agent)

        assert "test-agent" in dispatcher.registered_agents

    def test_register_multiple_agents(self, dispatcher):
        """Dispatcher registers multiple agents."""
        agent1 = MockAgent("agent-1")
        agent2 = MockAgent("agent-2")

        dispatcher.register(agent1)
        dispatcher.register(agent2)

        assert len(dispatcher.registered_agents) == 2

    def test_register_replaces_existing(self, dispatcher):
        """Registering same type replaces existing agent."""
        agent1 = MockAgent("test-agent")
        agent2 = MockAgent("test-agent")

        dispatcher.register(agent1)
        dispatcher.register(agent2)

        # Should have only one agent
        assert len(dispatcher.registered_agents) == 1
        # Should be the second agent
        assert dispatcher.get_agent("test-agent") is agent2

    def test_get_agent_returns_registered_agent(self, dispatcher):
        """get_agent returns the registered agent."""
        agent = MockAgent("test-agent")
        dispatcher.register(agent)

        result = dispatcher.get_agent("test-agent")

        assert result is agent

    def test_get_agent_returns_none_for_unknown(self, dispatcher):
        """get_agent returns None for unknown agent type."""
        result = dispatcher.get_agent("unknown-agent")

        assert result is None

    async def test_dispatch_calls_agent_execute(self, dispatcher):
        """dispatch calls the agent's execute method."""
        agent = MockAgent("test-agent")
        dispatcher.register(agent)
        event = self._create_event(agent_type="test-agent")
        context = AgentContext(
            session_id="session-123",
            task_id="task-123",
            tenant_id="default",
            workspace_path="/app/workspace",
        )

        result = await dispatcher.dispatch(event, context)

        assert agent.execute_called is True
        assert result.success is True
        assert result.agent_type == "test-agent"

    async def test_dispatch_passes_context_to_agent(self, dispatcher):
        """dispatch passes context to agent."""
        agent = MockAgent("test-agent")
        dispatcher.register(agent)
        event = self._create_event(agent_type="test-agent")
        context = AgentContext(
            session_id="session-abc",
            task_id="task-xyz",
            tenant_id="acme-corp",
            workspace_path="/custom/workspace",
        )

        await dispatcher.dispatch(event, context)

        assert agent.last_context.session_id == "session-abc"
        assert agent.last_context.task_id == "task-xyz"
        assert agent.last_context.tenant_id == "acme-corp"

    async def test_dispatch_passes_event_metadata(self, dispatcher):
        """dispatch passes event metadata to agent."""
        agent = MockAgent("test-agent")
        dispatcher.register(agent)
        event = ASDLCEvent(
            event_id="evt-001",
            event_type=EventType.AGENT_STARTED,
            session_id="session-123",
            task_id="task-123",
            timestamp=datetime.now(timezone.utc),
            metadata={"agent_type": "test-agent", "custom_key": "custom_value"},
        )
        context = AgentContext(
            session_id="session-123",
            task_id="task-123",
            tenant_id="default",
            workspace_path="/app/workspace",
        )

        await dispatcher.dispatch(event, context)

        assert agent.last_metadata["custom_key"] == "custom_value"

    async def test_dispatch_raises_for_unknown_agent(self, dispatcher):
        """dispatch raises AgentNotFoundError for unknown agent type."""
        event = self._create_event(agent_type="unknown-agent")
        context = AgentContext(
            session_id="session-123",
            task_id="task-123",
            tenant_id="default",
            workspace_path="/app/workspace",
        )

        with pytest.raises(AgentNotFoundError) as exc_info:
            await dispatcher.dispatch(event, context)

        assert "unknown-agent" in str(exc_info.value)

    async def test_dispatch_returns_agent_result(self, dispatcher):
        """dispatch returns the AgentResult from the agent."""
        agent = MockAgent("test-agent", success=False)
        dispatcher.register(agent)
        event = self._create_event(agent_type="test-agent")
        context = AgentContext(
            session_id="session-123",
            task_id="task-123",
            tenant_id="default",
            workspace_path="/app/workspace",
        )

        result = await dispatcher.dispatch(event, context)

        assert result.success is False
        assert result.error_message == "Mock failure"

    def test_get_agent_type_from_event(self, dispatcher):
        """get_agent_type_from_event extracts agent type from metadata."""
        event = self._create_event(agent_type="coding-agent")

        agent_type = dispatcher.get_agent_type_from_event(event)

        assert agent_type == "coding-agent"

    def test_get_agent_type_returns_none_if_missing(self, dispatcher):
        """get_agent_type_from_event returns None if agent_type not in metadata."""
        event = ASDLCEvent(
            event_id="evt-001",
            event_type=EventType.AGENT_STARTED,
            session_id="session-123",
            task_id="task-123",
            timestamp=datetime.now(timezone.utc),
            metadata={},  # No agent_type
        )

        agent_type = dispatcher.get_agent_type_from_event(event)

        assert agent_type is None


class TestAgentDispatcherWithCallbacks:
    """Tests for dispatcher with validation and cleanup callbacks."""

    @pytest.fixture
    def dispatcher(self):
        """Create an AgentDispatcher."""
        return AgentDispatcher()

    async def test_calls_validate_context_if_available(self, dispatcher):
        """dispatch calls validate_context if agent implements it."""

        class AgentWithValidation:
            @property
            def agent_type(self) -> str:
                return "validated-agent"

            async def validate_context(self, context: AgentContext) -> bool:
                return context.task_id is not None

            async def execute(
                self, context: AgentContext, event_metadata: dict[str, Any]
            ) -> AgentResult:
                return AgentResult(
                    success=True,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                )

        agent = AgentWithValidation()
        dispatcher.register(agent)

        event = ASDLCEvent(
            event_id="evt-001",
            event_type=EventType.AGENT_STARTED,
            session_id="session-123",
            task_id="task-123",
            timestamp=datetime.now(timezone.utc),
            metadata={"agent_type": "validated-agent"},
        )
        context = AgentContext(
            session_id="session-123",
            task_id="task-123",
            tenant_id="default",
            workspace_path="/app/workspace",
        )

        result = await dispatcher.dispatch(event, context)

        assert result.success is True

    async def test_calls_cleanup_after_execution(self, dispatcher):
        """dispatch calls cleanup after execution."""
        cleanup_called = False

        class AgentWithCleanup:
            @property
            def agent_type(self) -> str:
                return "cleanup-agent"

            async def execute(
                self, context: AgentContext, event_metadata: dict[str, Any]
            ) -> AgentResult:
                return AgentResult(
                    success=True,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                )

            async def cleanup(self, context: AgentContext) -> None:
                nonlocal cleanup_called
                cleanup_called = True

        agent = AgentWithCleanup()
        dispatcher.register(agent)

        event = ASDLCEvent(
            event_id="evt-001",
            event_type=EventType.AGENT_STARTED,
            session_id="session-123",
            task_id="task-123",
            timestamp=datetime.now(timezone.utc),
            metadata={"agent_type": "cleanup-agent"},
        )
        context = AgentContext(
            session_id="session-123",
            task_id="task-123",
            tenant_id="default",
            workspace_path="/app/workspace",
        )

        await dispatcher.dispatch(event, context)

        assert cleanup_called is True
