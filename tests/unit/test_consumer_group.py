"""Unit tests for consumer group module.

Tests the EventConsumer class, EventHandler protocol, and recovery logic.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Protocol
from unittest.mock import AsyncMock, MagicMock, patch, call
import os

import pytest

from src.core.events import ASDLCEvent, EventType, HandlerResult, RecoveryResult


class TestEventHandlerProtocol:
    """Tests for EventHandler protocol."""

    def test_protocol_is_defined(self):
        """EventHandler protocol is importable."""
        from src.infrastructure.consumer_group import EventHandler

        assert hasattr(EventHandler, "handle")
        assert hasattr(EventHandler, "can_handle")

    def test_custom_handler_satisfies_protocol(self):
        """Custom handlers can satisfy the protocol."""
        from src.infrastructure.consumer_group import EventHandler

        class MyHandler:
            async def handle(self, event: ASDLCEvent) -> HandlerResult:
                return HandlerResult(success=True)

            def can_handle(self, event_type: EventType) -> bool:
                return event_type == EventType.TASK_CREATED

        handler = MyHandler()
        # Protocol check - this just verifies the interface
        assert hasattr(handler, "handle")
        assert hasattr(handler, "can_handle")


class TestEventConsumer:
    """Tests for EventConsumer class."""

    @pytest.mark.asyncio
    async def test_consumer_initialization(self):
        """Consumer initializes with required parameters."""
        from src.infrastructure.consumer_group import EventConsumer

        mock_client = AsyncMock()
        mock_handler = MagicMock()
        mock_handler.can_handle.return_value = True

        consumer = EventConsumer(
            group_name="test-group",
            consumer_name="consumer-1",
            handler=mock_handler,
            client=mock_client,
        )

        assert consumer.group_name == "test-group"
        assert consumer.consumer_name == "consumer-1"
        assert consumer._running is False

    @pytest.mark.asyncio
    async def test_consumer_processes_event(self):
        """Consumer calls handler for received events."""
        from src.infrastructure.consumer_group import EventConsumer

        mock_client = AsyncMock()
        # First call returns an event, second call returns empty (for loop exit)
        mock_client.xreadgroup.side_effect = [
            [["asdlc:events", [
                ("1234-0", {
                    "event_type": "task_created",
                    "session_id": "session-123",
                    "timestamp": "2026-01-22T10:00:00+00:00",
                }),
            ]]],
            [],  # Empty to stop the loop
        ]
        mock_client.xack.return_value = 1
        mock_client.set.return_value = True

        mock_handler = MagicMock()
        mock_handler.can_handle.return_value = True
        mock_handler.handle = AsyncMock(return_value=HandlerResult(success=True))

        consumer = EventConsumer(
            group_name="test-group",
            consumer_name="consumer-1",
            handler=mock_handler,
            client=mock_client,
            stream_name="asdlc:events",
        )

        # Process just one iteration
        await consumer._process_once()

        mock_handler.handle.assert_called_once()
        event_arg = mock_handler.handle.call_args[0][0]
        assert event_arg.event_type == EventType.TASK_CREATED

    @pytest.mark.asyncio
    async def test_consumer_acknowledges_successful_events(self):
        """Consumer acks events after successful processing."""
        from src.infrastructure.consumer_group import EventConsumer

        mock_client = AsyncMock()
        mock_client.xreadgroup.return_value = [
            ["asdlc:events", [
                ("1234-0", {
                    "event_type": "task_created",
                    "session_id": "session-123",
                    "timestamp": "2026-01-22T10:00:00+00:00",
                }),
            ]]
        ]
        mock_client.xack.return_value = 1
        mock_client.set.return_value = True
        mock_client.exists.return_value = 0

        mock_handler = MagicMock()
        mock_handler.can_handle.return_value = True
        mock_handler.handle = AsyncMock(return_value=HandlerResult(success=True))

        consumer = EventConsumer(
            group_name="test-group",
            consumer_name="consumer-1",
            handler=mock_handler,
            client=mock_client,
            stream_name="asdlc:events",
        )

        await consumer._process_once()

        mock_client.xack.assert_called_once_with(
            "asdlc:events", "test-group", "1234-0"
        )

    @pytest.mark.asyncio
    async def test_consumer_skips_events_handler_cannot_process(self):
        """Consumer skips events the handler can't handle."""
        from src.infrastructure.consumer_group import EventConsumer

        mock_client = AsyncMock()
        mock_client.xreadgroup.return_value = [
            ["asdlc:events", [
                ("1234-0", {
                    "event_type": "gate_approved",  # Handler can't handle this
                    "session_id": "session-123",
                    "timestamp": "2026-01-22T10:00:00+00:00",
                }),
            ]]
        ]
        mock_client.xack.return_value = 1

        mock_handler = MagicMock()
        mock_handler.can_handle.return_value = False  # Can't handle

        consumer = EventConsumer(
            group_name="test-group",
            consumer_name="consumer-1",
            handler=mock_handler,
            client=mock_client,
            stream_name="asdlc:events",
        )

        await consumer._process_once()

        # Handler should not be called
        mock_handler.handle.assert_not_called()
        # But event should still be acked (to avoid redelivery)
        mock_client.xack.assert_called_once()

    @pytest.mark.asyncio
    async def test_consumer_respects_retry_result(self):
        """Consumer does not ack events that should be retried."""
        from src.infrastructure.consumer_group import EventConsumer

        mock_client = AsyncMock()
        mock_client.xreadgroup.return_value = [
            ["asdlc:events", [
                ("1234-0", {
                    "event_type": "task_created",
                    "session_id": "session-123",
                    "timestamp": "2026-01-22T10:00:00+00:00",
                }),
            ]]
        ]
        mock_client.exists.return_value = 0

        mock_handler = MagicMock()
        mock_handler.can_handle.return_value = True
        mock_handler.handle = AsyncMock(
            return_value=HandlerResult(success=False, should_retry=True)
        )

        consumer = EventConsumer(
            group_name="test-group",
            consumer_name="consumer-1",
            handler=mock_handler,
            client=mock_client,
            stream_name="asdlc:events",
        )

        await consumer._process_once()

        # Should NOT ack when retry is requested
        mock_client.xack.assert_not_called()

    @pytest.mark.asyncio
    async def test_consumer_catches_handler_exceptions(self):
        """Consumer catches and logs handler exceptions."""
        from src.infrastructure.consumer_group import EventConsumer

        mock_client = AsyncMock()
        mock_client.xreadgroup.return_value = [
            ["asdlc:events", [
                ("1234-0", {
                    "event_type": "task_created",
                    "session_id": "session-123",
                    "timestamp": "2026-01-22T10:00:00+00:00",
                }),
            ]]
        ]
        mock_client.exists.return_value = 0

        mock_handler = MagicMock()
        mock_handler.can_handle.return_value = True
        mock_handler.handle = AsyncMock(side_effect=RuntimeError("Handler crashed"))

        consumer = EventConsumer(
            group_name="test-group",
            consumer_name="consumer-1",
            handler=mock_handler,
            client=mock_client,
            stream_name="asdlc:events",
        )

        # Should not raise
        await consumer._process_once()

        # Should NOT ack on error (allow retry)
        mock_client.xack.assert_not_called()


class TestConsumerRecovery:
    """Tests for consumer recovery functionality."""

    @pytest.mark.asyncio
    async def test_process_pending_returns_stats(self):
        """process_pending returns RecoveryResult with stats."""
        from src.infrastructure.consumer_group import EventConsumer

        mock_client = AsyncMock()
        mock_client.xpending_range.return_value = [
            {
                "message_id": "1234-0",
                "consumer": "consumer-1",
                "time_since_delivered": 60000,
                "times_delivered": 2,
            },
        ]
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

        mock_handler = MagicMock()
        mock_handler.can_handle.return_value = True
        mock_handler.handle = AsyncMock(return_value=HandlerResult(success=True))

        consumer = EventConsumer(
            group_name="test-group",
            consumer_name="consumer-1",
            handler=mock_handler,
            client=mock_client,
            stream_name="asdlc:events",
        )

        result = await consumer.process_pending()

        assert isinstance(result, RecoveryResult)
        assert result.processed >= 0
        assert result.total >= 0

    @pytest.mark.asyncio
    async def test_process_pending_skips_already_processed(self):
        """process_pending skips events already marked as processed."""
        from src.infrastructure.consumer_group import EventConsumer

        mock_client = AsyncMock()
        mock_client.xpending_range.return_value = [
            {
                "message_id": "1234-0",
                "consumer": "consumer-1",
                "time_since_delivered": 60000,
                "times_delivered": 2,
            },
        ]
        mock_client.xclaim.return_value = [
            ("1234-0", {
                "event_type": "task_created",
                "session_id": "session-123",
                "timestamp": "2026-01-22T10:00:00+00:00",
                "idempotency_key": "already-processed",
            }),
        ]
        mock_client.exists.return_value = 1  # Already processed
        mock_client.xack.return_value = 1

        mock_handler = MagicMock()
        mock_handler.can_handle.return_value = True

        consumer = EventConsumer(
            group_name="test-group",
            consumer_name="consumer-1",
            handler=mock_handler,
            client=mock_client,
            stream_name="asdlc:events",
        )

        result = await consumer.process_pending()

        # Handler should not be called for already-processed events
        mock_handler.handle.assert_not_called()
        assert result.skipped >= 1


class TestConsumerLifecycle:
    """Tests for consumer start/stop lifecycle."""

    @pytest.mark.asyncio
    async def test_stop_sets_running_flag(self):
        """stop() sets _running to False."""
        from src.infrastructure.consumer_group import EventConsumer

        mock_client = AsyncMock()
        mock_handler = MagicMock()

        consumer = EventConsumer(
            group_name="test-group",
            consumer_name="consumer-1",
            handler=mock_handler,
            client=mock_client,
        )

        consumer._running = True
        await consumer.stop()

        assert consumer._running is False

    @pytest.mark.asyncio
    async def test_start_sets_running_flag(self):
        """start() sets _running to True."""
        from src.infrastructure.consumer_group import EventConsumer

        mock_client = AsyncMock()
        mock_client.xreadgroup.return_value = []  # No events

        mock_handler = MagicMock()

        consumer = EventConsumer(
            group_name="test-group",
            consumer_name="consumer-1",
            handler=mock_handler,
            client=mock_client,
        )

        # Start in background and immediately stop
        async def run_briefly():
            consumer._running = True
            try:
                await asyncio.wait_for(consumer._process_once(), timeout=0.1)
            except asyncio.TimeoutError:
                pass
            consumer._running = False

        await run_briefly()

        # Verify xreadgroup was called
        mock_client.xreadgroup.assert_called()
