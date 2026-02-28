"""Unit tests for tools/lib/cc_analyzer.py — cyclomatic complexity analyzer."""

import ast
import json
import subprocess
import sys
from pathlib import Path

import pytest

# Import the analyzer module
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "tools" / "lib"))
import cc_analyzer

FIXTURES = Path(__file__).parent / "fixtures"


# ---------------------------------------------------------------------------
# compute_complexity: table-driven tests for each AST node type
# ---------------------------------------------------------------------------

class TestComputeComplexity:
    """Table-driven tests for compute_complexity."""

    @pytest.mark.parametrize(
        "code,expected_cc",
        [
            # Base case: linear code, CC=1
            ("def f(): pass", 1),
            # If adds 1
            ("def f(x):\n  if x: pass", 2),
            # If-elif adds 2
            ("def f(x):\n  if x: pass\n  elif x > 1: pass", 3),
            # For loop adds 1
            ("def f(x):\n  for i in x: pass", 2),
            # While loop adds 1
            ("def f(x):\n  while x: pass", 2),
            # ExceptHandler adds 1 per handler
            ("def f():\n  try: pass\n  except ValueError: pass", 2),
            ("def f():\n  try: pass\n  except ValueError: pass\n  except TypeError: pass", 3),
            # With adds 1
            ("def f():\n  with open('f'): pass", 2),
            # Assert adds 1
            ("def f(x):\n  assert x > 0", 2),
            # BoolOp: 'and' adds 1
            ("def f(a, b):\n  if a and b: pass", 3),
            # BoolOp: 'or' adds 1
            ("def f(a, b):\n  if a or b: pass", 3),
            # BoolOp: 'a and b and c' adds 2
            ("def f(a, b, c):\n  if a and b and c: pass", 4),
            # IfExp (ternary) adds 1
            ("def f(x):\n  return x if x > 0 else -x", 2),
            # Comprehension if adds 1 per filter
            ("def f(x):\n  return [i for i in x if i > 0]", 2),
            # Comprehension with 2 ifs
            ("def f(x):\n  return [i for i in x if i > 0 if i < 10]", 3),
            # Combined: if + for + condition
            ("def f(items):\n  for i in items:\n    if i > 0:\n      pass", 3),
        ],
        ids=[
            "linear",
            "if",
            "if-elif",
            "for",
            "while",
            "except-one",
            "except-two",
            "with",
            "assert",
            "bool-and",
            "bool-or",
            "bool-and-and",
            "ternary",
            "comprehension-1if",
            "comprehension-2ifs",
            "for-plus-if",
        ],
    )
    def test_node_types(self, code: str, expected_cc: int) -> None:
        tree = ast.parse(code)
        func_node = tree.body[0]
        assert cc_analyzer.compute_complexity(func_node) == expected_cc

    def test_async_function(self) -> None:
        code = "async def f(x):\n  if x: pass"
        tree = ast.parse(code)
        func_node = tree.body[0]
        assert cc_analyzer.compute_complexity(func_node) == 2


# ---------------------------------------------------------------------------
# extract_docstring_cc
# ---------------------------------------------------------------------------

class TestExtractDocstringCc:
    """Tests for extracting CC = N from docstrings."""

    def test_with_annotation(self) -> None:
        code = 'def f():\n  """Do thing. CC = 3."""\n  pass'
        tree = ast.parse(code)
        assert cc_analyzer.extract_docstring_cc(tree.body[0]) == 3

    def test_without_annotation(self) -> None:
        code = 'def f():\n  """Do thing."""\n  pass'
        tree = ast.parse(code)
        assert cc_analyzer.extract_docstring_cc(tree.body[0]) is None

    def test_no_docstring(self) -> None:
        code = "def f(): pass"
        tree = ast.parse(code)
        assert cc_analyzer.extract_docstring_cc(tree.body[0]) is None

    def test_spaced_annotation(self) -> None:
        code = 'def f():\n  """Do thing. CC  =  7."""\n  pass'
        tree = ast.parse(code)
        assert cc_analyzer.extract_docstring_cc(tree.body[0]) == 7

    def test_multiline_docstring(self) -> None:
        code = 'def f():\n  """Do thing.\n\n  Details here. CC = 2.\n  """\n  pass'
        tree = ast.parse(code)
        assert cc_analyzer.extract_docstring_cc(tree.body[0]) == 2


# ---------------------------------------------------------------------------
# analyze_file: fixture-based tests
# ---------------------------------------------------------------------------

class TestAnalyzeFile:
    """Tests using fixture files."""

    def test_simple_fixture(self) -> None:
        results = cc_analyzer.analyze_file(str(FIXTURES / "cc_simple.py"))
        names = {r.name: r.complexity for r in results}
        assert names["linear_function"] == 1
        assert names["another_linear"] == 1
        assert names["async_linear"] == 1
        assert names["get_value"] == 1
        assert names["__init__"] == 1

    def test_branching_fixture(self) -> None:
        results = cc_analyzer.analyze_file(str(FIXTURES / "cc_branching.py"))
        names = {r.name: r.complexity for r in results}
        assert names["single_if"] == 2
        assert names["if_else_chain"] == 3
        assert names["loop_with_condition"] == 3
        assert names["compound_condition"] == 3
        assert names["at_threshold"] == 5

    def test_complex_fixture(self) -> None:
        results = cc_analyzer.analyze_file(str(FIXTURES / "cc_complex.py"))
        names = {r.name: r.complexity for r in results}
        assert names["complex_dispatcher"] == 8
        assert names["comprehension_with_filters"] == 3
        assert names["ternary_chain"] == 3

    def test_qualified_names_include_class(self) -> None:
        results = cc_analyzer.analyze_file(str(FIXTURES / "cc_simple.py"))
        qualified = {r.qualified_name for r in results}
        assert "SimpleClass.__init__" in qualified
        assert "SimpleClass.get_value" in qualified

    def test_nonexistent_file(self) -> None:
        results = cc_analyzer.analyze_file("/nonexistent/path.py")
        assert results == []

    def test_syntax_error_file(self, tmp_path: Path) -> None:
        bad_file = tmp_path / "bad.py"
        bad_file.write_text("def broken(:\n  pass")
        results = cc_analyzer.analyze_file(str(bad_file))
        assert results == []


# ---------------------------------------------------------------------------
# analyze_path: directory traversal
# ---------------------------------------------------------------------------

class TestAnalyzePath:
    """Tests for recursive directory analysis."""

    def test_single_file(self) -> None:
        results = cc_analyzer.analyze_path(str(FIXTURES / "cc_simple.py"))
        assert len(results) > 0
        assert all(r.file.endswith("cc_simple.py") for r in results)

    def test_directory(self) -> None:
        results = cc_analyzer.analyze_path(str(FIXTURES))
        files = {r.file for r in results}
        assert any("cc_simple.py" in f for f in files)
        assert any("cc_branching.py" in f for f in files)
        assert any("cc_complex.py" in f for f in files)

    def test_nonexistent_path(self) -> None:
        results = cc_analyzer.analyze_path("/nonexistent/dir")
        assert results == []


# ---------------------------------------------------------------------------
# find_violations
# ---------------------------------------------------------------------------

class TestFindViolations:
    """Tests for threshold violation detection."""

    def test_no_violations_at_threshold(self) -> None:
        results = cc_analyzer.analyze_file(str(FIXTURES / "cc_branching.py"))
        violations = cc_analyzer.find_violations(results, threshold=5)
        assert len(violations) == 0

    def test_violations_above_threshold(self) -> None:
        results = cc_analyzer.analyze_file(str(FIXTURES / "cc_complex.py"))
        violations = cc_analyzer.find_violations(results, threshold=5)
        violation_names = [v.name for v in violations]
        assert "complex_dispatcher" in violation_names

    def test_custom_threshold(self) -> None:
        results = cc_analyzer.analyze_file(str(FIXTURES / "cc_branching.py"))
        violations = cc_analyzer.find_violations(results, threshold=2)
        assert len(violations) > 0


# ---------------------------------------------------------------------------
# find_comment_mismatches (verify-comments mode)
# ---------------------------------------------------------------------------

class TestFindCommentMismatches:
    """Tests for docstring CC annotation drift detection."""

    def test_correct_annotations(self) -> None:
        results = cc_analyzer.analyze_file(str(FIXTURES / "cc_docstring.py"))
        mismatches = cc_analyzer.find_comment_mismatches(results)
        assert len(mismatches) == 0

    def test_drift_annotations(self) -> None:
        results = cc_analyzer.analyze_file(
            str(FIXTURES / "cc_docstring_drift.py")
        )
        mismatches = cc_analyzer.find_comment_mismatches(results)
        # claims_one_but_is_two: annotated=1, actual=2
        # claims_five_but_is_two: annotated=5, actual=2
        assert len(mismatches) == 2
        mismatch_names = {m.name for m in mismatches}
        assert "claims_one_but_is_two" in mismatch_names
        assert "claims_five_but_is_two" in mismatch_names

    def test_mismatch_values(self) -> None:
        results = cc_analyzer.analyze_file(
            str(FIXTURES / "cc_docstring_drift.py")
        )
        mismatches = cc_analyzer.find_comment_mismatches(results)
        by_name = {m.name: m for m in mismatches}
        assert by_name["claims_one_but_is_two"].annotated == 1
        assert by_name["claims_one_but_is_two"].actual == 2
        assert by_name["claims_five_but_is_two"].annotated == 5
        assert by_name["claims_five_but_is_two"].actual == 2


# ---------------------------------------------------------------------------
# JSON formatting
# ---------------------------------------------------------------------------

class TestFormatJson:
    """Tests for JSON output formatting."""

    def test_violation_format(self) -> None:
        v = cc_analyzer.FunctionComplexity(
            name="foo",
            qualified_name="Bar.foo",
            file="src/bar.py",
            line=10,
            complexity=8,
        )
        output = cc_analyzer.format_violations_json([v], threshold=5)
        assert len(output) == 1
        assert output[0]["rule"] == "cyclomatic_complexity"
        assert output[0]["complexity"] == 8
        assert output[0]["severity"] == "warning"
        assert "Bar.foo" in output[0]["message"]

    def test_mismatch_format(self) -> None:
        m = cc_analyzer.CommentMismatch(
            name="foo",
            qualified_name="Bar.foo",
            file="src/bar.py",
            line=10,
            annotated=3,
            actual=7,
        )
        output = cc_analyzer.format_mismatches_json([m])
        assert len(output) == 1
        assert output[0]["rule"] == "cc_comment_drift"
        assert output[0]["annotated"] == 3
        assert output[0]["actual"] == 7


# ---------------------------------------------------------------------------
# CLI integration test
# ---------------------------------------------------------------------------

class TestCli:
    """Tests for the CLI entry point."""

    def test_json_output(self) -> None:
        result = subprocess.run(
            [
                sys.executable,
                str(Path(__file__).resolve().parents[3] / "tools" / "lib" / "cc_analyzer.py"),
                "--json",
                "--threshold", "5",
                str(FIXTURES / "cc_complex.py"),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        output = json.loads(result.stdout)
        assert isinstance(output, list)
        assert any(v["complexity"] == 8 for v in output)

    def test_verify_comments_json(self) -> None:
        result = subprocess.run(
            [
                sys.executable,
                str(Path(__file__).resolve().parents[3] / "tools" / "lib" / "cc_analyzer.py"),
                "--verify-comments",
                "--json",
                str(FIXTURES / "cc_docstring_drift.py"),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        output = json.loads(result.stdout)
        assert isinstance(output, list)
        assert len(output) == 2

    def test_nonexistent_path_exits_1(self) -> None:
        result = subprocess.run(
            [
                sys.executable,
                str(Path(__file__).resolve().parents[3] / "tools" / "lib" / "cc_analyzer.py"),
                "/nonexistent/path",
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 1

    def test_human_readable_output(self) -> None:
        result = subprocess.run(
            [
                sys.executable,
                str(Path(__file__).resolve().parents[3] / "tools" / "lib" / "cc_analyzer.py"),
                "--threshold", "5",
                str(FIXTURES / "cc_simple.py"),
            ],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        assert "within CC threshold" in result.stdout
