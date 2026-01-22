"""Event consumer for AGENT_STARTED events.

Wraps Redis Streams consumer functionality specifically for the worker pool,
filtering for AGENT_STARTED events that trigger agent execution.
"""

from __future__ import annotations

import logging
from typing import Any

import redis.asyncio as redis

from src.core.config import get_redis_config
from src.core.events import ASDLCEvent, EventType
from src.core.exceptions import StreamError
from src.workers.config import WorkerConfig

logger = logging.getLogger(__name__)


class EventConsumer:
    """Consumer for AGENT_STARTED events from Redis Streams.

    Reads events from the configured consumer group and filters
    for AGENT_STARTED events that should trigger agent execution.

    Attributes:
        group_name: Name of the consumer group.
        consumer_name: Unique name for this consumer instance.
        batch_size: Number of events to read per batch.
    """

    def __init__(
        self,
        client: redis.Redis,
        config: WorkerConfig,
        tenant_id: str | None = None,
    ) -> None:
        """Initialize the event consumer.

        Args:
            client: Redis async client.
            config: Worker pool configuration.
            tenant_id: Optional tenant ID for multi-tenancy.
        """
        self._client = client
        self._config = config
        self._tenant_id = tenant_id

        self.group_name = config.consumer_group
        self.consumer_name = config.consumer_name
        self.batch_size = config.batch_size

    @property
    def stream_name(self) -> str:
        """Get the stream name, with tenant prefix if applicable."""
        base_name = get_redis_config().stream_name
        if self._tenant_id:
            return f"tenant:{self._tenant_id}:{base_name}"
        return base_name

    async def read_events(
        self,
        block_ms: int | None = None,
    ) -> list[ASDLCEvent]:
        """Read AGENT_STARTED events from the stream.

        Reads a batch of events from the consumer group and filters
        for AGENT_STARTED events only.

        Args:
            block_ms: Optional blocking timeout in milliseconds.

        Returns:
            list[ASDLCEvent]: List of AGENT_STARTED events.

        Raises:
            StreamError: If reading from the stream fails.
        """
        try:
            kwargs: dict[str, Any] = {
                "groupname": self.group_name,
                "consumername": self.consumer_name,
                "count": self.batch_size,
                "streams": {self.stream_name: ">"},
            }
            if block_ms is not None:
                kwargs["block"] = block_ms

            result = await self._client.xreadgroup(**kwargs)

            events = []
            if result:
                for stream_data in result:
                    _, messages = stream_data
                    for message_id, message_data in messages:
                        event = ASDLCEvent.from_stream_dict(message_id, message_data)

                        # Filter for AGENT_STARTED events only
                        if event.event_type == EventType.AGENT_STARTED:
                            events.append(event)
                        else:
                            # Acknowledge non-AGENT_STARTED events immediately
                            # (they're meant for other consumer groups)
                            await self.acknowledge(message_id)
                            logger.debug(
                                f"Skipped non-AGENT_STARTED event: {event.event_type}"
                            )

            return events

        except redis.RedisError as e:
            raise StreamError(
                f"Failed to read events from stream: {e}",
                details={"stream": self.stream_name, "group": self.group_name},
            ) from e

    async def acknowledge(self, event_id: str) -> bool:
        """Acknowledge an event as processed.

        Args:
            event_id: The event ID to acknowledge.

        Returns:
            bool: True if the event was acknowledged.

        Raises:
            StreamError: If acknowledgment fails.
        """
        try:
            result = await self._client.xack(
                self.stream_name, self.group_name, event_id
            )
            return result > 0
        except redis.RedisError as e:
            raise StreamError(
                f"Failed to acknowledge event: {e}",
                details={"event_id": event_id, "stream": self.stream_name},
            ) from e

    async def get_pending_count(self) -> int:
        """Get the count of pending events for this consumer group.

        Returns:
            int: Number of pending (unacknowledged) events.
        """
        try:
            result = await self._client.xpending(self.stream_name, self.group_name)
            if result and isinstance(result, dict):
                return result.get("pending", 0)
            return 0
        except redis.RedisError as e:
            logger.warning(f"Failed to get pending count: {e}")
            return 0

    async def claim_stale_events(
        self,
        min_idle_ms: int = 60000,
        count: int = 100,
    ) -> list[ASDLCEvent]:
        """Claim stale events from dead consumers.

        Uses XCLAIM to take ownership of messages that have been pending
        for longer than min_idle_ms.

        Args:
            min_idle_ms: Minimum idle time in milliseconds.
            count: Maximum number of messages to claim.

        Returns:
            list[ASDLCEvent]: List of claimed AGENT_STARTED events.
        """
        try:
            # Get pending messages
            pending = await self._client.xpending_range(
                name=self.stream_name,
                groupname=self.group_name,
                min="-",
                max="+",
                count=count,
            )

            # Filter for stale entries
            stale_ids = [
                p["message_id"]
                for p in pending
                if p.get("time_since_delivered", 0) >= min_idle_ms
            ]

            if not stale_ids:
                return []

            # Claim the stale messages
            result = await self._client.xclaim(
                self.stream_name,
                self.group_name,
                self.consumer_name,
                min_idle_time=min_idle_ms,
                message_ids=stale_ids,
            )

            events = []
            for message_id, message_data in result:
                if message_data:
                    event = ASDLCEvent.from_stream_dict(message_id, message_data)
                    # Only claim AGENT_STARTED events
                    if event.event_type == EventType.AGENT_STARTED:
                        events.append(event)

            logger.info(f"Claimed {len(events)} stale AGENT_STARTED events")
            return events

        except redis.RedisError as e:
            logger.warning(f"Failed to claim stale events: {e}")
            return []
