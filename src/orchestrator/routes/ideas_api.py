"""Ideas API routes for Brainflare Hub.

Provides CRUD endpoints for ideas:
- POST /api/brainflare/ideas - Create idea
- GET /api/brainflare/ideas - List ideas
- GET /api/brainflare/ideas/{idea_id} - Get idea
- PUT /api/brainflare/ideas/{idea_id} - Update idea
- DELETE /api/brainflare/ideas/{idea_id} - Delete idea
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Path, Query

from src.orchestrator.api.models.idea import (
    CreateIdeaRequest,
    Idea,
    IdeaClassification,
    IdeaListResponse,
    IdeaStatus,
    UpdateIdeaRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/brainflare/ideas", tags=["ideas"])


def _get_service():
    """Get ideas service instance."""
    return get_ideas_service()


def get_ideas_service():
    """Get ideas service - import here to avoid circular imports.

    Returns:
        IdeasService | None: The service instance, or None if unavailable.
    """
    try:
        from src.orchestrator.services.ideas_service import (
            get_ideas_service as _get,
        )

        return _get()
    except Exception:
        return None


# Mock data for development
MOCK_IDEAS: list[Idea] = [
    Idea(
        id="idea-001",
        content="Add dark mode support to the application for better accessibility and user preference",
        author_id="user-1",
        author_name="Alice",
        status=IdeaStatus.ACTIVE,
        classification=IdeaClassification.FUNCTIONAL,
        labels=["ui", "accessibility"],
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        word_count=13,
    ),
    Idea(
        id="idea-002",
        content="Implement caching layer to improve API response times",
        author_id="user-2",
        author_name="Bob",
        status=IdeaStatus.ACTIVE,
        classification=IdeaClassification.NON_FUNCTIONAL,
        labels=["performance", "backend"],
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        word_count=8,
    ),
]


def _count_words(text: str) -> int:
    """Count words in text.

    Args:
        text: The text to count words in.

    Returns:
        int: Number of words in the text.
    """
    return len(text.split())


@router.post("", response_model=Idea)
async def create_idea(request: CreateIdeaRequest) -> Idea:
    """Create a new idea.

    Args:
        request: Idea creation request with content and metadata.

    Returns:
        The created idea.

    Raises:
        HTTPException: 400 if content exceeds 144 words.
    """
    # Validate word count before anything else
    word_count = _count_words(request.content)
    if word_count > 144:
        raise HTTPException(
            status_code=400,
            detail=f"Idea exceeds 144 word limit ({word_count} words)",
        )

    service = _get_service()
    if service is None:
        # Mock response
        now = datetime.now(timezone.utc)
        return Idea(
            id=f"idea-{uuid4().hex[:12]}",
            content=request.content,
            author_id=request.author_id,
            author_name=request.author_name,
            status=IdeaStatus.ACTIVE,
            classification=request.classification,
            labels=request.labels,
            created_at=now,
            updated_at=now,
            word_count=word_count,
        )

    try:
        return await service.create_idea(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to create idea: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("", response_model=IdeaListResponse)
async def list_ideas(
    status: IdeaStatus | None = Query(None, description="Filter by status"),
    classification: IdeaClassification | None = Query(
        None, description="Filter by classification"
    ),
    search: str | None = Query(None, description="Search in content"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> IdeaListResponse:
    """List ideas with optional filters.

    Args:
        status: Filter by idea status (active/archived).
        classification: Filter by classification type.
        search: Full-text search in content.
        limit: Maximum number of ideas to return (1-100).
        offset: Number of ideas to skip for pagination.

    Returns:
        IdeaListResponse: List of matching ideas with pagination info.
    """
    service = _get_service()
    if service is None:
        # Mock response
        filtered = MOCK_IDEAS.copy()
        if status:
            filtered = [i for i in filtered if i.status == status]
        if classification:
            filtered = [i for i in filtered if i.classification == classification]
        return IdeaListResponse(
            ideas=filtered[offset : offset + limit],
            total=len(filtered),
            limit=limit,
            offset=offset,
        )

    try:
        ideas, total = await service.list_ideas(
            status=status,
            classification=classification,
            search=search,
            limit=limit,
            offset=offset,
        )
        return IdeaListResponse(ideas=ideas, total=total, limit=limit, offset=offset)
    except Exception as e:
        logger.error(f"Failed to list ideas: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{idea_id}", response_model=Idea)
async def get_idea(
    idea_id: str = Path(..., description="Idea ID"),
) -> Idea:
    """Get a specific idea by ID.

    Args:
        idea_id: The ID of the idea to retrieve.

    Returns:
        Idea: The requested idea.

    Raises:
        HTTPException: 404 if idea not found.
    """
    service = _get_service()
    if service is None:
        # Mock response
        for idea in MOCK_IDEAS:
            if idea.id == idea_id:
                return idea
        raise HTTPException(status_code=404, detail="Idea not found")

    try:
        idea = await service.get_idea(idea_id)
        if idea is None:
            raise HTTPException(status_code=404, detail="Idea not found")
        return idea
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get idea: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{idea_id}", response_model=Idea)
async def update_idea(
    request: UpdateIdeaRequest,
    idea_id: str = Path(..., description="Idea ID"),
) -> Idea:
    """Update an existing idea.

    Args:
        request: Update request with fields to modify.
        idea_id: The ID of the idea to update.

    Returns:
        Idea: The updated idea.

    Raises:
        HTTPException: 400 if content exceeds 144 words.
        HTTPException: 404 if idea not found.
    """
    # Validate word count if content is being updated
    if request.content is not None:
        word_count = _count_words(request.content)
        if word_count > 144:
            raise HTTPException(
                status_code=400,
                detail=f"Idea exceeds 144 word limit ({word_count} words)",
            )

    service = _get_service()
    if service is None:
        # Mock response
        for i, idea in enumerate(MOCK_IDEAS):
            if idea.id == idea_id:
                update_dict = {
                    k: v for k, v in request.model_dump().items() if v is not None
                }
                update_dict["updated_at"] = datetime.now(timezone.utc)
                if request.content is not None:
                    update_dict["word_count"] = _count_words(request.content)
                updated = idea.model_copy(update=update_dict)
                MOCK_IDEAS[i] = updated
                return updated
        raise HTTPException(status_code=404, detail="Idea not found")

    try:
        idea = await service.update_idea(idea_id, request)
        if idea is None:
            raise HTTPException(status_code=404, detail="Idea not found")
        return idea
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update idea: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{idea_id}")
async def delete_idea(
    idea_id: str = Path(..., description="Idea ID"),
) -> dict:
    """Delete an idea.

    Args:
        idea_id: The ID of the idea to delete.

    Returns:
        dict: Success response with deleted idea ID.

    Raises:
        HTTPException: 404 if idea not found.
    """
    service = _get_service()
    if service is None:
        # Mock response
        for i, idea in enumerate(MOCK_IDEAS):
            if idea.id == idea_id:
                MOCK_IDEAS.pop(i)
                return {"success": True, "id": idea_id}
        raise HTTPException(status_code=404, detail="Idea not found")

    try:
        deleted = await service.delete_idea(idea_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Idea not found")
        return {"success": True, "id": idea_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete idea: {e}")
        raise HTTPException(status_code=500, detail=str(e))
