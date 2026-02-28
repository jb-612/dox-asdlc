# aSDLC Implementation Project

An Agentic Software Development Lifecycle (aSDLC) system using the Claude Agent SDK, Redis for event coordination, and a bash-first tool abstraction layer. The system follows Spec Driven Development principles with explicit HITL governance gates.

## Quick Start

**Prerequisites:** Python 3.11+, Claude Code CLI, Docker 24+

```bash
cd dox-asdlc

# Start all services
cd docker && docker compose up -d

# Access services
# HITL UI: http://localhost:3000
# API: http://localhost:8080

# Create a new feature
./scripts/new-feature.sh P01 F02 "feature-name"

# Validate planning, then implement, then complete
./scripts/check-planning.sh P01-F02-feature-name
./scripts/check-completion.sh P01-F02-feature-name
```

## Development Workflow

All work follows the 8-step workflow defined in `CLAUDE.md`:

1. **Plan** -- Create work item with design, user stories, and tasks
2. **Validate** -- Run `check-planning.sh` to verify completeness
3. **Implement** -- Execute tasks using TDD (Red-Green-Refactor)
4. **Review** -- Reviewer inspects; findings become GitHub issues
5. **Complete** -- Run `check-completion.sh`, commit only when 100% done

See `.workitems/PLAN.md` for project tracking and `.workitems/README.md` for conventions.

## Multi-Agent Architecture

Multiple Claude CLI sessions work in parallel via isolated git worktrees, organized by bounded context (feature/epic).

| Role | Path Access | Responsibility |
|------|-------------|----------------|
| planner | `.workitems/` | Planning artifacts only |
| backend | `src/workers/`, `src/orchestrator/`, `src/infrastructure/` | Workers, orchestrator, infrastructure |
| frontend | `src/hitl_ui/`, `docker/hitl-ui/` | HITL Web UI, React components |
| reviewer | All (read-only) | Code review, design review |
| test-writer | Test files | Writes failing tests (RED phase) |
| debugger | All (read-only) | Test failure diagnostics |
| orchestrator | All paths, exclusive meta files | Commits, docs, coordination |
| devops | `docker/`, `helm/`, `.github/workflows/` | Infrastructure, deployments |

Coordination via Redis messaging. See `.claude/rules/coordination-protocol.md`.

## Project Structure

```text
dox-asdlc/
├── CLAUDE.md              # Claude Code configuration
├── .claude/               # Claude Code settings and skills
│   ├── settings.json      # Hooks and environment
│   ├── agents/            # Agent definitions
│   ├── rules/             # Development rules
│   └── skills/            # Custom skills
├── .workitems/            # Feature planning artifacts
│   ├── PLAN.md            # Master project plan
│   ├── _templates/        # Work item templates
│   └── Pnn-Fnn-{name}/   # Per-feature folders
├── docs/                  # Solution documentation
├── src/                   # Source code
│   ├── orchestrator/      # Governance container
│   ├── workers/           # Agent workers
│   │   ├── agents/        # Domain agents (discovery, design, dev)
│   │   ├── repo_mapper/   # Context pack generation
│   │   ├── rlm/           # Recursive LLM exploration
│   │   └── pool/          # Worker pool framework
│   ├── infrastructure/    # Redis, RAG backends
│   └── core/              # Shared models, exceptions
├── tests/                 # Test suites
├── tools/                 # Bash tool wrappers
├── docker/                # Container definitions
│   └── hitl-ui/           # HITL Web UI (React SPA)
├── helm/                  # Kubernetes Helm charts
└── scripts/               # Development and session scripts
```

## Environment Tiers

| Tier | Platform | Use Case |
|------|----------|----------|
| **Workstation** | Bare metal (tmux + worktrees) | Agent development |
| **Local Dev** | Docker Compose | Daily development (recommended) |
| **Local Staging** | K8s (minikube) | Helm chart testing |
| **Remote Lab** | GCP Cloud Run | Demos |
| **Remote Staging** | GCP GKE | Pre-production |

See `docs/environments/README.md` for detailed guides and `@deploy` skill for deployment scripts.

## Documentation

- [Environment Tiers](docs/environments/README.md)
- [Main Features](docs/Main_Features.md)
- [K8s Service Access](docs/K8s_Service_Access.md)
- [Guardrails](docs/guardrails/README.md)
- [Observability](docs/observability/workstation.md)
