---
name: code-review
description: 3-agent parallel code review — architecture, code quality + security, and test coverage reviewers with master synthesis. Use when reviewing PRs, inspecting code, or auditing a module.
allowed-tools: Read, Glob, Grep
context: fork
agent: reviewer
---

Review code for $ARGUMENTS:

## When to Use

- Code review (workflow step 4)
- Security audit
- Code inspection before commit

## When NOT to Use

- Writing or fixing code (read-only skill)
- Running tests (use `@testing`)

## 3-Agent Parallel Review Model

Launch three specialized review passes in parallel, then synthesize results.

### Agent 1: Architecture Reviewer

Focus areas:
- Design coherence with `design.md` specifications
- Pattern consistency with existing codebase
- Interface contracts honored (signatures, return types, error handling)
- Component coupling and separation of concerns
- Dependency direction (no circular deps)

### Agent 2: Code Quality + Security Reviewer

Focus areas:
- **Security** — No injection, no hardcoded secrets, proper input validation (OWASP Top 10)
- **Correctness** — Logic matches specification, edge cases handled
- **Style** — Follows project conventions, clear naming, type hints
- **Dependencies** — No known CVEs, minimal dependency footprint
- Invokes `@security-review` checklist for comprehensive security analysis

### Agent 3: Test Coverage Reviewer

Focus areas:
- Coverage gaps — untested code paths, missing edge cases
- Test quality — meaningful assertions, not just "runs without error"
- Test isolation — no shared state, no order dependencies
- Boundary testing — off-by-one, empty input, max values
- Mock appropriateness — mocking at right boundaries

## Master Synthesis

After all three agents complete:
1. Merge findings from all agents
2. Deduplicate overlapping findings
3. Assign severity: Critical / High / Medium / Low
4. Create GitHub issues by severity

```bash
gh issue create --title "Review: <finding>" --label "code-review,<severity>"
```

Critical and High issues must be resolved before commit. Medium/Low tracked for follow-up.

## Available Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `ast.sh` | Parse Python AST structure | `./tools/ast.sh <file.py>` |

## Cross-References

- `@security-review` — Dedicated security analysis (invoked by Agent 2)
- `@testing` — Run quality gates after review fixes
- `@feature-completion` — Final validation after review
- `@design-pipeline` — Design review at Stages 5, 7, 9
