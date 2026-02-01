"""Correlation API routes for Brainflare Hub.

Provides endpoints for idea linking and graph visualization:
- POST /api/brainflare/correlations - Create correlation
- GET /api/brainflare/ideas/{idea_id}/correlations - Get correlations for idea
- DELETE /api/brainflare/correlations/{correlation_id} - Delete correlation
- GET /api/brainflare/graph - Get full graph for visualization
"""

from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Path, Query

from src.orchestrator.api.models.correlation import (
    CorrelationType,
    CreateCorrelationRequest,
    GraphEdge,
    GraphNode,
    GraphResponse,
    IdeaCorrelation,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/brainflare", tags=["correlations"])


def _use_mock_mode() -> bool:
    """Check if mock mode should be used.

    Returns True if CORRELATION_MOCK_MODE=true or if we're in a test environment
    without Redis available.
    """
    return os.getenv("CORRELATION_MOCK_MODE", "true").lower() == "true"


def _get_graph_store():
    """Get graph store instance.

    Returns:
        RedisGraphStore | None: The graph store instance, or None if unavailable
                                or mock mode is enabled.
    """
    if _use_mock_mode():
        return None
    try:
        from src.infrastructure.graph_store.redis_store import get_graph_store

        return get_graph_store()
    except Exception:
        return None


def _get_ideas_service():
    """Get ideas service for node data.

    Returns:
        IdeasService | None: The ideas service instance, or None if unavailable.
    """
    try:
        from src.orchestrator.services.ideas_service import get_ideas_service

        return get_ideas_service()
    except Exception:
        return None


# Mock data for development
MOCK_CORRELATIONS: list[IdeaCorrelation] = []


@router.post("/correlations", response_model=IdeaCorrelation)
async def create_correlation(request: CreateCorrelationRequest) -> IdeaCorrelation:
    """Create a correlation between two ideas.

    Args:
        request: Correlation creation request with source, target, and type.

    Returns:
        The created correlation.

    Raises:
        HTTPException: 400 if trying to correlate idea with itself.
        HTTPException: 500 if graph store operation fails.
    """
    if request.source_idea_id == request.target_idea_id:
        raise HTTPException(
            status_code=400, detail="Cannot correlate idea with itself"
        )

    graph_store = _get_graph_store()
    correlation_id = f"corr-{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)

    correlation = IdeaCorrelation(
        id=correlation_id,
        source_idea_id=request.source_idea_id,
        target_idea_id=request.target_idea_id,
        correlation_type=request.correlation_type,
        created_by="anonymous",
        notes=request.notes,
        created_at=now,
    )

    if graph_store is None:
        # Mock mode
        MOCK_CORRELATIONS.append(correlation)
        return correlation

    try:
        # Add edge to graph
        await graph_store.add_edge(
            from_id=request.source_idea_id,
            to_id=request.target_idea_id,
            edge_type=request.correlation_type.value,
            properties={
                "id": correlation_id,
                "notes": request.notes or "",
                "created_by": "anonymous",
                "created_at": now.isoformat(),
            },
        )
        return correlation
    except Exception as e:
        logger.error(f"Failed to create correlation: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/ideas/{idea_id}/correlations", response_model=list[IdeaCorrelation])
async def get_idea_correlations(
    idea_id: str = Path(..., description="Idea ID"),
) -> list[IdeaCorrelation]:
    """Get all correlations for an idea.

    Args:
        idea_id: The ID of the idea to get correlations for.

    Returns:
        List of correlations involving the idea.

    Raises:
        HTTPException: 500 if graph store operation fails.
    """
    graph_store = _get_graph_store()

    if graph_store is None:
        # Mock mode
        return [
            c
            for c in MOCK_CORRELATIONS
            if c.source_idea_id == idea_id or c.target_idea_id == idea_id
        ]

    try:
        edges = await graph_store.get_edges(idea_id)
        correlations = []
        for edge in edges:
            correlations.append(
                IdeaCorrelation(
                    id=edge.get("id", f"corr-{uuid.uuid4().hex[:8]}"),
                    source_idea_id=edge["source"],
                    target_idea_id=edge["target"],
                    correlation_type=CorrelationType(edge["edge_type"]),
                    created_by=edge.get("created_by", "unknown"),
                    notes=edge.get("notes"),
                    created_at=(
                        datetime.fromisoformat(edge["created_at"])
                        if edge.get("created_at")
                        else datetime.now(timezone.utc)
                    ),
                )
            )
        return correlations
    except Exception as e:
        logger.error(f"Failed to get correlations: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/correlations/{correlation_id}")
async def delete_correlation(
    correlation_id: str = Path(..., description="Correlation ID"),
    source_idea_id: str = Query(..., description="Source idea ID"),
    target_idea_id: str = Query(..., description="Target idea ID"),
    correlation_type: CorrelationType = Query(..., description="Correlation type"),
) -> dict:
    """Delete a correlation.

    Args:
        correlation_id: The ID of the correlation to delete.
        source_idea_id: Source idea ID (needed to locate edge).
        target_idea_id: Target idea ID (needed to locate edge).
        correlation_type: Correlation type (needed to locate edge).

    Returns:
        Success response with deleted correlation ID.

    Raises:
        HTTPException: 404 if correlation not found.
        HTTPException: 500 if graph store operation fails.
    """
    graph_store = _get_graph_store()

    if graph_store is None:
        # Mock mode
        global MOCK_CORRELATIONS
        MOCK_CORRELATIONS = [c for c in MOCK_CORRELATIONS if c.id != correlation_id]
        return {"success": True, "id": correlation_id}

    try:
        removed = await graph_store.remove_edge(
            from_id=source_idea_id,
            to_id=target_idea_id,
            edge_type=correlation_type.value,
        )
        if not removed:
            raise HTTPException(status_code=404, detail="Correlation not found")
        return {"success": True, "id": correlation_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete correlation: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/graph", response_model=GraphResponse)
async def get_graph() -> GraphResponse:
    """Get full graph data for visualization.

    Returns all ideas as nodes, with edges for correlations.
    Ideas appear even without correlations (isolated nodes).

    Returns:
        Graph data containing nodes (ideas) and edges (correlations).

    Raises:
        HTTPException: 500 if graph store operation fails.
    """
    graph_store = _get_graph_store()
    ideas_service = _get_ideas_service()

    # Get ALL ideas from the ideas service
    all_ideas = []
    if ideas_service:
        try:
            ideas_list, _ = await ideas_service.list_ideas(limit=500)
            all_ideas = ideas_list
        except Exception as e:
            logger.warning(f"Failed to fetch ideas: {e}")

    # Get edges from graph store or mock correlations
    edges = []
    if graph_store is None:
        # Mock mode - use MOCK_CORRELATIONS list
        for corr in MOCK_CORRELATIONS:
            edges.append(
                GraphEdge(
                    id=corr.id,
                    source=corr.source_idea_id,
                    target=corr.target_idea_id,
                    correlation_type=corr.correlation_type,
                )
            )
    else:
        # Real mode - get from graph store
        try:
            _, raw_edges = await graph_store.get_graph()
            edges = [
                GraphEdge(
                    id=e.get("id", f"edge-{e['source'][:6]}-{e['target'][:6]}"),
                    source=e["source"],
                    target=e["target"],
                    correlation_type=CorrelationType(e["edge_type"]),
                )
                for e in raw_edges
            ]
        except Exception as e:
            logger.warning(f"Failed to get edges from graph store: {e}")

    # Build nodes from ALL ideas
    nodes = []
    for idea in all_ideas:
        # Count degree from edges
        degree = sum(
            1 for e in edges if e.source == idea.id or e.target == idea.id
        )
        nodes.append(
            GraphNode(
                id=idea.id,
                label=(
                    idea.content[:50] + "..."
                    if len(idea.content) > 50
                    else idea.content
                ),
                classification=idea.classification.value,
                labels=idea.labels,
                degree=degree,
            )
        )

    # If no ideas found (service unavailable), fall back to minimal mock
    if not nodes:
        logger.warning("No ideas found, returning empty graph")

    return GraphResponse(nodes=nodes, edges=edges)
