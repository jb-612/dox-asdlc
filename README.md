# aSDLC Implementation Project

An Agentic Software Development Lifecycle (aSDLC) system using the Claude Agent SDK, Redis for event coordination, and a bash-first tool abstraction layer. The system follows Spec Driven Development principles with explicit HITL governance gates.

## Quick Start

This project uses Claude Code CLI for development. The workflow enforces planning before implementation.

**Prerequisites:**

- Python 3.11+
- Claude Code CLI installed and authenticated
- Docker 24+ (for local development)
- Kubernetes + Helm 3+ (optional, for K8s testing)
- gcloud CLI (optional, for remote environments)

## Environment Tiers

| Tier | Platform | Use Case | Speed |
|------|----------|----------|-------|
| **Local Dev** | Docker Compose | Daily development | Fast |
| **Local Staging** | K8s (minikube) | Helm/K8s testing | Slow |
| **Remote Lab** | GCP Cloud Run | Demos | Fast |
| **Remote Staging** | GCP GKE | Pre-production | Slow |

See `docs/environments/README.md` for detailed guides.

**Local Development (Docker Compose) - Recommended:**

```bash
# Clone and enter project
cd dox-asdlc

# Start all services
cd docker && docker compose up -d

# Access services
# HITL UI: http://localhost:3000
# API: http://localhost:8080
# Metrics: http://localhost:8428

# Create a new feature
./scripts/new-feature.sh P01 F02 "feature-name"

# Validate planning before coding
./scripts/check-planning.sh P01-F02-feature-name

# After implementation, validate completion
./scripts/check-completion.sh P01-F02-feature-name
```

**Local Staging (Minikube) - For K8s testing:**

```bash
# Start local cluster
minikube start -p dox-asdlc --cpus=4 --memory=8192

# Build and load images
./scripts/build-images.sh --minikube

# Deploy via Helm
helm upgrade --install dox-asdlc ./helm/dox-asdlc -n dox-asdlc --create-namespace

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

## Remote Deployments

### Remote Lab (GCP Cloud Run)

Quick serverless deployment for demos:

```bash
export PROJECT_ID=your-project-id

# Build and push images
gcloud auth configure-docker
docker build -t gcr.io/$PROJECT_ID/orchestrator -f docker/orchestrator/Dockerfile .
docker push gcr.io/$PROJECT_ID/orchestrator

# Deploy to Cloud Run
gcloud run deploy orchestrator --image gcr.io/$PROJECT_ID/orchestrator --allow-unauthenticated
```

See `docs/environments/remote-lab.md` for full guide.

### Remote Staging (GCP GKE)

Production-like Kubernetes environment:

```bash
export PROJECT_ID=your-project-id
export CLUSTER_NAME=dox-staging

# Get cluster credentials
gcloud container clusters get-credentials $CLUSTER_NAME --region us-central1

# Deploy via Helm
helm upgrade --install dox-asdlc ./helm/dox-asdlc -n dox-staging
```

See `docs/environments/remote-staging.md` for full guide.

### Plane CE (Project Management)

Optionally deploy Plane Community Edition for project/task management:

```bash
# Deploy Plane CE alongside aSDLC
./scripts/k8s/deploy.sh --with-plane

# Access Plane CE UI (minikube)
minikube service plane-app-web -n plane-ce --url
```

## Documentation

- [Environment Tiers](docs/environments/README.md) - Local Dev, Staging, Remote environments
- [Main Features](docs/Main_Features.md) - Feature specifications
- [User Stories](docs/User_Stories.md) - Epic-level requirements
- [K8s Service Access](docs/K8s_Service_Access.md) - Kubernetes networking architecture
- [VictoriaMetrics Monitoring](docs/VictoriaMetrics_Monitoring.md) - Metrics and observability

## License

[License information here]
