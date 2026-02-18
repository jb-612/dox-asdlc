# File Index: CLI Coordination & Project Configuration

This index catalogs all configuration, rules, skills, hooks, and coordination scripts in the project.

**Legend:**
- **Meta**: General project and environment configuration (not part of the solution code)
- **Solution**: Part of the aSDLC solution implementation

---

## .claude/ - Claude Code Configuration

| File | Description | Type |
|------|-------------|------|
| `settings.json` | Claude Code settings (hooks, permissions) | Meta |
| `settings.local.json` | Local permission history (auto-generated) | Meta |
| `guardrails-static.json` | Static fallback guidelines for offline operation | Meta |
| `FILE_INDEX.md` | This index file | Meta |

### .claude/hooks/

| File | Description | Type |
|------|-------------|------|
| `startup.sh` | SessionStart hook - displays role and permissions | Solution |
| `guardrails-inject.py` | UserPromptSubmit hook - evaluates and injects guardrails context | Solution |
| `guardrails-enforce.py` | PreToolUse hook - enforces tool restrictions and path guards | Solution |
| `guardrails-subagent.py` | SubagentStart hook - sets up guardrails for spawned subagents | Solution |

### .claude/coordination/

| File | Description | Type |
|------|-------------|------|
| `README.md` | Quick reference for coordination system, troubleshooting | Meta |
| `status.json` | Runtime instance status tracking | Meta |
| `reviews/` | Directory for orchestrator review reports | Meta |

### .claude/rules/

| File | Description | Type |
|------|-------------|------|
| `coding-standards.md` | Python/TypeScript/Bash coding standards | Meta |
| `coordination-protocol.md` | Multi-session coordination via Redis and native teams | Meta |
| `hitl-gates.md` | HITL gate definitions - mandatory and advisory checkpoints | Meta |
| `identity-selection.md` | Session identity vs subagent role rules | Meta |
| `native-teams.md` | Native Agent Teams coordination mode | Meta |
| `orchestrator.md` | Rules for orchestrator CLI (master agent) - review, merge, meta ownership | Meta |
| `parallel-coordination.md` | Rules for parallel CLI work - identity, paths, messaging | Meta |
| `permissions.md` | Environment-aware permissions for workstation vs container | Meta |
| `pm-cli.md` | PM CLI behavior - main session as Project Manager | Meta |
| `task-visibility.md` | Task tracking requirements for progress visibility | Meta |
| `trunk-based-development.md` | Trunk-based development rules | Meta |
| `workflow.md` | 11-step development workflow with HITL gates | Meta |

### .claude/skills/

| File | Description | Type |
|------|-------------|------|
| `contract-update/SKILL.md` | Guide for proposing and publishing contract changes | Meta |
| `diagram-builder/SKILL.md` | Mermaid diagram creation skill | Meta |
| `feature-completion/SKILL.md` | Feature completion checklist and commit protocol | Meta |
| `feature-planning/SKILL.md` | Feature planning workflow (design, stories, tasks) | Meta |
| `tdd-execution/SKILL.md` | TDD execution workflow (red-green-refactor) | Meta |

### .claude/agents/

| File | Description | Type |
|------|-------------|------|
| `backend.md` | Backend agent for workers, infrastructure (P01-P03, P06) | Meta |
| `debugger.md` | Debugger agent for read-only diagnostic reports | Meta |
| `devops.md` | DevOps agent for Docker, K8s, cloud, GitHub Actions | Meta |
| `frontend.md` | Frontend agent for HITL UI (P05) | Meta |
| `orchestrator.md` | Orchestrator agent for meta files, commits, coordination | Meta |
| `planner.md` | Planner agent for planning and design tasks | Meta |
| `reviewer.md` | Reviewer agent for code review tasks | Meta |
| `test-writer.md` | Test-writer agent for writing failing tests (RED phase) | Meta |

---

## scripts/coordination/ - CLI Coordination Scripts

| File | Description | Type |
|------|-------------|------|
| `ack-message.sh` | Acknowledge a coordination message by ID | Solution |
| `check-messages.sh` | Query coordination messages (filter by type, sender, pending) | Solution |
| `mcp-server.sh` | Launch MCP server for coordination tools | Solution |
| `publish-message.sh` | Publish a coordination message to Redis | Solution |
| `watch-notifications.sh` | Watch for real-time notifications via Redis pub/sub | Solution |

### scripts/coordination/lib/

| File | Description | Type |
|------|-------------|------|
| `common.sh` | Shared functions: Redis connectivity, identity, Python calls | Solution |

---

## scripts/hooks/ - Claude Code Hook Wrappers

| File | Description | Type |
|------|-------------|------|
| `hook-wrapper.py` | Telemetry wrapper for all hooks (captures to SQLite + JSONL) | Solution |
| `session-start.py` | SessionStart hook - displays session banner | Solution |

---

## scripts/worktree/ - Worktree Management Scripts

| File | Description | Type |
|------|-------------|------|
| `setup-worktree.sh` | Create worktree and feature branch for a bounded context | Solution |
| `list-worktrees.sh` | List all worktrees as JSON | Solution |
| `merge-worktree.sh` | Merge feature branch to main via PR | Solution |
| `teardown-worktree.sh` | Remove worktree (with --merge or --abandon) | Solution |

---

## scripts/sessions/ - Multi-Session Management

| File | Description | Type |
|------|-------------|------|
| `tmux-launcher.sh` | Launch tmux session with PM + feature contexts + dashboard | Solution |
| `list-sessions.sh` | List sessions across tmux, SQLite, and worktrees | Solution |

---

## scripts/telemetry/ - Workstation Observability

| File | Description | Type |
|------|-------------|------|
| `sqlite_store.py` | SQLite store for hook telemetry events | Solution |
| `dashboard_server.py` | Zero-dependency Python HTTP server + SSE for dashboard | Solution |
| `dashboard.html` | Single-page dashboard HTML application | Solution |
| `start-dashboard.sh` | Start/stop the telemetry dashboard | Solution |

---

## scripts/orchestrator/ - Orchestrator Scripts

| File | Description | Type |
|------|-------------|------|
| `merge-branch.sh` | Safe merge a branch to main (orchestrator only) | Solution |
| `review-branch.sh` | Run full review checklist on a branch | Solution |

---

## scripts/ - Top-Level Scripts

| File | Description | Type |
|------|-------------|------|
| `bootstrap_guardrails.py` | Bootstrap default guardrails guidelines into Elasticsearch | Solution |
| `build-images.sh` | Build Docker images for all services | Solution |
| `check-completion.sh` | Validate feature completion (tests, docs, progress) | Solution |
| `check-compliance.sh` | Check SDD compliance (planning artifacts, structure) | Solution |
| `check-planning.sh` | Validate planning completeness before coding | Solution |
| `new-feature.sh` | Create new feature work item folder | Solution |
| `start-session.sh` | Unified session launcher (creates worktree + instructions) | Solution |

---

## Project Root - Key Files

| File | Description | Type |
|------|-------------|------|
| `CLAUDE.md` | Project instructions for Claude Code | Meta |
| `README.md` | Project overview and quick start | Meta |

---

## Summary

| Category | Files | Meta | Solution |
|----------|-------|------|----------|
| .claude/ config | 4 | 4 | 0 |
| .claude/hooks/ | 4 | 0 | 4 |
| .claude/coordination/ | 3 | 3 | 0 |
| .claude/rules/ | 12 | 12 | 0 |
| .claude/skills/ | 5 | 5 | 0 |
| .claude/agents/ | 8 | 8 | 0 |
| scripts/coordination/ | 6 | 0 | 6 |
| scripts/hooks/ | 2 | 0 | 2 |
| scripts/worktree/ | 4 | 0 | 4 |
| scripts/sessions/ | 2 | 0 | 2 |
| scripts/telemetry/ | 4 | 0 | 4 |
| scripts/orchestrator/ | 2 | 0 | 2 |
| scripts/ top-level | 7 | 0 | 7 |
| Project root | 2 | 2 | 0 |
| **Total** | **65** | **34** | **31** |

---

## Deleted Files (Historical)

The following files were removed during project evolution:

| File | Reason |
|------|--------|
| `.claude/instance-identity.json` | Replaced by CLAUDE_INSTANCE_ID env var (identity model shift) |
| `scripts/hooks/prompt-validator.py` | No-op hook, replaced by guardrails-inject.py |
| `scripts/hooks/tool-validator.py` | Replaced by guardrails-enforce.py (dynamic enforcement) |
| `scripts/cli-identity.sh` | Replaced by launcher scripts creating identity file |
| `scripts/merge-helper.sh` | Branch-prefix analysis obsolete in monorepo model |
| `scripts/coordination/migrate-to-redis.sh` | One-time migration script, no longer needed |
| `start-backend.sh` | Replaced by unified start-session.sh |
| `start-frontend.sh` | Replaced by unified start-session.sh |
| `start-orchestrator.sh` | Replaced by unified start-session.sh |
