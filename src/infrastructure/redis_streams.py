"""Redis Streams management for aSDLC event coordination.

Provides consumer group initialization, stream operations, idempotency tracking,
and tenant-aware stream handling as defined in System_Design.md Section 6.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import redis.asyncio as redis

from src.core.config import RedisConfig, get_redis_config, get_tenant_config
from src.core.events import ASDLCEvent, EventType, generate_idempotency_key
from src.core.exceptions import ConsumerGroupError, StreamError
from src.core.redis_client import get_redis_client
from src.core.tenant import TenantContext

logger = logging.getLogger(__name__)


# Default TTL for idempotency keys (7 days)
DEFAULT_IDEMPOTENCY_TTL = 86400 * 7


@dataclass
class StreamEvent:
    """Represents an event from the aSDLC event stream."""

    event_id: str
    event_type: str
    session_id: str
    epic_id: str | None
    task_id: str | None
    git_sha: str | None
    artifact_paths: list[str]
    mode: str
    timestamp: str
    raw_data: dict[str, Any]

    @classmethod
    def from_stream_entry(
        cls, event_id: str, data: dict[str, Any]
    ) -> StreamEvent:
        """Create StreamEvent from Redis stream entry."""
        artifact_paths = data.get("artifact_paths", "")
        if isinstance(artifact_paths, str):
            artifact_paths = (
                artifact_paths.split(",") if artifact_paths else []
            )

        return cls(
            event_id=event_id,
            event_type=data.get("event_type", "unknown"),
            session_id=data.get("session_id", ""),
            epic_id=data.get("epic_id"),
            task_id=data.get("task_id"),
            git_sha=data.get("git_sha"),
            artifact_paths=artifact_paths,
            mode=data.get("mode", "normal"),
            timestamp=data.get("timestamp", datetime.utcnow().isoformat()),
            raw_data=data,
        )


async def ensure_stream_exists(
    client: redis.Redis | None = None,
    stream_name: str | None = None,
) -> bool:
    """Ensure the event stream exists.

    Creates the stream if it doesn't exist by adding a placeholder message.

    Args:
        client: Redis client. Creates one if not provided.
        stream_name: Stream name. Uses config default if not provided.

    Returns:
        bool: True if stream exists or was created.

    Raises:
        StreamError: If stream creation fails.
    """
    if client is None:
        client = await get_redis_client()

    if stream_name is None:
        config = get_redis_config()
        stream_name = config.stream_name

    try:
        # Check if stream exists
        exists = await client.exists(stream_name)
        if exists:
            logger.debug(f"Stream {stream_name} already exists")
            return True

        # Create stream with initial placeholder
        # This will be trimmed when real events are added
        await client.xadd(
            stream_name,
            {"_init": "true", "timestamp": datetime.utcnow().isoformat()},
            maxlen=1000,
        )
        logger.info(f"Created stream: {stream_name}")
        return True
    except redis.RedisError as e:
        raise StreamError(
            f"Failed to ensure stream exists: {e}",
            details={"stream": stream_name},
        ) from e


async def create_consumer_group(
    client: redis.Redis,
    stream_name: str,
    group_name: str,
    start_id: str = "0",
) -> bool:
    """Create a consumer group for the stream.

    Args:
        client: Redis client.
        stream_name: Name of the stream.
        group_name: Name of the consumer group.
        start_id: ID to start reading from. "0" for beginning, "$" for new only.

    Returns:
        bool: True if group was created, False if it already exists.

    Raises:
        ConsumerGroupError: If group creation fails.
    """
    try:
        await client.xgroup_create(
            stream_name, group_name, id=start_id, mkstream=True
        )
        logger.info(f"Created consumer group: {group_name} for {stream_name}")
        return True
    except redis.ResponseError as e:
        if "BUSYGROUP" in str(e):
            # Group already exists
            logger.debug(
                f"Consumer group {group_name} already exists for {stream_name}"
            )
            return False
        raise ConsumerGroupError(
            f"Failed to create consumer group: {e}",
            details={"stream": stream_name, "group": group_name},
        ) from e
    except redis.RedisError as e:
        raise ConsumerGroupError(
            f"Redis error creating consumer group: {e}",
            details={"stream": stream_name, "group": group_name},
        ) from e


async def initialize_consumer_groups(
    client: redis.Redis | None = None,
    config: RedisConfig | None = None,
) -> dict[str, bool]:
    """Initialize all consumer groups defined in configuration.

    Creates the event stream and all consumer groups from config.
    Idempotent - safe to call multiple times.

    Args:
        client: Redis client. Creates one if not provided.
        config: Redis configuration. Uses environment config if not provided.

    Returns:
        dict: Mapping of group names to creation status (True=created, False=existed).

    Raises:
        ConsumerGroupError: If initialization fails.
    """
    if client is None:
        client = await get_redis_client()

    if config is None:
        config = get_redis_config()

    # Ensure stream exists first
    await ensure_stream_exists(client, config.stream_name)

    results = {}
    for group_name in config.consumer_groups:
        try:
            created = await create_consumer_group(
                client, config.stream_name, group_name
            )
            results[group_name] = created
        except ConsumerGroupError:
            logger.error(f"Failed to create consumer group: {group_name}")
            raise

    return results


async def get_stream_info(
    client: redis.Redis | None = None,
    stream_name: str | None = None,
) -> dict[str, Any]:
    """Get information about the event stream.

    Args:
        client: Redis client. Creates one if not provided.
        stream_name: Stream name. Uses config default if not provided.

    Returns:
        dict: Stream information including length, groups, and consumers.
    """
    if client is None:
        client = await get_redis_client()

    if stream_name is None:
        config = get_redis_config()
        stream_name = config.stream_name

    try:
        info = await client.xinfo_stream(stream_name)
        groups_info = await client.xinfo_groups(stream_name)

        return {
            "stream": stream_name,
            "length": info.get("length", 0),
            "first_entry": info.get("first-entry"),
            "last_entry": info.get("last-entry"),
            "groups": [
                {
                    "name": g.get("name"),
                    "consumers": g.get("consumers", 0),
                    "pending": g.get("pending", 0),
                    "last_delivered": g.get("last-delivered-id"),
                }
                for g in groups_info
            ],
        }
    except redis.ResponseError as e:
        if "no such key" in str(e).lower():
            return {
                "stream": stream_name,
                "length": 0,
                "exists": False,
                "groups": [],
            }
        raise StreamError(
            f"Failed to get stream info: {e}",
            details={"stream": stream_name},
        ) from e


async def publish_event(
    client: redis.Redis | None = None,
    event_type: str = "",
    session_id: str = "",
    epic_id: str | None = None,
    task_id: str | None = None,
    git_sha: str | None = None,
    artifact_paths: list[str] | None = None,
    mode: str = "normal",
    stream_name: str | None = None,
    **extra_fields,
) -> str:
    """Publish an event to the event stream.

    Args:
        client: Redis client. Creates one if not provided.
        event_type: Type of event (e.g., "task_created", "gate_requested").
        session_id: Session identifier.
        epic_id: Optional epic identifier.
        task_id: Optional task identifier.
        git_sha: Optional Git SHA reference.
        artifact_paths: Optional list of artifact paths.
        mode: Event mode ("normal" or "rlm").
        stream_name: Stream name. Uses config default if not provided.
        **extra_fields: Additional fields to include in the event.

    Returns:
        str: The event ID assigned by Redis.

    Raises:
        StreamError: If publishing fails.
    """
    if client is None:
        client = await get_redis_client()

    if stream_name is None:
        config = get_redis_config()
        stream_name = config.stream_name

    event_data = {
        "event_type": event_type,
        "session_id": session_id,
        "timestamp": datetime.utcnow().isoformat(),
        "mode": mode,
    }

    if epic_id:
        event_data["epic_id"] = epic_id
    if task_id:
        event_data["task_id"] = task_id
    if git_sha:
        event_data["git_sha"] = git_sha
    if artifact_paths:
        event_data["artifact_paths"] = ",".join(artifact_paths)

    # Add any extra fields
    event_data.update(extra_fields)

    try:
        event_id = await client.xadd(stream_name, event_data, maxlen=10000)
        logger.debug(f"Published event {event_id}: {event_type}")
        return event_id
    except redis.RedisError as e:
        raise StreamError(
            f"Failed to publish event: {e}",
            details={"event_type": event_type, "stream": stream_name},
        ) from e


def get_stream_name(base_name: str | None = None) -> str:
    """Get the stream name, with tenant prefix if multi-tenancy is enabled.

    Args:
        base_name: Optional base stream name. Uses config default if not provided.

    Returns:
        str: The stream name, possibly prefixed with tenant ID.
    """
    if base_name is None:
        config = get_redis_config()
        base_name = config.stream_name

    tenant_config = get_tenant_config()
    if tenant_config.enabled:
        try:
            tenant_id = TenantContext.get_current_tenant()
            return f"tenant:{tenant_id}:{base_name}"
        except Exception:
            # No tenant in context, use default
            return f"tenant:{tenant_config.default_tenant}:{base_name}"

    return base_name


async def publish_event_model(
    event: ASDLCEvent,
    client: redis.Redis | None = None,
    stream_name: str | None = None,
    maxlen: int = 10000,
) -> str:
    """Publish a validated ASDLCEvent to the event stream.

    This is the preferred method for publishing events, as it ensures
    proper validation, tenant context injection, and idempotency key generation.

    Args:
        event: The validated event model to publish.
        client: Redis client. Creates one if not provided.
        stream_name: Stream name. Uses tenant-aware default if not provided.
        maxlen: Maximum stream length for trimming.

    Returns:
        str: The event ID assigned by Redis.

    Raises:
        StreamError: If publishing fails.
    """
    if client is None:
        client = await get_redis_client()

    if stream_name is None:
        stream_name = get_stream_name()

    # Inject tenant context if not already set
    tenant_config = get_tenant_config()
    if tenant_config.enabled and not event.tenant_id:
        try:
            event.tenant_id = TenantContext.get_current_tenant()
        except Exception:
            event.tenant_id = tenant_config.default_tenant

    # Generate idempotency key if not set
    if not event.idempotency_key:
        event.idempotency_key = generate_idempotency_key(
            event_type=event.event_type.value,
            session_id=event.session_id,
            task_id=event.task_id,
            epic_id=event.epic_id,
        )

    # Serialize to stream format
    event_data = event.to_stream_dict()

    try:
        event_id = await client.xadd(stream_name, event_data, maxlen=maxlen)
        logger.debug(f"Published event {event_id}: {event.event_type.value}")
        return event_id
    except redis.RedisError as e:
        raise StreamError(
            f"Failed to publish event: {e}",
            details={"event_type": event.event_type.value, "stream": stream_name},
        ) from e


class IdempotencyTracker:
    """Tracks processed events to prevent duplicate processing.

    Uses Redis keys with TTL to track which events have been processed.
    In multi-tenant mode, keys are prefixed with tenant ID.
    """

    KEY_PREFIX = "asdlc:processed:"

    def __init__(
        self,
        client: redis.Redis,
        ttl_seconds: int = DEFAULT_IDEMPOTENCY_TTL,
    ):
        """Initialize the idempotency tracker.

        Args:
            client: Redis client for storage.
            ttl_seconds: Time-to-live for processed keys.
        """
        self.client = client
        self.ttl_seconds = ttl_seconds

    def _get_key(self, idempotency_key: str) -> str:
        """Get the full Redis key for an idempotency key.

        Args:
            idempotency_key: The event's idempotency key.

        Returns:
            str: The full Redis key, with tenant prefix if enabled.
        """
        base_key = f"{self.KEY_PREFIX}{idempotency_key}"

        tenant_config = get_tenant_config()
        if tenant_config.enabled:
            try:
                tenant_id = TenantContext.get_current_tenant()
                return f"tenant:{tenant_id}:{base_key}"
            except Exception:
                return f"tenant:{tenant_config.default_tenant}:{base_key}"

        return base_key

    async def is_processed(self, idempotency_key: str) -> bool:
        """Check if an event with this key was already processed.

        Args:
            idempotency_key: The event's idempotency key.

        Returns:
            bool: True if the event was already processed.
        """
        key = self._get_key(idempotency_key)
        exists = await self.client.exists(key)
        return exists > 0

    async def mark_processed(
        self,
        idempotency_key: str,
        event_id: str,
    ) -> None:
        """Mark an event as processed.

        Args:
            idempotency_key: The event's idempotency key.
            event_id: The Redis stream event ID.
        """
        key = self._get_key(idempotency_key)
        await self.client.set(
            key,
            event_id,
            ex=self.ttl_seconds,
        )
        logger.debug(f"Marked event as processed: {idempotency_key}")


async def ensure_stream_exists_for_tenant(
    client: redis.Redis,
    base_stream_name: str | None = None,
) -> bool:
    """Ensure the tenant-aware event stream exists.

    Args:
        client: Redis client.
        base_stream_name: Base stream name. Uses config default if not provided.

    Returns:
        bool: True if stream exists or was created.
    """
    stream_name = get_stream_name(base_stream_name)
    return await ensure_stream_exists(client, stream_name)


async def get_stream_info_for_tenant(
    client: redis.Redis,
    base_stream_name: str | None = None,
) -> dict[str, Any]:
    """Get information about the tenant-aware event stream.

    Args:
        client: Redis client.
        base_stream_name: Base stream name. Uses config default if not provided.

    Returns:
        dict: Stream information including length, groups, and consumers.
    """
    stream_name = get_stream_name(base_stream_name)
    return await get_stream_info(client, stream_name)


async def read_events_from_group(
    client: redis.Redis,
    group_name: str,
    consumer_name: str,
    stream_name: str | None = None,
    count: int = 10,
    block_ms: int | None = None,
) -> list[ASDLCEvent]:
    """Read events from a consumer group.

    Args:
        client: Redis client.
        group_name: Name of the consumer group.
        consumer_name: Name of this consumer instance.
        stream_name: Stream name. Uses tenant-aware default if not provided.
        count: Maximum number of events to read.
        block_ms: Optional blocking timeout in milliseconds.

    Returns:
        list[ASDLCEvent]: List of events read from the stream.
    """
    if stream_name is None:
        stream_name = get_stream_name()

    try:
        # Read new events (> means new undelivered messages)
        kwargs: dict[str, Any] = {
            "groupname": group_name,
            "consumername": consumer_name,
            "count": count,
            "streams": {stream_name: ">"},
        }
        if block_ms is not None:
            kwargs["block"] = block_ms

        result = await client.xreadgroup(**kwargs)

        events = []
        if result:
            for stream_data in result:
                stream_key, messages = stream_data
                for message_id, message_data in messages:
                    event = ASDLCEvent.from_stream_dict(message_id, message_data)
                    events.append(event)

        return events
    except redis.RedisError as e:
        raise StreamError(
            f"Failed to read from consumer group: {e}",
            details={"group": group_name, "stream": stream_name},
        ) from e


async def acknowledge_event(
    client: redis.Redis,
    stream_name: str,
    group_name: str,
    event_id: str,
) -> bool:
    """Acknowledge an event as processed.

    Args:
        client: Redis client.
        stream_name: Name of the stream.
        group_name: Name of the consumer group.
        event_id: The event ID to acknowledge.

    Returns:
        bool: True if the event was acknowledged.
    """
    try:
        result = await client.xack(stream_name, group_name, event_id)
        return result > 0
    except redis.RedisError as e:
        raise StreamError(
            f"Failed to acknowledge event: {e}",
            details={"event_id": event_id, "stream": stream_name},
        ) from e


async def get_pending_events(
    client: redis.Redis,
    stream_name: str,
    group_name: str,
    count: int = 100,
    consumer_name: str | None = None,
) -> list[dict[str, Any]]:
    """Get pending (unacknowledged) events from a consumer group.

    Args:
        client: Redis client.
        stream_name: Name of the stream.
        group_name: Name of the consumer group.
        count: Maximum number of pending entries to return.
        consumer_name: Optional consumer name to filter by.

    Returns:
        list[dict]: List of pending event info dictionaries.
    """
    try:
        # XPENDING returns entries with message_id, consumer, idle_time, delivery_count
        kwargs: dict[str, Any] = {
            "name": stream_name,
            "groupname": group_name,
            "min": "-",
            "max": "+",
            "count": count,
        }
        if consumer_name:
            kwargs["consumername"] = consumer_name

        result = await client.xpending_range(**kwargs)

        pending = []
        for entry in result:
            pending.append({
                "message_id": entry.get("message_id"),
                "consumer": entry.get("consumer"),
                "time_since_delivered": entry.get("time_since_delivered"),
                "times_delivered": entry.get("times_delivered"),
            })

        return pending
    except redis.RedisError as e:
        raise StreamError(
            f"Failed to get pending events: {e}",
            details={"group": group_name, "stream": stream_name},
        ) from e


async def claim_stale_events(
    client: redis.Redis,
    stream_name: str,
    group_name: str,
    consumer_name: str,
    min_idle_ms: int = 60000,
    count: int = 100,
) -> list[ASDLCEvent]:
    """Claim stale events from dead consumers.

    Uses XCLAIM to take ownership of messages that have been pending
    for longer than min_idle_ms.

    Args:
        client: Redis client.
        stream_name: Name of the stream.
        group_name: Name of the consumer group.
        consumer_name: Name of the consumer claiming messages.
        min_idle_ms: Minimum idle time in milliseconds.
        count: Maximum number of messages to claim.

    Returns:
        list[ASDLCEvent]: List of claimed events.
    """
    try:
        # First get pending messages that are idle enough
        pending = await get_pending_events(client, stream_name, group_name, count)

        stale_ids = [
            p["message_id"]
            for p in pending
            if p.get("time_since_delivered", 0) >= min_idle_ms
        ]

        if not stale_ids:
            return []

        # Claim the stale messages
        result = await client.xclaim(
            stream_name,
            group_name,
            consumer_name,
            min_idle_time=min_idle_ms,
            message_ids=stale_ids,
        )

        events = []
        for message_id, message_data in result:
            if message_data:  # XCLAIM returns data for valid messages
                event = ASDLCEvent.from_stream_dict(message_id, message_data)
                events.append(event)

        logger.info(f"Claimed {len(events)} stale events from {group_name}")
        return events
    except redis.RedisError as e:
        raise StreamError(
            f"Failed to claim stale events: {e}",
            details={"group": group_name, "stream": stream_name},
        ) from e
