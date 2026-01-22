"""Unit tests for worker idempotency tracker.

Tests the WorkerIdempotencyTracker that prevents duplicate event processing.
"""

from __future__ import annotations

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

from src.core.events import ASDLCEvent, EventType
from src.workers.pool.idempotency import WorkerIdempotencyTracker


class TestWorkerIdempotencyTracker:
    """Tests for WorkerIdempotencyTracker class."""

    @pytest.fixture
    def mock_redis(self):
        """Create a mock Redis client."""
        return AsyncMock()

    @pytest.fixture
    def tracker(self, mock_redis):
        """Create a WorkerIdempotencyTracker with mocked Redis."""
        return WorkerIdempotencyTracker(client=mock_redis)

    def _create_event(
        self,
        event_id: str = "evt-001",
        idempotency_key: str | None = None,
    ) -> ASDLCEvent:
        """Create a test event."""
        return ASDLCEvent(
            event_id=event_id,
            event_type=EventType.AGENT_STARTED,
            session_id="session-123",
            task_id="task-456",
            timestamp=datetime.now(timezone.utc),
            idempotency_key=idempotency_key or f"idem-{event_id}",
        )

    async def test_is_processed_returns_false_for_new_event(
        self, tracker, mock_redis
    ):
        """Tracker returns False for events not yet processed."""
        mock_redis.exists.return_value = 0
        event = self._create_event()

        result = await tracker.is_processed(event)

        assert result is False

    async def test_is_processed_returns_true_for_processed_event(
        self, tracker, mock_redis
    ):
        """Tracker returns True for already processed events."""
        mock_redis.exists.return_value = 1
        event = self._create_event()

        result = await tracker.is_processed(event)

        assert result is True

    async def test_mark_processed_sets_redis_key(self, tracker, mock_redis):
        """Tracker sets Redis key when marking event as processed."""
        mock_redis.set.return_value = True
        event = self._create_event()

        await tracker.mark_processed(event)

        mock_redis.set.assert_called_once()
        # Verify the key includes the idempotency key
        call_args = mock_redis.set.call_args
        key = call_args[0][0]
        assert "idem-evt-001" in key

    async def test_mark_processed_sets_ttl(self, tracker, mock_redis):
        """Tracker sets TTL when marking event as processed."""
        mock_redis.set.return_value = True
        event = self._create_event()

        await tracker.mark_processed(event)

        call_kwargs = mock_redis.set.call_args.kwargs
        assert "ex" in call_kwargs
        assert call_kwargs["ex"] > 0

    async def test_uses_custom_ttl(self, mock_redis):
        """Tracker uses custom TTL when provided."""
        custom_ttl = 3600  # 1 hour
        tracker = WorkerIdempotencyTracker(
            client=mock_redis, ttl_seconds=custom_ttl
        )
        mock_redis.set.return_value = True
        event = self._create_event()

        await tracker.mark_processed(event)

        call_kwargs = mock_redis.set.call_args.kwargs
        assert call_kwargs["ex"] == custom_ttl

    async def test_uses_event_idempotency_key(self, tracker, mock_redis):
        """Tracker uses the event's idempotency key."""
        mock_redis.exists.return_value = 0
        event = self._create_event(idempotency_key="custom-key-123")

        await tracker.is_processed(event)

        call_args = mock_redis.exists.call_args
        key = call_args[0][0]
        assert "custom-key-123" in key

    async def test_generates_idempotency_key_if_missing(
        self, tracker, mock_redis
    ):
        """Tracker generates idempotency key if event doesn't have one."""
        mock_redis.exists.return_value = 0
        event = ASDLCEvent(
            event_id="evt-no-idem",
            event_type=EventType.AGENT_STARTED,
            session_id="session-123",
            task_id="task-456",
            timestamp=datetime.now(timezone.utc),
            idempotency_key=None,  # No idempotency key
        )

        await tracker.is_processed(event)

        # Should still check Redis with a generated key
        mock_redis.exists.assert_called_once()

    async def test_check_and_mark_atomic_operation(self, tracker, mock_redis):
        """check_and_mark_if_new atomically checks and marks."""
        mock_redis.set.return_value = True  # SET NX returns True if key was set
        event = self._create_event()

        was_new = await tracker.check_and_mark_if_new(event)

        assert was_new is True
        # Should use SET NX (set if not exists)
        call_kwargs = mock_redis.set.call_args.kwargs
        assert call_kwargs.get("nx") is True

    async def test_check_and_mark_returns_false_for_duplicate(
        self, tracker, mock_redis
    ):
        """check_and_mark_if_new returns False for duplicates."""
        mock_redis.set.return_value = False  # SET NX returns False if key existed
        event = self._create_event()

        was_new = await tracker.check_and_mark_if_new(event)

        assert was_new is False


class TestWorkerIdempotencyTrackerTenantAware:
    """Tests for tenant-aware idempotency tracking."""

    @pytest.fixture
    def mock_redis(self):
        """Create a mock Redis client."""
        return AsyncMock()

    async def test_uses_tenant_prefix(self, mock_redis):
        """Tracker includes tenant prefix in keys."""
        tracker = WorkerIdempotencyTracker(
            client=mock_redis, tenant_id="acme-corp"
        )
        mock_redis.exists.return_value = 0
        event = ASDLCEvent(
            event_id="evt-001",
            event_type=EventType.AGENT_STARTED,
            session_id="session-123",
            task_id="task-456",
            timestamp=datetime.now(timezone.utc),
            idempotency_key="idem-001",
        )

        await tracker.is_processed(event)

        call_args = mock_redis.exists.call_args
        key = call_args[0][0]
        assert "tenant:acme-corp:" in key
