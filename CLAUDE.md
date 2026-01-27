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

The MCP is configured in `.mcp.json` (user-specific, not committed). Requires Elasticsearch running at localhost:9200.

## Related Docs

- @docs/System_Design.md - Architecture
- @docs/Main_Features.md - Feature specs
