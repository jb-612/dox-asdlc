"""Classification Worker for async classification processing.

This module provides a worker that processes classification jobs from a Redis
queue, enabling non-blocking classification of ideas.
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import TYPE_CHECKING, Any

import redis.asyncio as redis

from src.orchestrator.api.models.classification import (
    ClassificationJobStatus,
    ClassificationResult,
)

if TYPE_CHECKING:
    from src.orchestrator.services.classification_service import ClassificationService


logger = logging.getLogger(__name__)


# Redis keys
REDIS_QUEUE_KEY = "classification:queue"
REDIS_JOB_KEY_PREFIX = "classification:job:"

# Worker configuration
DEFAULT_TIMEOUT = 30  # seconds to wait for queue item
MAX_RETRIES = 3
INITIAL_BACKOFF = 1.0  # seconds
MAX_BACKOFF = 60.0  # seconds


class ClassificationWorker:
    """Worker for processing classification jobs from a Redis queue.

    Consumes classification jobs from a Redis list and processes them
    asynchronously, with support for retry logic and graceful shutdown.

    Usage:
        worker = ClassificationWorker(redis_client, classification_service)

        # Enqueue a job
        job_id = await worker.enqueue("idea-123")

        # Start processing (runs until stopped)
        await worker.start()

        # Stop gracefully
        await worker.stop()
    """

    def __init__(
        self,
        redis_client: redis.Redis,
        classification_service: ClassificationService,
    ) -> None:
        """Initialize the classification worker.

        Args:
            redis_client: Redis client for queue operations.
            classification_service: Service for performing classifications.
        """
        self._redis_client = redis_client
        self._classification_service = classification_service
        self._running = False

    async def enqueue(
        self,
        idea_id: str,
        force: bool = False,
    ) -> str:
        """Add a single idea to the classification queue.

        Args:
            idea_id: The ID of the idea to classify.
            force: If True, reclassify even if already classified.

        Returns:
            str: The job ID for tracking.
        """
        job_id = f"job-{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc)

        job_data = {
            "job_id": job_id,
            "idea_id": idea_id,
            "force": force,
            "retry_count": 0,
            "queued_at": now.isoformat(),
        }

        # Store job metadata
        job_meta = {
            "job_id": job_id,
            "status": ClassificationJobStatus.PENDING.value,
            "total": 1,
            "completed": 0,
            "failed": 0,
            "idea_ids": [idea_id],
            "created_at": now.isoformat(),
        }

        await self._redis_client.set(
            f"{REDIS_JOB_KEY_PREFIX}{job_id}",
            json.dumps(job_meta),
        )

        # Add to queue
        await self._redis_client.lpush(REDIS_QUEUE_KEY, json.dumps(job_data))

        logger.info(f"Enqueued classification job {job_id} for idea {idea_id}")
        return job_id

    async def enqueue_batch(
        self,
        idea_ids: list[str],
        force: bool = False,
    ) -> str:
        """Add multiple ideas to the classification queue as a batch job.

        Args:
            idea_ids: List of idea IDs to classify.
            force: If True, reclassify even if already classified.

        Returns:
            str: The batch job ID for tracking.
        """
        job_id = f"job-{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc)

        # Store batch job metadata
        job_meta = {
            "job_id": job_id,
            "status": ClassificationJobStatus.PENDING.value,
            "total": len(idea_ids),
            "completed": 0,
            "failed": 0,
            "idea_ids": idea_ids,
            "results": [],
            "created_at": now.isoformat(),
        }

        await self._redis_client.set(
            f"{REDIS_JOB_KEY_PREFIX}{job_id}",
            json.dumps(job_meta),
        )

        # Add each idea to queue with batch job reference
        for idea_id in idea_ids:
            job_data = {
                "job_id": job_id,
                "idea_id": idea_id,
                "force": force,
                "retry_count": 0,
                "batch_job_id": job_id,
                "queued_at": now.isoformat(),
            }
            await self._redis_client.lpush(REDIS_QUEUE_KEY, json.dumps(job_data))

        logger.info(
            f"Enqueued batch classification job {job_id} for {len(idea_ids)} ideas"
        )
        return job_id

    async def get_job_status(self, job_id: str) -> dict[str, Any] | None:
        """Get the status of a classification job.

        Args:
            job_id: The job ID to check.

        Returns:
            dict | None: Job status data if found, None otherwise.
        """
        data = await self._redis_client.get(f"{REDIS_JOB_KEY_PREFIX}{job_id}")
        if data is None:
            return None
        return json.loads(data)

    async def start(self) -> None:
        """Start the worker.

        Begins processing jobs from the queue. Call stop() to terminate.
        """
        self._running = True
        logger.info("Classification worker started")
        await self.process_queue()

    async def stop(self) -> None:
        """Stop the worker gracefully.

        Allows the current job to complete before stopping.
        """
        self._running = False
        logger.info("Classification worker stopping")

    async def process_queue(self) -> None:
        """Process classification jobs from the queue.

        Runs until _running is set to False or an unrecoverable error occurs.
        """
        while self._running:
            try:
                # Wait for a job from the queue
                result = await self._redis_client.brpop(
                    REDIS_QUEUE_KEY,
                    timeout=DEFAULT_TIMEOUT,
                )

                if result is None:
                    # Timeout, continue waiting
                    continue

                _, job_data_str = result
                job_data = json.loads(job_data_str)

                await self._process_job(job_data)

            except asyncio.CancelledError:
                logger.info("Classification worker cancelled")
                raise
            except Exception as e:
                logger.error(f"Error in classification worker: {e}")
                # Brief delay before retrying
                await asyncio.sleep(1)

    async def _process_job(self, job_data: dict[str, Any]) -> None:
        """Process a single classification job.

        Args:
            job_data: The job data from the queue.
        """
        job_id = job_data["job_id"]
        idea_id = job_data["idea_id"]
        force = job_data.get("force", False)
        retry_count = job_data.get("retry_count", 0)
        batch_job_id = job_data.get("batch_job_id")

        logger.info(f"Processing classification job {job_id} for idea {idea_id}")

        try:
            # Update job status to processing
            await self._update_job_status(
                batch_job_id or job_id,
                ClassificationJobStatus.PROCESSING,
            )

            # Perform classification
            result = await self._classification_service.classify_idea(
                idea_id,
                force=force,
            )

            # Update job with success
            await self._mark_job_success(
                batch_job_id or job_id,
                idea_id,
                result,
            )

            logger.info(
                f"Classification complete for {idea_id}: {result.classification.value}"
            )

        except Exception as e:
            logger.error(f"Classification failed for {idea_id}: {e}")

            if self._should_retry(e) and retry_count < MAX_RETRIES:
                # Retry with exponential backoff
                await self._retry_job(job_data, retry_count + 1)
            else:
                # Mark as failed
                await self._mark_job_failed(batch_job_id or job_id, idea_id, str(e))

    async def _update_job_status(
        self,
        job_id: str,
        status: ClassificationJobStatus,
    ) -> None:
        """Update the status of a job.

        Args:
            job_id: The job ID to update.
            status: The new status.
        """
        key = f"{REDIS_JOB_KEY_PREFIX}{job_id}"
        data = await self._redis_client.get(key)
        if data:
            job_meta = json.loads(data)
            job_meta["status"] = status.value
            await self._redis_client.set(key, json.dumps(job_meta))

    async def _mark_job_success(
        self,
        job_id: str,
        idea_id: str,
        result: ClassificationResult,
    ) -> None:
        """Mark an idea as successfully classified in the job.

        Args:
            job_id: The job ID.
            idea_id: The idea ID that was classified.
            result: The classification result.
        """
        key = f"{REDIS_JOB_KEY_PREFIX}{job_id}"
        data = await self._redis_client.get(key)
        if data:
            job_meta = json.loads(data)
            job_meta["completed"] = job_meta.get("completed", 0) + 1

            # Store result for batch jobs
            if "results" in job_meta:
                job_meta["results"].append({
                    "idea_id": idea_id,
                    "classification": result.classification.value,
                    "confidence": result.confidence,
                })

            # Check if job is complete
            if job_meta["completed"] + job_meta.get("failed", 0) >= job_meta["total"]:
                job_meta["status"] = ClassificationJobStatus.COMPLETED.value

            await self._redis_client.set(key, json.dumps(job_meta))

    async def _mark_job_failed(
        self,
        job_id: str,
        idea_id: str,
        error: str,
    ) -> None:
        """Mark an idea as failed in the job.

        Args:
            job_id: The job ID.
            idea_id: The idea ID that failed.
            error: The error message.
        """
        key = f"{REDIS_JOB_KEY_PREFIX}{job_id}"
        data = await self._redis_client.get(key)
        if data:
            job_meta = json.loads(data)
            job_meta["failed"] = job_meta.get("failed", 0) + 1

            # Store error for batch jobs
            if "errors" not in job_meta:
                job_meta["errors"] = []
            job_meta["errors"].append({
                "idea_id": idea_id,
                "error": error,
            })

            # Check if job is complete (all items processed, some failed)
            if job_meta["completed"] + job_meta["failed"] >= job_meta["total"]:
                if job_meta["failed"] == job_meta["total"]:
                    job_meta["status"] = ClassificationJobStatus.FAILED.value
                else:
                    job_meta["status"] = ClassificationJobStatus.COMPLETED.value

            await self._redis_client.set(key, json.dumps(job_meta))

    def _should_retry(self, error: Exception) -> bool:
        """Determine if an error should trigger a retry.

        Args:
            error: The exception that occurred.

        Returns:
            bool: True if the error is transient and should be retried.
        """
        # Retry on connection errors and timeouts
        transient_errors = (
            ConnectionError,
            TimeoutError,
            OSError,
        )
        return isinstance(error, transient_errors)

    async def _retry_job(
        self,
        job_data: dict[str, Any],
        retry_count: int,
    ) -> None:
        """Re-queue a job for retry with exponential backoff.

        Args:
            job_data: The original job data.
            retry_count: The new retry count.
        """
        # Calculate backoff delay
        backoff = min(INITIAL_BACKOFF * (2 ** (retry_count - 1)), MAX_BACKOFF)

        logger.info(
            f"Retrying job {job_data['job_id']} in {backoff}s (attempt {retry_count})"
        )

        await asyncio.sleep(backoff)

        # Update retry count and re-queue
        job_data["retry_count"] = retry_count
        await self._redis_client.lpush(REDIS_QUEUE_KEY, json.dumps(job_data))


# Factory function for creating workers
async def create_classification_worker(
    redis_url: str | None = None,
) -> ClassificationWorker:
    """Create a classification worker instance.

    Args:
        redis_url: Optional Redis URL. If not provided, uses environment variables.

    Returns:
        ClassificationWorker: Configured worker instance.
    """
    import os

    if redis_url is None:
        redis_url = os.environ.get("REDIS_URL")
        if not redis_url:
            redis_host = os.environ.get("REDIS_HOST", "localhost")
            redis_port = os.environ.get("REDIS_PORT", "6379")
            redis_url = f"redis://{redis_host}:{redis_port}"

    redis_client = redis.from_url(redis_url)

    from src.orchestrator.services.classification_service import (
        get_classification_service,
    )

    classification_service = get_classification_service()

    return ClassificationWorker(
        redis_client=redis_client,
        classification_service=classification_service,
    )
