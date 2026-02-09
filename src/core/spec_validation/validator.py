"""Spec file validator for structural and front-matter integrity."""

from __future__ import annotations

import re
from pathlib import Path

from src.core.spec_validation.models import SpecType, ValidationResult
from src.core.spec_validation.parser import extract_sections, parse_frontmatter


# Required sections per spec type
REQUIRED_SECTIONS: dict[SpecType, list[str]] = {
    SpecType.PRD: [
        "Business Intent",
        "Success Metrics",
        "User Impact",
        "Scope",
        "Constraints",
        "Acceptance Criteria",
    ],
    SpecType.DESIGN: [
        "Overview",
        "Dependencies",
        "Interfaces",
        "Technical Approach",
        "File Structure",
    ],
    SpecType.USER_STORIES: [],  # Dynamic: at least one US- section
    SpecType.TASKS: [
        "Progress",
        "Task List",
        "Completion Checklist",
    ],
}


def validate_frontmatter(file_path: str | Path) -> ValidationResult:
    """Validate YAML front-matter exists and is well-formed.

    Args:
        file_path: Path to the spec file.

    Returns:
        ValidationResult with errors if front-matter is missing or invalid.
    """
    errors: list[str] = []
    warnings: list[str] = []

    try:
        metadata = parse_frontmatter(file_path)
    except ValueError as e:
        return ValidationResult(valid=False, errors=(str(e),))

    if metadata is None:
        return ValidationResult(
            valid=False,
            errors=(
                "Missing YAML front-matter block "
                "(expected --- delimiters)",
            ),
        )

    # Validate id format matches Pnn-Fnn pattern
    if not re.match(r"^P\d{2}-F\d{2}(-[a-zA-Z0-9_-]+)?$", metadata.id):
        warnings.append(
            f"ID '{metadata.id}' does not match expected Pnn-Fnn format"
        )

    # Validate parent_id format
    if not re.match(r"^P\d{2}$", metadata.parent_id):
        warnings.append(
            f"Parent ID '{metadata.parent_id}' does not match "
            f"expected Pnn format"
        )

    return ValidationResult(
        valid=True,
        errors=tuple(errors),
        warnings=tuple(warnings),
    )


def validate_sections(
    file_path: str | Path,
    spec_type: SpecType,
) -> ValidationResult:
    """Validate that required sections exist for the spec type.

    Args:
        file_path: Path to the spec file.
        spec_type: The type of spec file being validated.

    Returns:
        ValidationResult with errors for each missing required section.
    """
    sections = extract_sections(file_path)
    section_names = set(sections.keys())

    errors: list[str] = []

    if spec_type == SpecType.USER_STORIES:
        # Special: need at least one US- section
        us_sections = [s for s in section_names if s.startswith("US-")]
        if not us_sections:
            errors.append(
                "No user story sections found (expected ## US-nn: ...)"
            )
        # Also check for Acceptance Criteria and Test Scenarios
        content = Path(file_path).read_text(encoding="utf-8")
        if "Acceptance Criteria" not in content:
            errors.append(
                "Missing 'Acceptance Criteria' in user stories"
            )
        if "Test Scenarios" not in content:
            errors.append(
                "Missing 'Test Scenarios' in user stories"
            )
    else:
        required = REQUIRED_SECTIONS.get(spec_type, [])
        for section in required:
            if section not in section_names:
                errors.append(f"Missing required section: ## {section}")

    return ValidationResult(valid=len(errors) == 0, errors=tuple(errors))


def validate_workitem(
    workitem_dir: str | Path,
) -> dict[str, ValidationResult]:
    """Validate all spec files in a work item directory.

    Checks that required files exist, and validates front-matter and
    sections for each file found.

    Args:
        workitem_dir: Path to the work item directory.

    Returns:
        Dictionary mapping filename to its ValidationResult.
    """
    workitem_path = Path(workitem_dir)
    results: dict[str, ValidationResult] = {}

    spec_files = {
        "prd.md": SpecType.PRD,
        "design.md": SpecType.DESIGN,
        "user_stories.md": SpecType.USER_STORIES,
        "tasks.md": SpecType.TASKS,
    }

    for filename, spec_type in spec_files.items():
        file_path = workitem_path / filename
        if not file_path.exists():
            if filename == "prd.md":
                # PRD is optional
                continue
            results[filename] = ValidationResult(
                valid=False,
                errors=(f"Required file missing: {filename}",),
            )
            continue

        # Validate front-matter
        fm_result = validate_frontmatter(file_path)
        if not fm_result.valid:
            results[filename] = fm_result
            continue

        # Validate sections
        section_result = validate_sections(file_path, spec_type)

        # Combine results
        all_errors = fm_result.errors + section_result.errors
        all_warnings = fm_result.warnings + section_result.warnings
        results[filename] = ValidationResult(
            valid=len(all_errors) == 0,
            errors=all_errors,
            warnings=all_warnings,
        )

    return results
