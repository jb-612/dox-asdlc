---
description: 8-step development workflow with HITL gates and skills
paths:
  - "**/*"
---

# Development Workflow

PM CLI orchestrates all feature work through these 8 sequential steps. Each step has clear executor, actions, and optional HITL gates. See `.claude/rules/hitl-gates.md` for full gate specifications.

## Steps

1. **Workplan** — PM CLI interprets user intent, drafts high-level plan with scope, agents needed, sequencing, and risks. No HITL gate.

2. **Design Pipeline** — 11-stage sequential pipeline: scaffold, design, user stories, diagrams, 2-round review, task breakdown, user approval. Uses `@design-pipeline` skill. HITL gates: **Design Review R2** (mandatory), **User Gate** (mandatory).

3. **TDD Build** — 3-agent micro-cycle engine (test-writer, code-writer, refactorer) implementing tasks via Red-Green-Refactor. Uses `@tdd-build` skill. HITL gates: **Refactor Approval** (advisory), **Test Failures > 3** (advisory).

4. **Code Review** — 3-agent parallel review: architecture, code quality + security, test coverage. All findings become GitHub issues. Uses `@code-review` skill. No HITL gate.

5. **Feature Completion** — Validates tasks complete, tests pass, linter clean, interfaces match, E2E passing, docs updated. Uses `@feature-completion` skill. No HITL gate.

6. **Commit** — Conventional commit with traceability (`type(scope): desc` + `Refs:` + `Co-Authored-By:`). Uses `@commit` skill. HITL gate: **Protected Path Commit** (mandatory) for `contracts/` or `.claude/`.

7. **DevOps** — PM CLI coordinates, devops agent executes. Uses `@deploy` skill. HITL gate: **DevOps Invocation** (mandatory).

8. **Closure** — PM CLI summarizes implementation, closes GitHub issues with commit references, notes deferred work. No HITL gate.

## HITL Gates by Step

| Step | Gate | Type |
|------|------|------|
| 2 | Design Review R2 | Mandatory |
| 2 | User Gate | Mandatory |
| 3 | Refactor Approval | Advisory |
| 3 | Test Failures > 3 | Advisory |
| 6 | Protected Path Commit | Mandatory |
| 7 | DevOps Invocation | Mandatory |

## Skills by Step

| Step | Skill | Purpose |
|------|-------|---------|
| 2 | design-pipeline | Feature design, review, and task breakdown |
| 2 | task-breakdown | Atomic task decomposition (invoked by pipeline) |
| 2 | diagram-builder | Mermaid diagrams (auto-invoked by pipeline) |
| 3 | tdd-build | Three Laws TDD micro-cycles |
| 4 | code-review | 3-agent parallel code review |
| 4 | security-review | OWASP, deps, secrets (invoked by code-review) |
| 5 | feature-completion | Feature validation and sign-off |
| 5 | testing | Quality gates (test, lint, SAST, SCA, E2E) |
| 6 | commit | Conventional commits with traceability |
| 7 | deploy | Environment deployment |
