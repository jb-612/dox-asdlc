"""Integration tests for full stream processing flow.

Tests end-to-end event publishing, consumption, and idempotency
with mocked Redis client.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.core.events import ASDLCEvent, EventType, HandlerResult


class MockHandler:
    """Test handler that tracks processed events."""

    def __init__(self, handled_types: list[EventType] | None = None):
        self.handled_types = handled_types or [EventType.TASK_CREATED]
        self.processed_events: list[ASDLCEvent] = []

    async def handle(self, event: ASDLCEvent) -> HandlerResult:
        self.processed_events.append(event)
        return HandlerResult(success=True)

    def can_handle(self, event_type: EventType) -> bool:
        return event_type in self.handled_types


class TestEndToEndPublishConsume:
    """Tests for end-to-end publish → consume flow."""

    @pytest.mark.asyncio
    async def test_published_event_is_consumed(self):
        """Event published to stream is received by consumer."""
        from src.infrastructure.redis_streams import publish_event_model
        from src.infrastructure.consumer_group import EventConsumer

        mock_client = AsyncMock()
        published_event_id = "1234-0"
        mock_client.xadd.return_value = published_event_id
        mock_client.xack.return_value = 1
        mock_client.set.return_value = True
        mock_client.exists.return_value = 0

        # Publish event
        event = ASDLCEvent(
            event_type=EventType.TASK_CREATED,
            session_id="session-123",
            task_id="task-456",
            timestamp=datetime.now(timezone.utc),
        )

        event_id = await publish_event_model(event, client=mock_client)
        assert event_id == published_event_id

        # Simulate consumer receiving the event
        mock_client.xreadgroup.return_value = [
            ["asdlc:events", [
                (published_event_id, {
                    "event_type": "task_created",
                    "session_id": "session-123",
                    "task_id": "task-456",
                    "timestamp": event.timestamp.isoformat(),
                }),
            ]]
        ]

        handler = MockHandler()
        consumer = EventConsumer(
            group_name="test-group",
            consumer_name="consumer-1",
            handler=handler,
            client=mock_client,
            stream_name="asdlc:events",
        )

        await consumer._process_once()

        # Handler should have received the event
        assert len(handler.processed_events) == 1
        processed = handler.processed_events[0]
        assert processed.session_id == "session-123"
        assert processed.task_id == "task-456"

    @pytest.mark.asyncio
    async def test_idempotent_processing_prevents_duplicates(self):
        """Same event is not processed twice."""
        from src.infrastructure.consumer_group import EventConsumer

        mock_client = AsyncMock()
        mock_client.xack.return_value = 1
        mock_client.set.return_value = True

        # First call: not processed
        # Second call: already processed
        mock_client.exists.side_effect = [0, 1]

        mock_client.xreadgroup.side_effect = [
            # First batch
            [["asdlc:events", [
                ("1234-0", {
                    "event_type": "task_created",
                    "session_id": "session-123",
                    "idempotency_key": "same-key",
                    "timestamp": "2026-01-22T10:00:00+00:00",
                }),
            ]]],
            # Second batch (same event redelivered somehow)
            [["asdlc:events", [
                ("1234-0", {
                    "event_type": "task_created",
                    "session_id": "session-123",
                    "idempotency_key": "same-key",
                    "timestamp": "2026-01-22T10:00:00+00:00",
                }),
            ]]],
        ]

        handler = MockHandler()
        consumer = EventConsumer(
            group_name="test-group",
            consumer_name="consumer-1",
            handler=handler,
            client=mock_client,
            stream_name="asdlc:events",
        )

        # Process twice
        await consumer._process_once()
        await consumer._process_once()

        # Handler should only have processed once
        assert len(handler.processed_events) == 1


class TestConsumerGroupDistribution:
    """Tests for consumer group load balancing."""

    @pytest.mark.asyncio
    async def test_multiple_consumers_see_different_messages(self):
        """Two consumers in same group receive different messages."""
        from src.infrastructure.consumer_group import EventConsumer

        # Consumer 1 gets first message
        mock_client_1 = AsyncMock()
        mock_client_1.xreadgroup.return_value = [
            ["asdlc:events", [
                ("1234-0", {
                    "event_type": "task_created",
                    "session_id": "session-1",
                    "timestamp": "2026-01-22T10:00:00+00:00",
                }),
            ]]
        ]
        mock_client_1.xack.return_value = 1
        mock_client_1.set.return_value = True
        mock_client_1.exists.return_value = 0

        # Consumer 2 gets second message
        mock_client_2 = AsyncMock()
        mock_client_2.xreadgroup.return_value = [
            ["asdlc:events", [
                ("1235-0", {
                    "event_type": "task_created",
                    "session_id": "session-2",
                    "timestamp": "2026-01-22T10:00:01+00:00",
                }),
            ]]
        ]
        mock_client_2.xack.return_value = 1
        mock_client_2.set.return_value = True
        mock_client_2.exists.return_value = 0

        handler_1 = MockHandler()
        handler_2 = MockHandler()

        consumer_1 = EventConsumer(
            group_name="shared-group",
            consumer_name="consumer-1",
            handler=handler_1,
            client=mock_client_1,
            stream_name="asdlc:events",
        )

        consumer_2 = EventConsumer(
            group_name="shared-group",
            consumer_name="consumer-2",
            handler=handler_2,
            client=mock_client_2,
            stream_name="asdlc:events",
        )

        await consumer_1._process_once()
        await consumer_2._process_once()

        # Each consumer should have processed different events
        assert len(handler_1.processed_events) == 1
        assert len(handler_2.processed_events) == 1
        assert handler_1.processed_events[0].session_id == "session-1"
        assert handler_2.processed_events[0].session_id == "session-2"


class TestTenantIsolation:
    """Tests for tenant isolation in stream processing."""

    @pytest.mark.asyncio
    async def test_events_go_to_tenant_stream(self):
        """Events are published to tenant-specific stream."""
        from src.infrastructure.redis_streams import publish_event_model, get_stream_name
        from src.core.tenant import TenantContext
        from src.core.config import clear_config_cache

        mock_client = AsyncMock()
        mock_client.xadd.return_value = "1234-0"

        event = ASDLCEvent(
            event_type=EventType.TASK_CREATED,
            session_id="session-123",
            timestamp=datetime.now(timezone.utc),
        )

        with patch.dict(os.environ, {"MULTI_TENANCY_ENABLED": "true"}, clear=False):
            clear_config_cache()

            with TenantContext.tenant_scope("acme-corp"):
                stream_name = get_stream_name()
                await publish_event_model(event, client=mock_client)

        # Verify tenant-prefixed stream was used
        assert "acme-corp" in stream_name
        call_args = mock_client.xadd.call_args
        actual_stream = call_args.args[0]
        assert "acme-corp" in actual_stream


class TestRecoveryFlow:
    """Tests for recovery after simulated crash."""

    @pytest.mark.asyncio
    async def test_pending_events_recovered_on_restart(self):
        """Pending events are processed on consumer restart."""
        from src.infrastructure.consumer_group import EventConsumer

        mock_client = AsyncMock()

        # Simulate pending events from previous run
        mock_client.xpending_range.return_value = [
            {
                "message_id": "1234-0",
                "consumer": "dead-consumer",
                "time_since_delivered": 120000,  # 2 minutes idle
                "times_delivered": 1,
            },
        ]

        # XCLAIM returns the event data
        mock_client.xclaim.return_value = [
            ("1234-0", {
                "event_type": "task_created",
                "session_id": "session-123",
                "timestamp": "2026-01-22T10:00:00+00:00",
            }),
        ]
        mock_client.xack.return_value = 1
        mock_client.set.return_value = True
        mock_client.exists.return_value = 0

        handler = MockHandler()
        consumer = EventConsumer(
            group_name="test-group",
            consumer_name="new-consumer",
            handler=handler,
            client=mock_client,
            stream_name="asdlc:events",
        )

        result = await consumer.process_pending()

        # Event should have been claimed and processed
        assert result.claimed == 1
        assert result.processed == 1
        assert len(handler.processed_events) == 1
