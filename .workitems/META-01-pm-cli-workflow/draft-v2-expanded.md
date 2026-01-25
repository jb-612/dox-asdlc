# META-01 Expanded Design Draft v2

**Saved:** 2026-01-25
**Status:** Approved by user, ready for planner

---

## Context

This draft captures the expanded PM CLI workflow design after user feedback. Save this file in case of context loss during implementation.

---

## Key Decisions

| # | Decision |
|---|----------|
| 1 | PM CLI is default main session behavior (no separate agent) |
| 2 | Orchestrator delegates ONE atomic task at a time, session renewal between |
| 3 | Implementer agent merged into backend/frontend (delete implementer.md) |
| 4 | Feature-completion skill updated with orchestrator-runs-E2E |
| 5 | DevOps agent added - only PM CLI can invoke, HITL required |
| 6 | Diagram-builder skill added - auto for architecture, explicit for others |
| 7 | Multi-CLI pattern via Redis MCP for devops operations |
| 8 | Environment-aware permissions: full freedom in container/K8s, restricted on workstation |
| 9 | HITL mandatory for: devops, protected path commits (contracts/, .claude/), destructive workstation ops |
| 10 | Chrome extension advisory for complex operations |

---

## Multi-CLI DevOps Pattern

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PM CLI (Main Session)                        │
├─────────────────────────────────────────────────────────────────────┤
│  When devops needed:                                                 │
│                                                                      │
│  AskUserQuestion:                                                    │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ "DevOps operation needed: [description]"                     │    │
│  │                                                              │    │
│  │ Options:                                                     │    │
│  │  A) Run devops agent here (I'll wait)                       │    │
│  │  B) Send notification to separate DevOps CLI                │    │
│  │  C) Show me instructions (I'll run manually)                │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  Option A ──> Invoke devops agent locally                           │
│  Option B ──> Publish to Redis MCP ──> DevOps CLI receives          │
│  Option C ──> Output instructions for Claude Chrome / manual        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ Redis MCP (Option B)
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    DevOps CLI (Separate Window)                      │
├─────────────────────────────────────────────────────────────────────┤
│  - Receives DEVOPS_REQUEST notification                             │
│  - Executes docker/k8s/cloud operations                             │
│  - Full permissions (isolated environment)                          │
│  - Acknowledges completion via Redis MCP                            │
│  - PM CLI receives ACK and continues workflow                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Environment-Aware Permissions

```
┌────────────────────────────────────────────────────────────────┐
│                    Permission Decision Tree                     │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Is /.dockerenv present OR KUBERNETES_SERVICE_HOST set?        │
│                     │                                           │
│          ┌─────────┴─────────┐                                 │
│          │                   │                                  │
│         YES                  NO                                 │
│          │                   │                                  │
│          ▼                   ▼                                  │
│   ┌──────────────┐   ┌──────────────────────────┐              │
│   │ FULL FREEDOM │   │ WORKSTATION RESTRICTIONS │              │
│   ├──────────────┤   ├──────────────────────────┤              │
│   │ • All bash   │   │ • No --force flags       │              │
│   │ • Force flags│   │ • No rm -rf              │              │
│   │ • Destructive│   │ • No kubectl delete      │              │
│   │ • No HITL    │   │ • HITL for deploys       │              │
│   │   needed     │   │ • HITL for commits to    │              │
│   └──────────────┘   │   contracts/, .claude/   │              │
│                      └──────────────────────────┘              │
└────────────────────────────────────────────────────────────────┘
```

---

## Chrome Extension Advisory Pattern

```
Triggers:
• Multi-file refactoring (>10 files)
• Cross-domain changes (backend + frontend)
• Infrastructure changes + code changes
• Operations requiring visual review (UI changes)

Advisory message:
"This operation is complex. Consider:
 • Opening a new CLI window with Claude Chrome extension
 • Running the [backend/frontend] portion there
 • Report back when complete

 Instructions to paste:
 [context + task description]"
```

---

## File Changes (16 files)

| # | File | Action | Notes |
|---|------|--------|-------|
| 1 | `.claude/rules/pm-cli.md` | **New** | PM CLI role, multi-CLI coordination, Chrome advisory |
| 2 | `.claude/rules/workflow.md` | Revise | 11-step workflow with HITL gates |
| 3 | `.claude/rules/hitl-gates.md` | **New** | HITL gate definitions, questions, triggers |
| 4 | `.claude/rules/permissions.md` | **New** | Environment-aware permissions, tiers |
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

---

## HITL Gates

| Gate | Trigger | Mandatory? | Question |
|------|---------|------------|----------|
| DevOps Invocation | Before any devops operation | **Yes** | "DevOps needed: [desc]. Run here / Send to DevOps CLI / Show instructions?" |
| Protected Path Commit | Commit to `contracts/`, `.claude/` | **Yes** | "Committing to protected path. Confirm?" |
| Contract Change | API contract modification | **Yes** | "This changes public API. Consumers notified?" |
| Destructive Workstation Op | rm, delete, prune on workstation | **Yes** | "Destructive operation on workstation. Confirm?" |
| Design Review Concerns | Reviewer found concerns | Advisory | "Review found [N] concerns. Address / Proceed / Abort?" |
| Test Failures > 3 | Repeated test failures | Advisory | "Tests failing repeatedly. Debug / Skip / Abort?" |
| Complex Operation | >10 files or cross-domain | Advisory | "Complex operation. Continue here / New CLI with Chrome?" |

---

## New Message Types for Redis MCP

| Type | Direction | Purpose |
|------|-----------|---------|
| `DEVOPS_REQUEST` | PM CLI → DevOps CLI | Request devops operation |
| `DEVOPS_STARTED` | DevOps CLI → PM CLI | Operation in progress |
| `DEVOPS_COMPLETE` | DevOps CLI → PM CLI | Operation finished (success) |
| `DEVOPS_FAILED` | DevOps CLI → PM CLI | Operation failed (with error) |
| `PERMISSION_FORWARD` | Subagent → PM CLI | Permission request to forward to user |

---

## Updated Workflow (11 Steps)

```
 1. Workplan         → PM CLI drafts plan
 2. Planning         → Planner creates work items
                       └─> diagram-builder (auto) for architecture diagrams
 3. Diagrams         → Explicit diagram requests if needed
 4. Design Review    → Reviewer validates
                       └─> HITL if concerns found
 5. Re-plan          → PM CLI assigns scopes, considers multi-CLI
                       └─> Advisory: Chrome extension for complex ops
 6. Parallel Build   → Backend/Frontend (atomic tasks)
                       └─> Permission forwarding if blocked
 7. Testing          → Unit/integration tests
                       └─> HITL if failures > 3
 8. Review           → Reviewer inspects, issues created
 9. Orchestration    → Orchestrator runs E2E
                       └─> HITL for protected path commits
10. DevOps           → PM CLI coordinates (HITL required)
                       └─> Local / Separate CLI / Instructions
11. Closure          → PM CLI summarizes, closes issues
```

---

## Roles Summary (6 agents)

| Role | Purpose | Domain | Invoker |
|------|---------|--------|---------|
| planner | Planning artifacts only | .workitems/ | PM CLI |
| backend | Backend implementation | P01-P03, P06 | PM CLI |
| frontend | SPA/HITL UI, mock-first | P05 | PM CLI |
| reviewer | Read-only code review | All (read) | PM CLI |
| orchestrator | Coordination, docs, meta, commits | Meta files | PM CLI |
| devops | Docker, K8s, cloud, GitHub Actions | Infrastructure | PM CLI only (HITL) |

---

## Skills Summary

| Skill | Purpose | Invokers |
|-------|---------|----------|
| feature-planning | Create work items | Planner |
| tdd-execution | Red-Green-Refactor | Backend, Frontend |
| feature-completion | Validate and complete | Orchestrator |
| contract-update | API contract changes | Orchestrator |
| diagram-builder | Mermaid diagrams | Planner, Orchestrator |

---

## Settings.json Updates

### Permissions to Add (allow)

```json
"Bash(python -m pytest:*)",
"Bash(npm test:*)",
"Bash(npm run lint:*)",
"Bash(docker build:*)",
"Bash(docker-compose up:*)",
"Bash(kubectl get:*)",
"Bash(kubectl describe:*)",
"Bash(kubectl logs:*)",
"Bash(helm list:*)",
"Bash(helm status:*)",
"mcp__coordination__*",
"mcp__ide__getDiagnostics"
```

### Permissions to Add (deny) - Workstation Only

```json
"Bash(kubectl delete:*)",
"Bash(helm uninstall:*)",
"Bash(docker system prune:*)",
"Bash(rm -rf:*)"
```

Note: These deny rules should be conditional on workstation environment.
In container/K8s, these should be allowed.

---

## DevOps Agent Definition

```yaml
---
name: devops
description: DevOps specialist for Docker builds, K8s deployments, cloud infrastructure, and GitHub Actions. ONLY PM CLI can invoke. Requires user confirmation.
tools: Read, Write, Edit, Bash, Glob, Grep
model: inherit
---

# RESTRICTED AGENT - PM CLI INVOCATION ONLY

This agent handles infrastructure operations that affect running systems.

## Capabilities
- Docker image builds and pushes
- Kubernetes deployments (helm, kubectl)
- GCP/AWS resource management
- GitHub Actions workflow configuration
- CI/CD pipeline operations

## Invocation Protocol
1. PM CLI must ask user for confirmation before invoking
2. User chooses: run locally / send to DevOps CLI / show instructions
3. Agent reports all actions taken for audit

## Multi-CLI Mode
When running in separate DevOps CLI:
- Receives DEVOPS_REQUEST via Redis MCP
- Executes with full permissions (isolated environment)
- Publishes DEVOPS_COMPLETE or DEVOPS_FAILED when done

## Guardrails (Workstation Only)
- Cannot delete production resources without explicit confirmation
- Cannot modify cloud IAM/permissions
- Cannot access secrets directly (use secret managers)

## Full Freedom (Container/K8s)
When running inside container or K8s:
- All operations allowed
- No HITL gates (environment is isolated)
- Force flags permitted
```

---

## Diagram Builder Skill Definition

```yaml
---
name: diagram-builder
description: Creates and updates Mermaid diagrams for architecture, workflows, and data flows. Auto-invoked during planning for architecture diagrams, explicit for others.
---

Create or update Mermaid diagram for $ARGUMENTS:

## Auto-Invocation Triggers
- Planner creates design.md → generate architecture diagram
- New agent/component added → update component diagram
- Workflow changes → update workflow diagram

## Step 1: Understand Context
- Read relevant source files
- Identify components, relationships, data flows
- Check existing diagrams in docs/diagrams/

## Step 2: Select Diagram Type
- flowchart: workflows, processes
- sequenceDiagram: interactions, API flows
- classDiagram: component relationships
- stateDiagram: state machines

## Step 3: Generate Diagram
- Follow existing conventions in docs/diagrams/
- Use consistent naming
- Include legend if complex

## Step 4: Save and Validate
- Write to docs/diagrams/{name}.mmd
- Copy to docker/hitl-ui/public/docs/diagrams/ if UI-visible
- Verify mermaid syntax is valid

## Step 5: Update References
- Update design.md to reference diagram
- Update README if public-facing
```

---

## Reviewer Concerns Addressed

| Concern | Resolution |
|---------|------------|
| C-1: Diagram files reference implementer | Add task to update diagrams (file #16) |
| C-2: FILE_INDEX.md reference | Include in FILE_INDEX update (file #14) |
| C-3: parallel-coordination.md roles | Update to multi-CLI pattern (file #8) |
| C-4: identity-selection.md missing roles | Add all 6 agents (file #6) |
| C-5: trunk-based-development commit authority | Update orchestrator commits only (file #7) |

---

## To Resume This Work

If context is lost, read this file and:
1. Review current state of tasks.md
2. Continue with next incomplete task
3. Follow the 11-step workflow

The planner should update design.md, user_stories.md, and tasks.md based on this draft.
