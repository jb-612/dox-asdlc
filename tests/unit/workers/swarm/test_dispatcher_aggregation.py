"""Unit tests for SwarmDispatcher aggregation integration.

Tests for the run_swarm() method that integrates dispatch, collection,
aggregation, and finalization into a single flow.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from src.workers.swarm.aggregator import ResultAggregator
from src.workers.swarm.config import SwarmConfig
from src.workers.swarm.dispatcher import SwarmDispatcher
from src.workers.swarm.models import (
    ReviewerResult,
    ReviewFinding,
    Severity,
    SwarmStatus,
    UnifiedReport,
)
from src.workers.swarm.redis_store import SwarmRedisStore
from src.workers.swarm.reviewers.base import ReviewerRegistry
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
        duplicate_similarity_threshold=0.8,
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


@pytest.fixture
def aggregator(config: SwarmConfig) -> ResultAggregator:
    """Create a ResultAggregator."""
    return ResultAggregator(config)


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


def create_finding(
    reviewer_type: str,
    severity: Severity = Severity.MEDIUM,
    line_start: int = 10,
) -> ReviewFinding:
    """Create a test finding."""
    return ReviewFinding(
        id=f"finding-{reviewer_type}-{line_start}",
        reviewer_type=reviewer_type,
        severity=severity,
        category=f"{reviewer_type}/test",
        title=f"Test finding from {reviewer_type}",
        description=f"Description from {reviewer_type}",
        file_path="src/test.py",
        line_start=line_start,
        recommendation="Fix it",
        confidence=0.9,
    )


def create_mock_result(
    reviewer_type: str,
    findings: list[ReviewFinding] | None = None,
) -> ReviewerResult:
    """Create a mock reviewer result."""
    return ReviewerResult(
        reviewer_type=reviewer_type,
        status="success",
        findings=findings or [],
        duration_seconds=1.0,
        files_reviewed=["test.py"],
        error_message=None,
    )


class TestDispatcherAggregatorInit:
    """Tests for SwarmDispatcher initialization with aggregator."""

    def test_init_with_aggregator(
        self,
        session_manager: SwarmSessionManager,
        redis_store: SwarmRedisStore,
        registry: ReviewerRegistry,
        config: SwarmConfig,
        aggregator: ResultAggregator,
    ) -> None:
        """Test that SwarmDispatcher accepts an aggregator."""
        dispatcher = SwarmDispatcher(
            session_manager=session_manager,
            redis_store=redis_store,
            registry=registry,
            config=config,
            aggregator=aggregator,
        )

        assert dispatcher._aggregator is aggregator

    def test_init_creates_default_aggregator(
        self,
        session_manager: SwarmSessionManager,
        redis_store: SwarmRedisStore,
        registry: ReviewerRegistry,
        config: SwarmConfig,
    ) -> None:
        """Test that default aggregator is created when not provided."""
        dispatcher = SwarmDispatcher(
            session_manager=session_manager,
            redis_store=redis_store,
            registry=registry,
            config=config,
        )

        assert dispatcher._aggregator is not None
        assert isinstance(dispatcher._aggregator, ResultAggregator)


class TestRunSwarm:
    """Tests for SwarmDispatcher.run_swarm() full flow."""

    @pytest.mark.asyncio
    async def test_run_swarm_returns_unified_report(
        self,
        session_manager: SwarmSessionManager,
        redis_store: SwarmRedisStore,
        registry: ReviewerRegistry,
        config: SwarmConfig,
        mock_redis: AsyncMock,
    ) -> None:
        """Test that run_swarm returns a UnifiedReport."""
        # Setup mocks
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
        redis_store.get_all_results = AsyncMock(
            return_value={"security": create_mock_result("security")}
        )
        session_manager.update_status = AsyncMock()

        executor = AsyncMock(return_value=create_mock_result("security"))

        dispatcher = SwarmDispatcher(
            session_manager=session_manager,
            redis_store=redis_store,
            registry=registry,
            config=config,
            review_executor=executor,
        )

        report = await dispatcher.run_swarm("src/workers/", reviewer_types=["security"])

        assert isinstance(report, UnifiedReport)
        assert report.target_path == "src/workers/"

    @pytest.mark.asyncio
    async def test_run_swarm_executes_full_flow(
        self,
        session_manager: SwarmSessionManager,
        redis_store: SwarmRedisStore,
        registry: ReviewerRegistry,
        config: SwarmConfig,
        mock_redis: AsyncMock,
    ) -> None:
        """Test that run_swarm executes dispatch -> collect -> aggregate -> finalize."""
        # Setup mocks
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

        findings = [create_finding("security", Severity.HIGH)]
        redis_store.wait_for_completion = AsyncMock(return_value=True)
        redis_store.get_all_results = AsyncMock(
            return_value={"security": create_mock_result("security", findings)}
        )
        session_manager.update_status = AsyncMock()

        executor = AsyncMock(return_value=create_mock_result("security", findings))

        dispatcher = SwarmDispatcher(
            session_manager=session_manager,
            redis_store=redis_store,
            registry=registry,
            config=config,
            review_executor=executor,
        )

        report = await dispatcher.run_swarm("src/workers/", reviewer_types=["security"])

        # Verify flow completed
        assert report.total_findings == 1
        assert len(report.high_findings) == 1
        assert "security" in report.reviewers_completed

    @pytest.mark.asyncio
    async def test_run_swarm_calls_finalize(
        self,
        session_manager: SwarmSessionManager,
        redis_store: SwarmRedisStore,
        registry: ReviewerRegistry,
        config: SwarmConfig,
        mock_redis: AsyncMock,
    ) -> None:
        """Test that run_swarm calls finalize_swarm."""
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
        redis_store.get_all_results = AsyncMock(
            return_value={"security": create_mock_result("security")}
        )
        session_manager.update_status = AsyncMock()

        executor = AsyncMock(return_value=create_mock_result("security"))

        dispatcher = SwarmDispatcher(
            session_manager=session_manager,
            redis_store=redis_store,
            registry=registry,
            config=config,
            review_executor=executor,
        )

        await dispatcher.run_swarm("src/workers/", reviewer_types=["security"])

        # Check finalize was called (status updated to COMPLETE)
        complete_calls = [
            c for c in session_manager.update_status.call_args_list
            if c[0][1] == SwarmStatus.COMPLETE
        ]
        assert len(complete_calls) >= 1

    @pytest.mark.asyncio
    async def test_run_swarm_handles_aggregation_error(
        self,
        session_manager: SwarmSessionManager,
        redis_store: SwarmRedisStore,
        registry: ReviewerRegistry,
        config: SwarmConfig,
        mock_redis: AsyncMock,
    ) -> None:
        """Test that run_swarm calls fail_swarm on error."""
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

        # Make collect_results raise an error
        redis_store.wait_for_completion = AsyncMock(
            side_effect=Exception("Redis connection lost")
        )
        session_manager.update_status = AsyncMock()

        executor = AsyncMock(return_value=create_mock_result("security"))

        dispatcher = SwarmDispatcher(
            session_manager=session_manager,
            redis_store=redis_store,
            registry=registry,
            config=config,
            review_executor=executor,
        )

        with pytest.raises(Exception, match="Redis connection lost"):
            await dispatcher.run_swarm("src/workers/", reviewer_types=["security"])

        # Check fail_swarm was called
        failed_calls = [
            c for c in session_manager.update_status.call_args_list
            if c[0][1] == SwarmStatus.FAILED
        ]
        assert len(failed_calls) >= 1

    @pytest.mark.asyncio
    async def test_run_swarm_publishes_complete_message(
        self,
        session_manager: SwarmSessionManager,
        redis_store: SwarmRedisStore,
        registry: ReviewerRegistry,
        config: SwarmConfig,
        mock_redis: AsyncMock,
    ) -> None:
        """Test that run_swarm publishes SWARM_COMPLETE message."""
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
        redis_store.get_all_results = AsyncMock(
            return_value={"security": create_mock_result("security")}
        )
        session_manager.update_status = AsyncMock()

        publisher = AsyncMock()
        executor = AsyncMock(return_value=create_mock_result("security"))

        dispatcher = SwarmDispatcher(
            session_manager=session_manager,
            redis_store=redis_store,
            registry=registry,
            config=config,
            review_executor=executor,
            coord_publisher=publisher,
        )

        await dispatcher.run_swarm("src/workers/", reviewer_types=["security"])

        # Check SWARM_COMPLETE was published
        complete_calls = [
            c for c in publisher.call_args_list
            if "SWARM_COMPLETE" in str(c)
        ]
        assert len(complete_calls) >= 1

    @pytest.mark.asyncio
    async def test_run_swarm_aggregates_multiple_reviewers(
        self,
        session_manager: SwarmSessionManager,
        redis_store: SwarmRedisStore,
        registry: ReviewerRegistry,
        config: SwarmConfig,
        mock_redis: AsyncMock,
    ) -> None:
        """Test that run_swarm aggregates findings from multiple reviewers."""
        mock_redis.hgetall.return_value = {
            "id": "swarm-test123",
            "target_path": "src/workers/",
            "reviewers": '["security", "performance", "style"]',
            "status": "IN_PROGRESS",
            "created_at": "2026-01-20T12:00:00+00:00",
            "completed_at": "",
            "results": "{}",
            "unified_report": "",
        }

        # Create findings for each reviewer
        security_finding = create_finding("security", Severity.CRITICAL, 10)
        perf_finding = create_finding("performance", Severity.HIGH, 20)
        style_finding = create_finding("style", Severity.LOW, 30)

        redis_store.wait_for_completion = AsyncMock(return_value=True)
        redis_store.get_all_results = AsyncMock(
            return_value={
                "security": create_mock_result("security", [security_finding]),
                "performance": create_mock_result("performance", [perf_finding]),
                "style": create_mock_result("style", [style_finding]),
            }
        )
        session_manager.update_status = AsyncMock()

        call_count = {"n": 0}

        async def mock_executor(session_id, path, reviewer):
            call_count["n"] += 1
            findings = {
                "security": [security_finding],
                "performance": [perf_finding],
                "style": [style_finding],
            }
            return create_mock_result(
                reviewer.reviewer_type,
                findings.get(reviewer.reviewer_type, []),
            )

        dispatcher = SwarmDispatcher(
            session_manager=session_manager,
            redis_store=redis_store,
            registry=registry,
            config=config,
            review_executor=mock_executor,
        )

        report = await dispatcher.run_swarm("src/workers/")

        # Verify all reviewers completed
        assert "security" in report.reviewers_completed
        assert "performance" in report.reviewers_completed
        assert "style" in report.reviewers_completed

        # Verify findings are aggregated
        assert report.total_findings == 3
        assert len(report.critical_findings) == 1
        assert len(report.high_findings) == 1
        assert len(report.low_findings) == 1


class TestRunSwarmWithDuplicates:
    """Tests for run_swarm with duplicate detection."""

    @pytest.mark.asyncio
    async def test_run_swarm_removes_duplicates(
        self,
        session_manager: SwarmSessionManager,
        redis_store: SwarmRedisStore,
        registry: ReviewerRegistry,
        config: SwarmConfig,
        mock_redis: AsyncMock,
    ) -> None:
        """Test that run_swarm removes duplicate findings."""
        mock_redis.hgetall.return_value = {
            "id": "swarm-test123",
            "target_path": "src/workers/",
            "reviewers": '["security", "style"]',
            "status": "IN_PROGRESS",
            "created_at": "2026-01-20T12:00:00+00:00",
            "completed_at": "",
            "results": "{}",
            "unified_report": "",
        }

        # Create duplicate findings (same file, same line, similar title)
        security_finding = ReviewFinding(
            id="finding-sec",
            reviewer_type="security",
            severity=Severity.CRITICAL,
            category="security/injection",
            title="SQL Injection vulnerability in query",
            description="Security perspective",
            file_path="src/test.py",
            line_start=10,
            recommendation="Fix it",
            confidence=0.9,
        )
        style_finding = ReviewFinding(
            id="finding-style",
            reviewer_type="style",
            severity=Severity.MEDIUM,
            category="security/injection",
            title="SQL Injection vulnerability found",
            description="Style perspective",
            file_path="src/test.py",
            line_start=10,
            recommendation="Fix it",
            confidence=0.8,
        )

        redis_store.wait_for_completion = AsyncMock(return_value=True)
        redis_store.get_all_results = AsyncMock(
            return_value={
                "security": create_mock_result("security", [security_finding]),
                "style": create_mock_result("style", [style_finding]),
            }
        )
        session_manager.update_status = AsyncMock()

        async def mock_executor(session_id, path, reviewer):
            if reviewer.reviewer_type == "security":
                return create_mock_result("security", [security_finding])
            return create_mock_result("style", [style_finding])

        dispatcher = SwarmDispatcher(
            session_manager=session_manager,
            redis_store=redis_store,
            registry=registry,
            config=config,
            review_executor=mock_executor,
        )

        report = await dispatcher.run_swarm(
            "src/workers/",
            reviewer_types=["security", "style"],
        )

        # Should have merged duplicates
        assert report.duplicates_removed == 1
        assert report.total_findings == 1
        # Merged finding should have CRITICAL severity
        assert len(report.critical_findings) == 1
        # Merged finding should have both reviewers
        assert "security" in report.critical_findings[0].reviewer_type
        assert "style" in report.critical_findings[0].reviewer_type
