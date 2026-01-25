# Tasks: PM CLI Workflow Establishment (Expanded)

**Work Item:** META-01-pm-cli-workflow
**Date:** 2026-01-25
**Status:** In Progress

---

## Task Breakdown

### Task 1: Create pm-cli.md rule file
**File:** `.claude/rules/pm-cli.md`
**Type:** Create new file
**Estimate:** 25 minutes
**Dependencies:** None
**Stories:** US-1, US-4, US-9, US-11

**Description:**
Create new rule file defining PM CLI behavior:
- Role definition (main session as Project Manager)
- Responsibilities (plan, delegate, track, NOT implement)
- Delegation rules (which agent for which task type)
- Session renewal protocol (pause after each atomic task)
- What PM CLI does NOT do
- Multi-CLI coordination via Redis MCP (for DevOps)
- Chrome extension advisory pattern with triggers and template

**Acceptance Criteria:**
- [ ] File exists at `.claude/rules/pm-cli.md`
- [ ] Contains YAML frontmatter with description
- [ ] Defines PM CLI role and responsibilities
- [ ] Documents session renewal protocol
- [ ] Includes multi-CLI coordination section
- [ ] Includes Chrome advisory pattern with 4 triggers
- [ ] Advisory message template included

- [x] Complete

---

### Task 2: Create hitl-gates.md rule file
**File:** `.claude/rules/hitl-gates.md`
**Type:** Create new file
**Estimate:** 20 minutes
**Dependencies:** None
**Stories:** US-8

**Description:**
Create new rule file defining all HITL gates:
- DevOps Invocation (mandatory)
- Protected Path Commit (mandatory)
- Contract Change (mandatory)
- Destructive Workstation Op (mandatory)
- Design Review Concerns (advisory)
- Test Failures > 3 (advisory)
- Complex Operation (advisory)

Each gate includes: trigger condition, question format, mandatory vs advisory.

**Acceptance Criteria:**
- [ ] File exists at `.claude/rules/hitl-gates.md`
- [ ] All 7 HITL gates documented
- [ ] Each gate has trigger, question, mandatory flag
- [ ] Mandatory vs advisory distinction clear
- [ ] DevOps invocation shows 3 options (local/CLI/instructions)

- [x] Complete

---

### Task 3: Create permissions.md rule file
**File:** `.claude/rules/permissions.md`
**Type:** Create new file
**Estimate:** 20 minutes
**Dependencies:** None
**Stories:** US-10

**Description:**
Create new rule file defining environment-aware permissions:
- Environment detection logic (/.dockerenv, KUBERNETES_SERVICE_HOST)
- Full freedom tier (container/K8s)
- Workstation restrictions tier
- Specific restrictions: no --force, no rm -rf, no kubectl delete
- HITL requirements for workstation destructive ops

**Acceptance Criteria:**
- [ ] File exists at `.claude/rules/permissions.md`
- [ ] Environment detection documented
- [ ] Two permission tiers documented
- [ ] Workstation restrictions listed
- [ ] HITL triggers for protected paths documented

- [x] Complete

---

### Task 4: Revise workflow.md with 11-step workflow
**File:** `.claude/rules/workflow.md`
**Type:** Major revision
**Estimate:** 25 minutes
**Dependencies:** Tasks 1, 2, 3 (references concepts from those)
**Stories:** US-2, US-4, US-5, US-11

**Description:**
Replace current workflow with 11-step workflow:
1. Workplan - PM CLI drafts overall work plan
2. Planning - Delegate to planner, auto diagram-builder
3. Diagrams - Explicit diagram requests if needed
4. Design Review - Send to reviewer, HITL if concerns
5. Re-plan - PM CLI revisits, Chrome advisory option
6. Parallel Build - Atomic tasks to builders, session renewal
7. Testing - Run required tests, HITL if failures > 3
8. Review - Reviewer inspects, create issues
9. Orchestration - Orchestrator runs E2E, HITL for protected commits
10. DevOps - PM CLI coordinates, HITL required
11. Closure - PM CLI summarizes, closes issues

**Acceptance Criteria:**
- [ ] workflow.md contains all 11 steps
- [ ] Each step has clear purpose
- [ ] HITL gates indicated at steps 4, 7, 9, 10
- [ ] Step 5 mentions Chrome advisory
- [ ] Step 6 mentions atomic tasks and session renewal
- [ ] Step 9 assigns E2E to orchestrator

- [x] Complete

---

### Task 5: Revise CLAUDE.md with expanded roles and workflow
**File:** `CLAUDE.md`
**Type:** Major revision
**Estimate:** 25 minutes
**Dependencies:** Tasks 1, 2, 3, 4 (must align with those)
**Stories:** US-1, US-2, US-3, US-7, US-8, US-10

**Description:**
Add to CLAUDE.md:
- PM CLI Role section (main session acts as PM)
- Reference to 11-step workflow
- Non-Negotiable Rules section (4 rules)
- Role table (6 roles: planner, backend, frontend, reviewer, orchestrator, devops)
- HITL summary (7 gates)
- Environment permissions summary
- Orchestrator meta file ownership

Preserve existing:
- Commands section
- Path Restrictions section
- Work Item Format section
- Related Docs section

**Acceptance Criteria:**
- [ ] CLAUDE.md has PM CLI Role section
- [ ] CLAUDE.md has Non-Negotiable Rules section
- [ ] CLAUDE.md has role table with 6 roles
- [ ] CLAUDE.md references 11-step workflow
- [ ] CLAUDE.md has HITL summary
- [ ] CLAUDE.md has permissions summary
- [ ] DevOps marked as HITL-required
- [ ] Existing sections preserved

- [x] Complete

---

### Task 6: Update identity-selection.md with 6 agents
**File:** `.claude/rules/identity-selection.md`
**Type:** Update
**Estimate:** 15 minutes
**Dependencies:** Tasks 1, 5 (must align with PM CLI definition)
**Stories:** US-1, US-3

**Description:**
Update to include all 6 agents:
- PM CLI is the default main session behavior
- No agent selection needed for PM CLI role
- All 6 agents: planner, backend, frontend, reviewer, orchestrator, devops
- DevOps marked as restricted (HITL required)
- When to stay in PM CLI vs invoke subagent

**Acceptance Criteria:**
- [ ] identity-selection.md mentions PM CLI as default
- [ ] All 6 agents listed in table
- [ ] DevOps marked as restricted/HITL
- [ ] Clarifies when to invoke subagents
- [ ] Does not contradict pm-cli.md or CLAUDE.md

- [x] Complete

---

### Task 7: Update trunk-based-development.md
**File:** `.claude/rules/trunk-based-development.md`
**Type:** Update
**Estimate:** 10 minutes
**Dependencies:** Task 5 (aligns with orchestrator role)
**Stories:** US-5, US-7

**Description:**
Update commit authority:
- Orchestrator is primary commit agent
- Protected paths require HITL: contracts/, .claude/
- Revert authority unchanged
- Issue tracking unchanged

**Acceptance Criteria:**
- [ ] Orchestrator documented as commit agent
- [ ] Protected paths listed
- [ ] HITL requirement for protected paths
- [ ] Existing revert/issue sections preserved

- [x] Complete

---

### Task 8: Update parallel-coordination.md with multi-CLI
**File:** `.claude/rules/parallel-coordination.md`
**Type:** Update
**Estimate:** 20 minutes
**Dependencies:** Tasks 1, 2 (references multi-CLI pattern)
**Stories:** US-9

**Description:**
Add multi-CLI patterns:
- DevOps CLI as separate window option
- All 5 new message types: DEVOPS_REQUEST, DEVOPS_STARTED, DEVOPS_COMPLETE, DEVOPS_FAILED, PERMISSION_FORWARD
- Message flow for devops operations
- Acknowledge patterns

Update roles section:
- Add devops role
- Update path restrictions if needed

**Acceptance Criteria:**
- [ ] Multi-CLI section added
- [ ] All 5 message types documented
- [ ] DevOps CLI pattern explained
- [ ] Message flow documented
- [ ] Devops role added to roles section

- [x] Complete

---

### Task 9: Update orchestrator.md agent
**File:** `.claude/agents/orchestrator.md`
**Type:** Update
**Estimate:** 15 minutes
**Dependencies:** Tasks 4, 7 (must align with workflow and commit rules)
**Stories:** US-4, US-5

**Description:**
Add to orchestrator.md:
- Atomic Task Delegation section
- Emphasize ONE task at a time to coding agents
- E2E validation step before commits
- Clarify this is the agent that runs E2E and commits
- Protected path HITL requirement

**Acceptance Criteria:**
- [ ] orchestrator.md has atomic delegation guidance
- [ ] orchestrator.md mentions E2E responsibility
- [ ] orchestrator.md mentions it is the committing agent
- [ ] Protected path HITL mentioned

- [x] Complete

---

### Task 10: Create devops.md agent
**File:** `.claude/agents/devops.md`
**Type:** Create new file
**Estimate:** 20 minutes
**Dependencies:** Tasks 2, 3 (uses HITL and permissions)
**Stories:** US-8

**Description:**
Create DevOps agent definition:
- YAML frontmatter with restricted designation
- Capabilities: Docker, K8s, GCP/AWS, GitHub Actions
- Invocation protocol (PM CLI only, HITL required)
- Three options: local / DevOps CLI / instructions
- Guardrails for workstation
- Full freedom for container/K8s
- Audit requirements

**Acceptance Criteria:**
- [ ] File exists at `.claude/agents/devops.md`
- [ ] YAML frontmatter valid
- [ ] HITL requirement documented
- [ ] Three invocation options listed
- [ ] Workstation guardrails documented
- [ ] Container/K8s full freedom documented

- [x] Complete

---

### Task 11: Create diagram-builder skill
**File:** `.claude/skills/diagram-builder/SKILL.md`
**Type:** Create new file
**Estimate:** 20 minutes
**Dependencies:** None
**Stories:** US-12

**Description:**
Create diagram-builder skill:
- Auto-invocation triggers (design.md, new components, workflow changes)
- Step 1: Understand context from source files
- Step 2: Select diagram type (flowchart, sequence, class, state)
- Step 3: Generate following conventions
- Step 4: Save to docs/diagrams/{name}.mmd
- Step 5: Copy to hitl-ui if UI-visible
- Step 6: Update references

**Acceptance Criteria:**
- [ ] File exists at `.claude/skills/diagram-builder/SKILL.md`
- [ ] Auto-invocation triggers documented
- [ ] All 4 diagram types listed
- [ ] Output paths documented (docs/diagrams/, hitl-ui)
- [ ] Reference update process included

- [x] Complete

---

### Task 12: Update feature-completion skill
**File:** `.claude/skills/feature-completion/SKILL.md`
**Type:** Update
**Estimate:** 15 minutes
**Dependencies:** Task 9 (aligns with orchestrator role)
**Stories:** US-5

**Description:**
Update feature-completion skill:
- Add step for requesting orchestrator validation
- Add step for orchestrator running E2E
- Add step for orchestrator validating issues resolved
- Move commit step to orchestrator responsibility
- Keep existing verification steps

**Acceptance Criteria:**
- [ ] SKILL.md has orchestrator validation step
- [ ] SKILL.md has orchestrator E2E step
- [ ] Commit is attributed to orchestrator role
- [ ] Existing verification steps preserved

- [x] Complete

---

### Task 13: Delete implementer.md and update FILE_INDEX.md
**File:** `.claude/agents/implementer.md`, `.claude/FILE_INDEX.md`
**Type:** Delete + Update
**Estimate:** 10 minutes
**Dependencies:** Tasks 5, 6 (ensure no references first)
**Stories:** US-6

**Description:**
- Delete `.claude/agents/implementer.md`
- Update FILE_INDEX.md:
  - Remove implementer.md reference
  - Add all new files: pm-cli.md, hitl-gates.md, permissions.md, devops.md, diagram-builder/SKILL.md

**Acceptance Criteria:**
- [ ] `.claude/agents/implementer.md` does not exist
- [ ] FILE_INDEX.md updated with all new files
- [ ] FILE_INDEX.md no longer references implementer

- [x] Complete

---

### Task 14: Update settings.json permissions
**File:** `.claude/settings.json`
**Type:** Update
**Estimate:** 15 minutes
**Dependencies:** Task 3 (uses permissions definitions)
**Stories:** US-10

**Description:**
Update settings.json with environment-aware permissions:

Add to allow:
- `"Bash(python -m pytest:*)"`
- `"Bash(npm test:*)"`
- `"Bash(npm run lint:*)"`
- `"Bash(docker build:*)"`
- `"Bash(docker-compose up:*)"`
- `"Bash(kubectl get:*)"`
- `"Bash(kubectl describe:*)"`
- `"Bash(kubectl logs:*)"`
- `"Bash(helm list:*)"`
- `"Bash(helm status:*)"`
- `"mcp__coordination__*"`
- `"mcp__ide__getDiagnostics"`

Note: Deny rules for workstation-only restrictions are advisory (documented in permissions.md) since settings.json cannot be environment-conditional.

**Acceptance Criteria:**
- [ ] settings.json has new allow entries
- [ ] MCP coordination permissions added
- [ ] Test/lint permissions added
- [ ] Container operation permissions added

- [x] Complete

---

### Task 15: Update diagram .mmd files
**File:** `docs/diagrams/*.mmd`
**Type:** Update
**Estimate:** 15 minutes
**Dependencies:** Tasks 10, 13 (need new agent, remove old)
**Stories:** US-6

**Description:**
Update all Mermaid diagram files:
- Remove references to "implementer" agent
- Add "devops" agent where appropriate
- Update workflow diagrams to show 11 steps
- Update agent relationship diagrams

**Acceptance Criteria:**
- [ ] No diagram references "implementer"
- [ ] DevOps agent appears in relevant diagrams
- [ ] Workflow diagrams show 11 steps
- [ ] Agent relationships accurate

- [ ] Complete

---

### Task 16: Verify no broken references
**Type:** Verification
**Estimate:** 15 minutes
**Dependencies:** Tasks 1-15 (all changes complete)
**Stories:** All

**Description:**
Verify consistency across all modified files:
- Grep for "implementer" - should find no active references
- Verify 11-step workflow is consistently described
- Verify PM CLI role is consistently described
- Verify orchestrator E2E responsibility is consistent
- Verify all 6 roles documented consistently
- Verify all 7 HITL gates documented
- Check YAML frontmatter syntax in all agent/rule files
- Verify FILE_INDEX.md is accurate

**Acceptance Criteria:**
- [ ] No broken references
- [ ] No "implementer" references in active files
- [ ] Consistent terminology across files
- [ ] All YAML frontmatter valid
- [ ] All 6 roles consistent
- [ ] All 7 HITL gates consistent

- [x] Complete

---

## Progress

- Started: 2026-01-25
- Completed: 2026-01-25
- Tasks Complete: 16/16
- Percentage: 100%
- Status: COMPLETE
- Last Completed: Task 16 (verification) - 2026-01-25

## Dependencies Diagram

```
                    +------------------+
                    |                  |
         +--------->| Task 1 (pm-cli)  |
         |          |                  |
         |          +--------+---------+
         |                   |
         |                   v
         |          +--------+---------+       +------------------+
         |          |                  |       |                  |
         |   +----->| Task 4 (workflow)|<------| Task 2 (hitl)    |
         |   |      |                  |       |                  |
         |   |      +--------+---------+       +--------+---------+
         |   |               |                          |
         |   |               v                          v
         |   |      +--------+---------+       +--------+---------+
         |   |      |                  |       |                  |
         |   +------| Task 5 (CLAUDE)  |       | Task 3 (perms)   |
         |          |                  |       |                  |
         |          +--------+---------+       +--------+---------+
         |                   |                          |
         |                   v                          |
         |          +--------+---------+                |
         |          |                  |<---------------+
         +----------| Task 6 (identity)|
                    |                  |
                    +--------+---------+
                             |
             +---------------+---------------+
             |               |               |
             v               v               v
    +--------+-------+ +-----+------+ +------+-------+
    |                | |            | |              |
    | Task 7 (trunk) | | Task 8     | | Task 10      |
    |                | | (parallel) | | (devops.md)  |
    +--------+-------+ +-----+------+ +------+-------+
             |               |               |
             v               |               |
    +--------+-------+       |               |
    |                |<------+               |
    | Task 9 (orch)  |                       |
    |                |                       |
    +--------+-------+                       |
             |                               |
             v                               |
    +--------+-------+                       |
    |                |                       |
    | Task 12        |                       |
    | (feat-compl)   |                       |
    +--------+-------+                       |
             |                               |
             +---------------+---------------+
                             |
                             v
                    +--------+---------+
                    |                  |
                    | Task 11          |
                    | (diagram-builder)|
                    +--------+---------+
                             |
                             v
                    +--------+---------+
                    |                  |
                    | Task 13          |
                    | (delete impl)    |
                    +--------+---------+
                             |
             +---------------+---------------+
             |                               |
             v                               v
    +--------+-------+              +--------+-------+
    |                |              |                |
    | Task 14        |              | Task 15        |
    | (settings.json)|              | (diagrams.mmd) |
    +--------+-------+              +--------+-------+
             |                               |
             +---------------+---------------+
                             |
                             v
                    +--------+---------+
                    |                  |
                    | Task 16 (verify) |
                    |                  |
                    +------------------+
```

## Execution Order

For atomic task delegation with session renewal between each:

**Phase 1: Foundation (parallel)**
1. **Session 1:** Task 1 - Create pm-cli.md
2. **Session 2:** Task 2 - Create hitl-gates.md
3. **Session 3:** Task 3 - Create permissions.md
4. **Session 4:** Task 11 - Create diagram-builder skill (no dependencies)

**Phase 2: Core Workflow**
5. **Session 5:** Task 4 - Revise workflow.md (needs 1, 2, 3)

**Phase 3: Main Documentation**
6. **Session 6:** Task 5 - Revise CLAUDE.md (needs 4)
7. **Session 7:** Task 6 - Update identity-selection.md (needs 1, 5)

**Phase 4: Supporting Rules**
8. **Session 8:** Task 7 - Update trunk-based-development.md (needs 5)
9. **Session 9:** Task 8 - Update parallel-coordination.md (needs 1, 2)

**Phase 5: Agents**
10. **Session 10:** Task 9 - Update orchestrator.md (needs 4, 7)
11. **Session 11:** Task 10 - Create devops.md (needs 2, 3)

**Phase 6: Skills**
12. **Session 12:** Task 12 - Update feature-completion skill (needs 9)

**Phase 7: Cleanup**
13. **Session 13:** Task 13 - Delete implementer.md + update FILE_INDEX.md (needs 5, 6)
14. **Session 14:** Task 14 - Update settings.json (needs 3)
15. **Session 15:** Task 15 - Update diagram .mmd files (needs 10, 13)

**Phase 8: Verification**
16. **Session 16:** Task 16 - Verify no broken references (needs all)

## Notes

- All tasks are documentation/configuration only - no implementation code
- Each task is atomic and can be completed in one session
- Session renewal recommended between tasks to maintain fresh context
- Orchestrator agent should execute these tasks (meta file changes)
- Tasks 1, 2, 3, 11 can run in parallel (no dependencies)
- Total estimated time: ~4.5 hours
- See `draft-v2-expanded.md` for full specifications and context
