"""Tests for cross-layer alignment checking."""

from __future__ import annotations

from pathlib import Path

import pytest

from src.core.spec_validation.alignment import (
    _extract_keywords,
    _extract_story_ids,
    _extract_task_ids,
    check_design_to_tasks,
    check_full_alignment,
    check_prd_to_design,
    check_tasks_to_stories,
)
from src.core.spec_validation.models import AlignmentResult

# -- Helpers ----------------------------------------------------------------

DESIGN_FM = """\
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

TASKS_FM = """\
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

STORIES_FM = """\
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

PRD_FM = """\
---
id: P01-F02
parent_id: P01
type: prd
version: 1
status: draft
created_by: planner
created_at: "2026-01-01T00:00:00Z"
updated_at: "2026-01-01T00:00:00Z"
---
"""


def _write(path: Path, content: str) -> Path:
    """Write content to path and return it."""
    path.write_text(content, encoding="utf-8")
    return path


# -- _extract_keywords tests ------------------------------------------------


class TestExtractKeywords:
    """Tests for the _extract_keywords helper."""

    def test_extract_keywords_filters_stop_words(self) -> None:
        keywords = _extract_keywords(
            "the quick brown fox and the lazy dog"
        )
        assert "the" not in keywords
        assert "and" not in keywords
        assert "quick" in keywords
        assert "brown" in keywords
        assert "lazy" in keywords

    def test_extract_keywords_lowercases(self) -> None:
        keywords = _extract_keywords("Redis Elasticsearch")
        assert "redis" in keywords
        assert "elasticsearch" in keywords

    def test_extract_keywords_filters_short_words(self) -> None:
        keywords = _extract_keywords("a to is in on at")
        # All words <= 2 chars should be excluded
        assert len(keywords) == 0

    def test_extract_keywords_extracts_underscore_words(self) -> None:
        keywords = _extract_keywords("task_id user_name")
        assert "task_id" in keywords
        assert "user_name" in keywords

    def test_extract_keywords_empty_input(self) -> None:
        keywords = _extract_keywords("")
        assert keywords == set()


# -- _extract_task_ids / _extract_story_ids tests --------------------------


class TestExtractIds:
    """Tests for task and story ID extraction."""

    def test_extract_task_ids(self) -> None:
        content = "### T01: First task\n### T02: Second task\n"
        ids = _extract_task_ids(content)
        assert ids == ["T01", "T02"]

    def test_extract_task_ids_empty(self) -> None:
        ids = _extract_task_ids("No tasks here.")
        assert ids == []

    def test_extract_story_ids(self) -> None:
        content = "## US-01: First story\n## US-02: Second story\n"
        ids = _extract_story_ids(content)
        assert ids == ["US-01", "US-02"]

    def test_extract_story_ids_empty(self) -> None:
        ids = _extract_story_ids("No stories here.")
        assert ids == []


# -- check_design_to_tasks tests -------------------------------------------


class TestCheckDesignToTasks:
    """Tests for design-to-tasks alignment checking."""

    def test_check_design_to_tasks_matching_content(
        self, tmp_path: Path,
    ) -> None:
        _write(tmp_path / "design.md", DESIGN_FM + """
## Overview

High-level architecture overview.

## Dependencies

Redis and Elasticsearch dependencies.

## Interfaces

REST API interface definitions.
""")
        _write(tmp_path / "tasks.md", TASKS_FM + """
## Progress

0%

## Task List

### T01: Setup overview architecture
Set up the architecture overview component.

### T02: Configure dependencies
Configure redis and elasticsearch dependencies.

### T03: Define interfaces
Define the REST API interfaces.

## Completion Checklist

- [ ] Done
""")
        result = check_design_to_tasks(tmp_path)
        assert isinstance(result, AlignmentResult)
        assert result.coverage > 0.0
        assert result.source_layer == "design"
        assert result.target_layer == "tasks"

    def test_check_design_to_tasks_returns_zero_for_missing_files(
        self, tmp_path: Path,
    ) -> None:
        result = check_design_to_tasks(tmp_path)
        assert result.coverage == 0.0
        assert result.passed is False
        assert len(result.unmatched_items) > 0

    def test_check_design_to_tasks_skips_excluded_sections(
        self, tmp_path: Path,
    ) -> None:
        _write(tmp_path / "design.md", DESIGN_FM + """
## Overview

Content.

## Open Questions

Some questions.

## Risks

Some risks.
""")
        _write(tmp_path / "tasks.md", TASKS_FM + """
## Progress

0%

## Task List

### T01: Implement overview
Overview implementation.

## Completion Checklist

- [ ] Done
""")
        result = check_design_to_tasks(tmp_path)
        # Open Questions and Risks are excluded from design items
        assert "Open Questions" not in result.unmatched_items
        assert "Risks" not in result.unmatched_items

    def test_check_design_to_tasks_empty_design_sections(
        self, tmp_path: Path,
    ) -> None:
        _write(tmp_path / "design.md", DESIGN_FM + "\nJust body text.\n")
        _write(tmp_path / "tasks.md", TASKS_FM + "\n## Task List\n\n")
        result = check_design_to_tasks(tmp_path)
        # No design sections means full coverage by default
        assert result.coverage == 1.0

    def test_check_design_to_tasks_custom_threshold(
        self, tmp_path: Path,
    ) -> None:
        _write(tmp_path / "design.md", DESIGN_FM + """
## Validation Logic

Validation content.

## Serialization Protocol

Serialization content.
""")
        _write(tmp_path / "tasks.md", TASKS_FM + """
## Progress

0%

## Task List

### T01: Implement validation logic
Validation work.

## Completion Checklist

- [ ] Done
""")
        result = check_design_to_tasks(tmp_path, threshold=0.5)
        assert result.threshold == 0.5
        # One of two matched, so 0.5 coverage
        assert result.coverage == 0.5
        assert result.passed is True


# -- check_tasks_to_stories tests ------------------------------------------


class TestCheckTasksToStories:
    """Tests for tasks-to-stories alignment checking."""

    def test_check_tasks_to_stories_matching_keywords(
        self, tmp_path: Path,
    ) -> None:
        _write(tmp_path / "user_stories.md", STORIES_FM + """
## US-01: User can validate specs

As a developer I want to validate spec files.

### Acceptance Criteria

- Spec files are validated.

### Test Scenarios

- Test validation.
""")
        _write(tmp_path / "tasks.md", TASKS_FM + """
## Progress

0%

## Task List

### T01: Implement spec validation
Build the validation logic for spec files.

## Completion Checklist

- [ ] Done
""")
        result = check_tasks_to_stories(tmp_path)
        assert isinstance(result, AlignmentResult)
        assert result.source_layer == "tasks"
        assert result.target_layer == "user_stories"
        assert result.coverage > 0.0

    def test_check_tasks_to_stories_returns_zero_for_missing_files(
        self, tmp_path: Path,
    ) -> None:
        result = check_tasks_to_stories(tmp_path)
        assert result.coverage == 0.0
        assert result.passed is False

    def test_check_tasks_to_stories_no_story_ids(
        self, tmp_path: Path,
    ) -> None:
        _write(tmp_path / "user_stories.md", STORIES_FM + """
## Introduction

No US- sections here.
""")
        _write(tmp_path / "tasks.md", TASKS_FM + """
## Task List

Tasks here.
""")
        result = check_tasks_to_stories(tmp_path)
        # No story IDs means full coverage by default
        assert result.coverage == 1.0


# -- check_prd_to_design tests ---------------------------------------------


class TestCheckPrdToDesign:
    """Tests for PRD-to-design alignment checking."""

    def test_check_prd_to_design_matching_content(
        self, tmp_path: Path,
    ) -> None:
        _write(tmp_path / "prd.md", PRD_FM + """
## Business Intent

Provide automated spec validation for work items.

## Scope

- Validate front-matter in spec files
- Check section structure

## Acceptance Criteria

- All spec files should be validated automatically
- Missing sections should produce clear errors
""")
        _write(tmp_path / "design.md", DESIGN_FM + """
## Overview

Automated spec validation system.

## Dependencies

PyYAML for front-matter parsing.

## Interfaces

Validator interface for spec files.

## Technical Approach

Parse front-matter, validate sections, report errors.

## File Structure

src/core/spec_validation/
""")
        result = check_prd_to_design(tmp_path)
        assert isinstance(result, AlignmentResult)
        assert result.source_layer == "prd"
        assert result.target_layer == "design"
        assert result.coverage > 0.0

    def test_check_prd_to_design_returns_zero_for_missing_files(
        self, tmp_path: Path,
    ) -> None:
        result = check_prd_to_design(tmp_path)
        assert result.coverage == 0.0
        assert result.passed is False


# -- check_full_alignment tests --------------------------------------------


class TestCheckFullAlignment:
    """Tests for the full alignment check suite."""

    def test_check_full_alignment_returns_list(
        self, tmp_path: Path,
    ) -> None:
        _write(tmp_path / "design.md", DESIGN_FM + """
## Overview

Content.
""")
        _write(tmp_path / "tasks.md", TASKS_FM + """
## Task List

Tasks.
""")
        _write(tmp_path / "user_stories.md", STORIES_FM + """
## US-01: Story

Story body.

### Acceptance Criteria

- Criteria.

### Test Scenarios

- Scenario.
""")
        results = check_full_alignment(tmp_path)
        assert isinstance(results, list)
        assert len(results) >= 2  # design->tasks and tasks->stories
        assert all(isinstance(r, AlignmentResult) for r in results)

    def test_check_full_alignment_includes_prd_when_present(
        self, tmp_path: Path,
    ) -> None:
        _write(tmp_path / "prd.md", PRD_FM + """
## Business Intent

Build spec validation.

## Scope

- Validate specs
""")
        _write(tmp_path / "design.md", DESIGN_FM + """
## Overview

Spec validation design.
""")
        _write(tmp_path / "tasks.md", TASKS_FM + """
## Task List

Tasks.
""")
        _write(tmp_path / "user_stories.md", STORIES_FM + """
## US-01: Story

Body.

### Acceptance Criteria

- Criteria.

### Test Scenarios

- Scenario.
""")
        results = check_full_alignment(tmp_path)
        assert len(results) == 3  # prd->design, design->tasks, tasks->stories
        layers = [(r.source_layer, r.target_layer) for r in results]
        assert ("prd", "design") in layers

    def test_check_full_alignment_excludes_prd_when_absent(
        self, tmp_path: Path,
    ) -> None:
        _write(tmp_path / "design.md", DESIGN_FM + "\n## Overview\n\n")
        _write(tmp_path / "tasks.md", TASKS_FM + "\n## Task List\n\n")
        _write(
            tmp_path / "user_stories.md",
            STORIES_FM + "\n## US-01: Story\n\nBody.\n"
            "\n### Acceptance Criteria\n\n- C.\n"
            "\n### Test Scenarios\n\n- T.\n",
        )
        results = check_full_alignment(tmp_path)
        layers = [(r.source_layer, r.target_layer) for r in results]
        assert ("prd", "design") not in layers

    def test_check_full_alignment_custom_threshold(
        self, tmp_path: Path,
    ) -> None:
        _write(tmp_path / "design.md", DESIGN_FM + "\n## Overview\n\n")
        _write(tmp_path / "tasks.md", TASKS_FM + "\n## Task List\n\n")
        _write(
            tmp_path / "user_stories.md",
            STORIES_FM + "\n## US-01: Story\n\nBody.\n"
            "\n### Acceptance Criteria\n\n- C.\n"
            "\n### Test Scenarios\n\n- T.\n",
        )
        results = check_full_alignment(tmp_path, threshold=0.5)
        for result in results:
            assert result.threshold == 0.5


# -- AlignmentResult.passed property tests ---------------------------------


class TestAlignmentResultPassed:
    """Tests ensuring AlignmentResult.passed respects the threshold."""

    def test_passed_with_low_threshold(self) -> None:
        result = AlignmentResult(
            source_layer="a",
            target_layer="b",
            coverage=0.3,
            threshold=0.2,
        )
        assert result.passed is True

    def test_passed_with_high_threshold(self) -> None:
        result = AlignmentResult(
            source_layer="a",
            target_layer="b",
            coverage=0.9,
            threshold=0.95,
        )
        assert result.passed is False

    def test_passed_exact_threshold(self) -> None:
        result = AlignmentResult(
            source_layer="a",
            target_layer="b",
            coverage=0.5,
            threshold=0.5,
        )
        assert result.passed is True
