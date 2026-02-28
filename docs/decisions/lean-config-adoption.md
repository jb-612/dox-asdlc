# Lean Configuration Adoption — CCR5-surv Patterns for aSDLC

**Date**: 2026-02-28
**Status**: Approved
**Source**: CCR5-surv project (`.claude/` configuration)

## Executive Summary

CCR5-surv achieves equivalent governance with dramatically less infrastructure. Where aSDLC uses 18 rule files + 3 Python hooks + Elasticsearch + async caching, CCR5 uses a concise CLAUDE.md + 6 bash scripts + a Stop hook.

## Side-by-Side Comparison

| Dimension | aSDLC (Current) | CCR5-surv (Reference) |
|---|---|---|
| **Rule files** | 18 `.md` files in `.claude/rules/` (all loaded into context) | 0 rule files — everything in CLAUDE.md |
| **CLAUDE.md** | ~190 lines + references 18 rules | ~130 lines, self-contained |
| **Hooks** | 3 Python scripts (250+ LOC each) + ES + async + caching | 6 bash scripts (20-50 LOC each), no dependencies |
| **Settings** | Single `settings.json` (permissions + hooks + env) | Split: `settings.json` (hooks) + `settings.local.json` (permissions) |
| **Enforcement model** | Runtime ES evaluation + cache TTL + context detection | Simple file checks + marker files |
| **Skills** | 9 | 26 (many domain-specific, but more granular) |
| **Agents** | 8 definitions | 3 (TDD-specific only) |
| **Context cost** | ~5K+ tokens from rules alone | ~1K tokens from CLAUDE.md |

## What CCR5 Does That We Adopt

### 1. Simple Bash Hooks Instead of Python+ES Guardrails

CCR5's hooks solve the same problems without external dependencies:

| CCR5 Hook | What It Does | aSDLC Equivalent |
|---|---|---|
| `require-workitem.sh` | Blocks writes to `internal/`/`cmd/` without workitem folder | `guardrails-enforce.py` (250 LOC + ES) |
| `enforce-tdd-separation.sh` | Marker files control who writes test vs prod files | Nothing — relied on CLAUDE.md instructions |
| `block-dangerous-commands.sh` | Blocks `rm -rf`, `sudo`, `kill -9`, force pushes | `settings.json` deny list (advisory only) |
| `check-workitems-length.sh` | Blocks workitem files > 100 lines | Nothing |
| `auto-gofmt.sh` | Auto-formats on save | Nothing (Python/TS — becomes `auto-lint.sh`) |
| `session-start-info.sh` | Shows branch + active workitems | `session-start.py` (via `hook-wrapper.py`) |

**Impact**: Replace 750+ LOC of Python + ES dependency with ~200 LOC of bash. Hooks fire instantly instead of waiting for ES ping + evaluation.

### 2. Stop Hook for Workflow Verification

CCR5 uses a prompt-based Stop hook that checks workflow compliance at session end, catching violations without heavy runtime enforcement.

### 3. Settings Split (hooks vs permissions)

CCR5 commits `settings.json` (hooks only) and keeps `settings.local.json` (permissions) user-local:
- Hooks are shared across all developers (consistency)
- Permissions are personal (different users may need different tools)
- No permission conflicts when pulling changes

### 4. Rules Consolidation

18 rule files consuming thousands of context tokens every turn → 4 files max:

| Current (18 files) | Proposed |
|---|---|
| `pm-cli/01-behavior.md` | Merge into CLAUDE.md "PM CLI" section |
| `pm-cli/02-delegation.md` | Merge into CLAUDE.md "PM CLI" section |
| `pm-cli/03-multi-cli.md` | Merge into CLAUDE.md "PM CLI" section |
| `pm-cli/README.md` | Delete (redundant) |
| `workflow/01-steps-1-5.md` | Keep as `workflow.md` (consolidated) |
| `workflow/02-steps-6-9.md` | Merge into `workflow.md` |
| `workflow/03-steps-10-11.md` | Merge into `workflow.md` |
| `workflow/README.md` | Delete (redundant) |
| `hitl-gates.md` | Keep (standalone, clear spec) |
| `permissions.md` | Move to CLAUDE.md or delete (hooks enforce) |
| `trunk-based-development.md` | Merge into CLAUDE.md |
| `task-visibility.md` | Merge into CLAUDE.md |
| `coordination-protocol.md` | Keep (multi-session specific) |
| `parallel-coordination.md` | Merge into `coordination-protocol.md` |
| `native-teams.md` | Merge into CLAUDE.md |
| `identity-selection.md` | Merge into CLAUDE.md |
| `coding-standards.md` | Merge into CLAUDE.md |
| `orchestrator.md` | Keep (role-specific) |

**Result**: 18 files → 4 files + richer CLAUDE.md. ~60-70% context reduction.

### 5. CCR5 Skills Worth Porting

| CCR5 Skill | Port As | Value |
|---|---|---|
| 3-agent `code-review` | Upgrade existing `code-review` | Parallel specialist reviewers |
| 4-agent `design-review` | New skill | Fills gap at workflow step 4 |
| `phase-gate` | New skill | Formal phase completion validation |
| `tdd-task` (with user gates) | Enhance `tdd-execution` | User approval between phases |
| `task-breakdown` | Extract from `feature-planning` | Dedicated reusable skill |
| `commit` (with pre-checks) | Enhance workflow step 9 | Verification before commit |

## Implementation Plan

| Phase | Action | Impact |
|---|---|---|
| **Phase 1** | Replace Python hooks with bash scripts | Instant hook execution, no ES dependency |
| **Phase 2** | Consolidate 18 rule files → 4 + richer CLAUDE.md | 60-70% context reduction |
| **Phase 3** | Split settings.json → hooks (committed) + permissions (local) | Clean separation |
| **Phase 4** | Add Stop hook for workflow verification | Catch missed steps |
| **Phase 5** | Port CCR5 skill patterns (multi-agent reviews, phase-gate) | Better quality gates |

## What We Keep (aSDLC-specific)

| aSDLC Feature | Reason to Keep |
|---|---|
| Dynamic guardrails (ES-backed) | P11 feature — keep as optional enhancement |
| Multi-session coordination (Redis MCP) | Cross-worktree coordination |
| Environment-aware permissions | Container/K8s deployment |
| Worktree management | Multi-feature parallel work |
| 8 agent definitions | More roles than CCR5's 3 TDD agents |

## Expected Outcomes

| Metric | Before | After |
|---|---|---|
| Rule files loaded per turn | 18 | 4 |
| Context tokens from rules | ~5,000+ | ~1,500 |
| Hook execution time | 2-5s (Python + ES ping) | <100ms (bash) |
| External dependencies for hooks | ES, Python async, tempfile cache | None |
| Files in `.claude/rules/` | 18 | 4 |
| Hook scripts LOC | ~750 (Python) | ~200 (bash) |
