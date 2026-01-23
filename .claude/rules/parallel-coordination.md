# Parallel CLI Coordination Rules

These rules govern how the three Claude CLI instances work simultaneously on this project.

---

## 3-CLI Architecture (Trunk-Based Development)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Backend-CLI    │     │  Frontend-CLI   │     │  Orchestrator   │
│                 │     │                 │     │                 │
│  - Workers      │     │  - HITL UI      │     │  - Meta files   │
│  - Infra        │     │  - Components   │     │  - Coordination │
│  - Tests        │     │  - Tests        │     │  - Build watch  │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │     All commit directly to main               │
         └───────────────────────┴───────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   pre-commit hook       │
                    │   - Tests must pass     │
                    │   - Path restrictions   │
                    └─────────────────────────┘
```

### Instance Roles

| Instance | ID | Primary Responsibility |
|----------|-----|------------------------|
| Backend-CLI | `backend` | Workers, orchestrator service, infrastructure |
| Frontend-CLI | `frontend` | HITL Web UI, React components |
| Orchestrator-CLI | `orchestrator` | Meta files, coordination, build monitoring |

**Note:** All CLIs can commit directly to main. See `.claude/rules/trunk-based-development.md` for details.

---

## Session Start - Interactive Role Selection

**When you start Claude Code, you'll be prompted to select your agent role:**

```
Which agent role do you want to use for this session?

[ ] Orchestrator - Master agent: review code, merge to main, modify docs/contracts/rules
[ ] Backend      - Backend developer: workers, orchestrator service, infrastructure
[ ] Frontend     - Frontend developer: HITL UI, React components
```

**How it works:**
1. The `SessionStart` hook detects if no identity is set
2. Claude uses `AskUserQuestion` to prompt you for role selection
3. Based on your choice, git config is set automatically
4. Path enforcement and merge permissions are applied based on your role

**Changing roles mid-session:**
Ask Claude to "switch to orchestrator" or "change agent role" to re-select.

**Why git email-based identity:**
- Each role has a distinct git email for commit attribution
- Hooks derive identity from `git config user.email`
- Provides audit trail for who made which changes

---

## Planning Artifact Requirements

**MANDATORY:** ALL features require formal planning artifacts in `.workitems/` BEFORE any code.

**Even if the user provides:**
- Detailed inline implementation plans
- Complete specifications in chat
- Copy-paste ready code
- "Just do X" instructions with full context

**You MUST still:**
1. Run `./scripts/new-feature.sh Pnn Fnn "description"`
2. Populate `design.md`, `tasks.md`, `user_stories.md`
3. Commit planning artifacts to git
4. THEN begin implementation

**No exceptions.** Inline plans supplement but do NOT replace formal planning artifacts.

**Ownership:**
- `.workitems/` is **SHARED** (not a meta file)
- Backend-CLI: Creates and manages `.workitems/P01-*`, `P02-*`, `P03-*`, `P06-*`
- Frontend-CLI: Creates and manages `.workitems/P05-*`
- Orchestrator: Can read all, modify any, but does NOT create planning for feature CLIs

**Why this matters:**
- Planning artifacts are the source of truth for feature scope
- They enable TDD workflow (tasks → tests → code)
- They provide review checkpoints for orchestrator
- They prevent scope creep and "just one more thing" drift

**Common mistake:** Treating user's detailed prompt as permission to skip `.workitems/` creation. This is ALWAYS a workflow violation.

---

## Rule 1: Instance Identity (Git Email-Based)

**Identity is derived from `git config user.email`:**

| Role | Git Email | Git Name |
|------|-----------|----------|
| Orchestrator | `claude-orchestrator@asdlc.local` | Claude Orchestrator |
| Backend | `claude-backend@asdlc.local` | Claude Backend |
| Frontend | `claude-frontend@asdlc.local` | Claude Frontend |

The git email determines:
- Which files you can modify (path restrictions)
- Commit attribution (audit trail)

**Enforcement layers:**
1. `SessionStart` hook - prompts for role selection if no identity set
2. `PreToolUse` hook - **BLOCKS** forbidden file edits (path restrictions)
3. `pre-commit` hook - **BLOCKS** commits to main if tests fail, **WARNS** on git author mismatch

## Rule 2: File Boundaries (Path-Based Access Control)

**Backend-CLI (instance_id=backend):**
- CAN modify: `src/workers/`, `src/orchestrator/`, `src/infrastructure/`, `docker/workers/`, `docker/orchestrator/`
- CAN modify: `.workitems/P01-*`, `.workitems/P02-*`, `.workitems/P03-*`, `.workitems/P06-*` (planning & tasks)
- CAN read: `contracts/`, `src/core/`, `docs/`
- CANNOT touch: `src/hitl_ui/`, `docker/hitl-ui/`, meta files

**Frontend-CLI (instance_id=frontend):**
- CAN modify: `src/hitl_ui/`, `docker/hitl-ui/`, `tests/unit/hitl_ui/`
- CAN modify: `.workitems/P05-*` (planning & tasks)
- CAN read: `contracts/`, `src/core/`, `docs/`
- CANNOT touch: `src/workers/`, `src/orchestrator/`, `src/infrastructure/`, meta files

**Orchestrator-CLI (instance_id=orchestrator) — Coordinator:**
- EXCLUSIVE ownership of meta files (see below)
- CAN read: All files
- CAN modify: Any file (no path restrictions)
- CAN commit to main: **Yes** (all CLIs can under TBD)
- Primary role: Coordinate, monitor builds, and maintain project integrity

**Meta Files (Orchestrator EXCLUSIVE ownership):**

| Category | Files |
|----------|-------|
| Project Config | `CLAUDE.md`, `README.md` |
| Rules | `.claude/rules/**` |
| Skills | `.claude/skills/**` |
| Documentation | `docs/**` |
| Contracts | `contracts/**` |
| Coordination | `.claude/coordination/**` |

**Note:** `.workitems/` is NOT in the exclusive list — feature CLIs manage their own planning artifacts.

**Feature CLIs CANNOT modify meta files directly.** To request changes:
```bash
./scripts/coordination/publish-message.sh META_CHANGE_REQUEST "<file>" "<description>" --to orchestrator
```

**Shared source files (require coordination):**
- `src/core/interfaces.py` — Coordinate via messages
- `src/core/events.py` — Coordinate via messages

## Rule 3: Direct Commits to Main (TBD)

**All CLIs can commit directly to main:**
- Backend-CLI: Commits backend changes
- Frontend-CLI: Commits frontend changes
- Orchestrator-CLI: Commits meta file changes

**Pre-commit requirements:**
- Tests must pass (`./tools/test.sh --quick`)
- Path restrictions are enforced
- Git author matches CLI identity

**This enables:**
- Faster iteration without review bottleneck
- Individual accountability per CLI
- Audit trail via git author identity

See `.claude/rules/trunk-based-development.md` for full TBD guidelines.

## Rule 4: Feature Development Workflow (TBD)

**For all CLIs:**

1. **Start Session:**
   ```bash
   claude  # Select your role when prompted
   ```

2. **Develop Feature:**
   ```bash
   # Create planning artifacts first
   ./scripts/new-feature.sh P03 F01 "feature-name"

   # Develop with TDD
   # Run tests frequently: ./tools/test.sh
   # Run linter: ./tools/lint.sh
   ```

3. **Commit Directly to Main:**
   ```bash
   # Tests must pass (pre-commit hook verifies)
   git add <files>
   git commit -m "feat(P03-F01): description"
   git push
   ```

4. **If Tests Fail:**
   - Fix the failing tests
   - Or commit to a short-lived branch temporarily

**No review request needed.** Tests are your verification.

## Rule 5: Contract Changes (Orchestrator-Mediated)

**Any change to `contracts/` MUST follow this protocol:**

1. **Proposer creates change:**
   ```bash
   # Create proposed change
   cp contracts/current/events.json contracts/proposed/events-v1.1.0.json
   # Edit the proposed file
   ./scripts/coordination/publish-message.sh CONTRACT_CHANGE_PROPOSED events "Add new field X" --to orchestrator
   ```

2. **Orchestrator reviews and notifies:**
   ```bash
   # Orchestrator sends to consumer CLI
   ./scripts/coordination/publish-message.sh CONTRACT_REVIEW_NEEDED events "Backend proposes adding field X" --to frontend
   ```

3. **Consumer provides feedback:**
   ```bash
   ./scripts/coordination/publish-message.sh CONTRACT_FEEDBACK events "Approved - compatible with UI" --to orchestrator
   ```

4. **Orchestrator approves:**
   ```bash
   # Move to versions, update symlinks
   mv contracts/proposed/events-v1.1.0.json contracts/versions/v1.1.0/events.json
   ln -sf ../versions/v1.1.0/events.json contracts/current/events.json
   # Update CHANGELOG.md
   ./scripts/coordination/publish-message.sh CONTRACT_APPROVED events "v1.1.0 approved" --to all
   ```

**NEVER modify `contracts/current/*` or `contracts/versions/*` without orchestrator approval.**

## Rule 6: Coordination Messages

**Check for messages at the start of each work session:**
```bash
./scripts/coordination/check-messages.sh
```

**Acknowledge messages promptly:**
```bash
./scripts/coordination/ack-message.sh <message-id>
```

**Active Message Types:**

| Type | Direction | Purpose |
|------|-----------|---------|
| `BUILD_BROKEN` | Any → All | Main branch tests failing |
| `BUILD_FIXED` | Any → All | Main branch tests restored |
| `CONTRACT_CHANGE_PROPOSED` | Feature → Orchestrator | Propose contract change |
| `CONTRACT_REVIEW_NEEDED` | Orchestrator → Consumer | Request contract feedback |
| `CONTRACT_FEEDBACK` | Consumer → Orchestrator | Provide contract feedback |
| `CONTRACT_APPROVED` | Orchestrator → All | Contract change approved |
| `CONTRACT_REJECTED` | Orchestrator → Proposer | Contract change rejected |
| `META_CHANGE_REQUEST` | Feature → Orchestrator | Request meta file change |
| `META_CHANGE_COMPLETE` | Orchestrator → Feature | Meta file change completed |
| `INTERFACE_UPDATE` | Any → Any | Shared interface notification |
| `BLOCKING_ISSUE` | Any → Any | Work blocked, needs help |

**Deprecated (TBD removes review workflow):**

| Type | Status |
|------|--------|
| `READY_FOR_REVIEW` | Deprecated - commit directly to main |
| `REVIEW_COMPLETE` | Deprecated - no longer needed |
| `REVIEW_FAILED` | Deprecated - pre-commit enforces tests |

## Rule 7: Status Updates

**Update your status when:**
- Starting work on a new task
- Completing a task
- Encountering a blocking issue
- Ending your session

## Rule 8: Pre-Commit Verification (TBD)

**Before committing to main, ensure:**

1. All tests pass: `./tools/test.sh`
2. Linter passes: `./tools/lint.sh`
3. Planning artifacts complete: `tasks.md` shows 100%
4. No unresolved coordination messages

**Commit directly:**
```bash
git add <files>
git commit -m "feat(<feature-id>): description"
git push
```

**If pre-commit hook fails:**
1. Read the error message
2. Run `./tools/test.sh` to see failures
3. Fix all issues
4. Commit again

## Rule 9: Mock-First Development (Frontend-CLI)

**Frontend-CLI MUST create mocks that match contract schemas:**

Location: `src/hitl_ui/api/mocks/`

```python
# Example: src/hitl_ui/api/mocks/gates_mock.py
from contracts.current.hitl_api import GateRequest  # Validate against schema

def mock_pending_gates() -> list[GateRequest]:
    """Return mock data matching hitl_api.json contract."""
    pass
```

When Backend-CLI delivers real implementation, mocks are swapped seamlessly.

## Rule 10: Session End Protocol

**Before ending your session:**

1. Commit all completed work
2. Update task progress in `.workitems/`
3. Check for any unanswered coordination messages
4. Leave clear notes in `tasks.md` for resumption

**Note:** Git config persists at the repo level. In parallel CLI scenarios, another CLI
may overwrite your identity. Ask Claude to "confirm my role" or "switch to [role]" if needed.

---

## Quick Reference: Common Workflows

### Starting a Session
```bash
# Start Claude Code normally
claude

# Claude will prompt you to select your role:
# - Orchestrator (for meta files/coordination)
# - Backend (for workers/infra)
# - Frontend (for HITL UI)
```

### Backend-CLI: Complete a Feature (TBD)
```bash
# Select "Backend" when prompted at session start
./scripts/new-feature.sh P03 F01 "feature-name"
# ... develop feature with TDD ...
./tools/test.sh && ./tools/lint.sh
git add <files>
git commit -m "feat(P03-F01): feature-name complete"
git push  # Direct to main!
```

### Frontend-CLI: Complete a Feature (TBD)
```bash
# Select "Frontend" when prompted at session start
./scripts/new-feature.sh P05 F01 "feature-name"
# ... develop feature with TDD ...
./tools/test.sh && ./tools/lint.sh
git add <files>
git commit -m "feat(P05-F01): feature-name complete"
git push  # Direct to main!
```

### Orchestrator-CLI: Coordinate and Monitor
```bash
# Select "Orchestrator" when prompted at session start
./scripts/coordination/check-messages.sh --pending
# Monitor build status
# Revert if main is broken
# Coordinate contract changes
```

### Switching Roles Mid-Session
Ask Claude: "switch to orchestrator" or "change agent role"

---

## Identity Enforcement Summary

| Layer | Hook/Script | What It Does | Blocking? |
|-------|-------------|--------------|-----------|
| 1 | `SessionStart` | Signals if identity selection needed | No |
| 2 | Claude | Uses `AskUserQuestion` for role selection | Interactive |
| 3 | `PreToolUse` | Checks path permissions (domain boundaries) | **Yes** |
| 4 | `pre-commit` | Runs tests on main, warns on author mismatch | **Yes** (tests) |

**Identity Source:** `git config user.email` (set via interactive selection)

**TBD Note:** All CLIs can commit to main. The pre-commit hook enforces test verification.
Path restrictions still apply — CLIs can only modify files within their domain.

**Parallel CLI Note:** Git config is shared at repo level. When running multiple CLIs,
they may overwrite each other's identity. Use "confirm my role" or "switch to [role]"
commands to re-establish identity as needed.

See `.claude/rules/trunk-based-development.md` for TBD workflow details.
See `.claude/rules/identity-selection.md` for the interactive selection flow.
