---
name: design-pipeline
description: 11-stage sequential pipeline for feature design — scaffolding, design, user stories, diagrams, 2-round review with hard gates, task breakdown, and user approval. Replaces feature-planning + diagram-builder trigger + design review + re-plan.
argument-hint: "[feature-id]"
---

Design pipeline for feature $ARGUMENTS:

## Overview

Sequential 11-stage pipeline absorbing planning, diagrams, design review, and re-plan into a single gated flow. Two review rounds with a hard HITL block ensure design quality before any code is written.

## Stage 1: Scaffold Work Item

```bash
./scripts/new-feature.sh <project> <feature> "<name>"
```

Creates `.workitems/$ARGUMENTS/` with template files (design.md, user_stories.md, tasks.md).

## Stage 2: Design

Fill `design.md` with:
- **Overview**: What and why
- **Dependencies**: Feature and external dependencies
- **Interfaces**: Provided/required with signatures
- **Technical Approach**: Key classes, data flow, error handling
- **File Structure**: Directory layout
- **Design Decisions**: Choices and rationale
- **Risks**: Technical risks and mitigations

Update YAML frontmatter: `id`, `parent_id`, `dependencies`, `tags`, timestamps.

## Stage 3: User Stories

Fill `user_stories.md` with:
- **As a** {role} **I want** {capability} **So that** {benefit}
- **Acceptance Criteria**: Specific, testable outcomes
- **Test Scenarios**: Given/When/Then format

## Stage 4: Diagrams

Auto-invoke `@diagram-builder` to generate architecture diagrams. Produces `.mmd` files in `docs/diagrams/` and optionally copies to HITL UI assets.

## Stage 5: Review Round 1

Reviewer agent validates design coherence:
- Design matches user stories
- Interfaces are complete and consistent
- Dependencies are satisfiable
- Risks have mitigations
- File structure follows project conventions

Output: List of concerns with severity (Critical / High / Medium / Low).

## Stage 6: Revision

Address all Critical and High concerns from R1. Medium/Low may be deferred with justification. Update design.md and user_stories.md as needed.

## Stage 7: Review Round 2 — HITL Hard Block

**HITL Gate: Design Review R2 (mandatory)**

Reviewer re-validates after revisions. If any Critical concerns remain, pipeline halts. User must resolve before proceeding.

```
Design Review Round 2 for [feature]:
 - Critical concerns remaining: [N]
 - [concern details]

Options:
 A) Address remaining concerns
 B) Override and proceed (requires justification)
 C) Abort design
```

Option B logs justification for audit trail. Option A returns to Stage 6.

## Stage 8: Task Breakdown

Invoke `@task-breakdown` to decompose the design into atomic tasks. The skill fills `tasks.md` with:
- Atomic tasks (each < 2hr), estimates, test paths, dependencies, hints
- Dependency graph and summary table
- Validation that every acceptance criterion maps to a task

## Stage 9: Task Review

Reviewer validates task granularity (included in `@task-breakdown` when standalone, explicit here):
- No task > 2 hours
- Each task is independently testable
- Dependencies form a DAG (no cycles)
- Complete coverage of design scope

## Stage 10: User Gate — HITL Mandatory

**HITL Gate: User Gate (mandatory)**

```
Design pipeline complete for [feature]:
 - Design: [summary]
 - Stories: [count] user stories
 - Tasks: [count] atomic tasks ([total estimate] hours)
 - Reviews: R1 + R2 passed

Options:
 A) Approve and proceed to TDD Build
 B) Steer: modify scope or approach (provide feedback)
 C) Reject and return to workplan
```

Option B returns to Stage 2 with user feedback. Option C aborts pipeline.

## Stage 11: Commit Artifacts

Orchestrator commits planning artifacts to main:
```bash
git add .workitems/$ARGUMENTS/
git commit -m "chore($ARGUMENTS): planning artifacts — design, stories, tasks

Refs: $ARGUMENTS
Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

**HITL Gate: Protected Path (mandatory)** if committing to `.claude/` or `contracts/`.

## Size Check

**Every planning file must be <= 100 lines.** If exceeded, split into sub-features linked via dependencies in YAML frontmatter.

## Validation Checklist

- [ ] All 3 files populated (design.md, user_stories.md, tasks.md)
- [ ] YAML frontmatter complete
- [ ] R1 + R2 review rounds passed
- [ ] All Critical concerns resolved
- [ ] User approved at Stage 10
- [ ] Artifacts committed

## Available Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `new-feature.sh` | Scaffold work item | `./scripts/new-feature.sh P01 F02 "name"` |
| `check-planning.sh` | Validate planning completeness | `./scripts/check-planning.sh P01-F02-name` |

## Cross-References

- `@diagram-builder` — Invoked at Stage 4
- `@task-breakdown` — Invoked at Stage 8
- `@code-review` — Reviewer agent at Stages 5, 7, 9
- `@tdd-build` — Next step after pipeline approval
- `.workitems/README.md` — Naming conventions and rules
- `.workitems/_templates/` — Template files
