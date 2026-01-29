"""Domain models for Validation agents.

Defines data structures for validation checks, validation reports,
security findings, and security reports produced by the validation phase agents.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from enum import Enum
from typing import Any

# Import TestRunResult for composition
from src.workers.agents.development.models import TestRunResult


class CheckCategory(str, Enum):
    """Categories for validation checks."""

    FUNCTIONAL = "functional"
    PERFORMANCE = "performance"
    COMPATIBILITY = "compatibility"


class Severity(str, Enum):
    """Severity levels for security findings.

    Ordered from most to least severe.
    """

    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"

    def is_blocking(self) -> bool:
        """Check if this severity level blocks deployment.

        Returns:
            bool: True if severity is critical or high.
        """
        return self in (Severity.CRITICAL, Severity.HIGH)


class SecurityCategory(str, Enum):
    """Categories for security findings."""

    INJECTION = "injection"
    XSS = "xss"
    SECRETS = "secrets"
    AUTH = "auth"
    CRYPTO = "crypto"
    CONFIGURATION = "configuration"
    OTHER = "other"


@dataclass
class ValidationCheck:
    """Individual validation check result.

    Attributes:
        name: Name of the validation check.
        category: Category of the check (functional, performance, compatibility).
        passed: Whether the check passed.
        details: Detailed description of the check result.
        evidence: Optional evidence file or log reference.
    """

    name: str
    category: CheckCategory
    passed: bool
    details: str
    evidence: str | None

    def to_dict(self) -> dict[str, Any]:
        """Serialize validation check to dictionary.

        Returns:
            dict: Dictionary representation.
        """
        return {
            "name": self.name,
            "category": self.category.value,
            "passed": self.passed,
            "details": self.details,
            "evidence": self.evidence,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ValidationCheck:
        """Create validation check from dictionary.

        Args:
            data: Dictionary with check data.

        Returns:
            ValidationCheck: New instance.
        """
        return cls(
            name=data.get("name", ""),
            category=CheckCategory(data.get("category", "functional")),
            passed=data.get("passed", False),
            details=data.get("details", ""),
            evidence=data.get("evidence"),
        )


@dataclass
class ValidationReport:
    """Complete validation report for a feature.

    Attributes:
        feature_id: Feature being validated.
        checks: List of validation checks performed.
        e2e_results: E2E test run results.
        passed: Whether overall validation passed.
        recommendations: List of recommendations for improvement.
    """

    feature_id: str
    checks: list[ValidationCheck]
    e2e_results: TestRunResult
    passed: bool
    recommendations: list[str]

    def to_dict(self) -> dict[str, Any]:
        """Serialize validation report to dictionary.

        Returns:
            dict: Dictionary representation.
        """
        return {
            "feature_id": self.feature_id,
            "checks": [check.to_dict() for check in self.checks],
            "e2e_results": self.e2e_results.to_dict(),
            "passed": self.passed,
            "recommendations": self.recommendations,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ValidationReport:
        """Create validation report from dictionary.

        Args:
            data: Dictionary with report data.

        Returns:
            ValidationReport: New instance.
        """
        return cls(
            feature_id=data.get("feature_id", ""),
            checks=[ValidationCheck.from_dict(c) for c in data.get("checks", [])],
            e2e_results=TestRunResult.from_dict(data.get("e2e_results", {})),
            passed=data.get("passed", False),
            recommendations=data.get("recommendations", []),
        )

    def to_json(self, indent: int = 2) -> str:
        """Serialize to JSON string.

        Args:
            indent: JSON indentation level.

        Returns:
            str: JSON string representation.
        """
        return json.dumps(self.to_dict(), indent=indent)

    @classmethod
    def from_json(cls, json_str: str) -> ValidationReport:
        """Create from JSON string.

        Args:
            json_str: JSON string.

        Returns:
            ValidationReport: New instance.
        """
        return cls.from_dict(json.loads(json_str))

    def to_markdown(self) -> str:
        """Format validation report as markdown.

        Returns:
            str: Markdown formatted report.
        """
        status = "PASSED" if self.passed else "FAILED"
        lines = [
            "# Validation Report",
            "",
            f"**Feature:** {self.feature_id}",
            f"**Status:** {status}",
            "",
            "## E2E Test Results",
            "",
            f"- **Passed:** {self.e2e_results.passed}",
            f"- **Failed:** {self.e2e_results.failed}",
            f"- **Coverage:** {self.e2e_results.coverage:.1f}%",
            "",
        ]

        if self.checks:
            lines.extend(["## Validation Checks", ""])
            for check in self.checks:
                check_status = "PASSED" if check.passed else "FAILED"
                lines.extend([
                    f"### {check.name}",
                    "",
                    f"**Category:** {check.category.value.title()}",
                    f"**Status:** {check_status}",
                    "",
                    check.details,
                    "",
                ])
                if check.evidence:
                    lines.append(f"**Evidence:** {check.evidence}")
                    lines.append("")

        if self.recommendations:
            lines.extend(["## Recommendations", ""])
            for rec in self.recommendations:
                lines.append(f"- {rec}")
            lines.append("")

        return "\n".join(lines)


@dataclass
class SecurityFinding:
    """Individual security finding.

    Attributes:
        id: Unique finding identifier.
        severity: Severity level of the finding.
        category: Security category (injection, xss, secrets, etc.).
        location: File and line location of the finding.
        description: Description of the security issue.
        remediation: Suggested remediation steps.
    """

    id: str
    severity: Severity
    category: SecurityCategory
    location: str
    description: str
    remediation: str

    def is_blocking(self) -> bool:
        """Check if this finding blocks deployment.

        Returns:
            bool: True if severity is blocking (critical or high).
        """
        return self.severity.is_blocking()

    def to_dict(self) -> dict[str, Any]:
        """Serialize security finding to dictionary.

        Returns:
            dict: Dictionary representation.
        """
        return {
            "id": self.id,
            "severity": self.severity.value,
            "category": self.category.value,
            "location": self.location,
            "description": self.description,
            "remediation": self.remediation,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> SecurityFinding:
        """Create security finding from dictionary.

        Args:
            data: Dictionary with finding data.

        Returns:
            SecurityFinding: New instance.
        """
        return cls(
            id=data.get("id", ""),
            severity=Severity(data.get("severity", "info")),
            category=SecurityCategory(data.get("category", "other")),
            location=data.get("location", ""),
            description=data.get("description", ""),
            remediation=data.get("remediation", ""),
        )


@dataclass
class SecurityReport:
    """Complete security report for a feature.

    Attributes:
        feature_id: Feature being scanned.
        findings: List of security findings.
        passed: Whether security check passed (no critical/high findings).
        scan_coverage: Percentage of code scanned.
        compliance_status: Dict of compliance framework statuses.
    """

    feature_id: str
    findings: list[SecurityFinding]
    passed: bool
    scan_coverage: float
    compliance_status: dict[str, bool]

    def has_blocking_findings(self) -> bool:
        """Check if any findings are blocking (critical or high).

        Returns:
            bool: True if any blocking findings exist.
        """
        return any(finding.is_blocking() for finding in self.findings)

    def to_dict(self) -> dict[str, Any]:
        """Serialize security report to dictionary.

        Returns:
            dict: Dictionary representation.
        """
        return {
            "feature_id": self.feature_id,
            "findings": [finding.to_dict() for finding in self.findings],
            "passed": self.passed,
            "scan_coverage": self.scan_coverage,
            "compliance_status": self.compliance_status,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> SecurityReport:
        """Create security report from dictionary.

        Args:
            data: Dictionary with report data.

        Returns:
            SecurityReport: New instance.
        """
        return cls(
            feature_id=data.get("feature_id", ""),
            findings=[
                SecurityFinding.from_dict(f) for f in data.get("findings", [])
            ],
            passed=data.get("passed", False),
            scan_coverage=data.get("scan_coverage", 0.0),
            compliance_status=data.get("compliance_status", {}),
        )

    def to_json(self, indent: int = 2) -> str:
        """Serialize to JSON string.

        Args:
            indent: JSON indentation level.

        Returns:
            str: JSON string representation.
        """
        return json.dumps(self.to_dict(), indent=indent)

    @classmethod
    def from_json(cls, json_str: str) -> SecurityReport:
        """Create from JSON string.

        Args:
            json_str: JSON string.

        Returns:
            SecurityReport: New instance.
        """
        return cls.from_dict(json.loads(json_str))

    def to_markdown(self) -> str:
        """Format security report as markdown.

        Returns:
            str: Markdown formatted report.
        """
        status = "PASSED" if self.passed else "FAILED"
        lines = [
            "# Security Report",
            "",
            f"**Feature:** {self.feature_id}",
            f"**Status:** {status}",
            f"**Scan Coverage:** {self.scan_coverage:.1f}%",
            "",
        ]

        if self.findings:
            lines.extend(["## Findings", ""])
            for finding in self.findings:
                lines.extend([
                    f"### {finding.id}: {finding.description}",
                    "",
                    f"**Severity:** {finding.severity.value.upper()}",
                    f"**Category:** {finding.category.value.title()}",
                    f"**Location:** {finding.location}",
                    "",
                    f"**Remediation:** {finding.remediation}",
                    "",
                ])
        else:
            lines.extend(["## Findings", "", "No security findings.", ""])

        if self.compliance_status:
            lines.extend(["## Compliance Status", ""])
            for framework, compliant in self.compliance_status.items():
                status_icon = "PASS" if compliant else "FAIL"
                lines.append(f"- **{framework}:** {status_icon}")
            lines.append("")

        return "\n".join(lines)
