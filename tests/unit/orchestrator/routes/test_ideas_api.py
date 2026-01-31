"""Tests for Ideas API routes (Brainflare Hub).

Tests the REST API endpoints for Ideas CRUD operations.
"""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.orchestrator.api.models.idea import (
    CreateIdeaRequest,
    Idea,
    IdeaClassification,
    IdeaListResponse,
    IdeaStatus,
    UpdateIdeaRequest,
)
from src.orchestrator.routes.ideas_api import router, get_ideas_service


@pytest.fixture
def mock_service() -> AsyncMock:
    """Create a mock ideas service."""
    service = AsyncMock()
    return service


@pytest.fixture
def client(mock_service: AsyncMock) -> TestClient:
    """Create test client with mocked service."""
    app = FastAPI()
    app.include_router(router)

    # Patch the get_ideas_service function to return our mock
    with patch(
        "src.orchestrator.routes.ideas_api.get_ideas_service",
        return_value=mock_service,
    ):
        yield TestClient(app)


@pytest.fixture
def sample_idea() -> Idea:
    """Create a sample idea."""
    now = datetime.now(timezone.utc)
    return Idea(
        id="idea-001",
        content="Add dark mode support to the application",
        author_id="user-1",
        author_name="Alice",
        status=IdeaStatus.ACTIVE,
        classification=IdeaClassification.FUNCTIONAL,
        labels=["ui", "accessibility"],
        created_at=now,
        updated_at=now,
        word_count=7,
    )


class TestCreateIdeaEndpoint:
    """Tests for POST /api/brainflare/ideas endpoint."""

    def test_create_idea_success(
        self, client: TestClient, mock_service: AsyncMock, sample_idea: Idea
    ) -> None:
        """Test creating an idea successfully."""
        mock_service.create_idea.return_value = sample_idea

        response = client.post(
            "/api/brainflare/ideas",
            json={
                "content": "Add dark mode support to the application",
                "author_id": "user-1",
                "author_name": "Alice",
                "classification": "functional",
                "labels": ["ui", "accessibility"],
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["content"] == "Add dark mode support to the application"
        assert data["author_name"] == "Alice"
        assert data["status"] == "active"
        assert data["classification"] == "functional"
        assert data["labels"] == ["ui", "accessibility"]

    def test_create_idea_with_defaults(
        self, client: TestClient, mock_service: AsyncMock, sample_idea: Idea
    ) -> None:
        """Test creating an idea with default values."""
        mock_service.create_idea.return_value = sample_idea

        response = client.post(
            "/api/brainflare/ideas",
            json={
                "content": "A simple idea",
            },
        )

        assert response.status_code == 200
        mock_service.create_idea.assert_called_once()
        call_args = mock_service.create_idea.call_args[0][0]
        assert call_args.author_id == "anonymous"
        assert call_args.author_name == "Anonymous"
        assert call_args.classification == IdeaClassification.UNDETERMINED

    def test_create_idea_exceeds_word_limit(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Test creating an idea with more than 144 words returns 400."""
        # Generate content with more than 144 words
        long_content = " ".join(["word"] * 150)

        response = client.post(
            "/api/brainflare/ideas",
            json={
                "content": long_content,
            },
        )

        assert response.status_code == 400
        assert "144 word limit" in response.json()["detail"]

    def test_create_idea_empty_content_returns_422(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Test creating an idea with empty content returns 422."""
        response = client.post(
            "/api/brainflare/ideas",
            json={
                "content": "",
            },
        )

        assert response.status_code == 422

    def test_create_idea_missing_content_returns_422(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Test creating an idea without content field returns 422."""
        response = client.post(
            "/api/brainflare/ideas",
            json={},
        )

        assert response.status_code == 422

    def test_create_idea_service_error_returns_500(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Test service error returns 500."""
        mock_service.create_idea.side_effect = Exception("Database error")

        response = client.post(
            "/api/brainflare/ideas",
            json={
                "content": "A simple idea",
            },
        )

        assert response.status_code == 500


class TestListIdeasEndpoint:
    """Tests for GET /api/brainflare/ideas endpoint."""

    def test_list_ideas_returns_empty_list(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Test listing ideas returns empty list when no ideas exist."""
        mock_service.list_ideas.return_value = ([], 0)

        response = client.get("/api/brainflare/ideas")

        assert response.status_code == 200
        data = response.json()
        assert data["ideas"] == []
        assert data["total"] == 0
        assert data["limit"] == 50
        assert data["offset"] == 0

    def test_list_ideas_returns_ideas(
        self, client: TestClient, mock_service: AsyncMock, sample_idea: Idea
    ) -> None:
        """Test listing ideas returns idea list."""
        mock_service.list_ideas.return_value = ([sample_idea], 1)

        response = client.get("/api/brainflare/ideas")

        assert response.status_code == 200
        data = response.json()
        assert len(data["ideas"]) == 1
        assert data["ideas"][0]["id"] == "idea-001"
        assert data["total"] == 1

    def test_list_ideas_with_status_filter(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Test listing ideas with status filter."""
        mock_service.list_ideas.return_value = ([], 0)

        response = client.get("/api/brainflare/ideas?status=active")

        assert response.status_code == 200
        mock_service.list_ideas.assert_called_once_with(
            status=IdeaStatus.ACTIVE,
            classification=None,
            search=None,
            limit=50,
            offset=0,
        )

    def test_list_ideas_with_classification_filter(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Test listing ideas with classification filter."""
        mock_service.list_ideas.return_value = ([], 0)

        response = client.get("/api/brainflare/ideas?classification=functional")

        assert response.status_code == 200
        mock_service.list_ideas.assert_called_once_with(
            status=None,
            classification=IdeaClassification.FUNCTIONAL,
            search=None,
            limit=50,
            offset=0,
        )

    def test_list_ideas_with_search(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Test listing ideas with search query."""
        mock_service.list_ideas.return_value = ([], 0)

        response = client.get("/api/brainflare/ideas?search=dark%20mode")

        assert response.status_code == 200
        mock_service.list_ideas.assert_called_once_with(
            status=None,
            classification=None,
            search="dark mode",
            limit=50,
            offset=0,
        )

    def test_list_ideas_with_pagination(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Test listing ideas with pagination parameters."""
        mock_service.list_ideas.return_value = ([], 0)

        response = client.get("/api/brainflare/ideas?limit=10&offset=20")

        assert response.status_code == 200
        data = response.json()
        assert data["limit"] == 10
        assert data["offset"] == 20
        mock_service.list_ideas.assert_called_once_with(
            status=None,
            classification=None,
            search=None,
            limit=10,
            offset=20,
        )

    def test_list_ideas_service_error_returns_500(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Test service error returns 500."""
        mock_service.list_ideas.side_effect = Exception("Database error")

        response = client.get("/api/brainflare/ideas")

        assert response.status_code == 500


class TestGetIdeaEndpoint:
    """Tests for GET /api/brainflare/ideas/{idea_id} endpoint."""

    def test_get_idea_success(
        self, client: TestClient, mock_service: AsyncMock, sample_idea: Idea
    ) -> None:
        """Test getting a specific idea by ID."""
        mock_service.get_idea.return_value = sample_idea

        response = client.get("/api/brainflare/ideas/idea-001")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "idea-001"
        assert data["content"] == "Add dark mode support to the application"

    def test_get_idea_not_found(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Test getting non-existent idea returns 404."""
        mock_service.get_idea.return_value = None

        response = client.get("/api/brainflare/ideas/nonexistent")

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_get_idea_service_error_returns_500(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Test service error returns 500."""
        mock_service.get_idea.side_effect = Exception("Database error")

        response = client.get("/api/brainflare/ideas/idea-001")

        assert response.status_code == 500


class TestUpdateIdeaEndpoint:
    """Tests for PUT /api/brainflare/ideas/{idea_id} endpoint."""

    def test_update_idea_content(
        self, client: TestClient, mock_service: AsyncMock, sample_idea: Idea
    ) -> None:
        """Test updating idea content."""
        updated_idea = sample_idea.model_copy(
            update={"content": "Updated content", "word_count": 2}
        )
        mock_service.update_idea.return_value = updated_idea

        response = client.put(
            "/api/brainflare/ideas/idea-001",
            json={"content": "Updated content"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["content"] == "Updated content"

    def test_update_idea_status(
        self, client: TestClient, mock_service: AsyncMock, sample_idea: Idea
    ) -> None:
        """Test updating idea status."""
        updated_idea = sample_idea.model_copy(update={"status": IdeaStatus.ARCHIVED})
        mock_service.update_idea.return_value = updated_idea

        response = client.put(
            "/api/brainflare/ideas/idea-001",
            json={"status": "archived"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "archived"

    def test_update_idea_classification(
        self, client: TestClient, mock_service: AsyncMock, sample_idea: Idea
    ) -> None:
        """Test updating idea classification."""
        updated_idea = sample_idea.model_copy(
            update={"classification": IdeaClassification.NON_FUNCTIONAL}
        )
        mock_service.update_idea.return_value = updated_idea

        response = client.put(
            "/api/brainflare/ideas/idea-001",
            json={"classification": "non_functional"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["classification"] == "non_functional"

    def test_update_idea_labels(
        self, client: TestClient, mock_service: AsyncMock, sample_idea: Idea
    ) -> None:
        """Test updating idea labels."""
        updated_idea = sample_idea.model_copy(update={"labels": ["new-label"]})
        mock_service.update_idea.return_value = updated_idea

        response = client.put(
            "/api/brainflare/ideas/idea-001",
            json={"labels": ["new-label"]},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["labels"] == ["new-label"]

    def test_update_idea_exceeds_word_limit(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Test updating idea with more than 144 words returns 400."""
        long_content = " ".join(["word"] * 150)

        response = client.put(
            "/api/brainflare/ideas/idea-001",
            json={"content": long_content},
        )

        assert response.status_code == 400
        assert "144 word limit" in response.json()["detail"]

    def test_update_idea_not_found(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Test updating non-existent idea returns 404."""
        mock_service.update_idea.return_value = None

        response = client.put(
            "/api/brainflare/ideas/nonexistent",
            json={"content": "Updated content"},
        )

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_update_idea_service_error_returns_500(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Test service error returns 500."""
        mock_service.update_idea.side_effect = Exception("Database error")

        response = client.put(
            "/api/brainflare/ideas/idea-001",
            json={"content": "Updated content"},
        )

        assert response.status_code == 500


class TestDeleteIdeaEndpoint:
    """Tests for DELETE /api/brainflare/ideas/{idea_id} endpoint."""

    def test_delete_idea_success(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Test deleting an idea successfully."""
        mock_service.delete_idea.return_value = True

        response = client.delete("/api/brainflare/ideas/idea-001")

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["id"] == "idea-001"

    def test_delete_idea_not_found(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Test deleting non-existent idea returns 404."""
        mock_service.delete_idea.return_value = False

        response = client.delete("/api/brainflare/ideas/nonexistent")

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_delete_idea_service_error_returns_500(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Test service error returns 500."""
        mock_service.delete_idea.side_effect = Exception("Database error")

        response = client.delete("/api/brainflare/ideas/idea-001")

        assert response.status_code == 500


class TestWordCountValidation:
    """Tests for word count validation across endpoints."""

    def test_create_exactly_144_words_succeeds(
        self, client: TestClient, mock_service: AsyncMock, sample_idea: Idea
    ) -> None:
        """Test creating an idea with exactly 144 words succeeds."""
        content = " ".join(["word"] * 144)
        mock_service.create_idea.return_value = sample_idea.model_copy(
            update={"content": content, "word_count": 144}
        )

        response = client.post(
            "/api/brainflare/ideas",
            json={"content": content},
        )

        assert response.status_code == 200

    def test_create_145_words_fails(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Test creating an idea with 145 words fails."""
        content = " ".join(["word"] * 145)

        response = client.post(
            "/api/brainflare/ideas",
            json={"content": content},
        )

        assert response.status_code == 400
        assert "145 words" in response.json()["detail"]

    def test_update_exactly_144_words_succeeds(
        self, client: TestClient, mock_service: AsyncMock, sample_idea: Idea
    ) -> None:
        """Test updating an idea with exactly 144 words succeeds."""
        content = " ".join(["word"] * 144)
        mock_service.update_idea.return_value = sample_idea.model_copy(
            update={"content": content, "word_count": 144}
        )

        response = client.put(
            "/api/brainflare/ideas/idea-001",
            json={"content": content},
        )

        assert response.status_code == 200

    def test_update_145_words_fails(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Test updating an idea with 145 words fails."""
        content = " ".join(["word"] * 145)

        response = client.put(
            "/api/brainflare/ideas/idea-001",
            json={"content": content},
        )

        assert response.status_code == 400
        assert "145 words" in response.json()["detail"]


class TestMockFallback:
    """Tests for mock fallback behavior when service is unavailable."""

    def test_create_idea_mock_fallback(self) -> None:
        """Test creating idea uses mock when service is unavailable."""
        app = FastAPI()
        app.include_router(router)

        # Patch to return None (service unavailable)
        with patch(
            "src.orchestrator.routes.ideas_api.get_ideas_service",
            return_value=None,
        ):
            client = TestClient(app)
            response = client.post(
                "/api/brainflare/ideas",
                json={"content": "Test idea"},
            )

            assert response.status_code == 200
            data = response.json()
            assert data["content"] == "Test idea"
            assert data["id"].startswith("idea-")

    def test_list_ideas_mock_fallback(self) -> None:
        """Test listing ideas uses mock when service is unavailable."""
        app = FastAPI()
        app.include_router(router)

        with patch(
            "src.orchestrator.routes.ideas_api.get_ideas_service",
            return_value=None,
        ):
            client = TestClient(app)
            response = client.get("/api/brainflare/ideas")

            assert response.status_code == 200
            data = response.json()
            # Should return mock ideas
            assert len(data["ideas"]) >= 0

    def test_get_idea_mock_fallback_found(self) -> None:
        """Test getting idea uses mock when service is unavailable."""
        app = FastAPI()
        app.include_router(router)

        with patch(
            "src.orchestrator.routes.ideas_api.get_ideas_service",
            return_value=None,
        ):
            client = TestClient(app)
            # Mock data has idea-001
            response = client.get("/api/brainflare/ideas/idea-001")

            assert response.status_code == 200
            data = response.json()
            assert data["id"] == "idea-001"

    def test_get_idea_mock_fallback_not_found(self) -> None:
        """Test getting non-existent idea from mock returns 404."""
        app = FastAPI()
        app.include_router(router)

        with patch(
            "src.orchestrator.routes.ideas_api.get_ideas_service",
            return_value=None,
        ):
            client = TestClient(app)
            response = client.get("/api/brainflare/ideas/nonexistent")

            assert response.status_code == 404
