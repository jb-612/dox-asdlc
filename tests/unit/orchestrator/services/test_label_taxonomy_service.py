"""Unit tests for Label Taxonomy Service.

Tests the LabelTaxonomyService class for managing label taxonomies
used in idea classification.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any
from unittest.mock import AsyncMock, patch

import pytest

from src.orchestrator.api.models.classification import (
    LabelDefinition,
    LabelTaxonomy,
)
from src.orchestrator.services.label_taxonomy_service import (
    DEFAULT_LABELS,
    LabelTaxonomyService,
    get_label_taxonomy_service,
)


class TestLabelTaxonomyServiceInit:
    """Tests for LabelTaxonomyService initialization."""

    def test_init_with_default_redis_client(self) -> None:
        """Test service can be instantiated with default Redis client."""
        service = LabelTaxonomyService()
        assert service is not None

    def test_init_with_custom_redis_client(self) -> None:
        """Test service can be instantiated with custom Redis client."""
        mock_client = AsyncMock()
        service = LabelTaxonomyService(redis_client=mock_client)
        assert service._redis_client is mock_client


class TestGetTaxonomy:
    """Tests for get_taxonomy method."""

    @pytest.fixture
    def service(self) -> LabelTaxonomyService:
        """Create a service instance with mocked Redis."""
        mock_client = AsyncMock()
        return LabelTaxonomyService(redis_client=mock_client)

    @pytest.mark.asyncio
    async def test_get_taxonomy_from_redis(self, service: LabelTaxonomyService) -> None:
        """Test getting taxonomy from Redis."""
        now = datetime.now(timezone.utc).isoformat()
        taxonomy_data = {
            "id": "default",
            "name": "Default Taxonomy",
            "description": "Standard labels",
            "labels": [
                {"id": "feature", "name": "Feature", "description": None, "keywords": [], "color": "#22c55e"},
                {"id": "bug", "name": "Bug", "description": None, "keywords": [], "color": "#ef4444"},
            ],
            "version": "1.0",
            "created_at": now,
            "updated_at": now,
        }
        service._redis_client.get.return_value = json.dumps(taxonomy_data)

        taxonomy = await service.get_taxonomy()

        assert taxonomy.id == "default"
        assert taxonomy.name == "Default Taxonomy"
        assert len(taxonomy.labels) == 2

    @pytest.mark.asyncio
    async def test_get_taxonomy_returns_default_when_not_found(
        self, service: LabelTaxonomyService
    ) -> None:
        """Test that get_taxonomy returns default taxonomy when not in Redis."""
        service._redis_client.get.return_value = None

        taxonomy = await service.get_taxonomy()

        assert taxonomy.id == "default"
        assert taxonomy.name == "Default Taxonomy"
        assert len(taxonomy.labels) == len(DEFAULT_LABELS)


class TestUpdateTaxonomy:
    """Tests for update_taxonomy method."""

    @pytest.fixture
    def service(self) -> LabelTaxonomyService:
        """Create a service instance with mocked Redis."""
        mock_client = AsyncMock()
        return LabelTaxonomyService(redis_client=mock_client)

    @pytest.mark.asyncio
    async def test_update_taxonomy_stores_in_redis(
        self, service: LabelTaxonomyService
    ) -> None:
        """Test that update_taxonomy stores the taxonomy in Redis."""
        now = datetime.now(timezone.utc)
        taxonomy = LabelTaxonomy(
            id="custom",
            name="Custom Taxonomy",
            labels=[
                LabelDefinition(id="label-1", name="Label 1"),
            ],
            version="1.0",
            created_at=now,
            updated_at=now,
        )

        result = await service.update_taxonomy(taxonomy)

        # Check that core fields match (updated_at will be newer)
        assert result.id == taxonomy.id
        assert result.name == taxonomy.name
        assert result.labels == taxonomy.labels
        assert result.version == taxonomy.version
        assert result.created_at == taxonomy.created_at
        service._redis_client.set.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_taxonomy_updates_timestamp(
        self, service: LabelTaxonomyService
    ) -> None:
        """Test that update_taxonomy updates the updated_at timestamp."""
        old_time = datetime(2024, 1, 1, tzinfo=timezone.utc)
        taxonomy = LabelTaxonomy(
            id="test",
            name="Test Taxonomy",
            labels=[],
            version="1.0",
            created_at=old_time,
            updated_at=old_time,
        )

        result = await service.update_taxonomy(taxonomy)

        # The updated_at should be newer than the original
        assert result.updated_at > old_time


class TestAddLabel:
    """Tests for add_label method."""

    @pytest.fixture
    def service(self) -> LabelTaxonomyService:
        """Create a service instance with mocked Redis."""
        mock_client = AsyncMock()
        return LabelTaxonomyService(redis_client=mock_client)

    @pytest.mark.asyncio
    async def test_add_label_to_taxonomy(self, service: LabelTaxonomyService) -> None:
        """Test adding a new label to the taxonomy."""
        now = datetime.now(timezone.utc).isoformat()
        existing_taxonomy = {
            "id": "default",
            "name": "Default Taxonomy",
            "description": None,
            "labels": [
                {"id": "feature", "name": "Feature", "description": None, "keywords": [], "color": "#22c55e"},
            ],
            "version": "1.0",
            "created_at": now,
            "updated_at": now,
        }
        service._redis_client.get.return_value = json.dumps(existing_taxonomy)

        new_label = LabelDefinition(
            id="new-label",
            name="New Label",
            description="A new label",
            keywords=["new"],
            color="#3b82f6",
        )

        result = await service.add_label(new_label)

        assert len(result.labels) == 2
        assert any(label.id == "new-label" for label in result.labels)

    @pytest.mark.asyncio
    async def test_add_label_with_duplicate_id_raises_error(
        self, service: LabelTaxonomyService
    ) -> None:
        """Test that adding a label with duplicate ID raises ValueError."""
        now = datetime.now(timezone.utc).isoformat()
        existing_taxonomy = {
            "id": "default",
            "name": "Default Taxonomy",
            "description": None,
            "labels": [
                {"id": "feature", "name": "Feature", "description": None, "keywords": [], "color": "#22c55e"},
            ],
            "version": "1.0",
            "created_at": now,
            "updated_at": now,
        }
        service._redis_client.get.return_value = json.dumps(existing_taxonomy)

        duplicate_label = LabelDefinition(id="feature", name="Duplicate Feature")

        with pytest.raises(ValueError, match="already exists"):
            await service.add_label(duplicate_label)


class TestUpdateLabel:
    """Tests for update_label method."""

    @pytest.fixture
    def service(self) -> LabelTaxonomyService:
        """Create a service instance with mocked Redis."""
        mock_client = AsyncMock()
        return LabelTaxonomyService(redis_client=mock_client)

    @pytest.mark.asyncio
    async def test_update_label_in_taxonomy(
        self, service: LabelTaxonomyService
    ) -> None:
        """Test updating an existing label."""
        now = datetime.now(timezone.utc).isoformat()
        existing_taxonomy = {
            "id": "default",
            "name": "Default Taxonomy",
            "description": None,
            "labels": [
                {"id": "feature", "name": "Feature", "description": "Old description", "keywords": [], "color": "#22c55e"},
            ],
            "version": "1.0",
            "created_at": now,
            "updated_at": now,
        }
        service._redis_client.get.return_value = json.dumps(existing_taxonomy)

        updated_label = LabelDefinition(
            id="feature",
            name="Feature Updated",
            description="New description",
            keywords=["updated"],
            color="#10b981",
        )

        result = await service.update_label("feature", updated_label)

        updated = next(l for l in result.labels if l.id == "feature")
        assert updated.name == "Feature Updated"
        assert updated.description == "New description"

    @pytest.mark.asyncio
    async def test_update_label_not_found_raises_error(
        self, service: LabelTaxonomyService
    ) -> None:
        """Test that updating a non-existent label raises KeyError."""
        now = datetime.now(timezone.utc).isoformat()
        existing_taxonomy = {
            "id": "default",
            "name": "Default Taxonomy",
            "description": None,
            "labels": [
                {"id": "feature", "name": "Feature", "description": None, "keywords": [], "color": None},
            ],
            "version": "1.0",
            "created_at": now,
            "updated_at": now,
        }
        service._redis_client.get.return_value = json.dumps(existing_taxonomy)

        updated_label = LabelDefinition(id="nonexistent", name="Does Not Exist")

        with pytest.raises(KeyError, match="not found"):
            await service.update_label("nonexistent", updated_label)


class TestDeleteLabel:
    """Tests for delete_label method."""

    @pytest.fixture
    def service(self) -> LabelTaxonomyService:
        """Create a service instance with mocked Redis."""
        mock_client = AsyncMock()
        return LabelTaxonomyService(redis_client=mock_client)

    @pytest.mark.asyncio
    async def test_delete_label_from_taxonomy(
        self, service: LabelTaxonomyService
    ) -> None:
        """Test deleting a label from the taxonomy."""
        now = datetime.now(timezone.utc).isoformat()
        existing_taxonomy = {
            "id": "default",
            "name": "Default Taxonomy",
            "description": None,
            "labels": [
                {"id": "feature", "name": "Feature", "description": None, "keywords": [], "color": None},
                {"id": "bug", "name": "Bug", "description": None, "keywords": [], "color": None},
            ],
            "version": "1.0",
            "created_at": now,
            "updated_at": now,
        }
        service._redis_client.get.return_value = json.dumps(existing_taxonomy)

        result = await service.delete_label("bug")

        assert len(result.labels) == 1
        assert result.labels[0].id == "feature"

    @pytest.mark.asyncio
    async def test_delete_label_not_found_raises_error(
        self, service: LabelTaxonomyService
    ) -> None:
        """Test that deleting a non-existent label raises KeyError."""
        now = datetime.now(timezone.utc).isoformat()
        existing_taxonomy = {
            "id": "default",
            "name": "Default Taxonomy",
            "description": None,
            "labels": [
                {"id": "feature", "name": "Feature", "description": None, "keywords": [], "color": None},
            ],
            "version": "1.0",
            "created_at": now,
            "updated_at": now,
        }
        service._redis_client.get.return_value = json.dumps(existing_taxonomy)

        with pytest.raises(KeyError, match="not found"):
            await service.delete_label("nonexistent")


class TestGetLabel:
    """Tests for get_label method."""

    @pytest.fixture
    def service(self) -> LabelTaxonomyService:
        """Create a service instance with mocked Redis."""
        mock_client = AsyncMock()
        return LabelTaxonomyService(redis_client=mock_client)

    @pytest.mark.asyncio
    async def test_get_label_by_id(self, service: LabelTaxonomyService) -> None:
        """Test getting a specific label by ID."""
        now = datetime.now(timezone.utc).isoformat()
        existing_taxonomy = {
            "id": "default",
            "name": "Default Taxonomy",
            "description": None,
            "labels": [
                {"id": "feature", "name": "Feature", "description": "A feature", "keywords": ["new"], "color": "#22c55e"},
                {"id": "bug", "name": "Bug", "description": "A bug", "keywords": ["fix"], "color": "#ef4444"},
            ],
            "version": "1.0",
            "created_at": now,
            "updated_at": now,
        }
        service._redis_client.get.return_value = json.dumps(existing_taxonomy)

        label = await service.get_label("feature")

        assert label.id == "feature"
        assert label.name == "Feature"
        assert label.description == "A feature"

    @pytest.mark.asyncio
    async def test_get_label_not_found_returns_none(
        self, service: LabelTaxonomyService
    ) -> None:
        """Test that getting a non-existent label returns None."""
        now = datetime.now(timezone.utc).isoformat()
        existing_taxonomy = {
            "id": "default",
            "name": "Default Taxonomy",
            "description": None,
            "labels": [
                {"id": "feature", "name": "Feature", "description": None, "keywords": [], "color": None},
            ],
            "version": "1.0",
            "created_at": now,
            "updated_at": now,
        }
        service._redis_client.get.return_value = json.dumps(existing_taxonomy)

        label = await service.get_label("nonexistent")

        assert label is None


class TestToPromptFormat:
    """Tests for to_prompt_format method."""

    @pytest.fixture
    def service(self) -> LabelTaxonomyService:
        """Create a service instance with mocked Redis."""
        mock_client = AsyncMock()
        return LabelTaxonomyService(redis_client=mock_client)

    @pytest.mark.asyncio
    async def test_to_prompt_format_returns_formatted_string(
        self, service: LabelTaxonomyService
    ) -> None:
        """Test that to_prompt_format returns properly formatted text for LLM."""
        now = datetime.now(timezone.utc).isoformat()
        existing_taxonomy = {
            "id": "default",
            "name": "Default Taxonomy",
            "description": None,
            "labels": [
                {"id": "feature", "name": "Feature", "description": "A new feature", "keywords": ["new", "add"], "color": "#22c55e"},
                {"id": "bug", "name": "Bug", "description": "A defect", "keywords": ["fix", "error"], "color": "#ef4444"},
            ],
            "version": "1.0",
            "created_at": now,
            "updated_at": now,
        }
        service._redis_client.get.return_value = json.dumps(existing_taxonomy)

        prompt_text = await service.to_prompt_format()

        # Should contain label information
        assert "feature" in prompt_text.lower()
        assert "bug" in prompt_text.lower()
        # Should contain descriptions
        assert "new feature" in prompt_text.lower()
        assert "defect" in prompt_text.lower()

    @pytest.mark.asyncio
    async def test_to_prompt_format_includes_keywords(
        self, service: LabelTaxonomyService
    ) -> None:
        """Test that to_prompt_format includes keywords."""
        now = datetime.now(timezone.utc).isoformat()
        existing_taxonomy = {
            "id": "default",
            "name": "Default Taxonomy",
            "description": None,
            "labels": [
                {"id": "performance", "name": "Performance", "description": "Performance improvement", "keywords": ["speed", "optimize", "fast"], "color": None},
            ],
            "version": "1.0",
            "created_at": now,
            "updated_at": now,
        }
        service._redis_client.get.return_value = json.dumps(existing_taxonomy)

        prompt_text = await service.to_prompt_format()

        # Should include keywords in the output
        assert "speed" in prompt_text.lower() or "optimize" in prompt_text.lower()


class TestDefaultLabels:
    """Tests for default label definitions."""

    def test_default_labels_exist(self) -> None:
        """Test that default labels are defined."""
        assert len(DEFAULT_LABELS) >= 10

    def test_default_labels_have_required_fields(self) -> None:
        """Test that all default labels have required fields."""
        required_ids = ["feature", "bug", "improvement", "performance", 
                       "security", "documentation", "api", "ui", 
                       "backend", "infrastructure"]
        
        label_ids = [label.id for label in DEFAULT_LABELS]
        for required_id in required_ids:
            assert required_id in label_ids, f"Missing default label: {required_id}"


class TestGetLabelTaxonomyService:
    """Tests for get_label_taxonomy_service function."""

    def test_returns_service_instance(self) -> None:
        """Test that function returns a service instance."""
        # Reset the global instance first
        import src.orchestrator.services.label_taxonomy_service as module
        module._label_taxonomy_service = None

        service = get_label_taxonomy_service()
        assert isinstance(service, LabelTaxonomyService)

    def test_returns_same_instance(self) -> None:
        """Test that function returns the same singleton instance."""
        # Reset the global instance first
        import src.orchestrator.services.label_taxonomy_service as module
        module._label_taxonomy_service = None

        service1 = get_label_taxonomy_service()
        service2 = get_label_taxonomy_service()

        assert service1 is service2
