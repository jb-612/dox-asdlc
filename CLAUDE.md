# aSDLC Development Project

## Project Overview

This project implements an Agentic Software Development Lifecycle (aSDLC) system using the Claude Agent SDK, Redis for event coordination, and a bash-first tool abstraction layer. The system follows Spec Driven Development principles with explicit HITL governance gates.

## Development Approach

This project follows a **Spec Driven Development** workflow. No coding begins until planning artifacts are complete.

### Workflow Rules

1. **Plan Before Code**: Every feature requires completed design, user stories, and task breakdown before implementation begins.

2. **TDD Execution**: Implement tasks one at a time using test-driven development. Write tests first, then implement to pass.

3. **Feature Completion**: A feature is complete only when all tasks pass, E2E tests pass, linter passes, and documentation is updated.

4. **Atomic Commits**: Commit only when a feature reaches 100% completion. No partial feature commits to main branch.

## Project Structure

```
/asdlc-project
├── CLAUDE.md                    # This file
├── .claude/
│   ├── settings.json            # Claude Code settings
│   ├── rules/                   # Development rules
│   ├── skills/                  # Custom skills
│   └── subagents/               # Subagent definitions
├── .workitems/                  # Feature planning folders
│   └── Pnn-Fnn-{description}/   # Per-feature planning
│       ├── design.md            # Technical design
│       ├── user_stories.md      # Success criteria
│       └── tasks.md             # Atomic task breakdown
├── docs/                        # Solution documentation
│   ├── BRD_HTML_Diagram.md
│   ├── Main_Features.md
│   ├── User_Stories.md
│   └── System_Design.md
├── src/                         # Source code
│   ├── orchestrator/            # Container 1: Governance
│   ├── workers/                 # Container 2: Agent workers
│   ├── infrastructure/          # Container 3: Redis, RAG
│   └── hitl_ui/                 # Container 4: HITL Web UI
├── tools/                       # Bash tool wrappers
├── tests/                       # Test suites
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docker/                      # Container definitions
└── scripts/                     # Development scripts
```

## Work Item Naming Convention

All feature work is tracked in `.workitems/` with the naming pattern:

```
Pnn-Fnn-{description}
```

Where:
- `Pnn` = Phase or Epic number (P01, P02, etc.)
- `Fnn` = Feature number within the phase (F01, F02, etc.)
- `{description}` = Kebab-case feature name

Example: `P01-F01-infra-setup`, `P02-F03-repo-mapper-agent`

## Development Commands

### Planning Phase
```bash
# Create new feature work item
./scripts/new-feature.sh P01 F01 "infra-setup"

# Validate planning completeness
./scripts/check-planning.sh P01-F01-infra-setup
```

### Implementation Phase
```bash
# Run tests for current feature
./tools/test.sh src/path/to/feature

# Run linter
./tools/lint.sh src/

# Run E2E tests
./tools/e2e.sh
```

### Completion Phase
```bash
# Update feature progress
./scripts/update-progress.sh P01-F01-infra-setup 100

# Validate feature completion
./scripts/check-completion.sh P01-F01-infra-setup

# Commit completed feature
git add -A && git commit -m "feat(P01-F01): infra-setup complete"
```

## Phase Overview

### Phase 1: Infrastructure Foundation
- P01-F01: Infrastructure setup (Docker, Redis, directory structure)
- P01-F02: Bash tool abstraction layer
- P01-F03: KnowledgeStore interface and ChromaDB backend

### Phase 2: Orchestration Core
- P02-F01: Redis event streams and consumer groups
- P02-F02: Manager Agent and commit gateway
- P02-F03: HITL dispatcher and decision logging

### Phase 3: Agent Workers
- P03-F01: Agent worker pool framework
- P03-F02: Context pack generation (Repo Mapper)
- P03-F03: RLM native implementation

### Phase 4: Domain Agents
- P04-F01: Discovery agents (PRD, Acceptance)
- P04-F02: Design agents (Surveyor, Architect)
- P04-F03: Development agents (UTest, Coding, Debugger, Reviewer)
- P04-F04: Validation and Deployment agents

### Phase 5: HITL and Integration
- P05-F01: HITL Web UI
- P05-F02: End-to-end workflow integration
- P05-F03: Observability and metrics

## Key Principles

1. **Git is authoritative** — All state derives from Git commits.
2. **Bash-first tools** — All tools are bash wrappers with JSON contracts.
3. **Container isolation** — Governance has exclusive commit access.
4. **Evidence required** — No gate advances without artifacts.
5. **Idempotent handlers** — All event processing is retry-safe.

## Memory Anchors

When resuming work, check:
1. Current phase and feature in `.workitems/`
2. Task progress in the active `tasks.md`
3. Any blocked items or dependencies
4. Last commit message for context

## Related Documentation

- Solution Design: `docs/System_Design.md`
- Feature Requirements: `docs/Main_Features.md`
- User Stories: `docs/User_Stories.md`
- Blueprint BRD: `docs/BRD_HTML_Diagram.md`
