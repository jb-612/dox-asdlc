# P04-F03: Development Agents - Technical Design

## Overview

Development Agents implement the core TDD loop of the aSDLC workflow. Four specialized agents collaborate to write tests, implement code, debug failures, and review quality. This phase produces code artifacts and prepares evidence for HITL-4 (Code Review) gate.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TDD Development Loop                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Plan (approved) ──► UTest Agent ──► Coding Agent ──► Test Run              │
│        │                  │                │              │                  │
│        ▼                  ▼                ▼              ▼                  │
│    HITL-3 OK        tests.py          impl.py       Pass/Fail               │
│                                                          │                  │
│                    ┌─────────────────────────────────────┘                  │
│                    │                                                         │
│                    ▼                                                         │
│              ┌─── Pass ───┐                                                  │
│              │            │                                                  │
│              ▼            ▼                                                  │
│        Reviewer ──► HITL-4     fail_count++ ──► (> 4) ──► Debugger (RLM)   │
│                                     │                          │            │
│                                     └──────── (≤ 4) ◄─────────┘            │
│                                                  │                          │
│                                                  ▼                          │
│                                           Coding Agent                      │
│                                           (retry loop)                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Development Configuration (`config.py`)

```python
@dataclass
class DevelopmentConfig:
    utest_model: str = "claude-sonnet-4-20250514"
    coding_model: str = "claude-sonnet-4-20250514"
    debugger_model: str = "claude-sonnet-4-20250514"
    reviewer_model: str = "claude-opus-4-20250514"  # Opus for review quality
    max_tokens: int = 16384
    temperature: float = 0.2
    artifact_base_path: Path = Path("artifacts/development")
    enable_rlm: bool = True
    max_coding_retries: int = 4  # Before escalating to debugger
    test_timeout_seconds: int = 300
    coverage_threshold: float = 80.0  # Minimum test coverage percentage
```

### 2. Development Models (`models.py`)

```python
@dataclass
class TestCase:
    id: str
    name: str
    description: str
    test_type: str  # "unit", "integration", "e2e"
    code: str
    requirement_ref: str

@dataclass
class TestSuite:
    task_id: str
    test_cases: list[TestCase]
    setup_code: str
    teardown_code: str
    fixtures: list[str]

@dataclass
class Implementation:
    task_id: str
    files: list[CodeFile]
    imports: list[str]
    dependencies: list[str]

@dataclass
class TestResult:
    test_id: str
    passed: bool
    output: str
    error: str | None
    duration_ms: int

@dataclass
class TestRunResult:
    suite_id: str
    results: list[TestResult]
    passed: int
    failed: int
    coverage: float

@dataclass
class CodeReview:
    implementation_id: str
    passed: bool
    issues: list[ReviewIssue]
    suggestions: list[str]
    security_concerns: list[str]

@dataclass
class DebugAnalysis:
    failure_id: str
    root_cause: str
    fix_suggestion: str
    code_changes: list[CodeChange]
```

### 3. UTest Agent (`utest_agent.py`)

Writes tests before implementation (TDD Red phase).

**Responsibilities:**
- Parse implementation task and acceptance criteria
- Generate test cases covering all criteria
- Create test fixtures and setup/teardown
- Ensure tests are executable and will fail initially

```python
class UTestAgent(DomainAgent):
    agent_type = "utest_agent"

    async def execute(
        self,
        context: AgentContext,
        event_metadata: dict[str, Any],
    ) -> AgentResult:
        task = context.get_artifact("implementation_task")
        acceptance = context.get_artifact("acceptance_criteria")

        test_suite = await self._generate_tests(task, acceptance)

        return AgentResult(
            success=True,
            artifacts={"test_suite": test_suite},
            next_agent="coding_agent",
        )
```

### 4. Coding Agent (`coding_agent.py`)

**RLM-Enabled**: Implements code to pass tests.

**Responsibilities:**
- Consume test suite and task specification
- Generate implementation code
- Ensure code style compliance
- Trigger RLM for complex algorithms or unfamiliar patterns

```python
class CodingAgent(DomainAgent):
    agent_type = "coding_agent"

    def __init__(
        self,
        llm_client: LLMClient,
        artifact_writer: ArtifactWriter,
        config: DevelopmentConfig,
        rlm_integration: RLMIntegration | None = None,
    ): ...

    async def execute(
        self,
        context: AgentContext,
        event_metadata: dict[str, Any],
    ) -> AgentResult:
        test_suite = context.get_artifact("test_suite")
        task = context.get_artifact("implementation_task")
        fail_count = event_metadata.get("fail_count", 0)

        # RLM for complex implementations
        if self._should_use_rlm(task, fail_count):
            rlm_result = await self._rlm_integration.explore(...)

        impl = await self._generate_implementation(task, test_suite)

        return AgentResult(
            success=True,
            artifacts={"implementation": impl},
            next_step="test_run",
        )
```

**RLM Trigger Conditions:**
- Task involves unfamiliar algorithms
- Previous attempts failed (fail_count > 0, i.e., any failure triggers RLM)
- Complex integration patterns needed

### 5. Debugger Agent (`debugger_agent.py`)

**RLM-Enabled**: Escalation for persistent failures.

**Responsibilities:**
- Analyze test failures after coding retries exceeded
- Identify root cause of failures
- Research solutions via RLM
- Suggest or implement fixes

```python
class DebuggerAgent(DomainAgent):
    agent_type = "debugger_agent"

    def __init__(
        self,
        llm_client: LLMClient,
        artifact_writer: ArtifactWriter,
        config: DevelopmentConfig,
        rlm_integration: RLMIntegration,  # Required for debugger
    ): ...

    async def execute(
        self,
        context: AgentContext,
        event_metadata: dict[str, Any],
    ) -> AgentResult:
        test_results = context.get_artifact("test_results")
        impl = context.get_artifact("implementation")

        # Always use RLM for debugging
        analysis = await self._analyze_failures(test_results, impl)
        fixes = await self._rlm_integration.explore_solutions(analysis)

        return AgentResult(
            success=True,
            artifacts={"debug_analysis": analysis, "fixes": fixes},
            next_agent="coding_agent",  # Return to coding with fixes
        )
```

### 6. Reviewer Agent (`reviewer_agent.py`)

**Uses Opus model** for high-quality code review.

**Responsibilities:**
- Review implementation for quality and correctness
- Check security concerns
- Verify style compliance
- Prepare evidence for HITL-4

```python
class ReviewerAgent(DomainAgent):
    agent_type = "reviewer_agent"

    async def execute(
        self,
        context: AgentContext,
        event_metadata: dict[str, Any],
    ) -> AgentResult:
        impl = context.get_artifact("implementation")
        test_suite = context.get_artifact("test_suite")
        test_results = context.get_artifact("test_results")

        # Use Opus for review
        review = await self._review_code(impl, test_suite, test_results)

        return AgentResult(
            success=review.passed,
            artifacts={"review": review},
            hitl_gate="HITL-4" if review.passed else None,
            issues=review.issues if not review.passed else None,
        )
```

### 7. TDD Orchestrator (`tdd_orchestrator.py`)

Manages the TDD loop with retry and escalation logic.

```python
class TDDOrchestrator:
    async def run_tdd_loop(
        self,
        task: ImplementationTask,
        acceptance: AcceptanceCriteria,
    ) -> TDDResult:
        # 1. UTest writes tests
        test_suite = await self.utest_agent.execute(...)

        fail_count = 0
        while fail_count <= self.config.max_coding_retries:
            # 2. Coding implements
            impl = await self.coding_agent.execute(
                ..., event_metadata={"fail_count": fail_count}
            )

            # 3. Run tests
            test_results = await self._run_tests(test_suite, impl)

            if test_results.failed == 0:
                # 4a. All tests pass → Review
                review = await self.reviewer_agent.execute(...)
                if review.passed:
                    await self._submit_hitl4(impl, test_suite, review)
                    return TDDResult.success(impl)
                else:
                    # Review failed → back to coding
                    fail_count += 1
                    continue
            else:
                # 4b. Tests failed
                fail_count += 1

        # 5. Exceeded retries → Debugger
        debug = await self.debugger_agent.execute(...)
        # Return to coding with debug insights
        return await self._retry_with_debug(debug)
```

## Data Flow

```
1. Implementation Task (from Design)
   │
   ▼
2. UTest Agent
   └─► Write test_suite.py (tests that will fail)
   │
   ▼
3. Coding Agent
   ├─► Check if RLM needed
   └─► Write implementation files
   │
   ▼
4. Test Runner
   ├─► Run pytest
   └─► Collect results
   │
   ├─── Pass ──► 5. Reviewer Agent ──► HITL-4
   │                    │
   │              (review failed) ──► back to 3
   │
   └─── Fail ──► fail_count++
                    │
                    ├─── ≤ 4 ──► back to 3 (retry)
                    │
                    └─── > 4 ──► 6. Debugger Agent (RLM)
                                       │
                                       └─► back to 3 with fixes
```

## Dependencies

| Dependency | Source | Purpose |
|------------|--------|---------|
| `DomainAgent` | P03-F01 | Base agent protocol |
| `LLMClient` | P03-F01 | LLM interactions |
| `ArtifactWriter` | P03-F01 | Artifact persistence |
| `RLMIntegration` | P03-F03 | Exploration mode |
| `HITLDispatcher` | P02-F03 | HITL-4 submission |
| `ImplementationTask` | P04-F02 | Input from planner |

## File Structure

```
src/workers/agents/development/
├── __init__.py              # Agent registration
├── config.py                # Configuration
├── models.py                # Domain models
├── utest_agent.py           # Test writing agent
├── coding_agent.py          # Implementation agent (RLM)
├── debugger_agent.py        # Debug agent (RLM)
├── reviewer_agent.py        # Review agent (Opus)
├── tdd_orchestrator.py      # TDD loop coordination
├── test_runner.py           # Test execution utility
└── prompts/
    ├── __init__.py
    ├── utest_prompts.py     # Test generation prompts
    ├── coding_prompts.py    # Implementation prompts
    ├── debugger_prompts.py  # Debug analysis prompts
    └── reviewer_prompts.py  # Code review prompts
```

## HITL-4: Code Review Gate

**Evidence Bundle:**
- Implementation code files
- Test suite with results
- Coverage report
- Code review summary
- Security scan results

**Approval Criteria:**
- All tests pass
- Code review passed
- No critical security issues
- Style compliance verified

## Error Handling

| Error Type | Handling |
|------------|----------|
| Test timeout | Mark as failed, continue loop |
| LLM generation error | Retry with backoff |
| Syntax error in generated code | Treat as test failure |
| Max retries exceeded | Escalate to debugger |
| Debugger cannot resolve | HITL escalation with context |

## Testing Strategy

- **Unit tests**: Each agent in isolation
- **Integration tests**: TDD loop with mocked test runner
- **E2E tests**: Full cycle with real test execution
