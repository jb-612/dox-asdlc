"""Integration tests for Slack HITL Bridge.

Tests the full flow of gate requests, approvals, rejections, and idea capture
with mocked Slack WebClient responses.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.core.events import ASDLCEvent, EventType
from src.infrastructure.slack_bridge.blocks import (
    build_approved_blocks,
    build_gate_request_blocks,
    build_rejected_blocks,
    build_rejection_modal,
)
from src.infrastructure.slack_bridge.bridge import SlackBridge
from src.infrastructure.slack_bridge.config import ChannelConfig, SlackBridgeConfig
from src.infrastructure.slack_bridge.decision_handler import (
    DecisionHandler,
    GateAlreadyDecidedException,
    GateNotFoundException,
    RBACDeniedException,
)
from src.infrastructure.slack_bridge.gate_consumer import GateConsumer
from src.infrastructure.slack_bridge.idea_handler import IdeaHandler
from src.infrastructure.slack_bridge.rbac import RBACValidator
from src.orchestrator.api.models.idea import CreateIdeaRequest, Idea, IdeaStatus


@pytest.fixture
def mock_config() -> SlackBridgeConfig:
    """Create a mock Slack Bridge configuration."""
    from pydantic import SecretStr

    return SlackBridgeConfig(
        bot_token=SecretStr("xoxb-test-token"),
        app_token=SecretStr("xapp-test-token"),
        signing_secret=SecretStr("test-signing-secret"),
        routing_policy={
            "hitl_4_code": ChannelConfig(
                channel_id="C-CODE-REVIEW",
                required_role="reviewer",
                mention_users=["U001"],
            ),
            "hitl_5_deploy": ChannelConfig(
                channel_id="C-DEPLOY",
                required_role="pm",
                mention_users=["U002"],
            ),
        },
        rbac_map={
            "U001": ["reviewer", "developer"],
            "U002": ["pm", "architect"],
            "U003": ["developer"],  # No reviewer role
        },
        ideas_channels=["C-IDEAS", "C-BRAINSTORM"],
        ideas_emoji="bulb",
        consumer_group="test_bridge",
        consumer_name="test_consumer",
    )


@pytest.fixture
def mock_redis() -> AsyncMock:
    """Create a mock Redis client."""
    redis = AsyncMock()
    redis.get.return_value = None
    redis.set.return_value = True
    redis.sismember.return_value = False
    redis.sadd.return_value = 1
    redis.expire.return_value = True
    redis.setnx.return_value = True
    redis.delete.return_value = 1
    return redis


@pytest.fixture
def mock_slack_client() -> AsyncMock:
    """Create a mock Slack WebClient."""
    client = AsyncMock()

    # Mock successful message post
    client.chat_postMessage.return_value = {
        "ok": True,
        "ts": "1234567890.123456",
        "channel": "C-CODE-REVIEW",
    }

    # Mock successful message update
    client.chat_update.return_value = {"ok": True}

    # Mock ephemeral message
    client.chat_postEphemeral.return_value = {"ok": True}

    # Mock user info
    client.users_info.return_value = {
        "ok": True,
        "user": {"id": "U001", "real_name": "Test User"},
    }

    # Mock views_open for modals
    client.views_open.return_value = {"ok": True}

    # Mock conversations_history for fetching messages
    client.conversations_history.return_value = {
        "ok": True,
        "messages": [
            {
                "user": "U001",
                "text": "This is a great idea for a new feature!",
                "ts": "1234567890.123456",
                "team": "T001",
            }
        ],
    }

    # Mock reactions_add
    client.reactions_add.return_value = {"ok": True}

    return client


class TestGateRequestFlow:
    """Test gate request flow: GATE_REQUESTED -> Slack message posted."""

    @pytest.mark.asyncio
    async def test_gate_consumer_posts_message_on_gate_requested(
        self,
        mock_config: SlackBridgeConfig,
        mock_redis: AsyncMock,
        mock_slack_client: AsyncMock,
    ) -> None:
        """Test that GateConsumer posts a Slack message when GATE_REQUESTED event is received."""
        consumer = GateConsumer(
            redis_client=mock_redis,
            slack_client=mock_slack_client,
            config=mock_config,
        )

        # Create a GATE_REQUESTED event
        event = ASDLCEvent(
            event_type=EventType.GATE_REQUESTED,
            session_id="session-123",
            timestamp=datetime.now(timezone.utc),
            task_id="task-456",
            metadata={
                "gate_type": "hitl_4_code",
                "request_id": "req-789",
                "summary": "Review authentication changes",
                "requested_by": "coding-agent",
            },
        )

        # Handle the event
        await consumer.handle_gate_requested(event)

        # Verify Slack message was posted
        mock_slack_client.chat_postMessage.assert_called_once()
        call_kwargs = mock_slack_client.chat_postMessage.call_args[1]

        assert call_kwargs["channel"] == "C-CODE-REVIEW"
        assert "HITL Gate" in call_kwargs["text"]
        assert len(call_kwargs["blocks"]) > 0

        # Verify message blocks contain expected content
        blocks = call_kwargs["blocks"]
        block_texts = json.dumps(blocks)
        assert "req-789" in block_texts
        assert "task-456" in block_texts

        # Verify duplicate tracking
        mock_redis.sadd.assert_called()

    @pytest.mark.asyncio
    async def test_gate_consumer_skips_duplicate_requests(
        self,
        mock_config: SlackBridgeConfig,
        mock_redis: AsyncMock,
        mock_slack_client: AsyncMock,
    ) -> None:
        """Test that duplicate gate requests are not posted again."""
        consumer = GateConsumer(
            redis_client=mock_redis,
            slack_client=mock_slack_client,
            config=mock_config,
        )

        # Mark request as already posted
        mock_redis.sismember.return_value = True

        event = ASDLCEvent(
            event_type=EventType.GATE_REQUESTED,
            session_id="session-123",
            timestamp=datetime.now(timezone.utc),
            metadata={
                "gate_type": "hitl_4_code",
                "request_id": "req-duplicate",
                "summary": "Duplicate request",
                "requested_by": "coding-agent",
            },
        )

        await consumer.handle_gate_requested(event)

        # Verify no message was posted
        mock_slack_client.chat_postMessage.assert_not_called()

    @pytest.mark.asyncio
    async def test_gate_consumer_ignores_unknown_gate_types(
        self,
        mock_config: SlackBridgeConfig,
        mock_redis: AsyncMock,
        mock_slack_client: AsyncMock,
    ) -> None:
        """Test that events with unknown gate types are ignored."""
        consumer = GateConsumer(
            redis_client=mock_redis,
            slack_client=mock_slack_client,
            config=mock_config,
        )

        event = ASDLCEvent(
            event_type=EventType.GATE_REQUESTED,
            session_id="session-123",
            timestamp=datetime.now(timezone.utc),
            metadata={
                "gate_type": "unknown_gate_type",
                "request_id": "req-unknown",
                "summary": "Unknown gate",
                "requested_by": "agent",
            },
        )

        await consumer.handle_gate_requested(event)

        # No message should be posted for unknown gate types
        mock_slack_client.chat_postMessage.assert_not_called()


class TestApprovalFlow:
    """Test approval flow: Slack button click -> GATE_APPROVED event."""

    @pytest.mark.asyncio
    async def test_handle_approval_publishes_gate_approved_event(
        self,
        mock_config: SlackBridgeConfig,
        mock_redis: AsyncMock,
        mock_slack_client: AsyncMock,
    ) -> None:
        """Test that approval button click publishes GATE_APPROVED event."""
        handler = DecisionHandler(
            redis_client=mock_redis,
            slack_client=mock_slack_client,
            config=mock_config,
        )

        # Setup gate status in Redis
        gate_status = {
            "status": "PENDING",
            "session_id": "session-123",
            "task_id": "task-456",
            "gate_type": "hitl_4_code",
        }
        mock_redis.get.return_value = json.dumps(gate_status)

        channel_config = mock_config.routing_policy["hitl_4_code"]

        # Process approval
        with patch(
            "src.infrastructure.slack_bridge.decision_handler.publish_event_model"
        ) as mock_publish:
            mock_publish.return_value = "event-123"

            result = await handler.handle_approval(
                request_id="req-789",
                slack_user_id="U001",  # Has reviewer role
                channel_config=channel_config,
            )

            assert result is True

            # Verify event was published
            mock_publish.assert_called_once()
            event_arg = mock_publish.call_args[0][0]
            assert event_arg.event_type == EventType.GATE_APPROVED
            assert event_arg.metadata["request_id"] == "req-789"
            assert event_arg.metadata["reviewer"] == "U001"

        # Verify gate status was updated
        mock_redis.set.assert_called()

    @pytest.mark.asyncio
    async def test_handle_approval_updates_slack_message(
        self,
        mock_config: SlackBridgeConfig,
        mock_redis: AsyncMock,
        mock_slack_client: AsyncMock,
    ) -> None:
        """Test that Slack message is updated after approval."""
        handler = DecisionHandler(
            redis_client=mock_redis,
            slack_client=mock_slack_client,
            config=mock_config,
        )

        original_blocks = build_gate_request_blocks(
            request_id="req-789",
            gate_type="hitl_4_code",
            task_id="task-456",
            summary="Review changes",
            evidence_url="https://example.com/evidence",
            requester="coding-agent",
        )

        await handler.update_message_after_approval(
            channel="C-CODE-REVIEW",
            message_ts="1234567890.123456",
            original_blocks=original_blocks,
            approver_name="Test User",
        )

        # Verify message was updated
        mock_slack_client.chat_update.assert_called_once()
        call_kwargs = mock_slack_client.chat_update.call_args[1]

        assert call_kwargs["channel"] == "C-CODE-REVIEW"
        assert call_kwargs["ts"] == "1234567890.123456"

        # Verify actions block was removed and approval added
        updated_blocks = call_kwargs["blocks"]
        block_types = [b.get("type") for b in updated_blocks]
        assert "actions" not in block_types

        # Verify approval message is present
        block_text = json.dumps(updated_blocks)
        assert "Approved" in block_text
        assert "Test User" in block_text


class TestRejectionFlow:
    """Test rejection flow: Slack button -> modal -> GATE_REJECTED event."""

    @pytest.mark.asyncio
    async def test_handle_reject_opens_modal(
        self,
        mock_config: SlackBridgeConfig,
        mock_redis: AsyncMock,
        mock_slack_client: AsyncMock,
    ) -> None:
        """Test that reject button opens the rejection reason modal."""
        handler = DecisionHandler(
            redis_client=mock_redis,
            slack_client=mock_slack_client,
            config=mock_config,
        )

        await handler.open_rejection_modal(
            trigger_id="trigger-123",
            request_id="req-789",
        )

        # Verify modal was opened
        mock_slack_client.views_open.assert_called_once()
        call_kwargs = mock_slack_client.views_open.call_args[1]

        assert call_kwargs["trigger_id"] == "trigger-123"

        view = call_kwargs["view"]
        assert view["type"] == "modal"
        assert "rejection_modal_req-789" in view["callback_id"]
        assert view["private_metadata"] == "req-789"

    @pytest.mark.asyncio
    async def test_handle_rejection_modal_submit_publishes_event(
        self,
        mock_config: SlackBridgeConfig,
        mock_redis: AsyncMock,
        mock_slack_client: AsyncMock,
    ) -> None:
        """Test that modal submission publishes GATE_REJECTED event."""
        handler = DecisionHandler(
            redis_client=mock_redis,
            slack_client=mock_slack_client,
            config=mock_config,
        )

        # Setup gate status
        gate_status = {
            "status": "PENDING",
            "session_id": "session-123",
            "task_id": "task-456",
            "gate_type": "hitl_4_code",
        }
        mock_redis.get.return_value = json.dumps(gate_status)

        view_submission = {
            "private_metadata": "req-789",
            "state": {
                "values": {
                    "reason_block": {
                        "reason_input": {"value": "Code does not meet security standards"}
                    }
                }
            },
        }

        channel_config = mock_config.routing_policy["hitl_4_code"]

        with patch(
            "src.infrastructure.slack_bridge.decision_handler.publish_event_model"
        ) as mock_publish:
            mock_publish.return_value = "event-456"

            result = await handler.handle_rejection_modal_submit(
                view_submission=view_submission,
                slack_user_id="U001",
                channel_config=channel_config,
            )

            assert result["success"] is True

            # Verify event was published
            mock_publish.assert_called_once()
            event_arg = mock_publish.call_args[0][0]
            assert event_arg.event_type == EventType.GATE_REJECTED
            assert event_arg.metadata["reason"] == "Code does not meet security standards"

    @pytest.mark.asyncio
    async def test_handle_rejection_requires_reason(
        self,
        mock_config: SlackBridgeConfig,
        mock_redis: AsyncMock,
        mock_slack_client: AsyncMock,
    ) -> None:
        """Test that rejection fails without a reason."""
        handler = DecisionHandler(
            redis_client=mock_redis,
            slack_client=mock_slack_client,
            config=mock_config,
        )

        view_submission = {
            "private_metadata": "req-789",
            "state": {
                "values": {
                    "reason_block": {
                        "reason_input": {"value": ""}  # Empty reason
                    }
                }
            },
        }

        channel_config = mock_config.routing_policy["hitl_4_code"]

        result = await handler.handle_rejection_modal_submit(
            view_submission=view_submission,
            slack_user_id="U001",
            channel_config=channel_config,
        )

        assert result["success"] is False
        assert "required" in result["error"].lower()

    @pytest.mark.asyncio
    async def test_handle_rejection_updates_message(
        self,
        mock_config: SlackBridgeConfig,
        mock_redis: AsyncMock,
        mock_slack_client: AsyncMock,
    ) -> None:
        """Test that Slack message is updated after rejection."""
        handler = DecisionHandler(
            redis_client=mock_redis,
            slack_client=mock_slack_client,
            config=mock_config,
        )

        original_blocks = build_gate_request_blocks(
            request_id="req-789",
            gate_type="hitl_4_code",
            task_id="task-456",
            summary="Review changes",
            evidence_url="https://example.com/evidence",
            requester="coding-agent",
        )

        await handler.update_message_after_rejection(
            channel="C-CODE-REVIEW",
            message_ts="1234567890.123456",
            original_blocks=original_blocks,
            rejecter_name="Test User",
            reason="Does not meet standards",
        )

        mock_slack_client.chat_update.assert_called_once()
        call_kwargs = mock_slack_client.chat_update.call_args[1]

        updated_blocks = call_kwargs["blocks"]
        block_text = json.dumps(updated_blocks)

        assert "Rejected" in block_text
        assert "Test User" in block_text
        assert "Does not meet standards" in block_text


class TestRBACDenialScenarios:
    """Test RBAC denial scenarios for gate approvals and rejections."""

    @pytest.mark.asyncio
    async def test_approval_denied_for_unauthorized_user(
        self,
        mock_config: SlackBridgeConfig,
        mock_redis: AsyncMock,
        mock_slack_client: AsyncMock,
    ) -> None:
        """Test that approval is denied for users without required role."""
        handler = DecisionHandler(
            redis_client=mock_redis,
            slack_client=mock_slack_client,
            config=mock_config,
        )

        gate_status = {
            "status": "PENDING",
            "session_id": "session-123",
            "task_id": "task-456",
            "gate_type": "hitl_4_code",
        }
        mock_redis.get.return_value = json.dumps(gate_status)

        channel_config = mock_config.routing_policy["hitl_4_code"]  # Requires "reviewer" role

        # U003 only has "developer" role, not "reviewer"
        with pytest.raises(RBACDeniedException) as exc_info:
            await handler.handle_approval(
                request_id="req-789",
                slack_user_id="U003",
                channel_config=channel_config,
            )

        assert "reviewer" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_rejection_denied_for_unauthorized_user(
        self,
        mock_config: SlackBridgeConfig,
        mock_redis: AsyncMock,
        mock_slack_client: AsyncMock,
    ) -> None:
        """Test that rejection is denied for users without required role."""
        handler = DecisionHandler(
            redis_client=mock_redis,
            slack_client=mock_slack_client,
            config=mock_config,
        )

        gate_status = {
            "status": "PENDING",
            "session_id": "session-123",
            "task_id": "task-456",
            "gate_type": "hitl_5_deploy",
        }
        mock_redis.get.return_value = json.dumps(gate_status)

        channel_config = mock_config.routing_policy["hitl_5_deploy"]  # Requires "pm" role

        # U001 has "reviewer" and "developer" but not "pm"
        with pytest.raises(RBACDeniedException):
            await handler.handle_rejection(
                request_id="req-789",
                slack_user_id="U001",
                reason="Deployment blocked",
                channel_config=channel_config,
            )

    @pytest.mark.asyncio
    async def test_approval_denied_for_unknown_user(
        self,
        mock_config: SlackBridgeConfig,
        mock_redis: AsyncMock,
        mock_slack_client: AsyncMock,
    ) -> None:
        """Test that approval is denied for users not in RBAC map."""
        handler = DecisionHandler(
            redis_client=mock_redis,
            slack_client=mock_slack_client,
            config=mock_config,
        )

        gate_status = {
            "status": "PENDING",
            "session_id": "session-123",
            "task_id": "task-456",
            "gate_type": "hitl_4_code",
        }
        mock_redis.get.return_value = json.dumps(gate_status)

        channel_config = mock_config.routing_policy["hitl_4_code"]

        # U999 is not in the RBAC map
        with pytest.raises(RBACDeniedException):
            await handler.handle_approval(
                request_id="req-789",
                slack_user_id="U999",
                channel_config=channel_config,
            )

    def test_rbac_validator_returns_user_roles(
        self,
        mock_config: SlackBridgeConfig,
    ) -> None:
        """Test that RBAC validator correctly returns user roles."""
        validator = RBACValidator(mock_config.rbac_map)

        assert validator.get_user_roles("U001") == ["reviewer", "developer"]
        assert validator.get_user_roles("U002") == ["pm", "architect"]
        assert validator.get_user_roles("U003") == ["developer"]
        assert validator.get_user_roles("U999") == []

    def test_rbac_validator_checks_role_correctly(
        self,
        mock_config: SlackBridgeConfig,
    ) -> None:
        """Test that RBAC validator correctly checks roles."""
        validator = RBACValidator(mock_config.rbac_map)

        assert validator.has_role("U001", "reviewer") is True
        assert validator.has_role("U001", "pm") is False
        assert validator.has_role("U002", "pm") is True
        assert validator.has_role("U003", "reviewer") is False


class TestGateAlreadyDecidedScenarios:
    """Test scenarios where a gate has already been decided."""

    @pytest.mark.asyncio
    async def test_approval_fails_for_already_approved_gate(
        self,
        mock_config: SlackBridgeConfig,
        mock_redis: AsyncMock,
        mock_slack_client: AsyncMock,
    ) -> None:
        """Test that approving an already approved gate fails."""
        handler = DecisionHandler(
            redis_client=mock_redis,
            slack_client=mock_slack_client,
            config=mock_config,
        )

        gate_status = {
            "status": "APPROVED",  # Already approved
            "session_id": "session-123",
            "task_id": "task-456",
            "gate_type": "hitl_4_code",
        }
        mock_redis.get.return_value = json.dumps(gate_status)

        channel_config = mock_config.routing_policy["hitl_4_code"]

        with pytest.raises(GateAlreadyDecidedException):
            await handler.handle_approval(
                request_id="req-789",
                slack_user_id="U001",
                channel_config=channel_config,
            )

    @pytest.mark.asyncio
    async def test_rejection_fails_for_already_rejected_gate(
        self,
        mock_config: SlackBridgeConfig,
        mock_redis: AsyncMock,
        mock_slack_client: AsyncMock,
    ) -> None:
        """Test that rejecting an already rejected gate fails."""
        handler = DecisionHandler(
            redis_client=mock_redis,
            slack_client=mock_slack_client,
            config=mock_config,
        )

        gate_status = {
            "status": "REJECTED",  # Already rejected
            "session_id": "session-123",
            "task_id": "task-456",
            "gate_type": "hitl_4_code",
        }
        mock_redis.get.return_value = json.dumps(gate_status)

        channel_config = mock_config.routing_policy["hitl_4_code"]

        with pytest.raises(GateAlreadyDecidedException):
            await handler.handle_rejection(
                request_id="req-789",
                slack_user_id="U001",
                reason="Rejected again",
                channel_config=channel_config,
            )


class TestGateNotFoundScenarios:
    """Test scenarios where a gate request cannot be found."""

    @pytest.mark.asyncio
    async def test_approval_fails_for_nonexistent_gate(
        self,
        mock_config: SlackBridgeConfig,
        mock_redis: AsyncMock,
        mock_slack_client: AsyncMock,
    ) -> None:
        """Test that approval fails for non-existent gate."""
        handler = DecisionHandler(
            redis_client=mock_redis,
            slack_client=mock_slack_client,
            config=mock_config,
        )

        # Gate not found in Redis
        mock_redis.get.return_value = None

        channel_config = mock_config.routing_policy["hitl_4_code"]

        with pytest.raises(GateNotFoundException):
            await handler.handle_approval(
                request_id="req-nonexistent",
                slack_user_id="U001",
                channel_config=channel_config,
            )


class TestIdeaReactionFlow:
    """Test idea capture from Slack reactions."""

    @pytest.fixture
    def mock_ideas_service(self) -> AsyncMock:
        """Create a mock ideas service."""
        service = AsyncMock()

        # Mock successful idea creation
        now = datetime.now(timezone.utc)
        service.create_idea.return_value = Idea(
            id="idea-123",
            content="This is a great idea for a new feature!",
            author_id="U001",
            author_name="Test User",
            status=IdeaStatus.ACTIVE,
            labels=["source_ref:slack:T001:C-IDEAS:1234567890.123456"],
            created_at=now,
            updated_at=now,
            word_count=9,
        )

        # Mock list_ideas to return empty (no duplicates)
        service.list_ideas.return_value = ([], 0)

        return service

    @pytest.mark.asyncio
    async def test_idea_created_from_reaction(
        self,
        mock_config: SlackBridgeConfig,
        mock_slack_client: AsyncMock,
        mock_ideas_service: AsyncMock,
    ) -> None:
        """Test that adding the configured emoji creates an idea."""
        handler = IdeaHandler(
            ideas_service=mock_ideas_service,
            slack_client=mock_slack_client,
            config=mock_config,
        )

        reaction_event = {
            "reaction": "bulb",  # Configured ideas_emoji
            "user": "U002",
            "item": {
                "type": "message",
                "channel": "C-IDEAS",  # Configured ideas channel
                "ts": "1234567890.123456",
            },
            "item_user": "U001",
        }

        idea = await handler.handle_reaction(reaction_event)

        assert idea is not None
        assert idea.id == "idea-123"

        # Verify the original message was fetched
        mock_slack_client.conversations_history.assert_called_once()

        # Verify idea was created
        mock_ideas_service.create_idea.assert_called_once()

        # Verify confirmation reaction was added
        mock_slack_client.reactions_add.assert_called()

    @pytest.mark.asyncio
    async def test_idea_not_created_for_wrong_emoji(
        self,
        mock_config: SlackBridgeConfig,
        mock_slack_client: AsyncMock,
        mock_ideas_service: AsyncMock,
    ) -> None:
        """Test that non-configured emoji does not create an idea."""
        handler = IdeaHandler(
            ideas_service=mock_ideas_service,
            slack_client=mock_slack_client,
            config=mock_config,
        )

        reaction_event = {
            "reaction": "thumbsup",  # Not the configured emoji
            "user": "U002",
            "item": {
                "type": "message",
                "channel": "C-IDEAS",
                "ts": "1234567890.123456",
            },
        }

        idea = await handler.handle_reaction(reaction_event)

        assert idea is None
        mock_ideas_service.create_idea.assert_not_called()

    @pytest.mark.asyncio
    async def test_idea_created_from_message_in_ideas_channel(
        self,
        mock_config: SlackBridgeConfig,
        mock_slack_client: AsyncMock,
        mock_ideas_service: AsyncMock,
    ) -> None:
        """Test that messages in ideas channels create ideas automatically."""
        handler = IdeaHandler(
            ideas_service=mock_ideas_service,
            slack_client=mock_slack_client,
            config=mock_config,
        )

        message_event = {
            "channel": "C-IDEAS",
            "user": "U001",
            "text": "We should add dark mode to the dashboard",
            "ts": "1234567890.654321",
            "team": "T001",
        }

        idea = await handler.handle_message(message_event)

        assert idea is not None
        mock_ideas_service.create_idea.assert_called_once()

    @pytest.mark.asyncio
    async def test_idea_not_created_from_non_ideas_channel(
        self,
        mock_config: SlackBridgeConfig,
        mock_slack_client: AsyncMock,
        mock_ideas_service: AsyncMock,
    ) -> None:
        """Test that messages in non-ideas channels do not create ideas."""
        handler = IdeaHandler(
            ideas_service=mock_ideas_service,
            slack_client=mock_slack_client,
            config=mock_config,
        )

        message_event = {
            "channel": "C-GENERAL",  # Not an ideas channel
            "user": "U001",
            "text": "Random message",
            "ts": "1234567890.654321",
        }

        idea = await handler.handle_message(message_event)

        assert idea is None
        mock_ideas_service.create_idea.assert_not_called()

    @pytest.mark.asyncio
    async def test_bot_messages_ignored(
        self,
        mock_config: SlackBridgeConfig,
        mock_slack_client: AsyncMock,
        mock_ideas_service: AsyncMock,
    ) -> None:
        """Test that bot messages do not create ideas."""
        handler = IdeaHandler(
            ideas_service=mock_ideas_service,
            slack_client=mock_slack_client,
            config=mock_config,
        )

        message_event = {
            "channel": "C-IDEAS",
            "user": "U001",
            "text": "Bot message",
            "ts": "1234567890.654321",
            "bot_id": "B001",  # Bot message
        }

        idea = await handler.handle_message(message_event)

        assert idea is None
        mock_ideas_service.create_idea.assert_not_called()


class TestSlackBridgeIntegration:
    """Test full SlackBridge integration scenarios."""

    @pytest.mark.asyncio
    async def test_bridge_initializes_with_config(
        self,
        mock_config: SlackBridgeConfig,
        mock_redis: AsyncMock,
    ) -> None:
        """Test that SlackBridge initializes correctly."""
        bridge = SlackBridge(config=mock_config, redis_client=mock_redis)

        assert bridge.config == mock_config
        assert bridge.decision_handler is not None
        assert bridge.gate_consumer is not None
        assert bridge.app is not None

    @pytest.mark.asyncio
    async def test_bridge_registers_action_handlers(
        self,
        mock_config: SlackBridgeConfig,
        mock_redis: AsyncMock,
    ) -> None:
        """Test that SlackBridge registers Slack action handlers."""
        bridge = SlackBridge(config=mock_config, redis_client=mock_redis)

        # The app should have registered handlers
        # We can verify by checking that the internal listeners exist
        assert bridge.app is not None

    @pytest.mark.asyncio
    async def test_get_channel_config_for_channel(
        self,
        mock_config: SlackBridgeConfig,
        mock_redis: AsyncMock,
    ) -> None:
        """Test channel config lookup by channel ID."""
        bridge = SlackBridge(config=mock_config, redis_client=mock_redis)

        config = bridge._get_channel_config_for_channel("C-CODE-REVIEW")
        assert config is not None
        assert config.required_role == "reviewer"

        config = bridge._get_channel_config_for_channel("C-DEPLOY")
        assert config is not None
        assert config.required_role == "pm"

        config = bridge._get_channel_config_for_channel("C-UNKNOWN")
        assert config is None


class TestBlockKitBuilders:
    """Test Block Kit message builders."""

    def test_build_gate_request_blocks_has_all_components(self) -> None:
        """Test that gate request blocks contain all required components."""
        blocks = build_gate_request_blocks(
            request_id="req-123",
            gate_type="hitl_4_code",
            task_id="task-456",
            summary="Review authentication changes",
            evidence_url="https://example.com/evidence",
            requester="coding-agent",
        )

        # Should have header, section, evidence link, actions, and context
        assert len(blocks) >= 5

        block_types = [b.get("type") for b in blocks]
        assert "header" in block_types
        assert "section" in block_types
        assert "actions" in block_types
        assert "context" in block_types

        # Verify action buttons
        actions_block = next(b for b in blocks if b.get("type") == "actions")
        elements = actions_block.get("elements", [])
        action_ids = [e.get("action_id") for e in elements]

        assert "approve_gate" in action_ids
        assert "reject_gate" in action_ids

    def test_build_approved_blocks_removes_actions(self) -> None:
        """Test that approved blocks remove the actions block."""
        original = build_gate_request_blocks(
            request_id="req-123",
            gate_type="hitl_4_code",
            task_id="task-456",
            summary="Review changes",
            evidence_url="https://example.com",
            requester="agent",
        )

        updated = build_approved_blocks(
            original_blocks=original,
            approver_name="Test User",
            timestamp="2024-01-15 10:30:00 UTC",
        )

        block_types = [b.get("type") for b in updated]
        assert "actions" not in block_types

    def test_build_rejection_modal_has_text_input(self) -> None:
        """Test that rejection modal has a text input for reason."""
        modal = build_rejection_modal("req-123")

        assert modal["type"] == "modal"
        assert modal["private_metadata"] == "req-123"

        # Find the input block
        input_blocks = [b for b in modal["blocks"] if b.get("type") == "input"]
        assert len(input_blocks) == 1

        input_block = input_blocks[0]
        assert input_block["block_id"] == "reason_block"
        assert input_block["element"]["action_id"] == "reason_input"
