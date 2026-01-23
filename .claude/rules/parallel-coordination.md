# Parallel CLI Coordination Rules

These rules govern how the three Claude CLI instances work simultaneously on this project.

---

## 3-CLI Architecture

```
┌─────────────────┐     ┌─────────────────┐
│  Backend-CLI    │     │  Frontend-CLI   │
│                 │     │                 │
│  - Workers      │     │  - HITL UI      │
│  - Orchestrator │     │  - Components   │
│  - Infra        │     │  - Frontend     │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │  READY_FOR_REVIEW     │
         └───────────┬───────────┘
                     ▼
         ┌─────────────────────┐
         │  Orchestrator-CLI   │
         │                     │
         │  - Code Review      │
         │  - E2E Tests        │
         │  - Contract Valid.  │
         │  - Merge to main    │
         └─────────────────────┘
```

### Instance Roles

| Instance | ID | Primary Responsibility |
|----------|-----|------------------------|
| Backend-CLI | `backend` | Workers, orchestrator, infrastructure |
| Frontend-CLI | `frontend` | HITL Web UI, frontend components |
| Orchestrator-CLI | `orchestrator` | Review, E2E tests, merge to main |

---

## MANDATORY: Session Start - Use Launcher Scripts

**ALWAYS start Claude Code using the appropriate launcher script:**

```bash
# For backend development (workers, orchestrator, infrastructure)
./start-backend.sh

# For frontend development (HITL Web UI)
./start-frontend.sh

# For review/merge operations (orchestrator only)
./start-orchestrator.sh
```

**Why launchers are required:**
- They create `.claude/instance-identity.json` with role-specific path permissions
- They set git user.name/email for commit attribution (audit trail)
- Claude Code hooks read this file to enforce path restrictions
- Environment variables don't persist across Claude bash sessions, but the identity file does

**If you start Claude without a launcher:**
- The `UserPromptSubmit` hook will **BLOCK** all prompts
- You'll see: "BLOCKED: NO LAUNCHER USED"
- Exit and restart using the correct launcher

**The launcher script automatically:**
- Sets git author for commit attribution
- Displays your role permissions and path restrictions
- Configures identity for all enforcement layers

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

## Rule 1: Instance Identity (Enforced via Launcher Scripts)

**Identity is automatically set when you use a launcher script:**

```bash
./start-backend.sh      # Sets identity: backend
./start-frontend.sh     # Sets identity: frontend
./start-orchestrator.sh # Sets identity: orchestrator
```

The identity file at `.claude/instance-identity.json` determines:
- Which files you can modify (path restrictions)
- Whether you can merge to main

**Enforcement layers:**
1. `SessionStart` hook - displays role and permissions
2. `UserPromptSubmit` hook - **BLOCKS** if no identity file
3. `PreToolUse` hook - **BLOCKS** forbidden file edits and merge/push to main
4. `pre-commit` hook - **WARNS** on git author mismatch

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

**Orchestrator-CLI (instance_id=orchestrator) — Master Agent:**
- EXCLUSIVE ownership of meta files (see below)
- CAN read: All files (for review purposes)
- CAN modify: Any file (no path restrictions)
- CAN merge to main: **Yes** (only instance with this permission)
- Primary role: Review, merge, and maintain project integrity

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

## Rule 3: Merge and Push Restrictions

**Only the Orchestrator can:**
- Merge branches to main
- Push to main

**Feature CLIs (Backend, Frontend):**
- Can commit to any branch
- Can push to any branch except main
- Must request review for merging to main

**This ensures:**
- All changes to main go through orchestrator review
- Audit trail via git author identity
- Quality gates (tests, linting) are enforced

## Rule 4: Feature Development Workflow

**For Backend-CLI and Frontend-CLI:**

1. **Start Session (use launcher script):**
   ```bash
   ./start-backend.sh   # For backend development
   # OR
   ./start-frontend.sh  # For frontend development
   ```

2. **Develop Feature:**
   ```bash
   # Work on any branch (branch choice is informational, not enforced)
   git checkout -b P03-F01-feature-name

   # Develop feature with TDD
   # Run local tests: ./tools/test.sh
   # Run linter: ./tools/lint.sh
   ```

3. **Request Review:**
   ```bash
   # When feature complete, include the commit hash or branch name
   ./scripts/coordination/publish-message.sh READY_FOR_REVIEW "P03-F01-feature-name" "Feature complete" --to orchestrator
   ```

4. **Wait for Response:**
   - `REVIEW_COMPLETE` → Feature merged to main
   - `REVIEW_FAILED` → Fix issues and re-submit

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

**Message Types:**

| Type | Direction | Purpose |
|------|-----------|---------|
| `READY_FOR_REVIEW` | Feature → Orchestrator | Request code review and merge |
| `REVIEW_COMPLETE` | Orchestrator → Feature | Review passed, merged to main |
| `REVIEW_FAILED` | Orchestrator → Feature | Review failed, lists issues |
| `CONTRACT_CHANGE_PROPOSED` | Feature → Orchestrator | Propose contract change |
| `CONTRACT_REVIEW_NEEDED` | Orchestrator → Consumer | Request contract feedback |
| `CONTRACT_FEEDBACK` | Consumer → Orchestrator | Provide contract feedback |
| `CONTRACT_APPROVED` | Orchestrator → All | Contract change approved |
| `CONTRACT_REJECTED` | Orchestrator → Proposer | Contract change rejected |
| `META_CHANGE_REQUEST` | Feature → Orchestrator | Request meta file change |
| `META_CHANGE_COMPLETE` | Orchestrator → Feature | Meta file change completed |
| `INTERFACE_UPDATE` | Any → Any | Shared interface notification |
| `BLOCKING_ISSUE` | Any → Any | Work blocked, needs help |

## Rule 7: Status Updates

**Update your status when:**
- Starting work on a new task
- Completing a task
- Encountering a blocking issue
- Ending your session

## Rule 8: Review Process (Feature CLIs)

**Before requesting review, ensure:**

1. All tests pass: `./tools/test.sh`
2. Linter passes: `./tools/lint.sh`
3. Planning artifacts complete: `tasks.md` shows 100%
4. No unresolved coordination messages

**Request review:**
```bash
./scripts/coordination/publish-message.sh READY_FOR_REVIEW "<feature-id>" "Feature complete" --to orchestrator
```

**After receiving REVIEW_FAILED:**
1. Read the failure reasons in the message
2. Fix all listed issues
3. Run tests again
4. Re-submit review request

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

**Note:** The identity file (`.claude/instance-identity.json`) persists until overwritten by the next launcher script. This is intentional - it prevents commits outside of Claude Code sessions from bypassing restrictions.

---

## Quick Reference: Common Workflows

### Backend-CLI: Complete a Feature
```bash
# Start session (from project root)
./start-backend.sh

# Inside Claude Code session:
git checkout -b P03-F01-feature-name
# ... develop feature ...
./tools/test.sh && ./tools/lint.sh
./scripts/coordination/publish-message.sh READY_FOR_REVIEW "P03-F01-feature-name" "Complete" --to orchestrator
# Wait for REVIEW_COMPLETE or REVIEW_FAILED
```

### Frontend-CLI: Complete a Feature
```bash
# Start session (from project root)
./start-frontend.sh

# Inside Claude Code session:
git checkout -b P05-F01-feature-name
# ... develop feature ...
./tools/test.sh && ./tools/lint.sh
./scripts/coordination/publish-message.sh READY_FOR_REVIEW "P05-F01-feature-name" "Complete" --to orchestrator
# Wait for REVIEW_COMPLETE or REVIEW_FAILED
```

### Orchestrator-CLI: Review and Merge
```bash
# Start session (from project root)
./start-orchestrator.sh

# Inside Claude Code session:
./scripts/coordination/check-messages.sh --pending
./scripts/orchestrator/review-branch.sh P03-F01-feature-name
# If review passes:
./scripts/orchestrator/merge-branch.sh P03-F01-feature-name
./scripts/coordination/publish-message.sh REVIEW_COMPLETE "P03-F01" "Merged as abc123" --to backend
```

---

## Identity Enforcement Summary

| Layer | Hook/Script | What It Does | Blocking? |
|-------|-------------|--------------|-----------|
| 1 | `SessionStart` | Displays role and permissions | No (informational) |
| 2 | `UserPromptSubmit` | Checks identity file exists | **Yes** |
| 3 | `PreToolUse` | Checks path permissions, blocks merge/push to main | **Yes** |
| 4 | `pre-commit` | Warns on git author mismatch | No (warning only) |

See `.claude/coordination/README.md` for detailed troubleshooting.
