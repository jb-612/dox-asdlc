"""Configuration for CLI coordination system."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import ClassVar


@dataclass(frozen=True)
class CoordinationConfig:
    """Configuration for the coordination system.

    Attributes:
        redis_host: Redis server hostname
        redis_port: Redis server port
        redis_db: Redis database number
        key_prefix: Prefix for all coordination keys
        message_ttl_days: Message TTL in days
        presence_timeout_minutes: Timeout for presence staleness
        timeline_max_size: Maximum messages in timeline
    """

    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0
    key_prefix: str = "coord"
    message_ttl_days: int = 30
    presence_timeout_minutes: int = 5
    timeline_max_size: int = 1000

    # Redis key patterns (class variables)
    KEY_MESSAGE: ClassVar[str] = "{prefix}:msg:{id}"
    KEY_TIMELINE: ClassVar[str] = "{prefix}:timeline"
    KEY_INBOX: ClassVar[str] = "{prefix}:inbox:{instance}"
    KEY_PENDING: ClassVar[str] = "{prefix}:pending"
    KEY_PRESENCE: ClassVar[str] = "{prefix}:presence"

    # Pub/sub channel patterns
    CHANNEL_INSTANCE: ClassVar[str] = "{prefix}:notify:{instance}"
    CHANNEL_BROADCAST: ClassVar[str] = "{prefix}:notify:all"

    # Notification queue pattern (for offline instances)
    KEY_NOTIFICATION_QUEUE: ClassVar[str] = "{prefix}:notifications:{instance}"

    @classmethod
    def from_env(cls) -> CoordinationConfig:
        """Create configuration from environment variables.

        Environment variables:
            REDIS_HOST: Redis hostname (default: localhost)
            REDIS_PORT: Redis port (default: 6379)
            REDIS_DB: Redis database (default: 0)
            COORD_KEY_PREFIX: Key prefix (default: coord)
            COORD_MESSAGE_TTL_DAYS: Message TTL (default: 30)
            COORD_PRESENCE_TIMEOUT_MINUTES: Presence timeout (default: 5)
            COORD_TIMELINE_MAX_SIZE: Max timeline size (default: 1000)

        Returns:
            CoordinationConfig instance
        """
        return cls(
            redis_host=os.getenv("REDIS_HOST", "localhost"),
            redis_port=int(os.getenv("REDIS_PORT", "6379")),
            redis_db=int(os.getenv("REDIS_DB", "0")),
            key_prefix=os.getenv("COORD_KEY_PREFIX", "coord"),
            message_ttl_days=int(os.getenv("COORD_MESSAGE_TTL_DAYS", "30")),
            presence_timeout_minutes=int(os.getenv("COORD_PRESENCE_TIMEOUT_MINUTES", "5")),
            timeline_max_size=int(os.getenv("COORD_TIMELINE_MAX_SIZE", "1000")),
        )

    @property
    def message_ttl_seconds(self) -> int:
        """Get message TTL in seconds."""
        return self.message_ttl_days * 24 * 60 * 60

    def message_key(self, message_id: str) -> str:
        """Get Redis key for a message.

        Args:
            message_id: Message identifier

        Returns:
            Redis key string
        """
        return self.KEY_MESSAGE.format(prefix=self.key_prefix, id=message_id)

    def inbox_key(self, instance_id: str) -> str:
        """Get Redis key for instance inbox.

        Args:
            instance_id: CLI instance identifier

        Returns:
            Redis key string
        """
        return self.KEY_INBOX.format(prefix=self.key_prefix, instance=instance_id)

    def timeline_key(self) -> str:
        """Get Redis key for timeline sorted set.

        Returns:
            Redis key string
        """
        return self.KEY_TIMELINE.format(prefix=self.key_prefix)

    def pending_key(self) -> str:
        """Get Redis key for pending acknowledgments set.

        Returns:
            Redis key string
        """
        return self.KEY_PENDING.format(prefix=self.key_prefix)

    def presence_key(self) -> str:
        """Get Redis key for presence hash.

        Returns:
            Redis key string
        """
        return self.KEY_PRESENCE.format(prefix=self.key_prefix)

    def instance_channel(self, instance_id: str) -> str:
        """Get pub/sub channel for instance notifications.

        Args:
            instance_id: CLI instance identifier

        Returns:
            Channel name string
        """
        return self.CHANNEL_INSTANCE.format(prefix=self.key_prefix, instance=instance_id)

    def broadcast_channel(self) -> str:
        """Get pub/sub channel for broadcast notifications.

        Returns:
            Channel name string
        """
        return self.CHANNEL_BROADCAST.format(prefix=self.key_prefix)

    def notification_queue_key(self, instance_id: str) -> str:
        """Get Redis key for instance notification queue.

        Args:
            instance_id: CLI instance identifier

        Returns:
            Redis key string
        """
        return self.KEY_NOTIFICATION_QUEUE.format(
            prefix=self.key_prefix, instance=instance_id
        )


# Global config instance (lazy-loaded)
_config: CoordinationConfig | None = None


def get_coordination_config() -> CoordinationConfig:
    """Get the global coordination configuration.

    Loads from environment variables on first call.

    Returns:
        CoordinationConfig instance
    """
    global _config
    if _config is None:
        _config = CoordinationConfig.from_env()
    return _config


def reset_coordination_config() -> None:
    """Reset the global configuration (for testing)."""
    global _config
    _config = None
