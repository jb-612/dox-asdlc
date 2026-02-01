"""Unit tests for Classification Service.

Tests the ClassificationService class for classifying ideas using LLM
and storing classification results.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.orchestrator.api.models.classification import (
    ClassificationResult,
    ClassificationType,
    LabelDefinition,
    LabelTaxonomy,
)
from src.orchestrator.api.models.idea import Idea, IdeaClassification, IdeaStatus
from src.orchestrator.services.classification_service import (
    ClassificationService,
    get_classification_service,
)


class TestClassificationServiceInit:
    """Tests for ClassificationService initialization."""

    def test_init_with_defaults(self) -> None:
        """Test service can be instantiated with defaults."""
        service = ClassificationService()
        assert service is not None

    def test_init_with_custom_dependencies(self) -> None:
        """Test service can be instantiated with custom dependencies."""
        mock_redis = AsyncMock()
        mock_taxonomy_service = AsyncMock()
        mock_ideas_service = AsyncMock()
        mock_llm_factory = AsyncMock()

        service = ClassificationService(
            redis_client=mock_redis,
            taxonomy_service=mock_taxonomy_service,
            ideas_service=mock_ideas_service,
            llm_factory=mock_llm_factory,
        )

        assert service._redis_client is mock_redis
        assert service._taxonomy_service is mock_taxonomy_service
        assert service._ideas_service is mock_ideas_service
        assert service._llm_factory is mock_llm_factory


class TestClassifyIdea:
    """Tests for classify_idea method."""

    @pytest.fixture
    def mock_taxonomy(self) -> LabelTaxonomy:
        """Create a mock taxonomy."""
        now = datetime.now(timezone.utc)
        return LabelTaxonomy(
            id="default",
            name="Default Taxonomy",
            labels=[
                LabelDefinition(
                    id="feature",
                    name="Feature",
                    description="A new feature",
                    keywords=["new", "add"],
                ),
                LabelDefinition(
                    id="bug",
                    name="Bug",
                    description="A defect",
                    keywords=["fix", "error"],
                ),
            ],
            version="1.0",
            created_at=now,
            updated_at=now,
        )

    @pytest.fixture
    def mock_idea(self) -> Idea:
        """Create a mock idea."""
        now = datetime.now(timezone.utc)
        return Idea(
            id="idea-123",
            content="Add a new login feature with OAuth support",
            author_id="user-1",
            author_name="Test User",
            status=IdeaStatus.ACTIVE,
            classification=IdeaClassification.UNDETERMINED,
            labels=[],
            created_at=now,
            updated_at=now,
            word_count=8,
        )

    @pytest.fixture
    def service(self) -> ClassificationService:
        """Create a service instance with mocked dependencies."""
        mock_redis = AsyncMock()
        mock_taxonomy_service = AsyncMock()
        mock_ideas_service = AsyncMock()
        mock_llm_factory = AsyncMock()

        return ClassificationService(
            redis_client=mock_redis,
            taxonomy_service=mock_taxonomy_service,
            ideas_service=mock_ideas_service,
            llm_factory=mock_llm_factory,
        )

    @pytest.mark.asyncio
    async def test_classify_idea_success(
        self,
        service: ClassificationService,
        mock_taxonomy: LabelTaxonomy,
        mock_idea: Idea,
    ) -> None:
        """Test successful idea classification."""
        # Setup mocks
        service._taxonomy_service.get_taxonomy.return_value = mock_taxonomy
        service._taxonomy_service.to_prompt_format.return_value = "Labels: feature, bug"
        service._ideas_service.get_idea.return_value = mock_idea

        # Mock LLM response
        mock_llm_client = AsyncMock()
        mock_llm_client.model = "claude-sonnet-4"
        mock_llm_response = MagicMock()
        mock_llm_response.content = json.dumps({
            "classification": "functional",
            "confidence": 0.92,
            "reasoning": "This describes a login feature.",
            "labels": ["feature"],
            "label_scores": {"feature": 0.92},
        })
        mock_llm_client.generate.return_value = mock_llm_response
        service._llm_factory.get_client.return_value = mock_llm_client

        # Call classify_idea
        result = await service.classify_idea("idea-123")

        # Verify result
        assert result.idea_id == "idea-123"
        assert result.classification == ClassificationType.FUNCTIONAL
        assert result.confidence == 0.92
        assert "feature" in result.labels
        assert result.reasoning == "This describes a login feature."

    @pytest.mark.asyncio
    async def test_classify_idea_not_found(self, service: ClassificationService) -> None:
        """Test classification when idea not found."""
        service._ideas_service.get_idea.return_value = None

        with pytest.raises(ValueError, match="Idea not found"):
            await service.classify_idea("nonexistent-idea")

    @pytest.mark.asyncio
    async def test_classify_idea_with_force_reclassify(
        self,
        service: ClassificationService,
        mock_taxonomy: LabelTaxonomy,
        mock_idea: Idea,
    ) -> None:
        """Test force reclassification of already classified idea."""
        # Set idea as already classified
        mock_idea.classification = IdeaClassification.FUNCTIONAL
        service._ideas_service.get_idea.return_value = mock_idea
        service._taxonomy_service.get_taxonomy.return_value = mock_taxonomy
        service._taxonomy_service.to_prompt_format.return_value = "Labels: feature, bug"

        # Mock LLM response
        mock_llm_client = AsyncMock()
        mock_llm_client.model = "claude-sonnet-4"
        mock_llm_response = MagicMock()
        mock_llm_response.content = json.dumps({
            "classification": "non_functional",
            "confidence": 0.85,
            "reasoning": "Updated classification.",
            "labels": ["bug"],
            "label_scores": {"bug": 0.85},
        })
        mock_llm_client.generate.return_value = mock_llm_response
        service._llm_factory.get_client.return_value = mock_llm_client

        # Call with force=True
        result = await service.classify_idea("idea-123", force=True)

        assert result.classification == ClassificationType.NON_FUNCTIONAL
        service._llm_factory.get_client.assert_called_once()

    @pytest.mark.asyncio
    async def test_classify_idea_skips_already_classified(
        self,
        service: ClassificationService,
        mock_idea: Idea,
    ) -> None:
        """Test that already classified ideas are skipped without force."""
        # Set idea as already classified
        mock_idea.classification = IdeaClassification.FUNCTIONAL
        service._ideas_service.get_idea.return_value = mock_idea

        # Mock get_classification_result
        existing_result = ClassificationResult(
            idea_id="idea-123",
            classification=ClassificationType.FUNCTIONAL,
            confidence=0.9,
            labels=["feature"],
            reasoning="Existing classification",
        )
        service._redis_client.get.return_value = json.dumps(existing_result.model_dump())

        result = await service.classify_idea("idea-123", force=False)

        assert result.idea_id == "idea-123"
        assert result.classification == ClassificationType.FUNCTIONAL
        # LLM should not be called
        service._llm_factory.get_client.assert_not_called()


class TestBuildClassificationPrompt:
    """Tests for build_classification_prompt method."""

    @pytest.fixture
    def service(self) -> ClassificationService:
        """Create a service instance."""
        return ClassificationService(
            redis_client=AsyncMock(),
            taxonomy_service=AsyncMock(),
            ideas_service=AsyncMock(),
            llm_factory=AsyncMock(),
        )

    def test_build_classification_prompt(self, service: ClassificationService) -> None:
        """Test building a classification prompt."""
        idea_content = "Add dark mode support for the dashboard"
        taxonomy_text = "Labels: feature, ui, improvement"

        prompt = service.build_classification_prompt(idea_content, taxonomy_text)

        assert "Add dark mode support" in prompt
        assert "feature" in prompt.lower() or "functional" in prompt.lower()
        assert "Labels:" in prompt or "TAXONOMY" in prompt

    def test_build_classification_prompt_includes_taxonomy(
        self, service: ClassificationService
    ) -> None:
        """Test that prompt includes taxonomy information."""
        idea_content = "Fix the performance issue with search"
        taxonomy_text = "feature: A new feature\nbug: A defect"

        prompt = service.build_classification_prompt(idea_content, taxonomy_text)

        assert "feature" in prompt.lower()
        assert "bug" in prompt.lower()


class TestParseClassificationResponse:
    """Tests for parse_classification_response method."""

    @pytest.fixture
    def service(self) -> ClassificationService:
        """Create a service instance."""
        return ClassificationService(
            redis_client=AsyncMock(),
            taxonomy_service=AsyncMock(),
            ideas_service=AsyncMock(),
            llm_factory=AsyncMock(),
        )

    def test_parse_valid_json_response(self, service: ClassificationService) -> None:
        """Test parsing a valid JSON response."""
        response = json.dumps({
            "classification": "functional",
            "confidence": 0.95,
            "reasoning": "This is a feature request.",
            "labels": ["feature", "api"],
            "label_scores": {"feature": 0.95, "api": 0.80},
        })

        result = service.parse_classification_response(response)

        assert result["classification"] == "functional"
        assert result["confidence"] == 0.95
        assert result["reasoning"] == "This is a feature request."
        assert result["labels"] == ["feature", "api"]

    def test_parse_response_with_markdown_wrapper(
        self, service: ClassificationService
    ) -> None:
        """Test parsing response wrapped in markdown code block."""
        response = """```json
{
    "classification": "non_functional",
    "confidence": 0.88,
    "reasoning": "Performance improvement.",
    "labels": ["performance"],
    "label_scores": {"performance": 0.88}
}
```"""

        result = service.parse_classification_response(response)

        assert result["classification"] == "non_functional"
        assert result["confidence"] == 0.88

    def test_parse_invalid_json_returns_undetermined(
        self, service: ClassificationService
    ) -> None:
        """Test that invalid JSON returns undetermined classification."""
        response = "This is not valid JSON"

        result = service.parse_classification_response(response)

        assert result["classification"] == "undetermined"
        assert result["confidence"] == 0.0
        assert result["labels"] == []

    def test_parse_missing_fields_uses_defaults(
        self, service: ClassificationService
    ) -> None:
        """Test that missing fields use default values."""
        response = json.dumps({
            "classification": "functional",
        })

        result = service.parse_classification_response(response)

        assert result["classification"] == "functional"
        assert result["confidence"] == 0.5  # Default confidence
        assert result["labels"] == []
        assert result["reasoning"] == ""


class TestValidateLabels:
    """Tests for validate_labels method."""

    @pytest.fixture
    def mock_taxonomy(self) -> LabelTaxonomy:
        """Create a mock taxonomy."""
        now = datetime.now(timezone.utc)
        return LabelTaxonomy(
            id="default",
            name="Default Taxonomy",
            labels=[
                LabelDefinition(id="feature", name="Feature"),
                LabelDefinition(id="bug", name="Bug"),
                LabelDefinition(id="performance", name="Performance"),
            ],
            version="1.0",
            created_at=now,
            updated_at=now,
        )

    @pytest.fixture
    def service(self) -> ClassificationService:
        """Create a service instance."""
        return ClassificationService(
            redis_client=AsyncMock(),
            taxonomy_service=AsyncMock(),
            ideas_service=AsyncMock(),
            llm_factory=AsyncMock(),
        )

    def test_validate_labels_all_valid(
        self, service: ClassificationService, mock_taxonomy: LabelTaxonomy
    ) -> None:
        """Test validation with all valid labels."""
        labels = ["feature", "bug"]

        valid_labels = service.validate_labels(labels, mock_taxonomy)

        assert valid_labels == ["feature", "bug"]

    def test_validate_labels_filters_invalid(
        self, service: ClassificationService, mock_taxonomy: LabelTaxonomy
    ) -> None:
        """Test validation filters out invalid labels."""
        labels = ["feature", "invalid-label", "bug", "nonexistent"]

        valid_labels = service.validate_labels(labels, mock_taxonomy)

        assert valid_labels == ["feature", "bug"]

    def test_validate_labels_empty_list(
        self, service: ClassificationService, mock_taxonomy: LabelTaxonomy
    ) -> None:
        """Test validation with empty list."""
        labels: list[str] = []

        valid_labels = service.validate_labels(labels, mock_taxonomy)

        assert valid_labels == []


class TestStoreAndGetClassificationResult:
    """Tests for store_classification_result and get_classification_result methods."""

    @pytest.fixture
    def service(self) -> ClassificationService:
        """Create a service instance with mocked Redis."""
        mock_redis = AsyncMock()
        return ClassificationService(
            redis_client=mock_redis,
            taxonomy_service=AsyncMock(),
            ideas_service=AsyncMock(),
            llm_factory=AsyncMock(),
        )

    @pytest.mark.asyncio
    async def test_store_classification_result(
        self, service: ClassificationService
    ) -> None:
        """Test storing a classification result."""
        result = ClassificationResult(
            idea_id="idea-123",
            classification=ClassificationType.FUNCTIONAL,
            confidence=0.95,
            labels=["feature"],
            reasoning="A feature request",
            model_version="v1.0",
        )

        await service.store_classification_result(result)

        service._redis_client.set.assert_called_once()
        call_args = service._redis_client.set.call_args
        assert "idea-123" in call_args[0][0]  # Key contains idea ID

    @pytest.mark.asyncio
    async def test_get_classification_result_found(
        self, service: ClassificationService
    ) -> None:
        """Test getting an existing classification result."""
        stored_result = {
            "idea_id": "idea-123",
            "classification": "functional",
            "confidence": 0.95,
            "labels": ["feature"],
            "reasoning": "A feature request",
            "model_version": "v1.0",
        }
        service._redis_client.get.return_value = json.dumps(stored_result)

        result = await service.get_classification_result("idea-123")

        assert result is not None
        assert result.idea_id == "idea-123"
        assert result.classification == ClassificationType.FUNCTIONAL

    @pytest.mark.asyncio
    async def test_get_classification_result_not_found(
        self, service: ClassificationService
    ) -> None:
        """Test getting a non-existent classification result."""
        service._redis_client.get.return_value = None

        result = await service.get_classification_result("nonexistent")

        assert result is None


class TestLLMIntegration:
    """Tests for LLM integration and retry logic."""

    @pytest.fixture
    def service(self) -> ClassificationService:
        """Create a service instance with mocked dependencies."""
        mock_redis = AsyncMock()
        mock_taxonomy_service = AsyncMock()
        mock_ideas_service = AsyncMock()
        mock_llm_factory = AsyncMock()

        return ClassificationService(
            redis_client=mock_redis,
            taxonomy_service=mock_taxonomy_service,
            ideas_service=mock_ideas_service,
            llm_factory=mock_llm_factory,
        )

    @pytest.mark.asyncio
    async def test_uses_discovery_agent_role(
        self, service: ClassificationService
    ) -> None:
        """Test that DISCOVERY agent role is used for classification."""
        from src.orchestrator.api.models.llm_config import AgentRole

        # Setup mocks
        now = datetime.now(timezone.utc)
        mock_idea = Idea(
            id="idea-123",
            content="Test idea",
            author_id="user-1",
            author_name="Test",
            status=IdeaStatus.ACTIVE,
            classification=IdeaClassification.UNDETERMINED,
            labels=[],
            created_at=now,
            updated_at=now,
        )
        mock_taxonomy = LabelTaxonomy(
            id="default",
            name="Default",
            labels=[],
            version="1.0",
            created_at=now,
            updated_at=now,
        )

        service._ideas_service.get_idea.return_value = mock_idea
        service._taxonomy_service.get_taxonomy.return_value = mock_taxonomy
        service._taxonomy_service.to_prompt_format.return_value = "Labels:"

        mock_llm_client = AsyncMock()
        mock_llm_client.model = "claude-sonnet-4"
        mock_llm_response = MagicMock()
        mock_llm_response.content = json.dumps({
            "classification": "undetermined",
            "confidence": 0.5,
            "reasoning": "",
            "labels": [],
            "label_scores": {},
        })
        mock_llm_client.generate.return_value = mock_llm_response
        service._llm_factory.get_client.return_value = mock_llm_client

        await service.classify_idea("idea-123")

        service._llm_factory.get_client.assert_called_once_with(AgentRole.DISCOVERY)

    @pytest.mark.asyncio
    async def test_uses_low_temperature_for_consistency(
        self, service: ClassificationService
    ) -> None:
        """Test that low temperature (0.3) is used for classification."""
        # Setup mocks
        now = datetime.now(timezone.utc)
        mock_idea = Idea(
            id="idea-123",
            content="Test idea",
            author_id="user-1",
            author_name="Test",
            status=IdeaStatus.ACTIVE,
            classification=IdeaClassification.UNDETERMINED,
            labels=[],
            created_at=now,
            updated_at=now,
        )
        mock_taxonomy = LabelTaxonomy(
            id="default",
            name="Default",
            labels=[],
            version="1.0",
            created_at=now,
            updated_at=now,
        )

        service._ideas_service.get_idea.return_value = mock_idea
        service._taxonomy_service.get_taxonomy.return_value = mock_taxonomy
        service._taxonomy_service.to_prompt_format.return_value = "Labels:"

        mock_llm_client = AsyncMock()
        mock_llm_client.model = "claude-sonnet-4"
        mock_llm_response = MagicMock()
        mock_llm_response.content = json.dumps({
            "classification": "undetermined",
            "confidence": 0.5,
            "reasoning": "",
            "labels": [],
            "label_scores": {},
        })
        mock_llm_client.generate.return_value = mock_llm_response
        service._llm_factory.get_client.return_value = mock_llm_client

        await service.classify_idea("idea-123")

        # Verify temperature is passed to generate call
        call_kwargs = mock_llm_client.generate.call_args[1]
        assert call_kwargs.get("temperature") == 0.3

    @pytest.mark.asyncio
    async def test_llm_error_falls_back_to_rule_based(
        self, service: ClassificationService
    ) -> None:
        """Test fallback to rule-based classification on LLM error."""
        # Setup mocks
        now = datetime.now(timezone.utc)
        mock_idea = Idea(
            id="idea-123",
            content="Fix the login bug that crashes the app",
            author_id="user-1",
            author_name="Test",
            status=IdeaStatus.ACTIVE,
            classification=IdeaClassification.UNDETERMINED,
            labels=[],
            created_at=now,
            updated_at=now,
        )
        mock_taxonomy = LabelTaxonomy(
            id="default",
            name="Default",
            labels=[
                LabelDefinition(id="bug", name="Bug", keywords=["fix", "bug", "crash"]),
            ],
            version="1.0",
            created_at=now,
            updated_at=now,
        )

        service._ideas_service.get_idea.return_value = mock_idea
        service._taxonomy_service.get_taxonomy.return_value = mock_taxonomy
        service._taxonomy_service.to_prompt_format.return_value = "Labels: bug"

        # Make LLM fail
        service._llm_factory.get_client.side_effect = Exception("LLM unavailable")

        # Should still return a result using rule-based fallback
        result = await service.classify_idea("idea-123")

        assert result.idea_id == "idea-123"
        # Rule-based should detect "bug" keyword
        assert "bug" in result.labels or result.classification == ClassificationType.UNDETERMINED


class TestGetClassificationService:
    """Tests for get_classification_service function."""

    def test_returns_service_instance(self) -> None:
        """Test that function returns a service instance."""
        # Reset the global instance first
        import src.orchestrator.services.classification_service as module

        module._classification_service = None

        service = get_classification_service()
        assert isinstance(service, ClassificationService)

    def test_returns_same_instance(self) -> None:
        """Test that function returns the same singleton instance."""
        # Reset the global instance first
        import src.orchestrator.services.classification_service as module

        module._classification_service = None

        service1 = get_classification_service()
        service2 = get_classification_service()

        assert service1 is service2
