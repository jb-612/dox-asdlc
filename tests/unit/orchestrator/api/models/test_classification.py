"""Unit tests for Classification API models.

Tests the Pydantic models for auto-classification including classification
results, requests, labels, and taxonomy management.
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from src.orchestrator.api.models.classification import (
    BatchClassificationRequest,
    ClassificationJob,
    ClassificationJobStatus,
    ClassificationRequest,
    ClassificationResult,
    ClassificationType,
    LabelDefinition,
    LabelTaxonomy,
)


class TestClassificationType:
    """Tests for ClassificationType enum."""

    def test_classification_values(self) -> None:
        """Test that all expected classification types exist."""
        assert ClassificationType.FUNCTIONAL.value == "functional"
        assert ClassificationType.NON_FUNCTIONAL.value == "non_functional"
        assert ClassificationType.UNDETERMINED.value == "undetermined"

    def test_classification_is_string_enum(self) -> None:
        """Test that classification values can be used as strings."""
        assert ClassificationType.FUNCTIONAL == "functional"
        assert ClassificationType.NON_FUNCTIONAL == "non_functional"
        assert ClassificationType.UNDETERMINED == "undetermined"


class TestClassificationResult:
    """Tests for ClassificationResult model."""

    def test_create_classification_result(self) -> None:
        """Test creating a classification result model."""
        result = ClassificationResult(
            idea_id="idea-123",
            classification=ClassificationType.FUNCTIONAL,
            confidence=0.95,
            labels=["feature", "api"],
            reasoning="This idea describes a new API endpoint feature.",
            model_version="v1.0",
        )
        assert result.idea_id == "idea-123"
        assert result.classification == ClassificationType.FUNCTIONAL
        assert result.confidence == 0.95
        assert result.labels == ["feature", "api"]
        assert result.reasoning == "This idea describes a new API endpoint feature."
        assert result.model_version == "v1.0"

    def test_classification_result_optional_fields(self) -> None:
        """Test classification result with optional fields omitted."""
        result = ClassificationResult(
            idea_id="idea-456",
            classification=ClassificationType.NON_FUNCTIONAL,
            confidence=0.87,
            labels=["performance"],
        )
        assert result.reasoning is None
        assert result.model_version is None

    def test_confidence_bounds_valid(self) -> None:
        """Test valid confidence bounds (0.0 to 1.0)."""
        # Minimum bound
        result_min = ClassificationResult(
            idea_id="idea-1",
            classification=ClassificationType.UNDETERMINED,
            confidence=0.0,
            labels=[],
        )
        assert result_min.confidence == 0.0

        # Maximum bound
        result_max = ClassificationResult(
            idea_id="idea-2",
            classification=ClassificationType.FUNCTIONAL,
            confidence=1.0,
            labels=[],
        )
        assert result_max.confidence == 1.0

    def test_confidence_below_min_invalid(self) -> None:
        """Test that confidence below 0.0 is invalid."""
        with pytest.raises(ValidationError):
            ClassificationResult(
                idea_id="idea-1",
                classification=ClassificationType.FUNCTIONAL,
                confidence=-0.1,
                labels=[],
            )

    def test_confidence_above_max_invalid(self) -> None:
        """Test that confidence above 1.0 is invalid."""
        with pytest.raises(ValidationError):
            ClassificationResult(
                idea_id="idea-1",
                classification=ClassificationType.FUNCTIONAL,
                confidence=1.1,
                labels=[],
            )

    def test_classification_result_serialization(self) -> None:
        """Test classification result JSON serialization."""
        result = ClassificationResult(
            idea_id="idea-789",
            classification=ClassificationType.NON_FUNCTIONAL,
            confidence=0.78,
            labels=["security", "backend"],
            reasoning="Security improvement for backend services.",
            model_version="v1.2",
        )
        data = result.model_dump()
        assert data["idea_id"] == "idea-789"
        assert data["classification"] == "non_functional"
        assert data["confidence"] == 0.78
        assert data["labels"] == ["security", "backend"]
        assert data["model_version"] == "v1.2"


class TestClassificationRequest:
    """Tests for ClassificationRequest model."""

    def test_create_classification_request(self) -> None:
        """Test creating a classification request."""
        request = ClassificationRequest(idea_id="idea-abc")
        assert request.idea_id == "idea-abc"

    def test_classification_request_required_field(self) -> None:
        """Test that idea_id is required."""
        with pytest.raises(ValidationError):
            ClassificationRequest()  # type: ignore


class TestBatchClassificationRequest:
    """Tests for BatchClassificationRequest model."""

    def test_create_batch_request(self) -> None:
        """Test creating a batch classification request."""
        request = BatchClassificationRequest(idea_ids=["idea-1", "idea-2", "idea-3"])
        assert request.idea_ids == ["idea-1", "idea-2", "idea-3"]

    def test_batch_request_empty_list(self) -> None:
        """Test batch request with empty list."""
        request = BatchClassificationRequest(idea_ids=[])
        assert request.idea_ids == []

    def test_batch_request_required_field(self) -> None:
        """Test that idea_ids is required."""
        with pytest.raises(ValidationError):
            BatchClassificationRequest()  # type: ignore


class TestLabelDefinition:
    """Tests for LabelDefinition model."""

    def test_create_label_definition(self) -> None:
        """Test creating a label definition."""
        label = LabelDefinition(
            id="feature",
            name="Feature",
            description="A new feature or capability",
            keywords=["new", "add", "create", "implement"],
            color="#22c55e",
        )
        assert label.id == "feature"
        assert label.name == "Feature"
        assert label.description == "A new feature or capability"
        assert label.keywords == ["new", "add", "create", "implement"]
        assert label.color == "#22c55e"

    def test_label_definition_optional_fields(self) -> None:
        """Test label definition with optional fields."""
        label = LabelDefinition(
            id="misc",
            name="Miscellaneous",
        )
        assert label.description is None
        assert label.keywords == []
        assert label.color is None

    def test_label_definition_serialization(self) -> None:
        """Test label definition JSON serialization."""
        label = LabelDefinition(
            id="bug",
            name="Bug",
            description="A defect or issue",
            keywords=["fix", "bug", "error", "broken"],
            color="#ef4444",
        )
        data = label.model_dump()
        assert data["id"] == "bug"
        assert data["name"] == "Bug"
        assert data["color"] == "#ef4444"


class TestLabelTaxonomy:
    """Tests for LabelTaxonomy model."""

    def test_create_label_taxonomy(self) -> None:
        """Test creating a label taxonomy."""
        now = datetime.now(timezone.utc)
        taxonomy = LabelTaxonomy(
            id="default",
            name="Default Taxonomy",
            description="Standard label taxonomy for idea classification",
            labels=[
                LabelDefinition(id="feature", name="Feature"),
                LabelDefinition(id="bug", name="Bug"),
            ],
            version="1.0",
            created_at=now,
            updated_at=now,
        )
        assert taxonomy.id == "default"
        assert taxonomy.name == "Default Taxonomy"
        assert len(taxonomy.labels) == 2
        assert taxonomy.version == "1.0"

    def test_taxonomy_empty_labels(self) -> None:
        """Test taxonomy with empty labels list."""
        now = datetime.now(timezone.utc)
        taxonomy = LabelTaxonomy(
            id="empty",
            name="Empty Taxonomy",
            labels=[],
            version="0.1",
            created_at=now,
            updated_at=now,
        )
        assert taxonomy.labels == []

    def test_taxonomy_serialization(self) -> None:
        """Test taxonomy JSON serialization."""
        now = datetime.now(timezone.utc)
        taxonomy = LabelTaxonomy(
            id="test",
            name="Test Taxonomy",
            labels=[
                LabelDefinition(id="test-label", name="Test Label"),
            ],
            version="1.0",
            created_at=now,
            updated_at=now,
        )
        data = taxonomy.model_dump()
        assert data["id"] == "test"
        assert len(data["labels"]) == 1
        assert data["labels"][0]["id"] == "test-label"


class TestClassificationJobStatus:
    """Tests for ClassificationJobStatus enum."""

    def test_job_status_values(self) -> None:
        """Test that all expected job statuses exist."""
        assert ClassificationJobStatus.PENDING.value == "pending"
        assert ClassificationJobStatus.PROCESSING.value == "processing"
        assert ClassificationJobStatus.COMPLETED.value == "completed"
        assert ClassificationJobStatus.FAILED.value == "failed"


class TestClassificationJob:
    """Tests for ClassificationJob model."""

    def test_create_classification_job(self) -> None:
        """Test creating a classification job."""
        now = datetime.now(timezone.utc)
        job = ClassificationJob(
            job_id="job-123",
            status=ClassificationJobStatus.PROCESSING,
            total=10,
            completed=5,
            failed=1,
            created_at=now,
        )
        assert job.job_id == "job-123"
        assert job.status == ClassificationJobStatus.PROCESSING
        assert job.total == 10
        assert job.completed == 5
        assert job.failed == 1
        assert job.created_at == now

    def test_job_default_values(self) -> None:
        """Test job with default values."""
        now = datetime.now(timezone.utc)
        job = ClassificationJob(
            job_id="job-456",
            status=ClassificationJobStatus.PENDING,
            total=20,
            created_at=now,
        )
        assert job.completed == 0
        assert job.failed == 0

    def test_job_serialization(self) -> None:
        """Test job JSON serialization."""
        now = datetime.now(timezone.utc)
        job = ClassificationJob(
            job_id="job-789",
            status=ClassificationJobStatus.COMPLETED,
            total=15,
            completed=14,
            failed=1,
            created_at=now,
        )
        data = job.model_dump()
        assert data["job_id"] == "job-789"
        assert data["status"] == "completed"
        assert data["total"] == 15
        assert data["completed"] == 14
        assert data["failed"] == 1

    def test_job_counts_cannot_be_negative(self) -> None:
        """Test that job counts cannot be negative."""
        now = datetime.now(timezone.utc)
        with pytest.raises(ValidationError):
            ClassificationJob(
                job_id="job-bad",
                status=ClassificationJobStatus.PENDING,
                total=-1,
                created_at=now,
            )

        with pytest.raises(ValidationError):
            ClassificationJob(
                job_id="job-bad",
                status=ClassificationJobStatus.PENDING,
                total=10,
                completed=-1,
                created_at=now,
            )

        with pytest.raises(ValidationError):
            ClassificationJob(
                job_id="job-bad",
                status=ClassificationJobStatus.PENDING,
                total=10,
                failed=-1,
                created_at=now,
            )
