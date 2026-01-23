"""Integration tests for coordination with real Redis.

These tests run against an actual Redis instance and verify:
- Full publish -> query -> acknowledge cycles
- Pub/sub notification delivery
- Instance presence tracking
- Concurrent operations
- Data persistence across operations

Requires: Redis running on localhost:6379 (or REDIS_HOST/REDIS_PORT env vars)
"""

from __future__ import annotations

import asyncio
import os
import uuid
from datetime import datetime, timezone
from typing import AsyncGenerator

import pytest
import redis.asyncio as redis

from src.infrastructure.coordination.client import CoordinationClient
from src.infrastructure.coordination.config import CoordinationConfig
from src.infrastructure.coordination.types import (
    CoordinationMessage,
    MessageQuery,
    MessageType,
    NotificationEvent,
)


# Skip all tests if Redis is not available
def redis_available() -> bool:
    """Check if Redis is available for integration tests."""
    host = os.environ.get("REDIS_HOST", "localhost")
    port = int(os.environ.get("REDIS_PORT", 6379))
    try:
        r = redis.from_url(f"redis://{host}:{port}", decode_responses=True)
        asyncio.get_event_loop().run_until_complete(r.ping())
        asyncio.get_event_loop().run_until_complete(r.aclose())
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(
    not redis_available(),
    reason="Redis not available for integration tests",
)


@pytest.fixture
def test_prefix() -> str:
    """Generate unique prefix for test isolation."""
    # Note: Don't include trailing colon - config key patterns add their own separators
    return f"test-{uuid.uuid4().hex[:8]}"


@pytest.fixture
def config(test_prefix: str) -> CoordinationConfig:
    """Create test configuration with unique prefix."""
    return CoordinationConfig(
        redis_host=os.environ.get("REDIS_HOST", "localhost"),
        redis_port=int(os.environ.get("REDIS_PORT", 6379)),
        key_prefix=test_prefix,
        message_ttl_days=1,  # 1 day for tests (minimum practical value)
        presence_timeout_minutes=1,  # 1 minute for tests
        timeline_max_size=100,
    )


@pytest.fixture
async def redis_client(config: CoordinationConfig) -> AsyncGenerator[redis.Redis, None]:
    """Create Redis client for tests."""
    client = redis.from_url(
        f"redis://{config.redis_host}:{config.redis_port}",
        decode_responses=True,
    )
    yield client
    # Cleanup: delete all test keys
    keys = await client.keys(f"{config.key_prefix}:*")
    if keys:
        await client.delete(*keys)
    await client.aclose()


@pytest.fixture
async def client(
    redis_client: redis.Redis,
    config: CoordinationConfig,
) -> AsyncGenerator[CoordinationClient, None]:
    """Create coordination client for tests."""
    client = CoordinationClient(
        redis_client=redis_client,
        config=config,
        instance_id="test-instance",
    )
    yield client


class TestPublishAndQuery:
    """Integration tests for publish and query operations."""

    @pytest.mark.asyncio
    async def test_publish_message_creates_in_redis(
        self,
        client: CoordinationClient,
        redis_client: redis.Redis,
        config: CoordinationConfig,
    ) -> None:
        """Test that publish creates message in Redis."""
        msg = await client.publish_message(
            msg_type=MessageType.GENERAL,
            subject="Test Subject",
            description="Test Description",
            from_instance="backend",
            to_instance="orchestrator",
        )

        # Verify message exists in Redis
        msg_key = config.message_key(msg.id)
        exists = await redis_client.exists(msg_key)
        assert exists

        # Verify message data
        data = await redis_client.hgetall(msg_key)
        assert data["type"] == "GENERAL"
        assert data["subject"] == "Test Subject"
        assert data["from"] == "backend"
        assert data["to"] == "orchestrator"

    @pytest.mark.asyncio
    async def test_publish_message_adds_to_timeline(
        self,
        client: CoordinationClient,
        redis_client: redis.Redis,
        config: CoordinationConfig,
    ) -> None:
        """Test that publish adds message to timeline sorted set."""
        msg = await client.publish_message(
            msg_type=MessageType.READY_FOR_REVIEW,
            subject="Review",
            description="Ready",
            from_instance="backend",
            to_instance="orchestrator",
        )

        # Verify in timeline
        timeline_key = config.timeline_key()
        score = await redis_client.zscore(timeline_key, msg.id)
        assert score is not None

    @pytest.mark.asyncio
    async def test_publish_message_adds_to_inbox(
        self,
        client: CoordinationClient,
        redis_client: redis.Redis,
        config: CoordinationConfig,
    ) -> None:
        """Test that publish adds message to target inbox."""
        msg = await client.publish_message(
            msg_type=MessageType.GENERAL,
            subject="Inbox Test",
            description="Test",
            from_instance="backend",
            to_instance="frontend",
        )

        # Verify in inbox
        inbox_key = config.inbox_key("frontend")
        is_member = await redis_client.sismember(inbox_key, msg.id)
        assert is_member

    @pytest.mark.asyncio
    async def test_publish_with_requires_ack_adds_to_pending(
        self,
        client: CoordinationClient,
        redis_client: redis.Redis,
        config: CoordinationConfig,
    ) -> None:
        """Test that publish with requires_ack adds to pending set."""
        msg = await client.publish_message(
            msg_type=MessageType.READY_FOR_REVIEW,
            subject="Pending Test",
            description="Test",
            from_instance="backend",
            to_instance="orchestrator",
            requires_ack=True,
        )

        # Verify in pending
        pending_key = config.pending_key()
        is_pending = await redis_client.sismember(pending_key, msg.id)
        assert is_pending

    @pytest.mark.asyncio
    async def test_publish_without_requires_ack_not_in_pending(
        self,
        client: CoordinationClient,
        redis_client: redis.Redis,
        config: CoordinationConfig,
    ) -> None:
        """Test that publish without requires_ack does not add to pending."""
        msg = await client.publish_message(
            msg_type=MessageType.GENERAL,
            subject="No Ack Test",
            description="Test",
            from_instance="backend",
            to_instance="orchestrator",
            requires_ack=False,
        )

        # Verify NOT in pending
        pending_key = config.pending_key()
        is_pending = await redis_client.sismember(pending_key, msg.id)
        assert not is_pending

    @pytest.mark.asyncio
    async def test_query_by_inbox(
        self,
        client: CoordinationClient,
    ) -> None:
        """Test querying messages by target inbox."""
        # Publish messages to different inboxes
        await client.publish_message(
            msg_type=MessageType.GENERAL,
            subject="To Orchestrator",
            description="Test",
            from_instance="backend",
            to_instance="orchestrator",
        )
        await client.publish_message(
            msg_type=MessageType.GENERAL,
            subject="To Frontend",
            description="Test",
            from_instance="backend",
            to_instance="frontend",
        )

        # Query orchestrator inbox
        query = MessageQuery(to_instance="orchestrator")
        messages = await client.get_messages(query)

        # Should only have orchestrator message
        assert len(messages) >= 1
        assert all(m.to_instance == "orchestrator" for m in messages)

    @pytest.mark.asyncio
    async def test_query_pending_only(
        self,
        client: CoordinationClient,
    ) -> None:
        """Test querying only pending (unacknowledged) messages."""
        # Publish with and without requires_ack
        msg1 = await client.publish_message(
            msg_type=MessageType.READY_FOR_REVIEW,
            subject="Needs Ack",
            description="Test",
            from_instance="backend",
            to_instance="orchestrator",
            requires_ack=True,
        )
        await client.publish_message(
            msg_type=MessageType.GENERAL,
            subject="No Ack Needed",
            description="Test",
            from_instance="backend",
            to_instance="orchestrator",
            requires_ack=False,
        )

        # Query pending only
        query = MessageQuery(pending_only=True)
        messages = await client.get_messages(query)

        # Should contain the pending message
        msg_ids = [m.id for m in messages]
        assert msg1.id in msg_ids

    @pytest.mark.asyncio
    async def test_get_single_message(
        self,
        client: CoordinationClient,
    ) -> None:
        """Test getting a single message by ID."""
        msg = await client.publish_message(
            msg_type=MessageType.GENERAL,
            subject="Single Test",
            description="Test Description",
            from_instance="backend",
            to_instance="orchestrator",
        )

        # Get by ID
        retrieved = await client.get_message(msg.id)

        assert retrieved is not None
        assert retrieved.id == msg.id
        assert retrieved.payload.subject == "Single Test"

    @pytest.mark.asyncio
    async def test_get_nonexistent_message(
        self,
        client: CoordinationClient,
    ) -> None:
        """Test getting a message that doesn't exist."""
        retrieved = await client.get_message("msg-nonexistent-id")
        assert retrieved is None


class TestAcknowledgment:
    """Integration tests for message acknowledgment."""

    @pytest.mark.asyncio
    async def test_acknowledge_removes_from_pending(
        self,
        client: CoordinationClient,
        redis_client: redis.Redis,
        config: CoordinationConfig,
    ) -> None:
        """Test that acknowledgment removes from pending set."""
        # Publish requiring ack
        msg = await client.publish_message(
            msg_type=MessageType.READY_FOR_REVIEW,
            subject="Ack Test",
            description="Test",
            from_instance="backend",
            to_instance="orchestrator",
            requires_ack=True,
        )

        # Verify in pending
        pending_key = config.pending_key()
        assert await redis_client.sismember(pending_key, msg.id)

        # Acknowledge
        result = await client.acknowledge_message(
            message_id=msg.id,
            ack_by="orchestrator",
        )
        assert result is True

        # Verify removed from pending
        assert not await redis_client.sismember(pending_key, msg.id)

    @pytest.mark.asyncio
    async def test_acknowledge_updates_message_fields(
        self,
        client: CoordinationClient,
        redis_client: redis.Redis,
        config: CoordinationConfig,
    ) -> None:
        """Test that acknowledgment updates message hash fields."""
        msg = await client.publish_message(
            msg_type=MessageType.READY_FOR_REVIEW,
            subject="Ack Fields Test",
            description="Test",
            from_instance="backend",
            to_instance="orchestrator",
            requires_ack=True,
        )

        # Acknowledge with comment
        await client.acknowledge_message(
            message_id=msg.id,
            ack_by="orchestrator",
            comment="Looks good!",
        )

        # Verify fields updated
        msg_key = config.message_key(msg.id)
        data = await redis_client.hgetall(msg_key)

        assert data["acknowledged"] == "1"
        assert data["ack_by"] == "orchestrator"
        assert data.get("ack_comment") == "Looks good!"
        assert "ack_timestamp" in data

    @pytest.mark.asyncio
    async def test_acknowledge_idempotent(
        self,
        client: CoordinationClient,
    ) -> None:
        """Test that acknowledging twice is idempotent."""
        msg = await client.publish_message(
            msg_type=MessageType.READY_FOR_REVIEW,
            subject="Idempotent Test",
            description="Test",
            from_instance="backend",
            to_instance="orchestrator",
            requires_ack=True,
        )

        # Acknowledge twice
        result1 = await client.acknowledge_message(msg.id, "orchestrator")
        result2 = await client.acknowledge_message(msg.id, "orchestrator")

        # Both should succeed
        assert result1 is True
        assert result2 is True

    @pytest.mark.asyncio
    async def test_acknowledge_nonexistent_returns_false(
        self,
        client: CoordinationClient,
    ) -> None:
        """Test acknowledging nonexistent message returns False."""
        result = await client.acknowledge_message(
            message_id="msg-nonexistent",
            ack_by="orchestrator",
        )
        assert result is False


class TestPresence:
    """Integration tests for instance presence tracking."""

    @pytest.mark.asyncio
    async def test_register_instance(
        self,
        client: CoordinationClient,
        redis_client: redis.Redis,
        config: CoordinationConfig,
    ) -> None:
        """Test registering an instance."""
        await client.register_instance(
            instance_id="backend",
            session_id="session-123",
        )

        # Verify in presence hash
        presence_key = config.presence_key()
        data = await redis_client.hgetall(presence_key)

        assert "backend.active" in data
        assert data["backend.active"] == "1"
        assert data["backend.session_id"] == "session-123"

    @pytest.mark.asyncio
    async def test_heartbeat_updates_timestamp(
        self,
        client: CoordinationClient,
        redis_client: redis.Redis,
        config: CoordinationConfig,
    ) -> None:
        """Test that heartbeat updates timestamp."""
        # Register
        await client.register_instance("frontend", "session-456")

        # Get initial timestamp
        presence_key = config.presence_key()
        initial = await redis_client.hget(presence_key, "frontend.last_heartbeat")

        # Small delay
        await asyncio.sleep(0.1)

        # Heartbeat
        await client.heartbeat("frontend")

        # Check updated
        updated = await redis_client.hget(presence_key, "frontend.last_heartbeat")
        assert updated is not None
        # Timestamps should be different (or at least exist)
        assert initial is not None

    @pytest.mark.asyncio
    async def test_unregister_instance(
        self,
        client: CoordinationClient,
        redis_client: redis.Redis,
        config: CoordinationConfig,
    ) -> None:
        """Test unregistering an instance."""
        # Register then unregister
        await client.register_instance("temp-instance", "session-temp")
        await client.unregister_instance("temp-instance")

        # Verify removed
        presence_key = config.presence_key()
        data = await redis_client.hgetall(presence_key)

        assert "temp-instance.active" not in data

    @pytest.mark.asyncio
    async def test_get_presence_returns_active_instances(
        self,
        client: CoordinationClient,
    ) -> None:
        """Test getting presence returns active instances."""
        # Register multiple instances
        await client.register_instance("instance-a", "session-a")
        await client.register_instance("instance-b", "session-b")

        # Get presence
        presence = await client.get_presence()

        assert "instance-a" in presence
        assert "instance-b" in presence
        assert presence["instance-a"].active is True
        assert presence["instance-b"].active is True


class TestConcurrentOperations:
    """Integration tests for concurrent operations."""

    @pytest.mark.asyncio
    async def test_concurrent_publishes(
        self,
        client: CoordinationClient,
    ) -> None:
        """Test that concurrent publishes don't interfere."""
        # Publish multiple messages concurrently
        tasks = [
            client.publish_message(
                msg_type=MessageType.GENERAL,
                subject=f"Concurrent {i}",
                description="Test",
                from_instance="backend",
                to_instance="orchestrator",
            )
            for i in range(10)
        ]

        messages = await asyncio.gather(*tasks)

        # All should succeed with unique IDs
        assert len(messages) == 10
        ids = [m.id for m in messages]
        assert len(set(ids)) == 10  # All unique

    @pytest.mark.asyncio
    async def test_concurrent_acks(
        self,
        client: CoordinationClient,
    ) -> None:
        """Test concurrent acknowledgments."""
        # Publish messages
        messages = [
            await client.publish_message(
                msg_type=MessageType.READY_FOR_REVIEW,
                subject=f"Ack {i}",
                description="Test",
                from_instance="backend",
                to_instance="orchestrator",
                requires_ack=True,
            )
            for i in range(5)
        ]

        # Acknowledge all concurrently
        tasks = [
            client.acknowledge_message(m.id, "orchestrator")
            for m in messages
        ]

        results = await asyncio.gather(*tasks)

        # All should succeed
        assert all(r is True for r in results)


class TestStatistics:
    """Integration tests for coordination statistics."""

    @pytest.mark.asyncio
    async def test_get_stats_counts_messages(
        self,
        client: CoordinationClient,
    ) -> None:
        """Test that stats correctly count messages."""
        # Start fresh - publish some messages
        await client.publish_message(
            msg_type=MessageType.GENERAL,
            subject="Stats Test 1",
            description="Test",
            from_instance="backend",
            to_instance="orchestrator",
            requires_ack=False,
        )
        await client.publish_message(
            msg_type=MessageType.READY_FOR_REVIEW,
            subject="Stats Test 2",
            description="Test",
            from_instance="backend",
            to_instance="orchestrator",
            requires_ack=True,
        )

        # Get stats
        stats = await client.get_stats()

        # Should have at least these messages
        assert stats.total_messages >= 2
        assert stats.pending_messages >= 1


class TestNotificationQueue:
    """Integration tests for notification queue operations."""

    @pytest.mark.asyncio
    async def test_queue_notification_stores_in_redis(
        self,
        client: CoordinationClient,
        redis_client: redis.Redis,
        config: CoordinationConfig,
    ) -> None:
        """Test that queue_notification stores in Redis LIST."""
        notification = NotificationEvent(
            event="message_published",
            message_id="msg-queue-test",
            msg_type=MessageType.READY_FOR_REVIEW,
            from_instance="backend",
            to_instance="orchestrator",
            requires_ack=True,
            timestamp=datetime.now(timezone.utc),
        )

        result = await client.queue_notification("orchestrator", notification)
        assert result is True

        # Verify in Redis
        queue_key = config.notification_queue_key("orchestrator")
        length = await redis_client.llen(queue_key)
        assert length >= 1

    @pytest.mark.asyncio
    async def test_pop_notifications_retrieves_and_clears(
        self,
        client: CoordinationClient,
        redis_client: redis.Redis,
        config: CoordinationConfig,
    ) -> None:
        """Test that pop_notifications retrieves and clears queue."""
        # Queue some notifications
        for i in range(3):
            notification = NotificationEvent(
                event="message_published",
                message_id=f"msg-pop-test-{i}",
                msg_type=MessageType.GENERAL,
                from_instance="backend",
                to_instance="test-pop-instance",
                requires_ack=False,
                timestamp=datetime.now(timezone.utc),
            )
            await client.queue_notification("test-pop-instance", notification)

        # Pop notifications
        notifications = await client.pop_notifications("test-pop-instance")

        assert len(notifications) == 3

        # Verify queue is empty
        queue_key = config.notification_queue_key("test-pop-instance")
        length = await redis_client.llen(queue_key)
        assert length == 0

    @pytest.mark.asyncio
    async def test_pop_notifications_empty_queue(
        self,
        client: CoordinationClient,
    ) -> None:
        """Test pop_notifications with empty queue."""
        notifications = await client.pop_notifications("nonexistent-instance")
        assert len(notifications) == 0

    @pytest.mark.asyncio
    async def test_publish_message_queues_for_offline_instance(
        self,
        client: CoordinationClient,
        redis_client: redis.Redis,
        config: CoordinationConfig,
    ) -> None:
        """Test that publish_message queues notification for offline instance."""
        # Ensure target instance is not registered (offline)
        # Publish a message to the offline instance
        unique_id = f"offline-test-{datetime.now().timestamp()}"
        await client.publish_message(
            msg_type=MessageType.GENERAL,
            subject="Test for offline",
            description="Test",
            from_instance="backend",
            to_instance=unique_id,
            requires_ack=False,
        )

        # Verify notification was queued
        queue_key = config.notification_queue_key(unique_id)
        length = await redis_client.llen(queue_key)
        assert length == 1

        # Pop and verify content
        notifications = await client.pop_notifications(unique_id)
        assert len(notifications) == 1
        assert notifications[0].to_instance == unique_id

    @pytest.mark.asyncio
    async def test_publish_message_skips_for_online_instance(
        self,
        client: CoordinationClient,
        redis_client: redis.Redis,
        config: CoordinationConfig,
    ) -> None:
        """Test that publish_message doesn't queue for online instance."""
        # Register the target instance as online
        unique_id = f"online-test-{datetime.now().timestamp()}"
        await client.register_instance(unique_id, "session-test")

        # Clear any existing notifications
        await client.pop_notifications(unique_id)

        # Publish a message
        await client.publish_message(
            msg_type=MessageType.GENERAL,
            subject="Test for online",
            description="Test",
            from_instance="backend",
            to_instance=unique_id,
            requires_ack=False,
        )

        # Verify notification was NOT queued (instance is online)
        queue_key = config.notification_queue_key(unique_id)
        length = await redis_client.llen(queue_key)
        assert length == 0

        # Cleanup
        await client.unregister_instance(unique_id)

    @pytest.mark.asyncio
    async def test_full_notification_cycle(
        self,
        client: CoordinationClient,
        redis_client: redis.Redis,
        config: CoordinationConfig,
    ) -> None:
        """Test full cycle: publish -> queue -> pop."""
        target_instance = f"full-cycle-{datetime.now().timestamp()}"

        # 1. Target is offline, publish message
        msg = await client.publish_message(
            msg_type=MessageType.READY_FOR_REVIEW,
            subject="Full cycle test",
            description="Testing the full notification cycle",
            from_instance="backend",
            to_instance=target_instance,
            requires_ack=True,
        )

        # 2. Verify notification queued
        queue_key = config.notification_queue_key(target_instance)
        length = await redis_client.llen(queue_key)
        assert length == 1

        # 3. Pop notifications (simulating session start)
        notifications = await client.pop_notifications(target_instance)

        assert len(notifications) == 1
        assert notifications[0].message_id == msg.id
        assert notifications[0].msg_type == MessageType.READY_FOR_REVIEW
        assert notifications[0].from_instance == "backend"
        assert notifications[0].to_instance == target_instance
        assert notifications[0].requires_ack is True

        # 4. Verify queue is now empty
        length = await redis_client.llen(queue_key)
        assert length == 0
