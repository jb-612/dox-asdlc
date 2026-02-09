"""Cross-layer alignment checker for work item spec files."""

from __future__ import annotations

import re
from pathlib import Path

from src.core.spec_validation.models import AlignmentResult
from src.core.spec_validation.parser import extract_body, extract_sections


def _extract_keywords(text: str) -> set[str]:
    """Extract significant keywords from text for matching.

    Lowercases text, removes common stop words, and keeps words
    with 3 or more characters.

    Args:
        text: Input text to extract keywords from.

    Returns:
        Set of significant lowercase keywords.
    """
    stop_words = {
        "the", "and", "for", "are", "but", "not", "you", "all",
        "can", "had", "her", "was", "one", "our", "out", "has",
        "this", "that", "with", "from", "they", "been", "have",
        "will", "each", "make", "like", "when", "what", "how",
        "should", "must", "into", "than", "them", "then", "also",
        "none", "some", "such", "more", "other", "only", "does",
    }
    words = set(re.findall(r"[a-z][a-z0-9_]{2,}", text.lower()))
    return words - stop_words


def _extract_task_ids(content: str) -> list[str]:
    """Extract task IDs (T01, T02, etc.) from content.

    Args:
        content: Markdown content to search.

    Returns:
        List of task ID strings found.
    """
    return re.findall(r"###\s+(T\d{2}):", content)


def _extract_story_ids(content: str) -> list[str]:
    """Extract user story IDs (US-01, US-02, etc.) from content.

    Args:
        content: Markdown content to search.

    Returns:
        List of story ID strings found.
    """
    return re.findall(r"##\s+(US-\d{2}):", content)


def check_design_to_tasks(
    workitem_dir: str | Path,
    threshold: float = 0.8,
) -> AlignmentResult:
    """Verify tasks.md covers design.md components.

    Strategy: Extract component/interface names from design.md section
    headings, then check each has at least one matching keyword in
    tasks.md.

    Args:
        workitem_dir: Path to the work item directory.
        threshold: Minimum coverage ratio required to pass.

    Returns:
        AlignmentResult with coverage and match details.
    """
    workitem_path = Path(workitem_dir)
    design_path = workitem_path / "design.md"
    tasks_path = workitem_path / "tasks.md"

    if not design_path.exists() or not tasks_path.exists():
        return AlignmentResult(
            source_layer="design",
            target_layer="tasks",
            coverage=0.0,
            unmatched_items=("design.md or tasks.md not found",),
            threshold=threshold,
        )

    design_sections = extract_sections(design_path)
    tasks_body = extract_body(tasks_path)
    tasks_keywords = _extract_keywords(tasks_body)

    # Extract key design concepts from section headings
    design_items: list[str] = []
    for heading in design_sections:
        if heading in ("Open Questions", "Risks", "Architecture Decisions"):
            continue
        design_items.append(heading)

    if not design_items:
        return AlignmentResult(
            source_layer="design",
            target_layer="tasks",
            coverage=1.0,
            threshold=threshold,
        )

    matched: list[str] = []
    unmatched: list[str] = []
    for item in design_items:
        item_keywords = _extract_keywords(item)
        if item_keywords & tasks_keywords:
            matched.append(item)
        else:
            unmatched.append(item)

    coverage = len(matched) / len(design_items) if design_items else 1.0

    return AlignmentResult(
        source_layer="design",
        target_layer="tasks",
        coverage=coverage,
        matched_items=tuple(matched),
        unmatched_items=tuple(unmatched),
        threshold=threshold,
    )


def check_tasks_to_stories(
    workitem_dir: str | Path,
    threshold: float = 0.8,
) -> AlignmentResult:
    """Verify tasks reference user stories and stories have tasks.

    Strategy: Check keyword overlap between task descriptions and
    story descriptions.

    Args:
        workitem_dir: Path to the work item directory.
        threshold: Minimum coverage ratio required to pass.

    Returns:
        AlignmentResult with coverage and match details.
    """
    workitem_path = Path(workitem_dir)
    stories_path = workitem_path / "user_stories.md"
    tasks_path = workitem_path / "tasks.md"

    if not stories_path.exists() or not tasks_path.exists():
        return AlignmentResult(
            source_layer="tasks",
            target_layer="user_stories",
            coverage=0.0,
            unmatched_items=(
                "user_stories.md or tasks.md not found",
            ),
            threshold=threshold,
        )

    story_ids = _extract_story_ids(
        stories_path.read_text(encoding="utf-8")
    )
    tasks_body = extract_body(tasks_path)

    if not story_ids:
        return AlignmentResult(
            source_layer="tasks",
            target_layer="user_stories",
            coverage=1.0,
            threshold=threshold,
        )

    # Check: each story should have keyword overlap with tasks
    stories_sections = extract_sections(stories_path)
    tasks_keywords = _extract_keywords(tasks_body)

    matched: list[str] = []
    unmatched: list[str] = []
    for story_heading, story_body in stories_sections.items():
        if not story_heading.startswith("US-"):
            continue
        story_keywords = _extract_keywords(
            story_heading + " " + story_body
        )
        if story_keywords & tasks_keywords:
            matched.append(story_heading)
        else:
            unmatched.append(story_heading)

    total = len(matched) + len(unmatched)
    coverage = len(matched) / total if total else 1.0

    return AlignmentResult(
        source_layer="tasks",
        target_layer="user_stories",
        coverage=coverage,
        matched_items=tuple(matched),
        unmatched_items=tuple(unmatched),
        threshold=threshold,
    )


def check_prd_to_design(
    workitem_dir: str | Path,
    threshold: float = 0.8,
) -> AlignmentResult:
    """Verify design.md addresses PRD requirements.

    Strategy: Extract acceptance criteria and scope items from prd.md,
    check keyword overlap with design.md.

    Args:
        workitem_dir: Path to the work item directory.
        threshold: Minimum coverage ratio required to pass.

    Returns:
        AlignmentResult with coverage and match details.
    """
    workitem_path = Path(workitem_dir)
    prd_path = workitem_path / "prd.md"
    design_path = workitem_path / "design.md"

    if not prd_path.exists() or not design_path.exists():
        return AlignmentResult(
            source_layer="prd",
            target_layer="design",
            coverage=0.0,
            unmatched_items=("prd.md or design.md not found",),
            threshold=threshold,
        )

    prd_sections = extract_sections(prd_path)
    design_body = extract_body(design_path)
    design_keywords = _extract_keywords(design_body)

    # Extract key items from PRD scope and acceptance criteria
    prd_items: list[str] = []
    for section_name in (
        "Acceptance Criteria", "Scope",
        "Business Intent", "Success Metrics",
    ):
        if section_name in prd_sections:
            lines = prd_sections[section_name].split("\n")
            for line in lines:
                line = line.strip().lstrip("- *")
                if len(line) > 10:  # Skip very short lines
                    prd_items.append(line)

    if not prd_items:
        return AlignmentResult(
            source_layer="prd",
            target_layer="design",
            coverage=1.0,
            threshold=threshold,
        )

    matched: list[str] = []
    unmatched: list[str] = []
    for item in prd_items:
        item_keywords = _extract_keywords(item)
        if item_keywords & design_keywords:
            matched.append(item[:60])  # Truncate for readability
        else:
            unmatched.append(item[:60])

    coverage = len(matched) / len(prd_items) if prd_items else 1.0

    return AlignmentResult(
        source_layer="prd",
        target_layer="design",
        coverage=coverage,
        matched_items=tuple(matched),
        unmatched_items=tuple(unmatched),
        threshold=threshold,
    )


def check_full_alignment(
    workitem_dir: str | Path,
    threshold: float = 0.8,
) -> list[AlignmentResult]:
    """Run all alignment checks on a work item directory.

    Args:
        workitem_dir: Path to the work item directory.
        threshold: Minimum coverage ratio for all checks.

    Returns:
        List of AlignmentResult instances for each check performed.
    """
    results: list[AlignmentResult] = []

    # Only include PRD alignment if prd.md exists
    prd_path = Path(workitem_dir) / "prd.md"
    if prd_path.exists():
        results.append(check_prd_to_design(workitem_dir, threshold))

    results.append(check_design_to_tasks(workitem_dir, threshold))
    results.append(check_tasks_to_stories(workitem_dir, threshold))

    return results
