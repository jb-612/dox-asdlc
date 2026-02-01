"""Unit tests for Slack Bridge Decision Handler.

Tests the DecisionHandler class for processing Slack button clicks
to approve or reject HITL gates.
"""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic import SecretStr

from src.infrastructure.slack_bridge.config import ChannelConfig, SlackBridgeConfig
from src.infrastructure.slack_bridge.decision_handler import (
    DecisionHandler,
    GateAlreadyDecidedException,
    GateNotFoundException,
    RBACDeniedException,
)


class TestDecisionHandlerInitialization:
    """Tests for DecisionHandler initialization."""

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
                ),
            },
            rbac_map={
                "U001": ["reviewer", "pm"],
                "U002": ["release_manager"],
            },
        )

    @pytest.fixture
    def mock_redis(self) -> AsyncMock:
        """Mock Redis client."""
        mock = AsyncMock()
        mock.get = AsyncMock(return_value=None)
        mock.set = AsyncMock(return_value=True)
        mock.hget = AsyncMock(return_value=None)
        mock.hgetall = AsyncMock(return_value={})
        return mock

    @pytest.fixture
    def mock_slack(self) -> MagicMock:
        """Mock Slack WebClient."""
        mock = MagicMock()
        mock.chat_update = AsyncMock(return_value={"ok": True})
        mock.views_open = AsyncMock(return_value={"ok": True})
        mock.chat_postEphemeral = AsyncMock(return_value={"ok": True})
        mock.users_info = AsyncMock(return_value={"user": {"real_name": "Test User"}})
        return mock

    @pytest.fixture
    def handler(
        self, mock_redis: AsyncMock, mock_slack: MagicMock, config: SlackBridgeConfig
    ) -> DecisionHandler:
        """Create DecisionHandler instance."""
        return DecisionHandler(
            redis_client=mock_redis,
            slack_client=mock_slack,
            config=config,
        )

    def test_handler_initialization(
        self, handler: DecisionHandler, config: SlackBridgeConfig
    ):
        """Handler initializes with correct config and RBAC validator."""
        assert handler.config == config
        assert handler.rbac is not None


class TestHandleApproval:
    """Tests for handle_approval method."""

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
            rbac_map={
                "U001": ["reviewer"],
                "U002": ["pm"],  # No reviewer role
            },
        )

    @pytest.fixture
    def mock_redis(self) -> AsyncMock:
        """Mock Redis client with gate status tracking."""
        mock = AsyncMock()
        # Gate status stored as JSON
        mock.get = AsyncMock(
            return_value='{"status": "PENDING", "gate_type": "hitl_4_code"}'
        )
        mock.set = AsyncMock(return_value=True)
        mock.setnx = AsyncMock(return_value=True)  # Lock acquired
        mock.delete = AsyncMock(return_value=1)
        return mock

    @pytest.fixture
    def mock_slack(self) -> MagicMock:
        """Mock Slack WebClient."""
        mock = MagicMock()
        mock.chat_update = AsyncMock(return_value={"ok": True})
        mock.users_info = AsyncMock(return_value={"user": {"real_name": "Test Reviewer"}})
        mock.chat_postEphemeral = AsyncMock(return_value={"ok": True})
        return mock

    @pytest.fixture
    def handler(
        self, mock_redis: AsyncMock, mock_slack: MagicMock, config: SlackBridgeConfig
    ) -> DecisionHandler:
        """Create DecisionHandler instance."""
        return DecisionHandler(
            redis_client=mock_redis,
            slack_client=mock_slack,
            config=config,
        )

    @pytest.mark.asyncio
    async def test_handle_approval_success(
        self, handler: DecisionHandler, mock_redis: AsyncMock
    ):
        """Successful approval publishes GATE_APPROVED event."""
        channel_config = ChannelConfig(channel_id="C-CODE", required_role="reviewer")

        with patch(
            "src.infrastructure.slack_bridge.decision_handler.publish_event_model"
        ) as mock_publish:
            mock_publish.return_value = "evt-123"

            result = await handler.handle_approval(
                request_id="req-001",
                slack_user_id="U001",
                channel_config=channel_config,
            )

            assert result is True
            mock_publish.assert_called_once()
            event = mock_publish.call_args[0][0]
            assert event.event_type.value == "gate_approved"

    @pytest.mark.asyncio
    async def test_handle_approval_rbac_denied(
        self, handler: DecisionHandler, mock_redis: AsyncMock
    ):
        """RBAC denial raises RBACDeniedException."""
        channel_config = ChannelConfig(channel_id="C-CODE", required_role="reviewer")

        with pytest.raises(RBACDeniedException):
            await handler.handle_approval(
                request_id="req-001",
                slack_user_id="U002",  # Has 'pm' role, not 'reviewer'
                channel_config=channel_config,
            )

    @pytest.mark.asyncio
    async def test_handle_approval_includes_metadata(
        self, handler: DecisionHandler, mock_redis: AsyncMock
    ):
        """Approval event includes correct metadata."""
        channel_config = ChannelConfig(channel_id="C-CODE", required_role="reviewer")

        with patch(
            "src.infrastructure.slack_bridge.decision_handler.publish_event_model"
        ) as mock_publish:
            mock_publish.return_value = "evt-123"

            await handler.handle_approval(
                request_id="req-001",
                slack_user_id="U001",
                channel_config=channel_config,
            )

            event = mock_publish.call_args[0][0]
            assert event.metadata.get("request_id") == "req-001"
            assert event.metadata.get("reviewer") == "U001"
            assert "decision_id" in event.metadata


class TestHandleRejection:
    """Tests for handle_rejection method."""

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
            rbac_map={
                "U001": ["reviewer"],
                "U002": ["pm"],
            },
        )

    @pytest.fixture
    def mock_redis(self) -> AsyncMock:
        """Mock Redis client."""
        mock = AsyncMock()
        mock.get = AsyncMock(
            return_value='{"status": "PENDING", "gate_type": "hitl_4_code"}'
        )
        mock.set = AsyncMock(return_value=True)
        mock.setnx = AsyncMock(return_value=True)
        mock.delete = AsyncMock(return_value=1)
        return mock

    @pytest.fixture
    def mock_slack(self) -> MagicMock:
        """Mock Slack WebClient."""
        mock = MagicMock()
        mock.chat_update = AsyncMock(return_value={"ok": True})
        mock.users_info = AsyncMock(return_value={"user": {"real_name": "Test User"}})
        mock.chat_postEphemeral = AsyncMock(return_value={"ok": True})
        return mock

    @pytest.fixture
    def handler(
        self, mock_redis: AsyncMock, mock_slack: MagicMock, config: SlackBridgeConfig
    ) -> DecisionHandler:
        """Create DecisionHandler instance."""
        return DecisionHandler(
            redis_client=mock_redis,
            slack_client=mock_slack,
            config=config,
        )

    @pytest.mark.asyncio
    async def test_handle_rejection_success(
        self, handler: DecisionHandler, mock_redis: AsyncMock
    ):
        """Successful rejection publishes GATE_REJECTED event."""
        channel_config = ChannelConfig(channel_id="C-CODE", required_role="reviewer")

        with patch(
            "src.infrastructure.slack_bridge.decision_handler.publish_event_model"
        ) as mock_publish:
            mock_publish.return_value = "evt-123"

            result = await handler.handle_rejection(
                request_id="req-001",
                slack_user_id="U001",
                reason="Code quality issues",
                channel_config=channel_config,
            )

            assert result is True
            mock_publish.assert_called_once()
            event = mock_publish.call_args[0][0]
            assert event.event_type.value == "gate_rejected"

    @pytest.mark.asyncio
    async def test_handle_rejection_includes_reason(
        self, handler: DecisionHandler, mock_redis: AsyncMock
    ):
        """Rejection event includes reason in metadata."""
        channel_config = ChannelConfig(channel_id="C-CODE", required_role="reviewer")

        with patch(
            "src.infrastructure.slack_bridge.decision_handler.publish_event_model"
        ) as mock_publish:
            mock_publish.return_value = "evt-123"

            await handler.handle_rejection(
                request_id="req-001",
                slack_user_id="U001",
                reason="Security vulnerability found",
                channel_config=channel_config,
            )

            event = mock_publish.call_args[0][0]
            assert event.metadata.get("reason") == "Security vulnerability found"

    @pytest.mark.asyncio
    async def test_handle_rejection_rbac_denied(
        self, handler: DecisionHandler, mock_redis: AsyncMock
    ):
        """RBAC denial raises RBACDeniedException."""
        channel_config = ChannelConfig(channel_id="C-CODE", required_role="reviewer")

        with pytest.raises(RBACDeniedException):
            await handler.handle_rejection(
                request_id="req-001",
                slack_user_id="U002",  # Has 'pm' role, not 'reviewer'
                reason="Some reason",
                channel_config=channel_config,
            )


class TestMessageUpdate:
    """Tests for message update methods."""

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

    @pytest.fixture
    def mock_slack(self) -> MagicMock:
        """Mock Slack WebClient."""
        mock = MagicMock()
        mock.chat_update = AsyncMock(return_value={"ok": True})
        mock.users_info = AsyncMock(return_value={"user": {"real_name": "Test User"}})
        return mock

    @pytest.fixture
    def handler(
        self, mock_redis: AsyncMock, mock_slack: MagicMock, config: SlackBridgeConfig
    ) -> DecisionHandler:
        """Create DecisionHandler instance."""
        return DecisionHandler(
            redis_client=mock_redis,
            slack_client=mock_slack,
            config=config,
        )

    @pytest.fixture
    def original_blocks(self) -> list[dict]:
        """Sample original message blocks."""
        return [
            {"type": "header", "text": {"type": "plain_text", "text": "HITL Gate"}},
            {"type": "section", "text": {"type": "mrkdwn", "text": "*Task:* task-123"}},
            {
                "type": "actions",
                "block_id": "gate_actions_req-001",
                "elements": [
                    {"type": "button", "action_id": "approve_gate"},
                    {"type": "button", "action_id": "reject_gate"},
                ],
            },
            {
                "type": "context",
                "elements": [{"type": "mrkdwn", "text": "Request ID: req-001"}],
            },
        ]

    @pytest.mark.asyncio
    async def test_update_message_after_approval(
        self,
        handler: DecisionHandler,
        mock_slack: MagicMock,
        original_blocks: list[dict],
    ):
        """Approval updates message to remove buttons and show approver."""
        await handler.update_message_after_approval(
            channel="C-CODE",
            message_ts="1234567890.123456",
            original_blocks=original_blocks,
            approver_name="Test Reviewer",
        )

        mock_slack.chat_update.assert_called_once()
        call_kwargs = mock_slack.chat_update.call_args.kwargs
        blocks = call_kwargs["blocks"]

        # Verify actions block is removed
        assert not any(b["type"] == "actions" for b in blocks)
        # Verify approval message is added
        block_texts = [
            b.get("text", {}).get("text", "") for b in blocks if b.get("text")
        ]
        assert any("Approved" in t and "Test Reviewer" in t for t in block_texts)

    @pytest.mark.asyncio
    async def test_update_message_after_rejection(
        self,
        handler: DecisionHandler,
        mock_slack: MagicMock,
        original_blocks: list[dict],
    ):
        """Rejection updates message to show rejecter and reason."""
        await handler.update_message_after_rejection(
            channel="C-CODE",
            message_ts="1234567890.123456",
            original_blocks=original_blocks,
            rejecter_name="Test Reviewer",
            reason="Does not meet standards",
        )

        mock_slack.chat_update.assert_called_once()
        call_kwargs = mock_slack.chat_update.call_args.kwargs
        blocks = call_kwargs["blocks"]

        # Verify actions block is removed
        assert not any(b["type"] == "actions" for b in blocks)
        # Verify rejection message includes reason
        block_texts = [
            b.get("text", {}).get("text", "") for b in blocks if b.get("text")
        ]
        assert any("Rejected" in t and "Test Reviewer" in t for t in block_texts)
        assert any("Does not meet standards" in t for t in block_texts)


class TestRejectionModal:
    """Tests for rejection modal flow."""

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
        mock = AsyncMock()
        mock.get = AsyncMock(
            return_value='{"status": "PENDING", "gate_type": "hitl_4_code"}'
        )
        mock.set = AsyncMock(return_value=True)
        mock.setnx = AsyncMock(return_value=True)
        mock.delete = AsyncMock(return_value=1)
        return mock

    @pytest.fixture
    def mock_slack(self) -> MagicMock:
        """Mock Slack WebClient."""
        mock = MagicMock()
        mock.views_open = AsyncMock(return_value={"ok": True})
        mock.chat_update = AsyncMock(return_value={"ok": True})
        mock.users_info = AsyncMock(return_value={"user": {"real_name": "Test User"}})
        mock.chat_postEphemeral = AsyncMock(return_value={"ok": True})
        return mock

    @pytest.fixture
    def handler(
        self, mock_redis: AsyncMock, mock_slack: MagicMock, config: SlackBridgeConfig
    ) -> DecisionHandler:
        """Create DecisionHandler instance."""
        return DecisionHandler(
            redis_client=mock_redis,
            slack_client=mock_slack,
            config=config,
        )

    @pytest.mark.asyncio
    async def test_open_rejection_modal(
        self, handler: DecisionHandler, mock_slack: MagicMock
    ):
        """Opens rejection modal with correct structure."""
        await handler.open_rejection_modal(
            trigger_id="trigger-123",
            request_id="req-001",
        )

        mock_slack.views_open.assert_called_once()
        call_kwargs = mock_slack.views_open.call_args.kwargs
        view = call_kwargs["view"]

        assert view["type"] == "modal"
        assert "rejection_modal_req-001" in view["callback_id"]
        assert view["private_metadata"] == "req-001"

    @pytest.mark.asyncio
    async def test_handle_rejection_modal_submit(
        self, handler: DecisionHandler, mock_redis: AsyncMock
    ):
        """Modal submission extracts reason and processes rejection."""
        view_submission = {
            "callback_id": "rejection_modal_req-001",
            "private_metadata": "req-001",
            "state": {
                "values": {
                    "reason_block": {
                        "reason_input": {"value": "Security concerns found"}
                    }
                }
            },
        }

        channel_config = ChannelConfig(channel_id="C-CODE", required_role="reviewer")

        with patch(
            "src.infrastructure.slack_bridge.decision_handler.publish_event_model"
        ) as mock_publish:
            mock_publish.return_value = "evt-123"

            result = await handler.handle_rejection_modal_submit(
                view_submission=view_submission,
                slack_user_id="U001",
                channel_config=channel_config,
            )

            assert result["success"] is True
            mock_publish.assert_called_once()
            event = mock_publish.call_args[0][0]
            assert event.metadata.get("reason") == "Security concerns found"

    @pytest.mark.asyncio
    async def test_handle_rejection_modal_empty_reason(
        self, handler: DecisionHandler, mock_redis: AsyncMock
    ):
        """Empty reason in modal returns validation error."""
        view_submission = {
            "callback_id": "rejection_modal_req-001",
            "private_metadata": "req-001",
            "state": {"values": {"reason_block": {"reason_input": {"value": ""}}}},
        }

        channel_config = ChannelConfig(channel_id="C-CODE", required_role="reviewer")

        result = await handler.handle_rejection_modal_submit(
            view_submission=view_submission,
            slack_user_id="U001",
            channel_config=channel_config,
        )

        assert result["success"] is False
        assert "reason" in result.get("error", "").lower()


class TestAlreadyDecidedGates:
    """Tests for handling already-decided gates."""

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
    def mock_slack(self) -> MagicMock:
        """Mock Slack WebClient."""
        mock = MagicMock()
        mock.chat_postEphemeral = AsyncMock(return_value={"ok": True})
        mock.users_info = AsyncMock(return_value={"user": {"real_name": "Test User"}})
        return mock

    @pytest.mark.asyncio
    async def test_approval_on_approved_gate(
        self, config: SlackBridgeConfig, mock_slack: MagicMock
    ):
        """Attempt to approve already-approved gate raises exception."""
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(
            return_value='{"status": "APPROVED", "gate_type": "hitl_4_code"}'
        )
        mock_redis.setnx = AsyncMock(return_value=False)  # Lock not acquired

        handler = DecisionHandler(
            redis_client=mock_redis,
            slack_client=mock_slack,
            config=config,
        )

        channel_config = ChannelConfig(channel_id="C-CODE", required_role="reviewer")

        with pytest.raises(GateAlreadyDecidedException):
            await handler.handle_approval(
                request_id="req-001",
                slack_user_id="U001",
                channel_config=channel_config,
            )

    @pytest.mark.asyncio
    async def test_rejection_on_rejected_gate(
        self, config: SlackBridgeConfig, mock_slack: MagicMock
    ):
        """Attempt to reject already-rejected gate raises exception."""
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(
            return_value='{"status": "REJECTED", "gate_type": "hitl_4_code"}'
        )
        mock_redis.setnx = AsyncMock(return_value=False)

        handler = DecisionHandler(
            redis_client=mock_redis,
            slack_client=mock_slack,
            config=config,
        )

        channel_config = ChannelConfig(channel_id="C-CODE", required_role="reviewer")

        with pytest.raises(GateAlreadyDecidedException):
            await handler.handle_rejection(
                request_id="req-001",
                slack_user_id="U001",
                reason="Some reason",
                channel_config=channel_config,
            )

    @pytest.mark.asyncio
    async def test_approval_on_nonexistent_gate(
        self, config: SlackBridgeConfig, mock_slack: MagicMock
    ):
        """Attempt to approve non-existent gate raises exception."""
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=None)  # Gate not found
        mock_redis.setnx = AsyncMock(return_value=True)
        mock_redis.delete = AsyncMock(return_value=1)

        handler = DecisionHandler(
            redis_client=mock_redis,
            slack_client=mock_slack,
            config=config,
        )

        channel_config = ChannelConfig(channel_id="C-CODE", required_role="reviewer")

        with pytest.raises(GateNotFoundException):
            await handler.handle_approval(
                request_id="req-nonexistent",
                slack_user_id="U001",
                channel_config=channel_config,
            )

    @pytest.mark.asyncio
    async def test_race_condition_prevention(
        self, config: SlackBridgeConfig, mock_slack: MagicMock
    ):
        """Concurrent approval attempts are prevented via locking."""
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(
            return_value='{"status": "PENDING", "gate_type": "hitl_4_code"}'
        )
        # Simulate lock already acquired by another process
        mock_redis.setnx = AsyncMock(return_value=False)

        handler = DecisionHandler(
            redis_client=mock_redis,
            slack_client=mock_slack,
            config=config,
        )

        channel_config = ChannelConfig(channel_id="C-CODE", required_role="reviewer")

        with pytest.raises(GateAlreadyDecidedException):
            await handler.handle_approval(
                request_id="req-001",
                slack_user_id="U001",
                channel_config=channel_config,
            )


class TestEventPublishing:
    """Tests for event publishing to Redis Streams."""

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
        mock = AsyncMock()
        mock.get = AsyncMock(
            return_value='{"status": "PENDING", "gate_type": "hitl_4_code", "session_id": "session-123"}'
        )
        mock.set = AsyncMock(return_value=True)
        mock.setnx = AsyncMock(return_value=True)
        mock.delete = AsyncMock(return_value=1)
        return mock

    @pytest.fixture
    def mock_slack(self) -> MagicMock:
        """Mock Slack WebClient."""
        mock = MagicMock()
        mock.users_info = AsyncMock(return_value={"user": {"real_name": "Test User"}})
        return mock

    @pytest.fixture
    def handler(
        self, mock_redis: AsyncMock, mock_slack: MagicMock, config: SlackBridgeConfig
    ) -> DecisionHandler:
        """Create DecisionHandler instance."""
        return DecisionHandler(
            redis_client=mock_redis,
            slack_client=mock_slack,
            config=config,
        )

    @pytest.mark.asyncio
    async def test_approval_publishes_gate_approved_event(
        self, handler: DecisionHandler
    ):
        """Approval publishes GATE_APPROVED event with correct type."""
        channel_config = ChannelConfig(channel_id="C-CODE", required_role="reviewer")

        with patch(
            "src.infrastructure.slack_bridge.decision_handler.publish_event_model"
        ) as mock_publish:
            mock_publish.return_value = "evt-123"

            await handler.handle_approval(
                request_id="req-001",
                slack_user_id="U001",
                channel_config=channel_config,
            )

            event = mock_publish.call_args[0][0]
            assert event.event_type.value == "gate_approved"

    @pytest.mark.asyncio
    async def test_rejection_publishes_gate_rejected_event(
        self, handler: DecisionHandler
    ):
        """Rejection publishes GATE_REJECTED event with correct type."""
        channel_config = ChannelConfig(channel_id="C-CODE", required_role="reviewer")

        with patch(
            "src.infrastructure.slack_bridge.decision_handler.publish_event_model"
        ) as mock_publish:
            mock_publish.return_value = "evt-123"

            await handler.handle_rejection(
                request_id="req-001",
                slack_user_id="U001",
                reason="Failed security review",
                channel_config=channel_config,
            )

            event = mock_publish.call_args[0][0]
            assert event.event_type.value == "gate_rejected"

    @pytest.mark.asyncio
    async def test_event_includes_session_id_from_gate(
        self, handler: DecisionHandler, mock_redis: AsyncMock
    ):
        """Event includes session_id from original gate request."""
        mock_redis.get = AsyncMock(
            return_value='{"status": "PENDING", "gate_type": "hitl_4_code", "session_id": "session-xyz"}'
        )

        channel_config = ChannelConfig(channel_id="C-CODE", required_role="reviewer")

        with patch(
            "src.infrastructure.slack_bridge.decision_handler.publish_event_model"
        ) as mock_publish:
            mock_publish.return_value = "evt-123"

            await handler.handle_approval(
                request_id="req-001",
                slack_user_id="U001",
                channel_config=channel_config,
            )

            event = mock_publish.call_args[0][0]
            assert event.session_id == "session-xyz"

    @pytest.mark.asyncio
    async def test_approval_event_logged_for_audit(
        self, handler: DecisionHandler, caplog: pytest.LogCaptureFixture
    ):
        """Approval event publication is logged for audit trail."""
        import logging

        caplog.set_level(logging.INFO)
        channel_config = ChannelConfig(channel_id="C-CODE", required_role="reviewer")

        with patch(
            "src.infrastructure.slack_bridge.decision_handler.publish_event_model"
        ) as mock_publish:
            mock_publish.return_value = "evt-123"

            await handler.handle_approval(
                request_id="req-001",
                slack_user_id="U001",
                channel_config=channel_config,
            )

            # Verify audit log entry exists
            assert any("req-001" in record.message for record in caplog.records)
            assert any("U001" in record.message for record in caplog.records)
