"""Unit tests for Manager Agent.

Tests the ManagerAgent class, event handlers, and worker dispatch.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.core.events import ASDLCEvent, EventType, HandlerResult
from src.orchestrator.state_machine import TaskState


class TestManagerAgentInitialization:
    """Tests for ManagerAgent initialization."""

    def test_manager_agent_created(self):
        """ManagerAgent can be instantiated."""
        from src.orchestrator.manager_agent import ManagerAgent

        mock_task_manager = MagicMock()
        mock_session_manager = MagicMock()
        mock_git_gateway = MagicMock()
        mock_event_publisher = AsyncMock()

        agent = ManagerAgent(
            task_manager=mock_task_manager,
            session_manager=mock_session_manager,
            git_gateway=mock_git_gateway,
            event_publisher=mock_event_publisher,
        )

        assert agent.task_manager == mock_task_manager
        assert agent.session_manager == mock_session_manager

    def test_can_handle_returns_true_for_supported_events(self):
        """can_handle returns True for supported event types."""
        from src.orchestrator.manager_agent import ManagerAgent

        agent = ManagerAgent(
            task_manager=MagicMock(),
            session_manager=MagicMock(),
            git_gateway=MagicMock(),
            event_publisher=AsyncMock(),
        )

        # Manager handles these events
        assert agent.can_handle(EventType.TASK_CREATED) is True
        assert agent.can_handle(EventType.AGENT_COMPLETED) is True
        assert agent.can_handle(EventType.GATE_APPROVED) is True
        assert agent.can_handle(EventType.GATE_REJECTED) is True
        assert agent.can_handle(EventType.TASK_FAILED) is True


class TestHandleTaskCreated:
    """Tests for task creation handling."""

    @pytest.mark.asyncio
    async def test_handle_task_created_creates_task(self):
        """TASK_CREATED event creates a task."""
        from src.orchestrator.manager_agent import ManagerAgent
        from src.orchestrator.task_manager import Task

        mock_task_manager = AsyncMock()
        mock_task_manager.create_task.return_value = Task(
            task_id="task-123",
            session_id="session-456",
            epic_id="epic-789",
            state=TaskState.PENDING,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )

        agent = ManagerAgent(
            task_manager=mock_task_manager,
            session_manager=AsyncMock(),
            git_gateway=MagicMock(),
            event_publisher=AsyncMock(),
        )

        event = ASDLCEvent(
            event_id="evt-001",
            event_type=EventType.TASK_CREATED,
            session_id="session-456",
            epic_id="epic-789",
            task_id="task-123",
            timestamp=datetime.now(timezone.utc),
        )

        result = await agent.handle(event)

        assert result.success is True
        mock_task_manager.create_task.assert_called_once()


class TestHandleAgentCompleted:
    """Tests for agent completion handling."""

    @pytest.mark.asyncio
    async def test_handle_agent_completed_with_patch(self):
        """AGENT_COMPLETED with patch triggers patch application."""
        from src.orchestrator.manager_agent import ManagerAgent
        from src.orchestrator.task_manager import Task

        mock_task_manager = AsyncMock()
        mock_task_manager.get_task.return_value = Task(
            task_id="task-123",
            session_id="session-456",
            epic_id="epic-789",
            state=TaskState.IN_PROGRESS,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        mock_task_manager.update_state.return_value = Task(
            task_id="task-123",
            session_id="session-456",
            epic_id="epic-789",
            state=TaskState.TESTING,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )

        mock_git_gateway = AsyncMock()
        mock_git_gateway.apply_patch.return_value = "newsha123"

        agent = ManagerAgent(
            task_manager=mock_task_manager,
            session_manager=AsyncMock(),
            git_gateway=mock_git_gateway,
            event_publisher=AsyncMock(),
        )

        event = ASDLCEvent(
            event_id="evt-001",
            event_type=EventType.AGENT_COMPLETED,
            session_id="session-456",
            task_id="task-123",
            artifact_paths=["/patches/task-123.patch"],
            timestamp=datetime.now(timezone.utc),
        )

        result = await agent.handle(event)

        assert result.success is True
        mock_git_gateway.apply_patch.assert_called_once()


class TestHandleGateApproved:
    """Tests for gate approval handling."""

    @pytest.mark.asyncio
    async def test_handle_gate_approved_advances_state(self):
        """GATE_APPROVED moves task to COMPLETE."""
        from src.orchestrator.manager_agent import ManagerAgent
        from src.orchestrator.task_manager import Task

        mock_task_manager = AsyncMock()
        mock_task_manager.get_task.return_value = Task(
            task_id="task-123",
            session_id="session-456",
            epic_id="epic-789",
            state=TaskState.BLOCKED_HITL,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        mock_task_manager.update_state.return_value = Task(
            task_id="task-123",
            session_id="session-456",
            epic_id="epic-789",
            state=TaskState.COMPLETE,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )

        agent = ManagerAgent(
            task_manager=mock_task_manager,
            session_manager=AsyncMock(),
            git_gateway=MagicMock(),
            event_publisher=AsyncMock(),
        )

        event = ASDLCEvent(
            event_id="evt-001",
            event_type=EventType.GATE_APPROVED,
            session_id="session-456",
            task_id="task-123",
            timestamp=datetime.now(timezone.utc),
        )

        result = await agent.handle(event)

        assert result.success is True
        mock_task_manager.update_state.assert_called()


class TestHandleGateRejected:
    """Tests for gate rejection handling."""

    @pytest.mark.asyncio
    async def test_handle_gate_rejected_retries(self):
        """GATE_REJECTED moves task back to IN_PROGRESS."""
        from src.orchestrator.manager_agent import ManagerAgent
        from src.orchestrator.task_manager import Task

        mock_task_manager = AsyncMock()
        mock_task_manager.get_task.return_value = Task(
            task_id="task-123",
            session_id="session-456",
            epic_id="epic-789",
            state=TaskState.BLOCKED_HITL,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        mock_task_manager.update_state.return_value = Task(
            task_id="task-123",
            session_id="session-456",
            epic_id="epic-789",
            state=TaskState.IN_PROGRESS,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        mock_task_manager.increment_fail_count.return_value = 1

        agent = ManagerAgent(
            task_manager=mock_task_manager,
            session_manager=AsyncMock(),
            git_gateway=MagicMock(),
            event_publisher=AsyncMock(),
        )

        event = ASDLCEvent(
            event_id="evt-001",
            event_type=EventType.GATE_REJECTED,
            session_id="session-456",
            task_id="task-123",
            timestamp=datetime.now(timezone.utc),
        )

        result = await agent.handle(event)

        assert result.success is True
        mock_task_manager.increment_fail_count.assert_called_once()


class TestHandleTaskFailed:
    """Tests for task failure handling."""

    @pytest.mark.asyncio
    async def test_handle_task_failed_increments_fail_count(self):
        """TASK_FAILED increments fail count."""
        from src.orchestrator.manager_agent import ManagerAgent
        from src.orchestrator.task_manager import Task

        mock_task_manager = AsyncMock()
        mock_task_manager.get_task.return_value = Task(
            task_id="task-123",
            session_id="session-456",
            epic_id="epic-789",
            state=TaskState.IN_PROGRESS,
            fail_count=3,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        mock_task_manager.increment_fail_count.return_value = 4

        agent = ManagerAgent(
            task_manager=mock_task_manager,
            session_manager=AsyncMock(),
            git_gateway=MagicMock(),
            event_publisher=AsyncMock(),
        )

        event = ASDLCEvent(
            event_id="evt-001",
            event_type=EventType.TASK_FAILED,
            session_id="session-456",
            task_id="task-123",
            timestamp=datetime.now(timezone.utc),
        )

        result = await agent.handle(event)

        mock_task_manager.increment_fail_count.assert_called_once()

    @pytest.mark.asyncio
    async def test_high_fail_count_triggers_rlm(self):
        """fail_count > 4 triggers RLM mode in dispatch."""
        from src.orchestrator.manager_agent import ManagerAgent
        from src.orchestrator.task_manager import Task

        mock_task_manager = AsyncMock()
        mock_task_manager.get_task.return_value = Task(
            task_id="task-123",
            session_id="session-456",
            epic_id="epic-789",
            state=TaskState.IN_PROGRESS,
            fail_count=4,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        mock_task_manager.increment_fail_count.return_value = 5

        mock_publisher = AsyncMock()

        agent = ManagerAgent(
            task_manager=mock_task_manager,
            session_manager=AsyncMock(),
            git_gateway=MagicMock(),
            event_publisher=mock_publisher,
        )

        event = ASDLCEvent(
            event_id="evt-001",
            event_type=EventType.TASK_FAILED,
            session_id="session-456",
            task_id="task-123",
            timestamp=datetime.now(timezone.utc),
        )

        await agent.handle(event)

        # Should dispatch with RLM mode
        mock_publisher.assert_called()


class TestDispatchToWorker:
    """Tests for worker dispatch."""

    @pytest.mark.asyncio
    async def test_dispatch_publishes_agent_started_event(self):
        """Dispatch publishes AGENT_STARTED event."""
        from src.orchestrator.manager_agent import ManagerAgent
        from src.orchestrator.task_manager import Task

        mock_task_manager = AsyncMock()
        mock_task_manager.get_task.return_value = Task(
            task_id="task-123",
            session_id="session-456",
            epic_id="epic-789",
            state=TaskState.PENDING,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        mock_task_manager.update_state.return_value = Task(
            task_id="task-123",
            session_id="session-456",
            epic_id="epic-789",
            state=TaskState.IN_PROGRESS,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )

        mock_publisher = AsyncMock()

        agent = ManagerAgent(
            task_manager=mock_task_manager,
            session_manager=AsyncMock(),
            git_gateway=MagicMock(),
            event_publisher=mock_publisher,
        )

        task = Task(
            task_id="task-123",
            session_id="session-456",
            epic_id="epic-789",
            state=TaskState.PENDING,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )

        await agent.dispatch_to_worker(task, "coding-agent")

        mock_publisher.assert_called()
        call_args = mock_publisher.call_args
        event = call_args.args[0]
        assert event.event_type == EventType.AGENT_STARTED

    @pytest.mark.asyncio
    async def test_dispatch_updates_task_state(self):
        """Dispatch moves task to IN_PROGRESS."""
        from src.orchestrator.manager_agent import ManagerAgent
        from src.orchestrator.task_manager import Task

        mock_task_manager = AsyncMock()
        mock_task_manager.update_state.return_value = Task(
            task_id="task-123",
            session_id="session-456",
            epic_id="epic-789",
            state=TaskState.IN_PROGRESS,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )

        agent = ManagerAgent(
            task_manager=mock_task_manager,
            session_manager=AsyncMock(),
            git_gateway=MagicMock(),
            event_publisher=AsyncMock(),
        )

        task = Task(
            task_id="task-123",
            session_id="session-456",
            epic_id="epic-789",
            state=TaskState.PENDING,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )

        await agent.dispatch_to_worker(task, "coding-agent")

        mock_task_manager.update_state.assert_called_with(
            "task-123",
            TaskState.IN_PROGRESS,
            current_agent="coding-agent",
        )
