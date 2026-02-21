---
description: Session identity (bounded context) vs subagent roles (path restrictions)
paths:
  - "**/*"
---

# Session Identity vs Subagent Roles

This project distinguishes between two concepts:
- **Session Identity** (CLAUDE_INSTANCE_ID): Which feature context (e.g., `p11-guardrails`)
- **Subagent Role**: Which paths are allowed (e.g., `backend`, `frontend`)

## Key Concepts

| Concept | Purpose | Example | Stored In |
|---------|---------|---------|-----------|
| **Session Identity** | Identifies the feature worktree | `p11-guardrails`, `pm` | CLAUDE_INSTANCE_ID env var |
| **Subagent Role** | Determines path restrictions | `backend`, `frontend` | Subagent invocation |

A single worktree (bounded context) can have multiple subagents working on it because they're all contributing to the same feature.

## PM CLI as Default

The main Claude session operates as the Project Manager (PM CLI) with identity `pm`. This is the default behavior when running in the main repository.

**PM CLI behavior:**
- Plans and coordinates overall work
- Delegates atomic tasks to specialized agents
- Does NOT implement code directly
- Does NOT design features (planner does this)
- Does NOT commit to main (orchestrator does this)

See `.claude/rules/pm-cli/` for full PM CLI specification.

## When to Use PM CLI vs Subagent

| Situation | Use |
|-----------|-----|
| Planning overall work | PM CLI |
| Creating work items (design.md, tasks.md) | Delegate to planner |
| Implementing backend code | Delegate to backend |
| Implementing frontend code | Delegate to frontend |
| Reviewing code | Delegate to reviewer |
| Updating meta files, committing | Delegate to orchestrator |
| Infrastructure, deploys | Delegate to devops (HITL required) |

**Key principle:** PM CLI coordinates. Subagents implement.

## Available Subagent Roles

| Role | Domain | Path Restrictions |
|------|--------|-------------------|
| `planner` | .workitems/ | Creating planning artifacts |
| `backend` | Workers, infra | P01-P03, P06 implementation |
| `frontend` | HITL UI | P05 implementation |
| `reviewer` | All (read-only) | Code review and validation |
| `test-writer` | Test files | Writes failing tests from specs (RED phase) |
| `debugger` | All (read-only) | Diagnostic reports for test failures |
| `orchestrator` | Meta files | Docs, contracts, coordination, commits |
| `devops` | Infrastructure | Docker, K8s, cloud, GitHub Actions |

## Invoking Subagents

```
"Use the planner subagent to create the work items"
"Use the backend subagent to implement the worker pool"
"Use the frontend subagent to add the approval dialog"
"Use the reviewer subagent to review the implementation"
"Use the test-writer subagent to write failing tests for the task"
"Use the debugger subagent to analyze repeated test failures"
"Use the orchestrator subagent to update the contract and commit"
"Use the devops subagent to deploy to Kubernetes"
```

## Session Identity Examples

| Context | CLAUDE_INSTANCE_ID | Description |
|---------|-------------------|-------------|
| Main repo (PM) | `pm` | Default for main repository |
| P11 Guardrails | `p11-guardrails` | Feature worktree |
| P04 Review Swarm | `p04-review-swarm` | Feature worktree |
| Side Project | `sp01-smart-saver` | Side project worktree |

Setting identity for a worktree:
```bash
export CLAUDE_INSTANCE_ID=p11-guardrails
```

## DevOps Agent Special Restrictions

The devops agent has special restrictions due to its ability to affect running systems:

1. **PM CLI only:** Only the PM CLI can invoke the devops agent
2. **HITL required:** User confirmation is mandatory before invocation
3. **Multi-CLI option:** May run in a separate CLI window for isolation

Before invoking devops, PM CLI presents:
```
DevOps operation needed: [description]

Options:
 A) Run devops agent here (I'll wait)
 B) Send notification to separate DevOps CLI
 C) Show me instructions (I'll run manually)
```

See `.claude/rules/hitl-gates.md` for full HITL gate specification.

## Built-in Coordination

Each subagent:
- Checks pending messages on start
- Publishes status updates on completion
- Can publish `BLOCKING_ISSUE` when stuck

See `.claude/agents/` for full agent definitions.
