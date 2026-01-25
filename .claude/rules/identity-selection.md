---
description: Role subagents and PM CLI as default main session
paths:
  - "**/*"
---

# Role Subagents

This project uses role-specific subagents in `.claude/agents/` for specialized work. The main Claude session acts as PM CLI by default.

## PM CLI as Default

The main Claude session operates as the Project Manager (PM CLI). This is the default behavior - no agent selection is needed.

**PM CLI behavior:**
- Plans and coordinates overall work
- Delegates atomic tasks to specialized agents
- Does NOT implement code directly
- Does NOT design features (planner does this)
- Does NOT commit to main (orchestrator does this)

See `.claude/rules/pm-cli.md` for full PM CLI specification.

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

**Key principle:** PM CLI coordinates. Agents implement.

## Available Subagents

| Subagent | Domain | Use For |
|----------|--------|---------|
| `planner` | .workitems/ | Creating planning artifacts (design.md, user_stories.md, tasks.md) |
| `backend` | Workers, infra | P01-P03, P06 implementation |
| `frontend` | HITL UI | P05 implementation |
| `reviewer` | All (read-only) | Code review and validation |
| `orchestrator` | Meta files | Docs, contracts, coordination, commits |
| `devops` | Infrastructure | Docker, K8s, cloud, GitHub Actions |

## Invoking Subagents

```
"Use the planner subagent to create the work items"
"Use the backend subagent to implement the worker pool"
"Use the frontend subagent to add the approval dialog"
"Use the reviewer subagent to review the implementation"
"Use the orchestrator subagent to update the contract and commit"
"Use the devops subagent to deploy to Kubernetes"
```

## Git Identity

Agents that commit use appropriate git identity:

| Subagent | Git Email |
|----------|-----------|
| backend | `claude-backend@asdlc.local` |
| frontend | `claude-frontend@asdlc.local` |
| orchestrator | `claude-orchestrator@asdlc.local` |
| devops | `claude-devops@asdlc.local` |

Note: planner and reviewer do not commit, so no git identity is needed for these agents.

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
