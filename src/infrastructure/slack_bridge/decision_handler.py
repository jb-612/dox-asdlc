"""Decision handler for Slack HITL Bridge.

Handles approval and rejection decisions from Slack button clicks,
validates RBAC permissions, publishes events to Redis Streams,
and updates Slack messages after decisions.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Protocol

import redis.asyncio as redis

from src.core.events import ASDLCEvent, EventType
from src.infrastructure.redis_streams import publish_event_model
from src.infrastructure.slack_bridge.blocks import (
    build_approved_blocks,
    build_rejected_blocks,
    build_rejection_modal,
)
from src.infrastructure.slack_bridge.config import ChannelConfig, SlackBridgeConfig
from src.infrastructure.slack_bridge.rbac import RBACValidator

logger = logging.getLogger(__name__)


# Redis key prefix for gate status tracking
GATE_STATUS_KEY_PREFIX = "slack_bridge:gate:"
# Lock key prefix for preventing race conditions
GATE_LOCK_KEY_PREFIX = "slack_bridge:lock:"
# Lock TTL in seconds
LOCK_TTL = 30


class RBACDeniedException(Exception):
    """Raised when a user lacks permission to approve/reject a gate."""

    pass


class GateNotFoundException(Exception):
    """Raised when attempting to decide on a non-existent gate."""

    pass


class GateAlreadyDecidedException(Exception):
    """Raised when attempting to decide on an already-decided gate."""

    pass


class SlackClient(Protocol):
    """Protocol for Slack WebClient operations."""

    async def chat_update(
        self,
        *,
        channel: str,
        ts: str,
        blocks: list[dict],
        text: str,
        **kwargs: Any,
    ) -> dict:
        """Update a message."""
        ...

    async def views_open(
        self,
        *,
        trigger_id: str,
        view: dict,
        **kwargs: Any,
    ) -> dict:
        """Open a modal view."""
        ...

    async def chat_postEphemeral(
        self,
        *,
        channel: str,
        user: str,
        text: str,
        **kwargs: Any,
    ) -> dict:
        """Post an ephemeral message."""
        ...

    async def users_info(
        self,
        *,
        user: str,
        **kwargs: Any,
    ) -> dict:
        """Get user information."""
        ...


class DecisionHandler:
    """Handles gate approval and rejection decisions from Slack.

    Validates RBAC permissions before processing decisions,
    publishes events to Redis Streams, and updates Slack messages
    to reflect the decision status.

    Attributes:
        redis: Redis client for gate status tracking.
        slack: Slack WebClient for message updates.
        config: SlackBridgeConfig with RBAC and routing settings.
        rbac: RBACValidator for permission checks.

    Example:
        ```python
        handler = DecisionHandler(
            redis_client=redis_client,
            slack_client=slack_client,
            config=config,
        )

        # Handle approval from Slack button click
        await handler.handle_approval(
            request_id="req-123",
            slack_user_id="U001",
            channel_config=channel_config,
        )
        ```
    """

    def __init__(
        self,
        redis_client: redis.Redis,
        slack_client: SlackClient,
        config: SlackBridgeConfig,
    ) -> None:
        """Initialize the decision handler.

        Args:
            redis_client: Redis client for gate status tracking.
            slack_client: Slack WebClient for message updates.
            config: SlackBridgeConfig with RBAC and routing settings.
        """
        self.redis = redis_client
        self.slack = slack_client
        self.config = config
        self.rbac = RBACValidator(config.rbac_map)

    async def _get_gate_status(self, request_id: str) -> dict | None:
        """Get the current status of a gate request.

        Args:
            request_id: The gate request ID.

        Returns:
            Gate status dict if found, None otherwise.
        """
        key = f"{GATE_STATUS_KEY_PREFIX}{request_id}"
        data = await self.redis.get(key)
        if data:
            return json.loads(data)
        return None

    async def _acquire_lock(self, request_id: str) -> bool:
        """Acquire a lock for processing a gate decision.

        Uses Redis SETNX for atomic lock acquisition.

        Args:
            request_id: The gate request ID.

        Returns:
            True if lock acquired, False otherwise.
        """
        lock_key = f"{GATE_LOCK_KEY_PREFIX}{request_id}"
        result = await self.redis.setnx(lock_key, "locked")
        if result:
            await self.redis.expire(lock_key, LOCK_TTL)
        return bool(result)

    async def _release_lock(self, request_id: str) -> None:
        """Release the lock for a gate decision.

        Args:
            request_id: The gate request ID.
        """
        lock_key = f"{GATE_LOCK_KEY_PREFIX}{request_id}"
        await self.redis.delete(lock_key)

    async def _check_gate_status_and_lock(
        self, request_id: str
    ) -> dict:
        """Check gate status and acquire lock atomically.

        Args:
            request_id: The gate request ID.

        Returns:
            Gate status dict.

        Raises:
            GateNotFoundException: If gate does not exist.
            GateAlreadyDecidedException: If gate is not PENDING or lock fails.
        """
        # Try to acquire lock first
        if not await self._acquire_lock(request_id):
            raise GateAlreadyDecidedException(
                f"Gate {request_id} is being processed by another request"
            )

        try:
            # Check gate status
            gate_status = await self._get_gate_status(request_id)

            if gate_status is None:
                await self._release_lock(request_id)
                raise GateNotFoundException(f"Gate {request_id} not found")

            status = gate_status.get("status", "UNKNOWN")
            if status != "PENDING":
                await self._release_lock(request_id)
                raise GateAlreadyDecidedException(
                    f"Gate {request_id} is already {status}"
                )

            return gate_status
        except (GateNotFoundException, GateAlreadyDecidedException):
            raise
        except Exception:
            await self._release_lock(request_id)
            raise

    async def handle_approval(
        self,
        request_id: str,
        slack_user_id: str,
        channel_config: ChannelConfig,
    ) -> bool:
        """Handle gate approval from Slack button click.

        Validates RBAC, checks gate status, publishes GATE_APPROVED event.

        Args:
            request_id: The gate request ID from button value.
            slack_user_id: Slack user who clicked approve.
            channel_config: Channel configuration with required role.

        Returns:
            True if approval was processed successfully.

        Raises:
            RBACDeniedException: If user lacks required role.
            GateNotFoundException: If gate does not exist.
            GateAlreadyDecidedException: If gate is not PENDING.
        """
        # Validate RBAC
        gate_type = channel_config.required_role  # Will get from gate status
        if not self.rbac.can_approve_gate(slack_user_id, gate_type, channel_config):
            logger.warning(
                f"RBAC denied approval: user={slack_user_id}, "
                f"request={request_id}, role={channel_config.required_role}"
            )
            raise RBACDeniedException(
                f"User {slack_user_id} lacks role '{channel_config.required_role}'"
            )

        # Check status and acquire lock
        gate_status = await self._check_gate_status_and_lock(request_id)

        try:
            # Generate decision ID
            decision_id = str(uuid.uuid4())

            # Build and publish event
            session_id = gate_status.get("session_id", "unknown")
            event = ASDLCEvent(
                event_type=EventType.GATE_APPROVED,
                session_id=session_id,
                timestamp=datetime.now(timezone.utc),
                task_id=gate_status.get("task_id"),
                metadata={
                    "request_id": request_id,
                    "decision_id": decision_id,
                    "reviewer": slack_user_id,
                    "gate_type": gate_status.get("gate_type"),
                },
            )

            event_id = await publish_event_model(event, client=self.redis)

            # Update gate status
            gate_status["status"] = "APPROVED"
            gate_status["decision_id"] = decision_id
            gate_status["reviewer"] = slack_user_id
            gate_status["decided_at"] = datetime.now(timezone.utc).isoformat()

            key = f"{GATE_STATUS_KEY_PREFIX}{request_id}"
            await self.redis.set(key, json.dumps(gate_status))

            logger.info(
                f"Gate approved: request_id={request_id}, "
                f"user={slack_user_id}, event_id={event_id}"
            )

            return True
        finally:
            await self._release_lock(request_id)

    async def handle_rejection(
        self,
        request_id: str,
        slack_user_id: str,
        reason: str,
        channel_config: ChannelConfig,
    ) -> bool:
        """Handle gate rejection from Slack button click.

        Validates RBAC, checks gate status, publishes GATE_REJECTED event.

        Args:
            request_id: The gate request ID from button value.
            slack_user_id: Slack user who clicked reject.
            reason: Reason for rejection.
            channel_config: Channel configuration with required role.

        Returns:
            True if rejection was processed successfully.

        Raises:
            RBACDeniedException: If user lacks required role.
            GateNotFoundException: If gate does not exist.
            GateAlreadyDecidedException: If gate is not PENDING.
        """
        # Validate RBAC
        gate_type = channel_config.required_role
        if not self.rbac.can_approve_gate(slack_user_id, gate_type, channel_config):
            logger.warning(
                f"RBAC denied rejection: user={slack_user_id}, "
                f"request={request_id}, role={channel_config.required_role}"
            )
            raise RBACDeniedException(
                f"User {slack_user_id} lacks role '{channel_config.required_role}'"
            )

        # Check status and acquire lock
        gate_status = await self._check_gate_status_and_lock(request_id)

        try:
            # Generate decision ID
            decision_id = str(uuid.uuid4())

            # Build and publish event
            session_id = gate_status.get("session_id", "unknown")
            event = ASDLCEvent(
                event_type=EventType.GATE_REJECTED,
                session_id=session_id,
                timestamp=datetime.now(timezone.utc),
                task_id=gate_status.get("task_id"),
                metadata={
                    "request_id": request_id,
                    "decision_id": decision_id,
                    "reviewer": slack_user_id,
                    "gate_type": gate_status.get("gate_type"),
                    "reason": reason,
                },
            )

            event_id = await publish_event_model(event, client=self.redis)

            # Update gate status
            gate_status["status"] = "REJECTED"
            gate_status["decision_id"] = decision_id
            gate_status["reviewer"] = slack_user_id
            gate_status["reason"] = reason
            gate_status["decided_at"] = datetime.now(timezone.utc).isoformat()

            key = f"{GATE_STATUS_KEY_PREFIX}{request_id}"
            await self.redis.set(key, json.dumps(gate_status))

            logger.info(
                f"Gate rejected: request_id={request_id}, "
                f"user={slack_user_id}, reason={reason}, event_id={event_id}"
            )

            return True
        finally:
            await self._release_lock(request_id)

    async def update_message_after_approval(
        self,
        channel: str,
        message_ts: str,
        original_blocks: list[dict],
        approver_name: str,
    ) -> None:
        """Update Slack message after gate approval.

        Removes Approve/Reject buttons and adds approval context.

        Args:
            channel: Slack channel ID.
            message_ts: Slack message timestamp.
            original_blocks: Original Block Kit blocks.
            approver_name: Display name of the approver.
        """
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        updated_blocks = build_approved_blocks(
            original_blocks=original_blocks,
            approver_name=approver_name,
            timestamp=timestamp,
        )

        try:
            await self.slack.chat_update(
                channel=channel,
                ts=message_ts,
                blocks=updated_blocks,
                text="Gate Approved",
            )
            logger.debug(f"Updated message after approval: channel={channel}, ts={message_ts}")
        except Exception as e:
            logger.error(f"Failed to update message after approval: {e}")

    async def update_message_after_rejection(
        self,
        channel: str,
        message_ts: str,
        original_blocks: list[dict],
        rejecter_name: str,
        reason: str,
    ) -> None:
        """Update Slack message after gate rejection.

        Removes Approve/Reject buttons and adds rejection context with reason.

        Args:
            channel: Slack channel ID.
            message_ts: Slack message timestamp.
            original_blocks: Original Block Kit blocks.
            rejecter_name: Display name of the rejecter.
            reason: Reason for rejection.
        """
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        updated_blocks = build_rejected_blocks(
            original_blocks=original_blocks,
            rejecter_name=rejecter_name,
            reason=reason,
            timestamp=timestamp,
        )

        try:
            await self.slack.chat_update(
                channel=channel,
                ts=message_ts,
                blocks=updated_blocks,
                text="Gate Rejected",
            )
            logger.debug(f"Updated message after rejection: channel={channel}, ts={message_ts}")
        except Exception as e:
            logger.error(f"Failed to update message after rejection: {e}")

    async def open_rejection_modal(
        self,
        trigger_id: str,
        request_id: str,
    ) -> None:
        """Open the rejection reason modal.

        Args:
            trigger_id: Slack trigger ID from the action.
            request_id: The gate request ID.
        """
        modal = build_rejection_modal(request_id)

        try:
            await self.slack.views_open(
                trigger_id=trigger_id,
                view=modal,
            )
            logger.debug(f"Opened rejection modal for request: {request_id}")
        except Exception as e:
            logger.error(f"Failed to open rejection modal: {e}")

    async def handle_rejection_modal_submit(
        self,
        view_submission: dict,
        slack_user_id: str,
        channel_config: ChannelConfig,
    ) -> dict:
        """Handle rejection modal submission.

        Extracts the reason from the modal and processes the rejection.

        Args:
            view_submission: The view submission payload from Slack.
            slack_user_id: Slack user who submitted the modal.
            channel_config: Channel configuration with required role.

        Returns:
            Result dict with success status and optional error.
        """
        # Extract request ID from private_metadata
        request_id = view_submission.get("private_metadata", "")

        # Extract reason from form values
        values = view_submission.get("state", {}).get("values", {})
        reason_block = values.get("reason_block", {})
        reason_input = reason_block.get("reason_input", {})
        reason = reason_input.get("value", "").strip()

        # Validate reason is not empty
        if not reason:
            return {
                "success": False,
                "error": "Rejection reason is required",
            }

        try:
            await self.handle_rejection(
                request_id=request_id,
                slack_user_id=slack_user_id,
                reason=reason,
                channel_config=channel_config,
            )
            return {"success": True}
        except RBACDeniedException as e:
            return {"success": False, "error": str(e)}
        except GateAlreadyDecidedException as e:
            return {"success": False, "error": str(e)}
        except GateNotFoundException as e:
            return {"success": False, "error": str(e)}
        except Exception as e:
            logger.error(f"Error handling rejection modal: {e}")
            return {"success": False, "error": "Internal error"}
