# aSDLC Project

Agentic Software Development Lifecycle using Claude Agent SDK, Redis coordination, and bash tools.

## PM CLI Role

This main session acts as Project Manager (PM CLI). It:
- Plans and delegates work, does NOT implement code
- Coordinates specialized agents
- Follows the 11-step workflow
- Enforces HITL gates for critical operations

See `.claude/rules/pm-cli.md` for full PM CLI behavior.

## The 11-Step Workflow

```
 1. Workplan         -> PM CLI drafts plan
 2. Planning         -> Planner creates work items
 3. Diagrams         -> Architecture diagrams
 4. Design Review    -> Reviewer validates
 5. Re-plan          -> PM CLI assigns scopes
 6. Parallel Build   -> Backend/Frontend (atomic tasks)
 7. Testing          -> Unit/integration tests
 8. Review           -> Reviewer inspects, issues created
 9. Orchestration    -> E2E, commits
10. DevOps           -> Infrastructure (HITL required)
11. Closure          -> Summary, close issues
```

See `.claude/rules/workflow.md` for full step details and HITL gates.

## Non-Negotiable Rules

1. **Plan before code** - Create `.workitems/Pnn-Fnn-name/` with design.md, user_stories.md, tasks.md BEFORE any implementation
2. **TDD required** - Red -> Green -> Refactor; never move on with failing tests
3. **Commit only complete features** - All tests pass, 100% task completion
4. **Review findings become issues** - All code review findings become GitHub issues
5. **Orchestrator owns meta files** - CLAUDE.md, docs/, contracts/, .claude/**
6. **Task visibility required** - Use TaskCreate/TaskUpdate for all multi-step work to show progress

See `.claude/rules/task-visibility.md` for the task tracking pattern.

## Roles

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

See `.claude/agents/` for full agent definitions.

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

# Issue Tracking
gh issue list                    # List open issues
gh issue create --title "..."    # Create new issue
gh issue close <num>             # Close resolved issue
```

## Path Restrictions

- **backend**: `src/workers/`, `src/orchestrator/`, `src/infrastructure/`, `.workitems/P01-P03,P06`
- **frontend**: `docker/hitl-ui/`, `src/hitl_ui/`, `.workitems/P05-*`
- **devops**: `docker/`, `helm/`, `.github/workflows/`, `scripts/k8s/`
- **orchestrator**: All paths, exclusive: `CLAUDE.md`, `docs/`, `contracts/`, `.claude/`

## Work Item Format

```text
.workitems/Pnn-Fnn-{description}/
├── design.md        # Technical approach, interfaces
├── user_stories.md  # Acceptance criteria
└── tasks.md         # Atomic tasks (<2hr each)
```

## Skills

| Skill | Purpose |
|-------|---------|
| feature-planning | Create work item artifacts |
| tdd-execution | Red-Green-Refactor cycle |
| feature-completion | Validate and complete feature |
| contract-update | API contract changes |
| diagram-builder | Mermaid diagrams |
| multi-review | Parallel AI code review (Gemini + Codex via mprocs) |

## Environment Tiers

The project uses a tiered environment strategy:

| Tier | Platform | Use Case |
|------|----------|----------|
| **Local Dev** | Docker Compose | Rapid iteration (recommended for daily dev) |
| **Local Staging** | K8s (minikube) | Helm chart testing |
| **Remote Lab** | GCP Cloud Run | Demos |
| **Remote Staging** | GCP GKE | Pre-production |

**Quick Start (Local Dev):**
```bash
cd docker && docker compose up -d
# UI: http://localhost:3000
# API: http://localhost:8080
```

See `docs/environments/README.md` for full environment guides.

## KnowledgeStore MCP

The project includes a semantic search MCP for exploring the indexed codebase.

### Tools Available

| Tool | Purpose |
|------|---------|
| `ks_search` | Semantic search across indexed code and docs |
| `ks_get` | Retrieve specific document by ID |
| `ks_index` | Add new documents to the index |
| `ks_health` | Check Elasticsearch status |

### Usage Examples

```bash
# Search for implementation patterns
ks_search query="HITL gate implementation" top_k=5

# Get specific file content
ks_get doc_id="src/core/interfaces.py:0"
```

### When to Use

- Exploring unfamiliar parts of the codebase
- Finding implementation patterns
- Locating related code during reviews
- Understanding how features are connected

### Configuration

MCP servers connect to localhost services exposed by Docker Compose or K8s port-forwards:
- **knowledge-store**: Elasticsearch at `localhost:9200`
- **coordination**: Redis at `localhost:6379`

**Local Dev (Docker Compose):** Services are automatically exposed on localhost.

**K8s (minikube):** Start port-forwards for MCP access:
```bash
./scripts/k8s/port-forward-mcp.sh all  # ES, Redis, HITL UI
```

## Multi-Session Infrastructure

The project supports running multiple Claude CLI sessions in parallel, each in an isolated git worktree with a unique identity. Worktrees are organized by **bounded context** (feature/epic), not by agent role.

### Key Concept: Bounded Context Model

Each worktree represents a feature or work item context (e.g., `p11-guardrails`, `p04-review-swarm`). Within a single CLI session, multiple subagents (backend, frontend, reviewer) can work on the same worktree because they're contributing to the same bounded context.

| Aspect | Description |
|--------|-------------|
| Worktree path | `.worktrees/<context>/` (e.g., `.worktrees/p11-guardrails/`) |
| Branch name | `feature/<context>` (e.g., `feature/p11-guardrails`) |
| CLAUDE_INSTANCE_ID | Context name (e.g., `p11-guardrails`) |
| Path restrictions | Determined by subagent role, not worktree |

### Quick Start

To start a session for a specific feature context:

```bash
# Create worktree for a feature
./scripts/start-session.sh p11-guardrails

# Follow the printed instructions:
cd .worktrees/p11-guardrails && export CLAUDE_INSTANCE_ID=p11-guardrails && claude
```

### Worktree Commands

| Command | Purpose |
|---------|---------|
| `./scripts/start-session.sh <context>` | Complete setup for a session |
| `./scripts/worktree/setup-worktree.sh <context>` | Create worktree and branch |
| `./scripts/worktree/list-worktrees.sh` | List all worktrees (JSON) |
| `./scripts/worktree/teardown-worktree.sh <context> [--merge\|--abandon]` | Remove worktree |
| `./scripts/worktree/merge-worktree.sh <context>` | Merge feature branch to main |

Context names follow work item format: `p11-guardrails`, `p04-review-swarm`, `sp01-smart-saver`

### Session Lifecycle

```
1. Setup     -> ./scripts/start-session.sh <context>
               - Creates worktree at .worktrees/<context>/
               - Creates branch feature/<context>
               - Sets CLAUDE_INSTANCE_ID

2. Work      -> cd .worktrees/<context> && export CLAUDE_INSTANCE_ID=<context> && claude
               - Session validates identity on startup
               - Registers presence in Redis
               - Multiple subagents can work in same worktree

3. Commit    -> Work is committed to feature/<context> branch
               - Isolated from main and other contexts

4. Merge     -> ./scripts/worktree/merge-worktree.sh <context>
               - Human reviews as "Librarian" gatekeeper
               - Merges feature branch to main via PR

5. Teardown  -> ./scripts/worktree/teardown-worktree.sh <context> --merge
               - Deregisters session presence
               - Removes worktree
               - Optionally merges changes first
```

### Session Identity vs Agent Role

Identity and role serve different purposes:

| Concept | Purpose | Example |
|---------|---------|---------|
| **Session Identity** (CLAUDE_INSTANCE_ID) | Which feature/context | `p11-guardrails` |
| **Agent Role** (subagent) | Which paths are allowed | `backend`, `frontend` |

Identity is resolved from:
1. `CLAUDE_INSTANCE_ID` environment variable (required for worktrees)
2. Default to `pm` in main repository

### Presence Tracking

Sessions register their presence in Redis for coordination:
- **Heartbeat**: Sessions should heartbeat every 60 seconds
- **Stale Threshold**: 5 minutes without heartbeat marks session stale
- **Startup**: Session presence registered automatically
- **Shutdown**: Presence deregistered on worktree teardown

Check presence with the coordination MCP:
```
coord_get_presence
```

### Shared Resource Rules

When multiple worktrees are active, watch for conflicts in shared resources:

| Resource | Risk | Rule |
|----------|------|------|
| `package-lock.json` | Merge conflicts | One context installs deps at a time |
| DB Migrations | ID collisions | Sequential, never parallel |
| Local ports | Collisions | Use different ports per session |
| `.git/` staging area | Conflicts | Worktrees solve this |

### Librarian Merge Protocol

Human acts as Integration Gatekeeper:
1. Push feature branches, create PRs for review
2. Merge one branch at a time to main
3. Rebase other branches after merge

### Troubleshooting

**Session identity not set:**
```bash
# Set identity explicitly for the context
export CLAUDE_INSTANCE_ID=p11-guardrails
```

**Worktree already exists:**
```bash
# Script is idempotent - safe to run again
./scripts/worktree/setup-worktree.sh p11-guardrails
```

**Uncommitted changes in worktree:**
```bash
# Merge changes to main before removing
./scripts/worktree/teardown-worktree.sh p11-guardrails --merge

# Or abandon changes
./scripts/worktree/teardown-worktree.sh p11-guardrails --abandon
```

**Redis not available:**
- Sessions can start without Redis (warnings only)
- Coordination features will be limited
- Presence tracking disabled

**Merge conflicts:**
```bash
# Resolve by rebasing on main
cd .worktrees/p11-guardrails
git fetch origin
git rebase origin/main
# Fix conflicts, then:
git push origin feature/p11-guardrails --force
```

## Guardrails Configuration System

The project includes a dynamic guardrails system (P11-F01) that provides contextually-conditional rules for agent behavior. Guidelines are stored in Elasticsearch, evaluated at runtime against the current task context, and injected into agent sessions via Claude Code hooks. This replaces static rule loading with targeted, per-context enforcement.

See `@docs/guardrails/README.md` for full documentation.

### Key Commands

```bash
# Bootstrap default guidelines into Elasticsearch
python scripts/bootstrap_guardrails.py --es-url http://localhost:9200

# Preview bootstrap without writing
python scripts/bootstrap_guardrails.py --dry-run
```

### Key Interfaces

- **HITL UI:** Navigate to `/guardrails` in the HITL UI to manage guidelines
- **MCP Tool:** `guardrails_get_context(agent="backend", action="implement")` evaluates matching guidelines
- **REST API:** `GET/POST/PUT/DELETE /api/guardrails` for CRUD operations

### Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `GUARDRAILS_ENABLED` | `true` | Master enable/disable |
| `ELASTICSEARCH_URL` | `http://localhost:9200` | ES connection |
| `GUARDRAILS_CACHE_TTL` | `60.0` | Evaluator cache TTL in seconds |
| `GUARDRAILS_FALLBACK_MODE` | `permissive` | Behavior when ES unavailable |

## Related Docs

- @docs/environments/README.md - Environment tiers
- @docs/Main_Features.md - Feature specs
- @docs/K8s_Service_Access.md - K8s networking
- @docs/guardrails/README.md - Guardrails configuration system
