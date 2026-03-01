# SDLC E2E Review -- Final Report

## Executive Summary

The aSDLC project has a thorough, well-structured governance system with 6 hooks, 8 agents, 13 skills, 3 rules files, and a comprehensive CLAUDE.md. Of R1's 41 findings, this review validates 18 as actionable, dismisses 14 as acceptable design or low-impact, and reclassifies 9 with corrected severity. The single most impactful issue is that `apps/workflow-studio/` -- a 170-file TypeScript codebase with 91 test files -- has zero governance coverage: no agent ownership, no coding standards in CLAUDE.md, and no path restrictions. The second systemic issue is that several mandatory HITL gates rely solely on LLM instruction-following with no deterministic hook enforcement. Priority should be: (1) bring workflow-studio under governance, (2) add hook enforcement for critical HITL gates, (3) fix the model version conflict in orchestrator.md, (4) address the Stop hook infinite loop risk.

## Methodology

**R1** examined all governance files and cross-referenced against Claude Code official documentation. **R2** (this report) independently read every source file cited by R1, verified claims against actual file contents and line numbers, searched current Claude Code documentation (hooks, agents, skills, rules, settings), and applied critical thinking to assess real-world impact, intentional design choices, and severity accuracy.

Documentation sources consulted for R2:
- [Hooks reference](https://code.claude.com/docs/en/hooks) -- hook events, matchers, exit codes, stop_hook_active
- [Custom subagents](https://code.claude.com/docs/en/sub-agents) -- tools, disallowedTools, inheritance behavior
- [Skills](https://code.claude.com/docs/en/skills) -- SKILL.md frontmatter fields, argument-hint, user-invocable
- [Memory](https://code.claude.com/docs/en/memory) -- CLAUDE.md layering, .claude/rules/ path-scoped rules

---

## Verified Findings

### Critical (must fix)

#### F-01: apps/workflow-studio/ Has No Governance Coverage
- **R1 Reference**: D8 (Critical) + A6 (High)
- **Verification**: Valid. Confirmed that zero files in `.claude/agents/`, `.claude/rules/`, `CLAUDE.md`, or `.claude/skills/` reference `apps/` or `apps/workflow-studio/`. The directory contains 170 TypeScript source files and 91 test files. Git status shows active modifications to 4 files in this path. CLAUDE.md line 70 says `TypeScript (docker/hitl-ui/)` with no mention of `apps/workflow-studio/`.
- **Impact**: The primary active development codebase has no agent ownership, no coding standards, and no domain boundaries. Any agent could modify any file here without restriction. The `require-workitem.sh` hook does catch `apps/workflow-studio/src/` paths (because they match `*/src/*`), but this is coincidental, not intentional governance.
- **Recommendation**: (1) Add `apps/workflow-studio/` to CLAUDE.md coding standards and path restrictions. (2) Create or extend an agent (likely frontend or a new `workflow-studio` agent) to own this path. (3) Update `require-workitem.sh` to explicitly handle `apps/` paths, not rely on the `*/src/*` coincidence.

---

### High (should fix)

#### F-02: Co-Authored-By Model Version Mismatch in Orchestrator
- **R1 Reference**: A1 (Medium -- R2 upgrades to High)
- **Verification**: Valid. Orchestrator agent line 113: `Co-Authored-By: Claude Opus 4.5`. Commit skill line 18: `Co-Authored-By: Claude Opus 4.6`. Design-pipeline skill line 120: `Co-Authored-By: Claude Opus 4.6`. Since the orchestrator is the primary commit agent (per CLAUDE.md rule), most commits will carry the wrong model version.
- **Impact**: Every commit made by the orchestrator agent will have an incorrect `Co-Authored-By` trailer. This is not cosmetic -- it creates a false audit trail about which model produced the code.
- **Recommendation**: Update orchestrator.md line 113 to `Claude Opus 4.6`.

#### F-03: Stop Hook Missing stop_hook_active Guard
- **R1 Reference**: E6 (Medium -- R2 upgrades to High)
- **Verification**: Valid. The Stop hook in settings.json (lines 59-68) is `type: "prompt"` with a verification prompt. Per the official Claude Code docs: "Your Stop hook script needs to check whether it already triggered a continuation" using the `stop_hook_active` field. The current prompt does not mention `stop_hook_active`. If the prompt determines steps were skipped and returns `ok: false`, Claude will continue, trigger Stop again, and the prompt will re-evaluate, potentially creating an infinite loop.
- **Impact**: Real risk of infinite loops at session end when the prompt detects missing workflow steps. The docs specifically warn about this scenario.
- **Recommendation**: Add a `stop_hook_active` check to the Stop hook prompt: "If stop_hook_active is true in the input, respond with ok: true to allow stopping." Alternatively, convert to a command-type hook that reads `stop_hook_active` from stdin JSON.

#### F-04: require-workitem.sh Validates ANY Workitem, Not the Correct One
- **R1 Reference**: D3 (High)
- **Verification**: Valid. Lines 30-36 of `require-workitem.sh` iterate over ALL `P*-F*-*/` directories and set `FOUND=true` if ANY has both `design.md` and `tasks.md`. There is no correlation between the file being edited and the workitem validated.
- **Impact**: Once any single feature has planning artifacts, the hook becomes a no-op for all future features. A developer could start coding P15-F18 without any planning artifacts as long as P15-F14 exists.
- **Recommendation**: Extract the feature ID from the file path being edited (e.g., map `src/main/services/retry-utils.ts` to the current active workitem via a marker file or git branch convention) and validate that specific workitem. This is non-trivial but the current behavior provides false assurance.

#### F-05: code-review Skill allowed-tools Excludes Bash But Body Requires It
- **R1 Reference**: E5 (Medium -- R2 upgrades to High)
- **Verification**: Valid. code-review/SKILL.md frontmatter: `allowed-tools: Read, Glob, Grep`. Body line 41: `Run ./tools/complexity.sh --threshold 5` (requires Bash). Line 63: `gh issue create` (requires Bash). The skill uses `context: fork` with `agent: reviewer`. Per the official docs, when a skill uses `context: fork`, the `allowed-tools` field controls tool access permissions (what tools can be used without asking), while the agent's `tools` field specifies available tools. The reviewer agent has `tools: Read, Grep, Glob, Bash` but `disallowedTools: Write, Edit`. Since the skill's `allowed-tools` is about permission grants rather than restricting the agent's tool list, Bash should still be available to the reviewer agent. However, the discrepancy between what's listed in `allowed-tools` and what the body requires is confusing and could lead to permission prompts or unexpected behavior.
- **Impact**: The skill may work due to agent tool inheritance, but the `allowed-tools` field is misleading. If the behavior depends on subtle interactions between skill `allowed-tools` and agent `tools`, it could break with Claude Code updates.
- **Recommendation**: Add `Bash` to the code-review skill's `allowed-tools` list to be explicit: `allowed-tools: Read, Glob, Grep, Bash`. Similarly for `security-review/SKILL.md`.

---

### Medium (consider fixing)

#### F-06: Orchestrator Rule paths Frontmatter Incomplete
- **R1 Reference**: A5 (Medium) + E8 (Medium) -- merged
- **Verification**: Valid. The orchestrator rule at `.claude/rules/orchestrator.md` has `paths: [CLAUDE.md, README.md, docs/**, contracts/**, .claude/rules/**, .claude/skills/**]` but omits `.claude/agents/**` and `.claude/hooks/**`. The orchestrator agent definition (line 14) claims `.claude/agents/` as exclusive domain. Per Claude Code docs, `paths` in rules files means the rule only loads when Claude works with matching files. So this rule will NOT load when editing agent or hook files, despite the orchestrator claiming exclusive ownership of those paths.
- **Impact**: When editing `.claude/agents/` or `.claude/hooks/` files, the orchestrator enforcement rules (exclusive ownership, META_CHANGE_REQUEST requirement) are absent from context.
- **Recommendation**: Add `.claude/agents/**` and `.claude/hooks/**` to the orchestrator rule's `paths` frontmatter.

#### F-07: No Hook Enforcement for Mandatory HITL Gates
- **R1 Reference**: D6 (Medium) + D11 (Medium) + D1 (High, partially) -- merged as root cause
- **Verification**: Partially Valid. R1 correctly identifies that Protected Path Commit and Contract Change mandatory gates have no hook enforcement. However, R2 notes that these gates are PM CLI-mediated: the PM CLI is responsible for presenting HITL gates before delegating, and agents "operate under the assumption that the PM CLI has already obtained necessary approvals" (hitl-gates.md). The risk is a direct `Edit` bypassing the PM CLI flow, which is mitigated by the fact that only the orchestrator commits.
- **Impact**: If an agent directly edits `contracts/` or `.claude/` files without going through the PM CLI workflow, no hook blocks the edit. The `require-workitem.sh` hook skips `.claude/` and `contracts/` paths (they're not under `src/`). The risk is real but somewhat mitigated by the agent role design.
- **Recommendation**: Add a PreToolUse hook for `Edit|Write` that detects writes to `contracts/` and `.claude/` paths and outputs a warning (exit 0 with stderr message) or blocks (exit 2). This converts the gate from LLM-compliance-only to deterministic enforcement.

#### F-08: Deploy Skill References Wrong Workflow Step
- **R1 Reference**: A4 (Low -- R2 upgrades to Medium)
- **Verification**: Valid. Deploy skill line 11: `Deploying to any environment tier (workflow step 10)`. The workflow has 8 steps; DevOps is step 7. Testing skill line 13: `Quality gate checks during workflow step 7` but testing maps to steps 3 and 5.
- **Impact**: Step numbers are used by the PM CLI to sequence operations. Wrong step references could cause incorrect workflow sequencing. This is more than cosmetic since the PM CLI relies on these references.
- **Recommendation**: Fix deploy/SKILL.md to "workflow step 7" and testing/SKILL.md to "workflow steps 3 and 5".

#### F-09: Refactor Approval Gate Promises Unreliable Revert
- **R1 Reference**: D2 (High -- R2 downgrades to Medium)
- **Verification**: Partially Valid. The Refactor Approval advisory gate (hitl-gates.md) offers "Option C: Revert refactor (keep pre-refactor code)." No explicit snapshot mechanism exists before refactoring starts. However, R2 notes: (1) this is an advisory gate, not mandatory; (2) git itself provides the revert mechanism -- the pre-refactor state is the last GREEN commit; (3) the TDD workflow explicitly says "run tests after EACH change" during refactoring, meaning incremental commits or at least a known-good state exists.
- **Impact**: The revert is not impossible -- `git checkout` or `git stash` could recover pre-refactor code. But no automated checkpoint is created, so the revert requires manual git operations by someone who understands the state.
- **Recommendation**: Add an instruction in tdd-build/SKILL.md Phase 3 to create a git stash or tag before refactoring: `git tag pre-refactor-{task_id}` or `git stash push -m "pre-refactor-{task_id}"`. This makes Option C reliable.

#### F-10: block-dangerous-commands.sh vs settings.local.json Conflict
- **R1 Reference**: A2 (High -- R2 downgrades to Medium)
- **Verification**: Valid but overstated. The hook blocks `pkill` and `killall` (line 27). `settings.local.json` allows `Bash(pkill:*)` (line 120). However, R2 notes: (1) `settings.local.json` permissions control whether Claude is prompted for approval; the hook runs AFTER permission is granted but BEFORE execution. (2) The hook correctly blocks dangerous commands regardless of permission settings -- this is defense-in-depth, not a conflict. (3) The user would see "Permission: allowed" then "BLOCKED by hook" which is confusing but safe.
- **Impact**: User confusion when a "permitted" command gets blocked. But the behavior is correct from a safety perspective -- the hook is a second layer of defense.
- **Recommendation**: Either remove `pkill` from the hook's block list (since it's explicitly permitted) or remove `Bash(pkill:*)` from `settings.local.json` permissions. Choose one enforcement point. If `pkill` should be allowed, remove from hook. If it should be blocked, remove from permissions.

---

### Low (cosmetic / nice-to-have)

#### F-11: Backend Agent src/core/ Not in CLAUDE.md Path Table
- **R1 Reference**: A7 (Low)
- **Verification**: Valid. Backend agent line 14 includes `src/core/` but CLAUDE.md path restrictions table does not list it. Minor inconsistency.
- **Recommendation**: Add `src/core/` to CLAUDE.md backend path restrictions.

#### F-12: Debugger Agent References Non-Existent Gate Number
- **R1 Reference**: D10 (Low)
- **Verification**: Valid. Debugger agent line 11: "Gate 6" but hitl-gates.md uses no gate numbers.
- **Recommendation**: Change to "Test Failures > 3 advisory gate" without a number.

#### F-13: SessionStart Hook Only Fires on startup
- **R1 Reference**: A3 (Low) + E1 (Low) -- merged
- **Verification**: Valid but intentional. The `matcher: "startup"` is a deliberate choice. Adding `resume` or `compact` matchers would re-display the banner, which may or may not be desired. Per Claude Code docs, valid matchers include `startup`, `resume`, `clear`, and `compact`.
- **Recommendation**: Consider adding `compact` matcher so the session banner re-displays after context compaction, restoring orientation. This is a UX improvement, not a bug.

#### F-14: MEMORY.md Contains Stale Date Entries
- **R1 Reference**: E7 (Low)
- **Verification**: Valid. MEMORY.md lines 41-44 contain duplicate `# currentDate` entries with `2026-03-01`. These are system-injected ephemeral data in a file meant for persistent learnings.
- **Recommendation**: Remove the `# currentDate` entries from MEMORY.md.

#### F-15: Skills Missing argument-hint and user-invocable Fields
- **R1 Reference**: E3 (Low) + E4 (Low) -- merged
- **Verification**: Valid. No skill uses `argument-hint`. `task-breakdown`, `diagram-builder`, and `security-review` are sub-skills but lack `user-invocable: false`. These are UX polish items.
- **Recommendation**: Add `argument-hint` to skills that take `$ARGUMENTS`. Add `user-invocable: false` to `task-breakdown`, `diagram-builder`, and `security-review` since they're only meant to be invoked by other skills.

---

## Dismissed Findings

| R1 ID | Title | Reason for Dismissal |
|-------|-------|---------------------|
| D1 | No Hook Enforcement for Agent Path Restrictions | **Intentional Design**. Per Claude Code docs, the `tools` field in agent frontmatter acts as an allowlist. Agent path restrictions are instructions (soft guardrails), not hooks. This is the standard Claude Code pattern -- no project uses hooks for agent domain enforcement. The `enforce-tdd-separation.sh` hook demonstrates that hooks ARE used where deterministic enforcement matters (TDD phase separation). Domain boundaries are less critical since the PM CLI controls delegation. |
| B1 | HITL Gates Defined in Three Places | **Intentional Design**. Each skill being self-contained is a Claude Code best practice. Skills load on-demand and need complete context. Cross-referencing from skills to rules would require loading multiple files. The overlap ensures skills work correctly in `context: fork` where they may not have the full rule set. |
| B2 | Workflow Steps in CLAUDE.md AND workflow.md | **Acceptable Pattern**. CLAUDE.md is the entry point loaded at session start. It serves as an index/summary. workflow.md is the detailed reference. Per Claude Code docs, CLAUDE.md should contain essential project context. |
| B3 | Coding Standards Repeated in Agents | **Acceptable Pattern**. Agent definitions need self-contained guidance. Each agent restates only the subset relevant to its domain. |
| B4 | Complexity Check in Six Files | **Acceptable Pattern**. Defensive repetition for a non-negotiable rule. Each file needs the check independently since skills load on-demand. |
| B5 | Auto-Lint Hook Overlaps with Feature-Completion | **Intentional Depth**. The hook provides immediate feedback per-edit. The skill provides batch validation. Different purposes at different granularities. |
| B6 | Path Restrictions in Agents AND CLAUDE.md | **Acceptable Pattern**. Same reasoning as B3. Agents need self-contained definitions. |
| B8 | Git Identity in Two Agents | **Correct Behavior**. Different agents have different identities. Both are set in their respective agent files. The pre-commit hook validates identity, providing a third layer. |
| C1 | Workitem Hook AND Stop Prompt | **Different Purposes**. The hook enforces at write-time. The Stop prompt performs end-of-session holistic validation. |
| C2 | tools/ Forwarding Stubs | **Clean Pattern**. The forwarding stubs provide a stable public interface (`./tools/test.sh`) while allowing implementation to live in skill directories. Confirmed: all 7 stubs use clean `exec` forwarding. |
| C3 | MEMORY.md Overlaps with CLAUDE.md | **Correct Usage**. The "Subagent Write permissions fail" entry in MEMORY.md is a learned workaround, not a project instruction. It belongs in MEMORY.md as session-specific knowledge. |
| C4-C6 | Non-Negotiable Rules / Coordination / Trunk-Based Repeated | **Defensive Repetition**. Critical rules should appear in multiple places. This is standard practice for important invariants. |
| E2 | Most Agents Lack disallowedTools | **R1 Claim is Inaccurate**. Per the official Claude Code docs: "If you omit tools, the subagent inherits all tools. If you specify tools, only those tools are available." The `tools` field IS the allowlist. If the planner agent has `tools: Read, Write, Glob, Grep`, it can ONLY use those tools. `disallowedTools` is a denylist applied on top. The planner does NOT need `disallowedTools: Bash, Edit` because `Bash` and `Edit` are not in its `tools` list. R1's claim that "inherited tools may leak through" is incorrect per current documentation. |
| E9 | Global CLAUDE.md Redundant with Project | **User's Prerogative**. The global CLAUDE.md contains personal preferences that apply across all projects. Even if they overlap with this project's rules, they serve as defaults for other projects. |
| B7 | Guardrails Boilerplate in All Agents | **Acceptable Overhead**. 12 lines per agent (96 total) for guardrails integration. Each agent needs its own `agent` and `domain` parameters. This could be a shared rule, but the current approach works and ensures each agent self-documents its guardrails integration. |

---

## New Findings

### N-01: require-workitem.sh Does Not Cover apps/workflow-studio/ Non-src Paths
- **Severity**: Medium
- **Description**: The `require-workitem.sh` hook checks `*/src/*` paths, which coincidentally catches `apps/workflow-studio/src/`. However, files at `apps/workflow-studio/test/`, `apps/workflow-studio/vite.config.*.ts`, or `apps/workflow-studio/package.json` are NOT covered. The hook's skip list (line 21) does not include `apps/` but also doesn't need to since the hook only triggers on `*/src/*`.
- **Impact**: Test files and configuration files in `apps/workflow-studio/` can be modified without any workitem governance.
- **Recommendation**: Expand the hook to also check `*/apps/*` paths or make the path check configurable.

### N-02: Pre-Commit Hook is Warning-Only for Author Mismatch
- **Severity**: Low
- **Description**: The pre-commit hook (`.git/hooks/pre-commit`) verifies git author identity against `.claude/instance-identity.json` but only issues a WARNING, not a block. Line: `echo "Proceeding with commit..."`. The "TBD" prefix on test execution (line: `TBD: Running pre-commit tests for main branch...`) is misleading but the tests DO execute and block on failure.
- **Impact**: An agent with wrong identity can still commit. The test enforcement works correctly despite the misleading label.
- **Recommendation**: Remove the "TBD:" prefix from the test execution message. Consider whether author mismatch should be a hard block.

### N-03: settings.local.json Contains Accumulated Permission Cruft
- **Severity**: Low
- **Description**: `settings.local.json` contains 252 permission entries, many of which appear to be one-off approvals accumulated over time (e.g., `Bash(for f in P12-F01-tdd-separation...)`, `Bash(do sleep:*)`, `Bash({\"session_id\": \"test-rename-005\"...})`). These are full command strings that were approved once and auto-saved.
- **Impact**: Bloated permissions file that could allow unintended command patterns. Some entries contain hardcoded paths.
- **Recommendation**: Periodically audit and clean `settings.local.json` permissions. Remove one-off approvals that are no longer needed.

---

## Root Cause Analysis

### RC-1: Workflow-Studio Governance Vacuum
**Related findings**: F-01, N-01, F-08 (partially)

The `apps/workflow-studio/` codebase was likely added after the initial governance framework was designed. The governance system was built around `src/` (Python backend) and `docker/hitl-ui/` (original frontend). When the Electron app was introduced, no one updated CLAUDE.md, agent definitions, or hooks. This single root cause explains the missing coding standards (A6), missing agent ownership (D8), and partial hook coverage (N-01).

**Fix**: A single coordinated update to CLAUDE.md (coding standards), an agent definition (ownership), and hooks (path coverage) resolves all three findings.

### RC-2: HITL Gates Are Instruction-Only
**Related findings**: F-07, F-09, D5, D7

Multiple HITL gates (Protected Path, Contract Change, "Plan before Code", "Review findings become issues") rely entirely on LLM compliance with instructions. No deterministic hooks validate that these gates were actually presented and approved. The root cause is a design philosophy that trusts PM CLI instruction-following rather than enforcing via hooks.

**Fix**: For mandatory gates, add PreToolUse hooks that detect the triggering conditions and block until confirmation. Start with the two most critical: Protected Path Commit and Contract Change.

### RC-3: Stale References from Workflow Evolution
**Related findings**: F-02, F-08, F-12

The workflow has evolved (from more steps to 8, from Claude Opus 4.5 to 4.6) but references scattered across multiple files were not all updated. This is a maintenance burden inherent in having distributed configuration.

**Fix**: A one-time audit to update all model version references and step numbers. Consider centralizing version and step number constants.

---

## Governance Scorecard

| Category | Score (1-5) | Notes |
|----------|-------------|-------|
| Hooks | 4 | Six well-designed hooks with proper exit codes. TDD separation hook is excellent. Missing: HITL gate enforcement, path-scoped enforcement for apps/. Stop hook needs stop_hook_active guard. |
| Skills | 4 | 13 skills with clear separation. Good use of context: fork and disable-model-invocation. Minor issues: wrong step numbers, missing argument-hint/user-invocable, code-review allowed-tools mismatch. |
| Agents | 3 | 8 agents with appropriate tool restrictions. Reviewer and debugger correctly use disallowedTools. Major gap: no agent covers apps/workflow-studio/. Guardrails boilerplate is verbose but functional. |
| Rules | 4 | 3 well-structured rules files. HITL gates are comprehensive. Orchestrator rule's path scope is incomplete. Workflow and coordination protocol rules are solid. |
| Settings | 3 | settings.json hooks are well-configured. settings.local.json has accumulated cruft (252 permissions, many one-off). Stop hook lacks infinite loop guard. |
| CLAUDE.md | 3 | Good structure with roles, standards, and non-negotiable rules. Major gap: no coverage of apps/workflow-studio/ TypeScript codebase. Some stale information. |
| Memory | 3 | MEMORY.md contains useful session learnings (P15 status, architecture patterns, workarounds). Contains stale date entries. Some permanent constraints belong in CLAUDE.md instead. |
| **Overall** | **3.4** | Solid governance framework with mature hook and skill design. The primary weakness is governance coverage of the workflow-studio codebase and the gap between declared HITL gates and deterministic enforcement. |

---

## Priority Action Items

| Priority | Finding | Action | Effort |
|----------|---------|--------|--------|
| 1 | F-01 | Add apps/workflow-studio/ to CLAUDE.md, create agent definition, update path restrictions | 1-2 hours |
| 2 | F-02 | Update orchestrator.md line 113 from Opus 4.5 to Opus 4.6 | 5 minutes |
| 3 | F-03 | Add stop_hook_active guard to Stop hook | 30 minutes |
| 4 | F-04 | Improve require-workitem.sh to validate the correct workitem, not any workitem | 2-3 hours |
| 5 | F-05 | Add Bash to code-review and security-review allowed-tools | 5 minutes |
| 6 | F-06 | Add .claude/agents/** and .claude/hooks/** to orchestrator rule paths | 5 minutes |
| 7 | F-07 | Add PreToolUse hook for contracts/ and .claude/ protected path enforcement | 1-2 hours |
| 8 | F-08 | Fix step numbers in deploy and testing SKILL.md | 5 minutes |
| 9 | F-09 | Add pre-refactor git tag/stash instruction to tdd-build SKILL.md | 15 minutes |
| 10 | F-10 | Resolve pkill/killall permission vs hook conflict (pick one enforcement point) | 15 minutes |
| 11-15 | F-11 to F-15 | Low-priority cosmetic fixes | 30 minutes total |
| 16 | N-01 | Expand require-workitem.sh to cover apps/ paths | 30 minutes |
| 17 | N-02 | Remove "TBD:" prefix from pre-commit test message | 5 minutes |
| 18 | N-03 | Audit and clean settings.local.json permissions | 1 hour |

**Total estimated effort**: 7-10 hours for all items. Items 1-6 (highest impact) can be completed in under 3 hours.
