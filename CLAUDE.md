# aSDLC Project

Agentic Software Development Lifecycle using Claude Agent SDK, Redis coordination, and bash tools.

## PM CLI Role

This main session acts as Project Manager (PM CLI). It:
- Plans and delegates work, does NOT implement code
- Coordinates specialized agents
- Follows the 11-step workflow
- Enforces HITL gates for critical operations

See `.claude/rules/pm-cli/` for full PM CLI behavior.

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

See `.claude/rules/workflow/` for full step details and HITL gates.

## Non-Negotiable Rules

1. **Plan before code** — See `@feature-planning` skill for work item creation
2. **TDD required** — See `@tdd-execution` skill for Red-Green-Refactor
3. **Commit only complete features** — See `@feature-completion` skill for validation
4. **Review findings become issues** — All code review findings become GitHub issues
5. **Orchestrator exclusively owns meta files** — CLAUDE.md, docs/, contracts/, .claude/**
6. **Task visibility required** — See `.claude/rules/task-visibility.md`

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

## Path Restrictions

- **backend**: `src/workers/`, `src/orchestrator/`, `src/infrastructure/`, `.workitems/P01-P03,P06`
- **frontend**: `docker/hitl-ui/`, `src/hitl_ui/`, `.workitems/P05-*`
- **devops**: `docker/`, `helm/`, `.github/workflows/`, `scripts/k8s/`
- **orchestrator**: All paths, exclusive: `CLAUDE.md`, `docs/`, `contracts/`, `.claude/`

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

## Commands

Scripts are owned by their respective skills. Original paths forward to skill locations:

```bash
# Planning (see @feature-planning)
./scripts/new-feature.sh P01 F02 "feature-name"
./scripts/check-planning.sh P01-F02-feature-name

# Quality gates (see @testing)
./tools/test.sh src/path/to/feature
./tools/lint.sh src/
./tools/e2e.sh

# Completion (see @feature-completion)
./scripts/check-completion.sh P01-F02-feature-name

# Issue Tracking
gh issue list
gh issue create --title "..."
gh issue close <num>
```

## Environment Tiers

| Tier | Platform | Use Case |
|------|----------|----------|
| **Workstation** | Bare metal (tmux + worktrees) | Agent development, multi-session work |
| **Local Dev** | Docker Compose | Rapid iteration (recommended for daily dev) |
| **Local Staging** | K8s (minikube) | Helm chart testing |
| **Remote Lab** | GCP Cloud Run | Demos |
| **Remote Staging** | GCP GKE | Pre-production |

**Quick Start:** `cd docker && docker compose up -d`

See `docs/environments/README.md` for full guides. See `@deploy` skill for deployment scripts.

## KnowledgeStore MCP

Semantic search MCP for exploring the indexed codebase.

| Tool | Purpose |
|------|---------|
| `ks_search` | Semantic search across indexed code and docs |
| `ks_get` | Retrieve specific document by ID |
| `ks_index` | Add new documents to the index |
| `ks_health` | Check Elasticsearch status |

**Configuration:** `localhost:9200` (Elasticsearch), `localhost:6379` (Redis).
For K8s: `./scripts/k8s/port-forward-mcp.sh all`

## Multi-Session Infrastructure

Multiple CLI sessions work in parallel, each in an isolated git worktree organized by **bounded context** (feature/epic), not by agent role.

**Quick Start:**
```bash
./scripts/start-session.sh p11-guardrails
cd .worktrees/p11-guardrails && export CLAUDE_INSTANCE_ID=p11-guardrails && claude
```

| Command | Purpose |
|---------|---------|
| `./scripts/start-session.sh <ctx>` | Create worktree + branch + identity |
| `./scripts/worktree/list-worktrees.sh` | List all worktrees (JSON) |
| `./scripts/worktree/teardown-worktree.sh <ctx>` | Remove worktree (--merge or --abandon) |
| `./scripts/worktree/merge-worktree.sh <ctx>` | Merge feature branch to main via PR |

**Key concepts:**
- **Session Identity** (CLAUDE_INSTANCE_ID) = which feature context
- **Agent Role** (subagent) = which paths are allowed
- **Presence**: Heartbeat every 60s, stale after 5min. See `.claude/rules/coordination-protocol.md`

**Librarian Merge Protocol:** Human acts as integration gatekeeper — merge one branch at a time to main, rebase others after.

See `.claude/rules/parallel-coordination.md` for full multi-session details.

## Guardrails Configuration System

The project includes a dynamic guardrails system (P11-F01) that provides contextually-conditional rules for agent behavior. Guidelines are stored in Elasticsearch, evaluated at runtime against the current task context, and injected into agent sessions via Claude Code hooks. This replaces static rule loading with targeted, per-context enforcement.

See `docs/guardrails/README.md` for full documentation.

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
| `GUARDRAILS_FALLBACK_MODE` | `static` | Behavior when ES unavailable: `static` (use local JSON), `permissive` (allow all), `restrictive` (block) |
| `GUARDRAILS_STATIC_FILE` | `.claude/guardrails-static.json` | Path to static guidelines file (used when fallback_mode=static) |

## Workstation Observability

Hook execution telemetry is captured to a local SQLite database and viewable via a built-in dashboard.

- **Telemetry store**: `~/.asdlc/telemetry.db` (SQLite, WAL mode)
- **Dashboard**: `http://localhost:9191` (zero-dependency Python server)
- **JSONL log**: `/tmp/hook-telemetry.jsonl` (backward compat with Prometheus exporter)

```bash
# Start the dashboard (opens browser on macOS)
./scripts/telemetry/start-dashboard.sh

# Stop the dashboard
./scripts/telemetry/start-dashboard.sh --stop
```

See `docs/observability/workstation.md` for full guide.

## tmux Multi-Session Management

Use tmux to run multiple Claude CLI sessions in parallel, each in its own worktree context:

```bash
# Launch tmux session with PM + feature contexts + dashboard
./scripts/sessions/tmux-launcher.sh p11-guardrails p04-review-swarm

# Start a single feature context (with optional --tmux flag to add to tmux session)
./scripts/start-session.sh p11-guardrails
./scripts/start-session.sh --tmux p11-guardrails

# List sessions across all sources (tmux, SQLite, worktrees)
./scripts/sessions/list-sessions.sh
```

tmux shortcuts: `Ctrl-b n` (next window), `Ctrl-b p` (previous window), `Ctrl-b w` (window list).

## Related Docs

- docs/environments/README.md — Environment tiers
- docs/Main_Features.md — Feature specs
- docs/K8s_Service_Access.md — K8s networking
- docs/guardrails/README.md — Guardrails configuration system
- docs/observability/workstation.md — Workstation observability guide
- docs/decisions/e2b-evaluation.md — E2B sandbox evaluation (deferred)
- docs/decisions/hook-consolidation.md — Hook consolidation ADR
