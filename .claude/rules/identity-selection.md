---
description: Session identity (bounded context) vs subagent roles (path restrictions)
paths:
  - "**/*"
---

# Session Identity vs Subagent Roles

## Key Concepts

| Concept | Purpose | Example | Stored In |
|---------|---------|---------|-----------|
| **Session Identity** | Identifies the feature worktree | `p11-guardrails`, `pm` | CLAUDE_INSTANCE_ID env var |
| **Subagent Role** | Determines path restrictions | `backend`, `frontend` | Subagent invocation |

A single worktree can have multiple subagents contributing to the same feature context.

**Key principle:** PM CLI coordinates. Subagents implement.

## Session Identity Examples

| Context | CLAUDE_INSTANCE_ID | Description |
|---------|-------------------|-------------|
| Main repo (PM) | `pm` | Default for main repository |
| P11 Guardrails | `p11-guardrails` | Feature worktree |
| P04 Review Swarm | `p04-review-swarm` | Feature worktree |

## References

- **Roles and path restrictions**: See `CLAUDE.md` Roles and Path Restrictions tables
- **PM CLI behavior**: See `.claude/rules/pm-cli/`
- **DevOps HITL gates**: See `.claude/rules/hitl-gates.md`
- **Agent definitions**: See `.claude/agents/`
