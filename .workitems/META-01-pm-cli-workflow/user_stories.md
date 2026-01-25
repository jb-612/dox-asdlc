# User Stories: PM CLI Workflow Establishment (Expanded)

**Work Item:** META-01-pm-cli-workflow
**Date:** 2026-01-25
**Status:** In Progress

## Epic Summary

As a developer using this codebase, I need a clear, documented workflow where the main Claude session acts as a Project Manager that plans and delegates work to specialized agents, with environment-aware permissions, multi-CLI coordination, and HITL gates for critical operations, so that features are developed consistently with proper planning, TDD execution, and coordination.

---

## User Stories

### US-1: PM CLI Role Understanding

**As a** developer starting a new session
**I want** the main Claude session to automatically behave as a Project Manager
**So that** I do not need to select a role or invoke special commands to start planning work

**Acceptance Criteria:**
- [ ] CLAUDE.md clearly states the main session is PM CLI by default
- [ ] PM CLI responsibilities are documented (plan, delegate, track, NOT implement)
- [ ] A new pm-cli.md rule file exists with detailed behavior
- [ ] identity-selection.md clarifies PM CLI is the default

**Test:**
- Read CLAUDE.md and confirm PM CLI role is prominently documented
- Read pm-cli.md and confirm it defines PM CLI behavior
- Read identity-selection.md and confirm it mentions PM CLI as default

---

### US-2: 11-Step Workflow Documentation

**As a** developer working on a feature
**I want** a clear 11-step workflow documented in the rules
**So that** I know exactly what sequence of steps to follow from planning to closure

**Acceptance Criteria:**
- [ ] workflow.md contains all 11 steps in order
- [ ] Each step has clear entry/exit criteria
- [ ] Session renewal requirement is documented
- [ ] HITL gates are indicated at relevant steps
- [ ] CLAUDE.md references the 11-step workflow

**Test:**
- Read workflow.md and confirm all 11 steps are present:
  1. Workplan
  2. Planning
  3. Diagrams
  4. Design Review
  5. Re-plan
  6. Parallel Build
  7. Testing
  8. Review
  9. Orchestration
  10. DevOps
  11. Closure
- Confirm HITL gates are documented at steps 4, 7, 9, 10

---

### US-3: Role Clarity

**As a** developer delegating tasks
**I want** a clear table showing all 6 roles, their purposes, and domains
**So that** I know which agent to invoke for each type of work

**Acceptance Criteria:**
- [ ] CLAUDE.md contains a role table with 6 roles
- [ ] Each role has: name, purpose, domain, invoker
- [ ] Roles documented: planner, backend, frontend, reviewer, orchestrator, devops
- [ ] implementer role is NOT listed (deprecated)
- [ ] DevOps role clearly marked as HITL-required

**Test:**
- Read CLAUDE.md and find role table
- Confirm table has exactly 6 rows
- Confirm implementer is not mentioned as an active role
- Confirm devops shows HITL requirement

---

### US-4: Atomic Task Delegation

**As a** PM CLI delegating work
**I want** documentation that enforces one atomic task at a time
**So that** I avoid context drift and maintain traceability

**Acceptance Criteria:**
- [ ] orchestrator.md documents atomic task delegation
- [ ] pm-cli.md documents session renewal after each task
- [ ] workflow.md step 6 emphasizes one task at a time

**Test:**
- Read orchestrator.md and find "atomic" or "one task at a time" guidance
- Read pm-cli.md and find session renewal protocol
- Read workflow.md step 6 and confirm atomic task mention

---

### US-5: Orchestrator E2E Responsibility

**As a** developer completing a feature
**I want** clear documentation that orchestrator runs E2E tests
**So that** integration validation happens at the right coordination layer

**Acceptance Criteria:**
- [ ] feature-completion/SKILL.md has orchestrator E2E step
- [ ] orchestrator.md mentions E2E responsibility
- [ ] workflow.md step 9 assigns E2E to orchestrator

**Test:**
- Read feature-completion/SKILL.md and find orchestrator E2E step
- Read orchestrator.md and find E2E mention
- Read workflow.md step 9 and confirm orchestrator runs E2E

---

### US-6: Implementer Agent Removal

**As a** developer invoking agents
**I want** the redundant implementer agent removed
**So that** I do not accidentally invoke a deprecated agent

**Acceptance Criteria:**
- [ ] .claude/agents/implementer.md is deleted
- [ ] No references to implementer agent in other files
- [ ] Backend and frontend agents are the implementation agents
- [ ] FILE_INDEX.md updated to remove implementer reference
- [ ] Diagram files updated to remove implementer references

**Test:**
- Confirm .claude/agents/implementer.md does not exist
- Grep for "implementer" in .claude/ and docs/ - should find no active references
- Confirm backend.md and frontend.md exist

---

### US-7: Non-Negotiable Rules

**As a** developer using this codebase
**I want** non-negotiable rules prominently documented
**So that** I understand which rules cannot be bypassed

**Acceptance Criteria:**
- [ ] CLAUDE.md has "Non-Negotiable Rules" section
- [ ] Rules include: plan before code, TDD required, commit only complete, review findings become issues
- [ ] Orchestrator meta file ownership is documented

**Test:**
- Read CLAUDE.md and find "Non-Negotiable Rules" section
- Confirm all 4 rules are listed
- Confirm orchestrator ownership of meta files is mentioned

---

### US-8: DevOps Agent Invocation with HITL

**As a** PM CLI coordinating infrastructure work
**I want** a DevOps agent that requires HITL confirmation before execution
**So that** dangerous infrastructure operations are always human-approved

**Acceptance Criteria:**
- [ ] devops.md agent file exists with restricted invocation rules
- [ ] HITL gate documented for all devops invocations
- [ ] Three invocation options documented: local / DevOps CLI / instructions
- [ ] hitl-gates.md includes DevOps Invocation gate definition
- [ ] Guardrails documented for workstation vs container/K8s

**Test:**
- Read devops.md and confirm HITL requirement
- Read hitl-gates.md and find DevOps Invocation gate
- Confirm three invocation options are documented
- Confirm environment-specific guardrails are defined

---

### US-9: Multi-CLI Coordination via Redis MCP

**As a** PM CLI sending work to a separate DevOps CLI
**I want** Redis MCP message types for coordination
**So that** I can track devops operations across CLI windows

**Acceptance Criteria:**
- [ ] parallel-coordination.md documents multi-CLI pattern
- [ ] Five new message types documented: DEVOPS_REQUEST, DEVOPS_STARTED, DEVOPS_COMPLETE, DEVOPS_FAILED, PERMISSION_FORWARD
- [ ] pm-cli.md references Redis MCP for devops coordination
- [ ] Message flow diagram included

**Test:**
- Read parallel-coordination.md and find multi-CLI section
- Find all 5 message types documented
- Confirm pm-cli.md mentions Redis MCP coordination

---

### US-10: Environment-Aware Permissions

**As a** developer running commands
**I want** permissions that adapt to the environment (container vs workstation)
**So that** I have full freedom in isolated environments but safety on my workstation

**Acceptance Criteria:**
- [ ] permissions.md rule file exists with environment detection logic
- [ ] Container/K8s detection documented (/.dockerenv, KUBERNETES_SERVICE_HOST)
- [ ] Full freedom tier documented for container/K8s
- [ ] Restricted tier documented for workstation
- [ ] settings.json updated with environment-aware permissions

**Test:**
- Read permissions.md and find environment detection
- Confirm two permission tiers are documented
- Confirm workstation restrictions include: no --force, no rm -rf, no kubectl delete
- Check settings.json for updated permission rules

---

### US-11: Chrome Extension Advisory for Complex Ops

**As a** PM CLI handling complex operations
**I want** an advisory pattern for Chrome extension usage
**So that** I can suggest multi-window workflows for large refactorings

**Acceptance Criteria:**
- [ ] pm-cli.md documents Chrome extension advisory pattern
- [ ] Triggers documented: >10 files, cross-domain, infra+code, visual review
- [ ] Advisory message template included
- [ ] workflow.md step 5 mentions advisory option

**Test:**
- Read pm-cli.md and find Chrome advisory section
- Confirm all 4 triggers are documented
- Confirm advisory message template is provided
- Read workflow.md step 5 and find advisory mention

---

### US-12: Diagram Auto-Generation During Planning

**As a** planner creating design documents
**I want** automatic diagram generation for architecture
**So that** designs include visual representations without manual effort

**Acceptance Criteria:**
- [ ] diagram-builder/SKILL.md exists with auto-invocation rules
- [ ] Auto-triggers documented: design.md creation, new components, workflow changes
- [ ] Diagram types documented: flowchart, sequence, class, state
- [ ] Output paths documented: docs/diagrams/, hitl-ui copy
- [ ] Reference update process documented

**Test:**
- Read diagram-builder/SKILL.md and find auto-invocation triggers
- Confirm all 4 diagram types are mentioned
- Confirm output paths include both docs/diagrams/ and hitl-ui

---

## Definition of Done

All user stories are complete when:
1. All acceptance criteria checked
2. All tests pass (manual verification)
3. No references to deprecated implementer agent
4. 11-step workflow is consistently documented across all affected files
5. PM CLI role is clearly established as default behavior
6. All 6 roles documented with correct domains
7. All 7 HITL gates defined and documented
8. Environment-aware permissions implemented
9. Multi-CLI coordination pattern documented
10. Chrome extension advisory pattern documented
11. Diagram-builder skill created and documented
