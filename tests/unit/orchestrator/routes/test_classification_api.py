"""Unit tests for Classification API routes.

Tests the classification API endpoints for batch processing and job status.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from src.orchestrator.api.models.classification import (
    ClassificationJobStatus,
    ClassificationResult,
    ClassificationType,
)


class TestBatchClassificationEndpoint:
    """Tests for POST /api/ideas/classify/batch endpoint."""

    @pytest.fixture
    def client(self) -> TestClient:
        """Create a test client with mocked dependencies."""
        with patch(
            "src.orchestrator.routes.classification_api.get_classification_worker"
        ) as mock_get_worker:
            mock_worker = AsyncMock()
            mock_worker.enqueue_batch.return_value = "job-test-123"
            mock_get_worker.return_value = mock_worker

            from src.orchestrator.routes.classification_api import router
            from fastapi import FastAPI

            app = FastAPI()
            app.include_router(router)

            return TestClient(app)

    def test_batch_classification_success(self, client: TestClient) -> None:
        """Test successful batch classification request."""
        with patch(
            "src.orchestrator.routes.classification_api.get_classification_worker"
        ) as mock_get_worker:
            mock_worker = AsyncMock()
            mock_worker.enqueue_batch.return_value = "job-test-123"
            mock_get_worker.return_value = mock_worker

            response = client.post(
                "/api/ideas/classify/batch",
                json={"idea_ids": ["idea-1", "idea-2", "idea-3"]},
            )

            assert response.status_code == 202
            data = response.json()
            assert data["job_id"] == "job-test-123"
            assert data["status"] == "queued"

    def test_batch_classification_empty_list(self, client: TestClient) -> None:
        """Test batch classification with empty list."""
        response = client.post(
            "/api/ideas/classify/batch",
            json={"idea_ids": []},
        )

        assert response.status_code == 400
        assert "empty" in response.json()["detail"].lower()

    def test_batch_classification_invalid_request(self, client: TestClient) -> None:
        """Test batch classification with invalid request body."""
        response = client.post(
            "/api/ideas/classify/batch",
            json={"invalid_field": "value"},
        )

        assert response.status_code == 422  # Validation error


class TestJobStatusEndpoint:
    """Tests for GET /api/ideas/classify/job/{job_id} endpoint."""

    @pytest.fixture
    def client(self) -> TestClient:
        """Create a test client."""
        from src.orchestrator.routes.classification_api import router
        from fastapi import FastAPI

        app = FastAPI()
        app.include_router(router)

        return TestClient(app)

    def test_get_job_status_found(self, client: TestClient) -> None:
        """Test getting status of existing job."""
        with patch(
            "src.orchestrator.routes.classification_api.get_classification_worker"
        ) as mock_get_worker:
            mock_worker = AsyncMock()
            mock_worker.get_job_status.return_value = {
                "job_id": "job-123",
                "status": "processing",
                "total": 5,
                "completed": 2,
                "failed": 0,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            mock_get_worker.return_value = mock_worker

            response = client.get("/api/ideas/classify/job/job-123")

            assert response.status_code == 200
            data = response.json()
            assert data["job_id"] == "job-123"
            assert data["status"] == "processing"
            assert data["total"] == 5
            assert data["completed"] == 2

    def test_get_job_status_not_found(self, client: TestClient) -> None:
        """Test getting status of non-existent job."""
        with patch(
            "src.orchestrator.routes.classification_api.get_classification_worker"
        ) as mock_get_worker:
            mock_worker = AsyncMock()
            mock_worker.get_job_status.return_value = None
            mock_get_worker.return_value = mock_worker

            response = client.get("/api/ideas/classify/job/nonexistent")

            assert response.status_code == 404
            assert "not found" in response.json()["detail"].lower()

    def test_get_job_status_completed(self, client: TestClient) -> None:
        """Test getting status of completed job with results."""
        with patch(
            "src.orchestrator.routes.classification_api.get_classification_worker"
        ) as mock_get_worker:
            mock_worker = AsyncMock()
            mock_worker.get_job_status.return_value = {
                "job_id": "job-123",
                "status": "completed",
                "total": 3,
                "completed": 3,
                "failed": 0,
                "results": [
                    {
                        "idea_id": "idea-1",
                        "classification": "functional",
                        "confidence": 0.9,
                    },
                    {
                        "idea_id": "idea-2",
                        "classification": "non_functional",
                        "confidence": 0.85,
                    },
                    {
                        "idea_id": "idea-3",
                        "classification": "functional",
                        "confidence": 0.88,
                    },
                ],
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            mock_get_worker.return_value = mock_worker

            response = client.get("/api/ideas/classify/job/job-123")

            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "completed"
            assert len(data["results"]) == 3


class TestClassifySingleEndpoint:
    """Tests for POST /api/ideas/{idea_id}/classify endpoint."""

    @pytest.fixture
    def client(self) -> TestClient:
        """Create a test client."""
        from src.orchestrator.routes.classification_api import router
        from fastapi import FastAPI

        app = FastAPI()
        app.include_router(router)

        return TestClient(app)

    def test_classify_single_success(self, client: TestClient) -> None:
        """Test successful single idea classification."""
        with patch(
            "src.orchestrator.routes.classification_api.get_classification_service"
        ) as mock_get_service:
            mock_service = AsyncMock()
            mock_service.classify_idea.return_value = ClassificationResult(
                idea_id="idea-123",
                classification=ClassificationType.FUNCTIONAL,
                confidence=0.92,
                labels=["feature", "api"],
                reasoning="This describes a new API feature.",
                model_version="v1.0",
            )
            mock_get_service.return_value = mock_service

            response = client.post("/api/ideas/idea-123/classify")

            assert response.status_code == 200
            data = response.json()
            assert data["idea_id"] == "idea-123"
            assert data["classification"] == "functional"
            assert data["confidence"] == 0.92

    def test_classify_single_not_found(self, client: TestClient) -> None:
        """Test classification of non-existent idea."""
        with patch(
            "src.orchestrator.routes.classification_api.get_classification_service"
        ) as mock_get_service:
            mock_service = AsyncMock()
            mock_service.classify_idea.side_effect = ValueError("Idea not found")
            mock_get_service.return_value = mock_service

            response = client.post("/api/ideas/nonexistent/classify")

            assert response.status_code == 404

    def test_classify_single_with_force(self, client: TestClient) -> None:
        """Test force reclassification."""
        with patch(
            "src.orchestrator.routes.classification_api.get_classification_service"
        ) as mock_get_service:
            mock_service = AsyncMock()
            mock_service.classify_idea.return_value = ClassificationResult(
                idea_id="idea-123",
                classification=ClassificationType.NON_FUNCTIONAL,
                confidence=0.88,
                labels=["performance"],
            )
            mock_get_service.return_value = mock_service

            response = client.post(
                "/api/ideas/idea-123/classify",
                params={"force": "true"},
            )

            assert response.status_code == 200
            mock_service.classify_idea.assert_called_once_with(
                "idea-123", force=True
            )


class TestAddLabelsEndpoint:
    """Tests for POST /api/ideas/{idea_id}/labels endpoint."""

    @pytest.fixture
    def client(self) -> TestClient:
        """Create a test client."""
        from src.orchestrator.routes.classification_api import router
        from fastapi import FastAPI

        app = FastAPI()
        app.include_router(router)

        return TestClient(app)

    def test_add_labels_success(self, client: TestClient) -> None:
        """Test successfully adding labels to an idea."""
        with patch(
            "src.orchestrator.routes.classification_api.get_ideas_service"
        ) as mock_get_service:
            from src.orchestrator.api.models.idea import (
                Idea,
                IdeaStatus,
                IdeaClassification,
            )

            now = datetime.now(timezone.utc)
            mock_service = AsyncMock()
            mock_service.get_idea.return_value = Idea(
                id="idea-123",
                content="Test idea",
                author_id="user-1",
                author_name="Test",
                status=IdeaStatus.ACTIVE,
                classification=IdeaClassification.FUNCTIONAL,
                labels=["existing"],
                created_at=now,
                updated_at=now,
            )
            mock_service.update_idea.return_value = Idea(
                id="idea-123",
                content="Test idea",
                author_id="user-1",
                author_name="Test",
                status=IdeaStatus.ACTIVE,
                classification=IdeaClassification.FUNCTIONAL,
                labels=["existing", "new-label"],
                created_at=now,
                updated_at=now,
            )
            mock_get_service.return_value = mock_service

            response = client.post(
                "/api/ideas/idea-123/labels",
                json={"labels": ["new-label"]},
            )

            assert response.status_code == 200
            data = response.json()
            assert "new-label" in data["labels"]


class TestRemoveLabelEndpoint:
    """Tests for DELETE /api/ideas/{idea_id}/labels/{label} endpoint."""

    @pytest.fixture
    def client(self) -> TestClient:
        """Create a test client."""
        from src.orchestrator.routes.classification_api import router
        from fastapi import FastAPI

        app = FastAPI()
        app.include_router(router)

        return TestClient(app)

    def test_remove_label_success(self, client: TestClient) -> None:
        """Test successfully removing a label from an idea."""
        with patch(
            "src.orchestrator.routes.classification_api.get_ideas_service"
        ) as mock_get_service:
            from src.orchestrator.api.models.idea import (
                Idea,
                IdeaStatus,
                IdeaClassification,
            )

            now = datetime.now(timezone.utc)
            mock_service = AsyncMock()
            mock_service.get_idea.return_value = Idea(
                id="idea-123",
                content="Test idea",
                author_id="user-1",
                author_name="Test",
                status=IdeaStatus.ACTIVE,
                classification=IdeaClassification.FUNCTIONAL,
                labels=["label-1", "label-2"],
                created_at=now,
                updated_at=now,
            )
            mock_service.update_idea.return_value = Idea(
                id="idea-123",
                content="Test idea",
                author_id="user-1",
                author_name="Test",
                status=IdeaStatus.ACTIVE,
                classification=IdeaClassification.FUNCTIONAL,
                labels=["label-2"],
                created_at=now,
                updated_at=now,
            )
            mock_get_service.return_value = mock_service

            response = client.delete("/api/ideas/idea-123/labels/label-1")

            assert response.status_code == 200
            data = response.json()
            assert "label-1" not in data["labels"]


class TestGetTaxonomyEndpoint:
    """Tests for GET /api/admin/labels/taxonomy endpoint."""

    @pytest.fixture
    def client(self) -> TestClient:
        """Create a test client."""
        from src.orchestrator.routes.classification_api import router, admin_router
        from fastapi import FastAPI

        app = FastAPI()
        app.include_router(router)
        app.include_router(admin_router)

        return TestClient(app)

    def test_get_taxonomy_success(self, client: TestClient) -> None:
        """Test successfully getting the taxonomy."""
        with patch(
            "src.orchestrator.routes.classification_api.get_label_taxonomy_service"
        ) as mock_get_service:
            from src.orchestrator.api.models.classification import (
                LabelDefinition,
                LabelTaxonomy,
            )

            now = datetime.now(timezone.utc)
            mock_service = AsyncMock()
            mock_service.get_taxonomy.return_value = LabelTaxonomy(
                id="default",
                name="Default Taxonomy",
                description="Test taxonomy",
                labels=[
                    LabelDefinition(
                        id="feature",
                        name="Feature",
                        description="A new feature",
                        keywords=["new", "add"],
                        color="#22c55e",
                    ),
                ],
                version="1.0",
                created_at=now,
                updated_at=now,
            )
            mock_get_service.return_value = mock_service

            response = client.get("/api/admin/labels/taxonomy")

            assert response.status_code == 200
            data = response.json()
            assert data["id"] == "default"
            assert data["name"] == "Default Taxonomy"
            assert len(data["labels"]) == 1
            assert data["labels"][0]["id"] == "feature"


class TestUpdateTaxonomyEndpoint:
    """Tests for PUT /api/admin/labels/taxonomy endpoint."""

    @pytest.fixture
    def client(self) -> TestClient:
        """Create a test client."""
        from src.orchestrator.routes.classification_api import router, admin_router
        from fastapi import FastAPI

        app = FastAPI()
        app.include_router(router)
        app.include_router(admin_router)

        return TestClient(app)

    def test_update_taxonomy_success(self, client: TestClient) -> None:
        """Test successfully updating the taxonomy."""
        with patch(
            "src.orchestrator.routes.classification_api.get_label_taxonomy_service"
        ) as mock_get_service:
            from src.orchestrator.api.models.classification import (
                LabelDefinition,
                LabelTaxonomy,
            )

            now = datetime.now(timezone.utc)
            updated_taxonomy = LabelTaxonomy(
                id="default",
                name="Updated Taxonomy",
                description="Updated description",
                labels=[
                    LabelDefinition(
                        id="feature",
                        name="Feature",
                        description="A new feature",
                        keywords=["new", "add"],
                        color="#22c55e",
                    ),
                ],
                version="1.1",
                created_at=now,
                updated_at=now,
            )

            mock_service = AsyncMock()
            mock_service.update_taxonomy.return_value = updated_taxonomy
            mock_get_service.return_value = mock_service

            response = client.put(
                "/api/admin/labels/taxonomy",
                json={
                    "id": "default",
                    "name": "Updated Taxonomy",
                    "description": "Updated description",
                    "labels": [
                        {
                            "id": "feature",
                            "name": "Feature",
                            "description": "A new feature",
                            "keywords": ["new", "add"],
                            "color": "#22c55e",
                        },
                    ],
                    "version": "1.1",
                    "created_at": now.isoformat(),
                    "updated_at": now.isoformat(),
                },
            )

            assert response.status_code == 200
            data = response.json()
            assert data["name"] == "Updated Taxonomy"
            assert data["version"] == "1.1"


class TestAddLabelEndpoint:
    """Tests for POST /api/admin/labels/taxonomy/labels endpoint."""

    @pytest.fixture
    def client(self) -> TestClient:
        """Create a test client."""
        from src.orchestrator.routes.classification_api import router, admin_router
        from fastapi import FastAPI

        app = FastAPI()
        app.include_router(router)
        app.include_router(admin_router)

        return TestClient(app)

    def test_add_label_success(self, client: TestClient) -> None:
        """Test successfully adding a label."""
        with patch(
            "src.orchestrator.routes.classification_api.get_label_taxonomy_service"
        ) as mock_get_service:
            from src.orchestrator.api.models.classification import (
                LabelDefinition,
                LabelTaxonomy,
            )

            now = datetime.now(timezone.utc)
            mock_service = AsyncMock()
            mock_service.add_label.return_value = LabelTaxonomy(
                id="default",
                name="Default Taxonomy",
                description="Test taxonomy",
                labels=[
                    LabelDefinition(
                        id="feature",
                        name="Feature",
                        description="A new feature",
                        keywords=["new", "add"],
                        color="#22c55e",
                    ),
                    LabelDefinition(
                        id="new-label",
                        name="New Label",
                        description="A new label",
                        keywords=["test"],
                        color="#ffffff",
                    ),
                ],
                version="1.0",
                created_at=now,
                updated_at=now,
            )
            mock_get_service.return_value = mock_service

            response = client.post(
                "/api/admin/labels/taxonomy/labels",
                json={
                    "id": "new-label",
                    "name": "New Label",
                    "description": "A new label",
                    "keywords": ["test"],
                    "color": "#ffffff",
                },
            )

            assert response.status_code == 201
            data = response.json()
            assert len(data["labels"]) == 2
            assert any(l["id"] == "new-label" for l in data["labels"])

    def test_add_label_duplicate(self, client: TestClient) -> None:
        """Test adding a label that already exists."""
        with patch(
            "src.orchestrator.routes.classification_api.get_label_taxonomy_service"
        ) as mock_get_service:
            mock_service = AsyncMock()
            mock_service.add_label.side_effect = ValueError(
                "Label with ID 'feature' already exists"
            )
            mock_get_service.return_value = mock_service

            response = client.post(
                "/api/admin/labels/taxonomy/labels",
                json={
                    "id": "feature",
                    "name": "Feature",
                },
            )

            assert response.status_code == 409
            assert "already exists" in response.json()["detail"]


class TestUpdateLabelEndpoint:
    """Tests for PUT /api/admin/labels/taxonomy/labels/{id} endpoint."""

    @pytest.fixture
    def client(self) -> TestClient:
        """Create a test client."""
        from src.orchestrator.routes.classification_api import router, admin_router
        from fastapi import FastAPI

        app = FastAPI()
        app.include_router(router)
        app.include_router(admin_router)

        return TestClient(app)

    def test_update_label_success(self, client: TestClient) -> None:
        """Test successfully updating a label."""
        with patch(
            "src.orchestrator.routes.classification_api.get_label_taxonomy_service"
        ) as mock_get_service:
            from src.orchestrator.api.models.classification import (
                LabelDefinition,
                LabelTaxonomy,
            )

            now = datetime.now(timezone.utc)
            mock_service = AsyncMock()
            mock_service.update_label.return_value = LabelTaxonomy(
                id="default",
                name="Default Taxonomy",
                description="Test taxonomy",
                labels=[
                    LabelDefinition(
                        id="feature",
                        name="Updated Feature",
                        description="Updated description",
                        keywords=["new", "add", "updated"],
                        color="#00ff00",
                    ),
                ],
                version="1.0",
                created_at=now,
                updated_at=now,
            )
            mock_get_service.return_value = mock_service

            response = client.put(
                "/api/admin/labels/taxonomy/labels/feature",
                json={
                    "id": "feature",
                    "name": "Updated Feature",
                    "description": "Updated description",
                    "keywords": ["new", "add", "updated"],
                    "color": "#00ff00",
                },
            )

            assert response.status_code == 200
            data = response.json()
            assert data["labels"][0]["name"] == "Updated Feature"

    def test_update_label_not_found(self, client: TestClient) -> None:
        """Test updating a label that does not exist."""
        with patch(
            "src.orchestrator.routes.classification_api.get_label_taxonomy_service"
        ) as mock_get_service:
            mock_service = AsyncMock()
            mock_service.update_label.side_effect = KeyError(
                "Label with ID 'nonexistent' not found"
            )
            mock_get_service.return_value = mock_service

            response = client.put(
                "/api/admin/labels/taxonomy/labels/nonexistent",
                json={
                    "id": "nonexistent",
                    "name": "Nonexistent",
                },
            )

            assert response.status_code == 404
            assert "not found" in response.json()["detail"]


class TestDeleteLabelEndpoint:
    """Tests for DELETE /api/admin/labels/taxonomy/labels/{id} endpoint."""

    @pytest.fixture
    def client(self) -> TestClient:
        """Create a test client."""
        from src.orchestrator.routes.classification_api import router, admin_router
        from fastapi import FastAPI

        app = FastAPI()
        app.include_router(router)
        app.include_router(admin_router)

        return TestClient(app)

    def test_delete_label_success(self, client: TestClient) -> None:
        """Test successfully deleting a label."""
        with patch(
            "src.orchestrator.routes.classification_api.get_label_taxonomy_service"
        ) as mock_get_service:
            from src.orchestrator.api.models.classification import (
                LabelDefinition,
                LabelTaxonomy,
            )

            now = datetime.now(timezone.utc)
            mock_service = AsyncMock()
            mock_service.delete_label.return_value = LabelTaxonomy(
                id="default",
                name="Default Taxonomy",
                description="Test taxonomy",
                labels=[
                    LabelDefinition(
                        id="bug",
                        name="Bug",
                        description="A bug",
                        keywords=["bug", "fix"],
                        color="#ef4444",
                    ),
                ],
                version="1.0",
                created_at=now,
                updated_at=now,
            )
            mock_get_service.return_value = mock_service

            response = client.delete("/api/admin/labels/taxonomy/labels/feature")

            assert response.status_code == 200
            data = response.json()
            assert not any(l["id"] == "feature" for l in data["labels"])

    def test_delete_label_not_found(self, client: TestClient) -> None:
        """Test deleting a label that does not exist."""
        with patch(
            "src.orchestrator.routes.classification_api.get_label_taxonomy_service"
        ) as mock_get_service:
            mock_service = AsyncMock()
            mock_service.delete_label.side_effect = KeyError(
                "Label with ID 'nonexistent' not found"
            )
            mock_get_service.return_value = mock_service

            response = client.delete("/api/admin/labels/taxonomy/labels/nonexistent")

            assert response.status_code == 404
            assert "not found" in response.json()["detail"]
