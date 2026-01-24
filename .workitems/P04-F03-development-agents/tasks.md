# P04-F03: Development Agents - Task Breakdown

## Overview

| Metric | Value |
|--------|-------|
| Total Tasks | 18 |
| Estimated Hours | ~28h |
| Dependencies | P03-F01, P03-F03, P02-F03, P04-F02 |
| Target Files | `src/workers/agents/development/` |

---

## Tasks

### T01: Development Configuration
**File:** `src/workers/agents/development/config.py`
**Estimate:** 1h
**Dependencies:** None

**Description:**
Create configuration for development agents:
- Per-agent model selection (Opus for reviewer)
- Retry limits and timeouts
- Coverage thresholds
- RLM integration settings

**Acceptance Criteria:**
- [x] `DevelopmentConfig` dataclass
- [x] Reviewer uses Opus model by default
- [x] Environment overrides supported
- [x] Unit tests for config

**Test:** `tests/unit/workers/agents/development/test_config.py`

---

### T02: Development Models
**File:** `src/workers/agents/development/models.py`
**Estimate:** 2h
**Dependencies:** None

**Description:**
Define domain models:
- `TestCase`, `TestSuite`
- `Implementation`, `CodeFile`
- `TestResult`, `TestRunResult`
- `CodeReview`, `ReviewIssue`
- `DebugAnalysis`, `CodeChange`

**Acceptance Criteria:**
- [x] All models with validation
- [x] JSON serialization
- [x] Unit tests for models

**Test:** `tests/unit/workers/agents/development/test_models.py`

---

### T03: UTest Agent Implementation
**File:** `src/workers/agents/development/utest_agent.py`
**Estimate:** 2h
**Dependencies:** T01, T02, P03-F01

**Description:**
Implement test-writing agent:
- Parse task and acceptance criteria
- Generate pytest test cases
- Create fixtures and setup
- Ensure tests will fail initially

**Acceptance Criteria:**
- [ ] Implements DomainAgent protocol
- [ ] Generates valid pytest code
- [ ] Tests map to acceptance criteria
- [ ] Unit tests with mocked LLM

**Test:** `tests/unit/workers/agents/development/test_utest_agent.py`

---

### T04: UTest Prompt Engineering
**File:** `src/workers/agents/development/prompts/utest_prompts.py`
**Estimate:** 1.5h
**Dependencies:** None

**Description:**
Create prompts for test generation:
- Test case generation prompt
- Fixture creation prompt
- Coverage analysis prompt

**Acceptance Criteria:**
- [x] Prompts produce pytest syntax
- [x] Examples included
- [x] Unit tests for formatting

**Test:** `tests/unit/workers/agents/development/prompts/test_utest_prompts.py`

---

### T05: Coding Agent Implementation
**File:** `src/workers/agents/development/coding_agent.py`
**Estimate:** 2.5h
**Dependencies:** T01, T02, P03-F01, P03-F03

**Description:**
Implement RLM-enabled coding agent:
- Generate implementation to pass tests
- Integrate with RLM for complex tasks
- Handle retry context (fail_count)
- Apply debug fixes when provided

**Acceptance Criteria:**
- [ ] Implements DomainAgent protocol
- [ ] RLM integration works
- [ ] Responds to fail_count
- [ ] Unit tests with mocked LLM

**Test:** `tests/unit/workers/agents/development/test_coding_agent.py`

---

### T06: Coding Prompt Engineering
**File:** `src/workers/agents/development/prompts/coding_prompts.py`
**Estimate:** 1.5h
**Dependencies:** None

**Description:**
Create prompts for code generation:
- Implementation generation prompt
- Test-passing focus prompt
- Style compliance prompt

**Acceptance Criteria:**
- [x] Prompts target test suite
- [x] Style guidelines enforced
- [x] Unit tests for formatting

**Test:** `tests/unit/workers/agents/development/prompts/test_coding_prompts.py`

---

### T07: Test Runner Utility
**File:** `src/workers/agents/development/test_runner.py`
**Estimate:** 1.5h
**Dependencies:** T02

**Description:**
Create test execution utility:
- Run pytest programmatically
- Capture output and errors
- Calculate coverage
- Return structured results

**Acceptance Criteria:**
- [ ] Executes pytest tests
- [ ] Captures all output
- [ ] Coverage calculation
- [ ] Timeout handling
- [ ] Unit tests for runner

**Test:** `tests/unit/workers/agents/development/test_test_runner.py`

---

### T08: Debugger Agent Implementation
**File:** `src/workers/agents/development/debugger_agent.py`
**Estimate:** 2h
**Dependencies:** T01, T02, P03-F01, P03-F03

**Description:**
Implement RLM-enabled debugger:
- Analyze test failures
- Research solutions via RLM
- Generate fix suggestions
- Provide actionable code changes

**Acceptance Criteria:**
- [ ] Implements DomainAgent protocol
- [ ] Always uses RLM
- [ ] Root cause analysis
- [ ] Unit tests with mocked LLM

**Test:** `tests/unit/workers/agents/development/test_debugger_agent.py`

---

### T09: Debugger Prompt Engineering
**File:** `src/workers/agents/development/prompts/debugger_prompts.py`
**Estimate:** 1h
**Dependencies:** None

**Description:**
Create prompts for debugging:
- Failure analysis prompt
- Root cause identification prompt
- Fix suggestion prompt

**Acceptance Criteria:**
- [x] Structured analysis output
- [x] Actionable fixes
- [x] Unit tests for formatting

**Test:** `tests/unit/workers/agents/development/prompts/test_debugger_prompts.py`

---

### T10: Reviewer Agent Implementation
**File:** `src/workers/agents/development/reviewer_agent.py`
**Estimate:** 2h
**Dependencies:** T01, T02, P03-F01

**Description:**
Implement code review agent using Opus:
- Review implementation quality
- Check security concerns
- Verify style compliance
- Generate review summary

**Acceptance Criteria:**
- [ ] Implements DomainAgent protocol
- [ ] Uses Opus model
- [ ] Security check included
- [ ] Unit tests with mocked LLM

**Test:** `tests/unit/workers/agents/development/test_reviewer_agent.py`

---

### T11: Reviewer Prompt Engineering
**File:** `src/workers/agents/development/prompts/reviewer_prompts.py`
**Estimate:** 1h
**Dependencies:** None

**Description:**
Create prompts for code review:
- Quality review prompt
- Security review prompt
- Style compliance prompt

**Acceptance Criteria:**
- [x] Comprehensive review criteria
- [x] Issue categorization
- [x] Unit tests for formatting

**Test:** `tests/unit/workers/agents/development/prompts/test_reviewer_prompts.py`

---

### T12: TDD Orchestrator
**File:** `src/workers/agents/development/tdd_orchestrator.py`
**Estimate:** 2h
**Dependencies:** T03, T05, T07, T08, T10

**Description:**
Implement TDD loop coordination:
- Sequence: UTest → Coding → Test → Review/Retry
- Handle fail_count and escalation
- Submit to HITL-4 on success

**Acceptance Criteria:**
- [ ] Complete TDD loop
- [ ] Retry logic correct
- [ ] Debugger escalation works
- [ ] Unit tests for orchestration

**Test:** `tests/unit/workers/agents/development/test_tdd_orchestrator.py`

---

### T13: HITL-4 Evidence Bundle
**File:** `src/workers/agents/development/tdd_orchestrator.py`
**Estimate:** 1h
**Dependencies:** T12, P02-F03

**Description:**
Create HITL-4 evidence bundle:
- Package implementation, tests, results
- Include review summary
- Include coverage report
- Submit to HITLDispatcher

**Acceptance Criteria:**
- [ ] Complete evidence bundle
- [ ] Submitted to HITL-4
- [ ] Rejection handling
- [ ] Unit tests for bundle

**Test:** `tests/unit/workers/agents/development/test_tdd_orchestrator.py`

---

### T14: Security Scanner Integration
**File:** `src/workers/agents/development/reviewer_agent.py`
**Estimate:** 1h
**Dependencies:** T10

**Description:**
Add basic security scanning to reviewer:
- Check for hardcoded secrets
- Validate input handling
- Flag common vulnerabilities

**Acceptance Criteria:**
- [ ] Secret detection
- [ ] Vulnerability patterns checked
- [ ] Results in review

**Test:** `tests/unit/workers/agents/development/test_reviewer_agent.py`

---

### T15: Agent Registration
**File:** `src/workers/agents/development/__init__.py`
**Estimate:** 30min
**Dependencies:** T03, T05, T08, T10

**Description:**
Register development agents:
- Export all four agents
- Register with dispatcher
- Include capability metadata

**Acceptance Criteria:**
- [ ] Agents importable
- [ ] Types registered
- [ ] Unit test for registration

**Test:** `tests/unit/workers/agents/development/test_init.py`

---

### T16: Integration Tests
**File:** `tests/integration/workers/agents/development/`
**Estimate:** 2.5h
**Dependencies:** T01-T15

**Description:**
Create integration tests:
- UTest → Coding flow
- Full TDD loop (mocked test runner)
- Debugger escalation
- HITL interaction (mocked)

**Acceptance Criteria:**
- [ ] All agents tested
- [ ] TDD loop integration tested
- [ ] Fixtures for setup

**Test:** `tests/integration/workers/agents/development/`

---

### T17: E2E TDD Validation
**File:** `tests/e2e/test_development_workflow.py`
**Estimate:** 2h
**Dependencies:** T16

**Description:**
Create E2E test for TDD workflow:
- Start with implementation task
- Verify test generation
- Verify implementation
- Test retry and debug escalation
- Validate HITL-4 triggered

**Acceptance Criteria:**
- [ ] E2E test passes
- [ ] All artifacts verified
- [ ] TDD loop validated
- [ ] Idempotent and repeatable

**Test:** `tests/e2e/test_development_workflow.py`

---

### T18: Retry and Escalation E2E
**File:** `tests/e2e/test_development_workflow.py`
**Estimate:** 1.5h
**Dependencies:** T17

**Description:**
E2E test for failure scenarios:
- Simulate persistent test failures
- Verify retry count tracking
- Verify debugger escalation
- Validate recovery flow

**Acceptance Criteria:**
- [ ] Retry scenarios tested
- [ ] Escalation works correctly
- [ ] Recovery completes
- [ ] Test is repeatable

**Test:** `tests/e2e/test_development_workflow.py`

---

## Progress

- Started: 2026-01-24
- Tasks Complete: 6/18 (T01, T02, T04, T06, T09, T11 - Config, Models, and Prompts)
- Percentage: 33%
- Status: IN_PROGRESS
- Blockers: None
- Note: Agent implementation tasks (T03, T05, T07, T08, T10, T12-T18) pending

---

## Task Dependencies Graph

```
T01 (Config) ────┬──► T03 (UTest) ────────────────────────┐
                 │                                         │
T02 (Models) ────┼──► T05 (Coding) ──┐                    │
                 │                    │                    │
                 ├──► T07 (Runner) ──┼──► T12 (TDD Orch) ─┼─► T13 (HITL-4)
                 │                    │         │          │
                 ├──► T08 (Debugger) ┘         │          │
                 │                              │          │
                 └──► T10 (Reviewer) ──► T14 ──┘          │
                                                           │
T04 (UTest Prompts) ──────────────────────────────────────┤
T06 (Coding Prompts) ─────────────────────────────────────┤
T09 (Debugger Prompts) ───────────────────────────────────┤
T11 (Reviewer Prompts) ───────────────────────────────────┘
                                                           │
                                                 T15 (Registration)
                                                           │
                                                 T16 (Integration)
                                                           │
                                                 T17 (E2E) ──► T18 (Retry E2E)
```
