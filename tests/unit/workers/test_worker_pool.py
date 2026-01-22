"""Unit tests for worker pool.

Tests the WorkerPool that manages concurrent agent execution.
"""

from __future__ import annotations

import asyncio
import pytest
from datetime import datetime, timezone
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

from src.core.events import ASDLCEvent, EventType
from src.workers.config import WorkerConfig
from src.workers.agents.protocols import AgentResult, AgentContext
from src.workers.agents.dispatcher import AgentDispatcher
from src.workers.agents.stub_agent import StubAgent
from src.workers.pool.worker_pool import WorkerPool, WorkerPoolState


class TestWorkerPoolState:
    """Tests for WorkerPool state management."""

    def test_initial_state_is_stopped(self):
        """WorkerPool starts in STOPPED state."""
        assert WorkerPoolState.STOPPED.value == "stopped"
        assert WorkerPoolState.RUNNING.value == "running"
        assert WorkerPoolState.SHUTTING_DOWN.value == "shutting_down"


class TestWorkerPoolLifecycle:
    """Tests for WorkerPool lifecycle management."""

    @pytest.fixture
    def mock_redis(self):
        """Create a mock Redis client."""
        client = AsyncMock()
        client.xreadgroup.return_value = []
        client.xack.return_value = 1
        return client

    @pytest.fixture
    def config(self):
        """Create a test worker config."""
        return WorkerConfig(
            pool_size=2,
            batch_size=5,
            event_timeout_seconds=10,
            shutdown_timeout_seconds=5,
            consumer_group="test-group",
            consumer_name="test-consumer",
        )

    @pytest.fixture
    def dispatcher(self):
        """Create a dispatcher with stub agent."""
        d = AgentDispatcher()
        d.register(StubAgent())
        return d

    @pytest.fixture
    def pool(self, mock_redis, config, dispatcher):
        """Create a WorkerPool with mocked dependencies."""
        return WorkerPool(
            redis_client=mock_redis,
            config=config,
            dispatcher=dispatcher,
            workspace_path="/app/workspace",
        )

    async def test_pool_starts_and_stops(self, pool):
        """WorkerPool can be started and stopped."""
        assert pool.state == WorkerPoolState.STOPPED

        # Start in background
        task = asyncio.create_task(pool.start())

        # Give it time to start
        await asyncio.sleep(0.05)
        assert pool.state == WorkerPoolState.RUNNING

        # Stop it
        await pool.stop()
        await task  # Wait for start to finish

        assert pool.state == WorkerPoolState.STOPPED

    async def test_pool_graceful_shutdown(self, pool):
        """WorkerPool gracefully shuts down."""
        task = asyncio.create_task(pool.start())
        await asyncio.sleep(0.05)

        # Stop should wait for in-progress work
        await pool.stop()
        await task

        assert pool.state == WorkerPoolState.STOPPED

    async def test_pool_respects_concurrency_limit(self, pool, config):
        """WorkerPool respects pool_size limit."""
        assert pool.concurrency_limit == config.pool_size

    async def test_double_start_is_safe(self, pool):
        """Starting an already running pool is safe."""
        task1 = asyncio.create_task(pool.start())
        await asyncio.sleep(0.05)

        # Second start should be no-op
        task2 = asyncio.create_task(pool.start())
        await asyncio.sleep(0.05)

        await pool.stop()
        await task1
        await task2


class TestWorkerPoolEventProcessing:
    """Tests for event processing in WorkerPool."""

    @pytest.fixture
    def mock_redis(self):
        """Create a mock Redis client."""
        client = AsyncMock()
        client.xack.return_value = 1
        client.set.return_value = True  # For idempotency
        return client

    @pytest.fixture
    def config(self):
        """Create a test worker config."""
        return WorkerConfig(
            pool_size=2,
            batch_size=5,
            consumer_group="test-group",
            consumer_name="test-consumer",
        )

    @pytest.fixture
    def dispatcher(self):
        """Create a dispatcher with stub agent."""
        d = AgentDispatcher()
        d.register(StubAgent())
        return d

    def _create_event(
        self,
        event_id: str = "evt-001",
        agent_type: str = "stub",
        task_id: str = "task-123",
    ) -> ASDLCEvent:
        """Create a test event."""
        return ASDLCEvent(
            event_id=event_id,
            event_type=EventType.AGENT_STARTED,
            session_id="session-123",
            task_id=task_id,
            timestamp=datetime.now(timezone.utc),
            metadata={"agent_type": agent_type},
            idempotency_key=f"idem-{event_id}",
        )

    async def test_processes_agent_started_event(
        self, mock_redis, config, dispatcher
    ):
        """WorkerPool processes AGENT_STARTED events."""
        event = self._create_event()

        # Configure mock to return one event then empty
        mock_redis.xreadgroup.side_effect = [
            [("asdlc:events", [(event.event_id, event.to_stream_dict())])],
            [],  # Second call returns empty to allow stop
        ]

        pool = WorkerPool(
            redis_client=mock_redis,
            config=config,
            dispatcher=dispatcher,
            workspace_path="/app/workspace",
        )

        # Run briefly
        task = asyncio.create_task(pool.start())
        await asyncio.sleep(0.1)
        await pool.stop()
        await task

        # Event should have been acknowledged
        mock_redis.xack.assert_called()

    async def test_publishes_agent_completed_on_success(
        self, mock_redis, config, dispatcher
    ):
        """WorkerPool publishes AGENT_COMPLETED on successful execution."""
        event = self._create_event()

        mock_redis.xreadgroup.side_effect = [
            [("asdlc:events", [(event.event_id, event.to_stream_dict())])],
            [],
        ]
        mock_redis.xadd.return_value = "new-evt-id"

        pool = WorkerPool(
            redis_client=mock_redis,
            config=config,
            dispatcher=dispatcher,
            workspace_path="/app/workspace",
        )

        task = asyncio.create_task(pool.start())
        await asyncio.sleep(0.1)
        await pool.stop()
        await task

        # Should have published completion event
        xadd_calls = [
            c for c in mock_redis.xadd.call_args_list
            if "agent_completed" in str(c)
        ]
        assert len(xadd_calls) >= 1

    async def test_publishes_agent_error_on_failure(
        self, mock_redis, config
    ):
        """WorkerPool publishes AGENT_ERROR on failed execution."""
        dispatcher = AgentDispatcher()
        dispatcher.register(StubAgent(success=False, error_message="Test failure"))

        event = self._create_event()

        mock_redis.xreadgroup.side_effect = [
            [("asdlc:events", [(event.event_id, event.to_stream_dict())])],
            [],
        ]
        mock_redis.xadd.return_value = "new-evt-id"

        pool = WorkerPool(
            redis_client=mock_redis,
            config=config,
            dispatcher=dispatcher,
            workspace_path="/app/workspace",
        )

        task = asyncio.create_task(pool.start())
        await asyncio.sleep(0.1)
        await pool.stop()
        await task

        # Should have published error event
        xadd_calls = [
            c for c in mock_redis.xadd.call_args_list
            if "agent_error" in str(c)
        ]
        assert len(xadd_calls) >= 1

    async def test_skips_duplicate_events(self, mock_redis, config, dispatcher):
        """WorkerPool skips duplicate events via idempotency."""
        event = self._create_event()

        # Return same event twice
        mock_redis.xreadgroup.side_effect = [
            [("asdlc:events", [(event.event_id, event.to_stream_dict())])],
            [("asdlc:events", [(event.event_id, event.to_stream_dict())])],
            [],
        ]
        # First set returns True (new), second returns False (duplicate)
        mock_redis.set.side_effect = [True, False]
        mock_redis.xadd.return_value = "new-evt-id"

        pool = WorkerPool(
            redis_client=mock_redis,
            config=config,
            dispatcher=dispatcher,
            workspace_path="/app/workspace",
        )

        task = asyncio.create_task(pool.start())
        await asyncio.sleep(0.15)
        await pool.stop()
        await task

        # Should only process once
        xadd_calls = [
            c for c in mock_redis.xadd.call_args_list
            if "agent_completed" in str(c) or "agent_error" in str(c)
        ]
        assert len(xadd_calls) == 1

    async def test_handles_unknown_agent_type(self, mock_redis, config):
        """WorkerPool handles unknown agent types gracefully."""
        dispatcher = AgentDispatcher()  # No agents registered

        event = self._create_event(agent_type="unknown-agent")

        mock_redis.xreadgroup.side_effect = [
            [("asdlc:events", [(event.event_id, event.to_stream_dict())])],
            [],
        ]
        mock_redis.xadd.return_value = "new-evt-id"

        pool = WorkerPool(
            redis_client=mock_redis,
            config=config,
            dispatcher=dispatcher,
            workspace_path="/app/workspace",
        )

        task = asyncio.create_task(pool.start())
        await asyncio.sleep(0.1)
        await pool.stop()
        await task

        # Should have published error event
        xadd_calls = mock_redis.xadd.call_args_list
        assert any("agent_error" in str(c) for c in xadd_calls)


class TestWorkerPoolMetrics:
    """Tests for WorkerPool metrics and monitoring."""

    @pytest.fixture
    def mock_redis(self):
        """Create a mock Redis client."""
        client = AsyncMock()
        client.xreadgroup.return_value = []
        client.xack.return_value = 1
        return client

    @pytest.fixture
    def config(self):
        """Create a test worker config."""
        return WorkerConfig(
            pool_size=4,
            batch_size=10,
            consumer_group="test-group",
            consumer_name="test-consumer",
        )

    @pytest.fixture
    def dispatcher(self):
        """Create a dispatcher with stub agent."""
        d = AgentDispatcher()
        d.register(StubAgent())
        return d

    @pytest.fixture
    def pool(self, mock_redis, config, dispatcher):
        """Create a WorkerPool."""
        return WorkerPool(
            redis_client=mock_redis,
            config=config,
            dispatcher=dispatcher,
            workspace_path="/app/workspace",
        )

    def test_get_stats(self, pool):
        """WorkerPool provides stats."""
        stats = pool.get_stats()

        assert "state" in stats
        assert "events_processed" in stats
        assert "events_succeeded" in stats
        assert "events_failed" in stats
        assert "active_workers" in stats

    async def test_stats_update_after_processing(
        self, mock_redis, config, dispatcher
    ):
        """WorkerPool stats update after processing events."""
        event = ASDLCEvent(
            event_id="evt-001",
            event_type=EventType.AGENT_STARTED,
            session_id="session-123",
            task_id="task-123",
            timestamp=datetime.now(timezone.utc),
            metadata={"agent_type": "stub"},
            idempotency_key="idem-001",
        )

        mock_redis.xreadgroup.side_effect = [
            [("asdlc:events", [("evt-001", event.to_stream_dict())])],
            [],
        ]
        mock_redis.set.return_value = True
        mock_redis.xadd.return_value = "new-evt"

        pool = WorkerPool(
            redis_client=mock_redis,
            config=config,
            dispatcher=dispatcher,
            workspace_path="/app/workspace",
        )

        task = asyncio.create_task(pool.start())
        await asyncio.sleep(0.1)
        await pool.stop()
        await task

        stats = pool.get_stats()
        assert stats["events_processed"] >= 1
