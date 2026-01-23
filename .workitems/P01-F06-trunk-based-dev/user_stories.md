# P01-F06: User Stories

## US-1: Direct Commit to Main

**As a** Backend or Frontend CLI developer
**I want to** commit directly to main without waiting for orchestrator review
**So that** I can iterate faster and maintain development velocity

### Acceptance Criteria

- [ ] Backend-CLI can commit to main branch
- [ ] Frontend-CLI can commit to main branch
- [ ] Path restrictions still enforce domain boundaries
- [ ] Pre-commit hook verifies tests pass

---

## US-2: Pre-Commit Quality Gate

**As a** developer committing to main
**I want** automatic test verification before commits
**So that** main branch remains stable

### Acceptance Criteria

- [ ] Pre-commit hook runs `./tools/test.sh --quick` on main branch
- [ ] Commits are blocked if tests fail
- [ ] Clear error message explains what failed
- [ ] Non-main branches are not subject to this check

---

## US-3: Orchestrator as Coordinator

**As an** Orchestrator
**I want to** focus on coordination rather than gatekeeping
**So that** I can add value through monitoring and dispute resolution

### Acceptance Criteria

- [ ] Orchestrator still owns meta files exclusively
- [ ] Orchestrator monitors build status
- [ ] Orchestrator has revert authority when main is broken
- [ ] Review workflow is deprecated (not required)

---

## US-4: Build Status Awareness

**As a** CLI developer
**I want to** be notified when main branch is broken
**So that** I can help fix it or avoid rebasing onto broken code

### Acceptance Criteria

- [ ] `BUILD_BROKEN` message type exists
- [ ] `BUILD_FIXED` message type exists
- [ ] Coordination scripts support these message types

---

## US-5: Clear TBD Documentation

**As a** developer joining the project
**I want** clear documentation of the TBD workflow
**So that** I understand how to contribute correctly

### Acceptance Criteria

- [ ] `trunk-based-development.md` explains core principles
- [ ] Role comparison (old vs new) is documented
- [ ] Pre-commit requirements are documented
- [ ] Short-lived branch guidance is provided
