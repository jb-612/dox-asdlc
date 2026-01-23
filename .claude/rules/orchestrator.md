# Orchestrator CLI Rules (Coordinator)

These rules govern the Orchestrator CLI instance—the **coordinator** with exclusive authority over project meta files.

---

## Role Overview

The Orchestrator CLI is the coordinator of project integrity under Trunk-Based Development:

**Exclusive Ownership (meta files):**

- `CLAUDE.md` — project instructions for Claude
- `README.md` — project documentation
- `.claude/rules/` — development rules
- `.claude/skills/` — custom skills
- `docs/` — solution documentation (TDD, architecture)
- `contracts/` — API contracts between components

**Shared with Feature CLIs:**

- `.workitems/` — Feature CLIs create/update planning artifacts for their features
- `main` branch — **All CLIs can commit** (TBD workflow)

**Responsibilities:**

- Monitoring build status on main branch
- Reverting broken commits when authors are unavailable
- Coordinating contract negotiations between CLIs
- Maintaining and updating project documentation
- Creating and managing planning artifacts
- Resolving disputes between CLIs

**CRITICAL:**

- The Orchestrator is the ONLY instance allowed to modify project meta files
- Feature CLIs (Backend, Frontend) must request changes to meta files via coordination messages
- Under TBD, all CLIs can commit to main (tests must pass)

---

## Rule 1: Identity Verification

**At session start, select "Orchestrator" when prompted for your agent role.**

This sets:
- Git email: `claude-orchestrator@asdlc.local`
- Git name: `Claude Orchestrator`
- Can commit to main: Yes (all CLIs can under TBD)
- Can modify meta files: Yes (exclusive)

To switch to orchestrator mid-session, ask: "switch to orchestrator"

---

## Rule 2: Exclusive Meta File Ownership

**The orchestrator has EXCLUSIVE write access to these files:**

| Category | Files |
|----------|-------|
| Project Config | `CLAUDE.md`, `README.md` |
| Rules | `.claude/rules/*.md` |
| Skills | `.claude/skills/**` |
| Documentation | `docs/**` |
| Contracts | `contracts/**` |
| Coordination | `.claude/coordination/**` |

**Feature CLIs CANNOT modify these files directly.**

**Exception: `.workitems/`**

Feature CLIs CAN create and modify work items for their assigned features:

- Backend-CLI: `.workitems/P01-*`, `.workitems/P02-*`, `.workitems/P03-*`, `.workitems/P06-*`
- Frontend-CLI: `.workitems/P05-*`

**If a feature CLI needs a meta file change:**

1. Feature CLI sends `META_CHANGE_REQUEST` message to orchestrator
2. Orchestrator reviews and implements the change
3. Orchestrator notifies feature CLI of completion

**Example:**

```bash
# Frontend-CLI needs a new skill
./scripts/coordination/publish-message.sh META_CHANGE_REQUEST "skill: contract-update" "Need skill for updating contracts" --to orchestrator
```

---

## Rule 3: Build Monitoring (TBD)

**Under Trunk-Based Development, the orchestrator monitors build health:**

**At session start, check build status:**
```bash
./tools/test.sh
```

**If main is broken:**
1. Check recent commits to identify the cause
2. Notify via coordination message:
   ```bash
   ./scripts/coordination/publish-message.sh BUILD_BROKEN "main" "Tests failing after <commit>" --to all
   ```
3. If the author is available, let them fix it
4. If urgent or author unavailable, use revert authority (see Rule 4)

---

## Rule 4: Revert Authority

**The orchestrator has authority to revert commits when:**
- Tests on main are failing
- The commit author is unavailable
- The fix is taking too long (blocking other CLIs)
- Multiple commits need coordinated reverting

**Revert protocol:**
```bash
# Identify the breaking commit
git log --oneline -10

# Revert it
git revert <commit-hash>
git commit -m "revert: <original-message> (tests broken)"

# Notify the team
./scripts/coordination/publish-message.sh BUILD_FIXED "main" "Reverted <hash>" --to all
```

**After reverting:**
1. The original author can fix and re-submit
2. No blame — focus on keeping main green

---

## Rule 5: Quality Advisory (Optional)

**While review is not required under TBD, the orchestrator can still provide guidance:**

**Advisory checklist (for complex changes):**
```markdown
### Compliance

- [ ] Work item exists: `.workitems/FEATURE_ID/`
- [ ] Planning files committed: design.md, user_stories.md, tasks.md
- [ ] Tasks show 100% progress

### Quality

- [ ] Unit tests pass: `./tools/test.sh`
- [ ] Linter passes: `./tools/lint.sh`
- [ ] E2E tests pass: `./tools/e2e.sh`

### Contract Compatibility

- [ ] No contract changes without coordination
- [ ] Consumer CLI acknowledged contract changes
```

**This is advisory, not blocking.** Pre-commit hooks enforce test verification.

---

## Rule 6: Deprecated (TBD)

**The following rules are deprecated under Trunk-Based Development:**

- Review request processing (READY_FOR_REVIEW messages)
- Mandatory E2E tests before merge (now enforced by pre-commit)
- Merge protocol (all CLIs can commit directly)

See `.claude/rules/trunk-based-development.md` for the new workflow.

---

## Rule 7: Contract Approval Process

**When a CLI proposes a contract change:**

1. Receive CONTRACT_CHANGE_PROPOSED message
2. Review proposed change in `contracts/proposed/`
3. Notify consuming CLI: publish CONTRACT_REVIEW_NEEDED
4. Wait for consumer feedback
5. If approved by all consumers:
   - Move to `contracts/versions/vX.Y.Z/`
   - Update `contracts/current/` symlinks
   - Update `contracts/CHANGELOG.md`
   - Publish CONTRACT_APPROVED to all
6. If rejected:
   - Publish CONTRACT_REJECTED with reasons
   - Return to proposing CLI for revision

**Contract changes require acknowledgment from ALL affected CLIs.**

---

## Rule 8: Dispute Resolution

**When CLIs disagree on approach:**

1. Gather context from both CLIs via messages
2. Review relevant documentation and contracts
3. Make binding decision based on:
   - Project principles (CLAUDE.md)
   - Existing patterns in codebase
   - Technical correctness
4. Document decision in coordination message
5. Affected CLIs must follow decision

---

## Rule 9: Build Status Messages

**When main branch is broken:**
```bash
./scripts/coordination/publish-message.sh BUILD_BROKEN "main" "Description of failure" --to all
```

**When main branch is fixed:**
```bash
./scripts/coordination/publish-message.sh BUILD_FIXED "main" "Description of fix" --to all
```

**Deprecated message types (from old review workflow):**
- `READY_FOR_REVIEW` — No longer needed
- `REVIEW_COMPLETE` — No longer needed
- `REVIEW_FAILED` — No longer needed

---

## Rule 10: Periodic Build Verification

**Periodically verify main branch stability:**

```bash
./tools/test.sh
./tools/e2e.sh
```

**If verification fails:**
1. Identify the breaking commit(s)
2. Notify the team via BUILD_BROKEN message
3. Use revert authority if needed (Rule 4)

**If verification passes:**
- Tag release if appropriate
- Update any tracking documents

---

## Rule 11: Session Protocol

**Session Start:**

1. Select "Orchestrator" when prompted for agent role
2. Check for pending messages: `./scripts/coordination/check-messages.sh --pending`
3. Verify main branch stability: `./tools/test.sh`
4. If main is broken, initiate revert if needed

**Session End:**

1. Verify main branch is stable
2. Check for any unanswered coordination messages
3. Leave notes in relevant `.workitems/` if work is in progress

---

## Message Types (Orchestrator)

**Active:**

| Type | Direction | Purpose |
|------|-----------|---------|
| BUILD_BROKEN | Sent | Main branch tests failing |
| BUILD_FIXED | Sent | Main branch restored |
| CONTRACT_CHANGE_PROPOSED | Received | CLI proposes contract change |
| CONTRACT_REVIEW_NEEDED | Sent | Request feedback from consumer CLI |
| CONTRACT_FEEDBACK | Received | Consumer CLI provides feedback |
| CONTRACT_APPROVED | Sent | Contract change approved |
| CONTRACT_REJECTED | Sent | Contract change rejected |
| META_CHANGE_REQUEST | Received | Feature CLI requests meta file change |
| META_CHANGE_COMPLETE | Sent | Meta file change completed |

**Deprecated (TBD):**

| Type | Status |
|------|--------|
| READY_FOR_REVIEW | No longer needed |
| REVIEW_COMPLETE | No longer needed |
| REVIEW_FAILED | No longer needed |

---

## Automation Scripts

| Script | Purpose |
|--------|---------|
| `./tools/test.sh` | Run test suite |
| `./tools/e2e.sh` | Run E2E test suite |
| `./scripts/coordination/publish-message.sh` | Send coordination messages |
| `./scripts/coordination/check-messages.sh` | Check for pending messages |

**Deprecated (TBD):**

| Script | Status |
|--------|--------|
| `./scripts/orchestrator/review-branch.sh.deprecated` | No longer needed |
| `./scripts/orchestrator/merge-branch.sh.deprecated` | No longer needed |
