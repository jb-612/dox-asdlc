"""Pydantic models for Parallel Review Swarm.

This module defines data models for the swarm review system including
severity levels, swarm status, review findings, and unified reports.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class Severity(str, Enum):
    """Severity levels for review findings.

    Ordered from most to least severe:
    - CRITICAL: Security vulnerabilities or bugs that cause data loss
    - HIGH: Major bugs or security issues
    - MEDIUM: Moderate issues that should be fixed
    - LOW: Minor issues or improvements
    - INFO: Informational notes or suggestions
    """

    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFO = "INFO"


class SwarmStatus(str, Enum):
    """Status of a swarm review session.

    Status transitions:
    PENDING -> IN_PROGRESS -> AGGREGATING -> COMPLETE
                          |-> FAILED
    """

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    AGGREGATING = "aggregating"
    COMPLETE = "complete"
    FAILED = "failed"


class ReviewFinding(BaseModel):
    """A single finding from a code reviewer.

    Attributes:
        id: Unique identifier (format: finding-{uuid8})
        reviewer_type: Type of reviewer that found this issue
        severity: Severity level of the finding
        category: Category of the finding (e.g., 'injection', 'complexity')
        title: Brief title describing the finding
        description: Detailed description of the finding
        file_path: Path to the file containing the issue
        line_start: Starting line number of the issue
        line_end: Ending line number (optional)
        code_snippet: Relevant code snippet (optional)
        recommendation: Suggested fix or improvement
        confidence: Confidence score between 0.0 and 1.0
    """

    id: str = Field(..., description="Unique identifier (format: finding-{uuid8})")
    reviewer_type: str = Field(..., description="Type of reviewer that found this issue")
    severity: Severity = Field(..., description="Severity level of the finding")
    category: str = Field(..., description="Category of the finding")
    title: str = Field(..., description="Brief title describing the finding")
    description: str = Field(..., description="Detailed description of the finding")
    file_path: str = Field(..., description="Path to the file containing the issue")
    line_start: int = Field(..., description="Starting line number of the issue")
    line_end: int | None = Field(default=None, description="Ending line number")
    code_snippet: str | None = Field(default=None, description="Relevant code snippet")
    recommendation: str = Field(..., description="Suggested fix or improvement")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score (0.0-1.0)")

    model_config = {"use_enum_values": True}


class ReviewerResult(BaseModel):
    """Result from a single reviewer's analysis.

    Attributes:
        reviewer_type: Type of reviewer (e.g., 'security', 'performance', 'style')
        status: Result status ('success', 'failed', 'timeout')
        findings: List of findings from this reviewer
        duration_seconds: Time taken for the review
        files_reviewed: List of files that were reviewed
        error_message: Error message if status is 'failed' or 'timeout'
    """

    reviewer_type: str = Field(..., description="Type of reviewer")
    status: str = Field(..., description="Result status (success/failed/timeout)")
    findings: list[ReviewFinding] = Field(
        default_factory=list, description="List of findings"
    )
    duration_seconds: float = Field(..., description="Time taken for the review")
    files_reviewed: list[str] = Field(
        default_factory=list, description="List of files reviewed"
    )
    error_message: str | None = Field(
        default=None, description="Error message if review failed"
    )


class UnifiedReport(BaseModel):
    """Unified report aggregating findings from all reviewers.

    Attributes:
        swarm_id: ID of the swarm session that produced this report
        target_path: Path that was reviewed
        created_at: Timestamp when the report was created
        reviewers_completed: List of reviewers that completed successfully
        reviewers_failed: List of reviewers that failed
        critical_findings: Findings with CRITICAL severity
        high_findings: Findings with HIGH severity
        medium_findings: Findings with MEDIUM severity
        low_findings: Findings with LOW severity
        info_findings: Findings with INFO severity
        total_findings: Total count of all findings
        findings_by_reviewer: Count of findings per reviewer
        findings_by_category: Count of findings per category
        duplicates_removed: Number of duplicate findings removed
    """

    swarm_id: str = Field(..., description="ID of the swarm session")
    target_path: str = Field(..., description="Path that was reviewed")
    created_at: datetime = Field(..., description="Report creation timestamp")
    reviewers_completed: list[str] = Field(
        default_factory=list, description="Reviewers that completed"
    )
    reviewers_failed: list[str] = Field(
        default_factory=list, description="Reviewers that failed"
    )
    critical_findings: list[ReviewFinding] = Field(
        default_factory=list, description="CRITICAL severity findings"
    )
    high_findings: list[ReviewFinding] = Field(
        default_factory=list, description="HIGH severity findings"
    )
    medium_findings: list[ReviewFinding] = Field(
        default_factory=list, description="MEDIUM severity findings"
    )
    low_findings: list[ReviewFinding] = Field(
        default_factory=list, description="LOW severity findings"
    )
    info_findings: list[ReviewFinding] = Field(
        default_factory=list, description="INFO severity findings"
    )
    total_findings: int = Field(default=0, description="Total finding count")
    findings_by_reviewer: dict[str, int] = Field(
        default_factory=dict, description="Findings count per reviewer"
    )
    findings_by_category: dict[str, int] = Field(
        default_factory=dict, description="Findings count per category"
    )
    duplicates_removed: int = Field(
        default=0, description="Number of duplicates removed"
    )


class SwarmSession(BaseModel):
    """A parallel review swarm session.

    Attributes:
        id: Unique session identifier (format: swarm-{uuid8})
        target_path: Path to review
        reviewers: List of reviewer types to use
        status: Current session status
        created_at: Session creation timestamp
        completed_at: Session completion timestamp (optional)
        results: Results from each reviewer, keyed by reviewer_type
        unified_report: Final aggregated report (optional)
    """

    id: str = Field(..., description="Session ID (format: swarm-{uuid8})")
    target_path: str = Field(..., description="Path to review")
    reviewers: list[str] = Field(..., description="List of reviewer types")
    status: SwarmStatus = Field(..., description="Current session status")
    created_at: datetime = Field(..., description="Session creation timestamp")
    completed_at: datetime | None = Field(
        default=None, description="Session completion timestamp"
    )
    results: dict[str, ReviewerResult] = Field(
        default_factory=dict, description="Results per reviewer"
    )
    unified_report: UnifiedReport | None = Field(
        default=None, description="Final aggregated report"
    )
    error_message: str | None = Field(
        default=None, description="Error message if session failed"
    )

    model_config = {"use_enum_values": True}
