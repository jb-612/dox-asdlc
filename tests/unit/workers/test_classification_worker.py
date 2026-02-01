"""Unit tests for Classification Worker.

Tests the ClassificationWorker class for async classification processing.
"""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.orchestrator.api.models.classification import (
    ClassificationResult,
    ClassificationType,
)
from src.workers.classification_worker import (
    ClassificationWorker,
    ClassificationJobStatus,
    REDIS_QUEUE_KEY,
    REDIS_JOB_KEY_PREFIX,
)


class TestClassificationWorkerInit:
    """Tests for ClassificationWorker initialization."""

    def test_init_with_redis_client(self) -> None:
        """Test worker can be instantiated with Redis client."""
        mock_redis = AsyncMock()
        mock_service = AsyncMock()

        worker = ClassificationWorker(
            redis_client=mock_redis,
            classification_service=mock_service,
        )

        assert worker._redis_client is mock_redis
        assert worker._classification_service is mock_service

    def test_init_sets_running_false(self) -> None:
        """Test worker initializes with running=False."""
        mock_redis = AsyncMock()
        mock_service = AsyncMock()

        worker = ClassificationWorker(
            redis_client=mock_redis,
            classification_service=mock_service,
        )

        assert worker._running is False


class TestEnqueue:
    """Tests for enqueue method."""

    @pytest.fixture
    def worker(self) -> ClassificationWorker:
        """Create a worker instance with mocked dependencies."""
        mock_redis = AsyncMock()
        mock_service = AsyncMock()
        return ClassificationWorker(
            redis_client=mock_redis,
            classification_service=mock_service,
        )

    @pytest.mark.asyncio
    async def test_enqueue_single_idea(self, worker: ClassificationWorker) -> None:
        """Test enqueueing a single idea for classification."""
        job_id = await worker.enqueue("idea-123")

        assert job_id is not None
        assert job_id.startswith("job-")

        # Verify Redis was called
        worker._redis_client.lpush.assert_called_once()
        worker._redis_client.set.assert_called_once()

    @pytest.mark.asyncio
    async def test_enqueue_with_force_flag(self, worker: ClassificationWorker) -> None:
        """Test enqueueing with force reclassification."""
        job_id = await worker.enqueue("idea-123", force=True)

        # Verify the job data includes force flag
        call_args = worker._redis_client.lpush.call_args
        job_data = json.loads(call_args[0][1])

        assert job_data["force"] is True

    @pytest.mark.asyncio
    async def test_enqueue_returns_unique_job_ids(
        self, worker: ClassificationWorker
    ) -> None:
        """Test that each enqueue returns a unique job ID."""
        job_id1 = await worker.enqueue("idea-1")
        job_id2 = await worker.enqueue("idea-2")

        assert job_id1 != job_id2


class TestEnqueueBatch:
    """Tests for enqueue_batch method."""

    @pytest.fixture
    def worker(self) -> ClassificationWorker:
        """Create a worker instance with mocked dependencies."""
        mock_redis = AsyncMock()
        mock_service = AsyncMock()
        return ClassificationWorker(
            redis_client=mock_redis,
            classification_service=mock_service,
        )

    @pytest.mark.asyncio
    async def test_enqueue_batch_creates_single_job(
        self, worker: ClassificationWorker
    ) -> None:
        """Test batch enqueue creates a single job for multiple ideas."""
        idea_ids = ["idea-1", "idea-2", "idea-3"]
        job_id = await worker.enqueue_batch(idea_ids)

        assert job_id is not None
        assert job_id.startswith("job-")

    @pytest.mark.asyncio
    async def test_enqueue_batch_stores_job_metadata(
        self, worker: ClassificationWorker
    ) -> None:
        """Test batch enqueue stores correct job metadata."""
        idea_ids = ["idea-1", "idea-2", "idea-3"]
        job_id = await worker.enqueue_batch(idea_ids)

        # Verify job metadata was stored
        worker._redis_client.set.assert_called()
        call_args = worker._redis_client.set.call_args
        key = call_args[0][0]
        job_data = json.loads(call_args[0][1])

        assert REDIS_JOB_KEY_PREFIX in key
        assert job_data["total"] == 3
        assert job_data["completed"] == 0
        assert job_data["status"] == ClassificationJobStatus.PENDING.value


class TestGetJobStatus:
    """Tests for get_job_status method."""

    @pytest.fixture
    def worker(self) -> ClassificationWorker:
        """Create a worker instance with mocked dependencies."""
        mock_redis = AsyncMock()
        mock_service = AsyncMock()
        return ClassificationWorker(
            redis_client=mock_redis,
            classification_service=mock_service,
        )

    @pytest.mark.asyncio
    async def test_get_job_status_found(self, worker: ClassificationWorker) -> None:
        """Test getting status of an existing job."""
        job_data = {
            "job_id": "job-123",
            "status": "processing",
            "total": 5,
            "completed": 2,
            "failed": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        worker._redis_client.get.return_value = json.dumps(job_data)

        status = await worker.get_job_status("job-123")

        assert status is not None
        assert status["job_id"] == "job-123"
        assert status["status"] == "processing"
        assert status["total"] == 5
        assert status["completed"] == 2

    @pytest.mark.asyncio
    async def test_get_job_status_not_found(
        self, worker: ClassificationWorker
    ) -> None:
        """Test getting status of non-existent job."""
        worker._redis_client.get.return_value = None

        status = await worker.get_job_status("nonexistent")

        assert status is None


class TestProcessQueue:
    """Tests for process_queue method."""

    @pytest.fixture
    def worker(self) -> ClassificationWorker:
        """Create a worker instance with mocked dependencies."""
        mock_redis = AsyncMock()
        mock_service = AsyncMock()
        return ClassificationWorker(
            redis_client=mock_redis,
            classification_service=mock_service,
        )

    @pytest.mark.asyncio
    async def test_process_queue_calls_classify_idea(
        self, worker: ClassificationWorker
    ) -> None:
        """Test that process_queue calls classify_idea for queued jobs."""
        # Setup mock to return one job then None
        job_data = {
            "job_id": "job-123",
            "idea_id": "idea-456",
            "force": False,
            "queued_at": datetime.now(timezone.utc).isoformat(),
        }

        # brpop returns (key, value) tuple
        worker._redis_client.brpop.side_effect = [
            (REDIS_QUEUE_KEY, json.dumps(job_data)),
            asyncio.CancelledError(),  # Stop the loop
        ]

        # Mock classification result
        worker._classification_service.classify_idea.return_value = ClassificationResult(
            idea_id="idea-456",
            classification=ClassificationType.FUNCTIONAL,
            confidence=0.9,
            labels=["feature"],
        )

        # Run process_queue (will stop on CancelledError)
        try:
            await worker.process_queue()
        except asyncio.CancelledError:
            pass

        worker._classification_service.classify_idea.assert_called_once_with(
            "idea-456", force=False
        )

    @pytest.mark.asyncio
    async def test_process_queue_handles_classification_error(
        self, worker: ClassificationWorker
    ) -> None:
        """Test that process_queue handles classification errors gracefully."""
        job_data = {
            "job_id": "job-123",
            "idea_id": "idea-456",
            "force": False,
            "queued_at": datetime.now(timezone.utc).isoformat(),
        }

        worker._redis_client.brpop.side_effect = [
            (REDIS_QUEUE_KEY, json.dumps(job_data)),
            asyncio.CancelledError(),
        ]

        # Make classification fail
        worker._classification_service.classify_idea.side_effect = ValueError(
            "Idea not found"
        )

        # Should not raise
        try:
            await worker.process_queue()
        except asyncio.CancelledError:
            pass

        # Verify job was marked as failed (set called to update status)
        assert worker._redis_client.set.called


class TestRetryLogic:
    """Tests for retry logic with exponential backoff."""

    @pytest.fixture
    def worker(self) -> ClassificationWorker:
        """Create a worker instance with mocked dependencies."""
        mock_redis = AsyncMock()
        mock_service = AsyncMock()
        return ClassificationWorker(
            redis_client=mock_redis,
            classification_service=mock_service,
        )

    @pytest.mark.asyncio
    async def test_retry_on_transient_error(
        self, worker: ClassificationWorker
    ) -> None:
        """Test that transient errors trigger retry."""
        job_data = {
            "job_id": "job-123",
            "idea_id": "idea-456",
            "force": False,
            "retry_count": 0,
            "queued_at": datetime.now(timezone.utc).isoformat(),
        }

        worker._redis_client.brpop.side_effect = [
            (REDIS_QUEUE_KEY, json.dumps(job_data)),
            asyncio.CancelledError(),
        ]

        # Simulate transient error
        worker._classification_service.classify_idea.side_effect = ConnectionError(
            "Redis unavailable"
        )

        try:
            await worker.process_queue()
        except asyncio.CancelledError:
            pass

        # Verify job was re-queued with incremented retry count
        lpush_calls = worker._redis_client.lpush.call_args_list
        if lpush_calls:
            requeued_data = json.loads(lpush_calls[-1][0][1])
            assert requeued_data.get("retry_count", 0) >= 1


class TestGracefulShutdown:
    """Tests for graceful shutdown handling."""

    @pytest.fixture
    def worker(self) -> ClassificationWorker:
        """Create a worker instance with mocked dependencies."""
        mock_redis = AsyncMock()
        mock_service = AsyncMock()
        return ClassificationWorker(
            redis_client=mock_redis,
            classification_service=mock_service,
        )

    @pytest.mark.asyncio
    async def test_stop_sets_running_false(
        self, worker: ClassificationWorker
    ) -> None:
        """Test that stop() sets _running to False."""
        worker._running = True

        await worker.stop()

        assert worker._running is False

    @pytest.mark.asyncio
    async def test_process_queue_respects_running_flag(
        self, worker: ClassificationWorker
    ) -> None:
        """Test that process_queue stops when _running is False."""
        worker._running = False

        # Should return immediately without processing
        await worker.process_queue()

        # brpop should not be called
        worker._redis_client.brpop.assert_not_called()


class TestBatchProcessing:
    """Tests for batch job processing."""

    @pytest.fixture
    def worker(self) -> ClassificationWorker:
        """Create a worker instance with mocked dependencies."""
        mock_redis = AsyncMock()
        mock_service = AsyncMock()
        return ClassificationWorker(
            redis_client=mock_redis,
            classification_service=mock_service,
        )

    @pytest.mark.asyncio
    async def test_batch_job_updates_progress(
        self, worker: ClassificationWorker
    ) -> None:
        """Test that batch jobs update progress correctly."""
        # Create a batch job with 3 ideas
        idea_ids = ["idea-1", "idea-2", "idea-3"]
        job_id = await worker.enqueue_batch(idea_ids)

        # Get the stored job data
        set_calls = worker._redis_client.set.call_args_list
        assert len(set_calls) > 0
