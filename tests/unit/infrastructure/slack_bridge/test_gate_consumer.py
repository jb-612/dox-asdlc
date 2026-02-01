"""Unit tests for Slack Bridge Gate Consumer.

Tests the GateConsumer class for consuming gate events and posting to Slack.
"""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
from pydantic import SecretStr

from src.core.events import ASDLCEvent, EventType
from src.infrastructure.slack_bridge.config import ChannelConfig, SlackBridgeConfig
from src.infrastructure.slack_bridge.gate_consumer import GateConsumer


class TestGateConsumer:
    """Tests for GateConsumer class."""

    @pytest.fixture
    def config(self) -> SlackBridgeConfig:
        """Sample config for testing."""
        return SlackBridgeConfig(
            bot_token=SecretStr("xoxb-test"),
            app_token=SecretStr("xapp-test"),
            signing_secret=SecretStr("secret"),
            routing_policy={
                "hitl_4_code": ChannelConfig(
                    channel_id="C-CODE",
                    required_role="reviewer",
                ),
                "hitl_6_release": ChannelConfig(
                    channel_id="C-RELEASE",
                    required_role="release_manager",
                    mention_users=["U001"],
                ),
            },
            rbac_map={},
            consumer_group="test_group",
            consumer_name="test_consumer",
        )

    @pytest.fixture
    def mock_redis(self) -> AsyncMock:
        """Mock Redis client."""
        mock = AsyncMock()
        mock.exists = AsyncMock(return_value=0)
        mock.set = AsyncMock(return_value=True)
        mock.sadd = AsyncMock(return_value=1)
        mock.sismember = AsyncMock(return_value=0)
        return mock

    @pytest.fixture
    def mock_slack(self) -> MagicMock:
        """Mock Slack WebClient."""
        mock = MagicMock()
        mock.chat_postMessage = AsyncMock(return_value={"ts": "1234567890.123456"})
        return mock

    @pytest.fixture
    def consumer(
        self, mock_redis: AsyncMock, mock_slack: MagicMock, config: SlackBridgeConfig
    ) -> GateConsumer:
        """Create GateConsumer instance."""
        return GateConsumer(
            redis_client=mock_redis,
            slack_client=mock_slack,
            config=config,
        )

    def test_consumer_initialization(self, consumer: GateConsumer, config: SlackBridgeConfig):
        """Consumer initializes with correct config."""
        assert consumer.config == config
        assert consumer.STREAM_NAME == "asdlc:events"
        assert consumer.GROUP_NAME == "test_group"

    def test_build_evidence_url(self, consumer: GateConsumer):
        """Build evidence URL for request ID."""
        url = consumer.build_evidence_url("req-123")

        assert "req-123" in url
        # URL should point to HITL UI
        assert "evidence" in url.lower() or "gate" in url.lower()

    @pytest.mark.asyncio
    async def test_handle_gate_requested_posts_to_slack(
        self, consumer: GateConsumer, mock_slack: MagicMock
    ):
        """Gate requested event posts message to Slack."""
        event = ASDLCEvent(
            event_id="evt-001",
            event_type=EventType.GATE_REQUESTED,
            session_id="session-123",
            task_id="task-456",
            timestamp=datetime.now(UTC),
            metadata={
                "gate_type": "hitl_4_code",
                "request_id": "req-789",
                "summary": "Review code changes",
                "requested_by": "agent-coder",
            },
        )

        await consumer.handle_gate_requested(event)

        mock_slack.chat_postMessage.assert_called_once()
        call_kwargs = mock_slack.chat_postMessage.call_args.kwargs
        assert call_kwargs["channel"] == "C-CODE"
        assert "blocks" in call_kwargs
        assert "text" in call_kwargs

    @pytest.mark.asyncio
    async def test_handle_gate_requested_unknown_gate_type(
        self, consumer: GateConsumer, mock_slack: MagicMock
    ):
        """Unknown gate type does not post to Slack."""
        event = ASDLCEvent(
            event_id="evt-001",
            event_type=EventType.GATE_REQUESTED,
            session_id="session-123",
            task_id="task-456",
            timestamp=datetime.now(UTC),
            metadata={
                "gate_type": "hitl_99_unknown",
                "request_id": "req-789",
                "summary": "Unknown gate",
                "requested_by": "agent",
            },
        )

        await consumer.handle_gate_requested(event)

        mock_slack.chat_postMessage.assert_not_called()

    @pytest.mark.asyncio
    async def test_handle_gate_requested_uses_correct_channel(
        self, consumer: GateConsumer, mock_slack: MagicMock
    ):
        """Gate type determines which channel receives the message."""
        event = ASDLCEvent(
            event_id="evt-001",
            event_type=EventType.GATE_REQUESTED,
            session_id="session-123",
            task_id="task-456",
            timestamp=datetime.now(UTC),
            metadata={
                "gate_type": "hitl_6_release",
                "request_id": "req-789",
                "summary": "Release approval",
                "requested_by": "agent-deployer",
            },
        )

        await consumer.handle_gate_requested(event)

        call_kwargs = mock_slack.chat_postMessage.call_args.kwargs
        assert call_kwargs["channel"] == "C-RELEASE"

    @pytest.mark.asyncio
    async def test_handle_gate_requested_builds_blocks(
        self, consumer: GateConsumer, mock_slack: MagicMock
    ):
        """Gate request event builds correct Block Kit blocks."""
        event = ASDLCEvent(
            event_id="evt-001",
            event_type=EventType.GATE_REQUESTED,
            session_id="session-123",
            task_id="task-456",
            timestamp=datetime.now(UTC),
            metadata={
                "gate_type": "hitl_4_code",
                "request_id": "req-789",
                "summary": "Review code changes",
                "requested_by": "agent-coder",
            },
        )

        await consumer.handle_gate_requested(event)

        call_kwargs = mock_slack.chat_postMessage.call_args.kwargs
        blocks = call_kwargs["blocks"]

        # Verify blocks structure
        assert any(b["type"] == "header" for b in blocks)
        assert any(b["type"] == "actions" for b in blocks)

        # Verify action buttons have request_id
        actions = next(b for b in blocks if b["type"] == "actions")
        assert any(e["value"] == "req-789" for e in actions["elements"])


class TestGateConsumerDuplicateDetection:
    """Tests for duplicate detection in GateConsumer."""

    @pytest.fixture
    def config(self) -> SlackBridgeConfig:
        """Sample config for testing."""
        return SlackBridgeConfig(
            bot_token=SecretStr("xoxb-test"),
            app_token=SecretStr("xapp-test"),
            signing_secret=SecretStr("secret"),
            routing_policy={
                "hitl_4_code": ChannelConfig(
                    channel_id="C-CODE",
                    required_role="reviewer",
                ),
            },
            rbac_map={},
        )

    @pytest.fixture
    def mock_redis(self) -> AsyncMock:
        """Mock Redis client."""
        mock = AsyncMock()
        mock.exists = AsyncMock(return_value=0)
        mock.set = AsyncMock(return_value=True)
        mock.sadd = AsyncMock(return_value=1)
        mock.sismember = AsyncMock(return_value=0)
        return mock

    @pytest.fixture
    def mock_slack(self) -> MagicMock:
        """Mock Slack WebClient."""
        mock = MagicMock()
        mock.chat_postMessage = AsyncMock(return_value={"ts": "1234567890.123456"})
        return mock

    @pytest.fixture
    def consumer(
        self, mock_redis: AsyncMock, mock_slack: MagicMock, config: SlackBridgeConfig
    ) -> GateConsumer:
        """Create GateConsumer instance."""
        return GateConsumer(
            redis_client=mock_redis,
            slack_client=mock_slack,
            config=config,
        )

    @pytest.mark.asyncio
    async def test_is_already_posted_false(self, consumer: GateConsumer, mock_redis: AsyncMock):
        """Returns False for new request_id."""
        mock_redis.sismember = AsyncMock(return_value=0)

        result = await consumer.is_already_posted("req-new")

        assert result is False
        mock_redis.sismember.assert_called_once()

    @pytest.mark.asyncio
    async def test_is_already_posted_true(self, consumer: GateConsumer, mock_redis: AsyncMock):
        """Returns True for already posted request_id."""
        mock_redis.sismember = AsyncMock(return_value=1)

        result = await consumer.is_already_posted("req-existing")

        assert result is True

    @pytest.mark.asyncio
    async def test_mark_as_posted(self, consumer: GateConsumer, mock_redis: AsyncMock):
        """Marks request_id as posted in Redis."""
        await consumer.mark_as_posted("req-123", "1234567890.123456")

        mock_redis.sadd.assert_called_once()
        # Should set TTL
        mock_redis.expire.assert_called_once() if hasattr(mock_redis, "expire") else True

    @pytest.mark.asyncio
    async def test_handle_gate_requested_skips_duplicate(
        self, consumer: GateConsumer, mock_slack: MagicMock, mock_redis: AsyncMock
    ):
        """Duplicate gate request is not posted again."""
        mock_redis.sismember = AsyncMock(return_value=1)  # Already posted

        event = ASDLCEvent(
            event_id="evt-001",
            event_type=EventType.GATE_REQUESTED,
            session_id="session-123",
            task_id="task-456",
            timestamp=datetime.now(UTC),
            metadata={
                "gate_type": "hitl_4_code",
                "request_id": "req-duplicate",
                "summary": "Review code",
                "requested_by": "agent",
            },
        )

        await consumer.handle_gate_requested(event)

        mock_slack.chat_postMessage.assert_not_called()

    @pytest.mark.asyncio
    async def test_handle_gate_requested_marks_as_posted(
        self, consumer: GateConsumer, mock_slack: MagicMock, mock_redis: AsyncMock
    ):
        """Successful post marks request_id as posted."""
        mock_redis.sismember = AsyncMock(return_value=0)  # Not yet posted

        event = ASDLCEvent(
            event_id="evt-001",
            event_type=EventType.GATE_REQUESTED,
            session_id="session-123",
            task_id="task-456",
            timestamp=datetime.now(UTC),
            metadata={
                "gate_type": "hitl_4_code",
                "request_id": "req-new",
                "summary": "Review code",
                "requested_by": "agent",
            },
        )

        await consumer.handle_gate_requested(event)

        mock_slack.chat_postMessage.assert_called_once()
        mock_redis.sadd.assert_called_once()


class TestGateConsumerEnvironmentSupport:
    """Tests for environment-based routing in GateConsumer."""

    @pytest.fixture
    def config(self) -> SlackBridgeConfig:
        """Config with environment overrides."""
        return SlackBridgeConfig(
            bot_token=SecretStr("xoxb-test"),
            app_token=SecretStr("xapp-test"),
            signing_secret=SecretStr("secret"),
            routing_policy={
                "hitl_6_release": ChannelConfig(
                    channel_id="C-DEFAULT-RELEASE",
                    required_role="release_manager",
                ),
            },
            environment_overrides={
                "production": {
                    "hitl_6_release": ChannelConfig(
                        channel_id="C-PROD-RELEASE",
                        required_role="release_manager",
                    ),
                },
            },
            rbac_map={},
        )

    @pytest.fixture
    def mock_redis(self) -> AsyncMock:
        """Mock Redis client."""
        mock = AsyncMock()
        mock.sismember = AsyncMock(return_value=0)
        mock.sadd = AsyncMock(return_value=1)
        return mock

    @pytest.fixture
    def mock_slack(self) -> MagicMock:
        """Mock Slack WebClient."""
        mock = MagicMock()
        mock.chat_postMessage = AsyncMock(return_value={"ts": "1234567890.123456"})
        return mock

    @pytest.fixture
    def consumer(
        self, mock_redis: AsyncMock, mock_slack: MagicMock, config: SlackBridgeConfig
    ) -> GateConsumer:
        """Create GateConsumer instance."""
        return GateConsumer(
            redis_client=mock_redis,
            slack_client=mock_slack,
            config=config,
        )

    @pytest.mark.asyncio
    async def test_uses_environment_override(self, consumer: GateConsumer, mock_slack: MagicMock):
        """Event with environment uses environment-specific channel."""
        event = ASDLCEvent(
            event_id="evt-001",
            event_type=EventType.GATE_REQUESTED,
            session_id="session-123",
            task_id="task-456",
            timestamp=datetime.now(UTC),
            metadata={
                "gate_type": "hitl_6_release",
                "request_id": "req-789",
                "summary": "Production release",
                "requested_by": "agent",
                "environment": "production",
            },
        )

        await consumer.handle_gate_requested(event)

        call_kwargs = mock_slack.chat_postMessage.call_args.kwargs
        assert call_kwargs["channel"] == "C-PROD-RELEASE"

    @pytest.mark.asyncio
    async def test_uses_default_without_environment(
        self, consumer: GateConsumer, mock_slack: MagicMock
    ):
        """Event without environment uses default channel."""
        event = ASDLCEvent(
            event_id="evt-001",
            event_type=EventType.GATE_REQUESTED,
            session_id="session-123",
            task_id="task-456",
            timestamp=datetime.now(UTC),
            metadata={
                "gate_type": "hitl_6_release",
                "request_id": "req-789",
                "summary": "Release",
                "requested_by": "agent",
            },
        )

        await consumer.handle_gate_requested(event)

        call_kwargs = mock_slack.chat_postMessage.call_args.kwargs
        assert call_kwargs["channel"] == "C-DEFAULT-RELEASE"
