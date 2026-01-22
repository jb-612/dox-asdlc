"""Unit tests for Redis streams module.

Tests the extended functionality including validated publishing,
idempotency tracking, and tenant-aware operations.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.core.events import ASDLCEvent, EventType


class TestGetStreamName:
    """Tests for get_stream_name function."""

    def test_default_stream_name(self):
        """Returns default stream name in single-tenant mode."""
        from src.infrastructure.redis_streams import get_stream_name

        with patch.dict(os.environ, {"MULTI_TENANCY_ENABLED": "false"}, clear=False):
            from src.core.config import clear_config_cache
            clear_config_cache()

            name = get_stream_name()
            assert name == "asdlc:events"

    def test_tenant_prefixed_stream_name(self):
        """Returns tenant-prefixed stream name in multi-tenant mode."""
        from src.infrastructure.redis_streams import get_stream_name
        from src.core.tenant import TenantContext

        with patch.dict(os.environ, {"MULTI_TENANCY_ENABLED": "true"}, clear=False):
            from src.core.config import clear_config_cache
            clear_config_cache()

            with TenantContext.tenant_scope("acme-corp"):
                name = get_stream_name()
                assert name == "tenant:acme-corp:asdlc:events"

    def test_custom_base_name(self):
        """Supports custom base stream name."""
        from src.infrastructure.redis_streams import get_stream_name

        with patch.dict(os.environ, {"MULTI_TENANCY_ENABLED": "false"}, clear=False):
            from src.core.config import clear_config_cache
            clear_config_cache()

            name = get_stream_name(base_name="custom:stream")
            assert name == "custom:stream"


class TestPublishEventModel:
    """Tests for publish_event_model function."""

    @pytest.mark.asyncio
    async def test_publish_validates_event(self):
        """Publish validates event model before sending."""
        from src.infrastructure.redis_streams import publish_event_model

        mock_client = AsyncMock()
        mock_client.xadd.return_value = "1234-0"

        event = ASDLCEvent(
            event_type=EventType.TASK_CREATED,
            session_id="session-123",
            timestamp=datetime.now(timezone.utc),
        )

        event_id = await publish_event_model(event, client=mock_client)

        assert event_id == "1234-0"
        mock_client.xadd.assert_called_once()

    @pytest.mark.asyncio
    async def test_publish_adds_tenant_context(self):
        """Publish automatically adds tenant from context."""
        from src.infrastructure.redis_streams import publish_event_model
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
            with TenantContext.tenant_scope("widgets-inc"):
                await publish_event_model(event, client=mock_client)

        call_args = mock_client.xadd.call_args
        event_data = call_args.args[1]
        assert event_data.get("tenant_id") == "widgets-inc"

    @pytest.mark.asyncio
    async def test_publish_generates_idempotency_key(self):
        """Publish generates idempotency key if not provided."""
        from src.infrastructure.redis_streams import publish_event_model

        mock_client = AsyncMock()
        mock_client.xadd.return_value = "1234-0"

        event = ASDLCEvent(
            event_type=EventType.TASK_CREATED,
            session_id="session-123",
            task_id="task-456",
            timestamp=datetime.now(timezone.utc),
        )

        await publish_event_model(event, client=mock_client)

        call_args = mock_client.xadd.call_args
        event_data = call_args.args[1]
        assert "idempotency_key" in event_data
        assert len(event_data["idempotency_key"]) > 0

    @pytest.mark.asyncio
    async def test_publish_preserves_existing_idempotency_key(self):
        """Publish keeps existing idempotency key."""
        from src.infrastructure.redis_streams import publish_event_model

        mock_client = AsyncMock()
        mock_client.xadd.return_value = "1234-0"

        event = ASDLCEvent(
            event_type=EventType.TASK_CREATED,
            session_id="session-123",
            idempotency_key="my-custom-key",
            timestamp=datetime.now(timezone.utc),
        )

        await publish_event_model(event, client=mock_client)

        call_args = mock_client.xadd.call_args
        event_data = call_args.args[1]
        assert event_data["idempotency_key"] == "my-custom-key"


class TestIdempotencyTracker:
    """Tests for IdempotencyTracker class."""

    @pytest.mark.asyncio
    async def test_is_processed_returns_false_for_new_key(self):
        """New keys are not processed."""
        from src.infrastructure.redis_streams import IdempotencyTracker

        mock_client = AsyncMock()
        mock_client.exists.return_value = 0

        tracker = IdempotencyTracker(mock_client)
        result = await tracker.is_processed("new-key")

        assert result is False
        mock_client.exists.assert_called_once()

    @pytest.mark.asyncio
    async def test_is_processed_returns_true_for_existing_key(self):
        """Existing keys are marked as processed."""
        from src.infrastructure.redis_streams import IdempotencyTracker

        mock_client = AsyncMock()
        mock_client.exists.return_value = 1

        tracker = IdempotencyTracker(mock_client)
        result = await tracker.is_processed("existing-key")

        assert result is True

    @pytest.mark.asyncio
    async def test_mark_processed_stores_key_with_ttl(self):
        """Marking processed stores key with TTL."""
        from src.infrastructure.redis_streams import IdempotencyTracker

        mock_client = AsyncMock()
        mock_client.set.return_value = True

        tracker = IdempotencyTracker(mock_client, ttl_seconds=3600)
        await tracker.mark_processed("my-key", "evt-001")

        mock_client.set.assert_called_once()
        call_args = mock_client.set.call_args
        assert "ex" in call_args.kwargs or len(call_args.args) >= 4

    @pytest.mark.asyncio
    async def test_tenant_prefixed_keys(self):
        """Idempotency keys are tenant-prefixed in multi-tenant mode."""
        from src.infrastructure.redis_streams import IdempotencyTracker
        from src.core.tenant import TenantContext

        mock_client = AsyncMock()
        mock_client.exists.return_value = 0

        with patch.dict(os.environ, {"MULTI_TENANCY_ENABLED": "true"}, clear=False):
            from src.core.config import clear_config_cache
            clear_config_cache()

            tracker = IdempotencyTracker(mock_client)

            with TenantContext.tenant_scope("acme-corp"):
                await tracker.is_processed("test-key")

            call_args = mock_client.exists.call_args
            key = call_args.args[0]
            assert "acme-corp" in key


class TestTenantAwareOperations:
    """Tests for tenant-aware stream operations."""

    @pytest.mark.asyncio
    async def test_ensure_stream_uses_tenant_prefix(self):
        """ensure_stream_exists uses tenant-prefixed key."""
        from src.infrastructure.redis_streams import ensure_stream_exists_for_tenant
        from src.core.tenant import TenantContext

        mock_client = AsyncMock()
        mock_client.exists.return_value = True

        with TenantContext.tenant_scope("widgets-inc"):
            await ensure_stream_exists_for_tenant(mock_client)

        call_args = mock_client.exists.call_args
        stream_name = call_args.args[0]
        assert "widgets-inc" in stream_name

    @pytest.mark.asyncio
    async def test_get_stream_info_for_tenant(self):
        """get_stream_info_for_tenant uses tenant-prefixed key."""
        from src.infrastructure.redis_streams import get_stream_info_for_tenant
        from src.core.tenant import TenantContext

        mock_client = AsyncMock()
        mock_client.xinfo_stream.return_value = {"length": 10}
        mock_client.xinfo_groups.return_value = []

        with TenantContext.tenant_scope("acme-corp"):
            info = await get_stream_info_for_tenant(mock_client)

        assert "acme-corp" in info["stream"]


class TestConsumeEvents:
    """Tests for event consumption helpers."""

    @pytest.mark.asyncio
    async def test_read_events_from_group(self):
        """Can read events from consumer group."""
        from src.infrastructure.redis_streams import read_events_from_group

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

        events = await read_events_from_group(
            client=mock_client,
            group_name="test-group",
            consumer_name="consumer-1",
            stream_name="asdlc:events",
            count=10,
        )

        assert len(events) == 1
        assert events[0].event_type == EventType.TASK_CREATED

    @pytest.mark.asyncio
    async def test_acknowledge_event(self):
        """Can acknowledge processed event."""
        from src.infrastructure.redis_streams import acknowledge_event

        mock_client = AsyncMock()
        mock_client.xack.return_value = 1

        result = await acknowledge_event(
            client=mock_client,
            stream_name="asdlc:events",
            group_name="test-group",
            event_id="1234-0",
        )

        assert result is True
        mock_client.xack.assert_called_once_with(
            "asdlc:events", "test-group", "1234-0"
        )

    @pytest.mark.asyncio
    async def test_get_pending_events(self):
        """Can get pending events from consumer group."""
        from src.infrastructure.redis_streams import get_pending_events

        mock_client = AsyncMock()
        mock_client.xpending_range.return_value = [
            {
                "message_id": "1234-0",
                "consumer": "consumer-1",
                "time_since_delivered": 60000,
                "times_delivered": 2,
            },
        ]

        pending = await get_pending_events(
            client=mock_client,
            stream_name="asdlc:events",
            group_name="test-group",
            count=10,
        )

        assert len(pending) == 1
        assert pending[0]["message_id"] == "1234-0"
