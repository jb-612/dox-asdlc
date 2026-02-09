# P12-F01: TDD Separation - UT Agent & Debugger Agent

## Technical Design

**Version:** 1.0
**Date:** 2026-02-09
**Status:** Draft

## 1. Overview

Implement agent-level separation of test-writing, code-writing, and debugging responsibilities to comply with Guardrails Constitution requirements G5 (Agentic TDD Protocol) and G2 (Cognitive Mode Isolation).

Currently the backend agent writes both tests and implementation code, violating the core TDD guardrail that requires distinct agents for these roles. Additionally, there is no Debugger agent for backward diagnosis -- the backend agent handles both coding and debugging, which constitutes cognitive mode mixing.

### 1.1 Goals

1. Create a **test-writer** agent that produces test files from design specs before the coder begins
2. Create a **debugger** agent for backward diagnosis, auto-invoked after repeated test failures
3. Update the **tdd-execution** skill to orchestrate the three-agent TDD workflow
4. Add **guardrails guidelines** enforcing cognitive isolation for the new agents
5. Update **HITL Gate 6** (Test Failures > 3) to include debugger auto-escalation
6. Update the **11-step workflow** to reflect the new agent handoff pattern in Steps 6-7

### 1.2 Non-Goals

- Replacing the backend or frontend agents (they remain the coders)
- Automated model routing for heuristic diversity (separate feature)
- Persistent debugger session state across tasks
- Changes to the reviewer agent (it remains independent)

## 2. Dependencies

### 2.1 Internal Dependencies

| Dependency | Status | Description |
|------------|--------|-------------|
| P01-F07 | Complete | CLI role subagents with Redis coordination |
| P11-F01 | Complete (95%) | Guardrails configuration system |
| tdd-execution skill | Exists | Current Red-Green-Refactor workflow (to be updated) |
| `.claude/agents/backend.md` | Exists | Current backend agent definition |
| `src/core/models.py` | Exists | AgentRole enum with TESTING and DEBUGGING values |

### 2.2 External Dependencies

None. No new Python packages or npm packages required.

## 3. Architecture

### 3.1 Three-Agent TDD Flow

```
                     Design Specs (design.md, user_stories.md, tasks.md)
                                         |
                                         v
                        +----------------------------+
                        |   test-writer agent        |
                        |   (Forward Synthesis of    |
                        |    test specifications)    |
                        |                            |
                        |   Input:  task spec        |
                        |   Output: test files       |
                        |   Mode:   TESTING          |
                        +----------------------------+
                                         |
                                    test files
                                         |
                                         v
                        +----------------------------+
                        |   backend/frontend agent   |
                        |   (Forward Synthesis of    |
                        |    implementation code)    |
                        |                            |
                        |   Input:  test files +     |
                        |           task spec        |
                        |   Output: source code      |
                        |   Mode:   CODING           |
                        +----------------------------+
                                         |
                                    run tests
                                         |
                            +------ pass? ------+
                            |                   |
                          yes                  no
                            |                   |
                            v                   v
                       REFACTOR         fail_count++
                            |                   |
                            |           fail_count > 3?
                            |              |         |
                            |            yes        no
                            |              |         |
                            |              v         +---> retry coder
                            |   +------------------+
                            |   | debugger agent   |
                            |   | (Backward        |
                            |   |  Diagnosis)      |
                            |   |                  |
                            |   | Input:  test     |
                            |   |   output, code,  |
                            |   |   error logs     |
                            |   | Output: diag     |
                            |   |   report + fix   |
                            |   |   instructions   |
                            |   +------------------+
                            |              |
                            |     fix instructions
                            |              |
                            |              v
                            |   coder applies fix
                            |   (retry with guidance)
                            |              |
                            v              v
                        TASK COMPLETE
```

### 3.2 Cognitive Mode Mapping

Per Guardrail G2, each agent operates in exactly one cognitive mode:

| Agent | Cognitive Mode | Activity |
|-------|---------------|----------|
| planner | Planning | Create specs and task breakdowns |
| test-writer | Forward Synthesis (Tests) | Write tests from specifications |
| backend/frontend | Forward Synthesis (Code) | Write minimal code to pass tests |
| debugger | Backward Diagnosis | Analyze failures, produce fix instructions |
| reviewer | Validation | Independent code review |

### 3.3 Agent Interaction Sequence

```
PM CLI                  test-writer           backend              debugger
  |                         |                    |                    |
  |-- delegate task T01 --->|                    |                    |
  |                         |                    |                    |
  |                    read design.md            |                    |
  |                    read user_stories.md      |                    |
  |                    read tasks.md             |                    |
  |                         |                    |                    |
  |                    write test files           |                    |
  |                    run: pytest (RED)          |                    |
  |                         |                    |                    |
  |<-- tests written -------|                    |                    |
  |                         |                    |                    |
  |-- delegate T01 code ----------------------->|                    |
  |                         |                    |                    |
  |                         |               read test files          |
  |                         |               write source code        |
  |                         |               run: pytest (GREEN?)     |
  |                         |                    |                    |
  |                         |              [if GREEN]                |
  |<-- code complete ---------------------------|                    |
  |                         |                    |                    |
  |                         |              [if RED, count < 4]       |
  |                         |               retry (up to 3 times)    |
  |                         |                    |                    |
  |                         |              [if RED, count >= 4]      |
  |                         |                    |                    |
  |-- HITL Gate 6 --------->|                    |                    |
  |   (user selects A/B/C)  |                    |                    |
  |                         |                    |                    |
  |   [if A: invoke debugger]                    |                    |
  |-- delegate diagnosis ------------------------------------------------>|
  |                         |                    |                    |
  |                         |                    |               read test output
  |                         |                    |               read source code
  |                         |                    |               read error logs
  |                         |                    |                    |
  |                         |                    |               write diagnostic
  |                         |                    |                 report
  |                         |                    |                    |
  |<-- diagnosis report --------------------------------------------------|
  |                         |                    |                    |
  |-- delegate fix with guidance --------------->|                    |
  |                         |               apply fix instructions    |
  |                         |               run: pytest               |
  |<-- code complete (or retry) ----------------|                    |
```

## 4. Agent Definitions

### 4.1 test-writer Agent

**File:** `.claude/agents/test-writer.md`

```yaml
---
name: test-writer
description: Test specification writer. Creates test files from design specs before implementation begins. Use for the RED phase of TDD.
tools: Read, Write, Glob, Grep, Bash
model: inherit
---
```

**Key Properties:**

| Property | Value |
|----------|-------|
| Cognitive Mode | Forward Synthesis (Tests) |
| Input | design.md, user_stories.md, tasks.md, existing interfaces |
| Output | Test files under tests/unit/ and tests/integration/ |
| Path Restrictions (WRITE) | `tests/unit/**`, `tests/integration/**` |
| Path Restrictions (READ) | All source code, specs, interfaces |
| Cannot Write | Source code (`src/**`), meta files, Docker files |
| Test Command | `pytest tests/unit/path/test_file.py -v` (must fail = RED) |

**Behavioral Rules:**

1. Read the task specification from tasks.md and the acceptance criteria from user_stories.md
2. Read existing interfaces and types to understand the expected API surface
3. Write test files that define the expected behavior
4. Run tests to confirm they FAIL (RED phase) -- tests must fail because implementation does not exist yet
5. Never write implementation code -- only test code
6. Use descriptive test names following `test_{function}_{scenario}_{outcome}()` convention
7. Include both positive and negative test cases
8. Include edge cases identified in the acceptance criteria
9. Publish STATUS_UPDATE when tests are ready for the coder

**Guardrails Integration:**

```
guardrails_get_context(
  agent: "test-writer",
  domain: "<from task>",
  action: "test"
)
```

### 4.2 debugger Agent

**File:** `.claude/agents/debugger.md`

```yaml
---
name: debugger
description: Backward diagnosis specialist. Analyzes repeated test failures to produce root-cause analysis and fix instructions. Invoked after 3+ consecutive failures.
tools: Read, Grep, Glob, Bash
model: inherit
disallowedTools: Write, Edit
---
```

**Key Properties:**

| Property | Value |
|----------|-------|
| Cognitive Mode | Backward Diagnosis |
| Input | Failed test output, source code, error logs |
| Output | Diagnostic report (stdout), fix instructions |
| Path Restrictions (READ) | All code, tests, logs |
| Path Restrictions (WRITE) | None (READ-ONLY agent, like reviewer) |
| Cannot Write | Any files -- produces diagnosis via stdout only |

**Behavioral Rules:**

1. Receive the test failure context: test output, relevant source files, error messages
2. Analyze the root cause by tracing from the failing assertion backward through the code
3. Identify the specific code location(s) causing the failure
4. Produce a structured diagnostic report including:
   - Root cause identification
   - Failing code location (file, line, function)
   - Expected vs actual behavior
   - Recommended fix (specific code changes)
   - Confidence level (high/medium/low)
5. Never fix code directly -- only provide diagnosis and fix instructions
6. The coding agent receives the fix instructions and applies them
7. If multiple failures have different root causes, prioritize by impact

**Diagnostic Report Format:**

```
## Diagnostic Report

### Root Cause
[Description of the underlying issue]

### Failing Location
- File: [path]
- Function: [name]
- Line: [number]

### Analysis
[Step-by-step trace from failing assertion to root cause]

### Expected vs Actual
- Expected: [what the test expects]
- Actual: [what the code produces]

### Recommended Fix
[Specific code changes to resolve the issue]

### Confidence
[high|medium|low] - [rationale]
```

**Guardrails Integration:**

```
guardrails_get_context(
  agent: "debugger",
  domain: "<from task>",
  action: "debug"
)
```

## 5. Updated TDD Execution Skill

### 5.1 Current Flow (Single Agent)

```
1. RED:     backend writes failing test
2. GREEN:   backend writes code to pass
3. REFACTOR: backend cleans up
```

### 5.2 New Flow (Three Agents)

```
1. RED:       test-writer writes failing tests from spec
2. GREEN:     backend/frontend writes minimal code to pass
3. DIAGNOSE:  debugger activated if fail_count > 3 (HITL Gate 6)
4. FIX:       backend/frontend applies fix instructions from debugger
5. REFACTOR:  backend/frontend cleans up while tests green
```

### 5.3 Failure Escalation Protocol

| Fail Count | Action | Agent |
|------------|--------|-------|
| 1-3 | Continue debugging | backend/frontend (self-retry) |
| 4 | HITL Gate 6 triggered | PM CLI presents options to user |
| 4 (option A) | Invoke debugger | debugger agent performs root-cause analysis |
| 4 (option B) | Skip test | Create GitHub issue, move on |
| 4 (option C) | Abort task | Stop current task |
| 5+ (after debugger) | HITL Gate 6 again | User decides next step |

### 5.4 Skill File Changes

The updated skill at `.claude/skills/tdd-execution/SKILL.md` will describe the three-agent workflow and the PM CLI's role in orchestrating handoffs.

## 6. Guardrails Guidelines

### 6.1 New Guidelines to Bootstrap

Four new guardrails guidelines will be added to the bootstrap script:

#### cognitive-isolation-test-writer

```json
{
  "id": "cognitive-isolation-test-writer",
  "name": "Cognitive Isolation: Test Writer",
  "description": "Restricts the test-writer agent to test file paths only. Cannot write source code.",
  "enabled": true,
  "category": "cognitive_isolation",
  "priority": 900,
  "condition": {
    "agents": ["test-writer"]
  },
  "action": {
    "type": "tool_restriction",
    "instruction": "Test-writer agent may only create and modify test files under tests/unit/ and tests/integration/. Read access to all source code and specs is allowed for context. Do NOT write any implementation code under src/.",
    "tools_allowed": ["Read", "Grep", "Glob", "Bash", "Write"],
    "tools_denied": []
  }
}
```

Note: The path restriction (Write only to tests/) is enforced via the PreToolUse hook checking the file path against the agent's allowed write patterns, not via tools_denied. The test-writer needs Write access but only to test directories.

#### cognitive-isolation-debugger

```json
{
  "id": "cognitive-isolation-debugger",
  "name": "Cognitive Isolation: Debugger",
  "description": "Restricts the debugger agent to read-only access. Cannot modify any files.",
  "enabled": true,
  "category": "cognitive_isolation",
  "priority": 900,
  "condition": {
    "agents": ["debugger"]
  },
  "action": {
    "type": "tool_restriction",
    "instruction": "Debugger agent is READ-ONLY. Analyze test failures and source code to produce a diagnostic report with fix instructions. Do NOT modify any files directly. Output your diagnosis as structured text.",
    "tools_allowed": ["Read", "Grep", "Glob", "Bash"],
    "tools_denied": ["Write", "Edit"]
  }
}
```

#### tdd-test-writer-protocol

```json
{
  "id": "tdd-test-writer-protocol",
  "name": "TDD Protocol: Test-Writer Phase",
  "description": "Enforces that test-writer creates tests that initially fail (RED phase).",
  "enabled": true,
  "category": "tdd_protocol",
  "priority": 800,
  "condition": {
    "agents": ["test-writer"],
    "actions": ["test", "implement"]
  },
  "action": {
    "type": "constraint",
    "instruction": "Write tests that define expected behavior BEFORE any implementation exists. Tests MUST fail when first run (RED phase). Verify failure by running pytest. Test files serve as the work specification for the coding agent.",
    "require_tests": true
  }
}
```

#### tdd-debugger-escalation

```json
{
  "id": "tdd-debugger-escalation",
  "name": "TDD Protocol: Debugger Auto-Escalation",
  "description": "Triggers debugger agent after 3+ consecutive test failures on the same test.",
  "enabled": true,
  "category": "tdd_protocol",
  "priority": 850,
  "condition": {
    "agents": ["backend", "frontend"],
    "actions": ["implement", "fix", "debug"],
    "events": ["test_failure_repeated"]
  },
  "action": {
    "type": "hitl_gate",
    "gate_type": "test_failure_escalation",
    "gate_threshold": "advisory",
    "instruction": "After 3+ consecutive test failures, present HITL Gate 6 with debugger escalation option. Option A should invoke the debugger agent for root-cause analysis before the coder retries."
  }
}
```

### 6.2 Updated Existing Guideline

The existing `tdd-protocol` guideline will be updated to reference the test-writer agent:

```json
{
  "id": "tdd-protocol",
  "action": {
    "instruction": "Follow the three-agent TDD protocol: 1) test-writer agent creates failing tests from spec (RED). 2) Coding agent writes minimal code to pass tests (GREEN). 3) If >3 failures, debugger agent provides root-cause analysis. 4) Coding agent applies fix instructions. 5) REFACTOR while tests remain green. Never proceed to the next task with failing tests."
  }
}
```

## 7. Workflow Integration

### 7.1 Updated Step 6 (Parallel Build)

Step 6 currently delegates to backend/frontend agents directly. The updated flow:

```
Step 6: Parallel Build (Updated)
  For each atomic task:
    1. PM CLI invokes test-writer agent with task spec
    2. test-writer produces test files (RED phase confirmed)
    3. PM CLI invokes backend/frontend agent with:
       - Task spec
       - Reference to test files created in step 1
       - Instruction: "Make these tests pass with minimal code"
    4. backend/frontend writes implementation (GREEN phase)
    5. If tests pass: mark task complete
    6. If tests fail > 3 times: trigger HITL Gate 6 with debugger option
```

### 7.2 Updated Step 7 (Testing)

Step 7 currently just runs tests. The updated flow includes debugger escalation:

```
Step 7: Testing (Updated)
  1. Run full test suite
  2. If any test fails repeatedly (>3 times same test):
     a. HITL Gate 6 presents:
        A) Invoke debugger agent for root-cause analysis
        B) Skip test and create GitHub issue
        C) Abort task
     b. If A selected:
        - Invoke debugger agent with failure context
        - Receive diagnostic report
        - Re-invoke coder with fix instructions
        - Run tests again
  3. All tests must pass before proceeding to Step 8
```

### 7.3 Updated HITL Gate 6

Current Gate 6 offers: Continue debugging / Skip / Abort.

Updated Gate 6 adds the debugger option:

```
Tests failing repeatedly ([N] times): [test name]

Options:
 A) Invoke debugger agent for root-cause analysis
 B) Continue manual debugging (current coder retries)
 C) Skip test and proceed (mark as known issue)
 D) Abort task
```

## 8. File Structure

### 8.1 Files to Create

| File | Owner | Purpose |
|------|-------|---------|
| `.claude/agents/test-writer.md` | orchestrator | Test-writer agent definition |
| `.claude/agents/debugger.md` | orchestrator | Debugger agent definition |

### 8.2 Files to Modify

| File | Owner | Purpose |
|------|-------|---------|
| `.claude/skills/tdd-execution/SKILL.md` | orchestrator | Updated three-agent TDD workflow |
| `.claude/rules/hitl-gates.md` | orchestrator | Updated Gate 6 with debugger option |
| `.claude/rules/workflow.md` | orchestrator | Updated Steps 6-7 for test-writer/debugger |
| `.claude/rules/identity-selection.md` | orchestrator | Add test-writer and debugger to agent table |
| `.claude/rules/parallel-coordination.md` | orchestrator | Add path restrictions for new agents |
| `scripts/bootstrap_guardrails.py` | backend | Add 4 new guideline definitions |
| `src/core/models.py` | backend | Verify TESTING and DEBUGGING roles map correctly |
| `CLAUDE.md` | orchestrator | Add test-writer and debugger to Roles table |
| `docs/guardrails/README.md` | orchestrator | Document new default guidelines |

### 8.3 Files to Create (Tests)

| File | Owner | Purpose |
|------|-------|---------|
| `tests/unit/core/guardrails/test_tdd_guidelines.py` | backend | Unit tests for new guideline evaluation |

## 9. Interface Contracts

### 9.1 test-writer Agent Contract

**Input (via PM CLI delegation):**

The PM CLI provides the task context when invoking the test-writer:

```
Task: [task description from tasks.md]
Design: [relevant section of design.md]
Acceptance Criteria: [from user_stories.md]
Existing Interfaces: [relevant interface files to test against]
Target Test Path: tests/unit/[module]/test_[feature].py
```

**Output (structured completion):**

```json
{
  "status": "complete",
  "subagent": "test-writer",
  "files_created": ["tests/unit/path/test_feature.py"],
  "test_count": 8,
  "test_results": {
    "passed": 0,
    "failed": 8,
    "skipped": 0
  },
  "red_confirmed": true,
  "handoff": "Tests ready for coder. All 8 tests fail as expected (RED)."
}
```

### 9.2 debugger Agent Contract

**Input (via PM CLI delegation):**

```
Test Failure Context:
  Test Name: [failing test]
  Failure Count: [N]
  Test Output: [last pytest output including traceback]
  Source Files: [relevant source file paths]
  Error Log: [relevant error messages]
```

**Output (diagnostic report via stdout):**

```json
{
  "status": "complete",
  "subagent": "debugger",
  "diagnosis": {
    "root_cause": "Description of the underlying issue",
    "failing_location": {
      "file": "src/module/file.py",
      "function": "function_name",
      "line": 42
    },
    "expected_vs_actual": {
      "expected": "What the test expects",
      "actual": "What the code produces"
    },
    "recommended_fix": "Specific code changes to resolve",
    "confidence": "high"
  },
  "handoff": "Diagnosis complete. Recommended fix provided for coder."
}
```

### 9.3 PM CLI Orchestration Contract

The PM CLI follows this sequence for each TDD task:

```
1. Invoke test-writer:
   Task(agent: test-writer, task: "Write tests for [task spec]")
   -> Receives: test files, RED confirmation

2. Invoke coder:
   Task(agent: backend, task: "Make tests pass: [test file paths]")
   -> Receives: implementation, test results

3. If fail_count > 3:
   HITL Gate 6 -> User selects option

   If option A (debugger):
   Task(agent: debugger, task: "Diagnose: [failure context]")
   -> Receives: diagnostic report

   Task(agent: backend, task: "Apply fix: [diagnosis]")
   -> Receives: fixed implementation, test results
```

## 10. Security Considerations

1. **test-writer path enforcement**: PreToolUse hook must block Write operations to `src/**` when agent is test-writer. This is enforced via the existing guardrails enforcement hook reading the `cognitive-isolation-test-writer` guideline.

2. **debugger read-only enforcement**: The debugger agent definition includes `disallowedTools: Write, Edit` in its frontmatter, providing first-line defense. The guardrails guideline `cognitive-isolation-debugger` adds dynamic enforcement via the PreToolUse hook.

3. **No credential escalation**: Neither new agent gains any additional permissions beyond their specific domains.

## 11. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| test-writer produces low-quality tests | High | Skill instructions emphasize reading specs and acceptance criteria; reviewer validates test quality in Step 8 |
| Debugger diagnosis is inaccurate | Medium | Diagnosis includes confidence level; user can choose to ignore and continue manual debugging |
| Three-agent handoff adds latency | Medium | PM CLI delegates atomically; each agent handles one task at a time; session renewal between steps |
| Test-writer writes code accidentally | High | PreToolUse hook blocks Write to src/; guardrails guideline denies source code paths |
| Debugger modifies code directly | High | disallowedTools in agent definition + guardrails guideline denies Write/Edit |
| Existing backend TDD flow breaks | Medium | Gradual rollout: test-writer is invoked when available; backend can still self-write tests as fallback |

## 12. Open Questions

1. Should the test-writer have access to the KnowledgeStore MCP for finding related test patterns?
2. Should the debugger produce its diagnosis as a file (e.g., `.workitems/diagnostics/`) or purely via stdout?
3. Should we add a `fail_count` tracking mechanism in Redis for cross-session persistence?
4. Should the test-writer also run tests for the REFACTOR phase to confirm no regressions?
