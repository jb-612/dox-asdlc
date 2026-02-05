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


def get_swarm_session_manager() -> SwarmSessionManager | None:
    """Get the swarm session manager.

    This returns None by default. In production, this should be wired up
    to return a properly configured SwarmSessionManager.

    Returns:
        SwarmSessionManager instance or None.
    """
    # Placeholder - will be wired up when dispatcher infrastructure is available
    return None


def get_swarm_dispatcher() -> SwarmDispatcher | None:
    """Get the swarm dispatcher.

    This returns None by default. In production, this should be wired up
    to return a properly configured SwarmDispatcher.

    Returns:
        SwarmDispatcher instance or None.
    """
    # Placeholder - will be wired up when dispatcher infrastructure is available
    return None


# =============================================================================
# Validation Functions
# =============================================================================


def validate_target_path(path: str, config: SwarmConfig) -> str:
    """Validate target path is within allowed directories.

    Args:
        path: Target path to validate.
        config: Swarm configuration with allowed prefixes.

    Returns:
        The validated path.

    Raises:
        HTTPException: 400 if path is invalid.
    """
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
    target_path: str,
    reviewer_types: list[str] | None,
    timeout_seconds: int | None,
) -> None:
    """Run swarm review in background.

    Args:
        swarm_id: The swarm session ID.
        dispatcher: The swarm dispatcher instance.
        target_path: Path to review.
        reviewer_types: Optional list of reviewer types.
        timeout_seconds: Optional timeout.
    """
    try:
        # Note: dispatch_swarm already creates the session, so we just need
        # to run the full flow and clean up after
        await dispatcher.run_swarm(target_path, reviewer_types, timeout_seconds)
    except Exception as e:
        logger.error(f"Swarm {swarm_id} failed: {e}")
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

    # Run the full swarm flow in background (collect, aggregate, finalize)
    # Note: dispatch_swarm already started the tasks, background just waits
    # For simplicity, we don't add background task here since dispatch_swarm
    # handles the task spawning. The client polls for status.

    return SwarmReviewResponse(
        swarm_id=swarm_id,
        status="pending",
        poll_url=f"/api/swarm/review/{swarm_id}",
    )


@router.get("/review/{swarm_id}", response_model=SwarmStatusResponse)
async def get_swarm_status(
    swarm_id: str,
    session_manager: SwarmSessionManager | None = Depends(get_swarm_session_manager),  # noqa: B008
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

    # Build reviewer status from results
    reviewers: dict[str, ReviewerStatusResponse] = {}
    for reviewer_type in session.reviewers:
        result = session.results.get(reviewer_type)
        if result is None:
            # Reviewer hasn't completed yet
            reviewers[reviewer_type] = ReviewerStatusResponse(
                status="pending",
                files_reviewed=0,
                findings_count=0,
                progress_percent=0,
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
        error_message=None,  # TODO: Store error message in session
    )
