"""Result Aggregator for Parallel Review Swarm.

This module provides the ResultAggregator class that merges findings from
multiple specialized reviewers into a unified report, including duplicate
detection and severity-based sorting.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import UTC, datetime
from difflib import SequenceMatcher

from src.workers.swarm.config import SwarmConfig
from src.workers.swarm.models import (
    ReviewerResult,
    ReviewFinding,
    Severity,
    SwarmSession,
    UnifiedReport,
)


class ResultAggregator:
    """Aggregates review results from multiple specialized reviewers.

    Combines findings from all reviewers into a unified report, detecting
    and merging duplicate findings, sorting by severity, and generating
    summary statistics.

    Attributes:
        _config: Swarm configuration settings.

    Example:
        >>> aggregator = ResultAggregator(config)
        >>> report = aggregator.aggregate(session, results)
        >>> print(f"Total findings: {report.total_findings}")
    """

    def __init__(self, config: SwarmConfig) -> None:
        """Initialize the ResultAggregator.

        Args:
            config: Swarm configuration settings, including duplicate
                similarity threshold.
        """
        self._config = config

    def aggregate(
        self,
        session: SwarmSession,
        results: dict[str, ReviewerResult],
    ) -> UnifiedReport:
        """Merge findings from all reviewers into unified report.

        Collects all findings from successful reviewers, detects and merges
        duplicates, sorts by severity, and generates summary statistics.

        Args:
            session: The swarm session being aggregated.
            results: Dictionary mapping reviewer_type to ReviewerResult.

        Returns:
            UnifiedReport containing all aggregated findings and statistics.
        """
        all_findings: list[ReviewFinding] = []
        reviewers_completed: list[str] = []
        reviewers_failed: list[str] = []

        # Collect findings and track reviewer status
        for reviewer_type, result in results.items():
            if result.status == "success":
                reviewers_completed.append(reviewer_type)
                all_findings.extend(result.findings)
            else:
                reviewers_failed.append(reviewer_type)

        # Detect and remove duplicates
        unique_findings, duplicates_removed = self._detect_duplicates(all_findings)

        # Sort findings by severity
        severity_order = {
            Severity.CRITICAL: 0,
            Severity.HIGH: 1,
            Severity.MEDIUM: 2,
            Severity.LOW: 3,
            Severity.INFO: 4,
        }
        unique_findings.sort(key=lambda f: severity_order.get(f.severity, 5))

        # Group by severity
        critical = [f for f in unique_findings if f.severity == Severity.CRITICAL]
        high = [f for f in unique_findings if f.severity == Severity.HIGH]
        medium = [f for f in unique_findings if f.severity == Severity.MEDIUM]
        low = [f for f in unique_findings if f.severity == Severity.LOW]
        info = [f for f in unique_findings if f.severity == Severity.INFO]

        # Generate statistics
        findings_by_reviewer: dict[str, int] = defaultdict(int)
        findings_by_category: dict[str, int] = defaultdict(int)
        for finding in unique_findings:
            # Handle merged findings with multiple reviewers
            for reviewer in finding.reviewer_type.split(", "):
                findings_by_reviewer[reviewer] += 1
            findings_by_category[finding.category] += 1

        return UnifiedReport(
            swarm_id=session.id,
            target_path=session.target_path,
            created_at=datetime.now(UTC),
            reviewers_completed=reviewers_completed,
            reviewers_failed=reviewers_failed,
            critical_findings=critical,
            high_findings=high,
            medium_findings=medium,
            low_findings=low,
            info_findings=info,
            total_findings=len(unique_findings),
            findings_by_reviewer=dict(findings_by_reviewer),
            findings_by_category=dict(findings_by_category),
            duplicates_removed=duplicates_removed,
        )

    def _text_similarity(self, text1: str, text2: str) -> float:
        """Calculate text similarity ratio between two strings.

        Uses SequenceMatcher for computing similarity, which returns a
        value between 0.0 (completely different) and 1.0 (identical).

        Args:
            text1: First text string to compare.
            text2: Second text string to compare.

        Returns:
            Similarity ratio between 0.0 and 1.0.
        """
        return SequenceMatcher(None, text1.lower(), text2.lower()).ratio()

    def _lines_overlap(
        self,
        start1: int | None,
        end1: int | None,
        start2: int | None,
        end2: int | None,
    ) -> bool:
        """Check if two line ranges overlap.

        Handles None values for start/end gracefully. If end is None,
        treats it as a single-line range (end = start).

        Args:
            start1: Starting line of first range.
            end1: Ending line of first range (or None for single line).
            start2: Starting line of second range.
            end2: Ending line of second range (or None for single line).

        Returns:
            True if the ranges overlap, False otherwise.
        """
        if start1 is None or start2 is None:
            return False

        e1 = end1 if end1 is not None else start1
        e2 = end2 if end2 is not None else start2

        return not (e1 < start2 or e2 < start1)

    def _is_duplicate(self, f1: ReviewFinding, f2: ReviewFinding) -> bool:
        """Check if two findings are duplicates.

        Duplicates are detected by matching:
        - Same file path
        - Overlapping line ranges
        - Similar category (matching root category)
        - High text similarity in title (above threshold)

        Args:
            f1: First finding to compare.
            f2: Second finding to compare.

        Returns:
            True if findings are duplicates, False otherwise.
        """
        # Different files cannot be duplicates
        if f1.file_path != f2.file_path:
            return False

        # Non-overlapping lines cannot be duplicates
        if not self._lines_overlap(f1.line_start, f1.line_end, f2.line_start, f2.line_end):
            return False

        # Check category similarity (compare root category)
        if f1.category and f2.category:
            cat1_root = f1.category.split("/")[0]
            cat2_root = f2.category.split("/")[0]
            if cat1_root != cat2_root:
                return False

        # Check title similarity
        title_similarity = self._text_similarity(f1.title, f2.title)
        return title_similarity >= self._config.duplicate_similarity_threshold

    def _merge_findings(
        self, f1: ReviewFinding, f2: ReviewFinding
    ) -> ReviewFinding:
        """Merge two duplicate findings into one.

        Keeps the higher severity, combines reviewer types, keeps higher
        confidence, and combines descriptions.

        Args:
            f1: First finding to merge.
            f2: Second finding to merge.

        Returns:
            A new ReviewFinding that merges information from both inputs.
        """
        severity_order = {
            Severity.CRITICAL: 0,
            Severity.HIGH: 1,
            Severity.MEDIUM: 2,
            Severity.LOW: 3,
            Severity.INFO: 4,
        }

        # Pick the one with higher severity as base
        if severity_order.get(f1.severity, 5) <= severity_order.get(f2.severity, 5):
            base, other = f1, f2
        else:
            base, other = f2, f1

        # Combine reviewer types
        reviewers = set(base.reviewer_type.split(", "))
        reviewers.update(other.reviewer_type.split(", "))

        # Expand line range to cover both
        line_start = min(
            f1.line_start if f1.line_start else 0,
            f2.line_start if f2.line_start else 0,
        )
        if line_start == 0:
            line_start = f1.line_start or f2.line_start

        line_end_1 = f1.line_end if f1.line_end else 0
        line_end_2 = f2.line_end if f2.line_end else 0
        line_end = max(line_end_1, line_end_2) if (line_end_1 or line_end_2) else None

        return ReviewFinding(
            id=base.id,
            reviewer_type=", ".join(sorted(reviewers)),
            severity=base.severity,
            category=base.category,
            title=base.title,
            description=f"{base.description}\n\n---\n\n{other.description}",
            file_path=base.file_path,
            line_start=line_start,
            line_end=line_end,
            code_snippet=base.code_snippet,
            recommendation=base.recommendation,
            confidence=max(base.confidence, other.confidence),
        )

    def _detect_duplicates(
        self,
        findings: list[ReviewFinding],
    ) -> tuple[list[ReviewFinding], int]:
        """Identify and merge duplicate findings.

        Iterates through findings, comparing each against already-seen
        unique findings, merging duplicates when found.

        Args:
            findings: List of findings to deduplicate.

        Returns:
            Tuple of (unique_findings, duplicates_removed_count).
        """
        if not findings:
            return [], 0

        unique: list[ReviewFinding] = []
        removed = 0

        for finding in findings:
            merged = False
            for i, existing in enumerate(unique):
                if self._is_duplicate(finding, existing):
                    unique[i] = self._merge_findings(existing, finding)
                    removed += 1
                    merged = True
                    break
            if not merged:
                unique.append(finding)

        return unique, removed
