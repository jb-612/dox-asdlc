"""Unit tests for development models."""

from __future__ import annotations

import json
from datetime import datetime, timezone

import pytest

from src.workers.agents.development.models import (
    TestCase,
    TestType,
    TestSuite,
    CodeFile,
    Implementation,
    TestResult,
    TestRunResult,
    ReviewIssue,
    IssueSeverity,
    CodeReview,
    CodeChange,
    DebugAnalysis,
    DevelopmentResult,
)


class TestTestCase:
    """Tests for TestCase model."""

    def test_test_case_creation(self) -> None:
        """Test that test case can be created with required fields."""
        test_case = TestCase(
            id="TC-001",
            name="test_user_login",
            description="Test that user can login with valid credentials",
            test_type=TestType.UNIT,
            code="def test_user_login():\n    assert True",
            requirement_ref="REQ-001",
        )

        assert test_case.id == "TC-001"
        assert test_case.name == "test_user_login"
        assert test_case.test_type == TestType.UNIT
        assert "def test_user_login" in test_case.code
        assert test_case.requirement_ref == "REQ-001"

    def test_test_case_to_dict(self) -> None:
        """Test that test case serializes to dictionary."""
        test_case = TestCase(
            id="TC-001",
            name="test_login",
            description="Test login",
            test_type=TestType.INTEGRATION,
            code="def test_login(): pass",
            requirement_ref="REQ-001",
        )

        result = test_case.to_dict()

        assert result["id"] == "TC-001"
        assert result["name"] == "test_login"
        assert result["test_type"] == "integration"
        assert result["code"] == "def test_login(): pass"
        assert result["requirement_ref"] == "REQ-001"

    def test_test_case_from_dict(self) -> None:
        """Test that test case deserializes from dictionary."""
        data = {
            "id": "TC-002",
            "name": "test_logout",
            "description": "Test logout",
            "test_type": "e2e",
            "code": "def test_logout(): pass",
            "requirement_ref": "REQ-002",
        }

        test_case = TestCase.from_dict(data)

        assert test_case.id == "TC-002"
        assert test_case.name == "test_logout"
        assert test_case.test_type == TestType.E2E


class TestTestSuite:
    """Tests for TestSuite model."""

    def test_test_suite_creation(self) -> None:
        """Test that test suite can be created."""
        test_cases = [
            TestCase(
                id="TC-001",
                name="test_one",
                description="First test",
                test_type=TestType.UNIT,
                code="def test_one(): pass",
                requirement_ref="REQ-001",
            ),
        ]

        suite = TestSuite(
            task_id="TASK-001",
            test_cases=test_cases,
            setup_code="import pytest",
            teardown_code="",
            fixtures=["db_fixture"],
        )

        assert suite.task_id == "TASK-001"
        assert len(suite.test_cases) == 1
        assert "db_fixture" in suite.fixtures

    def test_test_suite_to_dict(self) -> None:
        """Test that test suite serializes to dictionary."""
        suite = TestSuite(
            task_id="TASK-001",
            test_cases=[],
            setup_code="",
            teardown_code="",
            fixtures=[],
        )

        result = suite.to_dict()

        assert result["task_id"] == "TASK-001"
        assert "test_cases" in result

    def test_test_suite_from_dict(self) -> None:
        """Test that test suite deserializes from dictionary."""
        data = {
            "task_id": "TASK-002",
            "test_cases": [],
            "setup_code": "setup",
            "teardown_code": "teardown",
            "fixtures": ["fixture1"],
        }

        suite = TestSuite.from_dict(data)

        assert suite.task_id == "TASK-002"
        assert suite.fixtures == ["fixture1"]

    def test_test_suite_to_python_code(self) -> None:
        """Test that test suite generates valid Python test code."""
        test_cases = [
            TestCase(
                id="TC-001",
                name="test_example",
                description="Example test",
                test_type=TestType.UNIT,
                code="def test_example():\n    assert 1 + 1 == 2",
                requirement_ref="REQ-001",
            ),
        ]

        suite = TestSuite(
            task_id="TASK-001",
            test_cases=test_cases,
            setup_code="import pytest",
            teardown_code="",
            fixtures=[],
        )

        code = suite.to_python_code()

        assert "import pytest" in code
        assert "def test_example" in code


class TestCodeFile:
    """Tests for CodeFile model."""

    def test_code_file_creation(self) -> None:
        """Test that code file can be created."""
        code_file = CodeFile(
            path="src/module.py",
            content="class MyClass:\n    pass",
            language="python",
        )

        assert code_file.path == "src/module.py"
        assert "class MyClass" in code_file.content
        assert code_file.language == "python"

    def test_code_file_to_dict(self) -> None:
        """Test that code file serializes to dictionary."""
        code_file = CodeFile(
            path="test.py",
            content="# test",
            language="python",
        )

        result = code_file.to_dict()

        assert result["path"] == "test.py"
        assert result["content"] == "# test"

    def test_code_file_from_dict(self) -> None:
        """Test that code file deserializes from dictionary."""
        data = {
            "path": "module.py",
            "content": "# module",
            "language": "python",
        }

        code_file = CodeFile.from_dict(data)

        assert code_file.path == "module.py"


class TestImplementation:
    """Tests for Implementation model."""

    def test_implementation_creation(self) -> None:
        """Test that implementation can be created."""
        files = [
            CodeFile(path="src/main.py", content="# main", language="python"),
        ]

        impl = Implementation(
            task_id="TASK-001",
            files=files,
            imports=["os", "sys"],
            dependencies=["requests"],
        )

        assert impl.task_id == "TASK-001"
        assert len(impl.files) == 1
        assert "os" in impl.imports

    def test_implementation_to_dict(self) -> None:
        """Test that implementation serializes to dictionary."""
        impl = Implementation(
            task_id="TASK-001",
            files=[],
            imports=[],
            dependencies=[],
        )

        result = impl.to_dict()

        assert result["task_id"] == "TASK-001"

    def test_implementation_from_dict(self) -> None:
        """Test that implementation deserializes from dictionary."""
        data = {
            "task_id": "TASK-002",
            "files": [{"path": "test.py", "content": "#", "language": "python"}],
            "imports": ["typing"],
            "dependencies": [],
        }

        impl = Implementation.from_dict(data)

        assert impl.task_id == "TASK-002"
        assert len(impl.files) == 1


class TestTestResult:
    """Tests for TestResult model."""

    def test_test_result_creation(self) -> None:
        """Test that test result can be created."""
        result = TestResult(
            test_id="TC-001",
            passed=True,
            output="Test passed successfully",
            error=None,
            duration_ms=150,
        )

        assert result.test_id == "TC-001"
        assert result.passed is True
        assert result.duration_ms == 150

    def test_test_result_failed(self) -> None:
        """Test that failed test result captures error."""
        result = TestResult(
            test_id="TC-002",
            passed=False,
            output="",
            error="AssertionError: expected True, got False",
            duration_ms=50,
        )

        assert result.passed is False
        assert "AssertionError" in result.error

    def test_test_result_to_dict(self) -> None:
        """Test that test result serializes to dictionary."""
        result = TestResult(
            test_id="TC-001",
            passed=True,
            output="ok",
            error=None,
            duration_ms=100,
        )

        data = result.to_dict()

        assert data["test_id"] == "TC-001"
        assert data["passed"] is True

    def test_test_result_from_dict(self) -> None:
        """Test that test result deserializes from dictionary."""
        data = {
            "test_id": "TC-003",
            "passed": False,
            "output": "failed",
            "error": "error",
            "duration_ms": 200,
        }

        result = TestResult.from_dict(data)

        assert result.test_id == "TC-003"
        assert result.passed is False


class TestTestRunResult:
    """Tests for TestRunResult model."""

    def test_test_run_result_creation(self) -> None:
        """Test that test run result can be created."""
        results = [
            TestResult(
                test_id="TC-001",
                passed=True,
                output="",
                error=None,
                duration_ms=100,
            ),
            TestResult(
                test_id="TC-002",
                passed=False,
                output="",
                error="error",
                duration_ms=100,
            ),
        ]

        run_result = TestRunResult(
            suite_id="SUITE-001",
            results=results,
            passed=1,
            failed=1,
            coverage=85.5,
        )

        assert run_result.suite_id == "SUITE-001"
        assert run_result.passed == 1
        assert run_result.failed == 1
        assert run_result.coverage == 85.5

    def test_test_run_result_all_passed(self) -> None:
        """Test that all_passed returns correct value."""
        results = [
            TestResult(
                test_id="TC-001", passed=True, output="", error=None, duration_ms=100
            ),
            TestResult(
                test_id="TC-002", passed=True, output="", error=None, duration_ms=100
            ),
        ]

        run_result = TestRunResult(
            suite_id="SUITE-001",
            results=results,
            passed=2,
            failed=0,
            coverage=100.0,
        )

        assert run_result.all_passed() is True

    def test_test_run_result_not_all_passed(self) -> None:
        """Test that all_passed returns false when there are failures."""
        run_result = TestRunResult(
            suite_id="SUITE-001",
            results=[],
            passed=1,
            failed=1,
            coverage=50.0,
        )

        assert run_result.all_passed() is False

    def test_test_run_result_to_dict(self) -> None:
        """Test that test run result serializes to dictionary."""
        run_result = TestRunResult(
            suite_id="SUITE-001",
            results=[],
            passed=5,
            failed=0,
            coverage=95.0,
        )

        data = run_result.to_dict()

        assert data["suite_id"] == "SUITE-001"
        assert data["coverage"] == 95.0


class TestReviewIssue:
    """Tests for ReviewIssue model."""

    def test_review_issue_creation(self) -> None:
        """Test that review issue can be created."""
        issue = ReviewIssue(
            id="ISS-001",
            description="Missing error handling",
            severity=IssueSeverity.MEDIUM,
            file_path="src/main.py",
            line_number=42,
            suggestion="Add try-except block",
        )

        assert issue.id == "ISS-001"
        assert issue.severity == IssueSeverity.MEDIUM
        assert issue.line_number == 42

    def test_review_issue_to_dict(self) -> None:
        """Test that review issue serializes to dictionary."""
        issue = ReviewIssue(
            id="ISS-001",
            description="Issue",
            severity=IssueSeverity.HIGH,
            file_path="test.py",
            line_number=1,
            suggestion="Fix it",
        )

        data = issue.to_dict()

        assert data["severity"] == "high"
        assert data["file_path"] == "test.py"

    def test_review_issue_from_dict(self) -> None:
        """Test that review issue deserializes from dictionary."""
        data = {
            "id": "ISS-002",
            "description": "Test issue",
            "severity": "critical",
            "file_path": "module.py",
            "line_number": 10,
            "suggestion": "Suggestion",
        }

        issue = ReviewIssue.from_dict(data)

        assert issue.severity == IssueSeverity.CRITICAL


class TestCodeReview:
    """Tests for CodeReview model."""

    def test_code_review_creation(self) -> None:
        """Test that code review can be created."""
        issues = [
            ReviewIssue(
                id="ISS-001",
                description="Issue",
                severity=IssueSeverity.LOW,
                file_path="test.py",
                line_number=1,
                suggestion="",
            ),
        ]

        review = CodeReview(
            implementation_id="IMPL-001",
            passed=True,
            issues=issues,
            suggestions=["Use type hints"],
            security_concerns=[],
        )

        assert review.implementation_id == "IMPL-001"
        assert review.passed is True
        assert len(review.issues) == 1

    def test_code_review_failed_with_critical_issues(self) -> None:
        """Test that code review fails with critical issues."""
        issues = [
            ReviewIssue(
                id="ISS-001",
                description="SQL injection vulnerability",
                severity=IssueSeverity.CRITICAL,
                file_path="test.py",
                line_number=1,
                suggestion="Use parameterized queries",
            ),
        ]

        review = CodeReview(
            implementation_id="IMPL-001",
            passed=False,
            issues=issues,
            suggestions=[],
            security_concerns=["SQL injection"],
        )

        assert review.passed is False
        assert len(review.security_concerns) == 1

    def test_code_review_to_dict(self) -> None:
        """Test that code review serializes to dictionary."""
        review = CodeReview(
            implementation_id="IMPL-001",
            passed=True,
            issues=[],
            suggestions=[],
            security_concerns=[],
        )

        data = review.to_dict()

        assert data["implementation_id"] == "IMPL-001"
        assert data["passed"] is True

    def test_code_review_from_dict(self) -> None:
        """Test that code review deserializes from dictionary."""
        data = {
            "implementation_id": "IMPL-002",
            "passed": False,
            "issues": [],
            "suggestions": ["Improve naming"],
            "security_concerns": [],
        }

        review = CodeReview.from_dict(data)

        assert review.implementation_id == "IMPL-002"
        assert "Improve naming" in review.suggestions

    def test_code_review_to_markdown(self) -> None:
        """Test that code review formats as markdown."""
        issues = [
            ReviewIssue(
                id="ISS-001",
                description="Missing docstring",
                severity=IssueSeverity.LOW,
                file_path="main.py",
                line_number=10,
                suggestion="Add docstring",
            ),
        ]

        review = CodeReview(
            implementation_id="IMPL-001",
            passed=True,
            issues=issues,
            suggestions=["Add type hints"],
            security_concerns=[],
        )

        md = review.to_markdown()

        assert "# Code Review" in md
        assert "ISS-001" in md
        assert "Missing docstring" in md


class TestCodeChange:
    """Tests for CodeChange model."""

    def test_code_change_creation(self) -> None:
        """Test that code change can be created."""
        change = CodeChange(
            file_path="src/main.py",
            original_code="x = 1",
            new_code="x = 2",
            description="Fix variable value",
            line_start=10,
            line_end=10,
        )

        assert change.file_path == "src/main.py"
        assert change.original_code == "x = 1"
        assert change.new_code == "x = 2"

    def test_code_change_to_dict(self) -> None:
        """Test that code change serializes to dictionary."""
        change = CodeChange(
            file_path="test.py",
            original_code="old",
            new_code="new",
            description="Change",
            line_start=1,
            line_end=1,
        )

        data = change.to_dict()

        assert data["file_path"] == "test.py"
        assert data["original_code"] == "old"

    def test_code_change_from_dict(self) -> None:
        """Test that code change deserializes from dictionary."""
        data = {
            "file_path": "module.py",
            "original_code": "a",
            "new_code": "b",
            "description": "Update",
            "line_start": 5,
            "line_end": 10,
        }

        change = CodeChange.from_dict(data)

        assert change.file_path == "module.py"
        assert change.line_end == 10


class TestDebugAnalysis:
    """Tests for DebugAnalysis model."""

    def test_debug_analysis_creation(self) -> None:
        """Test that debug analysis can be created."""
        changes = [
            CodeChange(
                file_path="test.py",
                original_code="old",
                new_code="new",
                description="fix",
                line_start=1,
                line_end=1,
            ),
        ]

        analysis = DebugAnalysis(
            failure_id="FAIL-001",
            root_cause="Variable not initialized",
            fix_suggestion="Initialize variable before use",
            code_changes=changes,
        )

        assert analysis.failure_id == "FAIL-001"
        assert "not initialized" in analysis.root_cause
        assert len(analysis.code_changes) == 1

    def test_debug_analysis_to_dict(self) -> None:
        """Test that debug analysis serializes to dictionary."""
        analysis = DebugAnalysis(
            failure_id="FAIL-001",
            root_cause="Bug",
            fix_suggestion="Fix",
            code_changes=[],
        )

        data = analysis.to_dict()

        assert data["failure_id"] == "FAIL-001"

    def test_debug_analysis_from_dict(self) -> None:
        """Test that debug analysis deserializes from dictionary."""
        data = {
            "failure_id": "FAIL-002",
            "root_cause": "Logic error",
            "fix_suggestion": "Update logic",
            "code_changes": [],
        }

        analysis = DebugAnalysis.from_dict(data)

        assert analysis.failure_id == "FAIL-002"

    def test_debug_analysis_to_markdown(self) -> None:
        """Test that debug analysis formats as markdown."""
        analysis = DebugAnalysis(
            failure_id="FAIL-001",
            root_cause="Null pointer dereference",
            fix_suggestion="Check for null before access",
            code_changes=[],
        )

        md = analysis.to_markdown()

        assert "# Debug Analysis" in md
        assert "Null pointer" in md


class TestDevelopmentResult:
    """Tests for DevelopmentResult model."""

    def test_development_result_succeeded(self) -> None:
        """Test that successful result can be created."""
        impl = Implementation(
            task_id="TASK-001",
            files=[],
            imports=[],
            dependencies=[],
        )
        test_suite = TestSuite(
            task_id="TASK-001",
            test_cases=[],
            setup_code="",
            teardown_code="",
            fixtures=[],
        )
        test_result = TestRunResult(
            suite_id="SUITE-001",
            results=[],
            passed=5,
            failed=0,
            coverage=100.0,
        )
        review = CodeReview(
            implementation_id="IMPL-001",
            passed=True,
            issues=[],
            suggestions=[],
            security_concerns=[],
        )

        result = DevelopmentResult.succeeded(
            implementation=impl,
            test_suite=test_suite,
            test_result=test_result,
            review=review,
            hitl4_request_id="gate-123",
        )

        assert result.success is True
        assert result.implementation is not None
        assert result.hitl4_request_id == "gate-123"

    def test_development_result_failed(self) -> None:
        """Test that failed result can be created."""
        result = DevelopmentResult.failed("Tests failed after max retries")

        assert result.success is False
        assert "max retries" in result.error_message

    def test_development_result_pending_hitl4(self) -> None:
        """Test that pending HITL-4 result can be created."""
        impl = Implementation(
            task_id="TASK-001",
            files=[],
            imports=[],
            dependencies=[],
        )

        result = DevelopmentResult.pending_hitl4(
            implementation=impl,
            hitl4_request_id="gate-456",
        )

        assert result.success is True
        assert result.hitl4_request_id == "gate-456"
        assert result.metadata["status"] == "pending_hitl4"

    def test_development_result_to_dict(self) -> None:
        """Test that development result serializes to dictionary."""
        result = DevelopmentResult.failed("Error")

        data = result.to_dict()

        assert data["success"] is False
        assert data["error_message"] == "Error"
