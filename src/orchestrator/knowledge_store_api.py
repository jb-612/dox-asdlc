"""KnowledgeStore REST API endpoints for the orchestrator service.

Provides HTTP API for KnowledgeStore operations used by the ELK Search UI:
- POST /api/knowledge-store/search
- GET /api/knowledge-store/documents/{doc_id}
- GET /api/knowledge-store/health
- POST /api/knowledge-store/reindex
- GET /api/knowledge-store/reindex/status
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from src.core.exceptions import BackendConnectionError, SearchError
from src.infrastructure.knowledge_store.factory import get_knowledge_store

logger = logging.getLogger(__name__)


class SearchRequest(BaseModel):
    """Request body for search endpoint."""

    query: str = Field(..., min_length=1, description="Search query text")
    top_k: int = Field(default=10, ge=1, le=100, description="Maximum results")
    filters: dict[str, Any] | None = Field(
        default=None, description="Optional metadata filters"
    )


class SearchResultItem(BaseModel):
    """Single search result."""

    doc_id: str
    content: str
    metadata: dict[str, Any]
    score: float


class SearchResponse(BaseModel):
    """Response body for search endpoint."""

    results: list[SearchResultItem]
    total: int


class DocumentResponse(BaseModel):
    """Response body for document retrieval."""

    doc_id: str
    content: str
    metadata: dict[str, Any]


class HealthResponse(BaseModel):
    """Response body for health check."""

    status: str
    backend: str
    url: str
    error: str | None = None
    cluster_status: str | None = None
    cluster_name: str | None = None
    index: str | None = None


class ErrorResponse(BaseModel):
    """Error response body."""

    error: str
    detail: str | None = None


class ReindexRequest(BaseModel):
    """Request body for reindex endpoint."""

    path: str | None = Field(
        default=None,
        description="Optional path to re-index. If not provided, indexes entire repo.",
    )
    force: bool = Field(
        default=False, description="Force re-index even if already indexed"
    )


class ReindexResponse(BaseModel):
    """Response body for reindex endpoint."""

    status: str  # 'started', 'already_running', 'completed'
    job_id: str | None = None
    message: str


class ReindexStatusResponse(BaseModel):
    """Response body for reindex status endpoint."""

    status: str  # 'idle', 'running', 'completed', 'failed'
    job_id: str | None = None
    progress: int | None = None  # Percentage 0-100
    files_indexed: int | None = None
    total_files: int | None = None
    error: str | None = None
    started_at: str | None = None
    completed_at: str | None = None


# Global state for reindex job (in production, use Redis or database)
_reindex_state: dict[str, Any] = {
    "status": "idle",
    "job_id": None,
    "progress": None,
    "files_indexed": None,
    "total_files": None,
    "error": None,
    "started_at": None,
    "completed_at": None,
}


def create_knowledge_store_router() -> APIRouter:
    """Create and configure the KnowledgeStore API router.

    Returns:
        APIRouter: Configured FastAPI router with KnowledgeStore endpoints.
    """
    router = APIRouter(tags=["knowledge-store"])

    @router.post(
        "/search",
        response_model=SearchResponse,
        responses={500: {"model": ErrorResponse}},
    )
    async def search(request: SearchRequest) -> SearchResponse:
        """Search for documents in the knowledge store.

        Args:
            request: Search parameters including query, top_k, and optional filters.

        Returns:
            SearchResponse with results and total count.

        Raises:
            HTTPException: 500 if backend error occurs.
        """
        try:
            store = get_knowledge_store()
            results = await store.search(
                query=request.query,
                top_k=request.top_k,
                filters=request.filters,
            )

            return SearchResponse(
                results=[
                    SearchResultItem(
                        doc_id=r.doc_id,
                        content=r.content,
                        metadata=r.metadata,
                        score=r.score,
                    )
                    for r in results
                ],
                total=len(results),
            )
        except SearchError as e:
            logger.error(f"Search failed: {e}")
            raise HTTPException(status_code=500, detail={"error": str(e)})
        except Exception as e:
            logger.error(f"Unexpected search error: {e}")
            raise HTTPException(
                status_code=500, detail={"error": "Internal server error"}
            )

    @router.get(
        "/documents/{doc_id}",
        response_model=DocumentResponse,
        responses={
            404: {"model": ErrorResponse},
            500: {"model": ErrorResponse},
        },
    )
    async def get_document(doc_id: str) -> DocumentResponse:
        """Retrieve a document by its ID.

        Args:
            doc_id: Unique document identifier.

        Returns:
            DocumentResponse with document content and metadata.

        Raises:
            HTTPException: 404 if document not found, 400 if invalid ID,
                500 if backend error.
        """
        try:
            store = get_knowledge_store()
            document = await store.get_by_id(doc_id)

            if document is None:
                raise HTTPException(
                    status_code=404,
                    detail={"error": f"Document not found: {doc_id}"},
                )

            return DocumentResponse(
                doc_id=document.doc_id,
                content=document.content,
                metadata=document.metadata,
            )
        except HTTPException:
            raise
        except ValueError as e:
            logger.warning(f"Invalid doc_id: {doc_id} - {e}")
            raise HTTPException(
                status_code=400,
                detail={"error": f"Invalid document ID: {e}"},
            )
        except BackendConnectionError as e:
            logger.error(f"Backend error retrieving document: {e}")
            raise HTTPException(status_code=500, detail={"error": str(e)})
        except Exception as e:
            logger.error(f"Unexpected error retrieving document: {e}")
            raise HTTPException(
                status_code=500, detail={"error": "Internal server error"}
            )

    @router.get("/health", response_model=HealthResponse)
    async def health() -> HealthResponse:
        """Check the health of the KnowledgeStore backend.

        Returns:
            HealthResponse with backend status information.
        """
        try:
            store = get_knowledge_store()
            health_info = await store.health_check()

            return HealthResponse(
                status=health_info.get("status", "unknown"),
                backend=health_info.get("backend", "unknown"),
                url=health_info.get("url", ""),
                error=health_info.get("error"),
                cluster_status=health_info.get("cluster_status"),
                cluster_name=health_info.get("cluster_name"),
                index=health_info.get("index"),
            )
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return HealthResponse(
                status="unhealthy",
                backend="unknown",
                url="",
                error=str(e),
            )

    @router.post(
        "/reindex",
        response_model=ReindexResponse,
        responses={500: {"model": ErrorResponse}},
    )
    async def reindex(request: ReindexRequest) -> ReindexResponse:
        """Trigger re-indexing of the codebase.

        Args:
            request: Reindex parameters including optional path and force flag.

        Returns:
            ReindexResponse with job status and ID.
        """
        import asyncio
        import uuid
        from datetime import datetime

        global _reindex_state

        # Check if already running
        if _reindex_state["status"] == "running":
            return ReindexResponse(
                status="already_running",
                job_id=_reindex_state["job_id"],
                message="Reindexing is already in progress",
            )

        # Start new reindex job
        job_id = str(uuid.uuid4())[:8]
        _reindex_state = {
            "status": "running",
            "job_id": job_id,
            "progress": 0,
            "files_indexed": 0,
            "total_files": None,
            "error": None,
            "started_at": datetime.utcnow().isoformat(),
            "completed_at": None,
        }

        # Start background task to simulate reindexing
        # In production, this would trigger the actual repo ingestion
        async def run_reindex():
            global _reindex_state
            try:
                # Simulate counting files
                await asyncio.sleep(0.5)
                _reindex_state["total_files"] = 50  # Simulated total

                # Simulate indexing progress
                for i in range(50):
                    if _reindex_state["status"] != "running":
                        break
                    await asyncio.sleep(0.1)  # Simulate work
                    _reindex_state["files_indexed"] = i + 1
                    _reindex_state["progress"] = int(((i + 1) / 50) * 100)

                _reindex_state["status"] = "completed"
                _reindex_state["completed_at"] = datetime.utcnow().isoformat()
                logger.info(f"Reindex job {job_id} completed")
            except Exception as e:
                _reindex_state["status"] = "failed"
                _reindex_state["error"] = str(e)
                logger.error(f"Reindex job {job_id} failed: {e}")

        # Start background task (non-blocking)
        asyncio.create_task(run_reindex())

        logger.info(f"Started reindex job {job_id} for path={request.path}")
        return ReindexResponse(
            status="started",
            job_id=job_id,
            message=f"Reindexing started for {request.path or 'entire repository'}",
        )

    @router.get("/reindex/status", response_model=ReindexStatusResponse)
    async def reindex_status() -> ReindexStatusResponse:
        """Get the current reindex job status.

        Returns:
            ReindexStatusResponse with current job status and progress.
        """
        return ReindexStatusResponse(
            status=_reindex_state["status"],
            job_id=_reindex_state["job_id"],
            progress=_reindex_state["progress"],
            files_indexed=_reindex_state["files_indexed"],
            total_files=_reindex_state["total_files"],
            error=_reindex_state["error"],
            started_at=_reindex_state["started_at"],
            completed_at=_reindex_state["completed_at"],
        )

    return router
