# User Stories: P12-F01 TDD Separation - UT Agent & Debugger Agent

## Epic Reference

This feature addresses Guardrails Constitution gaps C1 (No separate UT Agent) and H1 (No Debugger Agent) by implementing agent-level separation between test-writing, code-writing, and debugging activities.

## Epic Summary

As a project maintainer, I want test-writing and debugging performed by dedicated agents separate from the coding agent, so that cognitive mode isolation is enforced and the TDD protocol follows the Guardrails Constitution requirement for distinct Forward Synthesis (Tests), Forward Synthesis (Code), and Backward Diagnosis modes.

## User Stories

### US-01: Test-Writer Agent Definition

**As a** PM CLI operator
**I want** a dedicated test-writer agent that creates test files from specifications
**So that** tests are written independently from implementation, ensuring unbiased test coverage

**Acceptance Criteria:**
- [ ] `.claude/agents/test-writer.md` exists with proper frontmatter (name, description, tools, model)
- [ ] Agent has READ access to all source code, design.md, user_stories.md, tasks.md
- [ ] Agent has WRITE access restricted to `tests/unit/**` and `tests/integration/**`
- [ ] Agent CANNOT write to `src/**`, `docker/**`, `docs/**`, `contracts/**`, or `.claude/**`
- [ ] Agent instructions specify reading specs first, then writing tests
- [ ] Agent verifies tests FAIL (RED phase) before reporting completion
- [ ] Agent follows test naming convention: `test_{function}_{scenario}_{outcome}()`
- [ ] Agent publishes STATUS_UPDATE on completion
- [ ] Agent includes guardrails integration section calling `guardrails_get_context(agent: "test-writer")`

**Priority:** Critical

---

### US-02: Debugger Agent Definition

**As a** PM CLI operator
**I want** a dedicated debugger agent that performs backward diagnosis on repeated test failures
**So that** complex faults are analyzed systematically without the coding agent mixing diagnosis with implementation

**Acceptance Criteria:**
- [ ] `.claude/agents/debugger.md` exists with proper frontmatter (name, description, tools, model, disallowedTools)
- [ ] Agent is READ-ONLY: `disallowedTools: Write, Edit` in frontmatter
- [ ] Agent has READ access to all source code, test files, and test output
- [ ] Agent produces a structured diagnostic report via stdout (not file writes)
- [ ] Diagnostic report includes: root cause, failing location (file/function/line), expected vs actual, recommended fix, confidence level
- [ ] Agent does NOT attempt to fix code directly
- [ ] Agent includes guardrails integration section calling `guardrails_get_context(agent: "debugger")`

**Priority:** Critical

---

### US-03: Updated TDD Execution Skill

**As a** developer following the TDD workflow
**I want** the tdd-execution skill updated to describe the three-agent handoff pattern
**So that** the PM CLI knows how to orchestrate test-writer, coder, and debugger agents

**Acceptance Criteria:**
- [ ] `.claude/skills/tdd-execution/SKILL.md` describes the three-agent flow: test-writer (RED), coder (GREEN), debugger (DIAGNOSE)
- [ ] Skill specifies that test-writer is invoked FIRST to produce failing tests
- [ ] Skill specifies that coder receives test file paths and makes them pass
- [ ] Skill specifies debugger escalation after 3+ consecutive failures
- [ ] Skill includes the failure escalation protocol table (fail count -> action)
- [ ] Skill references HITL Gate 6 for the debugger escalation decision
- [ ] REFACTOR phase still handled by the coder after tests pass

**Priority:** Critical

---

### US-04: Cognitive Isolation Guardrails for Test-Writer

**As a** guardrails system administrator
**I want** a cognitive isolation guideline preventing the test-writer from writing source code
**So that** the separation between test-writing and code-writing is enforced at runtime

**Acceptance Criteria:**
- [ ] `cognitive-isolation-test-writer` guideline exists in the bootstrap script
- [ ] Guideline condition matches `agents: ["test-writer"]`
- [ ] Guideline action restricts Write operations to `tests/unit/**` and `tests/integration/**`
- [ ] Guideline instruction states test-writer cannot modify source code under `src/`
- [ ] PreToolUse hook blocks Write to `src/**` when agent is test-writer
- [ ] Guideline has priority 900 (same as other cognitive isolation guidelines)
- [ ] Unit test verifies the guideline evaluates correctly for test-writer context

**Priority:** High

---

### US-05: Cognitive Isolation Guardrails for Debugger

**As a** guardrails system administrator
**I want** a cognitive isolation guideline enforcing read-only access for the debugger
**So that** the debugger cannot accidentally modify code while performing diagnosis

**Acceptance Criteria:**
- [ ] `cognitive-isolation-debugger` guideline exists in the bootstrap script
- [ ] Guideline condition matches `agents: ["debugger"]`
- [ ] Guideline action includes `tools_denied: ["Write", "Edit"]`
- [ ] Guideline instruction states debugger is read-only and must output diagnosis via stdout
- [ ] PreToolUse hook blocks Write and Edit when agent is debugger
- [ ] Guideline has priority 900
- [ ] Unit test verifies the guideline evaluates correctly for debugger context

**Priority:** High

---

### US-06: TDD Protocol Guidelines

**As a** guardrails system administrator
**I want** TDD protocol guidelines enforcing the RED phase for test-writer and debugger escalation for coders
**So that** the three-agent TDD workflow is dynamically enforced

**Acceptance Criteria:**
- [ ] `tdd-test-writer-protocol` guideline exists in bootstrap with category `tdd_protocol`
- [ ] `tdd-debugger-escalation` guideline exists in bootstrap with category `tdd_protocol`
- [ ] test-writer protocol enforces that tests must fail initially (RED confirmation)
- [ ] Debugger escalation triggers on `events: ["test_failure_repeated"]` for coders
- [ ] Existing `tdd-protocol` guideline instruction updated to reference three-agent flow
- [ ] Unit tests verify both new guidelines evaluate correctly

**Priority:** High

---

### US-07: Updated HITL Gate 6

**As a** developer experiencing repeated test failures
**I want** HITL Gate 6 to include an option to invoke the debugger agent
**So that** I get systematic root-cause analysis instead of ad-hoc debugging

**Acceptance Criteria:**
- [ ] `.claude/rules/hitl-gates.md` Gate 6 updated with four options: A) Invoke debugger, B) Continue manual debugging, C) Skip test, D) Abort task
- [ ] Gate 6 description mentions debugger agent performs backward diagnosis
- [ ] Gate 6 specifies that option A invokes debugger agent and returns diagnosis to PM CLI
- [ ] Gate 6 specifies that after debugger diagnosis, coder receives fix instructions
- [ ] Workflow.md Step 7 references the updated Gate 6

**Priority:** High

---

### US-08: Workflow Rules Update

**As a** PM CLI operator following the 11-step workflow
**I want** Steps 6 and 7 updated to reflect the test-writer and debugger agents
**So that** the workflow documentation matches the new TDD execution pattern

**Acceptance Criteria:**
- [ ] `.claude/rules/workflow.md` Step 6 (Parallel Build) updated to invoke test-writer before coder
- [ ] Step 6 specifies: test-writer writes tests -> coder makes them pass
- [ ] Step 7 (Testing) updated to include debugger escalation path
- [ ] Step 7 references HITL Gate 6 with the debugger option
- [ ] Skills integration table in workflow.md updated to show test-writer/debugger involvement

**Priority:** High

---

### US-09: Agent Registry Updates

**As a** developer looking up available agents
**I want** the test-writer and debugger agents documented in all agent registry locations
**So that** I know which agents are available and what they do

**Acceptance Criteria:**
- [ ] `CLAUDE.md` Roles table includes test-writer and debugger rows
- [ ] `.claude/rules/identity-selection.md` agent table includes test-writer and debugger
- [ ] `.claude/rules/parallel-coordination.md` path restrictions table includes test-writer and debugger
- [ ] test-writer domain listed as: `tests/unit/**, tests/integration/**`
- [ ] debugger domain listed as: `All (read-only), diagnostic reports (stdout)`

**Priority:** Medium

---

### US-10: Bootstrap Script Update

**As a** system maintainer
**I want** the guardrails bootstrap script updated with the four new guideline definitions
**So that** default guidelines are loaded for the new agents on system setup

**Acceptance Criteria:**
- [ ] `scripts/bootstrap_guardrails.py` includes `_cognitive_isolation_test_writer()` function
- [ ] Script includes `_cognitive_isolation_debugger()` function
- [ ] Script includes `_tdd_test_writer_protocol()` function
- [ ] Script includes `_tdd_debugger_escalation()` function
- [ ] Bootstrap is still idempotent (existing guidelines skipped)
- [ ] `--dry-run` mode shows the four new guidelines
- [ ] Default guidelines count increases from 11 to 15

**Priority:** Medium

---

### US-11: Unit Tests for New Guidelines

**As a** developer maintaining the guardrails system
**I want** unit tests verifying the new guidelines evaluate correctly
**So that** regressions in guideline evaluation are caught

**Acceptance Criteria:**
- [ ] `tests/unit/core/guardrails/test_tdd_guidelines.py` exists
- [ ] Tests verify cognitive-isolation-test-writer matches test-writer agent context
- [ ] Tests verify cognitive-isolation-test-writer does NOT match backend agent context
- [ ] Tests verify cognitive-isolation-debugger matches debugger agent context
- [ ] Tests verify cognitive-isolation-debugger denies Write and Edit tools
- [ ] Tests verify tdd-test-writer-protocol matches test-writer with action "test"
- [ ] Tests verify tdd-debugger-escalation matches backend with event "test_failure_repeated"
- [ ] Tests verify updated tdd-protocol instruction text references three-agent flow
- [ ] All tests pass with `pytest tests/unit/core/guardrails/test_tdd_guidelines.py -v`

**Priority:** High

---

### US-12: Documentation Updates

**As a** project maintainer
**I want** the guardrails documentation updated to include the new agent guidelines
**So that** users understand the TDD separation enforcement

**Acceptance Criteria:**
- [ ] `docs/guardrails/README.md` default guidelines table updated (11 -> 15 rows)
- [ ] README includes a "TDD Separation" pattern example showing three-agent flow
- [ ] README documents the test-writer and debugger agents in the component overview
- [ ] Pattern examples section includes cognitive isolation for test-writer
- [ ] Pattern examples section includes debugger escalation guideline

**Priority:** Low

---

## Non-Functional Requirements

### Cognitive Isolation

- Test-writer agent must NEVER write files under `src/`
- Debugger agent must NEVER write or edit any files
- Enforcement is layered: agent frontmatter (first line), guardrails PreToolUse hook (second line)

### Performance

- Agent handoff adds no more than 30 seconds of orchestration overhead per task
- Debugger diagnosis should complete within 2 minutes for typical failures
- No additional latency to agents that are not test-writer or debugger

### Compatibility

- Existing backend agent TDD flow continues to work if test-writer is not invoked
- No breaking changes to the backend or frontend agent definitions
- Existing guardrails guidelines are not modified (except tdd-protocol instruction text)

### Testability

- All new guidelines have unit tests
- Agent definitions can be validated by checking frontmatter fields
- TDD skill can be tested by verifying the documented sequence

## Story Dependencies

```
US-01 (test-writer agent) ----+
                               |
US-02 (debugger agent) -------+---> US-03 (tdd-execution skill update)
                               |         |
US-04 (test-writer guardrail) -+         +---> US-07 (HITL Gate 6)
                               |         |
US-05 (debugger guardrail) ---+         +---> US-08 (workflow rules)
                               |
US-06 (TDD protocol rules) ---+---> US-10 (bootstrap script)
                               |         |
                               |         +---> US-11 (unit tests)
                               |
US-09 (agent registry) -------+---> US-12 (documentation)
```

## Priority Summary

| Priority | Stories |
|----------|---------|
| Critical | US-01, US-02, US-03 |
| High | US-04, US-05, US-06, US-07, US-08, US-11 |
| Medium | US-09, US-10 |
| Low | US-12 |
