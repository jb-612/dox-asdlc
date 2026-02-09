"""Data models for spec validation."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class SpecType(str, Enum):
    """Types of spec files in a work item."""

    PRD = "prd"
    DESIGN = "design"
    USER_STORIES = "user_stories"
    TASKS = "tasks"


class SpecStatus(str, Enum):
    """Status values for spec files."""

    DRAFT = "draft"
    REVIEWED = "reviewed"
    APPROVED = "approved"


@dataclass(frozen=True)
class SpecMetadata:
    """Machine-readable metadata from YAML front-matter.

    Attributes:
        id: Work item identifier (e.g. ``"P01-F02"``).
        parent_id: Parent work item (e.g. ``"P01"``).
        type: Spec file type.
        version: Version number (>= 1).
        status: Current status of the spec.
        created_by: Creator identifier.
        created_at: ISO 8601 creation timestamp.
        updated_at: ISO 8601 last-update timestamp.
        constraints_hash: Optional hash of constraints for change detection.
        dependencies: Tuple of dependency identifiers.
        tags: Tuple of classification tags.
    """

    id: str
    parent_id: str
    type: SpecType
    version: int
    status: SpecStatus
    created_by: str
    created_at: str
    updated_at: str
    constraints_hash: str | None = None
    dependencies: tuple[str, ...] = ()
    tags: tuple[str, ...] = ()


@dataclass(frozen=True)
class ValidationResult:
    """Result of a single validation check.

    Attributes:
        valid: Whether validation passed.
        errors: Tuple of error messages.
        warnings: Tuple of warning messages.
    """

    valid: bool
    errors: tuple[str, ...] = ()
    warnings: tuple[str, ...] = ()


@dataclass(frozen=True)
class AlignmentResult:
    """Result of a cross-layer alignment check.

    Attributes:
        source_layer: Layer being checked (e.g. ``"design"``).
        target_layer: Layer checked against (e.g. ``"tasks"``).
        coverage: Coverage ratio from 0.0 to 1.0.
        matched_items: Items that matched between layers.
        unmatched_items: Items missing from the target layer.
        threshold: Minimum coverage required to pass.
    """

    source_layer: str
    target_layer: str
    coverage: float  # 0.0 to 1.0
    matched_items: tuple[str, ...] = ()
    unmatched_items: tuple[str, ...] = ()
    threshold: float = 0.8

    @property
    def passed(self) -> bool:
        """Whether coverage meets or exceeds the threshold."""
        return self.coverage >= self.threshold
