"""Unit tests for SwarmSessionManager.

Tests for session lifecycle management including creation, retrieval,
and status updates.
"""

from __future__ import annotations

import re
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.workers.swarm.config import SwarmConfig
from src.workers.swarm.models import SwarmSession, SwarmStatus
from src.workers.swarm.redis_store import SwarmRedisStore
from src.workers.swarm.session import SwarmSessionManager


@pytest.fixture
def config() -> SwarmConfig:
    """Create a test configuration."""
    return SwarmConfig(
        key_prefix="test_swarm",
        result_ttl_seconds=3600,
        default_reviewers=["security", "performance", "style"],
    )


@pytest.fixture
def mock_redis() -> AsyncMock:
    """Create a mock async Redis client."""
    mock = AsyncMock()
    mock.hset = AsyncMock(return_value=1)
    mock.hget = AsyncMock(return_value=None)
    mock.hgetall = AsyncMock(return_value={})
    mock.expire = AsyncMock(return_value=True)
    mock.sadd = AsyncMock(return_value=1)
    mock.smembers = AsyncMock(return_value=set())
    mock.pipeline = MagicMock()
    return mock


@pytest.fixture
def redis_store(mock_redis: AsyncMock, config: SwarmConfig) -> SwarmRedisStore:
    """Create a SwarmRedisStore with mock Redis."""
    return SwarmRedisStore(mock_redis, config)


@pytest.fixture
def session_manager(
    redis_store: SwarmRedisStore, config: SwarmConfig
) -> SwarmSessionManager:
    """Create a SwarmSessionManager for testing."""
    return SwarmSessionManager(redis_store, config)


class TestSwarmSessionManagerInit:
    """Tests for SwarmSessionManager initialization."""

    def test_init_with_store_and_config(
        self, redis_store: SwarmRedisStore, config: SwarmConfig
    ) -> None:
        """Test that SwarmSessionManager initializes correctly."""
        manager = SwarmSessionManager(redis_store, config)

        assert manager._store is redis_store
        assert manager._config is config


class TestGenerateId:
    """Tests for SwarmSessionManager._generate_id()."""

    def test_generate_id_format(
        self, session_manager: SwarmSessionManager
    ) -> None:
        """Test that generated ID has swarm-{uuid8} format."""
        session_id = session_manager._generate_id()

        # Should match pattern: swarm-{8 hex chars}
        assert re.match(r"^swarm-[a-f0-9]{8}$", session_id)

    def test_generate_id_unique(
        self, session_manager: SwarmSessionManager
    ) -> None:
        """Test that each generated ID is unique."""
        ids = [session_manager._generate_id() for _ in range(100)]

        # All IDs should be unique
        assert len(set(ids)) == len(ids)


class TestCreateSession:
    """Tests for SwarmSessionManager.create_session()."""

    @pytest.mark.asyncio
    async def test_create_session_returns_session(
        self, session_manager: SwarmSessionManager
    ) -> None:
        """Test that create_session returns a SwarmSession."""
        session = await session_manager.create_session("src/workers/")

        assert isinstance(session, SwarmSession)

    @pytest.mark.asyncio
    async def test_create_session_generates_valid_id(
        self, session_manager: SwarmSessionManager
    ) -> None:
        """Test that create_session generates a valid session ID."""
        session = await session_manager.create_session("src/workers/")

        assert re.match(r"^swarm-[a-f0-9]{8}$", session.id)

    @pytest.mark.asyncio
    async def test_create_session_sets_target_path(
        self, session_manager: SwarmSessionManager
    ) -> None:
        """Test that create_session sets the target path correctly."""
        session = await session_manager.create_session("src/workers/pool/")

        assert session.target_path == "src/workers/pool/"

    @pytest.mark.asyncio
    async def test_create_session_uses_default_reviewers(
        self, session_manager: SwarmSessionManager
    ) -> None:
        """Test that create_session uses default reviewers when none specified."""
        session = await session_manager.create_session("src/workers/")

        assert session.reviewers == ["security", "performance", "style"]

    @pytest.mark.asyncio
    async def test_create_session_uses_custom_reviewers(
        self, session_manager: SwarmSessionManager
    ) -> None:
        """Test that create_session uses custom reviewers when specified."""
        session = await session_manager.create_session(
            "src/workers/",
            reviewer_types=["security", "style"],
        )

        assert session.reviewers == ["security", "style"]

    @pytest.mark.asyncio
    async def test_create_session_sets_pending_status(
        self, session_manager: SwarmSessionManager
    ) -> None:
        """Test that create_session sets status to PENDING."""
        session = await session_manager.create_session("src/workers/")

        assert session.status == SwarmStatus.PENDING

    @pytest.mark.asyncio
    async def test_create_session_sets_created_at(
        self, session_manager: SwarmSessionManager
    ) -> None:
        """Test that create_session sets the created_at timestamp."""
        before = datetime.now(UTC)
        session = await session_manager.create_session("src/workers/")
        after = datetime.now(UTC)

        assert session.created_at is not None
        # created_at should be between before and after
        assert before <= session.created_at <= after

    @pytest.mark.asyncio
    async def test_create_session_persists_to_redis(
        self,
        session_manager: SwarmSessionManager,
        mock_redis: AsyncMock,
    ) -> None:
        """Test that create_session persists the session to Redis."""
        session = await session_manager.create_session("src/workers/")

        # Should have called hset to store the session
        mock_redis.hset.assert_called()
        call_args = mock_redis.hset.call_args
        key = call_args[0][0] if call_args[0] else call_args.kwargs.get("name")
        assert f"test_swarm:session:{session.id}" in str(call_args)

    @pytest.mark.asyncio
    async def test_create_session_with_empty_reviewers_uses_default(
        self, session_manager: SwarmSessionManager
    ) -> None:
        """Test that empty reviewer list uses defaults."""
        session = await session_manager.create_session(
            "src/workers/",
            reviewer_types=[],
        )

        # Empty list should fall back to defaults
        assert session.reviewers == ["security", "performance", "style"]


class TestGetSession:
    """Tests for SwarmSessionManager.get_session()."""

    @pytest.mark.asyncio
    async def test_get_session_returns_none_when_not_found(
        self, session_manager: SwarmSessionManager
    ) -> None:
        """Test that get_session returns None for non-existent session."""
        result = await session_manager.get_session("swarm-nonexistent")

        assert result is None

    @pytest.mark.asyncio
    async def test_get_session_returns_session(
        self,
        session_manager: SwarmSessionManager,
        mock_redis: AsyncMock,
    ) -> None:
        """Test that get_session retrieves a session by ID."""
        # Set up mock to return session data
        mock_redis.hgetall.return_value = {
            "id": "swarm-abc12345",
            "target_path": "src/workers/",
            "reviewers": '["security", "performance"]',
            "status": "IN_PROGRESS",
            "created_at": "2026-01-20T12:00:00+00:00",
            "completed_at": "",
            "results": "{}",
            "unified_report": "",
        }

        result = await session_manager.get_session("swarm-abc12345")

        assert result is not None
        assert result.id == "swarm-abc12345"
        assert result.target_path == "src/workers/"
        assert result.status == SwarmStatus.IN_PROGRESS

    @pytest.mark.asyncio
    async def test_get_session_passes_correct_id(
        self,
        session_manager: SwarmSessionManager,
        redis_store: SwarmRedisStore,
    ) -> None:
        """Test that get_session passes the correct session ID to store."""
        # Spy on the store's get_session method
        redis_store.get_session = AsyncMock(return_value=None)

        await session_manager.get_session("swarm-test123")

        redis_store.get_session.assert_called_once_with("swarm-test123")


class TestUpdateStatus:
    """Tests for SwarmSessionManager.update_status()."""

    @pytest.mark.asyncio
    async def test_update_status_to_in_progress(
        self,
        session_manager: SwarmSessionManager,
        mock_redis: AsyncMock,
    ) -> None:
        """Test updating session status to IN_PROGRESS."""
        await session_manager.update_status(
            "swarm-abc12345",
            SwarmStatus.IN_PROGRESS,
        )

        mock_redis.hset.assert_called_with(
            "test_swarm:session:swarm-abc12345",
            "status",
            "IN_PROGRESS",
        )

    @pytest.mark.asyncio
    async def test_update_status_to_complete_with_timestamp(
        self,
        session_manager: SwarmSessionManager,
        mock_redis: AsyncMock,
    ) -> None:
        """Test updating session status to COMPLETE with completed_at."""
        completed_at = datetime(2026, 1, 20, 13, 0, 0, tzinfo=UTC)

        await session_manager.update_status(
            "swarm-abc12345",
            SwarmStatus.COMPLETE,
            completed_at=completed_at,
        )

        # Should update both status and completed_at
        calls = mock_redis.hset.call_args_list
        # Check that status was set
        assert any("COMPLETE" in str(call) for call in calls)

    @pytest.mark.asyncio
    async def test_update_status_to_failed(
        self,
        session_manager: SwarmSessionManager,
        mock_redis: AsyncMock,
    ) -> None:
        """Test updating session status to FAILED."""
        await session_manager.update_status(
            "swarm-abc12345",
            SwarmStatus.FAILED,
        )

        mock_redis.hset.assert_called_with(
            "test_swarm:session:swarm-abc12345",
            "status",
            "FAILED",
        )

    @pytest.mark.asyncio
    async def test_update_status_to_aggregating(
        self,
        session_manager: SwarmSessionManager,
        mock_redis: AsyncMock,
    ) -> None:
        """Test updating session status to AGGREGATING."""
        await session_manager.update_status(
            "swarm-abc12345",
            SwarmStatus.AGGREGATING,
        )

        mock_redis.hset.assert_called_with(
            "test_swarm:session:swarm-abc12345",
            "status",
            "AGGREGATING",
        )

    @pytest.mark.asyncio
    async def test_update_status_without_completed_at(
        self,
        session_manager: SwarmSessionManager,
        mock_redis: AsyncMock,
    ) -> None:
        """Test updating status without setting completed_at."""
        await session_manager.update_status(
            "swarm-abc12345",
            SwarmStatus.IN_PROGRESS,
        )

        # Should only update status, not completed_at
        # Get all calls and verify only one call for status
        assert mock_redis.hset.call_count == 1
