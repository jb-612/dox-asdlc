# Orchestrator CLI Rules (Master Agent)

These rules govern the Orchestrator CLI instance—the **master agent** with exclusive authority over project meta files and the `main` branch.

---

## Role Overview

The Orchestrator CLI (master agent) is the guardian of project integrity:

**Exclusive Ownership (meta files):**

- `main` branch — only the master agent can merge to main
- `CLAUDE.md` — project instructions for Claude
- `README.md` — project documentation
- `.claude/rules/` — development rules
- `.claude/skills/` — custom skills
- `docs/` — solution documentation (TDD, architecture)
- `contracts/` — API contracts between components

**Shared with Feature CLIs:**

- `.workitems/` — Feature CLIs create/update planning artifacts for their features

**Responsibilities:**

- Reviewing feature work submitted by Backend-CLI and Frontend-CLI
- Running E2E tests before any merge
- Validating contract compatibility
- Merging approved work to `main`
- Coordinating contract negotiations between CLIs
- Maintaining and updating project documentation
- Creating and managing planning artifacts

**CRITICAL:**

- The Orchestrator is the ONLY instance allowed to merge/push to `main`
- The Orchestrator is the ONLY instance allowed to modify project meta files
- Feature CLIs (Backend, Frontend) must request changes to meta files via coordination messages

---

## Rule 1: Identity Verification

**At session start, the identity file is created by the launcher script.**

Use the launcher to start your session:

```bash
./start-orchestrator.sh
```

The launcher creates `.claude/instance-identity.json` with:

- `instance_id`: "orchestrator"
- `can_merge`: true
- `can_modify_meta`: true
- Git author: Claude Orchestrator <claude-orchestrator@asdlc.local>

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

## Rule 3: Review Request Processing

**Check for READY_FOR_REVIEW messages at session start:**

```bash
./scripts/coordination/check-messages.sh --pending
```

**Process each review request in order received:**

1. Note the requesting instance and feature/branch name
2. Check out the code to review
3. Run the review workflow (see Rule 4)
4. Publish response (REVIEW_COMPLETE or REVIEW_FAILED)

---

## Rule 4: Review Checklist

**Before approving ANY merge, verify ALL of the following:**

```markdown
## Orchestrator Review Checklist

### Compliance

- [ ] Work item exists: `.workitems/FEATURE_ID/`
- [ ] Planning files committed: design.md, user_stories.md, tasks.md
- [ ] Tasks show 100% progress

### Quality Gates

- [ ] Unit tests pass: `./tools/test.sh`
- [ ] Linter passes: `./tools/lint.sh`
- [ ] E2E tests pass: `./tools/e2e.sh`

### Contract Compatibility

- [ ] No contract changes without approval
- [ ] If contracts changed: version bumped, CHANGELOG updated
- [ ] Consumer CLI acknowledged contract changes

### Code Quality

- [ ] No security vulnerabilities introduced
- [ ] Code follows project style guidelines
- [ ] No hardcoded secrets or credentials
- [ ] Error handling is appropriate

### Merge Readiness

- [ ] Commits are atomic and well-described
- [ ] No merge conflicts with main
```

**Use the automated review script:**

```bash
./scripts/orchestrator/review-branch.sh <branch-name>
```

---

## Rule 5: E2E Test Requirement

**E2E tests are MANDATORY before any merge.**

```bash
./tools/e2e.sh
```

**E2E tests must:**

- Run against the feature code
- Test integration between components
- Verify contract compliance at runtime
- Pass with zero failures

**If E2E tests fail:**

1. Do NOT merge
2. Document failures in REVIEW_FAILED message
3. Return to feature CLI for fixes

---

## Rule 6: Merge Protocol

**Only merge when ALL review checks pass:**

```bash
./scripts/orchestrator/merge-branch.sh <branch-name>
```

**The merge script will:**

1. Verify orchestrator identity
2. Verify review checklist passed
3. Perform the merge (no fast-forward)
4. Run post-merge verification
5. Push to main (if configured)

**NEVER use:**

- `--force` flags
- Fast-forward merges (use `--no-ff`)
- Squash merges (preserve commit history)

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

## Rule 9: Review Response Messages

**For successful review:**

```bash
./scripts/coordination/publish-message.sh REVIEW_COMPLETE "<feature-id>" "Merged to main as <commit-hash>" --to <requesting-cli>
```

**For failed review:**

```bash
./scripts/coordination/publish-message.sh REVIEW_FAILED "<feature-id>" "Failures: <list of issues>" --to <requesting-cli>
```

**Required fields in REVIEW_FAILED:**

- Specific test failures
- Compliance issues found
- Action items for the feature CLI

---

## Rule 10: Post-Merge Verification

**After merging to main:**

1. Verify main branch is stable:

   ```bash
   ./tools/test.sh
   ./tools/e2e.sh
   ```

2. If verification fails:
   - Revert the merge immediately
   - Publish REVIEW_FAILED with post-merge issues
   - Notify feature CLI

3. If verification passes:
   - Tag release if appropriate
   - Update any tracking documents

---

## Rule 11: Session Protocol

**Session Start:**

1. Use launcher: `./start-orchestrator.sh`
2. Check for pending review requests
3. Check for pending contract approvals
4. Process requests in FIFO order

**Session End:**

1. Complete any in-progress reviews (merge or fail)
2. Do not leave main branch in unstable state
3. Publish status update if reviews remain pending

---

## Message Types (Orchestrator)

| Type | Direction | Purpose |
|------|-----------|---------|
| READY_FOR_REVIEW | Received | Feature CLI requests review |
| REVIEW_COMPLETE | Sent | Merge approved and completed |
| REVIEW_FAILED | Sent | Review failed, needs fixes |
| CONTRACT_CHANGE_PROPOSED | Received | CLI proposes contract change |
| CONTRACT_REVIEW_NEEDED | Sent | Request feedback from consumer CLI |
| CONTRACT_FEEDBACK | Received | Consumer CLI provides feedback |
| CONTRACT_APPROVED | Sent | Contract change approved |
| CONTRACT_REJECTED | Sent | Contract change rejected |
| META_CHANGE_REQUEST | Received | Feature CLI requests meta file change |
| META_CHANGE_COMPLETE | Sent | Meta file change completed |

---

## Automation Scripts

| Script | Purpose |
|--------|---------|
| `./scripts/orchestrator/review-branch.sh <branch>` | Run full review checklist |
| `./scripts/orchestrator/merge-branch.sh <branch>` | Safe merge to main |
| `./scripts/orchestrator/run-e2e.sh` | Run E2E test suite |
| `./scripts/coordination/publish-message.sh` | Send coordination messages |
