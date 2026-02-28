---
description: 11-step development workflow with HITL gates and skills
paths:
  - "**/*"
---

# Development Workflow

PM CLI orchestrates all feature work through these 11 sequential steps. Each step has clear executor, actions, and optional HITL gates. See `.claude/rules/hitl-gates.md` for full gate specifications.

## Steps

1. **Workplan** -- PM CLI interprets user intent, drafts high-level plan with scope, agents needed, sequencing, and risks. No HITL gate.

2. **Planning** -- Planner agent creates `.workitems/Pnn-Fnn-description/` with design.md, user_stories.md, tasks.md (atomic, <2hr each). Uses `@feature-planning` skill. Use `ks_search` for existing patterns. Diagram-builder auto-triggers. No HITL gate.

3. **Diagrams** -- Planner or orchestrator creates additional Mermaid diagrams in `docs/diagrams/` using `@diagram-builder` skill. No HITL gate.

4. **Design Review** -- Reviewer agent validates planning artifacts. HITL gate: **Design Review Concerns** (advisory) if concerns found -- options: address / proceed / abort.

5. **Re-plan** -- PM CLI assigns tasks to agents, plans execution strategy. HITL gate: **Complex Operation** (advisory) if >10 files or cross-domain.

6. **Parallel Build** -- Backend/frontend agents implement via `@tdd-execution` (Red-Green-Refactor). PM CLI delegates ONE atomic task at a time, waits for completion, pauses for session renewal. HITL gate: **Permission Forwarding** if agent is blocked by permissions.

7. **Testing** -- Implementing agents verify all tests pass. HITL gate: **Test Failures > 3** (advisory) if same test fails 3+ times. Never proceed to Step 8 with failing tests.

8. **Review** -- Reviewer agent inspects code quality, test coverage, security, performance. Uses `ks_search` for pattern comparison. All findings become GitHub issues with labels (`security`, `bug`, `enhancement`). No HITL gate.

9. **Orchestration** -- Orchestrator runs `./tools/e2e.sh`, `./tools/lint.sh`, commits to main. Uses `@feature-completion` skill. HITL gate: **Protected Path Commit** (mandatory) for `contracts/` or `.claude/`.

10. **DevOps** -- PM CLI coordinates, devops agent executes. HITL gate: **DevOps Invocation** (mandatory) -- options: run here / send to CLI / manual instructions.

11. **Closure** -- PM CLI summarizes implementation, closes GitHub issues with commit references, notes deferred work. No HITL gate.

## HITL Gates by Step

| Step | Gate | Type |
|------|------|------|
| 4 | Design Review Concerns | Advisory |
| 5 | Complex Operation | Advisory |
| 6 | Permission Forwarding | Per-request |
| 7 | Test Failures > 3 | Advisory |
| 9 | Protected Path Commit | Mandatory |
| 10 | DevOps Invocation | Mandatory |

## Skills by Step

| Step | Skill | Purpose |
|------|-------|---------|
| 2 | feature-planning | Create work item artifacts |
| 3 | diagram-builder | Generate Mermaid diagrams |
| 4, 8 | code-review | Code analysis and review |
| 6 | tdd-execution | Red-Green-Refactor cycle |
| 7 | testing | Quality gates (test, lint, SAST, SCA, E2E) |
| 9 | feature-completion | Validate and complete feature |
| 10 | deploy | Environment deployment |
