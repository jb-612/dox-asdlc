"""Worker idempotency tracker for preventing duplicate event processing.

Provides Redis-based tracking to ensure each event is processed exactly once
by the worker pool.
"""

from __future__ import annotations

import logging

import redis.asyncio as redis

from src.core.events import ASDLCEvent, generate_idempotency_key

logger = logging.getLogger(__name__)

# Default TTL for idempotency keys (7 days)
DEFAULT_IDEMPOTENCY_TTL = 86400 * 7


class WorkerIdempotencyTracker:
    """Tracks processed events to prevent duplicate processing.

    Uses Redis keys with TTL to track which events have been processed.
    Supports multi-tenancy via tenant ID prefixing.

    This tracker is specifically for the worker pool and uses atomic
    SET NX operations to safely handle concurrent processing attempts.
    """

    KEY_PREFIX = "asdlc:worker:processed:"

    def __init__(
        self,
        client: redis.Redis,
        ttl_seconds: int = DEFAULT_IDEMPOTENCY_TTL,
        tenant_id: str | None = None,
    ) -> None:
        """Initialize the idempotency tracker.

        Args:
            client: Redis async client.
            ttl_seconds: Time-to-live for processed keys.
            tenant_id: Optional tenant ID for multi-tenancy.
        """
        self._client = client
        self._ttl_seconds = ttl_seconds
        self._tenant_id = tenant_id

    def _get_key(self, idempotency_key: str) -> str:
        """Get the full Redis key for an idempotency key.

        Args:
            idempotency_key: The event's idempotency key.

        Returns:
            str: The full Redis key, with tenant prefix if applicable.
        """
        base_key = f"{self.KEY_PREFIX}{idempotency_key}"

        if self._tenant_id:
            return f"tenant:{self._tenant_id}:{base_key}"

        return base_key

    def _get_event_idempotency_key(self, event: ASDLCEvent) -> str:
        """Get or generate the idempotency key for an event.

        Args:
            event: The event to get the key for.

        Returns:
            str: The event's idempotency key.
        """
        if event.idempotency_key:
            return event.idempotency_key

        # Generate key from event identifiers
        return generate_idempotency_key(
            event_type=event.event_type.value,
            session_id=event.session_id,
            task_id=event.task_id,
            epic_id=event.epic_id,
        )

    async def is_processed(self, event: ASDLCEvent) -> bool:
        """Check if an event has already been processed.

        Args:
            event: The event to check.

        Returns:
            bool: True if the event was already processed.
        """
        idem_key = self._get_event_idempotency_key(event)
        key = self._get_key(idem_key)

        exists = await self._client.exists(key)
        return exists > 0

    async def mark_processed(self, event: ASDLCEvent) -> None:
        """Mark an event as processed.

        Args:
            event: The event to mark as processed.
        """
        idem_key = self._get_event_idempotency_key(event)
        key = self._get_key(idem_key)

        await self._client.set(
            key,
            event.event_id or "unknown",
            ex=self._ttl_seconds,
        )
        logger.debug(f"Marked event as processed: {idem_key}")

    async def check_and_mark_if_new(self, event: ASDLCEvent) -> bool:
        """Atomically check if event is new and mark it as processed.

        Uses SET NX (set if not exists) for atomic operation.
        This is the preferred method for processing events as it
        prevents race conditions.

        Args:
            event: The event to check and mark.

        Returns:
            bool: True if the event was new and is now marked,
                  False if it was already processed.
        """
        idem_key = self._get_event_idempotency_key(event)
        key = self._get_key(idem_key)

        # SET NX returns True if the key was set (event is new)
        # Returns False if key already existed (duplicate)
        result = await self._client.set(
            key,
            event.event_id or "unknown",
            ex=self._ttl_seconds,
            nx=True,
        )

        if result:
            logger.debug(f"New event marked as processing: {idem_key}")
            return True
        else:
            logger.debug(f"Duplicate event detected: {idem_key}")
            return False
