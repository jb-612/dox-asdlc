"""Integration tests for Classification Service and API.

Tests the full classification flow including LLM integration,
batch processing, taxonomy management, and error handling.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.orchestrator.api.models.classification import (
    BatchClassificationRequest,
    ClassificationResult,
    ClassificationType,
    LabelDefinition,
    LabelTaxonomy,
)
from src.orchestrator.api.models.idea import (
    CreateIdeaRequest,
    Idea,
    IdeaClassification,
    IdeaStatus,
    UpdateIdeaRequest,
)
from src.orchestrator.routes.classification_api import admin_router, router
from src.orchestrator.services.classification_service import ClassificationService


@pytest.fixture
def mock_taxonomy() -> LabelTaxonomy:
    """Create a mock taxonomy for testing."""
    now = datetime.now(timezone.utc)
    return LabelTaxonomy(
        id="default",
        name="Default Taxonomy",
        description="Default label taxonomy for classification",
        labels=[
            LabelDefinition(
                id="feature",
                name="Feature",
                description="A new feature request",
                keywords=["add", "new", "implement", "create", "feature"],
                color="#22c55e",
            ),
            LabelDefinition(
                id="bug",
                name="Bug",
                description="A defect or issue",
                keywords=["fix", "bug", "error", "crash", "broken"],
                color="#ef4444",
            ),
            LabelDefinition(
                id="performance",
                name="Performance",
                description="Performance improvement",
                keywords=["fast", "slow", "speed", "performance", "optimize"],
                color="#f59e0b",
            ),
            LabelDefinition(
                id="security",
                name="Security",
                description="Security-related concern",
                keywords=["security", "encrypt", "auth", "vulnerability"],
                color="#8b5cf6",
            ),
            LabelDefinition(
                id="ui",
                name="UI/UX",
                description="User interface or experience",
                keywords=["ui", "ux", "interface", "design", "button", "screen"],
                color="#06b6d4",
            ),
        ],
        version="1.0.0",
        created_at=now,
        updated_at=now,
    )


@pytest.fixture
def mock_idea() -> Idea:
    """Create a mock idea for testing."""
    now = datetime.now(timezone.utc)
    return Idea(
        id="idea-test-123",
        content="Add a dark mode feature to the dashboard for better user experience at night",
        author_id="user-001",
        author_name="Test User",
        status=IdeaStatus.ACTIVE,
        classification=IdeaClassification.UNDETERMINED,
        labels=[],
        created_at=now,
        updated_at=now,
        word_count=14,
    )


@pytest.fixture
def mock_redis() -> AsyncMock:
    """Create a mock Redis client."""
    redis = AsyncMock()
    redis.get.return_value = None
    redis.set.return_value = True
    return redis


@pytest.fixture
def mock_ideas_service() -> AsyncMock:
    """Create a mock ideas service."""
    service = AsyncMock()
    return service


@pytest.fixture
def mock_taxonomy_service(mock_taxonomy: LabelTaxonomy) -> AsyncMock:
    """Create a mock taxonomy service."""
    service = AsyncMock()
    service.get_taxonomy.return_value = mock_taxonomy
    service.to_prompt_format.return_value = """Available Labels:
- feature: A new feature request (keywords: add, new, implement, create, feature)
- bug: A defect or issue (keywords: fix, bug, error, crash, broken)
- performance: Performance improvement (keywords: fast, slow, speed, performance, optimize)
- security: Security-related concern (keywords: security, encrypt, auth, vulnerability)
- ui: User interface or experience (keywords: ui, ux, interface, design, button, screen)
"""
    return service


@pytest.fixture
def mock_llm_factory() -> AsyncMock:
    """Create a mock LLM factory."""
    factory = AsyncMock()
    return factory


class TestFullClassificationFlow:
    """Test complete classification flow from request to result."""

    @pytest.mark.asyncio
    async def test_classify_idea_with_llm_success(
        self,
        mock_redis: AsyncMock,
        mock_ideas_service: AsyncMock,
        mock_taxonomy_service: AsyncMock,
        mock_llm_factory: AsyncMock,
        mock_idea: Idea,
        mock_taxonomy: LabelTaxonomy,
    ) -> None:
        """Test successful classification using LLM."""
        # Setup mocks
        mock_ideas_service.get_idea.return_value = mock_idea
        mock_ideas_service.update_idea.return_value = mock_idea

        # Mock LLM client and response
        mock_llm_client = AsyncMock()
        mock_llm_client.model = "claude-sonnet-4"
        mock_llm_response = MagicMock()
        mock_llm_response.content = json.dumps({
            "classification": "functional",
            "confidence": 0.92,
            "reasoning": "This describes a user-facing feature (dark mode) that enhances the dashboard UX.",
            "labels": ["feature", "ui"],
            "label_scores": {"feature": 0.92, "ui": 0.85},
        })
        mock_llm_client.generate.return_value = mock_llm_response
        mock_llm_factory.get_client.return_value = mock_llm_client

        service = ClassificationService(
            redis_client=mock_redis,
            taxonomy_service=mock_taxonomy_service,
            ideas_service=mock_ideas_service,
            llm_factory=mock_llm_factory,
        )

        result = await service.classify_idea("idea-test-123")

        # Verify classification result
        assert result.idea_id == "idea-test-123"
        assert result.classification == ClassificationType.FUNCTIONAL
        assert result.confidence == 0.92
        assert "feature" in result.labels
        assert "ui" in result.labels
        assert "dark mode" in result.reasoning.lower() or "feature" in result.reasoning.lower()

        # Verify LLM was called with correct parameters
        mock_llm_factory.get_client.assert_called_once()
        mock_llm_client.generate.assert_called_once()
        call_kwargs = mock_llm_client.generate.call_args[1]
        assert call_kwargs["temperature"] == 0.3  # Low temperature for consistency

        # Verify result was stored
        mock_redis.set.assert_called()

        # Verify idea was updated
        mock_ideas_service.update_idea.assert_called_once()

    @pytest.mark.asyncio
    async def test_classify_idea_with_llm_non_functional(
        self,
        mock_redis: AsyncMock,
        mock_ideas_service: AsyncMock,
        mock_taxonomy_service: AsyncMock,
        mock_llm_factory: AsyncMock,
        mock_taxonomy: LabelTaxonomy,
    ) -> None:
        """Test classification of non-functional requirement."""
        now = datetime.now(timezone.utc)
        nf_idea = Idea(
            id="idea-nf-456",
            content="Improve API response time to under 100ms for all endpoints",
            author_id="user-001",
            author_name="Test User",
            status=IdeaStatus.ACTIVE,
            classification=IdeaClassification.UNDETERMINED,
            labels=[],
            created_at=now,
            updated_at=now,
            word_count=10,
        )

        mock_ideas_service.get_idea.return_value = nf_idea
        mock_ideas_service.update_idea.return_value = nf_idea

        mock_llm_client = AsyncMock()
        mock_llm_client.model = "claude-sonnet-4"
        mock_llm_response = MagicMock()
        mock_llm_response.content = json.dumps({
            "classification": "non_functional",
            "confidence": 0.88,
            "reasoning": "This is a performance requirement about response time, not a user-facing feature.",
            "labels": ["performance"],
            "label_scores": {"performance": 0.88},
        })
        mock_llm_client.generate.return_value = mock_llm_response
        mock_llm_factory.get_client.return_value = mock_llm_client

        service = ClassificationService(
            redis_client=mock_redis,
            taxonomy_service=mock_taxonomy_service,
            ideas_service=mock_ideas_service,
            llm_factory=mock_llm_factory,
        )

        result = await service.classify_idea("idea-nf-456")

        assert result.classification == ClassificationType.NON_FUNCTIONAL
        assert "performance" in result.labels

    @pytest.mark.asyncio
    async def test_classify_idea_fallback_to_rule_based(
        self,
        mock_redis: AsyncMock,
        mock_ideas_service: AsyncMock,
        mock_taxonomy_service: AsyncMock,
        mock_llm_factory: AsyncMock,
        mock_taxonomy: LabelTaxonomy,
    ) -> None:
        """Test fallback to rule-based classification when LLM fails."""
        now = datetime.now(timezone.utc)
        idea = Idea(
            id="idea-fallback",
            content="Fix the login bug that crashes the app on startup",
            author_id="user-001",
            author_name="Test User",
            status=IdeaStatus.ACTIVE,
            classification=IdeaClassification.UNDETERMINED,
            labels=[],
            created_at=now,
            updated_at=now,
            word_count=10,
        )

        mock_ideas_service.get_idea.return_value = idea
        mock_ideas_service.update_idea.return_value = idea

        # Make LLM fail
        mock_llm_factory.get_client.side_effect = Exception("LLM service unavailable")

        service = ClassificationService(
            redis_client=mock_redis,
            taxonomy_service=mock_taxonomy_service,
            ideas_service=mock_ideas_service,
            llm_factory=mock_llm_factory,
        )

        result = await service.classify_idea("idea-fallback")

        # Should still produce a result via rule-based fallback
        assert result.idea_id == "idea-fallback"
        assert "rule-based" in result.model_version

        # Bug keyword should be detected
        assert "bug" in result.labels

    @pytest.mark.asyncio
    async def test_classify_idea_not_found_raises_error(
        self,
        mock_redis: AsyncMock,
        mock_ideas_service: AsyncMock,
        mock_taxonomy_service: AsyncMock,
        mock_llm_factory: AsyncMock,
    ) -> None:
        """Test that classifying non-existent idea raises ValueError."""
        mock_ideas_service.get_idea.return_value = None

        service = ClassificationService(
            redis_client=mock_redis,
            taxonomy_service=mock_taxonomy_service,
            ideas_service=mock_ideas_service,
            llm_factory=mock_llm_factory,
        )

        with pytest.raises(ValueError, match="Idea not found"):
            await service.classify_idea("nonexistent-idea")


class TestBatchClassificationProcessing:
    """Test batch classification processing."""

    @pytest.mark.asyncio
    async def test_batch_classification_enqueues_all_ideas(
        self,
        mock_redis: AsyncMock,
    ) -> None:
        """Test that batch classification enqueues all ideas."""
        from src.workers.classification_worker import ClassificationWorker

        mock_service = AsyncMock()

        worker = ClassificationWorker(
            redis_client=mock_redis,
            classification_service=mock_service,
        )

        idea_ids = ["idea-1", "idea-2", "idea-3", "idea-4", "idea-5"]
        job_id = await worker.enqueue_batch(idea_ids)

        assert job_id is not None
        assert job_id.startswith("job-")

        # Verify job metadata was stored
        mock_redis.set.assert_called()
        set_call = mock_redis.set.call_args
        job_data = json.loads(set_call[0][1])

        assert job_data["total"] == 5
        assert job_data["completed"] == 0
        assert job_data["status"] == "pending"
        assert len(job_data["idea_ids"]) == 5

        # Verify all ideas were added to queue
        assert mock_redis.lpush.call_count == 5

    @pytest.mark.asyncio
    async def test_batch_job_status_tracking(
        self,
        mock_redis: AsyncMock,
    ) -> None:
        """Test batch job status retrieval."""
        from src.workers.classification_worker import ClassificationWorker

        mock_service = AsyncMock()

        worker = ClassificationWorker(
            redis_client=mock_redis,
            classification_service=mock_service,
        )

        # Setup mock job status
        job_status = {
            "job_id": "job-test-123",
            "status": "processing",
            "total": 5,
            "completed": 2,
            "failed": 0,
            "idea_ids": ["idea-1", "idea-2", "idea-3", "idea-4", "idea-5"],
            "results": [
                {"idea_id": "idea-1", "classification": "functional", "confidence": 0.9},
                {"idea_id": "idea-2", "classification": "non_functional", "confidence": 0.85},
            ],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        mock_redis.get.return_value = json.dumps(job_status)

        status = await worker.get_job_status("job-test-123")

        assert status is not None
        assert status["job_id"] == "job-test-123"
        assert status["status"] == "processing"
        assert status["total"] == 5
        assert status["completed"] == 2
        assert len(status["results"]) == 2

    @pytest.mark.asyncio
    async def test_batch_job_with_force_reclassification(
        self,
        mock_redis: AsyncMock,
    ) -> None:
        """Test batch classification with force flag."""
        from src.workers.classification_worker import ClassificationWorker

        mock_service = AsyncMock()

        worker = ClassificationWorker(
            redis_client=mock_redis,
            classification_service=mock_service,
        )

        idea_ids = ["idea-1", "idea-2"]
        job_id = await worker.enqueue_batch(idea_ids, force=True)

        # Verify force flag is set on queued items
        lpush_calls = mock_redis.lpush.call_args_list
        for call in lpush_calls:
            job_data = json.loads(call[0][1])
            assert job_data["force"] is True


class TestTaxonomyUpdates:
    """Test taxonomy management and updates."""

    @pytest.fixture
    def app(self) -> FastAPI:
        """Create a test FastAPI application."""
        test_app = FastAPI()
        test_app.include_router(router)
        test_app.include_router(admin_router)
        return test_app

    @pytest.fixture
    def client(self, app: FastAPI) -> TestClient:
        """Create a test client."""
        return TestClient(app)

    def test_get_taxonomy(self, client: TestClient, mock_taxonomy: LabelTaxonomy) -> None:
        """Test GET /api/admin/labels/taxonomy."""
        with patch(
            "src.orchestrator.routes.classification_api.get_label_taxonomy_service"
        ) as mock_get_service:
            mock_service = AsyncMock()
            mock_service.get_taxonomy.return_value = mock_taxonomy
            mock_get_service.return_value = mock_service

            response = client.get("/api/admin/labels/taxonomy")

            assert response.status_code == 200
            data = response.json()
            assert data["id"] == "default"
            assert len(data["labels"]) == 5

    def test_add_label_to_taxonomy(
        self, client: TestClient, mock_taxonomy: LabelTaxonomy
    ) -> None:
        """Test POST /api/admin/labels/taxonomy/labels."""
        new_label = LabelDefinition(
            id="documentation",
            name="Documentation",
            description="Documentation updates",
            keywords=["docs", "documentation", "readme", "guide"],
            color="#64748b",
        )

        # Add new label to taxonomy copy for return value
        updated_taxonomy = mock_taxonomy.model_copy()
        updated_taxonomy.labels.append(new_label)

        with patch(
            "src.orchestrator.routes.classification_api.get_label_taxonomy_service"
        ) as mock_get_service:
            mock_service = AsyncMock()
            mock_service.add_label.return_value = updated_taxonomy
            mock_get_service.return_value = mock_service

            response = client.post(
                "/api/admin/labels/taxonomy/labels",
                json={
                    "id": "documentation",
                    "name": "Documentation",
                    "description": "Documentation updates",
                    "keywords": ["docs", "documentation", "readme", "guide"],
                    "color": "#64748b",
                },
            )

            assert response.status_code == 201
            data = response.json()
            assert len(data["labels"]) == 6

    def test_add_duplicate_label_returns_409(
        self, client: TestClient, mock_taxonomy: LabelTaxonomy
    ) -> None:
        """Test that adding duplicate label returns 409 Conflict."""
        with patch(
            "src.orchestrator.routes.classification_api.get_label_taxonomy_service"
        ) as mock_get_service:
            mock_service = AsyncMock()
            mock_service.add_label.side_effect = ValueError("Label 'feature' already exists")
            mock_get_service.return_value = mock_service

            response = client.post(
                "/api/admin/labels/taxonomy/labels",
                json={
                    "id": "feature",  # Already exists
                    "name": "Feature",
                },
            )

            assert response.status_code == 409

    def test_update_label_in_taxonomy(
        self, client: TestClient, mock_taxonomy: LabelTaxonomy
    ) -> None:
        """Test PUT /api/admin/labels/taxonomy/labels/{label_id}."""
        # Update feature label with new keywords
        updated_label = LabelDefinition(
            id="feature",
            name="Feature Request",
            description="A new feature request from users",
            keywords=["add", "new", "implement", "create", "feature", "request"],
            color="#22c55e",
        )

        # Create updated taxonomy
        updated_taxonomy = mock_taxonomy.model_copy()
        for i, label in enumerate(updated_taxonomy.labels):
            if label.id == "feature":
                updated_taxonomy.labels[i] = updated_label
                break

        with patch(
            "src.orchestrator.routes.classification_api.get_label_taxonomy_service"
        ) as mock_get_service:
            mock_service = AsyncMock()
            mock_service.update_label.return_value = updated_taxonomy
            mock_get_service.return_value = mock_service

            response = client.put(
                "/api/admin/labels/taxonomy/labels/feature",
                json={
                    "id": "feature",
                    "name": "Feature Request",
                    "description": "A new feature request from users",
                    "keywords": ["add", "new", "implement", "create", "feature", "request"],
                    "color": "#22c55e",
                },
            )

            assert response.status_code == 200

    def test_delete_label_from_taxonomy(
        self, client: TestClient, mock_taxonomy: LabelTaxonomy
    ) -> None:
        """Test DELETE /api/admin/labels/taxonomy/labels/{label_id}."""
        # Remove bug label
        updated_taxonomy = mock_taxonomy.model_copy()
        updated_taxonomy.labels = [l for l in updated_taxonomy.labels if l.id != "bug"]

        with patch(
            "src.orchestrator.routes.classification_api.get_label_taxonomy_service"
        ) as mock_get_service:
            mock_service = AsyncMock()
            mock_service.delete_label.return_value = updated_taxonomy
            mock_get_service.return_value = mock_service

            response = client.delete("/api/admin/labels/taxonomy/labels/bug")

            assert response.status_code == 200
            data = response.json()
            label_ids = [l["id"] for l in data["labels"]]
            assert "bug" not in label_ids

    def test_delete_nonexistent_label_returns_404(
        self, client: TestClient
    ) -> None:
        """Test that deleting non-existent label returns 404."""
        with patch(
            "src.orchestrator.routes.classification_api.get_label_taxonomy_service"
        ) as mock_get_service:
            mock_service = AsyncMock()
            mock_service.delete_label.side_effect = KeyError("Label 'nonexistent' not found")
            mock_get_service.return_value = mock_service

            response = client.delete("/api/admin/labels/taxonomy/labels/nonexistent")

            assert response.status_code == 404


class TestLLMMockResponses:
    """Test handling of various LLM response formats."""

    @pytest.fixture
    def service(
        self,
        mock_redis: AsyncMock,
        mock_taxonomy_service: AsyncMock,
        mock_ideas_service: AsyncMock,
        mock_llm_factory: AsyncMock,
    ) -> ClassificationService:
        """Create a classification service with mocked dependencies."""
        return ClassificationService(
            redis_client=mock_redis,
            taxonomy_service=mock_taxonomy_service,
            ideas_service=mock_ideas_service,
            llm_factory=mock_llm_factory,
        )

    def test_parse_json_response(self, service: ClassificationService) -> None:
        """Test parsing plain JSON response."""
        response = json.dumps({
            "classification": "functional",
            "confidence": 0.85,
            "reasoning": "User-facing feature",
            "labels": ["feature"],
        })

        result = service.parse_classification_response(response)

        assert result["classification"] == "functional"
        assert result["confidence"] == 0.85
        assert result["labels"] == ["feature"]

    def test_parse_markdown_wrapped_json(self, service: ClassificationService) -> None:
        """Test parsing JSON wrapped in markdown code block."""
        response = """```json
{
    "classification": "non_functional",
    "confidence": 0.92,
    "reasoning": "Performance requirement",
    "labels": ["performance"]
}
```"""

        result = service.parse_classification_response(response)

        assert result["classification"] == "non_functional"
        assert result["confidence"] == 0.92

    def test_parse_markdown_without_json_label(self, service: ClassificationService) -> None:
        """Test parsing JSON in code block without 'json' label."""
        response = """```
{
    "classification": "functional",
    "confidence": 0.75,
    "reasoning": "Feature",
    "labels": []
}
```"""

        result = service.parse_classification_response(response)

        assert result["classification"] == "functional"
        assert result["confidence"] == 0.75

    def test_parse_invalid_json_returns_undetermined(
        self, service: ClassificationService
    ) -> None:
        """Test that invalid JSON returns undetermined with zero confidence."""
        response = "This is not valid JSON at all"

        result = service.parse_classification_response(response)

        assert result["classification"] == "undetermined"
        assert result["confidence"] == 0.0
        assert result["labels"] == []

    def test_parse_missing_fields_uses_defaults(
        self, service: ClassificationService
    ) -> None:
        """Test that missing fields get default values."""
        response = json.dumps({"classification": "functional"})

        result = service.parse_classification_response(response)

        assert result["classification"] == "functional"
        assert result["confidence"] == 0.5  # Default
        assert result["labels"] == []
        assert result["reasoning"] == ""

    def test_parse_normalizes_classification_values(
        self, service: ClassificationService
    ) -> None:
        """Test that classification values are normalized."""
        # Test with uppercase
        response = json.dumps({
            "classification": "FUNCTIONAL",
            "confidence": 0.8,
        })
        result = service.parse_classification_response(response)
        assert result["classification"] == "functional"

        # Test with invalid value
        response = json.dumps({
            "classification": "invalid_type",
            "confidence": 0.8,
        })
        result = service.parse_classification_response(response)
        assert result["classification"] == "undetermined"


class TestClassificationErrorHandling:
    """Test error handling in classification service."""

    @pytest.mark.asyncio
    async def test_redis_connection_error_during_store(
        self,
        mock_taxonomy_service: AsyncMock,
        mock_ideas_service: AsyncMock,
        mock_llm_factory: AsyncMock,
        mock_idea: Idea,
    ) -> None:
        """Test handling Redis errors during result storage."""
        mock_redis = AsyncMock()
        mock_redis.get.return_value = None
        mock_redis.set.side_effect = ConnectionError("Redis unavailable")

        mock_ideas_service.get_idea.return_value = mock_idea
        mock_ideas_service.update_idea.return_value = mock_idea

        mock_llm_client = AsyncMock()
        mock_llm_client.model = "claude-sonnet-4"
        mock_llm_response = MagicMock()
        mock_llm_response.content = json.dumps({
            "classification": "functional",
            "confidence": 0.9,
            "labels": ["feature"],
        })
        mock_llm_client.generate.return_value = mock_llm_response
        mock_llm_factory.get_client.return_value = mock_llm_client

        service = ClassificationService(
            redis_client=mock_redis,
            taxonomy_service=mock_taxonomy_service,
            ideas_service=mock_ideas_service,
            llm_factory=mock_llm_factory,
        )

        # Should raise the connection error
        with pytest.raises(ConnectionError):
            await service.classify_idea("idea-test-123")

    @pytest.mark.asyncio
    async def test_ideas_service_error_during_update(
        self,
        mock_redis: AsyncMock,
        mock_taxonomy_service: AsyncMock,
        mock_llm_factory: AsyncMock,
        mock_idea: Idea,
    ) -> None:
        """Test handling errors when updating idea."""
        mock_ideas_service = AsyncMock()
        mock_ideas_service.get_idea.return_value = mock_idea
        mock_ideas_service.update_idea.side_effect = Exception("Database error")

        mock_llm_client = AsyncMock()
        mock_llm_client.model = "claude-sonnet-4"
        mock_llm_response = MagicMock()
        mock_llm_response.content = json.dumps({
            "classification": "functional",
            "confidence": 0.9,
            "labels": ["feature"],
        })
        mock_llm_client.generate.return_value = mock_llm_response
        mock_llm_factory.get_client.return_value = mock_llm_client

        service = ClassificationService(
            redis_client=mock_redis,
            taxonomy_service=mock_taxonomy_service,
            ideas_service=mock_ideas_service,
            llm_factory=mock_llm_factory,
        )

        # Should raise the database error
        with pytest.raises(Exception, match="Database error"):
            await service.classify_idea("idea-test-123")


class TestClassificationAPIEndpoints:
    """Test Classification API endpoints."""

    @pytest.fixture
    def app(self) -> FastAPI:
        """Create a test FastAPI application."""
        test_app = FastAPI()
        test_app.include_router(router)
        test_app.include_router(admin_router)
        return test_app

    @pytest.fixture
    def client(self, app: FastAPI) -> TestClient:
        """Create a test client."""
        return TestClient(app)

    def test_classify_single_idea_endpoint(
        self,
        client: TestClient,
    ) -> None:
        """Test POST /api/ideas/{idea_id}/classify."""
        with patch(
            "src.orchestrator.routes.classification_api.get_classification_service"
        ) as mock_get_service:
            mock_service = AsyncMock()
            mock_service.classify_idea.return_value = ClassificationResult(
                idea_id="idea-123",
                classification=ClassificationType.FUNCTIONAL,
                confidence=0.9,
                labels=["feature", "ui"],
                reasoning="This is a feature request",
                model_version="claude-sonnet-4:v1.0",
            )
            mock_get_service.return_value = mock_service

            response = client.post("/api/ideas/idea-123/classify")

            assert response.status_code == 200
            data = response.json()
            assert data["idea_id"] == "idea-123"
            assert data["classification"] == "functional"
            assert data["confidence"] == 0.9
            assert "feature" in data["labels"]

    def test_classify_nonexistent_idea_returns_404(
        self,
        client: TestClient,
    ) -> None:
        """Test that classifying non-existent idea returns 404."""
        with patch(
            "src.orchestrator.routes.classification_api.get_classification_service"
        ) as mock_get_service:
            mock_service = AsyncMock()
            mock_service.classify_idea.side_effect = ValueError("Idea not found: nonexistent")
            mock_get_service.return_value = mock_service

            response = client.post("/api/ideas/nonexistent/classify")

            assert response.status_code == 404

    def test_batch_classify_endpoint(
        self,
        client: TestClient,
    ) -> None:
        """Test POST /api/ideas/classify/batch."""
        with patch(
            "src.orchestrator.routes.classification_api.get_classification_worker"
        ) as mock_get_worker:
            mock_worker = AsyncMock()
            mock_worker.enqueue_batch.return_value = "job-batch-123"
            mock_get_worker.return_value = mock_worker

            response = client.post(
                "/api/ideas/classify/batch",
                json={"idea_ids": ["idea-1", "idea-2", "idea-3"]},
            )

            assert response.status_code == 202
            data = response.json()
            assert data["job_id"] == "job-batch-123"
            assert data["status"] == "queued"
            assert data["total"] == 3

    def test_batch_classify_empty_list_returns_400(
        self,
        client: TestClient,
    ) -> None:
        """Test that batch classify with empty list returns 400."""
        response = client.post(
            "/api/ideas/classify/batch",
            json={"idea_ids": []},
        )

        assert response.status_code == 400

    def test_get_job_status_endpoint(
        self,
        client: TestClient,
    ) -> None:
        """Test GET /api/ideas/classify/job/{job_id}."""
        with patch(
            "src.orchestrator.routes.classification_api.get_classification_worker"
        ) as mock_get_worker:
            mock_worker = AsyncMock()
            mock_worker.get_job_status.return_value = {
                "job_id": "job-123",
                "status": "completed",
                "total": 5,
                "completed": 5,
                "failed": 0,
                "results": [
                    {"idea_id": "idea-1", "classification": "functional"},
                    {"idea_id": "idea-2", "classification": "non_functional"},
                ],
            }
            mock_get_worker.return_value = mock_worker

            response = client.get("/api/ideas/classify/job/job-123")

            assert response.status_code == 200
            data = response.json()
            assert data["job_id"] == "job-123"
            assert data["status"] == "completed"
            assert data["completed"] == 5

    def test_get_nonexistent_job_returns_404(
        self,
        client: TestClient,
    ) -> None:
        """Test that getting non-existent job returns 404."""
        with patch(
            "src.orchestrator.routes.classification_api.get_classification_worker"
        ) as mock_get_worker:
            mock_worker = AsyncMock()
            mock_worker.get_job_status.return_value = None
            mock_get_worker.return_value = mock_worker

            response = client.get("/api/ideas/classify/job/nonexistent")

            assert response.status_code == 404

    def test_add_labels_to_idea_endpoint(
        self,
        client: TestClient,
        mock_idea: Idea,
    ) -> None:
        """Test POST /api/ideas/{idea_id}/labels."""
        updated_idea = mock_idea.model_copy()
        updated_idea.labels = ["feature", "ui"]

        with patch(
            "src.orchestrator.routes.classification_api.get_ideas_service"
        ) as mock_get_service:
            mock_service = AsyncMock()
            mock_service.get_idea.return_value = mock_idea
            mock_service.update_idea.return_value = updated_idea
            mock_get_service.return_value = mock_service

            response = client.post(
                f"/api/ideas/{mock_idea.id}/labels",
                json={"labels": ["feature", "ui"]},
            )

            assert response.status_code == 200
            data = response.json()
            assert "feature" in data["labels"]
            assert "ui" in data["labels"]

    def test_remove_label_from_idea_endpoint(
        self,
        client: TestClient,
        mock_idea: Idea,
    ) -> None:
        """Test DELETE /api/ideas/{idea_id}/labels/{label}."""
        mock_idea.labels = ["feature", "ui"]
        updated_idea = mock_idea.model_copy()
        updated_idea.labels = ["feature"]

        with patch(
            "src.orchestrator.routes.classification_api.get_ideas_service"
        ) as mock_get_service:
            mock_service = AsyncMock()
            mock_service.get_idea.return_value = mock_idea
            mock_service.update_idea.return_value = updated_idea
            mock_get_service.return_value = mock_service

            response = client.delete(f"/api/ideas/{mock_idea.id}/labels/ui")

            assert response.status_code == 200
            data = response.json()
            assert "ui" not in data["labels"]
            assert "feature" in data["labels"]


class TestLabelValidation:
    """Test label validation against taxonomy."""

    def test_validate_labels_filters_invalid(
        self, mock_taxonomy: LabelTaxonomy
    ) -> None:
        """Test that invalid labels are filtered out."""
        service = ClassificationService(
            redis_client=AsyncMock(),
            taxonomy_service=AsyncMock(),
            ideas_service=AsyncMock(),
            llm_factory=AsyncMock(),
        )

        labels = ["feature", "invalid-label", "bug", "another-invalid"]
        valid = service.validate_labels(labels, mock_taxonomy)

        assert valid == ["feature", "bug"]

    def test_validate_labels_empty_list(
        self, mock_taxonomy: LabelTaxonomy
    ) -> None:
        """Test validation with empty label list."""
        service = ClassificationService(
            redis_client=AsyncMock(),
            taxonomy_service=AsyncMock(),
            ideas_service=AsyncMock(),
            llm_factory=AsyncMock(),
        )

        valid = service.validate_labels([], mock_taxonomy)
        assert valid == []

    def test_validate_labels_all_valid(
        self, mock_taxonomy: LabelTaxonomy
    ) -> None:
        """Test validation with all valid labels."""
        service = ClassificationService(
            redis_client=AsyncMock(),
            taxonomy_service=AsyncMock(),
            ideas_service=AsyncMock(),
            llm_factory=AsyncMock(),
        )

        labels = ["feature", "bug", "performance"]
        valid = service.validate_labels(labels, mock_taxonomy)

        assert valid == ["feature", "bug", "performance"]
