"""Gate Consumer for Slack HITL Bridge.

Consumes GATE_REQUESTED events from Redis Streams and posts
notifications to configured Slack channels.
"""

from __future__ import annotations

import logging
from typing import Any, Protocol

import redis.asyncio as redis

from src.core.events import ASDLCEvent, EventType
from src.infrastructure.slack_bridge.blocks import build_gate_request_blocks
from src.infrastructure.slack_bridge.config import SlackBridgeConfig
from src.infrastructure.slack_bridge.policy import RoutingPolicy

logger = logging.getLogger(__name__)


# TTL for duplicate detection keys (24 hours)
DUPLICATE_DETECTION_TTL = 86400

# Redis key for tracking posted request IDs
POSTED_REQUESTS_KEY = "slack_bridge:posted_requests"


class SlackClient(Protocol):
    """Protocol for Slack WebClient operations."""

    async def chat_postMessage(
        self,
        *,
        channel: str,
        blocks: list[dict],
        text: str,
        **kwargs: Any,
    ) -> dict:
        """Post a message to a channel."""
        ...


class GateConsumer:
    """Consumes gate events from Redis Streams and posts to Slack.

    Listens for GATE_REQUESTED events on the aSDLC event stream,
    looks up the appropriate Slack channel based on routing policy,
    and posts Block Kit messages with approve/reject buttons.

    Implements duplicate detection to prevent posting the same gate
    request multiple times (e.g., after consumer restart).

    Attributes:
        STREAM_NAME: Redis stream to consume from.
        GROUP_NAME: Consumer group name from config.
        redis: Redis client for stream operations.
        slack: Slack WebClient for posting messages.
        config: SlackBridgeConfig with routing and settings.
        policy: RoutingPolicy for gate-to-channel lookup.

    Example:
        ```python
        consumer = GateConsumer(
            redis_client=redis_client,
            slack_client=slack_client,
            config=config,
        )
        await consumer.run()  # Starts the consumer loop
        ```
    """

    STREAM_NAME = "asdlc:events"

    def __init__(
        self,
        redis_client: redis.Redis,
        slack_client: SlackClient,
        config: SlackBridgeConfig,
    ) -> None:
        """Initialize the gate consumer.

        Args:
            redis_client: Redis client for stream operations.
            slack_client: Slack WebClient for posting messages.
            config: SlackBridgeConfig with routing and settings.
        """
        self.redis = redis_client
        self.slack = slack_client
        self.config = config
        self.policy = RoutingPolicy(config)

    @property
    def GROUP_NAME(self) -> str:
        """Get the consumer group name from config."""
        return self.config.consumer_group

    def build_evidence_url(self, request_id: str) -> str:
        """Build the URL to view evidence in the HITL UI.

        Args:
            request_id: The gate request ID.

        Returns:
            URL string to the evidence view.
        """
        base_url = self.config.hitl_ui_base_url.rstrip("/")
        return f"{base_url}/gates/{request_id}/evidence"

    async def is_already_posted(self, request_id: str) -> bool:
        """Check if a gate request has already been posted to Slack.

        Uses a Redis set to track posted request IDs for duplicate detection.

        Args:
            request_id: The gate request ID to check.

        Returns:
            True if already posted, False otherwise.
        """
        result = await self.redis.sismember(POSTED_REQUESTS_KEY, request_id)
        return bool(result)

    async def mark_as_posted(self, request_id: str, message_ts: str) -> None:
        """Mark a gate request as posted to Slack.

        Stores the request_id in a Redis set with TTL for cleanup.

        Args:
            request_id: The gate request ID.
            message_ts: Slack message timestamp (for reference).
        """
        await self.redis.sadd(POSTED_REQUESTS_KEY, request_id)
        # Refresh TTL on the set (applies to entire set, not individual members)
        await self.redis.expire(POSTED_REQUESTS_KEY, DUPLICATE_DETECTION_TTL)

        logger.debug(f"Marked request {request_id} as posted (ts: {message_ts})")

    async def handle_gate_requested(self, event: ASDLCEvent) -> None:
        """Handle a GATE_REQUESTED event.

        Looks up the routing policy, builds the Block Kit message,
        and posts to the appropriate Slack channel.

        Args:
            event: The GATE_REQUESTED event from Redis Streams.
        """
        gate_type = event.metadata.get("gate_type", "")
        request_id = event.metadata.get("request_id", "")
        summary = event.metadata.get("summary", "")
        requester = event.metadata.get("requested_by", "")
        environment = event.metadata.get("environment")

        if not gate_type or not request_id:
            logger.warning(
                f"Gate event missing required metadata: gate_type={gate_type}, "
                f"request_id={request_id}"
            )
            return

        # Check for duplicate
        if await self.is_already_posted(request_id):
            logger.info(f"Skipping duplicate gate request: {request_id}")
            return

        # Look up routing
        channel_config = self.policy.get_channel_for_gate(gate_type, environment)
        if not channel_config:
            logger.warning(f"No routing for gate type: {gate_type}")
            return

        # Build message blocks
        blocks = build_gate_request_blocks(
            request_id=request_id,
            gate_type=gate_type,
            task_id=event.task_id or "",
            summary=summary,
            evidence_url=self.build_evidence_url(request_id),
            requester=requester,
        )

        # Post to Slack
        try:
            response = await self.slack.chat_postMessage(
                channel=channel_config.channel_id,
                blocks=blocks,
                text=f"HITL Gate: {gate_type}",
            )

            message_ts = response.get("ts", "")
            await self.mark_as_posted(request_id, message_ts)

            logger.info(f"Posted gate request {request_id} to channel {channel_config.channel_id}")
        except Exception as e:
            logger.error(f"Failed to post gate request to Slack: {e}")
            # Re-raise to allow retry handling at consumer level
            raise

    async def run(self) -> None:
        """Run the consumer loop.

        Creates the consumer group if needed and continuously reads
        events from the Redis stream, handling GATE_REQUESTED events.

        This is the main entry point for the consumer.
        """
        from src.infrastructure.redis_streams import (
            acknowledge_event,
            create_consumer_group,
            read_events_from_group,
        )

        # Ensure consumer group exists
        await create_consumer_group(
            self.redis,
            self.STREAM_NAME,
            self.GROUP_NAME,
        )

        logger.info(
            f"Starting gate consumer: group={self.GROUP_NAME}, consumer={self.config.consumer_name}"
        )

        while True:
            try:
                events = await read_events_from_group(
                    self.redis,
                    self.GROUP_NAME,
                    self.config.consumer_name,
                    self.STREAM_NAME,
                    count=10,
                    block_ms=5000,
                )

                for event in events:
                    if event.event_type == EventType.GATE_REQUESTED:
                        try:
                            await self.handle_gate_requested(event)
                            await acknowledge_event(
                                self.redis,
                                self.STREAM_NAME,
                                self.GROUP_NAME,
                                event.event_id,
                            )
                        except Exception as e:
                            logger.error(f"Error handling gate event {event.event_id}: {e}")
                            # Don't acknowledge - will be retried

            except Exception as e:
                logger.error(f"Consumer loop error: {e}")
                # Brief pause before retry
                import asyncio

                await asyncio.sleep(1)
