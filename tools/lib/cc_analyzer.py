#!/usr/bin/env python3
"""
Cyclomatic complexity analyzer for Python source files.

Uses stdlib `ast` to walk the AST and count decision points.
Zero external dependencies.

Usage:
    python3 cc_analyzer.py [--threshold N] [--json] [--verify-comments] <path>

Output:
    Human-readable table (default) or JSON array of violations.
"""

import ast
import json
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Optional


@dataclass
class FunctionComplexity:
    """Result for a single function/method analysis. CC = 1."""

    name: str
    qualified_name: str
    file: str
    line: int
    complexity: int
    docstring_cc: Optional[int] = None


@dataclass
class CommentMismatch:
    """Mismatch between docstring CC annotation and actual CC. CC = 1."""

    name: str
    qualified_name: str
    file: str
    line: int
    annotated: int
    actual: int


_CC_PATTERN = re.compile(r"CC\s*=\s*(\d+)")

# AST node types that each add exactly 1 decision point
_SIMPLE_DECISION_TYPES = (
    ast.If, ast.IfExp, ast.For, ast.While,
    ast.ExceptHandler, ast.With, ast.Assert,
)


def _node_complexity_delta(child: ast.AST) -> int:
    """Return the CC increment for a single AST node. CC = 4."""
    if isinstance(child, _SIMPLE_DECISION_TYPES):
        return 1
    if isinstance(child, ast.BoolOp):
        return len(child.values) - 1
    if isinstance(child, ast.comprehension):
        return len(child.ifs)
    return 0


def compute_complexity(node: ast.AST) -> int:
    """Walk AST node and count decision points. CC = 1."""
    return 1 + sum(_node_complexity_delta(child) for child in ast.walk(node))


def extract_docstring_cc(
    node: ast.FunctionDef | ast.AsyncFunctionDef,
) -> Optional[int]:
    """Extract CC = N annotation from function docstring. CC = 3."""
    docstring = ast.get_docstring(node)
    if not docstring:
        return None
    match = _CC_PATTERN.search(docstring)
    if match:
        return int(match.group(1))
    return None


def _collect_functions(
    tree: ast.AST,
    file_path: str,
) -> list[FunctionComplexity]:
    """Collect all functions/methods including nested, with qualified names. CC = 4."""
    results: list[FunctionComplexity] = []

    def _visit(node: ast.AST, prefix: str) -> None:
        for child in ast.iter_child_nodes(node):
            if isinstance(child, ast.ClassDef):
                _visit(child, f"{prefix}{child.name}.")
            elif isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)):
                qualified = f"{prefix}{child.name}"
                cc = compute_complexity(child)
                doc_cc = extract_docstring_cc(child)
                results.append(
                    FunctionComplexity(
                        name=child.name,
                        qualified_name=qualified,
                        file=file_path,
                        line=child.lineno,
                        complexity=cc,
                        docstring_cc=doc_cc,
                    )
                )
                # Visit nested functions/classes
                _visit(child, f"{qualified}.")

    _visit(tree, "")
    return results


def analyze_file(path: str) -> list[FunctionComplexity]:
    """Analyze all functions/methods in a Python file. CC = 3."""
    try:
        source = Path(path).read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return []
    try:
        tree = ast.parse(source, filename=path)
    except SyntaxError:
        return []
    return _collect_functions(tree, path)


def analyze_path(path: str) -> list[FunctionComplexity]:
    """Recursively discover .py files and analyze all functions. CC = 5."""
    target = Path(path)
    results: list[FunctionComplexity] = []
    if target.is_file() and target.suffix == ".py":
        results.extend(analyze_file(str(target)))
    elif target.is_dir():
        for py_file in sorted(target.rglob("*.py")):
            results.extend(analyze_file(str(py_file)))
    return results


def find_violations(
    results: list[FunctionComplexity],
    threshold: int,
) -> list[FunctionComplexity]:
    """Filter functions exceeding the complexity threshold. CC = 2."""
    return [r for r in results if r.complexity > threshold]


def find_comment_mismatches(
    results: list[FunctionComplexity],
) -> list[CommentMismatch]:
    """Find functions where docstring CC != actual CC. CC = 4."""
    mismatches: list[CommentMismatch] = []
    for r in results:
        if r.docstring_cc is not None and r.docstring_cc != r.complexity:
            mismatches.append(
                CommentMismatch(
                    name=r.name,
                    qualified_name=r.qualified_name,
                    file=r.file,
                    line=r.line,
                    annotated=r.docstring_cc,
                    actual=r.complexity,
                )
            )
    return mismatches


def format_violations_json(
    violations: list[FunctionComplexity],
    threshold: int,
) -> list[dict]:
    """Format violations as aSDLC-compatible JSON result objects. CC = 1."""
    return [
        {
            "file": v.file,
            "line": v.line,
            "severity": "warning",
            "message": (
                f"{v.qualified_name} has CC={v.complexity} "
                f"(threshold: {threshold})"
            ),
            "rule": "cyclomatic_complexity",
            "function": v.qualified_name,
            "complexity": v.complexity,
        }
        for v in violations
    ]


def format_mismatches_json(mismatches: list[CommentMismatch]) -> list[dict]:
    """Format comment mismatches as aSDLC-compatible JSON result objects. CC = 1."""
    return [
        {
            "file": m.file,
            "line": m.line,
            "severity": "info",
            "message": (
                f"{m.qualified_name} docstring says CC={m.annotated} "
                f"but actual CC={m.actual}"
            ),
            "rule": "cc_comment_drift",
            "function": m.qualified_name,
            "annotated": m.annotated,
            "actual": m.actual,
        }
        for m in mismatches
    ]


def _build_parser() -> "argparse.ArgumentParser":
    """Build CLI argument parser. CC = 1."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Analyze cyclomatic complexity of Python files."
    )
    parser.add_argument("path", help="File or directory to analyze")
    parser.add_argument(
        "--threshold",
        type=int,
        default=5,
        help="Complexity threshold (default: 5)",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        dest="json_output",
        help="Output as JSON",
    )
    parser.add_argument(
        "--verify-comments",
        action="store_true",
        help="Check docstring CC annotations match actual complexity",
    )
    return parser


def _output_verify_comments(
    results: list[FunctionComplexity],
    as_json: bool,
) -> None:
    """Print verify-comments results. CC = 4."""
    mismatches = find_comment_mismatches(results)
    if as_json:
        print(json.dumps(format_mismatches_json(mismatches), indent=2))
        return
    if not mismatches:
        print("No CC annotation mismatches found.")
        return
    print(f"Found {len(mismatches)} CC annotation mismatch(es):\n")
    for m in mismatches:
        print(
            f"  {m.file}:{m.line} {m.qualified_name} "
            f"annotated={m.annotated} actual={m.actual}"
        )


def _output_violations(
    results: list[FunctionComplexity],
    threshold: int,
    as_json: bool,
) -> None:
    """Print violation results. CC = 4."""
    violations = find_violations(results, threshold)
    if as_json:
        print(json.dumps(format_violations_json(violations, threshold), indent=2))
        return
    if not violations:
        print(
            f"All {len(results)} functions within CC threshold "
            f"of {threshold}."
        )
        return
    print(
        f"Found {len(violations)} function(s) exceeding "
        f"CC threshold of {threshold}:\n"
    )
    for v in violations:
        print(f"  {v.file}:{v.line} {v.qualified_name} CC={v.complexity}")
    print(f"\nTotal functions analyzed: {len(results)}")


def main() -> None:
    """CLI entry point. CC = 4."""
    args = _build_parser().parse_args()

    target = Path(args.path)
    if not target.exists():
        if args.json_output:
            print(json.dumps({"error": f"Path not found: {args.path}"}))
        else:
            print(f"Error: Path not found: {args.path}", file=sys.stderr)
        sys.exit(1)

    results = analyze_path(args.path)

    if args.verify_comments:
        _output_verify_comments(results, args.json_output)
    else:
        _output_violations(results, args.threshold, args.json_output)
    sys.exit(0)


if __name__ == "__main__":
    main()
