"""Swarm Session Manager for Parallel Review Swarm.

This module provides the SwarmSessionManager class for managing the lifecycle
of swarm review sessions, including creation, retrieval, and status updates.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from src.workers.swarm.config import SwarmConfig
from src.workers.swarm.models import SwarmSession, SwarmStatus

if TYPE_CHECKING:
    from src.workers.swarm.redis_store import SwarmRedisStore


class SwarmSessionManager:
    """Manager for swarm review session lifecycle.

    Provides methods for creating, retrieving, and updating swarm sessions.
    Sessions are persisted to Redis via the SwarmRedisStore.

    Attributes:
        _store: Redis store for session persistence.
        _config: Swarm configuration settings.

    Example:
        >>> manager = SwarmSessionManager(redis_store, config)
        >>> session = await manager.create_session("src/workers/")
        >>> session.id
        'swarm-a1b2c3d4'
    """

    def __init__(self, redis_store: SwarmRedisStore, config: SwarmConfig) -> None:
        """Initialize the SwarmSessionManager.

        Args:
            redis_store: Redis store for session persistence.
            config: Swarm configuration settings.
        """
        self._store = redis_store
        self._config = config

    def _generate_id(self) -> str:
        """Generate a unique session ID in swarm-{uuid8} format.

        Returns:
            A unique session ID string with format 'swarm-{8 hex chars}'.
        """
        return f"swarm-{uuid.uuid4().hex[:8]}"

    async def create_session(
        self,
        target_path: str,
        reviewer_types: list[str] | None = None,
    ) -> SwarmSession:
        """Create a new swarm session and persist to Redis.

        Creates a new session with a unique ID, sets the initial status to
        PENDING, and persists the session to Redis storage.

        Args:
            target_path: Path to the code to be reviewed.
            reviewer_types: List of reviewer types to use. If None or empty,
                defaults to the configured default_reviewers.

        Returns:
            The newly created SwarmSession.
        """
        # Use default reviewers if none specified or empty list
        if not reviewer_types:
            reviewer_types = self._config.default_reviewers

        session = SwarmSession(
            id=self._generate_id(),
            target_path=target_path,
            reviewers=reviewer_types,
            status=SwarmStatus.PENDING,
            created_at=datetime.now(UTC),
            completed_at=None,
            results={},
            unified_report=None,
        )

        await self._store.create_session(session)

        return session

    async def get_session(self, session_id: str) -> SwarmSession | None:
        """Retrieve a session by ID.

        Args:
            session_id: The unique session identifier.

        Returns:
            The SwarmSession if found, None otherwise.
        """
        return await self._store.get_session(session_id)

    async def update_status(
        self,
        session_id: str,
        status: SwarmStatus,
        completed_at: datetime | None = None,
    ) -> None:
        """Update session status and optionally set completion timestamp.

        Args:
            session_id: The unique session identifier.
            status: The new status to set.
            completed_at: Optional completion timestamp. If provided, will also
                update the completed_at field in the session.
        """
        await self._store.update_session_status(session_id, status)

        if completed_at is not None:
            # Update completed_at timestamp
            session_key = f"{self._config.key_prefix}:session:{session_id}"
            await self._store._redis.hset(
                session_key, "completed_at", completed_at.isoformat()
            )
