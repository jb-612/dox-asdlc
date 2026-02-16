# ADR: E2B Cloud Sandbox Evaluation

**Status:** Deferred
**Date:** 2026-02-10
**Decision Makers:** PM CLI, Orchestrator

## Context

The aSDLC project runs multiple Claude CLI sessions in parallel, each in an isolated git worktree. Currently, isolation is achieved via worktrees (git-level isolation) and tmux (session management). E2B (https://e2b.dev) offers cloud-based sandboxed environments that could provide stronger isolation (filesystem, network, process-level) at a per-second cost.

The question is whether E2B sandboxes should replace or supplement the current worktree + tmux approach for multi-context development.

## Cost Analysis

E2B default sandbox: 2 vCPU, billed at $0.000028/second.

| Duration | Cost |
|----------|------|
| 1 hour | $0.10 |
| 8 hours (workday) | $0.81 |
| 1 month (8h/day, 22 days) | $17.74 |
| 3 concurrent contexts, 1 month | $53.22 |

Additional costs: custom Docker images, persistent storage, network egress.

## Decision Matrix

| Criterion | Worktree + tmux | E2B Sandbox |
|-----------|----------------|-------------|
| Works offline | Yes | No (cloud-dependent) |
| Cost | Free | $0.10/hr per sandbox |
| Isolation quality | Git-level only | Full OS-level (filesystem, network, process) |
| Setup complexity | Low (bash scripts) | Medium (API integration, Docker images) |
| Session persistence | Native (tmux detach/attach) | Limited (sandbox timeout, must snapshot) |
| File access speed | Native disk | Network latency for sync |
| Port management | Manual (per-session ports) | Automatic (sandbox-scoped ports) |

## Decision

**DEFER.** Implement tmux + worktrees first as the primary multi-session strategy.

The current approach provides sufficient isolation for the project's needs:
- Git worktrees prevent staging area conflicts between contexts
- tmux provides session management with detach/reattach
- CLAUDE_INSTANCE_ID provides identity isolation for coordination
- Path restrictions via guardrails hooks enforce cognitive isolation

## Revisit Triggers

Revisit this decision when any of the following occur:

1. Running more than 3 concurrent feature contexts regularly, where worktree overhead becomes noticeable
2. Port conflicts between sessions become a real blocker (not just theoretical)
3. E2B's $100 free credit can fund an evaluation sprint to measure real-world latency and developer experience
4. A feature requires true filesystem or network isolation that worktrees cannot provide

## Consequences

### Positive
- No additional cloud costs during development
- Full offline capability preserved
- Simpler infrastructure (no API keys, no Docker image management)
- Faster file operations (native disk vs network sync)

### Negative
- No OS-level isolation between contexts (shared filesystem, shared ports)
- Manual port management required for parallel services
- No automatic cleanup of abandoned sessions (must teardown worktrees manually)

## References

- E2B documentation: https://e2b.dev/docs
- E2B agent sandbox skill: https://github.com/anthropics/agent-sandbox-skill
- Current multi-session implementation: `scripts/sessions/tmux-launcher.sh`, `scripts/start-session.sh`
