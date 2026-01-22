"""Consumer group management for aSDLC event processing.

Provides the EventConsumer class for processing events from Redis Streams
with support for handler protocols, idempotency, and crash recovery.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Protocol, runtime_checkable

import redis.asyncio as redis

from src.core.events import ASDLCEvent, EventType, HandlerResult, RecoveryResult
from src.core.exceptions import EventProcessingError, StreamError
from src.core.redis_client import get_redis_client
from src.infrastructure.redis_streams import (
    IdempotencyTracker,
    acknowledge_event,
    get_pending_events,
    get_stream_name,
    read_events_from_group,
)

logger = logging.getLogger(__name__)


@runtime_checkable
class EventHandler(Protocol):
    """Protocol for event handlers.

    Handlers implement this interface to process events from the stream.
    The consumer calls can_handle to filter events before dispatching.
    """

    async def handle(self, event: ASDLCEvent) -> HandlerResult:
        """Process an event.

        Args:
            event: The event to process.

        Returns:
            HandlerResult indicating success/failure and retry behavior.
        """
        ...

    def can_handle(self, event_type: EventType) -> bool:
        """Check if this handler processes the given event type.

        Args:
            event_type: The type of event.

        Returns:
            True if this handler should process events of this type.
        """
        ...


class EventConsumer:
    """Consumes and processes events from a Redis Streams consumer group.

    Handles:
    - Reading events from the consumer group
    - Dispatching to the handler based on event type
    - Idempotency checking to prevent duplicate processing
    - Acknowledgment of processed events
    - Recovery of pending events on restart

    Example:
        handler = MyEventHandler()
        consumer = EventConsumer(
            group_name="discovery-handlers",
            consumer_name="worker-1",
            handler=handler,
        )

        # Recover pending events first
        await consumer.process_pending()

        # Start consuming
        await consumer.start()
    """

    def __init__(
        self,
        group_name: str,
        consumer_name: str,
        handler: EventHandler,
        client: redis.Redis | None = None,
        stream_name: str | None = None,
        batch_size: int = 10,
        block_ms: int = 5000,
        idempotency_ttl: int = 86400 * 7,
    ):
        """Initialize the event consumer.

        Args:
            group_name: Name of the consumer group.
            consumer_name: Unique name for this consumer instance.
            handler: Event handler implementing the EventHandler protocol.
            client: Redis client. Will create one if not provided.
            stream_name: Stream name. Uses tenant-aware default if not provided.
            batch_size: Number of events to read per iteration.
            block_ms: Blocking timeout in milliseconds.
            idempotency_ttl: TTL for idempotency keys in seconds.
        """
        self.group_name = group_name
        self.consumer_name = consumer_name
        self.handler = handler
        self._client = client
        self._stream_name = stream_name
        self.batch_size = batch_size
        self.block_ms = block_ms
        self.idempotency_ttl = idempotency_ttl
        self._running = False
        self._idempotency_tracker: IdempotencyTracker | None = None

    @property
    def stream_name(self) -> str:
        """Get the resolved stream name."""
        if self._stream_name is None:
            self._stream_name = get_stream_name()
        return self._stream_name

    async def _get_client(self) -> redis.Redis:
        """Get or create the Redis client."""
        if self._client is None:
            self._client = await get_redis_client()
        return self._client

    async def _get_tracker(self) -> IdempotencyTracker:
        """Get or create the idempotency tracker."""
        if self._idempotency_tracker is None:
            client = await self._get_client()
            self._idempotency_tracker = IdempotencyTracker(
                client, ttl_seconds=self.idempotency_ttl
            )
        return self._idempotency_tracker

    async def start(self) -> None:
        """Start consuming events in a loop.

        This runs until stop() is called. Events are processed one at a time
        within each batch, with acknowledgment after successful processing.
        """
        self._running = True
        logger.info(
            f"Starting consumer {self.consumer_name} for group {self.group_name}"
        )

        while self._running:
            try:
                await self._process_once()
            except StreamError as e:
                logger.error(f"Stream error in consumer: {e}")
                # Back off on stream errors
                await asyncio.sleep(1.0)
            except Exception as e:
                logger.exception(f"Unexpected error in consumer: {e}")
                await asyncio.sleep(1.0)

        logger.info(f"Consumer {self.consumer_name} stopped")

    async def stop(self) -> None:
        """Stop the consumer gracefully.

        Sets _running to False, which will cause the start() loop to exit
        after the current iteration completes.
        """
        logger.info(f"Stopping consumer {self.consumer_name}")
        self._running = False

    async def _process_once(self) -> int:
        """Process one batch of events.

        Returns:
            Number of events processed.
        """
        client = await self._get_client()
        tracker = await self._get_tracker()

        # Read events from the stream
        events = await read_events_from_group(
            client=client,
            group_name=self.group_name,
            consumer_name=self.consumer_name,
            stream_name=self.stream_name,
            count=self.batch_size,
            block_ms=self.block_ms,
        )

        processed = 0
        for event in events:
            try:
                await self._handle_event(event, tracker)
                processed += 1
            except Exception as e:
                logger.error(
                    f"Error processing event {event.event_id}: {e}",
                    exc_info=True,
                )

        return processed

    async def _handle_event(
        self,
        event: ASDLCEvent,
        tracker: IdempotencyTracker,
    ) -> None:
        """Handle a single event.

        Args:
            event: The event to handle.
            tracker: Idempotency tracker for deduplication.
        """
        client = await self._get_client()
        event_id = event.event_id or ""

        # Check if handler can process this event type
        if not self.handler.can_handle(event.event_type):
            logger.debug(
                f"Handler cannot process event type {event.event_type}, "
                f"acknowledging without processing"
            )
            await acknowledge_event(
                client, self.stream_name, self.group_name, event_id
            )
            return

        # Check idempotency
        idempotency_key = event.idempotency_key
        if idempotency_key and await tracker.is_processed(idempotency_key):
            logger.debug(
                f"Event {event_id} already processed (key: {idempotency_key})"
            )
            await acknowledge_event(
                client, self.stream_name, self.group_name, event_id
            )
            return

        # Process the event
        try:
            result = await self.handler.handle(event)

            if result.success:
                # Mark as processed and acknowledge
                if idempotency_key:
                    await tracker.mark_processed(idempotency_key, event_id)
                await acknowledge_event(
                    client, self.stream_name, self.group_name, event_id
                )
                logger.debug(f"Successfully processed event {event_id}")
            elif result.should_retry:
                # Don't acknowledge - let it be redelivered
                logger.warning(
                    f"Event {event_id} requested retry: {result.error_message}"
                )
            else:
                # Permanent failure - acknowledge to prevent infinite retries
                # but don't mark as processed (it wasn't)
                await acknowledge_event(
                    client, self.stream_name, self.group_name, event_id
                )
                logger.error(
                    f"Event {event_id} permanently failed: {result.error_message}"
                )

        except Exception as e:
            # Handler crashed - don't acknowledge, allow retry
            logger.exception(f"Handler crashed for event {event_id}: {e}")

    async def process_pending(self) -> RecoveryResult:
        """Process pending events from previous runs.

        This should be called on startup to recover from crashes.
        It claims stale events from dead consumers and processes them.

        Returns:
            RecoveryResult with processing statistics.
        """
        client = await self._get_client()
        tracker = await self._get_tracker()

        logger.info(
            f"Processing pending events for group {self.group_name}"
        )

        processed = 0
        skipped = 0
        failed = 0
        claimed = 0

        # Get pending events
        pending = await get_pending_events(
            client=client,
            stream_name=self.stream_name,
            group_name=self.group_name,
            count=100,
        )

        if not pending:
            logger.info("No pending events to recover")
            return RecoveryResult(
                processed=0, skipped=0, failed=0, claimed=0
            )

        # Claim stale events (idle > 60 seconds)
        stale_ids = [
            p["message_id"]
            for p in pending
            if p.get("time_since_delivered", 0) >= 60000
        ]

        if stale_ids:
            try:
                claimed_messages = await client.xclaim(
                    self.stream_name,
                    self.group_name,
                    self.consumer_name,
                    min_idle_time=60000,
                    message_ids=stale_ids,
                )
                claimed = len(claimed_messages)
                logger.info(f"Claimed {claimed} stale events")

                # Process claimed events
                for message_id, message_data in claimed_messages:
                    if not message_data:
                        continue

                    event = ASDLCEvent.from_stream_dict(message_id, message_data)

                    # Check idempotency
                    idempotency_key = event.idempotency_key
                    if idempotency_key and await tracker.is_processed(idempotency_key):
                        logger.debug(f"Skipping already processed event {message_id}")
                        await acknowledge_event(
                            client, self.stream_name, self.group_name, message_id
                        )
                        skipped += 1
                        continue

                    # Check if handler can process
                    if not self.handler.can_handle(event.event_type):
                        await acknowledge_event(
                            client, self.stream_name, self.group_name, message_id
                        )
                        skipped += 1
                        continue

                    # Process the event
                    try:
                        result = await self.handler.handle(event)
                        if result.success:
                            if idempotency_key:
                                await tracker.mark_processed(
                                    idempotency_key, message_id
                                )
                            await acknowledge_event(
                                client, self.stream_name, self.group_name, message_id
                            )
                            processed += 1
                        elif result.should_retry:
                            # Leave for future retry
                            failed += 1
                        else:
                            # Permanent failure
                            await acknowledge_event(
                                client, self.stream_name, self.group_name, message_id
                            )
                            failed += 1
                    except Exception as e:
                        logger.error(f"Error recovering event {message_id}: {e}")
                        failed += 1

            except redis.RedisError as e:
                logger.error(f"Error claiming stale events: {e}")

        result = RecoveryResult(
            processed=processed,
            skipped=skipped,
            failed=failed,
            claimed=claimed,
        )

        logger.info(
            f"Recovery complete: {result.processed} processed, "
            f"{result.skipped} skipped, {result.failed} failed, "
            f"{result.claimed} claimed"
        )

        return result
