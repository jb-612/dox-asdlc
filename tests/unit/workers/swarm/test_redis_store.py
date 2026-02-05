"""Unit tests for SwarmRedisStore.

Tests for Redis storage operations including session CRUD, result storage,
and completion waiting functionality.
"""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.workers.swarm.config import SwarmConfig
from src.workers.swarm.models import (
    ReviewerResult,
    ReviewFinding,
    Severity,
    SwarmSession,
    SwarmStatus,
)
from src.workers.swarm.redis_store import SwarmRedisStore


@pytest.fixture
def config() -> SwarmConfig:
    """Create a test configuration."""
    return SwarmConfig(
        key_prefix="test_swarm",
        result_ttl_seconds=3600,
    )


@pytest.fixture
def mock_redis() -> AsyncMock:
    """Create a mock async Redis client."""
    mock = AsyncMock()
    # Set up default return values
    mock.hset = AsyncMock(return_value=1)
    mock.hget = AsyncMock(return_value=None)
    mock.hgetall = AsyncMock(return_value={})
    mock.expire = AsyncMock(return_value=True)
    mock.sadd = AsyncMock(return_value=1)
    mock.smembers = AsyncMock(return_value=set())
    mock.pipeline = MagicMock()
    return mock


@pytest.fixture
def sample_session() -> SwarmSession:
    """Create a sample swarm session for testing."""
    return SwarmSession(
        id="swarm-abc12345",
        target_path="src/workers/",
        reviewers=["security", "performance", "style"],
        status=SwarmStatus.PENDING,
        created_at=datetime(2026, 1, 20, 12, 0, 0, tzinfo=UTC),
        completed_at=None,
        results={},
        unified_report=None,
    )


@pytest.fixture
def sample_result() -> ReviewerResult:
    """Create a sample reviewer result for testing."""
    finding = ReviewFinding(
        id="finding-test123",
        reviewer_type="security",
        severity=Severity.HIGH,
        category="injection",
        title="SQL Injection",
        description="Potential SQL injection vulnerability",
        file_path="src/db.py",
        line_start=42,
        line_end=45,
        code_snippet="cursor.execute(f'SELECT * FROM {table}')",
        recommendation="Use parameterized queries",
        confidence=0.9,
    )
    return ReviewerResult(
        reviewer_type="security",
        status="success",
        findings=[finding],
        duration_seconds=15.5,
        files_reviewed=["src/db.py", "src/api.py"],
        error_message=None,
    )


class TestSwarmRedisStoreInit:
    """Tests for SwarmRedisStore initialization."""

    def test_init_with_client_and_config(
        self, mock_redis: AsyncMock, config: SwarmConfig
    ) -> None:
        """Test that SwarmRedisStore initializes correctly."""
        store = SwarmRedisStore(mock_redis, config)

        assert store._redis is mock_redis
        assert store._config is config

    def test_init_stores_key_prefix(
        self, mock_redis: AsyncMock, config: SwarmConfig
    ) -> None:
        """Test that key prefix is stored from config."""
        store = SwarmRedisStore(mock_redis, config)

        assert store._config.key_prefix == "test_swarm"


class TestCreateSession:
    """Tests for SwarmRedisStore.create_session()."""

    @pytest.mark.asyncio
    async def test_create_session_stores_with_hset(
        self,
        mock_redis: AsyncMock,
        config: SwarmConfig,
        sample_session: SwarmSession,
    ) -> None:
        """Test that create_session stores session data using hset."""
        store = SwarmRedisStore(mock_redis, config)

        await store.create_session(sample_session)

        # Verify hset was called with correct key
        mock_redis.hset.assert_called()
        call_args = mock_redis.hset.call_args
        assert "test_swarm:session:swarm-abc12345" in str(call_args)

    @pytest.mark.asyncio
    async def test_create_session_sets_ttl(
        self,
        mock_redis: AsyncMock,
        config: SwarmConfig,
        sample_session: SwarmSession,
    ) -> None:
        """Test that create_session sets TTL on the session key."""
        store = SwarmRedisStore(mock_redis, config)

        await store.create_session(sample_session)

        # Verify expire was called with correct TTL
        mock_redis.expire.assert_called_with(
            "test_swarm:session:swarm-abc12345",
            config.result_ttl_seconds,
        )

    @pytest.mark.asyncio
    async def test_create_session_stores_all_fields(
        self,
        mock_redis: AsyncMock,
        config: SwarmConfig,
        sample_session: SwarmSession,
    ) -> None:
        """Test that create_session stores all session fields."""
        store = SwarmRedisStore(mock_redis, config)

        await store.create_session(sample_session)

        # Get the mapping argument from hset call
        call_args = mock_redis.hset.call_args
        mapping = call_args.kwargs.get("mapping") or call_args[1].get("mapping")

        # Verify required fields are in the mapping
        assert "id" in mapping
        assert "target_path" in mapping
        assert "status" in mapping
        assert "created_at" in mapping
        assert "reviewers" in mapping

    @pytest.mark.asyncio
    async def test_create_session_serializes_session_to_json(
        self,
        mock_redis: AsyncMock,
        config: SwarmConfig,
        sample_session: SwarmSession,
    ) -> None:
        """Test that session data is properly serialized."""
        store = SwarmRedisStore(mock_redis, config)

        await store.create_session(sample_session)

        # Get the mapping from hset call
        call_args = mock_redis.hset.call_args
        mapping = call_args.kwargs.get("mapping") or call_args[1].get("mapping")

        # Verify status is stored as string
        assert mapping["status"] == "PENDING"


class TestGetSession:
    """Tests for SwarmRedisStore.get_session()."""

    @pytest.mark.asyncio
    async def test_get_session_returns_none_when_not_found(
        self, mock_redis: AsyncMock, config: SwarmConfig
    ) -> None:
        """Test that get_session returns None for non-existent session."""
        mock_redis.hgetall.return_value = {}
        store = SwarmRedisStore(mock_redis, config)

        result = await store.get_session("swarm-nonexistent")

        assert result is None

    @pytest.mark.asyncio
    async def test_get_session_retrieves_session(
        self,
        mock_redis: AsyncMock,
        config: SwarmConfig,
        sample_session: SwarmSession,
    ) -> None:
        """Test that get_session retrieves and deserializes session."""
        # Set up mock to return serialized session data
        mock_redis.hgetall.return_value = {
            "id": "swarm-abc12345",
            "target_path": "src/workers/",
            "reviewers": '["security", "performance", "style"]',
            "status": "PENDING",
            "created_at": "2026-01-20T12:00:00Z",
            "completed_at": "",
            "results": "{}",
            "unified_report": "",
        }
        store = SwarmRedisStore(mock_redis, config)

        result = await store.get_session("swarm-abc12345")

        assert result is not None
        assert result.id == "swarm-abc12345"
        assert result.target_path == "src/workers/"
        assert result.status == SwarmStatus.PENDING

    @pytest.mark.asyncio
    async def test_get_session_uses_correct_key(
        self, mock_redis: AsyncMock, config: SwarmConfig
    ) -> None:
        """Test that get_session uses the correct Redis key pattern."""
        mock_redis.hgetall.return_value = {}
        store = SwarmRedisStore(mock_redis, config)

        await store.get_session("swarm-test123")

        mock_redis.hgetall.assert_called_once_with("test_swarm:session:swarm-test123")


class TestUpdateSessionStatus:
    """Tests for SwarmRedisStore.update_session_status()."""

    @pytest.mark.asyncio
    async def test_update_session_status_updates_status_field(
        self, mock_redis: AsyncMock, config: SwarmConfig
    ) -> None:
        """Test that update_session_status updates the status field."""
        store = SwarmRedisStore(mock_redis, config)

        await store.update_session_status("swarm-abc12345", SwarmStatus.IN_PROGRESS)

        mock_redis.hset.assert_called_with(
            "test_swarm:session:swarm-abc12345",
            "status",
            "IN_PROGRESS",
        )

    @pytest.mark.asyncio
    async def test_update_session_status_to_complete(
        self, mock_redis: AsyncMock, config: SwarmConfig
    ) -> None:
        """Test updating session status to COMPLETE."""
        store = SwarmRedisStore(mock_redis, config)

        await store.update_session_status("swarm-abc12345", SwarmStatus.COMPLETE)

        mock_redis.hset.assert_called_with(
            "test_swarm:session:swarm-abc12345",
            "status",
            "COMPLETE",
        )

    @pytest.mark.asyncio
    async def test_update_session_status_to_failed(
        self, mock_redis: AsyncMock, config: SwarmConfig
    ) -> None:
        """Test updating session status to FAILED."""
        store = SwarmRedisStore(mock_redis, config)

        await store.update_session_status("swarm-abc12345", SwarmStatus.FAILED)

        mock_redis.hset.assert_called_with(
            "test_swarm:session:swarm-abc12345",
            "status",
            "FAILED",
        )


class TestStoreReviewerResult:
    """Tests for SwarmRedisStore.store_reviewer_result()."""

    @pytest.mark.asyncio
    async def test_store_reviewer_result_stores_in_results_hash(
        self,
        mock_redis: AsyncMock,
        config: SwarmConfig,
        sample_result: ReviewerResult,
    ) -> None:
        """Test that store_reviewer_result stores result in results hash."""
        store = SwarmRedisStore(mock_redis, config)

        await store.store_reviewer_result("swarm-abc12345", "security", sample_result)

        # Verify result is stored in results hash
        mock_redis.hset.assert_any_call(
            "test_swarm:results:swarm-abc12345",
            "security",
            sample_result.model_dump_json(),
        )

    @pytest.mark.asyncio
    async def test_store_reviewer_result_adds_to_progress_set(
        self,
        mock_redis: AsyncMock,
        config: SwarmConfig,
        sample_result: ReviewerResult,
    ) -> None:
        """Test that store_reviewer_result adds reviewer to progress set."""
        store = SwarmRedisStore(mock_redis, config)

        await store.store_reviewer_result("swarm-abc12345", "security", sample_result)

        # Verify reviewer is added to progress set
        mock_redis.sadd.assert_called_with(
            "test_swarm:progress:swarm-abc12345",
            "security",
        )

    @pytest.mark.asyncio
    async def test_store_reviewer_result_sets_ttl_on_results(
        self,
        mock_redis: AsyncMock,
        config: SwarmConfig,
        sample_result: ReviewerResult,
    ) -> None:
        """Test that TTL is set on results hash."""
        store = SwarmRedisStore(mock_redis, config)

        await store.store_reviewer_result("swarm-abc12345", "security", sample_result)

        # Verify TTL is set
        expire_calls = mock_redis.expire.call_args_list
        keys_with_ttl = [call[0][0] for call in expire_calls]
        assert "test_swarm:results:swarm-abc12345" in keys_with_ttl


class TestGetReviewerResult:
    """Tests for SwarmRedisStore.get_reviewer_result()."""

    @pytest.mark.asyncio
    async def test_get_reviewer_result_returns_none_when_not_found(
        self, mock_redis: AsyncMock, config: SwarmConfig
    ) -> None:
        """Test that get_reviewer_result returns None when result doesn't exist."""
        mock_redis.hget.return_value = None
        store = SwarmRedisStore(mock_redis, config)

        result = await store.get_reviewer_result("swarm-abc12345", "security")

        assert result is None

    @pytest.mark.asyncio
    async def test_get_reviewer_result_returns_deserialized_result(
        self,
        mock_redis: AsyncMock,
        config: SwarmConfig,
        sample_result: ReviewerResult,
    ) -> None:
        """Test that get_reviewer_result returns deserialized result."""
        mock_redis.hget.return_value = sample_result.model_dump_json()
        store = SwarmRedisStore(mock_redis, config)

        result = await store.get_reviewer_result("swarm-abc12345", "security")

        assert result is not None
        assert result.reviewer_type == "security"
        assert result.status == "success"
        assert len(result.findings) == 1

    @pytest.mark.asyncio
    async def test_get_reviewer_result_uses_correct_key(
        self, mock_redis: AsyncMock, config: SwarmConfig
    ) -> None:
        """Test that get_reviewer_result uses correct Redis key."""
        mock_redis.hget.return_value = None
        store = SwarmRedisStore(mock_redis, config)

        await store.get_reviewer_result("swarm-test123", "performance")

        mock_redis.hget.assert_called_once_with(
            "test_swarm:results:swarm-test123",
            "performance",
        )


class TestGetAllResults:
    """Tests for SwarmRedisStore.get_all_results()."""

    @pytest.mark.asyncio
    async def test_get_all_results_returns_empty_dict_when_no_results(
        self, mock_redis: AsyncMock, config: SwarmConfig
    ) -> None:
        """Test that get_all_results returns empty dict when no results exist."""
        mock_redis.hgetall.return_value = {}
        store = SwarmRedisStore(mock_redis, config)

        results = await store.get_all_results("swarm-abc12345")

        assert results == {}

    @pytest.mark.asyncio
    async def test_get_all_results_returns_all_results(
        self,
        mock_redis: AsyncMock,
        config: SwarmConfig,
        sample_result: ReviewerResult,
    ) -> None:
        """Test that get_all_results returns all stored results."""
        performance_result = ReviewerResult(
            reviewer_type="performance",
            status="success",
            findings=[],
            duration_seconds=10.0,
            files_reviewed=["src/api.py"],
            error_message=None,
        )
        mock_redis.hgetall.return_value = {
            "security": sample_result.model_dump_json(),
            "performance": performance_result.model_dump_json(),
        }
        store = SwarmRedisStore(mock_redis, config)

        results = await store.get_all_results("swarm-abc12345")

        assert len(results) == 2
        assert "security" in results
        assert "performance" in results
        assert results["security"].reviewer_type == "security"
        assert results["performance"].reviewer_type == "performance"

    @pytest.mark.asyncio
    async def test_get_all_results_uses_results_key(
        self, mock_redis: AsyncMock, config: SwarmConfig
    ) -> None:
        """Test that get_all_results uses the correct Redis key."""
        mock_redis.hgetall.return_value = {}
        store = SwarmRedisStore(mock_redis, config)

        await store.get_all_results("swarm-test456")

        mock_redis.hgetall.assert_called_once_with("test_swarm:results:swarm-test456")


class TestGetCompletedReviewers:
    """Tests for SwarmRedisStore.get_completed_reviewers()."""

    @pytest.mark.asyncio
    async def test_get_completed_reviewers_returns_empty_set_when_none(
        self, mock_redis: AsyncMock, config: SwarmConfig
    ) -> None:
        """Test that get_completed_reviewers returns empty set when no completions."""
        mock_redis.smembers.return_value = set()
        store = SwarmRedisStore(mock_redis, config)

        completed = await store.get_completed_reviewers("swarm-abc12345")

        assert completed == set()

    @pytest.mark.asyncio
    async def test_get_completed_reviewers_returns_completed_set(
        self, mock_redis: AsyncMock, config: SwarmConfig
    ) -> None:
        """Test that get_completed_reviewers returns set of completed reviewers."""
        mock_redis.smembers.return_value = {"security", "performance"}
        store = SwarmRedisStore(mock_redis, config)

        completed = await store.get_completed_reviewers("swarm-abc12345")

        assert completed == {"security", "performance"}

    @pytest.mark.asyncio
    async def test_get_completed_reviewers_uses_progress_key(
        self, mock_redis: AsyncMock, config: SwarmConfig
    ) -> None:
        """Test that get_completed_reviewers uses the correct Redis key."""
        mock_redis.smembers.return_value = set()
        store = SwarmRedisStore(mock_redis, config)

        await store.get_completed_reviewers("swarm-test789")

        mock_redis.smembers.assert_called_once_with("test_swarm:progress:swarm-test789")


class TestWaitForCompletion:
    """Tests for SwarmRedisStore.wait_for_completion()."""

    @pytest.mark.asyncio
    async def test_wait_for_completion_returns_true_when_all_complete(
        self, mock_redis: AsyncMock, config: SwarmConfig
    ) -> None:
        """Test that wait_for_completion returns True when all reviewers complete."""
        mock_redis.smembers.return_value = {"security", "performance", "style"}
        store = SwarmRedisStore(mock_redis, config)

        result = await store.wait_for_completion(
            "swarm-abc12345",
            ["security", "performance", "style"],
            timeout_seconds=10,
        )

        assert result is True

    @pytest.mark.asyncio
    async def test_wait_for_completion_returns_false_on_timeout(
        self, mock_redis: AsyncMock, config: SwarmConfig
    ) -> None:
        """Test that wait_for_completion returns False on timeout."""
        # Always return incomplete set
        mock_redis.smembers.return_value = {"security"}
        store = SwarmRedisStore(mock_redis, config)

        result = await store.wait_for_completion(
            "swarm-abc12345",
            ["security", "performance", "style"],
            timeout_seconds=0.1,  # Very short timeout
        )

        assert result is False

    @pytest.mark.asyncio
    async def test_wait_for_completion_polls_until_complete(
        self, mock_redis: AsyncMock, config: SwarmConfig
    ) -> None:
        """Test that wait_for_completion polls progress set."""
        # Simulate gradual completion
        call_count = [0]

        async def mock_smembers(key: str) -> set:
            call_count[0] += 1
            if call_count[0] == 1:
                return {"security"}
            elif call_count[0] == 2:
                return {"security", "performance"}
            else:
                return {"security", "performance", "style"}

        mock_redis.smembers = mock_smembers
        store = SwarmRedisStore(mock_redis, config)

        result = await store.wait_for_completion(
            "swarm-abc12345",
            ["security", "performance", "style"],
            timeout_seconds=10,
            poll_interval=0.01,  # Fast polling for test
        )

        assert result is True
        assert call_count[0] >= 3  # Should have polled at least 3 times

    @pytest.mark.asyncio
    async def test_wait_for_completion_uses_asyncio_sleep(
        self, mock_redis: AsyncMock, config: SwarmConfig
    ) -> None:
        """Test that wait_for_completion uses asyncio.sleep for non-blocking wait."""
        mock_redis.smembers.return_value = set()
        store = SwarmRedisStore(mock_redis, config)

        with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            # Short timeout to avoid long test
            await store.wait_for_completion(
                "swarm-abc12345",
                ["security"],
                timeout_seconds=0.05,
                poll_interval=0.01,
            )

            # Should have called asyncio.sleep at least once
            assert mock_sleep.called

    @pytest.mark.asyncio
    async def test_wait_for_completion_respects_poll_interval(
        self, mock_redis: AsyncMock, config: SwarmConfig
    ) -> None:
        """Test that wait_for_completion respects the poll interval."""
        call_count = [0]

        async def mock_smembers(key: str) -> set:
            call_count[0] += 1
            return set()  # Never complete

        mock_redis.smembers = mock_smembers
        store = SwarmRedisStore(mock_redis, config)

        await store.wait_for_completion(
            "swarm-abc12345",
            ["security"],
            timeout_seconds=0.1,
            poll_interval=0.03,
        )

        # With 0.1s timeout and 0.03s interval, should poll roughly 3-4 times
        assert call_count[0] >= 2
        assert call_count[0] <= 5

    @pytest.mark.asyncio
    async def test_wait_for_completion_default_poll_interval(
        self, mock_redis: AsyncMock, config: SwarmConfig
    ) -> None:
        """Test that wait_for_completion uses default 1s poll interval."""
        mock_redis.smembers.return_value = {"security", "performance", "style"}
        store = SwarmRedisStore(mock_redis, config)

        # Should complete immediately since all are already done
        result = await store.wait_for_completion(
            "swarm-abc12345",
            ["security", "performance", "style"],
        )

        assert result is True


class TestKeyPatterns:
    """Tests for Redis key pattern generation."""

    def test_session_key_pattern(
        self, mock_redis: AsyncMock, config: SwarmConfig
    ) -> None:
        """Test that session key follows {prefix}:session:{id} pattern."""
        store = SwarmRedisStore(mock_redis, config)

        key = store._session_key("swarm-abc123")

        assert key == "test_swarm:session:swarm-abc123"

    def test_results_key_pattern(
        self, mock_redis: AsyncMock, config: SwarmConfig
    ) -> None:
        """Test that results key follows {prefix}:results:{id} pattern."""
        store = SwarmRedisStore(mock_redis, config)

        key = store._results_key("swarm-abc123")

        assert key == "test_swarm:results:swarm-abc123"

    def test_progress_key_pattern(
        self, mock_redis: AsyncMock, config: SwarmConfig
    ) -> None:
        """Test that progress key follows {prefix}:progress:{id} pattern."""
        store = SwarmRedisStore(mock_redis, config)

        key = store._progress_key("swarm-abc123")

        assert key == "test_swarm:progress:swarm-abc123"
