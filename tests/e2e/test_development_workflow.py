"""End-to-end tests for the Development Workflow (TDD Loop).

Tests the complete TDD development workflow from implementation task through
test generation, coding, test execution, review, and HITL-4 gate submission.

These tests validate the full E2E flow including retry logic and debugger escalation.

Test coverage:
- T17: E2E TDD Validation for P04-F03 Development Agents
- T18: Retry and Escalation E2E for P04-F03 Development Agents
"""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
import redis.asyncio as redis

from src.core.events import ASDLCEvent, EventType
from src.orchestrator.evidence_bundle import EvidenceBundle, GateType
from src.orchestrator.hitl_dispatcher import (
    DecisionLogger,
    GateDecision,
    GateRequest,
    GateStatus,
    HITLDispatcher,
)
from src.workers.agents.development.coding_agent import CodingAgent
from src.workers.agents.development.config import DevelopmentConfig
from src.workers.agents.development.debugger_agent import DebuggerAgent
from src.workers.agents.development.models import (
    CodeChange,
    CodeFile,
    CodeReview,
    DebugAnalysis,
    Implementation,
    IssueSeverity,
    ReviewIssue,
    TestCase,
    TestResult,
    TestRunResult,
    TestSuite,
    TestType,
)
from src.workers.agents.development.reviewer_agent import ReviewerAgent
from src.workers.agents.development.tdd_orchestrator import TDDOrchestrator
from src.workers.agents.development.utest_agent import UTestAgent
from src.workers.agents.protocols import AgentContext, AgentResult
from src.workers.artifacts.writer import ArtifactWriter
from src.workers.llm.client import LLMResponse


# Test configuration
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))


def get_redis_url() -> str:
    """Get Redis URL for tests."""
    return f"redis://{REDIS_HOST}:{REDIS_PORT}/2"


# --- Fixtures ---


@pytest.fixture
def unique_session_id() -> str:
    """Generate unique session ID for test isolation."""
    return f"e2e-dev-session-{uuid.uuid4().hex[:8]}"


@pytest.fixture
def unique_task_id() -> str:
    """Generate unique task ID for test isolation."""
    return f"e2e-dev-task-{uuid.uuid4().hex[:8]}"


@pytest.fixture
def workspace_path(tmp_path: Path) -> Path:
    """Create isolated workspace for E2E tests."""
    workspace = tmp_path / "e2e_dev_workspace"
    workspace.mkdir()
    return workspace


@pytest.fixture
def artifact_writer(workspace_path: Path) -> ArtifactWriter:
    """Create artifact writer for test workspace."""
    return ArtifactWriter(str(workspace_path))


@pytest.fixture
def development_config() -> DevelopmentConfig:
    """Create test configuration with fast retry settings."""
    return DevelopmentConfig(
        max_coding_retries=3,
        test_timeout_seconds=30,
        enable_rlm=False,  # Disable RLM for E2E simplicity
    )


@pytest.fixture
def agent_context(
    workspace_path: Path,
    unique_session_id: str,
    unique_task_id: str,
) -> AgentContext:
    """Create agent context for E2E tests."""
    return AgentContext(
        session_id=unique_session_id,
        task_id=unique_task_id,
        tenant_id="default",
        workspace_path=str(workspace_path),
        metadata={"git_sha": "e2e-dev-test-sha"},
    )


@pytest.fixture
def sample_test_suite(unique_task_id: str) -> TestSuite:
    """Create a sample test suite for E2E testing."""
    return TestSuite(
        task_id=unique_task_id,
        test_cases=[
            TestCase(
                id="TC-001",
                name="test_add_numbers",
                description="Test that add_numbers returns correct sum",
                test_type=TestType.UNIT,
                code="""def test_add_numbers():
    from calculator import add_numbers
    assert add_numbers(2, 3) == 5
    assert add_numbers(-1, 1) == 0
    assert add_numbers(0, 0) == 0
""",
                requirement_ref="AC-001",
            ),
            TestCase(
                id="TC-002",
                name="test_subtract_numbers",
                description="Test that subtract_numbers returns correct difference",
                test_type=TestType.UNIT,
                code="""def test_subtract_numbers():
    from calculator import subtract_numbers
    assert subtract_numbers(5, 3) == 2
    assert subtract_numbers(3, 5) == -2
    assert subtract_numbers(0, 0) == 0
""",
                requirement_ref="AC-002",
            ),
        ],
        setup_code="import pytest",
        teardown_code="",
        fixtures=["mock_db"],
    )


@pytest.fixture
def sample_implementation(unique_task_id: str) -> Implementation:
    """Create a sample implementation for E2E testing."""
    return Implementation(
        task_id=unique_task_id,
        files=[
            CodeFile(
                path="calculator.py",
                content="""def add_numbers(a: int, b: int) -> int:
    \"\"\"Add two numbers.\"\"\"
    return a + b


def subtract_numbers(a: int, b: int) -> int:
    \"\"\"Subtract two numbers.\"\"\"
    return a - b
""",
                language="python",
            )
        ],
        imports=["typing"],
        dependencies=[],
    )


@pytest.fixture
def passing_test_result(unique_task_id: str) -> TestRunResult:
    """Create a passing test result."""
    return TestRunResult(
        suite_id=unique_task_id,
        results=[
            TestResult(
                test_id="test_add_numbers",
                passed=True,
                output=".",
                error=None,
                duration_ms=50,
            ),
            TestResult(
                test_id="test_subtract_numbers",
                passed=True,
                output=".",
                error=None,
                duration_ms=45,
            ),
        ],
        passed=2,
        failed=0,
        coverage=85.0,
    )


@pytest.fixture
def failing_test_result(unique_task_id: str) -> TestRunResult:
    """Create a failing test result."""
    return TestRunResult(
        suite_id=unique_task_id,
        results=[
            TestResult(
                test_id="test_add_numbers",
                passed=False,
                output="F",
                error="AssertionError: assert 2 == 5\n  where 2 = add_numbers(2, 3)",
                duration_ms=50,
            ),
            TestResult(
                test_id="test_subtract_numbers",
                passed=False,
                output="F",
                error="AssertionError: assert 5 == 2\n  where 5 = subtract_numbers(5, 3)",
                duration_ms=45,
            ),
        ],
        passed=0,
        failed=2,
        coverage=0.0,
    )


@pytest.fixture
def passing_review(unique_task_id: str) -> CodeReview:
    """Create a passing code review."""
    return CodeReview(
        implementation_id=unique_task_id,
        passed=True,
        issues=[],
        suggestions=["Consider adding more comprehensive error handling"],
        security_concerns=[],
    )


@pytest.fixture
def failing_review(unique_task_id: str) -> CodeReview:
    """Create a failing code review."""
    return CodeReview(
        implementation_id=unique_task_id,
        passed=False,
        issues=[
            ReviewIssue(
                id="ISSUE-001",
                description="Missing input validation for numeric types",
                severity=IssueSeverity.HIGH,
                file_path="calculator.py",
                line_number=1,
                suggestion="Add type checking for inputs",
            )
        ],
        suggestions=[],
        security_concerns=[],
    )


@pytest.fixture
def sample_debug_analysis() -> DebugAnalysis:
    """Create a sample debug analysis."""
    return DebugAnalysis(
        failure_id="debug-e2e-001",
        root_cause="Implementation ignores the second parameter in arithmetic operations",
        fix_suggestion="Include parameter b in the return calculation",
        code_changes=[
            CodeChange(
                file_path="calculator.py",
                original_code="return a  # Bug: ignores b",
                new_code="return a + b",
                description="Fix add_numbers to include second parameter",
                line_start=2,
                line_end=2,
            ),
        ],
    )


@pytest.fixture
def mock_rlm_integration() -> MagicMock:
    """Create a mock RLM integration."""
    rlm = MagicMock()
    rlm.should_use_rlm.return_value = MagicMock(should_trigger=False)
    rlm.explore = AsyncMock(
        return_value=MagicMock(
            formatted_output="RLM exploration found similar patterns in codebase",
            error=None,
        )
    )
    return rlm


@pytest.fixture
def mock_event_publisher() -> AsyncMock:
    """Create mock event publisher that captures events."""
    events: list[ASDLCEvent] = []

    async def capture_event(event: ASDLCEvent) -> str:
        events.append(event)
        return event.event_id

    publisher = AsyncMock(side_effect=capture_event)
    publisher.events = events
    return publisher


@pytest.fixture
async def redis_client():
    """Create Redis client for E2E tests.

    Skip tests if Redis is not available.
    """
    try:
        client = redis.Redis.from_url(get_redis_url(), decode_responses=True)
        await client.ping()
        yield client
        await client.aclose()
    except (redis.ConnectionError, OSError):
        pytest.skip("Redis not available for E2E tests")


@pytest.fixture
async def hitl_dispatcher(redis_client, mock_event_publisher) -> HITLDispatcher:
    """Create HITL dispatcher with real Redis backend."""
    decision_logger = DecisionLogger(redis_client)
    return HITLDispatcher(
        redis_client=redis_client,
        event_publisher=mock_event_publisher,
        decision_logger=decision_logger,
    )


def create_mock_utest_agent(test_suite: TestSuite) -> MagicMock:
    """Create a mock UTest agent that returns the given test suite."""
    agent = MagicMock()
    agent.agent_type = "utest"
    agent.execute = AsyncMock(
        return_value=AgentResult(
            success=True,
            agent_type="utest",
            task_id=test_suite.task_id,
            metadata={"test_suite": test_suite.to_dict()},
        )
    )
    return agent


def create_mock_coding_agent(implementation: Implementation) -> MagicMock:
    """Create a mock Coding agent that returns the given implementation."""
    agent = MagicMock()
    agent.agent_type = "coding"
    agent.execute = AsyncMock(
        return_value=AgentResult(
            success=True,
            agent_type="coding",
            task_id=implementation.task_id,
            metadata={"implementation": implementation.to_dict()},
        )
    )
    return agent


def create_mock_debugger_agent(debug_analysis: DebugAnalysis) -> MagicMock:
    """Create a mock Debugger agent that returns the given analysis."""
    agent = MagicMock()
    agent.agent_type = "debugger"
    agent.execute = AsyncMock(
        return_value=AgentResult(
            success=True,
            agent_type="debugger",
            task_id="e2e-task",
            metadata={
                "debug_analysis": debug_analysis.to_dict(),
                "root_cause": debug_analysis.root_cause,
                "fix_suggestion": debug_analysis.fix_suggestion,
                "code_changes": [c.to_dict() for c in debug_analysis.code_changes],
            },
        )
    )
    return agent


def create_mock_reviewer_agent(review: CodeReview) -> MagicMock:
    """Create a mock Reviewer agent that returns the given review."""
    agent = MagicMock()
    agent.agent_type = "reviewer"
    agent.execute = AsyncMock(
        return_value=AgentResult(
            success=True,
            agent_type="reviewer",
            task_id=review.implementation_id,
            metadata={
                "passed": review.passed,
                "review": review.to_dict(),
            },
        )
    )
    return agent


def create_mock_test_runner(test_result: TestRunResult) -> MagicMock:
    """Create a mock test runner that returns the given result."""
    runner = MagicMock()
    runner.run_tests = MagicMock(return_value=test_result)
    return runner


def create_mock_hitl_dispatcher(
    unique_task_id: str,
    unique_session_id: str,
    status: GateStatus = GateStatus.PENDING,
) -> MagicMock:
    """Create a mock HITL dispatcher."""
    dispatcher = MagicMock()

    mock_gate_request = GateRequest(
        request_id=f"e2e-hitl4-{uuid.uuid4().hex[:8]}",
        task_id=unique_task_id,
        session_id=unique_session_id,
        gate_type=GateType.HITL_4_CODE,
        status=status,
        evidence_bundle=MagicMock(),
        requested_by="tdd_orchestrator",
        requested_at=datetime.now(timezone.utc),
    )
    dispatcher.request_gate = AsyncMock(return_value=mock_gate_request)
    dispatcher.get_request_by_id = AsyncMock(return_value=mock_gate_request)

    return dispatcher


# --- E2E Test Classes ---


class TestFullTDDWorkflowE2E:
    """End-to-end tests for the complete TDD development workflow.

    These tests validate:
    - T17: E2E TDD Validation
    - Full workflow from task to HITL-4 submission
    - All artifacts are created and validated
    """

    @pytest.mark.asyncio
    async def test_full_tdd_workflow_success(
        self,
        agent_context: AgentContext,
        sample_test_suite: TestSuite,
        sample_implementation: Implementation,
        passing_test_result: TestRunResult,
        passing_review: CodeReview,
        development_config: DevelopmentConfig,
        unique_task_id: str,
        unique_session_id: str,
    ) -> None:
        """Test complete TDD workflow: UTest -> Coding -> Test -> Review -> HITL-4.

        This test validates:
        1. Test generation from acceptance criteria
        2. Implementation generation
        3. Test execution and passing
        4. Code review approval
        5. HITL-4 gate submission
        6. All artifacts are correctly produced
        """
        # Arrange - Create all mock agents
        mock_utest = create_mock_utest_agent(sample_test_suite)
        mock_coding = create_mock_coding_agent(sample_implementation)
        mock_debugger = create_mock_debugger_agent(
            DebugAnalysis(
                failure_id="unused",
                root_cause="unused",
                fix_suggestion="unused",
                code_changes=[],
            )
        )
        mock_reviewer = create_mock_reviewer_agent(passing_review)
        mock_runner = create_mock_test_runner(passing_test_result)
        mock_hitl = create_mock_hitl_dispatcher(unique_task_id, unique_session_id)

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest,
            coding_agent=mock_coding,
            debugger_agent=mock_debugger,
            reviewer_agent=mock_reviewer,
            test_runner=mock_runner,
            config=development_config,
            hitl_dispatcher=mock_hitl,
        )

        # Act
        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement a calculator with add and subtract functions",
            acceptance_criteria=[
                "add_numbers(2, 3) should return 5",
                "subtract_numbers(5, 3) should return 2",
            ],
        )

        # Assert - Workflow success
        assert result.success is True
        assert result.error_message is None

        # Assert - All artifacts present
        assert result.implementation is not None
        assert len(result.implementation.files) > 0
        assert result.implementation.files[0].path == "calculator.py"

        assert result.test_suite is not None
        assert len(result.test_suite.test_cases) == 2

        assert result.test_result is not None
        assert result.test_result.all_passed() is True
        assert result.test_result.coverage == 85.0

        assert result.review is not None
        assert result.review.passed is True

        # Assert - HITL-4 submitted
        assert result.hitl4_request_id is not None
        mock_hitl.request_gate.assert_called_once()

        # Assert - No retries needed
        assert result.retry_count == 0

    @pytest.mark.asyncio
    async def test_tdd_workflow_all_artifacts_verified(
        self,
        agent_context: AgentContext,
        sample_test_suite: TestSuite,
        sample_implementation: Implementation,
        passing_test_result: TestRunResult,
        passing_review: CodeReview,
        development_config: DevelopmentConfig,
        unique_task_id: str,
        unique_session_id: str,
    ) -> None:
        """Test that all artifacts from TDD workflow are properly structured.

        This verifies artifact content and structure for HITL-4 evidence bundle.
        """
        # Arrange
        mock_utest = create_mock_utest_agent(sample_test_suite)
        mock_coding = create_mock_coding_agent(sample_implementation)
        mock_debugger = create_mock_debugger_agent(
            DebugAnalysis(failure_id="", root_cause="", fix_suggestion="", code_changes=[])
        )
        mock_reviewer = create_mock_reviewer_agent(passing_review)
        mock_runner = create_mock_test_runner(passing_test_result)
        mock_hitl = create_mock_hitl_dispatcher(unique_task_id, unique_session_id)

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest,
            coding_agent=mock_coding,
            debugger_agent=mock_debugger,
            reviewer_agent=mock_reviewer,
            test_runner=mock_runner,
            config=development_config,
            hitl_dispatcher=mock_hitl,
        )

        # Act
        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement calculator",
            acceptance_criteria=["add works", "subtract works"],
        )

        # Assert - Implementation structure
        impl = result.implementation
        assert impl.task_id == unique_task_id
        for code_file in impl.files:
            assert code_file.path is not None
            assert code_file.content is not None
            assert code_file.language == "python"

        # Assert - Test suite structure
        suite = result.test_suite
        assert suite.task_id == unique_task_id
        for test_case in suite.test_cases:
            assert test_case.id.startswith("TC-")
            assert test_case.name is not None
            assert test_case.code is not None
            assert test_case.requirement_ref is not None

        # Assert - Test result structure
        test_res = result.test_result
        assert test_res.suite_id == unique_task_id
        assert test_res.passed >= 0
        assert test_res.failed >= 0
        assert 0.0 <= test_res.coverage <= 100.0

        # Assert - Review structure
        review = result.review
        assert review.implementation_id == unique_task_id
        assert isinstance(review.passed, bool)
        assert isinstance(review.issues, list)

        # Assert - Evidence bundle structure in HITL call
        call_kwargs = mock_hitl.request_gate.call_args[1]
        evidence_bundle = call_kwargs["evidence_bundle"]
        assert evidence_bundle is not None

        # Verify all required evidence types
        item_types = {item.item_type for item in evidence_bundle.items}
        assert "artifact" in item_types
        assert "test_suite" in item_types
        assert "test_result" in item_types
        assert "review" in item_types

    @pytest.mark.asyncio
    async def test_tdd_workflow_validates_hitl4_evidence_content(
        self,
        agent_context: AgentContext,
        sample_test_suite: TestSuite,
        sample_implementation: Implementation,
        passing_test_result: TestRunResult,
        passing_review: CodeReview,
        development_config: DevelopmentConfig,
        unique_task_id: str,
        unique_session_id: str,
    ) -> None:
        """Test that HITL-4 evidence bundle contains correct content."""
        # Arrange
        mock_utest = create_mock_utest_agent(sample_test_suite)
        mock_coding = create_mock_coding_agent(sample_implementation)
        mock_debugger = create_mock_debugger_agent(
            DebugAnalysis(failure_id="", root_cause="", fix_suggestion="", code_changes=[])
        )
        mock_reviewer = create_mock_reviewer_agent(passing_review)
        mock_runner = create_mock_test_runner(passing_test_result)
        mock_hitl = create_mock_hitl_dispatcher(unique_task_id, unique_session_id)

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest,
            coding_agent=mock_coding,
            debugger_agent=mock_debugger,
            reviewer_agent=mock_reviewer,
            test_runner=mock_runner,
            config=development_config,
            hitl_dispatcher=mock_hitl,
        )

        # Act
        await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement calculator with add and subtract",
            acceptance_criteria=["add works", "subtract works"],
        )

        # Assert - Evidence bundle content
        call_kwargs = mock_hitl.request_gate.call_args[1]
        evidence_bundle = call_kwargs["evidence_bundle"]

        # Check implementation artifact
        impl_items = [i for i in evidence_bundle.items if i.item_type == "artifact"]
        assert len(impl_items) > 0
        assert impl_items[0].content_hash is not None
        assert "files" in impl_items[0].metadata

        # Check test suite
        test_items = [i for i in evidence_bundle.items if i.item_type == "test_suite"]
        assert len(test_items) > 0
        assert test_items[0].metadata.get("test_count") == 2

        # Check test results
        result_items = [i for i in evidence_bundle.items if i.item_type == "test_result"]
        assert len(result_items) > 0
        assert result_items[0].metadata.get("all_passed") is True
        assert result_items[0].metadata.get("coverage") == 85.0

        # Check review
        review_items = [i for i in evidence_bundle.items if i.item_type == "review"]
        assert len(review_items) > 0
        assert review_items[0].metadata.get("passed") is True

        # Check gate type and requester
        assert call_kwargs["gate_type"] == GateType.HITL_4_CODE
        assert call_kwargs["requested_by"] == "tdd_orchestrator"

    @pytest.mark.asyncio
    async def test_tdd_workflow_idempotent_and_repeatable(
        self,
        workspace_path: Path,
        sample_test_suite: TestSuite,
        sample_implementation: Implementation,
        passing_test_result: TestRunResult,
        passing_review: CodeReview,
        development_config: DevelopmentConfig,
    ) -> None:
        """Test that TDD workflow is idempotent and produces consistent results."""

        async def run_workflow() -> Any:
            """Run a single workflow iteration with fresh IDs."""
            session_id = f"e2e-session-{uuid.uuid4().hex[:8]}"
            task_id = f"e2e-task-{uuid.uuid4().hex[:8]}"

            # Create fresh mocks with task-specific IDs
            test_suite = TestSuite(
                task_id=task_id,
                test_cases=sample_test_suite.test_cases,
                setup_code=sample_test_suite.setup_code,
                teardown_code=sample_test_suite.teardown_code,
                fixtures=sample_test_suite.fixtures,
            )
            impl = Implementation(
                task_id=task_id,
                files=sample_implementation.files,
                imports=sample_implementation.imports,
                dependencies=sample_implementation.dependencies,
            )
            test_res = TestRunResult(
                suite_id=task_id,
                results=passing_test_result.results,
                passed=passing_test_result.passed,
                failed=passing_test_result.failed,
                coverage=passing_test_result.coverage,
            )
            review = CodeReview(
                implementation_id=task_id,
                passed=True,
                issues=[],
                suggestions=passing_review.suggestions,
                security_concerns=[],
            )

            context = AgentContext(
                session_id=session_id,
                task_id=task_id,
                tenant_id="default",
                workspace_path=str(workspace_path),
            )

            orchestrator = TDDOrchestrator(
                utest_agent=create_mock_utest_agent(test_suite),
                coding_agent=create_mock_coding_agent(impl),
                debugger_agent=create_mock_debugger_agent(
                    DebugAnalysis(failure_id="", root_cause="", fix_suggestion="", code_changes=[])
                ),
                reviewer_agent=create_mock_reviewer_agent(review),
                test_runner=create_mock_test_runner(test_res),
                config=development_config,
                hitl_dispatcher=create_mock_hitl_dispatcher(task_id, session_id),
            )

            return await orchestrator.run_tdd_loop(
                context=context,
                task_description="Implement calculator",
                acceptance_criteria=["add works", "subtract works"],
            )

        # Run workflow twice
        result1 = await run_workflow()
        result2 = await run_workflow()

        # Assert - Both runs succeeded
        assert result1.success is True
        assert result2.success is True

        # Assert - Structurally equivalent results
        assert len(result1.implementation.files) == len(result2.implementation.files)
        assert len(result1.test_suite.test_cases) == len(result2.test_suite.test_cases)
        assert result1.test_result.passed == result2.test_result.passed
        assert result1.test_result.failed == result2.test_result.failed
        assert result1.review.passed == result2.review.passed

        # Assert - Both submitted to HITL-4
        assert result1.hitl4_request_id is not None
        assert result2.hitl4_request_id is not None


class TestTDDWorkflowRetryAndEscalationE2E:
    """End-to-end tests for TDD retry logic and debugger escalation.

    These tests validate:
    - T18: Retry and Escalation E2E
    - Test retry behavior with fail_count tracking
    - Debugger escalation after max retries exceeded
    - Recovery flow after debugger assistance
    """

    @pytest.mark.asyncio
    async def test_retry_on_test_failure(
        self,
        agent_context: AgentContext,
        sample_test_suite: TestSuite,
        sample_implementation: Implementation,
        failing_test_result: TestRunResult,
        passing_test_result: TestRunResult,
        passing_review: CodeReview,
        unique_task_id: str,
        unique_session_id: str,
    ) -> None:
        """Test that TDD loop retries on test failure.

        Validates:
        1. First test run fails
        2. Coding agent retries with fail_count incremented
        3. Second test run passes
        4. Workflow completes successfully
        """
        config = DevelopmentConfig(max_coding_retries=3)

        # Track coding agent calls
        coding_calls: list[dict] = []

        async def track_coding_execute(context, event_metadata):
            coding_calls.append(event_metadata.copy())
            return AgentResult(
                success=True,
                agent_type="coding",
                task_id=unique_task_id,
                metadata={"implementation": sample_implementation.to_dict()},
            )

        mock_utest = create_mock_utest_agent(sample_test_suite)

        mock_coding = MagicMock()
        mock_coding.agent_type = "coding"
        mock_coding.execute = AsyncMock(side_effect=track_coding_execute)

        mock_debugger = create_mock_debugger_agent(
            DebugAnalysis(failure_id="", root_cause="", fix_suggestion="", code_changes=[])
        )
        mock_reviewer = create_mock_reviewer_agent(passing_review)

        # Test runner: fail first time, pass second time
        mock_runner = MagicMock()
        mock_runner.run_tests = MagicMock(
            side_effect=[failing_test_result, passing_test_result]
        )

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest,
            coding_agent=mock_coding,
            debugger_agent=mock_debugger,
            reviewer_agent=mock_reviewer,
            test_runner=mock_runner,
            config=config,
        )

        # Act
        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement calculator",
            acceptance_criteria=["add works"],
        )

        # Assert - Workflow succeeded after retry
        assert result.success is True
        assert result.retry_count == 1

        # Assert - Coding was called twice
        assert len(coding_calls) == 2

        # Assert - First call had fail_count=0
        assert coding_calls[0].get("fail_count") == 0

        # Assert - Second call had fail_count=1 and test_errors
        assert coding_calls[1].get("fail_count") == 1
        assert "test_errors" in coding_calls[1]
        assert len(coding_calls[1]["test_errors"]) > 0

    @pytest.mark.asyncio
    async def test_debugger_escalation_after_max_retries(
        self,
        agent_context: AgentContext,
        sample_test_suite: TestSuite,
        sample_implementation: Implementation,
        failing_test_result: TestRunResult,
        passing_test_result: TestRunResult,
        passing_review: CodeReview,
        sample_debug_analysis: DebugAnalysis,
        unique_task_id: str,
        unique_session_id: str,
    ) -> None:
        """Test that debugger is escalated after max_coding_retries exceeded.

        Validates:
        1. Coding retries fail max_coding_retries times
        2. Debugger is invoked for analysis
        3. Debugger analysis is passed to coding
        4. Coding succeeds with debugger hints
        5. Workflow completes successfully
        """
        config = DevelopmentConfig(max_coding_retries=2)  # Escalate after 2 retries

        # Track debugger calls
        debugger_called = False

        async def track_debugger_execute(context, event_metadata):
            nonlocal debugger_called
            debugger_called = True
            return AgentResult(
                success=True,
                agent_type="debugger",
                task_id=unique_task_id,
                metadata={
                    "debug_analysis": sample_debug_analysis.to_dict(),
                    "root_cause": sample_debug_analysis.root_cause,
                    "fix_suggestion": sample_debug_analysis.fix_suggestion,
                    "code_changes": [c.to_dict() for c in sample_debug_analysis.code_changes],
                },
            )

        # Track coding agent calls
        coding_calls: list[dict] = []

        async def track_coding_execute(context, event_metadata):
            coding_calls.append(event_metadata.copy())
            return AgentResult(
                success=True,
                agent_type="coding",
                task_id=unique_task_id,
                metadata={"implementation": sample_implementation.to_dict()},
            )

        mock_utest = create_mock_utest_agent(sample_test_suite)

        mock_coding = MagicMock()
        mock_coding.agent_type = "coding"
        mock_coding.execute = AsyncMock(side_effect=track_coding_execute)

        mock_debugger = MagicMock()
        mock_debugger.agent_type = "debugger"
        mock_debugger.execute = AsyncMock(side_effect=track_debugger_execute)

        mock_reviewer = create_mock_reviewer_agent(passing_review)

        # Test runner: fail 3 times (exceeds max_coding_retries=2), then pass
        fail_count = 0

        def run_tests_with_escalation(*args, **kwargs):
            nonlocal fail_count
            fail_count += 1
            if fail_count <= 4:  # Fail first 4 times
                return failing_test_result
            else:
                return passing_test_result

        mock_runner = MagicMock()
        mock_runner.run_tests = MagicMock(side_effect=run_tests_with_escalation)

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest,
            coding_agent=mock_coding,
            debugger_agent=mock_debugger,
            reviewer_agent=mock_reviewer,
            test_runner=mock_runner,
            config=config,
        )

        # Act
        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement calculator",
            acceptance_criteria=["add works"],
        )

        # Assert - Workflow succeeded
        assert result.success is True

        # Assert - Debugger was called
        assert debugger_called is True

        # Assert - Debug analysis was passed to coding
        debug_analysis_calls = [c for c in coding_calls if c.get("debug_analysis")]
        assert len(debug_analysis_calls) >= 1

    @pytest.mark.asyncio
    async def test_retry_count_tracking_accurate(
        self,
        agent_context: AgentContext,
        sample_test_suite: TestSuite,
        sample_implementation: Implementation,
        failing_test_result: TestRunResult,
        passing_test_result: TestRunResult,
        passing_review: CodeReview,
        unique_task_id: str,
    ) -> None:
        """Test that retry_count in result accurately reflects attempts."""
        config = DevelopmentConfig(max_coding_retries=5)

        mock_utest = create_mock_utest_agent(sample_test_suite)
        mock_coding = create_mock_coding_agent(sample_implementation)
        mock_debugger = create_mock_debugger_agent(
            DebugAnalysis(failure_id="", root_cause="", fix_suggestion="", code_changes=[])
        )
        mock_reviewer = create_mock_reviewer_agent(passing_review)

        # Fail exactly 3 times before passing
        call_count = 0

        def run_tests_n_failures(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count <= 3:
                return failing_test_result
            else:
                return passing_test_result

        mock_runner = MagicMock()
        mock_runner.run_tests = MagicMock(side_effect=run_tests_n_failures)

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest,
            coding_agent=mock_coding,
            debugger_agent=mock_debugger,
            reviewer_agent=mock_reviewer,
            test_runner=mock_runner,
            config=config,
        )

        # Act
        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement calculator",
            acceptance_criteria=["add works"],
        )

        # Assert - Correct retry count
        assert result.success is True
        assert result.retry_count == 3  # 3 failures before success

    @pytest.mark.asyncio
    async def test_recovery_after_debugger_assistance(
        self,
        agent_context: AgentContext,
        sample_test_suite: TestSuite,
        sample_implementation: Implementation,
        failing_test_result: TestRunResult,
        passing_test_result: TestRunResult,
        passing_review: CodeReview,
        sample_debug_analysis: DebugAnalysis,
        unique_task_id: str,
        unique_session_id: str,
    ) -> None:
        """Test that workflow recovers after debugger provides assistance.

        Validates complete recovery flow:
        1. Tests fail repeatedly
        2. Debugger is invoked
        3. Coding receives debug hints
        4. Tests pass after applying hints
        5. Review passes
        6. HITL-4 submitted
        """
        config = DevelopmentConfig(max_coding_retries=1)  # Quick escalation

        mock_utest = create_mock_utest_agent(sample_test_suite)
        mock_coding = create_mock_coding_agent(sample_implementation)
        mock_debugger = create_mock_debugger_agent(sample_debug_analysis)
        mock_reviewer = create_mock_reviewer_agent(passing_review)
        mock_hitl = create_mock_hitl_dispatcher(unique_task_id, unique_session_id)

        # Fail twice (trigger escalation), then pass
        call_count = 0

        def run_tests_recovery(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count <= 2:
                return failing_test_result
            else:
                return passing_test_result

        mock_runner = MagicMock()
        mock_runner.run_tests = MagicMock(side_effect=run_tests_recovery)

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest,
            coding_agent=mock_coding,
            debugger_agent=mock_debugger,
            reviewer_agent=mock_reviewer,
            test_runner=mock_runner,
            config=config,
            hitl_dispatcher=mock_hitl,
        )

        # Act
        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement calculator",
            acceptance_criteria=["add works"],
        )

        # Assert - Complete recovery
        assert result.success is True
        assert result.implementation is not None
        assert result.test_suite is not None
        assert result.test_result is not None
        assert result.test_result.all_passed() is True
        assert result.review is not None
        assert result.review.passed is True
        assert result.hitl4_request_id is not None

        # Assert - Recovery took multiple attempts
        assert result.retry_count >= 2

    @pytest.mark.asyncio
    async def test_workflow_repeatable_with_retry_scenario(
        self,
        workspace_path: Path,
        sample_test_suite: TestSuite,
        sample_implementation: Implementation,
        failing_test_result: TestRunResult,
        passing_test_result: TestRunResult,
        passing_review: CodeReview,
    ) -> None:
        """Test that retry scenarios are repeatable and produce consistent results."""
        config = DevelopmentConfig(max_coding_retries=2)

        async def run_retry_workflow() -> Any:
            """Run workflow with retry scenario."""
            session_id = f"e2e-retry-{uuid.uuid4().hex[:8]}"
            task_id = f"e2e-retry-task-{uuid.uuid4().hex[:8]}"

            test_suite = TestSuite(
                task_id=task_id,
                test_cases=sample_test_suite.test_cases,
                setup_code=sample_test_suite.setup_code,
                teardown_code=sample_test_suite.teardown_code,
                fixtures=sample_test_suite.fixtures,
            )
            impl = Implementation(
                task_id=task_id,
                files=sample_implementation.files,
                imports=sample_implementation.imports,
                dependencies=sample_implementation.dependencies,
            )
            fail_res = TestRunResult(
                suite_id=task_id,
                results=failing_test_result.results,
                passed=failing_test_result.passed,
                failed=failing_test_result.failed,
                coverage=failing_test_result.coverage,
            )
            pass_res = TestRunResult(
                suite_id=task_id,
                results=passing_test_result.results,
                passed=passing_test_result.passed,
                failed=passing_test_result.failed,
                coverage=passing_test_result.coverage,
            )
            review = CodeReview(
                implementation_id=task_id,
                passed=True,
                issues=[],
                suggestions=[],
                security_concerns=[],
            )

            context = AgentContext(
                session_id=session_id,
                task_id=task_id,
                tenant_id="default",
                workspace_path=str(workspace_path),
            )

            # Test runner: fail once, then pass
            call_count = [0]  # Use list for closure

            def run_tests(*args, **kwargs):
                call_count[0] += 1
                return fail_res if call_count[0] == 1 else pass_res

            mock_runner = MagicMock()
            mock_runner.run_tests = MagicMock(side_effect=run_tests)

            orchestrator = TDDOrchestrator(
                utest_agent=create_mock_utest_agent(test_suite),
                coding_agent=create_mock_coding_agent(impl),
                debugger_agent=create_mock_debugger_agent(
                    DebugAnalysis(failure_id="", root_cause="", fix_suggestion="", code_changes=[])
                ),
                reviewer_agent=create_mock_reviewer_agent(review),
                test_runner=mock_runner,
                config=config,
            )

            return await orchestrator.run_tdd_loop(
                context=context,
                task_description="Implement calculator",
                acceptance_criteria=["add works"],
            )

        # Run twice
        result1 = await run_retry_workflow()
        result2 = await run_retry_workflow()

        # Assert - Both succeeded with same retry count
        assert result1.success is True
        assert result2.success is True
        assert result1.retry_count == result2.retry_count == 1


class TestTDDWorkflowWithRealRedis:
    """E2E tests that require real Redis instance.

    These tests validate the full HITL-4 lifecycle with persistent storage.
    """

    @pytest.mark.asyncio
    async def test_hitl4_gate_lifecycle_with_approval(
        self,
        agent_context: AgentContext,
        sample_test_suite: TestSuite,
        sample_implementation: Implementation,
        passing_test_result: TestRunResult,
        passing_review: CodeReview,
        development_config: DevelopmentConfig,
        hitl_dispatcher: HITLDispatcher,
        mock_event_publisher: AsyncMock,
    ) -> None:
        """Test complete HITL-4 gate lifecycle: request -> pending -> approved.

        Requires Redis to be running.
        """
        # Arrange
        mock_utest = create_mock_utest_agent(sample_test_suite)
        mock_coding = create_mock_coding_agent(sample_implementation)
        mock_debugger = create_mock_debugger_agent(
            DebugAnalysis(failure_id="", root_cause="", fix_suggestion="", code_changes=[])
        )
        mock_reviewer = create_mock_reviewer_agent(passing_review)
        mock_runner = create_mock_test_runner(passing_test_result)

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest,
            coding_agent=mock_coding,
            debugger_agent=mock_debugger,
            reviewer_agent=mock_reviewer,
            test_runner=mock_runner,
            config=development_config,
            hitl_dispatcher=hitl_dispatcher,
        )

        # Act - Run TDD workflow
        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement calculator",
            acceptance_criteria=["add works"],
        )

        # Assert - Request created
        assert result.success is True
        assert result.hitl4_request_id is not None

        # Act - Simulate human approval
        decision = await hitl_dispatcher.record_decision(
            request_id=result.hitl4_request_id,
            approved=True,
            reviewer="e2e-test-reviewer",
            reason="Implementation meets quality standards",
            conditions=["Ensure tests are maintained"],
        )

        # Assert - Decision recorded
        assert decision.approved is True
        assert decision.reviewer == "e2e-test-reviewer"

        # Assert - Request status updated
        updated_request = await hitl_dispatcher.get_request_by_id(result.hitl4_request_id)
        assert updated_request.status == GateStatus.APPROVED

        # Assert - Events published
        approval_events = [
            e for e in mock_event_publisher.events
            if e.event_type == EventType.GATE_APPROVED
        ]
        assert len(approval_events) >= 1

    @pytest.mark.asyncio
    async def test_hitl4_gate_rejection(
        self,
        agent_context: AgentContext,
        sample_test_suite: TestSuite,
        sample_implementation: Implementation,
        passing_test_result: TestRunResult,
        passing_review: CodeReview,
        development_config: DevelopmentConfig,
        hitl_dispatcher: HITLDispatcher,
        mock_event_publisher: AsyncMock,
    ) -> None:
        """Test HITL-4 gate rejection scenario."""
        # Arrange
        mock_utest = create_mock_utest_agent(sample_test_suite)
        mock_coding = create_mock_coding_agent(sample_implementation)
        mock_debugger = create_mock_debugger_agent(
            DebugAnalysis(failure_id="", root_cause="", fix_suggestion="", code_changes=[])
        )
        mock_reviewer = create_mock_reviewer_agent(passing_review)
        mock_runner = create_mock_test_runner(passing_test_result)

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest,
            coding_agent=mock_coding,
            debugger_agent=mock_debugger,
            reviewer_agent=mock_reviewer,
            test_runner=mock_runner,
            config=development_config,
            hitl_dispatcher=hitl_dispatcher,
        )

        # Act - Run TDD workflow
        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement calculator",
            acceptance_criteria=["add works"],
        )

        # Act - Simulate human rejection
        decision = await hitl_dispatcher.record_decision(
            request_id=result.hitl4_request_id,
            approved=False,
            reviewer="e2e-test-reviewer",
            reason="Missing error handling for edge cases",
        )

        # Assert - Decision recorded
        assert decision.approved is False

        # Assert - Request status updated
        updated_request = await hitl_dispatcher.get_request_by_id(result.hitl4_request_id)
        assert updated_request.status == GateStatus.REJECTED

        # Assert - Rejection event published
        rejection_events = [
            e for e in mock_event_publisher.events
            if e.event_type == EventType.GATE_REJECTED
        ]
        assert len(rejection_events) >= 1


class TestTDDWorkflowErrorHandling:
    """E2E tests for error handling in TDD workflow."""

    @pytest.mark.asyncio
    async def test_handles_utest_failure_gracefully(
        self,
        agent_context: AgentContext,
        development_config: DevelopmentConfig,
    ) -> None:
        """Test that workflow handles UTest agent failure gracefully."""
        # Arrange - UTest that fails
        mock_utest = MagicMock()
        mock_utest.agent_type = "utest"
        mock_utest.execute = AsyncMock(
            return_value=AgentResult(
                success=False,
                agent_type="utest",
                task_id="test-task",
                error_message="Failed to parse acceptance criteria",
            )
        )

        mock_coding = MagicMock()
        mock_debugger = MagicMock()
        mock_reviewer = MagicMock()
        mock_runner = MagicMock()

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest,
            coding_agent=mock_coding,
            debugger_agent=mock_debugger,
            reviewer_agent=mock_reviewer,
            test_runner=mock_runner,
            config=development_config,
        )

        # Act
        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature works"],
        )

        # Assert - Failure captured
        assert result.success is False
        assert "Failed" in result.error_message
        assert result.implementation is None
        assert result.test_suite is None

    @pytest.mark.asyncio
    async def test_handles_coding_failure_gracefully(
        self,
        agent_context: AgentContext,
        sample_test_suite: TestSuite,
        development_config: DevelopmentConfig,
    ) -> None:
        """Test that workflow handles Coding agent failure gracefully."""
        # Arrange
        mock_utest = create_mock_utest_agent(sample_test_suite)

        mock_coding = MagicMock()
        mock_coding.agent_type = "coding"
        mock_coding.execute = AsyncMock(
            return_value=AgentResult(
                success=False,
                agent_type="coding",
                task_id="test-task",
                error_message="Failed to generate implementation",
            )
        )

        mock_debugger = MagicMock()
        mock_reviewer = MagicMock()
        mock_runner = MagicMock()

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest,
            coding_agent=mock_coding,
            debugger_agent=mock_debugger,
            reviewer_agent=mock_reviewer,
            test_runner=mock_runner,
            config=development_config,
        )

        # Act
        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature works"],
        )

        # Assert - Failure captured
        assert result.success is False
        assert "implementation" in result.error_message.lower()

    @pytest.mark.asyncio
    async def test_handles_test_runner_timeout(
        self,
        agent_context: AgentContext,
        sample_test_suite: TestSuite,
        sample_implementation: Implementation,
        development_config: DevelopmentConfig,
    ) -> None:
        """Test that workflow handles test runner timeout gracefully."""
        from src.workers.agents.development.test_runner import TestTimeoutError

        # Arrange
        mock_utest = create_mock_utest_agent(sample_test_suite)
        mock_coding = create_mock_coding_agent(sample_implementation)
        mock_debugger = MagicMock()
        mock_reviewer = MagicMock()

        # Test runner that times out
        mock_runner = MagicMock()
        mock_runner.run_tests = MagicMock(
            side_effect=TestTimeoutError("Tests timed out after 30 seconds")
        )

        orchestrator = TDDOrchestrator(
            utest_agent=mock_utest,
            coding_agent=mock_coding,
            debugger_agent=mock_debugger,
            reviewer_agent=mock_reviewer,
            test_runner=mock_runner,
            config=development_config,
        )

        # Act
        result = await orchestrator.run_tdd_loop(
            context=agent_context,
            task_description="Implement feature",
            acceptance_criteria=["Feature works"],
        )

        # Assert - Timeout failure captured
        assert result.success is False
        assert "timeout" in result.error_message.lower() or "timed out" in result.error_message.lower()


# Cleanup fixture
@pytest.fixture(autouse=True)
async def cleanup_redis_keys(redis_client, unique_session_id, unique_task_id):
    """Clean up Redis keys after each test."""
    yield

    if redis_client:
        # Clean up test keys
        patterns = [
            "asdlc:gate_request:*",
            "asdlc:evidence_bundle:*",
            f"asdlc:decision_log:{unique_task_id}",
            "asdlc:pending_gates:*",
        ]

        for pattern in patterns:
            try:
                keys = await redis_client.keys(pattern)
                if keys:
                    await redis_client.delete(*keys)
            except Exception:
                pass  # Ignore cleanup errors
