"""Swarm Dispatcher for Parallel Review Swarm.

This module provides the SwarmDispatcher class that manages the parallel
execution of multiple specialized code reviewers. It handles task spawning,
result collection, aggregation, and coordination message publishing.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from src.workers.swarm.aggregator import ResultAggregator
from src.workers.swarm.config import SwarmConfig
from src.workers.swarm.models import (
    ReviewerResult,
    SwarmStatus,
    UnifiedReport,
)

if TYPE_CHECKING:
    from src.workers.swarm.redis_store import SwarmRedisStore
    from src.workers.swarm.reviewers.base import ReviewerRegistry, SpecializedReviewer
    from src.workers.swarm.session import SwarmSessionManager

logger = logging.getLogger(__name__)


class SwarmDispatcher:
    """Dispatcher for parallel review swarm execution.

    Manages the lifecycle of a swarm review session including:
    - Creating sessions with the session manager
    - Spawning parallel reviewer tasks
    - Collecting results from all reviewers
    - Aggregating findings into a unified report
    - Publishing coordination messages at lifecycle events

    Attributes:
        _session_manager: Manager for swarm session lifecycle.
        _store: Redis store for result persistence.
        _registry: Registry of available reviewers.
        _config: Swarm configuration settings.
        _aggregator: Aggregator for combining reviewer results.
        _executor: Callable that executes a review for a given reviewer.
        _publish: Callable for publishing coordination messages.

    Example:
        >>> dispatcher = SwarmDispatcher(session_manager, store, registry, config)
        >>> report = await dispatcher.run_swarm("src/workers/")
        >>> print(f"Total findings: {report.total_findings}")
    """

    def __init__(
        self,
        session_manager: SwarmSessionManager,
        redis_store: SwarmRedisStore,
        registry: ReviewerRegistry,
        config: SwarmConfig,
        review_executor: Callable[
            [str, str, SpecializedReviewer], Awaitable[ReviewerResult]
        ]
        | None = None,
        coord_publisher: Callable[[str, str, str], Awaitable[None]] | None = None,
        aggregator: ResultAggregator | None = None,
    ) -> None:
        """Initialize the SwarmDispatcher.

        Args:
            session_manager: Manager for swarm session lifecycle.
            redis_store: Redis store for result persistence.
            registry: Registry of available reviewers.
            config: Swarm configuration settings.
            review_executor: Optional callable for executing reviews. If not provided,
                a default mock executor is used.
            coord_publisher: Optional callable for publishing coordination messages.
                If not provided, a no-op publisher is used.
            aggregator: Optional ResultAggregator for combining findings. If not
                provided, a default aggregator is created using the config.
        """
        self._session_manager = session_manager
        self._store = redis_store
        self._registry = registry
        self._config = config
        self._aggregator = aggregator or ResultAggregator(config)
        self._executor = review_executor or self._default_executor
        self._publish = coord_publisher or self._noop_publish

    async def _noop_publish(
        self, msg_type: str, subject: str, description: str
    ) -> None:
        """No-op publisher for when coordination is not needed.

        Args:
            msg_type: Message type (ignored).
            subject: Subject line (ignored).
            description: Description body (ignored).
        """
        pass

    async def _default_executor(
        self,
        session_id: str,
        target_path: str,
        reviewer: SpecializedReviewer,
    ) -> ReviewerResult:
        """Default executor - placeholder for actual LLM integration.

        In a real implementation, this would call the Claude API with the
        reviewer's system prompt. For now, returns a mock success result.

        Args:
            session_id: The swarm session ID.
            target_path: Path to the code being reviewed.
            reviewer: The specialized reviewer instance.

        Returns:
            A mock ReviewerResult with success status.
        """
        # Placeholder implementation - will be replaced with actual LLM calls
        return ReviewerResult(
            reviewer_type=reviewer.reviewer_type,
            status="success",
            findings=[],
            duration_seconds=0.0,
            files_reviewed=[target_path],
            error_message=None,
        )

    async def dispatch_swarm(
        self,
        target_path: str,
        reviewer_types: list[str] | None = None,
        timeout_seconds: int | None = None,
    ) -> str:
        """Spawn parallel reviewer tasks and return session_id.

        Creates a new swarm session, retrieves the appropriate reviewers from
        the registry, and executes all reviews in parallel using asyncio.gather.

        Args:
            target_path: Path to the code to review.
            reviewer_types: Optional list of reviewer types. If not provided,
                defaults to the configured default_reviewers.
            timeout_seconds: Optional timeout for the entire dispatch operation.
                If not provided, uses config.task_timeout_seconds.

        Returns:
            The session ID of the created swarm session.
        """
        # 1. Create session
        session = await self._session_manager.create_session(
            target_path, reviewer_types
        )

        # Update status to IN_PROGRESS
        await self._session_manager.update_status(session.id, SwarmStatus.IN_PROGRESS)

        # 2. Publish SWARM_STARTED message
        await self._publish(
            "SWARM_STARTED",
            f"Swarm started: {session.id}",
            f"Target: {target_path}, Reviewers: {session.reviewers}",
        )

        # 3. Get reviewers from registry
        reviewers = [
            self._registry.get(rt)
            for rt in session.reviewers
            if self._registry.get(rt) is not None
        ]

        # 4. Create task coroutines
        tasks = [
            self._run_reviewer(session.id, target_path, reviewer)
            for reviewer in reviewers
        ]

        # 5. Execute in parallel with timeout
        timeout = timeout_seconds or self._config.task_timeout_seconds
        try:
            await asyncio.wait_for(
                asyncio.gather(*tasks, return_exceptions=True),
                timeout=timeout,
            )
        except TimeoutError:
            # Handle timeout - session still valid with partial results
            logger.warning(
                f"Swarm dispatch timed out for session {session.id} after {timeout}s"
            )

        return session.id

    async def _run_reviewer(
        self,
        session_id: str,
        target_path: str,
        reviewer: SpecializedReviewer,
    ) -> None:
        """Run a single reviewer and store result.

        Executes the review using the configured executor, stores the result
        in Redis, and publishes a SWARM_REVIEWER_COMPLETE message.

        Args:
            session_id: The swarm session ID.
            target_path: Path to the code being reviewed.
            reviewer: The specialized reviewer instance.
        """
        try:
            result = await self._executor(session_id, target_path, reviewer)
        except Exception as e:
            # Store failed result
            logger.error(
                f"Reviewer {reviewer.reviewer_type} failed for session {session_id}: {e}"
            )
            result = ReviewerResult(
                reviewer_type=reviewer.reviewer_type,
                status="failed",
                findings=[],
                duration_seconds=0.0,
                files_reviewed=[],
                error_message=str(e),
            )

        # Store result in Redis
        await self._store.store_reviewer_result(
            session_id, reviewer.reviewer_type, result
        )

        # Publish reviewer complete message
        await self._publish(
            "SWARM_REVIEWER_COMPLETE",
            f"Reviewer complete: {reviewer.reviewer_type}",
            f"Session: {session_id}, Status: {result.status}",
        )

    async def collect_results(
        self,
        session_id: str,
        timeout_seconds: int | None = None,
    ) -> dict[str, ReviewerResult]:
        """Wait for all reviewers to complete and collect results.

        Retrieves the session, waits for all expected reviewers to complete,
        updates the session status to AGGREGATING, and returns all results.

        Args:
            session_id: The swarm session ID.
            timeout_seconds: Optional timeout for waiting. If not provided,
                uses config.aggregate_timeout_seconds.

        Returns:
            Dictionary mapping reviewer_type to ReviewerResult.

        Raises:
            ValueError: If the session is not found.
        """
        session = await self._session_manager.get_session(session_id)
        if not session:
            raise ValueError(f"Session not found: {session_id}")

        timeout = timeout_seconds or self._config.aggregate_timeout_seconds

        # Wait for completion
        await self._store.wait_for_completion(
            session_id, session.reviewers, timeout
        )

        # Update status
        await self._session_manager.update_status(session_id, SwarmStatus.AGGREGATING)

        # Get all results
        return await self._store.get_all_results(session_id)

    async def finalize_swarm(
        self,
        session_id: str,
        unified_report: UnifiedReport,
    ) -> None:
        """Mark swarm as complete with final report.

        Updates the session status to COMPLETE, sets the completion timestamp,
        and publishes a SWARM_COMPLETE coordination message.

        Args:
            session_id: The swarm session ID.
            unified_report: The final aggregated report.
        """
        await self._session_manager.update_status(
            session_id,
            SwarmStatus.COMPLETE,
            completed_at=datetime.now(UTC),
        )

        await self._publish(
            "SWARM_COMPLETE",
            f"Swarm complete: {session_id}",
            f"Total findings: {unified_report.total_findings}",
        )

    async def fail_swarm(self, session_id: str, error: str) -> None:
        """Mark swarm as failed.

        Updates the session status to FAILED and publishes a SWARM_FAILED
        coordination message.

        Args:
            session_id: The swarm session ID.
            error: Description of the error that caused the failure.
        """
        await self._session_manager.update_status(session_id, SwarmStatus.FAILED)

        await self._publish(
            "SWARM_FAILED",
            f"Swarm failed: {session_id}",
            error,
        )

    async def run_swarm(
        self,
        target_path: str,
        reviewer_types: list[str] | None = None,
        timeout_seconds: int | None = None,
    ) -> UnifiedReport:
        """Execute full swarm flow: dispatch -> collect -> aggregate -> finalize.

        This is the main entry point for running a complete swarm review.
        It orchestrates the entire lifecycle from dispatching reviewers to
        producing a unified report.

        Args:
            target_path: Path to the code to review.
            reviewer_types: Optional list of reviewer types. If not provided,
                defaults to the configured default_reviewers.
            timeout_seconds: Optional timeout for the dispatch operation.
                If not provided, uses config.task_timeout_seconds.

        Returns:
            UnifiedReport containing aggregated findings from all reviewers.

        Raises:
            ValueError: If the session is lost during processing.
            Exception: Re-raises any exception after marking the swarm as failed.
        """
        # 1. Dispatch parallel tasks
        session_id = await self.dispatch_swarm(target_path, reviewer_types, timeout_seconds)

        try:
            # 2. Collect results
            results = await self.collect_results(session_id)

            # 3. Get session for aggregation
            session = await self._session_manager.get_session(session_id)
            if not session:
                raise ValueError(f"Session lost: {session_id}")

            # 4. Aggregate results
            report = self._aggregator.aggregate(session, results)

            # 5. Finalize
            await self.finalize_swarm(session_id, report)

            return report

        except Exception as e:
            await self.fail_swarm(session_id, str(e))
            raise
