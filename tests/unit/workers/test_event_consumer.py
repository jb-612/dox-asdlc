"""Unit tests for event consumer.

Tests the EventConsumer that reads AGENT_STARTED events from Redis Streams.
"""

from __future__ import annotations

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from src.core.events import ASDLCEvent, EventType
from src.workers.pool.event_consumer import EventConsumer
from src.workers.config import WorkerConfig


class TestEventConsumer:
    """Tests for EventConsumer class."""

    @pytest.fixture
    def mock_redis(self):
        """Create a mock Redis client."""
        client = AsyncMock()
        return client

    @pytest.fixture
    def config(self):
        """Create a test worker config."""
        return WorkerConfig(
            pool_size=4,
            batch_size=5,
            consumer_group="test-group",
            consumer_name="test-consumer",
        )

    @pytest.fixture
    def consumer(self, mock_redis, config):
        """Create an EventConsumer with mocked Redis."""
        return EventConsumer(client=mock_redis, config=config)

    async def test_consumer_initialization(self, consumer, config):
        """EventConsumer initializes with config values."""
        assert consumer.group_name == config.consumer_group
        assert consumer.consumer_name == config.consumer_name
        assert consumer.batch_size == config.batch_size

    async def test_read_events_returns_agent_started_events(
        self, consumer, mock_redis
    ):
        """EventConsumer reads AGENT_STARTED events from stream."""
        # Setup mock to return events
        event_data = {
            "event_type": "agent_started",
            "session_id": "session-123",
            "task_id": "task-456",
            "timestamp": "2026-01-22T10:00:00+00:00",
            "metadata": '{"agent_type": "coding"}',
        }
        mock_redis.xreadgroup.return_value = [
            ("asdlc:events", [("evt-001", event_data)])
        ]

        events = await consumer.read_events()

        assert len(events) == 1
        assert events[0].event_type == EventType.AGENT_STARTED
        assert events[0].session_id == "session-123"
        assert events[0].task_id == "task-456"

    async def test_read_events_filters_non_agent_started(
        self, consumer, mock_redis
    ):
        """EventConsumer filters out non-AGENT_STARTED events."""
        # Mock acknowledge for non-AGENT_STARTED events
        mock_redis.xack.return_value = 1

        # Mix of event types
        events_data = [
            (
                "evt-001",
                {
                    "event_type": "agent_started",
                    "session_id": "session-1",
                    "task_id": "task-1",
                    "timestamp": "2026-01-22T10:00:00+00:00",
                },
            ),
            (
                "evt-002",
                {
                    "event_type": "task_completed",  # Not AGENT_STARTED
                    "session_id": "session-2",
                    "task_id": "task-2",
                    "timestamp": "2026-01-22T10:01:00+00:00",
                },
            ),
            (
                "evt-003",
                {
                    "event_type": "agent_started",
                    "session_id": "session-3",
                    "task_id": "task-3",
                    "timestamp": "2026-01-22T10:02:00+00:00",
                },
            ),
        ]
        mock_redis.xreadgroup.return_value = [("asdlc:events", events_data)]

        events = await consumer.read_events()

        # Should only return AGENT_STARTED events
        assert len(events) == 2
        assert all(e.event_type == EventType.AGENT_STARTED for e in events)

    async def test_read_events_empty_stream(self, consumer, mock_redis):
        """EventConsumer handles empty stream."""
        mock_redis.xreadgroup.return_value = []

        events = await consumer.read_events()

        assert events == []

    async def test_read_events_with_timeout(self, consumer, mock_redis):
        """EventConsumer passes timeout to xreadgroup."""
        mock_redis.xreadgroup.return_value = []

        await consumer.read_events(block_ms=5000)

        # Verify block timeout was passed
        call_kwargs = mock_redis.xreadgroup.call_args.kwargs
        assert call_kwargs.get("block") == 5000

    async def test_acknowledge_event(self, consumer, mock_redis):
        """EventConsumer acknowledges processed events."""
        mock_redis.xack.return_value = 1

        result = await consumer.acknowledge("evt-001")

        assert result is True
        mock_redis.xack.assert_called_once()

    async def test_acknowledge_event_failure(self, consumer, mock_redis):
        """EventConsumer handles acknowledgment failure."""
        mock_redis.xack.return_value = 0

        result = await consumer.acknowledge("evt-nonexistent")

        assert result is False

    async def test_get_pending_count(self, consumer, mock_redis):
        """EventConsumer returns pending event count."""
        mock_redis.xpending.return_value = {
            "pending": 5,
            "min": "evt-001",
            "max": "evt-005",
            "consumers": [{"name": "test-consumer", "pending": 5}],
        }

        count = await consumer.get_pending_count()

        assert count == 5

    async def test_claim_stale_events(self, consumer, mock_redis):
        """EventConsumer claims stale events from dead consumers."""
        # Mock pending entries
        mock_redis.xpending_range.return_value = [
            {
                "message_id": "evt-001",
                "consumer": "dead-consumer",
                "time_since_delivered": 120000,  # 2 minutes
                "times_delivered": 1,
            }
        ]
        # Mock claim result
        mock_redis.xclaim.return_value = [
            (
                "evt-001",
                {
                    "event_type": "agent_started",
                    "session_id": "session-123",
                    "task_id": "task-456",
                    "timestamp": "2026-01-22T10:00:00+00:00",
                },
            )
        ]

        events = await consumer.claim_stale_events(min_idle_ms=60000)

        assert len(events) == 1
        assert events[0].event_id == "evt-001"


class TestEventConsumerTenantAware:
    """Tests for tenant-aware event consumption."""

    @pytest.fixture
    def mock_redis(self):
        """Create a mock Redis client."""
        return AsyncMock()

    @pytest.fixture
    def config(self):
        """Create a test worker config."""
        return WorkerConfig(
            consumer_group="test-group",
            consumer_name="test-consumer",
        )

    async def test_read_events_uses_tenant_stream(self, mock_redis, config):
        """EventConsumer uses tenant-prefixed stream when tenant context is set."""
        consumer = EventConsumer(
            client=mock_redis,
            config=config,
            tenant_id="acme-corp",
        )
        mock_redis.xreadgroup.return_value = []

        await consumer.read_events()

        # Should read from tenant-prefixed stream
        call_kwargs = mock_redis.xreadgroup.call_args.kwargs
        streams = call_kwargs.get("streams", {})
        stream_name = list(streams.keys())[0] if streams else None
        assert stream_name == "tenant:acme-corp:asdlc:events"
