"""Swarm Review API endpoints for Parallel Review Swarm (P04-F05).

Provides REST API endpoints for triggering and monitoring parallel code reviews.

Endpoints:
- POST /api/swarm/review - Trigger a parallel review swarm
- GET /api/swarm/review/{swarm_id} - Get swarm status and results
"""

from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field

from src.workers.swarm.config import SwarmConfig
from src.workers.swarm.config import get_swarm_config as _get_swarm_config
from src.workers.swarm.models import UnifiedReport
from src.workers.swarm.reviewers import ReviewerRegistry, default_registry

if TYPE_CHECKING:
    from src.workers.swarm.dispatcher import SwarmDispatcher
    from src.workers.swarm.redis_store import SwarmRedisStore
    from src.workers.swarm.session import SwarmSessionManager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/swarm", tags=["swarm"])

# Track active swarms for rate limiting (simple in-memory for now)
_active_swarms: set[str] = set()
_active_swarms_lock = asyncio.Lock()


# =============================================================================
# Request/Response Models
# =============================================================================


class SwarmReviewRequest(BaseModel):
    """Request body for triggering a swarm review.

    Attributes:
        target_path: Path to review (relative to project root).
        reviewer_types: Optional list of reviewer types to use. Defaults to
            ['security', 'performance', 'style'] if not provided.
        timeout_seconds: Optional timeout in seconds. Must be between 30 and 600.
            Defaults to 300 if not provided.
    """

    target_path: str = Field(
        ...,
        min_length=1,
        description="Path to review (relative to project root)",
    )
    reviewer_types: list[str] | None = Field(
        None,
        description="Reviewer types to use. Defaults to ['security', 'performance', 'style']",
    )
    timeout_seconds: int | None = Field(
        None,
        ge=30,
        le=600,
        description="Timeout in seconds. Defaults to 300.",
    )


class SwarmReviewResponse(BaseModel):
    """Response for triggering a swarm review.

    Attributes:
        swarm_id: Unique identifier for the swarm session.
        status: Initial status (always 'pending').
        poll_url: URL to poll for status updates.
    """

    swarm_id: str = Field(..., description="Unique identifier for the swarm session")
    status: str = Field(..., description="Initial status")
    poll_url: str = Field(..., description="URL to poll for status updates")


class ReviewerStatusResponse(BaseModel):
    """Status of a single reviewer within a swarm.

    Attributes:
        status: Reviewer status ('pending', 'success', 'failed', 'timeout').
        files_reviewed: Number of files reviewed by this reviewer.
        findings_count: Number of findings from this reviewer.
        progress_percent: Progress percentage (0-100).
        duration_seconds: Time taken for the review, if completed.
    """

    status: str = Field(..., description="Reviewer status")
    files_reviewed: int = Field(0, description="Number of files reviewed")
    findings_count: int = Field(0, description="Number of findings")
    progress_percent: int = Field(0, description="Progress percentage (0-100)")
    duration_seconds: float | None = Field(None, description="Time taken")


class SwarmStatusResponse(BaseModel):
    """Response for swarm status query.

    Attributes:
        swarm_id: Unique identifier for the swarm session.
        status: Current status (pending, in_progress, aggregating, complete, failed).
        reviewers: Status of each reviewer.
        unified_report: Final report when status is 'complete'.
        duration_seconds: Total time taken, when complete.
        error_message: Error message if status is 'failed'.
    """

    swarm_id: str = Field(..., description="Unique identifier for the swarm session")
    status: str = Field(..., description="Current status")
    reviewers: dict[str, ReviewerStatusResponse] = Field(
        default_factory=dict, description="Status of each reviewer"
    )
    unified_report: UnifiedReport | None = Field(
        None, description="Final report when complete"
    )
    duration_seconds: float | None = Field(None, description="Total time taken")
    error_message: str | None = Field(None, description="Error message if failed")


# =============================================================================
# Dependency Injection
# =============================================================================


def get_swarm_config() -> SwarmConfig:
    """Get swarm configuration.

    Returns:
        SwarmConfig instance.
    """
    return _get_swarm_config()


def get_reviewer_registry() -> ReviewerRegistry:
    """Get the reviewer registry.

    Returns:
        ReviewerRegistry instance with registered reviewers.
    """
    return default_registry


_cached_redis_store: SwarmRedisStore | None = None
_cached_session_manager: SwarmSessionManager | None = None
_cached_dispatcher: SwarmDispatcher | None = None
_init_lock: asyncio.Lock | None = None


def _get_init_lock() -> asyncio.Lock:
    """Get or create the module-level init lock.

    Returns:
        An asyncio.Lock for guarding lazy initialization.
    """
    global _init_lock
    if _init_lock is None:
        _init_lock = asyncio.Lock()
    return _init_lock


async def _ensure_swarm_components() -> (
    tuple[SwarmRedisStore, SwarmSessionManager, SwarmDispatcher] | None
):
    """Lazily initialize swarm components using the project Redis client.

    Returns:
        Tuple of (store, session_manager, dispatcher) or None if Redis
        is unavailable.
    """
    global _cached_redis_store, _cached_session_manager, _cached_dispatcher

    if _cached_dispatcher is not None:
        return _cached_redis_store, _cached_session_manager, _cached_dispatcher

    async with _get_init_lock():
        # Double-check after acquiring lock
        if _cached_dispatcher is not None:
            return _cached_redis_store, _cached_session_manager, _cached_dispatcher

        try:
            from src.core.redis_client import get_redis_client
            from src.infrastructure.llm.factory import LLMClientFactory
            from src.orchestrator.services.llm_config_service import LLMConfigService
            from src.workers.swarm.dispatcher import SwarmDispatcher as _Dispatcher
            from src.workers.swarm.executor import ReviewExecutor
            from src.workers.swarm.redis_store import SwarmRedisStore as _Store
            from src.workers.swarm.session import SwarmSessionManager as _Manager

            redis_client = await get_redis_client()

            config = _get_swarm_config()
            _cached_redis_store = _Store(redis_client, config)
            _cached_session_manager = _Manager(_cached_redis_store, config)

            # Wire up real LLM executor for code reviews
            llm_config_service = LLMConfigService(redis_client=redis_client)
            llm_factory = LLMClientFactory(config_service=llm_config_service)
            review_executor = ReviewExecutor(factory=llm_factory)

            _cached_dispatcher = _Dispatcher(
                session_manager=_cached_session_manager,
                redis_store=_cached_redis_store,
                registry=default_registry,
                config=config,
                review_executor=review_executor.execute_review,
            )
            return _cached_redis_store, _cached_session_manager, _cached_dispatcher
        except Exception as exc:
            logger.warning("Could not initialize swarm components: %s", exc)
            return None


async def get_swarm_redis_store() -> SwarmRedisStore | None:
    """Get the swarm Redis store.

    Returns:
        SwarmRedisStore instance or None if not available.
    """
    result = await _ensure_swarm_components()
    return result[0] if result else None


async def get_swarm_session_manager() -> SwarmSessionManager | None:
    """Get the swarm session manager.

    Returns:
        SwarmSessionManager instance or None if not available.
    """
    result = await _ensure_swarm_components()
    return result[1] if result else None


async def get_swarm_dispatcher() -> SwarmDispatcher | None:
    """Get the swarm dispatcher.

    Returns:
        SwarmDispatcher instance or None if not available.
    """
    result = await _ensure_swarm_components()
    return result[2] if result else None


# =============================================================================
# Validation Functions
# =============================================================================


def validate_target_path(path: str, config: SwarmConfig) -> str:
    """Validate target path is within allowed directories.

    URLs (http:// or https://) are accepted as-is for external repo targets.
    Local paths are validated against allowed prefixes.

    Args:
        path: Target path to validate.
        config: Swarm configuration with allowed prefixes.

    Returns:
        The validated path.

    Raises:
        HTTPException: 400 if path is invalid.
    """
    # Accept URLs as-is (external repo targets for review)
    if path.startswith("http://") or path.startswith("https://"):
        return path

    # Reject absolute paths
    if path.startswith("/"):
        raise HTTPException(status_code=400, detail="Absolute paths not allowed")

    # Reject path traversal
    if ".." in path:
        raise HTTPException(status_code=400, detail="Path traversal not allowed")

    # Check against allowed prefixes
    allowed = any(path.startswith(prefix) for prefix in config.allowed_path_prefixes)
    if not allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Path must start with one of: {config.allowed_path_prefixes}",
        )

    return path


def validate_reviewer_types(
    types: list[str] | None, registry: ReviewerRegistry
) -> list[str] | None:
    """Validate reviewer types exist in registry.

    Args:
        types: List of reviewer types to validate, or None.
        registry: Reviewer registry to check against.

    Returns:
        The validated list, or None if input was None.

    Raises:
        HTTPException: 400 if any type is unknown.
    """
    if types is None:
        return None

    valid_types = registry.list_types()
    for t in types:
        if t not in valid_types:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown reviewer type: {t}. Valid types: {valid_types}",
            )

    return types


# =============================================================================
# Rate Limiting
# =============================================================================


async def check_rate_limit(
    config: SwarmConfig = Depends(get_swarm_config),  # noqa: B008
) -> None:
    """Dependency to check rate limit.

    Args:
        config: Swarm configuration with rate limit settings.

    Raises:
        HTTPException: 429 if at capacity.
    """
    async with _active_swarms_lock:
        if len(_active_swarms) >= config.max_concurrent_swarms:
            raise HTTPException(
                status_code=429,
                detail=f"Too many concurrent swarms. Max: {config.max_concurrent_swarms}",
            )


async def register_swarm(swarm_id: str) -> None:
    """Register a swarm as active.

    Args:
        swarm_id: The swarm ID to register.
    """
    async with _active_swarms_lock:
        _active_swarms.add(swarm_id)


async def unregister_swarm(swarm_id: str) -> None:
    """Unregister a swarm as active.

    Args:
        swarm_id: The swarm ID to unregister.
    """
    async with _active_swarms_lock:
        _active_swarms.discard(swarm_id)


# =============================================================================
# Background Task
# =============================================================================


async def run_swarm_background(
    swarm_id: str,
    dispatcher: SwarmDispatcher,
) -> None:
    """Collect results, aggregate, and finalize a swarm that was already dispatched.

    This function is meant to run as a background task after
    ``dispatcher.dispatch_swarm`` has already created the session and
    started the parallel reviewer tasks.  It only performs the
    collect -> aggregate -> finalize steps.

    Args:
        swarm_id: The swarm session ID returned by dispatch_swarm.
        dispatcher: The swarm dispatcher instance.
    """
    try:
        # 1. Collect results (waits for all reviewers)
        results = await dispatcher.collect_results(swarm_id)

        # 2. Get session for aggregation context
        session = await dispatcher._session_manager.get_session(swarm_id)
        if not session:
            raise ValueError(f"Session lost: {swarm_id}")

        # 3. Aggregate findings into unified report
        report = dispatcher._aggregator.aggregate(session, results)

        # 4. Finalize swarm (mark complete, publish coordination msg)
        await dispatcher.finalize_swarm(swarm_id, report)

    except Exception as e:
        logger.error("Swarm %s background processing failed: %s", swarm_id, e)
        try:
            await dispatcher.fail_swarm(swarm_id, str(e))
        except Exception as fail_err:
            logger.error("Failed to mark swarm %s as failed: %s", swarm_id, fail_err)
    finally:
        await unregister_swarm(swarm_id)


# =============================================================================
# Endpoints
# =============================================================================


@router.post(
    "/review",
    response_model=SwarmReviewResponse,
    status_code=202,
    dependencies=[Depends(check_rate_limit)],
)
async def trigger_swarm_review(
    request: SwarmReviewRequest,
    background_tasks: BackgroundTasks,
    config: SwarmConfig = Depends(get_swarm_config),  # noqa: B008
    registry: ReviewerRegistry = Depends(get_reviewer_registry),  # noqa: B008
    dispatcher: SwarmDispatcher | None = Depends(get_swarm_dispatcher),  # noqa: B008
) -> SwarmReviewResponse:
    """Trigger a parallel review swarm.

    The review runs asynchronously. Use the poll_url to check status.

    Args:
        request: Request body with target path and options.
        background_tasks: FastAPI background task manager.
        config: Swarm configuration.
        registry: Reviewer registry.
        dispatcher: Swarm dispatcher instance.

    Returns:
        SwarmReviewResponse with swarm_id, status, and poll_url.

    Raises:
        HTTPException: 400 if request is invalid.
        HTTPException: 429 if at capacity.
        HTTPException: 503 if dispatcher unavailable.
    """
    # Validate inputs
    validated_path = validate_target_path(request.target_path, config)
    validated_types = validate_reviewer_types(request.reviewer_types, registry)

    # Check if dispatcher is available
    if dispatcher is None:
        raise HTTPException(
            status_code=503,
            detail="Swarm dispatcher not available",
        )

    # Dispatch the swarm (creates session and starts tasks)
    swarm_id = await dispatcher.dispatch_swarm(
        target_path=validated_path,
        reviewer_types=validated_types,
        timeout_seconds=request.timeout_seconds,
    )

    # Register for rate limiting
    await register_swarm(swarm_id)

    # Schedule background task to collect results, aggregate, and finalize.
    # dispatch_swarm already started the reviewer tasks; this background
    # task waits for them to complete and produces the unified report.
    background_tasks.add_task(run_swarm_background, swarm_id, dispatcher)

    return SwarmReviewResponse(
        swarm_id=swarm_id,
        status="pending",
        poll_url=f"/api/swarm/review/{swarm_id}",
    )


@router.get("/review/{swarm_id}", response_model=SwarmStatusResponse)
async def get_swarm_status(
    swarm_id: str,
    session_manager: SwarmSessionManager | None = Depends(get_swarm_session_manager),  # noqa: B008
    redis_store: SwarmRedisStore | None = Depends(get_swarm_redis_store),  # noqa: B008
) -> SwarmStatusResponse:
    """Get status and results of a swarm review.

    When status is 'complete', the unified_report field contains the full results.

    Args:
        swarm_id: The swarm session ID.
        session_manager: Session manager instance.

    Returns:
        SwarmStatusResponse with current status and results.

    Raises:
        HTTPException: 404 if swarm not found.
        HTTPException: 503 if session manager unavailable.
    """
    if session_manager is None:
        raise HTTPException(
            status_code=503,
            detail="Session manager not available",
        )

    session = await session_manager.get_session(swarm_id)
    if session is None:
        raise HTTPException(
            status_code=404,
            detail=f"Swarm not found: {swarm_id}",
        )

    # Fetch actual results from the Redis store (BUG-4 fix).
    # session.results is often {} because results are stored in a
    # separate Redis key ({prefix}:results:{session_id}).
    # Fall back to session.results when the store is unavailable.
    actual_results: dict[str, object] = {}
    if redis_store is not None:
        try:
            actual_results = await redis_store.get_all_results(swarm_id)
        except Exception as exc:
            logger.warning("Failed to fetch results for %s: %s", swarm_id, exc)
    if not actual_results and session.results:
        actual_results = session.results

    # Build reviewer status from results
    reviewers: dict[str, ReviewerStatusResponse] = {}
    for reviewer_type in session.reviewers:
        result = actual_results.get(reviewer_type)
        if result is None:
            # Reviewer hasn't completed yet.  Show "in_progress" when
            # the session is actively running so the frontend renders
            # animated progress bars instead of a static "pending" state.
            is_running = session.status in ("in_progress", "aggregating")
            reviewers[reviewer_type] = ReviewerStatusResponse(
                status="in_progress" if is_running else "pending",
                files_reviewed=0,
                findings_count=0,
                progress_percent=30 if is_running else 0,
                duration_seconds=None,
            )
        else:
            reviewers[reviewer_type] = ReviewerStatusResponse(
                status=result.status,
                files_reviewed=len(result.files_reviewed),
                findings_count=len(result.findings),
                progress_percent=100 if result.status == "success" else 0,
                duration_seconds=result.duration_seconds,
            )

    # Calculate duration if completed
    duration_seconds: float | None = None
    if session.completed_at and session.created_at:
        duration_seconds = (session.completed_at - session.created_at).total_seconds()

    return SwarmStatusResponse(
        swarm_id=session.id,
        status=session.status if isinstance(session.status, str) else session.status.value,
        reviewers=reviewers,
        unified_report=session.unified_report,
        duration_seconds=duration_seconds,
        error_message=session.error_message,
    )
