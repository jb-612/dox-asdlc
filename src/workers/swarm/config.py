"""Configuration for Parallel Review Swarm.

This module provides the SwarmConfig Pydantic model and a factory
function to load configuration from environment variables.
"""

from __future__ import annotations

import os
from functools import lru_cache

from pydantic import BaseModel, Field


class SwarmConfig(BaseModel):
    """Configuration for the swarm review system.

    Attributes:
        task_timeout_seconds: Timeout for individual reviewer tasks
        aggregate_timeout_seconds: Timeout for aggregation phase
        max_concurrent_swarms: Maximum number of concurrent swarm sessions
        default_reviewers: Default list of reviewers to use
        key_prefix: Redis key prefix for swarm data
        result_ttl_seconds: TTL for cached results in Redis
        duplicate_similarity_threshold: Threshold for duplicate detection (0.0-1.0)
        allowed_path_prefixes: Allowed path prefixes for review targets
    """

    task_timeout_seconds: int = Field(
        default=300,
        gt=0,
        description="Timeout for individual reviewer tasks in seconds",
    )
    aggregate_timeout_seconds: int = Field(
        default=60,
        gt=0,
        description="Timeout for aggregation phase in seconds",
    )
    max_concurrent_swarms: int = Field(
        default=5,
        gt=0,
        description="Maximum number of concurrent swarm sessions",
    )
    default_reviewers: list[str] = Field(
        default=["security", "performance", "style"],
        description="Default list of reviewers to use",
    )
    key_prefix: str = Field(
        default="swarm",
        description="Redis key prefix for swarm data",
    )
    result_ttl_seconds: int = Field(
        default=86400,
        gt=0,
        description="TTL for cached results in Redis (default: 24 hours)",
    )
    duplicate_similarity_threshold: float = Field(
        default=0.8,
        ge=0.0,
        le=1.0,
        description="Threshold for duplicate detection (0.0-1.0)",
    )
    allowed_path_prefixes: list[str] = Field(
        default=["src/", "docker/", "tests/"],
        description="Allowed path prefixes for review targets",
    )


def _parse_list(value: str) -> list[str]:
    """Parse a comma-separated string into a list.

    Args:
        value: Comma-separated string

    Returns:
        List of strings, stripped of whitespace
    """
    return [item.strip() for item in value.split(",") if item.strip()]


@lru_cache(maxsize=1)
def get_swarm_config() -> SwarmConfig:
    """Get swarm configuration from environment variables.

    Environment variables use SWARM_ prefix:
        - SWARM_TASK_TIMEOUT_SECONDS
        - SWARM_AGGREGATE_TIMEOUT_SECONDS
        - SWARM_MAX_CONCURRENT_SWARMS
        - SWARM_DEFAULT_REVIEWERS (comma-separated)
        - SWARM_KEY_PREFIX
        - SWARM_RESULT_TTL_SECONDS
        - SWARM_DUPLICATE_SIMILARITY_THRESHOLD
        - SWARM_ALLOWED_PATH_PREFIXES (comma-separated)

    Returns:
        SwarmConfig instance

    Raises:
        ValueError: If environment variable values are invalid
    """
    config_kwargs: dict = {}

    # Integer fields
    int_fields = [
        ("SWARM_TASK_TIMEOUT_SECONDS", "task_timeout_seconds"),
        ("SWARM_AGGREGATE_TIMEOUT_SECONDS", "aggregate_timeout_seconds"),
        ("SWARM_MAX_CONCURRENT_SWARMS", "max_concurrent_swarms"),
        ("SWARM_RESULT_TTL_SECONDS", "result_ttl_seconds"),
    ]

    for env_var, field_name in int_fields:
        value = os.environ.get(env_var)
        if value is not None:
            try:
                config_kwargs[field_name] = int(value)
            except ValueError as e:
                raise ValueError(
                    f"Invalid integer value for {env_var}: {value}"
                ) from e

    # Float fields
    float_value = os.environ.get("SWARM_DUPLICATE_SIMILARITY_THRESHOLD")
    if float_value is not None:
        try:
            config_kwargs["duplicate_similarity_threshold"] = float(float_value)
        except ValueError as e:
            raise ValueError(
                f"Invalid float value for SWARM_DUPLICATE_SIMILARITY_THRESHOLD: {float_value}"
            ) from e

    # String field
    key_prefix = os.environ.get("SWARM_KEY_PREFIX")
    if key_prefix is not None:
        config_kwargs["key_prefix"] = key_prefix

    # List fields (comma-separated)
    reviewers = os.environ.get("SWARM_DEFAULT_REVIEWERS")
    if reviewers is not None:
        config_kwargs["default_reviewers"] = _parse_list(reviewers)

    path_prefixes = os.environ.get("SWARM_ALLOWED_PATH_PREFIXES")
    if path_prefixes is not None:
        config_kwargs["allowed_path_prefixes"] = _parse_list(path_prefixes)

    return SwarmConfig(**config_kwargs)
