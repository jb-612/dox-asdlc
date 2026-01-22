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
│   ├── subagents/               # Subagent definitions
│   └── coordination/            # Parallel CLI coordination
│       ├── status.json          # Instance status
│       ├── messages/            # Coordination messages
│       ├── pending-acks/        # Awaiting acknowledgment
│       └── locks/               # Soft file locks
├── contracts/                   # API contracts
│   ├── current/                 # Active contracts (symlinks)
│   ├── versions/                # Version snapshots
│   ├── proposed/                # Pending changes
│   └── CHANGELOG.md
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
├── helm/                        # Kubernetes Helm charts
│   └── dox-asdlc/               # Umbrella chart
│       ├── Chart.yaml
│       ├── values.yaml
│       ├── values-minikube.yaml
│       └── charts/              # Sub-charts
│           ├── redis/
│           ├── chromadb/
│           ├── orchestrator/
│           ├── workers/
│           └── hitl-ui/
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

### Kubernetes Development (Phase 6+)
```bash
# Start local Kubernetes cluster
./scripts/k8s/start-minikube.sh

# Deploy all services via Helm
./scripts/k8s/deploy.sh

# Helm operations
helm upgrade --install dox-asdlc ./helm/dox-asdlc -f helm/dox-asdlc/values-minikube.yaml
helm list -n dox-asdlc

# Verify deployment
kubectl get pods -n dox-asdlc
kubectl get services -n dox-asdlc

# Teardown
./scripts/k8s/teardown.sh
```

## Compliance Verification

**CRITICAL: Run before ANY coding session**

Compliance failures are **BLOCKING**. Do not write code until resolved.

```bash
# Check SDD compliance for a feature
./scripts/check-compliance.sh P03-F01-agent-worker-pool

# Check session start requirements (parallel work)
./scripts/check-compliance.sh --session-start

# Full pre-commit check
./scripts/check-compliance.sh --pre-commit P03-F01-agent-worker-pool
```

### What the Compliance Check Verifies

**Feature check (`./scripts/check-compliance.sh FEATURE_ID`):**
- Work item folder exists: `.workitems/FEATURE_ID/`
- `design.md`, `user_stories.md`, `tasks.md` exist and are non-empty
- Planning artifacts are committed to git (not just on disk)

**Session start check (`--session-start`):**
- `CLAUDE_INSTANCE_ID` environment variable is set
- Current branch matches instance's branch prefix
- No pending coordination messages require acknowledgment

**Pre-commit check (`--pre-commit FEATURE_ID`):**
- All feature checks pass
- All tests pass (`./tools/test.sh`)
- Linter passes (`./tools/lint.sh`)
- `tasks.md` shows 100% progress

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
- P05-F04: Adaptive Feedback Learning (Evaluator Agent)

### Phase 6: Kubernetes Platform Migration
- P06-F01: Kubernetes base infrastructure (minikube, Helm)
- P06-F02: Redis StatefulSet deployment
- P06-F03: ChromaDB StatefulSet deployment (RAG service)
- P06-F04: Stateless services deployment (orchestrator, workers, HITL-UI)
- P06-F05: Multi-tenancy support

## Key Principles

1. **Git is authoritative** — All state derives from Git commits.
2. **Bash-first tools** — All tools are bash wrappers with JSON contracts.
3. **Container isolation** — Governance has exclusive commit access.
4. **Evidence required** — No gate advances without artifacts.
5. **Idempotent handlers** — All event processing is retry-safe.
6. **Continuous improvement** — HITL feedback trains the system via the Evaluator Agent.

## Memory Anchors

When resuming work, check:
1. Current phase and feature in `.workitems/`
2. Task progress in the active `tasks.md`
3. Any blocked items or dependencies
4. Last commit message for context
5. `git status` for uncommitted complete work

## Related Documentation

- Solution Design: `docs/System_Design.md`
- Feature Requirements: `docs/Main_Features.md`
- User Stories: `docs/User_Stories.md`
- Blueprint BRD: `docs/BRD_HTML_Diagram.md`

## Parallel Claude CLI Coordination

This project supports multiple Claude CLI instances working simultaneously on different features.

### Instance Setup

Before starting a Claude CLI session for parallel work:

```bash
# For HITL Web UI development (P05-F01)
source scripts/cli-identity.sh ui

# For Agent Workers development (P03)
source scripts/cli-identity.sh agent

# Check coordination status
source scripts/cli-identity.sh status

# Deactivate when done
source scripts/cli-identity.sh deactivate
```

### Branch Strategy

```
main                              # Protected - human merge only
├── ui/P05-F01-hitl-ui            # UI-CLI feature branch
├── agent/P03-F01-worker-pool     # Agent-CLI feature branch
└── contracts/vX.Y                # Shared contract updates
```

**Branch Rules:**
- UI-CLI commits only to `ui/*` branches
- Agent-CLI commits only to `agent/*` branches
- Neither commits directly to `main`
- `contracts/*` branches require coordination message first

### File Ownership Boundaries

| Instance | Owns (Read/Write) | Can Read | Cannot Touch |
|----------|-------------------|----------|--------------|
| UI-CLI | `src/hitl_ui/`, `docker/hitl-ui/` | `contracts/`, `src/core/` | `src/workers/`, `src/orchestrator/` |
| Agent-CLI | `src/workers/`, `src/orchestrator/` | `contracts/`, `src/core/` | `src/hitl_ui/` |

**Shared (both read, coordinate writes):**
- `contracts/`
- `src/core/interfaces.py`
- `src/core/events.py`

### Contract Management

Contracts define the interfaces between components:

```
contracts/
├── current/                 # Active contracts (symlinks)
│   ├── events.json          # Event schemas
│   ├── hitl_api.json        # HITL API endpoints
│   └── knowledge_store.json # RAG interface
├── versions/v1.0.0/         # Version snapshots
├── proposed/                # Pending changes
└── CHANGELOG.md
```

**Contract Change Protocol:**
1. Proposer creates change in `contracts/proposed/`
2. Proposer writes coordination message in `.claude/coordination/messages/`
3. Consumer acknowledges or requests discussion
4. After ACK: move to `contracts/versions/vX.Y.Z/`, update `current/` symlinks
5. Update `contracts/CHANGELOG.md`

### Coordination Protocol

Instances communicate via files in `.claude/coordination/`:

```
.claude/coordination/
├── status.json              # Instance status (active, branch, task)
├── messages/                # Timestamped coordination messages
├── pending-acks/            # Messages awaiting acknowledgment
└── locks/                   # Soft file locks for shared resources
```

**Coordination Scripts:**
```bash
# Publish a coordination message
./scripts/coordination/publish-message.sh CONTRACT_CHANGE_PROPOSED hitl_api "Added endpoint"

# Check for messages requiring attention
./scripts/coordination/check-messages.sh

# Acknowledge a message
./scripts/coordination/ack-message.sh <message-id>
```

### Merge Strategy

Human-in-the-loop merge order:
1. Merge `contracts/*` changes first
2. Merge `agent/*` branch (provides backend)
3. Merge `ui/*` branch (consumes backend)
4. Run integration tests: `./tools/e2e.sh`

Use the merge helper for guidance:
```bash
./scripts/merge-helper.sh ui/P05-F01-hitl-ui agent/P03-F01-worker-pool
```
