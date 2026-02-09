"""Front-matter parsing and section extraction for spec files."""

from __future__ import annotations

import re
from pathlib import Path

import yaml

from src.core.spec_validation.models import SpecMetadata, SpecStatus, SpecType


# Regex for YAML front-matter block (--- ... ---)
_FRONTMATTER_RE = re.compile(
    r"\A---\s*\n(.*?)\n---\s*\n",
    re.DOTALL,
)


def parse_frontmatter(file_path: str | Path) -> SpecMetadata | None:
    """Parse YAML front-matter from a spec file.

    Args:
        file_path: Path to the spec file.

    Returns:
        SpecMetadata instance if valid front-matter is found, None otherwise.

    Raises:
        ValueError: If front-matter exists but is malformed or missing
            required fields.
    """
    content = Path(file_path).read_text(encoding="utf-8")
    match = _FRONTMATTER_RE.match(content)
    if not match:
        return None

    raw = yaml.safe_load(match.group(1))
    if not isinstance(raw, dict):
        raise ValueError("Front-matter must be a YAML mapping")

    # Validate required fields
    required = [
        "id", "parent_id", "type", "version",
        "status", "created_by", "created_at", "updated_at",
    ]
    missing = [f for f in required if f not in raw]
    if missing:
        raise ValueError(
            f"Missing required front-matter fields: {', '.join(missing)}"
        )

    # Parse type enum
    try:
        spec_type = SpecType(raw["type"])
    except ValueError:
        raise ValueError(
            f"Invalid spec type: {raw['type']}. "
            f"Must be one of: {[t.value for t in SpecType]}"
        )

    # Parse status enum
    try:
        spec_status = SpecStatus(raw["status"])
    except ValueError:
        raise ValueError(
            f"Invalid spec status: {raw['status']}. "
            f"Must be one of: {[s.value for s in SpecStatus]}"
        )

    version = raw["version"]
    if not isinstance(version, int) or version < 1:
        raise ValueError(f"Version must be integer >= 1, got: {version}")

    deps = raw.get("dependencies") or []
    tags = raw.get("tags") or []

    return SpecMetadata(
        id=str(raw["id"]),
        parent_id=str(raw["parent_id"]),
        type=spec_type,
        version=version,
        status=spec_status,
        created_by=str(raw["created_by"]),
        created_at=str(raw["created_at"]),
        updated_at=str(raw["updated_at"]),
        constraints_hash=raw.get("constraints_hash"),
        dependencies=tuple(str(d) for d in deps),
        tags=tuple(str(t) for t in tags),
    )


def extract_sections(file_path: str | Path) -> dict[str, str]:
    """Extract markdown sections from a file.

    Returns a dict mapping section heading text to its body content.
    Only extracts ``##`` level headings.

    Args:
        file_path: Path to the markdown file.

    Returns:
        Dictionary of heading text to body content.
    """
    content = Path(file_path).read_text(encoding="utf-8")

    # Strip front-matter if present
    fm_match = _FRONTMATTER_RE.match(content)
    if fm_match:
        content = content[fm_match.end():]

    sections: dict[str, str] = {}
    current_heading: str | None = None
    current_lines: list[str] = []

    for line in content.split("\n"):
        heading_match = re.match(r"^##\s+(.+)$", line)
        if heading_match:
            if current_heading is not None:
                sections[current_heading] = "\n".join(current_lines).strip()
            current_heading = heading_match.group(1).strip()
            current_lines = []
        elif current_heading is not None:
            current_lines.append(line)

    if current_heading is not None:
        sections[current_heading] = "\n".join(current_lines).strip()

    return sections


def extract_body(file_path: str | Path) -> str:
    """Extract the body content (everything after front-matter).

    Args:
        file_path: Path to the markdown file.

    Returns:
        Body content as a string, stripped of leading/trailing whitespace.
    """
    content = Path(file_path).read_text(encoding="utf-8")
    fm_match = _FRONTMATTER_RE.match(content)
    if fm_match:
        return content[fm_match.end():].strip()
    return content.strip()
