---
name: task-breakdown
description: Break a feature design into atomic, testable tasks with estimates, dependencies, and test paths. Reusable standalone skill invoked by @design-pipeline or independently.
argument-hint: "[feature-id]"
---

Break down feature $ARGUMENTS into atomic tasks:

## When to Use

- Invoked by `@design-pipeline` at Stage 8
- Standalone when a design already exists and only task breakdown is needed
- Re-breakdown after scope changes or steering feedback

## Prerequisites

Before running, ensure:
- `design.md` exists with interfaces and technical approach
- `user_stories.md` exists with acceptance criteria and test scenarios
- Design has passed review (R1 + R2 if running inside pipeline)

## Step 1: Read Design Inputs

Read from `.workitems/$ARGUMENTS/`:
- `design.md` — interfaces, approach, file structure, decisions
- `user_stories.md` — acceptance criteria, test scenarios

Identify all behaviors that need implementation.

## Step 2: Decompose into Atomic Tasks

Each task must be:
- **< 2 hours** estimated effort
- **Independently testable** — produces one observable behavior change
- **Single-responsibility** — touches one concern (one module, one endpoint, one component)
- **CC budget** — all new/modified functions must stay CC <= 5; split complex logic into helpers

### Task Format

```markdown
### TNN: [imperative verb] [what]

- **Estimate**: [0.5h | 1h | 1.5h | 2h]
- **Test file**: `tests/unit/path/test_module.py::test_function`
- **Dependencies**: [TNN, TNN] or none
- **Hints**: [implementation guidance, key functions/classes to create]

**Description**: [1-2 sentences explaining what this task produces]

**Acceptance criteria**:
- [ ] [specific testable outcome]
- [ ] [specific testable outcome]
```

## Step 3: Build Dependency Graph

Map task dependencies as a DAG:
- No circular dependencies
- Identify parallelizable tasks (no shared dependencies)
- Critical path should be explicit

```markdown
## Dependency Graph

T01 ──→ T02 ──→ T04
              ↗
T03 ────┘
```

## Step 4: Create Summary Table

```markdown
## Summary

| Phase | Tasks | Estimate | Description |
|-------|-------|----------|-------------|
| Foundation | T01-T03 | 4h | Core types and interfaces |
| Implementation | T04-T08 | 8h | Business logic |
| Integration | T09-T10 | 3h | Wiring and E2E |

**Total**: NN tasks, NNh estimated
```

## Step 5: Validate

Checklist before proceeding:
- [ ] Every user story acceptance criterion maps to at least one task
- [ ] No task exceeds 2 hours
- [ ] Each task has a test file path
- [ ] Dependencies form a DAG (no cycles)
- [ ] Total coverage matches design scope — no gaps, no extras
- [ ] tasks.md is <= 100 lines (split feature if exceeded)

## Step 6: Task Review (when standalone)

When invoked standalone (not via `@design-pipeline`), request reviewer validation:
- Task granularity appropriate
- Estimates realistic
- Dependencies correct
- No missing coverage

## Available Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `check-planning.sh` | Validate planning completeness | `./scripts/check-planning.sh P01-F02-name` |

## Cross-References

- `@design-pipeline` — Invokes this skill at Stage 8
- `@tdd-build` — Consumes tasks for TDD micro-cycles
- `.workitems/_templates/tasks.md` — Template file
