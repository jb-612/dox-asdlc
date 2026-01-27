"""DevOps activity API endpoints.

This module provides API endpoints for tracking DevOps operations,
including current and recent activities.

Endpoints:
- GET /api/devops/activity - Get current and recent DevOps activities
- GET /api/devops/activity/current - Get only the current activity
"""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from src.orchestrator.api.models.devops_activity import (
    DevOpsActivity,
    DevOpsActivityResponse,
)
from src.orchestrator.services.devops_activity import DevOpsActivityService


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/devops", tags=["devops"])

# Service singleton
_service: DevOpsActivityService | None = None


def get_devops_service() -> DevOpsActivityService:
    """Get or create the DevOps activity service.

    Returns:
        DevOpsActivityService instance.
    """
    global _service
    if _service is None:
        _service = DevOpsActivityService()
    return _service


class CurrentActivityResponse(BaseModel):
    """Response model for current activity endpoint."""

    current: DevOpsActivity | None = None


@router.get("/activity", response_model=DevOpsActivityResponse)
async def get_devops_activity(
    service: Annotated[DevOpsActivityService, Depends(get_devops_service)],
    limit: Annotated[
        int,
        Query(
            ge=1,
            le=100,
            description="Maximum number of recent activities to return",
        ),
    ] = 10,
) -> DevOpsActivityResponse:
    """Get current and recent DevOps activities.

    Returns the currently running DevOps operation (if any) along with
    a list of recently completed or failed operations.

    Args:
        service: DevOps activity service (injected).
        limit: Maximum number of recent activities to return (1-100).

    Returns:
        DevOpsActivityResponse with current and recent activities.

    Raises:
        HTTPException: If service is unavailable (503).
    """
    try:
        response = await service.get_activity(limit=limit)
        return response
    except Exception as e:
        logger.error(f"Error getting DevOps activity: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"DevOps activity service unavailable: Error retrieving activity",
        ) from e


@router.get("/activity/current", response_model=CurrentActivityResponse)
async def get_current_devops_activity(
    service: Annotated[DevOpsActivityService, Depends(get_devops_service)],
) -> CurrentActivityResponse:
    """Get the current in-progress DevOps activity.

    Returns only the currently running DevOps operation, or null if
    no operation is in progress.

    Args:
        service: DevOps activity service (injected).

    Returns:
        CurrentActivityResponse with current activity or null.

    Raises:
        HTTPException: If service is unavailable (503).
    """
    try:
        current = await service.get_current_activity()
        return CurrentActivityResponse(current=current)
    except Exception as e:
        logger.error(f"Error getting current DevOps activity: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"DevOps activity service unavailable: Error retrieving activity",
        ) from e
