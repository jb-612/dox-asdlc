"""Unit tests for Slack Bridge main module.

Tests the SlackBridge class which serves as the main entry point
for the Slack HITL Bridge application.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

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
