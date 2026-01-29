"""Test runner utility for executing pytest programmatically.

Provides a TestRunner class that executes pytest on specified test files,
captures output and errors, calculates coverage, and returns structured results.
"""

from __future__ import annotations

import re
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

from .models import TestResult, TestRunResult


class TestRunnerError(Exception):
    """Raised when test execution encounters an error."""

    pass


class TestTimeoutError(TestRunnerError):
    """Raised when test execution times out."""

    pass


@dataclass
class TestRunner:
    """Utility for running pytest programmatically.

    Executes pytest on specified test files, captures output and errors,
    parses results into structured TestResult objects, and calculates coverage.

    Attributes:
        timeout_seconds: Maximum time in seconds for test execution.
        working_directory: Working directory for test execution.
    """

    timeout_seconds: int = 300
    working_directory: Path = field(default_factory=Path.cwd)

    def run_tests(
        self,
        test_path: Path,
        with_coverage: bool = False,
        coverage_source: Path | None = None,
        extra_args: list[str] | None = None,
        suite_id: str | None = None,
    ) -> TestRunResult:
        """Run pytest on the specified test path.

        Args:
            test_path: Path to test file or directory.
            with_coverage: Whether to enable coverage measurement.
            coverage_source: Source directory for coverage measurement.
            extra_args: Additional pytest arguments.
            suite_id: Optional suite ID (defaults to test path).

        Returns:
            TestRunResult: Structured test results with pass/fail counts
                and coverage information.

        Raises:
            TestTimeoutError: If test execution exceeds timeout.
            TestRunnerError: If test execution encounters an error (not test failure).
        """
        cmd = self._build_command(
            test_path, with_coverage, coverage_source, extra_args
        )

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=self.timeout_seconds,
                cwd=self.working_directory,
            )
        except subprocess.TimeoutExpired as e:
            raise TestTimeoutError(
                f"Test execution timed out after {self.timeout_seconds} seconds"
            ) from e

        # Return code 0 = all passed, 1 = some failed, 2+ = execution error
        if result.returncode >= 2:
            error_msg = result.stderr or result.stdout or "Unknown error"
            raise TestRunnerError(f"Pytest execution error: {error_msg}")

        return self._parse_output(
            result.stdout,
            result.stderr,
            suite_id or str(test_path),
        )

    def _build_command(
        self,
        test_path: Path,
        with_coverage: bool,
        coverage_source: Path | None,
        extra_args: list[str] | None,
    ) -> list[str]:
        """Build the pytest command.

        Args:
            test_path: Path to test file or directory.
            with_coverage: Whether to enable coverage.
            coverage_source: Source directory for coverage.
            extra_args: Additional pytest arguments.

        Returns:
            list[str]: Complete pytest command as list.
        """
        cmd = ["pytest", "-v", str(test_path)]

        if with_coverage:
            cmd.append("--cov")
            if coverage_source:
                cmd.append(f"--cov={coverage_source}")

        if extra_args:
            cmd.extend(extra_args)

        return cmd

    def _parse_output(
        self,
        stdout: str,
        stderr: str,
        suite_id: str,
    ) -> TestRunResult:
        """Parse pytest output into structured results.

        Args:
            stdout: Standard output from pytest.
            stderr: Standard error from pytest.
            suite_id: Suite identifier.

        Returns:
            TestRunResult: Parsed test results.
        """
        test_results = self._parse_test_results(stdout)
        passed_count = sum(1 for r in test_results if r.passed)
        failed_count = sum(1 for r in test_results if not r.passed)
        coverage = self._parse_coverage(stdout)

        return TestRunResult(
            suite_id=suite_id,
            results=test_results,
            passed=passed_count,
            failed=failed_count,
            coverage=coverage,
            metadata={
                "stdout": stdout,
                "stderr": stderr,
            },
        )

    def _parse_test_results(self, stdout: str) -> list[TestResult]:
        """Parse individual test results from pytest output.

        Args:
            stdout: Standard output from pytest.

        Returns:
            list[TestResult]: List of individual test results.
        """
        results: list[TestResult] = []

        # Pattern to match test results like:
        # tests/test_example.py::test_one PASSED
        # tests/test_example.py::test_two FAILED
        test_pattern = re.compile(
            r"^(.+?)::(\w+)\s+(PASSED|FAILED|ERROR|SKIPPED)",
            re.MULTILINE,
        )

        # Extract failure details for error messages
        failure_details = self._extract_failure_details(stdout)

        for match in test_pattern.finditer(stdout):
            _file_path, test_name, status = match.groups()
            passed = status == "PASSED"
            error = failure_details.get(test_name) if not passed else None

            results.append(
                TestResult(
                    test_id=test_name,
                    passed=passed,
                    output=stdout,
                    error=error,
                    duration_ms=0,  # Pytest doesn't provide per-test timing in basic output
                )
            )

        return results

    def _extract_failure_details(self, stdout: str) -> dict[str, str]:
        """Extract failure details for each failed test.

        Args:
            stdout: Standard output from pytest.

        Returns:
            dict[str, str]: Mapping of test name to failure message.
        """
        failures: dict[str, str] = {}

        # First try to extract from the detailed FAILURES section
        # This has the complete error message (not truncated)
        failures_section = re.search(
            r"=+ FAILURES =+(.+?)(?:=+ short test summary|=+ \d+ (?:failed|passed))",
            stdout,
            re.DOTALL,
        )

        if failures_section:
            section_content = failures_section.group(1)
            # Match individual test failure blocks
            # Pattern matches: ___ test_name ___ (with varying number of underscores)
            test_block_pattern = re.compile(
                r"_+ ([\w_]+) _+(.+?)(?=\n_+ [\w_]+ _+|\Z)",
                re.DOTALL,
            )

            for match in test_block_pattern.finditer(section_content):
                test_name, block_content = match.groups()
                # Extract all assertion error lines (lines starting with E)
                error_lines = re.findall(r"^E\s+(.+)$", block_content, re.MULTILINE)
                if error_lines:
                    # Join all error lines for complete context
                    failures[test_name] = "\n".join(error_lines)
                else:
                    failures[test_name] = block_content.strip()[:500]

        # Fall back to short test summary if FAILURES section parsing missed any
        summary_pattern = re.compile(
            r"FAILED\s+\S+::(\w+)\s+-\s+(.+)",
            re.MULTILINE,
        )

        for match in summary_pattern.finditer(stdout):
            test_name, error_msg = match.groups()
            # Only add if not already captured from FAILURES section
            if test_name not in failures:
                failures[test_name] = error_msg

        return failures

    def _parse_coverage(self, stdout: str) -> float:
        """Parse coverage percentage from pytest output.

        Args:
            stdout: Standard output from pytest.

        Returns:
            float: Coverage percentage (0.0 if not found).
        """
        # Look for TOTAL line in coverage output
        # TOTAL                      20      2    90%
        total_pattern = re.compile(
            r"^TOTAL\s+\d+\s+\d+\s+(\d+)%",
            re.MULTILINE,
        )

        match = total_pattern.search(stdout)
        if match:
            return float(match.group(1))

        return 0.0
