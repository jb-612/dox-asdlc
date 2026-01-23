"""Tests for coordination client base structure."""

import logging
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, call, patch

import pytest
import redis.asyncio as redis

from src.core.exceptions import (
    AcknowledgeError,
    CoordinationError,
    PresenceError,
    PublishError,
)
from src.infrastructure.coordination.client import (
    CoordinationClient,
    generate_message_id,
)
from src.infrastructure.coordination.config import CoordinationConfig
from src.infrastructure.coordination.types import MessageType, NotificationEvent


class TestGenerateMessageId:
    """Tests for message ID generation."""

    def test_format(self) -> None:
        """Test that message ID has correct format."""
        msg_id = generate_message_id()
        assert msg_id.startswith("msg-")
        assert len(msg_id) == 12  # "msg-" + 8 hex chars

    def test_uniqueness(self) -> None:
        """Test that generated IDs are unique."""
        ids = {generate_message_id() for _ in range(100)}
        assert len(ids) == 100

    def test_hex_suffix(self) -> None:
        """Test that suffix is valid hex."""
        msg_id = generate_message_id()
        hex_part = msg_id[4:]  # Remove "msg-" prefix
        int(hex_part, 16)  # Should not raise


class TestCoordinationClientInit:
    """Tests for CoordinationClient initialization."""

    @pytest.fixture
    def mock_redis(self) -> AsyncMock:
        """Create mock Redis client."""
        return AsyncMock(spec=redis.Redis)

    @pytest.fixture
    def config(self) -> CoordinationConfig:
        """Create test configuration."""
        return CoordinationConfig(key_prefix="test")

    def test_init_with_redis_client(
        self,
        mock_redis: AsyncMock,
        config: CoordinationConfig,
    ) -> None:
        """Test initialization with Redis client."""
        client = CoordinationClient(mock_redis, config)

        assert client.redis is mock_redis
        assert client.config is config
        assert client.instance_id is None
        assert client.is_connected is False

    def test_init_with_instance_id(
        self,
        mock_redis: AsyncMock,
        config: CoordinationConfig,
    ) -> None:
        """Test initialization with instance ID."""
        client = CoordinationClient(mock_redis, config, instance_id="backend")

        assert client.instance_id == "backend"

    def test_init_with_default_config(self, mock_redis: AsyncMock) -> None:
        """Test initialization uses default config when not provided."""
        with patch(
            "src.infrastructure.coordination.client.get_coordination_config"
        ) as mock_get_config:
            default_config = CoordinationConfig()
            mock_get_config.return_value = default_config

            client = CoordinationClient(mock_redis)

            assert client.config is default_config
            mock_get_config.assert_called_once()


class TestCoordinationClientProperties:
    """Tests for CoordinationClient properties."""

    @pytest.fixture
    def mock_redis(self) -> AsyncMock:
        """Create mock Redis client."""
        return AsyncMock(spec=redis.Redis)

    @pytest.fixture
    def client(self, mock_redis: AsyncMock) -> CoordinationClient:
        """Create test client."""
        config = CoordinationConfig(key_prefix="test")
        return CoordinationClient(mock_redis, config, instance_id="test-instance")

    def test_redis_property(
        self,
        client: CoordinationClient,
        mock_redis: AsyncMock,
    ) -> None:
        """Test redis property returns client."""
        assert client.redis is mock_redis

    def test_config_property(self, client: CoordinationClient) -> None:
        """Test config property returns configuration."""
        assert client.config.key_prefix == "test"

    def test_instance_id_property(self, client: CoordinationClient) -> None:
        """Test instance_id property returns ID."""
        assert client.instance_id == "test-instance"

    def test_is_connected_property_initial(self, client: CoordinationClient) -> None:
        """Test is_connected is False initially."""
        assert client.is_connected is False


class TestCoordinationClientCorrelationId:
    """Tests for correlation ID management."""

    @pytest.fixture
    def client(self) -> CoordinationClient:
        """Create test client."""
        mock_redis = AsyncMock(spec=redis.Redis)
        config = CoordinationConfig(key_prefix="test")
        return CoordinationClient(mock_redis, config)

    def test_set_correlation_id(self, client: CoordinationClient) -> None:
        """Test setting correlation ID."""
        client.set_correlation_id("corr-123")
        assert client._correlation_id == "corr-123"

    def test_clear_correlation_id(self, client: CoordinationClient) -> None:
        """Test clearing correlation ID."""
        client.set_correlation_id("corr-123")
        client.clear_correlation_id()
        assert client._correlation_id is None


class TestCoordinationClientContextManager:
    """Tests for async context manager."""

    @pytest.fixture
    def mock_redis(self) -> AsyncMock:
        """Create mock Redis client."""
        mock = AsyncMock(spec=redis.Redis)
        mock.ping = AsyncMock(return_value=True)
        return mock

    @pytest.fixture
    def config(self) -> CoordinationConfig:
        """Create test configuration."""
        return CoordinationConfig(key_prefix="test")

    @pytest.mark.asyncio
    async def test_context_manager_entry_success(
        self,
        mock_redis: AsyncMock,
        config: CoordinationConfig,
    ) -> None:
        """Test successful context manager entry."""
        client = CoordinationClient(mock_redis, config)

        async with client as ctx:
            assert ctx is client
            assert client.is_connected is True
            mock_redis.ping.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_context_manager_exit_normal(
        self,
        mock_redis: AsyncMock,
        config: CoordinationConfig,
    ) -> None:
        """Test normal context manager exit."""
        client = CoordinationClient(mock_redis, config)
        client.set_correlation_id("test-corr")

        async with client:
            pass

        assert client.is_connected is False
        assert client._correlation_id is None

    @pytest.mark.asyncio
    async def test_context_manager_exit_with_exception(
        self,
        mock_redis: AsyncMock,
        config: CoordinationConfig,
    ) -> None:
        """Test context manager exit with exception."""
        client = CoordinationClient(mock_redis, config)

        with pytest.raises(ValueError):
            async with client:
                raise ValueError("Test error")

        assert client.is_connected is False

    @pytest.mark.asyncio
    async def test_context_manager_entry_connection_failure(
        self,
        mock_redis: AsyncMock,
        config: CoordinationConfig,
    ) -> None:
        """Test context manager entry when connection fails."""
        mock_redis.ping = AsyncMock(return_value=False)
        client = CoordinationClient(mock_redis, config)

        with pytest.raises(CoordinationError) as exc_info:
            async with client:
                pass

        assert "Redis connection failed" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_context_manager_entry_redis_error(
        self,
        mock_redis: AsyncMock,
        config: CoordinationConfig,
    ) -> None:
        """Test context manager entry when Redis raises error."""
        mock_redis.ping = AsyncMock(side_effect=redis.RedisError("Connection refused"))
        client = CoordinationClient(mock_redis, config)

        with pytest.raises(CoordinationError) as exc_info:
            async with client:
                pass

        # Health check catches RedisError and returns unhealthy status
        assert "Redis connection failed" in str(exc_info.value)


class TestCoordinationClientHealthCheck:
    """Tests for health check functionality."""

    @pytest.fixture
    def mock_redis(self) -> AsyncMock:
        """Create mock Redis client."""
        return AsyncMock(spec=redis.Redis)

    @pytest.fixture
    def config(self) -> CoordinationConfig:
        """Create test configuration."""
        return CoordinationConfig(key_prefix="test")

    @pytest.mark.asyncio
    async def test_health_check_healthy(
        self,
        mock_redis: AsyncMock,
        config: CoordinationConfig,
    ) -> None:
        """Test health check when Redis is healthy."""
        mock_redis.ping = AsyncMock(return_value=True)
        client = CoordinationClient(mock_redis, config)

        health = await client.health_check()

        assert health["connected"] is True
        assert health["status"] == "healthy"
        assert "latency_ms" in health
        assert health["key_prefix"] == "test"

    @pytest.mark.asyncio
    async def test_health_check_ping_returns_false(
        self,
        mock_redis: AsyncMock,
        config: CoordinationConfig,
    ) -> None:
        """Test health check when ping returns False."""
        mock_redis.ping = AsyncMock(return_value=False)
        client = CoordinationClient(mock_redis, config)

        health = await client.health_check()

        assert health["connected"] is False
        assert health["status"] == "unhealthy"
        assert "error" in health

    @pytest.mark.asyncio
    async def test_health_check_connection_error(
        self,
        mock_redis: AsyncMock,
        config: CoordinationConfig,
    ) -> None:
        """Test health check when connection fails."""
        mock_redis.ping = AsyncMock(
            side_effect=redis.ConnectionError("Connection refused")
        )
        client = CoordinationClient(mock_redis, config)

        health = await client.health_check()

        assert health["connected"] is False
        assert health["status"] == "unhealthy"
        assert "Connection error" in health["error"]

    @pytest.mark.asyncio
    async def test_health_check_redis_error(
        self,
        mock_redis: AsyncMock,
        config: CoordinationConfig,
    ) -> None:
        """Test health check when Redis raises error."""
        mock_redis.ping = AsyncMock(side_effect=redis.RedisError("Unknown error"))
        client = CoordinationClient(mock_redis, config)

        health = await client.health_check()

        assert health["connected"] is False
        assert health["status"] == "unhealthy"
        assert "Unknown error" in health["error"]


class TestCoordinationClientLogging:
    """Tests for logging functionality."""

    @pytest.fixture
    def client(self) -> CoordinationClient:
        """Create test client."""
        mock_redis = AsyncMock(spec=redis.Redis)
        config = CoordinationConfig(key_prefix="test")
        return CoordinationClient(mock_redis, config, instance_id="test-instance")

    def test_log_operation_basic(
        self,
        client: CoordinationClient,
        caplog: pytest.LogCaptureFixture,
    ) -> None:
        """Test basic operation logging."""
        with caplog.at_level(logging.DEBUG):
            client._log_operation("test_operation")

        assert "test_operation" in caplog.text

    def test_log_operation_with_correlation_id(
        self,
        client: CoordinationClient,
        caplog: pytest.LogCaptureFixture,
    ) -> None:
        """Test operation logging includes correlation ID."""
        client.set_correlation_id("corr-xyz")

        with caplog.at_level(logging.DEBUG):
            client._log_operation("test_operation")

        # The correlation ID is in the extra context
        assert "test_operation" in caplog.text

    def test_log_operation_with_custom_level(
        self,
        client: CoordinationClient,
        caplog: pytest.LogCaptureFixture,
    ) -> None:
        """Test operation logging with custom level."""
        with caplog.at_level(logging.INFO):
            client._log_operation("important_operation", level=logging.INFO)

        assert "important_operation" in caplog.text

    def test_log_operation_with_kwargs(
        self,
        client: CoordinationClient,
        caplog: pytest.LogCaptureFixture,
    ) -> None:
        """Test operation logging with additional kwargs."""
        with caplog.at_level(logging.DEBUG):
            client._log_operation("test_operation", message_id="msg-123")

        assert "test_operation" in caplog.text


class TestCoordinationClientPublishMessage:
    """Tests for message publishing functionality."""

    @pytest.fixture
    def mock_redis(self) -> AsyncMock:
        """Create mock Redis client with pipeline support."""
        mock = AsyncMock(spec=redis.Redis)
        mock.ping = AsyncMock(return_value=True)
        mock.exists = AsyncMock(return_value=0)  # Message doesn't exist

        # Create mock pipeline
        mock_pipeline = AsyncMock()
        mock_pipeline.__aenter__ = AsyncMock(return_value=mock_pipeline)
        mock_pipeline.__aexit__ = AsyncMock(return_value=None)
        mock_pipeline.hset = MagicMock()
        mock_pipeline.expire = MagicMock()
        mock_pipeline.zadd = MagicMock()
        mock_pipeline.zremrangebyrank = MagicMock()
        mock_pipeline.sadd = MagicMock()
        mock_pipeline.publish = MagicMock()
        mock_pipeline.execute = AsyncMock(return_value=[True] * 8)

        mock.pipeline = MagicMock(return_value=mock_pipeline)
        mock._pipeline = mock_pipeline  # Store for assertions

        return mock

    @pytest.fixture
    def config(self) -> CoordinationConfig:
        """Create test configuration."""
        return CoordinationConfig(key_prefix="test")

    @pytest.mark.asyncio
    async def test_publish_message_success(
        self,
        mock_redis: AsyncMock,
        config: CoordinationConfig,
    ) -> None:
        """Test successful message publishing."""
        client = CoordinationClient(mock_redis, config)

        msg = await client.publish_message(
            msg_type=MessageType.READY_FOR_REVIEW,
            subject="Test Subject",
            description="Test description",
            from_instance="backend",
            to_instance="orchestrator",
        )

        assert msg.id.startswith("msg-")
        assert msg.type == MessageType.READY_FOR_REVIEW
        assert msg.from_instance == "backend"
        assert msg.to_instance == "orchestrator"
        assert msg.payload.subject == "Test Subject"
        assert msg.payload.description == "Test description"
        assert msg.requires_ack is True
        assert msg.acknowledged is False

    @pytest.mark.asyncio
    async def test_publish_message_custom_id(
        self,
        mock_redis: AsyncMock,
        config: CoordinationConfig,
    ) -> None:
        """Test publishing with custom message ID."""
        client = CoordinationClient(mock_redis, config)

        msg = await client.publish_message(
            msg_type=MessageType.GENERAL,
            subject="Custom ID Test",
            description="Testing custom ID",
            from_instance="backend",
            to_instance="frontend",
            message_id="msg-custom123",
        )

        assert msg.id == "msg-custom123"

    @pytest.mark.asyncio
    async def test_publish_message_requires_ack_false(
        self,
        mock_redis: AsyncMock,
        config: CoordinationConfig,
    ) -> None:
        """Test publishing with requires_ack=False."""
        client = CoordinationClient(mock_redis, config)

        msg = await client.publish_message(
            msg_type=MessageType.STATUS_UPDATE,
            subject="Status",
            description="Just an update",
            from_instance="backend",
            to_instance="orchestrator",
            requires_ack=False,
        )

        assert msg.requires_ack is False

    @pytest.mark.asyncio
    async def test_publish_message_pipeline_operations(
        self,
        mock_redis: AsyncMock,
        config: CoordinationConfig,
    ) -> None:
        """Test that pipeline contains all required operations."""
        client = CoordinationClient(mock_redis, config)

        await client.publish_message(
            msg_type=MessageType.READY_FOR_REVIEW,
            subject="Test",
            description="Description",
            from_instance="backend",
            to_instance="orchestrator",
        )

        pipe = mock_redis._pipeline

        # Verify pipeline operations were called
        pipe.hset.assert_called_once()
        pipe.expire.assert_called_once()
        pipe.zadd.assert_called_once()
        pipe.zremrangebyrank.assert_called_once()
        assert pipe.sadd.call_count == 2  # inbox + pending
        assert pipe.publish.call_count == 2  # instance + broadcast channels
        pipe.execute.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_publish_message_no_pending_when_ack_false(
        self,
        mock_redis: AsyncMock,
        config: CoordinationConfig,
    ) -> None:
        """Test that pending set is not used when requires_ack=False."""
        client = CoordinationClient(mock_redis, config)

        await client.publish_message(
            msg_type=MessageType.HEARTBEAT,
            subject="Heartbeat",
            description="Still alive",
            from_instance="backend",
            to_instance="orchestrator",
            requires_ack=False,
        )

        pipe = mock_redis._pipeline
        # Only inbox sadd, not pending
        assert pipe.sadd.call_count == 1

    @pytest.mark.asyncio
    async def test_publish_message_duplicate_id_rejected(
        self,
        mock_redis: AsyncMock,
        config: CoordinationConfig,
    ) -> None:
        """Test that duplicate message IDs are rejected."""
        mock_redis.exists = AsyncMock(return_value=1)  # Message exists
        client = CoordinationClient(mock_redis, config)

        with pytest.raises(PublishError) as exc_info:
            await client.publish_message(
                msg_type=MessageType.GENERAL,
                subject="Duplicate",
                description="Should fail",
                from_instance="backend",
                to_instance="orchestrator",
                message_id="msg-existing",
            )

        assert "already exists" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_publish_message_redis_error(
        self,
        mock_redis: AsyncMock,
        config: CoordinationConfig,
    ) -> None:
        """Test handling of Redis errors during publish."""
        mock_redis._pipeline.execute = AsyncMock(
            side_effect=redis.RedisError("Connection lost")
        )
        client = CoordinationClient(mock_redis, config)

        with pytest.raises(PublishError) as exc_info:
            await client.publish_message(
                msg_type=MessageType.GENERAL,
                subject="Will Fail",
                description="Redis error",
                from_instance="backend",
                to_instance="orchestrator",
            )

        assert "Failed to publish message" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_publish_message_uses_correct_keys(
        self,
        mock_redis: AsyncMock,
        config: CoordinationConfig,
    ) -> None:
        """Test that correct Redis keys are used."""
        client = CoordinationClient(mock_redis, config)

        await client.publish_message(
            msg_type=MessageType.READY_FOR_REVIEW,
            subject="Test",
            description="Desc",
            from_instance="backend",
            to_instance="orchestrator",
            message_id="msg-test123",
        )

        pipe = mock_redis._pipeline

        # Check hset uses correct key
        hset_call = pipe.hset.call_args
        assert hset_call[0][0] == "test:msg:msg-test123"

        # Check expire uses correct TTL
        expire_call = pipe.expire.call_args
        assert expire_call[0][0] == "test:msg:msg-test123"
        assert expire_call[0][1] == config.message_ttl_seconds

        # Check zadd uses timeline key
        zadd_call = pipe.zadd.call_args
        assert zadd_call[0][0] == "test:timeline"

    @pytest.mark.asyncio
    async def test_publish_message_notification_channels(
        self,
        mock_redis: AsyncMock,
        config: CoordinationConfig,
    ) -> None:
        """Test that notifications are published to correct channels."""
        client = CoordinationClient(mock_redis, config)

        await client.publish_message(
            msg_type=MessageType.READY_FOR_REVIEW,
            subject="Test",
            description="Desc",
            from_instance="backend",
            to_instance="orchestrator",
        )

        pipe = mock_redis._pipeline
        publish_calls = pipe.publish.call_args_list

        # Should have two publish calls
        assert len(publish_calls) == 2

        # Check channels
        channels = [call[0][0] for call in publish_calls]
        assert "test:notify:orchestrator" in channels
        assert "test:notify:all" in channels

    @pytest.mark.asyncio
    async def test_publish_message_to_all(
        self,
        mock_redis: AsyncMock,
        config: CoordinationConfig,
    ) -> None:
        """Test broadcasting to 'all' instance."""
        client = CoordinationClient(mock_redis, config)

        msg = await client.publish_message(
            msg_type=MessageType.INTERFACE_UPDATE,
            subject="Interface Changed",
            description="New interface version",
            from_instance="backend",
            to_instance="all",
        )

        assert msg.to_instance == "all"

        pipe = mock_redis._pipeline
        publish_calls = pipe.publish.call_args_list
        channels = [call[0][0] for call in publish_calls]
        assert "test:notify:all" in channels


class TestCoordinationClientCheckMessageExists:
    """Tests for message existence checking."""

    @pytest.fixture
    def mock_redis(self) -> AsyncMock:
        """Create mock Redis client."""
        return AsyncMock(spec=redis.Redis)

    @pytest.fixture
    def config(self) -> CoordinationConfig:
        """Create test configuration."""
        return CoordinationConfig(key_prefix="test")

    @pytest.mark.asyncio
    async def test_check_message_exists_true(
        self,
        mock_redis: AsyncMock,
        config: CoordinationConfig,
    ) -> None:
        """Test checking for existing message."""
        mock_redis.exists = AsyncMock(return_value=1)
        client = CoordinationClient(mock_redis, config)

        result = await client._check_message_exists("msg-test123")

        assert result is True
        mock_redis.exists.assert_awaited_once_with("test:msg:msg-test123")

    @pytest.mark.asyncio
    async def test_check_message_exists_false(
        self,
        mock_redis: AsyncMock,
        config: CoordinationConfig,
    ) -> None:
        """Test checking for non-existing message."""
        mock_redis.exists = AsyncMock(return_value=0)
        client = CoordinationClient(mock_redis, config)

        result = await client._check_message_exists("msg-notfound")

        assert result is False


class TestCoordinationClientGetMessage:
    """Tests for get_message functionality."""

    @pytest.fixture
    def config(self) -> CoordinationConfig:
        """Create test configuration."""
        return CoordinationConfig(key_prefix="test")

    @pytest.fixture
    def sample_hash(self) -> dict[str, str]:
        """Create sample message hash from Redis."""
        return {
            "id": "msg-abc123",
            "type": "READY_FOR_REVIEW",
            "from": "backend",
            "to": "orchestrator",
            "timestamp": "2026-01-23T12:00:00Z",
            "requires_ack": "1",
            "acknowledged": "0",
            "subject": "Test Subject",
            "description": "Test Description",
        }

    @pytest.mark.asyncio
    async def test_get_message_found(
        self,
        config: CoordinationConfig,
        sample_hash: dict[str, str],
    ) -> None:
        """Test getting an existing message."""
        mock_redis = AsyncMock(spec=redis.Redis)
        mock_redis.hgetall = AsyncMock(return_value=sample_hash)
        client = CoordinationClient(mock_redis, config)

        msg = await client.get_message("msg-abc123")

        assert msg is not None
        assert msg.id == "msg-abc123"
        assert msg.type == MessageType.READY_FOR_REVIEW
        assert msg.from_instance == "backend"
        assert msg.to_instance == "orchestrator"
        assert msg.payload.subject == "Test Subject"
        mock_redis.hgetall.assert_awaited_once_with("test:msg:msg-abc123")

    @pytest.mark.asyncio
    async def test_get_message_not_found(
        self,
        config: CoordinationConfig,
    ) -> None:
        """Test getting a non-existent message."""
        mock_redis = AsyncMock(spec=redis.Redis)
        mock_redis.hgetall = AsyncMock(return_value={})
        client = CoordinationClient(mock_redis, config)

        msg = await client.get_message("msg-notfound")

        assert msg is None

    @pytest.mark.asyncio
    async def test_get_message_with_ack_fields(
        self,
        config: CoordinationConfig,
        sample_hash: dict[str, str],
    ) -> None:
        """Test getting a message with acknowledgment fields."""
        ack_hash = {
            **sample_hash,
            "acknowledged": "1",
            "ack_by": "orchestrator",
            "ack_timestamp": "2026-01-23T12:05:00Z",
            "ack_comment": "Acknowledged",
        }
        mock_redis = AsyncMock(spec=redis.Redis)
        mock_redis.hgetall = AsyncMock(return_value=ack_hash)
        client = CoordinationClient(mock_redis, config)

        msg = await client.get_message("msg-abc123")

        assert msg is not None
        assert msg.acknowledged is True
        assert msg.ack_by == "orchestrator"
        assert msg.ack_comment == "Acknowledged"

    @pytest.mark.asyncio
    async def test_get_message_redis_error(
        self,
        config: CoordinationConfig,
    ) -> None:
        """Test get_message with Redis error."""
        mock_redis = AsyncMock(spec=redis.Redis)
        mock_redis.hgetall = AsyncMock(side_effect=redis.RedisError("Connection lost"))
        client = CoordinationClient(mock_redis, config)

        with pytest.raises(CoordinationError) as exc_info:
            await client.get_message("msg-error")

        assert "Failed to get message" in str(exc_info.value)


class TestCoordinationClientGetMessages:
    """Tests for get_messages query functionality."""

    @pytest.fixture
    def config(self) -> CoordinationConfig:
        """Create test configuration."""
        return CoordinationConfig(key_prefix="test")

    @pytest.fixture
    def sample_hashes(self) -> list[dict[str, str]]:
        """Create sample message hashes."""
        return [
            {
                "id": "msg-001",
                "type": "READY_FOR_REVIEW",
                "from": "backend",
                "to": "orchestrator",
                "timestamp": "2026-01-23T12:00:00Z",
                "requires_ack": "1",
                "acknowledged": "0",
                "subject": "First Message",
                "description": "Description 1",
            },
            {
                "id": "msg-002",
                "type": "STATUS_UPDATE",
                "from": "frontend",
                "to": "orchestrator",
                "timestamp": "2026-01-23T12:01:00Z",
                "requires_ack": "0",
                "acknowledged": "0",
                "subject": "Second Message",
                "description": "Description 2",
            },
            {
                "id": "msg-003",
                "type": "READY_FOR_REVIEW",
                "from": "backend",
                "to": "orchestrator",
                "timestamp": "2026-01-23T12:02:00Z",
                "requires_ack": "1",
                "acknowledged": "1",
                "subject": "Third Message",
                "description": "Description 3",
            },
        ]

    def _create_mock_redis(
        self,
        inbox_ids: set[str] | None = None,
        pending_ids: set[str] | None = None,
        timeline_ids: list[str] | None = None,
        msg_hashes: dict[str, dict[str, str]] | None = None,
    ) -> AsyncMock:
        """Create mock Redis client with configurable responses."""
        mock_redis = AsyncMock(spec=redis.Redis)

        # Setup smembers for inbox
        async def mock_smembers(key: str) -> set[str]:
            if "inbox" in key and inbox_ids is not None:
                return inbox_ids
            if "pending" in key and pending_ids is not None:
                return pending_ids
            return set()

        mock_redis.smembers = AsyncMock(side_effect=mock_smembers)

        # Setup zrevrange for timeline
        mock_redis.zrevrange = AsyncMock(return_value=timeline_ids or [])
        mock_redis.zrangebyscore = AsyncMock(return_value=timeline_ids or [])

        # Setup hgetall for message retrieval
        async def mock_hgetall(key: str) -> dict[str, str]:
            if msg_hashes:
                msg_id = key.split(":")[-1]
                return msg_hashes.get(msg_id, {})
            return {}

        mock_redis.hgetall = AsyncMock(side_effect=mock_hgetall)

        return mock_redis

    @pytest.mark.asyncio
    async def test_get_messages_default_query(
        self,
        config: CoordinationConfig,
        sample_hashes: list[dict[str, str]],
    ) -> None:
        """Test getting messages with default query."""
        msg_hashes = {h["id"]: h for h in sample_hashes}
        mock_redis = self._create_mock_redis(
            timeline_ids=["msg-003", "msg-002", "msg-001"],
            msg_hashes=msg_hashes,
        )
        client = CoordinationClient(mock_redis, config)

        from src.infrastructure.coordination.types import MessageQuery
        messages = await client.get_messages()

        assert len(messages) == 3
        # Should be sorted newest first
        assert messages[0].id == "msg-003"
        assert messages[1].id == "msg-002"
        assert messages[2].id == "msg-001"

    @pytest.mark.asyncio
    async def test_get_messages_by_to_instance(
        self,
        config: CoordinationConfig,
        sample_hashes: list[dict[str, str]],
    ) -> None:
        """Test filtering by to_instance."""
        msg_hashes = {h["id"]: h for h in sample_hashes}
        mock_redis = self._create_mock_redis(
            inbox_ids={"msg-001", "msg-002"},
            msg_hashes=msg_hashes,
        )
        client = CoordinationClient(mock_redis, config)

        from src.infrastructure.coordination.types import MessageQuery
        query = MessageQuery(to_instance="orchestrator")
        messages = await client.get_messages(query)

        assert len(messages) == 2
        mock_redis.smembers.assert_awaited()

    @pytest.mark.asyncio
    async def test_get_messages_pending_only(
        self,
        config: CoordinationConfig,
        sample_hashes: list[dict[str, str]],
    ) -> None:
        """Test filtering pending only messages."""
        msg_hashes = {h["id"]: h for h in sample_hashes}
        mock_redis = self._create_mock_redis(
            pending_ids={"msg-001"},  # Only msg-001 is pending
            msg_hashes=msg_hashes,
        )
        client = CoordinationClient(mock_redis, config)

        from src.infrastructure.coordination.types import MessageQuery
        query = MessageQuery(pending_only=True)
        messages = await client.get_messages(query)

        assert len(messages) == 1
        assert messages[0].id == "msg-001"

    @pytest.mark.asyncio
    async def test_get_messages_by_from_instance(
        self,
        config: CoordinationConfig,
        sample_hashes: list[dict[str, str]],
    ) -> None:
        """Test filtering by from_instance."""
        msg_hashes = {h["id"]: h for h in sample_hashes}
        mock_redis = self._create_mock_redis(
            timeline_ids=["msg-003", "msg-002", "msg-001"],
            msg_hashes=msg_hashes,
        )
        client = CoordinationClient(mock_redis, config)

        from src.infrastructure.coordination.types import MessageQuery
        query = MessageQuery(from_instance="backend")
        messages = await client.get_messages(query)

        # Only messages from backend
        assert len(messages) == 2
        for msg in messages:
            assert msg.from_instance == "backend"

    @pytest.mark.asyncio
    async def test_get_messages_by_type(
        self,
        config: CoordinationConfig,
        sample_hashes: list[dict[str, str]],
    ) -> None:
        """Test filtering by message type."""
        msg_hashes = {h["id"]: h for h in sample_hashes}
        mock_redis = self._create_mock_redis(
            timeline_ids=["msg-003", "msg-002", "msg-001"],
            msg_hashes=msg_hashes,
        )
        client = CoordinationClient(mock_redis, config)

        from src.infrastructure.coordination.types import MessageQuery
        query = MessageQuery(msg_type=MessageType.READY_FOR_REVIEW)
        messages = await client.get_messages(query)

        # Only READY_FOR_REVIEW messages
        assert len(messages) == 2
        for msg in messages:
            assert msg.type == MessageType.READY_FOR_REVIEW

    @pytest.mark.asyncio
    async def test_get_messages_with_limit(
        self,
        config: CoordinationConfig,
        sample_hashes: list[dict[str, str]],
    ) -> None:
        """Test limiting results."""
        msg_hashes = {h["id"]: h for h in sample_hashes}
        mock_redis = self._create_mock_redis(
            timeline_ids=["msg-003", "msg-002", "msg-001"],
            msg_hashes=msg_hashes,
        )
        client = CoordinationClient(mock_redis, config)

        from src.infrastructure.coordination.types import MessageQuery
        query = MessageQuery(limit=2)
        messages = await client.get_messages(query)

        assert len(messages) == 2

    @pytest.mark.asyncio
    async def test_get_messages_combined_filters(
        self,
        config: CoordinationConfig,
        sample_hashes: list[dict[str, str]],
    ) -> None:
        """Test combining multiple filters."""
        msg_hashes = {h["id"]: h for h in sample_hashes}
        mock_redis = self._create_mock_redis(
            inbox_ids={"msg-001", "msg-002", "msg-003"},
            pending_ids={"msg-001"},
            msg_hashes=msg_hashes,
        )
        client = CoordinationClient(mock_redis, config)

        from src.infrastructure.coordination.types import MessageQuery
        query = MessageQuery(
            to_instance="orchestrator",
            pending_only=True,
            msg_type=MessageType.READY_FOR_REVIEW,
        )
        messages = await client.get_messages(query)

        assert len(messages) == 1
        assert messages[0].id == "msg-001"
        assert messages[0].type == MessageType.READY_FOR_REVIEW

    @pytest.mark.asyncio
    async def test_get_messages_empty_result(
        self,
        config: CoordinationConfig,
    ) -> None:
        """Test getting messages when none match."""
        mock_redis = self._create_mock_redis(
            inbox_ids=set(),
            msg_hashes={},
        )
        client = CoordinationClient(mock_redis, config)

        from src.infrastructure.coordination.types import MessageQuery
        query = MessageQuery(to_instance="nobody")
        messages = await client.get_messages(query)

        assert len(messages) == 0

    @pytest.mark.asyncio
    async def test_get_messages_redis_error(
        self,
        config: CoordinationConfig,
    ) -> None:
        """Test get_messages with Redis error."""
        mock_redis = AsyncMock(spec=redis.Redis)
        mock_redis.zrevrange = AsyncMock(
            side_effect=redis.RedisError("Connection lost")
        )
        client = CoordinationClient(mock_redis, config)

        with pytest.raises(CoordinationError) as exc_info:
            await client.get_messages()

        assert "Failed to query messages" in str(exc_info.value)


class TestHashToMessage:
    """Tests for _hash_to_message helper."""

    @pytest.fixture
    def client(self) -> CoordinationClient:
        """Create test client."""
        mock_redis = AsyncMock(spec=redis.Redis)
        config = CoordinationConfig(key_prefix="test")
        return CoordinationClient(mock_redis, config)

    def test_hash_to_message_basic(self, client: CoordinationClient) -> None:
        """Test converting basic hash to message."""
        msg_hash = {
            "id": "msg-test",
            "type": "GENERAL",
            "from": "sender",
            "to": "receiver",
            "timestamp": "2026-01-23T12:00:00Z",
            "requires_ack": "1",
            "acknowledged": "0",
            "subject": "Test",
            "description": "Test desc",
        }

        msg = client._hash_to_message(msg_hash)

        assert msg.id == "msg-test"
        assert msg.type == MessageType.GENERAL
        assert msg.from_instance == "sender"
        assert msg.to_instance == "receiver"
        assert msg.requires_ack is True
        assert msg.acknowledged is False

    def test_hash_to_message_with_ack(self, client: CoordinationClient) -> None:
        """Test converting hash with ack fields."""
        msg_hash = {
            "id": "msg-acked",
            "type": "REVIEW_COMPLETE",
            "from": "orchestrator",
            "to": "backend",
            "timestamp": "2026-01-23T12:00:00Z",
            "requires_ack": "1",
            "acknowledged": "1",
            "subject": "Done",
            "description": "Complete",
            "ack_by": "backend",
            "ack_timestamp": "2026-01-23T12:05:00Z",
            "ack_comment": "Got it",
        }

        msg = client._hash_to_message(msg_hash)

        assert msg.acknowledged is True
        assert msg.ack_by == "backend"
        assert msg.ack_comment == "Got it"


class TestCoordinationClientAcknowledge:
    """Tests for message acknowledgment functionality."""

    @pytest.fixture
    def config(self) -> CoordinationConfig:
        """Create test configuration."""
        return CoordinationConfig(key_prefix="test")

    @pytest.fixture
    def mock_redis_ack(self) -> AsyncMock:
        """Create mock Redis client for ack tests."""
        mock = AsyncMock(spec=redis.Redis)
        mock.exists = AsyncMock(return_value=1)  # Message exists
        mock.hget = AsyncMock(return_value="0")  # Not yet acknowledged

        # Create mock pipeline
        mock_pipeline = AsyncMock()
        mock_pipeline.__aenter__ = AsyncMock(return_value=mock_pipeline)
        mock_pipeline.__aexit__ = AsyncMock(return_value=None)
        mock_pipeline.hset = MagicMock()
        mock_pipeline.srem = MagicMock()
        mock_pipeline.execute = AsyncMock(return_value=[True, 1])

        mock.pipeline = MagicMock(return_value=mock_pipeline)
        mock._pipeline = mock_pipeline

        return mock

    @pytest.mark.asyncio
    async def test_acknowledge_message_success(
        self,
        mock_redis_ack: AsyncMock,
        config: CoordinationConfig,
    ) -> None:
        """Test successful message acknowledgment."""
        client = CoordinationClient(mock_redis_ack, config)

        result = await client.acknowledge_message(
            message_id="msg-abc123",
            ack_by="orchestrator",
        )

        assert result is True
        mock_redis_ack.exists.assert_awaited_once()
        mock_redis_ack.hget.assert_awaited_once_with("test:msg:msg-abc123", "acknowledged")
        mock_redis_ack._pipeline.execute.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_acknowledge_message_with_comment(
        self,
        mock_redis_ack: AsyncMock,
        config: CoordinationConfig,
    ) -> None:
        """Test acknowledgment with comment."""
        client = CoordinationClient(mock_redis_ack, config)

        result = await client.acknowledge_message(
            message_id="msg-abc123",
            ack_by="orchestrator",
            comment="Reviewed and approved",
        )

        assert result is True
        pipe = mock_redis_ack._pipeline
        hset_call = pipe.hset.call_args
        ack_data = hset_call[1]["mapping"]
        assert ack_data["ack_comment"] == "Reviewed and approved"

    @pytest.mark.asyncio
    async def test_acknowledge_message_not_found(
        self,
        mock_redis_ack: AsyncMock,
        config: CoordinationConfig,
    ) -> None:
        """Test acknowledging non-existent message."""
        mock_redis_ack.exists = AsyncMock(return_value=0)
        client = CoordinationClient(mock_redis_ack, config)

        result = await client.acknowledge_message(
            message_id="msg-notfound",
            ack_by="orchestrator",
        )

        assert result is False
        # Pipeline should not be called
        mock_redis_ack._pipeline.execute.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_acknowledge_message_already_acked(
        self,
        mock_redis_ack: AsyncMock,
        config: CoordinationConfig,
    ) -> None:
        """Test acknowledging already-acknowledged message (idempotent)."""
        mock_redis_ack.hget = AsyncMock(return_value="1")  # Already acknowledged
        client = CoordinationClient(mock_redis_ack, config)

        result = await client.acknowledge_message(
            message_id="msg-acked",
            ack_by="orchestrator",
        )

        assert result is True
        # Pipeline should not be called
        mock_redis_ack._pipeline.execute.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_acknowledge_message_updates_pending(
        self,
        mock_redis_ack: AsyncMock,
        config: CoordinationConfig,
    ) -> None:
        """Test that acknowledgment removes from pending set."""
        client = CoordinationClient(mock_redis_ack, config)

        await client.acknowledge_message(
            message_id="msg-pending",
            ack_by="orchestrator",
        )

        pipe = mock_redis_ack._pipeline
        pipe.srem.assert_called_once_with("test:pending", "msg-pending")

    @pytest.mark.asyncio
    async def test_acknowledge_message_redis_error(
        self,
        mock_redis_ack: AsyncMock,
        config: CoordinationConfig,
    ) -> None:
        """Test acknowledgment with Redis error."""
        mock_redis_ack._pipeline.execute = AsyncMock(
            side_effect=redis.RedisError("Connection lost")
        )
        client = CoordinationClient(mock_redis_ack, config)

        with pytest.raises(AcknowledgeError) as exc_info:
            await client.acknowledge_message(
                message_id="msg-error",
                ack_by="orchestrator",
            )

        assert "Failed to acknowledge message" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_acknowledge_message_sets_timestamp(
        self,
        mock_redis_ack: AsyncMock,
        config: CoordinationConfig,
    ) -> None:
        """Test that acknowledgment sets timestamp."""
        client = CoordinationClient(mock_redis_ack, config)

        await client.acknowledge_message(
            message_id="msg-abc123",
            ack_by="orchestrator",
        )

        pipe = mock_redis_ack._pipeline
        hset_call = pipe.hset.call_args
        ack_data = hset_call[1]["mapping"]
        assert "ack_timestamp" in ack_data
        assert ack_data["acknowledged"] == "1"
        assert ack_data["ack_by"] == "orchestrator"


class TestCoordinationClientPresence:
    """Tests for instance presence functionality."""

    @pytest.fixture
    def config(self) -> CoordinationConfig:
        """Create test configuration."""
        return CoordinationConfig(key_prefix="test", presence_timeout_minutes=5)

    @pytest.mark.asyncio
    async def test_register_instance_success(
        self,
        config: CoordinationConfig,
    ) -> None:
        """Test successful instance registration."""
        mock_redis = AsyncMock(spec=redis.Redis)
        mock_redis.hset = AsyncMock()
        client = CoordinationClient(mock_redis, config)

        await client.register_instance("backend", session_id="session-123")

        mock_redis.hset.assert_awaited_once()
        call_args = mock_redis.hset.call_args
        assert call_args[0][0] == "test:presence"
        mapping = call_args[1]["mapping"]
        assert "backend.active" in mapping
        assert "backend.last_heartbeat" in mapping
        assert "backend.session_id" in mapping

    @pytest.mark.asyncio
    async def test_register_instance_without_session(
        self,
        config: CoordinationConfig,
    ) -> None:
        """Test registration without session ID."""
        mock_redis = AsyncMock(spec=redis.Redis)
        mock_redis.hset = AsyncMock()
        client = CoordinationClient(mock_redis, config)

        await client.register_instance("backend")

        call_args = mock_redis.hset.call_args
        mapping = call_args[1]["mapping"]
        assert "backend.session_id" not in mapping

    @pytest.mark.asyncio
    async def test_register_instance_redis_error(
        self,
        config: CoordinationConfig,
    ) -> None:
        """Test registration with Redis error."""
        mock_redis = AsyncMock(spec=redis.Redis)
        mock_redis.hset = AsyncMock(side_effect=redis.RedisError("Failed"))
        client = CoordinationClient(mock_redis, config)

        with pytest.raises(PresenceError):
            await client.register_instance("backend")

    @pytest.mark.asyncio
    async def test_heartbeat_success(
        self,
        config: CoordinationConfig,
    ) -> None:
        """Test successful heartbeat."""
        mock_redis = AsyncMock(spec=redis.Redis)
        mock_redis.hset = AsyncMock()
        client = CoordinationClient(mock_redis, config)

        await client.heartbeat("backend")

        mock_redis.hset.assert_awaited_once()
        call_args = mock_redis.hset.call_args
        assert call_args[0][0] == "test:presence"
        assert call_args[0][1] == "backend.last_heartbeat"

    @pytest.mark.asyncio
    async def test_heartbeat_redis_error(
        self,
        config: CoordinationConfig,
    ) -> None:
        """Test heartbeat with Redis error."""
        mock_redis = AsyncMock(spec=redis.Redis)
        mock_redis.hset = AsyncMock(side_effect=redis.RedisError("Failed"))
        client = CoordinationClient(mock_redis, config)

        with pytest.raises(PresenceError):
            await client.heartbeat("backend")

    @pytest.mark.asyncio
    async def test_unregister_instance_success(
        self,
        config: CoordinationConfig,
    ) -> None:
        """Test successful instance unregistration."""
        mock_redis = AsyncMock(spec=redis.Redis)
        mock_redis.hdel = AsyncMock()
        client = CoordinationClient(mock_redis, config)

        await client.unregister_instance("backend")

        mock_redis.hdel.assert_awaited_once_with(
            "test:presence",
            "backend.active",
            "backend.last_heartbeat",
            "backend.session_id",
        )

    @pytest.mark.asyncio
    async def test_unregister_instance_redis_error(
        self,
        config: CoordinationConfig,
    ) -> None:
        """Test unregistration with Redis error."""
        mock_redis = AsyncMock(spec=redis.Redis)
        mock_redis.hdel = AsyncMock(side_effect=redis.RedisError("Failed"))
        client = CoordinationClient(mock_redis, config)

        with pytest.raises(PresenceError):
            await client.unregister_instance("backend")

    @pytest.mark.asyncio
    async def test_get_presence_success(
        self,
        config: CoordinationConfig,
    ) -> None:
        """Test getting presence information."""
        from datetime import timedelta

        now = datetime.now(timezone.utc)
        mock_redis = AsyncMock(spec=redis.Redis)
        mock_redis.hgetall = AsyncMock(
            return_value={
                "backend.active": "1",
                "backend.last_heartbeat": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "backend.session_id": "session-123",
                "frontend.active": "1",
                "frontend.last_heartbeat": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
            }
        )
        client = CoordinationClient(mock_redis, config)

        presence = await client.get_presence()

        assert "backend" in presence
        assert "frontend" in presence
        assert presence["backend"].active is True
        assert presence["backend"].session_id == "session-123"

    @pytest.mark.asyncio
    async def test_get_presence_stale_instance(
        self,
        config: CoordinationConfig,
    ) -> None:
        """Test that stale instances are marked inactive."""
        from datetime import timedelta

        old_time = datetime.now(timezone.utc) - timedelta(minutes=10)
        mock_redis = AsyncMock(spec=redis.Redis)
        mock_redis.hgetall = AsyncMock(
            return_value={
                "stale.active": "1",
                "stale.last_heartbeat": old_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            }
        )
        client = CoordinationClient(mock_redis, config)

        presence = await client.get_presence(timeout_minutes=5)

        assert "stale" in presence
        assert presence["stale"].active is False

    @pytest.mark.asyncio
    async def test_get_presence_empty(
        self,
        config: CoordinationConfig,
    ) -> None:
        """Test getting presence when no instances registered."""
        mock_redis = AsyncMock(spec=redis.Redis)
        mock_redis.hgetall = AsyncMock(return_value={})
        client = CoordinationClient(mock_redis, config)

        presence = await client.get_presence()

        assert len(presence) == 0

    @pytest.mark.asyncio
    async def test_get_presence_redis_error(
        self,
        config: CoordinationConfig,
    ) -> None:
        """Test get_presence with Redis error."""
        mock_redis = AsyncMock(spec=redis.Redis)
        mock_redis.hgetall = AsyncMock(side_effect=redis.RedisError("Failed"))
        client = CoordinationClient(mock_redis, config)

        with pytest.raises(PresenceError):
            await client.get_presence()


class TestCoordinationClientStats:
    """Tests for coordination stats functionality."""

    @pytest.fixture
    def config(self) -> CoordinationConfig:
        """Create test configuration."""
        return CoordinationConfig(key_prefix="test")

    @pytest.mark.asyncio
    async def test_get_stats_success(
        self,
        config: CoordinationConfig,
    ) -> None:
        """Test getting coordination stats."""
        now = datetime.now(timezone.utc)
        mock_redis = AsyncMock(spec=redis.Redis)

        # Mock pipeline for counts
        mock_pipeline = AsyncMock()
        mock_pipeline.__aenter__ = AsyncMock(return_value=mock_pipeline)
        mock_pipeline.__aexit__ = AsyncMock(return_value=None)
        mock_pipeline.zcard = MagicMock()
        mock_pipeline.scard = MagicMock()
        mock_pipeline.execute = AsyncMock(return_value=[50, 5])
        mock_redis.pipeline = MagicMock(return_value=mock_pipeline)

        # Mock presence data
        mock_redis.hgetall = AsyncMock(
            return_value={
                "backend.active": "1",
                "backend.last_heartbeat": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "orchestrator.active": "1",
                "orchestrator.last_heartbeat": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
            }
        )

        client = CoordinationClient(mock_redis, config)

        stats = await client.get_stats()

        assert stats.total_messages == 50
        assert stats.pending_messages == 5
        assert stats.active_instances == 2
        assert "backend" in stats.instance_names
        assert "orchestrator" in stats.instance_names

    @pytest.mark.asyncio
    async def test_get_stats_empty_system(
        self,
        config: CoordinationConfig,
    ) -> None:
        """Test getting stats with empty system."""
        mock_redis = AsyncMock(spec=redis.Redis)

        mock_pipeline = AsyncMock()
        mock_pipeline.__aenter__ = AsyncMock(return_value=mock_pipeline)
        mock_pipeline.__aexit__ = AsyncMock(return_value=None)
        mock_pipeline.zcard = MagicMock()
        mock_pipeline.scard = MagicMock()
        mock_pipeline.execute = AsyncMock(return_value=[0, 0])
        mock_redis.pipeline = MagicMock(return_value=mock_pipeline)

        mock_redis.hgetall = AsyncMock(return_value={})

        client = CoordinationClient(mock_redis, config)

        stats = await client.get_stats()

        assert stats.total_messages == 0
        assert stats.pending_messages == 0
        assert stats.active_instances == 0
        assert len(stats.instance_names) == 0

    @pytest.mark.asyncio
    async def test_get_stats_redis_error(
        self,
        config: CoordinationConfig,
    ) -> None:
        """Test get_stats with Redis error."""
        mock_redis = AsyncMock(spec=redis.Redis)

        mock_pipeline = AsyncMock()
        mock_pipeline.__aenter__ = AsyncMock(return_value=mock_pipeline)
        mock_pipeline.__aexit__ = AsyncMock(return_value=None)
        mock_pipeline.execute = AsyncMock(
            side_effect=redis.RedisError("Connection lost")
        )
        mock_redis.pipeline = MagicMock(return_value=mock_pipeline)

        client = CoordinationClient(mock_redis, config)

        with pytest.raises(CoordinationError) as exc_info:
            await client.get_stats()

        assert "Failed to get stats" in str(exc_info.value)


class TestCoordinationClientQueueNotification:
    """Tests for notification queuing functionality."""

    @pytest.fixture
    def config(self) -> CoordinationConfig:
        """Create test configuration."""
        return CoordinationConfig(key_prefix="test")

    @pytest.fixture
    def sample_notification(self) -> NotificationEvent:
        """Create sample notification event."""
        return NotificationEvent(
            event="message_published",
            message_id="msg-test123",
            msg_type=MessageType.READY_FOR_REVIEW,
            from_instance="backend",
            to_instance="orchestrator",
            requires_ack=True,
            timestamp=datetime(2026, 1, 23, 12, 0, 0, tzinfo=timezone.utc),
        )

    @pytest.mark.asyncio
    async def test_queue_notification_success(
        self,
        config: CoordinationConfig,
        sample_notification: NotificationEvent,
    ) -> None:
        """Test successful notification queuing."""
        mock_redis = AsyncMock(spec=redis.Redis)

        mock_pipeline = AsyncMock()
        mock_pipeline.__aenter__ = AsyncMock(return_value=mock_pipeline)
        mock_pipeline.__aexit__ = AsyncMock(return_value=None)
        mock_pipeline.lpush = MagicMock()
        mock_pipeline.expire = MagicMock()
        mock_pipeline.execute = AsyncMock(return_value=[1, True])
        mock_redis.pipeline = MagicMock(return_value=mock_pipeline)

        client = CoordinationClient(mock_redis, config)

        result = await client.queue_notification("orchestrator", sample_notification)

        assert result is True
        mock_pipeline.lpush.assert_called_once()
        mock_pipeline.expire.assert_called_once()

    @pytest.mark.asyncio
    async def test_queue_notification_uses_correct_key(
        self,
        config: CoordinationConfig,
        sample_notification: NotificationEvent,
    ) -> None:
        """Test that queue_notification uses the correct Redis key."""
        mock_redis = AsyncMock(spec=redis.Redis)

        mock_pipeline = AsyncMock()
        mock_pipeline.__aenter__ = AsyncMock(return_value=mock_pipeline)
        mock_pipeline.__aexit__ = AsyncMock(return_value=None)
        mock_pipeline.lpush = MagicMock()
        mock_pipeline.expire = MagicMock()
        mock_pipeline.execute = AsyncMock(return_value=[1, True])
        mock_redis.pipeline = MagicMock(return_value=mock_pipeline)

        client = CoordinationClient(mock_redis, config)

        await client.queue_notification("frontend", sample_notification)

        # Check that lpush was called with correct key
        lpush_call = mock_pipeline.lpush.call_args
        assert lpush_call[0][0] == "test:notifications:frontend"

    @pytest.mark.asyncio
    async def test_queue_notification_redis_error(
        self,
        config: CoordinationConfig,
        sample_notification: NotificationEvent,
    ) -> None:
        """Test queue_notification handles Redis errors."""
        mock_redis = AsyncMock(spec=redis.Redis)

        mock_pipeline = AsyncMock()
        mock_pipeline.__aenter__ = AsyncMock(return_value=mock_pipeline)
        mock_pipeline.__aexit__ = AsyncMock(return_value=None)
        mock_pipeline.lpush = MagicMock()
        mock_pipeline.expire = MagicMock()
        mock_pipeline.execute = AsyncMock(
            side_effect=redis.RedisError("Connection lost")
        )
        mock_redis.pipeline = MagicMock(return_value=mock_pipeline)

        client = CoordinationClient(mock_redis, config)

        with pytest.raises(CoordinationError) as exc_info:
            await client.queue_notification("orchestrator", sample_notification)

        assert "Failed to queue notification" in str(exc_info.value)


class TestCoordinationClientPopNotifications:
    """Tests for notification pop functionality."""

    @pytest.fixture
    def config(self) -> CoordinationConfig:
        """Create test configuration."""
        return CoordinationConfig(key_prefix="test")

    @pytest.mark.asyncio
    async def test_pop_notifications_success(
        self,
        config: CoordinationConfig,
    ) -> None:
        """Test successful notification pop."""
        import json

        notification_json = json.dumps({
            "event": "message_published",
            "message_id": "msg-abc123",
            "type": "READY_FOR_REVIEW",
            "from": "backend",
            "to": "orchestrator",
            "requires_ack": True,
            "timestamp": "2026-01-23T12:00:00Z",
        })

        mock_redis = AsyncMock(spec=redis.Redis)
        mock_pipeline = AsyncMock()
        mock_pipeline.__aenter__ = AsyncMock(return_value=mock_pipeline)
        mock_pipeline.__aexit__ = AsyncMock(return_value=None)
        mock_pipeline.lrange = MagicMock()
        mock_pipeline.delete = MagicMock()
        mock_pipeline.execute = AsyncMock(return_value=[[notification_json], 1])
        mock_redis.pipeline = MagicMock(return_value=mock_pipeline)

        client = CoordinationClient(mock_redis, config)

        notifications = await client.pop_notifications("orchestrator")

        assert len(notifications) == 1
        assert notifications[0].message_id == "msg-abc123"

    @pytest.mark.asyncio
    async def test_pop_notifications_empty_queue(
        self,
        config: CoordinationConfig,
    ) -> None:
        """Test pop_notifications with empty queue."""
        mock_redis = AsyncMock(spec=redis.Redis)
        mock_pipeline = AsyncMock()
        mock_pipeline.__aenter__ = AsyncMock(return_value=mock_pipeline)
        mock_pipeline.__aexit__ = AsyncMock(return_value=None)
        mock_pipeline.lrange = MagicMock()
        mock_pipeline.delete = MagicMock()
        mock_pipeline.execute = AsyncMock(return_value=[[], 0])
        mock_redis.pipeline = MagicMock(return_value=mock_pipeline)

        client = CoordinationClient(mock_redis, config)

        notifications = await client.pop_notifications("orchestrator")

        assert len(notifications) == 0

    @pytest.mark.asyncio
    async def test_pop_notifications_with_parse_error(
        self,
        config: CoordinationConfig,
    ) -> None:
        """Test that pop_notifications handles parse errors gracefully."""
        import json

        valid_notification = json.dumps({
            "event": "message_published",
            "message_id": "msg-valid",
            "type": "GENERAL",
            "from": "backend",
            "to": "orchestrator",
            "requires_ack": False,
            "timestamp": "2026-01-23T12:00:00Z",
        })

        mock_redis = AsyncMock(spec=redis.Redis)
        mock_pipeline = AsyncMock()
        mock_pipeline.__aenter__ = AsyncMock(return_value=mock_pipeline)
        mock_pipeline.__aexit__ = AsyncMock(return_value=None)
        mock_pipeline.lrange = MagicMock()
        mock_pipeline.delete = MagicMock()
        # Return one valid and one invalid JSON
        mock_pipeline.execute = AsyncMock(return_value=[
            [valid_notification, "invalid json {"],
            1
        ])
        mock_redis.pipeline = MagicMock(return_value=mock_pipeline)

        client = CoordinationClient(mock_redis, config)

        # Should not raise, just skip invalid entries
        notifications = await client.pop_notifications("orchestrator")

        assert len(notifications) == 1
        assert notifications[0].message_id == "msg-valid"

    @pytest.mark.asyncio
    async def test_pop_notifications_redis_error(
        self,
        config: CoordinationConfig,
    ) -> None:
        """Test pop_notifications handles Redis errors."""
        mock_redis = AsyncMock(spec=redis.Redis)
        mock_pipeline = AsyncMock()
        mock_pipeline.__aenter__ = AsyncMock(return_value=mock_pipeline)
        mock_pipeline.__aexit__ = AsyncMock(return_value=None)
        mock_pipeline.lrange = MagicMock()
        mock_pipeline.delete = MagicMock()
        mock_pipeline.execute = AsyncMock(
            side_effect=redis.RedisError("Connection lost")
        )
        mock_redis.pipeline = MagicMock(return_value=mock_pipeline)

        client = CoordinationClient(mock_redis, config)

        with pytest.raises(CoordinationError) as exc_info:
            await client.pop_notifications("orchestrator")

        assert "Failed to pop notifications" in str(exc_info.value)


class TestCoordinationClientQueueIfOffline:
    """Tests for _queue_if_offline helper."""

    @pytest.fixture
    def config(self) -> CoordinationConfig:
        """Create test configuration."""
        return CoordinationConfig(key_prefix="test")

    @pytest.fixture
    def sample_notification(self) -> NotificationEvent:
        """Create sample notification event."""
        return NotificationEvent(
            event="message_published",
            message_id="msg-test123",
            msg_type=MessageType.READY_FOR_REVIEW,
            from_instance="backend",
            to_instance="orchestrator",
            requires_ack=True,
            timestamp=datetime(2026, 1, 23, 12, 0, 0, tzinfo=timezone.utc),
        )

    @pytest.mark.asyncio
    async def test_queue_if_offline_queues_for_offline_instance(
        self,
        config: CoordinationConfig,
        sample_notification: NotificationEvent,
    ) -> None:
        """Test that notification is queued when instance is offline."""
        mock_redis = AsyncMock(spec=redis.Redis)

        # Presence shows no active instances
        mock_redis.hgetall = AsyncMock(return_value={})

        # Setup pipeline for queue_notification
        mock_pipeline = AsyncMock()
        mock_pipeline.__aenter__ = AsyncMock(return_value=mock_pipeline)
        mock_pipeline.__aexit__ = AsyncMock(return_value=None)
        mock_pipeline.lpush = MagicMock()
        mock_pipeline.expire = MagicMock()
        mock_pipeline.execute = AsyncMock(return_value=[1, True])
        mock_redis.pipeline = MagicMock(return_value=mock_pipeline)

        client = CoordinationClient(mock_redis, config)

        await client._queue_if_offline("orchestrator", sample_notification)

        # Should have called lpush (queue_notification was invoked)
        mock_pipeline.lpush.assert_called_once()

    @pytest.mark.asyncio
    async def test_queue_if_offline_skips_for_online_instance(
        self,
        config: CoordinationConfig,
        sample_notification: NotificationEvent,
    ) -> None:
        """Test that notification is NOT queued when instance is online."""
        mock_redis = AsyncMock(spec=redis.Redis)

        # Presence shows orchestrator as active
        mock_redis.hgetall = AsyncMock(return_value={
            "orchestrator.active": "1",
            "orchestrator.session_id": "session-123",
            "orchestrator.last_heartbeat": datetime.now(timezone.utc).isoformat(),
        })

        # Setup pipeline - should NOT be used for queueing
        mock_pipeline = AsyncMock()
        mock_pipeline.__aenter__ = AsyncMock(return_value=mock_pipeline)
        mock_pipeline.__aexit__ = AsyncMock(return_value=None)
        mock_pipeline.lpush = MagicMock()
        mock_pipeline.expire = MagicMock()
        mock_pipeline.execute = AsyncMock(return_value=[1, True])
        mock_redis.pipeline = MagicMock(return_value=mock_pipeline)

        client = CoordinationClient(mock_redis, config)

        await client._queue_if_offline("orchestrator", sample_notification)

        # Should NOT have called lpush (queue_notification NOT invoked)
        mock_pipeline.lpush.assert_not_called()

    @pytest.mark.asyncio
    async def test_queue_if_offline_handles_errors_gracefully(
        self,
        config: CoordinationConfig,
        sample_notification: NotificationEvent,
    ) -> None:
        """Test that errors in _queue_if_offline don't propagate."""
        mock_redis = AsyncMock(spec=redis.Redis)

        # Presence check fails
        mock_redis.hgetall = AsyncMock(
            side_effect=redis.RedisError("Connection lost")
        )

        client = CoordinationClient(mock_redis, config)

        # Should not raise - errors are logged but not propagated
        await client._queue_if_offline("orchestrator", sample_notification)
