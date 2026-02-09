"""Tests for spec file front-matter parsing and section extraction."""

from __future__ import annotations

from pathlib import Path

import pytest

from src.core.spec_validation.models import SpecMetadata, SpecStatus, SpecType
from src.core.spec_validation.parser import (
    extract_body,
    extract_sections,
    parse_frontmatter,
)

# -- Fixtures / Helpers -------------------------------------------------------

VALID_FRONTMATTER = """\
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

## Overview

This is the overview section.

## Dependencies

- Redis
- Elasticsearch
"""

FRONTMATTER_WITH_OPTIONALS = """\
---
id: P02-F01
parent_id: P02
type: tasks
version: 3
status: reviewed
created_by: backend
created_at: "2026-01-10T00:00:00Z"
updated_at: "2026-01-12T00:00:00Z"
constraints_hash: sha256abc
dependencies:
  - P02-F00
  - P01-F01
tags:
  - infra
  - redis
---

## Progress

50%
"""

NO_FRONTMATTER = """\
## Overview

Just a plain markdown file with no front-matter.
"""

INVALID_TYPE_FRONTMATTER = """\
---
id: P01-F02
parent_id: P01
type: unknown_type
version: 1
status: draft
created_by: planner
created_at: "2026-01-01T00:00:00Z"
updated_at: "2026-01-01T00:00:00Z"
---

Body content.
"""

INVALID_STATUS_FRONTMATTER = """\
---
id: P01-F02
parent_id: P01
type: design
version: 1
status: invalid_status
created_by: planner
created_at: "2026-01-01T00:00:00Z"
updated_at: "2026-01-01T00:00:00Z"
---

Body content.
"""

MISSING_FIELDS_FRONTMATTER = """\
---
id: P01-F02
type: design
---

Body content.
"""

INVALID_VERSION_FRONTMATTER = """\
---
id: P01-F02
parent_id: P01
type: design
version: 0
status: draft
created_by: planner
created_at: "2026-01-01T00:00:00Z"
updated_at: "2026-01-01T00:00:00Z"
---

Body content.
"""

INVALID_VERSION_STRING_FRONTMATTER = """\
---
id: P01-F02
parent_id: P01
type: design
version: "abc"
status: draft
created_by: planner
created_at: "2026-01-01T00:00:00Z"
updated_at: "2026-01-01T00:00:00Z"
---

Body content.
"""

NON_MAPPING_FRONTMATTER = """\
---
- just
- a
- list
---

Body content.
"""

MULTI_SECTION_CONTENT = """\
---
id: P01-F01
parent_id: P01
type: design
version: 1
status: draft
created_by: planner
created_at: "2026-01-01T00:00:00Z"
updated_at: "2026-01-01T00:00:00Z"
---

# Title (H1 ignored)

## Overview

Overview body text here.
Multiple lines.

## Dependencies

- Redis
- Elasticsearch

## Interfaces

Interface definitions.
"""


def _write(tmp_path: Path, content: str, name: str = "test.md") -> Path:
    """Write content to a temporary file and return its path."""
    fp = tmp_path / name
    fp.write_text(content, encoding="utf-8")
    return fp


# -- parse_frontmatter tests -----------------------------------------------


class TestParseFrontmatter:
    """Tests for the parse_frontmatter function."""

    def test_parse_valid_frontmatter_returns_metadata(
        self, tmp_path: Path,
    ) -> None:
        fp = _write(tmp_path, VALID_FRONTMATTER)
        meta = parse_frontmatter(fp)
        assert meta is not None
        assert isinstance(meta, SpecMetadata)
        assert meta.id == "P01-F02"
        assert meta.parent_id == "P01"
        assert meta.type == SpecType.DESIGN
        assert meta.version == 1
        assert meta.status == SpecStatus.DRAFT
        assert meta.created_by == "planner"

    def test_parse_frontmatter_with_optionals(
        self, tmp_path: Path,
    ) -> None:
        fp = _write(tmp_path, FRONTMATTER_WITH_OPTIONALS)
        meta = parse_frontmatter(fp)
        assert meta is not None
        assert meta.constraints_hash == "sha256abc"
        assert meta.dependencies == ("P02-F00", "P01-F01")
        assert meta.tags == ("infra", "redis")
        assert meta.version == 3
        assert meta.status == SpecStatus.REVIEWED

    def test_parse_frontmatter_returns_none_when_no_frontmatter(
        self, tmp_path: Path,
    ) -> None:
        fp = _write(tmp_path, NO_FRONTMATTER)
        result = parse_frontmatter(fp)
        assert result is None

    def test_parse_frontmatter_raises_for_missing_required_fields(
        self, tmp_path: Path,
    ) -> None:
        fp = _write(tmp_path, MISSING_FIELDS_FRONTMATTER)
        with pytest.raises(ValueError, match="Missing required"):
            parse_frontmatter(fp)

    def test_parse_frontmatter_raises_for_invalid_type(
        self, tmp_path: Path,
    ) -> None:
        fp = _write(tmp_path, INVALID_TYPE_FRONTMATTER)
        with pytest.raises(ValueError, match="Invalid spec type"):
            parse_frontmatter(fp)

    def test_parse_frontmatter_raises_for_invalid_status(
        self, tmp_path: Path,
    ) -> None:
        fp = _write(tmp_path, INVALID_STATUS_FRONTMATTER)
        with pytest.raises(ValueError, match="Invalid spec status"):
            parse_frontmatter(fp)

    def test_parse_frontmatter_raises_for_version_zero(
        self, tmp_path: Path,
    ) -> None:
        fp = _write(tmp_path, INVALID_VERSION_FRONTMATTER)
        with pytest.raises(ValueError, match="Version must be integer"):
            parse_frontmatter(fp)

    def test_parse_frontmatter_raises_for_non_integer_version(
        self, tmp_path: Path,
    ) -> None:
        fp = _write(tmp_path, INVALID_VERSION_STRING_FRONTMATTER)
        with pytest.raises(ValueError, match="Version must be integer"):
            parse_frontmatter(fp)

    def test_parse_frontmatter_raises_for_non_mapping(
        self, tmp_path: Path,
    ) -> None:
        fp = _write(tmp_path, NON_MAPPING_FRONTMATTER)
        with pytest.raises(ValueError, match="YAML mapping"):
            parse_frontmatter(fp)

    def test_parse_frontmatter_accepts_string_path(
        self, tmp_path: Path,
    ) -> None:
        fp = _write(tmp_path, VALID_FRONTMATTER)
        meta = parse_frontmatter(str(fp))
        assert meta is not None
        assert meta.id == "P01-F02"


# -- extract_sections tests ------------------------------------------------


class TestExtractSections:
    """Tests for the extract_sections function."""

    def test_extract_sections_parses_headings(
        self, tmp_path: Path,
    ) -> None:
        fp = _write(tmp_path, MULTI_SECTION_CONTENT)
        sections = extract_sections(fp)
        assert "Overview" in sections
        assert "Dependencies" in sections
        assert "Interfaces" in sections
        assert len(sections) == 3

    def test_extract_sections_strips_frontmatter(
        self, tmp_path: Path,
    ) -> None:
        fp = _write(tmp_path, MULTI_SECTION_CONTENT)
        sections = extract_sections(fp)
        # Front-matter fields should not appear in section content
        for body in sections.values():
            assert "parent_id" not in body
            assert "created_by" not in body

    def test_extract_sections_body_content(
        self, tmp_path: Path,
    ) -> None:
        fp = _write(tmp_path, MULTI_SECTION_CONTENT)
        sections = extract_sections(fp)
        assert "Overview body text" in sections["Overview"]
        assert "Redis" in sections["Dependencies"]

    def test_extract_sections_no_sections(
        self, tmp_path: Path,
    ) -> None:
        content = "Just plain text with no headings.\n"
        fp = _write(tmp_path, content)
        sections = extract_sections(fp)
        assert sections == {}

    def test_extract_sections_ignores_h1_headings(
        self, tmp_path: Path,
    ) -> None:
        content = "# H1 Heading\n\nSome text.\n"
        fp = _write(tmp_path, content)
        sections = extract_sections(fp)
        assert "H1 Heading" not in sections

    def test_extract_sections_without_frontmatter(
        self, tmp_path: Path,
    ) -> None:
        content = "## Section A\n\nBody A.\n\n## Section B\n\nBody B.\n"
        fp = _write(tmp_path, content)
        sections = extract_sections(fp)
        assert "Section A" in sections
        assert "Section B" in sections
        assert sections["Section A"] == "Body A."
        assert sections["Section B"] == "Body B."


# -- extract_body tests ----------------------------------------------------


class TestExtractBody:
    """Tests for the extract_body function."""

    def test_extract_body_returns_content_after_frontmatter(
        self, tmp_path: Path,
    ) -> None:
        fp = _write(tmp_path, VALID_FRONTMATTER)
        body = extract_body(fp)
        assert body.startswith("## Overview")
        assert "parent_id" not in body

    def test_extract_body_returns_full_content_without_frontmatter(
        self, tmp_path: Path,
    ) -> None:
        fp = _write(tmp_path, NO_FRONTMATTER)
        body = extract_body(fp)
        assert body.startswith("## Overview")

    def test_extract_body_is_stripped(
        self, tmp_path: Path,
    ) -> None:
        content = "---\nid: test\n---\n\n  \n\nBody text.\n\n  \n"
        fp = _write(tmp_path, content)
        body = extract_body(fp)
        assert not body.startswith("\n")
        assert not body.endswith("\n")
