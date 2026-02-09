"""Unit tests for Guardrails API endpoints.

Tests the REST API endpoints for listing and getting guardrails guidelines.
"""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.core.guardrails.exceptions import (
    GuardrailsError,
    GuidelineNotFoundError,
)
from src.core.guardrails.models import (
    ActionType,
    Guideline,
    GuidelineAction,
    GuidelineCategory,
    GuidelineCondition,
)
from src.orchestrator.routes.guardrails_api import (
    get_guardrails_store,
    router,
)


def _make_guideline(
    guideline_id: str = "gl-001",
    name: str = "Test Guideline",
    category: GuidelineCategory = GuidelineCategory.COGNITIVE_ISOLATION,
    enabled: bool = True,
    priority: int = 100,
) -> Guideline:
    """Create a test Guideline domain object."""
    now = datetime.now(timezone.utc)
    return Guideline(
        id=guideline_id,
        name=name,
        description="A test guideline",
        enabled=enabled,
        category=category,
        priority=priority,
        condition=GuidelineCondition(agents=["backend"]),
        action=GuidelineAction(
            type=ActionType.INSTRUCTION,
            instruction="Follow TDD",
        ),
        metadata={},
        version=1,
        created_at=now,
        updated_at=now,
        created_by="test-user",
    )


@pytest.fixture
def mock_store() -> AsyncMock:
    """Create a mock GuardrailsStore."""
    return AsyncMock()


@pytest.fixture
def client(mock_store: AsyncMock) -> TestClient:
    """Create test client with mocked store dependency."""
    app = FastAPI()
    app.include_router(router)

    app.dependency_overrides[get_guardrails_store] = lambda: mock_store

    return TestClient(app)


class TestListGuidelines:
    """Tests for GET /api/guardrails."""

    def test_list_guidelines_empty(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test listing guidelines when none exist."""
        mock_store.list_guidelines.return_value = ([], 0)

        response = client.get("/api/guardrails")

        assert response.status_code == 200
        data = response.json()
        assert data["guidelines"] == []
        assert data["total"] == 0
        assert data["page"] == 1
        assert data["page_size"] == 20

    def test_list_guidelines_with_results(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test listing guidelines returns guideline data."""
        gl1 = _make_guideline("gl-001", "First Guideline")
        gl2 = _make_guideline("gl-002", "Second Guideline")
        mock_store.list_guidelines.return_value = ([gl1, gl2], 2)

        response = client.get("/api/guardrails")

        assert response.status_code == 200
        data = response.json()
        assert len(data["guidelines"]) == 2
        assert data["total"] == 2
        assert data["guidelines"][0]["id"] == "gl-001"
        assert data["guidelines"][0]["name"] == "First Guideline"
        assert data["guidelines"][1]["id"] == "gl-002"

    def test_list_guidelines_with_category_filter(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test listing guidelines filtered by category."""
        gl = _make_guideline(category=GuidelineCategory.TDD_PROTOCOL)
        mock_store.list_guidelines.return_value = ([gl], 1)

        response = client.get("/api/guardrails?category=tdd_protocol")

        assert response.status_code == 200
        data = response.json()
        assert len(data["guidelines"]) == 1
        # Verify the store was called with the category filter
        mock_store.list_guidelines.assert_called_once()
        call_kwargs = mock_store.list_guidelines.call_args
        assert call_kwargs.kwargs.get("category") is not None or (
            len(call_kwargs.args) > 0
        )

    def test_list_guidelines_with_enabled_filter(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test listing guidelines filtered by enabled status."""
        gl = _make_guideline(enabled=True)
        mock_store.list_guidelines.return_value = ([gl], 1)

        response = client.get("/api/guardrails?enabled=true")

        assert response.status_code == 200
        data = response.json()
        assert len(data["guidelines"]) == 1
        mock_store.list_guidelines.assert_called_once()

    def test_list_guidelines_with_pagination(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test listing guidelines with custom pagination params."""
        gl = _make_guideline()
        mock_store.list_guidelines.return_value = ([gl], 50)

        response = client.get("/api/guardrails?page=3&page_size=10")

        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 3
        assert data["page_size"] == 10
        # Verify pagination was passed to the store
        mock_store.list_guidelines.assert_called_once()
        call_kwargs = mock_store.list_guidelines.call_args.kwargs
        assert call_kwargs["page"] == 3
        assert call_kwargs["page_size"] == 10

    def test_list_guidelines_invalid_page(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test that page < 1 returns 422 validation error."""
        response = client.get("/api/guardrails?page=0")

        assert response.status_code == 422

    def test_list_guidelines_invalid_page_size(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test that page_size > 100 returns 422 validation error."""
        response = client.get("/api/guardrails?page_size=200")

        assert response.status_code == 422

    def test_list_guidelines_store_error_returns_503(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test that store errors return 503."""
        mock_store.list_guidelines.side_effect = GuardrailsError(
            "ES connection failed"
        )

        response = client.get("/api/guardrails")

        assert response.status_code == 503
        data = response.json()
        assert "detail" in data


class TestGetGuideline:
    """Tests for GET /api/guardrails/{guideline_id}."""

    def test_get_existing_guideline(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test getting an existing guideline by ID."""
        gl = _make_guideline("gl-123", "My Guideline")
        mock_store.get_guideline.return_value = gl

        response = client.get("/api/guardrails/gl-123")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "gl-123"
        assert data["name"] == "My Guideline"
        assert data["description"] == "A test guideline"
        assert data["enabled"] is True
        assert data["category"] == "cognitive_isolation"
        assert data["priority"] == 100
        assert data["version"] == 1
        assert data["created_by"] == "test-user"
        assert "condition" in data
        assert "action" in data

    def test_get_guideline_not_found(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test getting a non-existent guideline returns 404."""
        mock_store.get_guideline.side_effect = GuidelineNotFoundError(
            "gl-missing"
        )

        response = client.get("/api/guardrails/gl-missing")

        assert response.status_code == 404
        data = response.json()
        assert "detail" in data

    def test_get_guideline_store_error_returns_503(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test that store errors return 503."""
        mock_store.get_guideline.side_effect = GuardrailsError(
            "ES connection failed"
        )

        response = client.get("/api/guardrails/gl-001")

        assert response.status_code == 503
        data = response.json()
        assert "detail" in data

    def test_get_guideline_response_has_condition_fields(
        self, client: TestClient, mock_store: AsyncMock
    ) -> None:
        """Test the response includes condition and action details."""
        gl = _make_guideline()
        mock_store.get_guideline.return_value = gl

        response = client.get("/api/guardrails/gl-001")

        assert response.status_code == 200
        data = response.json()
        condition = data["condition"]
        assert condition["agents"] == ["backend"]
        action = data["action"]
        assert action["instruction"] == "Follow TDD"


class TestGetGuardrailsStoreFactory:
    """Tests for get_guardrails_store singleton factory and shutdown."""

    @pytest.mark.asyncio
    async def test_store_uses_config_index_prefix(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test that get_guardrails_store passes index_prefix from config."""
        from src.orchestrator.routes import guardrails_api

        # Reset module-level singleton state
        guardrails_api._store = None
        guardrails_api._es_client = None

        monkeypatch.setenv("GUARDRAILS_INDEX_PREFIX", "test-tenant")
        monkeypatch.setenv("ELASTICSEARCH_URL", "http://test-es:9200")

        with patch("elasticsearch.AsyncElasticsearch") as mock_es_cls:
            mock_es = AsyncMock()
            mock_es_cls.return_value = mock_es

            store = await guardrails_api.get_guardrails_store()

            assert store._index_prefix == "test-tenant"
            mock_es_cls.assert_called_once_with(["http://test-es:9200"])

        # Cleanup
        guardrails_api._store = None
        guardrails_api._es_client = None

    @pytest.mark.asyncio
    async def test_shutdown_closes_es_client(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test that shutdown_guardrails_store closes the ES client."""
        from src.orchestrator.routes import guardrails_api

        mock_es = AsyncMock()
        mock_store = AsyncMock()
        mock_store.close = AsyncMock()

        guardrails_api._es_client = mock_es
        guardrails_api._store = mock_store

        await guardrails_api.shutdown_guardrails_store()

        mock_store.close.assert_awaited_once()
        assert guardrails_api._es_client is None
        assert guardrails_api._store is None

    @pytest.mark.asyncio
    async def test_shutdown_when_not_initialized(self) -> None:
        """Test that shutdown is safe when store was never created."""
        from src.orchestrator.routes import guardrails_api

        guardrails_api._es_client = None
        guardrails_api._store = None

        # Should not raise
        await guardrails_api.shutdown_guardrails_store()
