"""Tests for spec validation data models."""

from __future__ import annotations

import pytest

from src.core.spec_validation.models import (
    AlignmentResult,
    SpecMetadata,
    SpecStatus,
    SpecType,
    ValidationResult,
)


class TestSpecType:
    """Tests for the SpecType enum."""

    def test_spec_type_has_four_values(self) -> None:
        assert len(SpecType) == 4

    def test_spec_type_values(self) -> None:
        assert SpecType.PRD.value == "prd"
        assert SpecType.DESIGN.value == "design"
        assert SpecType.USER_STORIES.value == "user_stories"
        assert SpecType.TASKS.value == "tasks"

    def test_spec_type_is_str_enum(self) -> None:
        assert isinstance(SpecType.PRD, str)
        assert SpecType.PRD == "prd"


class TestSpecStatus:
    """Tests for the SpecStatus enum."""

    def test_spec_status_has_three_values(self) -> None:
        assert len(SpecStatus) == 3

    def test_spec_status_values(self) -> None:
        assert SpecStatus.DRAFT.value == "draft"
        assert SpecStatus.REVIEWED.value == "reviewed"
        assert SpecStatus.APPROVED.value == "approved"

    def test_spec_status_is_str_enum(self) -> None:
        assert isinstance(SpecStatus.DRAFT, str)
        assert SpecStatus.DRAFT == "draft"


class TestSpecMetadata:
    """Tests for the SpecMetadata frozen dataclass."""

    def test_create_spec_metadata(self) -> None:
        meta = SpecMetadata(
            id="P01-F02",
            parent_id="P01",
            type=SpecType.DESIGN,
            version=1,
            status=SpecStatus.DRAFT,
            created_by="planner",
            created_at="2026-01-01T00:00:00Z",
            updated_at="2026-01-01T00:00:00Z",
        )
        assert meta.id == "P01-F02"
        assert meta.type == SpecType.DESIGN
        assert meta.version == 1

    def test_spec_metadata_is_frozen(self) -> None:
        meta = SpecMetadata(
            id="P01-F02",
            parent_id="P01",
            type=SpecType.DESIGN,
            version=1,
            status=SpecStatus.DRAFT,
            created_by="planner",
            created_at="2026-01-01T00:00:00Z",
            updated_at="2026-01-01T00:00:00Z",
        )
        with pytest.raises(AttributeError):
            meta.id = "P01-F03"  # type: ignore[misc]

    def test_spec_metadata_defaults(self) -> None:
        meta = SpecMetadata(
            id="P01-F02",
            parent_id="P01",
            type=SpecType.DESIGN,
            version=1,
            status=SpecStatus.DRAFT,
            created_by="planner",
            created_at="2026-01-01T00:00:00Z",
            updated_at="2026-01-01T00:00:00Z",
        )
        assert meta.constraints_hash is None
        assert meta.dependencies == ()
        assert meta.tags == ()

    def test_spec_metadata_with_optional_fields(self) -> None:
        meta = SpecMetadata(
            id="P01-F02",
            parent_id="P01",
            type=SpecType.DESIGN,
            version=2,
            status=SpecStatus.REVIEWED,
            created_by="planner",
            created_at="2026-01-01T00:00:00Z",
            updated_at="2026-01-02T00:00:00Z",
            constraints_hash="abc123",
            dependencies=("P01-F01",),
            tags=("backend", "api"),
        )
        assert meta.constraints_hash == "abc123"
        assert meta.dependencies == ("P01-F01",)
        assert meta.tags == ("backend", "api")


class TestValidationResult:
    """Tests for the ValidationResult frozen dataclass."""

    def test_validation_result_defaults(self) -> None:
        result = ValidationResult(valid=True)
        assert result.valid is True
        assert result.errors == ()
        assert result.warnings == ()

    def test_validation_result_with_errors(self) -> None:
        result = ValidationResult(
            valid=False,
            errors=("Missing field: id",),
        )
        assert result.valid is False
        assert len(result.errors) == 1

    def test_validation_result_with_warnings(self) -> None:
        result = ValidationResult(
            valid=True,
            warnings=("Non-standard ID format",),
        )
        assert result.valid is True
        assert len(result.warnings) == 1

    def test_validation_result_is_frozen(self) -> None:
        result = ValidationResult(valid=True)
        with pytest.raises(AttributeError):
            result.valid = False  # type: ignore[misc]


class TestAlignmentResult:
    """Tests for the AlignmentResult frozen dataclass."""

    def test_alignment_result_passed_above_threshold(self) -> None:
        result = AlignmentResult(
            source_layer="design",
            target_layer="tasks",
            coverage=0.9,
            threshold=0.8,
        )
        assert result.passed is True

    def test_alignment_result_passed_at_threshold(self) -> None:
        result = AlignmentResult(
            source_layer="design",
            target_layer="tasks",
            coverage=0.8,
            threshold=0.8,
        )
        assert result.passed is True

    def test_alignment_result_failed_below_threshold(self) -> None:
        result = AlignmentResult(
            source_layer="design",
            target_layer="tasks",
            coverage=0.5,
            threshold=0.8,
        )
        assert result.passed is False

    def test_alignment_result_defaults(self) -> None:
        result = AlignmentResult(
            source_layer="design",
            target_layer="tasks",
            coverage=1.0,
        )
        assert result.matched_items == ()
        assert result.unmatched_items == ()
        assert result.threshold == 0.8

    def test_alignment_result_is_frozen(self) -> None:
        result = AlignmentResult(
            source_layer="design",
            target_layer="tasks",
            coverage=1.0,
        )
        with pytest.raises(AttributeError):
            result.coverage = 0.5  # type: ignore[misc]

    def test_alignment_result_zero_coverage(self) -> None:
        result = AlignmentResult(
            source_layer="prd",
            target_layer="design",
            coverage=0.0,
            threshold=0.8,
        )
        assert result.passed is False

    def test_alignment_result_with_items(self) -> None:
        result = AlignmentResult(
            source_layer="design",
            target_layer="tasks",
            coverage=0.75,
            matched_items=("Overview", "Dependencies", "Interfaces"),
            unmatched_items=("File Structure",),
            threshold=0.8,
        )
        assert len(result.matched_items) == 3
        assert len(result.unmatched_items) == 1
        assert result.passed is False
