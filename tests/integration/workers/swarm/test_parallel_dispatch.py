"""Integration tests for SwarmDispatcher parallel execution (T22).

Tests the dispatcher's parallel task spawning and coordination including:
- Parallel execution timing verification
- Partial failure handling
- Timeout behavior with partial results
- Coordination message publishing

Requires: Redis running on localhost:6379 (or REDIS_HOST/REDIS_PORT env vars)
"""

from __future__ import annotations

import asyncio
import time
import uuid
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime

import pytest
import redis.asyncio as redis

from src.workers.swarm.aggregator import ResultAggregator
from src.workers.swarm.config import SwarmConfig
from src.workers.swarm.dispatcher import SwarmDispatcher
from src.workers.swarm.models import (
    ReviewerResult,
    Severity,
    SwarmStatus,
)
from src.workers.swarm.redis_store import SwarmRedisStore
from src.workers.swarm.reviewers import ReviewerRegistry, default_registry
from src.workers.swarm.reviewers.base import SpecializedReviewer
from src.workers.swarm.session import SwarmSessionManager

from .conftest import make_finding, make_result, redis_available

# Skip all tests if Redis is not available
pytestmark = pytest.mark.skipif(
    not redis_available(),
    reason="Redis not available for integration tests",
)


@pytest.fixture
def registry() -> ReviewerRegistry:
    """Get the default reviewer registry."""
    return default_registry


class TestParallelExecutionTiming:
    """Tests verifying that tasks execute in parallel."""

    @pytest.mark.asyncio
    async def test_parallel_execution_timing(
        self,
        store: SwarmRedisStore,
        session_manager: SwarmSessionManager,
        registry: ReviewerRegistry,
        config: SwarmConfig,
    ) -> None:
        """Verify tasks start within 500ms of each other."""
        start_times: list[float] = []
        lock = asyncio.Lock()

        async def tracking_executor(
            session_id: str,
            target_path: str,
            reviewer: SpecializedReviewer,
        ) -> ReviewerResult:
            """Executor that tracks start times."""
            async with lock:
                start_times.append(time.time())
            await asyncio.sleep(0.1)  # Simulate work
            return make_result(reviewer.reviewer_type)

        dispatcher = SwarmDispatcher(
            session_manager,
            store,
            registry,
            config,
            review_executor=tracking_executor,
        )

        await dispatcher.dispatch_swarm("src/")

        # All 3 reviewers should start within 500ms of each other
        assert len(start_times) == 3
        time_spread = max(start_times) - min(start_times)
        assert time_spread < 0.5, f"Tasks started {time_spread:.3f}s apart (expected < 0.5s)"

    @pytest.mark.asyncio
    async def test_parallel_execution_faster_than_sequential(
        self,
        store: SwarmRedisStore,
        session_manager: SwarmSessionManager,
        registry: ReviewerRegistry,
        config: SwarmConfig,
    ) -> None:
        """Verify parallel execution is faster than sequential would be."""
        task_duration = 0.1
        num_reviewers = 3

        async def slow_executor(
            session_id: str,
            target_path: str,
            reviewer: SpecializedReviewer,
        ) -> ReviewerResult:
            """Executor that takes fixed time."""
            await asyncio.sleep(task_duration)
            return make_result(reviewer.reviewer_type)

        dispatcher = SwarmDispatcher(
            session_manager,
            store,
            registry,
            config,
            review_executor=slow_executor,
        )

        start_time = time.time()
        await dispatcher.dispatch_swarm("src/")
        elapsed = time.time() - start_time

        # Sequential would take 3 * 0.1 = 0.3s minimum
        # Parallel should take roughly 0.1s (plus overhead)
        sequential_time = task_duration * num_reviewers
        assert elapsed < sequential_time, (
            f"Execution took {elapsed:.3f}s, which is not faster than "
            f"sequential ({sequential_time:.3f}s)"
        )

    @pytest.mark.asyncio
    async def test_all_reviewers_called(
        self,
        store: SwarmRedisStore,
        session_manager: SwarmSessionManager,
        registry: ReviewerRegistry,
        config: SwarmConfig,
    ) -> None:
        """Verify all configured reviewers are called."""
        called_reviewers: list[str] = []
        lock = asyncio.Lock()

        async def tracking_executor(
            session_id: str,
            target_path: str,
            reviewer: SpecializedReviewer,
        ) -> ReviewerResult:
            """Executor that tracks which reviewers are called."""
            async with lock:
                called_reviewers.append(reviewer.reviewer_type)
            return make_result(reviewer.reviewer_type)

        dispatcher = SwarmDispatcher(
            session_manager,
            store,
            registry,
            config,
            review_executor=tracking_executor,
        )

        await dispatcher.dispatch_swarm("src/")

        assert sorted(called_reviewers) == sorted(config.default_reviewers)


class TestPartialFailureHandling:
    """Tests for handling partial failures in swarm execution."""

    @pytest.mark.asyncio
    async def test_partial_failure_does_not_stop_others(
        self,
        store: SwarmRedisStore,
        session_manager: SwarmSessionManager,
        registry: ReviewerRegistry,
        config: SwarmConfig,
    ) -> None:
        """One reviewer failure should not stop others."""
        call_count: dict[str, int] = {rt: 0 for rt in config.default_reviewers}
        lock = asyncio.Lock()

        async def failing_executor(
            session_id: str,
            target_path: str,
            reviewer: SpecializedReviewer,
        ) -> ReviewerResult:
            """Executor where security reviewer fails."""
            async with lock:
                call_count[reviewer.reviewer_type] += 1

            if reviewer.reviewer_type == "security":
                raise Exception("Security review failed")

            return make_result(reviewer.reviewer_type)

        dispatcher = SwarmDispatcher(
            session_manager,
            store,
            registry,
            config,
            review_executor=failing_executor,
        )

        session_id = await dispatcher.dispatch_swarm("src/")

        # All reviewers should have been called
        assert all(count == 1 for count in call_count.values()), (
            f"Not all reviewers called: {call_count}"
        )

        # Results should be stored for all reviewers
        results = await store.get_all_results(session_id)
        assert len(results) == 3

        # Security should be failed
        assert results["security"].status == "failed"
        assert "Security review failed" in (results["security"].error_message or "")

        # Others should succeed
        assert results["performance"].status == "success"
        assert results["style"].status == "success"

    @pytest.mark.asyncio
    async def test_multiple_failures_handled(
        self,
        store: SwarmRedisStore,
        session_manager: SwarmSessionManager,
        registry: ReviewerRegistry,
        config: SwarmConfig,
    ) -> None:
        """Multiple reviewer failures should all be recorded."""

        async def multi_failing_executor(
            session_id: str,
            target_path: str,
            reviewer: SpecializedReviewer,
        ) -> ReviewerResult:
            """Executor where multiple reviewers fail."""
            if reviewer.reviewer_type in ["security", "performance"]:
                raise Exception(f"{reviewer.reviewer_type} failed")
            return make_result(reviewer.reviewer_type)

        dispatcher = SwarmDispatcher(
            session_manager,
            store,
            registry,
            config,
            review_executor=multi_failing_executor,
        )

        session_id = await dispatcher.dispatch_swarm("src/")
        results = await store.get_all_results(session_id)

        # Two should be failed
        failed = [rt for rt, r in results.items() if r.status == "failed"]
        assert len(failed) == 2
        assert "security" in failed
        assert "performance" in failed

        # Style should succeed
        assert results["style"].status == "success"

    @pytest.mark.asyncio
    async def test_all_failures_recorded(
        self,
        store: SwarmRedisStore,
        session_manager: SwarmSessionManager,
        registry: ReviewerRegistry,
        config: SwarmConfig,
    ) -> None:
        """All reviewers failing should still record results."""

        async def all_failing_executor(
            session_id: str,
            target_path: str,
            reviewer: SpecializedReviewer,
        ) -> ReviewerResult:
            """Executor where all reviewers fail."""
            raise Exception(f"{reviewer.reviewer_type} crashed")

        dispatcher = SwarmDispatcher(
            session_manager,
            store,
            registry,
            config,
            review_executor=all_failing_executor,
        )

        session_id = await dispatcher.dispatch_swarm("src/")
        results = await store.get_all_results(session_id)

        # All should be failed
        assert len(results) == 3
        assert all(r.status == "failed" for r in results.values())


class TestTimeoutHandling:
    """Tests for timeout behavior during swarm execution."""

    @pytest.mark.asyncio
    async def test_timeout_returns_partial_results(
        self,
        store: SwarmRedisStore,
        session_manager: SwarmSessionManager,
        registry: ReviewerRegistry,
    ) -> None:
        """Timeout should return without hanging, with partial results available."""
        # Config with short timeout
        short_config = SwarmConfig(
            key_prefix=f"timeout_test_{uuid.uuid4().hex[:8]}",
            result_ttl_seconds=60,
            task_timeout_seconds=1,
        )
        timeout_store = SwarmRedisStore(store._redis, short_config)
        timeout_session_manager = SwarmSessionManager(timeout_store, short_config)

        completed: dict[str, bool] = {}
        lock = asyncio.Lock()

        async def slow_executor(
            session_id: str,
            target_path: str,
            reviewer: SpecializedReviewer,
        ) -> ReviewerResult:
            """Executor where one reviewer is very slow."""
            if reviewer.reviewer_type == "security":
                await asyncio.sleep(10)  # Very slow
            else:
                await asyncio.sleep(0.1)
            async with lock:
                completed[reviewer.reviewer_type] = True
            return make_result(reviewer.reviewer_type)

        dispatcher = SwarmDispatcher(
            timeout_session_manager,
            timeout_store,
            registry,
            short_config,
            review_executor=slow_executor,
        )

        start = time.time()
        session_id = await dispatcher.dispatch_swarm("src/", timeout_seconds=1)
        elapsed = time.time() - start

        # Should not have waited 10 seconds
        assert elapsed < 5, f"Dispatch took {elapsed:.1f}s (expected < 5s)"

        # Fast reviewers should have completed
        results = await timeout_store.get_all_results(session_id)

        # At least the fast ones should be there
        assert "performance" in results or "style" in results

    @pytest.mark.asyncio
    async def test_timeout_does_not_crash(
        self,
        store: SwarmRedisStore,
        session_manager: SwarmSessionManager,
        registry: ReviewerRegistry,
    ) -> None:
        """Timeout should not raise exception."""
        short_config = SwarmConfig(
            key_prefix=f"no_crash_{uuid.uuid4().hex[:8]}",
            result_ttl_seconds=60,
            task_timeout_seconds=1,
        )
        timeout_store = SwarmRedisStore(store._redis, short_config)
        timeout_session_manager = SwarmSessionManager(timeout_store, short_config)

        async def hang_executor(
            session_id: str,
            target_path: str,
            reviewer: SpecializedReviewer,
        ) -> ReviewerResult:
            """Executor that hangs."""
            await asyncio.sleep(100)
            return make_result(reviewer.reviewer_type)

        dispatcher = SwarmDispatcher(
            timeout_session_manager,
            timeout_store,
            registry,
            short_config,
            review_executor=hang_executor,
        )

        # Should not raise
        session_id = await dispatcher.dispatch_swarm("src/", timeout_seconds=0.5)

        # Session should exist
        session = await timeout_session_manager.get_session(session_id)
        assert session is not None


class TestCoordinationMessagePublishing:
    """Tests for coordination message publishing during swarm lifecycle."""

    @pytest.mark.asyncio
    async def test_swarm_started_message_published(
        self,
        store: SwarmRedisStore,
        session_manager: SwarmSessionManager,
        registry: ReviewerRegistry,
        config: SwarmConfig,
    ) -> None:
        """Verify SWARM_STARTED message is published."""
        published_messages: list[tuple[str, str, str]] = []
        lock = asyncio.Lock()

        async def capture_publisher(
            msg_type: str, subject: str, description: str
        ) -> None:
            async with lock:
                published_messages.append((msg_type, subject, description))

        async def quick_executor(
            session_id: str,
            target_path: str,
            reviewer: SpecializedReviewer,
        ) -> ReviewerResult:
            return make_result(reviewer.reviewer_type)

        dispatcher = SwarmDispatcher(
            session_manager,
            store,
            registry,
            config,
            review_executor=quick_executor,
            coord_publisher=capture_publisher,
        )

        await dispatcher.dispatch_swarm("src/workers/")

        # Find SWARM_STARTED message
        started_msgs = [m for m in published_messages if m[0] == "SWARM_STARTED"]
        assert len(started_msgs) == 1
        assert "src/workers/" in started_msgs[0][2]

    @pytest.mark.asyncio
    async def test_reviewer_complete_messages_published(
        self,
        store: SwarmRedisStore,
        session_manager: SwarmSessionManager,
        registry: ReviewerRegistry,
        config: SwarmConfig,
    ) -> None:
        """Verify SWARM_REVIEWER_COMPLETE message is published for each reviewer."""
        published_messages: list[tuple[str, str, str]] = []
        lock = asyncio.Lock()

        async def capture_publisher(
            msg_type: str, subject: str, description: str
        ) -> None:
            async with lock:
                published_messages.append((msg_type, subject, description))

        async def quick_executor(
            session_id: str,
            target_path: str,
            reviewer: SpecializedReviewer,
        ) -> ReviewerResult:
            return make_result(reviewer.reviewer_type)

        dispatcher = SwarmDispatcher(
            session_manager,
            store,
            registry,
            config,
            review_executor=quick_executor,
            coord_publisher=capture_publisher,
        )

        await dispatcher.dispatch_swarm("src/")

        # Find SWARM_REVIEWER_COMPLETE messages
        complete_msgs = [
            m for m in published_messages
            if m[0] == "SWARM_REVIEWER_COMPLETE"
        ]
        assert len(complete_msgs) == 3

        # Check each reviewer is mentioned
        subjects = [m[1] for m in complete_msgs]
        assert any("security" in s for s in subjects)
        assert any("performance" in s for s in subjects)
        assert any("style" in s for s in subjects)

    @pytest.mark.asyncio
    async def test_swarm_complete_message_published(
        self,
        store: SwarmRedisStore,
        session_manager: SwarmSessionManager,
        registry: ReviewerRegistry,
        config: SwarmConfig,
    ) -> None:
        """Verify SWARM_COMPLETE message is published after full flow."""
        published_messages: list[tuple[str, str, str]] = []
        lock = asyncio.Lock()

        async def capture_publisher(
            msg_type: str, subject: str, description: str
        ) -> None:
            async with lock:
                published_messages.append((msg_type, subject, description))

        async def quick_executor(
            session_id: str,
            target_path: str,
            reviewer: SpecializedReviewer,
        ) -> ReviewerResult:
            return make_result(reviewer.reviewer_type)

        dispatcher = SwarmDispatcher(
            session_manager,
            store,
            registry,
            config,
            review_executor=quick_executor,
            coord_publisher=capture_publisher,
        )

        # Run full swarm flow (not just dispatch)
        await dispatcher.run_swarm("src/")

        # Find SWARM_COMPLETE message
        complete_msgs = [m for m in published_messages if m[0] == "SWARM_COMPLETE"]
        assert len(complete_msgs) == 1

    @pytest.mark.asyncio
    async def test_swarm_failed_message_on_error(
        self,
        store: SwarmRedisStore,
        session_manager: SwarmSessionManager,
        registry: ReviewerRegistry,
        config: SwarmConfig,
    ) -> None:
        """Verify SWARM_FAILED message is published on aggregation error."""
        published_messages: list[tuple[str, str, str]] = []
        lock = asyncio.Lock()

        async def capture_publisher(
            msg_type: str, subject: str, description: str
        ) -> None:
            async with lock:
                published_messages.append((msg_type, subject, description))

        async def quick_executor(
            session_id: str,
            target_path: str,
            reviewer: SpecializedReviewer,
        ) -> ReviewerResult:
            return make_result(reviewer.reviewer_type)

        # Create aggregator that raises
        class FailingAggregator(ResultAggregator):
            def aggregate(self, session, results):
                raise Exception("Aggregation failed")

        dispatcher = SwarmDispatcher(
            session_manager,
            store,
            registry,
            config,
            review_executor=quick_executor,
            coord_publisher=capture_publisher,
            aggregator=FailingAggregator(config),
        )

        # Run full swarm - should raise but publish FAILED message
        with pytest.raises(Exception, match="Aggregation failed"):
            await dispatcher.run_swarm("src/")

        # Find SWARM_FAILED message
        failed_msgs = [m for m in published_messages if m[0] == "SWARM_FAILED"]
        assert len(failed_msgs) == 1
        assert "Aggregation failed" in failed_msgs[0][2]

    @pytest.mark.asyncio
    async def test_message_sequence_is_correct(
        self,
        store: SwarmRedisStore,
        session_manager: SwarmSessionManager,
        registry: ReviewerRegistry,
        config: SwarmConfig,
    ) -> None:
        """Verify messages are published in correct order."""
        published_messages: list[tuple[str, str, str]] = []
        lock = asyncio.Lock()

        async def capture_publisher(
            msg_type: str, subject: str, description: str
        ) -> None:
            async with lock:
                published_messages.append((msg_type, subject, description))

        async def quick_executor(
            session_id: str,
            target_path: str,
            reviewer: SpecializedReviewer,
        ) -> ReviewerResult:
            return make_result(reviewer.reviewer_type)

        dispatcher = SwarmDispatcher(
            session_manager,
            store,
            registry,
            config,
            review_executor=quick_executor,
            coord_publisher=capture_publisher,
        )

        await dispatcher.run_swarm("src/")

        # Extract message types
        msg_types = [m[0] for m in published_messages]

        # SWARM_STARTED should be first
        assert msg_types[0] == "SWARM_STARTED"

        # SWARM_COMPLETE should be last
        assert msg_types[-1] == "SWARM_COMPLETE"

        # SWARM_REVIEWER_COMPLETE should be in between
        reviewer_completes = [t for t in msg_types if t == "SWARM_REVIEWER_COMPLETE"]
        assert len(reviewer_completes) == 3


class TestResultCollection:
    """Tests for result collection after dispatch."""

    @pytest.mark.asyncio
    async def test_collect_results_returns_all_results(
        self,
        store: SwarmRedisStore,
        session_manager: SwarmSessionManager,
        registry: ReviewerRegistry,
        config: SwarmConfig,
    ) -> None:
        """Test that collect_results returns all reviewer results."""

        async def quick_executor(
            session_id: str,
            target_path: str,
            reviewer: SpecializedReviewer,
        ) -> ReviewerResult:
            finding = make_finding(
                reviewer_type=reviewer.reviewer_type,
                severity=Severity.MEDIUM,
            )
            return make_result(reviewer.reviewer_type, findings=[finding])

        dispatcher = SwarmDispatcher(
            session_manager,
            store,
            registry,
            config,
            review_executor=quick_executor,
        )

        session_id = await dispatcher.dispatch_swarm("src/")
        results = await dispatcher.collect_results(session_id)

        assert len(results) == 3
        assert all(r.status == "success" for r in results.values())
        assert all(len(r.findings) == 1 for r in results.values())

    @pytest.mark.asyncio
    async def test_collect_results_updates_status_to_aggregating(
        self,
        store: SwarmRedisStore,
        session_manager: SwarmSessionManager,
        registry: ReviewerRegistry,
        config: SwarmConfig,
    ) -> None:
        """Test that collect_results updates session status."""

        async def quick_executor(
            session_id: str,
            target_path: str,
            reviewer: SpecializedReviewer,
        ) -> ReviewerResult:
            return make_result(reviewer.reviewer_type)

        dispatcher = SwarmDispatcher(
            session_manager,
            store,
            registry,
            config,
            review_executor=quick_executor,
        )

        session_id = await dispatcher.dispatch_swarm("src/")
        await dispatcher.collect_results(session_id)

        session = await session_manager.get_session(session_id)
        assert session is not None
        assert session.status == SwarmStatus.AGGREGATING


class TestFullSwarmFlow:
    """Tests for the complete swarm flow."""

    @pytest.mark.asyncio
    async def test_run_swarm_returns_unified_report(
        self,
        store: SwarmRedisStore,
        session_manager: SwarmSessionManager,
        registry: ReviewerRegistry,
        config: SwarmConfig,
    ) -> None:
        """Test that run_swarm returns a complete UnifiedReport."""
        # Use different files/lines for each reviewer to avoid duplicate detection
        file_counter = [0]

        async def executor_with_findings(
            session_id: str,
            target_path: str,
            reviewer: SpecializedReviewer,
        ) -> ReviewerResult:
            file_counter[0] += 1
            finding = make_finding(
                reviewer_type=reviewer.reviewer_type,
                severity=Severity.HIGH if reviewer.reviewer_type == "security" else Severity.MEDIUM,
                file_path=f"src/file_{file_counter[0]}.py",  # Different files
                line_start=file_counter[0] * 100,  # Different lines
                title=f"{reviewer.reviewer_type.title()} Finding",  # Different titles
            )
            return make_result(reviewer.reviewer_type, findings=[finding])

        dispatcher = SwarmDispatcher(
            session_manager,
            store,
            registry,
            config,
            review_executor=executor_with_findings,
        )

        report = await dispatcher.run_swarm("src/test/")

        assert report.target_path == "src/test/"
        # With different files/lines/titles, no duplicates should be detected
        assert report.total_findings == 3
        assert len(report.reviewers_completed) == 3
        assert len(report.reviewers_failed) == 0

    @pytest.mark.asyncio
    async def test_run_swarm_with_custom_reviewers(
        self,
        store: SwarmRedisStore,
        session_manager: SwarmSessionManager,
        registry: ReviewerRegistry,
        config: SwarmConfig,
    ) -> None:
        """Test run_swarm with custom reviewer list."""
        called_reviewers: list[str] = []
        lock = asyncio.Lock()

        async def tracking_executor(
            session_id: str,
            target_path: str,
            reviewer: SpecializedReviewer,
        ) -> ReviewerResult:
            async with lock:
                called_reviewers.append(reviewer.reviewer_type)
            return make_result(reviewer.reviewer_type)

        dispatcher = SwarmDispatcher(
            session_manager,
            store,
            registry,
            config,
            review_executor=tracking_executor,
        )

        await dispatcher.run_swarm("src/", reviewer_types=["security", "style"])

        assert sorted(called_reviewers) == ["security", "style"]

    @pytest.mark.asyncio
    async def test_run_swarm_session_marked_complete(
        self,
        store: SwarmRedisStore,
        session_manager: SwarmSessionManager,
        registry: ReviewerRegistry,
        config: SwarmConfig,
    ) -> None:
        """Test that session is marked COMPLETE after run_swarm."""
        session_ids: list[str] = []
        lock = asyncio.Lock()

        async def capture_executor(
            session_id: str,
            target_path: str,
            reviewer: SpecializedReviewer,
        ) -> ReviewerResult:
            async with lock:
                if session_id not in session_ids:
                    session_ids.append(session_id)
            return make_result(reviewer.reviewer_type)

        dispatcher = SwarmDispatcher(
            session_manager,
            store,
            registry,
            config,
            review_executor=capture_executor,
        )

        await dispatcher.run_swarm("src/")

        assert len(session_ids) == 1
        session = await session_manager.get_session(session_ids[0])
        assert session is not None
        assert session.status == SwarmStatus.COMPLETE
