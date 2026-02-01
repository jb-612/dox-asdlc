"""Secrets helper for worker agents.

Provides convenient async and sync functions for workers to fetch secrets
from the centralized secrets backend (Infisical, GCP, or env vars).

Usage:
    # Async usage (preferred)
    api_key = await get_secret("ANTHROPIC_API_KEY")

    # Sync usage (for non-async contexts)
    api_key = get_secret_sync("ANTHROPIC_API_KEY")

    # Get multiple secrets at once
    secrets = await get_multiple_secrets(["SLACK_BOT_TOKEN", "ANTHROPIC_API_KEY"])
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Optional

from src.infrastructure.secrets.client import get_secrets_client

logger = logging.getLogger(__name__)


async def get_secret(
    name: str,
    environment: str = "dev",
    fallback_to_env: bool = True,
) -> Optional[str]:
    """Get a secret value from the secrets backend.

    Attempts to fetch the secret from the configured secrets backend
    (Infisical, GCP Secret Manager, or env vars). If not found and
    fallback_to_env is True, checks environment variables as fallback.

    Args:
        name: Secret name (e.g., "ANTHROPIC_API_KEY")
        environment: Environment scope (dev, staging, prod)
        fallback_to_env: If True, check env vars if secret not in backend

    Returns:
        Secret value or None if not found

    Example:
        api_key = await get_secret("ANTHROPIC_API_KEY")
        if api_key:
            client = anthropic.Client(api_key=api_key)
    """
    try:
        client = get_secrets_client()
        value = await client.get_secret(name, environment)

        if value:
            return value

        # Fallback to environment variable
        if fallback_to_env:
            env_value = os.environ.get(name)
            if env_value:
                logger.debug(f"Secret '{name}' not in backend, using env var")
                return env_value

        return None

    except Exception as e:
        logger.warning(f"Failed to get secret '{name}' from backend: {e}")

        # Try environment variable fallback
        if fallback_to_env:
            env_value = os.environ.get(name)
            if env_value:
                logger.info(f"Using env var fallback for '{name}'")
                return env_value

        return None


def get_secret_sync(
    name: str,
    environment: str = "dev",
    fallback_to_env: bool = True,
) -> Optional[str]:
    """Synchronous version of get_secret.

    Use this in non-async contexts where asyncio is not available.
    Internally runs the async function in a new event loop.

    Args:
        name: Secret name
        environment: Environment scope
        fallback_to_env: If True, check env vars if secret not in backend

    Returns:
        Secret value or None if not found

    Example:
        api_key = get_secret_sync("OPENAI_API_KEY")
    """
    try:
        # Check if there's a running event loop
        try:
            loop = asyncio.get_running_loop()
            # Already in an async context, need to use a different approach
            # Create a new thread to run the async function
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(
                    asyncio.run,
                    get_secret(name, environment, fallback_to_env)
                )
                return future.result(timeout=10.0)
        except RuntimeError:
            # No running loop, we can use asyncio.run directly
            return asyncio.run(get_secret(name, environment, fallback_to_env))

    except Exception as e:
        logger.warning(f"Sync get_secret failed for '{name}': {e}")

        # Last resort fallback
        if fallback_to_env:
            return os.environ.get(name)

        return None


async def get_multiple_secrets(
    names: list[str],
    environment: str = "dev",
    fallback_to_env: bool = True,
) -> dict[str, Optional[str]]:
    """Get multiple secrets at once.

    Args:
        names: List of secret names
        environment: Environment scope
        fallback_to_env: If True, check env vars if secrets not in backend

    Returns:
        Dict mapping secret names to values (None if not found)

    Example:
        secrets = await get_multiple_secrets([
            "ANTHROPIC_API_KEY",
            "SLACK_BOT_TOKEN",
        ])
        anthropic_key = secrets["ANTHROPIC_API_KEY"]
        slack_token = secrets["SLACK_BOT_TOKEN"]
    """
    result: dict[str, Optional[str]] = {}

    for name in names:
        value = await get_secret(name, environment, fallback_to_env)
        result[name] = value

    return result


async def require_secret(
    name: str,
    environment: str = "dev",
) -> str:
    """Get a secret value, raising if not found.

    Use this when a secret is required and the application cannot
    proceed without it.

    Args:
        name: Secret name
        environment: Environment scope

    Returns:
        Secret value

    Raises:
        ValueError: If the secret is not found

    Example:
        api_key = await require_secret("ANTHROPIC_API_KEY")
        # Guaranteed to have a value here
    """
    value = await get_secret(name, environment, fallback_to_env=True)

    if not value:
        raise ValueError(
            f"Required secret '{name}' not found in backend or environment"
        )

    return value
