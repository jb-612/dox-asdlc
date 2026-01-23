# aSDLC Implementation Project

An Agentic Software Development Lifecycle (aSDLC) system using the Claude Agent SDK, Redis for event coordination, and a bash-first tool abstraction layer. The system follows Spec Driven Development principles with explicit HITL governance gates.

## Quick Start

This project uses Claude Code CLI for development. The workflow enforces planning before implementation.

**Prerequisites:**

- Python 3.11+
- Claude Code CLI installed and authenticated
- Docker 24+ (for local development)
- Kubernetes + Helm 3+ (for k8s deployment)

**Local Development (Docker Compose):**

```bash
# Clone and enter project
cd dox-asdlc

# Start infrastructure
docker compose -f docker/docker-compose.yml up -d

# Create a new feature
./scripts/new-feature.sh P01 F02 "feature-name"

# Validate planning before coding
./scripts/check-planning.sh P01-F02-feature-name

# After implementation, validate completion
./scripts/check-completion.sh P01-F02-feature-name
```

**Kubernetes Development (Minikube):**

```bash
# Start local cluster
./scripts/k8s/start-minikube.sh

# Build and load images into minikube
./scripts/build-images.sh --minikube

# Deploy via Helm
./scripts/k8s/deploy.sh

# Verify
kubectl get pods -n dox-asdlc
```

## Multi-Agent CLI Architecture

This project uses three specialized Claude CLI instances working in parallel:

| Agent | Path Access | Responsibility |
|-------|-------------|----------------|
| Orchestrator | All paths, exclusive meta files | Reviews, merges, meta files, docs |
| Backend | `src/workers/`, `src/orchestrator/`, `src/infrastructure/` | Workers, orchestrator, infrastructure |
| Frontend | `src/hitl_ui/`, `docker/hitl-ui/` | HITL Web UI, frontend components |

Coordination happens via Redis messaging. See `.claude/rules/parallel-coordination.md`.

## Project Structure

```text
dox-asdlc/
├── CLAUDE.md              # Claude Code configuration
├── .claude/               # Claude Code settings and skills
│   ├── settings.json
│   ├── rules/             # Development rules
│   ├── skills/            # Custom skills
│   └── subagents/         # Subagent definitions
├── .workitems/            # Feature planning artifacts
│   └── Pnn-Fnn-{name}/    # Per-feature folders
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
│   └── dox-asdlc/         # Umbrella chart
│       └── charts/        # Sub-charts (redis, chromadb, etc.)
└── scripts/               # Development scripts
    ├── coordination/      # CLI coordination (Redis messaging)
    ├── k8s/               # Kubernetes scripts
    └── orchestrator/      # Orchestrator review scripts
```

## Development Workflow

1. **Plan**: Create work item with design, user stories, and tasks
2. **Validate**: Run `check-planning.sh` to verify completeness
3. **Implement**: Execute tasks using TDD (Red-Green-Refactor)
4. **Complete**: Run `check-completion.sh` to verify all criteria met
5. **Commit**: Commit only when feature is 100% complete

## CLI Coordination

```bash
# Start session with a launcher script (creates identity file)
./start-backend.sh      # For backend development
./start-frontend.sh     # For frontend development
./start-orchestrator.sh # For review/merge operations

# Check coordination messages
./scripts/coordination/check-messages.sh

# Publish a message
./scripts/coordination/publish-message.sh <type> <subject> <description> --to <target>

# Acknowledge a message
./scripts/coordination/ack-message.sh <message-id>
```

## Kubernetes Deployment

For production-like deployments, the system supports Kubernetes via Helm:

```bash
# Start local Kubernetes cluster (minikube)
./scripts/k8s/start-minikube.sh

# Deploy all services via Helm
./scripts/k8s/deploy.sh

# Or deploy manually with Helm
helm upgrade --install dox-asdlc ./helm/dox-asdlc -f helm/dox-asdlc/values-minikube.yaml

# Verify deployment
kubectl get pods -n dox-asdlc
kubectl get services -n dox-asdlc

# Teardown
./scripts/k8s/teardown.sh
```

## Documentation

- [System Design](docs/System_Design.md) - Technical architecture
- [Main Features](docs/Main_Features.md) - Feature specifications
- [User Stories](docs/User_Stories.md) - Epic-level requirements
- [BRD HTML Diagram](docs/BRD_HTML_Diagram.md) - Blueprint visualization

## License

[License information here]
