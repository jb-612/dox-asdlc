# Claude Code Governance Review -- Final Report

## Executive Summary

This project uses Claude Code governance mechanisms extensively: 6 hooks (SessionStart, PreToolUse x2, PostToolUse x2, Stop), 13 skills, 8 custom agents, 4 rules files, settings.json with hook wiring, and a layered CLAUDE.md + MEMORY.md system. The governance design is architecturally sound -- hooks enforce deterministic checks, skills use `context: fork` and `disable-model-invocation` correctly, agents have appropriate tool allowlists, and rules use path-scoping for conditional loading. However, this review uncovered a critical finding that R1 missed entirely: **all 5 hook scripts reference `.input.command` / `.input.file_path` instead of the documented `.tool_input.command` / `.tool_input.file_path` field names**, which may cause hooks to silently no-op depending on the Claude Code version. The Stop hook lacks the documented `stop_hook_active` infinite-loop guard, and several skills omit `argument-hint` and `user-invocable` fields that would improve discoverability and prevent unintended invocation.

## Methodology

### Documentation Sources Consulted

- [Hooks reference](https://code.claude.com/docs/en/hooks) -- all 16 hook events, matcher syntax, exit codes, `stop_hook_active`, JSON input/output schema, `type: command` vs `type: prompt` vs `type: agent`
- [Skills](https://code.claude.com/docs/en/skills) -- full frontmatter reference (`name`, `description`, `allowed-tools`, `argument-hint`, `user-invocable`, `disable-model-invocation`, `context`, `agent`, `model`, `hooks`), `$ARGUMENTS` substitution, invocation control matrix
- [Custom subagents](https://code.claude.com/docs/en/sub-agents) -- all frontmatter fields (`name`, `description`, `tools`, `disallowedTools`, `model`, `permissionMode`, `maxTurns`, `skills`, `mcpServers`, `hooks`, `memory`, `background`, `isolation`), tool inheritance behavior
- [Memory](https://code.claude.com/docs/en/memory) -- CLAUDE.md layering (global > project > directory), `.claude/rules/` path-scoped loading, MEMORY.md auto-memory (200-line limit)
- [Settings](https://code.claude.com/docs/en/settings) -- hook configuration format, `env` vars, `settings.local.json` purpose (personal tweaks, gitignored)

### Files Reviewed

- `.claude/settings.json` (75 lines)
- `.claude/settings.local.json` (259 lines, 252 permission entries)
- `.claude/rules/orchestrator.md`, `coordination-protocol.md`, `hitl-gates.md`, `workflow.md` (4 rules files)
- `.claude/agents/backend.md`, `frontend.md`, `orchestrator.md`, `planner.md`, `reviewer.md`, `test-writer.md`, `debugger.md`, `devops.md` (8 agent files)
- `.claude/skills/*/SKILL.md` (13 skill files)
- `.claude/hooks/*.sh` (6 hook scripts)
- `/Users/jbellish/VSProjects/dox-asdlc/CLAUDE.md` (project instructions)
- `/Users/jbellish/.claude/CLAUDE.md` (global instructions)
- `/Users/jbellish/.claude/projects/-Users-jbellish-VSProjects-dox-asdlc/memory/MEMORY.md` (auto-memory)
- `.workitems/SDLC-REVIEW-FINAL.md` (R1 findings)

---

## Hooks Assessment

### Verified Issues

**NEW -- CRITICAL: All Hook Scripts Use Wrong JSON Field Names**

Every hook script in `.claude/hooks/` references `.input.command` or `.input.file_path` to extract tool parameters from stdin JSON. Per the official Claude Code documentation, the correct field names are `.tool_input.command` and `.tool_input.file_path`. This affects all 5 scripts that parse tool input:

| Script | Uses | Docs Say |
|--------|------|----------|
| `block-dangerous-commands.sh` line 6 | `.input.command` | `.tool_input.command` |
| `require-workitem.sh` line 7 | `.input.file_path` | `.tool_input.file_path` |
| `require-workitem.sh` line 6 | `.tool` | `.tool_name` |
| `enforce-tdd-separation.sh` line 6 | `.input.file_path` | `.tool_input.file_path` |
| `auto-lint.sh` line 6 | `.input.file_path` | `.tool_input.file_path` |
| `check-workitems-length.sh` line 6 | `.input.file_path` | `.tool_input.file_path` |

Every script guards empty extractions with `[[ -z "$..." ]] && exit 0`, which means if the field names are wrong, jq returns empty, the guard fires, the script exits 0, and the hook silently becomes a no-op. The block-dangerous-commands hook would never block anything. The require-workitem hook would never enforce workitem requirements. The TDD separation hook would never enforce role boundaries.

There are two possibilities: (1) Claude Code sends both `.input` and `.tool_input` for backward compatibility, in which case the hooks work but use deprecated field names. (2) Claude Code only sends `.tool_input`, in which case all hooks are no-ops. The official documentation consistently uses `.tool_input` in every example and reference table. This finding was **not identified by R1** and is potentially the highest-severity governance issue in the project.

**Evidence**: The official docs example (`block-rm.sh`) uses `COMMAND=$(jq -r '.tool_input.command')`. The project's `block-dangerous-commands.sh` uses `COMMAND=$(echo "$INPUT" | jq -r '.input.command // empty')`.

**Recommendation**: Test by adding `echo "$INPUT" > /tmp/hook-debug.json` at the top of any hook script, triggering the hook, and inspecting the actual JSON structure. If `.tool_input` is the correct field, update all 5 scripts immediately.

**F-03 CONFIRMED: Stop Hook Missing `stop_hook_active` Guard**

The Stop hook in `settings.json` (lines 59-68) is `type: "prompt"`. Per the official docs (Stop hook section): "The `stop_hook_active` field is `true` when Claude Code is already continuing as a result of a stop hook. Check this value or process the transcript to prevent Claude Code from running indefinitely."

The current prompt text does not reference `stop_hook_active`. If the prompt determines workflow steps were skipped and returns a decision to block stopping, Claude will continue, trigger Stop again, and the same prompt will re-evaluate -- creating an infinite loop.

The docs explicitly say: "Stop hooks do not support matchers and always fire on every occurrence." The Stop hook's JSON input includes `stop_hook_active` as a boolean field. A `type: "prompt"` hook cannot directly read stdin JSON the way a command hook can. The prompt would need to instruct the model to check for `stop_hook_active` in the input context, or this should be converted to a `type: "command"` hook that reads the field from stdin.

**Recommendation**: Convert to a `type: "command"` hook that: (1) reads `stop_hook_active` from stdin JSON, (2) if true, exits 0 immediately, (3) if false, performs the workflow validation logic.

**F-13 CONFIRMED: SessionStart Hook Matcher Only `startup`**

The SessionStart hook uses `matcher: "startup"`. Per the docs, valid matchers for SessionStart are: `startup`, `resume`, `clear`, `compact`. The current configuration means the session banner will not display after `/resume`, `/clear`, or compaction events.

This is an intentional design choice per R1's assessment, but is worth noting for completeness. After context compaction (which can happen automatically when the context window fills), the session orientation information is lost and not re-displayed. Adding `compact` as a matcher would restore context after compaction.

### Best Practice Gaps

1. **No `$CLAUDE_PROJECT_DIR` in hook commands**: The `settings.json` hook commands reference `.claude/hooks/session-start.sh` as a relative path. The docs recommend using `"$CLAUDE_PROJECT_DIR"/.claude/hooks/session-start.sh` to handle path resolution correctly regardless of working directory. While relative paths may work in practice if the cwd is always the project root, the documented best practice is to use the environment variable.

2. **No PostToolUseFailure hooks**: The project has PostToolUse hooks but no PostToolUseFailure hooks. PostToolUseFailure fires when a tool execution fails and could provide useful diagnostic context (e.g., logging failed edits or failed bash commands).

3. **No PermissionRequest hooks**: The project could benefit from PermissionRequest hooks to auto-approve repetitive safe operations (like `npm test` or `pytest`) instead of relying on the growing `settings.local.json` permission list.

4. **Timeout values are conservative but reasonable**: SessionStart timeout is 5000ms (5s), PreToolUse/PostToolUse are 3000ms (3s). The default for command hooks is 600s (10 minutes). The chosen values are appropriate for fast-running validation scripts.

### Score: 2/5

The field name mismatch is potentially a show-stopper that could render all hooks inoperative. Even if Claude Code supports the deprecated `.input` field names, the project is using undocumented API surface that could break in any update. The Stop hook infinite loop risk compounds this. Without verifying the actual JSON field names, confidence in hook effectiveness is low.

---

## Skills Assessment

### Verified Issues

**F-05 CONFIRMED: code-review Skill `allowed-tools` Excludes Bash But Body Requires It**

`code-review/SKILL.md` frontmatter: `allowed-tools: Read, Glob, Grep`. The skill body references running `./tools/complexity.sh --threshold 5` (line 41) and `gh issue create` (line 63), both requiring Bash.

Per the docs: "allowed-tools -- Tools Claude can use without asking permission when this skill is active." This field controls permission grants, not tool availability. Since the skill uses `context: fork` with `agent: reviewer`, and the reviewer agent has `tools: Read, Grep, Glob, Bash`, Bash IS available to the agent. However, without Bash in `allowed-tools`, every Bash invocation during a code review will prompt for permission, degrading the user experience.

The same issue applies to `security-review/SKILL.md` which has `allowed-tools: Read, Glob, Grep, Bash` -- this one is correct and shows the intended pattern.

**Recommendation**: Add `Bash` to code-review's `allowed-tools`: `allowed-tools: Read, Glob, Grep, Bash`.

**F-15 CONFIRMED: Skills Missing `argument-hint` and `user-invocable` Fields**

No skill in the project uses `argument-hint`. Per the docs: "Hint shown during autocomplete to indicate expected arguments. Example: `[issue-number]` or `[filename] [format]`."

Skills that take `$ARGUMENTS` and would benefit from `argument-hint`:

| Skill | Suggested `argument-hint` |
|-------|--------------------------|
| `commit` | `[feature-id]` |
| `deploy` | `[environment-tier]` |
| `tdd-build` | `[feature-id/task-id]` |
| `design-pipeline` | `[feature-id]` |
| `code-review` | `[scope or file-path]` |
| `feature-completion` | `[feature-id]` |
| `phase-gate` | `[phase-number]` |
| `contract-update` | `[contract-name]` |
| `task-breakdown` | `[feature-id]` |
| `security-review` | `[scope or file-path]` |
| `testing` | `[scope or test-path]` |

Three skills are sub-skills invoked by other skills but lack `user-invocable: false`:
- `task-breakdown` -- invoked by `design-pipeline` at Stage 8
- `diagram-builder` -- auto-invoked during planning
- `security-review` -- invoked by `code-review`

Per the docs: "Set [user-invocable] to `false` to hide from the `/` menu. Use for background knowledge users shouldn't invoke directly."

These sub-skills ARE usable standalone (task-breakdown and security-review explicitly say "standalone when..."), so marking them `user-invocable: false` may be too restrictive. However, the docs' invocation control matrix shows that `user-invocable: false` means "Only Claude can invoke the skill" -- meaning the user cannot use `/task-breakdown` but Claude can still load it. Since these skills are useful both standalone and as sub-skills, leaving `user-invocable` as default (true) is arguably correct.

### Best Practice Gaps

1. **No `hooks` field usage in skills**: Skills support frontmatter `hooks` for lifecycle events scoped to the skill. None of the 13 skills use this feature. For example, the `commit` skill could benefit from a `Stop` hook that verifies the commit was actually made, or `tdd-build` could use a `PostToolUse` hook to verify test results after Bash executions.

2. **No `model` field usage in skills**: No skill overrides the model. For skills like `code-review` (which needs careful analysis) or `testing` (which could use a faster model), specifying `model` could optimize cost/quality tradeoffs.

3. **`context: fork` usage is well-targeted**: Only `code-review` and `security-review` use `context: fork` with `agent: reviewer`. This is correct -- these are read-only review tasks that benefit from isolated context.

4. **`disable-model-invocation` usage is appropriate**: `commit`, `deploy`, `feature-completion`, `phase-gate`, and `contract-update` all use `disable-model-invocation: true`. These are workflow-step skills with side effects that should only be invoked manually. This follows the documented best practice.

### Score: 4/5

Skills are well-designed overall. The `allowed-tools` gap in code-review is functional (Bash still works via agent inheritance) but creates unnecessary permission prompts. The missing `argument-hint` fields are a UX polish item. The `disable-model-invocation` and `context: fork` usage demonstrates good understanding of the skill framework.

---

## Agents Assessment

### Verified Issues

**E2 Dismissal CONFIRMED: `tools` vs `disallowedTools` Interaction is Correctly Understood**

R1 finding E2 claimed most agents lack `disallowedTools`. The R1 dismissal in the final report correctly explains: when `tools` is specified as an allowlist, only those tools are available. `disallowedTools` is a denylist applied on top of the inherited or specified list.

Two agents use both `tools` AND `disallowedTools`:
- `reviewer.md`: `tools: Read, Grep, Glob, Bash` + `disallowedTools: Write, Edit`
- `test-writer.md`: `tools: Read, Write, Edit, Bash, Glob, Grep` + `disallowedTools: MultiEdit, NotebookEdit, Task, WebFetch, WebSearch`

Per the docs: "`disallowedTools` -- Tools to deny, removed from inherited or specified list." For the reviewer, `Write` and `Edit` are NOT in the `tools` list, so `disallowedTools` is redundant. This is belt-and-suspenders -- not harmful but not necessary. For the test-writer, the `disallowedTools` items (`MultiEdit`, `NotebookEdit`, `Task`, `WebFetch`, `WebSearch`) are also not in the `tools` list, making `disallowedTools` equally redundant.

**Recommendation**: The redundancy is harmless and provides defense-in-depth. No change needed, but documenting the rationale would help future maintainers understand the intent.

### Best Practice Gaps

1. **No `maxTurns` specified**: None of the 8 agents use `maxTurns`. Per the docs: "Maximum number of agentic turns before the subagent stops." Without this, agents could run indefinitely. For the reviewer and debugger (read-only agents), a `maxTurns: 50` would prevent runaway analysis. For the orchestrator, a higher limit would be appropriate.

2. **No `memory` field usage**: No agent uses persistent memory (`memory: user|project|local`). Per the docs, this enables cross-session learning. The reviewer agent could benefit from `memory: project` to accumulate knowledge about code patterns and recurring issues across reviews.

3. **No `permissionMode` specified**: All agents inherit the default permission mode. For the reviewer and debugger (read-only agents), `permissionMode: "plan"` would be appropriate since they should not make changes. For the devops agent, `permissionMode: "bypassPermissions"` might be appropriate in container contexts per its own documentation.

4. **No `background` field usage**: No agent uses `background: true`. The reviewer and debugger agents could run as background tasks to avoid blocking the main conversation.

5. **Agent `description` fields are well-written**: All agents include "Use proactively" or similar phrasing that encourages Claude to delegate tasks automatically. This follows the documented best practice.

6. **No `skills` preloading**: No agent uses the `skills` field to preload domain-specific skills. For example, the orchestrator agent could preload `commit` and `contract-update` skills.

### Score: 4/5

Agent definitions are solid with correct tool allowlists and appropriate descriptions. The `tools` + `disallowedTools` redundancy in reviewer and test-writer is harmless defense-in-depth. The missing `maxTurns`, `memory`, and `permissionMode` fields represent unused features that could add value. Overall, agents follow documented patterns correctly.

---

## Rules Assessment

### Verified Issues

**F-06 CONFIRMED: Orchestrator Rule `paths` Frontmatter Incomplete**

`orchestrator.md` frontmatter:
```yaml
paths:
  - CLAUDE.md
  - README.md
  - docs/**
  - contracts/**
  - .claude/rules/**
  - .claude/skills/**
```

Missing paths that the orchestrator agent claims exclusive ownership of (per agent definition line 14-15):
- `.claude/agents/**`
- `.claude/hooks/**`

Per the docs: "Rules without paths frontmatter are loaded at launch with the same priority as .claude/CLAUDE.md. These conditional rules only apply when Claude works with files matching the specified patterns."

This means when editing `.claude/agents/*.md` or `.claude/hooks/*.sh` files, the orchestrator's exclusive ownership rules are NOT loaded into context. Another agent could modify these files without seeing the warning about META_CHANGE_REQUEST.

**Recommendation**: Add `.claude/agents/**` and `.claude/hooks/**` to the `paths` frontmatter. Also consider adding `.claude/settings.json` since that is also a meta file.

### Best Practice Gaps

1. **No `description` field in 3 of 4 rules**: Only `orchestrator.md` has a `description` field. Per the docs, the `description` field helps Claude understand when the rule applies. The other rules (`coordination-protocol.md`, `hitl-gates.md`, `workflow.md`) have no frontmatter at all -- they are loaded unconditionally at session start.

2. **Rules that could benefit from path-scoping but are not scoped**:
   - `coordination-protocol.md` -- applies to multi-session work, could be scoped to `scripts/coordination/**` or similar, but it is needed as general context. Loading unconditionally is correct.
   - `hitl-gates.md` -- HITL gate specs are needed globally since gates can trigger at any step. Loading unconditionally is correct.
   - `workflow.md` -- workflow steps are needed globally. Loading unconditionally is correct.

3. **Rules directory structure is flat**: All 4 rules are in `.claude/rules/` at the top level. This is fine for 4 files. If the count grows, subdirectories (`frontend/`, `backend/`) could organize rules by domain.

4. **YAML quoting**: The `paths` values in `orchestrator.md` do not use quoted strings. Per a known Claude Code issue (#13905), glob patterns starting with `{` or `*` should be quoted. Current patterns (`CLAUDE.md`, `docs/**`) do not start with special YAML characters, so this is not an issue, but future additions should use quotes.

### Score: 3/5

The rules framework is underutilized. Only 1 of 4 rules uses path-scoping, and only 1 has a `description` field. The orchestrator rule has an incomplete paths scope. The unconditionally-loaded rules are appropriate for their content (workflow, HITL gates, coordination are always relevant). The primary gap is the orchestrator rule's missing paths.

---

## Settings Assessment

### Verified Issues

**F-10 CONFIRMED: Hook Blocks What `settings.local.json` Permits**

The `block-dangerous-commands.sh` hook blocks `pkill` and `killall` (line 27). `settings.local.json` explicitly permits `Bash(pkill:*)` (line 120) and `Bash(xargs kill:*)` (line 108).

Per the docs, `settings.local.json` permissions control whether Claude is prompted for approval. Hooks run after permission is granted but before execution (for PreToolUse). The behavior is:
1. Claude proposes `pkill someprocess`
2. Permission check: `settings.local.json` says allow -- no prompt shown
3. PreToolUse hook runs: `block-dangerous-commands.sh` sees `pkill` and exits 2
4. Tool call is blocked

This is defense-in-depth, not a conflict. But it creates a confusing UX where the user explicitly permitted `pkill` yet it gets blocked. R1's assessment that this is a "conflict" overstated the issue.

**Recommendation**: Decide on a single enforcement point. If `pkill` should be blocked, remove `Bash(pkill:*)` from `settings.local.json`. If it should be allowed, remove the `pkill` pattern from the hook.

**N-03 CONFIRMED: `settings.local.json` Has 252 Accumulated Permissions**

The `settings.local.json` contains 252 permission entries in the `allow` array (lines 3-254). Many are clearly one-off approvals accumulated over time:

- `Bash(for f in P12-F01-tdd-separation P12-F02-token-budget-circuit-breaker...` (line 208) -- a specific loop command
- `Bash({\"session_id\": \"test-rename-005\"...` (line 154) -- a specific JSON payload
- `Bash(do sleep:*)` (line 153) -- a fragment
- `Bash(while ps aux)` (line 152) -- a loop fragment
- `Bash(__NEW_LINE_9b531002782a6ef0__ echo "")` (line 110) -- a newline-encoded command
- `Bash(EOF)` (line 155) -- a heredoc terminator

Per the docs, `settings.local.json` is "for personal tweaks within a project, ignored by Git." While having many entries is not a technical problem, the accumulation of one-off command approvals creates a wide permission surface. Some entries (like `Bash(kill:*)`, `Bash(pkill:*)`) are intentionally broad; others are clearly artifacts.

**Recommendation**: Periodically audit and prune this file. Group entries logically (development tools, CI/CD, infrastructure, coordination). Remove entries that are clearly one-off commands.

### Best Practice Gaps

1. **`settings.json` hook commands use relative paths**: All hook commands in `settings.json` use relative paths (e.g., `.claude/hooks/session-start.sh`). The docs recommend `"$CLAUDE_PROJECT_DIR"/.claude/hooks/session-start.sh` for reliable path resolution.

2. **No `permissions.deny` in `settings.json`**: The project uses only `permissions.allow` in `settings.local.json`. The team-shared `settings.json` could benefit from explicit `permissions.deny` entries for dangerous patterns (e.g., denying `Agent(devops)` from being spawned without PM CLI approval).

3. **`enableAllProjectMcpServers: true`** in `settings.json` is a broad permission. This auto-enables all MCP servers defined in the project, including any new ones added later. A more restrictive approach would be to list specific servers.

4. **`env` section is minimal and correct**: `PYTHONPATH: "."` and `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "1"` are both appropriate.

### Score: 3/5

The hook configuration in `settings.json` is well-structured with appropriate matchers and timeouts. The `settings.local.json` has accumulated significant cruft (252 permissions including command fragments and one-off approvals). The relative path usage for hook commands is functional but not per documented best practice. The `enableAllProjectMcpServers: true` is overly permissive.

---

## CLAUDE.md Assessment

### Verified Issues

No R1 governance-only findings specifically target CLAUDE.md structure (F-01 about workflow-studio coverage is a content gap, not a structural issue).

### Best Practice Gaps

1. **Content that could be in `.claude/rules/`**: The "Coding Standards" section in CLAUDE.md is ~15 lines covering Python, TypeScript, Bash, and Tests. This could be split into path-scoped rules:
   - `.claude/rules/python-standards.md` with `paths: ["src/**/*.py", "tests/**/*.py"]`
   - `.claude/rules/typescript-standards.md` with `paths: ["docker/hitl-ui/**/*.ts", "apps/**/*.ts"]`
   - `.claude/rules/bash-standards.md` with `paths: ["tools/**/*.sh", "scripts/**/*.sh"]`

   This would load language-specific standards only when relevant, reducing context window usage.

2. **CLAUDE.md is reasonably sized**: At approximately 100 lines, it is well within the recommended bounds. It covers roles, paths, standards, skills, and related docs without excessive detail.

3. **Global vs project CLAUDE.md split is appropriate**: The global `~/.claude/CLAUDE.md` contains 3 personal preferences (write tests first, never push without asking, check cyclomatic complexity). These are cross-project preferences that correctly live at the global level.

4. **Layering is correct**: Global CLAUDE.md provides general development preferences. Project CLAUDE.md provides aSDLC-specific governance. The `.claude/rules/` directory provides path-scoped and domain-specific rules. MEMORY.md provides learned patterns. This layering follows the documented hierarchy.

### Score: 4/5

CLAUDE.md is well-structured and appropriately sized. The content organization follows documented best practices. The main improvement opportunity is extracting coding standards into path-scoped rules to reduce context window usage, but this is an optimization rather than a deficiency.

---

## Memory Assessment

### Verified Issues

**F-14 CONFIRMED: MEMORY.md Contains Stale System-Injected Dates**

MEMORY.md contains duplicate `# currentDate` entries:
```
# currentDate
Today's date is 2026-03-01.

# currentDate
Today's date is 2026-03-01.
```

Per the docs, MEMORY.md is limited to 200 lines and is read at the start of every session. These 4 lines of duplicate date stamps waste 2% of the memory budget on ephemeral data that should not be persisted.

**Recommendation**: Remove both `# currentDate` entries. The current date is available via system context and does not need to be stored in MEMORY.md.

### Best Practice Gaps

1. **Some MEMORY.md content belongs in CLAUDE.md**: The "Key Architecture Patterns" section contains stable architectural decisions (e.g., "ExecutionEngine dispatches by backend type (claude/cursor/codex), NOT by blockType"). If these are permanent project constraints, they belong in CLAUDE.md or a `.claude/rules/architecture.md` file, not in auto-memory which is meant for evolving learnings.

2. **Some MEMORY.md content is session-specific**: The "P15 Phase 3 Status" section tracks current work progress ("Next step: TDD Build starting with F14"). This is appropriate for MEMORY.md as it changes across sessions.

3. **"LLM Response Parsing" entry**: The note about LLMs wrapping JSON in prose text is a workaround that should be in CLAUDE.md if it's a permanent coding pattern, or in MEMORY.md if it's a temporary issue.

4. **"Docker/Compose" entries**: Notes about `LLM_CONFIG_ENCRYPTION_KEY` and port mappings are operational knowledge appropriate for MEMORY.md.

5. **MEMORY.md is at approximately 50 lines**: Well within the 200-line limit, leaving room for growth.

### Score: 3/5

MEMORY.md contains a mix of appropriate session learnings and content that would be better placed in CLAUDE.md or rules files. The stale date entries should be removed. The architecture pattern notes could graduate to more permanent homes as the project stabilizes.

---

## R1 Finding Verification

### F-03: Stop Hook Missing `stop_hook_active` Guard
**Status: CONFIRMED**

The Stop hook in `settings.json` is `type: "prompt"` and does not reference `stop_hook_active`. Per the official docs, the Stop hook input includes `stop_hook_active: true|false` and "Check this value or process the transcript to prevent Claude Code from running indefinitely." The risk of infinite loops at session end is real.

Additionally, the docs state that Stop hooks "do not support matchers and always fire on every occurrence" -- the project correctly does not specify a matcher for the Stop hook.

### F-05: code-review Skill `allowed-tools` Excludes Bash But Body Requires It
**Status: CONFIRMED**

`allowed-tools: Read, Glob, Grep` omits Bash, but the skill body requires running `./tools/complexity.sh` and `gh issue create`. The skill uses `context: fork` with `agent: reviewer`, and the reviewer agent includes Bash in its `tools` list, so Bash is technically available. However, without Bash in the skill's `allowed-tools`, each Bash invocation will trigger a permission prompt, degrading the review experience.

### F-06: Orchestrator Rule `paths` Frontmatter Incomplete
**Status: CONFIRMED**

The `paths` list omits `.claude/agents/**` and `.claude/hooks/**` despite the orchestrator agent claiming exclusive ownership of these paths. When editing agent or hook files, the orchestrator's exclusive ownership rules will not load into context.

### F-10: Hook Blocks What `settings.local.json` Permits
**Status: CONFIRMED (with nuance)**

This is defense-in-depth, not a conflict. The hook runs after permission is granted, providing a second layer of protection. The UX is confusing but the behavior is safe. R1 correctly identified the issue but overstated it as a "conflict."

### F-13: SessionStart Hook Matcher Only `startup`
**Status: CONFIRMED (intentional design)**

Valid matchers are `startup`, `resume`, `clear`, `compact`. Using only `startup` means the session banner is not re-displayed after compaction. This is a deliberate choice. Adding `compact` could help restore orientation after automatic context compaction.

### F-14: MEMORY.md Contains Stale System-Injected Dates
**Status: CONFIRMED**

Duplicate `# currentDate` entries waste memory budget on ephemeral data. Should be removed.

### F-15: Skills Missing `argument-hint` and `user-invocable` Fields
**Status: CONFIRMED (UX polish)**

No skill uses `argument-hint`. Three sub-skills lack `user-invocable: false`, but per the docs' invocation control matrix, the default behavior (both user and Claude can invoke) is acceptable for skills that work both standalone and as sub-skills.

### N-03: `settings.local.json` Has 252 Accumulated Permissions
**Status: CONFIRMED**

252 entries including command fragments, one-off approvals, and heredoc terminators. Should be periodically audited and pruned.

### E2 Dismissal: `tools` vs `disallowedTools` in Agents
**Status: R1 DISMISSAL CORRECT**

Per the official docs, `tools` is an allowlist and `disallowedTools` is a denylist applied on top. When `tools` is specified, only those tools are available. The reviewer's `disallowedTools: Write, Edit` is redundant since those tools are not in its `tools` list, but this is harmless defense-in-depth. R1's dismissal reasoning is accurate.

---

## Priority Action Items

| Priority | Issue | Category | Action | Effort |
|----------|-------|----------|--------|--------|
| 1 | **Hook JSON field names** | Hooks | Verify actual JSON structure by adding debug logging; update all 5 scripts from `.input.*` to `.tool_input.*` if needed | 30 min |
| 2 | F-03: Stop hook `stop_hook_active` | Hooks | Convert to `type: "command"` hook that reads `stop_hook_active` from stdin JSON | 1 hour |
| 3 | F-05: code-review `allowed-tools` | Skills | Add `Bash` to `allowed-tools` in code-review/SKILL.md | 2 min |
| 4 | F-06: Orchestrator rule paths | Rules | Add `.claude/agents/**`, `.claude/hooks/**` to `paths` frontmatter | 2 min |
| 5 | F-14: MEMORY.md stale dates | Memory | Remove duplicate `# currentDate` entries | 2 min |
| 6 | F-15: Skills `argument-hint` | Skills | Add `argument-hint` to all 11 skills that accept `$ARGUMENTS` | 15 min |
| 7 | F-10: Permission vs hook conflict | Settings | Remove `Bash(pkill:*)` from `settings.local.json` or remove `pkill` pattern from hook | 5 min |
| 8 | N-03: `settings.local.json` cruft | Settings | Audit and prune one-off permission entries | 1 hour |
| 9 | Hook path references | Settings | Update `settings.json` hook commands to use `"$CLAUDE_PROJECT_DIR"` prefix | 10 min |
| 10 | Agent `maxTurns` | Agents | Add `maxTurns` to all 8 agent definitions to prevent runaway execution | 15 min |

---

## Overall Governance Score: 3/5

The project demonstrates strong understanding of Claude Code's governance mechanisms -- skills use `context: fork` and `disable-model-invocation` correctly, agents use tool allowlists appropriately, rules use path-scoping for conditional loading, and the settings/hooks integration is well-structured. The architecture is sound.

However, the potential hook JSON field name mismatch is a critical risk that could render all 5 hook scripts non-functional. If confirmed, this means the project has been operating without any of its deterministic hook enforcement (dangerous command blocking, workitem validation, TDD separation, auto-linting, workitem length checks). Combined with the Stop hook infinite loop risk and the accumulated `settings.local.json` cruft, the operational reliability of the governance system is uncertain until the field names are verified and corrected.

If the hooks are confirmed working (i.e., Claude Code accepts `.input` as an alias for `.tool_input`), the score would be **4/5** with only minor gaps in skill frontmatter completeness and rules path-scoping.
