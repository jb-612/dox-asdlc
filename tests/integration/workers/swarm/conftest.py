"""Shared fixtures for Parallel Review Swarm integration tests.

Provides common fixtures for Redis clients, configuration, and test data
used across swarm integration tests.
"""

from __future__ import annotations

import asyncio
import os
import uuid
from datetime import UTC, datetime
from typing import AsyncGenerator

import pytest
import redis.asyncio as redis

from src.workers.swarm.config import SwarmConfig
from src.workers.swarm.models import (
    ReviewerResult,
    ReviewFinding,
    Severity,
    SwarmSession,
    SwarmStatus,
)
from src.workers.swarm.redis_store import SwarmRedisStore
from src.workers.swarm.session import SwarmSessionManager


def redis_available() -> bool:
    """Check if Redis is available for integration tests.

    Returns:
        True if Redis is reachable, False otherwise.
    """
    host = os.environ.get("REDIS_HOST", "localhost")
    port = int(os.environ.get("REDIS_PORT", 6379))
    try:
        # Use synchronous Redis client for the check
        import redis as sync_redis
        r = sync_redis.Redis(host=host, port=port)
        r.ping()
        r.close()
        return True
    except Exception:
        return False


# Skip all tests in this module if Redis is not available
pytestmark = pytest.mark.skipif(
    not redis_available(),
    reason="Redis not available for integration tests",
)


@pytest.fixture(scope="module")
def event_loop():
    """Create an event loop for the test module.

    This fixture provides a module-scoped event loop for async tests.
    """
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def test_prefix() -> str:
    """Generate unique prefix for test isolation.

    Returns:
        Unique prefix string to prevent key collisions between test runs.
    """
    return f"swarm_test_{uuid.uuid4().hex[:8]}"


@pytest.fixture
def config(test_prefix: str) -> SwarmConfig:
    """Create test configuration with unique prefix.

    Args:
        test_prefix: Unique prefix for Redis keys.

    Returns:
        SwarmConfig instance configured for testing.
    """
    return SwarmConfig(
        key_prefix=test_prefix,
        result_ttl_seconds=60,  # Short TTL for tests
        task_timeout_seconds=5,  # Short timeout for tests
        aggregate_timeout_seconds=5,
        max_concurrent_swarms=5,
        default_reviewers=["security", "performance", "style"],
    )


@pytest.fixture
async def redis_client(config: SwarmConfig) -> AsyncGenerator[redis.Redis, None]:
    """Create async Redis client for tests.

    Args:
        config: Swarm configuration with key prefix.

    Yields:
        Async Redis client instance.
    """
    host = os.environ.get("REDIS_HOST", "localhost")
    port = int(os.environ.get("REDIS_PORT", 6379))
    db = 15  # Use test database

    client = redis.Redis(host=host, port=port, db=db, decode_responses=True)

    try:
        # Verify connection
        await client.ping()
    except Exception:
        pytest.skip("Redis not available")

    yield client

    # Cleanup: delete all test keys
    keys = await client.keys(f"{config.key_prefix}:*")
    if keys:
        await client.delete(*keys)
    await client.aclose()


@pytest.fixture
async def store(
    redis_client: redis.Redis, config: SwarmConfig
) -> SwarmRedisStore:
    """Create SwarmRedisStore instance for tests.

    Args:
        redis_client: Async Redis client.
        config: Swarm configuration.

    Returns:
        SwarmRedisStore instance.
    """
    return SwarmRedisStore(redis_client, config)


@pytest.fixture
async def session_manager(
    store: SwarmRedisStore, config: SwarmConfig
) -> SwarmSessionManager:
    """Create SwarmSessionManager instance for tests.

    Args:
        store: SwarmRedisStore instance.
        config: Swarm configuration.

    Returns:
        SwarmSessionManager instance.
    """
    return SwarmSessionManager(store, config)


@pytest.fixture
def sample_session(config: SwarmConfig) -> SwarmSession:
    """Create a sample swarm session for testing.

    Args:
        config: Swarm configuration for defaults.

    Returns:
        SwarmSession instance with test data.
    """
    return SwarmSession(
        id=f"swarm-{uuid.uuid4().hex[:8]}",
        target_path="src/workers/",
        reviewers=config.default_reviewers,
        status=SwarmStatus.PENDING,
        created_at=datetime.now(UTC),
        completed_at=None,
        results={},
        unified_report=None,
    )


@pytest.fixture
def sample_finding() -> ReviewFinding:
    """Create a sample review finding for testing.

    Returns:
        ReviewFinding instance with test data.
    """
    return ReviewFinding(
        id=f"finding-{uuid.uuid4().hex[:8]}",
        reviewer_type="security",
        severity=Severity.HIGH,
        category="injection",
        title="SQL Injection Vulnerability",
        description="Potential SQL injection in database query",
        file_path="src/db/queries.py",
        line_start=42,
        line_end=45,
        code_snippet="cursor.execute(f'SELECT * FROM {table}')",
        recommendation="Use parameterized queries instead",
        confidence=0.9,
    )


@pytest.fixture
def sample_result(sample_finding: ReviewFinding) -> ReviewerResult:
    """Create a sample reviewer result for testing.

    Args:
        sample_finding: Sample finding to include in result.

    Returns:
        ReviewerResult instance with test data.
    """
    return ReviewerResult(
        reviewer_type="security",
        status="success",
        findings=[sample_finding],
        duration_seconds=15.5,
        files_reviewed=["src/db/queries.py", "src/api/handlers.py"],
        error_message=None,
    )


def make_result(
    reviewer_type: str,
    status: str = "success",
    findings: list[ReviewFinding] | None = None,
    duration: float = 10.0,
    error: str | None = None,
) -> ReviewerResult:
    """Factory function to create ReviewerResult instances.

    Args:
        reviewer_type: Type of the reviewer (e.g., "security").
        status: Result status ("success", "failed", "timeout").
        findings: List of findings (defaults to empty).
        duration: Duration in seconds.
        error: Error message if status is not "success".

    Returns:
        ReviewerResult instance.
    """
    return ReviewerResult(
        reviewer_type=reviewer_type,
        status=status,
        findings=findings or [],
        duration_seconds=duration,
        files_reviewed=["src/test.py"],
        error_message=error,
    )


def make_finding(
    reviewer_type: str = "security",
    severity: Severity = Severity.MEDIUM,
    category: str = "test",
    title: str = "Test Finding",
    file_path: str = "src/test.py",
    line_start: int = 10,
) -> ReviewFinding:
    """Factory function to create ReviewFinding instances.

    Args:
        reviewer_type: Type of reviewer that found this.
        severity: Severity level.
        category: Finding category.
        title: Brief title.
        file_path: Path to the file.
        line_start: Starting line number.

    Returns:
        ReviewFinding instance.
    """
    return ReviewFinding(
        id=f"finding-{uuid.uuid4().hex[:8]}",
        reviewer_type=reviewer_type,
        severity=severity,
        category=category,
        title=title,
        description=f"Description for {title}",
        file_path=file_path,
        line_start=line_start,
        line_end=line_start + 5,
        code_snippet="# sample code",
        recommendation="Fix this issue",
        confidence=0.85,
    )
