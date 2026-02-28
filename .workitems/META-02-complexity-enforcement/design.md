---
id: META-02
parent_id: META
type: design
version: 1
status: approved
dependencies: []
tags: [tooling, quality, python]
created_by: planner
created_at: "2026-02-28T00:00:00Z"
updated_at: "2026-02-28T00:00:00Z"
---

# Cyclomatic Complexity Enforcement

## Overview

Automated cyclomatic complexity (CC) analysis for Python code using stdlib `ast`. Provides a standalone analyzer, bash wrappers matching aSDLC tool conventions, and integration into 5 workflow skills. Enforces CC <= 5 per function with docstring annotation convention (`CC = N`).

Zero external dependencies — uses only Python stdlib `ast` module. TypeScript CC analysis deferred to META-03.

## Dependencies

- **Requires**: `tools/lib/common.sh` (bash output helpers), `tools/lib/ast_parser.py` (pattern reference)
- **External**: None (stdlib only)

## Interfaces

### Provided

```python
# tools/lib/cc_analyzer.py

@dataclass
class FunctionComplexity:
    name: str
    qualified_name: str
    file: str
    line: int
    complexity: int
    docstring_cc: int | None

def compute_complexity(node: ast.AST) -> int:
    """Count decision points in an AST node. CC = 1."""

def extract_docstring_cc(node: ast.FunctionDef | ast.AsyncFunctionDef) -> int | None:
    """Extract CC = N annotation from docstring. CC = 1."""

def analyze_file(path: str) -> list[FunctionComplexity]:
    """Analyze all functions/methods in a Python file. CC = 2."""

def analyze_path(path: str) -> list[FunctionComplexity]:
    """Recursively discover .py files and analyze. CC = 3."""

def main() -> None:
    """CLI entry: --threshold N, --json, --verify-comments. CC = 4."""
```

### Required

- `tools/lib/common.sh` — `emit_result`, `emit_error`, `json_escape`

## Technical Approach

- AST walk counts decision points: base=1, +1 per `If`, `For`, `While`, `ExceptHandler`, `With`, `Assert`, `BoolOp(And/Or)`, `IfExp`, comprehension `ifs`
- Handles nested functions, async functions, class methods
- Docstring convention: `CC = N` on first line after summary sentence
- `--verify-comments` mode detects drift between actual CC and annotated CC
- Bash wrapper follows 3-line forwarder pattern (matches `tools/sast.sh`)
- Output format: standard aSDLC JSON via `emit_result`/`emit_error`

## File Structure

```
tools/
  lib/
    cc_analyzer.py          # Core analyzer (CREATE)
  complexity.sh             # 3-line forwarder (CREATE)
.claude/skills/testing/
  scripts/
    complexity.sh           # Actual bash impl (CREATE)
tests/unit/tools/
  __init__.py               # Package init (CREATE)
  test_cc_analyzer.py       # Unit tests (CREATE)
  fixtures/
    cc_simple.py            # CC=1 fixture
    cc_branching.py         # CC=2,3,5 fixture
    cc_complex.py           # CC=7 fixture
    cc_docstring.py         # Correct annotations
    cc_docstring_drift.py   # Wrong annotations
```

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| stdlib `ast` only | Zero external deps, matches project convention |
| Dataclass output | Structured, type-safe, JSON-serializable |
| 3-line forwarder | Matches `tools/sast.sh` pattern exactly |
| CC = N in docstring | Convention from shv-sim-swz, grep-friendly |
| Threshold default 5 | Matches user's global CLAUDE.md requirement |

## Risks

| Risk | Mitigation |
|------|------------|
| AST changes across Python versions | Uses only stable AST nodes present since 3.8 |
| False positives on `with` statements | Document that `with` adds 1 (it has `__exit__` path) |

## Open Questions

None — design approved.
