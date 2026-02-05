"""Unit tests for SwarmDispatcher.

Tests for parallel task spawning, result collection, and coordination
message publishing in the swarm dispatcher.
"""

from __future__ import annotations

import asyncio
import time
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.workers.swarm.config import SwarmConfig
from src.workers.swarm.dispatcher import SwarmDispatcher
from src.workers.swarm.models import (
    ReviewerResult,
    ReviewFinding,
    Severity,
    SwarmSession,
    SwarmStatus,
    UnifiedReport,
)
from src.workers.swarm.redis_store import SwarmRedisStore
from src.workers.swarm.reviewers.base import ReviewerRegistry, SpecializedReviewer
from src.workers.swarm.session import SwarmSessionManager


@pytest.fixture
def config() -> SwarmConfig:
    """Create a test configuration."""
    return SwarmConfig(
        key_prefix="test_swarm",
        result_ttl_seconds=3600,
        default_reviewers=["security", "performance", "style"],
        task_timeout_seconds=60,
        aggregate_timeout_seconds=30,
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
    """Create a SwarmSessionManager."""
    return SwarmSessionManager(redis_store, config)


class MockReviewer:
    """Mock reviewer for testing."""

    def __init__(self, reviewer_type: str):
        self.reviewer_type = reviewer_type
        self.focus_areas = ["test"]
        self.severity_weights = {"test": 1.0}

    def get_system_prompt(self) -> str:
        return f"Review for {self.reviewer_type}"

    def get_checklist(self) -> list[str]:
        return ["Check 1", "Check 2"]


@pytest.fixture
def registry() -> ReviewerRegistry:
    """Create a registry with mock reviewers."""
    reg = ReviewerRegistry()
    reg.register(MockReviewer("security"))
    reg.register(MockReviewer("performance"))
    reg.register(MockReviewer("style"))
    return reg


def create_mock_result(reviewer_type: str, delay: float = 0.0) -> ReviewerResult:
    """Create a mock reviewer result."""
    return ReviewerResult(
        reviewer_type=reviewer_type,
        status="success",
        findings=[],
        duration_seconds=delay,
        files_reviewed=["test.py"],
        error_message=None,
    )


class TestSwarmDispatcherInit:
    """Tests for SwarmDispatcher initialization."""

    def test_init_with_all_dependencies(
        self,
        session_manager: SwarmSessionManager,
        redis_store: SwarmRedisStore,
        registry: ReviewerRegistry,
        config: SwarmConfig,
    ) -> None:
        """Test that SwarmDispatcher initializes correctly."""
        dispatcher = SwarmDispatcher(
            session_manager=session_manager,
            redis_store=redis_store,
            registry=registry,
            config=config,
        )

        assert dispatcher._session_manager is session_manager
        assert dispatcher._store is redis_store
        assert dispatcher._registry is registry
        assert dispatcher._config is config

    def test_init_with_custom_executor(
        self,
        session_manager: SwarmSessionManager,
        redis_store: SwarmRedisStore,
        registry: ReviewerRegistry,
        config: SwarmConfig,
    ) -> None:
        """Test that custom executor is used when provided."""
        custom_executor = AsyncMock()
        dispatcher = SwarmDispatcher(
            session_manager=session_manager,
            redis_store=redis_store,
            registry=registry,
            config=config,
            review_executor=custom_executor,
        )

        assert dispatcher._executor is custom_executor

    def test_init_with_coordination_publisher(
        self,
        session_manager: SwarmSessionManager,
        redis_store: SwarmRedisStore,
        registry: ReviewerRegistry,
        config: SwarmConfig,
    ) -> None:
        """Test that coordination publisher can be set."""
        publisher = AsyncMock()
        dispatcher = SwarmDispatcher(
            session_manager=session_manager,
            redis_store=redis_store,
            registry=registry,
            config=config,
            coord_publisher=publisher,
        )

        assert dispatcher._publish is publisher


class TestDispatchSwarm:
    """Tests for SwarmDispatcher.dispatch_swarm()."""

    @pytest.mark.asyncio
    async def test_dispatch_swarm_returns_session_id(
        self,
        session_manager: SwarmSessionManager,
        redis_store: SwarmRedisStore,
        registry: ReviewerRegistry,
        config: SwarmConfig,
    ) -> None:
        """Test that dispatch_swarm returns a valid session ID."""
        executor = AsyncMock(return_value=create_mock_result("test"))
        dispatcher = SwarmDispatcher(
            session_manager=session_manager,
            redis_store=redis_store,
            registry=registry,
            config=config,
            review_executor=executor,
        )

        session_id = await dispatcher.dispatch_swarm("src/workers/")

        assert session_id is not None
        assert session_id.startswith("swarm-")

    @pytest.mark.asyncio
    async def test_dispatch_swarm_creates_session(
        self,
        session_manager: SwarmSessionManager,
        redis_store: SwarmRedisStore,
        registry: ReviewerRegistry,
        config: SwarmConfig,
    ) -> None:
        """Test that dispatch_swarm creates a session via manager."""
        executor = AsyncMock(return_value=create_mock_result("test"))
        session_manager.create_session = AsyncMock(
            return_value=SwarmSession(
                id="swarm-test123",
                target_path="src/workers/",
                reviewers=["security", "performance", "style"],
                status=SwarmStatus.PENDING,
                created_at=datetime.now(UTC),
            )
        )
        dispatcher = SwarmDispatcher(
            session_manager=session_manager,
            redis_store=redis_store,
            registry=registry,
            config=config,
            review_executor=executor,
        )

        await dispatcher.dispatch_swarm("src/workers/")

        session_manager.create_session.assert_called_once_with(
            "src/workers/", None
        )

    @pytest.mark.asyncio
    async def test_dispatch_swarm_uses_custom_reviewers(
        self,
        session_manager: SwarmSessionManager,
        redis_store: SwarmRedisStore,
        registry: ReviewerRegistry,
        config: SwarmConfig,
    ) -> None:
        """Test that dispatch_swarm passes custom reviewers to session manager."""
        executor = AsyncMock(return_value=create_mock_result("test"))
        session_manager.create_session = AsyncMock(
            return_value=SwarmSession(
                id="swarm-test123",
                target_path="src/workers/",
                reviewers=["security"],
                status=SwarmStatus.PENDING,
                created_at=datetime.now(UTC),
            )
        )
        dispatcher = SwarmDispatcher(
            session_manager=session_manager,
            redis_store=redis_store,
            registry=registry,
            config=config,
            review_executor=executor,
        )

        await dispatcher.dispatch_swarm("src/workers/", reviewer_types=["security"])

        session_manager.create_session.assert_called_once_with(
            "src/workers/", ["security"]
        )

    @pytest.mark.asyncio
    async def test_dispatch_spawns_parallel_tasks(
        self,
        session_manager: SwarmSessionManager,
        redis_store: SwarmRedisStore,
        registry: ReviewerRegistry,
        config: SwarmConfig,
    ) -> None:
        """Test that dispatch_swarm spawns tasks for all reviewers in parallel."""
        start_times: list[float] = []

        async def track_executor(session_id, path, reviewer):
            start_times.append(time.time())
            await asyncio.sleep(0.05)  # Small delay
            return create_mock_result(reviewer.reviewer_type)

        dispatcher = SwarmDispatcher(
            session_manager=session_manager,
            redis_store=redis_store,
            registry=registry,
            config=config,
            review_executor=track_executor,
        )

        await dispatcher.dispatch_swarm("src/workers/")

        # All 3 reviewers should have started within 500ms of each other
        assert len(start_times) == 3
        time_spread = max(start_times) - min(start_times)
        assert time_spread < 0.5, f"Tasks not parallel, spread: {time_spread}s"

    @pytest.mark.asyncio
    async def test_dispatch_calls_executor_for_each_reviewer(
        self,
        session_manager: SwarmSessionManager,
        redis_store: SwarmRedisStore,
        registry: ReviewerRegistry,
        config: SwarmConfig,
    ) -> None:
        """Test that executor is called for each reviewer."""
        executor = AsyncMock(return_value=create_mock_result("test"))
        dispatcher = SwarmDispatcher(
            session_manager=session_manager,
            redis_store=redis_store,
            registry=registry,
            config=config,
            review_executor=executor,
        )

        await dispatcher.dispatch_swarm("src/workers/")

        # Should call executor for each of the 3 reviewers
        assert executor.call_count == 3

    @pytest.mark.asyncio
    async def test_dispatch_stores_results_in_redis(
        self,
        session_manager: SwarmSessionManager,
        redis_store: SwarmRedisStore,
        registry: ReviewerRegistry,
        config: SwarmConfig,
    ) -> None:
        """Test that results are stored in Redis after execution."""
        executor = AsyncMock(return_value=create_mock_result("test"))
        redis_store.store_reviewer_result = AsyncMock()
        dispatcher = SwarmDispatcher(
            session_manager=session_manager,
            redis_store=redis_store,
            registry=registry,
            config=config,
            review_executor=executor,
        )

        await dispatcher.dispatch_swarm("src/workers/")

        # Should store result for each reviewer
        assert redis_store.store_reviewer_result.call_count == 3

    @pytest.mark.asyncio
    async def test_dispatch_handles_timeout(
        self,
        session_manager: SwarmSessionManager,
        redis_store: SwarmRedisStore,
        registry: ReviewerRegistry,
        config: SwarmConfig,
    ) -> None:
        """Test that dispatch handles timeout gracefully."""
        async def slow_executor(session_id, path, reviewer):
            await asyncio.sleep(10)  # Very slow
            return create_mock_result(reviewer.reviewer_type)

        dispatcher = SwarmDispatcher(
            session_manager=session_manager,
            redis_store=redis_store,
            registry=registry,
            config=config,
            review_executor=slow_executor,
        )

        # Should not raise, should complete with timeout
        session_id = await dispatcher.dispatch_swarm(
            "src/workers/",
            timeout_seconds=0.1,  # Very short timeout
        )

        assert session_id is not None

    @pytest.mark.asyncio
    async def test_dispatch_handles_partial_failure(
        self,
        session_manager: SwarmSessionManager,
        redis_store: SwarmRedisStore,
        registry: ReviewerRegistry,
        config: SwarmConfig,
    ) -> None:
        """Test that partial failures don't stop other reviewers."""
        call_count = {"count": 0}

        async def flaky_executor(session_id, path, reviewer):
            call_count["count"] += 1
            if reviewer.reviewer_type == "security":
                raise Exception("Security reviewer failed")
            return create_mock_result(reviewer.reviewer_type)

        redis_store.store_reviewer_result = AsyncMock()
        dispatcher = SwarmDispatcher(
            session_manager=session_manager,
            redis_store=redis_store,
            registry=registry,
            config=config,
            review_executor=flaky_executor,
        )

        await dispatcher.dispatch_swarm("src/workers/")

        # All 3 reviewers should have been called
        assert call_count["count"] == 3
        # Results should still be stored (including failed one)
        assert redis_store.store_reviewer_result.call_count == 3


class TestDefaultExecutor:
    """Tests for the default executor (placeholder implementation)."""

    @pytest.mark.asyncio
    async def test_default_executor_returns_mock_result(
        self,
        session_manager: SwarmSessionManager,
        redis_store: SwarmRedisStore,
        registry: ReviewerRegistry,
        config: SwarmConfig,
    ) -> None:
        """Test that default executor returns a mock result."""
        dispatcher = SwarmDispatcher(
            session_manager=session_manager,
            redis_store=redis_store,
            registry=registry,
            config=config,
        )

        reviewer = MockReviewer("security")
        result = await dispatcher._default_executor("swarm-test", "src/", reviewer)

        assert isinstance(result, ReviewerResult)
        assert result.reviewer_type == "security"
        assert result.status == "success"


class TestCollectResults:
    """Tests for SwarmDispatcher.collect_results()."""

    @pytest.mark.asyncio
    async def test_collect_results_returns_all_results(
        self,
        session_manager: SwarmSessionManager,
        redis_store: SwarmRedisStore,
        registry: ReviewerRegistry,
        config: SwarmConfig,
        mock_redis: AsyncMock,
    ) -> None:
        """Test that collect_results returns all reviewer results."""
        # Set up session manager to return a session
        mock_redis.hgetall.return_value = {
            "id": "swarm-test123",
            "target_path": "src/workers/",
            "reviewers": '["security", "performance"]',
            "status": "IN_PROGRESS",
            "created_at": "2026-01-20T12:00:00+00:00",
            "completed_at": "",
            "results": "{}",
            "unified_report": "",
        }
        mock_redis.smembers.return_value = {"security", "performance"}

        # Mock get_all_results
        security_result = create_mock_result("security")
        performance_result = create_mock_result("performance")
        redis_store.get_all_results = AsyncMock(
            return_value={
                "security": security_result,
                "performance": performance_result,
            }
        )
        redis_store.wait_for_completion = AsyncMock(return_value=True)

        dispatcher = SwarmDispatcher(
            session_manager=session_manager,
            redis_store=redis_store,
            registry=registry,
            config=config,
        )

        results = await dispatcher.collect_results("swarm-test123")

        assert "security" in results
        assert "performance" in results

    @pytest.mark.asyncio
    async def test_collect_results_raises_for_unknown_session(
        self,
        session_manager: SwarmSessionManager,
        redis_store: SwarmRedisStore,
        registry: ReviewerRegistry,
        config: SwarmConfig,
    ) -> None:
        """Test that collect_results raises for non-existent session."""
        dispatcher = SwarmDispatcher(
            session_manager=session_manager,
            redis_store=redis_store,
            registry=registry,
            config=config,
        )

        with pytest.raises(ValueError, match="Session not found"):
            await dispatcher.collect_results("swarm-nonexistent")

    @pytest.mark.asyncio
    async def test_collect_results_waits_for_completion(
        self,
        session_manager: SwarmSessionManager,
        redis_store: SwarmRedisStore,
        registry: ReviewerRegistry,
        config: SwarmConfig,
        mock_redis: AsyncMock,
    ) -> None:
        """Test that collect_results waits for all reviewers."""
        mock_redis.hgetall.return_value = {
            "id": "swarm-test123",
            "target_path": "src/workers/",
            "reviewers": '["security", "performance"]',
            "status": "IN_PROGRESS",
            "created_at": "2026-01-20T12:00:00+00:00",
            "completed_at": "",
            "results": "{}",
            "unified_report": "",
        }

        redis_store.wait_for_completion = AsyncMock(return_value=True)
        redis_store.get_all_results = AsyncMock(return_value={})

        dispatcher = SwarmDispatcher(
            session_manager=session_manager,
            redis_store=redis_store,
            registry=registry,
            config=config,
        )

        await dispatcher.collect_results("swarm-test123")

        redis_store.wait_for_completion.assert_called_once()

    @pytest.mark.asyncio
    async def test_collect_results_updates_status_to_aggregating(
        self,
        session_manager: SwarmSessionManager,
        redis_store: SwarmRedisStore,
        registry: ReviewerRegistry,
        config: SwarmConfig,
        mock_redis: AsyncMock,
    ) -> None:
        """Test that collect_results updates status to AGGREGATING."""
        mock_redis.hgetall.return_value = {
            "id": "swarm-test123",
            "target_path": "src/workers/",
            "reviewers": '["security"]',
            "status": "IN_PROGRESS",
            "created_at": "2026-01-20T12:00:00+00:00",
            "completed_at": "",
            "results": "{}",
            "unified_report": "",
        }
        mock_redis.smembers.return_value = {"security"}

        redis_store.wait_for_completion = AsyncMock(return_value=True)
        redis_store.get_all_results = AsyncMock(return_value={})
        session_manager.update_status = AsyncMock()

        dispatcher = SwarmDispatcher(
            session_manager=session_manager,
            redis_store=redis_store,
            registry=registry,
            config=config,
        )

        await dispatcher.collect_results("swarm-test123")

        session_manager.update_status.assert_called_with(
            "swarm-test123", SwarmStatus.AGGREGATING
        )

    @pytest.mark.asyncio
    async def test_collect_results_respects_timeout(
        self,
        session_manager: SwarmSessionManager,
        redis_store: SwarmRedisStore,
        registry: ReviewerRegistry,
        config: SwarmConfig,
        mock_redis: AsyncMock,
    ) -> None:
        """Test that collect_results uses provided timeout."""
        mock_redis.hgetall.return_value = {
            "id": "swarm-test123",
            "target_path": "src/workers/",
            "reviewers": '["security"]',
            "status": "IN_PROGRESS",
            "created_at": "2026-01-20T12:00:00+00:00",
            "completed_at": "",
            "results": "{}",
            "unified_report": "",
        }

        redis_store.wait_for_completion = AsyncMock(return_value=True)
        redis_store.get_all_results = AsyncMock(return_value={})
        session_manager.update_status = AsyncMock()

        dispatcher = SwarmDispatcher(
            session_manager=session_manager,
            redis_store=redis_store,
            registry=registry,
            config=config,
        )

        await dispatcher.collect_results("swarm-test123", timeout_seconds=120)

        # Verify timeout was passed to wait_for_completion
        call_args = redis_store.wait_for_completion.call_args
        assert call_args[0][2] == 120  # timeout_seconds argument


class TestCoordinationMessages:
    """Tests for coordination message publishing (T14)."""

    @pytest.mark.asyncio
    async def test_dispatch_publishes_swarm_started(
        self,
        session_manager: SwarmSessionManager,
        redis_store: SwarmRedisStore,
        registry: ReviewerRegistry,
        config: SwarmConfig,
    ) -> None:
        """Test that SWARM_STARTED message is published on dispatch."""
        publisher = AsyncMock()
        executor = AsyncMock(return_value=create_mock_result("test"))

        dispatcher = SwarmDispatcher(
            session_manager=session_manager,
            redis_store=redis_store,
            registry=registry,
            config=config,
            review_executor=executor,
            coord_publisher=publisher,
        )

        await dispatcher.dispatch_swarm("src/workers/")

        # Should have published SWARM_STARTED
        calls = publisher.call_args_list
        started_calls = [c for c in calls if "SWARM_STARTED" in str(c)]
        assert len(started_calls) >= 1

    @pytest.mark.asyncio
    async def test_dispatch_publishes_reviewer_complete(
        self,
        session_manager: SwarmSessionManager,
        redis_store: SwarmRedisStore,
        registry: ReviewerRegistry,
        config: SwarmConfig,
    ) -> None:
        """Test that SWARM_REVIEWER_COMPLETE is published for each reviewer."""
        publisher = AsyncMock()
        executor = AsyncMock(return_value=create_mock_result("test"))

        dispatcher = SwarmDispatcher(
            session_manager=session_manager,
            redis_store=redis_store,
            registry=registry,
            config=config,
            review_executor=executor,
            coord_publisher=publisher,
        )

        await dispatcher.dispatch_swarm("src/workers/")

        # Should have published SWARM_REVIEWER_COMPLETE for each reviewer
        calls = publisher.call_args_list
        complete_calls = [c for c in calls if "SWARM_REVIEWER_COMPLETE" in str(c)]
        assert len(complete_calls) == 3  # One for each reviewer

    @pytest.mark.asyncio
    async def test_finalize_swarm_publishes_complete(
        self,
        session_manager: SwarmSessionManager,
        redis_store: SwarmRedisStore,
        registry: ReviewerRegistry,
        config: SwarmConfig,
    ) -> None:
        """Test that SWARM_COMPLETE is published when swarm is finalized."""
        publisher = AsyncMock()
        session_manager.update_status = AsyncMock()

        dispatcher = SwarmDispatcher(
            session_manager=session_manager,
            redis_store=redis_store,
            registry=registry,
            config=config,
            coord_publisher=publisher,
        )

        report = UnifiedReport(
            swarm_id="swarm-test123",
            target_path="src/workers/",
            created_at=datetime.now(UTC),
            total_findings=5,
        )

        await dispatcher.finalize_swarm("swarm-test123", report)

        # Should have published SWARM_COMPLETE
        calls = publisher.call_args_list
        complete_calls = [c for c in calls if "SWARM_COMPLETE" in str(c)]
        assert len(complete_calls) == 1

    @pytest.mark.asyncio
    async def test_finalize_swarm_updates_status_to_complete(
        self,
        session_manager: SwarmSessionManager,
        redis_store: SwarmRedisStore,
        registry: ReviewerRegistry,
        config: SwarmConfig,
    ) -> None:
        """Test that finalize_swarm updates status to COMPLETE."""
        session_manager.update_status = AsyncMock()

        dispatcher = SwarmDispatcher(
            session_manager=session_manager,
            redis_store=redis_store,
            registry=registry,
            config=config,
        )

        report = UnifiedReport(
            swarm_id="swarm-test123",
            target_path="src/workers/",
            created_at=datetime.now(UTC),
            total_findings=0,
        )

        await dispatcher.finalize_swarm("swarm-test123", report)

        # Should update status to COMPLETE with timestamp
        session_manager.update_status.assert_called_once()
        call_args = session_manager.update_status.call_args
        assert call_args[0][0] == "swarm-test123"
        assert call_args[0][1] == SwarmStatus.COMPLETE
        assert call_args[1]["completed_at"] is not None

    @pytest.mark.asyncio
    async def test_fail_swarm_publishes_failed(
        self,
        session_manager: SwarmSessionManager,
        redis_store: SwarmRedisStore,
        registry: ReviewerRegistry,
        config: SwarmConfig,
    ) -> None:
        """Test that SWARM_FAILED is published on failure."""
        publisher = AsyncMock()
        session_manager.update_status = AsyncMock()

        dispatcher = SwarmDispatcher(
            session_manager=session_manager,
            redis_store=redis_store,
            registry=registry,
            config=config,
            coord_publisher=publisher,
        )

        await dispatcher.fail_swarm("swarm-test123", "Critical error occurred")

        # Should have published SWARM_FAILED
        calls = publisher.call_args_list
        failed_calls = [c for c in calls if "SWARM_FAILED" in str(c)]
        assert len(failed_calls) == 1

    @pytest.mark.asyncio
    async def test_fail_swarm_updates_status_to_failed(
        self,
        session_manager: SwarmSessionManager,
        redis_store: SwarmRedisStore,
        registry: ReviewerRegistry,
        config: SwarmConfig,
    ) -> None:
        """Test that fail_swarm updates status to FAILED."""
        session_manager.update_status = AsyncMock()

        dispatcher = SwarmDispatcher(
            session_manager=session_manager,
            redis_store=redis_store,
            registry=registry,
            config=config,
        )

        await dispatcher.fail_swarm("swarm-test123", "Error message")

        session_manager.update_status.assert_called_once_with(
            "swarm-test123", SwarmStatus.FAILED
        )

    @pytest.mark.asyncio
    async def test_noop_publisher_when_none_provided(
        self,
        session_manager: SwarmSessionManager,
        redis_store: SwarmRedisStore,
        registry: ReviewerRegistry,
        config: SwarmConfig,
    ) -> None:
        """Test that dispatcher works without coordination publisher."""
        executor = AsyncMock(return_value=create_mock_result("test"))

        dispatcher = SwarmDispatcher(
            session_manager=session_manager,
            redis_store=redis_store,
            registry=registry,
            config=config,
            review_executor=executor,
            # No coord_publisher
        )

        # Should not raise
        session_id = await dispatcher.dispatch_swarm("src/workers/")
        assert session_id is not None


class TestUpdateSessionStatus:
    """Tests for status update during dispatch."""

    @pytest.mark.asyncio
    async def test_dispatch_updates_status_to_in_progress(
        self,
        session_manager: SwarmSessionManager,
        redis_store: SwarmRedisStore,
        registry: ReviewerRegistry,
        config: SwarmConfig,
    ) -> None:
        """Test that dispatch updates status to IN_PROGRESS."""
        executor = AsyncMock(return_value=create_mock_result("test"))
        session_manager.update_status = AsyncMock()

        dispatcher = SwarmDispatcher(
            session_manager=session_manager,
            redis_store=redis_store,
            registry=registry,
            config=config,
            review_executor=executor,
        )

        await dispatcher.dispatch_swarm("src/workers/")

        # First status update should be IN_PROGRESS
        calls = session_manager.update_status.call_args_list
        in_progress_calls = [
            c for c in calls if c[0][1] == SwarmStatus.IN_PROGRESS
        ]
        assert len(in_progress_calls) >= 1
