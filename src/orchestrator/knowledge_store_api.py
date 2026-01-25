"""KnowledgeStore REST API endpoints for the orchestrator service.

Provides HTTP API for KnowledgeStore operations used by the ELK Search UI:
- POST /api/knowledge-store/search
- GET /api/knowledge-store/documents/{doc_id}
- GET /api/knowledge-store/health
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

    return router
