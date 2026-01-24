"""Domain models for Development agents.

Defines data structures for test suites, implementations, test results,
code reviews, and debug analyses produced by the development phase agents.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any


class TestType(str, Enum):
    """Types of tests."""

    UNIT = "unit"
    INTEGRATION = "integration"
    E2E = "e2e"


class IssueSeverity(str, Enum):
    """Severity levels for review issues."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class TestCase:
    """Individual test case.

    Attributes:
        id: Unique test case identifier.
        name: Test function name.
        description: Description of what the test validates.
        test_type: Type of test (unit, integration, e2e).
        code: Test code as a string.
        requirement_ref: Reference to requirement this test validates.
        metadata: Additional test metadata.
    """

    id: str
    name: str
    description: str
    test_type: TestType
    code: str
    requirement_ref: str
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Serialize test case to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "test_type": self.test_type.value,
            "code": self.code,
            "requirement_ref": self.requirement_ref,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> TestCase:
        """Create test case from dictionary."""
        return cls(
            id=data.get("id", ""),
            name=data.get("name", ""),
            description=data.get("description", ""),
            test_type=TestType(data.get("test_type", "unit")),
            code=data.get("code", ""),
            requirement_ref=data.get("requirement_ref", ""),
            metadata=data.get("metadata", {}),
        )


@dataclass
class TestSuite:
    """Collection of test cases for a task.

    Attributes:
        task_id: Task this test suite is for.
        test_cases: List of test cases.
        setup_code: Setup code to run before tests.
        teardown_code: Teardown code to run after tests.
        fixtures: List of pytest fixture names.
        metadata: Additional metadata.
    """

    task_id: str
    test_cases: list[TestCase]
    setup_code: str
    teardown_code: str
    fixtures: list[str]
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Serialize test suite to dictionary."""
        return {
            "task_id": self.task_id,
            "test_cases": [tc.to_dict() for tc in self.test_cases],
            "setup_code": self.setup_code,
            "teardown_code": self.teardown_code,
            "fixtures": self.fixtures,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> TestSuite:
        """Create test suite from dictionary."""
        return cls(
            task_id=data.get("task_id", ""),
            test_cases=[
                TestCase.from_dict(tc) for tc in data.get("test_cases", [])
            ],
            setup_code=data.get("setup_code", ""),
            teardown_code=data.get("teardown_code", ""),
            fixtures=data.get("fixtures", []),
            metadata=data.get("metadata", {}),
        )

    def to_json(self, indent: int = 2) -> str:
        """Serialize to JSON string."""
        return json.dumps(self.to_dict(), indent=indent)

    @classmethod
    def from_json(cls, json_str: str) -> TestSuite:
        """Create from JSON string."""
        return cls.from_dict(json.loads(json_str))

    def to_python_code(self) -> str:
        """Generate Python test code from test suite.

        Returns:
            str: Complete Python test file content.
        """
        lines = [
            '"""Auto-generated tests for task: {}"""'.format(self.task_id),
            "",
        ]

        # Add setup code
        if self.setup_code:
            lines.append(self.setup_code)
            lines.append("")

        # Add fixtures reference comment
        if self.fixtures:
            lines.append(f"# Fixtures used: {', '.join(self.fixtures)}")
            lines.append("")

        # Add test cases
        for test_case in self.test_cases:
            lines.append(f"# {test_case.id}: {test_case.description}")
            lines.append(test_case.code)
            lines.append("")

        # Add teardown code
        if self.teardown_code:
            lines.append(self.teardown_code)
            lines.append("")

        return "\n".join(lines)


@dataclass
class CodeFile:
    """A single code file in an implementation.

    Attributes:
        path: Relative file path.
        content: File content.
        language: Programming language.
        metadata: Additional file metadata.
    """

    path: str
    content: str
    language: str = "python"
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Serialize code file to dictionary."""
        return {
            "path": self.path,
            "content": self.content,
            "language": self.language,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> CodeFile:
        """Create code file from dictionary."""
        return cls(
            path=data.get("path", ""),
            content=data.get("content", ""),
            language=data.get("language", "python"),
            metadata=data.get("metadata", {}),
        )


@dataclass
class Implementation:
    """Implementation code for a task.

    Attributes:
        task_id: Task this implementation is for.
        files: List of code files.
        imports: List of imports used.
        dependencies: External dependencies required.
        metadata: Additional metadata.
    """

    task_id: str
    files: list[CodeFile]
    imports: list[str]
    dependencies: list[str]
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Serialize implementation to dictionary."""
        return {
            "task_id": self.task_id,
            "files": [f.to_dict() for f in self.files],
            "imports": self.imports,
            "dependencies": self.dependencies,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Implementation:
        """Create implementation from dictionary."""
        return cls(
            task_id=data.get("task_id", ""),
            files=[CodeFile.from_dict(f) for f in data.get("files", [])],
            imports=data.get("imports", []),
            dependencies=data.get("dependencies", []),
            metadata=data.get("metadata", {}),
        )

    def to_json(self, indent: int = 2) -> str:
        """Serialize to JSON string."""
        return json.dumps(self.to_dict(), indent=indent)

    @classmethod
    def from_json(cls, json_str: str) -> Implementation:
        """Create from JSON string."""
        return cls.from_dict(json.loads(json_str))


@dataclass
class TestResult:
    """Result of running a single test.

    Attributes:
        test_id: ID of the test that was run.
        passed: Whether the test passed.
        output: Test output (stdout).
        error: Error message if test failed.
        duration_ms: Test duration in milliseconds.
        metadata: Additional result metadata.
    """

    test_id: str
    passed: bool
    output: str
    error: str | None
    duration_ms: int
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Serialize test result to dictionary."""
        return {
            "test_id": self.test_id,
            "passed": self.passed,
            "output": self.output,
            "error": self.error,
            "duration_ms": self.duration_ms,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> TestResult:
        """Create test result from dictionary."""
        return cls(
            test_id=data.get("test_id", ""),
            passed=data.get("passed", False),
            output=data.get("output", ""),
            error=data.get("error"),
            duration_ms=data.get("duration_ms", 0),
            metadata=data.get("metadata", {}),
        )


@dataclass
class TestRunResult:
    """Result of running a complete test suite.

    Attributes:
        suite_id: ID of the test suite that was run.
        results: Individual test results.
        passed: Number of passed tests.
        failed: Number of failed tests.
        coverage: Code coverage percentage.
        created_at: When the test run was executed.
        metadata: Additional result metadata.
    """

    suite_id: str
    results: list[TestResult]
    passed: int
    failed: int
    coverage: float
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: dict[str, Any] = field(default_factory=dict)

    def all_passed(self) -> bool:
        """Check if all tests passed.

        Returns:
            bool: True if all tests passed, False otherwise.
        """
        return self.failed == 0

    def to_dict(self) -> dict[str, Any]:
        """Serialize test run result to dictionary."""
        return {
            "suite_id": self.suite_id,
            "results": [r.to_dict() for r in self.results],
            "passed": self.passed,
            "failed": self.failed,
            "coverage": self.coverage,
            "created_at": self.created_at.isoformat(),
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> TestRunResult:
        """Create test run result from dictionary."""
        return cls(
            suite_id=data.get("suite_id", ""),
            results=[TestResult.from_dict(r) for r in data.get("results", [])],
            passed=data.get("passed", 0),
            failed=data.get("failed", 0),
            coverage=data.get("coverage", 0.0),
            created_at=datetime.fromisoformat(
                data.get("created_at", datetime.now(timezone.utc).isoformat())
            ),
            metadata=data.get("metadata", {}),
        )


@dataclass
class ReviewIssue:
    """Issue identified during code review.

    Attributes:
        id: Unique issue identifier.
        description: Issue description.
        severity: Issue severity level.
        file_path: File where issue was found.
        line_number: Line number of the issue.
        suggestion: Suggested fix.
        metadata: Additional issue metadata.
    """

    id: str
    description: str
    severity: IssueSeverity
    file_path: str
    line_number: int
    suggestion: str
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Serialize review issue to dictionary."""
        return {
            "id": self.id,
            "description": self.description,
            "severity": self.severity.value,
            "file_path": self.file_path,
            "line_number": self.line_number,
            "suggestion": self.suggestion,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ReviewIssue:
        """Create review issue from dictionary."""
        return cls(
            id=data.get("id", ""),
            description=data.get("description", ""),
            severity=IssueSeverity(data.get("severity", "medium")),
            file_path=data.get("file_path", ""),
            line_number=data.get("line_number", 0),
            suggestion=data.get("suggestion", ""),
            metadata=data.get("metadata", {}),
        )


@dataclass
class CodeReview:
    """Complete code review result.

    Attributes:
        implementation_id: ID of the implementation reviewed.
        passed: Whether the review passed.
        issues: List of issues found.
        suggestions: General improvement suggestions.
        security_concerns: Security-related concerns.
        created_at: When the review was performed.
        metadata: Additional review metadata.
    """

    implementation_id: str
    passed: bool
    issues: list[ReviewIssue]
    suggestions: list[str]
    security_concerns: list[str]
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Serialize code review to dictionary."""
        return {
            "implementation_id": self.implementation_id,
            "passed": self.passed,
            "issues": [i.to_dict() for i in self.issues],
            "suggestions": self.suggestions,
            "security_concerns": self.security_concerns,
            "created_at": self.created_at.isoformat(),
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> CodeReview:
        """Create code review from dictionary."""
        return cls(
            implementation_id=data.get("implementation_id", ""),
            passed=data.get("passed", False),
            issues=[ReviewIssue.from_dict(i) for i in data.get("issues", [])],
            suggestions=data.get("suggestions", []),
            security_concerns=data.get("security_concerns", []),
            created_at=datetime.fromisoformat(
                data.get("created_at", datetime.now(timezone.utc).isoformat())
            ),
            metadata=data.get("metadata", {}),
        )

    def to_json(self, indent: int = 2) -> str:
        """Serialize to JSON string."""
        return json.dumps(self.to_dict(), indent=indent)

    @classmethod
    def from_json(cls, json_str: str) -> CodeReview:
        """Create from JSON string."""
        return cls.from_dict(json.loads(json_str))

    def to_markdown(self) -> str:
        """Format code review as markdown.

        Returns:
            str: Markdown formatted review.
        """
        status = "PASSED" if self.passed else "FAILED"
        lines = [
            "# Code Review",
            "",
            f"**Implementation:** {self.implementation_id}",
            f"**Status:** {status}",
            f"**Date:** {self.created_at.strftime('%Y-%m-%d')}",
            "",
        ]

        if self.issues:
            lines.extend(["## Issues", ""])
            for issue in self.issues:
                lines.extend([
                    f"### {issue.id}: {issue.description}",
                    "",
                    f"**Severity:** {issue.severity.value.upper()}",
                    f"**Location:** {issue.file_path}:{issue.line_number}",
                    "",
                    f"**Suggestion:** {issue.suggestion}",
                    "",
                ])

        if self.suggestions:
            lines.extend(["## Suggestions", ""])
            for suggestion in self.suggestions:
                lines.append(f"- {suggestion}")
            lines.append("")

        if self.security_concerns:
            lines.extend(["## Security Concerns", ""])
            for concern in self.security_concerns:
                lines.append(f"- {concern}")
            lines.append("")

        return "\n".join(lines)


@dataclass
class CodeChange:
    """A code change for fixing an issue.

    Attributes:
        file_path: File to modify.
        original_code: Original code to replace.
        new_code: New code to insert.
        description: Description of the change.
        line_start: Starting line number.
        line_end: Ending line number.
        metadata: Additional change metadata.
    """

    file_path: str
    original_code: str
    new_code: str
    description: str
    line_start: int
    line_end: int
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Serialize code change to dictionary."""
        return {
            "file_path": self.file_path,
            "original_code": self.original_code,
            "new_code": self.new_code,
            "description": self.description,
            "line_start": self.line_start,
            "line_end": self.line_end,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> CodeChange:
        """Create code change from dictionary."""
        return cls(
            file_path=data.get("file_path", ""),
            original_code=data.get("original_code", ""),
            new_code=data.get("new_code", ""),
            description=data.get("description", ""),
            line_start=data.get("line_start", 0),
            line_end=data.get("line_end", 0),
            metadata=data.get("metadata", {}),
        )


@dataclass
class DebugAnalysis:
    """Analysis and fix suggestions from debugger.

    Attributes:
        failure_id: ID of the failure being analyzed.
        root_cause: Root cause analysis.
        fix_suggestion: Suggested fix description.
        code_changes: Specific code changes to apply.
        created_at: When the analysis was performed.
        metadata: Additional analysis metadata.
    """

    failure_id: str
    root_cause: str
    fix_suggestion: str
    code_changes: list[CodeChange]
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Serialize debug analysis to dictionary."""
        return {
            "failure_id": self.failure_id,
            "root_cause": self.root_cause,
            "fix_suggestion": self.fix_suggestion,
            "code_changes": [c.to_dict() for c in self.code_changes],
            "created_at": self.created_at.isoformat(),
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> DebugAnalysis:
        """Create debug analysis from dictionary."""
        return cls(
            failure_id=data.get("failure_id", ""),
            root_cause=data.get("root_cause", ""),
            fix_suggestion=data.get("fix_suggestion", ""),
            code_changes=[
                CodeChange.from_dict(c) for c in data.get("code_changes", [])
            ],
            created_at=datetime.fromisoformat(
                data.get("created_at", datetime.now(timezone.utc).isoformat())
            ),
            metadata=data.get("metadata", {}),
        )

    def to_json(self, indent: int = 2) -> str:
        """Serialize to JSON string."""
        return json.dumps(self.to_dict(), indent=indent)

    @classmethod
    def from_json(cls, json_str: str) -> DebugAnalysis:
        """Create from JSON string."""
        return cls.from_dict(json.loads(json_str))

    def to_markdown(self) -> str:
        """Format debug analysis as markdown.

        Returns:
            str: Markdown formatted analysis.
        """
        lines = [
            "# Debug Analysis",
            "",
            f"**Failure ID:** {self.failure_id}",
            f"**Date:** {self.created_at.strftime('%Y-%m-%d')}",
            "",
            "## Root Cause",
            "",
            self.root_cause,
            "",
            "## Suggested Fix",
            "",
            self.fix_suggestion,
            "",
        ]

        if self.code_changes:
            lines.extend(["## Code Changes", ""])
            for i, change in enumerate(self.code_changes, 1):
                lines.extend([
                    f"### Change {i}: {change.description}",
                    "",
                    f"**File:** {change.file_path}",
                    f"**Lines:** {change.line_start}-{change.line_end}",
                    "",
                    "**Original:**",
                    "```",
                    change.original_code,
                    "```",
                    "",
                    "**New:**",
                    "```",
                    change.new_code,
                    "```",
                    "",
                ])

        return "\n".join(lines)


@dataclass
class DevelopmentResult:
    """Result from the development TDD workflow.

    Attributes:
        success: Whether development completed successfully.
        implementation: Generated implementation (if successful).
        test_suite: Generated test suite (if successful).
        test_result: Test run results (if tests were run).
        review: Code review (if review was performed).
        debug_analysis: Debug analysis (if debugger was invoked).
        error_message: Error description (if failed).
        hitl4_request_id: HITL-4 gate request ID.
        retry_count: Number of coding retries performed.
        metadata: Additional result metadata.
    """

    success: bool
    implementation: Implementation | None = None
    test_suite: TestSuite | None = None
    test_result: TestRunResult | None = None
    review: CodeReview | None = None
    debug_analysis: DebugAnalysis | None = None
    error_message: str | None = None
    hitl4_request_id: str | None = None
    retry_count: int = 0
    metadata: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def succeeded(
        cls,
        implementation: Implementation,
        test_suite: TestSuite,
        test_result: TestRunResult,
        review: CodeReview,
        hitl4_request_id: str | None = None,
    ) -> DevelopmentResult:
        """Create successful result."""
        return cls(
            success=True,
            implementation=implementation,
            test_suite=test_suite,
            test_result=test_result,
            review=review,
            hitl4_request_id=hitl4_request_id,
        )

    @classmethod
    def failed(cls, error_message: str, retry_count: int = 0) -> DevelopmentResult:
        """Create failed result."""
        return cls(
            success=False,
            error_message=error_message,
            retry_count=retry_count,
        )

    @classmethod
    def pending_hitl4(
        cls,
        implementation: Implementation,
        hitl4_request_id: str,
    ) -> DevelopmentResult:
        """Create result pending HITL-4 approval."""
        return cls(
            success=True,
            implementation=implementation,
            hitl4_request_id=hitl4_request_id,
            metadata={"status": "pending_hitl4"},
        )

    def to_dict(self) -> dict[str, Any]:
        """Serialize to dictionary."""
        return {
            "success": self.success,
            "implementation": (
                self.implementation.to_dict() if self.implementation else None
            ),
            "test_suite": self.test_suite.to_dict() if self.test_suite else None,
            "test_result": self.test_result.to_dict() if self.test_result else None,
            "review": self.review.to_dict() if self.review else None,
            "debug_analysis": (
                self.debug_analysis.to_dict() if self.debug_analysis else None
            ),
            "error_message": self.error_message,
            "hitl4_request_id": self.hitl4_request_id,
            "retry_count": self.retry_count,
            "metadata": self.metadata,
        }
