"""TDD Orchestrator for coordinating the test-driven development loop.

Manages the TDD workflow by sequencing UTest, Coding, TestRunner, Debugger,
and Reviewer agents with retry logic and escalation.
"""

from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING, Any, Protocol

from src.workers.agents.development.config import DevelopmentConfig
from src.workers.agents.development.models import (
    CodeReview,
    DebugAnalysis,
    DevelopmentResult,
    Implementation,
    TestRunResult,
    TestSuite,
)
from src.workers.agents.protocols import AgentContext, AgentResult

if TYPE_CHECKING:
    from src.orchestrator.hitl_dispatcher import HITLDispatcher
    from src.workers.agents.development.coding_agent import CodingAgent
    from src.workers.agents.development.debugger_agent import DebuggerAgent
    from src.workers.agents.development.reviewer_agent import ReviewerAgent
    from src.workers.agents.development.test_runner import TestRunner
    from src.workers.agents.development.utest_agent import UTestAgent

logger = logging.getLogger(__name__)


class TDDOrchestratorError(Exception):
    """Raised when TDD orchestration fails."""

    pass


class TDDOrchestrator:
    """Orchestrator for the Test-Driven Development loop.

    Coordinates the TDD workflow by sequencing agents in this order:
    1. UTestAgent generates test cases from acceptance criteria
    2. CodingAgent generates implementation to pass tests
    3. TestRunner executes tests
    4. If tests pass: ReviewerAgent reviews code
    5. If review passes: Success, return result
    6. If tests fail or review fails:
       - Increment fail_count
       - If fail_count <= max_retries: CodingAgent retries with test errors
       - If fail_count > max_retries: Escalate to DebuggerAgent
       - Apply debug fixes and retry CodingAgent

    Example:
        orchestrator = TDDOrchestrator(
            utest_agent=utest,
            coding_agent=coding,
            debugger_agent=debugger,
            reviewer_agent=reviewer,
            test_runner=runner,
            config=DevelopmentConfig(),
        )
        result = await orchestrator.run_tdd_loop(
            context=context,
            task_description="Implement feature X",
            acceptance_criteria=["Should do Y", "Should handle Z"],
        )
    """

    def __init__(
        self,
        utest_agent: UTestAgent,
        coding_agent: CodingAgent,
        debugger_agent: DebuggerAgent,
        reviewer_agent: ReviewerAgent,
        test_runner: TestRunner,
        config: DevelopmentConfig | None = None,
        hitl_dispatcher: HITLDispatcher | None = None,
    ) -> None:
        """Initialize the TDD orchestrator.

        Args:
            utest_agent: Agent for generating test cases.
            coding_agent: Agent for generating implementation.
            debugger_agent: Agent for debugging failures.
            reviewer_agent: Agent for reviewing code.
            test_runner: Utility for running tests.
            config: Development configuration. Uses defaults if not provided.
            hitl_dispatcher: HITL dispatcher for gate submissions. Optional.
        """
        self._utest_agent = utest_agent
        self._coding_agent = coding_agent
        self._debugger_agent = debugger_agent
        self._reviewer_agent = reviewer_agent
        self._test_runner = test_runner
        self._config = config or DevelopmentConfig()
        self._hitl_dispatcher = hitl_dispatcher

    async def run_tdd_loop(
        self,
        context: AgentContext,
        task_description: str,
        acceptance_criteria: list[str],
    ) -> DevelopmentResult:
        """Run the complete TDD development loop.

        Args:
            context: Execution context with session/task info.
            task_description: Description of the implementation task.
            acceptance_criteria: List of acceptance criteria to satisfy.

        Returns:
            DevelopmentResult: Result containing implementation, tests,
                test results, and review.
        """
        logger.info(f"Starting TDD loop for task {context.task_id}")

        # Step 1: Generate tests from acceptance criteria
        test_suite_result = await self._run_utest_agent(
            context=context,
            task_description=task_description,
            acceptance_criteria=acceptance_criteria,
        )

        if not test_suite_result.success:
            logger.error(f"UTest failed: {test_suite_result.error_message}")
            return DevelopmentResult.failed(
                error_message=test_suite_result.error_message or "Failed to generate tests",
            )

        test_suite = self._extract_test_suite(test_suite_result)
        if not test_suite:
            return DevelopmentResult.failed(
                error_message="Failed to extract test suite from UTest result",
            )

        # Initialize loop variables
        fail_count = 0
        implementation: Implementation | None = None
        test_result: TestRunResult | None = None
        review: CodeReview | None = None
        debug_analysis: DebugAnalysis | None = None
        previous_implementation: str = ""
        test_errors: list[str] = []

        # TDD loop with retry and escalation
        while True:
            # Step 2: Generate implementation
            coding_result = await self._run_coding_agent(
                context=context,
                task_description=task_description,
                test_suite=test_suite,
                fail_count=fail_count,
                previous_implementation=previous_implementation,
                test_errors=test_errors,
                debug_analysis=debug_analysis,
            )

            if not coding_result.success:
                logger.error(f"Coding failed: {coding_result.error_message}")
                return DevelopmentResult.failed(
                    error_message=coding_result.error_message or "Failed to generate implementation",
                    retry_count=fail_count,
                )

            implementation = self._extract_implementation(coding_result)
            if not implementation:
                return DevelopmentResult.failed(
                    error_message="Failed to extract implementation from Coding result",
                    retry_count=fail_count,
                )

            # Store implementation string for retry context
            previous_implementation = self._implementation_to_string(implementation)

            # Step 3: Run tests
            try:
                test_result = await self._run_tests(
                    context=context,
                    test_suite=test_suite,
                    implementation=implementation,
                )
            except Exception as e:
                logger.error(f"Test execution failed: {e}")
                return DevelopmentResult.failed(
                    error_message=f"Test execution failed: {e}",
                    retry_count=fail_count,
                )

            # Step 4: Check test results
            if test_result.all_passed():
                # Tests pass - proceed to review
                logger.info("Tests passed, proceeding to review")
                review_result = await self._run_reviewer_agent(
                    context=context,
                    implementation=implementation,
                    test_suite=test_suite,
                    test_result=test_result,
                )

                if not review_result.success:
                    logger.error(f"Review execution failed: {review_result.error_message}")
                    return DevelopmentResult.failed(
                        error_message=review_result.error_message or "Review failed",
                        retry_count=fail_count,
                    )

                review = self._extract_review(review_result)
                review_passed = review_result.metadata.get("passed", False) if review_result.metadata else False

                if review_passed:
                    # Success! Submit to HITL-4 if dispatcher is available
                    logger.info(f"TDD loop completed successfully after {fail_count} retries")

                    hitl4_request_id = None
                    hitl4_status = None
                    hitl4_reason = None

                    if self._hitl_dispatcher:
                        gate_request = await self._submit_hitl4_evidence(
                            context=context,
                            task_description=task_description,
                            implementation=implementation,
                            test_suite=test_suite,
                            test_result=test_result,
                            review=review,
                        )
                        hitl4_request_id = gate_request.request_id

                        # Check if already rejected (synchronous rejection)
                        from src.orchestrator.evidence_bundle import GateStatus
                        if gate_request.status == GateStatus.REJECTED:
                            hitl4_status = "rejected"
                            hitl4_reason = (
                                gate_request.decision.reason
                                if gate_request.decision
                                else "No reason provided"
                            )
                            return DevelopmentResult(
                                success=False,
                                implementation=implementation,
                                test_suite=test_suite,
                                test_result=test_result,
                                review=review,
                                hitl4_request_id=hitl4_request_id,
                                retry_count=fail_count,
                                metadata={
                                    "hitl4_status": hitl4_status,
                                    "hitl4_reason": hitl4_reason,
                                },
                            )

                    return DevelopmentResult.succeeded(
                        implementation=implementation,
                        test_suite=test_suite,
                        test_result=test_result,
                        review=review,
                        hitl4_request_id=hitl4_request_id,
                        retry_count=fail_count,
                    )
                else:
                    # Review failed - treat as failure and retry
                    logger.warning(f"Review failed, incrementing fail_count to {fail_count + 1}")
                    fail_count += 1
                    test_errors = self._extract_review_issues(review)
                    debug_analysis = None  # Reset debug analysis for non-test failures
            else:
                # Tests failed - increment fail_count
                logger.warning(f"Tests failed: {test_result.failed} failures")
                fail_count += 1
                test_errors = self._extract_test_errors(test_result)

                # Check if we should escalate to debugger
                if fail_count > self._config.max_coding_retries:
                    logger.info(f"Exceeded max retries ({self._config.max_coding_retries}), escalating to debugger")

                    debugger_result = await self._run_debugger_agent(
                        context=context,
                        test_output=self._format_test_output(test_result),
                        implementation=previous_implementation,
                        test_code=test_suite.to_python_code(),
                    )

                    if debugger_result.success:
                        debug_analysis = self._extract_debug_analysis(debugger_result)
                    else:
                        logger.warning(f"Debugger failed: {debugger_result.error_message}")
                        # Continue without debug analysis

            # Safety check for infinite loops
            if fail_count > self._config.max_coding_retries + 5:
                logger.error("Exceeded maximum iterations, aborting TDD loop")
                return DevelopmentResult.failed(
                    error_message="Exceeded maximum TDD loop iterations",
                    retry_count=fail_count,
                )

    async def _run_utest_agent(
        self,
        context: AgentContext,
        task_description: str,
        acceptance_criteria: list[str],
    ) -> AgentResult:
        """Run the UTest agent to generate tests.

        Args:
            context: Execution context.
            task_description: Task description.
            acceptance_criteria: Acceptance criteria.

        Returns:
            AgentResult: Result from UTest agent.
        """
        event_metadata = {
            "task_description": task_description,
            "acceptance_criteria": acceptance_criteria,
        }

        return await self._utest_agent.execute(
            context=context,
            event_metadata=event_metadata,
        )

    async def _run_coding_agent(
        self,
        context: AgentContext,
        task_description: str,
        test_suite: TestSuite,
        fail_count: int,
        previous_implementation: str,
        test_errors: list[str],
        debug_analysis: DebugAnalysis | None,
    ) -> AgentResult:
        """Run the Coding agent to generate implementation.

        Args:
            context: Execution context.
            task_description: Task description.
            test_suite: Test suite to satisfy.
            fail_count: Number of failed attempts.
            previous_implementation: Previous implementation code.
            test_errors: List of test error messages.
            debug_analysis: Debug analysis from debugger (if any).

        Returns:
            AgentResult: Result from Coding agent.
        """
        event_metadata: dict[str, Any] = {
            "task_description": task_description,
            "test_code": test_suite.to_python_code(),
            "fail_count": fail_count,
        }

        if previous_implementation:
            event_metadata["previous_implementation"] = previous_implementation

        if test_errors:
            event_metadata["test_errors"] = test_errors

        if debug_analysis:
            event_metadata["debug_analysis"] = debug_analysis.to_dict()

        return await self._coding_agent.execute(
            context=context,
            event_metadata=event_metadata,
        )

    async def _run_tests(
        self,
        context: AgentContext,
        test_suite: TestSuite,
        implementation: Implementation,
    ) -> TestRunResult:
        """Run tests using the test runner.

        Args:
            context: Execution context.
            test_suite: Test suite to run.
            implementation: Implementation to test.

        Returns:
            TestRunResult: Test execution results.
        """
        # For now, we use a mock approach where test files are expected
        # to be written by the agents. In a real implementation, we would
        # write the files to a temporary directory and run pytest.
        workspace_path = Path(context.workspace_path)
        test_path = workspace_path / "tests"

        # Run tests
        return self._test_runner.run_tests(
            test_path=test_path,
            suite_id=test_suite.task_id,
        )

    async def _run_reviewer_agent(
        self,
        context: AgentContext,
        implementation: Implementation,
        test_suite: TestSuite,
        test_result: TestRunResult,
    ) -> AgentResult:
        """Run the Reviewer agent to review code.

        Args:
            context: Execution context.
            implementation: Implementation to review.
            test_suite: Test suite.
            test_result: Test results.

        Returns:
            AgentResult: Result from Reviewer agent.
        """
        event_metadata = {
            "implementation": self._implementation_to_string(implementation),
            "test_suite": test_suite.to_python_code(),
            "test_results": self._format_test_output(test_result),
        }

        return await self._reviewer_agent.execute(
            context=context,
            event_metadata=event_metadata,
        )

    async def _run_debugger_agent(
        self,
        context: AgentContext,
        test_output: str,
        implementation: str,
        test_code: str,
    ) -> AgentResult:
        """Run the Debugger agent to analyze failures.

        Args:
            context: Execution context.
            test_output: Test failure output.
            implementation: Implementation code.
            test_code: Test code.

        Returns:
            AgentResult: Result from Debugger agent.
        """
        event_metadata = {
            "test_output": test_output,
            "implementation": implementation,
            "test_code": test_code,
        }

        return await self._debugger_agent.execute(
            context=context,
            event_metadata=event_metadata,
        )

    def _extract_test_suite(self, result: AgentResult) -> TestSuite | None:
        """Extract test suite from agent result.

        Args:
            result: Agent result containing test suite.

        Returns:
            TestSuite | None: Extracted test suite or None.
        """
        if not result.metadata:
            return None

        test_suite_data = result.metadata.get("test_suite")
        if not test_suite_data:
            return None

        if isinstance(test_suite_data, TestSuite):
            return test_suite_data

        return TestSuite.from_dict(test_suite_data)

    def _extract_implementation(self, result: AgentResult) -> Implementation | None:
        """Extract implementation from agent result.

        Args:
            result: Agent result containing implementation.

        Returns:
            Implementation | None: Extracted implementation or None.
        """
        if not result.metadata:
            return None

        impl_data = result.metadata.get("implementation")
        if not impl_data:
            return None

        if isinstance(impl_data, Implementation):
            return impl_data

        return Implementation.from_dict(impl_data)

    def _extract_review(self, result: AgentResult) -> CodeReview | None:
        """Extract code review from agent result.

        Args:
            result: Agent result containing review.

        Returns:
            CodeReview | None: Extracted code review or None.
        """
        if not result.metadata:
            return None

        review_data = result.metadata.get("review")
        if not review_data:
            return None

        if isinstance(review_data, CodeReview):
            return review_data

        return CodeReview.from_dict(review_data)

    def _extract_debug_analysis(self, result: AgentResult) -> DebugAnalysis | None:
        """Extract debug analysis from agent result.

        Args:
            result: Agent result containing debug analysis.

        Returns:
            DebugAnalysis | None: Extracted debug analysis or None.
        """
        if not result.metadata:
            return None

        analysis_data = result.metadata.get("debug_analysis")
        if not analysis_data:
            return None

        if isinstance(analysis_data, DebugAnalysis):
            return analysis_data

        return DebugAnalysis.from_dict(analysis_data)

    def _extract_test_errors(self, test_result: TestRunResult) -> list[str]:
        """Extract error messages from test results.

        Args:
            test_result: Test run result.

        Returns:
            list[str]: List of error messages.
        """
        errors = []
        for result in test_result.results:
            if not result.passed and result.error:
                errors.append(result.error)
        return errors

    def _extract_review_issues(self, review: CodeReview | None) -> list[str]:
        """Extract issue descriptions from code review.

        Args:
            review: Code review result.

        Returns:
            list[str]: List of issue descriptions.
        """
        if not review:
            return []

        return [
            f"{issue.severity.value.upper()}: {issue.description}"
            for issue in review.issues
        ]

    def _implementation_to_string(self, implementation: Implementation) -> str:
        """Convert implementation to string representation.

        Args:
            implementation: Implementation to convert.

        Returns:
            str: String representation of implementation files.
        """
        parts = []
        for code_file in implementation.files:
            parts.append(f"# File: {code_file.path}")
            parts.append(code_file.content)
            parts.append("")
        return "\n".join(parts)

    def _format_test_output(self, test_result: TestRunResult) -> str:
        """Format test result as string output.

        Args:
            test_result: Test run result.

        Returns:
            str: Formatted test output.
        """
        lines = [
            f"Test Suite: {test_result.suite_id}",
            f"Passed: {test_result.passed}",
            f"Failed: {test_result.failed}",
            f"Coverage: {test_result.coverage}%",
            "",
            "Results:",
        ]

        for result in test_result.results:
            status = "PASSED" if result.passed else "FAILED"
            lines.append(f"  {result.test_id}: {status}")
            if result.error:
                lines.append(f"    Error: {result.error}")

        return "\n".join(lines)

    async def _submit_hitl4_evidence(
        self,
        context: AgentContext,
        task_description: str,
        implementation: Implementation,
        test_suite: TestSuite,
        test_result: TestRunResult,
        review: CodeReview,
    ) -> Any:
        """Build and submit HITL-4 evidence bundle.

        Args:
            context: Execution context.
            task_description: Description of the implementation task.
            implementation: Final implementation.
            test_suite: Test suite.
            test_result: Test results.
            review: Code review.

        Returns:
            GateRequest from the dispatcher.
        """
        from src.orchestrator.evidence_bundle import EvidenceBundle, EvidenceItem, GateType

        # Build evidence items
        evidence_items = []

        # 1. Implementation artifact
        impl_content = self._implementation_to_string(implementation)
        impl_hash = hashlib.sha256(impl_content.encode()).hexdigest()
        file_paths = [f.path for f in implementation.files]

        evidence_items.append(
            EvidenceItem(
                item_type="artifact",
                path=file_paths[0] if file_paths else "implementation",
                description=f"Implementation with {len(implementation.files)} file(s)",
                content_hash=impl_hash,
                metadata={
                    "files": file_paths,
                    "imports": implementation.imports,
                    "dependencies": implementation.dependencies,
                },
            )
        )

        # 2. Test suite
        test_code = test_suite.to_python_code()
        test_hash = hashlib.sha256(test_code.encode()).hexdigest()

        evidence_items.append(
            EvidenceItem(
                item_type="test_suite",
                path=f"tests/{test_suite.task_id}_test.py",
                description=f"Test suite with {len(test_suite.test_cases)} test case(s)",
                content_hash=test_hash,
                metadata={
                    "test_count": len(test_suite.test_cases),
                    "fixtures": test_suite.fixtures,
                },
            )
        )

        # 3. Test results
        test_result_str = self._format_test_output(test_result)
        result_hash = hashlib.sha256(test_result_str.encode()).hexdigest()

        evidence_items.append(
            EvidenceItem(
                item_type="test_result",
                path=f"results/{test_result.suite_id}",
                description=f"Test results: {test_result.passed} passed, {test_result.failed} failed",
                content_hash=result_hash,
                metadata={
                    "passed": test_result.passed,
                    "failed": test_result.failed,
                    "coverage": test_result.coverage,
                    "all_passed": test_result.all_passed(),
                },
            )
        )

        # 4. Code review
        review_content = review.to_markdown() if hasattr(review, "to_markdown") else str(review.to_dict())
        review_hash = hashlib.sha256(review_content.encode()).hexdigest()

        evidence_items.append(
            EvidenceItem(
                item_type="review",
                path=f"reviews/{review.implementation_id}",
                description=f"Code review: {'PASSED' if review.passed else 'FAILED'}",
                content_hash=review_hash,
                metadata={
                    "passed": review.passed,
                    "issue_count": len(review.issues),
                    "security_concerns": len(review.security_concerns),
                    "suggestions": review.suggestions,
                },
            )
        )

        # Build summary
        total_tests = len(test_suite.test_cases)
        test_word = "test" if total_tests == 1 else "tests"
        summary = (
            f"TDD implementation for: {task_description}\n"
            f"Files: {len(implementation.files)} | "
            f"Tests: {total_tests} {test_word} | "
            f"Coverage: {test_result.coverage}% | "
            f"Review: {'PASSED' if review.passed else 'FAILED'}"
        )

        # Create evidence bundle
        evidence_bundle = EvidenceBundle.create(
            task_id=context.task_id,
            gate_type=GateType.HITL_4_CODE,
            git_sha="",  # Will be filled by dispatcher or caller
            items=evidence_items,
            summary=summary,
        )

        # Submit to dispatcher
        logger.info(f"Submitting HITL-4 evidence bundle for task {context.task_id}")

        gate_request = await self._hitl_dispatcher.request_gate(
            task_id=context.task_id,
            session_id=context.session_id,
            gate_type=GateType.HITL_4_CODE,
            evidence_bundle=evidence_bundle,
            requested_by="tdd_orchestrator",
        )

        logger.info(f"HITL-4 gate request created: {gate_request.request_id}")
        return gate_request
