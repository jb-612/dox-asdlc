"""Spec validation framework for work item files."""

from src.core.spec_validation.models import (
    AlignmentResult,
    SpecMetadata,
    SpecStatus,
    SpecType,
    ValidationResult,
)
from src.core.spec_validation.parser import (
    extract_body,
    extract_sections,
    parse_frontmatter,
)
from src.core.spec_validation.alignment import (
    check_design_to_tasks,
    check_full_alignment,
    check_prd_to_design,
    check_tasks_to_stories,
)
from src.core.spec_validation.validator import (
    validate_frontmatter,
    validate_sections,
    validate_workitem,
)

__all__ = [
    # Models
    "AlignmentResult",
    "SpecMetadata",
    "SpecStatus",
    "SpecType",
    "ValidationResult",
    # Parser
    "extract_body",
    "extract_sections",
    "parse_frontmatter",
    # Alignment
    "check_design_to_tasks",
    "check_full_alignment",
    "check_prd_to_design",
    "check_tasks_to_stories",
    # Validator
    "validate_frontmatter",
    "validate_sections",
    "validate_workitem",
]
