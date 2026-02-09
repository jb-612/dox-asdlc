# P12-F01: TDD Separation - Tasks

## Overview

This task breakdown covers implementing agent-level TDD separation: a test-writer agent, a debugger agent, updated TDD skill, new guardrails guidelines, and workflow/documentation updates.

## Dependencies

### External Dependencies

- P01-F07: CLI role subagents - COMPLETE
- P11-F01: Guardrails configuration system - COMPLETE (95%)
- Existing agent definitions at `.claude/agents/` - COMPLETE
- Existing tdd-execution skill - COMPLETE

### Phase Dependencies

```
Phase 1 (Agent Definitions) ──────────┐
                                       ├──► Phase 3 (Skill & Workflow Updates)
Phase 2 (Guardrails Guidelines) ──────┘              │
                                                      ├──► Phase 5 (Documentation)
Phase 4 (Unit Tests) ◄───────────────────────────────┘
```

---

## Phase 1: Agent Definitions (Orchestrator)

### T01: Create test-writer Agent Definition

- [ ] Estimate: 45min
- [ ] File: `.claude/agents/test-writer.md`
- [ ] Dependencies: None
- [ ] Stories: US-01

**Description**: Create the test-writer agent definition file following the existing agent format (see backend.md, reviewer.md for reference).

**Subtasks**:
- [ ] Create `.claude/agents/test-writer.md` with YAML frontmatter (name, description, tools: Read/Write/Glob/Grep/Bash, model: inherit)
- [ ] Write system prompt describing the test-writer's responsibilities:
  - Read task specs from design.md, user_stories.md, tasks.md
  - Read existing interfaces and types to understand API surface
  - Write test files under tests/unit/ and tests/integration/
  - Run pytest to confirm tests FAIL (RED phase)
  - Never write implementation code
- [ ] Define path restrictions:
  - WRITE: `tests/unit/**`, `tests/integration/**`
  - READ: all source, specs, interfaces
  - BLOCKED: `src/**`, `docker/**`, `docs/**`, `contracts/**`, `.claude/**`
- [ ] Add coordination protocol (check messages on start, publish STATUS_UPDATE on completion)
- [ ] Add guardrails integration section with `guardrails_get_context(agent: "test-writer")`
- [ ] Add structured output contract (status, files_created, test_count, red_confirmed)

**Acceptance Criteria**:
- [ ] Agent file follows the same format as `.claude/agents/backend.md`
- [ ] Frontmatter includes name, description, tools, model
- [ ] System prompt clearly prohibits writing source code
- [ ] Guardrails integration section present

---

### T02: Create debugger Agent Definition

- [ ] Estimate: 45min
- [ ] File: `.claude/agents/debugger.md`
- [ ] Dependencies: None
- [ ] Stories: US-02

**Description**: Create the debugger agent definition file. This agent is READ-ONLY like the reviewer but focused on backward diagnosis of test failures.

**Subtasks**:
- [ ] Create `.claude/agents/debugger.md` with YAML frontmatter (name, description, tools: Read/Grep/Glob/Bash, model: inherit, disallowedTools: Write/Edit)
- [ ] Write system prompt describing the debugger's responsibilities:
  - Receive test failure context (test output, source files, error messages)
  - Trace from failing assertion backward through code to find root cause
  - Produce structured diagnostic report (root cause, location, expected vs actual, fix, confidence)
  - Never fix code directly
- [ ] Define the diagnostic report format template in the prompt
- [ ] Define path restrictions:
  - READ: all code, tests, logs
  - WRITE: none (READ-ONLY agent)
- [ ] Add coordination protocol
- [ ] Add guardrails integration section with `guardrails_get_context(agent: "debugger")`
- [ ] Add structured output contract (status, diagnosis object)

**Acceptance Criteria**:
- [ ] Agent file follows the same format as `.claude/agents/reviewer.md` (both are read-only)
- [ ] `disallowedTools: Write, Edit` present in frontmatter
- [ ] Diagnostic report format is documented in the prompt
- [ ] Guardrails integration section present

---

## Phase 2: Guardrails Guidelines (Backend)

### T03: Add Cognitive Isolation Guideline for test-writer

- [ ] Estimate: 30min
- [ ] File: `scripts/bootstrap_guardrails.py`
- [ ] Dependencies: None
- [ ] Stories: US-04

**Description**: Add the `cognitive-isolation-test-writer` guideline function to the bootstrap script.

**Subtasks**:
- [ ] Add `_cognitive_isolation_test_writer()` function to `scripts/bootstrap_guardrails.py`
- [ ] Guideline fields:
  - id: `cognitive-isolation-test-writer`
  - name: "Cognitive Isolation: Test Writer"
  - category: `cognitive_isolation`
  - priority: 900
  - condition: `agents: ["test-writer"]`
  - action type: `tool_restriction`
  - instruction: restricts Write to test directories only
  - tools_allowed: Read, Grep, Glob, Bash, Write
  - tools_denied: empty (path restriction handles Write scope)
  - metadata: source reference to this feature
- [ ] Add function call to `_build_default_guidelines()` list
- [ ] Verify idempotency (skip if guideline already exists)

**Acceptance Criteria**:
- [ ] Function returns a valid Guideline object
- [ ] Guideline matches the schema in design.md Section 6.1
- [ ] Bootstrap script still runs without error

---

### T04: Add Cognitive Isolation Guideline for debugger

- [ ] Estimate: 30min
- [ ] File: `scripts/bootstrap_guardrails.py`
- [ ] Dependencies: None
- [ ] Stories: US-05

**Description**: Add the `cognitive-isolation-debugger` guideline function to the bootstrap script.

**Subtasks**:
- [ ] Add `_cognitive_isolation_debugger()` function to `scripts/bootstrap_guardrails.py`
- [ ] Guideline fields:
  - id: `cognitive-isolation-debugger`
  - name: "Cognitive Isolation: Debugger"
  - category: `cognitive_isolation`
  - priority: 900
  - condition: `agents: ["debugger"]`
  - action type: `tool_restriction`
  - instruction: debugger is read-only, output diagnosis via stdout
  - tools_allowed: Read, Grep, Glob, Bash
  - tools_denied: Write, Edit
  - metadata: source reference to this feature
- [ ] Add function call to `_build_default_guidelines()` list

**Acceptance Criteria**:
- [ ] Function returns a valid Guideline object
- [ ] tools_denied includes Write and Edit
- [ ] Bootstrap script still runs without error

---

### T05: Add TDD Protocol Guidelines

- [ ] Estimate: 45min
- [ ] File: `scripts/bootstrap_guardrails.py`
- [ ] Dependencies: None
- [ ] Stories: US-06

**Description**: Add two TDD protocol guidelines: test-writer protocol and debugger escalation.

**Subtasks**:
- [ ] Add `_tdd_test_writer_protocol()` function:
  - id: `tdd-test-writer-protocol`
  - category: `tdd_protocol`
  - priority: 800
  - condition: `agents: ["test-writer"], actions: ["test", "implement"]`
  - action type: `constraint`
  - instruction: tests must fail initially (RED), serve as work spec for coder
  - require_tests: true
- [ ] Add `_tdd_debugger_escalation()` function:
  - id: `tdd-debugger-escalation`
  - category: `tdd_protocol`
  - priority: 850
  - condition: `agents: ["backend", "frontend"], actions: ["implement", "fix", "debug"], events: ["test_failure_repeated"]`
  - action type: `hitl_gate`
  - gate_type: `test_failure_escalation`
  - gate_threshold: `advisory`
  - instruction: after 3+ failures, present HITL Gate 6 with debugger option
- [ ] Add both function calls to `_build_default_guidelines()` list

**Acceptance Criteria**:
- [ ] Both functions return valid Guideline objects
- [ ] test-writer protocol requires tests
- [ ] debugger escalation is an advisory HITL gate
- [ ] Bootstrap script still runs without error

---

### T06: Update Existing TDD Protocol Guideline

- [ ] Estimate: 15min
- [ ] File: `scripts/bootstrap_guardrails.py`
- [ ] Dependencies: T03, T04, T05
- [ ] Stories: US-06

**Description**: Update the instruction text of the existing `tdd-protocol` guideline to reference the three-agent TDD flow.

**Subtasks**:
- [ ] Locate `_tdd_protocol()` function in bootstrap script
- [ ] Update instruction text to describe three-agent flow:
  1. test-writer creates failing tests from spec (RED)
  2. Coding agent writes minimal code to pass tests (GREEN)
  3. If >3 failures, debugger provides root-cause analysis
  4. Coding agent applies fix instructions
  5. REFACTOR while tests remain green
- [ ] Ensure the guideline is still idempotent (version handling)

**Acceptance Criteria**:
- [ ] Updated instruction mentions test-writer, coder, and debugger
- [ ] Five-step TDD flow clearly documented
- [ ] No breaking changes to existing guideline structure

---

## Phase 3: Skill & Workflow Updates (Orchestrator)

### T07: Update TDD Execution Skill

- [ ] Estimate: 45min
- [ ] File: `.claude/skills/tdd-execution/SKILL.md`
- [ ] Dependencies: T01, T02
- [ ] Stories: US-03

**Description**: Rewrite the tdd-execution skill to describe the three-agent TDD workflow.

**Subtasks**:
- [ ] Update YAML frontmatter description to mention three-agent flow
- [ ] Rewrite Phase 1 (RED) to describe test-writer agent:
  - PM CLI invokes test-writer with task spec
  - test-writer reads design.md, user_stories.md, tasks.md
  - test-writer writes test files and confirms they FAIL
- [ ] Rewrite Phase 2 (GREEN) to describe coder receiving tests:
  - PM CLI invokes backend/frontend with test file references
  - Coder writes minimal code to make tests pass
  - Coder runs pytest to confirm GREEN
- [ ] Add Phase 3 (DIAGNOSE) for debugger escalation:
  - After 3+ consecutive failures, HITL Gate 6 triggered
  - If user selects debugger option, PM CLI invokes debugger
  - Debugger produces diagnostic report
  - PM CLI re-invokes coder with fix instructions
- [ ] Keep Phase 4 (REFACTOR) for cleanup after GREEN
- [ ] Add failure escalation protocol table
- [ ] Keep Anti-Patterns section, update for three-agent context
- [ ] Add Task Completion section (same as current)

**Acceptance Criteria**:
- [ ] Skill describes test-writer, coder, and debugger roles clearly
- [ ] RED phase explicitly invokes test-writer (not coder)
- [ ] GREEN phase explicitly references test files from test-writer
- [ ] DIAGNOSE phase describes debugger escalation
- [ ] Anti-patterns updated for three-agent context

---

### T08: Update HITL Gate 6

- [ ] Estimate: 30min
- [ ] File: `.claude/rules/hitl-gates.md`
- [ ] Dependencies: T02
- [ ] Stories: US-07

**Description**: Update Gate 6 (Test Failures Greater Than 3) to include the debugger agent option.

**Subtasks**:
- [ ] Update Gate 6 trigger description to mention debugger escalation
- [ ] Update question format to four options:
  - A) Invoke debugger agent for root-cause analysis
  - B) Continue manual debugging (coder retries)
  - C) Skip test and proceed (mark as known issue)
  - D) Abort task
- [ ] Update behavior section:
  - Option A: PM CLI invokes debugger agent, receives diagnosis, re-invokes coder with fix instructions
  - Option B: Continue TDD debugging loop (current behavior)
  - Option C: Skip test, create GitHub issue
  - Option D: Abort current task
- [ ] Update Summary Table to reflect four options

**Acceptance Criteria**:
- [ ] Gate 6 has four options (was three)
- [ ] Option A clearly describes debugger invocation
- [ ] Behavior section describes full debugger flow
- [ ] No changes to other gates

---

### T09: Update Workflow Rules (Steps 6-7)

- [ ] Estimate: 30min
- [ ] File: `.claude/rules/workflow.md`
- [ ] Dependencies: T07, T08
- [ ] Stories: US-08

**Description**: Update Steps 6 (Parallel Build) and 7 (Testing) in the workflow rules.

**Subtasks**:
- [ ] Update Step 6 description:
  - For each atomic task, PM CLI invokes test-writer first
  - test-writer produces test files (RED confirmed)
  - PM CLI then invokes backend/frontend with test file references
  - Coder writes minimal code to pass (GREEN)
- [ ] Update Step 6 TDD Protocol section to reference three-agent flow
- [ ] Update Step 7 description:
  - Include debugger escalation path
  - Reference HITL Gate 6 with debugger option
  - Describe diagnosis -> fix instructions -> coder retry flow
- [ ] Update Skills Integration table to include test-writer and debugger
- [ ] Update Overview ASCII art to show test-writer/debugger

**Acceptance Criteria**:
- [ ] Step 6 describes test-writer invocation before coder
- [ ] Step 7 includes debugger escalation flow
- [ ] Skills table reflects new agent involvement
- [ ] Overview diagram updated

---

### T10: Update Agent Registry Files

- [ ] Estimate: 30min
- [ ] Files: `CLAUDE.md`, `.claude/rules/identity-selection.md`, `.claude/rules/parallel-coordination.md`
- [ ] Dependencies: T01, T02
- [ ] Stories: US-09

**Description**: Add test-writer and debugger to all agent registry locations.

**Subtasks**:
- [ ] Update `CLAUDE.md`:
  - Add test-writer row to Roles table: Purpose "Writes tests from specs (RED phase)", Domain "tests/"
  - Add debugger row to Roles table: Purpose "Backward diagnosis of failures", Domain "All (read-only)"
  - Update agent count references if any
- [ ] Update `.claude/rules/identity-selection.md`:
  - Add test-writer and debugger to Available Subagent Roles table
  - Add invocation examples
- [ ] Update `.claude/rules/parallel-coordination.md`:
  - Add test-writer path restrictions (Write: tests/, Read: all)
  - Add debugger path restrictions (Write: none, Read: all)
  - Add to Subagent Roles table

**Acceptance Criteria**:
- [ ] All three registry files include both new agents
- [ ] Path restrictions are consistent across all files
- [ ] Invocation examples are correct

---

## Phase 4: Unit Tests (Backend)

### T11: Write Unit Tests for New Guidelines

- [ ] Estimate: 1hr
- [ ] File: `tests/unit/core/guardrails/test_tdd_guidelines.py`
- [ ] Dependencies: T03, T04, T05, T06
- [ ] Stories: US-11

**Description**: Create unit tests verifying the four new guidelines evaluate correctly against various task contexts.

**Subtasks**:
- [ ] Create `tests/unit/core/guardrails/test_tdd_guidelines.py`
- [ ] Test cognitive-isolation-test-writer:
  - Matches test-writer agent context
  - Does NOT match backend agent context
  - Does NOT match frontend agent context
  - tools_allowed includes Write
  - Instruction mentions test directories
- [ ] Test cognitive-isolation-debugger:
  - Matches debugger agent context
  - Does NOT match backend agent context
  - tools_denied includes Write and Edit
  - tools_allowed does NOT include Write or Edit
- [ ] Test tdd-test-writer-protocol:
  - Matches test-writer agent with action "test"
  - Matches test-writer agent with action "implement"
  - Does NOT match backend agent
  - require_tests is true
- [ ] Test tdd-debugger-escalation:
  - Matches backend agent with event "test_failure_repeated"
  - Matches frontend agent with event "test_failure_repeated"
  - Does NOT match test-writer agent
  - Does NOT match without the event
  - gate_type is "test_failure_escalation"
  - gate_threshold is "advisory"
- [ ] Test updated tdd-protocol instruction mentions three-agent flow
- [ ] Verify all tests pass: `pytest tests/unit/core/guardrails/test_tdd_guidelines.py -v`

**Acceptance Criteria**:
- [ ] All positive and negative matching tests pass
- [ ] Tests cover all four new guidelines
- [ ] Tests verify the updated tdd-protocol instruction
- [ ] Test file follows naming convention

---

### T12: Validate Agent Definitions

- [ ] Estimate: 30min
- [ ] Files: `.claude/agents/test-writer.md`, `.claude/agents/debugger.md`
- [ ] Dependencies: T01, T02
- [ ] Stories: US-01, US-02

**Description**: Validate that the new agent definitions parse correctly and contain all required fields.

**Subtasks**:
- [ ] Verify test-writer.md YAML frontmatter parses (name, description, tools, model)
- [ ] Verify debugger.md YAML frontmatter parses (name, description, tools, model, disallowedTools)
- [ ] Verify test-writer.md contains guardrails integration section
- [ ] Verify debugger.md contains guardrails integration section
- [ ] Verify debugger.md includes disallowedTools: Write, Edit
- [ ] Compare format consistency with existing agents (backend.md, reviewer.md)
- [ ] Verify no syntax errors in markdown

**Acceptance Criteria**:
- [ ] Both agent files have valid YAML frontmatter
- [ ] Both files contain all required sections
- [ ] Format is consistent with existing agent definitions

---

## Phase 5: Documentation (Orchestrator)

### T13: Update Guardrails README

- [ ] Estimate: 30min
- [ ] File: `docs/guardrails/README.md`
- [ ] Dependencies: T03, T04, T05
- [ ] Stories: US-12

**Description**: Update the guardrails documentation to include the new default guidelines and TDD separation pattern.

**Subtasks**:
- [ ] Update "Default Guidelines" table to add four new rows (total: 15)
- [ ] Add TDD Separation pattern example in "Common Patterns" section showing:
  - cognitive-isolation-test-writer guideline JSON
  - tdd-debugger-escalation guideline JSON
- [ ] Update Component Overview table to mention test-writer and debugger agents
- [ ] Update the `guardrails_get_context` agent enum in MCP Tool Reference to include "test-writer" and "debugger"

**Acceptance Criteria**:
- [ ] Default guidelines table shows 15 entries
- [ ] TDD Separation pattern is documented with full JSON examples
- [ ] Agent enum includes test-writer and debugger

---

## Progress

- **Started**: Not started
- **Tasks Complete**: 0/13
- **Percentage**: 0%
- **Status**: PLANNED
- **Blockers**: None

## Task Summary

| Phase | Tasks | Estimate | Status |
|-------|-------|----------|--------|
| Phase 1: Agent Definitions | T01-T02 | 1.5hr | [ ] |
| Phase 2: Guardrails Guidelines | T03-T06 | 2hr | [ ] |
| Phase 3: Skill & Workflow Updates | T07-T10 | 2.25hr | [ ] |
| Phase 4: Unit Tests | T11-T12 | 1.5hr | [ ] |
| Phase 5: Documentation | T13 | 0.5hr | [ ] |

**Total Estimated Time**: ~7.75 hours

## Implementation Order (Recommended Build Sequence)

```
Phase 1 + Phase 2 (parallel) -> Phase 3 -> Phase 4 -> Phase 5
```

**Batch 1 (Parallel - ~2hr):**
- T01 (test-writer agent) + T03 (test-writer guardrail) -- can be done together
- T02 (debugger agent) + T04 (debugger guardrail) -- can be done together

**Batch 2 (~1hr):**
- T05 (TDD protocol guidelines)
- T06 (update existing TDD guideline)

**Batch 3 (~2.25hr):**
- T07 (TDD skill update)
- T08 (HITL Gate 6 update)
- T09 (workflow rules)
- T10 (agent registry files)

**Batch 4 (~1.5hr):**
- T11 (unit tests for guidelines)
- T12 (validate agent definitions)

**Batch 5 (~0.5hr):**
- T13 (documentation)

## Task Dependencies

```
T01 ──────┐
           ├──► T07 ──► T09 ──┐
T02 ──────┤                    ├──► T12 ──► T13
           ├──► T08 ──────────┘         │
T03 ──────┤                              │
           ├──► T06 ──► T11 ────────────┘
T04 ──────┤
           │
T05 ──────┘

T10 depends on T01, T02
```

## Risk Mitigation

1. **Agent format consistency**: Compare new agents with existing backend.md and reviewer.md to ensure format matches exactly
2. **Guardrails bootstrap idempotency**: Test that running bootstrap twice does not create duplicate guidelines
3. **PreToolUse enforcement**: Verify the existing PreToolUse hook correctly reads the new cognitive isolation guidelines from cache
4. **Workflow regression**: Review existing workflow.md carefully before modifying Steps 6-7 to preserve all existing content

## Notes

### Owner Assignment

All files in this feature are meta files (`.claude/agents/`, `.claude/skills/`, `.claude/rules/`, `docs/`, `CLAUDE.md`) and the bootstrap script. Per the project's path restrictions:

- **Orchestrator agent** owns: agent definitions, skills, rules, docs, CLAUDE.md
- **Backend agent** owns: `scripts/bootstrap_guardrails.py`, `tests/unit/core/guardrails/`

Tasks should be delegated accordingly:
- T01, T02, T07-T10, T13: orchestrator agent
- T03-T06, T11: backend agent
- T12: either agent (validation only)

### Testing Strategy

- Unit tests (T11) mock the ES client and test guideline evaluation logic
- Agent definition validation (T12) is structural (YAML parsing, field presence)
- No integration tests needed for this feature (agent definitions and guidelines are declarative artifacts)
- Full integration testing happens naturally when agents are first invoked in real workflows
