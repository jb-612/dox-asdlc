"""Factory functions for coordination client.

Provides singleton access to CoordinationClient instances
with proper configuration from environment variables.
"""

from __future__ import annotations

import asyncio
import logging

from src.core.redis_client import get_redis_client
from src.infrastructure.coordination.client import CoordinationClient
from src.infrastructure.coordination.config import (
    CoordinationConfig,
    get_coordination_config,
)

logger = logging.getLogger(__name__)

# Global singleton client
_client: CoordinationClient | None = None
_lock: asyncio.Lock | None = None


def _get_lock() -> asyncio.Lock:
    """Get or create the module lock (lazy initialization).

    Creating asyncio.Lock at module import time can cause issues when
    the module is imported before an event loop exists.
    """
    global _lock
    if _lock is None:
        _lock = asyncio.Lock()
    return _lock


async def get_coordination_client(
    instance_id: str | None = None,
    config: CoordinationConfig | None = None,
) -> CoordinationClient:
    """Get the coordination client singleton.

    Creates a new client if one doesn't exist, or returns the existing one.
    The client is configured from environment variables by default.

    Args:
        instance_id: Optional instance ID for this client.
                    If provided on first call, sets the instance ID.
                    Ignored on subsequent calls.
        config: Optional configuration override.
                If not provided, uses environment config.

    Returns:
        CoordinationClient: The async coordination client

    Example:
        >>> client = await get_coordination_client(instance_id="backend")
        >>> await client.publish_message(...)
    """
    global _client

    if _client is not None:
        return _client

    async with _get_lock():
        # Double-check after acquiring lock
        if _client is not None:
            return _client

        # Get configuration
        coord_config = config or get_coordination_config()

        # Get Redis client
        redis_client = await get_redis_client()

        # Create coordination client
        _client = CoordinationClient(
            redis_client=redis_client,
            config=coord_config,
            instance_id=instance_id,
        )

        logger.info(
            f"Created coordination client singleton "
            f"(instance_id={instance_id}, prefix={coord_config.key_prefix})"
        )

        return _client


async def reset_coordination_client() -> None:
    """Reset the coordination client singleton (for testing)."""
    global _client

    async with _get_lock():
        if _client is not None:
            logger.info("Resetting coordination client singleton")
            _client = None


async def get_coordination_client_context(
    instance_id: str | None = None,
) -> CoordinationClient:
    """Get coordination client and enter its context.

    Convenience function that gets the client and verifies connectivity.

    Args:
        instance_id: Optional instance ID for this client

    Returns:
        CoordinationClient: Connected and ready client

    Raises:
        CoordinationError: If connection fails

    Example:
        >>> async with get_coordination_client_context("backend") as client:
        ...     await client.publish_message(...)
    """
    client = await get_coordination_client(instance_id=instance_id)

    # Verify connectivity
    health = await client.health_check()
    if not health["connected"]:
        from src.core.exceptions import CoordinationError

        raise CoordinationError(
            "Coordination client not connected",
            details=health,
        )

    return client
