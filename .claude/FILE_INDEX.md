# File Index: CLI Coordination & Project Configuration

This index catalogs all configuration, rules, skills, hooks, and coordination scripts in the project.

**Legend:**
- **Meta**: General project and environment configuration (not part of the solution code)
- **Solution**: Part of the aSDLC solution implementation

---

## .claude/ - Claude Code Configuration

| File | Description | Type |
|------|-------------|------|
| `instance-identity.json` | Runtime identity file created by launchers (instance_id, paths, permissions) | Meta |
| `settings.json` | Claude Code settings (hooks, permissions) | Meta |
| `settings.local.json` | Local permission history (auto-generated) | Meta |
| `FILE_INDEX.md` | This index file | Meta |

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
| `hitl-gates.md` | HITL gate definitions - mandatory and advisory checkpoints | Meta |
| `identity-selection.md` | Role subagent invocation rules | Meta |
| `orchestrator.md` | Rules for orchestrator CLI (master agent) - review, merge, meta ownership | Meta |
| `parallel-coordination.md` | Rules for 3-CLI parallel work - identity, paths, messaging | Meta |
| `permissions.md` | Environment-aware permissions for workstation vs container | Meta |
| `pm-cli.md` | PM CLI behavior - main session as Project Manager | Meta |
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
| `devops.md` | DevOps agent for Docker, K8s, cloud, GitHub Actions | Meta |
| `frontend.md` | Frontend agent for HITL UI (P05) | Meta |
| `orchestrator.md` | Orchestrator agent for meta files, commits, coordination | Meta |
| `planner.md` | Planner agent for planning and design tasks | Meta |
| `reviewer.md` | Reviewer agent for code review tasks | Meta |

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

## scripts/hooks/ - Claude Code Hooks

| File | Description | Type |
|------|-------------|------|
| `prompt-validator.py` | UserPromptSubmit hook - blocks if no identity file | Solution |
| `session-start.py` | SessionStart hook - displays role and permissions | Solution |
| `tool-validator.py` | PreToolUse hook - enforces path restrictions, merge blocking | Solution |

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
| `build-images.sh` | Build Docker images for all services | Solution |
| `check-completion.sh` | Validate feature completion (tests, docs, progress) | Solution |
| `check-compliance.sh` | Check SDD compliance (planning artifacts, structure) | Solution |
| `check-planning.sh` | Validate planning completeness before coding | Solution |
| `new-feature.sh` | Create new feature work item folder | Solution |

---

## Project Root - Key Files

| File | Description | Type |
|------|-------------|------|
| `CLAUDE.md` | Project instructions for Claude Code | Meta |
| `README.md` | Project overview and quick start | Meta |
| `start-backend.sh` | Launcher script for backend CLI | Solution |
| `start-frontend.sh` | Launcher script for frontend CLI | Solution |
| `start-orchestrator.sh` | Launcher script for orchestrator CLI | Solution |

---

## Summary

| Category | Files | Meta | Solution |
|----------|-------|------|----------|
| .claude/ config | 4 | 4 | 0 |
| .claude/coordination/ | 3 | 3 | 0 |
| .claude/rules/ | 9 | 9 | 0 |
| .claude/skills/ | 5 | 5 | 0 |
| .claude/agents/ | 6 | 6 | 0 |
| scripts/coordination/ | 6 | 0 | 6 |
| scripts/hooks/ | 3 | 0 | 3 |
| scripts/orchestrator/ | 2 | 0 | 2 |
| scripts/ top-level | 5 | 0 | 5 |
| Project root | 5 | 2 | 3 |
| **Total** | **48** | **29** | **19** |

---

## Deleted Files (P01-F06 Migration)

The following files were removed as part of the monorepo migration:

| File | Reason |
|------|--------|
| `scripts/cli-identity.sh` | Replaced by launcher scripts creating identity file |
| `scripts/merge-helper.sh` | Branch-prefix analysis obsolete in monorepo model |
| `scripts/coordination/migrate-to-redis.sh` | One-time migration script, no longer needed |
