# Design: PM CLI Workflow Establishment (Expanded)

**Work Item:** META-01-pm-cli-workflow
**Date:** 2026-01-25
**Status:** In Progress
**Full Details:** See `draft-v2-expanded.md` for complete specifications

## 1. Overview and Goals

Establish the Project Manager (PM) CLI as the default main session behavior for this codebase. The PM CLI plans and delegates work but does NOT design features or implement code directly.

### Goals

1. Codify the PM CLI role as the default main session behavior
2. Define the strict 11-step workflow for feature development
3. Clarify role boundaries between PM CLI and subagents (6 roles)
4. Enforce atomic task delegation with session renewal
5. Remove/deprecate the redundant `implementer` agent
6. Add DevOps agent with HITL-required invocation
7. Implement environment-aware permissions (container/K8s vs workstation)
8. Enable multi-CLI coordination via Redis MCP
9. Add Chrome extension advisory pattern for complex operations
10. Add diagram-builder skill for auto-generation during planning

## 2. Multi-CLI DevOps Pattern

```
+---------------------------------------------------------------------------+
|                         PM CLI (Main Session)                              |
+---------------------------------------------------------------------------+
|  When devops needed:                                                       |
|                                                                            |
|  AskUserQuestion:                                                          |
|  +-----------------------------------------------------------------------+ |
|  | "DevOps operation needed: [description]"                              | |
|  |                                                                       | |
|  | Options:                                                              | |
|  |  A) Run devops agent here (I'll wait)                                | |
|  |  B) Send notification to separate DevOps CLI                         | |
|  |  C) Show me instructions (I'll run manually)                         | |
|  +-----------------------------------------------------------------------+ |
|                                                                            |
|  Option A --> Invoke devops agent locally                                  |
|  Option B --> Publish to Redis MCP --> DevOps CLI receives                 |
|  Option C --> Output instructions for Claude Chrome / manual               |
+---------------------------------------------------------------------------+
                              |
                              | Redis MCP (Option B)
                              v
+---------------------------------------------------------------------------+
|                    DevOps CLI (Separate Window)                            |
+---------------------------------------------------------------------------+
|  - Receives DEVOPS_REQUEST notification                                    |
|  - Executes docker/k8s/cloud operations                                    |
|  - Full permissions (isolated environment)                                 |
|  - Acknowledges completion via Redis MCP                                   |
|  - PM CLI receives ACK and continues workflow                              |
+---------------------------------------------------------------------------+
```

## 3. Environment-Aware Permissions

```
+------------------------------------------------------------------+
|                    Permission Decision Tree                       |
+------------------------------------------------------------------+
|                                                                   |
|  Is /.dockerenv present OR KUBERNETES_SERVICE_HOST set?          |
|                     |                                             |
|          +----------+----------+                                  |
|          |                     |                                  |
|         YES                   NO                                  |
|          |                     |                                  |
|          v                     v                                  |
|   +--------------+   +----------------------------+               |
|   | FULL FREEDOM |   | WORKSTATION RESTRICTIONS   |               |
|   +--------------+   +----------------------------+               |
|   | - All bash   |   | - No --force flags         |               |
|   | - Force flags|   | - No rm -rf                |               |
|   | - Destructive|   | - No kubectl delete        |               |
|   | - No HITL    |   | - HITL for deploys         |               |
|   |   needed     |   | - HITL for commits to      |               |
|   +--------------+   |   contracts/, .claude/     |               |
|                      +----------------------------+               |
+------------------------------------------------------------------+
```

## 4. File Changes (16 files)

| # | File | Action | Notes |
|---|------|--------|-------|
| 1 | `.claude/rules/pm-cli.md` | **New** | PM CLI role, multi-CLI coordination, Chrome advisory |
| 2 | `.claude/rules/hitl-gates.md` | **New** | HITL gate definitions, questions, triggers |
| 3 | `.claude/rules/permissions.md` | **New** | Environment-aware permissions, tiers |
| 4 | `.claude/rules/workflow.md` | Revise | 11-step workflow with HITL gates |
| 5 | `CLAUDE.md` | Revise | All roles, workflow, HITL, permissions summary |
| 6 | `.claude/rules/identity-selection.md` | Update | 6 agents including devops |
| 7 | `.claude/rules/trunk-based-development.md` | Update | Orchestrator commits, protected paths |
| 8 | `.claude/rules/parallel-coordination.md` | Update | Multi-CLI patterns, Redis MCP |
| 9 | `.claude/agents/orchestrator.md` | Update | Atomic delegation, E2E, commit |
| 10 | `.claude/agents/devops.md` | **New** | Docker, K8s, GCP/AWS, GitHub Actions |
| 11 | `.claude/skills/diagram-builder/SKILL.md` | **New** | Mermaid diagrams, auto + explicit |
| 12 | `.claude/skills/feature-completion/SKILL.md` | Update | Orchestrator E2E step |
| 13 | `.claude/agents/implementer.md` | Delete | Merged into backend/frontend |
| 14 | `.claude/FILE_INDEX.md` | Update | All new files, remove implementer |
| 15 | `.claude/settings.json` | Update | Environment-aware permissions |
| 16 | `docs/diagrams/*.mmd` | Update | Remove implementer references |

## 5. 11-Step Workflow

```
 1. Workplan         -> PM CLI drafts plan
 2. Planning         -> Planner creates work items
                        +-> diagram-builder (auto) for architecture diagrams
 3. Diagrams         -> Explicit diagram requests if needed
 4. Design Review    -> Reviewer validates
                        +-> HITL if concerns found
 5. Re-plan          -> PM CLI assigns scopes, considers multi-CLI
                        +-> Advisory: Chrome extension for complex ops
 6. Parallel Build   -> Backend/Frontend (atomic tasks)
                        +-> Permission forwarding if blocked
 7. Testing          -> Unit/integration tests
                        +-> HITL if failures > 3
 8. Review           -> Reviewer inspects, issues created
 9. Orchestration    -> Orchestrator runs E2E
                        +-> HITL for protected path commits
10. DevOps           -> PM CLI coordinates (HITL required)
                        +-> Local / Separate CLI / Instructions
11. Closure          -> PM CLI summarizes, closes issues
```

## 6. Roles (6 agents)

| Role | Purpose | Domain | Invoker |
|------|---------|--------|---------|
| planner | Planning artifacts only | .workitems/ | PM CLI |
| backend | Backend implementation | P01-P03, P06 | PM CLI |
| frontend | SPA/HITL UI, mock-first | P05 | PM CLI |
| reviewer | Read-only code review | All (read) | PM CLI |
| orchestrator | Coordination, docs, meta, commits | Meta files | PM CLI |
| devops | Docker, K8s, cloud, GitHub Actions | Infrastructure | PM CLI only (HITL) |

## 7. HITL Gates

| Gate | Trigger | Mandatory? | Question |
|------|---------|------------|----------|
| DevOps Invocation | Before any devops operation | **Yes** | "DevOps needed: [desc]. Run here / Send to DevOps CLI / Show instructions?" |
| Protected Path Commit | Commit to `contracts/`, `.claude/` | **Yes** | "Committing to protected path. Confirm?" |
| Contract Change | API contract modification | **Yes** | "This changes public API. Consumers notified?" |
| Destructive Workstation Op | rm, delete, prune on workstation | **Yes** | "Destructive operation on workstation. Confirm?" |
| Design Review Concerns | Reviewer found concerns | Advisory | "Review found [N] concerns. Address / Proceed / Abort?" |
| Test Failures > 3 | Repeated test failures | Advisory | "Tests failing repeatedly. Debug / Skip / Abort?" |
| Complex Operation | >10 files or cross-domain | Advisory | "Complex operation. Continue here / New CLI with Chrome?" |

## 8. New Redis MCP Message Types

| Type | Direction | Purpose |
|------|-----------|---------|
| `DEVOPS_REQUEST` | PM CLI -> DevOps CLI | Request devops operation |
| `DEVOPS_STARTED` | DevOps CLI -> PM CLI | Operation in progress |
| `DEVOPS_COMPLETE` | DevOps CLI -> PM CLI | Operation finished (success) |
| `DEVOPS_FAILED` | DevOps CLI -> PM CLI | Operation failed (with error) |
| `PERMISSION_FORWARD` | Subagent -> PM CLI | Permission request to forward to user |

## 9. DevOps Agent Definition

The DevOps agent is a restricted agent that only PM CLI can invoke. It requires user confirmation before any operation.

**Capabilities:**
- Docker image builds and pushes
- Kubernetes deployments (helm, kubectl)
- GCP/AWS resource management
- GitHub Actions workflow configuration
- CI/CD pipeline operations

**Invocation Protocol:**
1. PM CLI must ask user for confirmation before invoking
2. User chooses: run locally / send to DevOps CLI / show instructions
3. Agent reports all actions taken for audit

**Guardrails (Workstation Only):**
- Cannot delete production resources without explicit confirmation
- Cannot modify cloud IAM/permissions
- Cannot access secrets directly (use secret managers)

**Full Freedom (Container/K8s):**
- When running inside container or K8s, all operations allowed
- No HITL gates (environment is isolated)
- Force flags permitted

## 10. Diagram Builder Skill Definition

The diagram-builder skill creates and updates Mermaid diagrams for architecture, workflows, and data flows.

**Auto-Invocation Triggers:**
- Planner creates design.md -> generate architecture diagram
- New agent/component added -> update component diagram
- Workflow changes -> update workflow diagram

**Process:**
1. Understand context from source files
2. Select appropriate diagram type (flowchart, sequence, class, state)
3. Generate diagram following existing conventions
4. Save to docs/diagrams/{name}.mmd
5. Copy to docker/hitl-ui/public/docs/diagrams/ if UI-visible
6. Update references in design.md and README

## 11. Chrome Extension Advisory Pattern

**Triggers:**
- Multi-file refactoring (>10 files)
- Cross-domain changes (backend + frontend)
- Infrastructure changes + code changes
- Operations requiring visual review (UI changes)

**Advisory Message:**
```
"This operation is complex. Consider:
 - Opening a new CLI window with Claude Chrome extension
 - Running the [backend/frontend] portion there
 - Report back when complete

 Instructions to paste:
 [context + task description]"
```

## 12. Reviewer Concerns Addressed

| Concern | Resolution |
|---------|------------|
| C-1: Diagram files reference implementer | Add task to update diagrams (file #16) |
| C-2: FILE_INDEX.md reference | Include in FILE_INDEX update (file #14) |
| C-3: parallel-coordination.md roles | Update to multi-CLI pattern (file #8) |
| C-4: identity-selection.md missing roles | Add all 6 agents (file #6) |
| C-5: trunk-based-development commit authority | Update orchestrator commits only (file #7) |

## 13. Architecture Decisions

### AD-1: PM CLI as Default
**Decision:** The main session is PM CLI by default, no separate agent definition needed.
**Rationale:** Reduces complexity; the main session naturally acts as coordinator.

### AD-2: Atomic Task Delegation
**Decision:** Orchestrator delegates ONE atomic task at a time to coding agents.
**Rationale:** Prevents context drift, enables session renewal, maintains traceability.

### AD-3: Remove Implementer Agent
**Decision:** Delete `.claude/agents/implementer.md`
**Rationale:** Backend and frontend agents already cover implementation domains with domain-specific knowledge.

### AD-4: Orchestrator Owns E2E
**Decision:** Orchestrator runs E2E tests before committing.
**Rationale:** Ensures integration validation happens at the coordination layer with full context.

### AD-5: DevOps Agent with HITL
**Decision:** DevOps agent requires HITL confirmation before any operation.
**Rationale:** Infrastructure operations can have production impact; human oversight required.

### AD-6: Environment-Aware Permissions
**Decision:** Full permissions in container/K8s, restricted on workstation.
**Rationale:** Container environments are isolated; workstation operations affect user's system.

### AD-7: Multi-CLI Coordination via Redis MCP
**Decision:** Use Redis MCP for coordination between PM CLI and DevOps CLI.
**Rationale:** Enables async operations and parallel work across CLI windows.

## 14. Validation Criteria

- All rule files parse without errors
- Agent definitions are syntactically valid (YAML frontmatter)
- No broken references between files
- Skill files maintain valid structure
- implementer.md is removed and not referenced elsewhere
- All 6 roles documented consistently
- All 7 HITL gates defined
- All 5 Redis MCP message types documented
