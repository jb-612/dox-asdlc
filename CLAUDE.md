# aSDLC Project

Agentic Software Development Lifecycle using Claude Agent SDK, Redis coordination, and bash tools.

## Mandatory Development Workflow

All feature work follows the 11-step workflow. See `.claude/rules/workflow.md` for full details.

1. Workplan -- PM CLI drafts plan
2. Planning -- Planner creates work items (`@feature-planning`)
3. Diagrams -- Architecture diagrams (`@diagram-builder`)
4. Design Review -- Reviewer validates (HITL: advisory)
5. Re-plan -- PM CLI assigns scopes
6. Parallel Build -- Backend/Frontend via TDD (`@tdd-execution`)
7. Testing -- Unit/integration tests (`@testing`)
8. Review -- Reviewer inspects, findings become GitHub issues
9. Orchestration -- E2E, lint, commit to main (`@feature-completion`)
10. DevOps -- Infrastructure (HITL: mandatory)
11. Closure -- Summary, close issues

## PM CLI Role

PM CLI coordinates between the user and specialized agents. It plans workflow, delegates atomic tasks, tracks progress, and handles blockers. PM CLI does NOT write code, create tests, modify source files, make commits, or design architecture.

- **Message check**: Native teams deliver automatically; Redis sessions call `coord_check_messages` every turn
- **Presence check**: Call `coord_get_presence` before delegating; warn if stale (>5min) or offline (>15min)
- **Delegation**: ONE atomic task at a time sequentially; use TeamCreate for parallel work
- **Task visibility**: Use TaskCreate/TaskUpdate for all multi-step work

## Non-Negotiable Rules

1. **Plan before code** -- Steps 1-2 must complete before Step 6
2. **TDD required** -- Step 6 uses `@tdd-execution` skill (Red-Green-Refactor)
3. **Commit only complete features** -- Step 9 uses `@feature-completion` skill
4. **Review findings become issues** -- All code review findings become GitHub issues
5. **Orchestrator exclusively owns meta files** -- CLAUDE.md, docs/, contracts/, .claude/**
6. **Task visibility required** -- Use TaskCreate/TaskUpdate for all multi-step work
7. **Trunk-based development** -- All work targets main branch directly

## Roles and Path Restrictions

| Role | Purpose | Domain |
|------|---------|--------|
| planner | Creates planning artifacts only | .workitems/ |
| backend | Backend implementation | P01-P03, P06 |
| frontend | SPA/HITL UI, mock-first | P05 |
| reviewer | Read-only code review | All (read) |
| test-writer | Writes failing tests from specs (RED phase) | Test files |
| debugger | Read-only test failure diagnostics | All (read) |
| orchestrator | Coordination, docs, meta, commits | Meta files |
| devops | Docker, K8s, cloud, GitHub Actions | Infrastructure |

**Path restrictions:**
- **backend**: `src/workers/`, `src/orchestrator/`, `src/infrastructure/`, `.workitems/P01-P03,P06`
- **frontend**: `docker/hitl-ui/`, `src/hitl_ui/`, `.workitems/P05-*`
- **devops**: `docker/`, `helm/`, `.github/workflows/`, `scripts/k8s/`
- **orchestrator**: All paths, exclusive: `CLAUDE.md`, `docs/`, `contracts/`, `.claude/`

See `.claude/agents/` for full agent definitions.

## Trunk-Based Development

All work targets `main`. Orchestrator is primary commit authority; devops commits infrastructure only. Other agents prepare changes but do not commit.

- Pre-commit hook enforces `./tools/test.sh --quick`
- Protected paths (`contracts/`, `.claude/`) require HITL confirmation
- Orchestrator can revert any commit when tests on main are failing

## Coding Standards

**Python** (src/, tests/): 100 char lines, type hints required, Google-style docstrings, isort imports, use `src/core/exceptions.py` (never bare `Exception`), async via `asyncio`.

**TypeScript** (docker/hitl-ui/): Strict mode, prettier formatting, eslint recommended, prefer interfaces over type aliases.

**Bash** (tools/): `#!/bin/bash` with `set -euo pipefail`, output JSON `{ "success": bool, "results": [], "errors": [] }`, exit 0 on success.

**Tests**: One file per module (`test_{module}.py`), naming `test_{function}_{scenario}_{outcome}()`, 80% coverage minimum.

## Skills

| Skill | Purpose | Invocation |
|-------|---------|------------|
| `feature-planning` | Create work item artifacts | Workflow step 2 |
| `tdd-execution` | Red-Green-Refactor cycle | Workflow step 6 |
| `feature-completion` | Validate and complete feature | Workflow step 9 |
| `contract-update` | API contract changes | On demand |
| `diagram-builder` | Mermaid diagrams | Workflow step 3 |
| `multi-review` | Parallel AI code review (Gemini + Codex via mprocs) | Workflow step 8 |
| `testing` | Quality gates (test, lint, SAST, SCA, E2E) | Workflow step 7 |
| `code-review` | Code analysis and review | Workflow steps 4, 8 |
| `deploy` | Environment deployment (Cloud Run, K8s) | Workflow step 10 |

Each skill lives in `.claude/skills/<name>/` with SKILL.md + optional `scripts/` directory.

## Multi-Session Infrastructure

Multiple CLI sessions run in parallel via isolated git worktrees, organized by bounded context. See `.claude/rules/coordination-protocol.md` for coordination details.

Quick start: `./scripts/start-session.sh <context>` then `cd .worktrees/<context> && claude`

## Related Docs

- `.claude/rules/workflow.md` -- Full 11-step workflow
- `.claude/rules/hitl-gates.md` -- HITL gate specifications
- `.claude/rules/coordination-protocol.md` -- Multi-session coordination and native teams
- `docs/environments/README.md` -- Environment tiers and deployment
