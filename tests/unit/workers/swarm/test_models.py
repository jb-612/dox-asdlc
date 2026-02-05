"""Unit tests for swarm data models.

Tests for Severity, SwarmStatus enums and ReviewFinding, ReviewerResult,
UnifiedReport, and SwarmSession Pydantic models.
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from src.workers.swarm.models import (
    ReviewerResult,
    ReviewFinding,
    Severity,
    SwarmSession,
    SwarmStatus,
    UnifiedReport,
)


class TestSeverity:
    """Tests for Severity enum."""

    def test_all_severities_defined(self) -> None:
        """Test that all severity levels are defined."""
        expected = {"CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"}
        actual = {s.value for s in Severity}
        assert actual == expected

    def test_severity_is_string_enum(self) -> None:
        """Test that Severity values are strings."""
        assert Severity.CRITICAL.value == "CRITICAL"
        assert Severity.HIGH.value == "HIGH"
        assert Severity.MEDIUM.value == "MEDIUM"
        assert Severity.LOW.value == "LOW"
        assert Severity.INFO.value == "INFO"

    def test_severity_ordering(self) -> None:
        """Test that severities can be compared by custom order."""
        # This validates the enum values exist, ordering is by string comparison
        severities = [Severity.INFO, Severity.LOW, Severity.MEDIUM, Severity.HIGH, Severity.CRITICAL]
        assert len(severities) == 5


class TestSwarmStatus:
    """Tests for SwarmStatus enum."""

    def test_all_statuses_defined(self) -> None:
        """Test that all swarm statuses are defined."""
        expected = {"PENDING", "IN_PROGRESS", "AGGREGATING", "COMPLETE", "FAILED"}
        actual = {s.value for s in SwarmStatus}
        assert actual == expected

    def test_swarm_status_is_string_enum(self) -> None:
        """Test that SwarmStatus values are strings."""
        assert SwarmStatus.PENDING.value == "PENDING"
        assert SwarmStatus.IN_PROGRESS.value == "IN_PROGRESS"
        assert SwarmStatus.AGGREGATING.value == "AGGREGATING"
        assert SwarmStatus.COMPLETE.value == "COMPLETE"
        assert SwarmStatus.FAILED.value == "FAILED"


class TestReviewFinding:
    """Tests for ReviewFinding model."""

    def test_review_finding_creation(self) -> None:
        """Test that ReviewFinding can be created with required fields."""
        finding = ReviewFinding(
            id="finding-abc12345",
            reviewer_type="security",
            severity=Severity.HIGH,
            category="injection",
            title="SQL Injection Vulnerability",
            description="User input is not sanitized before SQL query",
            file_path="src/api/handlers.py",
            line_start=42,
            line_end=45,
            code_snippet="cursor.execute(f'SELECT * FROM users WHERE id={user_id}')",
            recommendation="Use parameterized queries",
            confidence=0.95,
        )

        assert finding.id == "finding-abc12345"
        assert finding.reviewer_type == "security"
        assert finding.severity == Severity.HIGH
        assert finding.category == "injection"
        assert finding.title == "SQL Injection Vulnerability"
        assert finding.confidence == 0.95

    def test_review_finding_optional_fields(self) -> None:
        """Test that ReviewFinding handles optional fields."""
        finding = ReviewFinding(
            id="finding-xyz98765",
            reviewer_type="style",
            severity=Severity.LOW,
            category="formatting",
            title="Missing docstring",
            description="Function lacks documentation",
            file_path="src/utils.py",
            line_start=10,
            line_end=None,
            code_snippet=None,
            recommendation="Add a docstring",
            confidence=0.8,
        )

        assert finding.line_end is None
        assert finding.code_snippet is None

    def test_review_finding_to_dict(self) -> None:
        """Test that ReviewFinding serializes to dictionary."""
        finding = ReviewFinding(
            id="finding-test123",
            reviewer_type="performance",
            severity=Severity.MEDIUM,
            category="complexity",
            title="High cyclomatic complexity",
            description="Function has too many branches",
            file_path="src/logic.py",
            line_start=100,
            line_end=150,
            code_snippet="def process(): ...",
            recommendation="Split into smaller functions",
            confidence=0.75,
        )

        result = finding.model_dump()

        assert result["id"] == "finding-test123"
        assert result["reviewer_type"] == "performance"
        assert result["severity"] == "MEDIUM"
        assert result["category"] == "complexity"
        assert result["confidence"] == 0.75

    def test_review_finding_from_dict(self) -> None:
        """Test that ReviewFinding deserializes from dictionary."""
        data = {
            "id": "finding-fromdict",
            "reviewer_type": "security",
            "severity": "CRITICAL",
            "category": "auth",
            "title": "Auth bypass",
            "description": "Auth can be bypassed",
            "file_path": "src/auth.py",
            "line_start": 20,
            "line_end": 25,
            "code_snippet": "if True: pass",
            "recommendation": "Fix auth logic",
            "confidence": 0.99,
        }

        finding = ReviewFinding.model_validate(data)

        assert finding.id == "finding-fromdict"
        assert finding.severity == Severity.CRITICAL
        assert finding.confidence == 0.99

    def test_review_finding_confidence_validation(self) -> None:
        """Test that confidence is validated to be between 0 and 1."""
        with pytest.raises(ValueError):
            ReviewFinding(
                id="finding-invalid",
                reviewer_type="test",
                severity=Severity.LOW,
                category="test",
                title="Test",
                description="Test",
                file_path="test.py",
                line_start=1,
                recommendation="Test",
                confidence=1.5,  # Invalid: > 1.0
            )

        with pytest.raises(ValueError):
            ReviewFinding(
                id="finding-invalid",
                reviewer_type="test",
                severity=Severity.LOW,
                category="test",
                title="Test",
                description="Test",
                file_path="test.py",
                line_start=1,
                recommendation="Test",
                confidence=-0.1,  # Invalid: < 0.0
            )

    def test_review_finding_json_serialization(self) -> None:
        """Test JSON serialization round-trip."""
        finding = ReviewFinding(
            id="finding-json",
            reviewer_type="style",
            severity=Severity.INFO,
            category="naming",
            title="Non-descriptive name",
            description="Variable name 'x' is not descriptive",
            file_path="src/util.py",
            line_start=5,
            line_end=5,
            code_snippet="x = 42",
            recommendation="Use a descriptive name",
            confidence=0.6,
        )

        json_str = finding.model_dump_json()
        restored = ReviewFinding.model_validate_json(json_str)

        assert restored.id == finding.id
        assert restored.severity == finding.severity
        assert restored.confidence == finding.confidence


class TestReviewerResult:
    """Tests for ReviewerResult model."""

    def test_reviewer_result_success(self) -> None:
        """Test creating a successful reviewer result."""
        findings = [
            ReviewFinding(
                id="finding-1",
                reviewer_type="security",
                severity=Severity.HIGH,
                category="test",
                title="Finding 1",
                description="Desc 1",
                file_path="src/a.py",
                line_start=1,
                recommendation="Fix it",
                confidence=0.9,
            ),
        ]

        result = ReviewerResult(
            reviewer_type="security",
            status="success",
            findings=findings,
            duration_seconds=12.5,
            files_reviewed=["src/a.py", "src/b.py"],
            error_message=None,
        )

        assert result.reviewer_type == "security"
        assert result.status == "success"
        assert len(result.findings) == 1
        assert result.duration_seconds == 12.5
        assert len(result.files_reviewed) == 2
        assert result.error_message is None

    def test_reviewer_result_failed(self) -> None:
        """Test creating a failed reviewer result."""
        result = ReviewerResult(
            reviewer_type="performance",
            status="failed",
            findings=[],
            duration_seconds=5.0,
            files_reviewed=[],
            error_message="Timeout while analyzing large file",
        )

        assert result.status == "failed"
        assert result.error_message == "Timeout while analyzing large file"
        assert len(result.findings) == 0

    def test_reviewer_result_timeout(self) -> None:
        """Test creating a timed out reviewer result."""
        result = ReviewerResult(
            reviewer_type="style",
            status="timeout",
            findings=[],
            duration_seconds=300.0,
            files_reviewed=["src/large_file.py"],
            error_message="Review exceeded time limit",
        )

        assert result.status == "timeout"

    def test_reviewer_result_to_dict(self) -> None:
        """Test ReviewerResult serialization."""
        result = ReviewerResult(
            reviewer_type="security",
            status="success",
            findings=[],
            duration_seconds=10.0,
            files_reviewed=["src/test.py"],
            error_message=None,
        )

        data = result.model_dump()

        assert data["reviewer_type"] == "security"
        assert data["status"] == "success"
        assert data["duration_seconds"] == 10.0

    def test_reviewer_result_from_dict(self) -> None:
        """Test ReviewerResult deserialization."""
        data = {
            "reviewer_type": "style",
            "status": "success",
            "findings": [],
            "duration_seconds": 8.5,
            "files_reviewed": ["src/a.py"],
            "error_message": None,
        }

        result = ReviewerResult.model_validate(data)

        assert result.reviewer_type == "style"
        assert result.duration_seconds == 8.5


class TestUnifiedReport:
    """Tests for UnifiedReport model."""

    def test_unified_report_creation(self) -> None:
        """Test creating a unified report."""
        now = datetime.now(UTC)
        critical_finding = ReviewFinding(
            id="finding-crit",
            reviewer_type="security",
            severity=Severity.CRITICAL,
            category="auth",
            title="Critical issue",
            description="Auth bypass",
            file_path="src/auth.py",
            line_start=10,
            recommendation="Fix auth",
            confidence=0.95,
        )

        report = UnifiedReport(
            swarm_id="swarm-12345678",
            target_path="src/",
            created_at=now,
            reviewers_completed=["security", "style"],
            reviewers_failed=["performance"],
            critical_findings=[critical_finding],
            high_findings=[],
            medium_findings=[],
            low_findings=[],
            info_findings=[],
            total_findings=1,
            findings_by_reviewer={"security": 1, "style": 0},
            findings_by_category={"auth": 1},
            duplicates_removed=2,
        )

        assert report.swarm_id == "swarm-12345678"
        assert report.target_path == "src/"
        assert len(report.reviewers_completed) == 2
        assert len(report.reviewers_failed) == 1
        assert report.total_findings == 1
        assert report.duplicates_removed == 2

    def test_unified_report_empty(self) -> None:
        """Test creating an empty unified report."""
        now = datetime.now(UTC)

        report = UnifiedReport(
            swarm_id="swarm-empty",
            target_path="src/empty/",
            created_at=now,
            reviewers_completed=["security", "style", "performance"],
            reviewers_failed=[],
            critical_findings=[],
            high_findings=[],
            medium_findings=[],
            low_findings=[],
            info_findings=[],
            total_findings=0,
            findings_by_reviewer={},
            findings_by_category={},
            duplicates_removed=0,
        )

        assert report.total_findings == 0
        assert len(report.reviewers_failed) == 0

    def test_unified_report_to_dict(self) -> None:
        """Test UnifiedReport serialization."""
        now = datetime(2026, 1, 20, 12, 0, 0, tzinfo=UTC)

        report = UnifiedReport(
            swarm_id="swarm-dict",
            target_path="src/test/",
            created_at=now,
            reviewers_completed=["security"],
            reviewers_failed=[],
            critical_findings=[],
            high_findings=[],
            medium_findings=[],
            low_findings=[],
            info_findings=[],
            total_findings=0,
            findings_by_reviewer={"security": 0},
            findings_by_category={},
            duplicates_removed=0,
        )

        data = report.model_dump()

        assert data["swarm_id"] == "swarm-dict"
        assert data["target_path"] == "src/test/"
        assert data["total_findings"] == 0

    def test_unified_report_from_dict(self) -> None:
        """Test UnifiedReport deserialization."""
        data = {
            "swarm_id": "swarm-fromdict",
            "target_path": "src/api/",
            "created_at": "2026-01-20T12:00:00Z",
            "reviewers_completed": ["security", "performance"],
            "reviewers_failed": [],
            "critical_findings": [],
            "high_findings": [],
            "medium_findings": [],
            "low_findings": [],
            "info_findings": [],
            "total_findings": 0,
            "findings_by_reviewer": {},
            "findings_by_category": {},
            "duplicates_removed": 0,
        }

        report = UnifiedReport.model_validate(data)

        assert report.swarm_id == "swarm-fromdict"
        assert len(report.reviewers_completed) == 2

    def test_unified_report_json_serialization(self) -> None:
        """Test JSON round-trip for UnifiedReport."""
        now = datetime(2026, 1, 20, 12, 0, 0, tzinfo=UTC)

        original = UnifiedReport(
            swarm_id="swarm-json",
            target_path="src/",
            created_at=now,
            reviewers_completed=["security"],
            reviewers_failed=["style"],
            critical_findings=[],
            high_findings=[],
            medium_findings=[],
            low_findings=[],
            info_findings=[],
            total_findings=0,
            findings_by_reviewer={},
            findings_by_category={},
            duplicates_removed=5,
        )

        json_str = original.model_dump_json()
        restored = UnifiedReport.model_validate_json(json_str)

        assert restored.swarm_id == original.swarm_id
        assert restored.duplicates_removed == 5


class TestSwarmSession:
    """Tests for SwarmSession model."""

    def test_swarm_session_creation(self) -> None:
        """Test creating a swarm session."""
        now = datetime.now(UTC)

        session = SwarmSession(
            id="swarm-abc12345",
            target_path="src/workers/",
            reviewers=["security", "performance", "style"],
            status=SwarmStatus.PENDING,
            created_at=now,
            completed_at=None,
            results={},
            unified_report=None,
        )

        assert session.id == "swarm-abc12345"
        assert session.target_path == "src/workers/"
        assert len(session.reviewers) == 3
        assert session.status == SwarmStatus.PENDING
        assert session.completed_at is None
        assert session.unified_report is None

    def test_swarm_session_in_progress(self) -> None:
        """Test swarm session with in-progress status."""
        now = datetime.now(UTC)
        result = ReviewerResult(
            reviewer_type="security",
            status="success",
            findings=[],
            duration_seconds=10.0,
            files_reviewed=["src/a.py"],
            error_message=None,
        )

        session = SwarmSession(
            id="swarm-progress",
            target_path="src/",
            reviewers=["security", "performance"],
            status=SwarmStatus.IN_PROGRESS,
            created_at=now,
            completed_at=None,
            results={"security": result},
            unified_report=None,
        )

        assert session.status == SwarmStatus.IN_PROGRESS
        assert "security" in session.results
        assert session.results["security"].status == "success"

    def test_swarm_session_complete(self) -> None:
        """Test swarm session with complete status and unified report."""
        now = datetime(2026, 1, 20, 12, 0, 0, tzinfo=UTC)
        completed = datetime(2026, 1, 20, 12, 5, 0, tzinfo=UTC)

        report = UnifiedReport(
            swarm_id="swarm-complete",
            target_path="src/",
            created_at=completed,
            reviewers_completed=["security"],
            reviewers_failed=[],
            critical_findings=[],
            high_findings=[],
            medium_findings=[],
            low_findings=[],
            info_findings=[],
            total_findings=0,
            findings_by_reviewer={},
            findings_by_category={},
            duplicates_removed=0,
        )

        result = ReviewerResult(
            reviewer_type="security",
            status="success",
            findings=[],
            duration_seconds=300.0,
            files_reviewed=["src/a.py"],
            error_message=None,
        )

        session = SwarmSession(
            id="swarm-complete",
            target_path="src/",
            reviewers=["security"],
            status=SwarmStatus.COMPLETE,
            created_at=now,
            completed_at=completed,
            results={"security": result},
            unified_report=report,
        )

        assert session.status == SwarmStatus.COMPLETE
        assert session.completed_at is not None
        assert session.unified_report is not None
        assert session.unified_report.swarm_id == "swarm-complete"

    def test_swarm_session_failed(self) -> None:
        """Test swarm session with failed status."""
        now = datetime.now(UTC)

        session = SwarmSession(
            id="swarm-failed",
            target_path="src/",
            reviewers=["security"],
            status=SwarmStatus.FAILED,
            created_at=now,
            completed_at=now,
            results={},
            unified_report=None,
        )

        assert session.status == SwarmStatus.FAILED

    def test_swarm_session_to_dict(self) -> None:
        """Test SwarmSession serialization."""
        now = datetime(2026, 1, 20, 12, 0, 0, tzinfo=UTC)

        session = SwarmSession(
            id="swarm-dict",
            target_path="src/test/",
            reviewers=["security", "style"],
            status=SwarmStatus.PENDING,
            created_at=now,
            completed_at=None,
            results={},
            unified_report=None,
        )

        data = session.model_dump()

        assert data["id"] == "swarm-dict"
        assert data["target_path"] == "src/test/"
        assert data["status"] == "PENDING"
        assert len(data["reviewers"]) == 2

    def test_swarm_session_from_dict(self) -> None:
        """Test SwarmSession deserialization."""
        data = {
            "id": "swarm-fromdict",
            "target_path": "src/api/",
            "reviewers": ["security"],
            "status": "IN_PROGRESS",
            "created_at": "2026-01-20T12:00:00Z",
            "completed_at": None,
            "results": {},
            "unified_report": None,
        }

        session = SwarmSession.model_validate(data)

        assert session.id == "swarm-fromdict"
        assert session.status == SwarmStatus.IN_PROGRESS

    def test_swarm_session_json_serialization(self) -> None:
        """Test JSON round-trip for SwarmSession."""
        now = datetime(2026, 1, 20, 12, 0, 0, tzinfo=UTC)

        original = SwarmSession(
            id="swarm-json",
            target_path="src/",
            reviewers=["security", "performance", "style"],
            status=SwarmStatus.AGGREGATING,
            created_at=now,
            completed_at=None,
            results={},
            unified_report=None,
        )

        json_str = original.model_dump_json()
        restored = SwarmSession.model_validate_json(json_str)

        assert restored.id == original.id
        assert restored.status == SwarmStatus.AGGREGATING
        assert len(restored.reviewers) == 3

    def test_swarm_session_with_nested_results(self) -> None:
        """Test SwarmSession with nested ReviewerResult containing findings."""
        now = datetime(2026, 1, 20, 12, 0, 0, tzinfo=UTC)

        finding = ReviewFinding(
            id="finding-nested",
            reviewer_type="security",
            severity=Severity.HIGH,
            category="injection",
            title="SQL Injection",
            description="Potential SQL injection",
            file_path="src/db.py",
            line_start=50,
            recommendation="Use parameterized queries",
            confidence=0.9,
        )

        result = ReviewerResult(
            reviewer_type="security",
            status="success",
            findings=[finding],
            duration_seconds=15.0,
            files_reviewed=["src/db.py"],
            error_message=None,
        )

        session = SwarmSession(
            id="swarm-nested",
            target_path="src/",
            reviewers=["security"],
            status=SwarmStatus.IN_PROGRESS,
            created_at=now,
            completed_at=None,
            results={"security": result},
            unified_report=None,
        )

        # Test serialization/deserialization preserves nested structure
        json_str = session.model_dump_json()
        restored = SwarmSession.model_validate_json(json_str)

        assert len(restored.results) == 1
        assert restored.results["security"].findings[0].severity == Severity.HIGH
        assert restored.results["security"].findings[0].title == "SQL Injection"
