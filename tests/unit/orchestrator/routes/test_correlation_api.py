"""Tests for Correlation API routes.

Tests cover:
- POST /api/brainflare/correlations - Create correlation
- GET /api/brainflare/ideas/{idea_id}/correlations - Get correlations for idea
- DELETE /api/brainflare/correlations/{correlation_id} - Delete correlation
- GET /api/brainflare/graph - Get full graph for visualization
"""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from src.orchestrator.api.models.correlation import (
    CorrelationType,
    IdeaCorrelation,
)


@pytest.fixture
def client():
    """Create a test client with mocked dependencies."""
    from src.orchestrator.main import create_app

    app = create_app()
    return TestClient(app)


class TestCreateCorrelation:
    """Tests for POST /api/brainflare/correlations."""

    def test_create_correlation_success(self, client: TestClient) -> None:
        """Test creating a correlation between two ideas."""
        response = client.post(
            "/api/brainflare/correlations",
            json={
                "source_idea_id": "idea-001",
                "target_idea_id": "idea-002",
                "correlation_type": "related",
                "notes": "These ideas are connected",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["source_idea_id"] == "idea-001"
        assert data["target_idea_id"] == "idea-002"
        assert data["correlation_type"] == "related"
        assert data["notes"] == "These ideas are connected"
        assert "id" in data
        assert data["id"].startswith("corr-")

    def test_create_correlation_self_reference_error(self, client: TestClient) -> None:
        """Test that correlating an idea with itself returns 400."""
        response = client.post(
            "/api/brainflare/correlations",
            json={
                "source_idea_id": "idea-001",
                "target_idea_id": "idea-001",
                "correlation_type": "similar",
            },
        )

        assert response.status_code == 400
        assert "Cannot correlate idea with itself" in response.json()["detail"]

    def test_create_correlation_default_type(self, client: TestClient) -> None:
        """Test that correlation defaults to RELATED type."""
        response = client.post(
            "/api/brainflare/correlations",
            json={
                "source_idea_id": "idea-001",
                "target_idea_id": "idea-002",
            },
        )

        assert response.status_code == 200
        assert response.json()["correlation_type"] == "related"

    def test_create_correlation_with_similar_type(self, client: TestClient) -> None:
        """Test creating a SIMILAR correlation."""
        response = client.post(
            "/api/brainflare/correlations",
            json={
                "source_idea_id": "idea-001",
                "target_idea_id": "idea-003",
                "correlation_type": "similar",
            },
        )

        assert response.status_code == 200
        assert response.json()["correlation_type"] == "similar"

    def test_create_correlation_with_contradicts_type(self, client: TestClient) -> None:
        """Test creating a CONTRADICTS correlation."""
        response = client.post(
            "/api/brainflare/correlations",
            json={
                "source_idea_id": "idea-001",
                "target_idea_id": "idea-004",
                "correlation_type": "contradicts",
            },
        )

        assert response.status_code == 200
        assert response.json()["correlation_type"] == "contradicts"


class TestGetIdeaCorrelations:
    """Tests for GET /api/brainflare/ideas/{idea_id}/correlations."""

    def test_get_correlations_empty(self, client: TestClient) -> None:
        """Test getting correlations for an idea with none."""
        # Reset mock correlations by creating a new client
        from src.orchestrator.routes import correlation_api

        correlation_api.MOCK_CORRELATIONS.clear()

        response = client.get("/api/brainflare/ideas/idea-lonely/correlations")

        assert response.status_code == 200
        assert response.json() == []

    def test_get_correlations_returns_matching(self, client: TestClient) -> None:
        """Test getting correlations returns those matching the idea."""
        from src.orchestrator.routes import correlation_api

        correlation_api.MOCK_CORRELATIONS.clear()

        # Create a correlation first
        create_response = client.post(
            "/api/brainflare/correlations",
            json={
                "source_idea_id": "idea-test-1",
                "target_idea_id": "idea-test-2",
                "correlation_type": "related",
            },
        )
        assert create_response.status_code == 200

        # Get correlations for source idea
        response = client.get("/api/brainflare/ideas/idea-test-1/correlations")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["source_idea_id"] == "idea-test-1"
        assert data[0]["target_idea_id"] == "idea-test-2"

    def test_get_correlations_returns_bidirectional(self, client: TestClient) -> None:
        """Test that correlations are returned for both source and target."""
        from src.orchestrator.routes import correlation_api

        correlation_api.MOCK_CORRELATIONS.clear()

        # Create a correlation
        client.post(
            "/api/brainflare/correlations",
            json={
                "source_idea_id": "idea-bidir-1",
                "target_idea_id": "idea-bidir-2",
                "correlation_type": "similar",
            },
        )

        # Get correlations for target idea (should also find it)
        response = client.get("/api/brainflare/ideas/idea-bidir-2/correlations")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1


class TestDeleteCorrelation:
    """Tests for DELETE /api/brainflare/correlations/{correlation_id}."""

    def test_delete_correlation_success(self, client: TestClient) -> None:
        """Test deleting a correlation."""
        from src.orchestrator.routes import correlation_api

        correlation_api.MOCK_CORRELATIONS.clear()

        # Create a correlation first
        create_response = client.post(
            "/api/brainflare/correlations",
            json={
                "source_idea_id": "idea-del-1",
                "target_idea_id": "idea-del-2",
                "correlation_type": "related",
            },
        )
        correlation_id = create_response.json()["id"]

        # Delete it
        response = client.delete(
            f"/api/brainflare/correlations/{correlation_id}",
            params={
                "source_idea_id": "idea-del-1",
                "target_idea_id": "idea-del-2",
                "correlation_type": "related",
            },
        )

        assert response.status_code == 200
        assert response.json()["success"] is True
        assert response.json()["id"] == correlation_id

    def test_delete_correlation_removes_from_list(self, client: TestClient) -> None:
        """Test that deleted correlation is no longer returned."""
        from src.orchestrator.routes import correlation_api

        correlation_api.MOCK_CORRELATIONS.clear()

        # Create a correlation
        create_response = client.post(
            "/api/brainflare/correlations",
            json={
                "source_idea_id": "idea-rem-1",
                "target_idea_id": "idea-rem-2",
                "correlation_type": "similar",
            },
        )
        correlation_id = create_response.json()["id"]

        # Verify it exists
        get_response = client.get("/api/brainflare/ideas/idea-rem-1/correlations")
        assert len(get_response.json()) == 1

        # Delete it
        client.delete(
            f"/api/brainflare/correlations/{correlation_id}",
            params={
                "source_idea_id": "idea-rem-1",
                "target_idea_id": "idea-rem-2",
                "correlation_type": "similar",
            },
        )

        # Verify it's gone
        get_response = client.get("/api/brainflare/ideas/idea-rem-1/correlations")
        assert len(get_response.json()) == 0


class TestGetGraph:
    """Tests for GET /api/brainflare/graph."""

    def test_get_graph_returns_structure(self, client: TestClient) -> None:
        """Test that graph endpoint returns nodes and edges."""
        from src.orchestrator.routes import correlation_api

        correlation_api.MOCK_CORRELATIONS.clear()

        response = client.get("/api/brainflare/graph")

        assert response.status_code == 200
        data = response.json()
        assert "nodes" in data
        assert "edges" in data
        assert isinstance(data["nodes"], list)
        assert isinstance(data["edges"], list)

    def test_get_graph_nodes_have_required_fields(self, client: TestClient) -> None:
        """Test that graph nodes have required fields."""
        response = client.get("/api/brainflare/graph")

        assert response.status_code == 200
        data = response.json()

        # In mock mode, we get sample nodes
        for node in data["nodes"]:
            assert "id" in node
            assert "label" in node

    def test_get_graph_edges_have_required_fields(self, client: TestClient) -> None:
        """Test that graph edges have required fields when correlations exist."""
        from src.orchestrator.routes import correlation_api

        # Add a correlation to trigger edges in mock response
        correlation_api.MOCK_CORRELATIONS.clear()
        correlation_api.MOCK_CORRELATIONS.append(
            IdeaCorrelation(
                id="corr-test",
                source_idea_id="idea-001",
                target_idea_id="idea-002",
                correlation_type=CorrelationType.RELATED,
                created_by="test",
                created_at=datetime.now(timezone.utc),
            )
        )

        response = client.get("/api/brainflare/graph")

        assert response.status_code == 200
        data = response.json()

        if data["edges"]:
            for edge in data["edges"]:
                assert "id" in edge
                assert "source" in edge
                assert "target" in edge
                assert "correlation_type" in edge


class TestCorrelationTypes:
    """Tests for correlation type validation."""

    def test_invalid_correlation_type_rejected(self, client: TestClient) -> None:
        """Test that invalid correlation types are rejected."""
        response = client.post(
            "/api/brainflare/correlations",
            json={
                "source_idea_id": "idea-001",
                "target_idea_id": "idea-002",
                "correlation_type": "invalid_type",
            },
        )

        assert response.status_code == 422  # Validation error

    def test_all_valid_correlation_types(self, client: TestClient) -> None:
        """Test that all valid correlation types are accepted."""
        from src.orchestrator.routes import correlation_api

        correlation_api.MOCK_CORRELATIONS.clear()

        valid_types = ["similar", "related", "contradicts"]

        for i, corr_type in enumerate(valid_types):
            response = client.post(
                "/api/brainflare/correlations",
                json={
                    "source_idea_id": f"idea-type-{i}",
                    "target_idea_id": f"idea-type-{i+10}",
                    "correlation_type": corr_type,
                },
            )
            assert response.status_code == 200, f"Failed for type: {corr_type}"
            assert response.json()["correlation_type"] == corr_type
