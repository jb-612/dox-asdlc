"""Redis storage layer for Parallel Review Swarm.

This module provides the SwarmRedisStore class for persisting swarm sessions,
reviewer results, and tracking completion progress in Redis.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime
from typing import TYPE_CHECKING

from src.workers.swarm.config import SwarmConfig
from src.workers.swarm.models import ReviewerResult, SwarmSession, SwarmStatus

if TYPE_CHECKING:
    import redis.asyncio as redis

logger = logging.getLogger(__name__)


class SwarmRedisStore:
    """Redis storage for swarm session data.

    Provides methods for creating, retrieving, and updating swarm sessions,
    storing reviewer results, and tracking completion progress.

    Key patterns:
        - {prefix}:session:{session_id} - Session hash
        - {prefix}:results:{session_id} - Results hash (reviewer -> JSON)
        - {prefix}:progress:{session_id} - Set of completed reviewers

    Attributes:
        _redis: Async Redis client for database operations.
        _config: Swarm configuration with key prefix and TTL settings.

    Example:
        >>> store = SwarmRedisStore(redis_client, config)
        >>> await store.create_session(session)
        >>> await store.store_reviewer_result("swarm-123", "security", result)
        >>> completed = await store.get_completed_reviewers("swarm-123")
    """

    def __init__(self, redis_client: redis.Redis, config: SwarmConfig) -> None:
        """Initialize the SwarmRedisStore.

        Args:
            redis_client: Async Redis client for database operations.
            config: Swarm configuration with key prefix and TTL settings.
        """
        self._redis = redis_client
        self._config = config

    def _session_key(self, session_id: str) -> str:
        """Generate the Redis key for a session hash.

        Args:
            session_id: The unique session identifier.

        Returns:
            Redis key in format {prefix}:session:{session_id}.
        """
        return f"{self._config.key_prefix}:session:{session_id}"

    def _results_key(self, session_id: str) -> str:
        """Generate the Redis key for a results hash.

        Args:
            session_id: The unique session identifier.

        Returns:
            Redis key in format {prefix}:results:{session_id}.
        """
        return f"{self._config.key_prefix}:results:{session_id}"

    def _progress_key(self, session_id: str) -> str:
        """Generate the Redis key for a progress set.

        Args:
            session_id: The unique session identifier.

        Returns:
            Redis key in format {prefix}:progress:{session_id}.
        """
        return f"{self._config.key_prefix}:progress:{session_id}"

    async def create_session(self, session: SwarmSession) -> None:
        """Store a new swarm session in Redis.

        Creates a hash with all session fields and sets a TTL for automatic
        expiration.

        Args:
            session: The SwarmSession to store.

        Raises:
            redis.RedisError: If the Redis operation fails.
        """
        key = self._session_key(session.id)

        # Serialize session fields for Redis hash storage
        mapping = {
            "id": session.id,
            "target_path": session.target_path,
            "reviewers": json.dumps(session.reviewers),
            "status": session.status.value if isinstance(session.status, SwarmStatus) else session.status,
            "created_at": session.created_at.isoformat() if session.created_at else "",
            "completed_at": session.completed_at.isoformat() if session.completed_at else "",
            "results": json.dumps(
                {k: v.model_dump() for k, v in session.results.items()}
            ),
            "unified_report": session.unified_report.model_dump_json() if session.unified_report else "",
        }

        await self._redis.hset(key, mapping=mapping)
        await self._redis.expire(key, self._config.result_ttl_seconds)

        logger.debug(f"Created session {session.id} with TTL {self._config.result_ttl_seconds}s")

    async def get_session(self, session_id: str) -> SwarmSession | None:
        """Retrieve a swarm session from Redis.

        Args:
            session_id: The unique session identifier.

        Returns:
            The SwarmSession if found, None otherwise.

        Raises:
            redis.RedisError: If the Redis operation fails.
        """
        key = self._session_key(session_id)
        data = await self._redis.hgetall(key)

        if not data:
            return None

        # Deserialize session fields from Redis hash
        return SwarmSession(
            id=data["id"],
            target_path=data["target_path"],
            reviewers=json.loads(data["reviewers"]),
            status=SwarmStatus(data["status"]),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else None,
            completed_at=datetime.fromisoformat(data["completed_at"]) if data.get("completed_at") else None,
            results=self._deserialize_results(data.get("results", "{}")),
            unified_report=None,  # TODO: Deserialize unified_report if needed
        )

    def _deserialize_results(self, results_json: str) -> dict[str, ReviewerResult]:
        """Deserialize results dictionary from JSON string.

        Args:
            results_json: JSON string containing results mapping.

        Returns:
            Dictionary mapping reviewer type to ReviewerResult.
        """
        if not results_json:
            return {}

        raw_results = json.loads(results_json)
        return {
            reviewer_type: ReviewerResult.model_validate(result_data)
            for reviewer_type, result_data in raw_results.items()
        }

    async def update_session_status(
        self, session_id: str, status: SwarmStatus
    ) -> None:
        """Update the status of a swarm session.

        Performs an atomic update of the status field in the session hash.

        Args:
            session_id: The unique session identifier.
            status: The new status to set.

        Raises:
            redis.RedisError: If the Redis operation fails.
        """
        key = self._session_key(session_id)
        await self._redis.hset(key, "status", status.value)

        logger.debug(f"Updated session {session_id} status to {status.value}")

    async def store_reviewer_result(
        self, session_id: str, reviewer_type: str, result: ReviewerResult
    ) -> None:
        """Store a reviewer result and mark the reviewer as completed.

        Stores the result JSON in the results hash and adds the reviewer type
        to the progress set. Also sets TTL on the results and progress keys.

        Args:
            session_id: The unique session identifier.
            reviewer_type: The type of reviewer (e.g., "security", "performance").
            result: The ReviewerResult to store.

        Raises:
            redis.RedisError: If the Redis operation fails.
        """
        results_key = self._results_key(session_id)
        progress_key = self._progress_key(session_id)

        # Store result JSON in results hash
        await self._redis.hset(results_key, reviewer_type, result.model_dump_json())

        # Add reviewer to progress set
        await self._redis.sadd(progress_key, reviewer_type)

        # Set TTL on both keys
        await self._redis.expire(results_key, self._config.result_ttl_seconds)
        await self._redis.expire(progress_key, self._config.result_ttl_seconds)

        logger.debug(
            f"Stored result for reviewer {reviewer_type} in session {session_id}"
        )

    async def get_reviewer_result(
        self, session_id: str, reviewer_type: str
    ) -> ReviewerResult | None:
        """Retrieve a single reviewer result from Redis.

        Args:
            session_id: The unique session identifier.
            reviewer_type: The type of reviewer (e.g., "security", "performance").

        Returns:
            The ReviewerResult if found, None otherwise.

        Raises:
            redis.RedisError: If the Redis operation fails.
        """
        results_key = self._results_key(session_id)
        result_json = await self._redis.hget(results_key, reviewer_type)

        if result_json is None:
            return None

        return ReviewerResult.model_validate_json(result_json)

    async def get_all_results(
        self, session_id: str
    ) -> dict[str, ReviewerResult]:
        """Retrieve all reviewer results for a session.

        Args:
            session_id: The unique session identifier.

        Returns:
            Dictionary mapping reviewer type to ReviewerResult.

        Raises:
            redis.RedisError: If the Redis operation fails.
        """
        results_key = self._results_key(session_id)
        all_results = await self._redis.hgetall(results_key)

        return {
            reviewer_type: ReviewerResult.model_validate_json(result_json)
            for reviewer_type, result_json in all_results.items()
        }

    async def get_completed_reviewers(self, session_id: str) -> set[str]:
        """Get the set of reviewers that have completed.

        Args:
            session_id: The unique session identifier.

        Returns:
            Set of reviewer types that have completed.

        Raises:
            redis.RedisError: If the Redis operation fails.
        """
        progress_key = self._progress_key(session_id)
        return await self._redis.smembers(progress_key)

    async def wait_for_completion(
        self,
        session_id: str,
        expected_reviewers: list[str],
        timeout_seconds: int = 300,
        poll_interval: float = 1.0,
    ) -> bool:
        """Wait for all expected reviewers to complete.

        Polls the progress set at the configured interval until all expected
        reviewers are present or the timeout is reached.

        Args:
            session_id: The unique session identifier.
            expected_reviewers: List of reviewer types to wait for.
            timeout_seconds: Maximum time to wait in seconds (default: 300).
            poll_interval: Time between polls in seconds (default: 1.0).

        Returns:
            True if all reviewers completed within the timeout, False otherwise.

        Raises:
            redis.RedisError: If a Redis operation fails.
        """
        expected_set = set(expected_reviewers)
        elapsed = 0.0

        while elapsed < timeout_seconds:
            completed = await self.get_completed_reviewers(session_id)

            if expected_set.issubset(completed):
                logger.debug(
                    f"All reviewers completed for session {session_id} "
                    f"after {elapsed:.1f}s"
                )
                return True

            await asyncio.sleep(poll_interval)
            elapsed += poll_interval

        logger.warning(
            f"Timeout waiting for completion of session {session_id}. "
            f"Expected: {expected_set}, Completed: {completed}"
        )
        return False
