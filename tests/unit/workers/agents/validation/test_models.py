"""Unit tests for Validation models.

Tests for ValidationCheck, ValidationReport, SecurityFinding, and SecurityReport
domain models used by the Validation and Security agents.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone

import pytest

from src.workers.agents.validation.models import (
    CheckCategory,
    Severity,
    SecurityCategory,
    ValidationCheck,
    ValidationReport,
    SecurityFinding,
    SecurityReport,
)
from src.workers.agents.development.models import TestRunResult, TestResult


class TestCheckCategory:
    """Tests for CheckCategory enum."""

    def test_check_category_values(self) -> None:
        """Test that check category has expected values."""
        assert CheckCategory.FUNCTIONAL.value == "functional"
        assert CheckCategory.PERFORMANCE.value == "performance"
        assert CheckCategory.COMPATIBILITY.value == "compatibility"

    def test_check_category_is_string_enum(self) -> None:
        """Test that check category is a string enum."""
        assert isinstance(CheckCategory.FUNCTIONAL.value, str)
        assert str(CheckCategory.FUNCTIONAL) == "CheckCategory.FUNCTIONAL"


class TestSeverity:
    """Tests for Severity enum."""

    def test_severity_values(self) -> None:
        """Test that severity has expected values."""
        assert Severity.CRITICAL.value == "critical"
        assert Severity.HIGH.value == "high"
        assert Severity.MEDIUM.value == "medium"
        assert Severity.LOW.value == "low"
        assert Severity.INFO.value == "info"

    def test_severity_ordering(self) -> None:
        """Test that severity levels can be compared by index."""
        levels = list(Severity)
        assert levels[0] == Severity.CRITICAL
        assert levels[1] == Severity.HIGH
        assert levels[2] == Severity.MEDIUM
        assert levels[3] == Severity.LOW
        assert levels[4] == Severity.INFO

    def test_is_blocking_returns_true_for_critical_and_high(self) -> None:
        """Test that is_blocking returns True for critical and high severity."""
        assert Severity.CRITICAL.is_blocking() is True
        assert Severity.HIGH.is_blocking() is True

    def test_is_blocking_returns_false_for_lower_severities(self) -> None:
        """Test that is_blocking returns False for medium, low, and info."""
        assert Severity.MEDIUM.is_blocking() is False
        assert Severity.LOW.is_blocking() is False
        assert Severity.INFO.is_blocking() is False


class TestSecurityCategory:
    """Tests for SecurityCategory enum."""

    def test_security_category_values(self) -> None:
        """Test that security category has expected values."""
        assert SecurityCategory.INJECTION.value == "injection"
        assert SecurityCategory.XSS.value == "xss"
        assert SecurityCategory.SECRETS.value == "secrets"
        assert SecurityCategory.AUTH.value == "auth"
        assert SecurityCategory.CRYPTO.value == "crypto"
        assert SecurityCategory.CONFIGURATION.value == "configuration"
        assert SecurityCategory.OTHER.value == "other"


class TestValidationCheck:
    """Tests for ValidationCheck model."""

    def test_validation_check_creation(self) -> None:
        """Test that validation check can be created with required fields."""
        check = ValidationCheck(
            name="E2E Login Test",
            category=CheckCategory.FUNCTIONAL,
            passed=True,
            details="All login scenarios passed successfully",
            evidence="test_output.log",
        )

        assert check.name == "E2E Login Test"
        assert check.category == CheckCategory.FUNCTIONAL
        assert check.passed is True
        assert "scenarios passed" in check.details
        assert check.evidence == "test_output.log"

    def test_validation_check_with_none_evidence(self) -> None:
        """Test that validation check can have None evidence."""
        check = ValidationCheck(
            name="Performance Baseline",
            category=CheckCategory.PERFORMANCE,
            passed=False,
            details="Response time exceeded threshold",
            evidence=None,
        )

        assert check.evidence is None
        assert check.passed is False

    def test_validation_check_to_dict(self) -> None:
        """Test that validation check serializes to dictionary."""
        check = ValidationCheck(
            name="Test Check",
            category=CheckCategory.COMPATIBILITY,
            passed=True,
            details="Compatible",
            evidence="evidence.txt",
        )

        result = check.to_dict()

        assert result["name"] == "Test Check"
        assert result["category"] == "compatibility"
        assert result["passed"] is True
        assert result["details"] == "Compatible"
        assert result["evidence"] == "evidence.txt"

    def test_validation_check_from_dict(self) -> None:
        """Test that validation check deserializes from dictionary."""
        data = {
            "name": "From Dict Check",
            "category": "functional",
            "passed": False,
            "details": "Failed verification",
            "evidence": None,
        }

        check = ValidationCheck.from_dict(data)

        assert check.name == "From Dict Check"
        assert check.category == CheckCategory.FUNCTIONAL
        assert check.passed is False
        assert check.details == "Failed verification"
        assert check.evidence is None

    def test_validation_check_from_dict_with_missing_optional(self) -> None:
        """Test that from_dict handles missing optional fields."""
        data = {
            "name": "Minimal Check",
            "category": "performance",
            "passed": True,
            "details": "OK",
        }

        check = ValidationCheck.from_dict(data)

        assert check.evidence is None

    def test_validation_check_roundtrip(self) -> None:
        """Test that to_dict and from_dict are inverse operations."""
        original = ValidationCheck(
            name="Roundtrip Check",
            category=CheckCategory.FUNCTIONAL,
            passed=True,
            details="All good",
            evidence="log.txt",
        )

        roundtrip = ValidationCheck.from_dict(original.to_dict())

        assert roundtrip.name == original.name
        assert roundtrip.category == original.category
        assert roundtrip.passed == original.passed
        assert roundtrip.details == original.details
        assert roundtrip.evidence == original.evidence


class TestValidationReport:
    """Tests for ValidationReport model."""

    def _create_test_run_result(self, passed: int = 5, failed: int = 0) -> TestRunResult:
        """Create a test run result for testing."""
        return TestRunResult(
            suite_id="SUITE-001",
            results=[],
            passed=passed,
            failed=failed,
            coverage=90.0,
        )

    def test_validation_report_creation(self) -> None:
        """Test that validation report can be created."""
        checks = [
            ValidationCheck(
                name="Check 1",
                category=CheckCategory.FUNCTIONAL,
                passed=True,
                details="OK",
                evidence=None,
            ),
        ]
        e2e_results = self._create_test_run_result()

        report = ValidationReport(
            feature_id="P04-F04",
            checks=checks,
            e2e_results=e2e_results,
            passed=True,
            recommendations=["Consider adding more E2E tests"],
        )

        assert report.feature_id == "P04-F04"
        assert len(report.checks) == 1
        assert report.e2e_results.passed == 5
        assert report.passed is True
        assert "more E2E tests" in report.recommendations[0]

    def test_validation_report_failed_when_checks_fail(self) -> None:
        """Test that validation report can indicate failure."""
        checks = [
            ValidationCheck(
                name="Failed Check",
                category=CheckCategory.PERFORMANCE,
                passed=False,
                details="Performance degraded",
                evidence=None,
            ),
        ]
        e2e_results = self._create_test_run_result(passed=3, failed=2)

        report = ValidationReport(
            feature_id="P04-F04",
            checks=checks,
            e2e_results=e2e_results,
            passed=False,
            recommendations=["Fix performance regression"],
        )

        assert report.passed is False
        assert report.e2e_results.failed == 2

    def test_validation_report_to_dict(self) -> None:
        """Test that validation report serializes to dictionary."""
        checks = [
            ValidationCheck(
                name="Serialization Check",
                category=CheckCategory.FUNCTIONAL,
                passed=True,
                details="OK",
                evidence=None,
            ),
        ]
        e2e_results = self._create_test_run_result()

        report = ValidationReport(
            feature_id="P04-F04",
            checks=checks,
            e2e_results=e2e_results,
            passed=True,
            recommendations=["Rec 1"],
        )

        result = report.to_dict()

        assert result["feature_id"] == "P04-F04"
        assert len(result["checks"]) == 1
        assert result["checks"][0]["name"] == "Serialization Check"
        assert result["e2e_results"]["suite_id"] == "SUITE-001"
        assert result["passed"] is True
        assert "Rec 1" in result["recommendations"]

    def test_validation_report_from_dict(self) -> None:
        """Test that validation report deserializes from dictionary."""
        data = {
            "feature_id": "P04-F05",
            "checks": [
                {
                    "name": "Deserialization Check",
                    "category": "compatibility",
                    "passed": False,
                    "details": "Failed",
                    "evidence": None,
                },
            ],
            "e2e_results": {
                "suite_id": "SUITE-002",
                "results": [],
                "passed": 10,
                "failed": 2,
                "coverage": 85.0,
            },
            "passed": False,
            "recommendations": ["Fix compatibility"],
        }

        report = ValidationReport.from_dict(data)

        assert report.feature_id == "P04-F05"
        assert len(report.checks) == 1
        assert report.checks[0].category == CheckCategory.COMPATIBILITY
        assert report.e2e_results.failed == 2
        assert report.passed is False

    def test_validation_report_to_json(self) -> None:
        """Test that validation report serializes to JSON string."""
        checks = []
        e2e_results = self._create_test_run_result()

        report = ValidationReport(
            feature_id="P04-F04",
            checks=checks,
            e2e_results=e2e_results,
            passed=True,
            recommendations=[],
        )

        json_str = report.to_json()
        parsed = json.loads(json_str)

        assert parsed["feature_id"] == "P04-F04"

    def test_validation_report_from_json(self) -> None:
        """Test that validation report deserializes from JSON string."""
        json_str = json.dumps({
            "feature_id": "P04-F06",
            "checks": [],
            "e2e_results": {
                "suite_id": "SUITE-003",
                "results": [],
                "passed": 1,
                "failed": 0,
                "coverage": 100.0,
            },
            "passed": True,
            "recommendations": [],
        })

        report = ValidationReport.from_json(json_str)

        assert report.feature_id == "P04-F06"

    def test_validation_report_to_markdown(self) -> None:
        """Test that validation report formats as markdown."""
        checks = [
            ValidationCheck(
                name="E2E Test",
                category=CheckCategory.FUNCTIONAL,
                passed=True,
                details="All scenarios pass",
                evidence="test.log",
            ),
            ValidationCheck(
                name="Performance Baseline",
                category=CheckCategory.PERFORMANCE,
                passed=False,
                details="Response time exceeded threshold",
                evidence=None,
            ),
        ]
        e2e_results = self._create_test_run_result(passed=8, failed=2)

        report = ValidationReport(
            feature_id="P04-F04",
            checks=checks,
            e2e_results=e2e_results,
            passed=False,
            recommendations=["Optimize database queries", "Add caching"],
        )

        md = report.to_markdown()

        assert "# Validation Report" in md
        assert "P04-F04" in md
        assert "E2E Test" in md
        assert "PASSED" in md
        assert "FAILED" in md
        assert "Recommendations" in md
        assert "Optimize database queries" in md


class TestSecurityFinding:
    """Tests for SecurityFinding model."""

    def test_security_finding_creation(self) -> None:
        """Test that security finding can be created."""
        finding = SecurityFinding(
            id="SEC-001",
            severity=Severity.HIGH,
            category=SecurityCategory.INJECTION,
            location="src/api/handler.py:42",
            description="Potential SQL injection vulnerability",
            remediation="Use parameterized queries",
        )

        assert finding.id == "SEC-001"
        assert finding.severity == Severity.HIGH
        assert finding.category == SecurityCategory.INJECTION
        assert "handler.py" in finding.location
        assert "SQL injection" in finding.description
        assert "parameterized queries" in finding.remediation

    def test_security_finding_is_blocking(self) -> None:
        """Test that is_blocking delegates to severity."""
        critical_finding = SecurityFinding(
            id="SEC-001",
            severity=Severity.CRITICAL,
            category=SecurityCategory.SECRETS,
            location="config.py:10",
            description="Hardcoded API key",
            remediation="Use environment variables",
        )

        info_finding = SecurityFinding(
            id="SEC-002",
            severity=Severity.INFO,
            category=SecurityCategory.CONFIGURATION,
            location="app.py:5",
            description="Debug mode enabled",
            remediation="Disable debug in production",
        )

        assert critical_finding.is_blocking() is True
        assert info_finding.is_blocking() is False

    def test_security_finding_to_dict(self) -> None:
        """Test that security finding serializes to dictionary."""
        finding = SecurityFinding(
            id="SEC-001",
            severity=Severity.MEDIUM,
            category=SecurityCategory.XSS,
            location="views.py:100",
            description="Unescaped output",
            remediation="Escape HTML entities",
        )

        result = finding.to_dict()

        assert result["id"] == "SEC-001"
        assert result["severity"] == "medium"
        assert result["category"] == "xss"
        assert result["location"] == "views.py:100"
        assert result["description"] == "Unescaped output"
        assert result["remediation"] == "Escape HTML entities"

    def test_security_finding_from_dict(self) -> None:
        """Test that security finding deserializes from dictionary."""
        data = {
            "id": "SEC-002",
            "severity": "low",
            "category": "crypto",
            "location": "auth.py:50",
            "description": "Weak hash algorithm",
            "remediation": "Use bcrypt",
        }

        finding = SecurityFinding.from_dict(data)

        assert finding.id == "SEC-002"
        assert finding.severity == Severity.LOW
        assert finding.category == SecurityCategory.CRYPTO
        assert finding.location == "auth.py:50"

    def test_security_finding_roundtrip(self) -> None:
        """Test that to_dict and from_dict are inverse operations."""
        original = SecurityFinding(
            id="SEC-003",
            severity=Severity.HIGH,
            category=SecurityCategory.AUTH,
            location="login.py:25",
            description="Missing rate limiting",
            remediation="Implement rate limiting",
        )

        roundtrip = SecurityFinding.from_dict(original.to_dict())

        assert roundtrip.id == original.id
        assert roundtrip.severity == original.severity
        assert roundtrip.category == original.category
        assert roundtrip.location == original.location
        assert roundtrip.description == original.description
        assert roundtrip.remediation == original.remediation


class TestSecurityReport:
    """Tests for SecurityReport model."""

    def test_security_report_creation(self) -> None:
        """Test that security report can be created."""
        findings = [
            SecurityFinding(
                id="SEC-001",
                severity=Severity.MEDIUM,
                category=SecurityCategory.CONFIGURATION,
                location="config.py:10",
                description="Insecure default",
                remediation="Change default",
            ),
        ]

        report = SecurityReport(
            feature_id="P04-F04",
            findings=findings,
            passed=True,
            scan_coverage=95.5,
            compliance_status={"OWASP": True, "PCI-DSS": False},
        )

        assert report.feature_id == "P04-F04"
        assert len(report.findings) == 1
        assert report.passed is True
        assert report.scan_coverage == 95.5
        assert report.compliance_status["OWASP"] is True
        assert report.compliance_status["PCI-DSS"] is False

    def test_security_report_fails_with_critical_finding(self) -> None:
        """Test that security report indicates failure with critical findings."""
        findings = [
            SecurityFinding(
                id="SEC-001",
                severity=Severity.CRITICAL,
                category=SecurityCategory.SECRETS,
                location="env.py:5",
                description="Exposed API key",
                remediation="Remove from source",
            ),
        ]

        report = SecurityReport(
            feature_id="P04-F04",
            findings=findings,
            passed=False,  # Should be False due to critical finding
            scan_coverage=100.0,
            compliance_status={},
        )

        assert report.passed is False

    def test_security_report_has_blocking_findings(self) -> None:
        """Test has_blocking_findings helper method."""
        critical_findings = [
            SecurityFinding(
                id="SEC-001",
                severity=Severity.CRITICAL,
                category=SecurityCategory.INJECTION,
                location="db.py:10",
                description="SQL injection",
                remediation="Fix it",
            ),
        ]

        high_findings = [
            SecurityFinding(
                id="SEC-002",
                severity=Severity.HIGH,
                category=SecurityCategory.XSS,
                location="view.py:20",
                description="XSS vulnerability",
                remediation="Escape output",
            ),
        ]

        medium_findings = [
            SecurityFinding(
                id="SEC-003",
                severity=Severity.MEDIUM,
                category=SecurityCategory.CONFIGURATION,
                location="app.py:5",
                description="Debug enabled",
                remediation="Disable debug",
            ),
        ]

        report_critical = SecurityReport(
            feature_id="P04-F04",
            findings=critical_findings,
            passed=False,
            scan_coverage=100.0,
            compliance_status={},
        )

        report_high = SecurityReport(
            feature_id="P04-F04",
            findings=high_findings,
            passed=False,
            scan_coverage=100.0,
            compliance_status={},
        )

        report_medium = SecurityReport(
            feature_id="P04-F04",
            findings=medium_findings,
            passed=True,
            scan_coverage=100.0,
            compliance_status={},
        )

        report_empty = SecurityReport(
            feature_id="P04-F04",
            findings=[],
            passed=True,
            scan_coverage=100.0,
            compliance_status={},
        )

        assert report_critical.has_blocking_findings() is True
        assert report_high.has_blocking_findings() is True
        assert report_medium.has_blocking_findings() is False
        assert report_empty.has_blocking_findings() is False

    def test_security_report_to_dict(self) -> None:
        """Test that security report serializes to dictionary."""
        findings = [
            SecurityFinding(
                id="SEC-001",
                severity=Severity.LOW,
                category=SecurityCategory.OTHER,
                location="misc.py:1",
                description="Minor issue",
                remediation="Optional fix",
            ),
        ]

        report = SecurityReport(
            feature_id="P04-F04",
            findings=findings,
            passed=True,
            scan_coverage=88.0,
            compliance_status={"SOC2": True},
        )

        result = report.to_dict()

        assert result["feature_id"] == "P04-F04"
        assert len(result["findings"]) == 1
        assert result["findings"][0]["severity"] == "low"
        assert result["passed"] is True
        assert result["scan_coverage"] == 88.0
        assert result["compliance_status"]["SOC2"] is True

    def test_security_report_from_dict(self) -> None:
        """Test that security report deserializes from dictionary."""
        data = {
            "feature_id": "P04-F05",
            "findings": [
                {
                    "id": "SEC-002",
                    "severity": "info",
                    "category": "configuration",
                    "location": "app.py:1",
                    "description": "Info only",
                    "remediation": "None needed",
                },
            ],
            "passed": True,
            "scan_coverage": 99.0,
            "compliance_status": {"HIPAA": False},
        }

        report = SecurityReport.from_dict(data)

        assert report.feature_id == "P04-F05"
        assert len(report.findings) == 1
        assert report.findings[0].severity == Severity.INFO
        assert report.scan_coverage == 99.0
        assert report.compliance_status["HIPAA"] is False

    def test_security_report_to_json(self) -> None:
        """Test that security report serializes to JSON string."""
        report = SecurityReport(
            feature_id="P04-F04",
            findings=[],
            passed=True,
            scan_coverage=100.0,
            compliance_status={},
        )

        json_str = report.to_json()
        parsed = json.loads(json_str)

        assert parsed["feature_id"] == "P04-F04"
        assert parsed["scan_coverage"] == 100.0

    def test_security_report_from_json(self) -> None:
        """Test that security report deserializes from JSON string."""
        json_str = json.dumps({
            "feature_id": "P04-F06",
            "findings": [],
            "passed": True,
            "scan_coverage": 95.0,
            "compliance_status": {},
        })

        report = SecurityReport.from_json(json_str)

        assert report.feature_id == "P04-F06"

    def test_security_report_to_markdown(self) -> None:
        """Test that security report formats as markdown."""
        findings = [
            SecurityFinding(
                id="SEC-001",
                severity=Severity.HIGH,
                category=SecurityCategory.INJECTION,
                location="db.py:50",
                description="SQL injection risk",
                remediation="Use prepared statements",
            ),
            SecurityFinding(
                id="SEC-002",
                severity=Severity.LOW,
                category=SecurityCategory.CONFIGURATION,
                location="settings.py:10",
                description="Debug mode",
                remediation="Disable in production",
            ),
        ]

        report = SecurityReport(
            feature_id="P04-F04",
            findings=findings,
            passed=False,
            scan_coverage=92.5,
            compliance_status={"OWASP": True, "PCI-DSS": False},
        )

        md = report.to_markdown()

        assert "# Security Report" in md
        assert "P04-F04" in md
        assert "FAILED" in md
        assert "SEC-001" in md
        assert "HIGH" in md
        assert "SQL injection" in md
        assert "Scan Coverage" in md
        assert "92.5%" in md
        assert "Compliance" in md
        assert "OWASP" in md
        assert "PCI-DSS" in md
