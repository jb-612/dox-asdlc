"""Unit tests for ResultAggregator.

Tests for result aggregation, duplicate detection, and finding merging
in the swarm result aggregator.
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from src.workers.swarm.aggregator import ResultAggregator
from src.workers.swarm.config import SwarmConfig
from src.workers.swarm.models import (
    ReviewerResult,
    ReviewFinding,
    Severity,
    SwarmSession,
    SwarmStatus,
    UnifiedReport,
)


@pytest.fixture
def config() -> SwarmConfig:
    """Create a test configuration."""
    return SwarmConfig(
        key_prefix="test_swarm",
        duplicate_similarity_threshold=0.8,
    )


@pytest.fixture
def aggregator(config: SwarmConfig) -> ResultAggregator:
    """Create a ResultAggregator instance."""
    return ResultAggregator(config)


@pytest.fixture
def sample_session() -> SwarmSession:
    """Create a sample swarm session for testing."""
    return SwarmSession(
        id="swarm-test123",
        target_path="src/workers/",
        reviewers=["security", "performance", "style"],
        status=SwarmStatus.AGGREGATING,
        created_at=datetime.now(UTC),
    )


def create_finding(
    reviewer_type: str = "security",
    severity: Severity = Severity.MEDIUM,
    category: str = "test/category",
    title: str = "Test Finding",
    file_path: str = "src/test.py",
    line_start: int = 10,
    line_end: int | None = None,
    confidence: float = 0.9,
) -> ReviewFinding:
    """Helper to create a ReviewFinding for tests."""
    return ReviewFinding(
        id=f"finding-{reviewer_type}-{line_start}",
        reviewer_type=reviewer_type,
        severity=severity,
        category=category,
        title=title,
        description=f"Description for {title}",
        file_path=file_path,
        line_start=line_start,
        line_end=line_end,
        code_snippet="code here",
        recommendation="Fix this issue",
        confidence=confidence,
    )


def create_result(
    reviewer_type: str,
    status: str = "success",
    findings: list[ReviewFinding] | None = None,
) -> ReviewerResult:
    """Helper to create a ReviewerResult for tests."""
    return ReviewerResult(
        reviewer_type=reviewer_type,
        status=status,
        findings=findings or [],
        duration_seconds=1.5,
        files_reviewed=["src/test.py"],
        error_message=None if status == "success" else "Error occurred",
    )


class TestResultAggregatorInit:
    """Tests for ResultAggregator initialization."""

    def test_init_with_config(self, config: SwarmConfig) -> None:
        """Test that ResultAggregator initializes correctly."""
        aggregator = ResultAggregator(config)
        assert aggregator._config is config

    def test_init_stores_threshold(self, config: SwarmConfig) -> None:
        """Test that duplicate threshold is accessible from config."""
        aggregator = ResultAggregator(config)
        assert aggregator._config.duplicate_similarity_threshold == 0.8


class TestBasicAggregation:
    """Tests for basic result aggregation (T15)."""

    def test_aggregate_empty_results(
        self, aggregator: ResultAggregator, sample_session: SwarmSession
    ) -> None:
        """Test aggregation with no results produces empty report."""
        results: dict[str, ReviewerResult] = {}
        report = aggregator.aggregate(sample_session, results)

        assert isinstance(report, UnifiedReport)
        assert report.swarm_id == sample_session.id
        assert report.target_path == sample_session.target_path
        assert report.total_findings == 0
        assert len(report.reviewers_completed) == 0
        assert len(report.reviewers_failed) == 0

    def test_aggregate_single_reviewer_success(
        self, aggregator: ResultAggregator, sample_session: SwarmSession
    ) -> None:
        """Test aggregation with single successful reviewer."""
        finding = create_finding(
            reviewer_type="security", severity=Severity.HIGH, line_start=10
        )
        results = {"security": create_result("security", findings=[finding])}

        report = aggregator.aggregate(sample_session, results)

        assert report.total_findings == 1
        assert "security" in report.reviewers_completed
        assert len(report.reviewers_failed) == 0
        assert len(report.high_findings) == 1

    def test_aggregate_single_reviewer_failed(
        self, aggregator: ResultAggregator, sample_session: SwarmSession
    ) -> None:
        """Test aggregation with single failed reviewer."""
        results = {"security": create_result("security", status="failed")}

        report = aggregator.aggregate(sample_session, results)

        assert report.total_findings == 0
        assert len(report.reviewers_completed) == 0
        assert "security" in report.reviewers_failed

    def test_aggregate_multiple_reviewers_mixed(
        self, aggregator: ResultAggregator, sample_session: SwarmSession
    ) -> None:
        """Test aggregation with multiple reviewers, some success some failed."""
        security_finding = create_finding(
            reviewer_type="security", severity=Severity.CRITICAL
        )
        style_finding = create_finding(
            reviewer_type="style", severity=Severity.LOW, line_start=20
        )

        results = {
            "security": create_result("security", findings=[security_finding]),
            "performance": create_result("performance", status="failed"),
            "style": create_result("style", findings=[style_finding]),
        }

        report = aggregator.aggregate(sample_session, results)

        assert report.total_findings == 2
        assert "security" in report.reviewers_completed
        assert "style" in report.reviewers_completed
        assert "performance" in report.reviewers_failed

    def test_aggregate_preserves_findings(
        self, aggregator: ResultAggregator, sample_session: SwarmSession
    ) -> None:
        """Test that all findings are preserved in the report."""
        findings = [
            create_finding(reviewer_type="security", line_start=i)
            for i in range(5)
        ]
        results = {"security": create_result("security", findings=findings)}

        report = aggregator.aggregate(sample_session, results)

        assert report.total_findings == 5


class TestSeveritySorting:
    """Tests for severity-based sorting of findings."""

    def test_findings_sorted_by_severity(
        self, aggregator: ResultAggregator, sample_session: SwarmSession
    ) -> None:
        """Test that findings are sorted by severity (Critical first)."""
        findings = [
            create_finding(severity=Severity.LOW, line_start=1),
            create_finding(severity=Severity.CRITICAL, line_start=2),
            create_finding(severity=Severity.HIGH, line_start=3),
            create_finding(severity=Severity.INFO, line_start=4),
            create_finding(severity=Severity.MEDIUM, line_start=5),
        ]
        results = {"security": create_result("security", findings=findings)}

        report = aggregator.aggregate(sample_session, results)

        # Verify grouping by severity level
        assert len(report.critical_findings) == 1
        assert len(report.high_findings) == 1
        assert len(report.medium_findings) == 1
        assert len(report.low_findings) == 1
        assert len(report.info_findings) == 1

    def test_severity_groups_populated_correctly(
        self, aggregator: ResultAggregator, sample_session: SwarmSession
    ) -> None:
        """Test that severity groups contain correct findings."""
        critical = create_finding(
            severity=Severity.CRITICAL, title="Critical Issue", line_start=1
        )
        high = create_finding(
            severity=Severity.HIGH, title="High Issue", line_start=2
        )

        results = {
            "security": create_result("security", findings=[critical, high])
        }

        report = aggregator.aggregate(sample_session, results)

        assert report.critical_findings[0].title == "Critical Issue"
        assert report.high_findings[0].title == "High Issue"


class TestStatisticsGeneration:
    """Tests for statistics calculation in aggregation."""

    def test_findings_by_reviewer_count(
        self, aggregator: ResultAggregator, sample_session: SwarmSession
    ) -> None:
        """Test that findings_by_reviewer is calculated correctly."""
        security_findings = [
            create_finding(reviewer_type="security", line_start=i)
            for i in range(3)
        ]
        style_findings = [
            create_finding(reviewer_type="style", line_start=i + 10)
            for i in range(2)
        ]

        results = {
            "security": create_result("security", findings=security_findings),
            "style": create_result("style", findings=style_findings),
        }

        report = aggregator.aggregate(sample_session, results)

        assert report.findings_by_reviewer["security"] == 3
        assert report.findings_by_reviewer["style"] == 2

    def test_findings_by_category_count(
        self, aggregator: ResultAggregator, sample_session: SwarmSession
    ) -> None:
        """Test that findings_by_category is calculated correctly."""
        findings = [
            create_finding(category="security/injection", line_start=1),
            create_finding(category="security/injection", line_start=2),
            create_finding(category="style/naming", line_start=3),
        ]
        results = {"security": create_result("security", findings=findings)}

        report = aggregator.aggregate(sample_session, results)

        assert report.findings_by_category["security/injection"] == 2
        assert report.findings_by_category["style/naming"] == 1

    def test_total_findings_matches_sum(
        self, aggregator: ResultAggregator, sample_session: SwarmSession
    ) -> None:
        """Test that total_findings matches sum of all findings."""
        findings = [
            create_finding(severity=Severity.CRITICAL, line_start=1),
            create_finding(severity=Severity.HIGH, line_start=2),
            create_finding(severity=Severity.MEDIUM, line_start=3),
            create_finding(severity=Severity.LOW, line_start=4),
            create_finding(severity=Severity.INFO, line_start=5),
        ]
        results = {"security": create_result("security", findings=findings)}

        report = aggregator.aggregate(sample_session, results)

        total_from_groups = (
            len(report.critical_findings)
            + len(report.high_findings)
            + len(report.medium_findings)
            + len(report.low_findings)
            + len(report.info_findings)
        )
        assert report.total_findings == total_from_groups == 5


class TestDuplicateDetection:
    """Tests for duplicate finding detection (T16)."""

    def test_text_similarity_identical(
        self, aggregator: ResultAggregator
    ) -> None:
        """Test text similarity returns 1.0 for identical strings."""
        similarity = aggregator._text_similarity("Same text", "Same text")
        assert similarity == 1.0

    def test_text_similarity_different(
        self, aggregator: ResultAggregator
    ) -> None:
        """Test text similarity returns low value for different strings."""
        similarity = aggregator._text_similarity(
            "Completely different", "Nothing alike"
        )
        assert similarity < 0.5

    def test_text_similarity_case_insensitive(
        self, aggregator: ResultAggregator
    ) -> None:
        """Test text similarity is case insensitive."""
        similarity = aggregator._text_similarity("Same Text", "same text")
        assert similarity == 1.0

    def test_lines_overlap_no_overlap(
        self, aggregator: ResultAggregator
    ) -> None:
        """Test lines_overlap returns False for non-overlapping ranges."""
        assert not aggregator._lines_overlap(1, 5, 10, 15)

    def test_lines_overlap_with_overlap(
        self, aggregator: ResultAggregator
    ) -> None:
        """Test lines_overlap returns True for overlapping ranges."""
        assert aggregator._lines_overlap(1, 10, 5, 15)

    def test_lines_overlap_adjacent(
        self, aggregator: ResultAggregator
    ) -> None:
        """Test lines_overlap returns True for adjacent lines."""
        assert aggregator._lines_overlap(1, 5, 5, 10)

    def test_lines_overlap_single_line(
        self, aggregator: ResultAggregator
    ) -> None:
        """Test lines_overlap handles single line ranges."""
        assert aggregator._lines_overlap(5, None, 5, None)

    def test_lines_overlap_none_values(
        self, aggregator: ResultAggregator
    ) -> None:
        """Test lines_overlap returns False when start is None."""
        assert not aggregator._lines_overlap(None, 5, 10, 15)
        assert not aggregator._lines_overlap(10, 15, None, 5)

    def test_is_duplicate_same_location_similar_title(
        self, aggregator: ResultAggregator
    ) -> None:
        """Test is_duplicate returns True for same location with similar title."""
        f1 = create_finding(
            reviewer_type="security",
            file_path="src/test.py",
            line_start=10,
            line_end=15,
            title="SQL Injection vulnerability in query",
            category="security/injection",
        )
        f2 = create_finding(
            reviewer_type="style",
            file_path="src/test.py",
            line_start=10,
            line_end=15,
            title="SQL Injection vulnerability found",
            category="security/injection",
        )
        # The titles are similar enough (>= 0.8 similarity)
        assert aggregator._is_duplicate(f1, f2)

    def test_is_duplicate_different_file(
        self, aggregator: ResultAggregator
    ) -> None:
        """Test is_duplicate returns False for different files."""
        f1 = create_finding(file_path="src/a.py", line_start=10)
        f2 = create_finding(file_path="src/b.py", line_start=10)
        assert not aggregator._is_duplicate(f1, f2)

    def test_is_duplicate_non_overlapping_lines(
        self, aggregator: ResultAggregator
    ) -> None:
        """Test is_duplicate returns False for non-overlapping lines."""
        f1 = create_finding(line_start=10, line_end=15)
        f2 = create_finding(line_start=50, line_end=55)
        assert not aggregator._is_duplicate(f1, f2)

    def test_is_duplicate_different_category(
        self, aggregator: ResultAggregator
    ) -> None:
        """Test is_duplicate returns False for different categories."""
        f1 = create_finding(
            file_path="src/test.py",
            line_start=10,
            category="security/injection",
        )
        f2 = create_finding(
            file_path="src/test.py",
            line_start=10,
            category="performance/complexity",
        )
        assert not aggregator._is_duplicate(f1, f2)


class TestFindingMerging:
    """Tests for merging duplicate findings (T16)."""

    def test_merge_keeps_higher_severity(
        self, aggregator: ResultAggregator
    ) -> None:
        """Test merge keeps the higher severity finding."""
        f1 = create_finding(severity=Severity.LOW, reviewer_type="style")
        f2 = create_finding(severity=Severity.CRITICAL, reviewer_type="security")

        merged = aggregator._merge_findings(f1, f2)

        assert merged.severity == Severity.CRITICAL

    def test_merge_combines_reviewer_types(
        self, aggregator: ResultAggregator
    ) -> None:
        """Test merge combines reviewer types."""
        f1 = create_finding(reviewer_type="security")
        f2 = create_finding(reviewer_type="style")

        merged = aggregator._merge_findings(f1, f2)

        assert "security" in merged.reviewer_type
        assert "style" in merged.reviewer_type

    def test_merge_keeps_higher_confidence(
        self, aggregator: ResultAggregator
    ) -> None:
        """Test merge keeps the higher confidence value."""
        f1 = create_finding(confidence=0.7)
        f2 = create_finding(confidence=0.95)

        merged = aggregator._merge_findings(f1, f2)

        assert merged.confidence == 0.95

    def test_merge_combines_descriptions(
        self, aggregator: ResultAggregator
    ) -> None:
        """Test merge combines descriptions from both findings."""
        f1 = create_finding(reviewer_type="security")
        f1 = ReviewFinding(
            id="finding-1",
            reviewer_type="security",
            severity=Severity.MEDIUM,
            category="test",
            title="Test",
            description="Security perspective",
            file_path="src/test.py",
            line_start=10,
            recommendation="Fix it",
            confidence=0.9,
        )
        f2 = ReviewFinding(
            id="finding-2",
            reviewer_type="style",
            severity=Severity.MEDIUM,
            category="test",
            title="Test",
            description="Style perspective",
            file_path="src/test.py",
            line_start=10,
            recommendation="Fix it",
            confidence=0.9,
        )

        merged = aggregator._merge_findings(f1, f2)

        assert "Security perspective" in merged.description
        assert "Style perspective" in merged.description

    def test_merge_expands_line_range(
        self, aggregator: ResultAggregator
    ) -> None:
        """Test merge expands line range to cover both findings."""
        f1 = create_finding(line_start=10, line_end=15)
        f2 = create_finding(line_start=12, line_end=20)

        merged = aggregator._merge_findings(f1, f2)

        assert merged.line_start == 10
        assert merged.line_end == 20


class TestDeduplicationFlow:
    """Tests for the complete deduplication flow (T16)."""

    def test_detect_duplicates_no_duplicates(
        self, aggregator: ResultAggregator
    ) -> None:
        """Test detect_duplicates with no duplicates."""
        findings = [
            create_finding(file_path="src/a.py", line_start=10),
            create_finding(file_path="src/b.py", line_start=20),
            create_finding(file_path="src/c.py", line_start=30),
        ]

        unique, removed = aggregator._detect_duplicates(findings)

        assert len(unique) == 3
        assert removed == 0

    def test_detect_duplicates_with_duplicates(
        self, aggregator: ResultAggregator
    ) -> None:
        """Test detect_duplicates identifies and merges duplicates."""
        findings = [
            create_finding(
                reviewer_type="security",
                file_path="src/test.py",
                line_start=10,
                title="SQL Injection vulnerability in query",
                category="security/injection",
            ),
            create_finding(
                reviewer_type="style",
                file_path="src/test.py",
                line_start=10,
                title="SQL Injection vulnerability found",
                category="security/injection",
            ),
        ]

        unique, removed = aggregator._detect_duplicates(findings)

        assert len(unique) == 1
        assert removed == 1
        # Merged finding should have both reviewer types
        assert "security" in unique[0].reviewer_type
        assert "style" in unique[0].reviewer_type

    def test_detect_duplicates_empty_list(
        self, aggregator: ResultAggregator
    ) -> None:
        """Test detect_duplicates with empty list."""
        unique, removed = aggregator._detect_duplicates([])

        assert len(unique) == 0
        assert removed == 0

    def test_aggregation_removes_duplicates(
        self, aggregator: ResultAggregator, sample_session: SwarmSession
    ) -> None:
        """Test that aggregate() removes duplicates and reports count."""
        security_finding = create_finding(
            reviewer_type="security",
            file_path="src/test.py",
            line_start=10,
            title="SQL Injection vulnerability in query",
            category="security/injection",
            severity=Severity.CRITICAL,
        )
        style_finding = create_finding(
            reviewer_type="style",
            file_path="src/test.py",
            line_start=10,
            title="SQL Injection vulnerability found",
            category="security/injection",
            severity=Severity.MEDIUM,
        )

        results = {
            "security": create_result("security", findings=[security_finding]),
            "style": create_result("style", findings=[style_finding]),
        }

        report = aggregator.aggregate(sample_session, results)

        assert report.duplicates_removed == 1
        assert report.total_findings == 1
        # Should keep CRITICAL severity
        assert len(report.critical_findings) == 1


class TestReportMetadata:
    """Tests for report metadata fields."""

    def test_report_has_created_at(
        self, aggregator: ResultAggregator, sample_session: SwarmSession
    ) -> None:
        """Test that report has created_at timestamp."""
        results: dict[str, ReviewerResult] = {}
        report = aggregator.aggregate(sample_session, results)

        assert report.created_at is not None
        assert isinstance(report.created_at, datetime)

    def test_report_has_swarm_id_from_session(
        self, aggregator: ResultAggregator, sample_session: SwarmSession
    ) -> None:
        """Test that report swarm_id matches session ID."""
        results: dict[str, ReviewerResult] = {}
        report = aggregator.aggregate(sample_session, results)

        assert report.swarm_id == sample_session.id

    def test_report_has_target_path_from_session(
        self, aggregator: ResultAggregator, sample_session: SwarmSession
    ) -> None:
        """Test that report target_path matches session."""
        results: dict[str, ReviewerResult] = {}
        report = aggregator.aggregate(sample_session, results)

        assert report.target_path == sample_session.target_path
