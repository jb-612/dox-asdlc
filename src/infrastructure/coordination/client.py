"""Async coordination client for CLI message passing.

Provides the main CoordinationClient class for publishing, querying,
and acknowledging coordination messages between CLI instances.
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from collections.abc import Callable, Coroutine
from datetime import UTC, datetime
from typing import Any

import redis.asyncio as redis

from src.core.exceptions import (
    AcknowledgeError,
    CoordinationError,
    PresenceError,
    PublishError,
)
from src.infrastructure.coordination.config import (
    CoordinationConfig,
    get_coordination_config,
)
from src.infrastructure.coordination.types import (
    CoordinationMessage,
    CoordinationStats,
    MessagePayload,
    MessageQuery,
    MessageType,
    NotificationEvent,
    PresenceInfo,
)


logger = logging.getLogger(__name__)


def generate_message_id() -> str:
    """Generate a unique message ID.

    Returns:
        Message ID in format msg-{uuid8}
    """
    return f"msg-{uuid.uuid4().hex[:8]}"


class CoordinationClient:
    """Async client for CLI coordination via Redis.

    Provides methods for publishing messages, querying inbox,
    acknowledging messages, and tracking instance presence.

    Usage:
        async with CoordinationClient(redis_client, config) as client:
            await client.publish_message(
                msg_type=MessageType.READY_FOR_REVIEW,
                subject="Feature ready",
                description="P03-F01 complete",
                from_instance="backend",
                to_instance="orchestrator",
            )

    Attributes:
        redis: The Redis client instance
        config: Coordination configuration
        instance_id: Optional instance ID for this client
    """

    def __init__(
        self,
        redis_client: redis.Redis,
        config: CoordinationConfig | None = None,
        instance_id: str | None = None,
    ) -> None:
        """Initialize the coordination client.

        Args:
            redis_client: Async Redis client instance
            config: Optional coordination config. Uses default if not provided.
            instance_id: Optional instance ID for this client (for presence tracking)
        """
        self._redis = redis_client
        self._config = config or get_coordination_config()
        self._instance_id = instance_id
        self._is_connected = False
        self._correlation_id: str | None = None

        logger.debug(
            f"CoordinationClient initialized with prefix={self._config.key_prefix}"
        )

    @property
    def redis(self) -> redis.Redis:
        """Get the Redis client instance."""
        return self._redis

    @property
    def config(self) -> CoordinationConfig:
        """Get the coordination configuration."""
        return self._config

    @property
    def instance_id(self) -> str | None:
        """Get the instance ID for this client."""
        return self._instance_id

    @property
    def is_connected(self) -> bool:
        """Check if the client has verified connectivity."""
        return self._is_connected

    def set_correlation_id(self, correlation_id: str) -> None:
        """Set a correlation ID for request tracing.

        Args:
            correlation_id: Unique identifier for tracing related operations
        """
        self._correlation_id = correlation_id
        logger.debug(f"Correlation ID set: {correlation_id}")

    def clear_correlation_id(self) -> None:
        """Clear the correlation ID."""
        self._correlation_id = None

    async def __aenter__(self) -> CoordinationClient:
        """Enter async context manager.

        Verifies Redis connectivity on entry.

        Returns:
            Self for use in context

        Raises:
            CoordinationError: If Redis connection check fails
        """
        try:
            health = await self.health_check()
            if not health["connected"]:
                raise CoordinationError(
                    "Redis connection failed on context entry",
                    details=health,
                )
            self._is_connected = True
            logger.debug("CoordinationClient entered context (connected)")
            return self
        except redis.RedisError as e:
            raise CoordinationError(
                f"Failed to connect to Redis: {e}",
                details={"error": str(e)},
            ) from e

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: Any,
    ) -> None:
        """Exit async context manager.

        Performs cleanup and logs any exceptions.

        Args:
            exc_type: Exception type if an exception was raised
            exc_val: Exception value if an exception was raised
            exc_tb: Exception traceback if an exception was raised
        """
        self._is_connected = False
        self._correlation_id = None

        if exc_val is not None:
            logger.warning(
                f"CoordinationClient exiting with exception: {exc_type.__name__}: {exc_val}"
            )
        else:
            logger.debug("CoordinationClient exiting context normally")

    async def health_check(self) -> dict[str, Any]:
        """Check Redis connectivity and return health status.

        Returns:
            Dict with health status including:
            - connected: bool indicating connectivity
            - status: "healthy" or "unhealthy"
            - latency_ms: Optional ping latency in milliseconds
            - error: Optional error message if unhealthy

        Example:
            >>> health = await client.health_check()
            >>> if health["connected"]:
            ...     print(f"Connected with {health['latency_ms']}ms latency")
        """
        start = datetime.now(UTC)
        try:
            pong = await self._redis.ping()
            end = datetime.now(UTC)
            latency_ms = (end - start).total_seconds() * 1000

            if pong:
                logger.debug(f"Redis health check passed (latency={latency_ms:.2f}ms)")
                return {
                    "connected": True,
                    "status": "healthy",
                    "latency_ms": round(latency_ms, 2),
                    "key_prefix": self._config.key_prefix,
                }
            else:
                return {
                    "connected": False,
                    "status": "unhealthy",
                    "error": "PING returned unexpected response",
                }
        except redis.ConnectionError as e:
            logger.warning(f"Redis health check failed (connection): {e}")
            return {
                "connected": False,
                "status": "unhealthy",
                "error": f"Connection error: {e}",
            }
        except redis.RedisError as e:
            logger.warning(f"Redis health check failed: {e}")
            return {
                "connected": False,
                "status": "unhealthy",
                "error": str(e),
            }

    def _log_operation(
        self,
        operation: str,
        level: int = logging.DEBUG,
        **kwargs: Any,
    ) -> None:
        """Log an operation with correlation ID and context.

        Args:
            operation: Name of the operation
            level: Logging level (default DEBUG)
            **kwargs: Additional context to include in log
        """
        context = {
            "operation": operation,
            "instance_id": self._instance_id,
            **kwargs,
        }
        if self._correlation_id:
            context["correlation_id"] = self._correlation_id

        logger.log(level, f"Coordination: {operation}", extra={"context": context})

    async def publish_message(
        self,
        msg_type: MessageType,
        subject: str,
        description: str,
        from_instance: str,
        to_instance: str,
        requires_ack: bool = True,
        message_id: str | None = None,
    ) -> CoordinationMessage:
        """Publish a coordination message atomically.

        Uses a Redis pipeline to ensure all operations complete together:
        1. Store message hash at coord:msg:{id}
        2. Add to timeline sorted set (score = timestamp)
        3. Add to inbox set for target instance
        4. Add to pending set if requires_ack
        5. Publish notification to instance channel
        6. Publish notification to broadcast channel

        Args:
            msg_type: Type of coordination message
            subject: Brief subject line
            description: Detailed message content
            from_instance: Sender instance ID
            to_instance: Target instance ID or "all" for broadcast
            requires_ack: Whether acknowledgment is required (default True)
            message_id: Optional custom message ID (auto-generated if not provided)

        Returns:
            CoordinationMessage: The published message

        Raises:
            PublishError: If publishing fails

        Example:
            >>> msg = await client.publish_message(
            ...     msg_type=MessageType.READY_FOR_REVIEW,
            ...     subject="P03-F01 complete",
            ...     description="All tests passing, ready for review",
            ...     from_instance="backend",
            ...     to_instance="orchestrator",
            ... )
            >>> print(f"Published: {msg.id}")
        """
        # Generate message ID if not provided
        msg_id = message_id or generate_message_id()

        # Create timestamp
        timestamp = datetime.now(UTC)
        timestamp_unix = timestamp.timestamp()

        # Build the message
        payload = MessagePayload(subject=subject, description=description)
        message = CoordinationMessage(
            id=msg_id,
            type=msg_type,
            from_instance=from_instance,
            to_instance=to_instance,
            timestamp=timestamp,
            requires_ack=requires_ack,
            acknowledged=False,
            payload=payload,
        )

        # Build Redis keys
        msg_key = self._config.message_key(msg_id)
        timeline_key = self._config.timeline_key()
        inbox_key = self._config.inbox_key(to_instance)
        pending_key = self._config.pending_key()
        instance_channel = self._config.instance_channel(to_instance)
        broadcast_channel = self._config.broadcast_channel()

        # Build hash data for message storage
        msg_hash = {
            "id": msg_id,
            "type": msg_type.value,
            "from": from_instance,
            "to": to_instance,
            "timestamp": timestamp.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "requires_ack": "1" if requires_ack else "0",
            "acknowledged": "0",
            "subject": subject,
            "description": description,
        }

        # Build notification event
        notification = NotificationEvent(
            event="message_published",
            message_id=msg_id,
            msg_type=msg_type,
            from_instance=from_instance,
            to_instance=to_instance,
            requires_ack=requires_ack,
            timestamp=timestamp,
        )
        notification_json = notification.to_json()

        self._log_operation(
            "publish_message",
            level=logging.INFO,
            message_id=msg_id,
            msg_type=msg_type.value,
            from_instance=from_instance,
            to_instance=to_instance,
        )

        try:
            # Check for duplicate message ID
            exists = await self._redis.exists(msg_key)
            if exists:
                raise PublishError(
                    f"Message ID already exists: {msg_id}",
                    details={"message_id": msg_id},
                )

            # Execute atomic pipeline
            async with self._redis.pipeline(transaction=True) as pipe:
                # Store message hash with TTL
                pipe.hset(msg_key, mapping=msg_hash)
                pipe.expire(msg_key, self._config.message_ttl_seconds)

                # Add to timeline (sorted set by timestamp)
                pipe.zadd(timeline_key, {msg_id: timestamp_unix})

                # Trim timeline to max size
                pipe.zremrangebyrank(timeline_key, 0, -self._config.timeline_max_size - 1)

                # Add to inbox
                pipe.sadd(inbox_key, msg_id)

                # Add to pending set if requires acknowledgment
                if requires_ack:
                    pipe.sadd(pending_key, msg_id)

                # Publish notifications
                pipe.publish(instance_channel, notification_json)
                pipe.publish(broadcast_channel, notification_json)

                # Execute all commands atomically
                await pipe.execute()

            # Queue notification for offline instances (skip for broadcasts)
            if to_instance != "all":
                await self._queue_if_offline(to_instance, notification)

            logger.info(
                f"Published message {msg_id}: {msg_type.value} from {from_instance} to {to_instance}"
            )
            return message

        except PublishError:
            raise
        except redis.RedisError as e:
            logger.error(f"Failed to publish message {msg_id}: {e}")
            raise PublishError(
                f"Failed to publish message: {e}",
                details={"message_id": msg_id, "error": str(e)},
            ) from e
        except Exception as e:
            logger.error(f"Unexpected error publishing message {msg_id}: {e}")
            raise PublishError(
                f"Unexpected error publishing message: {e}",
                details={"message_id": msg_id, "error": str(e)},
            ) from e

    async def _check_message_exists(self, message_id: str) -> bool:
        """Check if a message exists in Redis.

        Args:
            message_id: The message ID to check

        Returns:
            True if message exists, False otherwise
        """
        msg_key = self._config.message_key(message_id)
        return bool(await self._redis.exists(msg_key))

    async def _queue_if_offline(
        self,
        instance_id: str,
        notification: NotificationEvent,
    ) -> None:
        """Queue notification for instance if it appears offline.

        Checks instance presence and queues the notification if the instance
        is not currently active. This is a best-effort operation - failures
        are logged but don't affect message publishing.

        Args:
            instance_id: Target instance ID
            notification: Notification to potentially queue
        """
        try:
            presence = await self.get_presence()
            instance_info = presence.get(instance_id)

            # Queue if instance is not registered or not active
            if instance_info is None or not instance_info.active:
                await self.queue_notification(instance_id, notification)
                logger.debug(
                    f"Queued notification for offline instance {instance_id}"
                )
        except Exception as e:
            # Best-effort: log but don't fail the publish
            logger.warning(
                f"Failed to check/queue notification for {instance_id}: {e}"
            )

    async def get_message(self, message_id: str) -> CoordinationMessage | None:
        """Get a single message by ID.

        Args:
            message_id: The message ID to retrieve

        Returns:
            CoordinationMessage if found, None otherwise

        Example:
            >>> msg = await client.get_message("msg-abc12345")
            >>> if msg:
            ...     print(f"Found: {msg.payload.subject}")
        """
        msg_key = self._config.message_key(message_id)

        self._log_operation("get_message", message_id=message_id)

        try:
            msg_hash = await self._redis.hgetall(msg_key)
            if not msg_hash:
                return None

            return self._hash_to_message(msg_hash)

        except redis.RedisError as e:
            logger.error(f"Failed to get message {message_id}: {e}")
            raise CoordinationError(
                f"Failed to get message: {e}",
                details={"message_id": message_id, "error": str(e)},
            ) from e

    async def get_messages(self, query: MessageQuery | None = None) -> list[CoordinationMessage]:
        """Query messages with optional filters.

        Supports filtering by:
        - to_instance: Messages sent to a specific instance
        - from_instance: Messages sent from a specific instance
        - msg_type: Messages of a specific type
        - pending_only: Only unacknowledged messages
        - since: Messages after a specific timestamp
        - limit: Maximum number of results

        Args:
            query: Optional MessageQuery with filter parameters.
                   If not provided, returns recent messages up to default limit.

        Returns:
            List of CoordinationMessage objects sorted by timestamp (newest first)

        Example:
            >>> query = MessageQuery(
            ...     to_instance="orchestrator",
            ...     pending_only=True,
            ...     limit=10,
            ... )
            >>> messages = await client.get_messages(query)
            >>> for msg in messages:
            ...     print(f"{msg.id}: {msg.payload.subject}")
        """
        query = query or MessageQuery()

        self._log_operation(
            "get_messages",
            to_instance=query.to_instance,
            from_instance=query.from_instance,
            msg_type=query.msg_type.value if query.msg_type else None,
            pending_only=query.pending_only,
            limit=query.limit,
        )

        try:
            # Start with candidate message IDs
            message_ids: set[str] | None = None

            # If filtering by to_instance, use the inbox set
            if query.to_instance:
                inbox_key = self._config.inbox_key(query.to_instance)
                inbox_ids = await self._redis.smembers(inbox_key)
                message_ids = set(inbox_ids) if inbox_ids else set()

            # If filtering by pending_only, intersect with pending set
            if query.pending_only:
                pending_key = self._config.pending_key()
                pending_ids = await self._redis.smembers(pending_key)
                pending_set = set(pending_ids) if pending_ids else set()
                if message_ids is not None:
                    message_ids = message_ids.intersection(pending_set)
                else:
                    message_ids = pending_set

            # If no inbox/pending filter, use timeline
            if message_ids is None:
                timeline_key = self._config.timeline_key()
                if query.since:
                    since_score = query.since.timestamp()
                    timeline_ids = await self._redis.zrangebyscore(
                        timeline_key,
                        min=since_score,
                        max="+inf",
                    )
                else:
                    # Get from timeline (most recent)
                    timeline_ids = await self._redis.zrevrange(
                        timeline_key,
                        0,
                        query.limit * 2 - 1,  # Fetch extra for filtering
                    )
                message_ids = set(timeline_ids) if timeline_ids else set()

            # Fetch message data for each ID
            messages: list[CoordinationMessage] = []
            for msg_id in message_ids:
                msg_key = self._config.message_key(msg_id)
                msg_hash = await self._redis.hgetall(msg_key)
                if not msg_hash:
                    continue  # Message expired or deleted

                msg = self._hash_to_message(msg_hash)

                # Apply additional filters
                if query.from_instance and msg.from_instance != query.from_instance:
                    continue
                if query.msg_type and msg.type != query.msg_type:
                    continue
                if query.since and msg.timestamp < query.since:
                    continue

                messages.append(msg)

            # Sort by timestamp (newest first)
            messages.sort(key=lambda m: m.timestamp, reverse=True)

            # Apply limit
            return messages[: query.limit]

        except redis.RedisError as e:
            logger.error(f"Failed to query messages: {e}")
            raise CoordinationError(
                f"Failed to query messages: {e}",
                details={"error": str(e)},
            ) from e

    def _hash_to_message(self, msg_hash: dict[str, str]) -> CoordinationMessage:
        """Convert a Redis hash to a CoordinationMessage.

        Args:
            msg_hash: Dictionary from Redis hgetall

        Returns:
            CoordinationMessage instance
        """
        # Parse ack fields if present
        ack_by = msg_hash.get("ack_by")
        ack_timestamp_str = msg_hash.get("ack_timestamp")
        ack_comment = msg_hash.get("ack_comment")

        # Build the message dict in the format CoordinationMessage.from_dict expects
        msg_dict = {
            "id": msg_hash["id"],
            "type": msg_hash["type"],
            "from": msg_hash["from"],
            "to": msg_hash["to"],
            "timestamp": msg_hash["timestamp"],
            "requires_ack": msg_hash.get("requires_ack", "1") == "1",
            "acknowledged": msg_hash.get("acknowledged", "0") == "1",
            "payload": {
                "subject": msg_hash.get("subject", ""),
                "description": msg_hash.get("description", ""),
            },
        }

        if ack_by:
            msg_dict["ack_by"] = ack_by
        if ack_timestamp_str:
            msg_dict["ack_timestamp"] = ack_timestamp_str
        if ack_comment:
            msg_dict["ack_comment"] = ack_comment

        return CoordinationMessage.from_dict(msg_dict)

    async def acknowledge_message(
        self,
        message_id: str,
        ack_by: str,
        comment: str | None = None,
    ) -> bool:
        """Acknowledge a coordination message.

        Updates the message to mark it as acknowledged and removes it
        from the pending set. This operation is idempotent - acknowledging
        an already-acknowledged message returns True without error.

        Args:
            message_id: The message ID to acknowledge
            ack_by: The instance acknowledging the message
            comment: Optional comment for the acknowledgment

        Returns:
            True if message was acknowledged (or already was), False if not found

        Raises:
            AcknowledgeError: If acknowledgment fails due to Redis error

        Example:
            >>> success = await client.acknowledge_message(
            ...     message_id="msg-abc123",
            ...     ack_by="orchestrator",
            ...     comment="Reviewed and approved",
            ... )
            >>> if success:
            ...     print("Message acknowledged")
        """
        msg_key = self._config.message_key(message_id)
        pending_key = self._config.pending_key()
        ack_timestamp = datetime.now(UTC)

        self._log_operation(
            "acknowledge_message",
            level=logging.INFO,
            message_id=message_id,
            ack_by=ack_by,
        )

        try:
            # Check if message exists
            exists = await self._redis.exists(msg_key)
            if not exists:
                logger.warning(f"Message not found for acknowledgment: {message_id}")
                return False

            # Check if already acknowledged (idempotent)
            current_ack = await self._redis.hget(msg_key, "acknowledged")
            if current_ack == "1":
                logger.debug(f"Message already acknowledged: {message_id}")
                return True

            # Build ack update
            ack_data = {
                "acknowledged": "1",
                "ack_by": ack_by,
                "ack_timestamp": ack_timestamp.strftime("%Y-%m-%dT%H:%M:%SZ"),
            }
            if comment:
                ack_data["ack_comment"] = comment

            # Execute atomic update
            async with self._redis.pipeline(transaction=True) as pipe:
                # Update message hash with ack fields
                pipe.hset(msg_key, mapping=ack_data)

                # Remove from pending set
                pipe.srem(pending_key, message_id)

                await pipe.execute()

            logger.info(f"Acknowledged message {message_id} by {ack_by}")
            return True

        except redis.RedisError as e:
            logger.error(f"Failed to acknowledge message {message_id}: {e}")
            raise AcknowledgeError(
                f"Failed to acknowledge message: {e}",
                details={"message_id": message_id, "error": str(e)},
            ) from e

    async def subscribe_notifications(
        self,
        instance_id: str,
        callback: Callable[[NotificationEvent], Coroutine[Any, Any, None]],
        include_broadcast: bool = True,
    ) -> asyncio.Task:
        """Subscribe to real-time notifications for an instance.

        Subscribes to the instance-specific channel and optionally the
        broadcast channel. Invokes the callback when notifications arrive.

        Args:
            instance_id: Instance ID to subscribe for
            callback: Async callback function to invoke on notification
            include_broadcast: Whether to also subscribe to broadcast channel

        Returns:
            asyncio.Task: The subscription task (can be cancelled to unsubscribe)

        Example:
            >>> async def handle_notification(event: NotificationEvent):
            ...     print(f"Received: {event.message_id}")
            >>> task = await client.subscribe_notifications("backend", handle_notification)
            >>> # ... later
            >>> task.cancel()  # Unsubscribe
        """
        instance_channel = self._config.instance_channel(instance_id)
        broadcast_channel = self._config.broadcast_channel()

        channels = [instance_channel]
        if include_broadcast:
            channels.append(broadcast_channel)

        self._log_operation(
            "subscribe_notifications",
            instance_id=instance_id,
            channels=channels,
        )

        async def _listener() -> None:
            """Internal listener coroutine."""
            pubsub = self._redis.pubsub()
            try:
                await pubsub.subscribe(*channels)
                logger.info(f"Subscribed to channels: {channels}")

                async for message in pubsub.listen():
                    if message["type"] == "message":
                        try:
                            data = message["data"]
                            if isinstance(data, bytes):
                                data = data.decode("utf-8")
                            event_dict = json.loads(data)

                            event = NotificationEvent(
                                event=event_dict.get("event", "message_published"),
                                message_id=event_dict["message_id"],
                                msg_type=MessageType(event_dict["type"]),
                                from_instance=event_dict["from"],
                                to_instance=event_dict["to"],
                                requires_ack=event_dict["requires_ack"],
                                timestamp=datetime.fromisoformat(
                                    event_dict["timestamp"].replace("Z", "+00:00")
                                ),
                            )

                            await callback(event)
                        except Exception as e:
                            logger.error(f"Error processing notification: {e}")

            except asyncio.CancelledError:
                logger.info(f"Subscription cancelled for {instance_id}")
                raise
            except redis.ConnectionError as e:
                logger.error(f"Connection lost in subscription: {e}")
                raise
            finally:
                await pubsub.unsubscribe(*channels)
                await pubsub.close()

        task = asyncio.create_task(_listener())
        return task

    async def register_instance(
        self,
        instance_id: str,
        session_id: str | None = None,
    ) -> None:
        """Register an instance as active.

        Adds the instance to the presence hash with current timestamp.

        Args:
            instance_id: Instance ID to register
            session_id: Optional session identifier

        Raises:
            PresenceError: If registration fails
        """
        presence_key = self._config.presence_key()
        now = datetime.now(UTC)

        presence_data = {
            f"{instance_id}.active": "1",
            f"{instance_id}.last_heartbeat": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
        if session_id:
            presence_data[f"{instance_id}.session_id"] = session_id

        self._log_operation(
            "register_instance",
            instance_id=instance_id,
            session_id=session_id,
        )

        try:
            await self._redis.hset(presence_key, mapping=presence_data)
            logger.info(f"Registered instance: {instance_id}")
        except redis.RedisError as e:
            logger.error(f"Failed to register instance {instance_id}: {e}")
            raise PresenceError(
                f"Failed to register instance: {e}",
                details={"instance_id": instance_id, "error": str(e)},
            ) from e

    async def heartbeat(self, instance_id: str) -> None:
        """Update instance heartbeat timestamp.

        Args:
            instance_id: Instance ID to heartbeat

        Raises:
            PresenceError: If heartbeat fails
        """
        presence_key = self._config.presence_key()
        now = datetime.now(UTC)

        try:
            await self._redis.hset(
                presence_key,
                f"{instance_id}.last_heartbeat",
                now.strftime("%Y-%m-%dT%H:%M:%SZ"),
            )
            logger.debug(f"Heartbeat for instance: {instance_id}")
        except redis.RedisError as e:
            logger.error(f"Failed to heartbeat for {instance_id}: {e}")
            raise PresenceError(
                f"Failed to update heartbeat: {e}",
                details={"instance_id": instance_id, "error": str(e)},
            ) from e

    async def unregister_instance(self, instance_id: str) -> None:
        """Unregister an instance.

        Removes the instance from the presence hash.

        Args:
            instance_id: Instance ID to unregister

        Raises:
            PresenceError: If unregistration fails
        """
        presence_key = self._config.presence_key()

        self._log_operation("unregister_instance", instance_id=instance_id)

        try:
            # Remove all fields for this instance
            await self._redis.hdel(
                presence_key,
                f"{instance_id}.active",
                f"{instance_id}.last_heartbeat",
                f"{instance_id}.session_id",
            )
            logger.info(f"Unregistered instance: {instance_id}")
        except redis.RedisError as e:
            logger.error(f"Failed to unregister instance {instance_id}: {e}")
            raise PresenceError(
                f"Failed to unregister instance: {e}",
                details={"instance_id": instance_id, "error": str(e)},
            ) from e

    async def get_presence(
        self,
        timeout_minutes: int | None = None,
    ) -> dict[str, PresenceInfo]:
        """Get presence information for all registered instances.

        Args:
            timeout_minutes: Minutes before instance is considered stale.
                           Uses config default if not provided.

        Returns:
            Dict mapping instance ID to PresenceInfo

        Raises:
            PresenceError: If query fails
        """
        presence_key = self._config.presence_key()
        timeout = timeout_minutes or self._config.presence_timeout_minutes

        self._log_operation("get_presence")

        try:
            presence_data = await self._redis.hgetall(presence_key)

            # Group fields by instance
            # Use rsplit to handle instance IDs that contain dots (e.g., timestamps)
            instances: dict[str, dict[str, str]] = {}
            for key, value in presence_data.items():
                parts = key.rsplit(".", 1)  # Split from right to handle dots in instance IDs
                if len(parts) == 2:
                    instance_id, field = parts
                    if instance_id not in instances:
                        instances[instance_id] = {}
                    instances[instance_id][field] = value

            # Build PresenceInfo objects
            result: dict[str, PresenceInfo] = {}
            for instance_id, fields in instances.items():
                last_hb_str = fields.get("last_heartbeat", "")
                if last_hb_str:
                    last_hb = datetime.fromisoformat(
                        last_hb_str.replace("Z", "+00:00")
                    )
                else:
                    last_hb = datetime.now(UTC)

                presence = PresenceInfo(
                    instance_id=instance_id,
                    active=fields.get("active", "0") == "1",
                    last_heartbeat=last_hb,
                    session_id=fields.get("session_id"),
                )

                # Mark as inactive if stale
                if presence.is_stale(timeout):
                    presence = PresenceInfo(
                        instance_id=presence.instance_id,
                        active=False,
                        last_heartbeat=presence.last_heartbeat,
                        session_id=presence.session_id,
                    )

                result[instance_id] = presence

            return result

        except redis.RedisError as e:
            logger.error(f"Failed to get presence: {e}")
            raise PresenceError(
                f"Failed to get presence: {e}",
                details={"error": str(e)},
            ) from e

    async def get_stats(self) -> CoordinationStats:
        """Get coordination system statistics.

        Returns:
            CoordinationStats with message counts and instance info

        Raises:
            CoordinationError: If query fails
        """
        self._log_operation("get_stats")

        try:
            # Get counts from various keys
            timeline_key = self._config.timeline_key()
            pending_key = self._config.pending_key()

            async with self._redis.pipeline(transaction=False) as pipe:
                pipe.zcard(timeline_key)  # Total messages in timeline
                pipe.scard(pending_key)  # Pending messages
                results = await pipe.execute()

            total_messages = results[0] or 0
            pending_messages = results[1] or 0

            # Get presence info for active instances
            presence = await self.get_presence()
            active_instances = [
                info.instance_id for info in presence.values() if info.active
            ]

            # For messages by type, we'd need to scan all messages
            # This is a simplified version that returns empty dict
            # A full implementation would track this in a separate hash
            messages_by_type: dict[str, int] = {}

            return CoordinationStats(
                total_messages=total_messages,
                pending_messages=pending_messages,
                messages_by_type=messages_by_type,
                active_instances=len(active_instances),
                instance_names=active_instances,
            )

        except redis.RedisError as e:
            logger.error(f"Failed to get stats: {e}")
            raise CoordinationError(
                f"Failed to get stats: {e}",
                details={"error": str(e)},
            ) from e

    async def queue_notification(
        self,
        instance_id: str,
        notification: NotificationEvent,
    ) -> bool:
        """Queue a notification for an offline instance.

        Uses a Redis LIST to store notifications for instances that are
        not currently online. When the instance starts, it can retrieve
        these notifications using pop_notifications().

        Args:
            instance_id: Target instance ID to queue notification for
            notification: NotificationEvent to queue

        Returns:
            True if notification was queued successfully

        Raises:
            CoordinationError: If queuing fails
        """
        queue_key = self._config.notification_queue_key(instance_id)

        self._log_operation(
            "queue_notification",
            instance_id=instance_id,
            message_id=notification.message_id,
        )

        try:
            async with self._redis.pipeline(transaction=True) as pipe:
                # Push to left of list (newest first)
                pipe.lpush(queue_key, notification.to_json())
                # Set TTL matching message TTL
                pipe.expire(queue_key, self._config.message_ttl_seconds)
                await pipe.execute()

            logger.debug(
                f"Queued notification for {instance_id}: {notification.message_id}"
            )
            return True

        except redis.RedisError as e:
            logger.error(f"Failed to queue notification for {instance_id}: {e}")
            raise CoordinationError(
                f"Failed to queue notification: {e}",
                details={"instance_id": instance_id, "error": str(e)},
            ) from e

    async def pop_notifications(
        self,
        instance_id: str,
        limit: int = 100,
    ) -> list[NotificationEvent]:
        """Pop pending notifications for an instance.

        Retrieves and removes all pending notifications from the queue.
        This is an atomic operation using LRANGE + DELETE.

        Args:
            instance_id: Instance ID to get notifications for
            limit: Maximum number of notifications to retrieve

        Returns:
            List of NotificationEvent objects (newest first)

        Raises:
            CoordinationError: If retrieval fails
        """
        queue_key = self._config.notification_queue_key(instance_id)

        self._log_operation(
            "pop_notifications",
            instance_id=instance_id,
            limit=limit,
        )

        try:
            # Use pipeline for atomic read and delete
            async with self._redis.pipeline(transaction=True) as pipe:
                # Get all notifications (up to limit)
                pipe.lrange(queue_key, 0, limit - 1)
                # Delete the entire queue
                pipe.delete(queue_key)
                results = await pipe.execute()

            notification_jsons = results[0] or []

            # Parse notifications
            notifications: list[NotificationEvent] = []
            for json_str in notification_jsons:
                try:
                    notification = NotificationEvent.from_json(json_str)
                    notifications.append(notification)
                except (ValueError, KeyError) as e:
                    logger.warning(f"Failed to parse notification: {e}")
                    continue

            logger.debug(
                f"Popped {len(notifications)} notifications for {instance_id}"
            )
            return notifications

        except redis.RedisError as e:
            logger.error(f"Failed to pop notifications for {instance_id}: {e}")
            raise CoordinationError(
                f"Failed to pop notifications: {e}",
                details={"instance_id": instance_id, "error": str(e)},
            ) from e
