"""Worker configuration for aSDLC agent workers.

Provides configuration for the worker pool including pool size,
batch processing settings, and timeouts.
"""

from __future__ import annotations

import os
import uuid
from dataclasses import dataclass, field
from functools import lru_cache


def _generate_consumer_name() -> str:
    """Generate a unique consumer name."""
    return f"worker-{uuid.uuid4().hex[:8]}"


@dataclass(frozen=True)
class WorkerConfig:
    """Worker pool configuration.

    Attributes:
        pool_size: Maximum number of concurrent agent executions.
        batch_size: Number of events to read per batch from Redis.
        event_timeout_seconds: Maximum time for agent execution.
        shutdown_timeout_seconds: Time to wait for graceful shutdown.
        consumer_group: Redis consumer group name.
        consumer_name: Unique name for this consumer instance.
    """

    pool_size: int = 4
    batch_size: int = 10
    event_timeout_seconds: int = 300
    shutdown_timeout_seconds: int = 30
    consumer_group: str = "development-handlers"
    consumer_name: str = field(default_factory=_generate_consumer_name)

    def __post_init__(self) -> None:
        """Validate configuration after initialization."""
        if self.pool_size < 1:
            raise ValueError(f"pool_size must be positive, got {self.pool_size}")
        if self.batch_size < 1:
            raise ValueError(f"batch_size must be positive, got {self.batch_size}")
        if self.event_timeout_seconds < 1:
            raise ValueError(
                f"event_timeout_seconds must be positive, got {self.event_timeout_seconds}"
            )
        if self.shutdown_timeout_seconds < 1:
            raise ValueError(
                f"shutdown_timeout_seconds must be positive, got {self.shutdown_timeout_seconds}"
            )

    @classmethod
    def from_env(cls) -> WorkerConfig:
        """Create worker configuration from environment variables.

        Environment Variables:
            WORKER_POOL_SIZE: Maximum concurrent agents (default: 4)
            WORKER_BATCH_SIZE: Events per batch (default: 10)
            WORKER_EVENT_TIMEOUT: Agent timeout in seconds (default: 300)
            WORKER_SHUTDOWN_TIMEOUT: Shutdown timeout in seconds (default: 30)
            WORKER_CONSUMER_GROUP: Redis consumer group (default: development-handlers)
            WORKER_CONSUMER_NAME: Consumer instance name (default: auto-generated)

        Returns:
            WorkerConfig: Configuration loaded from environment.
        """
        consumer_name = os.getenv("WORKER_CONSUMER_NAME")
        if not consumer_name:
            consumer_name = _generate_consumer_name()

        return cls(
            pool_size=int(os.getenv("WORKER_POOL_SIZE", "4")),
            batch_size=int(os.getenv("WORKER_BATCH_SIZE", "10")),
            event_timeout_seconds=int(os.getenv("WORKER_EVENT_TIMEOUT", "300")),
            shutdown_timeout_seconds=int(os.getenv("WORKER_SHUTDOWN_TIMEOUT", "30")),
            consumer_group=os.getenv("WORKER_CONSUMER_GROUP", "development-handlers"),
            consumer_name=consumer_name,
        )


@lru_cache(maxsize=1)
def get_worker_config() -> WorkerConfig:
    """Get the singleton worker configuration.

    Configuration is loaded from environment variables on first call
    and cached for subsequent calls.

    Returns:
        WorkerConfig: The worker configuration singleton.
    """
    return WorkerConfig.from_env()


def clear_worker_config_cache() -> None:
    """Clear the worker configuration cache.

    Call this when testing or when configuration might have changed.
    """
    get_worker_config.cache_clear()
