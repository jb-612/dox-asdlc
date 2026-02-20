---
name: code-review
description: Analyze code for quality, security, and standards compliance. Use when reviewing PRs, inspecting code, or auditing a module.
allowed-tools: Read, Glob, Grep
context: fork
agent: reviewer
---

Review code for $ARGUMENTS:

## When to Use

- PR review (workflow step 4, 8)
- Security audit
- Code inspection before commit

## When NOT to Use

- Writing or fixing code (read-only skill)
- Running tests (use `@testing`)

## Available Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `ast.sh` | Parse Python AST structure | `./tools/ast.sh <file.py>` |

## Review Checklist

1. **Security** — No injection, no hardcoded secrets, proper input validation
2. **Correctness** — Logic matches specification, edge cases handled
3. **Style** — Follows project conventions, clear naming
4. **Tests** — Adequate coverage, meaningful assertions
5. **Performance** — No obvious bottlenecks, proper data structures

## Output

Create GitHub issues for all findings:
```bash
gh issue create --title "Review: <finding>" --label "code-review"
```

## Cross-References

- `@testing` — Run quality gates after review fixes
- `@feature-completion` — Final validation after review
