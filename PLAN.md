# Plan: Reorganize Scripts into Skills + Deduplicate Docs

## Status: DRAFT — Awaiting approval

## Design Principle: Three-Layer Model

| Layer | Purpose | Example |
|-------|---------|---------|
| **CLAUDE.md** | Index/entrypoint — brief tables, pointers | "See `.claude/skills/testing/` for quality gates" |
| **Rules** (`.claude/rules/`) | Constraints — "what must be true" | "Tests must pass before commit" |
| **Skills** (`.claude/skills/`) | Procedures — "how to do X" + bundled scripts | Step-by-step TDD with `test.sh` |

**No content lives in two places.** If a skill explains how to do TDD, the rule only
says "TDD is required" and points to the skill. If CLAUDE.md lists commands, it
points to the skill that owns them.

---

## Part 1: Script Reorganization

### Approach

Move domain scripts INTO skill `scripts/` subdirectories. Original locations
become thin forwarding wrappers (one-liners) so existing references keep working.

### Guardrails Respected

| Guardrail | How We Respect It |
|-----------|-------------------|
| `.claude/skills/**` is orchestrator-exclusive | Only orchestrator modifies; plan approved first |
| CLAUDE.md references `scripts/` and `tools/` | Forwarding wrappers at original paths |
| `tools/lib/` shared parsers | Stay in place; moved scripts resolve via `$SCRIPT_DIR` |
| `hooks/startup.sh` calls coordination scripts | Coordination scripts don't move |
| `scripts/worktree/` session lifecycle | Don't move (infrastructure) |

### What Moves

| Script | From | To (skill) |
|--------|------|-----------|
| `test.sh` | `tools/` | `testing/scripts/` |
| `lint.sh` | `tools/` | `testing/scripts/` |
| `sast.sh` | `tools/` | `testing/scripts/` |
| `sca.sh` | `tools/` | `testing/scripts/` |
| `e2e.sh` | `tools/` | `testing/scripts/` |
| `ast.sh` | `tools/` | `code-review/scripts/` |
| `deploy-cloud-run.sh` | `scripts/gcp/` | `deploy/scripts/` |
| `deploy.sh` | `scripts/k8s/` | `deploy/scripts/deploy-k8s.sh` |
| `teardown.sh` | `scripts/k8s/` | `deploy/scripts/teardown-k8s.sh` |
| `build-images.sh` | `scripts/` | `deploy/scripts/` |
| `new-feature.sh` | `scripts/` | `feature-planning/scripts/` |
| `check-planning.sh` | `scripts/` | `feature-planning/scripts/` |
| `check-completion.sh` | `scripts/` | `feature-completion/scripts/` |

### What Stays (infrastructure, not skills)

- `scripts/coordination/*` — hooks infrastructure
- `scripts/worktree/*` — session lifecycle
- `scripts/start-session.sh` — worktree entry point
- `scripts/check-compliance.sh` — called by hooks
- `scripts/k8s/start-minikube.sh`, `quickstart.sh`, `port-forward-mcp.sh`, `ensure-mcp-ports.sh` — infra
- `scripts/devops/publish-progress.sh` — devops agent infra
- `tools/lib/*` — shared parsers (referenced by moved scripts via relative paths)

### Forwarding Wrappers

Each original location becomes a one-liner:

```bash
#!/usr/bin/env bash
# Forwarded — see .claude/skills/testing/scripts/test.sh
exec "$(dirname "$0")/../.claude/skills/testing/scripts/test.sh" "$@"
```

### Skill Layout (After)

```
.claude/skills/
├── testing/                          # NEW
│   ├── SKILL.md
│   └── scripts/
│       ├── test.sh, lint.sh, sast.sh, sca.sh, e2e.sh
│
├── code-review/                      # NEW
│   ├── SKILL.md
│   └── scripts/
│       └── ast.sh
│
├── deploy/                           # NEW
│   ├── SKILL.md
│   └── scripts/
│       ├── deploy-cloud-run.sh, deploy-k8s.sh
│       ├── teardown-k8s.sh, build-images.sh
│
├── feature-planning/                 # ENHANCED (add scripts/)
│   ├── SKILL.md
│   └── scripts/
│       ├── new-feature.sh, check-planning.sh
│
├── feature-completion/               # ENHANCED (add scripts/)
│   ├── SKILL.md
│   └── scripts/
│       └── check-completion.sh
│
├── tdd-execution/                    # ENHANCED (add allowed-tools)
│   └── SKILL.md
│
├── diagram-builder/                  # UNCHANGED
│   └── SKILL.md
│
└── contract-update/                  # UNCHANGED
    └── SKILL.md
```

---

## Part 2: New Skills

### `/testing` — Quality Gate Runner

```yaml
---
name: testing
description: Run quality gates — unit tests, linting, SAST, SCA, and E2E.
  Use when running tests, checking code quality, or validating before commit.
allowed-tools: Read, Glob, Grep, Bash
---
```

- **When to Use:** Running tests, pre-commit validation, quality gates
- **When NOT to Use:** Writing tests (use `@tdd-execution`)
- Read-only analysis + execution; no file editing
- Cross-refs: `@tdd-execution`, `@feature-completion`

### `/code-review` — Code Analysis

```yaml
---
name: code-review
description: Analyze code for quality, security, and standards compliance.
  Use when reviewing PRs, inspecting code, or auditing a module.
allowed-tools: Read, Glob, Grep
context: fork
agent: reviewer
---
```

- **When to Use:** PR review, security audit, code inspection
- **When NOT to Use:** Writing code or fixing issues
- Strictly read-only (no Bash, no Edit)
- Runs in forked context (isolated subagent)
- Cross-refs: `@testing`

### `/deploy` — Environment Deployment

```yaml
---
name: deploy
description: Deploy aSDLC to any environment tier — Cloud Run, K8s, or local.
  Use when deploying, updating, or tearing down environments.
disable-model-invocation: true
---
```

- User-only (`disable-model-invocation`) — never auto-triggered
- Presents environment menu, runs the matching script
- Cross-refs: `@testing` (run tests before deploy)

---

## Part 3: Deduplicate CLAUDE.md and Rules

### Principle

Each topic has ONE source of truth. Other files reference it, never repeat it.

### Duplication Removals

| Topic | Source of Truth | Remove duplication from |
|-------|----------------|------------------------|
| Work item format (3 files, design.md sections) | `feature-planning` SKILL | CLAUDE.md (replace with pointer), workflow.md step 2 |
| TDD workflow (Red-Green-Refactor steps) | `tdd-execution` SKILL | CLAUDE.md rule #2 (keep one-liner, add pointer), workflow.md step 6 |
| Commit protocol (format, co-author, who commits) | `feature-completion` SKILL | workflow.md step 9, trunk-based-dev.md (keep authority rule, remove format) |
| Role definitions table (5 places!) | CLAUDE.md Roles table | pm-cli.md, parallel-coordination.md, identity-selection.md, permissions.md |
| Path restrictions (3 places) | CLAUDE.md Path Restrictions | parallel-coordination.md, permissions.md |
| Presence/heartbeat values (60s, 5min TTL) | coordination-protocol.md | CLAUDE.md (replace 12 lines with 1-line pointer) |
| Worktree commands table (2 places) | CLAUDE.md | pm-cli.md (remove duplicate table) |
| Task visibility pattern | task-visibility.md | pm-cli.md (replace with pointer) |
| Contract change workflow | `contract-update` SKILL | orchestrator.md (replace with pointer) |
| Quality gate tools (test.sh, lint.sh paths) | `testing` SKILL | CLAUDE.md Commands section, feature-completion SKILL |

### CLAUDE.md — Target Size Reduction

**Current:** ~320 lines with significant content duplication
**Target:** ~180 lines — index/entrypoint with pointers

Specific cuts:
- Lines 85-92 (Work Item Format): Replace with "See `/feature-planning` skill"
- Lines 65-72 (Commands section): Replace script paths with skill references
- Lines 167-312 (Multi-Session Infrastructure, 145 lines): Cut to ~40 lines overview + pointers to rules
- Lines 245-256 (Presence Tracking detail): Replace with pointer to coordination-protocol.md

### Rules — Dedup Strategy

| Rule File | Change |
|-----------|--------|
| `workflow.md` | Replace step detail with skill references where skill is source of truth. Keep step structure and HITL gate references. |
| `pm-cli.md` | Remove duplicate roles table, worktree commands table, task visibility pattern. Add pointers. |
| `parallel-coordination.md` | Remove duplicate roles/paths tables. Add "See CLAUDE.md" pointers. |
| `identity-selection.md` | Consider merging into parallel-coordination.md (overlapping scope). |
| `trunk-based-development.md` | Remove commit format detail (owned by feature-completion SKILL). Keep authority rules. |
| `orchestrator.md` | Remove contract workflow steps (owned by contract-update SKILL). Keep exclusive ownership rules. |

### Conflict Fixes

| Conflict | Fix |
|----------|-----|
| CLAUDE.md says "owns" vs orchestrator.md says "EXCLUSIVE" for meta files | CLAUDE.md line 39: change to "Orchestrator **exclusively** owns meta files" |
| pm-cli.md "one task at a time" vs task-visibility.md parallel example | Clarify: one task per agent at a time; multiple agents can work in parallel |

---

## Part 4: Workflow Integration

Update `.claude/rules/workflow.md` skills table to include new skills:

| Step | Skill | Purpose |
|------|-------|---------|
| 2 | `feature-planning` | Create work item artifacts |
| 3 | `diagram-builder` | Generate Mermaid diagrams |
| 4 | `code-review` | Design review analysis |
| 6 | `tdd-execution` | Red-Green-Refactor cycle |
| 7 | `testing` | Run quality gates |
| 8 | `code-review` | Code inspection |
| 9 | `feature-completion` | Validate and complete feature |
| 10 | `deploy` | Infrastructure deployment |

Update CLAUDE.md skills table:

| Skill | Purpose |
|-------|---------|
| `feature-planning` | Create work item artifacts |
| `tdd-execution` | Red-Green-Refactor cycle |
| `feature-completion` | Validate and complete feature |
| `contract-update` | API contract changes |
| `diagram-builder` | Mermaid diagrams |
| `testing` | Quality gates (test, lint, SAST, SCA, E2E) |
| `code-review` | Code analysis and review |
| `deploy` | Environment deployment (Cloud Run, K8s) |

---

## Part 5: Chunked Documentation

### Principle

No single documentation file exceeds 200 lines. Broad concepts get a directory
with an index file and chapter files. This keeps context loads small and enables
precise cross-references.

### Structure Pattern

```
.claude/rules/<concept>/
├── README.md           # Index/outline — max 50 lines, links to chapters
├── 01-overview.md      # Chapter 1 (100-200 lines)
├── 02-lifecycle.md     # Chapter 2 (100-200 lines)
└── ...
```

### Files to Chunk

| File | Lines | Split Into |
|------|-------|-----------|
| `coordination-protocol.md` | 469 | `coordination-protocol/` — README + 4 chapters (lifecycle, heartbeat, messages, troubleshooting) |
| `pm-cli.md` | 387 | `pm-cli/` — README + 3 chapters (behavior, delegation, message-handling) |
| `workflow.md` | 372 | `workflow/` — README + 3 chapters (steps-1-5, steps-6-9, steps-10-11) |
| `permissions.md` | 272 | `permissions/` — README + 2 chapters (path-restrictions, enforcement) |
| `hitl-gates.md` | 233 | `hitl-gates/` — README + 2 chapters (gate-definitions, confirmation-protocol) |

CLAUDE.md (~318 lines) is reduced to ~180 lines by dedup (Part 3), so no chunking needed.

### Cross-Reference Convention

Chapter files use relative links:
```markdown
See [Heartbeat Protocol](./02-heartbeat.md) for timing details.
```

Index files use brief descriptions + links:
```markdown
## Chapters
- [Overview](./01-overview.md) — Key concepts and session lifecycle
- [Heartbeat](./02-heartbeat.md) — Frequency, TTL, stale detection
```

### Graph DB Correlation (Future)

Store relationships between documentation and code in an open-source graph DB
(e.g., Neo4j Community) for intuitive semantic search:

- Planning docs ↔ implementation files
- Skills ↔ scripts they own
- Rules ↔ skills they reference
- Work items ↔ source files modified

This is a future enhancement — for now, cross-references in markdown provide
the mapping. The chunked structure makes future graph ingestion straightforward.

---

## Execution Order

1. Create new skill directories + SKILL.md files (testing, code-review, deploy)
2. Move scripts into skill `scripts/` subdirectories (`git mv`)
3. Create forwarding wrappers at original locations
4. Enhance existing skills (add scripts/, cross-refs, allowed-tools)
5. Deduplicate CLAUDE.md (cut to ~180 lines, add pointers)
6. Deduplicate rules (remove repeated tables, add cross-references)
7. Fix conflicts (exclusive ownership, parallel task clarification)
8. Update workflow.md skills table
9. Chunk oversized rule files into directory structures
10. Verify forwarding wrappers work
11. Commit and push

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Broken script references | Forwarding wrappers at every original path |
| Broken `tools/lib/` parser imports | Parsers stay in `tools/lib/`; moved scripts resolve via `$SCRIPT_DIR` |
| CLAUDE.md becomes too terse | Keep it as useful index — brief tables + pointers, not empty |
| Rules lose context by pointing elsewhere | Each rule keeps its constraint statement; only procedure detail moves to skills |
| Circular references | Each topic has exactly ONE source of truth; no A→B→A chains |
| Skill context budget exceeded | 8 skills x ~300 words avg = ~2400 words << 16KB budget |
