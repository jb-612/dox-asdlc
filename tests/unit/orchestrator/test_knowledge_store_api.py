"""Tests for KnowledgeStore API endpoints.

Tests the REST API endpoints for KnowledgeStore operations:
- POST /api/knowledge-store/search
- GET /api/knowledge-store/documents/{doc_id}
- GET /api/knowledge-store/health
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.infrastructure.knowledge_store.models import Document, SearchResult
from src.orchestrator.knowledge_store_api import create_knowledge_store_router


@pytest.fixture
def mock_store() -> AsyncMock:
    """Create a mock knowledge store."""
    store = AsyncMock()
    return store


@pytest.fixture
def client(mock_store: AsyncMock) -> TestClient:
    """Create test client with mocked knowledge store."""
    app = FastAPI()

    with patch(
        "src.orchestrator.knowledge_store_api.get_knowledge_store",
        return_value=mock_store,
    ):
        router = create_knowledge_store_router()
        app.include_router(router, prefix="/api/knowledge-store")

    return TestClient(app)


class TestSearchEndpoint:
    """Tests for POST /api/knowledge-store/search."""

    def test_search_basic_query(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test basic search with query string."""
        mock_store.search.return_value = [
            SearchResult(
                doc_id="doc-1",
                content="Hello world",
                metadata={"file_type": "py"},
                score=0.95,
                source="elasticsearch",
            ),
            SearchResult(
                doc_id="doc-2",
                content="Goodbye world",
                metadata={"file_type": "py"},
                score=0.85,
                source="elasticsearch",
            ),
        ]

        response = client.post(
            "/api/knowledge-store/search",
            json={"query": "hello", "top_k": 10},
        )

        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        assert "total" in data
        assert data["total"] == 2
        assert len(data["results"]) == 2
        assert data["results"][0]["doc_id"] == "doc-1"
        assert data["results"][0]["score"] == 0.95

    def test_search_with_filters(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test search with metadata filters."""
        mock_store.search.return_value = [
            SearchResult(
                doc_id="doc-1",
                content="Python code",
                metadata={"file_type": "py", "path": "/src/main.py"},
                score=0.90,
                source="elasticsearch",
            ),
        ]

        response = client.post(
            "/api/knowledge-store/search",
            json={
                "query": "python",
                "top_k": 5,
                "filters": {"file_type": "py", "path": "/src"},
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        mock_store.search.assert_called_once()

    def test_search_empty_results(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test search returning empty results."""
        mock_store.search.return_value = []

        response = client.post(
            "/api/knowledge-store/search",
            json={"query": "nonexistent", "top_k": 10},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["results"] == []

    def test_search_missing_query(self, client: TestClient) -> None:
        """Test search with missing query parameter."""
        response = client.post(
            "/api/knowledge-store/search",
            json={"top_k": 10},
        )

        assert response.status_code == 422  # Validation error

    def test_search_invalid_top_k(self, client: TestClient) -> None:
        """Test search with invalid top_k value."""
        response = client.post(
            "/api/knowledge-store/search",
            json={"query": "test", "top_k": -1},
        )

        assert response.status_code == 422  # Validation error

    def test_search_backend_error(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test search when backend raises an error."""
        from src.core.exceptions import SearchError

        mock_store.search.side_effect = SearchError("Backend unavailable")

        response = client.post(
            "/api/knowledge-store/search",
            json={"query": "test", "top_k": 10},
        )

        assert response.status_code == 500
        data = response.json()
        assert "error" in data["detail"]


class TestDocumentEndpoint:
    """Tests for GET /api/knowledge-store/documents/{doc_id}."""

    def test_get_document_found(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test getting an existing document."""
        mock_store.get_by_id.return_value = Document(
            doc_id="doc-123",
            content="Document content here",
            metadata={"author": "test", "file_type": "md"},
        )

        response = client.get("/api/knowledge-store/documents/doc-123")

        assert response.status_code == 200
        data = response.json()
        assert data["doc_id"] == "doc-123"
        assert data["content"] == "Document content here"
        assert data["metadata"]["author"] == "test"

    def test_get_document_not_found(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test getting a non-existent document."""
        mock_store.get_by_id.return_value = None

        response = client.get("/api/knowledge-store/documents/nonexistent")

        assert response.status_code == 404
        data = response.json()
        assert "error" in data["detail"]

    def test_get_document_invalid_id(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test getting document with invalid ID format."""
        mock_store.get_by_id.side_effect = ValueError("Invalid doc_id")

        response = client.get("/api/knowledge-store/documents/" + "x" * 600)

        assert response.status_code == 400

    def test_get_document_backend_error(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test getting document when backend raises an error."""
        from src.core.exceptions import BackendConnectionError

        mock_store.get_by_id.side_effect = BackendConnectionError(
            "Connection failed"
        )

        response = client.get("/api/knowledge-store/documents/doc-123")

        assert response.status_code == 500
        data = response.json()
        assert "error" in data["detail"]


class TestHealthEndpoint:
    """Tests for GET /api/knowledge-store/health."""

    def test_health_healthy(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test health check when backend is healthy."""
        mock_store.health_check.return_value = {
            "status": "healthy",
            "backend": "elasticsearch",
            "url": "http://localhost:9200",
            "cluster_status": "green",
        }

        response = client.get("/api/knowledge-store/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["backend"] == "elasticsearch"
        assert "url" in data

    def test_health_unhealthy(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test health check when backend is unhealthy."""
        mock_store.health_check.return_value = {
            "status": "unhealthy",
            "backend": "elasticsearch",
            "url": "http://localhost:9200",
            "error": "Connection refused",
        }

        response = client.get("/api/knowledge-store/health")

        # Should still return 200 with unhealthy status
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "unhealthy"
        assert "error" in data

    def test_health_backend_exception(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test health check when backend raises exception."""
        mock_store.health_check.side_effect = Exception("Unexpected error")

        response = client.get("/api/knowledge-store/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "unhealthy"
