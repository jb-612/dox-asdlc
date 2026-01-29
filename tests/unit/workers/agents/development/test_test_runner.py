"""Unit tests for TestRunner utility."""

from __future__ import annotations

import subprocess
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from src.workers.agents.development.models import TestResult, TestRunResult
from src.workers.agents.development.test_runner import (
    TestRunner,
    TestRunnerError,
    TestTimeoutError,
)


class TestTestRunnerInit:
    """Tests for TestRunner initialization."""

    def test_creates_with_default_timeout(self) -> None:
        """Test that TestRunner creates with default timeout."""
        runner = TestRunner()

        assert runner.timeout_seconds == 300  # Default from config

    def test_creates_with_custom_timeout(self) -> None:
        """Test that TestRunner creates with custom timeout."""
        runner = TestRunner(timeout_seconds=600)

        assert runner.timeout_seconds == 600

    def test_creates_with_custom_working_directory(self) -> None:
        """Test that TestRunner creates with custom working directory."""
        runner = TestRunner(working_directory=Path("/custom/path"))

        assert runner.working_directory == Path("/custom/path")

    def test_default_working_directory_is_cwd(self) -> None:
        """Test that default working directory is current working directory."""
        runner = TestRunner()

        assert runner.working_directory == Path.cwd()


class TestTestRunnerRunTests:
    """Tests for TestRunner.run_tests method."""

    def test_runs_pytest_on_specified_path(self) -> None:
        """Test that run_tests executes pytest on the specified test path."""
        runner = TestRunner()

        with patch("subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(
                returncode=0,
                stdout="test session starts\n1 passed",
                stderr="",
            )

            runner.run_tests(Path("tests/unit/test_example.py"))

            # Verify pytest was called with the correct path
            call_args = mock_run.call_args
            assert "pytest" in call_args[0][0]
            assert "tests/unit/test_example.py" in str(call_args[0][0])

    def test_returns_test_run_result_on_success(self) -> None:
        """Test that run_tests returns TestRunResult on success."""
        runner = TestRunner()

        pytest_output = """
============================= test session starts ==============================
collected 3 items

tests/test_example.py::test_one PASSED
tests/test_example.py::test_two PASSED
tests/test_example.py::test_three PASSED

============================== 3 passed in 0.05s ===============================
"""

        with patch("subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(
                returncode=0,
                stdout=pytest_output,
                stderr="",
            )

            result = runner.run_tests(Path("tests/test_example.py"))

            assert isinstance(result, TestRunResult)
            assert result.passed == 3
            assert result.failed == 0
            assert result.all_passed() is True

    def test_captures_failures_correctly(self) -> None:
        """Test that run_tests captures test failures correctly."""
        runner = TestRunner()

        pytest_output = """
============================= test session starts ==============================
collected 3 items

tests/test_example.py::test_one PASSED
tests/test_example.py::test_two FAILED
tests/test_example.py::test_three PASSED

=================================== FAILURES ===================================
_________________________________ test_two _________________________________

    def test_two():
>       assert 1 == 2
E       assert 1 == 2

tests/test_example.py:10: AssertionError
=========================== short test summary info ============================
FAILED tests/test_example.py::test_two - assert 1 == 2
============================== 1 failed, 2 passed in 0.05s =====================
"""

        with patch("subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(
                returncode=1,
                stdout=pytest_output,
                stderr="",
            )

            result = runner.run_tests(Path("tests/test_example.py"))

            assert result.passed == 2
            assert result.failed == 1
            assert result.all_passed() is False

    def test_handles_timeout_gracefully(self) -> None:
        """Test that run_tests handles timeout gracefully."""
        runner = TestRunner(timeout_seconds=1)

        with patch("subprocess.run") as mock_run:
            mock_run.side_effect = subprocess.TimeoutExpired(
                cmd="pytest", timeout=1
            )

            with pytest.raises(TestTimeoutError) as exc_info:
                runner.run_tests(Path("tests/test_example.py"))

            assert "timed out after 1 seconds" in str(exc_info.value)

    def test_captures_stderr_on_error(self) -> None:
        """Test that run_tests captures stderr on errors."""
        runner = TestRunner()

        with patch("subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(
                returncode=2,  # pytest error (not test failure)
                stdout="",
                stderr="Error: No module named 'nonexistent'",
            )

            with pytest.raises(TestRunnerError) as exc_info:
                runner.run_tests(Path("tests/nonexistent.py"))

            assert "No module named" in str(exc_info.value)


class TestTestRunnerWithCoverage:
    """Tests for TestRunner.run_tests with coverage."""

    def test_enables_coverage_when_requested(self) -> None:
        """Test that coverage is enabled when requested."""
        runner = TestRunner()

        with patch("subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(
                returncode=0,
                stdout="1 passed",
                stderr="",
            )

            runner.run_tests(
                Path("tests/test_example.py"),
                with_coverage=True,
                coverage_source=Path("src/module"),
            )

            call_args = mock_run.call_args
            cmd = " ".join(call_args[0][0])
            assert "--cov" in cmd

    def test_parses_coverage_percentage(self) -> None:
        """Test that coverage percentage is parsed from output."""
        runner = TestRunner()

        pytest_output = """
============================= test session starts ==============================
collected 2 items

tests/test_example.py ..                                                 [100%]

---------- coverage: platform linux, python 3.11.0 ----------------------------
Name                    Stmts   Miss  Cover
-------------------------------------------
src/module/__init__.py      0      0   100%
src/module/main.py         20      2    90%
-------------------------------------------
TOTAL                      20      2    90%

============================== 2 passed in 0.10s ===============================
"""

        with patch("subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(
                returncode=0,
                stdout=pytest_output,
                stderr="",
            )

            result = runner.run_tests(
                Path("tests/test_example.py"),
                with_coverage=True,
            )

            assert result.coverage == 90.0

    def test_coverage_defaults_to_zero_when_not_available(self) -> None:
        """Test that coverage defaults to 0 when not in output."""
        runner = TestRunner()

        pytest_output = """
============================= test session starts ==============================
collected 1 item

tests/test_example.py .                                                  [100%]

============================== 1 passed in 0.05s ===============================
"""

        with patch("subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(
                returncode=0,
                stdout=pytest_output,
                stderr="",
            )

            result = runner.run_tests(Path("tests/test_example.py"))

            assert result.coverage == 0.0


class TestTestRunnerTestResultParsing:
    """Tests for parsing individual test results."""

    def test_creates_test_result_for_each_test(self) -> None:
        """Test that a TestResult is created for each test."""
        runner = TestRunner()

        pytest_output = """
============================= test session starts ==============================
collected 2 items

tests/test_example.py::test_one PASSED
tests/test_example.py::test_two PASSED

============================== 2 passed in 0.05s ===============================
"""

        with patch("subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(
                returncode=0,
                stdout=pytest_output,
                stderr="",
            )

            result = runner.run_tests(Path("tests/test_example.py"))

            assert len(result.results) == 2
            assert all(isinstance(r, TestResult) for r in result.results)
            assert result.results[0].test_id == "test_one"
            assert result.results[0].passed is True
            assert result.results[1].test_id == "test_two"
            assert result.results[1].passed is True

    def test_captures_failure_error_message(self) -> None:
        """Test that failure error messages are captured."""
        runner = TestRunner()

        pytest_output = """
============================= test session starts ==============================
collected 1 items

tests/test_example.py::test_failing FAILED

=================================== FAILURES ===================================
_________________________________ test_failing _________________________________

    def test_failing():
>       assert result == expected
E       AssertionError: assert 'actual' == 'expected'

tests/test_example.py:15: AssertionError
=========================== short test summary info ============================
FAILED tests/test_example.py::test_failing - AssertionError: assert 'actual' == 'expected'
============================== 1 failed in 0.05s ===============================
"""

        with patch("subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(
                returncode=1,
                stdout=pytest_output,
                stderr="",
            )

            result = runner.run_tests(Path("tests/test_example.py"))

            assert len(result.results) == 1
            assert result.results[0].passed is False
            assert result.results[0].error is not None
            assert "assert 'actual' == 'expected'" in result.results[0].error


class TestTestRunnerPytestOptions:
    """Tests for pytest command options."""

    def test_passes_verbose_flag_by_default(self) -> None:
        """Test that verbose flag is passed by default."""
        runner = TestRunner()

        with patch("subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(
                returncode=0, stdout="", stderr=""
            )

            runner.run_tests(Path("tests/test_example.py"))

            call_args = mock_run.call_args
            assert "-v" in call_args[0][0]

    def test_accepts_extra_pytest_args(self) -> None:
        """Test that extra pytest arguments can be passed."""
        runner = TestRunner()

        with patch("subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(
                returncode=0, stdout="", stderr=""
            )

            runner.run_tests(
                Path("tests/test_example.py"),
                extra_args=["-x", "--tb=short"],
            )

            call_args = mock_run.call_args
            assert "-x" in call_args[0][0]
            assert "--tb=short" in call_args[0][0]

    def test_uses_timeout_from_config(self) -> None:
        """Test that timeout from config is used."""
        runner = TestRunner(timeout_seconds=120)

        with patch("subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(
                returncode=0, stdout="", stderr=""
            )

            runner.run_tests(Path("tests/test_example.py"))

            call_args = mock_run.call_args
            assert call_args[1]["timeout"] == 120


class TestTestRunnerSuiteId:
    """Tests for suite ID generation."""

    def test_generates_suite_id_from_test_path(self) -> None:
        """Test that suite ID is generated from test path."""
        runner = TestRunner()

        with patch("subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(
                returncode=0,
                stdout="1 passed",
                stderr="",
            )

            result = runner.run_tests(Path("tests/unit/test_example.py"))

            assert result.suite_id == "tests/unit/test_example.py"

    def test_accepts_custom_suite_id(self) -> None:
        """Test that custom suite ID can be provided."""
        runner = TestRunner()

        with patch("subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(
                returncode=0,
                stdout="1 passed",
                stderr="",
            )

            result = runner.run_tests(
                Path("tests/test_example.py"),
                suite_id="custom-suite-id",
            )

            assert result.suite_id == "custom-suite-id"


class TestTestRunnerIntegration:
    """Integration tests that run actual pytest."""

    @pytest.mark.integration
    def test_runs_real_pytest_on_simple_test(self, tmp_path: Path) -> None:
        """Test that real pytest runs on a simple test file."""
        # Create a simple passing test
        test_file = tmp_path / "test_simple.py"
        test_file.write_text("""
def test_always_passes():
    assert True
""")

        runner = TestRunner(working_directory=tmp_path)
        result = runner.run_tests(test_file)

        assert result.passed == 1
        assert result.failed == 0
        assert result.all_passed() is True

    @pytest.mark.integration
    def test_captures_real_test_failures(self, tmp_path: Path) -> None:
        """Test that real test failures are captured."""
        test_file = tmp_path / "test_failing.py"
        test_file.write_text("""
def test_always_fails():
    assert False, "This test should fail"
""")

        runner = TestRunner(working_directory=tmp_path)
        result = runner.run_tests(test_file)

        assert result.passed == 0
        assert result.failed == 1
        assert result.all_passed() is False
        assert any("This test should fail" in (r.error or "") for r in result.results)
