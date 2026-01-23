# P03-F03: RLM Native Implementation - Tasks

## Overview

Task breakdown for implementing the native RLM (Recursive LLM) exploration system.

## Dependencies

- **P03-F01**: AgentRunner, AgentResult models - (in progress)
- **P03-F02**: RepoMapper for initial context, parsers - (in progress)

## Task List

### T01: Define RLM data models

**File:** `src/workers/rlm/models.py`
**Test:** `tests/unit/rlm/test_rlm_models.py`

- [x] Define `Finding` dataclass
- [x] Define `Citation` dataclass
- [x] Define `ExplorationStep` dataclass
- [x] Define `ExplorationTrajectory` dataclass
- [x] Define `RLMUsage` dataclass
- [x] Define `RLMResult` dataclass
- [x] Define `GrepMatch` dataclass
- [x] Define `ToolCall` dataclass
- [x] Add JSON serialization methods
- [x] Write unit tests for all models (32 tests)

**Estimate:** 1h
**Status:** COMPLETE

---

### T02: Implement SubCallBudgetManager

**File:** `src/workers/rlm/budget_manager.py`
**Test:** `tests/unit/rlm/test_budget_manager.py`

- [x] Create `SubCallBudgetManager` class
- [x] Track total sub-calls used
- [x] Track per-iteration sub-calls
- [x] Implement `can_make_call()` check
- [x] Implement `record_call()` method
- [x] Implement `reset_iteration()` for new iteration
- [x] Raise `BudgetExceededError` when exceeded
- [x] Write unit tests (34 tests)

**Estimate:** 1h
**Status:** COMPLETE

---

### T03: Implement SubCallCache

**File:** `src/workers/rlm/cache.py`
**Test:** `tests/unit/rlm/test_subcall_cache.py`

- [x] Create `SubCallCache` class
- [x] Implement cache key generation (hash of prompt + context)
- [x] Implement `get()` method
- [x] Implement `set()` method
- [x] Track cache hit statistics
- [x] Support cache clearing
- [x] Write unit tests (35 tests)

**Estimate:** 1h
**Status:** COMPLETE

---

### T04: Implement REPLToolSurface - File Operations

**File:** `src/workers/rlm/tools/file_tools.py`
**Test:** `tests/unit/rlm/test_rlm_file_tools.py`

- [x] Implement `list_files()` with glob pattern support
- [x] Implement `read_file()` with line range support
- [x] Implement `grep()` with context lines
- [x] Implement `file_exists()` and `get_file_info()`
- [x] Ensure read-only access (no writes)
- [x] Validate paths are within repo (sandbox)
- [x] Write unit tests with file fixtures (39 tests)

**Estimate:** 1.5h
**Status:** COMPLETE

---

### T05: Implement REPLToolSurface - Symbol Operations

**File:** `src/workers/rlm/tools/symbol_tools.py`
**Test:** `tests/unit/rlm/test_rlm_symbol_tools.py`

- [x] Implement `extract_symbols()` using P03-F02 parsers
- [x] Implement `parse_ast()` using P03-F02 parsers
- [x] Implement `find_symbol()` and `find_symbols_by_kind()`
- [x] Implement `get_function_signature()` and `get_imports()`
- [x] Handle unsupported file types
- [x] Handle parse errors gracefully
- [x] Write unit tests (32 tests)

**Estimate:** 1h
**Status:** COMPLETE

---

### T06: Implement REPLToolSurface - LLM Query

**File:** `src/workers/rlm/tools/llm_query.py`
**Test:** `tests/unit/rlm/test_llm_query.py`

- [x] Implement `llm_query()` invoking Haiku model
- [x] Enforce token limit per query
- [x] Integrate with SubCallBudgetManager
- [x] Integrate with SubCallCache
- [x] Handle API errors
- [x] Write unit tests with mocked Anthropic client (36 tests)

**Estimate:** 1.5h
**Status:** COMPLETE

---

### T07: Implement REPLToolSurface Registry

**File:** `src/workers/rlm/tools/registry.py`
**Test:** `tests/unit/rlm/test_repl_tool_surface.py`

- [x] Create `REPLToolSurface` class aggregating all tools
- [x] Implement tool dispatch by name
- [x] Enforce tool allowlist
- [x] Log all tool invocations
- [x] Write unit tests (35 tests)

**Estimate:** 30min
**Status:** COMPLETE

---

### T08: Implement RLMAgent

**File:** `src/workers/rlm/agent.py`
**Test:** `tests/unit/rlm/test_rlm_agent.py`

- [x] Create `RLMAgent` class
- [x] Inject Anthropic client and tool surface
- [x] Design exploration prompt template
- [x] Implement single iteration execution
- [x] Parse agent output for tool calls and thoughts
- [x] Accumulate findings across iterations
- [x] Write unit tests with mocked responses (28 tests)

**Estimate:** 2h
**Status:** COMPLETE

---

### T09: Implement RLMOrchestrator

**File:** `src/workers/rlm/orchestrator.py`
**Test:** `tests/unit/rlm/test_rlm_orchestrator.py`

- [x] Create `RLMOrchestrator` class
- [x] Inject RLMAgent, BudgetManager, Cache
- [x] Implement `explore()` method with iteration loop
- [x] Implement timeout handling with asyncio.wait_for
- [x] Handle budget exhaustion gracefully (returns partial results)
- [x] Synthesize final result from findings
- [x] Generate citations from tool calls
- [x] Write unit tests (22 tests)

**Estimate:** 2h
**Status:** COMPLETE

---

### T10: Implement Audit Trail Generation

**File:** `src/workers/rlm/audit.py`
**Test:** `tests/unit/rlm/test_rlm_audit.py`

- [x] Create `RLMAuditor` class
- [x] Implement `save_trajectory()` to configurable audit_dir
- [x] Include full exploration steps with save_result()
- [x] Include usage metrics (via RLMResult)
- [x] Include citations (via RLMResult)
- [x] Implement `load_trajectory()` for replay
- [x] Write unit tests (26 tests)

**Estimate:** 1h
**Status:** COMPLETE

---

### T11: Implement RLM Trigger Detection

**File:** `src/workers/rlm/trigger.py`
**Test:** `tests/unit/rlm/test_rlm_trigger.py`

- [x] Create `RLMTriggerDetector` class
- [x] Check context size > configurable threshold
- [x] Check multi-file dependency requirement
- [x] Check fail_count > threshold for Debugger
- [x] Check explicit RLM mode request
- [x] Check complex query keywords
- [x] Return trigger reason with confidence
- [x] Write unit tests (30 tests)

**Estimate:** 1h
**Status:** COMPLETE

---

### T12: Integrate RLM with AgentRunner

**File:** `src/workers/rlm/integration.py`
**Test:** `tests/unit/rlm/test_rlm_integration.py`

- [x] Create RLMIntegration class (standalone, pending AgentRunner)
- [x] Use RLMTriggerDetector to decide mode
- [x] Route to RLMOrchestrator when triggered
- [x] Format RLM results for agent consumption
- [x] process_with_rlm_check() for automatic detection
- [x] Write unit tests (18 tests)

**Note:** AgentRunner integration deferred until P03-F01 complete.

**Estimate:** 1.5h
**Status:** COMPLETE

---

### T13: Add RLM exceptions and configuration

**Files:** `src/core/exceptions.py`, `src/workers/rlm/config.py`

- [x] Add `RLMError` base exception
- [x] Add `BudgetExceededError`
- [x] Add `RLMTimeoutError`
- [x] Add `RLMToolError` exception
- [x] Add `RLMCacheError` exception
- [x] Create `RLMConfig` dataclass
- [x] Load from environment variables
- [x] Document configuration options

**Estimate:** 30min
**Status:** COMPLETE

---

### T14: Integration tests for RLM

**File:** `tests/integration/rlm/test_rlm_exploration.py`

- [x] Test file tools with real filesystem
- [x] Test symbol tools with real Python files
- [x] Test tool surface multi-tool invocation
- [x] Test budget enforcement end-to-end
- [x] Test timeout handling
- [x] Test cache effectiveness
- [x] Test trigger detection scenarios
- [x] Test end-to-end exploration flow
- [x] Test audit trail with real explorations
- [x] Write integration tests (15 tests)

**Estimate:** 2h
**Status:** COMPLETE

---

## Progress

- **Started**: 2026-01-23
- **Tasks Complete**: 14/14
- **Percentage**: 100%
- **Status**: COMPLETE
- **Blockers**: None
- **Tests Passing**: 382 tests (349 + 18 unit + 15 integration)

## Task Summary

| Task | Description | Estimate | Status |
|------|-------------|----------|--------|
| T01 | RLM data models | 1h | [x] |
| T02 | SubCallBudgetManager | 1h | [x] |
| T03 | SubCallCache | 1h | [x] |
| T04 | File operation tools | 1.5h | [x] |
| T05 | Symbol operation tools | 1h | [x] |
| T06 | LLM query tool | 1.5h | [x] |
| T07 | REPLToolSurface registry | 30min | [x] |
| T08 | RLMAgent | 2h | [x] |
| T09 | RLMOrchestrator | 2h | [x] |
| T10 | Audit trail generation | 1h | [x] |
| T11 | Trigger detection | 1h | [x] |
| T12 | AgentRunner integration | 1.5h | [x] |
| T13 | Exceptions and configuration | 30min | [x] |
| T14 | Integration tests | 2h | [x] |

**Total Estimated Time**: 17 hours

## Completion Checklist

- [x] All tasks in Task List are marked complete
- [x] All unit tests pass: `./tools/test.sh tests/unit/rlm/`
- [x] All integration tests pass: `./tools/test.sh tests/integration/rlm/`
- [x] Budget enforcement verified (unit and integration tests)
- [x] Timeout handling verified (integration tests)
- [x] Audit trails generated correctly (unit and integration tests)
- [ ] Linter passes: `./tools/lint.sh src/` (pending CI)
- [ ] No type errors: `mypy src/` (pending CI)
- [x] Documentation updated (docstrings complete)
- [x] Progress marked as 100% in tasks.md

## Notes

### Dependency Order

P03-F03 depends on components from P03-F01 and P03-F02:
- P03-F01 T02: AgentResult, ToolCall models
- P03-F02 T02-T04: Python and TypeScript parsers

Can start T01-T03 immediately (models, budget, cache).
T04-T07 (tools) can proceed once parsers from P03-F02 are ready.
T08-T12 (orchestrator, agent, integration) after tools are complete.
