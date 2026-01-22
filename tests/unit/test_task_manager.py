"""Unit tests for task and session managers.

Tests the Task model, TaskManager, Session model, and SessionManager.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest

from src.orchestrator.state_machine import TaskState


class TestTaskModel:
    """Tests for Task dataclass."""

    def test_create_task(self):
        """Task can be created with required fields."""
        from src.orchestrator.task_manager import Task

        now = datetime.now(timezone.utc)
        task = Task(
            task_id="task-123",
            session_id="session-456",
            epic_id="epic-789",
            state=TaskState.PENDING,
            created_at=now,
            updated_at=now,
        )

        assert task.task_id == "task-123"
        assert task.session_id == "session-456"
        assert task.epic_id == "epic-789"
        assert task.state == TaskState.PENDING
        assert task.fail_count == 0
        assert task.current_agent is None

    def test_task_serialization(self):
        """Task can be serialized to dict."""
        from src.orchestrator.task_manager import Task

        now = datetime.now(timezone.utc)
        task = Task(
            task_id="task-123",
            session_id="session-456",
            epic_id="epic-789",
            state=TaskState.IN_PROGRESS,
            fail_count=2,
            current_agent="coding-agent",
            git_sha="abc123",
            artifact_paths=["/patches/t1.patch"],
            created_at=now,
            updated_at=now,
        )

        data = task.to_dict()

        assert data["task_id"] == "task-123"
        assert data["state"] == "in_progress"
        assert data["fail_count"] == "2"
        assert data["artifact_paths"] == "/patches/t1.patch"

    def test_task_deserialization(self):
        """Task can be created from dict."""
        from src.orchestrator.task_manager import Task

        data = {
            "task_id": "task-123",
            "session_id": "session-456",
            "epic_id": "epic-789",
            "state": "pending",
            "fail_count": "3",
            "current_agent": "review-agent",
            "created_at": "2026-01-22T10:00:00+00:00",
            "updated_at": "2026-01-22T10:30:00+00:00",
        }

        task = Task.from_dict(data)

        assert task.task_id == "task-123"
        assert task.state == TaskState.PENDING
        assert task.fail_count == 3


class TestTaskManager:
    """Tests for TaskManager class."""

    @pytest.mark.asyncio
    async def test_create_task(self):
        """Create stores task in Redis hash."""
        from src.orchestrator.task_manager import Task, TaskManager

        mock_client = AsyncMock()
        mock_client.hset.return_value = True

        manager = TaskManager(mock_client)

        now = datetime.now(timezone.utc)
        task = Task(
            task_id="task-123",
            session_id="session-456",
            epic_id="epic-789",
            state=TaskState.PENDING,
            created_at=now,
            updated_at=now,
        )

        result = await manager.create_task(task)

        assert result.task_id == "task-123"
        mock_client.hset.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_task(self):
        """Get retrieves task from Redis hash."""
        from src.orchestrator.task_manager import Task, TaskManager

        mock_client = AsyncMock()
        mock_client.hgetall.return_value = {
            "task_id": "task-123",
            "session_id": "session-456",
            "epic_id": "epic-789",
            "state": "pending",
            "fail_count": "0",
            "created_at": "2026-01-22T10:00:00+00:00",
            "updated_at": "2026-01-22T10:00:00+00:00",
        }

        manager = TaskManager(mock_client)
        task = await manager.get_task("task-123")

        assert task is not None
        assert task.task_id == "task-123"
        assert task.state == TaskState.PENDING

    @pytest.mark.asyncio
    async def test_get_task_not_found(self):
        """Get returns None for missing task."""
        from src.orchestrator.task_manager import TaskManager

        mock_client = AsyncMock()
        mock_client.hgetall.return_value = {}

        manager = TaskManager(mock_client)
        task = await manager.get_task("nonexistent")

        assert task is None

    @pytest.mark.asyncio
    async def test_update_state_validates_transition(self):
        """Update state validates transition before applying."""
        from src.orchestrator.task_manager import TaskManager
        from src.core.exceptions import TaskStateError

        mock_client = AsyncMock()
        mock_client.hgetall.return_value = {
            "task_id": "task-123",
            "session_id": "session-456",
            "epic_id": "epic-789",
            "state": "pending",  # Current state
            "fail_count": "0",
            "created_at": "2026-01-22T10:00:00+00:00",
            "updated_at": "2026-01-22T10:00:00+00:00",
        }

        manager = TaskManager(mock_client)

        # Invalid: PENDING → COMPLETE
        with pytest.raises(TaskStateError):
            await manager.update_state("task-123", TaskState.COMPLETE)

    @pytest.mark.asyncio
    async def test_update_state_success(self):
        """Update state applies valid transition."""
        from src.orchestrator.task_manager import TaskManager

        mock_client = AsyncMock()
        mock_client.hgetall.return_value = {
            "task_id": "task-123",
            "session_id": "session-456",
            "epic_id": "epic-789",
            "state": "pending",
            "fail_count": "0",
            "created_at": "2026-01-22T10:00:00+00:00",
            "updated_at": "2026-01-22T10:00:00+00:00",
        }
        mock_client.hset.return_value = True

        manager = TaskManager(mock_client)

        # Valid: PENDING → IN_PROGRESS
        task = await manager.update_state("task-123", TaskState.IN_PROGRESS)

        assert task.state == TaskState.IN_PROGRESS
        mock_client.hset.assert_called()

    @pytest.mark.asyncio
    async def test_increment_fail_count(self):
        """Fail count is incremented atomically."""
        from src.orchestrator.task_manager import TaskManager

        mock_client = AsyncMock()
        mock_client.hincrby.return_value = 3

        manager = TaskManager(mock_client)
        count = await manager.increment_fail_count("task-123")

        assert count == 3
        mock_client.hincrby.assert_called_once()

    @pytest.mark.asyncio
    async def test_tenant_prefixed_keys(self):
        """Task keys are tenant-prefixed in multi-tenant mode."""
        from src.orchestrator.task_manager import TaskManager
        from src.core.tenant import TenantContext
        from src.core.config import clear_config_cache

        mock_client = AsyncMock()
        mock_client.hgetall.return_value = {}

        with patch.dict(os.environ, {"MULTI_TENANCY_ENABLED": "true"}, clear=False):
            clear_config_cache()

            manager = TaskManager(mock_client)

            with TenantContext.tenant_scope("acme-corp"):
                await manager.get_task("task-123")

            call_args = mock_client.hgetall.call_args
            key = call_args.args[0]
            assert "acme-corp" in key


class TestSessionModel:
    """Tests for Session dataclass."""

    def test_create_session(self):
        """Session can be created with required fields."""
        from src.orchestrator.task_manager import Session

        now = datetime.now(timezone.utc)
        session = Session(
            session_id="session-123",
            tenant_id="acme-corp",
            current_git_sha="abc123",
            active_epic_ids=["epic-1", "epic-2"],
            created_at=now,
        )

        assert session.session_id == "session-123"
        assert session.tenant_id == "acme-corp"
        assert session.status == "active"

    def test_session_serialization(self):
        """Session can be serialized to dict."""
        from src.orchestrator.task_manager import Session

        now = datetime.now(timezone.utc)
        session = Session(
            session_id="session-123",
            tenant_id="acme-corp",
            current_git_sha="abc123",
            active_epic_ids=["epic-1", "epic-2"],
            created_at=now,
        )

        data = session.to_dict()

        assert data["session_id"] == "session-123"
        assert data["active_epic_ids"] == "epic-1,epic-2"


class TestSessionManager:
    """Tests for SessionManager class."""

    @pytest.mark.asyncio
    async def test_create_session(self):
        """Create stores session in Redis hash."""
        from src.orchestrator.task_manager import Session, SessionManager

        mock_client = AsyncMock()
        mock_client.hset.return_value = True

        manager = SessionManager(mock_client)

        now = datetime.now(timezone.utc)
        session = Session(
            session_id="session-123",
            tenant_id="acme-corp",
            current_git_sha="abc123",
            active_epic_ids=[],
            created_at=now,
        )

        result = await manager.create_session(session)

        assert result.session_id == "session-123"
        mock_client.hset.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_session(self):
        """Get retrieves session from Redis hash."""
        from src.orchestrator.task_manager import SessionManager

        mock_client = AsyncMock()
        mock_client.hgetall.return_value = {
            "session_id": "session-123",
            "tenant_id": "acme-corp",
            "current_git_sha": "abc123",
            "active_epic_ids": "epic-1,epic-2",
            "created_at": "2026-01-22T10:00:00+00:00",
            "status": "active",
        }

        manager = SessionManager(mock_client)
        session = await manager.get_session("session-123")

        assert session is not None
        assert session.session_id == "session-123"
        assert session.active_epic_ids == ["epic-1", "epic-2"]

    @pytest.mark.asyncio
    async def test_update_git_sha(self):
        """Git SHA can be updated."""
        from src.orchestrator.task_manager import SessionManager

        mock_client = AsyncMock()
        mock_client.hset.return_value = True

        manager = SessionManager(mock_client)
        await manager.update_git_sha("session-123", "newsha456")

        mock_client.hset.assert_called()
        call_args = mock_client.hset.call_args
        assert "newsha456" in str(call_args)
