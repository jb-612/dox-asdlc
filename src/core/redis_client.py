"""Async Redis client factory with connection pooling.

Provides a singleton Redis client with proper connection management
and health checking capabilities.
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import redis.asyncio as redis
from redis.asyncio.connection import ConnectionPool

from src.core.config import RedisConfig, get_redis_config
from src.core.exceptions import RedisConnectionError, RedisOperationError

logger = logging.getLogger(__name__)

# Global connection pool and client instances
_pool: ConnectionPool | None = None
_client: redis.Redis | None = None
_lock: asyncio.Lock | None = None


def _get_lock() -> asyncio.Lock:
    """Get or create the module lock (lazy initialization).

    Creating asyncio.Lock at module import time can cause issues when
    the module is imported before an event loop exists. This function
    creates the lock lazily when first needed.
    """
    global _lock
    if _lock is None:
        _lock = asyncio.Lock()
    return _lock


async def get_connection_pool(config: RedisConfig | None = None) -> ConnectionPool:
    """Get or create the connection pool singleton.

    Args:
        config: Optional Redis configuration. Uses environment config if not provided.

    Returns:
        ConnectionPool: The Redis connection pool.

    Raises:
        RedisConnectionError: If pool creation fails.
    """
    global _pool

    if _pool is not None:
        return _pool

    async with _get_lock():
        # Double-check after acquiring lock
        if _pool is not None:
            return _pool

        if config is None:
            config = get_redis_config()

        try:
            _pool = ConnectionPool(
                host=config.host,
                port=config.port,
                db=config.db,
                password=config.password,
                max_connections=config.max_connections,
                socket_timeout=config.socket_timeout,
                socket_connect_timeout=config.socket_connect_timeout,
                retry_on_timeout=config.retry_on_timeout,
                decode_responses=True,
            )
            logger.info(
                f"Created Redis connection pool: {config.host}:{config.port}"
            )
            return _pool
        except Exception as e:
            raise RedisConnectionError(
                f"Failed to create connection pool: {e}",
                details={"host": config.host, "port": config.port},
            ) from e


async def get_redis_client(config: RedisConfig | None = None) -> redis.Redis:
    """Get the Redis client singleton.

    Args:
        config: Optional Redis configuration. Uses environment config if not provided.

    Returns:
        redis.Redis: The async Redis client.

    Raises:
        RedisConnectionError: If client creation fails.
    """
    global _client

    if _client is not None:
        return _client

    # Get pool first (it has its own locking) to avoid deadlock
    pool = await get_connection_pool(config)

    async with _get_lock():
        # Double-check after acquiring lock
        if _client is not None:
            return _client

        _client = redis.Redis(connection_pool=pool)
        return _client


async def close_redis_client() -> None:
    """Close the Redis client and connection pool.

    Should be called during application shutdown.
    """
    global _client, _pool

    async with _get_lock():
        if _client is not None:
            await _client.aclose()
            _client = None
            logger.info("Closed Redis client")

        if _pool is not None:
            await _pool.disconnect()
            _pool = None
            logger.info("Closed Redis connection pool")


@asynccontextmanager
async def redis_client(
    config: RedisConfig | None = None,
) -> AsyncGenerator[redis.Redis, None]:
    """Context manager for Redis client access.

    For use in scripts or tests that need a managed Redis connection.

    Args:
        config: Optional Redis configuration.

    Yields:
        redis.Redis: The async Redis client.

    Example:
        async with redis_client() as client:
            await client.set("key", "value")
    """
    client = await get_redis_client(config)
    try:
        yield client
    finally:
        # Don't close the singleton client in context manager
        # Use close_redis_client() explicitly for cleanup
        pass


async def ping_redis(client: redis.Redis | None = None) -> bool:
    """Check Redis connectivity.

    Args:
        client: Optional Redis client. Creates one if not provided.

    Returns:
        bool: True if Redis is responding, False otherwise.
    """
    try:
        if client is None:
            client = await get_redis_client()
        result = await client.ping()
        return result is True
    except Exception as e:
        logger.warning(f"Redis ping failed: {e}")
        return False


async def check_redis_health(
    client: redis.Redis | None = None,
) -> dict[str, str | bool | dict]:
    """Get detailed Redis health status.

    Args:
        client: Optional Redis client. Creates one if not provided.

    Returns:
        dict: Health status with connection info and status.
    """
    if client is None:
        try:
            client = await get_redis_client()
        except RedisConnectionError as e:
            return {
                "status": "unhealthy",
                "connected": False,
                "error": str(e),
            }

    config = get_redis_config()
    try:
        # Check basic connectivity
        pong = await client.ping()

        # Get server info
        info = await client.info(section="server")

        return {
            "status": "healthy",
            "connected": pong is True,
            "host": config.host,
            "port": config.port,
            "server_version": info.get("redis_version", "unknown"),
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "connected": False,
            "host": config.host,
            "port": config.port,
            "error": str(e),
        }


async def execute_with_retry(
    operation: str,
    func,
    *args,
    max_retries: int = 3,
    retry_delay: float = 0.5,
    **kwargs,
):
    """Execute a Redis operation with retry logic.

    Args:
        operation: Name of the operation for logging.
        func: Async function to execute.
        *args: Positional arguments for func.
        max_retries: Maximum number of retry attempts.
        retry_delay: Delay between retries in seconds.
        **kwargs: Keyword arguments for func.

    Returns:
        The result of the function call.

    Raises:
        RedisOperationError: If all retries fail.
    """
    last_error = None

    for attempt in range(max_retries):
        try:
            return await func(*args, **kwargs)
        except redis.ConnectionError as e:
            last_error = e
            logger.warning(
                f"Redis {operation} failed (attempt {attempt + 1}/{max_retries}): {e}"
            )
            if attempt < max_retries - 1:
                await asyncio.sleep(retry_delay * (attempt + 1))
        except redis.RedisError as e:
            # Non-connection errors should not be retried
            raise RedisOperationError(
                f"Redis {operation} failed: {e}",
                details={"operation": operation},
            ) from e

    raise RedisOperationError(
        f"Redis {operation} failed after {max_retries} retries",
        details={"operation": operation, "last_error": str(last_error)},
    )
