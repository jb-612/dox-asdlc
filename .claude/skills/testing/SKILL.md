---
name: testing
description: Run quality gates — unit tests, linting, SAST, SCA, and E2E. Use when running tests, checking code quality, or validating before commit.
allowed-tools: Read, Glob, Grep, Bash
---

Run quality gates for $ARGUMENTS:

## When to Use

- Running tests before commit
- Pre-merge validation
- Quality gate checks during workflow step 7

## When NOT to Use

- Writing tests (use `@tdd-build`)
- Implementing code changes

## Available Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `test.sh` | Run pytest suite | `./tools/test.sh <path>` |
| `lint.sh` | Run ruff linter | `./tools/lint.sh <path>` |
| `sast.sh` | Run bandit security analysis | `./tools/sast.sh <path>` |
| `sca.sh` | Run pip-audit dependency scan | `./tools/sca.sh <requirements_file>` |
| `complexity.sh` | Run cyclomatic complexity analysis | `./tools/complexity.sh [--threshold N] [--verify-comments] <path>` |
| `e2e.sh` | Run E2E tests with Docker | `./tools/e2e.sh` |

All scripts output standardized JSON via `tools/lib/common.sh`.

## Quick Run (All Gates)

```bash
./tools/test.sh src/path/        # Unit tests
./tools/lint.sh src/path/        # Lint
./tools/sast.sh src/path/        # Security
./tools/complexity.sh src/path/  # Complexity
./tools/sca.sh                   # Dependencies
./tools/e2e.sh                   # End-to-end
```

## Cross-References

- `@tdd-build` — Writing tests (Three Laws TDD micro-cycles)
- `@feature-completion` — Pre-commit validation sequence
