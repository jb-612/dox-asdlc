"""Integration tests for worker event cycle.

Tests the full event cycle: AGENT_STARTED → WorkerPool → Agent → AGENT_COMPLETED/AGENT_ERROR
with mocked Redis client. Full integration tests with real Redis require Docker.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.core.events import ASDLCEvent, EventType
from src.workers.agents.dispatcher import AgentDispatcher
from src.workers.agents.protocols import AgentContext, AgentResult
from src.workers.agents.stub_agent import StubAgent
from src.workers.config import WorkerConfig
from src.workers.pool.worker_pool import WorkerPool, WorkerPoolState


class TestWorkerEventCycle:
    """Tests for full worker event processing cycle."""

    @pytest.fixture
    def mock_redis(self) -> AsyncMock:
        """Create a mock Redis client."""
        mock = AsyncMock()
        mock.xreadgroup.return_value = []
        mock.xadd.return_value = "result-event-id"
        mock.xack.return_value = 1
        mock.set.return_value = True
        mock.exists.return_value = 0
        return mock

    @pytest.fixture
    def worker_config(self) -> WorkerConfig:
        """Create test worker configuration."""
        return WorkerConfig(
            pool_size=2,
            batch_size=5,
            event_timeout_seconds=30,
            shutdown_timeout_seconds=5,
            consumer_group="test-handlers",
            consumer_name="test-consumer",
        )

    @pytest.fixture
    def dispatcher(self) -> AgentDispatcher:
        """Create dispatcher with stub agent."""
        dispatcher = AgentDispatcher()
        dispatcher.register(StubAgent())
        return dispatcher

    @pytest.mark.asyncio
    async def test_agent_started_produces_agent_completed(
        self, mock_redis: AsyncMock, worker_config: WorkerConfig, dispatcher: AgentDispatcher
    ) -> None:
        """AGENT_STARTED event produces AGENT_COMPLETED on success."""
        # Set up mock to return an AGENT_STARTED event then empty
        event_id = "1234567890-0"
        agent_event_data = {
            "event_type": "agent_started",
            "session_id": "session-123",
            "task_id": "task-456",
            "epic_id": "epic-1",
            "git_sha": "abc123",
            "mode": "normal",
            "tenant_id": "default",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "metadata": '{"agent_type": "stub"}',
        }

        call_count = 0

        async def mock_xreadgroup(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return [["asdlc:events", [(event_id, agent_event_data)]]]
            return []

        mock_redis.xreadgroup.side_effect = mock_xreadgroup

        pool = WorkerPool(
            redis_client=mock_redis,
            config=worker_config,
            dispatcher=dispatcher,
            workspace_path="/tmp/test-workspace",
        )

        # Run pool briefly
        async def run_and_stop():
            task = asyncio.create_task(pool.start())
            await asyncio.sleep(0.1)
            await pool.stop()
            try:
                await asyncio.wait_for(task, timeout=1.0)
            except asyncio.CancelledError:
                pass

        await run_and_stop()

        # Verify AGENT_COMPLETED was published
        xadd_calls = [c for c in mock_redis.xadd.call_args_list]
        assert len(xadd_calls) >= 1

        # Check the published event type
        published_data = xadd_calls[0].args[1]
        assert published_data["event_type"] == "agent_completed"
        assert published_data["session_id"] == "session-123"
        assert published_data["task_id"] == "task-456"

        # Verify metrics
        stats = pool.get_stats()
        assert stats["events_processed"] == 1
        assert stats["events_succeeded"] == 1
        assert stats["events_failed"] == 0

    @pytest.mark.asyncio
    async def test_agent_started_produces_agent_error_on_failure(
        self, mock_redis: AsyncMock, worker_config: WorkerConfig
    ) -> None:
        """AGENT_STARTED event produces AGENT_ERROR on agent failure."""
        # Register a stub agent configured to fail
        dispatcher = AgentDispatcher()
        failing_agent = StubAgent(
            success=False,
            error_message="Simulated failure",
            should_retry=True,
        )
        dispatcher.register(failing_agent)

        event_id = "1234567890-0"
        agent_event_data = {
            "event_type": "agent_started",
            "session_id": "session-fail",
            "task_id": "task-fail",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "metadata": '{"agent_type": "stub"}',
        }

        call_count = 0

        async def mock_xreadgroup(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return [["asdlc:events", [(event_id, agent_event_data)]]]
            return []

        mock_redis.xreadgroup.side_effect = mock_xreadgroup

        pool = WorkerPool(
            redis_client=mock_redis,
            config=worker_config,
            dispatcher=dispatcher,
            workspace_path="/tmp/test-workspace",
        )

        async def run_and_stop():
            task = asyncio.create_task(pool.start())
            await asyncio.sleep(0.1)
            await pool.stop()
            try:
                await asyncio.wait_for(task, timeout=1.0)
            except asyncio.CancelledError:
                pass

        await run_and_stop()

        # Verify AGENT_ERROR was published
        xadd_calls = [c for c in mock_redis.xadd.call_args_list]
        assert len(xadd_calls) >= 1

        published_data = xadd_calls[0].args[1]
        assert published_data["event_type"] == "agent_error"
        assert published_data["session_id"] == "session-fail"

        # Verify metrics
        stats = pool.get_stats()
        assert stats["events_failed"] == 1

    @pytest.mark.asyncio
    async def test_unknown_agent_type_produces_error(
        self, mock_redis: AsyncMock, worker_config: WorkerConfig, dispatcher: AgentDispatcher
    ) -> None:
        """Event with unknown agent_type produces AGENT_ERROR."""
        event_id = "1234567890-0"
        agent_event_data = {
            "event_type": "agent_started",
            "session_id": "session-unknown",
            "task_id": "task-unknown",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "metadata": '{"agent_type": "nonexistent_agent"}',
        }

        call_count = 0

        async def mock_xreadgroup(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return [["asdlc:events", [(event_id, agent_event_data)]]]
            return []

        mock_redis.xreadgroup.side_effect = mock_xreadgroup

        pool = WorkerPool(
            redis_client=mock_redis,
            config=worker_config,
            dispatcher=dispatcher,
            workspace_path="/tmp/test-workspace",
        )

        async def run_and_stop():
            task = asyncio.create_task(pool.start())
            await asyncio.sleep(0.1)
            await pool.stop()
            try:
                await asyncio.wait_for(task, timeout=1.0)
            except asyncio.CancelledError:
                pass

        await run_and_stop()

        # Verify AGENT_ERROR was published
        xadd_calls = [c for c in mock_redis.xadd.call_args_list]
        assert len(xadd_calls) >= 1

        published_data = xadd_calls[0].args[1]
        assert published_data["event_type"] == "agent_error"

        stats = pool.get_stats()
        assert stats["events_failed"] == 1


class TestIdempotentProcessing:
    """Tests for idempotent event processing in worker pool."""

    @pytest.fixture
    def mock_redis(self) -> AsyncMock:
        """Create a mock Redis client."""
        mock = AsyncMock()
        mock.xreadgroup.return_value = []
        mock.xadd.return_value = "result-event-id"
        mock.xack.return_value = 1
        return mock

    @pytest.fixture
    def worker_config(self) -> WorkerConfig:
        """Create test worker configuration."""
        return WorkerConfig(
            pool_size=2,
            batch_size=5,
            consumer_group="test-handlers",
            consumer_name="test-consumer",
        )

    @pytest.mark.asyncio
    async def test_duplicate_event_not_processed_twice(
        self, mock_redis: AsyncMock, worker_config: WorkerConfig
    ) -> None:
        """Same event delivered twice is only processed once."""
        dispatcher = AgentDispatcher()
        dispatcher.register(StubAgent())

        event_id = "1234567890-0"
        agent_event_data = {
            "event_type": "agent_started",
            "session_id": "session-dup",
            "task_id": "task-dup",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "metadata": '{"agent_type": "stub"}',
        }

        call_count = 0

        async def mock_xreadgroup(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count <= 2:  # Return same event twice
                return [["asdlc:events", [(event_id, agent_event_data)]]]
            return []

        mock_redis.xreadgroup.side_effect = mock_xreadgroup

        # First check returns False (not processed), second returns True (already processed)
        mock_redis.set.side_effect = [True, False]

        pool = WorkerPool(
            redis_client=mock_redis,
            config=worker_config,
            dispatcher=dispatcher,
            workspace_path="/tmp/test-workspace",
        )

        async def run_and_stop():
            task = asyncio.create_task(pool.start())
            await asyncio.sleep(0.2)
            await pool.stop()
            try:
                await asyncio.wait_for(task, timeout=1.0)
            except asyncio.CancelledError:
                pass

        await run_and_stop()

        # Only one AGENT_COMPLETED should be published (duplicate skipped)
        xadd_calls = [
            c for c in mock_redis.xadd.call_args_list
            if c.args[1].get("event_type") in ("agent_completed", "agent_error")
        ]
        assert len(xadd_calls) == 1

        stats = pool.get_stats()
        assert stats["events_processed"] == 1


class TestConcurrencyControl:
    """Tests for worker pool concurrency control."""

    @pytest.fixture
    def mock_redis(self) -> AsyncMock:
        """Create a mock Redis client."""
        mock = AsyncMock()
        mock.xreadgroup.return_value = []
        mock.xadd.return_value = "result-event-id"
        mock.xack.return_value = 1
        mock.set.return_value = True
        mock.exists.return_value = 0
        return mock

    @pytest.mark.asyncio
    async def test_pool_respects_concurrency_limit(self, mock_redis: AsyncMock) -> None:
        """Worker pool respects pool_size limit."""
        config = WorkerConfig(
            pool_size=2,  # Only 2 concurrent
            batch_size=10,
            consumer_group="test-handlers",
            consumer_name="test-consumer",
        )

        dispatcher = AgentDispatcher()
        # Use slow agent to test concurrency
        slow_agent = StubAgent(delay_seconds=0.5)
        dispatcher.register(slow_agent)

        # Return 5 events at once
        events = [
            (f"event-{i}", {
                "event_type": "agent_started",
                "session_id": f"session-{i}",
                "task_id": f"task-{i}",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "metadata": '{"agent_type": "stub"}',
            })
            for i in range(5)
        ]

        call_count = 0

        async def mock_xreadgroup(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return [["asdlc:events", events]]
            return []

        mock_redis.xreadgroup.side_effect = mock_xreadgroup

        pool = WorkerPool(
            redis_client=mock_redis,
            config=config,
            dispatcher=dispatcher,
            workspace_path="/tmp/test-workspace",
        )

        # Track max concurrent workers
        max_active = 0

        original_get_stats = pool.get_stats

        def tracking_get_stats():
            nonlocal max_active
            stats = original_get_stats()
            if stats["active_workers"] > max_active:
                max_active = stats["active_workers"]
            return stats

        pool.get_stats = tracking_get_stats

        async def run_and_stop():
            task = asyncio.create_task(pool.start())
            # Check active workers during execution
            for _ in range(10):
                await asyncio.sleep(0.1)
                pool.get_stats()
            await pool.stop()
            try:
                await asyncio.wait_for(task, timeout=5.0)
            except asyncio.CancelledError:
                pass

        await run_and_stop()

        # Verify concurrency was limited
        assert max_active <= config.pool_size


class TestTenantIsolation:
    """Tests for multi-tenant worker processing."""

    @pytest.fixture
    def mock_redis(self) -> AsyncMock:
        """Create a mock Redis client."""
        mock = AsyncMock()
        mock.xreadgroup.return_value = []
        mock.xadd.return_value = "result-event-id"
        mock.xack.return_value = 1
        mock.set.return_value = True
        mock.exists.return_value = 0
        return mock

    @pytest.fixture
    def worker_config(self) -> WorkerConfig:
        """Create test worker configuration."""
        return WorkerConfig(
            pool_size=2,
            batch_size=5,
            consumer_group="test-handlers",
            consumer_name="test-consumer",
        )

    @pytest.mark.asyncio
    async def test_tenant_context_passed_to_agent(
        self, mock_redis: AsyncMock, worker_config: WorkerConfig
    ) -> None:
        """Tenant ID is correctly passed to agent context."""
        # Create custom agent that captures context
        captured_contexts: list[AgentContext] = []

        class ContextCapturingAgent:
            @property
            def agent_type(self) -> str:
                return "capturing"

            async def execute(
                self, context: AgentContext, event_metadata: dict
            ) -> AgentResult:
                captured_contexts.append(context)
                return AgentResult(
                    agent_type="capturing",
                    success=True,
                )

        dispatcher = AgentDispatcher()
        dispatcher.register(ContextCapturingAgent())

        event_id = "1234567890-0"
        agent_event_data = {
            "event_type": "agent_started",
            "session_id": "session-tenant",
            "task_id": "task-tenant",
            "tenant_id": "acme-corp",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "metadata": '{"agent_type": "capturing"}',
        }

        call_count = 0

        async def mock_xreadgroup(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return [["asdlc:events", [(event_id, agent_event_data)]]]
            return []

        mock_redis.xreadgroup.side_effect = mock_xreadgroup

        pool = WorkerPool(
            redis_client=mock_redis,
            config=worker_config,
            dispatcher=dispatcher,
            workspace_path="/tmp/test-workspace",
            tenant_id="acme-corp",
        )

        async def run_and_stop():
            task = asyncio.create_task(pool.start())
            await asyncio.sleep(0.1)
            await pool.stop()
            try:
                await asyncio.wait_for(task, timeout=1.0)
            except asyncio.CancelledError:
                pass

        await run_and_stop()

        # Verify tenant was passed to agent
        assert len(captured_contexts) == 1
        assert captured_contexts[0].tenant_id == "acme-corp"


class TestGracefulShutdown:
    """Tests for graceful shutdown behavior."""

    @pytest.fixture
    def mock_redis(self) -> AsyncMock:
        """Create a mock Redis client."""
        mock = AsyncMock()
        mock.xreadgroup.return_value = []
        mock.xadd.return_value = "result-event-id"
        mock.xack.return_value = 1
        mock.set.return_value = True
        mock.exists.return_value = 0
        return mock

    @pytest.mark.asyncio
    async def test_shutdown_waits_for_active_tasks(self, mock_redis: AsyncMock) -> None:
        """Shutdown waits for in-progress tasks to complete."""
        config = WorkerConfig(
            pool_size=2,
            batch_size=5,
            shutdown_timeout_seconds=5,
            consumer_group="test-handlers",
            consumer_name="test-consumer",
        )

        dispatcher = AgentDispatcher()
        # Use slow agent
        slow_agent = StubAgent(delay_seconds=0.3)
        dispatcher.register(slow_agent)

        event_id = "1234567890-0"
        agent_event_data = {
            "event_type": "agent_started",
            "session_id": "session-shutdown",
            "task_id": "task-shutdown",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "metadata": '{"agent_type": "stub"}',
        }

        call_count = 0

        async def mock_xreadgroup(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return [["asdlc:events", [(event_id, agent_event_data)]]]
            return []

        mock_redis.xreadgroup.side_effect = mock_xreadgroup

        pool = WorkerPool(
            redis_client=mock_redis,
            config=config,
            dispatcher=dispatcher,
            workspace_path="/tmp/test-workspace",
        )

        task = asyncio.create_task(pool.start())

        # Wait for event to start processing
        await asyncio.sleep(0.05)

        # Initiate shutdown while task is still running
        await pool.stop()

        # Pool should have completed the task
        stats = pool.get_stats()
        assert stats["events_processed"] == 1

        try:
            await asyncio.wait_for(task, timeout=1.0)
        except asyncio.CancelledError:
            pass

    @pytest.mark.asyncio
    async def test_shutdown_state_transitions(self, mock_redis: AsyncMock) -> None:
        """Shutdown transitions through correct states."""
        config = WorkerConfig(
            pool_size=2,
            batch_size=5,
            consumer_group="test-handlers",
            consumer_name="test-consumer",
        )

        dispatcher = AgentDispatcher()
        dispatcher.register(StubAgent())

        pool = WorkerPool(
            redis_client=mock_redis,
            config=config,
            dispatcher=dispatcher,
            workspace_path="/tmp/test-workspace",
        )

        # Initially stopped
        assert pool.state == WorkerPoolState.STOPPED

        task = asyncio.create_task(pool.start())
        await asyncio.sleep(0.05)

        # Running
        assert pool.state == WorkerPoolState.RUNNING

        await pool.stop()

        # After stop() is called, state is SHUTTING_DOWN
        # State transitions to STOPPED when start() task completes
        try:
            await asyncio.wait_for(task, timeout=1.0)
        except asyncio.CancelledError:
            pass

        # Now state should be STOPPED
        assert pool.state == WorkerPoolState.STOPPED
