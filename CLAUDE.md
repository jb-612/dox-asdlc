# aSDLC Project

Agentic Software Development Lifecycle using Claude Agent SDK, Redis coordination, and bash tools.

## IMPORTANT: Workflow Rules

1. **YOU MUST plan before code** - Create `.workitems/Pnn-Fnn-name/` with design.md, user_stories.md, tasks.md BEFORE any implementation
2. **YOU MUST use TDD** - Write failing test first, then implement, then refactor
3. **YOU MUST commit only complete features** - All tests pass, 100% task completion

## Commands

```bash
# Planning
./scripts/new-feature.sh P01 F02 "feature-name"
./scripts/check-planning.sh P01-F02-feature-name

# Testing
./tools/test.sh src/path/to/feature
./tools/lint.sh src/
./tools/e2e.sh

# Completion
./scripts/check-completion.sh P01-F02-feature-name
```

## Subagents

Use role-specific subagents in `.claude/agents/`:

| Task | Subagent |
|------|----------|
| Backend (workers, infra) | `backend` |
| Frontend (HITL UI) | `frontend` |
| Meta files, contracts | `orchestrator` |

## Path Restrictions

- **backend**: `src/workers/`, `src/orchestrator/`, `src/infrastructure/`, `.workitems/P01-P03,P06`
- **frontend**: `docker/hitl-ui/`, `src/hitl_ui/`, `.workitems/P05-*`
- **orchestrator**: All paths, exclusive: `CLAUDE.md`, `docs/`, `contracts/`, `.claude/rules/`

## Work Item Format

```
.workitems/Pnn-Fnn-{description}/
├── design.md        # Technical approach, interfaces
├── user_stories.md  # Acceptance criteria
└── tasks.md         # Atomic tasks (<2hr each)
```

## Related Docs

- @docs/System_Design.md - Architecture
- @docs/Main_Features.md - Feature specs
