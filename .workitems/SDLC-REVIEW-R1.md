# SDLC E2E Review -- Round 1 Thesis

## Methodology

This review examined every governance file in the aSDLC project and cross-referenced them against official Claude Code documentation (code.claude.com, March 2026). The files reviewed:

- **Settings**: `.claude/settings.json`, `.claude/settings.local.json`
- **Rules**: `.claude/rules/workflow.md`, `.claude/rules/hitl-gates.md`, `.claude/rules/coordination-protocol.md`, `.claude/rules/orchestrator.md`
- **Agents** (8): `backend.md`, `frontend.md`, `orchestrator.md`, `planner.md`, `test-writer.md`, `reviewer.md`, `debugger.md`, `devops.md`
- **Skills** (13): `design-pipeline`, `tdd-build`, `code-review`, `security-review`, `feature-completion`, `testing`, `commit`, `deploy`, `phase-gate`, `task-breakdown`, `diagram-builder`, `multi-review`, `contract-update`
- **Hooks** (6): `session-start.sh`, `block-dangerous-commands.sh`, `require-workitem.sh`, `enforce-tdd-separation.sh`, `auto-lint.sh`, `check-workitems-length.sh`
- **Project CLAUDE.md**, **Global CLAUDE.md** (`~/.claude/CLAUDE.md`), **MEMORY.md**

Documentation sources consulted: Claude Code official docs on hooks, skills, subagents, memory/CLAUDE.md, and rules.

## Summary of Findings

| Category | Count |
|----------|-------|
| Conflicts | 7 |
| Overlaps | 8 |
| Redundancies | 6 |
| Gaps | 11 |
| Governance Alignment Issues | 9 |

---

## A. Conflicts

### A1. Co-Authored-By Model Version Mismatch

- **Files involved**: `.claude/agents/orchestrator.md` (line 113), `.claude/skills/commit/SKILL.md` (line 18), `.claude/skills/design-pipeline/SKILL.md` (line 120)
- **Description**: The orchestrator agent specifies `Co-Authored-By: Claude Opus 4.5` while both the commit skill and design-pipeline skill specify `Co-Authored-By: Claude Opus 4.6`. Since the orchestrator is the primary commit authority, its template will produce commits with the wrong model version.
- **Evidence**: orchestrator.md line 113: `Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>` vs commit SKILL.md line 18: `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
- **Severity**: Medium -- produces inconsistent commit metadata

### A2. block-dangerous-commands.sh vs settings.local.json Permission Conflict

- **Files involved**: `.claude/hooks/block-dangerous-commands.sh` (lines 27, 28), `.claude/settings.local.json` (lines 108, 120, 218)
- **Description**: The hook blocks `pkill` and `killall` commands (line 27), yet `settings.local.json` explicitly allows `Bash(pkill:*)`, `Bash(kill:*)`, and `Bash(xargs kill:*)`. The hook runs as a PreToolUse handler, so it will block commands that the permissions layer has already approved, creating user confusion -- the permission prompt says "allowed" but the hook then blocks execution.
- **Evidence**: Hook line 27: `check_pattern '(^|\s|;|&&|\|)(pkill|killall)(\s|$)' "Force-killing processes (pkill/killall)"`. Settings line 120: `"Bash(pkill:*)"`, line 218: `"Bash(kill:*)"`.
- **Severity**: High -- approved commands get silently blocked, leading to frustrating debugging

### A3. SessionStart Hook Matcher Uses Invalid Value

- **Files involved**: `.claude/settings.json` (line 5)
- **Description**: The SessionStart hook uses `"matcher": "startup"` but per Claude Code docs, the valid SessionStart matcher values are `startup`, `resume`, `clear`, and `compact`. While `startup` is valid for initial sessions, the hook will NOT fire on session resume, after `/clear`, or after compaction. If the session banner is intended to re-display after compaction (to maintain orientation), it should also match `compact` and `resume`.
- **Evidence**: settings.json line 5: `"matcher": "startup"`. The session-start.sh script displays a banner with instance, branch, and workitems.
- **Severity**: Low -- the banner only appears once per new session; may be intentional, but worth noting that context is lost after compaction

### A4. Deploy Skill References Wrong Workflow Step Number

- **Files involved**: `.claude/skills/deploy/SKILL.md` (line 11), `.claude/rules/workflow.md`
- **Description**: The deploy skill says "workflow step 10" but the actual workflow has only 8 steps (DevOps is step 7). Similarly, the testing skill says "workflow step 7" (line 15 of testing SKILL.md) but testing maps to steps 3/5 in the workflow.
- **Evidence**: deploy/SKILL.md line 11: `"Deploying to any environment tier (workflow step 10)"`. workflow.md defines step 7 as DevOps and only has 8 steps total. testing/SKILL.md line 15: `"Quality gate checks during workflow step 7"` but testing is invoked at steps 3 and 5.
- **Severity**: Low -- cosmetic, but could cause confusion about sequencing

### A5. Orchestrator Rule paths Frontmatter Incomplete

- **Files involved**: `.claude/rules/orchestrator.md` (lines 3-9), `.claude/agents/orchestrator.md` (lines 11-16)
- **Description**: The orchestrator rule's `paths` frontmatter lists `CLAUDE.md`, `README.md`, `docs/**`, `contracts/**`, `.claude/rules/**`, `.claude/skills/**` but is missing `.claude/agents/**` and `.claude/hooks/**` which the orchestrator agent definition claims as exclusive domain (line 14: "Agents: `.claude/agents/`"). This means the rule file may not load when editing agent or hook files, potentially missing enforcement.
- **Evidence**: Rule paths omit `.claude/agents/**` and `.claude/hooks/**`. Agent definition line 14 claims `.claude/agents/` as exclusive.
- **Severity**: Medium -- incomplete path-scoped rule loading

### A6. TypeScript Coding Standards Scope Mismatch

- **Files involved**: `CLAUDE.md` (line 70)
- **Description**: CLAUDE.md's TypeScript coding standards section says `TypeScript (docker/hitl-ui/)` but the project now has a major TypeScript codebase at `apps/workflow-studio/` (the Electron app with 1,331+ tests). The coding standards do not mention this path at all, and the frontend agent definition only references `docker/hitl-ui/` and `src/hitl_ui/` as its domain.
- **Evidence**: CLAUDE.md line 70: `**TypeScript** (docker/hitl-ui/): Strict mode, prettier formatting, eslint recommended, prefer interfaces over type aliases.` The `apps/workflow-studio/` directory exists with active development (modified files in git status).
- **Severity**: High -- a major codebase has no coding standards coverage or agent ownership

### A7. Backend Agent Path Restrictions Conflict with CLAUDE.md

- **Files involved**: `.claude/agents/backend.md` (lines 11-17), `CLAUDE.md` (lines 51-52)
- **Description**: CLAUDE.md says backend domain includes `src/workers/`, `src/orchestrator/`, `src/infrastructure/`, `.workitems/P01-P03,P06`. However, the backend agent definition also includes `src/core/` (line 14) which CLAUDE.md does not mention in the backend path restrictions. Additionally, CLAUDE.md lists `src/orchestrator/` but there's an ambiguity -- does this refer to the Python orchestrator (`src/orchestrator/`) or could it be confused with the orchestrator role's meta files?
- **Evidence**: Backend agent line 14: `Core shared modules (src/core/)`. CLAUDE.md line 51 does not list `src/core/` under backend restrictions.
- **Severity**: Low -- minor inconsistency in domain coverage

---

## B. Overlaps

### B1. HITL Gates Defined in Three Places

- **Files involved**: `.claude/rules/hitl-gates.md`, `.claude/rules/workflow.md` (lines 12-26), `.claude/skills/tdd-build/SKILL.md` (lines 96-130), `.claude/skills/design-pipeline/SKILL.md` (lines 59-76, 93-110), `.claude/skills/commit/SKILL.md` (lines 49-58), `.claude/skills/phase-gate/SKILL.md` (lines 42-56), `.claude/agents/orchestrator.md` (lines 118-134)
- **Description**: HITL gate definitions appear in hitl-gates.md (canonical), workflow.md (summary table), and are then repeated in detail in each relevant skill and agent file. The content is largely identical but creates maintenance burden. When a gate changes, at least 3-5 files need updating.
- **Evidence**: The "Test Failures > 3" gate appears in hitl-gates.md (full spec), workflow.md (table row), tdd-build/SKILL.md (lines 118-130), and debugger.md (lines 140-160). The "Protected Path Commit" gate appears in hitl-gates.md, workflow.md, commit/SKILL.md, and orchestrator.md.
- **Severity**: Medium -- redundant but ensures each skill is self-contained

### B2. Workflow Steps Summarized in CLAUDE.md AND workflow.md

- **Files involved**: `CLAUDE.md` (lines 6-16), `.claude/rules/workflow.md` (full file)
- **Description**: CLAUDE.md repeats the 8-step workflow with skill mappings that are also fully defined in workflow.md. CLAUDE.md also repeats the skill table (lines 78-93) that mirrors the workflow.md table (lines 28-40).
- **Evidence**: CLAUDE.md lines 6-16 is a condensed version of workflow.md steps 1-8. CLAUDE.md skills table (lines 78-93) is identical content to workflow.md (lines 28-40).
- **Severity**: Low -- CLAUDE.md is the entry point so some repetition is acceptable, but the skill table is a verbatim duplicate

### B3. Coding Standards Repeated Across CLAUDE.md and Agent Definitions

- **Files involved**: `CLAUDE.md` (lines 67-74), `.claude/agents/backend.md` (lines 34-38), `.claude/agents/frontend.md` (lines 39-42), `.claude/agents/test-writer.md` (lines 95-104), `.claude/agents/reviewer.md` (lines 39-43)
- **Description**: CLAUDE.md defines coding standards centrally. Each agent then restates subset requirements: backend says "type hints", "Google-style docstrings"; reviewer checks "follows coding standards in CLAUDE.md", "type hints on all function signatures", "Google-style docstrings"; test-writer specifies naming convention. These partial restatements risk drift.
- **Evidence**: CLAUDE.md line 68: `type hints required, Google-style docstrings`. Backend agent line 37: `Use type hints for all function signatures` and line 38: `Write Google-style docstrings for public functions`. These are not cross-references but restated rules.
- **Severity**: Low -- minor maintenance burden

### B4. Complexity Check in Three Locations

- **Files involved**: `CLAUDE.md` (line 68), `.claude/skills/tdd-build/SKILL.md` (line 94), `.claude/skills/feature-completion/SKILL.md` (lines 43-49), `.claude/skills/code-review/SKILL.md` (line 41), `.claude/skills/task-breakdown/SKILL.md` (line 35), `~/.claude/CLAUDE.md` (line 3)
- **Description**: The CC <= 5 complexity rule appears in 6 different files. CLAUDE.md defines it centrally, the global CLAUDE.md asks to "check cyclomatic complexity and report if it exceeds 5", and four skills each independently restate the rule with `./tools/complexity.sh --threshold 5`.
- **Evidence**: CLAUDE.md: `Cyclomatic complexity cap: CC <= 5 per function`. tdd-build: `Run ./tools/complexity.sh --threshold 5`. feature-completion: `./tools/complexity.sh --threshold 5`. code-review: `Run ./tools/complexity.sh --threshold 5`. task-breakdown: `CC budget -- all new/modified functions must stay CC <= 5`.
- **Severity**: Low -- widely distributed but consistent; the global CLAUDE.md adds an additional layer

### B5. Auto-Lint Hook Overlaps with Feature-Completion Lint Step

- **Files involved**: `.claude/hooks/auto-lint.sh`, `.claude/skills/feature-completion/SKILL.md` (lines 36-39), `.claude/skills/testing/SKILL.md` (lines 36-37)
- **Description**: The PostToolUse auto-lint hook automatically runs `ruff check --fix` after every Python file edit. Then the feature-completion and testing skills both instruct to run `./tools/lint.sh` explicitly. This means linting happens twice -- once automatically per edit and once as a validation gate. While not harmful, it creates unnecessary processing.
- **Evidence**: auto-lint.sh runs `ruff check --fix "$FILE_PATH"` on every `.py` edit. feature-completion line 37: `./tools/lint.sh src/path/to/feature/`. testing line 37: `./tools/lint.sh src/path/`.
- **Severity**: Low -- defensive redundancy, not harmful

### B6. Path Restrictions Stated in Agents AND CLAUDE.md

- **Files involved**: `CLAUDE.md` (lines 50-54), all 8 agent files
- **Description**: CLAUDE.md defines path restrictions centrally in a table. Each agent then restates its own restrictions (what it can and cannot modify). The agent files contain more detail (e.g., specific exclusion lists) but the central table and agent definitions could drift apart.
- **Evidence**: CLAUDE.md line 51: `backend: src/workers/, src/orchestrator/, src/infrastructure/`. Backend agent lines 27-29 add: `cannot modify: Frontend files: src/hitl_ui/, docker/hitl-ui/; Meta files...`. These are complementary but partially overlapping.
- **Severity**: Low -- acceptable pattern for self-contained agent definitions

### B7. Guardrails Integration Boilerplate in All Agents

- **Files involved**: All 8 agent files in `.claude/agents/`
- **Description**: Every single agent file contains an identical "Guardrails Integration" section (approximately 12 lines each, ~96 lines total) that describes calling `guardrails_get_context`. This is pure boilerplate repeated 8 times.
- **Evidence**: Every agent ends with the same block: `When the guardrails MCP server is available, call guardrails_get_context at the start of each task...`. The only variation is the `agent` and `domain` parameter values.
- **Severity**: Medium -- 96 lines of near-identical boilerplate across 8 files; should be a shared rule or injected by the guardrails server itself

### B8. Git Identity Set in orchestrator.md AND devops.md

- **Files involved**: `.claude/agents/orchestrator.md` (lines 47-49), `.claude/agents/devops.md` (lines 143-146)
- **Description**: Both the orchestrator and devops agents contain `git config user.email/user.name` blocks with different identities. This is correct behavior (different identities for different roles) but the pre-commit hook in `.git/hooks/pre-commit` already handles identity verification. The git config instructions in agent files are redundant with the launcher scripts that set identity.
- **Evidence**: orchestrator.md: `git config user.email "claude-orchestrator@asdlc.local"`. devops.md: `git config user.email "claude-devops@asdlc.local"`. Pre-commit hook reads from `.claude/instance-identity.json` set by launcher scripts.
- **Severity**: Low -- different systems addressing the same concern

---

## C. Redundancy

### C1. Workitem Requirement Enforced by Hook AND Stop Prompt

- **Files involved**: `.claude/hooks/require-workitem.sh`, `.claude/settings.json` Stop hook (lines 59-68)
- **Description**: The `require-workitem.sh` hook blocks writes to `src/` unless a workitem with `design.md` AND `tasks.md` exists. The Stop hook prompt then asks "Do .workitems/PNN-FNN-*/ folders exist for every feature worked on?" This is redundant -- the PreToolUse hook already enforces workitem existence at write time. The Stop prompt re-checks what was already enforced.
- **Evidence**: require-workitem.sh blocks writes without workitems. Stop prompt (settings.json line 64): "Do .workitems/PNN-FNN-*/ folders exist for every feature worked on?"
- **Severity**: Low -- the Stop prompt provides broader end-of-session validation beyond just file writes

### C2. skills/ Scripts Duplicated as tools/ Forwarding Stubs

- **Files involved**: `tools/test.sh`, `tools/lint.sh`, `tools/sast.sh`, `tools/sca.sh`, `tools/complexity.sh`, `tools/e2e.sh`, `tools/ast.sh` and their counterparts in `.claude/skills/testing/scripts/` and `.claude/skills/code-review/scripts/`
- **Description**: The `tools/` directory contains forwarding stubs (`exec ... .claude/skills/testing/scripts/test.sh`) that redirect to the actual implementations in `.claude/skills/testing/scripts/`. While this maintains backward compatibility for references to `./tools/test.sh`, it means there are two paths to every script. Multiple governance files reference both paths.
- **Evidence**: `tools/test.sh` line 3: `exec "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)/.claude/skills/testing/scripts/test.sh" "$@"`. References to `./tools/test.sh` appear in CLAUDE.md, orchestrator.md, and commit/SKILL.md. References to direct paths appear in skills.
- **Severity**: Low -- the forwarding pattern is clean, but having two paths creates cognitive overhead

### C3. MEMORY.md Partially Duplicates CLAUDE.md Content

- **Files involved**: `MEMORY.md` (lines 1-6), `CLAUDE.md` (lines 1-2)
- **Description**: MEMORY.md begins with "# aSDLC Project Memory" and contains project context that overlaps with CLAUDE.md. For example, MEMORY.md records "Subagent Write permissions fail -- planner/orchestrator/reviewer subagents cannot write to .workitems/." This is a workaround for a Claude Code limitation that should either be in CLAUDE.md (as a permanent instruction) or only in MEMORY.md (as a learned behavior). Having it in MEMORY.md means it might not persist if memory is curated.
- **Evidence**: MEMORY.md line 30: `Subagent Write permissions fail`. This is an ongoing constraint, not a session-specific learning.
- **Severity**: Low -- MEMORY.md is used appropriately for session-specific learnings, but some entries are permanent constraints that belong in CLAUDE.md

### C4. Non-Negotiable Rules Restated Across Files

- **Files involved**: `CLAUDE.md` (lines 28-35), `.claude/rules/workflow.md`, `.claude/rules/hitl-gates.md`, multiple skill files
- **Description**: CLAUDE.md's "Non-Negotiable Rules" section lists 7 rules. Rules 1-3 are restated in workflow.md. Rule 4 is restated in code-review/SKILL.md. Rule 5 is restated in orchestrator.md and orchestrator rule. Rule 7 is restated in the Trunk-Based Development section of CLAUDE.md itself.
- **Evidence**: CLAUDE.md rule 1: "Plan before code". workflow.md: "Step 3: TDD Build" has prerequisite check. CLAUDE.md rule 4: "Review findings become issues". code-review/SKILL.md line 63: `gh issue create`.
- **Severity**: Low -- defensive repetition for critical rules is acceptable

### C5. Coordination Protocol Information in CLAUDE.md AND coordination-protocol.md

- **Files involved**: `CLAUDE.md` (lines 96-100), `.claude/rules/coordination-protocol.md`
- **Description**: CLAUDE.md contains a "Multi-Session Infrastructure" section that summarizes coordination-protocol.md. The coordination-protocol.md file is already loaded as a rule. The CLAUDE.md section adds no new information beyond what the rule provides.
- **Evidence**: CLAUDE.md lines 96-100 is a 5-line summary. coordination-protocol.md has the full specification. Both are loaded into context.
- **Severity**: Low -- the CLAUDE.md section serves as a pointer

### C6. Trunk-Based Development Repeated

- **Files involved**: `CLAUDE.md` (lines 58-64), `.claude/agents/orchestrator.md` (lines 98-114), `.claude/rules/workflow.md`
- **Description**: Trunk-based development is mentioned in CLAUDE.md (rule 7 + dedicated section), restated in orchestrator.md (Commit Authority section), and implied in workflow.md. Each adds slightly different detail but the core message ("all work targets main, orchestrator commits, devops commits infra") is the same.
- **Evidence**: CLAUDE.md: "All work targets main. Orchestrator is primary commit authority; devops commits infrastructure only." Orchestrator.md: "The orchestrator is the primary commit agent...Backend and frontend agents prepare changes but do not commit."
- **Severity**: Low -- acceptable for emphasis

---

## D. Gaps

### D1. No Hook Enforcement for Agent Path Restrictions

- **Files involved**: All agent files, `.claude/hooks/enforce-tdd-separation.sh`
- **Description**: Each agent definition claims path restrictions (e.g., backend "CANNOT modify: Frontend files, Meta files"). However, no PreToolUse hook validates these restrictions. The `enforce-tdd-separation.sh` hook only checks TDD phase roles (test-writer vs code-writer), not agent domain boundaries. If a backend agent attempts to edit `docker/hitl-ui/src/App.tsx`, nothing stops it.
- **Evidence**: Backend agent lines 27-29 claim restrictions. Frontend agent lines 32-33 claim restrictions. No hook reads agent identity or validates domain boundaries on Edit/Write operations. The agents state path restrictions as instructions (soft guardrails) not enforcement (hard guardrails).
- **Severity**: High -- claimed enforcement exists only as LLM instructions, not deterministic hooks

### D2. Refactor Approval Gate Has No Revert Mechanism

- **Files involved**: `.claude/rules/hitl-gates.md` (Refactor Approval section), `.claude/skills/tdd-build/SKILL.md` (lines 96-107)
- **Description**: The Refactor Approval advisory gate offers "Option C: Revert refactor (keep pre-refactor code)." However, there is no snapshot mechanism, no git stash, no checkpoint, and no hook that creates a save point before refactoring begins. If the user chooses Option C, the system has no way to revert to pre-refactor state.
- **Evidence**: hitl-gates.md: `C) Revert refactor (keep pre-refactor code)`. No pre-refactor checkpoint is created anywhere in the TDD build flow. tdd-build/SKILL.md Phase 3 does not mention creating a snapshot before refactoring.
- **Severity**: High -- the gate promises an action it cannot deliver

### D3. require-workitem.sh Does Not Validate Feature-Specific Workitem

- **Files involved**: `.claude/hooks/require-workitem.sh`
- **Description**: The hook checks that ANY workitem with `design.md` + `tasks.md` exists, not that the CORRECT workitem for the current feature exists. If feature P15-F01 has planning artifacts, the hook allows writes for P15-F18 code even if P15-F18 has no workitem at all.
- **Evidence**: require-workitem.sh line 30-36: iterates over ALL `P*-F*-*/` directories and sets `FOUND=true` if ANY has both files. There is no correlation between the file being edited and the workitem being validated.
- **Severity**: High -- the hook provides a false sense of enforcement

### D4. No Pre-Commit Test Enforcement on Main

- **Files involved**: `CLAUDE.md` (line 62), `.git/hooks/pre-commit`
- **Description**: CLAUDE.md states "Pre-commit hook enforces `./tools/test.sh --quick`." The actual pre-commit hook does attempt this (line starting with `"TBD: Running pre-commit tests"`), but only on the `main` branch. However, since the project uses trunk-based development (ALL work targets main), this should always fire. The issue is the pre-commit hook prints "TBD:" before running tests, suggesting this was implemented but may have been incomplete at some point.
- **Evidence**: Pre-commit hook line: `echo -e "${YELLOW}TBD: Running pre-commit tests for main branch...${NC}"`. The "TBD" prefix is misleading -- the test execution code IS implemented below it.
- **Severity**: Low -- the enforcement works, but the "TBD" label is misleading

### D5. No Enforcement of "Plan Before Code" Rule

- **Files involved**: `CLAUDE.md` (line 29, rule 1), `.claude/hooks/require-workitem.sh`
- **Description**: Rule 1 says "Steps 1-2 must complete before Step 3." The `require-workitem.sh` hook checks for `design.md` + `tasks.md` existence but does not verify that design review R1+R2 passed, that user approved at the User Gate, or that the design has `status: approved`. The tdd-build skill does check `status: approved` as a prerequisite, but only when explicitly invoked -- if someone bypasses the skill, no hook enforces this.
- **Evidence**: require-workitem.sh only checks file existence. tdd-build/SKILL.md lines 11-13 check `status: approved` but this is an LLM instruction, not a deterministic hook.
- **Severity**: Medium -- partial enforcement via hook + skill combination, but bypassable

### D6. No Hook for Protected Path Commit Gate

- **Files involved**: `.claude/rules/hitl-gates.md` (Protected Path Commit), `.claude/skills/commit/SKILL.md` (lines 49-58)
- **Description**: The Protected Path Commit HITL gate (mandatory for `contracts/` and `.claude/`) is described in hitl-gates.md and referenced in the commit skill, but there is no PreToolUse hook that detects commits to protected paths and forces a confirmation. The enforcement relies entirely on the PM CLI following the skill instructions.
- **Evidence**: No hook in `.claude/hooks/` checks for commits to protected paths. The commit skill states the gate but it's an LLM instruction, not a deterministic enforcement.
- **Severity**: Medium -- HITL gate relies on LLM compliance rather than deterministic enforcement

### D7. No Enforcement of "Review Findings Become Issues" Rule

- **Files involved**: `CLAUDE.md` (line 31, rule 4), `.claude/skills/code-review/SKILL.md` (lines 57-64)
- **Description**: Rule 4 states "All code review findings become GitHub issues." The code-review skill instructs creating issues with `gh issue create`, but no hook or validation checks that issues were actually created after a code review. The skill could complete without creating any issues.
- **Evidence**: code-review/SKILL.md line 63: `gh issue create --title "Review: <finding>" --label "code-review,<severity>"`. No PostToolUse or Stop hook validates that issues were created.
- **Severity**: Medium -- relies entirely on LLM compliance

### D8. apps/workflow-studio/ Has No Agent Ownership

- **Files involved**: `CLAUDE.md` (lines 40-48), all agent definitions
- **Description**: The `apps/workflow-studio/` directory contains a major Electron/TypeScript application (the active development target with P15 features), but no agent definition claims ownership of this path. The frontend agent only covers `docker/hitl-ui/` and `src/hitl_ui/`. The backend agent covers Python paths under `src/`. This means the workflow studio code has no dedicated agent, no domain boundaries, and no coding standards in CLAUDE.md.
- **Evidence**: Frontend agent: domain is `docker/hitl-ui/` and `src/hitl_ui/`. Backend agent: domain is `src/workers/`, `src/orchestrator/`, etc. No agent mentions `apps/` or `apps/workflow-studio/`.
- **Severity**: Critical -- the primary active development codebase has no governance coverage

### D9. No Enforcement of Task Visibility Rule

- **Files involved**: `CLAUDE.md` (line 34, rule 6)
- **Description**: Rule 6 states "Task visibility required -- Use TaskCreate/TaskUpdate for all multi-step work." No hook, prompt, or validation enforces this. There is no way to detect if an agent is performing multi-step work without creating tasks.
- **Evidence**: No hook checks for TaskCreate/TaskUpdate usage. The rule is purely instructional.
- **Severity**: Low -- inherently difficult to enforce via hooks

### D10. Debugger Agent References Wrong Gate Number

- **Files involved**: `.claude/agents/debugger.md` (line 11)
- **Description**: The debugger agent says it's "invoked at Gate 6 (Test Failures > 3)" but hitl-gates.md does not number gates. The advisory gate for test failures is described in the HITL gates doc without a gate number. This appears to be a stale reference to an older numbering scheme.
- **Evidence**: debugger.md line 11: `after 3+ consecutive failures (Gate 6)`. hitl-gates.md does not use numbered gates.
- **Severity**: Low -- cosmetic reference error

### D11. Contract Change Gate Missing Hook Enforcement

- **Files involved**: `.claude/rules/hitl-gates.md` (Contract Change section), `.claude/skills/contract-update/SKILL.md`
- **Description**: The Contract Change HITL gate (mandatory) requires user confirmation when modifying `contracts/current/` or `contracts/versions/`. No PreToolUse hook detects writes to these paths and blocks them pending confirmation. The enforcement relies on the contract-update skill being invoked, but a direct `Edit` to a contract file would bypass the gate entirely.
- **Evidence**: No hook in `.claude/hooks/` checks for writes to `contracts/`. hitl-gates.md defines the gate as mandatory. contract-update/SKILL.md describes the process but no deterministic enforcement exists.
- **Severity**: Medium -- mandatory gate has no enforcement mechanism

---

## E. Governance Alignment

### E1. Settings.json Hook Matcher for SessionStart

- **Files involved**: `.claude/settings.json` (line 5)
- **Description**: Per Claude Code docs, `SessionStart` matchers filter on how the session started: `startup`, `resume`, `clear`, `compact`. The project uses `"matcher": "startup"` which is valid. However, this means the session banner does NOT re-display after compaction or resume. Given that compaction can lose context, a `compact` matcher for re-injecting the banner would follow best practices.
- **Evidence**: Current: `"matcher": "startup"`. Best practice: Consider `"startup|resume|compact"` to maintain orientation.
- **Severity**: Low -- valid but suboptimal

### E2. Agent Definitions Missing disallowedTools for Most Agents

- **Files involved**: `.claude/agents/backend.md`, `.claude/agents/frontend.md`, `.claude/agents/orchestrator.md`, `.claude/agents/planner.md`, `.claude/agents/devops.md`
- **Description**: Per Claude Code docs, agents support both `tools` (allowlist) and `disallowedTools` (denylist) frontmatter fields. Only `test-writer.md` uses `disallowedTools` (`MultiEdit, NotebookEdit, Task, WebFetch, WebSearch`), and only `reviewer.md` and `debugger.md` use it (`Write, Edit`). The other 5 agents list `tools` but don't use `disallowedTools`. For example, the planner agent has `tools: Read, Write, Glob, Grep` but does not explicitly disallow `Edit` or `Bash` -- yet the planner "does NOT write implementation code." Without `disallowedTools`, Claude can still use unlisted tools through inheritance.
- **Evidence**: Planner has `tools: Read, Write, Glob, Grep` but no `disallowedTools`. Per docs: "By default, subagents inherit all tools from the main conversation." This means the planner can still use Bash, Edit, etc. unless explicitly denied.
- **Severity**: High -- tools list is an allowlist in Claude Code docs, but without `disallowedTools`, inherited tools may leak through depending on version behavior

### E3. Skill Frontmatter Missing `argument-hint` Field

- **Files involved**: All 13 skill SKILL.md files
- **Description**: Per Claude Code docs, the `argument-hint` field provides hints during autocomplete (e.g., `[issue-number]` or `[filename]`). None of the 13 skills use this field. Skills like `tdd-build`, `design-pipeline`, and `code-review` take $ARGUMENTS but users have no autocomplete guidance.
- **Evidence**: No skill uses `argument-hint`. Skills reference `$ARGUMENTS` extensively (e.g., `Deploy to environment $ARGUMENTS`).
- **Severity**: Low -- nice-to-have UX improvement

### E4. Skills Missing `user-invocable: false` Where Appropriate

- **Files involved**: `.claude/skills/task-breakdown/SKILL.md`, `.claude/skills/diagram-builder/SKILL.md`, `.claude/skills/security-review/SKILL.md`
- **Description**: Per Claude Code docs, `user-invocable: false` hides skills from the `/` menu when they're only meant to be invoked by other skills/agents. `task-breakdown` is "invoked by @design-pipeline at Stage 8", `diagram-builder` is "auto-invoked during planning", and `security-review` is "invoked by code-review Agent 2." These are sub-skills not meant for direct user invocation but lack `user-invocable: false`.
- **Evidence**: task-breakdown description: "Invoked by @design-pipeline at Stage 8". diagram-builder: "Auto-invoked during planning". Both appear in the `/` menu unnecessarily.
- **Severity**: Low -- UX clutter in the skill menu

### E5. Code-Review Skill Uses `context: fork` and `agent: reviewer` Correctly

- **Files involved**: `.claude/skills/code-review/SKILL.md`, `.claude/skills/security-review/SKILL.md`
- **Description**: These skills correctly use `context: fork` with `agent: reviewer` to run in isolated context. This is the recommended pattern per Claude Code docs. However, the `allowed-tools` field (`Read, Glob, Grep`) does not include `Bash`, yet the skill body instructs running `./tools/complexity.sh` and `gh issue create`. Since the agent (reviewer) has `Bash` in its tools, and skills with `context: fork` use the agent's tools, this may work -- but the `allowed-tools` in the skill frontmatter should either include `Bash` or be removed to inherit from the agent.
- **Evidence**: code-review/SKILL.md: `allowed-tools: Read, Glob, Grep`. Body line 41: `Run ./tools/complexity.sh --threshold 5` (requires Bash). Line 63: `gh issue create` (requires Bash).
- **Severity**: Medium -- skill instructs actions its `allowed-tools` do not permit; behavior depends on how `context: fork` + `agent` + `allowed-tools` interact

### E6. Stop Hook Uses Prompt Type Without stop_hook_active Guard

- **Files involved**: `.claude/settings.json` (lines 59-68)
- **Description**: Per Claude Code docs, Stop hooks that use `type: "prompt"` should check the `stop_hook_active` field to prevent infinite loops where the Stop hook keeps preventing Claude from stopping. The current Stop hook is `type: "prompt"` but does not instruct the model to check `stop_hook_active`. If the prompt returns `ok: false`, Claude will keep working, trigger Stop again, and the prompt will re-evaluate.
- **Evidence**: settings.json Stop hook: `"type": "prompt"` with a verification prompt. No mention of `stop_hook_active` in the prompt text. Per docs: "Your Stop hook script needs to check whether it already triggered a continuation."
- **Severity**: Medium -- potential infinite loop if the prompt determines steps were skipped

### E7. MEMORY.md Contains Date Injections

- **Files involved**: `MEMORY.md` (lines 41-42)
- **Description**: MEMORY.md contains `# currentDate\nToday's date is 2026-03-01.` entries (appears twice). This is injecting temporal context into auto memory. Per Claude Code docs, MEMORY.md is for "learnings and patterns" not ephemeral data. The date will become stale in future sessions. This appears to have been injected by the system, not curated.
- **Evidence**: MEMORY.md lines 41-42: `# currentDate\nToday's date is 2026-03-01.` (duplicated).
- **Severity**: Low -- stale date in memory; will need manual cleanup

### E8. Orchestrator Rule Uses paths Frontmatter But Is Not Agent-Scoped

- **Files involved**: `.claude/rules/orchestrator.md`
- **Description**: Per Claude Code docs, `.claude/rules/` files with `paths` frontmatter are "path-specific rules" that only load when Claude works with matching files. The orchestrator rule has `paths: [CLAUDE.md, README.md, docs/**, contracts/**, .claude/rules/**, .claude/skills/**]`. This means the orchestrator enforcement rules only load when editing those specific files, NOT when the orchestrator agent is running on other tasks. This is a misuse of the `paths` field -- it should load for the orchestrator role, not for file paths.
- **Evidence**: orchestrator.md frontmatter: `paths: [CLAUDE.md, ...]`. Per docs, `paths` filters by files Claude is working with, not by agent identity. The rule content describes orchestrator behavior but only loads when editing meta files.
- **Severity**: Medium -- the rule's scope is file-based when it should be role-based; orchestrator enforcement is missing when editing non-meta files

### E9. Global CLAUDE.md (~/.claude/CLAUDE.md) Partially Redundant with Project CLAUDE.md

- **Files involved**: `~/.claude/CLAUDE.md`, `CLAUDE.md`
- **Description**: The global CLAUDE.md has 3 rules: (1) write tests before implementing, (2) never push without permission, (3) check cyclomatic complexity. Rule 1 is already covered by TDD requirements in CLAUDE.md. Rule 3 is already covered by the CC <= 5 requirement in CLAUDE.md. Only rule 2 (no push without permission) adds unique value. Per docs, user-level CLAUDE.md is for "personal preferences for all projects" -- rules 1 and 3 are project-specific concerns that duplicate project CLAUDE.md.
- **Evidence**: Global: "Before implementing any new behaviors or bug fixes, write tests for them." Project CLAUDE.md: "TDD required -- Step 3 uses @tdd-build skill." Global: "check its cyclomatic complexity and report if it exceeds 5." Project: "Cyclomatic complexity cap: CC <= 5 per function."
- **Severity**: Low -- the global rules are more general versions of project-specific rules; they don't conflict but do consume context tokens

---

## Cross-Reference Matrix

The following matrix shows which governance files reference each other, highlighting dependency chains and potential circular references.

| Source File | References To | Referenced By |
|-------------|--------------|---------------|
| `CLAUDE.md` | workflow.md, hitl-gates.md, coordination-protocol.md, agents/, skills/ | All agents, all skills, MEMORY.md |
| `workflow.md` | hitl-gates.md, all skills | CLAUDE.md, design-pipeline, tdd-build, code-review |
| `hitl-gates.md` | workflow steps | workflow.md, design-pipeline, tdd-build, commit, phase-gate, orchestrator agent, debugger agent |
| `coordination-protocol.md` | Teams, Redis, worktrees | CLAUDE.md |
| `orchestrator.md` (rule) | CLAUDE.md, hitl-gates.md | (path-scoped, loads on meta file edits) |
| `orchestrator.md` (agent) | hitl-gates.md, contract-update skill | CLAUDE.md roles table |
| `design-pipeline` skill | diagram-builder, task-breakdown, code-review, tdd-build | workflow.md, CLAUDE.md |
| `tdd-build` skill | testing, feature-completion, design-pipeline | workflow.md, CLAUDE.md |
| `code-review` skill | security-review, testing, feature-completion, design-pipeline | workflow.md, CLAUDE.md |
| `feature-completion` skill | tdd-build, code-review, testing, commit | workflow.md, CLAUDE.md |
| `commit` skill | feature-completion, phase-gate | workflow.md, CLAUDE.md |
| `testing` skill | tdd-build, feature-completion | workflow.md, CLAUDE.md, feature-completion |
| `deploy` skill | testing | workflow.md, CLAUDE.md |
| `phase-gate` skill | feature-completion, commit, testing | workflow.md, CLAUDE.md |
| `require-workitem.sh` | .workitems/ directory | settings.json PreToolUse |
| `enforce-tdd-separation.sh` | /tmp marker files | settings.json PreToolUse |
| `block-dangerous-commands.sh` | (self-contained) | settings.json PreToolUse |
| `auto-lint.sh` | ruff | settings.json PostToolUse |
| `check-workitems-length.sh` | .workitems/ directory | settings.json PostToolUse |
| `session-start.sh` | git, .workitems/ | settings.json SessionStart |

### Circular/Missing References

- **design-pipeline** references `@code-review` for review stages but code-review is a separate workflow step (step 4). During design pipeline, the reviewer agent is used directly, not via the code-review skill.
- **hitl-gates.md** is referenced by 7+ files but has no back-references to know which files depend on it.
- **No file references** `apps/workflow-studio/` -- the active codebase has zero governance coverage.
- **orchestrator rule** (`orchestrator.md` in rules/) and **orchestrator agent** (`orchestrator.md` in agents/) have the same filename but different content and purposes. The rule is path-scoped; the agent is role-scoped.

---

## Priority Summary

### Critical (must address)
1. **D8**: `apps/workflow-studio/` has no agent ownership or coding standards
2. **D1**: Agent path restrictions have no hook enforcement
3. **D2**: Refactor revert gate promises action it cannot deliver

### High (should address)
4. **A2**: Hook blocks commands that permissions allow (pkill/kill)
5. **A6**: TypeScript coding standards omit major codebase
6. **D3**: require-workitem.sh validates existence of ANY workitem, not the correct one
7. **E2**: Most agents lack disallowedTools, allowing tool inheritance leakage
8. **E5**: code-review skill allowed-tools excludes Bash but body requires it

### Medium (track and address)
9. **A1**: Co-Authored-By model version mismatch
10. **A5**: Orchestrator rule paths missing agents/ and hooks/
11. **B1**: HITL gates defined in 3-5 files each
12. **B7**: Guardrails boilerplate repeated 8 times
13. **D5**: "Plan before code" rule partially enforced
14. **D6**: Protected Path Commit gate has no hook
15. **D7**: "Review findings become issues" rule has no enforcement
16. **D11**: Contract Change gate has no hook enforcement
17. **E6**: Stop hook lacks stop_hook_active guard (infinite loop risk)
18. **E8**: Orchestrator rule uses file-scoped paths when it needs role-scoping
