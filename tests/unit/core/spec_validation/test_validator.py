"""Tests for spec file validation."""

from __future__ import annotations

from pathlib import Path

import pytest

from src.core.spec_validation.models import SpecType, ValidationResult
from src.core.spec_validation.validator import (
    validate_frontmatter,
    validate_sections,
    validate_workitem,
)

# -- Helpers ----------------------------------------------------------------

VALID_DESIGN_FM = """\
---
id: P01-F02
parent_id: P01
type: design
version: 1
status: draft
created_by: planner
created_at: "2026-01-01T00:00:00Z"
updated_at: "2026-01-01T00:00:00Z"
---
"""

VALID_DESIGN_CONTENT = VALID_DESIGN_FM + """
## Overview

Overview of the design.

## Dependencies

- Redis

## Interfaces

Interface definitions.

## Technical Approach

How we build it.

## File Structure

Where files go.
"""

VALID_TASKS_FM = """\
---
id: P01-F02
parent_id: P01
type: tasks
version: 1
status: draft
created_by: planner
created_at: "2026-01-01T00:00:00Z"
updated_at: "2026-01-01T00:00:00Z"
---
"""

VALID_TASKS_CONTENT = VALID_TASKS_FM + """
## Progress

0/5 tasks complete (0%)

## Task List

### T01: Implement feature

Details here.

## Completion Checklist

- [ ] All tests pass
"""

VALID_USER_STORIES_FM = """\
---
id: P01-F02
parent_id: P01
type: user_stories
version: 1
status: draft
created_by: planner
created_at: "2026-01-01T00:00:00Z"
updated_at: "2026-01-01T00:00:00Z"
---
"""

VALID_USER_STORIES_CONTENT = VALID_USER_STORIES_FM + """
## US-01: User can submit request

As a user I want to submit requests.

### Acceptance Criteria

- Given a valid request, it is submitted.

### Test Scenarios

- Test valid submission.
"""

NON_STANDARD_ID_FM = """\
---
id: CUSTOM-01
parent_id: CUSTOM
type: design
version: 1
status: draft
created_by: planner
created_at: "2026-01-01T00:00:00Z"
updated_at: "2026-01-01T00:00:00Z"
---

## Overview

Content.
"""


def _write(path: Path, content: str) -> Path:
    """Write content to path and return it."""
    path.write_text(content, encoding="utf-8")
    return path


# -- validate_frontmatter tests ---------------------------------------------


class TestValidateFrontmatter:
    """Tests for the validate_frontmatter function."""

    def test_validate_frontmatter_passes_for_valid_file(
        self, tmp_path: Path,
    ) -> None:
        fp = _write(tmp_path / "design.md", VALID_DESIGN_CONTENT)
        result = validate_frontmatter(fp)
        assert result.valid is True
        assert len(result.errors) == 0

    def test_validate_frontmatter_fails_for_missing_frontmatter(
        self, tmp_path: Path,
    ) -> None:
        fp = _write(
            tmp_path / "design.md",
            "## Overview\n\nNo front-matter here.\n",
        )
        result = validate_frontmatter(fp)
        assert result.valid is False
        assert any("Missing YAML front-matter" in e for e in result.errors)

    def test_validate_frontmatter_fails_for_malformed_frontmatter(
        self, tmp_path: Path,
    ) -> None:
        content = "---\nid: P01-F02\ntype: design\n---\n\nBody.\n"
        fp = _write(tmp_path / "design.md", content)
        result = validate_frontmatter(fp)
        assert result.valid is False
        assert any("Missing required" in e for e in result.errors)

    def test_validate_frontmatter_warns_for_nonstandard_id(
        self, tmp_path: Path,
    ) -> None:
        fp = _write(tmp_path / "design.md", NON_STANDARD_ID_FM)
        result = validate_frontmatter(fp)
        assert result.valid is True
        assert any("Pnn-Fnn format" in w for w in result.warnings)

    def test_validate_frontmatter_warns_for_nonstandard_parent_id(
        self, tmp_path: Path,
    ) -> None:
        fp = _write(tmp_path / "design.md", NON_STANDARD_ID_FM)
        result = validate_frontmatter(fp)
        assert any("Pnn format" in w for w in result.warnings)


# -- validate_sections tests -----------------------------------------------


class TestValidateSections:
    """Tests for the validate_sections function."""

    def test_validate_sections_passes_for_complete_design(
        self, tmp_path: Path,
    ) -> None:
        fp = _write(tmp_path / "design.md", VALID_DESIGN_CONTENT)
        result = validate_sections(fp, SpecType.DESIGN)
        assert result.valid is True
        assert len(result.errors) == 0

    def test_validate_sections_fails_for_missing_design_section(
        self, tmp_path: Path,
    ) -> None:
        # Missing "File Structure" section
        content = VALID_DESIGN_FM + """
## Overview

Content.

## Dependencies

Content.

## Interfaces

Content.

## Technical Approach

Content.
"""
        fp = _write(tmp_path / "design.md", content)
        result = validate_sections(fp, SpecType.DESIGN)
        assert result.valid is False
        assert any("File Structure" in e for e in result.errors)

    def test_validate_sections_passes_for_complete_tasks(
        self, tmp_path: Path,
    ) -> None:
        fp = _write(tmp_path / "tasks.md", VALID_TASKS_CONTENT)
        result = validate_sections(fp, SpecType.TASKS)
        assert result.valid is True

    def test_validate_sections_fails_for_missing_tasks_section(
        self, tmp_path: Path,
    ) -> None:
        content = VALID_TASKS_FM + """
## Progress

0%

## Task List

Tasks here.
"""
        fp = _write(tmp_path / "tasks.md", content)
        result = validate_sections(fp, SpecType.TASKS)
        assert result.valid is False
        assert any("Completion Checklist" in e for e in result.errors)

    def test_validate_sections_user_stories_passes_with_us_section(
        self, tmp_path: Path,
    ) -> None:
        fp = _write(
            tmp_path / "user_stories.md",
            VALID_USER_STORIES_CONTENT,
        )
        result = validate_sections(fp, SpecType.USER_STORIES)
        assert result.valid is True

    def test_validate_sections_user_stories_fails_without_us_section(
        self, tmp_path: Path,
    ) -> None:
        content = VALID_USER_STORIES_FM + """
## Introduction

No user story sections here.

### Acceptance Criteria

Something.

### Test Scenarios

Something.
"""
        fp = _write(tmp_path / "user_stories.md", content)
        result = validate_sections(fp, SpecType.USER_STORIES)
        assert result.valid is False
        assert any("No user story sections" in e for e in result.errors)

    def test_validate_sections_user_stories_fails_without_acceptance(
        self, tmp_path: Path,
    ) -> None:
        content = VALID_USER_STORIES_FM + """
## US-01: Story one

Story body.

### Test Scenarios

Something.
"""
        fp = _write(tmp_path / "user_stories.md", content)
        result = validate_sections(fp, SpecType.USER_STORIES)
        assert result.valid is False
        assert any("Acceptance Criteria" in e for e in result.errors)

    def test_validate_sections_user_stories_fails_without_test_scenarios(
        self, tmp_path: Path,
    ) -> None:
        content = VALID_USER_STORIES_FM + """
## US-01: Story one

Story body.

### Acceptance Criteria

Something.
"""
        fp = _write(tmp_path / "user_stories.md", content)
        result = validate_sections(fp, SpecType.USER_STORIES)
        assert result.valid is False
        assert any("Test Scenarios" in e for e in result.errors)


# -- validate_workitem tests -----------------------------------------------


class TestValidateWorkitem:
    """Tests for the validate_workitem function."""

    def test_validate_workitem_passes_for_complete_directory(
        self, tmp_path: Path,
    ) -> None:
        _write(tmp_path / "design.md", VALID_DESIGN_CONTENT)
        _write(tmp_path / "tasks.md", VALID_TASKS_CONTENT)
        _write(
            tmp_path / "user_stories.md",
            VALID_USER_STORIES_CONTENT,
        )

        results = validate_workitem(tmp_path)
        assert all(r.valid for r in results.values())

    def test_validate_workitem_fails_for_missing_required_file(
        self, tmp_path: Path,
    ) -> None:
        _write(tmp_path / "design.md", VALID_DESIGN_CONTENT)
        # Missing tasks.md and user_stories.md

        results = validate_workitem(tmp_path)
        assert "tasks.md" in results
        assert results["tasks.md"].valid is False
        assert any(
            "Required file missing" in e
            for e in results["tasks.md"].errors
        )

    def test_validate_workitem_skips_optional_prd(
        self, tmp_path: Path,
    ) -> None:
        _write(tmp_path / "design.md", VALID_DESIGN_CONTENT)
        _write(tmp_path / "tasks.md", VALID_TASKS_CONTENT)
        _write(
            tmp_path / "user_stories.md",
            VALID_USER_STORIES_CONTENT,
        )
        # No prd.md - should not appear in results

        results = validate_workitem(tmp_path)
        assert "prd.md" not in results

    def test_validate_workitem_reports_frontmatter_errors(
        self, tmp_path: Path,
    ) -> None:
        _write(
            tmp_path / "design.md",
            "## Overview\n\nNo front-matter.\n",
        )
        _write(tmp_path / "tasks.md", VALID_TASKS_CONTENT)
        _write(
            tmp_path / "user_stories.md",
            VALID_USER_STORIES_CONTENT,
        )

        results = validate_workitem(tmp_path)
        assert results["design.md"].valid is False

    def test_validate_workitem_combines_warnings(
        self, tmp_path: Path,
    ) -> None:
        _write(tmp_path / "design.md", NON_STANDARD_ID_FM + """
## Overview

Content.

## Dependencies

Content.

## Interfaces

Content.

## Technical Approach

Content.

## File Structure

Content.
""")
        _write(tmp_path / "tasks.md", VALID_TASKS_CONTENT)
        _write(
            tmp_path / "user_stories.md",
            VALID_USER_STORIES_CONTENT,
        )

        results = validate_workitem(tmp_path)
        assert results["design.md"].valid is True
        assert len(results["design.md"].warnings) > 0
