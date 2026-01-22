# Parallel CLI Coordination Rules

These rules govern how multiple Claude CLI instances work simultaneously on this project.

---

## MANDATORY: Session Start Checklist

**Run this BEFORE any other work:**

```bash
./scripts/check-compliance.sh --session-start
```

**If this fails, DO NOT proceed. Fix compliance issues first.**

The session start check verifies:
- `CLAUDE_INSTANCE_ID` is set
- You are on the correct branch for your instance
- No pending coordination messages require acknowledgment
- No file locks conflict with your planned work

**Manual verification (if script unavailable):**
```bash
# 1. Verify identity
echo "Instance: $CLAUDE_INSTANCE_ID, Branch Prefix: $CLAUDE_BRANCH_PREFIX"
[ -z "$CLAUDE_INSTANCE_ID" ] && echo "ERROR: Run 'source scripts/cli-identity.sh <ui|agent>' first"

# 2. Verify branch
git branch --show-current | grep "^${CLAUDE_BRANCH_PREFIX}" || echo "ERROR: Wrong branch!"

# 3. Check coordination messages
./scripts/coordination/check-messages.sh

# 4. Acknowledge any pending messages BEFORE starting work
./scripts/coordination/ack-message.sh <message-id>
```

---

## Rule 1: Instance Identity

**BEFORE starting any work, verify your instance identity:**

```bash
echo $CLAUDE_INSTANCE_ID
```

If not set, run:
```bash
source scripts/cli-identity.sh <ui|agent>
```

Your identity determines which files you can modify and which branches you can commit to.

## Rule 2: Branch Discipline

**Each instance commits ONLY to its designated branch prefix:**

| Instance | Branch Prefix | Example |
|----------|--------------|---------|
| UI-CLI | `ui/` | `ui/P05-F01-hitl-ui` |
| Agent-CLI | `agent/` | `agent/P03-F01-worker-pool` |

**NEVER commit directly to:**
- `main` branch
- Another instance's branch prefix
- `contracts/*` without coordination

**Before committing, verify:**
```bash
git branch --show-current | grep "^${CLAUDE_BRANCH_PREFIX}"
```

## Rule 3: File Boundaries

**UI-CLI (CLAUDE_INSTANCE_ID=ui):**
- CAN modify: `src/hitl_ui/`, `docker/hitl-ui/`, `tests/unit/hitl_ui/`
- CAN read: `contracts/`, `src/core/`, `docs/`
- CANNOT touch: `src/workers/`, `src/orchestrator/`, `src/infrastructure/`

**Agent-CLI (CLAUDE_INSTANCE_ID=agent):**
- CAN modify: `src/workers/`, `src/orchestrator/`, `src/infrastructure/`, `docker/workers/`, `docker/orchestrator/`
- CAN read: `contracts/`, `src/core/`, `docs/`
- CANNOT touch: `src/hitl_ui/`, `docker/hitl-ui/`

**Shared files (require coordination):**
- `contracts/*` — Use contract change protocol
- `src/core/interfaces.py` — Coordinate via messages
- `src/core/events.py` — Coordinate via messages

## Rule 4: Contract Changes

**Any change to `contracts/` MUST follow this protocol:**

1. Create proposed change: `contracts/proposed/<change-description>.json`
2. Publish coordination message:
   ```bash
   ./scripts/coordination/publish-message.sh CONTRACT_CHANGE_PROPOSED <contract_name> "<description>"
   ```
3. Wait for acknowledgment from consumer instance
4. After ACK received, move to versioned location and update symlinks
5. Update `contracts/CHANGELOG.md`

**NEVER modify `contracts/current/*` or `contracts/versions/*` without ACK.**

## Rule 5: Coordination Messages

**Check for messages at the start of each work session:**
```bash
./scripts/coordination/check-messages.sh
```

**Acknowledge messages promptly:**
```bash
./scripts/coordination/ack-message.sh <message-id>
```

**Message types:**
- `CONTRACT_CHANGE_PROPOSED` — New contract version proposed
- `CONTRACT_CHANGE_ACK` — Consumer acknowledges contract change
- `INTERFACE_UPDATE` — Shared interface change notification
- `BLOCKING_ISSUE` — Work blocked, needs coordination
- `READY_FOR_MERGE` — Branch ready for human merge

## Rule 6: Status Updates

**Update your status when:**
- Starting work on a new task
- Completing a task
- Encountering a blocking issue
- Ending your session

**Status file location:** `.claude/coordination/status.json`

The status is automatically updated by `cli-identity.sh` when activating/deactivating.

## Rule 7: Merge Preparation

**Before requesting a merge:**

1. Ensure all tests pass: `./tools/test.sh`
2. Ensure linter passes: `./tools/lint.sh`
3. Check for unresolved coordination messages
4. Verify contract compatibility with other branch
5. Run merge helper:
   ```bash
   ./scripts/merge-helper.sh <your-branch> <other-branch>
   ```
6. Publish READY_FOR_MERGE message

## Rule 8: Mock-First Development (UI-CLI)

**UI-CLI MUST create mocks that match contract schemas:**

Location: `src/hitl_ui/api/mocks/`

```python
# Example: src/hitl_ui/api/mocks/gates_mock.py
from contracts.current.hitl_api import GateRequest  # Validate against schema

def mock_pending_gates() -> list[GateRequest]:
    """Return mock data matching hitl_api.json contract."""
    pass
```

When Agent-CLI delivers real implementation, mocks are swapped seamlessly.

## Rule 9: Conflict Prevention

**If you need to modify a shared file:**

1. Check `.claude/coordination/locks/` for existing lock
2. Create lock file: `echo "$CLAUDE_INSTANCE_ID" > .claude/coordination/locks/<filename>.lock`
3. Publish message notifying other instance
4. Make changes
5. Commit
6. Remove lock file
7. Publish unlock message

**If a lock exists, wait or coordinate with the other instance.**

## Rule 10: Session End Protocol

**Before ending your session:**

1. Commit all completed work to your branch
2. Update task progress in `.workitems/`
3. Update status file:
   ```bash
   source scripts/cli-identity.sh deactivate
   ```
4. Check for any unanswered coordination messages
5. Leave clear notes in `tasks.md` for resumption
