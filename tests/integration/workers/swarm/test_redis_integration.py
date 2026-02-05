"""Integration tests for SwarmRedisStore with real Redis (T21).

Tests the Redis storage layer with actual Redis connections to verify:
- Session CRUD operations
- Result storage and retrieval
- TTL expiration behavior
- Atomic operations under concurrent access
- Completion waiting with real polling

Requires: Redis running on localhost:6379 (or REDIS_HOST/REDIS_PORT env vars)
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, datetime

import pytest
import redis.asyncio as redis

from src.workers.swarm.config import SwarmConfig
from src.workers.swarm.models import (
    ReviewerResult,
    Severity,
    SwarmSession,
    SwarmStatus,
)
from src.workers.swarm.redis_store import SwarmRedisStore

from .conftest import make_finding, make_result, redis_available

# Skip all tests if Redis is not available
pytestmark = pytest.mark.skipif(
    not redis_available(),
    reason="Redis not available for integration tests",
)


class TestSessionCRUD:
    """Integration tests for session create, read, update operations."""

    @pytest.mark.asyncio
    async def test_create_and_read_session(
        self,
        store: SwarmRedisStore,
        sample_session: SwarmSession,
    ) -> None:
        """Test creating and retrieving a session with real Redis."""
        # Create session
        await store.create_session(sample_session)

        # Read back
        retrieved = await store.get_session(sample_session.id)

        # Verify
        assert retrieved is not None
        assert retrieved.id == sample_session.id
        assert retrieved.target_path == sample_session.target_path
        assert retrieved.reviewers == sample_session.reviewers
        assert retrieved.status == SwarmStatus.PENDING

    @pytest.mark.asyncio
    async def test_session_not_found_returns_none(
        self,
        store: SwarmRedisStore,
    ) -> None:
        """Test that getting a non-existent session returns None."""
        result = await store.get_session("swarm-nonexistent-id")
        assert result is None

    @pytest.mark.asyncio
    async def test_update_session_status(
        self,
        store: SwarmRedisStore,
        sample_session: SwarmSession,
    ) -> None:
        """Test updating session status with real Redis."""
        # Create session
        await store.create_session(sample_session)

        # Update status
        await store.update_session_status(sample_session.id, SwarmStatus.IN_PROGRESS)

        # Verify update
        retrieved = await store.get_session(sample_session.id)
        assert retrieved is not None
        assert retrieved.status == SwarmStatus.IN_PROGRESS

    @pytest.mark.asyncio
    async def test_update_session_status_to_complete(
        self,
        store: SwarmRedisStore,
        sample_session: SwarmSession,
    ) -> None:
        """Test updating session status through full lifecycle."""
        # Create session
        await store.create_session(sample_session)

        # Progress through statuses
        for status in [SwarmStatus.IN_PROGRESS, SwarmStatus.AGGREGATING, SwarmStatus.COMPLETE]:
            await store.update_session_status(sample_session.id, status)
            retrieved = await store.get_session(sample_session.id)
            assert retrieved is not None
            assert retrieved.status == status

    @pytest.mark.asyncio
    async def test_update_session_status_to_failed(
        self,
        store: SwarmRedisStore,
        sample_session: SwarmSession,
    ) -> None:
        """Test updating session status to FAILED."""
        # Create session
        await store.create_session(sample_session)
        await store.update_session_status(sample_session.id, SwarmStatus.IN_PROGRESS)

        # Update to FAILED
        await store.update_session_status(sample_session.id, SwarmStatus.FAILED)

        # Verify
        retrieved = await store.get_session(sample_session.id)
        assert retrieved is not None
        assert retrieved.status == SwarmStatus.FAILED

    @pytest.mark.asyncio
    async def test_session_preserves_reviewers_list(
        self,
        store: SwarmRedisStore,
        config: SwarmConfig,
    ) -> None:
        """Test that session correctly stores and retrieves reviewers list."""
        session = SwarmSession(
            id=f"swarm-{uuid.uuid4().hex[:8]}",
            target_path="src/",
            reviewers=["security", "performance", "style", "custom"],
            status=SwarmStatus.PENDING,
            created_at=datetime.now(UTC),
        )

        await store.create_session(session)
        retrieved = await store.get_session(session.id)

        assert retrieved is not None
        assert retrieved.reviewers == ["security", "performance", "style", "custom"]


class TestResultStorageAndRetrieval:
    """Integration tests for storing and retrieving reviewer results."""

    @pytest.mark.asyncio
    async def test_store_and_retrieve_single_result(
        self,
        store: SwarmRedisStore,
        sample_session: SwarmSession,
        sample_result: ReviewerResult,
    ) -> None:
        """Test storing and retrieving a single reviewer result."""
        # Create session
        await store.create_session(sample_session)

        # Store result
        await store.store_reviewer_result(
            sample_session.id, sample_result.reviewer_type, sample_result
        )

        # Retrieve result
        retrieved = await store.get_reviewer_result(
            sample_session.id, sample_result.reviewer_type
        )

        assert retrieved is not None
        assert retrieved.reviewer_type == sample_result.reviewer_type
        assert retrieved.status == "success"
        assert len(retrieved.findings) == 1
        assert retrieved.duration_seconds == sample_result.duration_seconds

    @pytest.mark.asyncio
    async def test_store_multiple_results(
        self,
        store: SwarmRedisStore,
        sample_session: SwarmSession,
    ) -> None:
        """Test storing results from multiple reviewers."""
        await store.create_session(sample_session)

        # Store results from each reviewer
        results = {
            "security": make_result("security", findings=[make_finding("security")]),
            "performance": make_result("performance", findings=[make_finding("performance")]),
            "style": make_result("style", findings=[make_finding("style")]),
        }

        for reviewer_type, result in results.items():
            await store.store_reviewer_result(sample_session.id, reviewer_type, result)

        # Retrieve all results
        all_results = await store.get_all_results(sample_session.id)

        assert len(all_results) == 3
        assert "security" in all_results
        assert "performance" in all_results
        assert "style" in all_results

    @pytest.mark.asyncio
    async def test_get_all_results_empty_when_none_stored(
        self,
        store: SwarmRedisStore,
        sample_session: SwarmSession,
    ) -> None:
        """Test that get_all_results returns empty dict when no results stored."""
        await store.create_session(sample_session)

        results = await store.get_all_results(sample_session.id)

        assert results == {}

    @pytest.mark.asyncio
    async def test_result_not_found_returns_none(
        self,
        store: SwarmRedisStore,
        sample_session: SwarmSession,
    ) -> None:
        """Test that getting a non-existent result returns None."""
        await store.create_session(sample_session)

        result = await store.get_reviewer_result(sample_session.id, "nonexistent")

        assert result is None

    @pytest.mark.asyncio
    async def test_result_with_findings_preserves_data(
        self,
        store: SwarmRedisStore,
        sample_session: SwarmSession,
    ) -> None:
        """Test that findings data is preserved through storage cycle."""
        await store.create_session(sample_session)

        finding = make_finding(
            reviewer_type="security",
            severity=Severity.HIGH,
            title="SQL Injection",
            file_path="src/db.py",
            line_start=42,
        )
        result = make_result("security", findings=[finding])

        await store.store_reviewer_result(sample_session.id, "security", result)
        retrieved = await store.get_reviewer_result(sample_session.id, "security")

        assert retrieved is not None
        assert len(retrieved.findings) == 1
        retrieved_finding = retrieved.findings[0]
        assert retrieved_finding.title == "SQL Injection"
        assert retrieved_finding.file_path == "src/db.py"
        assert retrieved_finding.line_start == 42

    @pytest.mark.asyncio
    async def test_store_failed_result(
        self,
        store: SwarmRedisStore,
        sample_session: SwarmSession,
    ) -> None:
        """Test storing a failed reviewer result."""
        await store.create_session(sample_session)

        failed_result = make_result(
            "security",
            status="failed",
            error="Connection timeout to LLM API",
        )

        await store.store_reviewer_result(sample_session.id, "security", failed_result)
        retrieved = await store.get_reviewer_result(sample_session.id, "security")

        assert retrieved is not None
        assert retrieved.status == "failed"
        assert retrieved.error_message == "Connection timeout to LLM API"


class TestTTLExpiration:
    """Integration tests for TTL expiration behavior."""

    @pytest.mark.asyncio
    async def test_session_has_ttl_set(
        self,
        store: SwarmRedisStore,
        redis_client: redis.Redis,
        config: SwarmConfig,
        sample_session: SwarmSession,
    ) -> None:
        """Test that session keys have TTL set after creation."""
        await store.create_session(sample_session)

        session_key = f"{config.key_prefix}:session:{sample_session.id}"
        ttl = await redis_client.ttl(session_key)

        # TTL should be positive and close to configured value
        assert ttl > 0
        assert ttl <= config.result_ttl_seconds

    @pytest.mark.asyncio
    async def test_result_keys_have_ttl(
        self,
        store: SwarmRedisStore,
        redis_client: redis.Redis,
        config: SwarmConfig,
        sample_session: SwarmSession,
        sample_result: ReviewerResult,
    ) -> None:
        """Test that result and progress keys have TTL set."""
        await store.create_session(sample_session)
        await store.store_reviewer_result(
            sample_session.id, sample_result.reviewer_type, sample_result
        )

        results_key = f"{config.key_prefix}:results:{sample_session.id}"
        progress_key = f"{config.key_prefix}:progress:{sample_session.id}"

        results_ttl = await redis_client.ttl(results_key)
        progress_ttl = await redis_client.ttl(progress_key)

        assert results_ttl > 0
        assert progress_ttl > 0

    @pytest.mark.asyncio
    async def test_short_ttl_expiration(
        self,
        redis_client: redis.Redis,
    ) -> None:
        """Test that keys expire after short TTL."""
        # Create config with very short TTL
        short_config = SwarmConfig(
            key_prefix=f"ttl_test_{uuid.uuid4().hex[:8]}",
            result_ttl_seconds=1,  # 1 second TTL
        )
        store = SwarmRedisStore(redis_client, short_config)

        session = SwarmSession(
            id=f"swarm-{uuid.uuid4().hex[:8]}",
            target_path="src/",
            reviewers=["security"],
            status=SwarmStatus.PENDING,
            created_at=datetime.now(UTC),
        )

        await store.create_session(session)

        # Verify key exists
        assert await store.get_session(session.id) is not None

        # Wait for expiration
        await asyncio.sleep(1.5)

        # Verify key is gone
        assert await store.get_session(session.id) is None


class TestConcurrentAccess:
    """Integration tests for concurrent operations."""

    @pytest.mark.asyncio
    async def test_concurrent_session_creations(
        self,
        redis_client: redis.Redis,
        config: SwarmConfig,
    ) -> None:
        """Test that concurrent session creations don't interfere."""
        store = SwarmRedisStore(redis_client, config)

        # Create multiple sessions concurrently
        sessions = [
            SwarmSession(
                id=f"swarm-concurrent-{i}-{uuid.uuid4().hex[:8]}",
                target_path=f"src/module_{i}/",
                reviewers=["security", "performance"],
                status=SwarmStatus.PENDING,
                created_at=datetime.now(UTC),
            )
            for i in range(10)
        ]

        # Create all sessions concurrently
        await asyncio.gather(*[store.create_session(s) for s in sessions])

        # Verify all sessions were created
        for session in sessions:
            retrieved = await store.get_session(session.id)
            assert retrieved is not None
            assert retrieved.id == session.id
            assert retrieved.target_path == session.target_path

    @pytest.mark.asyncio
    async def test_concurrent_result_storage(
        self,
        store: SwarmRedisStore,
        sample_session: SwarmSession,
    ) -> None:
        """Test storing results concurrently from multiple reviewers."""
        await store.create_session(sample_session)

        # Create results for concurrent storage
        results = [
            make_result(f"reviewer_{i}", findings=[make_finding(f"reviewer_{i}")])
            for i in range(5)
        ]

        # Store all results concurrently
        await asyncio.gather(*[
            store.store_reviewer_result(sample_session.id, r.reviewer_type, r)
            for r in results
        ])

        # Verify all results were stored
        all_results = await store.get_all_results(sample_session.id)
        assert len(all_results) == 5

    @pytest.mark.asyncio
    async def test_concurrent_status_updates(
        self,
        redis_client: redis.Redis,
        config: SwarmConfig,
    ) -> None:
        """Test concurrent status updates on different sessions."""
        store = SwarmRedisStore(redis_client, config)

        # Create multiple sessions
        sessions = [
            SwarmSession(
                id=f"swarm-status-{i}-{uuid.uuid4().hex[:8]}",
                target_path=f"src/{i}/",
                reviewers=["security"],
                status=SwarmStatus.PENDING,
                created_at=datetime.now(UTC),
            )
            for i in range(5)
        ]

        for session in sessions:
            await store.create_session(session)

        # Update all statuses concurrently
        await asyncio.gather(*[
            store.update_session_status(s.id, SwarmStatus.IN_PROGRESS)
            for s in sessions
        ])

        # Verify all updates succeeded
        for session in sessions:
            retrieved = await store.get_session(session.id)
            assert retrieved is not None
            assert retrieved.status == SwarmStatus.IN_PROGRESS

    @pytest.mark.asyncio
    async def test_atomic_progress_tracking(
        self,
        store: SwarmRedisStore,
        sample_session: SwarmSession,
    ) -> None:
        """Test that progress set is updated atomically under concurrency."""
        await store.create_session(sample_session)

        # Store results concurrently and check progress
        reviewers = ["security", "performance", "style"]
        results = [make_result(rt) for rt in reviewers]

        # Store all concurrently
        await asyncio.gather(*[
            store.store_reviewer_result(sample_session.id, r.reviewer_type, r)
            for r in results
        ])

        # Verify progress set has all reviewers
        completed = await store.get_completed_reviewers(sample_session.id)
        assert completed == {"security", "performance", "style"}


class TestCompletionWaiting:
    """Integration tests for wait_for_completion with real Redis."""

    @pytest.mark.asyncio
    async def test_wait_for_completion_immediate_success(
        self,
        store: SwarmRedisStore,
        sample_session: SwarmSession,
    ) -> None:
        """Test wait_for_completion when all reviewers are already complete."""
        await store.create_session(sample_session)

        # Store all results first
        for reviewer in sample_session.reviewers:
            result = make_result(reviewer)
            await store.store_reviewer_result(sample_session.id, reviewer, result)

        # Wait should return immediately
        completed = await store.wait_for_completion(
            sample_session.id,
            sample_session.reviewers,
            timeout_seconds=5,
            poll_interval=0.1,
        )

        assert completed is True

    @pytest.mark.asyncio
    async def test_wait_for_completion_with_gradual_results(
        self,
        store: SwarmRedisStore,
        sample_session: SwarmSession,
    ) -> None:
        """Test wait_for_completion as results arrive gradually."""
        await store.create_session(sample_session)

        async def store_results_gradually():
            """Simulate reviewers completing at different times."""
            for i, reviewer in enumerate(sample_session.reviewers):
                await asyncio.sleep(0.1 * (i + 1))
                result = make_result(reviewer)
                await store.store_reviewer_result(sample_session.id, reviewer, result)

        # Start storing results in background
        store_task = asyncio.create_task(store_results_gradually())

        # Wait for completion
        completed = await store.wait_for_completion(
            sample_session.id,
            sample_session.reviewers,
            timeout_seconds=5,
            poll_interval=0.05,
        )

        await store_task  # Ensure task completes
        assert completed is True

    @pytest.mark.asyncio
    async def test_wait_for_completion_timeout(
        self,
        store: SwarmRedisStore,
        sample_session: SwarmSession,
    ) -> None:
        """Test wait_for_completion returns False on timeout."""
        await store.create_session(sample_session)

        # Only store one result
        result = make_result("security")
        await store.store_reviewer_result(sample_session.id, "security", result)

        # Wait should timeout since not all reviewers complete
        completed = await store.wait_for_completion(
            sample_session.id,
            sample_session.reviewers,  # Expects 3 reviewers
            timeout_seconds=0.3,
            poll_interval=0.1,
        )

        assert completed is False

    @pytest.mark.asyncio
    async def test_wait_for_completion_partial_results(
        self,
        store: SwarmRedisStore,
        sample_session: SwarmSession,
    ) -> None:
        """Test wait returns False with partial results at timeout."""
        await store.create_session(sample_session)

        # Store 2 of 3 results
        for reviewer in ["security", "performance"]:
            result = make_result(reviewer)
            await store.store_reviewer_result(sample_session.id, reviewer, result)

        # Wait should timeout
        completed = await store.wait_for_completion(
            sample_session.id,
            ["security", "performance", "style"],
            timeout_seconds=0.2,
            poll_interval=0.05,
        )

        assert completed is False

        # But completed reviewers should still be tracked
        completed_reviewers = await store.get_completed_reviewers(sample_session.id)
        assert "security" in completed_reviewers
        assert "performance" in completed_reviewers

    @pytest.mark.asyncio
    async def test_wait_for_completion_empty_expected_list(
        self,
        store: SwarmRedisStore,
        sample_session: SwarmSession,
    ) -> None:
        """Test wait_for_completion with empty expected list returns True."""
        await store.create_session(sample_session)

        completed = await store.wait_for_completion(
            sample_session.id,
            [],  # No reviewers expected
            timeout_seconds=1,
        )

        assert completed is True


class TestKeyPatterns:
    """Integration tests verifying key patterns work correctly."""

    @pytest.mark.asyncio
    async def test_key_isolation_between_sessions(
        self,
        store: SwarmRedisStore,
        config: SwarmConfig,
    ) -> None:
        """Test that keys are properly isolated between sessions."""
        session1 = SwarmSession(
            id=f"swarm-iso1-{uuid.uuid4().hex[:8]}",
            target_path="src/a/",
            reviewers=["security"],
            status=SwarmStatus.PENDING,
            created_at=datetime.now(UTC),
        )
        session2 = SwarmSession(
            id=f"swarm-iso2-{uuid.uuid4().hex[:8]}",
            target_path="src/b/",
            reviewers=["performance"],
            status=SwarmStatus.PENDING,
            created_at=datetime.now(UTC),
        )

        await store.create_session(session1)
        await store.create_session(session2)

        # Store results for each session
        await store.store_reviewer_result(
            session1.id, "security", make_result("security")
        )
        await store.store_reviewer_result(
            session2.id, "performance", make_result("performance")
        )

        # Verify isolation
        s1_results = await store.get_all_results(session1.id)
        s2_results = await store.get_all_results(session2.id)

        assert "security" in s1_results
        assert "performance" not in s1_results
        assert "performance" in s2_results
        assert "security" not in s2_results

    @pytest.mark.asyncio
    async def test_key_prefix_isolation(
        self,
        redis_client: redis.Redis,
    ) -> None:
        """Test that different key prefixes are properly isolated."""
        config1 = SwarmConfig(
            key_prefix=f"prefix1_{uuid.uuid4().hex[:8]}",
            result_ttl_seconds=60,
        )
        config2 = SwarmConfig(
            key_prefix=f"prefix2_{uuid.uuid4().hex[:8]}",
            result_ttl_seconds=60,
        )

        store1 = SwarmRedisStore(redis_client, config1)
        store2 = SwarmRedisStore(redis_client, config2)

        session_id = f"swarm-{uuid.uuid4().hex[:8]}"
        session1 = SwarmSession(
            id=session_id,
            target_path="src/",
            reviewers=["security"],
            status=SwarmStatus.PENDING,
            created_at=datetime.now(UTC),
        )
        session2 = SwarmSession(
            id=session_id,  # Same ID
            target_path="src/",
            reviewers=["performance"],
            status=SwarmStatus.IN_PROGRESS,  # Different status
            created_at=datetime.now(UTC),
        )

        await store1.create_session(session1)
        await store2.create_session(session2)

        # Verify stores are isolated despite same session ID
        retrieved1 = await store1.get_session(session_id)
        retrieved2 = await store2.get_session(session_id)

        assert retrieved1 is not None
        assert retrieved2 is not None
        assert retrieved1.status == SwarmStatus.PENDING
        assert retrieved2.status == SwarmStatus.IN_PROGRESS
        assert retrieved1.reviewers == ["security"]
        assert retrieved2.reviewers == ["performance"]
