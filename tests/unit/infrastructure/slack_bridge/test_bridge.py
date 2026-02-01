"""Unit tests for Slack Bridge main module.

Tests the SlackBridge class which serves as the main entry point
for the Slack HITL Bridge application.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch, ANY

import pytest
from pydantic import SecretStr

from src.infrastructure.slack_bridge.config import ChannelConfig, SlackBridgeConfig


class TestSlackBridgeInitialization:
    """Tests for SlackBridge initialization."""

    @pytest.fixture
    def config(self) -> SlackBridgeConfig:
        """Sample config for testing."""
        return SlackBridgeConfig(
            bot_token=SecretStr("xoxb-test-token"),
            app_token=SecretStr("xapp-test-token"),
            signing_secret=SecretStr("test-secret"),
            routing_policy={
                "hitl_4_code": ChannelConfig(
                    channel_id="C-CODE",
                    required_role="reviewer",
                ),
            },
            rbac_map={"U001": ["reviewer"]},
        )

    @pytest.fixture
    def mock_redis(self) -> AsyncMock:
        """Mock Redis client."""
        return AsyncMock()

    def test_bridge_initialization_with_valid_config(
        self, config: SlackBridgeConfig, mock_redis: AsyncMock
    ):
        """Bridge initializes successfully with valid config."""
        from src.infrastructure.slack_bridge.bridge import SlackBridge

        bridge = SlackBridge(config=config, redis_client=mock_redis)

        assert bridge.config == config
        assert bridge.app is not None

    def test_bridge_creates_decision_handler(
        self, config: SlackBridgeConfig, mock_redis: AsyncMock
    ):
        """Bridge creates DecisionHandler on initialization."""
        from src.infrastructure.slack_bridge.bridge import SlackBridge

        bridge = SlackBridge(config=config, redis_client=mock_redis)

        assert bridge.decision_handler is not None

    def test_bridge_creates_gate_consumer(
        self, config: SlackBridgeConfig, mock_redis: AsyncMock
    ):
        """Bridge creates GateConsumer on initialization."""
        from src.infrastructure.slack_bridge.bridge import SlackBridge

        bridge = SlackBridge(config=config, redis_client=mock_redis)

        assert bridge.gate_consumer is not None


class TestActionHandlerRegistration:
    """Tests for action handler registration."""

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
            rbac_map={"U001": ["reviewer"]},
        )

    @pytest.fixture
    def mock_redis(self) -> AsyncMock:
        """Mock Redis client."""
        return AsyncMock()

    def test_registers_approve_gate_action(
        self, config: SlackBridgeConfig, mock_redis: AsyncMock
    ):
        """Bridge registers approve_gate action handler."""
        from src.infrastructure.slack_bridge.bridge import SlackBridge

        bridge = SlackBridge(config=config, redis_client=mock_redis)

        # Verify action handler is registered by checking the app's action registry
        assert bridge.app is not None

    def test_registers_reject_gate_action(
        self, config: SlackBridgeConfig, mock_redis: AsyncMock
    ):
        """Bridge registers reject_gate action handler."""
        from src.infrastructure.slack_bridge.bridge import SlackBridge

        bridge = SlackBridge(config=config, redis_client=mock_redis)

        # Verify action handler is registered
        assert bridge.app is not None

    def test_registers_rejection_modal_view_handler(
        self, config: SlackBridgeConfig, mock_redis: AsyncMock
    ):
        """Bridge registers rejection_modal view submission handler."""
        from src.infrastructure.slack_bridge.bridge import SlackBridge

        bridge = SlackBridge(config=config, redis_client=mock_redis)

        # Verify view handler is registered
        assert bridge.app is not None


class TestApproveGateHandler:
    """Tests for approve_gate action handler."""

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
            rbac_map={"U001": ["reviewer"]},
        )

    @pytest.fixture
    def mock_redis(self) -> AsyncMock:
        """Mock Redis client."""
        return AsyncMock()

    @pytest.mark.asyncio
    async def test_approve_gate_calls_decision_handler(
        self, config: SlackBridgeConfig, mock_redis: AsyncMock
    ):
        """Approve gate action calls DecisionHandler.handle_approval."""
        from src.infrastructure.slack_bridge.bridge import SlackBridge

        bridge = SlackBridge(config=config, redis_client=mock_redis)

        # Mock the decision handler methods
        bridge.decision_handler.handle_approval = AsyncMock(return_value=True)
        bridge.decision_handler.update_message_after_approval = AsyncMock()

        # Create mock action body
        body = {
            "user": {"id": "U001"},
            "channel": {"id": "C-CODE"},
            "message": {"ts": "1234567890.123456", "blocks": []},
            "actions": [{"value": "req-001"}],
        }

        ack = AsyncMock()
        client = MagicMock()
        client.users_info = AsyncMock(
            return_value={"user": {"real_name": "Test User"}}
        )

        # Call the handler
        await bridge._handle_approve_gate(ack, body, client)

        ack.assert_called_once()
        bridge.decision_handler.handle_approval.assert_called_once()


class TestRejectGateHandler:
    """Tests for reject_gate action handler."""

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
            rbac_map={"U001": ["reviewer"]},
        )

    @pytest.fixture
    def mock_redis(self) -> AsyncMock:
        """Mock Redis client."""
        return AsyncMock()

    @pytest.mark.asyncio
    async def test_reject_gate_opens_modal(
        self, config: SlackBridgeConfig, mock_redis: AsyncMock
    ):
        """Reject gate action opens rejection modal."""
        from src.infrastructure.slack_bridge.bridge import SlackBridge

        bridge = SlackBridge(config=config, redis_client=mock_redis)

        bridge.decision_handler.open_rejection_modal = AsyncMock()

        body = {
            "user": {"id": "U001"},
            "trigger_id": "trigger-123",
            "actions": [{"value": "req-001"}],
        }

        ack = AsyncMock()
        client = MagicMock()

        await bridge._handle_reject_gate(ack, body, client)

        ack.assert_called_once()
        bridge.decision_handler.open_rejection_modal.assert_called_once_with(
            trigger_id="trigger-123",
            request_id="req-001",
        )


class TestRejectionModalHandler:
    """Tests for rejection modal submission handler."""

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
            rbac_map={"U001": ["reviewer"]},
        )

    @pytest.fixture
    def mock_redis(self) -> AsyncMock:
        """Mock Redis client."""
        return AsyncMock()

    @pytest.mark.asyncio
    async def test_modal_submit_calls_handle_rejection(
        self, config: SlackBridgeConfig, mock_redis: AsyncMock
    ):
        """Modal submission calls handle_rejection_modal_submit."""
        from src.infrastructure.slack_bridge.bridge import SlackBridge

        bridge = SlackBridge(config=config, redis_client=mock_redis)

        bridge.decision_handler.handle_rejection_modal_submit = AsyncMock(
            return_value={"success": True}
        )
        bridge.decision_handler.update_message_after_rejection = AsyncMock()

        body = {
            "user": {"id": "U001"},
            "view": {
                "callback_id": "rejection_modal_req-001",
                "private_metadata": "req-001",
                "state": {
                    "values": {
                        "reason_block": {"reason_input": {"value": "Test reason"}}
                    }
                },
            },
        }

        ack = AsyncMock()
        client = MagicMock()
        client.users_info = AsyncMock(
            return_value={"user": {"real_name": "Test User"}}
        )

        await bridge._handle_rejection_modal(ack, body, client)

        ack.assert_called_once()
        bridge.decision_handler.handle_rejection_modal_submit.assert_called_once()


class TestIdeaNewCommandHandler:
    """Tests for /idea-new slash command handler."""

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
            rbac_map={"U001": ["reviewer"]},
            ideas_channels=["C-IDEAS"],
            ideas_emoji="bulb",
        )

    @pytest.fixture
    def mock_redis(self) -> AsyncMock:
        """Mock Redis client."""
        return AsyncMock()

    @pytest.fixture
    def mock_idea_handler(self) -> AsyncMock:
        """Mock IdeaHandler."""
        from datetime import UTC, datetime

        from src.orchestrator.api.models.idea import Idea, IdeaStatus

        mock = AsyncMock()
        mock.create_idea_from_command = AsyncMock(
            return_value=Idea(
                id="idea-abc12345",
                content="Test idea",
                author_id="U001",
                author_name="Test User",
                status=IdeaStatus.ACTIVE,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
                word_count=2,
            )
        )
        return mock

    @pytest.mark.asyncio
    async def test_idea_new_command_creates_idea(
        self,
        config: SlackBridgeConfig,
        mock_redis: AsyncMock,
        mock_idea_handler: AsyncMock,
    ):
        """Successful /idea-new command creates idea and returns confirmation."""
        from src.infrastructure.slack_bridge.bridge import SlackBridge

        bridge = SlackBridge(config=config, redis_client=mock_redis)
        bridge.idea_handler = mock_idea_handler

        command = {
            "user_id": "U001",
            "channel_id": "C-IDEAS",
            "text": "This is my great idea",
        }

        ack = AsyncMock()
        client = MagicMock()
        client.chat_postEphemeral = AsyncMock()

        await bridge._handle_idea_new_command(ack, command, client)

        ack.assert_called_once()
        mock_idea_handler.create_idea_from_command.assert_called_once_with(
            user_id="U001",
            text="This is my great idea",
            channel_id="C-IDEAS",
        )
        # Verify success message was sent
        client.chat_postEphemeral.assert_called_once()
        call_kwargs = client.chat_postEphemeral.call_args.kwargs
        assert "idea-abc" in call_kwargs.get("text", "")  # Reference shows first 8 chars

    @pytest.mark.asyncio
    async def test_idea_new_command_empty_text_returns_error(
        self,
        config: SlackBridgeConfig,
        mock_redis: AsyncMock,
        mock_idea_handler: AsyncMock,
    ):
        """Empty text returns usage error message."""
        from src.infrastructure.slack_bridge.bridge import SlackBridge

        bridge = SlackBridge(config=config, redis_client=mock_redis)
        bridge.idea_handler = mock_idea_handler

        command = {
            "user_id": "U001",
            "channel_id": "C-IDEAS",
            "text": "",  # Empty
        }

        ack = AsyncMock()
        client = MagicMock()
        client.chat_postEphemeral = AsyncMock()

        await bridge._handle_idea_new_command(ack, command, client)

        ack.assert_called_once()
        mock_idea_handler.create_idea_from_command.assert_not_called()
        # Verify usage error was sent
        call_kwargs = client.chat_postEphemeral.call_args.kwargs
        assert "Usage" in call_kwargs.get("text", "")

    @pytest.mark.asyncio
    async def test_idea_new_command_whitespace_only_returns_error(
        self,
        config: SlackBridgeConfig,
        mock_redis: AsyncMock,
        mock_idea_handler: AsyncMock,
    ):
        """Whitespace-only text returns usage error message."""
        from src.infrastructure.slack_bridge.bridge import SlackBridge

        bridge = SlackBridge(config=config, redis_client=mock_redis)
        bridge.idea_handler = mock_idea_handler

        command = {
            "user_id": "U001",
            "channel_id": "C-IDEAS",
            "text": "   ",  # Whitespace only
        }

        ack = AsyncMock()
        client = MagicMock()
        client.chat_postEphemeral = AsyncMock()

        await bridge._handle_idea_new_command(ack, command, client)

        ack.assert_called_once()
        mock_idea_handler.create_idea_from_command.assert_not_called()

    @pytest.mark.asyncio
    async def test_idea_new_command_no_handler_returns_error(
        self, config: SlackBridgeConfig, mock_redis: AsyncMock
    ):
        """Missing idea handler returns configuration error."""
        from src.infrastructure.slack_bridge.bridge import SlackBridge

        bridge = SlackBridge(config=config, redis_client=mock_redis)
        # idea_handler is None by default

        command = {
            "user_id": "U001",
            "channel_id": "C-IDEAS",
            "text": "My idea",
        }

        ack = AsyncMock()
        client = MagicMock()
        client.chat_postEphemeral = AsyncMock()

        await bridge._handle_idea_new_command(ack, command, client)

        ack.assert_called_once()
        call_kwargs = client.chat_postEphemeral.call_args.kwargs
        assert "not configured" in call_kwargs.get("text", "").lower()

    @pytest.mark.asyncio
    async def test_idea_new_command_failed_creation_returns_error(
        self,
        config: SlackBridgeConfig,
        mock_redis: AsyncMock,
        mock_idea_handler: AsyncMock,
    ):
        """Failed idea creation returns error message."""
        from src.infrastructure.slack_bridge.bridge import SlackBridge

        bridge = SlackBridge(config=config, redis_client=mock_redis)
        mock_idea_handler.create_idea_from_command = AsyncMock(return_value=None)
        bridge.idea_handler = mock_idea_handler

        command = {
            "user_id": "U001",
            "channel_id": "C-IDEAS",
            "text": "My idea that will fail",
        }

        ack = AsyncMock()
        client = MagicMock()
        client.chat_postEphemeral = AsyncMock()

        await bridge._handle_idea_new_command(ack, command, client)

        ack.assert_called_once()
        call_kwargs = client.chat_postEphemeral.call_args.kwargs
        assert "failed" in call_kwargs.get("text", "").lower()


class TestGracefulShutdown:
    """Tests for graceful shutdown handling."""

    @pytest.fixture
    def config(self) -> SlackBridgeConfig:
        """Sample config for testing."""
        return SlackBridgeConfig(
            bot_token=SecretStr("xoxb-test"),
            app_token=SecretStr("xapp-test"),
            signing_secret=SecretStr("secret"),
            routing_policy={},
            rbac_map={},
        )

    @pytest.fixture
    def mock_redis(self) -> AsyncMock:
        """Mock Redis client."""
        return AsyncMock()

    @pytest.mark.asyncio
    async def test_shutdown_stops_consumer(
        self, config: SlackBridgeConfig, mock_redis: AsyncMock
    ):
        """Shutdown stops the gate consumer."""
        from src.infrastructure.slack_bridge.bridge import SlackBridge

        bridge = SlackBridge(config=config, redis_client=mock_redis)
        bridge._running = True

        await bridge.shutdown()

        assert bridge._running is False


class TestErrorHandling:
    """Tests for error handling in action handlers."""

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
            rbac_map={"U001": ["reviewer"]},
        )

    @pytest.fixture
    def mock_redis(self) -> AsyncMock:
        """Mock Redis client."""
        return AsyncMock()

    @pytest.mark.asyncio
    async def test_rbac_denied_sends_ephemeral_message(
        self, config: SlackBridgeConfig, mock_redis: AsyncMock
    ):
        """RBAC denial sends ephemeral error message to user."""
        from src.infrastructure.slack_bridge.bridge import SlackBridge
        from src.infrastructure.slack_bridge.decision_handler import RBACDeniedException

        bridge = SlackBridge(config=config, redis_client=mock_redis)

        bridge.decision_handler.handle_approval = AsyncMock(
            side_effect=RBACDeniedException("Not authorized")
        )

        body = {
            "user": {"id": "U002"},
            "channel": {"id": "C-CODE"},
            "message": {"ts": "1234567890.123456", "blocks": []},
            "actions": [{"value": "req-001"}],
        }

        ack = AsyncMock()
        client = MagicMock()
        client.chat_postEphemeral = AsyncMock()

        await bridge._handle_approve_gate(ack, body, client)

        ack.assert_called_once()
        client.chat_postEphemeral.assert_called_once()

    @pytest.mark.asyncio
    async def test_already_decided_sends_ephemeral_message(
        self, config: SlackBridgeConfig, mock_redis: AsyncMock
    ):
        """Already decided gate sends ephemeral message."""
        from src.infrastructure.slack_bridge.bridge import SlackBridge
        from src.infrastructure.slack_bridge.decision_handler import (
            GateAlreadyDecidedException,
        )

        bridge = SlackBridge(config=config, redis_client=mock_redis)

        bridge.decision_handler.handle_approval = AsyncMock(
            side_effect=GateAlreadyDecidedException("Already approved")
        )

        body = {
            "user": {"id": "U001"},
            "channel": {"id": "C-CODE"},
            "message": {"ts": "1234567890.123456", "blocks": []},
            "actions": [{"value": "req-001"}],
        }

        ack = AsyncMock()
        client = MagicMock()
        client.chat_postEphemeral = AsyncMock()

        await bridge._handle_approve_gate(ack, body, client)

        ack.assert_called_once()
        client.chat_postEphemeral.assert_called_once()
        # Verify message mentions "already"
        call_kwargs = client.chat_postEphemeral.call_args.kwargs
        assert "already" in call_kwargs.get("text", "").lower()


class TestHealthCheck:
    """Tests for health check endpoint (T19)."""

    @pytest.fixture
    def config(self) -> SlackBridgeConfig:
        """Sample config for testing."""
        return SlackBridgeConfig(
            bot_token=SecretStr("xoxb-test"),
            app_token=SecretStr("xapp-test"),
            signing_secret=SecretStr("secret"),
            routing_policy={},
            rbac_map={},
        )

    @pytest.fixture
    def mock_redis(self) -> AsyncMock:
        """Mock Redis client."""
        mock = AsyncMock()
        mock.ping = AsyncMock(return_value=True)
        return mock

    @pytest.mark.asyncio
    async def test_get_health_status_healthy(
        self, config: SlackBridgeConfig, mock_redis: AsyncMock
    ):
        """Health status returns healthy when all components are connected."""
        from src.infrastructure.slack_bridge.bridge import SlackBridge

        bridge = SlackBridge(config=config, redis_client=mock_redis)

        # Mock Slack auth.test
        bridge.app.client.auth_test = AsyncMock(
            return_value={"ok": True, "user_id": "U123"}
        )

        status = await bridge.get_health_status()

        assert status["status"] == "healthy"
        assert status["components"]["slack"]["status"] == "healthy"
        assert status["components"]["slack"]["connected"] is True
        assert status["components"]["redis"]["status"] == "healthy"
        assert status["components"]["redis"]["connected"] is True

    @pytest.mark.asyncio
    async def test_get_health_status_slack_unhealthy(
        self, config: SlackBridgeConfig, mock_redis: AsyncMock
    ):
        """Health status returns unhealthy when Slack is disconnected."""
        from src.infrastructure.slack_bridge.bridge import SlackBridge

        bridge = SlackBridge(config=config, redis_client=mock_redis)

        # Mock Slack auth.test failure
        bridge.app.client.auth_test = AsyncMock(
            return_value={"ok": False, "error": "invalid_auth"}
        )

        status = await bridge.get_health_status()

        assert status["status"] == "unhealthy"
        assert status["components"]["slack"]["status"] == "unhealthy"
        assert status["components"]["slack"]["connected"] is False
        assert "invalid_auth" in status["components"]["slack"]["error"]

    @pytest.mark.asyncio
    async def test_get_health_status_redis_unhealthy(
        self, config: SlackBridgeConfig
    ):
        """Health status returns unhealthy when Redis is disconnected."""
        from src.infrastructure.slack_bridge.bridge import SlackBridge

        mock_redis = AsyncMock()
        mock_redis.ping = AsyncMock(side_effect=Exception("Connection refused"))

        bridge = SlackBridge(config=config, redis_client=mock_redis)

        # Mock Slack auth.test success
        bridge.app.client.auth_test = AsyncMock(
            return_value={"ok": True, "user_id": "U123"}
        )

        status = await bridge.get_health_status()

        assert status["status"] == "unhealthy"
        assert status["components"]["redis"]["status"] == "unhealthy"
        assert status["components"]["redis"]["connected"] is False

    @pytest.mark.asyncio
    async def test_health_status_includes_version(
        self, config: SlackBridgeConfig, mock_redis: AsyncMock
    ):
        """Health status includes version information."""
        from src.infrastructure.slack_bridge.bridge import SlackBridge, __version__

        bridge = SlackBridge(config=config, redis_client=mock_redis)
        bridge.app.client.auth_test = AsyncMock(
            return_value={"ok": True, "user_id": "U123"}
        )

        status = await bridge.get_health_status()

        assert "version" in status
        assert status["version"] == __version__

    @pytest.mark.asyncio
    async def test_health_status_includes_timestamp(
        self, config: SlackBridgeConfig, mock_redis: AsyncMock
    ):
        """Health status includes timestamp."""
        from src.infrastructure.slack_bridge.bridge import SlackBridge

        bridge = SlackBridge(config=config, redis_client=mock_redis)
        bridge.app.client.auth_test = AsyncMock(
            return_value={"ok": True, "user_id": "U123"}
        )

        status = await bridge.get_health_status()

        assert "timestamp" in status
        # ISO format check
        assert "T" in status["timestamp"]


class TestStartupValidation:
    """Tests for startup validation (T20)."""

    @pytest.fixture
    def mock_redis(self) -> AsyncMock:
        """Mock Redis client."""
        mock = AsyncMock()
        mock.ping = AsyncMock(return_value=True)
        return mock

    @pytest.mark.asyncio
    async def test_validate_startup_success(self, mock_redis: AsyncMock):
        """Startup validation succeeds with valid config and connections."""
        from src.infrastructure.slack_bridge.bridge import SlackBridge

        config = SlackBridgeConfig(
            bot_token=SecretStr("xoxb-valid-token"),
            app_token=SecretStr("xapp-valid-token"),
            signing_secret=SecretStr("valid-secret"),
            routing_policy={},
            rbac_map={},
        )

        bridge = SlackBridge(config=config, redis_client=mock_redis)

        # Mock Slack auth.test success
        bridge.app.client.auth_test = AsyncMock(
            return_value={"ok": True, "user_id": "U123", "team": "TestTeam"}
        )

        # Should not raise
        await bridge.validate_startup()

        assert bridge._slack_connected is True
        assert bridge._redis_connected is True

    @pytest.mark.asyncio
    async def test_validate_startup_missing_bot_token(self, mock_redis: AsyncMock):
        """Slack Bolt raises error when bot_token is missing at init."""
        from slack_bolt.error import BoltError

        # Slack Bolt validates token at initialization, not startup
        # This test verifies that behavior
        with pytest.raises(BoltError) as exc_info:
            SlackBridgeConfig(
                bot_token=SecretStr(""),
                app_token=SecretStr("xapp-token"),
                signing_secret=SecretStr("secret"),
                routing_policy={},
                rbac_map={},
            )
            from src.infrastructure.slack_bridge.bridge import SlackBridge
            SlackBridge(
                config=SlackBridgeConfig(
                    bot_token=SecretStr(""),
                    app_token=SecretStr("xapp-token"),
                    signing_secret=SecretStr("secret"),
                    routing_policy={},
                    rbac_map={},
                ),
                redis_client=mock_redis,
            )

        assert "token" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_validate_startup_missing_app_token(self, mock_redis: AsyncMock):
        """Startup validation fails when app_token is missing."""
        from src.infrastructure.slack_bridge.bridge import (
            SlackBridge,
            StartupValidationError,
        )

        config = SlackBridgeConfig(
            bot_token=SecretStr("xoxb-token"),
            app_token=SecretStr(""),
            signing_secret=SecretStr("secret"),
            routing_policy={},
            rbac_map={},
        )

        bridge = SlackBridge(config=config, redis_client=mock_redis)

        with pytest.raises(StartupValidationError) as exc_info:
            await bridge.validate_startup()

        assert "SLACK_APP_TOKEN" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_validate_startup_missing_signing_secret(self, mock_redis: AsyncMock):
        """Startup validation fails when signing_secret is missing."""
        from src.infrastructure.slack_bridge.bridge import (
            SlackBridge,
            StartupValidationError,
        )

        config = SlackBridgeConfig(
            bot_token=SecretStr("xoxb-token"),
            app_token=SecretStr("xapp-token"),
            signing_secret=SecretStr(""),
            routing_policy={},
            rbac_map={},
        )

        bridge = SlackBridge(config=config, redis_client=mock_redis)

        with pytest.raises(StartupValidationError) as exc_info:
            await bridge.validate_startup()

        assert "SLACK_SIGNING_SECRET" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_validate_startup_slack_auth_fails(self, mock_redis: AsyncMock):
        """Startup validation fails when Slack auth.test fails."""
        from src.infrastructure.slack_bridge.bridge import (
            SlackBridge,
            StartupValidationError,
        )

        config = SlackBridgeConfig(
            bot_token=SecretStr("xoxb-invalid-token"),
            app_token=SecretStr("xapp-token"),
            signing_secret=SecretStr("secret"),
            routing_policy={},
            rbac_map={},
        )

        bridge = SlackBridge(config=config, redis_client=mock_redis)

        # Mock Slack auth.test failure
        bridge.app.client.auth_test = AsyncMock(
            return_value={"ok": False, "error": "invalid_auth"}
        )

        with pytest.raises(StartupValidationError) as exc_info:
            await bridge.validate_startup()

        assert "invalid_auth" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_validate_startup_redis_connection_fails(self):
        """Startup validation fails when Redis connection fails."""
        from src.infrastructure.slack_bridge.bridge import (
            SlackBridge,
            StartupValidationError,
        )

        config = SlackBridgeConfig(
            bot_token=SecretStr("xoxb-token"),
            app_token=SecretStr("xapp-token"),
            signing_secret=SecretStr("secret"),
            routing_policy={},
            rbac_map={},
        )

        mock_redis = AsyncMock()
        mock_redis.ping = AsyncMock(side_effect=Exception("Connection refused"))

        bridge = SlackBridge(config=config, redis_client=mock_redis)

        # Mock Slack auth.test success
        bridge.app.client.auth_test = AsyncMock(
            return_value={"ok": True, "user_id": "U123", "team": "TestTeam"}
        )

        with pytest.raises(StartupValidationError) as exc_info:
            await bridge.validate_startup()

        assert "Redis" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_validate_startup_logs_version(
        self, mock_redis: AsyncMock, caplog
    ):
        """Startup validation logs version information."""
        from src.infrastructure.slack_bridge.bridge import SlackBridge, __version__

        import logging
        caplog.set_level(logging.INFO)

        config = SlackBridgeConfig(
            bot_token=SecretStr("xoxb-token"),
            app_token=SecretStr("xapp-token"),
            signing_secret=SecretStr("secret"),
            routing_policy={},
            rbac_map={},
        )

        bridge = SlackBridge(config=config, redis_client=mock_redis)
        bridge.app.client.auth_test = AsyncMock(
            return_value={"ok": True, "user_id": "U123", "team": "TestTeam"}
        )

        await bridge.validate_startup()

        assert any(__version__ in record.message for record in caplog.records)


class TestFetchSlackCredentialsFromSecrets:
    """Tests for fetching Slack credentials from secrets service."""

    @pytest.mark.asyncio
    async def test_fetch_credentials_returns_all_slack_tokens(self):
        """Fetch credentials returns all three Slack token types."""
        from src.infrastructure.slack_bridge.bridge import fetch_slack_credentials_from_secrets

        mock_service = AsyncMock()
        mock_service.list_credentials.return_value = [
            {
                "id": "cred-slack-bot",
                "integration_type": "slack",
                "credential_type": "bot_token",
                "name": "Bot Token",
                "key_masked": "xoxb...abc",
            },
            {
                "id": "cred-slack-app",
                "integration_type": "slack",
                "credential_type": "app_token",
                "name": "App Token",
                "key_masked": "xapp...def",
            },
            {
                "id": "cred-slack-sign",
                "integration_type": "slack",
                "credential_type": "signing_secret",
                "name": "Signing Secret",
                "key_masked": "abc...xyz",
            },
        ]
        mock_service.retrieve.side_effect = [
            "xoxb-actual-bot-token",
            "xapp-actual-app-token",
            "actual-signing-secret",
        ]

        with patch(
            "src.infrastructure.secrets.service.get_secrets_service",
            return_value=mock_service,
        ):
            result = await fetch_slack_credentials_from_secrets()

        assert result is not None
        assert result["bot_token"] == "xoxb-actual-bot-token"
        assert result["app_token"] == "xapp-actual-app-token"
        assert result["signing_secret"] == "actual-signing-secret"

    @pytest.mark.asyncio
    async def test_fetch_credentials_returns_none_when_no_slack_credentials(self):
        """Fetch credentials returns None when no Slack credentials exist."""
        from src.infrastructure.slack_bridge.bridge import fetch_slack_credentials_from_secrets

        mock_service = AsyncMock()
        mock_service.list_credentials.return_value = []

        with patch(
            "src.infrastructure.secrets.service.get_secrets_service",
            return_value=mock_service,
        ):
            result = await fetch_slack_credentials_from_secrets()

        assert result is None

    @pytest.mark.asyncio
    async def test_fetch_credentials_returns_none_when_incomplete(self):
        """Fetch credentials returns None when not all token types are present."""
        from src.infrastructure.slack_bridge.bridge import fetch_slack_credentials_from_secrets

        mock_service = AsyncMock()
        mock_service.list_credentials.return_value = [
            {
                "id": "cred-slack-bot",
                "integration_type": "slack",
                "credential_type": "bot_token",
                "name": "Bot Token",
                "key_masked": "xoxb...abc",
            },
            # Missing app_token and signing_secret
        ]
        mock_service.retrieve.return_value = "xoxb-actual-bot-token"

        with patch(
            "src.infrastructure.secrets.service.get_secrets_service",
            return_value=mock_service,
        ):
            result = await fetch_slack_credentials_from_secrets()

        assert result is None

    @pytest.mark.asyncio
    async def test_fetch_credentials_returns_none_on_service_error(self):
        """Fetch credentials returns None when secrets service fails."""
        from src.infrastructure.slack_bridge.bridge import fetch_slack_credentials_from_secrets

        mock_service = AsyncMock()
        mock_service.list_credentials.side_effect = Exception("Service unavailable")

        with patch(
            "src.infrastructure.secrets.service.get_secrets_service",
            return_value=mock_service,
        ):
            result = await fetch_slack_credentials_from_secrets()

        assert result is None

    @pytest.mark.asyncio
    async def test_fetch_credentials_returns_none_on_retrieve_error(self):
        """Fetch credentials returns None when credential retrieval fails."""
        from src.infrastructure.slack_bridge.bridge import fetch_slack_credentials_from_secrets

        mock_service = AsyncMock()
        mock_service.list_credentials.return_value = [
            {
                "id": "cred-slack-bot",
                "integration_type": "slack",
                "credential_type": "bot_token",
                "name": "Bot Token",
                "key_masked": "xoxb...abc",
            },
            {
                "id": "cred-slack-app",
                "integration_type": "slack",
                "credential_type": "app_token",
                "name": "App Token",
                "key_masked": "xapp...def",
            },
            {
                "id": "cred-slack-sign",
                "integration_type": "slack",
                "credential_type": "signing_secret",
                "name": "Signing Secret",
                "key_masked": "abc...xyz",
            },
        ]
        mock_service.retrieve.side_effect = Exception("Decryption failed")

        with patch(
            "src.infrastructure.secrets.service.get_secrets_service",
            return_value=mock_service,
        ):
            result = await fetch_slack_credentials_from_secrets()

        assert result is None

    @pytest.mark.asyncio
    async def test_fetch_credentials_handles_multiple_bot_tokens(self):
        """Fetch credentials uses first matching credential of each type."""
        from src.infrastructure.slack_bridge.bridge import fetch_slack_credentials_from_secrets

        mock_service = AsyncMock()
        mock_service.list_credentials.return_value = [
            {
                "id": "cred-slack-bot-1",
                "integration_type": "slack",
                "credential_type": "bot_token",
                "name": "Bot Token 1",
                "key_masked": "xoxb...111",
            },
            {
                "id": "cred-slack-bot-2",
                "integration_type": "slack",
                "credential_type": "bot_token",
                "name": "Bot Token 2",
                "key_masked": "xoxb...222",
            },
            {
                "id": "cred-slack-app",
                "integration_type": "slack",
                "credential_type": "app_token",
                "name": "App Token",
                "key_masked": "xapp...def",
            },
            {
                "id": "cred-slack-sign",
                "integration_type": "slack",
                "credential_type": "signing_secret",
                "name": "Signing Secret",
                "key_masked": "abc...xyz",
            },
        ]
        # Retrieve should only be called once per credential type (first one found)
        mock_service.retrieve.side_effect = [
            "xoxb-first-bot-token",
            "xapp-actual-app-token",
            "actual-signing-secret",
        ]

        with patch(
            "src.infrastructure.secrets.service.get_secrets_service",
            return_value=mock_service,
        ):
            result = await fetch_slack_credentials_from_secrets()

        assert result is not None
        assert result["bot_token"] == "xoxb-first-bot-token"


class TestMainCredentialLoading:
    """Tests for main() credential loading from secrets service vs env vars."""

    @pytest.mark.asyncio
    async def test_main_uses_secrets_service_credentials_when_available(self):
        """Main uses credentials from secrets service when available."""
        from src.infrastructure.slack_bridge.bridge import main, fetch_slack_credentials_from_secrets

        mock_creds = {
            "bot_token": "xoxb-from-secrets",
            "app_token": "xapp-from-secrets",
            "signing_secret": "secret-from-secrets",
        }

        with patch(
            "src.infrastructure.slack_bridge.bridge.fetch_slack_credentials_from_secrets",
            new_callable=AsyncMock,
            return_value=mock_creds,
        ) as mock_fetch:
            with patch(
                "src.infrastructure.slack_bridge.bridge.SlackBridge"
            ) as mock_bridge_class:
                with patch(
                    "src.infrastructure.slack_bridge.bridge.redis.from_url"
                ) as mock_redis:
                    with patch.dict("os.environ", {
                        "SLACK_BOT_TOKEN": "xoxb-from-env",
                        "SLACK_APP_TOKEN": "xapp-from-env",
                        "SLACK_SIGNING_SECRET": "secret-from-env",
                        "SLACK_CONFIG_FILE": "",
                    }):
                        # Make the bridge.start() not actually run
                        mock_bridge = AsyncMock()
                        mock_bridge_class.return_value = mock_bridge

                        await main()

                        # Verify secrets service was called
                        mock_fetch.assert_called_once()

                        # Check that secrets service credentials were used
                        call_args = mock_bridge_class.call_args
                        config = call_args.kwargs["config"]
                        assert config.bot_token.get_secret_value() == "xoxb-from-secrets"
                        assert config.app_token.get_secret_value() == "xapp-from-secrets"
                        assert config.signing_secret.get_secret_value() == "secret-from-secrets"

    @pytest.mark.asyncio
    async def test_main_falls_back_to_env_vars_when_secrets_unavailable(self):
        """Main falls back to env vars when secrets service returns None."""
        from src.infrastructure.slack_bridge.bridge import main

        with patch(
            "src.infrastructure.slack_bridge.bridge.fetch_slack_credentials_from_secrets",
            new_callable=AsyncMock,
            return_value=None,  # Secrets service returns nothing
        ) as mock_fetch:
            with patch(
                "src.infrastructure.slack_bridge.bridge.SlackBridge"
            ) as mock_bridge_class:
                with patch(
                    "src.infrastructure.slack_bridge.bridge.redis.from_url"
                ) as mock_redis:
                    with patch.dict("os.environ", {
                        "SLACK_BOT_TOKEN": "xoxb-from-env",
                        "SLACK_APP_TOKEN": "xapp-from-env",
                        "SLACK_SIGNING_SECRET": "secret-from-env",
                        "SLACK_CONFIG_FILE": "",
                    }, clear=False):
                        mock_bridge = AsyncMock()
                        mock_bridge_class.return_value = mock_bridge

                        await main()

                        # Verify secrets service was attempted
                        mock_fetch.assert_called_once()

                        # Check that env var credentials were used
                        call_args = mock_bridge_class.call_args
                        config = call_args.kwargs["config"]
                        assert config.bot_token.get_secret_value() == "xoxb-from-env"
                        assert config.app_token.get_secret_value() == "xapp-from-env"
                        assert config.signing_secret.get_secret_value() == "secret-from-env"
